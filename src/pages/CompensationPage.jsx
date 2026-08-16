import { useReconciliationBatches } from "../modules/compensation/queries/useReconciliationBatches";
import Skeleton from "../components/common/Skeleton";
import ErrorBanner from "../components/common/ErrorBanner";
import { formatCurrency } from "../utils/transactions";
import { useState } from "react";
import {
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  FileText,
  Clock,
  Wallet,
} from "lucide-react";

const STATUS_COLORS = {
  COMPLETED: { bg: "bg-primary-green/10", border: "border-primary-green/20", text: "text-primary-green", label: "Completado" },
  OPEN: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", label: "Abierto" },
  PROCESSING: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", label: "Procesando" },
  FAILED: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", label: "Fallido" },
};

const ITEM_STATUS_COLORS = {
  MATCH: { bg: "bg-primary-green/10", text: "text-primary-green", label: "Match" },
  MISMATCH: { bg: "bg-red-500/10", text: "text-red-400", label: "Diferencia" },
  PENDING: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Pendiente" },
};

const CompensationPage = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expandedBatch, setExpandedBatch] = useState(null);

  const { data: response, isLoading, isError, error } = useReconciliationBatches({
    businessDate: selectedDate,
    limit: 5,
  });

  const batches = response?.data?.batches || [];

  const toggleBatch = (batchId) => {
    setExpandedBatch(expandedBatch === batchId ? null : batchId);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 w-64 bg-dark-card border border-dark-border rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-dark-card border border-dark-border rounded-2xl"></div>
          ))}
        </div>
        <div className="h-[500px] bg-dark-card border border-dark-border rounded-3xl"></div>
      </div>
    );
  }

  if (isError) {
    return <ErrorBanner error={error} />;
  }

  const latestBatch = batches[0];
  const batchStatus = latestBatch ? STATUS_COLORS[latestBatch.status] || STATUS_COLORS.OPEN : null;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      {/* Header & Date Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <Banknote className="h-6 w-6 text-purple-400" />
            </div>
            Compensacion
          </h2>
          <p className="text-gray-400 text-sm ml-12">
            Resultados diarios de la compensacion bancaria y validacion de cuentas puente.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-dark-card border border-dark-border p-2 rounded-2xl">
          <Calendar className="h-4 w-4 text-purple-400 ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none text-white text-sm focus:ring-0 outline-none pr-4 cursor-pointer"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Batches"
          value={batches.length}
          icon={<Layers className="h-5 w-5 text-purple-400" />}
          trend={`${batches.filter(b => b.status === 'COMPLETED').length} completados`}
        />
        <SummaryCard
          title="Items Totales"
          value={batches.reduce((sum, b) => sum + b.totalItems, 0)}
          icon={<FileText className="h-5 w-5 text-purple-400" />}
          trend="En todos los batches"
        />
        <SummaryCard
          title="Matches"
          value={batches.reduce((sum, b) => sum + b.matchCount, 0)}
          icon={<CheckCircle2 className="h-5 w-5 text-primary-green" />}
          trend="Conciliados"
          positive
        />
        <SummaryCard
          title="Sin Match"
          value={batches.reduce((sum, b) => sum + b.unmatchedCount, 0)}
          icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}
          trend="Por revisar"
        />
      </div>

      {/* Batches List */}
      {batches.length > 0 ? (
        <div className="space-y-6">
          {batches.map((batch) => {
            const statusStyle = STATUS_COLORS[batch.status] || STATUS_COLORS.OPEN;
            const isOpen = expandedBatch === batch.id;
            const totalDifference = batch.items.reduce(
              (sum, item) => sum + (item.difference || 0), 0
            );

            return (
              <div
                key={batch.id}
                className="bg-dark-card border border-dark-border rounded-3xl overflow-hidden"
              >
                {/* Batch Header */}
                <button
                  onClick={() => toggleBatch(batch.id)}
                  className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 hover:bg-dark-bg/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                      <Layers className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        Batch #{batch.id} — {new Date(batch.businessDate).toLocaleDateString("es-DO", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>{batch.totalItems} bovedas</span>
                        <span className="w-1 h-1 rounded-full bg-dark-border"></span>
                        <span>{batch.matchCount} matches</span>
                        {batch.unmatchedCount > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-dark-border"></span>
                            <span className="text-amber-400">{batch.unmatchedCount} sin match</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border`}>
                      {statusStyle.label}
                    </div>
                    <div className={`text-sm font-bold ${totalDifference === 0 ? 'text-primary-green' : 'text-red-400'}`}>
                      {totalDifference === 0 ? 'OK' : formatCurrency(totalDifference)}
                    </div>
                    <div className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      <TrendingDown className="h-4 w-4 text-gray-500" />
                    </div>
                  </div>
                </button>

                {/* Expanded Items */}
                {isOpen && (
                  <div className="border-t border-dark-border">
                    {/* Batch Metadata */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-dark-bg/30">
                      <MetaItem label="Inicio" value={batch.startedAt ? new Date(batch.startedAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }) : "--"} />
                      <MetaItem label="Fin" value={batch.finishedAt ? new Date(batch.finishedAt).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" }) : "--"} />
                      <MetaItem label="Creado por" value={batch.createdBy || "Sistema"} />
                      {batch.notes && <MetaItem label="Notas" value={batch.notes} />}
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-separate border-spacing-y-1">
                        <thead>
                          <tr className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                            <th className="px-4 py-3">Boveda</th>
                            <th className="px-4 py-3 text-right">Apertura</th>
                            <th className="px-4 py-3 text-right">Entradas</th>
                            <th className="px-4 py-3 text-right">Salidas</th>
                            <th className="px-4 py-3 text-right">Comisiones</th>
                            <th className="px-4 py-3 text-right">Reversos</th>
                            <th className="px-4 py-3 text-right">Esperado</th>
                            <th className="px-4 py-3 text-right">Actual</th>
                            <th className="px-4 py-3 text-right">Diferencia</th>
                            <th className="px-4 py-3 text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.items.map((item) => {
                            const diffStatus = item.status === "MATCH"
                              ? ITEM_STATUS_COLORS.MATCH
                              : item.difference !== 0 && item.difference !== null
                                ? ITEM_STATUS_COLORS.MISMATCH
                                : ITEM_STATUS_COLORS.PENDING;

                            return (
                              <tr
                                key={item.id}
                                className="bg-dark-bg/30 hover:bg-dark-border/20 transition-colors group"
                              >
                                <td className="px-4 py-3 first:rounded-l-2xl">
                                  <div className="text-white text-xs font-bold">
                                    {item.bankName || item.accountNumber}
                                  </div>
                                  <div className="text-[10px] text-gray-500">{item.bankCode}</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-white text-xs font-medium">
                                    {formatCurrency(item.openingBalance)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-primary-green text-xs font-medium">
                                    {formatCurrency(item.totalInbounds)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-primary-red text-xs font-medium">
                                    {formatCurrency(item.totalOutbounds)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-amber-400 text-xs font-medium">
                                    {formatCurrency(item.totalBankFees)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-gray-400 text-xs font-medium">
                                    {formatCurrency(item.totalReversals)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-white text-xs font-medium">
                                    {formatCurrency(item.expectedClosingBalance)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="text-white text-xs font-medium">
                                    {item.actualClosingBalance != null
                                      ? formatCurrency(item.actualClosingBalance)
                                      : "--"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right last:rounded-r-2xl">
                                  {item.difference != null ? (
                                    <span
                                      className={`text-xs font-bold ${
                                        item.difference === 0
                                          ? "text-primary-green"
                                          : "text-red-400"
                                      }`}
                                    >
                                      {item.difference === 0
                                        ? "0.00"
                                        : formatCurrency(item.difference)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">--</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${diffStatus.bg} ${diffStatus.text}`}
                                  >
                                    {diffStatus.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-dark-card border border-dark-border rounded-3xl p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-dark-bg rounded-2xl border border-dark-border">
              <Banknote className="h-12 w-12 text-dark-border" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              Sin datos de compensacion para esta fecha.
            </p>
            <p className="text-gray-600 text-xs">
              Selecciona una fecha o ejecuta el worker de compensacion para ver resultados.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ title, value, icon, trend, positive }) => (
  <div className={`bg-dark-card border border-dark-border p-6 rounded-2xl shadow-card hover:border-purple-500/30 transition-all hover:-translate-y-1 duration-300 group ${positive ? 'hover:border-primary-green/30' : ''}`}>
    <div className="flex items-center justify-between mb-5">
      <div className="p-2.5 bg-dark-bg border border-dark-border rounded-xl group-hover:bg-purple-500/5 group-hover:border-purple-500/20 transition-colors">
        {icon}
      </div>
      <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-dark-bg border border-dark-border ${positive === true ? 'text-primary-green border-primary-green/10' : positive === false ? 'text-red-400 border-red-500/10' : 'text-gray-500'}`}>
        {trend}
      </div>
    </div>
    <div className="space-y-1.5">
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{title}</p>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
    </div>
  </div>
);

const MetaItem = ({ label, value }) => (
  <div className="text-left">
    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
    <p className="text-white text-xs font-semibold mt-1">{value}</p>
  </div>
);

export default CompensationPage;
