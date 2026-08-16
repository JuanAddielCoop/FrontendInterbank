import { createElement } from 'react'
import { Activity, CheckCircle2, Clock10, ShieldAlert, Zap } from 'lucide-react'
import { formatCurrency } from '../../utils/transactions'

const summaryIcons = [
  { key: 'total', Icon: Activity, color: 'text-sky-300', label: 'Total solicitudes' },
  { key: 'pending', Icon: Clock10, color: 'text-amber-300', label: 'Pendientes' },
  { key: 'approved', Icon: CheckCircle2, color: 'text-green-300', label: 'Aprobadas' },
  { key: 'cancelled', Icon: ShieldAlert, color: 'text-red-300', label: 'Canceladas' },
  { key: 'priority', Icon: Zap, color: 'text-purple-300', label: 'Prioridad' },
]

const SummarySkeleton = () => {
  const placeholders = Array.from({ length: 6 })
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {placeholders.map((_, idx) => (
        <article
          key={idx}
          className="card flex items-center justify-between animate-pulse bg-[#0f1320]"
        >
          <div className="space-y-2">
            <div className="h-3 w-28 rounded-full bg-dark-border" />
            <div className="h-6 w-16 rounded-full bg-dark-border" />
          </div>
          <div className="h-12 w-12 rounded-2xl bg-dark-border" />
        </article>
      ))}
    </section>
  )
}

const InterbankSummary = ({ stats, isLoading = false }) => {
  if (isLoading) return <SummarySkeleton />

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {summaryIcons.map(({ key, Icon, color, label }) => (
        <article key={key} className="card flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {key === 'total' ? stats.total : stats[key]}
            </p>
          </div>
          <div className={`rounded-2xl bg-[#151822] p-3 ${color}`}>
            {createElement(Icon, { className: 'h-6 w-6' })}
          </div>
        </article>
      ))}
      <article className="card flex min-w-0 items-center justify-between 2xl:px-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500">Monto total</p>
          <p className="mt-2 whitespace-nowrap text-xl font-semibold tracking-tight text-primary-green 2xl:text-base">
            {formatCurrency(stats.totalAmount)}
          </p>
        </div>
      </article>
    </section>
  )
}

export default InterbankSummary
