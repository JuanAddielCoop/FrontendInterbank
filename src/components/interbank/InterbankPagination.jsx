import { ChevronLeft, ChevronRight } from 'lucide-react'

const InterbankPagination = ({
  pageNumber,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disablePrev,
  disableNext,
}) => (
  <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span>Página {pageNumber}</span>
      <span className="text-gray-600">|</span>
      <label className="text-xs uppercase tracking-wide">Resultados</label>
      <select
        className="input-field w-24"
        value={pageSize}
        onChange={(event) => onPageSizeChange(Number(event.target.value))}
      >
        {[5, 10, 20, 30, 50].map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary flex items-center gap-2 text-sm"
        onClick={() => onPageChange(pageNumber - 1)}
        disabled={disablePrev}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </button>
      <button
        type="button"
        className="btn-secondary flex items-center gap-2 text-sm"
        onClick={() => onPageChange(pageNumber + 1)}
        disabled={disableNext}
      >
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
)

export default InterbankPagination
