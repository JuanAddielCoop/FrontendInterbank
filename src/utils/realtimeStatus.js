export const REALTIME_STATUS_META = {
  connected: {
    label: 'Conectado',
    description: 'Recibes nuevas operaciones apenas el backend las emite.',
    badgeClass: 'border-primary-green/60 bg-primary-green/10 text-primary-green',
  },
  reconnecting: {
    label: 'Reconectando...',
    description: 'Intentamos recuperar la conexion con el hub en segundo plano.',
    badgeClass: 'border-amber-400/70 bg-amber-400/10 text-amber-200',
  },
  connecting: {
    label: 'Sincronizando...',
    description: 'Abriendo un canal SignalR con el backend.',
    badgeClass: 'border-amber-400/40 bg-amber-400/5 text-amber-100',
  },
  disconnected: {
    label: 'Desconectado',
    description: 'No pudimos sostener la conexion. Puedes actualizar manualmente.',
    badgeClass: 'border-red-400/60 bg-red-400/10 text-red-200',
  },
  error: {
    label: 'Error de hub',
    description: 'No fue posible establecer la conexion de tiempo real.',
    badgeClass: 'border-red-500/70 bg-red-500/10 text-red-200',
  },
  disabled: {
    label: 'Hub deshabilitado',
    description: 'Define VITE_TRANSFER_HUB_URL para activar la sincronizacion en vivo.',
    badgeClass: 'border-dark-border bg-[#0d121c] text-gray-400',
  },
  idle: {
    label: 'En espera',
    description: 'Esperamos las credenciales para iniciar SignalR.',
    badgeClass: 'border-dark-border bg-[#0d121c] text-gray-400',
  },
}
