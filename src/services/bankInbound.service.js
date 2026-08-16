import api from "../lib/axiosInstance.js";
import { getApiBaseUrl } from "../utils/api.js";

const ENDPOINT = "/BankInbound";

/**
 * Construye los query params limpios para la API, omitiendo valores vacíos.
 */
export const buildBankInboundParams = (filters, pageNumber, pageSize) => {
  const raw = {
    PageNumber: pageNumber,
    PageSize: pageSize,
    ...(filters.nameBank && { NameBank: filters.nameBank }),
    ...(filters.socioId && { SocioId: Number(filters.socioId) }),
    ...(filters.amount && { Amount: Number(filters.amount) }),
    ...(filters.isConfirm && { IsConfirm: filters.isConfirm }),
    ...(filters.updatedBy && { UpdatedBy: filters.updatedBy }),
    ...(filters.createdAt && { CreatedAt: filters.createdAt }),
    ...(filters.updatedAt && { UpdatedAt: filters.updatedAt }),
  };
  return raw;
};

export const buildBankInboundDashboardParams = (filters) => ({
  ...(filters.amount && { amount: Number(filters.amount) }),
  ...(filters.createdAt && {
    createdAt: new Date(filters.createdAt).toISOString(),
  }),
  ...(filters.updatedAt && {
    updatedAt: new Date(filters.updatedAt).toISOString(),
  }),
  ...(filters.socioId && { socioId: Number(filters.socioId) }),
  ...(filters.updatedBy && { updatedBy: filters.updatedBy }),
  ...(filters.nameBank && { nameBank: filters.nameBank }),
});

export const normalizeBankInboundDashboard = (data) => ({
  totalSolicitudes: Number(data?.totalSolicitudes) || 0,
  pendientes: Number(data?.pendientes) || 0,
  confirmadas: Number(data?.confirmadas) || 0,
  canceladas: Number(data?.canceladas) || 0,
  montoTotal: Number(data?.montoTotal) || 0,
});

/**
 * Obtiene los depósitos interbancarios paginados.
 * @param {object} params
 * @param {object} params.filters   - Filtros activos
 * @param {number} params.pageNumber
 * @param {number} params.pageSize
 * @param {AbortSignal} params.signal
 */
export const fetchBankInbound = async ({
  filters,
  pageNumber,
  pageSize,
  signal,
}) => {
  const baseUrl = getApiBaseUrl();
  const params = buildBankInboundParams(filters, pageNumber, pageSize);

  const response = await api.get(`${baseUrl}${ENDPOINT}`, {
    signal,
    params,
  });

  const body = response.data;
  return {
    data: Array.isArray(body?.data) ? body.data : [],
    pageNumber: body?.pageNumber ?? pageNumber,
    pageSize: body?.pageSize ?? pageSize,
    succeeded: body?.succeeded ?? false,
    message: body?.message ?? null,
  };
};

export const fetchBankInboundDashboard = async ({ filters, signal }) => {
  const baseUrl = getApiBaseUrl();
  const response = await api.get(`${baseUrl}${ENDPOINT}/Dashboard`, {
    signal,
    params: buildBankInboundDashboardParams(filters),
  });

  return {
    data: normalizeBankInboundDashboard(response.data?.data),
    succeeded: response.data?.succeeded ?? false,
    message: response.data?.message ?? null,
  };
};

/**
 * Actualiza el estado de un depósito interbancario (Confirmar / Cancelar).
 * Actualiza el estado y adjunta el comprobante del empleado cuando se confirma.
 */
export const updateBankInboundStatus = async ({ payload }) => {
  const baseUrl = getApiBaseUrl();
  const formData = new FormData();

  formData.append("Id", payload.id);
  formData.append("IsConfirm", payload.isConfirm);
  formData.append("UpdatedBy", payload.updatedBy);
  formData.append("UpdatedAt", payload.updatedAt);
  formData.append("Comentario", payload.comentario ?? "");
  formData.append("Recibo", String(payload.recibo ?? 0));

  if (payload.confirmationImage) {
    formData.append("ConfirmationImage", payload.confirmationImage);
  }

  const response = await api.patch(`${baseUrl}${ENDPOINT}`, formData);
  return response.data;
};
