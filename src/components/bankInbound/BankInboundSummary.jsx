import { createElement } from "react";
import {
  Activity,
  Banknote,
  CheckCircle2,
  Clock10,
  ShieldAlert,
} from "lucide-react";
import { formatCurrency } from "../../utils/transactions";

const METRICS = [
  {
    key: "totalSolicitudes",
    label: "Total solicitudes",
    Icon: Activity,
    color: "text-sky-300",
  },
  {
    key: "pendientes",
    label: "Pendientes",
    Icon: Clock10,
    color: "text-amber-300",
  },
  {
    key: "confirmadas",
    label: "Confirmadas",
    Icon: CheckCircle2,
    color: "text-green-300",
  },
  {
    key: "canceladas",
    label: "Canceladas",
    Icon: ShieldAlert,
    color: "text-red-300",
  },
  {
    key: "montoTotal",
    label: "Monto total",
    Icon: Banknote,
    color: "text-primary-green",
    currency: true,
  },
];

const BankInboundSummary = ({ metrics, isLoading = false }) => (
  <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
    {METRICS.map(({ key, label, Icon, color, currency }) => (
      <article
        key={key}
        className={`card flex min-w-0 items-center justify-between ${
          currency ? "xl:px-3" : ""
        }`}
      >
        {isLoading ? (
          <>
            <div className="flex-1 animate-pulse space-y-2">
              <div className="h-3 w-24 rounded-full bg-dark-border" />
              <div className="h-7 w-20 rounded-full bg-dark-border" />
            </div>
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-dark-border" />
          </>
        ) : (
          <>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {label}
              </p>
              <p
                className={`mt-2 whitespace-nowrap font-semibold ${
                  currency
                    ? "text-xl tracking-tight text-primary-green xl:text-base"
                    : "text-2xl text-white"
                }`}
              >
                {currency
                  ? formatCurrency(metrics?.[key] ?? 0)
                  : (metrics?.[key] ?? 0)}
              </p>
            </div>
            <div className={`shrink-0 rounded-2xl bg-[#151822] p-3 ${color}`}>
              {createElement(Icon, { className: "h-6 w-6" })}
            </div>
          </>
        )}
      </article>
    ))}
  </section>
);

export default BankInboundSummary;
