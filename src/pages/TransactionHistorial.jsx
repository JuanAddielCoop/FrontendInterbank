import { useMemo, useState } from 'react'
import HistoryComponent from '../components/HistoryComponent'
import {
  FALLBACK_TRANSACTIONS,
  buildTransactionStats,
  filterTransactions,
  normalizeTransactions,
  sortTransactions,
} from '../utils/transactions'
import useTransactionsQuery from '../modules/transactions/queries/useTransactions'

const INITIAL_FILTERS = {
  search: '',
  type: 'all',
  dateRange: 'all',
  minAmount: '',
  maxAmount: '',
}

const DEFAULT_DIALOG = {
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
}

const TARGET_TRANSACTION_TYPE = 5
const TARGET_ACCOUNT_NUMBER = 'INTER-BANCARIO-001'

const extractTransactionsFromPayload = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.transactions)) return payload.transactions
  if (Array.isArray(payload?.historial)) return payload.historial
  if (Array.isArray(payload?.resultado)) return payload.resultado
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

const matchesTargetCriteria = (transaction) => {
  const typeValue = Number(
    transaction.tipoTransaccion ??
      transaction.tipo ??
      transaction.transactionType ??
      transaction.typeId,
  )

  const matchesType = !Number.isNaN(typeValue)
    ? typeValue === TARGET_TRANSACTION_TYPE
    : String(transaction.type ?? '').toLowerCase() === 'transfer'

  const matchesAccount = [
    transaction.cuentaDestino,
    transaction.cuentaOrigen,
    transaction.numeroCuenta,
    transaction.accountNumber,
    transaction.account,
  ]
    .filter(Boolean)
    .some((value) => String(value) === TARGET_ACCOUNT_NUMBER)

  return matchesType && matchesAccount
}

const TransactionHistorial = () => {
  const { data, isPending, error, refetch } = useTransactionsQuery()
  const [filters, setFilters] = useState(() => ({ ...INITIAL_FILTERS }))
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [expandedTransaction, setExpandedTransaction] = useState(null)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [dialog, setDialog] = useState(() => ({ ...DEFAULT_DIALOG }))

  const rawTransactions = useMemo(() => {
    const apiTransactions = extractTransactionsFromPayload(data)
    const filteredApiTransactions = apiTransactions.filter(matchesTargetCriteria)

    if (apiTransactions.length > 0 || data) {
      return filteredApiTransactions
    }

    return FALLBACK_TRANSACTIONS.filter(matchesTargetCriteria)
  }, [data])

  const transactions = useMemo(
    () => normalizeTransactions(rawTransactions, TARGET_ACCOUNT_NUMBER),
    [rawTransactions],
  )

  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters],
  )

  const sortedTransactions = useMemo(
    () => sortTransactions(filteredTransactions, sortBy, sortOrder),
    [filteredTransactions, sortBy, sortOrder],
  )

  const stats = useMemo(() => buildTransactionStats(transactions), [transactions])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleResetFilters = () => setFilters({ ...INITIAL_FILTERS })

  const handleSortChange = (nextSortBy, nextSortOrder = sortOrder) => {
    setSortBy(nextSortBy)
    setSortOrder(nextSortOrder)
  }

  const handleToggleExpand = (transactionId) => {
    setExpandedTransaction((prev) => (prev === transactionId ? null : transactionId))
  }

  const handleViewReceipt = (transaction) => setSelectedReceipt(transaction)
  const handleCloseReceipt = () => setSelectedReceipt(null)

  const showDialog = (payload) => setDialog({ ...DEFAULT_DIALOG, ...payload, isOpen: true })
  const closeDialog = () => setDialog({ ...DEFAULT_DIALOG })

  const handleDownloadReceipt = (transaction) => {
    try {
      const payload = JSON.stringify(
        {
          id: transaction.id,
          date: transaction.timestamp,
          amount: transaction.amount,
          description: transaction.description,
          counterparty: transaction.counterpartyName,
          account: transaction.accountNumber,
          nameAccountBank: transaction.nameAccountBank
        },
        null,
        2,
      )

      if (typeof window === 'undefined') {
        showDialog({
          type: 'info',
          title: 'Descarga disponible',
          message: 'Este recibo se puede descargar solo en el navegador.',
        })
        return
      }

      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${transaction.id}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showDialog({
        type: 'success',
        title: 'Recibo descargado',
        message: 'Guardamos un resumen en tu carpeta de descargas.',
      })
    } catch (err) {
      showDialog({
        type: 'error',
        title: 'No pudimos descargar el recibo',
        message: err?.message ?? 'Intenta nuevamente en unos segundos.',
      })
    }
  }

  return (
    <HistoryComponent
      filters={filters}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onFilterChange={handleFilterChange}
      onResetFilters={handleResetFilters}
      onSortChange={handleSortChange}
      transactions={sortedTransactions}
      totalTransactions={transactions.length}
      isLoading={isPending}
      error={error}
      expandedTransaction={expandedTransaction}
      onToggleExpand={handleToggleExpand}
      onViewReceipt={handleViewReceipt}
      onDownloadReceipt={handleDownloadReceipt}
      selectedReceipt={selectedReceipt}
      onCloseReceipt={handleCloseReceipt}
      stats={stats}
      dialog={dialog}
      onCloseDialog={closeDialog}
      onRetry={refetch}
    />
  )
}

export default TransactionHistorial
