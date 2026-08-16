import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  X,
} from "lucide-react";
import ErrorBanner from "../components/common/ErrorBanner";
import { formatCurrency } from "../utils/transactions";
import { useBankReservasAccounts } from "../modules/accountBook/queries/useAccountBook";
import {
  useBankExpenses,
  useCreateBankExpense,
  useDeleteBankExpense,
} from "../modules/bankExpenses/queries/useBankExpenses";

const EMPTY_STATUS = { type: "", message: "" };

const extractExpenseItems = (payload) => {
  const candidates = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.gastosBancarios,
    payload?.data?.gastosBancarios,
    payload?.gastoBancario,
    payload?.data?.gastoBancario,
    payload?.gastos,
    payload?.data?.gastos,
    payload?.items,
    payload?.data?.items,
  ];
  const directMatch = candidates.find(Array.isArray);
  if (directMatch) return directMatch;

  const nestedPayload = payload?.data && typeof payload.data === "object"
    ? Object.values(payload.data).find(Array.isArray)
    : null;

  return nestedPayload || [];
};

const normalizeExpense = (expense, index) => {
  const relatedAccount = expense?.account ?? expense?.cuenta ?? {};

  return {
    id:
      expense?.id ??
      expense?.gastoBancarioId ??
      expense?.idGastoBancario ??
      `gasto-${index}`,
    total: Number(expense?.total ?? expense?.monto ?? expense?.amount ?? 0) || 0,
    description:
      expense?.descripcion ??
      expense?.description ??
      expense?.concepto ??
      "Gasto bancario",
    accountId:
      expense?.accountId ??
      expense?.cuentaId ??
      relatedAccount?.id ??
      relatedAccount?.accountId,
    accountNumber:
      expense?.numeroCuenta ??
      expense?.accountNumber ??
      relatedAccount?.numeroCuenta ??
      relatedAccount?.accountNumber,
    createdAt:
      expense?.createdAt ??
      expense?.fechaCreacion ??
      expense?.fecha ??
      expense?.date ??
      null,
  };
};

const resolveAccountId = (account) =>
  account?.id ?? account?.accountId ?? account?.cuentaId;

const formatExpenseDate = (value) => {
  if (!value) return { date: "Sin fecha", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "Sin fecha", time: "" };

  return {
    date: date.toLocaleDateString("es-DO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("es-DO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message ?? error?.message ?? fallback;

const BankExpensesPage = () => {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [status, setStatus] = useState(EMPTY_STATUS);

  const expensesQuery = useBankExpenses();
  const accountsQuery = useBankReservasAccounts();
  const createExpense = useCreateBankExpense();
  const deleteExpense = useDeleteBankExpense();

  const accounts = useMemo(
    () => accountsQuery.data?.data?.cuentas || accountsQuery.data?.cuentas || [],
    [accountsQuery.data],
  );

  const expenses = useMemo(
    () => extractExpenseItems(expensesQuery.data).map(normalizeExpense),
    [expensesQuery.data],
  );

  const accountsById = useMemo(
    () =>
      new Map(
        accounts
          .map((account) => [String(resolveAccountId(account)), account])
          .filter(([id]) => id !== "undefined" && id !== "null"),
      ),
    [accounts],
  );

  const filteredExpenses = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return expenses;

    return expenses.filter((expense) => {
      const account = accountsById.get(String(expense.accountId));
      const searchable = [
        expense.id,
        expense.description,
        expense.accountNumber,
        expense.accountId,
        account?.numeroCuenta,
        account?.descripcionTipoCuenta,
      ]
        .filter((value) => value !== undefined && value !== null)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [accountsById, expenses, search]);

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.total, 0);
  const affectedAccounts = new Set(
    expenses
      .filter((expense) => expense.accountId !== undefined && expense.accountId !== null)
      .map((expense) => String(expense.accountId)),
  ).size;

  const handleCreate = async (payload) => {
    await createExpense.mutateAsync(payload);
    setIsCreateOpen(false);
    setStatus({
      type: "success",
      message: "El gasto bancario fue registrado y el saldo de la cuenta fue actualizado.",
    });
  };

  const handleDelete = async ({ id, notaDeleted }) => {
    await deleteExpense.mutateAsync({ id, notaDeleted });
    setDeleteTarget(null);
    setStatus({
      type: "success",
      message: `El gasto #${id} fue eliminado con su nota de auditoría.`,
    });
  };

  if (expensesQuery.isPending) {
    return <BankExpensesSkeleton />;
  }

  if (expensesQuery.isError) {
    return (
      <ErrorBanner
        message={getErrorMessage(
          expensesQuery.error,
          "No pudimos obtener los gastos bancarios.",
        )}
        onRetry={expensesQuery.refetch}
      />
    );
  }

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.26em] text-amber-400">
            Control de cargos
          </p>
          <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
              <ReceiptText className="h-5 w-5 text-amber-400" />
            </span>
            Gastos bancarios
          </h2>
          <p className="mt-2 text-sm text-gray-400 md:ml-14">
            Registra cargos bancarios y conserva la trazabilidad de cada ajuste.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setStatus(EMPTY_STATUS);
            setIsCreateOpen(true);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-[#171006] transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-300/70 focus:ring-offset-2 focus:ring-offset-dark-bg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={accountsQuery.isPending || accounts.length === 0}
          title={accounts.length === 0 ? "No hay cuentas corporativas disponibles" : undefined}
        >
          <Plus className="h-4 w-4" />
          Registrar gasto
        </button>
      </div>

      {status.message && (
        <div
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
            status.type === "success"
              ? "border-primary-green/20 bg-primary-green/10 text-emerald-100"
              : "border-primary-red/20 bg-primary-red/10 text-red-100"
          }`}
          role="status"
        >
          {status.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-green" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-red" />
          )}
          <p className="flex-1 text-sm">{status.message}</p>
          <button
            type="button"
            onClick={() => setStatus(EMPTY_STATUS)}
            className="text-current/60 transition hover:text-current"
            aria-label="Cerrar mensaje"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {accountsQuery.isError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Los gastos están disponibles, pero no pudimos cargar las cuentas para registrar uno nuevo.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ExpenseMetric
          label="Total registrado"
          value={formatCurrency(totalExpenses)}
          icon={<CircleDollarSign className="h-5 w-5 text-amber-400" />}
        />
        <ExpenseMetric
          label="Cargos activos"
          value={expenses.length.toLocaleString("es-DO")}
          icon={<ReceiptText className="h-5 w-5 text-sky-400" />}
        />
        <ExpenseMetric
          label="Cuentas afectadas"
          value={affectedAccounts.toLocaleString("es-DO")}
          icon={<Building2 className="h-5 w-5 text-purple-400" />}
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-dark-border bg-dark-card shadow-card">
        <div className="flex flex-col gap-4 border-b border-dark-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <h3 className="font-bold text-white">Libro de cargos</h3>
            <p className="mt-1 text-xs text-gray-500">
              {filteredExpenses.length} de {expenses.length} registros
            </p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Buscar gastos bancarios</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cuenta o descripción"
              className="input-field w-full pl-10"
            />
          </label>
        </div>

        {filteredExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-dark-bg/60 text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                <tr>
                  <th className="px-6 py-4">Registro</th>
                  <th className="px-6 py-4">Cuenta</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-right">Monto</th>
                  <th className="px-6 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border/70">
                {filteredExpenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    account={accountsById.get(String(expense.accountId))}
                    onDelete={() => setDeleteTarget(expense)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center px-6 py-20 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-dark-border bg-dark-bg text-gray-600">
              <ReceiptText className="h-6 w-6" />
            </span>
            <h4 className="font-semibold text-white">
              {expenses.length === 0 ? "Aún no hay gastos bancarios" : "No encontramos coincidencias"}
            </h4>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              {expenses.length === 0
                ? "Registra el primer cargo para comenzar el historial de gastos."
                : "Prueba con otro número de cuenta o una descripción diferente."}
            </p>
          </div>
        )}
      </section>

      {isCreateOpen && (
        <CreateExpenseModal
          accounts={accounts}
          loading={createExpense.isPending}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {deleteTarget && (
        <DeleteExpenseModal
          expense={deleteTarget}
          loading={deleteExpense.isPending}
          onClose={() => setDeleteTarget(null)}
          onSubmit={handleDelete}
        />
      )}
    </div>
  );
};

const ExpenseMetric = ({ label, value, icon }) => (
  <div className="rounded-2xl border border-dark-border bg-dark-card p-5 shadow-card">
    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-dark-border bg-dark-bg">
      {icon}
    </div>
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">{label}</p>
    <p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p>
  </div>
);

const ExpenseRow = ({ expense, account, onDelete }) => {
  const { date, time } = formatExpenseDate(expense.createdAt);
  const accountNumber = expense.accountNumber ?? account?.numeroCuenta;
  const canDelete = Number.isInteger(Number(expense.id));

  return (
    <tr className="transition-colors hover:bg-amber-500/[0.03]">
      <td className="px-6 py-4">
        <p className="text-xs font-bold text-white">#{expense.id}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-500">
          <CalendarDays className="h-3 w-3" />
          <span>{date}</span>
          {time && <span>· {time}</span>}
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-xs font-bold text-white">{accountNumber || `Cuenta #${expense.accountId}`}</p>
        <p className="mt-1 max-w-[180px] truncate text-[10px] uppercase tracking-wide text-gray-500">
          {account?.descripcionTipoCuenta || `ID ${expense.accountId ?? "no disponible"}`}
        </p>
      </td>
      <td className="max-w-xs px-6 py-4">
        <p className="truncate text-sm text-gray-300" title={expense.description}>
          {expense.description}
        </p>
      </td>
      <td className="px-6 py-4 text-right">
        <span className="font-black tabular-nums text-amber-300">
          {formatCurrency(expense.total)}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-dark-border text-gray-500 transition hover:border-primary-red/40 hover:bg-primary-red/10 hover:text-primary-red focus:outline-none focus:ring-2 focus:ring-primary-red/50 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Eliminar gasto ${expense.id}`}
          title={canDelete ? "Eliminar gasto" : "Este registro no tiene un ID válido"}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
};

const useModalLifecycle = (loading, onClose) => {
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
};

const CreateExpenseModal = ({ accounts, loading, onClose, onSubmit }) => {
  const availableAccounts = accounts.filter((account) => {
    const id = Number(resolveAccountId(account));
    return Number.isInteger(id) && id > 0;
  });
  const [form, setForm] = useState({ total: "", descripcion: "", accountId: "" });
  const [error, setError] = useState("");

  useModalLifecycle(loading, onClose);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const total = Number(form.total);
    const accountId = Number(form.accountId);
    const descripcion = form.descripcion.trim();

    if (!form.total || !descripcion || !form.accountId) {
      setError("Completa la cuenta, la descripción y el monto del gasto.");
      return;
    }

    if (!Number.isFinite(total) || total <= 0) {
      setError("El monto debe ser mayor que cero.");
      return;
    }

    if (!Number.isInteger(accountId) || accountId <= 0) {
      setError("Selecciona una cuenta corporativa válida.");
      return;
    }

    try {
      await onSubmit({ total, descripcion, accountId });
    } catch (submitError) {
      setError(
        getErrorMessage(
          submitError,
          "No se pudo registrar el gasto. Revisa los datos e intenta de nuevo.",
        ),
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
        aria-labelledby="create-expense-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-dark-border bg-dark-card shadow-card animate-slide-up"
      >
        <div className="h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400/10" />
        <div className="p-6 sm:p-8">
          <ModalHeader
            eyebrow="Nuevo cargo"
            title="Registrar gasto bancario"
            description="El monto se cargará a la cuenta corporativa seleccionada."
            titleId="create-expense-title"
            accentClass="text-amber-400"
            loading={loading}
            onClose={onClose}
          />

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="expense-account" className="block px-1 text-xs font-semibold text-gray-300">
                Cuenta corporativa
              </label>
              <select
                id="expense-account"
                name="accountId"
                value={form.accountId}
                onChange={handleChange}
                className="input-field w-full"
                disabled={loading}
                autoFocus
              >
                <option value="" disabled>Selecciona una cuenta...</option>
                {availableAccounts.map((account) => {
                  const accountId = resolveAccountId(account);
                  return (
                    <option key={accountId} value={accountId}>
                      {account.numeroCuenta} — {account.descripcionTipoCuenta || "Cuenta corporativa"}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="expense-description" className="block px-1 text-xs font-semibold text-gray-300">
                Descripción
              </label>
              <textarea
                id="expense-description"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                placeholder="Ej. Comisión por transferencia internacional"
                rows={3}
                maxLength={500}
                className="input-field w-full resize-none"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="expense-total" className="block px-1 text-xs font-semibold text-gray-300">
                Monto total
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold text-gray-500">
                  RD$
                </span>
                <input
                  id="expense-total"
                  name="total"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.total}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="input-field w-full pl-12 text-right font-bold tabular-nums focus:border-amber-400"
                  disabled={loading}
                />
              </div>
            </div>

            {error && <ModalError message={error} />}

            <ModalActions
              loading={loading}
              loadingText="Registrando..."
              submitText="Registrar gasto"
              submitClass="bg-amber-400 text-[#171006] hover:bg-amber-300"
              onClose={onClose}
            />
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
};

const DeleteExpenseModal = ({ expense, loading, onClose, onSubmit }) => {
  const [notaDeleted, setNotaDeleted] = useState("");
  const [error, setError] = useState("");

  useModalLifecycle(loading, onClose);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const note = notaDeleted.trim();

    if (!note) {
      setError("Escribe la razón por la que se elimina este gasto.");
      return;
    }

    try {
      await onSubmit({ id: expense.id, notaDeleted: note });
    } catch (submitError) {
      setError(
        getErrorMessage(
          submitError,
          "No se pudo eliminar el gasto. Revisa la nota e intenta de nuevo.",
        ),
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
        aria-labelledby="delete-expense-title"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-primary-red/20 bg-dark-card shadow-card animate-slide-up"
      >
        <div className="h-1 bg-gradient-to-r from-primary-red via-red-400 to-primary-red/10" />
        <div className="p-6 sm:p-8">
          <ModalHeader
            eyebrow="Anular registro"
            title={`Eliminar gasto #${expense.id}`}
            description={`${formatCurrency(expense.total)} · ${expense.description}`}
            titleId="delete-expense-title"
            accentClass="text-primary-red"
            loading={loading}
            onClose={onClose}
          />

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="delete-expense-note" className="block px-1 text-xs font-semibold text-gray-300">
                Nota de eliminación
              </label>
              <textarea
                id="delete-expense-note"
                value={notaDeleted}
                onChange={(event) => {
                  setNotaDeleted(event.target.value);
                  if (error) setError("");
                }}
                placeholder="Explica por qué se elimina este cargo"
                rows={4}
                maxLength={500}
                className="input-field w-full resize-none focus:border-primary-red"
                autoFocus
                disabled={loading}
              />
              <p className="px-1 text-[10px] text-gray-500">
                Esta nota quedará asociada al registro para fines de auditoría.
              </p>
            </div>

            {error && <ModalError message={error} />}

            <ModalActions
              loading={loading}
              loadingText="Eliminando..."
              submitText="Eliminar gasto"
              submitClass="bg-primary-red text-white hover:bg-red-500"
              onClose={onClose}
            />
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
};

const ModalHeader = ({
  eyebrow,
  title,
  description,
  titleId,
  accentClass,
  loading,
  onClose,
}) => (
  <header className="mb-7 flex items-start justify-between gap-4">
    <div className="min-w-0">
      <p className={`mb-2 text-[10px] font-black uppercase tracking-[0.24em] ${accentClass}`}>
        {eyebrow}
      </p>
      <h3 id={titleId} className="text-2xl font-bold text-white">{title}</h3>
      <p className="mt-2 break-words text-sm leading-relaxed text-gray-400">{description}</p>
    </div>
    <button
      type="button"
      onClick={onClose}
      disabled={loading}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dark-border text-gray-500 transition hover:border-gray-600 hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-500/60 disabled:cursor-not-allowed disabled:opacity-40"
      aria-label="Cerrar formulario"
    >
      <X className="h-4 w-4" />
    </button>
  </header>
);

const ModalError = ({ message }) => (
  <div role="alert" className="rounded-xl border border-primary-red/20 bg-primary-red/10 px-4 py-3 text-sm text-red-200">
    {message}
  </div>
);

const ModalActions = ({
  loading,
  loadingText,
  submitText,
  submitClass,
  onClose,
}) => (
  <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
    <button type="button" className="btn-secondary sm:min-w-28" onClick={onClose} disabled={loading}>
      Cancelar
    </button>
    <button
      type="submit"
      className={`rounded-xl px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-40 ${submitClass}`}
      disabled={loading}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {loadingText}
        </span>
      ) : (
        submitText
      )}
    </button>
  </div>
);

const BankExpensesSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="flex items-end justify-between gap-4">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded-full bg-dark-border" />
        <div className="h-10 w-64 rounded-xl bg-dark-border" />
      </div>
      <div className="h-11 w-40 rounded-xl bg-dark-border" />
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-32 rounded-2xl border border-dark-border bg-dark-card" />
      ))}
    </div>
    <div className="h-[420px] rounded-3xl border border-dark-border bg-dark-card" />
  </div>
);

export default BankExpensesPage;
