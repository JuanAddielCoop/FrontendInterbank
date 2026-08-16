import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../../lib/axiosInstance";
import { getApiBaseUrl } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import QUERY_KEYS from "../../shared/queryKeys";

const BANK_EXPENSES_KEY = QUERY_KEYS.bankExpenses || ["bank-expenses"];

const assertSuccessful = (response, fallbackMessage) => {
  const result = response?.data;

  if (result?.succeeded === false || result?.success === false) {
    throw new Error(result?.message || fallbackMessage);
  }

  return result;
};

const fetchBankExpenses = async ({ baseUrl, signal }) => {
  const response = await api.get(`${baseUrl}/GastoBancario`, { signal });
  return response?.data;
};

const createBankExpense = async ({ baseUrl, payload }) => {
  const response = await api.post(`${baseUrl}/GastoBancario`, payload);
  return assertSuccessful(response, "No se pudo registrar el gasto bancario.");
};

const deleteBankExpense = async ({ baseUrl, id, notaDeleted }) => {
  const numericId = Number(id);
  const response = await api.delete(`${baseUrl}/GastoBancario/${numericId}`, {
    data: {
      id: numericId,
      notaDeleted,
    },
  });

  return assertSuccessful(response, "No se pudo eliminar el gasto bancario.");
};

const invalidateExpenseBalances = (queryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: BANK_EXPENSES_KEY }),
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.bankReservasAccounts || ["bank-reservas-accounts"],
    }),
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.accountBookSumatoria || ["account-book-sumatoria"],
    }),
  ]);

export const useBankExpenses = () => {
  const baseUrl = getApiBaseUrl();
  const { token } = useAuth();

  return useQuery({
    queryKey: BANK_EXPENSES_KEY,
    queryFn: ({ signal }) => fetchBankExpenses({ baseUrl, signal }),
    enabled: !!token,
    staleTime: 30_000,
  });
};

export const useCreateBankExpense = () => {
  const baseUrl = getApiBaseUrl();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createBankExpense({ baseUrl, payload }),
    onSuccess: () => invalidateExpenseBalances(queryClient),
  });
};

export const useDeleteBankExpense = () => {
  const baseUrl = getApiBaseUrl();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notaDeleted }) =>
      deleteBankExpense({ baseUrl, id, notaDeleted }),
    onSuccess: () => invalidateExpenseBalances(queryClient),
  });
};
