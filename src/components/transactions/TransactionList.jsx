import TransactionCard from './TransactionCard'
import TransactionEmptyState from './TransactionEmptyState'
import Skeleton from '../common/Skeleton'

const TransactionList = ({
  transactions,
  isLoading,
  expandedTransaction,
  onToggleExpand,
  onViewReceipt,
  onDownloadReceipt,
  totalTransactions,
}) => (
  <section className="card space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-lg font-semibold text-white">Historial de transacciones</h2>
        <p className="text-sm text-gray-400">Mostrando {transactions.length} resultados</p>
      </div>
    </header>

    {isLoading ? (
      <Skeleton rows={5} />
    ) : transactions.length === 0 ? (
      <TransactionEmptyState hasRecords={totalTransactions > 0} />
    ) : (
      <div className="space-y-2">
        {transactions.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            isExpanded={expandedTransaction === transaction.id}
            onToggle={onToggleExpand}
            onViewReceipt={onViewReceipt}
            onDownloadReceipt={onDownloadReceipt}
          />
        ))}
      </div>
    )}
  </section>
)

export default TransactionList
