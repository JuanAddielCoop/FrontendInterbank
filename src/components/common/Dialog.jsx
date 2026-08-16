import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { createPortal } from 'react-dom'

const iconMap = {
  success: { Icon: CheckCircle2, className: 'text-primary-green' },
  error: { Icon: AlertCircle, className: 'text-primary-red' },
  info: { Icon: Info, className: 'text-sky-400' },
}

const Dialog = ({
  isOpen,
  type = 'info',
  title,
  message,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showCancel = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  const { Icon, className } = iconMap[type] ?? iconMap.info

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="common-dialog-title"
        className="w-full max-w-md rounded-2xl border border-dark-border bg-dark-card p-6 shadow-card animate-slide-up"
      >
        <div className="flex items-start gap-3">
          <div className={`rounded-xl bg-[#151822] p-3 ${className}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 id="common-dialog-title" className="text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm text-gray-400">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {showCancel && (
            <button type="button" className="btn-secondary text-sm" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => {
              onConfirm?.()
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default Dialog
