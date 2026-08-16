import TransactionSummary from './transactions/TransactionSummary'
import TransactionFilters from './transactions/TransactionFilters'
import TransactionList from './transactions/TransactionList'
import TransactionReceiptModal from './transactions/TransactionReceiptModal'
import ErrorBanner from './common/ErrorBanner'
import Dialog from './common/Dialog'

const HistoryComponent = ({
  filters,
  sortBy,
  sortOrder,
  onFilterChange,
  onResetFilters,
  onSortChange,
  transactions,
  totalTransactions,
  isLoading,
  error,
  expandedTransaction,
  onToggleExpand,
  onViewReceipt,
  onDownloadReceipt,
  selectedReceipt,
  onCloseReceipt,
  stats,
  dialog,
  onCloseDialog,
  onRetry,
}) => (
  <div className="space-y-6">
    <TransactionSummary stats={stats} />

    <TransactionFilters
      filters={filters}
      onFilterChange={onFilterChange}
      onResetFilters={onResetFilters}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSortChange={onSortChange}
    />

    {error && <ErrorBanner message={error} onRetry={onRetry} />}

    <TransactionList
      transactions={transactions}
      totalTransactions={totalTransactions}
      isLoading={isLoading}
      expandedTransaction={expandedTransaction}
      onToggleExpand={onToggleExpand}
      onViewReceipt={onViewReceipt}
      onDownloadReceipt={onDownloadReceipt}
    />

    <TransactionReceiptModal
      transaction={selectedReceipt}
      onClose={onCloseReceipt}
      onDownload={onDownloadReceipt}
    />

    <Dialog
      isOpen={dialog.isOpen}
      type={dialog.type}
      title={dialog.title}
      message={dialog.message}
      confirmText="Entendido"
      onConfirm={onCloseDialog}
    />
  </div>
)

export default HistoryComponent
