import api from '../../../lib/axiosInstance'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthApiBaseUrl } from '../../../utils/api'
import { useAuth } from '../../../context/AuthContext'
import QUERY_KEYS from '../../shared/queryKeys'
import { normalizeUser, normalizeUsers } from './usersAdapters'

const USERS_PAGE = { pageNumber: 1, pageSize: 50 }

const fetchUsers = async ({ signal, authBaseUrl, token }) => {
  const response = await api.get(`${authBaseUrl}/list-admin-user`, {
    signal,
    params: USERS_PAGE,
  })
  const payload = Array.isArray(response.data?.data)
    ? response.data.data
    : Array.isArray(response.data?.users)
      ? response.data.users
      : Array.isArray(response.data)
        ? response.data
        : []
  return normalizeUsers(payload)
}

export const useUsersQuery = () => {
  const authBaseUrl = getAuthApiBaseUrl()
  const { token } = useAuth()

  return useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: ({ signal }) => fetchUsers({ signal, authBaseUrl, token }),
    refetchOnMount: false,
  })
}

export const useRegisterUserMutation = () => {
  const authBaseUrl = getAuthApiBaseUrl()
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload) => {
      const response = await api.post(`${authBaseUrl}/register`, payload)
      const normalized = normalizeUser(response?.data?.data ?? payload, 0)
      return { response, normalized }
    },
    onSuccess: ({ normalized }) => {
      queryClient.setQueryData(QUERY_KEYS.users, (prev = []) => [normalized, ...(Array.isArray(prev) ? prev : [])])
    },
  })
}

export const useUpdateUserRolesMutation = () => {
  const authBaseUrl = getAuthApiBaseUrl()
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ user, roles }) => {
      const identifier = user?.id ?? user?.userName ?? user?.email
      const response = await api.put(
        `${authBaseUrl}/Users/${encodeURIComponent(identifier)}/roles`,
        {
          userId: identifier,
          roles,
        },
      )
      return { response, user, roles }
    },
    onSuccess: ({ user, roles }) => {
      queryClient.setQueryData(QUERY_KEYS.users, (prev = []) =>
        (Array.isArray(prev) ? prev : []).map((entry) =>
          entry.id === user.id ? { ...entry, roles } : entry,
        ),
      )
    },
  })
}

export const useToggleUserStatusMutation = () => {
  const authBaseUrl = getAuthApiBaseUrl()
  const { token } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ user, isDeactivating }) => {
      const identifier =
        user?.raw?.id ?? user?.raw?.userId ?? user?.id ?? user?.userId ?? user?.email ?? user?.userName
      if (isDeactivating) {
        await api.patch(
          `${authBaseUrl}/unactivate`,
          null,
          {
            params: { userId: identifier },
          },
        )
      } else {
        const response = await api.patch(
          `${authBaseUrl}/activate`,
          null,
          {
            params: { userId: identifier },
          },
        )
        const { succeeded } = response?.data ?? {}
        if (succeeded === false) {
          throw new Error(response?.data?.message ?? 'No hay usuario registrado con este ID.')
        }
      }
      return { user, isDeactivating }
    },
    onSuccess: ({ user, isDeactivating }) => {
      queryClient.setQueryData(QUERY_KEYS.users, (prev = []) =>
        (Array.isArray(prev) ? prev : []).map((entry) =>
          entry.id === user.id
            ? { ...entry, isVerified: !isDeactivating, isActive: !isDeactivating }
            : entry,
        ),
      )
    },
  })
}

export const useChangePasswordMutation = () => {
  const authBaseUrl = getAuthApiBaseUrl()
  const { token } = useAuth()

  return useMutation({
    mutationFn: async ({ email, newPassword }) => {
      const response = await api.put(
        `${authBaseUrl}/ChangePassword`,
        {
          email,
          newPassword,
        },
      )
      return response?.data
    },
  })
}

