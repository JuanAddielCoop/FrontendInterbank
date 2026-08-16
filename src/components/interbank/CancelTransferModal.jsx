import { useEffect, useMemo, useState } from 'react'
import Dialog from '../common/Dialog'
import { useAuth } from '../../context/AuthContext'

const defaultState = { updatedBy: '', message: '' }

const CANCEL_REASONS = [
  'Datos de cuenta inválidos',
  'Nombre del beneficiario no coincide',
  'Comprobante de transferencia ilegible',
  'Monto no coincide con el comprobante',
  'Transferencia duplicada',
  'Cuenta de destino bloqueada o inactiva',
  'Otro (especificar)',
]

const CancelTransferModal = ({ transfer, isOpen, onClose, onSubmit, loading }) => {
  const [form, setForm] = useState(defaultState)
  const [selectedReason, setSelectedReason] = useState('')
  const [dialog, setDialog] = useState({ isOpen: false, type: 'info', title: '', message: '' })
  const { user } = useAuth()

  const currentUserName = useMemo(() => {
    const first = user?.firstName?.trim() ?? ''
    const last = user?.lastName?.trim() ?? ''
    const composed = `${first} ${last}`.trim()
    return composed || user?.userName || ''
  }, [user])

  useEffect(() => {
    if (isOpen) {
      const resolvedUpdatedBy = currentUserName || transfer?.updatedBy || ''
      setForm({
        updatedBy: resolvedUpdatedBy,
        message: '',
      })
      setSelectedReason('')
    }
  }, [isOpen, transfer, currentUserName])

  const handleReasonChange = (reason) => {
    setSelectedReason(reason)
    if (reason !== 'Otro (especificar)') {
      setForm((prev) => ({ ...prev, message: reason }))
    } else {
      setForm((prev) => ({ ...prev, message: '' }))
    }
  }

  const handleSubmit = () => {
    if (!form.updatedBy || !form.message) {
      setDialog({
        isOpen: true,
        type: 'error',
        title: 'Faltan datos',
        message: 'Indica quién cancela y el motivo correspondiente.',
      })
      return
    }

    onSubmit({
      id: transfer?.id,
      updatedBy: form.updatedBy,
      message: form.message,
    })
  }

  if (!isOpen || !transfer) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-dark-border bg-dark-card p-6 shadow-card transition-all duration-300">
          <header className="mb-4">
            <p className="text-xs uppercase tracking-[0.3em] text-primary-red font-semibold">Cancelar</p>
            <h3 className="text-2xl font-bold text-white">Transferencia #{transfer.id}</h3>
            <p className="text-sm text-gray-500 mt-1">
              Esta acción notificará al socio y marcará el flujo como cancelado permanentemente.
            </p>
          </header>

          <div className="space-y-5">
            <div className="rounded-2xl border border-dark-border bg-[#111427]/50 px-4 py-3 text-sm text-gray-300">
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Autorizado por</p>
              <p className="mt-1 text-white font-medium">{form.updatedBy || 'Sin usuario'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 block px-1">
                Motivo de la cancelación
              </label>
              <select
                className="input-field w-full cursor-pointer bg-[#111427] border-dark-border text-white focus:border-primary-red/50"
                value={selectedReason}
                onChange={(e) => handleReasonChange(e.target.value)}
              >
                <option value="" disabled>Elegir motivo...</option>
                {CANCEL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {selectedReason === 'Otro (especificar)' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                <label className="text-xs font-semibold text-gray-400 block px-1">
                  Especifica el motivo
                </label>
                <textarea
                  rows={3}
                  className="input-field w-full bg-[#111427] border-dark-border text-white focus:border-primary-red/50 placeholder:text-gray-600"
                  placeholder="Explica detalladamente la razón"
                  value={form.message}
                  onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                  autoFocus
                />
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button 
              type="button" 
              className="px-6 py-2.5 rounded-xl border border-dark-border text-gray-400 hover:text-white hover:bg-white/5 transition-all font-semibold text-sm"
              onClick={onClose} 
              disabled={loading}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="px-6 py-2.5 rounded-xl bg-primary-red text-white hover:bg-red-500 active:scale-95 transition-all font-semibold text-sm shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSubmit}
              disabled={loading || !form.message}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cancelando...
                </span>
              ) : (
                'Confirmar cancelación'
              )}
            </button>
          </div>
        </div>
      </div>
      <Dialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        confirmText="Entendido"
        onConfirm={() => setDialog({ isOpen: false })}
      />
    </>
  )
}

export default CancelTransferModal
