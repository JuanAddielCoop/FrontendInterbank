import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 0,
      staleTime: Infinity,
      gcTime: Infinity,
    },
    mutations: {
      retry: 0,
    },
  },
})

export default queryClient
