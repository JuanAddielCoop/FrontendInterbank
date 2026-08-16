import { ChevronDown, ChevronUp, Download, Eye, Info } from 'lucide-react'
import {
  formatCurrency,
  formatDate,
  formatTime,
  getTransactionAppearance,
} from '../../utils/transactions'

const TransactionCard = ({
  transaction,
  isExpanded,
  onToggle,
  onViewReceipt,
  onDownloadReceipt,
}) => {
  const appearance = getTransactionAppearance(transaction.type, transaction.direction)

  return (
    <article className="rounded-2xl border border-dark-border bg-[#0c0f19]">
      <button
        type="button"
        onClick={() => onToggle(transaction.id)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#121627]"
      >
        <div className={`rounded-2xl p-3 ${appearance.badgeClass}`}>
          <appearance.Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-white">{transaction.description}</p>
          <p className="text-xs text-gray-500">{transaction.counterpartyName}</p>
          <p className="text-[11px] text-gray-500">
            {formatDate(transaction.timestamp)} - {formatTime(transaction.timestamp)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold ${appearance.amountClass}`}>
            {appearance.sign}
            {formatCurrency(transaction.amount)}
          </p>
          <p className="text-xs capitalize text-gray-500">{transaction.status}</p>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {isExpanded && (
        <div className="border-t border-dark-border px-4 py-4 text-sm text-gray-300">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-500">ID</p>
              <p className="font-mono text-xs text-white">{transaction.id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Cuenta</p>
              <p className="font-mono text-xs text-white">
                ****{transaction.accountNumber?.slice(-4) ?? '0000'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Estado</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#151822] px-2 py-1 text-xs capitalize text-primary-green">
                <Info className="h-3 w-3" />
                {transaction.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Detalle</p>
              <p className="text-white">
                {transaction.raw?.notas ??
                  transaction.raw?.transferData?.observaciones ??
                  transaction.description}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 text-xs"
              onClick={() => onViewReceipt(transaction)}
            >
              <Eye className="h-4 w-4" />
              Ver recibo
            </button>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2 text-xs"
              onClick={() => onDownloadReceipt(transaction)}
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

export default TransactionCard
