import {
  useAccountBookSumatoria,
  useBankReservasAccounts,
  useAdminInterExternaAccounts,
  useCreateCorporateAccount,
  useCreateInternalAccountTransfer,
} from "../modules/accountBook/queries/useAccountBook";
import Skeleton from "../components/common/Skeleton";
import ErrorBanner from "../components/common/ErrorBanner";
import Dialog from "../components/common/Dialog";
import { formatCurrency } from "../utils/transactions";
import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  Layers,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  BarChart3,
  Plus,
  X,
  LoaderCircle,
  ArrowLeftRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  normalizeInternalTransfer,
  resolveEmployeeId,
  validateInternalTransfer,
} from "../modules/accountBook/internalTransfers";

const DEFAULT_ACCOUNT_DIALOG = {
  isOpen: false,
  type: "success",
  title: "",
  message: "",
};

const AccountBookPage = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activeHistoryTab, setActiveHistoryTab] = useState("all");
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isInternalTransferOpen, setIsInternalTransferOpen] = useState(false);
  const [accountDialog, setAccountDialog] = useState(DEFAULT_ACCOUNT_DIALOG);
  const [internalTransfers, setInternalTransfers] = useState([]);

  const {
    data: response,
    isLoading: isLoadingSum,
    isError: isErrorSum,
    error: errorSum,
  } = useAccountBookSumatoria(selectedDate);
  const { data: accountsResponse, isLoading: isLoadingAcc } =
    useBankReservasAccounts();
  const { data: adminAccountsResponse, isLoading: isLoadingAdmin } = 
    useAdminInterExternaAccounts();
  const createAccount = useCreateCorporateAccount();
  const createInternalTransfer = useCreateInternalAccountTransfer();
  const { user } = useAuth();

  const data = response?.data;
  const bankAccounts = accountsResponse?.data?.cuentas || [];
  const adminAccounts = adminAccountsResponse?.data || [];
  
  // Only bank accounts count for total capital
  const totalBalance = accountsResponse?.data?.totalCapitalActual || 0;

  const stats = useMemo(() => {
    if (!data) return null;

    // Grouping by Bank Entity (External)
    const banksMap = {};

    data.transactionDtos?.forEach((tx) => {
      const bankName = tx.bankAccountName || "Banco Externo";
      if (!banksMap[bankName])
        banksMap[bankName] = { name: bankName, in: 0, out: 0, count: 0 };
      banksMap[bankName].out += tx.total || tx.amount;
      banksMap[bankName].count += 1;
    });

    data.inbounds?.forEach((tx) => {
      const bankName = tx.bankName || "Banco Externo";
      if (!banksMap[bankName])
        banksMap[bankName] = { name: bankName, in: 0, out: 0, count: 0 };
      banksMap[bankName].in += tx.amount;
      banksMap[bankName].count += 1;
    });

    const banksList = Object.values(banksMap).sort(
      (a, b) => b.in + b.out - (a.in + a.out),
    );

    // Combined History
    const allHistory = [
      ...(data.inbounds || []).map((tx) => ({
        id: tx.id,
        type: "in",
        amount: tx.amount,
        name: tx.createdBy || "Sistema",
        description: tx.description,
        date: tx.createdAt,
        bank: tx.bankName?.split(' - ').pop() || "Inbound",
      })),
      ...(data.transactionDtos || []).map((tx) => ({
        id: tx.id,
        type: "out",
        amount: tx.total || tx.amount,
        name: tx.name,
        description: tx.description || "Transferencia Interbancaria",
        date: tx.createdAt,
        bank: tx.noAccountBank?.split(' - ').pop() || "Interbank",
      })),
      ...internalTransfers
        .filter(
          (tx) =>
            new Date(tx.date).toISOString().slice(0, 10) === selectedDate,
        )
        .map((tx) => ({
          id: tx.id,
          type: "internal",
          amount: tx.amount,
          name: `${tx.accountOrigin} → ${tx.accountDestination}`,
          description: tx.notes
            ? `Reciente (sesión actual): ${tx.notes}`
            : "Transferencia interna reciente (sesión actual)",
          date: tx.date,
          bank: "Cuentas internas",
        })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      inboundsCount: data.inbounds?.length || 0,
      outboundsCount: data.transactionDtos?.length || 0,
      sumatoriaInter: data.sumatoriaInter || 0,
      sumatoriaInbounds: data.sumatoriaInbounds || 0,
      banksList,
      allHistory,
    };
  }, [data, internalTransfers, selectedDate]);

  const filteredHistory = useMemo(() => {
    if (!stats?.allHistory) return [];
    if (activeHistoryTab === "all") return stats.allHistory;
    return stats.allHistory.filter((tx) => {
      if (activeHistoryTab === "internal") return tx.type === "internal";
      return tx.type === (activeHistoryTab === "in" ? "in" : "out");
    });
  }, [stats?.allHistory, activeHistoryTab]);

  const handleCreateAccount = async (payload) => {
    await createAccount.mutateAsync(payload);
    setIsAddAccountOpen(false);
    setAccountDialog({
      isOpen: true,
      type: "success",
      title: "Cuenta agregada",
      message: `La cuenta ${payload.numeroCuenta} ya está disponible en el libro de cuentas.`,
    });
  };

  const handleCreateInternalTransfer = async (payload) => {
    const result = await createInternalTransfer.mutateAsync(payload);
    const transfer = normalizeInternalTransfer(result?.data ?? result, payload);

    setInternalTransfers((current) => [transfer, ...current]);

    setIsInternalTransferOpen(false);
    setAccountDialog({
      isOpen: true,
      type: "success",
      title: "Transferencia interna completada",
      message: `Se transfirieron ${formatCurrency(payload.monto)} de ${payload.numeroCuentaOrigen} a ${payload.numeroCuentaDestino}.`,
    });
  };

  if (isLoadingSum || isLoadingAcc || isLoadingAdmin) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-dark-card border border-dark-border rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-32 bg-dark-card border border-dark-border rounded-2xl"></div>
          <div className="h-32 bg-dark-card border border-dark-border rounded-2xl"></div>
          <div className="h-32 bg-dark-card border border-dark-border rounded-2xl"></div>
          <div className="h-32 bg-dark-card border border-dark-border rounded-2xl"></div>
        </div>
        <div className="h-[400px] bg-dark-card border border-dark-border rounded-3xl"></div>
      </div>
    );
  }

  if (isErrorSum) {
    return <ErrorBanner error={errorSum} />;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header & Date Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-primary-green/10 rounded-xl border border-primary-green/20">
              <Layers className="h-6 w-6 text-primary-green" />
            </div>
            Libro de Cuentas
          </h2>
          <p className="text-gray-400 text-sm ml-12">
            Resumen corporativo y conciliación bancaria.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-dark-card border border-dark-border p-2 rounded-2xl">
          <Calendar className="h-4 w-4 text-primary-green ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none text-white text-sm focus:ring-0 outline-none pr-4 cursor-pointer"
          />
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Capital Total Actual"
          value={formatCurrency(totalBalance)}
          icon={<Wallet className="h-5 w-5 text-primary-green" />}
          trend="Cuentas Corporativas"
          positive={totalBalance >= 0}
        />
        <SummaryCard
          title="Entradas de Hoy"
          value={formatCurrency(stats.sumatoriaInbounds)}
          icon={<ArrowUpRight className="h-5 w-5 text-primary-green" />}
          trend={`${stats.inboundsCount} transacciones`}
        />
        <SummaryCard
          title="Salidas de Hoy"
          value={formatCurrency(stats.sumatoriaInter)}
          icon={<ArrowDownRight className="h-5 w-5 text-primary-red" />}
          trend={`${stats.outboundsCount} transacciones`}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
        {/* Left Side: Accounts */}
        <div className="space-y-8">
          {/* Real Bank Accounts */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-card group min-h-[400px]">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-4">
                <div className="p-2 bg-primary-green/10 rounded-xl border border-primary-green/20">
                  <FileText className="h-5 w-5 text-primary-green" />
                </div>
                Cuentas Corporativas
              </h3>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(true)}
                  className="group/add flex h-10 w-10 items-center justify-center rounded-xl border border-primary-green/30 bg-primary-green/10 text-primary-green transition-all hover:bg-primary-green hover:text-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-green/60 focus:ring-offset-2 focus:ring-offset-dark-card active:scale-95"
                  aria-label="Agregar cuenta corporativa"
                  title="Agregar cuenta corporativa"
                >
                  <Plus className="h-5 w-5 transition-transform group-hover/add:rotate-90" />
                </button>
                <div className="flex min-w-0 flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => setIsInternalTransferOpen(true)}
                    disabled={bankAccounts.length < 2}
                    aria-describedby="internal-transfer-help"
                    className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-primary-green/30 bg-primary-green/10 px-3 py-2 text-xs font-bold text-primary-green transition-all hover:bg-primary-green hover:text-dark-bg focus:outline-none focus:ring-2 focus:ring-primary-green/60 focus:ring-offset-2 focus:ring-offset-dark-card disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Transferencia interna
                  </button>
                  {bankAccounts.length < 2 && (
                    <span
                      id="internal-transfer-help"
                      className="max-w-56 text-right text-[10px] text-gray-500"
                    >
                      Necesitas al menos dos cuentas corporativas.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bankAccounts.length > 0 ? (
                bankAccounts.map((acc, idx) => (
                  <AccountRow
                    key={idx}
                    name={acc.numeroCuenta}
                    type={acc.descripcionTipoCuenta}
                    balance={formatCurrency(acc.capitalActual)}
                    status="Online"
                    positive={acc.capitalActual >= 0}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-20 opacity-50">
                  <p className="text-gray-500 text-sm italic">
                    No hay cuentas comerciales disponibles por el momento.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Admin/Control Accounts */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-card group hover:border-amber-500/20 transition-all">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-4">
                <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20">
                  <Layers className="h-5 w-5 text-amber-500" />
                </div>
                Cuentas de Puente
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {adminAccounts.length > 0 ? (
                adminAccounts.map((acc, idx) => (
                  <AccountRow
                    key={idx}
                    name={acc.numeroCuenta}
                    type={acc.descripcionTipoCuenta}
                    balance={formatCurrency(acc.capitalActual)}
                    status="Control"
                    positive={acc.capitalActual >= 0}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-20 opacity-50">
                  <p className="text-gray-500 text-sm italic">
                    No hay cuentas de puente configuradas.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Flow & Cutoff */}
        <div className="space-y-8">
          {/* Banks Summary */}
          <div className="bg-dark-card border border-dark-border rounded-3xl p-8 shadow-card hover:border-purple-500/20 transition-all min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-4">
                <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
                Flujo por Entidad
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stats.banksList.length > 0 ? (
                stats.banksList
                  .slice(0, 8)
                  .map((bank, idx) => (
                    <BankSummaryItem
                      key={idx}
                      name={bank.name}
                      inflow={bank.in}
                      outflow={bank.out}
                      count={bank.count}
                    />
                  ))
              ) : (
                <div className="col-span-full text-center py-20 opacity-50">
                  <div className="flex flex-col items-center gap-4">
                    <BarChart3 className="h-12 w-12 text-dark-border" />
                    <p className="text-gray-500 text-sm">Sin actividad hoy.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Row 2: Transaction History */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <h3 className="text-lg font-semibold text-white flex items-center gap-3">
            <div className="p-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <FileText className="h-4 w-4 text-amber-400" />
            </div>
            Historial de Entradas y Salidas
          </h3>

          <div className="flex items-center bg-dark-bg p-1 rounded-xl border border-dark-border">
              {[
                { id: "all", label: "Todo" },
                { id: "in", label: "Entradas" },
                { id: "out", label: "Salidas" },
                { id: "internal", label: "Internas" },
              ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveHistoryTab(tab.id)}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeHistoryTab === tab.id
                    ? "bg-primary-green text-black"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Fecha / Hora</th>
                <th className="px-4 py-2">Beneficiario / Origen</th>
                <th className="px-4 py-2">Banco</th>
                <th className="px-4 py-2">Concepto</th>
                <th className="px-4 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((tx, idx) => (
                  <tr
                    key={idx}
                    className="bg-dark-bg/50 hover:bg-dark-border/30 transition-colors group"
                  >
                    <td className="px-4 py-3 first:rounded-l-2xl">
                      <div
                        className={`flex items-center gap-2 text-xs font-bold ${tx.type === "in" ? "text-primary-green" : tx.type === "internal" ? "text-amber-400" : "text-primary-red"}`}
                      >
                        {tx.type === "in" ? (
                          <ArrowUpRight size={14} />
                        ) : tx.type === "internal" ? (
                          <ArrowLeftRight size={14} />
                        ) : (
                          <ArrowDownRight size={14} />
                        )}
                        {tx.type === "in"
                          ? "ENTRADA"
                          : tx.type === "internal"
                            ? "TRANSFERENCIA INTERNA"
                            : "SALIDA"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white text-xs font-medium">
                        {new Date(tx.date).toLocaleDateString("es-DO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(tx.date).toLocaleTimeString("es-DO", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white text-xs font-bold">
                        {tx.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] bg-dark-card border border-dark-border px-2 py-1 rounded text-gray-400 capitalize">
                        {tx.bank}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">
                      <div className="text-gray-400 text-xs italic">
                        "{tx.description}"
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right last:rounded-r-2xl">
                      <div
                        className={`text-sm font-black ${tx.type === "in" ? "text-primary-green" : tx.type === "internal" ? "text-amber-300" : "text-primary-red"}`}
                      >
                        {formatCurrency(tx.amount)}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="text-center py-20 text-gray-500 text-sm"
                  >
                    No hay movimientos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddAccountOpen && (
        <AddCorporateAccountModal
          loading={createAccount.isPending}
          onClose={() => setIsAddAccountOpen(false)}
          onSubmit={handleCreateAccount}
        />
      )}

      {isInternalTransferOpen && (
        <InternalTransferModal
          accounts={bankAccounts}
          employeeId={resolveEmployeeId(user)}
          loading={createInternalTransfer.isPending}
          onClose={() => setIsInternalTransferOpen(false)}
          onSubmit={handleCreateInternalTransfer}
        />
      )}

      <Dialog
        isOpen={accountDialog.isOpen}
        type={accountDialog.type}
        title={accountDialog.title}
        message={accountDialog.message}
        onConfirm={() => setAccountDialog(DEFAULT_ACCOUNT_DIALOG)}
      />
    </div>
  );
};

const InternalTransferModal = ({
  accounts,
  employeeId,
  loading,
  onClose,
  onSubmit,
}) => {
  const isSubmittingRef = useRef(false);
  const [form, setForm] = useState({
    numeroCuentaOrigen: "",
    numeroCuentaDestino: "",
    monto: "",
    observaciones: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onClose]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || isSubmittingRef.current) return;

    const normalizedOrigin = form.numeroCuentaOrigen.trim();
    const normalizedDestination = form.numeroCuentaDestino.trim();

    const validationError = validateInternalTransfer(
      {
        numeroCuentaOrigen: normalizedOrigin,
        numeroCuentaDestino: normalizedDestination,
        monto: form.monto,
      },
      employeeId,
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    isSubmittingRef.current = true;
    try {
      await onSubmit({
        numeroCuentaOrigen: normalizedOrigin,
        numeroCuentaDestino: normalizedDestination,
        monto: Number(form.monto),
        observaciones: form.observaciones.trim(),
      });
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message ??
          submitError?.message ??
          "No se pudo completar la transferencia. Revisa los datos e intenta de nuevo.",
      );
    } finally {
      isSubmittingRef.current = false;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="internal-transfer-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-dark-border bg-dark-card shadow-card animate-slide-up"
      >
        <div className="h-1 bg-gradient-to-r from-primary-green via-emerald-300 to-primary-green/20" />
        <div className="p-6 sm:p-8">
          <header className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-primary-green">
                Movimiento interno
              </p>
              <h3 id="internal-transfer-title" className="text-2xl font-bold text-white">
                Transferencia entre cuentas
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Mueve fondos entre dos cuentas corporativas sin salir del libro de cuentas.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dark-border text-gray-500 transition-colors hover:border-gray-600 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-green/60 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Cerrar transferencia interna"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="numeroCuentaOrigen" className="block px-1 text-xs font-semibold text-gray-300">
                  Cuenta de origen
                </label>
                <select
                  id="numeroCuentaOrigen"
                  name="numeroCuentaOrigen"
                  value={form.numeroCuentaOrigen}
                  onChange={updateField}
                  className="input-field w-full"
                  disabled={loading}
                >
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.numeroCuenta} value={account.numeroCuenta}>
                      {account.numeroCuenta}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="numeroCuentaDestino" className="block px-1 text-xs font-semibold text-gray-300">
                  Cuenta de destino
                </label>
                <select
                  id="numeroCuentaDestino"
                  name="numeroCuentaDestino"
                  value={form.numeroCuentaDestino}
                  onChange={updateField}
                  className="input-field w-full"
                  disabled={loading}
                >
                  <option value="">Selecciona una cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.numeroCuenta} value={account.numeroCuenta}>
                      {account.numeroCuenta}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="monto" className="block px-1 text-xs font-semibold text-gray-300">
                Monto
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-gray-500">
                  RD$
                </span>
                <input
                  id="monto"
                  name="monto"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.monto}
                  onChange={updateField}
                  placeholder="0.00"
                  className="input-field w-full pl-12 text-right font-semibold tabular-nums"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="observaciones" className="block px-1 text-xs font-semibold text-gray-300">
                Observaciones <span className="font-normal text-gray-500">(opcional)</span>
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                value={form.observaciones}
                onChange={updateField}
                rows="3"
                placeholder="Describe el motivo del movimiento"
                className="input-field w-full resize-none"
                disabled={loading}
              />
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-primary-red/20 bg-primary-red/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary sm:min-w-28" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary sm:min-w-48" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Procesando...
                  </span>
                ) : (
                  "Transferir fondos"
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
};

const AddCorporateAccountModal = ({ loading, onClose, onSubmit }) => {
  const [form, setForm] = useState({
    numeroCuenta: "",
    descripcionTipoCuenta: "",
    capitalInicial: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !loading) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loading, onClose]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const numeroCuenta = form.numeroCuenta.trim();
    const descripcionTipoCuenta = form.descripcionTipoCuenta.trim();
    const capitalInicial = Number(form.capitalInicial);

    if (!numeroCuenta || !descripcionTipoCuenta || form.capitalInicial === "") {
      setError("Completa todos los campos para agregar la cuenta.");
      return;
    }

    if (!Number.isFinite(capitalInicial) || capitalInicial < 0) {
      setError("El capital inicial debe ser un monto válido igual o mayor que cero.");
      return;
    }

    try {
      await onSubmit({
        numeroCuenta,
        descripcionTipoCuenta,
        capitalInicial,
      });
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message ??
          submitError?.message ??
          "No se pudo agregar la cuenta. Revisa los datos e intenta de nuevo.",
      );
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-account-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-dark-border bg-dark-card shadow-card animate-slide-up"
      >
        <div className="h-1 bg-gradient-to-r from-primary-green via-emerald-300 to-primary-green/20" />
        <div className="p-6 sm:p-8">
          <header className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-primary-green">
                Nueva cuenta
              </p>
              <h3 id="add-account-title" className="text-2xl font-bold text-white">
                Agregar cuenta corporativa
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">
                Registra la cuenta y su capital de apertura en el libro corporativo.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dark-border text-gray-500 transition-colors hover:border-gray-600 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-green/60 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Cerrar formulario"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="numeroCuenta" className="block px-1 text-xs font-semibold text-gray-300">
                Número de cuenta
              </label>
              <input
                id="numeroCuenta"
                name="numeroCuenta"
                type="text"
                value={form.numeroCuenta}
                onChange={updateField}
                placeholder="Ej. BRD-9607299"
                className="input-field w-full"
                autoComplete="off"
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="descripcionTipoCuenta"
                className="block px-1 text-xs font-semibold text-gray-300"
              >
                Descripción o tipo de cuenta
              </label>
              <input
                id="descripcionTipoCuenta"
                name="descripcionTipoCuenta"
                type="text"
                value={form.descripcionTipoCuenta}
                onChange={updateField}
                placeholder="Ej. Banco de Reservas — corriente"
                className="input-field w-full"
                autoComplete="off"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="capitalInicial" className="block px-1 text-xs font-semibold text-gray-300">
                Capital inicial
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-gray-500">
                  RD$
                </span>
                <input
                  id="capitalInicial"
                  name="capitalInicial"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.capitalInicial}
                  onChange={updateField}
                  placeholder="0.00"
                  className="input-field w-full pl-12 text-right font-semibold tabular-nums"
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-primary-red/20 bg-primary-red/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary sm:min-w-28"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary sm:min-w-40" disabled={loading}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  "Agregar cuenta"
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
};

const AccountRow = ({ name, type, balance, status, positive }) => (
  <div className="flex flex-col p-4 bg-dark-bg/50 border border-dark-border rounded-2xl hover:bg-dark-border/20 transition-all cursor-default group h-full">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border transition-all ${positive ? "bg-primary-green/5 border-primary-green/20" : "bg-primary-red/5 border-primary-red/20"}`}
        >
          <Wallet
            className={`h-4 w-4 ${positive ? "text-primary-green" : "text-primary-red"}`}
          />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-xs truncate tracking-tight">{name}</p>
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter truncate mt-0.5">
            {type}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 bg-dark-card border border-dark-border px-1.5 py-0.5 rounded-full">
        <span className={`h-1 w-1 rounded-full ${positive ? "bg-primary-green" : "bg-primary-red"}`}></span>
        <span className={`text-[8px] uppercase font-black ${positive ? "text-primary-green" : "text-primary-red"}`}>
          {status}
        </span>
      </div>
    </div>
    <div className="mt-auto pt-2 border-t border-dark-border/40">
      <p
        className={`font-black text-lg text-right ${positive ? "text-white" : "text-primary-red"}`}
      >
        {balance}
      </p>
    </div>
  </div>
);

const BankSummaryItem = ({ name, inflow, outflow, count }) => (
  <div className="p-4 bg-dark-bg/50 border border-dark-border rounded-2xl hover:border-purple-500/30 transition-all group">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">{name}</p>
          <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
            {count} Operaciones
          </p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <div className="flex flex-col">
        <span className="text-gray-500 font-medium">Entradas</span>
        <span className="text-primary-green font-bold">
          {formatCurrency(inflow)}
        </span>
      </div>
      <div className="flex flex-col text-right">
        <span className="text-gray-500 font-medium">Salidas</span>
        <span className="text-primary-red font-bold">
          {formatCurrency(outflow)}
        </span>
      </div>
    </div>
  </div>
);

const SummaryCard = ({ title, value, icon, trend, trendIcon, positive }) => (
  <div className="bg-dark-card border border-dark-border p-6 rounded-2xl shadow-card hover:border-primary-green/30 transition-all hover:-translate-y-1 duration-300 group">
    <div className="flex items-center justify-between mb-5">
      <div className="p-2.5 bg-dark-bg border border-dark-border rounded-xl group-hover:bg-primary-green/5 group-hover:border-primary-green/20 transition-colors">
        {icon}
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-dark-bg border border-dark-border ${positive === undefined ? "text-gray-500" : positive ? "text-primary-green border-primary-green/10" : "text-primary-red border-primary-red/10"}`}
        >
          {trendIcon}
          {trend}
        </div>
      )}
    </div>
    <div className="space-y-1.5">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
        {title}
      </p>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  </div>
);

export default AccountBookPage;
