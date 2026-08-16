import { History } from 'lucide-react'

const TransactionEmptyState = ({ hasRecords }) => (
  <div className="py-10 text-center">
    <History className="mx-auto mb-4 h-10 w-10 text-gray-600" />
    <p className="text-sm text-gray-400">
      {hasRecords
        ? 'No encontramos coincidencias con los filtros seleccionados'
        : 'Todavía no hay transacciones para mostrar'}
    </p>
    <p className="mt-2 text-xs text-gray-500">
      Ajusta los filtros o intenta nuevamente en unos minutos.
    </p>
  </div>
)

export default TransactionEmptyState
