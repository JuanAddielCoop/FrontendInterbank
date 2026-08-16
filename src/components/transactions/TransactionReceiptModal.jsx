import { Download, Receipt, X } from 'lucide-react'
import { formatCurrency, formatDate, formatTime } from '../../utils/transactions'

const TransactionReceiptModal = ({ transaction, onClose, onDownload }) => {
  if (!transaction) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-dark-border bg-dark-card p-6 shadow-card animate-slide-up">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary-green/10 p-3 text-primary-green">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Recibo de transaccion</h3>
              <p className="text-sm text-gray-400">{transaction.id}</p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-full bg-[#151822] p-2 text-gray-400 hover:text-white"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#151822] p-4">
              <p className="text-xs text-gray-500">Fecha</p>
              <p className="text-white">
                {formatDate(transaction.timestamp)} - {formatTime(transaction.timestamp)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#151822] p-4">
              <p className="text-xs text-gray-500">Cuenta</p>
              <p className="font-mono text-white">
                ****{transaction.accountNumber?.slice(-4) ?? '0000'}
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#151822] p-4">
            <p className="text-xs text-gray-500">Beneficiario</p>
            <p className="text-white">{transaction.counterpartyName}</p>
          </div>
          {(transaction.raw?.cuentaOrigen || transaction.raw?.cuentaDestino) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {transaction.raw?.cuentaOrigen && (
                <div className="rounded-2xl bg-[#151822] p-4">
                  <p className="text-xs text-gray-500">Cuenta origen</p>
                  <p className="font-mono text-white">{transaction.raw.cuentaOrigen}</p>
                </div>
              )}
              {transaction.raw?.cuentaDestino && (
                <div className="rounded-2xl bg-[#151822] p-4">
                  <p className="text-xs text-gray-500">Cuenta destino</p>
                  <p className="font-mono text-white">{transaction.raw.cuentaDestino}</p>
                </div>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#151822] p-4">
              <p className="text-xs text-gray-500">Descripcion</p>
              <p className="text-white">{transaction.description}</p>
            </div>
            <div className="rounded-2xl bg-[#151822] p-4">
              <p className="text-xs text-gray-500">Monto</p>
              <p className="text-2xl font-semibold text-primary-green">
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>
          {transaction.raw?.notas && (
            <div className="rounded-2xl bg-[#151822] p-4">
              <p className="text-xs text-gray-500">Notas</p>
              <p className="text-white">{transaction.raw.notas}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => onDownload(transaction)}
          >
            <Download className="h-4 w-4" />
            Descargar
          </button>
        </div>
      </div>
    </div>
  )
}

export default TransactionReceiptModal
