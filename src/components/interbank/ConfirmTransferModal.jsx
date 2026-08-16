import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle,
  CircleDashed,
  Loader2,
  ShieldAlert,
  UploadCloud,
  XCircle,
} from "lucide-react";
import Dialog from "../common/Dialog";
import { useAuth } from "../../context/AuthContext";
import { useBankReservasAccounts } from "../../modules/accountBook/queries/useAccountBook";
import ocrService from "../../services/ocr.service";
import { formatCurrency } from "../../utils/transactions";

const OCR_MIN_CONFIDENCE = 70;

const amountsMatch = (ocrRaw, expected) => {
  const toCents = (value) => {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number") {
      return Number.isFinite(value) ? Math.round(value * 100) : null;
    }

    let normalized = String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(/[^\d,.-]/g, "");

    const lastDot = normalized.lastIndexOf(".");
    const lastComma = normalized.lastIndexOf(",");

    if (lastDot !== -1 && lastComma !== -1) {
      const decimalSeparator = lastDot > lastComma ? "." : ",";
      const thousandsSeparator = decimalSeparator === "." ? "," : ".";
      normalized = normalized.replaceAll(thousandsSeparator, "");
      if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
    } else if (lastComma !== -1) {
      normalized = /,\d{1,2}$/.test(normalized)
        ? normalized.replace(",", ".")
        : normalized.replaceAll(",", "");
    } else if (lastDot !== -1 && !/\.\d{1,2}$/.test(normalized)) {
      normalized = normalized.replaceAll(".", "");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
  };

  const ocrCents = toCents(ocrRaw);
  const expectedCents = toCents(expected);

  if (ocrCents === null || expectedCents === null) return null;
  return ocrCents === expectedCents;
};

// ── Componente de estado OCR ──────────────────────────────────────────────────
const OcrStatusRow = ({ label, status, detail }) => {
  const cfg = {
    ok: {
      icon: <CheckCircle className="h-4 w-4 text-emerald-400" />,
      cls: "text-emerald-300",
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-red-400" />,
      cls: "text-red-300",
    },
    warn: {
      icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,
      cls: "text-amber-300",
    },
    pending: {
      icon: <CircleDashed className="h-4 w-4 text-gray-500" />,
      cls: "text-gray-400",
    },
  }[status] ?? { icon: null, cls: "text-gray-400" };

  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{cfg.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-300">{label}</p>
        {detail && <p className={`truncate text-xs ${cfg.cls}`}>{detail}</p>}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const defaultState = {
  updatedBy: "",
  accountSend: "",
  file: null,
  previewUrl: "",
  localFileName: "",
};

const defaultOcr = {
  running: false,
  done: false,
  result: null,
  error: null,
};

const ConfirmTransferModal = ({
  transfer,
  isOpen,
  onClose,
  onSubmit,
  loading,
}) => {
  const [form, setForm] = useState(defaultState);
  const [ocr, setOcr] = useState(defaultOcr);
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });
  const { user } = useAuth();
  const accountsQuery = useBankReservasAccounts({ enabled: isOpen });
  const abortRef = useRef(false);

  const accountOptions = useMemo(() => {
    const accounts =
      accountsQuery.data?.data?.cuentas ?? accountsQuery.data?.cuentas ?? [];

    if (!Array.isArray(accounts)) return [];

    return accounts
      .filter((account) => account?.numeroCuenta)
      .map((account) => ({
        id: account.id,
        value: String(account.numeroCuenta),
        label: String(account.numeroCuenta),
        description:
          account.descripcionTipoCuenta?.trim() || "Cuenta bancaria",
      }));
  }, [accountsQuery.data]);

  const currentUserName = useMemo(() => {
    const first = user?.firstName?.trim() ?? "";
    const last = user?.lastName?.trim() ?? "";
    const composed = `${first} ${last}`.trim();
    return composed || user?.userName || "";
  }, [user]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      abortRef.current = false;
      setForm({
        updatedBy: currentUserName || transfer?.updatedBy || "",
        accountSend: "",
        file: null,
        previewUrl: "",
        localFileName: "",
      });
      setOcr(defaultOcr);
    } else {
      abortRef.current = true;
    }
  }, [isOpen, transfer, currentUserName]);

  // Revoke blob URL on change
  useEffect(() => {
    const url = form.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [form.previewUrl]);

  // Selecciona la cuenta detectada solo cuando pertenece al catálogo vigente.
  useEffect(() => {
    const detectedAccount = ocr.result?.targetAccountSend;
    if (
      !ocr.done ||
      !detectedAccount ||
      !accountOptions.some((account) => account.value === detectedAccount)
    ) {
      return;
    }

    setForm((prev) => ({ ...prev, accountSend: detectedAccount }));
  }, [accountOptions, ocr.done, ocr.result]);

  // ── File handling + automatic OCR ─────────────────────────────────────────
  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      file,
      previewUrl,
      localFileName: file.name,
    }));
    setOcr({ running: true, done: false, result: null, error: null });

    try {
      const result = await ocrService.processReceipt(
        file,
        [],
        [],
        accountOptions,
        transfer?.amount ?? transfer?.total ?? null,
      );

      if (abortRef.current) return; // modal was closed during OCR

      if (result?.error) {
        throw new Error(result.error);
      }

      setOcr({ running: false, done: true, result, error: null });
    } catch (err) {
      if (!abortRef.current) {
        setOcr({
          running: false,
          done: true,
          result: null,
          error: err.message,
        });
      }
    }
  };

  // ── OCR validation results ─────────────────────────────────────────────────
  const ocrValidation = useMemo(() => {
    if (!ocr.done || !ocr.result) return null;
    const r = ocr.result;
    const expectedAmount = transfer?.amount ?? transfer?.total ?? null;

    const amountOk =
      expectedAmount != null ? amountsMatch(r.amount, expectedAmount) : null;
    const detectedAccount = String(r.targetAccountSend ?? "");
    const accountOk = Boolean(
      detectedAccount &&
        form.accountSend &&
        detectedAccount === form.accountSend &&
        accountOptions.some((account) => account.value === detectedAccount),
    );

    return { accountOk, amountOk, detectedAccount, r, expectedAmount };
  }, [accountOptions, form.accountSend, ocr, transfer]);

  // ── OCR result is informational until recognition is reliable enough ─────
  const ocrHasWarning = useMemo(() => {
    if (!ocrValidation) return false;
    return (
      ocrValidation.amountOk !== true ||
      ocrValidation.accountOk !== true ||
      ocrValidation.r.confidence < OCR_MIN_CONFIDENCE ||
      !ocrValidation.r.isValid
    );
  }, [ocrValidation]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const hasValidAccount = accountOptions.some(
      (account) => account.value === form.accountSend,
    );

    if (!form.updatedBy || !hasValidAccount || !form.file) {
      setDialog({
        isOpen: true,
        type: "error",
        title: "No se puede confirmar",
        message:
          "Debes seleccionar la cuenta de origen y subir la imagen de evidencia.",
      });
      return;
    }

    if (ocr.running) {
      setDialog({
        isOpen: true,
        type: "info",
        title: "OCR en proceso",
        message: "Espera a que termine la verificación del comprobante.",
      });
      return;
    }

    onSubmit({
      id: transfer?.id,
      updatedBy: form.updatedBy,
      accountSend: form.accountSend,
      file: form.file,
    });
  };

  if (!isOpen || !transfer) return null;

  const expectedAmountFmt = transfer?.amount
    ? formatCurrency(transfer.amount)
    : transfer?.total
      ? formatCurrency(transfer.total)
      : null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div
          className="w-full max-w-xl overflow-y-auto rounded-3xl border border-dark-border bg-dark-card p-6 shadow-card"
          style={{ maxHeight: "90vh" }}
        >
          {/* ── Header ─────────────────────────────────────────────────── */}
          <header className="mb-5">
            <p className="text-xs uppercase tracking-[0.3em] text-primary-green">
              Confirmar
            </p>
            <h3 className="text-2xl font-semibold text-white">
              Transferencia #{transfer.id}
            </h3>
            <p className="text-sm text-gray-500">
              Selecciona la cuenta de origen, sube la evidencia y verifica con
              el OCR.
            </p>
          </header>

          <div className="space-y-5">
            {/* ── Actualizado por ────────────────────────────────────── */}
            <div className="rounded-2xl border border-dark-border bg-[#111427] px-4 py-3 text-sm text-gray-300">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                Actualizado por
              </p>
              <p className="mt-1 text-white">
                {form.updatedBy || "Sin usuario"}
              </p>
            </div>

            {/* ── Monto esperado ─────────────────────────────────────── */}
            {expectedAmountFmt && (
              <div className="rounded-2xl border border-primary-green/20 bg-primary-green/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-primary-green">
                  Monto de la transferencia
                </p>
                <p className="mt-1 text-xl font-bold text-white">
                  {expectedAmountFmt}
                </p>
                {transfer.bankAccountName && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    Banco:{" "}
                    <span className="text-gray-200">
                      {transfer.bankAccountName}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* ── Cuenta de origen ───────────────────────────────────── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Cuenta de origen (AccountSend)
              </p>
              {accountsQuery.isFetching && (
                <div className="flex items-center gap-3 rounded-2xl border border-dark-border bg-[#111427] px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-green" />
                  <p className="text-xs text-gray-400">
                    {accountOptions.length > 0
                      ? "Actualizando cuentas bancarias…"
                      : "Cargando cuentas bancarias…"}
                  </p>
                </div>
              )}

              {accountsQuery.isError && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                    <p className="text-xs text-red-300">
                      No se pudieron cargar las cuentas bancarias.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => accountsQuery.refetch()}
                    className="shrink-0 text-xs font-semibold text-primary-green hover:text-white"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {!accountsQuery.isFetching &&
                !accountsQuery.isError &&
                accountOptions.length === 0 && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                    <p className="text-xs text-amber-300">
                      No hay cuentas bancarias disponibles para confirmar esta
                      transferencia.
                    </p>
                  </div>
                )}

              {!accountsQuery.isFetching && accountOptions.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {accountOptions.map((opt) => {
                    const isSelected = form.accountSend === opt.value;
                    const isAutoDetected =
                      ocr.done && ocr.result?.targetAccountSend === opt.value;
                    return (
                      <button
                        key={opt.id ?? opt.value}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            accountSend: opt.value,
                          }))
                        }
                        className={`relative flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                          isSelected
                            ? "border-primary-green bg-primary-green/10 text-primary-green"
                            : "border-dark-border bg-[#111427] text-gray-400 hover:border-primary-green/60 hover:text-gray-200"
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-primary-green bg-primary-green"
                              : "border-gray-600 bg-transparent"
                          }`}
                        >
                          {isSelected && (
                            <CheckCircle className="h-3 w-3 text-black" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{opt.label}</span>
                          <span className="block truncate text-[11px] font-normal text-gray-500">
                            {opt.description}
                          </span>
                        </span>
                        {isAutoDetected && (
                          <span className="absolute right-2 top-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                            OCR
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {!accountsQuery.isFetching &&
                !accountsQuery.isError &&
                accountOptions.length > 0 &&
                !form.accountSend && (
                  <p className="mt-1.5 text-xs text-amber-400/80">
                    Debes seleccionar una cuenta antes de confirmar.
                  </p>
                )}
            </div>

            {/* ── Evidencia ──────────────────────────────────────────── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Evidencia (imagen)
              </p>
              <label
                className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-dark-border bg-[#111427] p-4 text-center text-sm text-gray-500 ${
                  accountsQuery.isFetching ||
                  accountsQuery.isError ||
                  accountOptions.length === 0 ||
                  ocr.running
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:border-primary-green"
                }`}
              >
                <UploadCloud className="mb-2 h-6 w-6 text-primary-green" />
                <span>
                  {ocr.running
                    ? "Analizando imagen…"
                    : form.localFileName || "Seleccionar imagen"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={
                    accountsQuery.isFetching ||
                    accountsQuery.isError ||
                    accountOptions.length === 0 ||
                    ocr.running
                  }
                />
              </label>

              {form.previewUrl && (
                <img
                  src={form.previewUrl}
                  alt="Comprobante"
                  className="max-h-48 w-full rounded-2xl border border-dark-border object-contain"
                />
              )}

              {/* ── Resultado informativo del comprobante ───────── */}
              {ocr.running && (
                <div className="flex items-center gap-3 rounded-2xl border border-dark-border bg-[#111427] px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-green" />
                  <p className="text-xs text-gray-400">
                    Analizando comprobante con OCR…
                  </p>
                </div>
              )}

              {ocr.error && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-xs text-amber-300">
                    El OCR no pudo leer la imagen: {ocr.error}. Revisa el
                    comprobante manualmente antes de confirmar.
                  </p>
                </div>
              )}

              {ocrValidation && (
                <div
                  className={`rounded-2xl border px-4 py-4 ${
                    ocrHasWarning
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-emerald-500/20 bg-emerald-500/5"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-300">
                      Resultado OCR
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        ocrValidation.r.confidence >= OCR_MIN_CONFIDENCE
                          ? "bg-emerald-500/15 text-emerald-300"
                          : ocrValidation.r.confidence >= 40
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      Confianza {ocrValidation.r.confidence}%
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {/* Monto */}
                    <OcrStatusRow
                      label="Monto detectado en imagen"
                      status={
                        ocrValidation.amountOk === true
                          ? "ok"
                          : ocrValidation.amountOk === false
                            ? "error"
                            : "warn"
                      }
                      detail={
                        ocrValidation.r.amount
                          ? `RD$ ${ocrValidation.r.amount}${
                              ocrValidation.amountOk === false
                                ? ` ≠ ${expectedAmountFmt}`
                                : ocrValidation.amountOk === true
                                  ? " ✓ coincide exactamente"
                                  : " (sin referencia para comparar)"
                            }`
                          : ocrValidation.r.requiresManualReview
                            ? "Monto no confiable; requiere revisión manual"
                            : "No se detectó monto"
                      }
                    />

                    {/* Cuenta de origen */}
                    <OcrStatusRow
                      label="Cuenta de origen detectada"
                      status={ocrValidation.accountOk ? "ok" : "error"}
                      detail={
                        ocrValidation.detectedAccount
                          ? `${ocrValidation.detectedAccount}${
                              ocrValidation.accountOk
                                ? " ✓ coincide"
                                : ` ≠ ${form.accountSend || "sin selección"}`
                            }`
                          : "No se detectó una cuenta válida del catálogo"
                      }
                    />
                  </div>

                  {ocrHasWarning && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <p className="text-xs text-amber-300">
                        El OCR no pudo validar todos los datos. Revisa
                        manualmente la imagen antes de confirmar.
                      </p>
                    </div>
                  )}

                  {!ocrHasWarning && ocrValidation.r.isValid && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <p className="text-xs text-emerald-300">
                        Cuenta y monto exacto verificados. Puedes confirmar la
                        interbancaria.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Acciones ───────────────────────────────────────────────── */}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading || ocr.running}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSubmit}
              disabled={
                loading ||
                accountsQuery.isFetching ||
                accountsQuery.isError ||
                accountOptions.length === 0 ||
                !form.accountSend ||
                !form.file ||
                ocr.running
              }
            >
              {loading
                ? "Confirmando..."
                : ocr.running
                  ? "Analizando..."
                  : "Confirmar"}
            </button>
          </div>
        </div>
      </div>

      <Dialog
        isOpen={dialog.isOpen}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        confirmText="Entendido"
        onConfirm={() => setDialog({ isOpen: false })}
      />
    </>
  );
};

export default ConfirmTransferModal;
