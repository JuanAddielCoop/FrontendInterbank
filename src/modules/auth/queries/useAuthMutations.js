import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { getAuthApiBaseUrl } from '../../../utils/api'

const authBaseUrl = getAuthApiBaseUrl()

/**
 * POST /api/Authentication
 * Body: { username, password }
 */
export const useAuthenticateMutation = () =>
  useMutation({
    mutationFn: async ({ username, password }) => {
      const response = await axios.post(`${authBaseUrl}`, {
        username: username.trim(),
        password,
      })
      return response?.data
    },
  })

export const useForgotPasswordMutation = () =>
  useMutation({
    mutationFn: async ({ email, clientApiUrl }) =>
      axios.post(`${authBaseUrl}/forgot-password`, {
        email: email.trim(),
        clientApiUrl,
      }),
  })

export const useResetPasswordMutation = () =>
  useMutation({
    mutationFn: async ({ email, code, newPassword }) =>
      axios.post(`${authBaseUrl}/reset-password`, {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      }),
  })
