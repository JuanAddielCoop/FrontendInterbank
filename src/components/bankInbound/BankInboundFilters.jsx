import { Filter, RefreshCw, Search } from "lucide-react";

const BankInboundFilters = ({ filters, onChange, onSearch, onReset }) => (
  <section className="card space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-white">
        <Filter className="h-5 w-5 text-primary-green" />
        <h2 className="text-base font-semibold">Filtros de depósitos</h2>
        <span className="hidden text-xs text-gray-500 sm:block">
          — Busca por banco, socio, monto o fecha
        </span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-secondary flex items-center gap-2 text-xs"
          onClick={onReset}
        >
          <RefreshCw className="h-3 w-3" />
          Limpiar
        </button>
        <button
          type="button"
          className="btn-primary flex items-center gap-2 text-xs"
          onClick={onSearch}
        >
          <Search className="h-3 w-3" />
          Buscar
        </button>
      </div>
    </header>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Nombre del Banco */}
      <div>
        <p className="mb-1 text-xs text-gray-500">Nombre del Banco</p>
        <input
          id="bi-filter-nameBank"
          className="input-field w-full"
          placeholder="Ej. Santa Cruz"
          value={filters.nameBank}
          onChange={(e) => onChange("nameBank", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
      </div>

      {/* Socio ID */}
      <div>
        <p className="mb-1 text-xs text-gray-500">ID del Socio</p>
        <input
          id="bi-filter-socioId"
          type="number"
          className="input-field w-full"
          placeholder="Ej. 20137"
          value={filters.socioId}
          onChange={(e) => onChange("socioId", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
      </div>

      {/* Monto */}
      <div>
        <p className="mb-1 text-xs text-gray-500">Monto exacto</p>
        <input
          id="bi-filter-amount"
          type="number"
          className="input-field w-full"
          placeholder="Ej. 5000"
          value={filters.amount}
          onChange={(e) => onChange("amount", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
      </div>

      {/* Fecha de creación */}
      <div>
        <p className="mb-1 text-xs text-gray-500">Fecha de creación</p>
        <input
          id="bi-filter-createdAt"
          type="date"
          className="input-field w-full"
          value={filters.createdAt}
          onChange={(e) => onChange("createdAt", e.target.value)}
        />
      </div>

      {/* Fecha de actualización */}
      <div>
        <p className="mb-1 text-xs text-gray-500">Fecha de actualización</p>
        <input
          id="bi-filter-updatedAt"
          type="date"
          className="input-field w-full"
          value={filters.updatedAt}
          onChange={(e) => onChange("updatedAt", e.target.value)}
        />
      </div>

      {/* Actualizado por */}
      <div>
        <p className="mb-1 text-xs text-gray-500">Actualizado por</p>
        <input
          id="bi-filter-updatedBy"
          className="input-field w-full"
          placeholder="Nombre de usuario"
          value={filters.updatedBy}
          onChange={(e) => onChange("updatedBy", e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
      </div>
    </div>
  </section>
);

export default BankInboundFilters;
