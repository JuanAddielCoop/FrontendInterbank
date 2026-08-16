import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../lib/axiosInstance'
import { getAuthApiBaseUrl } from '../utils/api'

// ─── Constantes ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'interbank-admin-auth'
const SESSION_ID_KEY = 'interbank-admin-session-id'

const INITIAL_STATE = {
  user: null,
  token: null,
  refreshToken: null,
  roles: [],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const normalizeToken = (value) => {
  if (typeof value !== 'string') return ''
  return value.replace(/^Bearer\s+/i, '').trim()
}

const generateSessionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * Decodifica el payload de un JWT sin librerías externas.
 * Retorna null si el token es inválido.
 */
const decodeJwtPayload = (token) => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Verifica si el JWT ya expiró (o expira en los próximos `bufferMs`).
 */
const isTokenExpired = (token, bufferMs = 60_000) => {
  if (!token) return true
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  const expiresAt = payload.exp * 1000
  return Date.now() + bufferMs >= expiresAt
}

// ─── Lectura persistente ─────────────────────────────────────────────────────
const readStoredAuth = () => {
  if (typeof window === 'undefined') return INITIAL_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_STATE
    const parsed = JSON.parse(raw)
    const token = normalizeToken(parsed.token) || null
    // Si el token almacenado ya expiró, limpiar directamente
    if (token && isTokenExpired(token, 0)) {
      window.localStorage.removeItem(STORAGE_KEY)
      return INITIAL_STATE
    }
    return {
      user: parsed.user ?? null,
      token,
      refreshToken: parsed.refreshToken ?? null,
      roles: Array.isArray(parsed.roles) ? parsed.roles : [],
    }
  } catch {
    return INITIAL_STATE
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────
const AuthContext = createContext({
  ...INITIAL_STATE,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
})

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState(() => readStoredAuth())
  const logoutCalledRef = useRef(false)
  const sessionIdRef = useRef(
    typeof window !== 'undefined'
      ? window.localStorage.getItem(SESSION_ID_KEY) || ''
      : '',
  )

  // ── Logout centralizado ────────────────────────────────────────────────────
  const logout = useCallback((reason) => {
    if (logoutCalledRef.current) return
    logoutCalledRef.current = true

    if (reason) {
      console.warn(`[Auth] Sesión cerrada: ${reason}`)
    }

    // Call the API to clear the refresh token from the database
    setAuthState((currentAuthState) => {
      if (currentAuthState.token && currentAuthState.refreshToken && currentAuthState.user?.id) {
        const authBaseUrl = getAuthApiBaseUrl()
        api.post(
          `${authBaseUrl}/logout`, 
          null, 
          {
            params: {
              refreshToken: currentAuthState.refreshToken,
              userId: currentAuthState.user.id
            }
          }
        ).catch(() => {
          // Ignore network errors or if token is already expired
        })
      }
      return { ...INITIAL_STATE }
    })

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.removeItem(SESSION_ID_KEY)
    }

    // Permitir futuras invocaciones después de un breve delay
    setTimeout(() => {
      logoutCalledRef.current = false
    }, 500)
  }, [])

  // ── Persistencia y headers de Axios ────────────────────────────────────────
  useEffect(() => {
    if (authState?.token) {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(authState))
      }
    } else {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [authState])

  // ── Interceptor de REQUEST: inyecta ambos tokens ───────────────────────────
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use((config) => {
      const { token, refreshToken } = authState

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      if (refreshToken) {
        config.headers['X-Refresh-Token'] = refreshToken
      }

      return config
    })

    return () => {
      api.interceptors.request.eject(requestInterceptor)
    }
  }, [authState])

  // ── Interceptor de RESPONSE: detecta 401 → cerrar sesión ──────────────────
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401 && authState.token) {
          logout('Token expirado o inválido (401)')
        }
        return Promise.reject(error)
      },
    )

    return () => {
      api.interceptors.response.eject(responseInterceptor)
    }
  }, [authState.token, logout])

  // ── Timer de expiración del JWT ────────────────────────────────────────────
  useEffect(() => {
    if (!authState.token) return undefined

    const payload = decodeJwtPayload(authState.token)
    if (!payload?.exp) return undefined

    const expiresAt = payload.exp * 1000
    const msUntilExpiry = expiresAt - Date.now()

    if (msUntilExpiry <= 0) {
      logout('JWT expirado')
      return undefined
    }

    // Programar cierre de sesión justo cuando expire
    const timerId = setTimeout(() => {
      logout('JWT expirado (timer)')
    }, msUntilExpiry)

    return () => clearTimeout(timerId)
  }, [authState.token, logout])

  // ── Detección de login en otro dispositivo / otra pestaña ──────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleStorageChange = (event) => {
      // Caso 1: alguien hizo logout desde otra pestaña
      if (event.key === STORAGE_KEY && event.newValue === null && authState.token) {
        logout('Sesión cerrada desde otra pestaña')
        return
      }

      // Caso 2: otra pestaña / dispositivo inició sesión con otro sessionId
      if (event.key === SESSION_ID_KEY && event.newValue && event.newValue !== sessionIdRef.current) {
        logout('Se inició sesión en otro dispositivo o pestaña')
        if (typeof window !== 'undefined') {
          window.alert('Tu sesión fue cerrada porque se inició sesión en otro dispositivo.')
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [authState.token, logout])

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = useCallback((payload) => {
    const token = normalizeToken(payload.token)
    const refreshToken = normalizeToken(payload.refreshToken)

    const newSessionId = generateSessionId()
    sessionIdRef.current = newSessionId

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_ID_KEY, newSessionId)
    }

    setAuthState({
      user: payload.user ?? null,
      token: token || null,
      refreshToken: refreshToken || null,
      roles: Array.isArray(payload.roles)
        ? payload.roles
        : Array.isArray(payload.user?.roles)
          ? payload.user.roles
          : [],
    })
  }, [])

  // ── Value del contexto ─────────────────────────────────────────────────────
  const value = useMemo(
    () => ({
      user: authState.user,
      token: authState.token,
      refreshToken: authState.refreshToken,
      roles: authState.roles ?? [],
      isAuthenticated: Boolean(authState.token),
      login,
      logout,
    }),
    [authState, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
