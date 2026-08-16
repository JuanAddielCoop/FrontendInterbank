import {
  buildInterbankParams,
  normalizeInterbankTransfers,
} from "../../utils/interbank.js";

export const INTERBANK_API_PAGE_SIZE = 200;
export const INTERBANK_MAX_API_PAGES = 100;
export const INTERBANK_SYNC_CONCURRENCY = 3;

export const getInterbankResponseRecords = (response) => {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

export const requestInterbankPage = async ({
  client,
  baseUrl,
  filters,
  pageNumber,
  pageSize = INTERBANK_API_PAGE_SIZE,
  signal,
}) => {
  const response = await client.get(`${baseUrl}/InterBank/Transactions`, {
    signal,
    params: buildInterbankParams(filters, pageNumber, pageSize),
  });
  return getInterbankResponseRecords(response);
};

const getRecordMap = (records) =>
  new Map(records.map((record) => [record.id, record]));

const collectExternalUpdates = (current, lastPublished, protectedRecords) => {
  const previous = getRecordMap(lastPublished);
  current.forEach((record) => {
    if (!previous.has(record.id) || previous.get(record.id) !== record) {
      protectedRecords.set(record.id, record);
    }
  });
};

export const mergeInterbankSnapshot = ({
  apiRecords,
  currentRecords = [],
  protectedRecords = new Map(),
  complete = false,
}) => {
  const merged = [];
  const seen = new Set();

  apiRecords.forEach((record) => {
    if (seen.has(record.id)) return;
    merged.push(protectedRecords.get(record.id) ?? record);
    seen.add(record.id);
  });

  currentRecords.forEach((record) => {
    if (seen.has(record.id)) return;
    if (!complete || protectedRecords.has(record.id)) {
      merged.push(protectedRecords.get(record.id) ?? record);
      seen.add(record.id);
    }
  });

  return merged;
};

export const retainCompletedInterbankSnapshot = (
  previousSnapshot,
  candidateSnapshot,
  syncStatus,
) =>
  syncStatus === "complete" && Array.isArray(candidateSnapshot)
    ? candidateSnapshot
    : previousSnapshot;

const createAbortError = () => {
  const error = new Error("InterBank synchronization aborted");
  error.name = "AbortError";
  return error;
};

const ensureActive = (signal, isCurrent) => {
  if (signal?.aborted || !isCurrent()) throw createAbortError();
};

export const loadInterbankTransfersProgressively = async ({
  fetchPage,
  getCurrent = () => [],
  publish = () => {},
  onStateChange = () => {},
  normalize = normalizeInterbankTransfers,
  pageSize = INTERBANK_API_PAGE_SIZE,
  maxPages = INTERBANK_MAX_API_PAGES,
  concurrency = INTERBANK_SYNC_CONCURRENCY,
  signal,
  isCurrent = () => true,
}) => {
  const rawPages = [];
  const protectedRecords = new Map();
  let lastPublished = getCurrent();

  const publishPages = (complete) => {
    ensureActive(signal, isCurrent);
    const current = getCurrent();
    collectExternalUpdates(current, lastPublished, protectedRecords);
    const apiRecords = normalize(rawPages.flat());
    const snapshot = mergeInterbankSnapshot({
      apiRecords,
      currentRecords: current,
      protectedRecords,
      complete,
    });
    publish(snapshot);
    lastPublished = snapshot;
    return snapshot;
  };

  ensureActive(signal, isCurrent);
  const firstPage = await fetchPage(1, signal);
  ensureActive(signal, isCurrent);
  rawPages.push(firstPage);

  if (firstPage.length < pageSize) {
    const records = publishPages(true);
    onStateChange({ status: "complete", loadedPages: 1, error: null });
    return { records, status: "complete", loadedPages: 1 };
  }

  let records = publishPages(false);
  onStateChange({ status: "syncing", loadedPages: 1, error: null });

  for (let first = 2; first <= maxPages; first += concurrency) {
    ensureActive(signal, isCurrent);
    const pageNumbers = Array.from(
      { length: Math.min(concurrency, maxPages - first + 1) },
      (_, index) => first + index,
    );

    let responses;
    try {
      responses = await Promise.all(
        pageNumbers.map(async (pageNumber) => ({
          pageNumber,
          records: await fetchPage(pageNumber, signal),
        })),
      );
    } catch (error) {
      ensureActive(signal, isCurrent);
      onStateChange({
        status: "incomplete",
        loadedPages: rawPages.length,
        error,
      });
      return {
        records: getCurrent(),
        status: "incomplete",
        loadedPages: rawPages.length,
        error,
      };
    }

    ensureActive(signal, isCurrent);
    const terminalIndex = responses.findIndex(
      (response) => response.records.length < pageSize,
    );
    const accepted =
      terminalIndex === -1 ? responses : responses.slice(0, terminalIndex + 1);
    accepted.forEach((response) => rawPages.push(response.records));

    const complete = terminalIndex !== -1;
    records = publishPages(complete);
    onStateChange({
      status: complete ? "complete" : "syncing",
      loadedPages: rawPages.length,
      error: null,
    });

    if (complete) {
      return { records, status: "complete", loadedPages: rawPages.length };
    }
  }

  onStateChange({
    status: "incomplete",
    loadedPages: rawPages.length,
    error: new Error("InterBank page safety limit reached"),
  });
  return {
    records,
    status: "incomplete",
    loadedPages: rawPages.length,
  };
};

export const applyInterbankLocalFilter = (transfers, filters) => {
  const byText = (value = "", search = "") =>
    value.toString().toLowerCase().includes(search.toString().toLowerCase());

  const isSameDay = (value, target) => {
    if (!value || !target) return false;
    const valueDate = new Date(value);
    const targetDate = new Date(target);
    return (
      valueDate.getFullYear() === targetDate.getFullYear() &&
      valueDate.getMonth() === targetDate.getMonth() &&
      valueDate.getDate() === targetDate.getDate()
    );
  };

  return transfers.filter((transfer) => {
    if (filters.name && !byText(transfer.name, filters.name)) return false;
    if (filters.socioId && !byText(transfer.socioId, filters.socioId))
      return false;
    if (
      filters.identification &&
      !byText(transfer.identification, filters.identification)
    )
      return false;
    if (
      filters.noAccountBank &&
      !byText(transfer.bankAccount, filters.noAccountBank)
    )
      return false;
    if (
      filters.noAccountCoop &&
      !byText(transfer.coopAccount, filters.noAccountCoop)
    )
      return false;
    if (filters.updatedBy && !byText(transfer.updatedBy, filters.updatedBy))
      return false;
    if (filters.createdAt && !isSameDay(transfer.createdAt, filters.createdAt))
      return false;
    if (filters.updatedAt && !isSameDay(transfer.updatedAt, filters.updatedAt))
      return false;

    for (const [key, field] of [
      ["isSubmit", "isSubmit"],
      ["isPriority", "isPriority"],
      ["isCancelled", "isCancelled"],
    ]) {
      const value = filters[key];
      if (value !== "" && value !== undefined && value !== null) {
        const normalized = value === true || value === "true";
        if (transfer[field] !== normalized) return false;
      }
    }

    return true;
  });
};
