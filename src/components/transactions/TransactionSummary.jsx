import { ArrowDownLeft, ArrowUpRight, History } from 'lucide-react'
import { formatCurrency } from '../../utils/transactions'

const TransactionSummary = ({ stats }) => (
  <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <article className="card flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Total</p>
        <h3 className="mt-2 text-3xl font-semibold">{stats.total}</h3>
      </div>
      <div className="rounded-2xl bg-[#151822] p-3 text-sky-300">
        <History className="h-6 w-6" />
      </div>
    </article>
    <article className="card flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Entradas</p>
        <h3 className="mt-2 text-xl font-semibold text-green-300">
          {formatCurrency(stats.incoming)}
        </h3>
      </div>
      <div className="rounded-2xl bg-green-500/10 p-3 text-green-300">
        <ArrowDownLeft className="h-6 w-6" />
      </div>
    </article>
    <article className="card flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Salidas</p>
        <h3 className="mt-2 text-xl font-semibold text-red-300">
          {formatCurrency(stats.outgoing)}
        </h3>
      </div>
      <div className="rounded-2xl bg-red-500/10 p-3 text-red-300">
        <ArrowUpRight className="h-6 w-6" />
      </div>
    </article>
  </section>
)

export default TransactionSummary
