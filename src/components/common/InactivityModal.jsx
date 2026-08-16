import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

const InactivityModal = ({ isOpen, onClose, onLogout }) => {
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    let timer;
    if (isOpen) {
      setCountdown(15);
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, onLogout]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card mx-4 w-full max-w-md space-y-4 animate-in fade-in zoom-in duration-200">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-yellow-500/10 p-2">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              Sesión Inactiva
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              No se ha detectado actividad durante 10 segundos. Por seguridad,
              tu sesión se cerrará automáticamente en{" "}
              <span className="font-bold text-yellow-500">{countdown}s</span>.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            onClick={onClose}
          >
            Mantener sesión activa
          </button>
        </div>
      </div>
    </div>
  );
};

export default InactivityModal;
