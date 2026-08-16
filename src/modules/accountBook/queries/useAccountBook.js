import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../lib/axiosInstance";
import { getApiBaseUrl } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import QUERY_KEYS from "../../shared/queryKeys";
import {
  buildInternalTransferPayload,
  resolveEmployeeId,
} from "../internalTransfers";

const fetchBankReservasAccounts = async ({ signal, baseUrl }) => {
  const response = await api.get(`${baseUrl}/Cuentas/banco-reservas`, {
    signal,
  });
  const result = response.data;

  if (result?.succeeded === false || result?.success === false) {
    throw new Error(
      result?.message || "No se pudieron obtener las cuentas bancarias.",
    );
  }

  return result;
};

const fetchAdminInterExternaAccounts = async ({ signal, baseUrl }) => {
  const response = await api.get(`${baseUrl}/Cuentas/admin/inter-externa`, {
    signal,
  });
  return response.data;
};


const fetchAccountBookSumatoria = async ({ signal, baseUrl, now }) => {
  const response = await api.get(`${baseUrl}/InterBank/Sumatoria`, {
    signal,
    params: { now },
  });

  return response.data;
};

const createCorporateAccount = async ({ baseUrl, payload }) => {
  const response = await api.post(`${baseUrl}/Cuentas/corporativa`, payload);
  const result = response?.data;

  if (result?.succeeded === false || result?.success === false) {
    throw new Error(result?.message || "No se pudo crear la cuenta corporativa.");
  }

  return result;
};

const createInternalAccountTransfer = async ({ baseUrl, payload }) => {
  const response = await api.post(
    `${baseUrl}/Cuentas/transferencias-internas`,
    payload,
  );
  const result = response?.data;

  if (result?.succeeded === false || result?.success === false) {
    throw new Error(
      result?.message || "No se pudo completar la transferencia interna.",
    );
  }

  return result;
};

export const useAccountBookSumatoria = (now) => {
  const baseUrl = getApiBaseUrl();
  const { token } = useAuth();
  
  // Si no se provee fecha, usamos la de hoy en formato YYYY-MM-DD
  const date = now || new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: [...QUERY_KEYS.accountBookSumatoria || ['account-book-sumatoria'], date],
    queryFn: ({ signal }) =>
      fetchAccountBookSumatoria({ signal, baseUrl, now: date }),
    enabled: !!token,
  });
};

export const useBankReservasAccounts = ({ enabled = true } = {}) => {
  const baseUrl = getApiBaseUrl();
  const { token } = useAuth();

  return useQuery({
    queryKey: QUERY_KEYS.bankReservasAccounts || ['bank-reservas-accounts'],
    queryFn: ({ signal }) =>
      fetchBankReservasAccounts({ signal, baseUrl }),
    enabled: Boolean(token) && enabled,
    // Account validation is time-sensitive: never treat a cached catalog as
    // permanently fresh when the OCR modal is opened again.
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

export const useCreateCorporateAccount = () => {
  const baseUrl = getApiBaseUrl();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createCorporateAccount({ baseUrl, payload }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.bankReservasAccounts || ["bank-reservas-accounts"],
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.accountBookSumatoria || ["account-book-sumatoria"],
        }),
      ]);
    },
  });
};

export const useCreateInternalAccountTransfer = () => {
  const baseUrl = getApiBaseUrl();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (payload) => {
      const employeeId = resolveEmployeeId(user);

      return createInternalAccountTransfer({
        baseUrl,
        payload: buildInternalTransferPayload(payload, employeeId),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.accounts || ["accounts"],
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.bankReservasAccounts || ["bank-reservas-accounts"],
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.accountBookSumatoria || ["account-book-sumatoria"],
        }),
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.transactions || ["transactions"],
        }),
      ]);
    },
  });
};

export const useAdminInterExternaAccounts = () => {
  const baseUrl = getApiBaseUrl();
  const { token } = useAuth();

  return useQuery({
    queryKey: QUERY_KEYS.adminInterExternaAccounts || ['admin-inter-externa-accounts'],
    queryFn: ({ signal }) =>
      fetchAdminInterExternaAccounts({ signal, baseUrl }),
    enabled: !!token,
  });
};
