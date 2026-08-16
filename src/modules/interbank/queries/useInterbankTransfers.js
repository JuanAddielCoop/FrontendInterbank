import { useMemo, useState } from "react";
import api from "../../../lib/axiosInstance";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl } from "../../../utils/api";
import {
  INTERBANK_FALLBACK,
} from "../../../utils/interbank";
import QUERY_KEYS from "../../shared/queryKeys";
import {
  INTERBANK_API_PAGE_SIZE,
  applyInterbankLocalFilter,
  loadInterbankTransfersProgressively,
  requestInterbankPage,
} from "../interbankLoader";

export const DEFAULT_FILTERS = {
  name: "",
  socioId: "",
  identification: "",
  noAccountBank: "",
  noAccountCoop: "",
  updatedBy: "",
  isSubmit: "",
  isPriority: "",
  isCancelled: "",
  createdAt: "",
  updatedAt: "",
  pageSize: 10,
};

let interbankSyncGeneration = 0;

export const useInterbankTransfers = (filters) => {
  const baseUrl = getApiBaseUrl();
  const queryClient = useQueryClient();
  const cached = queryClient.getQueryData(QUERY_KEYS.interbankTransfers);
  const [syncState, setSyncState] = useState({
    status: Array.isArray(cached) && cached.length > 0 ? "complete" : "idle",
    loadedPages: 0,
    error: null,
  });

  const query = useQuery({
    queryKey: QUERY_KEYS.interbankTransfers,
    queryFn: async ({ signal }) => {
      const generation = ++interbankSyncGeneration;
      const current = queryClient.getQueryData(QUERY_KEYS.interbankTransfers);
      setSyncState({
        status: Array.isArray(current) && current.length > 0 ? "syncing" : "loading",
        loadedPages: 0,
        error: null,
      });

      const result = await loadInterbankTransfersProgressively({
        signal,
        isCurrent: () => generation === interbankSyncGeneration,
        fetchPage: (pageNumber, requestSignal) =>
          requestInterbankPage({
            client: api,
            baseUrl,
            filters: DEFAULT_FILTERS,
            pageNumber,
            pageSize: INTERBANK_API_PAGE_SIZE,
            signal: requestSignal,
          }),
        getCurrent: () =>
          queryClient.getQueryData(QUERY_KEYS.interbankTransfers) ?? [],
        publish: (records) =>
          queryClient.setQueryData(QUERY_KEYS.interbankTransfers, records),
        onStateChange: (nextState) => {
          if (generation === interbankSyncGeneration) setSyncState(nextState);
        },
      });

      return result.records;
    },
    refetchOnMount: false,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });

  const filteredTransfers = useMemo(() => {
    const snapshot = Array.isArray(query.data)
      ? query.data
      : INTERBANK_FALLBACK;
    if (!filters) return snapshot;
    return applyInterbankLocalFilter(snapshot, filters);
  }, [query.data, filters]);

  return {
    ...query,
    data: filteredTransfers,
    raw: query.data,
    syncStatus: syncState.status,
    syncError: syncState.error,
    loadedPages: syncState.loadedPages,
  };
};

export const useInterbankSummary = () => {
  // Compute summary client-side from fetched transactions instead of calling
  // the /InterBank/Summary endpoint which was removed from the backend.
  // The parent component already falls back to buildInterbankStats(dataset).
  return useQuery({
    queryKey: ['interbank-summary-disabled'],
    queryFn: () => null,
    staleTime: Infinity,
  });
};

const setTransferState = (queryClient, updater) => {
  queryClient.setQueriesData(
    { queryKey: QUERY_KEYS.interbankTransfers, exact: false },
    (prev = INTERBANK_FALLBACK) =>
      updater(Array.isArray(prev) ? prev : INTERBANK_FALLBACK),
  );
};

export const useConfirmInterbankTransfer = () => {
  const baseUrl = getApiBaseUrl();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const formData = new FormData();
      formData.append("File", payload.file);

      // IMPORTANT: Do NOT set Content-Type manually here.
      // Axios must auto-generate it with the multipart boundary for the server to parse the body.
      // We only set Authorization and let axios handle the rest.
      await api.patch(`${baseUrl}/InterBank/submit`, formData, { params: { Id: payload.id, UpdatedBy: payload.updatedBy, AccountSend: payload.accountSend } });
      return payload;
    },
    onSuccess: (payload) => {
      setTransferState(queryClient, (prev) =>
        prev.map((transfer) =>
          transfer.id === payload.id
            ? {
                ...transfer,
                isSubmit: true,
                isCancelled: false,
                updatedAt: new Date().toISOString(),
              }
            : transfer,
        ),
      );
    },
  });
};

export const useCancelInterbankTransfer = () => {
  const baseUrl = getApiBaseUrl();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      await api.delete(`${baseUrl}/InterBank/${payload.id}`, {
        data: payload,
        
      });
      return payload;
    },
    onSuccess: (payload) => {
      setTransferState(queryClient, (prev) =>
        prev.map((transfer) =>
          transfer.id === payload.id
            ? {
                ...transfer,
                isCancelled: true,
                isSubmit: false,
                updatedAt: new Date().toISOString(),
              }
            : transfer,
        ),
      );
    },
  });
};

export const useAddInterbankTransferSnapshot = () => {
  const queryClient = useQueryClient();
  return (transfer) => {
    setTransferState(queryClient, (prev) => {
      const exists = prev.some((entry) => entry.id === transfer.id);
      if (exists) {
        return prev.map((entry) =>
          entry.id === transfer.id ? { ...entry, ...transfer } : entry,
        );
      }
      return [transfer, ...prev];
    });
  };
};
