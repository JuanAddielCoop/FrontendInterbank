import axios from 'axios'

/**
 * Instancia centralizada de Axios.
 * Crea un wrapper al que los interceptores del AuthContext le
 * inyectan los headers de forma automática.
 *
 * ──────────────────────────────────────────────────────────────────
 * IMPORTANTE: todos los servicios y hooks deben importar ESTE
 * objeto en lugar del `axios` global para que la inyección de
 * tokens y la detección de 401 funcionen de manera consistente.
 * ──────────────────────────────────────────────────────────────────
 */
const api = axios.create()

export default api
