import { Filter, RefreshCw } from "lucide-react";

const booleanOptions = [
  { value: "", label: "Todos" },
  { value: "true", label: "Si" },
  { value: "false", label: "No" },
];

const InterbankFilters = ({
  filters,
  onChange,
  onReset,
  onSubmit,
  isAdminOnly = false,
}) => (
  <section className="card space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 text-white sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary-green" />
          <h2 className="text-base font-semibold">Filtros de transferencias</h2>
        </div>
        <span className="text-xs text-gray-500">
          Sección principal muestra pendientes; usa los botones rápidos para
          otros estados
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
          className="btn-primary text-xs"
          onClick={onSubmit}
        >
          Aplicar filtros
        </button>
      </div>
    </header>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      <div>
        <p className="text-xs text-gray-500 mb-1">Nombre del socio</p>
        <input
          className="input-field w-full"
          placeholder="Buscar por nombre"
          value={filters.name}
          onChange={(event) => onChange("name", event.target.value)}
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">
          Identificación beneficiario
        </p>
        <input
          className="input-field w-full"
          placeholder="Cédula o RNC"
          value={filters.identification}
          onChange={(event) => onChange("identification", event.target.value)}
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Cuenta banco</p>
        <input
          className="input-field w-full"
          placeholder="No. cuenta bancaria"
          value={filters.noAccountBank}
          onChange={(event) => onChange("noAccountBank", event.target.value)}
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Cuenta Coop</p>
        <input
          className="input-field w-full"
          placeholder="No. cuenta cooperativa"
          value={filters.noAccountCoop}
          onChange={(event) => onChange("noAccountCoop", event.target.value)}
        />
      </div>
      {!isAdminOnly && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Actualizado por</p>
          <input
            className="input-field w-full"
            placeholder="Usuario admin"
            value={filters.updatedBy}
            onChange={(event) => onChange("updatedBy", event.target.value)}
          />
        </div>
      )}
      {!isAdminOnly && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Aprobada?</p>
          <select
            className="input-field w-full"
            value={filters.isSubmit}
            onChange={(event) => onChange("isSubmit", event.target.value)}
          >
            {booleanOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 mb-1">Prioridad?</p>
        <select
          className="input-field w-full"
          value={filters.isPriority}
          onChange={(event) => onChange("isPriority", event.target.value)}
        >
          {booleanOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Fecha solicitada</p>
        <input
          type="date"
          className="input-field w-full"
          value={filters.createdAt}
          onChange={(event) => onChange("createdAt", event.target.value)}
        />
      </div>
      {!isAdminOnly && (
        <div>
          <p className="text-xs text-gray-500 mb-1">Fecha confirmada</p>
          <input
            type="date"
            className="input-field w-full"
            value={filters.updatedAt}
            onChange={(event) => onChange("updatedAt", event.target.value)}
          />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 mb-1">Resultados por página</p>
        <select
          className="input-field w-full"
          value={filters.pageSize}
          onChange={(event) => onChange("pageSize", Number(event.target.value))}
        >
          {[5, 10, 20, 30, 50].map((size) => (
            <option key={size} value={size}>
              {size} resultados
            </option>
          ))}
        </select>
      </div>
    </div>
  </section>
);

export default InterbankFilters;
