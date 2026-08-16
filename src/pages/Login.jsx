import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  useAuthenticateMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
} from '../modules/auth/queries/useAuthMutations'

const DEFAULT_STATUS = {
  type: '',
  message: '',
}

const VIEW = {
  LOGIN: 'login',
  FORGOT: 'forgot',
  RESET: 'reset',
}

const Login = () => {
  const { login } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState(VIEW.LOGIN)
  const [forgotForm, setForgotForm] = useState({ email: '' })
  const [forgotStatus, setForgotStatus] = useState(DEFAULT_STATUS)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [resetForm, setResetForm] = useState({
    email: '',
    code: '',
    password: '',
    confirm: '',
  })
  const [resetStatus, setResetStatus] = useState(DEFAULT_STATUS)
  const [resetLoading, setResetLoading] = useState(false)
  const authMutation = useAuthenticateMutation()
  const forgotMutation = useForgotPasswordMutation()
  const resetMutation = useResetPasswordMutation()

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const getClientAppUrl = () => {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email') ?? ''
    const code = params.get('code') ?? ''
    if (email && code) {
      setView(VIEW.RESET)
      setResetForm((prev) => ({
        ...prev,
        email,
        code,
      }))
    }
  }, [])

  const handleForgotChange = (field, value) => {
    setForgotForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleResetChange = (field, value) => {
    setResetForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.username || !form.password) {
      setStatus({ type: 'error', message: 'Completa tu usuario y contrasena.' })
      return
    }

    setLoading(true)
    setStatus(DEFAULT_STATUS)

    try {
      const response = await authMutation.mutateAsync({
        username: form.username,
        password: form.password,
      })

      const { message: serverMessage, succeeded } = response ?? {}
      if (succeeded === false) {
        throw new Error(serverMessage || 'No pudimos iniciar sesion.')
      }

      const payload = response?.data ?? response
      if (!payload?.jwToken) {
        throw new Error(serverMessage || 'Respuesta invalida del servidor.')
      }

      const roles = Array.isArray(payload.roles) ? payload.roles : []
      login({
        token: payload.jwToken,
        refreshToken: payload.refreshToken,
        roles,
        user: {
           id: payload.id ?? null,
           employeeId: payload.employeeId ?? payload.empleado ?? null,
           firstName: payload.firstName ?? '',
          lastName: payload.lastName ?? '',
          userName: payload.userName ?? form.username.trim(),
          email: payload.email ?? '',
          isVerified: payload.isVerified ?? false,
          roles,
        },
      })
    } catch (err) {
      setStatus({
        type: 'error',
        message:
          err?.response?.data?.message ??
          err?.message ??
          'Credenciales incorrectas.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleForgotSubmit = async (event) => {
    event.preventDefault()
    const trimmedEmail = forgotForm.email.trim()
    if (!trimmedEmail) {
      setForgotStatus({ type: 'error', message: 'Ingresa el correo del usuario.' })
      return
    }

    setForgotLoading(true)
    setForgotStatus(DEFAULT_STATUS)

    try {
      await forgotMutation.mutateAsync({
        email: trimmedEmail,
        clientApiUrl: getClientAppUrl(),
      })

      setForgotStatus({
        type: 'success',
        message:
          'Si el correo existe, enviamos un codigo de 6 digitos (vigencia 2 minutos).',
      })
      setView(VIEW.RESET)
      setResetForm((prev) => ({ ...prev, email: trimmedEmail }))
    } catch (err) {
      setForgotStatus({
        type: 'error',
        message:
          err?.response?.data?.message ??
          err?.message ??
          'No pudimos procesar la solicitud.',
      })
    } finally {
      setForgotLoading(false)
    }
  }

  const handleResetSubmit = async (event) => {
    event.preventDefault()
    const trimmedEmail = resetForm.email.trim()
    const trimmedCode = resetForm.code.trim()
    if (!trimmedEmail || !trimmedCode) {
      setResetStatus({ type: 'error', message: 'Correo y codigo son obligatorios.' })
      return
    }

    if (!resetForm.password) {
      setResetStatus({ type: 'error', message: 'Ingresa la nueva contrasena.' })
      return
    }

    if (resetForm.password !== resetForm.confirm) {
      setResetStatus({ type: 'error', message: 'Las contrasenas no coinciden.' })
      return
    }

    setResetLoading(true)
    setResetStatus(DEFAULT_STATUS)

    try {
      await resetMutation.mutateAsync({
        email: trimmedEmail,
        code: trimmedCode,
        newPassword: resetForm.password,
      })

      setResetStatus({
        type: 'success',
        message: 'Contrasena actualizada. Ya puedes iniciar sesion con tus nuevas credenciales.',
      })
      setView(VIEW.LOGIN)
      setResetStatus(DEFAULT_STATUS)
      setForm((prev) => ({
        ...prev,
        username: trimmedEmail,
        password: '',
      }))
      setStatus({
        type: 'success',
        message: 'Contrasena actualizada. Inicia sesion para continuar.',
      })
    } catch (err) {
      setResetStatus({
        type: 'error',
        message:
          err?.response?.data?.message ??
          err?.message ??
          'No pudimos actualizar la contrasena.',
      })
    } finally {
      setResetLoading(false)
    }
  }

  const renderStatusAlert = (payload) => {
    if (!payload.type) return null
    const isSuccess = payload.type === 'success'
    const baseClass = isSuccess
      ? 'border-primary-green/60 bg-primary-green/10 text-primary-green'
      : 'border-red-500/60 bg-red-500/10 text-red-200'

    return (
      <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${baseClass}`}>
        {payload.message}
      </div>
    )
  }

  const renderLoginForm = () => (
    <>
      {renderStatusAlert(status)}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium text-gray-300">
            Usuario
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
            placeholder="admin"
            value={form.username}
            onChange={(event) => handleChange('username', event.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-gray-300">
              Contrasena
            </label>
            <button
              type="button"
              onClick={() => {
                setView(VIEW.FORGOT)
                setStatus(DEFAULT_STATUS)
              }}
              className="text-xs font-semibold text-primary-green transition hover:text-primary-green/80"
            >
              Olvide la contrasena
            </button>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
            placeholder="Escribe tu contrasena"
            value={form.password}
            onChange={(event) => handleChange('password', event.target.value)}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-2xl bg-primary-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-green/80 disabled:cursor-not-allowed disabled:bg-primary-green/60"
        >
          {loading ? 'Validando...' : 'Entrar'}
        </button>
      </form>
    </>
  )

  const renderForgotForm = () => (
    <>
      {renderStatusAlert(forgotStatus)}
      <form className="space-y-5" onSubmit={handleForgotSubmit}>
        <div className="space-y-2">
          <label htmlFor="forgot-email" className="text-sm font-medium text-gray-300">
            Correo del usuario
          </label>
          <input
            id="forgot-email"
            type="email"
            className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
            placeholder="usuario@empresa.com"
            value={forgotForm.email}
            onChange={(event) => handleForgotChange('email', event.target.value)}
            disabled={forgotLoading}
          />
        </div>
        <button
          type="submit"
          disabled={forgotLoading}
          className="flex w-full items-center justify-center rounded-2xl bg-primary-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-green/80 disabled:cursor-not-allowed disabled:bg-primary-green/60"
        >
          {forgotLoading ? 'Enviando...' : 'Enviar enlace'}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(VIEW.LOGIN)
            setForgotStatus(DEFAULT_STATUS)
            setStatus(DEFAULT_STATUS)
          }}
          className="w-full rounded-2xl border border-dark-border px-4 py-3 text-xs font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white"
        >
          Volver al login
        </button>
      </form>
    </>
  )

  const renderResetForm = () => (
    <>
      {renderStatusAlert(resetStatus)}
      <form className="space-y-5" onSubmit={handleResetSubmit}>
        <div className="space-y-2">
          <label htmlFor="reset-email" className="text-sm font-medium text-gray-300">
            Correo
          </label>
          <input
            id="reset-email"
            type="email"
            className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
            placeholder="usuario@empresa.com"
            value={resetForm.email}
            onChange={(event) => handleResetChange('email', event.target.value)}
            disabled={resetLoading}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="reset-code" className="text-sm font-medium text-gray-300">
            Codigo de 6 digitos
          </label>
          <input
            id="reset-code"
            type="text"
            maxLength={6}
            className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
            placeholder="Ej: 123456"
            value={resetForm.code}
            onChange={(event) => handleResetChange('code', event.target.value)}
            disabled={resetLoading}
          />
          <p className="text-[11px] text-gray-500">Vigencia: 2 minutos desde el envio.</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="new-password" className="text-sm font-medium text-gray-300">
            Nueva contrasena
          </label>
          <input
            id="new-password"
            type="password"
            className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
            placeholder="********"
            value={resetForm.password}
            onChange={(event) => handleResetChange('password', event.target.value)}
            disabled={resetLoading}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm font-medium text-gray-300">
            Confirma la nueva contrasena
          </label>
          <input
            id="confirm-password"
            type="password"
            className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
            placeholder="********"
            value={resetForm.confirm}
            onChange={(event) => handleResetChange('confirm', event.target.value)}
            disabled={resetLoading}
          />
        </div>
        <button
          type="submit"
          disabled={resetLoading || !resetForm.code}
          className="flex w-full items-center justify-center rounded-2xl bg-primary-green px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-green/80 disabled:cursor-not-allowed disabled:bg-primary-green/60"
        >
          {resetLoading ? 'Guardando...' : 'Actualizar contrasena'}
        </button>
        <button
          type="button"
          onClick={() => {
            setView(VIEW.LOGIN)
            setResetStatus(DEFAULT_STATUS)
            setStatus(DEFAULT_STATUS)
          }}
          className="w-full rounded-2xl border border-dark-border px-4 py-3 text-xs font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white"
        >
          Volver al login
        </button>
      </form>
    </>
  )

  const renderActiveView = () => {
    if (view === VIEW.FORGOT) return renderForgotForm()
    if (view === VIEW.RESET) return renderResetForm()
    return renderLoginForm()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark-bg px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-dark-border bg-[#0d121c] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-green">
            Interbank Admin
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            {view === VIEW.LOGIN
              ? 'Ingresar al panel'
              : view === VIEW.FORGOT
                ? 'Recuperar acceso'
                : 'Restablecer contrasena'}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {view === VIEW.LOGIN
              ? 'Valida tus credenciales corporativas.'
              : view === VIEW.FORGOT
                ? 'Envianos tu correo para recibir el enlace de restablecimiento.'
                : 'Ingresa el token recibido y tu nueva contrasena.'}
          </p>
        </div>

        {renderActiveView()}
      </div>
      <p className="mt-6 text-xs text-gray-500">
        Usa tus credenciales asignadas. Si tienes inconvenientes, contacta a soporte.
      </p>
    </div>
  )
}

export default Login
