import { useEffect, useMemo, useState } from 'react'
import InterbankFilters from '../components/interbank/InterbankFilters'
import InterbankSummary from '../components/interbank/InterbankSummary'
import InterbankList from '../components/interbank/InterbankList'
import InterbankPagination from '../components/interbank/InterbankPagination'
import ConfirmTransferModal from '../components/interbank/ConfirmTransferModal'
import CancelTransferModal from '../components/interbank/CancelTransferModal'
import ErrorBanner from '../components/common/ErrorBanner'
import Dialog from '../components/common/Dialog'
import { INTERBANK_FALLBACK, buildInterbankStats } from '../utils/interbank'
import { useNotifications } from '../context/NotificationContext'
import { useAuth } from '../context/AuthContext'
import {
  DEFAULT_FILTERS,
  useCancelInterbankTransfer,
  useConfirmInterbankTransfer,
  useInterbankTransfers,
  useInterbankSummary,
} from '../modules/interbank/queries/useInterbankTransfers'
import { retainCompletedInterbankSnapshot } from '../modules/interbank/interbankLoader'
import { REALTIME_STATUS_META } from '../utils/realtimeStatus'

const DEFAULT_DIALOG = {
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
}

const QUICK_FILTERS = [
  {
    id: 'history',
    label: 'Historial',
    subtitle: 'Todo el registro de transferencias',
    config: { isSubmit: '', isCancelled: '' },
  },
  {
    id: 'pending',
    label: 'Pendientes',
    subtitle: 'Esperando confirmacion',
    config: { isSubmit: 'false', isCancelled: 'false' },
  },
  {
    id: 'approved',
    label: 'Confirmadas',
    subtitle: 'Transferencias completadas',
    config: { isSubmit: 'true', isCancelled: 'false' },
  },
  {
    id: 'cancelled',
    label: 'Canceladas',
    subtitle: 'Rechazadas o anuladas',
    config: { isSubmit: '', isCancelled: 'true' },
  },
]

const InterbankDashboard = () => {
  const { roles } = useAuth()
  const isAdminOnly = roles.includes('Admin') && !roles.includes('SuperAdmin')

  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [pageNumber, setPageNumber] = useState(1)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [dialog, setDialog] = useState(DEFAULT_DIALOG)
  const [activeQuickFilter, setActiveQuickFilter] = useState('pending')
  const { realtimeStatus } = useNotifications()

  const {
    data,
    isPending,
    error,
    refetch: refetchTransfers,
    syncStatus,
    loadedPages,
    raw,
  } = useInterbankTransfers(filters)
  const { data: summaryData, refetch: refetchSummary } = useInterbankSummary(filters)
  const [stableSummaryDataset, setStableSummaryDataset] = useState(null)

  useEffect(() => {
    setStableSummaryDataset((previous) =>
      retainCompletedInterbankSnapshot(previous, raw, syncStatus),
    )
  }, [raw, syncStatus])

  const refetch = () => {
    refetchTransfers()
    refetchSummary()
  }
  const confirmMutation = useConfirmInterbankTransfer()
  const cancelMutation = useCancelInterbankTransfer()

  const availableQuickFilters = useMemo(() => {
    if (isAdminOnly) return QUICK_FILTERS.filter((quick) => quick.id === 'pending')
    return QUICK_FILTERS
  }, [isAdminOnly])

  useEffect(() => {
    const exists = availableQuickFilters.some((item) => item.id === activeQuickFilter)
    if (!exists) {
      const fallbackFilter = availableQuickFilters[0]?.id ?? 'custom'
      setActiveQuickFilter(fallbackFilter)
      setFilters((prev) => ({
        ...prev,
        ...(availableQuickFilters[0]?.config ?? {}),
      }))
      setPageNumber(1)
    }
  }, [availableQuickFilters, activeQuickFilter])

  const dataset = data !== undefined && data !== null ? data : INTERBANK_FALLBACK
  const summaryLoading = !summaryData && !stableSummaryDataset

  const pendingTransfers = useMemo(
    () => dataset.filter((transfer) => !transfer.isSubmit && !transfer.isCancelled),
    [dataset],
  )

  const approvedTransfers = useMemo(
    () => dataset.filter((transfer) => transfer.isSubmit && !transfer.isCancelled),
    [dataset],
  )

  const cancelledTransfers = useMemo(
    () => dataset.filter((transfer) => transfer.isCancelled),
    [dataset],
  )

  const stats = useMemo(() => {
    if (summaryData) return summaryData
    return buildInterbankStats(stableSummaryDataset ?? [])
  }, [summaryData, stableSummaryDataset])
  const realtimeMeta = REALTIME_STATUS_META[realtimeStatus] ?? REALTIME_STATUS_META.idle


  const paginatedTransfers = useMemo(() => {
    const start = (pageNumber - 1) * filters.pageSize
    const end = start + filters.pageSize
    switch (activeQuickFilter) {
      case 'approved':
        return approvedTransfers.slice(start, end)
      case 'cancelled':
        return cancelledTransfers.slice(start, end)
      case 'history':
        return dataset.slice(start, end)
      case 'custom':
        return dataset.slice(start, end)
      case 'pending':
      default:
        return pendingTransfers.slice(start, end)
    }
  }, [
    activeQuickFilter,
    approvedTransfers,
    cancelledTransfers,
    dataset,
    filters.pageSize,
    pageNumber,
    pendingTransfers,
  ])

  const currentCollectionSize = useMemo(() => {
    switch (activeQuickFilter) {
      case 'approved':
        return approvedTransfers.length
      case 'cancelled':
        return cancelledTransfers.length
      case 'history':
      case 'custom':
        return dataset.length
      case 'pending':
      default:
        return pendingTransfers.length
    }
  }, [activeQuickFilter, approvedTransfers, cancelledTransfers, dataset, pendingTransfers])

  const displayedMeta = useMemo(() => {
    const quick = availableQuickFilters.find((item) => item.id === activeQuickFilter)
    if (quick) return quick
    return {
      label: 'Filtrado personalizado',
      subtitle: 'Resultados segun criterios avanzados',
      id: 'custom',
    }
  }, [activeQuickFilter, availableQuickFilters])

  const handleFilterChange = (key, value) => {
    setActiveQuickFilter((prev) => (prev === 'custom' ? 'custom' : prev))
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      pageSize: key === 'pageSize' ? Number(value) : prev.pageSize,
    }))
    setPageNumber(1)
  }

  const applyQuickFilter = (filterId) => {
    const quick = availableQuickFilters.find((filter) => filter.id === filterId)
    if (!quick) return
    setActiveQuickFilter(filterId)
    setFilters((prev) => ({
      ...prev,
      ...quick.config,
    }))
    setPageNumber(1)
  }

  const handlePageChange = (nextPage) => {
    if (nextPage < 1) return
    setPageNumber(nextPage)
  }

  const handlePageSizeChange = (size) => {
    setFilters((prev) => ({ ...prev, pageSize: size }))
    setPageNumber(1)
  }

  const showDialog = (payload) =>
    setDialog({
      ...DEFAULT_DIALOG,
      ...payload,
      isOpen: true,
    })
  const closeDialog = () => setDialog(DEFAULT_DIALOG)

  const handleConfirmSubmit = async (payload) => {
    setActionLoading(true)
    try {
      await confirmMutation.mutateAsync(payload)
      showDialog({
        type: 'success',
        title: 'Transferencia confirmada',
        message: 'El registro fue confirmado y el socio recibira la notificacion.',
      })
      setConfirmTarget(null)
    } catch (err) {
      showDialog({
        type: 'error',
        title: 'No se pudo confirmar',
        message: err?.response?.data?.message ?? err?.message ?? 'Intentalo de nuevo.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelSubmit = async (payload) => {
    setActionLoading(true)
    try {
      await cancelMutation.mutateAsync(payload)
      showDialog({
        type: 'success',
        title: 'Transferencia cancelada',
        message: 'Registramos la cancelacion y notificamos al socio.',
      })
      setCancelTarget(null)
      applyQuickFilter('cancelled')
    } catch (err) {
      showDialog({
        type: 'error',
        title: 'No se pudo cancelar',
        message: err?.response?.data?.message ?? err?.message ?? 'Revisa los datos e intenta de nuevo.',
      })
    } finally {
      setActionLoading(false)
    }
  }

  const disableNext = pageNumber * filters.pageSize >= currentCollectionSize

  return (
    <div className="space-y-6">
      {!isAdminOnly && <InterbankSummary stats={stats} isLoading={summaryLoading} />}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dark-border bg-[#0d121c] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Sincronizacion en tiempo real</p>
          <p className="text-xs text-gray-400">{realtimeMeta.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${realtimeMeta.badgeClass}`}
          >
            {realtimeMeta.label}
          </span>
          <button
            type="button"
            onClick={refetch}
            className="rounded-2xl border border-primary-green/50 px-4 py-2 text-xs font-semibold text-primary-green transition hover:border-primary-green hover:text-white"
          >
            Actualizar ahora
          </button>
        </div>
      </div>
      {syncStatus === 'syncing' && (
        <div
          role="status"
          className="rounded-2xl border border-primary-green/40 bg-primary-green/5 px-4 py-3 text-sm text-gray-300"
        >
          {`Mostrando resultados disponibles. Sincronizando historial en segundo plano (${loadedPages} pagina${loadedPages === 1 ? '' : 's'} cargada${loadedPages === 1 ? '' : 's'}).`}
        </div>
      )}
      <InterbankFilters
        filters={filters}
        onChange={handleFilterChange}
        onReset={() => {
          setFilters({ ...DEFAULT_FILTERS })
          setPageNumber(1)
          setActiveQuickFilter(isAdminOnly ? 'pending' : 'history')
        }}
        onSubmit={refetch}
        isAdminOnly={isAdminOnly}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {availableQuickFilters.map((quick) => {
          const isActive = activeQuickFilter === quick.id
          return (
            <button
              key={quick.id}
              type="button"
              onClick={() => applyQuickFilter(quick.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-primary-green bg-primary-green/10 text-white'
                  : 'border-dark-border bg-[#0d121c] text-gray-400 hover:border-primary-green/60'
              }`}
            >
              <p className="text-sm font-semibold">{quick.label}</p>
              <p className="text-xs text-gray-500">{quick.subtitle}</p>
            </button>
          )
        })}
      </div>

      {error && (
        <ErrorBanner
          message="No pudimos obtener las transferencias. Validamos el ultimo snapshot disponible."
          onRetry={refetch}
        />
      )}

      <InterbankList
        title={
          activeQuickFilter === 'custom'
            ? 'Transferencias filtradas'
            : `Transferencias ${displayedMeta.label.toLowerCase()}`
        }
        description={displayedMeta.subtitle}
        transfers={paginatedTransfers}
        isLoading={isPending}
        onConfirm={(transfer) => setConfirmTarget(transfer)}
        onCancel={(transfer) => setCancelTarget(transfer)}
        emptyMessage={`No hay transferencias ${displayedMeta.label.toLowerCase()} para mostrar.`}
        showActions={activeQuickFilter === 'pending' || activeQuickFilter === 'custom'}
      />

      <InterbankPagination
        pageNumber={pageNumber}
        pageSize={filters.pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        disablePrev={pageNumber <= 1}
        disableNext={disableNext}
      />

      <ConfirmTransferModal
        transfer={confirmTarget}
        isOpen={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        onSubmit={handleConfirmSubmit}
        loading={actionLoading}
      />

      <CancelTransferModal
        transfer={cancelTarget}
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onSubmit={handleCancelSubmit}
        loading={actionLoading}
      />

      <Dialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={closeDialog}
        confirmText="Entendido"
      />
    </div>
  )
}

export default InterbankDashboard
