import { useQuery } from "@tanstack/react-query";
import api from "../../../lib/axiosInstance";
import { getApiBaseUrl } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import QUERY_KEYS from "../../shared/queryKeys";

const fetchReconciliationBatches = async ({ signal, baseUrl, token, params }) => {
  const response = await api.get(`${baseUrl}/InterBank/reconciliation-batches`, {
    signal,
    params,
  });
  return response.data;
};

export const useReconciliationBatches = (params = {}) => {
  const baseUrl = getApiBaseUrl();
  const { token } = useAuth();

  const queryParams = {
    limit: params.limit ?? 10,
    ...(params.batchId ? { batchId: params.batchId } : {}),
    ...(params.businessDate ? { businessDate: params.businessDate } : {}),
  };

  return useQuery({
    queryKey: [...QUERY_KEYS.reconciliationBatches, queryParams],
    queryFn: ({ signal }) =>
      fetchReconciliationBatches({ signal, baseUrl, token, params: queryParams }),
    enabled: !!token,
  });
};
