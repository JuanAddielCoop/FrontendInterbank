import { useEffect, useState } from "react";
import api from "../lib/axiosInstance";
import { useAuth } from "../context/AuthContext";

const useFetch = (url, { immediate = true, config } = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url && immediate));
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { token } = useAuth(); // kept just as a dependency if needed

  useEffect(() => {
    if (!url || !immediate) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get(url, {
          signal: controller.signal,
          ...config,
        });

        if (isMounted) {
          setData(response.data ?? null);
          setError(null); // Limpiar errores previos en caso de éxito
        }
      } catch (err) {
        if (!axios.isCancel(err) && isMounted) {
          // Limpiar datos obsoletos cuando hay error
          setData(null);

          // Detectar tipo de error
          let errorMessage = "Error al cargar la información";

          if (!err.response) {
            // Error de red (sin conexión)
            errorMessage =
              "Sin conexión: Verifica tu internet o inicia sesión nuevamente";
          } else if (err.response.status === 401) {
            // No autorizado
            errorMessage =
              "Sesión expirada: Por favor, inicia sesión nuevamente";
          } else if (err.response.status >= 500) {
            // Error del servidor
            errorMessage = "Error del servidor: Intenta más tarde";
          } else {
            errorMessage = err?.message ?? errorMessage;
          }

          setError(errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [url, immediate, reloadKey, config, token]);

  const refetch = () => setReloadKey((prev) => prev + 1);

  return { data, loading, error, refetch };
};

export default useFetch;
