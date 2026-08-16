import { X, Bell } from 'lucide-react'
import { useMemo } from 'react'

const formatTimestamp = (value) => {
  if (!value) return ''
  try {
    const date = new Date(value)
    return date.toLocaleString()
  } catch {
    return ''
  }
}

const NotificationsPanel = ({
  notifications = [],
  isOpen,
  onClose,
  onMarkAllRead,
  onSelectNotification,
  onRemoveNotification,
}) => {
  const hasNotifications = notifications.length > 0
  const containerClasses = `absolute right-0 top-12 w-80 rounded-3xl border border-dark-border bg-[#0d121c] shadow-2xl transition-all ${
    isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
  }`

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  )

  return (
    <div className={containerClasses}>
      <header className="flex items-center justify-between border-b border-dark-border px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary-green">Alertas</p>
          <p className="text-sm font-semibold text-white">Notificaciones</p>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-gray-400 transition hover:text-white"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="max-h-96 overflow-y-auto px-4 py-2">
        {!hasNotifications && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-gray-400">
            <Bell className="h-10 w-10 text-gray-600" />
            <p>Sin notificaciones por ahora.</p>
          </div>
        )}

        {hasNotifications && (
          <>
            <div className="flex items-center justify-between py-2">
              <p className="text-xs text-gray-400">
                {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al dia'}
              </p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary-green transition hover:text-primary-green/80"
                  onClick={onMarkAllRead}
                >
                  Marcar todo como leido
                </button>
              )}
            </div>

            <ul className="space-y-2">
              {notifications.map((notification) => (
                <li key={notification.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectNotification?.(notification)}
                    className={`w-full rounded-2xl border px-4 py-3 pr-10 text-left transition ${
                      notification.read
                        ? 'border-dark-border text-gray-400 hover:border-primary-green/40 hover:text-white'
                        : 'border-primary-green/40 bg-primary-green/5 text-white hover:border-primary-green/80'
                    }`}
                  >
                    <p className="text-sm font-semibold">{notification.title}</p>
                    {notification.message && (
                      <p className="text-xs text-gray-400">{notification.message}</p>
                    )}
                    <p className="mt-1 text-[11px] text-gray-500">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </button>
                  {onRemoveNotification && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveNotification(notification.id)
                      }}
                      className="absolute right-2 top-2 hidden rounded-full p-1 text-xs text-gray-500 transition hover:bg-red-500/10 hover:text-red-300 group-hover:flex"
                      aria-label="Eliminar notificacion"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

export default NotificationsPanel
