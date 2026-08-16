import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";

import {
  INTERBANK_SYNC_CONCURRENCY,
  applyInterbankLocalFilter,
  loadInterbankTransfersProgressively,
  mergeInterbankSnapshot,
  requestInterbankPage,
  retainCompletedInterbankSnapshot,
} from "../src/modules/interbank/interbankLoader.js";
import {
  canPrefetchNextBankInboundPage,
  createBankInboundQueryOptions,
  getBankInboundDashboardQueryKey,
  getBankInboundQueryKey,
} from "../src/modules/bankInbound/bankInboundQuery.js";
import {
  buildBankInboundDashboardParams,
  buildBankInboundParams,
  normalizeBankInboundDashboard,
} from "../src/services/bankInbound.service.js";
import {
  buildInterbankParams,
  buildInterbankStats,
  normalizeInterbankTransfers,
} from "../src/utils/interbank.js";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const record = (id, overrides = {}) => ({ id, name: id, ...overrides });

test("preserva los parametros de InterBank y BankInbound", async () => {
  const filters = {
    name: "Ana",
    socioId: "12",
    identification: "001",
    noAccountBank: "bank",
    noAccountCoop: "coop",
    updatedBy: "admin",
    isSubmit: "false",
    isPriority: "true",
    isCancelled: "",
    createdAt: "2026-08-01",
    updatedAt: "",
  };
  assert.deepEqual(buildInterbankParams(filters, 3, 200), {
    Name: "Ana",
    SocioId: "12",
    Identification: "001",
    NoAccountBank: "bank",
    NoAccountCoop: "coop",
    UpdatedBy: "admin",
    IsSubmit: false,
    IsPriority: true,
    CreatedAt: new Date("2026-08-01").toISOString(),
    PageNumber: 3,
    PageSize: 200,
  });

  const bankFilters = {
    nameBank: "Popular",
    socioId: "42",
    amount: "1500",
    isConfirm: "PENDIENTE",
    updatedBy: "",
    createdAt: "2026-08-01",
    updatedAt: "",
  };
  assert.deepEqual(buildBankInboundParams(bankFilters, 2, 10), {
    NameBank: "Popular",
    SocioId: 42,
    Amount: 1500,
    IsConfirm: "PENDIENTE",
    CreatedAt: "2026-08-01",
    PageNumber: 2,
    PageSize: 10,
  });

  let requestConfig;
  const signal = new AbortController().signal;
  await requestInterbankPage({
    client: {
      get: async (url, config) => {
        requestConfig = { url, ...config };
        return { data: { data: [record("1")] } };
      },
    },
    baseUrl: "https://example.test/api/v1",
    filters,
    pageNumber: 3,
    signal,
  });
  assert.equal(
    requestConfig.url,
    "https://example.test/api/v1/InterBank/Transactions",
  );
  assert.equal(requestConfig.signal, signal);
  assert.deepEqual(requestConfig.params, buildInterbankParams(filters, 3, 200));
});

test("normaliza, filtra y resume sin cambiar el orden", () => {
  const normalized = normalizeInterbankTransfers([
    {
      id: "first",
      name: "Ana Perez",
      amount: 100,
      isPriority: true,
      isSubmit: false,
      createdAt: "2026-08-01T10:00:00Z",
    },
    {
      id: "second",
      name: "Luis",
      amount: 50,
      isSubmit: true,
      createdAt: "2026-08-02T10:00:00Z",
    },
  ]);
  assert.deepEqual(normalized.map(({ id }) => id), ["first", "second"]);
  assert.deepEqual(
    applyInterbankLocalFilter(normalized, {
      name: "ana",
      isPriority: "true",
    }).map(({ id }) => id),
    ["first"],
  );
  assert.deepEqual(buildInterbankStats(normalized), {
    total: 2,
    pending: 1,
    approved: 1,
    cancelled: 0,
    priority: 1,
    totalAmount: 150,
  });
});

test("publica la primera pagina antes del historial y limita concurrencia", async () => {
  let active = 0;
  let maxActive = 0;
  let current = [];
  let resolveFirstPublish;
  const firstPublish = new Promise((resolve) => {
    resolveFirstPublish = resolve;
  });

  const loading = loadInterbankTransfersProgressively({
    pageSize: 2,
    maxPages: 8,
    concurrency: INTERBANK_SYNC_CONCURRENCY,
    getCurrent: () => current,
    publish: (records) => {
      current = records;
      if (records.length === 2) resolveFirstPublish(records);
    },
    fetchPage: async (pageNumber) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(pageNumber === 1 ? 5 : 30);
      active -= 1;
      return pageNumber < 5
        ? [record(`${pageNumber}-a`), record(`${pageNumber}-b`)]
        : [record(`${pageNumber}-last`)];
    },
  });

  const available = await firstPublish;
  assert.equal(available.length, 2);
  assert.equal(current.length, 2);
  const result = await loading;
  assert.equal(result.status, "complete");
  assert.equal(result.loadedPages, 5);
  assert.ok(maxActive <= INTERBANK_SYNC_CONCURRENCY);
  assert.deepEqual(current.map(({ id }) => id), [
    "1-a",
    "1-b",
    "2-a",
    "2-b",
    "3-a",
    "3-b",
    "4-a",
    "4-b",
    "5-last",
  ]);
});

test("descarta paginas especulativas posteriores a la pagina terminal", async () => {
  let current = [];
  const requested = [];
  const result = await loadInterbankTransfersProgressively({
    pageSize: 2,
    maxPages: 10,
    concurrency: 3,
    getCurrent: () => current,
    publish: (records) => {
      current = records;
    },
    fetchPage: async (pageNumber) => {
      requested.push(pageNumber);
      if (pageNumber === 1) return [record("1-a"), record("1-b")];
      if (pageNumber === 2) return [record("2-last")];
      return [record(`${pageNumber}-a`), record(`${pageNumber}-b`)];
    },
  });
  assert.deepEqual(requested, [1, 2, 3, 4]);
  assert.deepEqual(result.records.map(({ id }) => id), ["1-a", "1-b", "2-last"]);
});

test("reporta el limite de seguridad como sincronizacion incompleta", async () => {
  let state;
  const result = await loadInterbankTransfersProgressively({
    pageSize: 1,
    maxPages: 4,
    concurrency: 2,
    fetchPage: async (pageNumber) => [record(String(pageNumber))],
    onStateChange: (next) => {
      state = next;
    },
  });
  assert.equal(result.status, "incomplete");
  assert.equal(result.loadedPages, 4);
  assert.equal(state.status, "incomplete");
  assert.match(state.error.message, /safety limit/);
});

test("deduplica ids y conserva actualizaciones externas durante la carga", async () => {
  let current = [];
  let firstPublished;
  const waitForFirst = new Promise((resolve) => {
    firstPublished = resolve;
  });
  let releaseBackground;
  const background = new Promise((resolve) => {
    releaseBackground = resolve;
  });

  const loading = loadInterbankTransfersProgressively({
    pageSize: 2,
    maxPages: 4,
    concurrency: 2,
    getCurrent: () => current,
    publish: (records) => {
      current = records;
      if (records.length === 2) firstPublished();
    },
    fetchPage: async (pageNumber) => {
      if (pageNumber === 1)
        return [record("shared", { name: "api-old" }), record("first")];
      await background;
      if (pageNumber === 2)
        return [record("shared", { name: "api-new" }), record("second")];
      return [];
    },
  });

  await waitForFirst;
  current = current.map((item) =>
    item.id === "shared" ? { ...item, name: "signalr-newest" } : item,
  );
  current = [record("live", { name: "live" }), ...current];
  releaseBackground();
  const result = await loading;

  assert.deepEqual(result.records.map(({ id }) => id), [
    "shared",
    "first",
    "second",
    "live",
  ]);
  assert.equal(result.records[0].name, "signalr-newest");
});

test("conserva resultados parciales cuando falla una pagina posterior", async () => {
  let current = [];
  let state;
  const result = await loadInterbankTransfersProgressively({
    pageSize: 2,
    maxPages: 4,
    concurrency: 2,
    getCurrent: () => current,
    publish: (records) => {
      current = records;
    },
    onStateChange: (next) => {
      state = next;
    },
    fetchPage: async (pageNumber) => {
      if (pageNumber === 1) return [record("a"), record("b")];
      if (pageNumber === 2) throw new Error("network down");
      return [];
    },
  });
  assert.equal(result.status, "incomplete");
  assert.deepEqual(current.map(({ id }) => id), ["a", "b"]);
  assert.equal(state.status, "incomplete");
  assert.match(state.error.message, /network down/);
});

test("un reintento reemplaza una sincronizacion parcial con el historial completo", async () => {
  let current = [];
  let failBackground = true;
  const run = () =>
    loadInterbankTransfersProgressively({
      pageSize: 2,
      maxPages: 3,
      concurrency: 2,
      getCurrent: () => current,
      publish: (records) => {
        current = records;
      },
      fetchPage: async (pageNumber) => {
        if (pageNumber === 1) return [record("a"), record("b")];
        if (pageNumber === 2 && failBackground) throw new Error("temporary");
        if (pageNumber === 2) return [record("c")];
        return [];
      },
    });

  assert.equal((await run()).status, "incomplete");
  failBackground = false;
  const retried = await run();
  assert.equal(retried.status, "complete");
  assert.deepEqual(retried.records.map(({ id }) => id), ["a", "b", "c"]);
});

test("impide publicar cargas abortadas o reemplazadas", async () => {
  const controller = new AbortController();
  let publishes = 0;
  await assert.rejects(
    loadInterbankTransfersProgressively({
      signal: controller.signal,
      pageSize: 1,
      publish: () => {
        publishes += 1;
      },
      fetchPage: async () => {
        controller.abort();
        return [record("late")];
      },
    }),
    { name: "AbortError" },
  );
  assert.equal(publishes, 0);

  let currentGeneration = true;
  await assert.rejects(
    loadInterbankTransfersProgressively({
      pageSize: 1,
      isCurrent: () => currentGeneration,
      fetchPage: async () => {
        currentGeneration = false;
        return [record("stale")];
      },
    }),
    { name: "AbortError" },
  );
});

test("fusiona snapshots completos sin duplicar y preserva ids protegidos", () => {
  const live = record("same", { name: "live" });
  assert.deepEqual(
    mergeInterbankSnapshot({
      apiRecords: [record("same", { name: "api" }), record("api")],
      currentRecords: [live, record("removed")],
      protectedRecords: new Map([["same", live]]),
      complete: true,
    }),
    [live, record("api")],
  );
});

test("mantiene estable el resumen hasta recibir un snapshot completo", () => {
  const complete = [record("complete")];
  const partial = [record("partial")];

  assert.equal(
    retainCompletedInterbankSnapshot(complete, partial, "syncing"),
    complete,
  );
  assert.equal(
    retainCompletedInterbankSnapshot(complete, partial, "incomplete"),
    complete,
  );
  assert.equal(
    retainCompletedInterbankSnapshot(complete, partial, "complete"),
    partial,
  );
  assert.equal(
    retainCompletedInterbankSnapshot(null, partial, "syncing"),
    null,
  );
});

test("construye claves y elegibilidad de prefetch de BankInbound", () => {
  const filters = { isConfirm: "PENDIENTE" };
  assert.deepEqual(
    getBankInboundQueryKey({ filters, pageNumber: 2, pageSize: 10 }),
    ["bank-inbound", { filters, pageNumber: 2, pageSize: 10 }],
  );
  assert.equal(canPrefetchNextBankInboundPage({ data: Array(10) }, 10), true);
  assert.equal(canPrefetchNextBankInboundPage({ data: Array(9) }, 10), false);
  assert.equal(canPrefetchNextBankInboundPage(null, 10), false);
});

test("preserva el contrato y normaliza las metricas de BankInbound Dashboard", () => {
  const filters = {
    amount: "950000",
    createdAt: "2026-08-01",
    updatedAt: "2026-08-02",
    socioId: "20137",
    updatedBy: "admin",
    nameBank: "Banreservas",
    isConfirm: "PENDIENTE",
  };

  assert.deepEqual(buildBankInboundDashboardParams(filters), {
    amount: 950000,
    createdAt: new Date("2026-08-01").toISOString(),
    updatedAt: new Date("2026-08-02").toISOString(),
    socioId: 20137,
    updatedBy: "admin",
    nameBank: "Banreservas",
  });
  assert.deepEqual(getBankInboundDashboardQueryKey(filters), [
    "bank-inbound-dashboard",
    { filters },
  ]);
  assert.deepEqual(
    normalizeBankInboundDashboard({
      totalSolicitudes: 5,
      pendientes: 1,
      confirmadas: 0,
      canceladas: 4,
      montoTotal: 950000,
    }),
    {
      totalSolicitudes: 5,
      pendientes: 1,
      confirmadas: 0,
      canceladas: 4,
      montoTotal: 950000,
    },
  );
  assert.deepEqual(normalizeBankInboundDashboard(null), {
    totalSolicitudes: 0,
    pendientes: 0,
    confirmadas: 0,
    canceladas: 0,
    montoTotal: 0,
  });
});

test("BankInbound retiene datos, deduplica prefetch y propaga cancelacion", async () => {
  const filters = { isConfirm: "PENDIENTE" };
  let requests = 0;
  let receivedSignal;
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const fetchPage = async ({ pageNumber, signal }) => {
    requests += 1;
    receivedSignal = signal;
    await pending;
    if (signal.aborted) {
      const error = new Error("cancelled");
      error.name = "AbortError";
      throw error;
    }
    return { data: [record(String(pageNumber))] };
  };
  const options = createBankInboundQueryOptions({
    filters,
    pageNumber: 2,
    pageSize: 10,
    fetchPage,
  });
  const previous = { data: [record("previous")] };
  assert.equal(options.placeholderData(previous), previous);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const first = queryClient.prefetchQuery(options);
  const duplicate = queryClient.prefetchQuery(options);
  await delay(1);
  assert.equal(requests, 1);
  await queryClient.cancelQueries({ queryKey: options.queryKey, exact: true });
  assert.equal(receivedSignal.aborted, true);
  release();
  await Promise.all([first, duplicate]);
  queryClient.clear();
});
