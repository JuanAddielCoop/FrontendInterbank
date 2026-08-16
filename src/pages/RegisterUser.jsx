import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import {
  useChangePasswordMutation,
  useRegisterUserMutation,
  useToggleUserStatusMutation,
  useUpdateUserRolesMutation,
  useUsersQuery,
} from '../modules/users/queries/useUsers'
import { normalizeUser } from '../modules/users/queries/usersAdapters'

const ROLE_OPTIONS = [
  { id: 'Admin', label: 'Admin' },
  { id: 'SuperAdmin', label: 'Super admin' },
  { id: 'Desarrollador', label: 'Desarrollador' },
]

const DEFAULT_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  userName: '',
  password: '',
  confirmPassword: '',
  roles: ['Admin'],
}

const DEFAULT_STATUS = {
  type: '',
  message: '',
}

const RegisterUser = () => {
  const { roles } = useAuth()
  const { addNotification } = useNotifications()
  const isSuperAdmin = roles.includes('SuperAdmin')

  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [editingUser, setEditingUser] = useState(null)
  const [roleDraft, setRoleDraft] = useState([])
  const [roleStatus, setRoleStatus] = useState(DEFAULT_STATUS)
  const [statusUpdatingId, setStatusUpdatingId] = useState(null)
  const [passwordEditor, setPasswordEditor] = useState(null)
  const [passwordDraft, setPasswordDraft] = useState('')
  const [passwordRowStatus, setPasswordRowStatus] = useState(DEFAULT_STATUS)

  const usersQuery = useUsersQuery()
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const usersError = usersQuery.error?.message ?? ''

  const registerMutation = useRegisterUserMutation()
  const updateRolesMutation = useUpdateUserRolesMutation()
  const toggleUserStatusMutation = useToggleUserStatusMutation()
  const changePasswordMutation = useChangePasswordMutation()

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleRoleToggle = (roleId) => {
    setForm((prev) => {
      const hasRole = prev.roles.includes(roleId)
      const nextRoles = hasRole
        ? prev.roles.filter((role) => role !== roleId)
        : [...prev.roles, roleId]

      return {
        ...prev,
        roles: nextRoles,
      }
    })
  }

  const resetForm = () => {
    setForm({ ...DEFAULT_FORM })
    setStatus(DEFAULT_STATUS)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const trimmedUser = form.userName.trim()
    const trimmedEmail = form.email.trim()

    if (!trimmedUser || !trimmedEmail) {
      setStatus({ type: 'error', message: 'Usuario y correo son obligatorios.' })
      return
    }

    if (!form.roles.length) {
      setStatus({ type: 'error', message: 'Selecciona al menos un rol.' })
      return
    }

    if (!form.password || form.password !== form.confirmPassword) {
      setStatus({ type: 'error', message: 'Las contrasenas deben coincidir.' })
      return
    }

    setStatus(DEFAULT_STATUS)

    try {
      const payload = {
        name: form.firstName.trim() || '',
        lastName: form.lastName.trim() || '',
        email: trimmedEmail,
        userName: trimmedUser,
        password: form.password,
        confirmPassword: form.confirmPassword,
        roles: form.roles,
      }

      const response = await registerMutation.mutateAsync(payload)
      const { message: serverMessage, succeeded } = response?.response?.data ?? {}
      if (succeeded === false) {
        throw new Error(serverMessage || 'No pudimos registrar el usuario.')
      }

      setStatus({
        type: 'success',
        message: serverMessage ?? 'Usuario registrado correctamente.',
      })
      setForm({ ...DEFAULT_FORM })
    } catch (err) {
      setStatus({
        type: 'error',
        message:
          err?.response?.data?.message ?? err?.message ?? 'No pudimos registrar el usuario.',
      })
    }
  }

  const openRoleEditor = (user) => {
    setEditingUser(user)
    setRoleDraft(user.roles ?? [])
    setRoleStatus(DEFAULT_STATUS)
  }

  const closeRoleEditor = () => {
    setEditingUser(null)
    setRoleDraft([])
    setRoleStatus(DEFAULT_STATUS)
  }

  const toggleRoleDraft = (roleId) => {
    setRoleDraft((prev) => {
      const hasRole = prev.includes(roleId)
      if (hasRole) {
        return prev.filter((role) => role !== roleId)
      }
      return [...prev, roleId]
    })
  }

  const handleSaveRoles = async () => {
    if (!editingUser) return
    if (!roleDraft.length) {
      setRoleStatus({ type: 'error', message: 'Selecciona al menos un rol.' })
      return
    }

    setRoleStatus(DEFAULT_STATUS)

    try {
      await updateRolesMutation.mutateAsync({ user: editingUser, roles: roleDraft })
      setRoleStatus({
        type: 'success',
        message: 'Roles actualizados correctamente.',
      })
      closeRoleEditor()
    } catch (err) {
      setRoleStatus({
        type: 'error',
        message: err?.response?.data?.message ?? err?.message ?? 'No pudimos actualizar los roles.',
      })
    }
  }

  const handleToggleActive = async (user) => {
    const identifier =
      user?.raw?.id ?? user?.raw?.userId ?? user?.id ?? user?.userId ?? user?.email ?? user?.userName
    if (!identifier) {
      return
    }

    const isDeactivating = Boolean(user.isVerified)
    if (isDeactivating && !isSuperAdmin) {
      setStatus({
        type: 'error',
        message: 'Solo un SuperAdmin puede inactivar usuarios.',
      })
      return
    }

    setStatusUpdatingId(user.id)
    try {
      await toggleUserStatusMutation.mutateAsync({ user, isDeactivating })
      if (!isDeactivating) {
        addNotification({
          title: 'Usuario activado',
          message: 'Usuario activo exitosamente.',
        })
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: err?.response?.data?.message ?? err?.message ?? 'No pudimos actualizar el estado.',
      })
    } finally {
      setStatusUpdatingId(null)
    }
  }

  const openPasswordEditor = (user) => {
    if (!user.email) {
      setPasswordRowStatus({
        type: 'error',
        message: 'El usuario no tiene correo registrado.',
      })
      return
    }
    setPasswordEditor(user)
    setPasswordDraft('')
    setPasswordRowStatus(DEFAULT_STATUS)
  }

  const closePasswordEditor = () => {
    setPasswordEditor(null)
    setPasswordDraft('')
    setPasswordRowStatus(DEFAULT_STATUS)
  }

  const handlePasswordDraftChange = (value) => setPasswordDraft(value)

  const handlePasswordUpdate = async () => {
    if (!passwordEditor?.email) {
      setPasswordRowStatus({
        type: 'error',
        message: 'El usuario no tiene correo asignado.',
      })
      return
    }
    if (!passwordDraft) {
      setPasswordRowStatus({
        type: 'error',
        message: 'Define una nueva contrasena.',
      })
      return
    }

    setPasswordRowStatus(DEFAULT_STATUS)
    try {
      const response = await changePasswordMutation.mutateAsync({
        email: passwordEditor.email,
        newPassword: passwordDraft,
      })
      const { message: serverMessage, succeeded } = response ?? {}
      if (succeeded === false) {
        throw new Error(serverMessage || 'No pudimos actualizar la contrasena.')
      }
      setPasswordRowStatus({
        type: 'success',
        message: serverMessage ?? 'Contrasena actualizada correctamente.',
      })
      setPasswordEditor(null)
      setPasswordDraft('')
    } catch (err) {
      setPasswordRowStatus({
        type: 'error',
        message:
          err?.response?.data?.message ?? err?.message ?? 'No pudimos actualizar la contrasena.',
      })
    }
  }

  const renderUsers = useCallback(
    () =>
      users.length === 0 ? (
        <p className="text-sm text-gray-400">
          Aun no hay usuarios registrados. Crea el primero usando el formulario superior.
        </p>
      ) : (
        users.map((user, index) => {
          const normalizedUser = normalizeUser(user, index)
          const roleBadges = normalizedUser.roles.length ? normalizedUser.roles : ['Sin rol asignado']
          const isUpdatingStatus = statusUpdatingId === normalizedUser.id
          const isPasswordOpen = passwordEditor?.id === normalizedUser.id
          const isActiveUser = Boolean(normalizedUser.isVerified)
          const isDeactivationDisabled = isActiveUser && !isSuperAdmin
          const statusButtonDisabled = isUpdatingStatus || isDeactivationDisabled
          return (
            <article
              key={normalizedUser.id}
              className="space-y-3 rounded-2xl border border-dark-border bg-[#05070f] p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{normalizedUser.userName}</p>
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${
                        isActiveUser
                          ? 'bg-primary-green/10 text-primary-green'
                          : 'bg-red-500/10 text-red-300'
                      }`}
                    >
                      {isActiveUser ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{normalizedUser.email || 'Sin correo'}</p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {roleBadges.map((role) => (
                      <span
                        key={`${normalizedUser.id}-${role}`}
                        className="rounded-full border border-dark-border px-3 py-1 text-xs text-gray-300"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openRoleEditor(normalizedUser)}
                    className="rounded-2xl border border-dark-border px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white"
                  >
                    Roles
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(normalizedUser)}
                    disabled={statusButtonDisabled}
                    className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${
                      isActiveUser
                        ? 'border-red-500/40 text-red-300 hover:border-red-500/80'
                        : 'border-primary-green/50 text-primary-green hover:border-primary-green'
                    } ${statusButtonDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    title={isDeactivationDisabled ? 'Solo el SuperAdmin puede inactivar usuarios' : ''}
                  >
                    {isActiveUser ? 'Inactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openPasswordEditor(normalizedUser)}
                    className="rounded-2xl border border-primary-green/50 px-4 py-2 text-xs font-semibold text-primary-green transition hover:border-primary-green hover:text-white"
                  >
                    Password
                  </button>
                </div>
              </div>

              {isPasswordOpen && (
                <div className="rounded-2xl border border-dark-border/60 bg-[#0d121c] p-4">
                  <p className="text-xs text-gray-400">
                    Cambia la contrasena para {normalizedUser.email ?? normalizedUser.userName}.
                  </p>
                  {passwordRowStatus.type && (
                    <div
                      className={`mt-2 rounded-2xl border px-4 py-3 text-xs ${
                        passwordRowStatus.type === 'success'
                          ? 'border-primary-green/60 bg-primary-green/10 text-primary-green'
                          : 'border-red-500/60 bg-red-500/10 text-red-200'
                      }`}
                    >
                      {passwordRowStatus.message}
                    </div>
                  )}
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="password"
                      value={passwordDraft}
                      onChange={(event) => handlePasswordDraftChange(event.target.value)}
                      className="flex-1 rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
                      placeholder="Nueva contrasena"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handlePasswordUpdate}
                        className="rounded-2xl bg-primary-green px-4 py-3 text-xs font-semibold text-white transition hover:bg-primary-green/80 disabled:cursor-not-allowed disabled:bg-primary-green/60"
                      >
                        Actualizar
                      </button>
                      <button
                        type="button"
                        onClick={closePasswordEditor}
                        className="rounded-2xl border border-dark-border px-4 py-3 text-xs font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )
        })
      ),
    [users, statusUpdatingId, passwordEditor, isSuperAdmin, passwordRowStatus],
  )

  return (
    <div className="space-y-6">
      <section className="space-y-6 rounded-3xl border border-dark-border bg-[#0d121c] p-6 text-white">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-green">
            Usuarios
          </p>
          <h2 className="text-2xl font-semibold text-white">Registrar nuevo usuario</h2>
          <p className="text-sm text-gray-400">
            Asigna roles y comparte las credenciales por un canal seguro.
          </p>
        </header>

        {status.type && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'border-primary-green/60 bg-primary-green/10 text-primary-green'
                : 'border-red-500/60 bg-red-500/10 text-red-200'
            }`}
          >
            {status.message}
          </div>
        )}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-gray-400" htmlFor="firstName">
                Nombre
              </label>
              <input
                id="firstName"
                type="text"
                className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
                value={form.firstName}
                onChange={(event) => handleChange('firstName', event.target.value)}
                disabled={registerMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400" htmlFor="lastName">
                Apellido
              </label>
              <input
                id="lastName"
                type="text"
                className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
                value={form.lastName}
                onChange={(event) => handleChange('lastName', event.target.value)}
                disabled={registerMutation.isPending}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-gray-400" htmlFor="userName">
                Usuario
              </label>
              <input
                id="userName"
                type="text"
                className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
                value={form.userName}
                onChange={(event) => handleChange('userName', event.target.value)}
                disabled={registerMutation.isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400" htmlFor="email">
                Correo
              </label>
              <input
                id="email"
                type="email"
                className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                disabled={registerMutation.isPending}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-gray-400" htmlFor="password">
                Contrasena temporal
              </label>
              <input
                id="password"
                type="password"
                className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
                value={form.password}
                onChange={(event) => handleChange('password', event.target.value)}
                disabled={registerMutation.isPending}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400" htmlFor="confirmPassword">
                Confirmar contrasena
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="w-full rounded-2xl border border-dark-border bg-transparent px-4 py-3 text-white outline-none transition focus:border-primary-green"
                value={form.confirmPassword}
                onChange={(event) => handleChange('confirmPassword', event.target.value)}
                disabled={registerMutation.isPending}
                required
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-300">Roles asignados</p>
            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((role) => {
                const isActive = form.roles.includes(role.id)
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`rounded-2xl border px-4 py-2 text-sm transition ${
                      isActive
                        ? 'border-primary-green bg-primary-green/10 text-white'
                        : 'border-dark-border text-gray-400 hover:border-primary-green/60'
                    }`}
                    onClick={() => handleRoleToggle(role.id)}
                    disabled={registerMutation.isPending}
                  >
                    {role.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="rounded-2xl bg-primary-green px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-green/80 disabled:cursor-not-allowed disabled:bg-primary-green/60"
            >
              {registerMutation.isPending ? 'Registrando...' : 'Registrar usuario'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={registerMutation.isPending}
              className="rounded-2xl border border-dark-border px-6 py-3 text-sm font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Limpiar
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-3xl border border-dark-border bg-[#0d121c] p-6 text-white">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-green">
              Administrador
            </p>
            <h2 className="text-2xl font-semibold text-white">Usuarios registrados</h2>
            <p className="text-sm text-gray-400">
              Consulta y ajusta roles sin salir del panel.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => usersQuery.refetch()}
              className="rounded-2xl border border-dark-border px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white"
            >
              Refrescar
            </button>
          </div>
        </header>

        {usersError && (
          <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <div className="flex items-center justify-between gap-3">
              <span>{usersError}</span>
              <button
                type="button"
                onClick={() => usersQuery.refetch()}
                className="text-xs font-semibold text-red-200 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {usersQuery.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-2xl border border-dark-border bg-[#05070f] p-4"
                >
                  <div className="h-4 w-1/3 rounded bg-gray-800" />
                  <div className="mt-2 h-3 w-1/4 rounded bg-gray-900" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-6 w-20 rounded-full bg-gray-900" />
                    <div className="h-6 w-16 rounded-full bg-gray-900" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            renderUsers()
          )}
        </div>

        {editingUser && (
          <div className="space-y-4 rounded-2xl border border-primary-green/40 bg-primary-green/5 p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Editar roles: {editingUser.userName}
                </p>
                <p className="text-xs text-gray-400">{editingUser.email || 'Sin correo'}</p>
              </div>
              <button
                type="button"
                onClick={closeRoleEditor}
                className="rounded-2xl border border-dark-border px-4 py-2 text-xs font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            {roleStatus.type && (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  roleStatus.type === 'success'
                    ? 'border-primary-green/60 bg-primary-green/10 text-primary-green'
                    : 'border-red-500/60 bg-red-500/10 text-red-200'
                }`}
              >
                {roleStatus.message}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {ROLE_OPTIONS.map((role) => {
                const isActive = roleDraft.includes(role.id)
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRoleDraft(role.id)}
                    className={`rounded-2xl border px-4 py-2 text-sm transition ${
                      isActive
                        ? 'border-primary-green bg-primary-green/10 text-white'
                        : 'border-dark-border text-gray-400 hover:border-primary-green/60'
                    }`}
                  >
                    {role.label}
                  </button>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveRoles}
                className="rounded-2xl bg-primary-green px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-green/80 disabled:cursor-not-allowed disabled:bg-primary-green/60"
              >
                {updateRolesMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={closeRoleEditor}
                className="rounded-2xl border border-dark-border px-6 py-3 text-sm font-semibold text-gray-300 transition hover:border-primary-green/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default RegisterUser
