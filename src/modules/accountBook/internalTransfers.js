export const resolveEmployeeId = (user) => {
  const employeeId = Number(
    user?.employeeId ?? user?.empleado ?? user?.id,
  );
  return Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null;
};

export const normalizeInternalTransfer = (response, fallbackPayload) => {
  const transfer = response && typeof response === "object" ? response : {};

  return {
    id: transfer.id ?? `internal-${Date.now()}`,
    accountOrigin:
      transfer.cuentaOrigen ??
      transfer.numeroCuentaOrigen ??
      fallbackPayload.numeroCuentaOrigen,
    accountDestination:
      transfer.cuentaDestino ??
      transfer.numeroCuentaDestino ??
      fallbackPayload.numeroCuentaDestino,
    amount: Number(transfer.monto ?? fallbackPayload.monto),
    date: transfer.fecha ?? new Date().toISOString(),
    notes:
      transfer.notas ??
      transfer.observaciones ??
      fallbackPayload.observaciones ??
      "Transferencia interna reciente (sesión actual)",
  };
};

export const validateInternalTransfer = (payload, employeeId) => {
  const origin = payload?.numeroCuentaOrigen?.trim();
  const destination = payload?.numeroCuentaDestino?.trim();
  const amount = Number(payload?.monto);

  if (!origin || !destination || payload?.monto === "") {
    return "Selecciona las cuentas e indica el monto de la transferencia.";
  }

  if (origin === destination) {
    return "La cuenta de origen y destino deben ser diferentes.";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return "El monto debe ser un número válido mayor que cero.";
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return "No se encontró un identificador de empleado válido. Cierra sesión e inicia nuevamente.";
  }

  return "";
};

export const buildInternalTransferPayload = (payload, employeeId) => {
  const validationError = validateInternalTransfer(payload, employeeId);
  if (validationError) throw new Error(validationError);

  return {
    numeroCuentaOrigen: payload.numeroCuentaOrigen.trim(),
    numeroCuentaDestino: payload.numeroCuentaDestino.trim(),
    monto: Number(payload.monto),
    observaciones: payload.observaciones?.trim() ?? "",
    empleado: employeeId,
  };
};
