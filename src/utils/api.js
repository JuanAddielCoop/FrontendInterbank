const normalizeBaseUrl = (value) => {
  if (!value) return ''
  return value.endsWith('/') ? value.slice(0, -1) : value
}

const DEFAULT_AUTH_PATH = '/api/Account'

const normalizeApiPath = (value) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash
}

const ensurePathSuffix = (value, pathSuffix) => {
  const normalized = normalizeBaseUrl(value)
  if (!normalized) return ''
  if (!pathSuffix) return normalized
  const suffixLower = pathSuffix.toLowerCase()
  return normalized.toLowerCase().endsWith(suffixLower)
    ? normalized
    : `${normalized}${pathSuffix}`
}

const getDevProxyPath = () => {
  if (!import.meta.env.DEV) return ''
  const raw = import.meta.env.VITE_AUTH_PROXY_PATH
  if (!raw) return ''
  return raw.startsWith('/') ? raw : `/${raw}`
}

export const getApiBaseUrl = () => {
  const fallback = 'https://red.coophispanica.com/api/v1'
  const raw = import.meta.env.VITE_BASE_API_URL ?? fallback
  return normalizeBaseUrl(raw)
}

export const getAuthApiBaseUrl = () => {
  const authPath = normalizeApiPath(import.meta.env.VITE_AUTH_API_PATH ?? DEFAULT_AUTH_PATH)
  const rawAuthUrl = import.meta.env.VITE_AUTH_API_URL
  const rawBaseUrl = import.meta.env.VITE_BASE_API_URL
  const proxyPath = getDevProxyPath()

  // Prioritize explicit URL if provided, even in dev.
  if (rawAuthUrl) return ensurePathSuffix(rawAuthUrl, authPath)
  if (rawBaseUrl) return ensurePathSuffix(rawBaseUrl, authPath)

  // Fallback to dev proxy only when no explicit URL is set.
  if (proxyPath) return ensurePathSuffix(proxyPath, authPath)

  const fallback = 'https://localhost:7137'
  return ensurePathSuffix(fallback, authPath)
}

export const getTransferHubUrl = () => normalizeBaseUrl(import.meta.env.VITE_TRANSFER_HUB_URL ?? '')
