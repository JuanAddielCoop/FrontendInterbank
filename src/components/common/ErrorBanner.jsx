import { AlertCircle } from 'lucide-react'

const ErrorBanner = ({ message, onRetry }) => (
  <div className="card border border-red-500/30 bg-red-500/10">
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2 text-red-300">
        <AlertCircle className="h-5 w-5" />
        <p className="font-semibold">No pudimos cargar la información</p>
      </div>
      <p className="text-sm text-red-200/80 flex-1">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary text-sm" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  </div>
)

export default ErrorBanner
