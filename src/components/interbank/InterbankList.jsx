import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Loader2,
  ShieldX,
} from "lucide-react";
import Skeleton from "../common/Skeleton";
import {
  formatCurrency,
  formatDate,
  formatTime,
} from "../../utils/transactions";
import { getApiBaseUrl } from "../../utils/api";
import api from "../../lib/axiosInstance";

const INVOICE_IMAGE_ENDPOINT = `${getApiBaseUrl()}/InterBank/image-socio?imageUrl=`;

const InvoicePreviewModal = ({
  isOpen,
  imageUrl,
  title,
  subtitle,
  onClose,
}) => {
  const [imgError, setImgError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");
  const blobUrlRef = useRef("");

  useEffect(() => {
    if (!isOpen || !imageUrl) {
      setImgError(false);
      setLoading(false);
      return;
    }

    if (imageUrl.startsWith("data:image/")) {
      setBlobUrl("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setImgError(false);

    const controller = new AbortController();

    api
      .get(imageUrl, { responseType: "blob", signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(res.data);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setImgError(true);
        setLoading(false);
      });

    return () => {
      controller.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = "";
      }
    };
  }, [isOpen, imageUrl]);

  if (!isOpen) return null;

  const src = imageUrl?.startsWith("data:image/") ? imageUrl : blobUrl;
  const showError = !imageUrl || (imgError && !loading);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-3xl rounded-3xl border border-dark-border bg-dark-card p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary-green">
              Factura
            </p>
            <h3 className="text-xl font-semibold text-white">
              {title || "Comprobante"}
            </h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {showError ? (
          <div className="rounded-2xl border border-dashed border-dark-border px-4 py-6 text-center text-sm text-gray-400">
            No pudimos cargar la factura.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-dark-border bg-[#0e111a] px-4 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-green" />
          </div>
        ) : (
          <img
            src={src}
            alt="Factura del socio"
            onError={() => setImgError(true)}
            className="max-h-[70vh] w-full rounded-2xl border border-dark-border object-contain"
          />
        )}
      </div>
    </div>
  );
};

const StatusChip = ({ label, color }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}
  >
    {label}
  </span>
);

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-dark-border bg-[#0e111a] p-8 text-center">
    <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-gray-600" />
    <p className="text-sm text-gray-400">
      No encontramos transferencias con esos filtros.
    </p>
    <p className="text-xs text-gray-500">
      Ajusta los parámetros y vuelve a intentarlo.
    </p>
  </div>
);

const InterbankRow = ({
  transfer,
  onConfirm,
  onCancel,
  showActions = true,
  onViewInvoice = () => {},
}) => {
  const disabledConfirm = transfer.isSubmit || transfer.isCancelled;
  const disabledCancel = transfer.isCancelled || transfer.isSubmit;
  let invoiceUrl = "";

  const imgExtRe = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
  const base64Re = /^[A-Za-z0-9+/=]+$/;

  const rawImage =
    transfer?.imageUrl?.trim() ||
    transfer?.receiptImage?.trim() ||
    Object.values(transfer?.raw || {}).find((v) => {
      if (typeof v !== "string") return false;
      const s = v.trim();
      if (!s) return false;
      if (s.startsWith("data:image/")) return true;
      if (imgExtRe.test(s)) return true;
      if (s.length > 100 && base64Re.test(s)) return true;
      return false;
    });

  if (rawImage) {
    if (rawImage.startsWith("data:image/")) {
      invoiceUrl = rawImage;
    } else if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
      invoiceUrl = rawImage;
    } else if (imgExtRe.test(rawImage)) {
      invoiceUrl = `${INVOICE_IMAGE_ENDPOINT}${encodeURIComponent(rawImage)}`;
    } else {
      invoiceUrl = `data:image/png;base64,${rawImage}`;
    }
  }
  return (
    <article className="rounded-2xl border border-dark-border bg-[#0b0e17] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-white">
            <h3 className="text-lg font-semibold">{transfer.name}</h3>
            {transfer.bankAccountName && (
              <span className="text-sm text-gray-400">
                ({transfer.bankAccountName})
              </span>
            )}
            {transfer.isPriority && (
              <StatusChip
                label="Prioridad"
                color="bg-purple-500/10 text-purple-300"
              />
            )}
            {transfer.isSubmit && (
              <StatusChip
                label="Aprobada"
                color="bg-green-500/10 text-green-300"
              />
            )}
            {transfer.isCancelled && (
              <StatusChip
                label="Cancelada"
                color="bg-red-500/10 text-red-300"
              />
            )}
            {transfer.isPending && (
              <StatusChip
                label="Pendiente"
                color="bg-amber-500/10 text-amber-300"
              />
            )}
          </div>
          <p className="text-sm text-gray-400">{transfer.description}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-primary-green">
            {formatCurrency(transfer.amount)}
          </p>
          <p className="text-xs text-gray-500">
            Total:{" "}
            <span className="text-white/80">
              {formatCurrency(transfer.total)}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-gray-300 md:grid-cols-3">
        <div className="rounded-xl bg-[#111427] p-3">
          <p className="text-xs text-gray-500">Identificación</p>
          <p className="font-mono">{transfer.identification || "N/D"}</p>
        </div>
        <div className="rounded-xl bg-[#111427] p-3">
          <p className="text-xs text-gray-500">Cuenta bancaria</p>
          <p className="font-mono">{transfer.bankAccount || "N/D"}</p>
        </div>
        <div className="rounded-xl bg-[#111427] p-3">
          <p className="text-xs text-gray-500">Tipo de cuenta</p>
          <p className="font-mono">{transfer.accountType || "N/D"}</p>
        </div>
        <div className="rounded-xl bg-[#111427] p-3">
          <p className="text-xs text-gray-500">Beneficiario</p>
          <p className="font-mono">{transfer.nameAccountBank || "N/D"}</p>
        </div>
        <div className="rounded-xl bg-[#111427] p-3">
          <p className="text-xs text-gray-500">Creado</p>
          <p>
            {transfer.createdAt
              ? `${formatDate(transfer.createdAt)} - ${formatTime(
                  transfer.createdAt
                )}`
              : "N/D"}
          </p>
        </div>
        <div className="rounded-xl bg-[#111427] p-3">
          <p className="text-xs text-gray-500">Estado</p>
          <p>
            {transfer.updatedAt
              ? `${formatDate(transfer.updatedAt)} - ${formatTime(
                  transfer.updatedAt
                )}`
              : "Pendiente"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2 text-xs text-gray-500">
          <BadgeCheck className="h-4 w-4" />
          <span>Socio #{transfer.socioId || "N/D"}</span>
          <ArrowRight className="h-4 w-4" />
          <span>{transfer.bankAccountName}</span>
          <ArrowRight className="h-4 w-4" />
          <span>{transfer.coopAdminAccount || "Admin"}</span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {invoiceUrl && (
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-primary-green/60 px-3 py-2 text-xs font-semibold text-primary-green transition hover:border-primary-green hover:text-white"
              onClick={() =>
                onViewInvoice({
                  imageUrl: invoiceUrl,
                  title: transfer.name || "Factura",
                  subtitle:
                    transfer.bankAccountName ||
                    transfer.identification ||
                    transfer.socioId ||
                    "",
                })
              }
            >
              Ver factura
            </button>
          )}

          {showActions && (
            <div className="flex gap-2">
              <button
                type="button"
                className={`btn-secondary flex items-center gap-2 text-xs ${
                  disabledCancel ? "opacity-60 cursor-not-allowed" : ""
                }`}
                onClick={() => onCancel(transfer)}
                disabled={disabledCancel}
              >
                <ShieldX className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                className={`btn-primary flex items-center gap-2 text-xs ${
                  disabledConfirm ? "opacity-60 cursor-not-allowed" : ""
                }`}
                onClick={() => onConfirm(transfer)}
                disabled={disabledConfirm}
              >
                <Banknote className="h-4 w-4" />
                Confirmar
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

const InterbankList = ({
  title = "Transferencias interbancarias",
  description = "Monitorea el estado y confirma en segundos.",
  transfers,
  isLoading,
  onConfirm,
  onCancel,
  emptyMessage = "No encontramos transferencias con esos filtros.",
  showActions = true,
}) => {
  const [invoicePreview, setInvoicePreview] = useState({
    isOpen: false,
    imageUrl: "",
    title: "",
    subtitle: "",
  });

  const openInvoiceModal = ({ imageUrl, title, subtitle }) => {
    setInvoicePreview({
      isOpen: true,
      imageUrl,
      title,
      subtitle,
    });
  };

  const closeInvoiceModal = () =>
    setInvoicePreview((prev) => ({ ...prev, isOpen: false }));

  return (
    <>
      <section className="card space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </header>

        {isLoading ? (
          <Skeleton rows={5} />
        ) : transfers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dark-border bg-[#0e111a] p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-400">{emptyMessage}</p>
            <p className="text-xs text-gray-500">
              Ajusta los parámetros y vuelve a intentarlo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...transfers]
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Descendente: más reciente primero
  .map((transfer) => (
    <InterbankRow
      key={transfer.id}
      transfer={transfer}
      onConfirm={onConfirm}
      onCancel={onCancel}
      showActions={showActions}
      onViewInvoice={openInvoiceModal}
    />
))}

          </div>
        )}
      </section>

      <InvoicePreviewModal
        isOpen={invoicePreview.isOpen}
        imageUrl={invoicePreview.imageUrl}
        title={invoicePreview.title}
        subtitle={invoicePreview.subtitle}
        onClose={closeInvoiceModal}
      />
    </>
  );
};

export default InterbankList;
