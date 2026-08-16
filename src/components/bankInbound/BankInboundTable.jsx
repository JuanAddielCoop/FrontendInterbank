import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  Clock,
  Eye,
  Loader2,
  ShieldX,
  User,
} from "lucide-react";
import Skeleton from "../common/Skeleton";
import api from "../../lib/axiosInstance";
import { getApiBaseUrl } from "../../utils/api";
import {
  formatCurrency,
  formatDate,
  formatTime,
} from "../../utils/transactions";

// ─── URL base para imágenes ───────────────────────────────────────────────────
const IMAGE_BASE = `${getApiBaseUrl()}/BankInbound/image-socio?imageUrl=`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const buildImageUrl = (imageUrl) => {
  if (!imageUrl?.trim()) return null;
  const url = imageUrl.trim();
  if (url.startsWith("http")) return url;
  return `${IMAGE_BASE}${encodeURIComponent(url)}`;
};

const isProtectedImageUrl = (imageUrl) => {
  if (!imageUrl) return false;
  if (imageUrl.startsWith(IMAGE_BASE)) return true;

  try {
    return new URL(imageUrl).pathname
      .toLowerCase()
      .endsWith("/bankinbound/image-socio");
  } catch {
    return false;
  }
};

// ─── Badge de estado ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDIENTE: {
    label: "Pendiente",
    cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  CONFIRMADO: {
    label: "Confirmado",
    cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  CANCELADO: {
    label: "Cancelado",
    cls: "bg-red-500/15 text-red-300 border border-red-500/30",
    dot: "bg-red-400",
  },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status?.toUpperCase()] ?? {
    label: status ?? "Desconocido",
    cls: "bg-gray-500/15 text-gray-300 border border-gray-500/30",
    dot: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ─── Modal de imagen ──────────────────────────────────────────────────────────
const ImagePreviewModal = ({ isOpen, imageUrl, title, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");
  const blobUrlRef = useRef("");

  useEffect(() => {
    if (!isOpen || !imageUrl) {
      setBlobUrl("");
      setIsLoading(false);
      setHasError(false);
      return;
    }

    const requiresAuthenticatedFetch = isProtectedImageUrl(imageUrl);
    if (!requiresAuthenticatedFetch) {
      setBlobUrl("");
      setIsLoading(false);
      setHasError(false);
      return;
    }

    const controller = new AbortController();
    setBlobUrl("");
    setIsLoading(true);
    setHasError(false);

    api
      .get(imageUrl, { responseType: "blob", signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(response.data);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setHasError(false);
        setIsLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setHasError(true);
        setIsLoading(false);
      });

    return () => {
      controller.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
      setBlobUrl("");
    };
  }, [isOpen, imageUrl]);

  if (!isOpen) return null;

  const src = isProtectedImageUrl(imageUrl) ? blobUrl : imageUrl;
  const showError = !imageUrl || (hasError && !isLoading);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-dark-border bg-dark-card p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary-green">
              Comprobante
            </p>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {showError ? (
          <div className="rounded-2xl border border-dashed border-dark-border px-4 py-8 text-center text-sm text-gray-400">
            No se pudo cargar el comprobante.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-dark-border bg-[#0e111a] px-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-green" />
          </div>
        ) : (
          <img
            src={src}
            alt="Comprobante de depósito"
            onError={() => setHasError(true)}
            className="max-h-[68vh] w-full rounded-2xl border border-dark-border object-contain"
          />
        )}
      </div>
    </div>
  );
};

// ─── Fila individual ──────────────────────────────────────────────────────────
const BankInboundRow = ({ record, onConfirm, onCancel, onViewImage }) => {
  const status = record.isConfirm?.toUpperCase();
  const isPending = status === "PENDIENTE";
  const imageUrl = buildImageUrl(record.imageUrl);
  const confirmationImageUrl = buildImageUrl(record.confirmationImageUrl);

  return (
    <article className="rounded-2xl border border-dark-border bg-[#0b0e17] p-4 transition hover:border-primary-green/30">
      {/* Cabecera de fila */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {/* Bloque izquierdo */}
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-white">
              {record.bankName ?? "Banco desconocido"}
            </h3>
            <StatusBadge status={record.isConfirm} />
            {record.transferType && (
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300">
                {record.transferType}
              </span>
            )}
          </div>
        </div>

        {/* Monto */}
        <div className="shrink-0 text-right">
          <p className="text-2xl font-bold text-primary-green">
            {formatCurrency(record.amount)}
          </p>
        </div>
      </div>

      {/* Grid de metadatos */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-300 sm:grid-cols-3 md:grid-cols-4">
        <div className="rounded-xl bg-[#111427] p-3">
          <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">
            Socio
          </p>
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-gray-500" />
            <span className="font-mono"># {record.socioId ?? "N/D"}</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#111427] p-3">
          <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">
            Creado por
          </p>
          <div className="flex items-center gap-1.5">
            <BadgeCheck className="h-3.5 w-3.5 text-gray-500" />
            <span className="truncate">{record.createdBy ?? "N/D"}</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#111427] p-3">
          <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">
            Fecha creación
          </p>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs">
              {record.createdAt
                ? `${formatDate(record.createdAt)} ${formatTime(record.createdAt)}`
                : "N/D"}
            </span>
          </div>
        </div>

        {record.updatedBy && (
          <div className="rounded-xl bg-[#111427] p-3">
            <p className="mb-0.5 text-[10px] uppercase tracking-wider text-gray-500">
              Actualizado por
            </p>
            <span className="truncate text-xs">{record.updatedBy}</span>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {/* Ver imagen */}
        {imageUrl && (
          <button
            type="button"
            id={`bi-view-image-${record.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary-green/40 px-3 py-1.5 text-xs font-semibold text-primary-green transition hover:border-primary-green hover:bg-primary-green/10"
            onClick={() =>
              onViewImage({
                imageUrl,
                title: `${record.bankName} — Socio #${record.socioId}`,
              })
            }
          >
            <Eye className="h-3.5 w-3.5" />
            Ver imagen
          </button>
        )}

        {confirmationImageUrl && (
          <button
            type="button"
            id={`bi-view-confirmation-image-${record.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-300 transition hover:border-sky-400 hover:bg-sky-500/10"
            onClick={() =>
              onViewImage({
                imageUrl: confirmationImageUrl,
                title: `Confirmación de ${record.bankName} — Socio #${record.socioId}`,
              })
            }
          >
            <Eye className="h-3.5 w-3.5" />
            Ver confirmación
          </button>
        )}

        {/* Cancelar */}
        <button
          type="button"
          id={`bi-cancel-${record.id}`}
          disabled={!isPending}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
            isPending
              ? "border-red-500/40 text-red-300 hover:border-red-500 hover:bg-red-500/10"
              : "cursor-not-allowed border-dark-border text-gray-600 opacity-50"
          }`}
          onClick={() => isPending && onCancel(record)}
        >
          <ShieldX className="h-3.5 w-3.5" />
          Cancelar
        </button>

        {/* Confirmar */}
        <button
          type="button"
          id={`bi-confirm-${record.id}`}
          disabled={!isPending}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
            isPending
              ? "border-primary-green/50 text-primary-green hover:border-primary-green hover:bg-primary-green/10"
              : "cursor-not-allowed border-dark-border text-gray-600 opacity-50"
          }`}
          onClick={() => isPending && onConfirm(record)}
        >
          <Banknote className="h-3.5 w-3.5" />
          Confirmar
        </button>
      </div>
    </article>
  );
};

// ─── Tabla principal ──────────────────────────────────────────────────────────
const BankInboundTable = ({
  records = [],
  isLoading = false,
  onConfirm,
  onCancel,
  emptyMessage = "No hay depósitos que coincidan con los filtros.",
}) => {
  const [preview, setPreview] = useState({
    isOpen: false,
    imageUrl: "",
    title: "",
  });

  const openPreview = ({ imageUrl, title }) =>
    setPreview({ isOpen: true, imageUrl, title });
  const closePreview = () =>
    setPreview({ isOpen: false, imageUrl: "", title: "" });

  return (
    <>
      <section className="card space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Depósitos interbancarios
            </h2>
            <p className="text-sm text-gray-500">
              Gestiona y confirma los depósitos recibidos desde bancos externos.
            </p>
          </div>

          {records.length > 0 && (
            <span className="rounded-full border border-dark-border bg-[#0d121c] px-3 py-1 text-xs text-gray-400">
              {records.length} registro{records.length !== 1 ? "s" : ""}
            </span>
          )}
        </header>

        {isLoading ? (
          <Skeleton rows={5} />
        ) : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dark-border bg-[#0e111a] p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-400">{emptyMessage}</p>
            <p className="mt-1 text-xs text-gray-600">
              Ajusta los filtros y vuelve a buscar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <BankInboundRow
                key={record.id}
                record={record}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onViewImage={openPreview}
              />
            ))}
          </div>
        )}
      </section>

      <ImagePreviewModal
        isOpen={preview.isOpen}
        imageUrl={preview.imageUrl}
        title={preview.title}
        onClose={closePreview}
      />
    </>
  );
};

export default BankInboundTable;
