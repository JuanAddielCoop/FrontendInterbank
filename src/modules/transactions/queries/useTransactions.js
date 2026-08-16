import api from '../../../lib/axiosInstance'
import { useQuery } from '@tanstack/react-query'
import { getApiBaseUrl } from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import QUERY_KEYS from '../../shared/queryKeys'

const fetchTransactions = async ({ signal, baseUrl, token }) => {
  const response = await api.get(`${baseUrl}/HistorialTransacciones/listar`, {
    signal,
  })
  return response?.data
}

export const useTransactionsQuery = () => {
  const baseUrl = getApiBaseUrl()
  const { token } = useAuth()

  return useQuery({
    queryKey: QUERY_KEYS.transactions,
    queryFn: ({ signal }) => fetchTransactions({ signal, baseUrl, token }),
    refetchOnMount: false,
  })
}

export default useTransactionsQuery
