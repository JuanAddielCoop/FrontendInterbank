import {
  CalendarDays,
  ChevronDown,
  Filter,
  RefreshCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

const TransactionFilters = ({
  filters,
  onFilterChange,
  onResetFilters,
  sortBy,
  sortOrder,
  onSortChange,
}) => (
  <section className="card space-y-4">
    <header className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-white">
        <Filter className="h-5 w-5 text-primary-green" />
        <h2 className="text-base font-semibold">Filtros y búsqueda</h2>
      </div>
      {filters.search ||
      filters.type !== 'all' ||
      filters.dateRange !== 'all' ||
      filters.minAmount ||
      filters.maxAmount ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          onClick={onResetFilters}
        >
          <RefreshCcw className="h-3 w-3" />
          Limpiar filtros
        </button>
      ) : null}
    </header>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          value={filters.search}
          onChange={(event) => onFilterChange('search', event.target.value)}
          placeholder="Buscar por descripción, ID o beneficiario"
          className="input-field w-full pl-10"
        />
      </div>

      <div className="relative">
        <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <select
          value={filters.type}
          onChange={(event) => onFilterChange('type', event.target.value)}
          className="input-field w-full appearance-none pl-10 pr-8"
        >
          <option value="all">Todos los tipos</option>
          <option value="deposit">Depósitos</option>
          <option value="withdrawal">Retiros</option>
          <option value="transfer">Transferencias</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      </div>

      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <select
          value={filters.dateRange}
          onChange={(event) => onFilterChange('dateRange', event.target.value)}
          className="input-field w-full appearance-none pl-10 pr-8"
        >
          <option value="all">Todo el periodo</option>
          <option value="today">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          placeholder="Monto mínimo"
          value={filters.minAmount}
          onChange={(event) => onFilterChange('minAmount', event.target.value)}
          className="input-field w-1/2"
        />
        <input
          type="number"
          min="0"
          placeholder="Monto máximo"
          value={filters.maxAmount}
          onChange={(event) => onFilterChange('maxAmount', event.target.value)}
          className="input-field w-1/2"
        />
      </div>
    </div>

    <div className="flex flex-col gap-3 border-t border-dark-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <SlidersHorizontal className="h-4 w-4" />
        <span>Ordenar resultados</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={sortBy}
          onChange={(event) => onSortChange(event.target.value, sortOrder)}
          className="input-field w-full appearance-none pr-8 sm:w-48"
        >
          <option value="date">Fecha</option>
          <option value="amount">Monto</option>
          <option value="description">Descripción</option>
        </select>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
        </button>
      </div>
    </div>
  </section>
)

export default TransactionFilters
