import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInternalTransferPayload,
  normalizeInternalTransfer,
  resolveEmployeeId,
  validateInternalTransfer,
} from "../src/modules/accountBook/internalTransfers.js";

test("construye el payload con el contrato de transferencia interna", () => {
  assert.deepEqual(
    buildInternalTransferPayload(
      {
        numeroCuentaOrigen: "  cuenta-origen ",
        numeroCuentaDestino: " cuenta-destino ",
        monto: "1250.50",
        observaciones: "  traslado operativo ",
      },
      42,
    ),
    {
      numeroCuentaOrigen: "cuenta-origen",
      numeroCuentaDestino: "cuenta-destino",
      monto: 1250.5,
      observaciones: "traslado operativo",
      empleado: 42,
    },
  );
});

test("rechaza cuentas iguales, monto inválido y empleado faltante", () => {
  const basePayload = {
    numeroCuentaOrigen: "cuenta-1",
    numeroCuentaDestino: "cuenta-1",
    monto: 10,
  };

  assert.match(validateInternalTransfer(basePayload, 42), /diferentes/);
  assert.match(
    validateInternalTransfer({ ...basePayload, numeroCuentaDestino: "cuenta-2", monto: 0 }, 42),
    /mayor que cero/,
  );
  assert.match(
    validateInternalTransfer({ ...basePayload, numeroCuentaDestino: "cuenta-2", monto: 10 }, null),
    /identificador de empleado/,
  );
});

test("resuelve únicamente identificadores numéricos positivos", () => {
  assert.equal(resolveEmployeeId({ id: 42 }), 42);
  assert.equal(resolveEmployeeId({ employeeId: 43, id: 42 }), 43);
  assert.equal(resolveEmployeeId({ id: "42" }), 42);
  assert.equal(resolveEmployeeId({ id: 0 }), null);
  assert.equal(resolveEmployeeId({}), null);
});

test("normaliza respuestas con nombres de cuenta del endpoint o del request", () => {
  const fallback = {
    numeroCuentaOrigen: "cuenta-1",
    numeroCuentaDestino: "cuenta-2",
    monto: 10,
    observaciones: "traslado",
  };

  assert.deepEqual(
    normalizeInternalTransfer(
      {
        id: 7,
        cuentaOrigen: "cuenta-1",
        cuentaDestino: "cuenta-2",
        monto: 10,
        notas: "confirmado",
        fecha: "2026-07-21T00:00:00.000Z",
      },
      fallback,
    ),
    {
      id: 7,
      accountOrigin: "cuenta-1",
      accountDestination: "cuenta-2",
      amount: 10,
      date: "2026-07-21T00:00:00.000Z",
      notes: "confirmado",
    },
  );

  assert.equal(
    normalizeInternalTransfer({ numeroCuentaOrigen: "cuenta-3" }, fallback)
      .accountDestination,
    "cuenta-2",
  );
});
