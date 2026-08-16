import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../context/AuthContext";
import {
  fetchBankInbound,
  fetchBankInboundDashboard,
  updateBankInboundStatus,
} from "../../../services/bankInbound.service";
import {
  BANK_INBOUND_KEY,
  BANK_INBOUND_DASHBOARD_KEY,
  canPrefetchNextBankInboundPage,
  createBankInboundQueryOptions,
  getBankInboundDashboardQueryKey,
} from "../bankInboundQuery";

export { BANK_INBOUND_KEY } from "../bankInboundQuery";

export const DEFAULT_FILTERS = {
  nameBank: "",
  socioId: "",
  amount: "",
  isConfirm: "",
  updatedBy: "",
  createdAt: "",
  updatedAt: "",
};

export const DEFAULT_PAGE_SIZE = 10;

// ─────────────────────────────────────────────
// Hook principal: listado paginado
// ─────────────────────────────────────────────
export const useBankInbound = ({ filters, pageNumber, pageSize }) => {
  const queryClient = useQueryClient();
  const fetchPage = useCallback(
    ({
      filters: requestFilters,
      pageNumber: requestPageNumber,
      pageSize: requestPageSize,
      signal,
    }) =>
      fetchBankInbound({
        filters: requestFilters,
        pageNumber: requestPageNumber,
        pageSize: requestPageSize,
        signal,
      }),
    [],
  );
  const query = useQuery(
    createBankInboundQueryOptions({ filters, pageNumber, pageSize, fetchPage }),
  );

  useEffect(() => {
    if (
      query.isPlaceholderData ||
      !canPrefetchNextBankInboundPage(query.data, pageSize)
    )
      return;

    const nextPageNumber = pageNumber + 1;
    queryClient.prefetchQuery(
      createBankInboundQueryOptions({
        filters,
        pageNumber: nextPageNumber,
        pageSize,
        fetchPage,
      }),
    );
  }, [
    filters,
    fetchPage,
    pageNumber,
    pageSize,
    query.data,
    query.isPlaceholderData,
    queryClient,
  ]);

  return query;
};

export const useBankInboundDashboard = (filters) =>
  useQuery({
    queryKey: getBankInboundDashboardQueryKey(filters),
    queryFn: ({ signal }) => fetchBankInboundDashboard({ filters, signal }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

// ─────────────────────────────────────────────
// Mutación: Confirmar
// ─────────────────────────────────────────────
export const useConfirmBankInbound = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comentario = "", recibo = 0, confirmationImage }) => {
      const payload = {
        id,
        isConfirm: "CONFIRMADO",
        updatedBy: user?.firstName ?? user?.userName ?? "Admin",
        updatedAt: new Date().toISOString(),
        comentario,
        recibo,
        confirmationImage,
      };
      return updateBankInboundStatus({ payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_INBOUND_KEY });
      queryClient.invalidateQueries({ queryKey: BANK_INBOUND_DASHBOARD_KEY });
    },
  });
};

// ─────────────────────────────────────────────
// Mutación: Cancelar
// ─────────────────────────────────────────────
export const useCancelBankInbound = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comentario = "", recibo = 0 }) => {
      const payload = {
        id,
        isConfirm: "CANCELADO",
        updatedBy: user?.firstName ?? user?.userName ?? "Admin",
        updatedAt: new Date().toISOString(),
        comentario,
        recibo,
      };
      return updateBankInboundStatus({ payload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_INBOUND_KEY });
      queryClient.invalidateQueries({ queryKey: BANK_INBOUND_DASHBOARD_KEY });
    },
  });
};
