import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 50];

const BankInboundPagination = ({
  pageNumber,
  pageSize,
  hasNextPage,
  onPageChange,
  onPageSizeChange,
}) => (
  <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span>Página {pageNumber}</span>
      <span className="text-gray-600">|</span>
      <label htmlFor="bi-page-size" className="text-xs uppercase tracking-wide">
        Por página
      </label>
      <select
        id="bi-page-size"
        className="input-field w-24"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
      >
        {PAGE_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>

    <div className="flex items-center gap-2">
      <button
        id="bi-prev-page"
        type="button"
        className="btn-secondary flex items-center gap-2 text-sm"
        onClick={() => onPageChange(pageNumber - 1)}
        disabled={pageNumber <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Anterior
      </button>
      <button
        id="bi-next-page"
        type="button"
        className="btn-secondary flex items-center gap-2 text-sm"
        onClick={() => onPageChange(pageNumber + 1)}
        disabled={!hasNextPage}
      >
        Siguiente
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

export default BankInboundPagination;
