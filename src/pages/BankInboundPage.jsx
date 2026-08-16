import { useMemo, useState } from "react";
import BankInboundFilters from "../components/bankInbound/BankInboundFilters";
import BankInboundTable from "../components/bankInbound/BankInboundTable";
import BankInboundPagination from "../components/bankInbound/BankInboundPagination";
import BankInboundSummary from "../components/bankInbound/BankInboundSummary";
import ErrorBanner from "../components/common/ErrorBanner";
import Dialog from "../components/common/Dialog";
import { useNotifications } from "../context/NotificationContext";
import { REALTIME_STATUS_META } from "../utils/realtimeStatus";
import {
  useBankInbound,
  useBankInboundDashboard,
  useConfirmBankInbound,
  useCancelBankInbound,
  DEFAULT_FILTERS,
  DEFAULT_PAGE_SIZE,
} from "../modules/bankInbound/queries/useBankInbound";

// ─── Filtros rápidos (igual que Interbank) ────────────────────────────────────
const QUICK_FILTERS = [
  {
    id: "all",
    label: "Todos",
    subtitle: "Historial completo de depósitos",
    isConfirm: "",
  },
  {
    id: "pending",
    label: "Pendientes",
    subtitle: "Esperando confirmación",
    isConfirm: "PENDIENTE",
  },
  {
    id: "confirmed",
    label: "Confirmadas",
    subtitle: "Depósitos procesados",
    isConfirm: "CONFIRMADO",
  },
  {
    id: "cancelled",
    label: "Canceladas",
    subtitle: "Rechazadas o anuladas",
    isConfirm: "CANCELADO",
  },
];

// ─── Estado por defecto del Dialog ───────────────────────────────────────────
const DEFAULT_DIALOG = { isOpen: false, type: "info", title: "", message: "" };

const CANCEL_REASONS = [
  'Monto del comprobante no coincide',
  'Comprobante ilegible o incompleto',
  'Referencia de depósito inválida',
  'Depósito no reflejado en cuenta bancaria',
  'Transacción duplicada',
  'Otro (especificar)',
];

// ─── Modal de acción (Confirmar / Cancelar) ───────────────────────────────────
const ActionModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
  showComment = false,
  showConfirmationImage = false,
}) => {
  const [comentario, setComentario] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [confirmationImage, setConfirmationImage] = useState(null);

  if (!isOpen) return null;

  const handleReasonChange = (reason) => {
    setSelectedReason(reason);
    if (reason !== 'Otro (especificar)') {
      setComentario(reason);
    } else {
      setComentario("");
    }
  };

  const handleConfirm = () => {
    onConfirm({
      comentario,
      confirmationImage,
    });
    setComentario("");
    setSelectedReason("");
    setConfirmationImage(null);
  };

  const handleCancel = () => {
    setComentario("");
    setSelectedReason("");
    setConfirmationImage(null);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-dark-border bg-dark-card p-6 shadow-card transition-all duration-300">
        <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
        <p className="mb-4 text-sm text-gray-400">{message}</p>

        {showConfirmationImage && (
          <div className="mb-4">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Comprobante de confirmación
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              className="input-field w-full cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-primary-green/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-green"
              onChange={(event) =>
                setConfirmationImage(event.target.files?.[0] ?? null)
              }
            />
            <p className="mt-2 text-xs text-gray-500">
              Sube la evidencia emitida por la cooperativa al confirmar el depósito.
            </p>
          </div>
        )}

        {showComment && (
          <div className="mb-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Especifica el motivo
                </label>
                <textarea
                  className="input-field min-h-[100px] w-full resize-none py-3"
                  placeholder="Escribe el motivo aquí..."
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Atrás
          </button>
          <button
            type="button"
            className={`btn-primary ${showComment ? 'bg-primary-red text-white hover:bg-red-500' : ''}`}
            onClick={handleConfirm}
            disabled={
              loading ||
              (showComment && !comentario.trim()) ||
              (showConfirmationImage && !confirmationImage)
            }
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Procesando…
              </span>
            ) : (
              "Confirmar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Página principal ─────────────────────────────────────────────────────────
const BankInboundPage = () => {
  const { realtimeStatus } = useNotifications();
  const realtimeMeta =
    REALTIME_STATUS_META[realtimeStatus] ?? REALTIME_STATUS_META.idle;
  // Filtro rápido activo
  const [activeQuickFilter, setActiveQuickFilter] = useState("pending");

  // Filtros avanzados (draft = lo que el usuario escribe, active = lo que se envía al query)
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS);

  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Targets de acción
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dialog, setDialog] = useState(DEFAULT_DIALOG);

  // ── Filtros efectivos = fusión del filtro rápido + avanzados ────────────────
  const currentQuick =
    QUICK_FILTERS.find((q) => q.id === activeQuickFilter) ?? QUICK_FILTERS[0];
  const effectiveFilters = useMemo(
    () => ({
      ...activeFilters,
      isConfirm: currentQuick.isConfirm,
    }),
    [activeFilters, currentQuick.isConfirm],
  );

  // ── React Query ─────────────────────────────────────────────────────────────
  const {
    data,
    isPending,
    isFetching,
    isError,
    refetch: refetchRecords,
  } = useBankInbound({
    filters: effectiveFilters,
    pageNumber,
    pageSize,
  });
  const {
    data: dashboard,
    isFetching: isDashboardFetching,
    isError: isDashboardError,
    refetch: refetchDashboard,
  } = useBankInboundDashboard(activeFilters);

  const confirmMutation = useConfirmBankInbound();
  const cancelMutation = useCancelBankInbound();

  const records = data?.data ?? [];
  const hasNextPage = records.length >= pageSize;
  const refetch = () => {
    refetchRecords();
    refetchDashboard();
  };

  // ── Aplicar filtro rápido ──────────────────────────────────────────────────
  const applyQuickFilter = (quickId) => {
    setActiveQuickFilter(quickId);
    setPageNumber(1);
  };

  // ── Handlers del buscador avanzado ─────────────────────────────────────────
  const handleFilterChange = (key, value) => {
    setDraftFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setActiveFilters({ ...draftFilters });
    setPageNumber(1);
  };

  const handleReset = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setActiveFilters(DEFAULT_FILTERS);
    setActiveQuickFilter("pending");
    setPageNumber(1);
  };

  // ── Paginación ──────────────────────────────────────────────────────────────
  const handlePageChange = (next) => {
    if (next >= 1) setPageNumber(next);
  };
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setPageNumber(1);
  };

  // ── Dialog helpers ──────────────────────────────────────────────────────────
  const showDialog = (payload) =>
    setDialog({ ...DEFAULT_DIALOG, ...payload, isOpen: true });
  const closeDialog = () => setDialog(DEFAULT_DIALOG);

  // ─── Confirmar ───────────────────────────────────────────────────────────────
  const handleConfirmSubmit = async ({
    comentario = "",
    confirmationImage,
  } = {}) => {
    if (!confirmTarget) return;
    setActionLoading(true);
    try {
      await confirmMutation.mutateAsync({
        id: confirmTarget.id,
        comentario,
        confirmationImage,
      });
      showDialog({
        type: "success",
        title: "Depósito confirmado",
        message: `El depósito de ${confirmTarget.bankName} (socio #${confirmTarget.socioId}) fue confirmado correctamente.`,
      });
      setConfirmTarget(null);
    } catch (err) {
      showDialog({
        type: "error",
        title: "Error al confirmar",
        message:
          err?.response?.data?.message ?? err?.message ?? "Intenta de nuevo.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Cancelar ────────────────────────────────────────────────────────────────
  const handleCancelSubmit = async ({ comentario = "", recibo = 0 } = {}) => {
    if (!cancelTarget) return;
    setActionLoading(true);
    try {
      await cancelMutation.mutateAsync({
        id: cancelTarget.id,
        comentario,
        recibo,
      });
      showDialog({
        type: "success",
        title: "Depósito cancelado",
        message: `El depósito de ${cancelTarget.bankName} (socio #${cancelTarget.socioId}) fue cancelado correctamente.`,
      });
      setCancelTarget(null);
      applyQuickFilter("cancelled");
    } catch (err) {
      showDialog({
        type: "error",
        title: "Error al cancelar",
        message:
          err?.response?.data?.message ?? err?.message ?? "Intenta de nuevo.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <BankInboundSummary
        metrics={dashboard?.data}
        isLoading={!dashboard?.data}
      />

      {isDashboardError && (
        <ErrorBanner
          message="No pudimos obtener las métricas de depósitos."
          onRetry={() => refetchDashboard()}
        />
      )}

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dark-border bg-[#0d121c] px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary-green">
            BankInbound
          </p>
          <h2 className="text-base font-semibold text-white">
            Depósitos Interbancarios
          </h2>
          <p className="text-xs text-gray-400">
            Revisa, confirma y gestiona los depósitos recibidos desde bancos
            externos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            title={realtimeMeta.description}
            className={`rounded-2xl border px-4 py-2 text-xs font-semibold transition ${realtimeMeta.badgeClass}`}
          >
            {realtimeMeta.label}
          </span>
          <button
            id="bi-refresh"
            type="button"
            onClick={() => refetch()}
            className="rounded-2xl border border-primary-green/50 px-4 py-2 text-xs font-semibold text-primary-green transition hover:border-primary-green hover:text-white"
          >
            {(isFetching && !isPending) || isDashboardFetching
              ? "Actualizando..."
              : "Actualizar ahora"}
          </button>
        </div>
      </div>

      {/* ── Buscador avanzado ─────────────────────────────────────────────── */}
      <BankInboundFilters
        filters={draftFilters}
        onChange={handleFilterChange}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* ── Filtros rápidos (igual que Interbank) ────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_FILTERS.map((quick) => {
          const isActive = activeQuickFilter === quick.id;
          return (
            <button
              key={quick.id}
              id={`bi-quick-${quick.id}`}
              type="button"
              onClick={() => applyQuickFilter(quick.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-primary-green bg-primary-green/10 text-white"
                  : "border-dark-border bg-[#0d121c] text-gray-400 hover:border-primary-green/60"
              }`}
            >
              <p className="text-sm font-semibold">{quick.label}</p>
              <p className="text-xs text-gray-500">{quick.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {isError && (
        <ErrorBanner
          message="No pudimos obtener los depósitos. Revisa tu conexión o intenta de nuevo."
          onRetry={() => refetch()}
        />
      )}

      {/* ── Tabla ────────────────────────────────────────────────────────── */}
      <BankInboundTable
        records={records}
        isLoading={isPending}
        onConfirm={(record) => setConfirmTarget(record)}
        onCancel={(record) => setCancelTarget(record)}
        emptyMessage={`No hay depósitos ${currentQuick.label.toLowerCase()} para mostrar.`}
      />

      {/* ── Paginación ───────────────────────────────────────────────────── */}
      <BankInboundPagination
        pageNumber={pageNumber}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* ── Modal: Confirmar ─────────────────────────────────────────────── */}
      <ActionModal
        isOpen={Boolean(confirmTarget)}
        title="Confirmar depósito"
        message={
          confirmTarget
            ? `¿Deseas confirmar el depósito de ${confirmTarget.bankName} por ${new Intl.NumberFormat(
                "es-DO",
                { style: "currency", currency: "DOP" },
              ).format(
                confirmTarget.amount ?? 0,
              )} del socio #${confirmTarget.socioId}?`
            : ""
        }
        showConfirmationImage={true}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmTarget(null)}
        loading={actionLoading}
      />

      {/* ── Modal: Cancelar ──────────────────────────────────────────────── */}
      <ActionModal
        isOpen={Boolean(cancelTarget)}
        title="Cancelar depósito"
        message={
          cancelTarget
            ? `¿Estás seguro de cancelar el depósito de ${cancelTarget.bankName} (socio #${cancelTarget.socioId})? Esta acción no se puede deshacer.`
            : ""
        }
        showComment={true}
        onConfirm={handleCancelSubmit}
        onCancel={() => setCancelTarget(null)}
        loading={actionLoading}
      />

      {/* ── Dialog de resultado ──────────────────────────────────────────── */}
      <Dialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={closeDialog}
        confirmText="Entendido"
      />
    </div>
  );
};

export default BankInboundPage;
