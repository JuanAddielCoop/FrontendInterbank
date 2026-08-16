import assert from "node:assert/strict";
import test from "node:test";

import ocrService from "../src/services/ocr.service.js";

const accounts = [
  { id: 11135, numeroCuenta: "9607299752" },
  { id: 11136, numeroCuenta: "9607299819" },
];

const appEmpresasReceipt = `
App Empresas
Comprobante
¡Transacción completada!
17 de Julio 2026
42745222833
Monto:
DOP 31,500.00
TRANSFERENCIA A EFREN JOSE ROSARIO MARTIN
Tipo de movimiento:
Débito
Origen:
Cuenta corriente - *9752
`;

test("reconoce el monto DOP y la cuenta enmascarada en el bloque Origen", () => {
  const result = ocrService.parseReceiptText(
    appEmpresasReceipt,
    [],
    [],
    accounts,
  );

  assert.equal(result.amount, "31500.00");
  assert.equal(result.amountMatchType, "labeled");
  assert.equal(result.targetAccountSend, "9607299752");
  assert.equal(result.accountMatchType, "lastFour");
  assert.equal(result.accountMatchContext, "origin");
  assert.equal(result.confidence, 75);
  assert.equal(result.isValid, true);
});

test("reconoce montos DOP con y sin separador de miles en App Empresas", async (t) => {
  const receipts = [
    ["DOP 700.00", "700.00"],
    ["DOP 7,300.00", "7300.00"],
  ];

  for (const [amountText, expected] of receipts) {
    await t.test(amountText, () => {
      const result = ocrService.parseReceiptText(
        appEmpresasReceipt.replace("DOP 31,500.00", amountText),
        [],
        [],
        accounts,
      );

      assert.equal(result.amount, expected);
      assert.equal(result.amountMatchType, "labeled");
      assert.equal(result.targetAccountSend, "9607299752");
      assert.equal(result.requiresManualReview, false);
    });
  }
});

test("no sobrevalora una terminación de cuenta fuera del bloque Origen", () => {
  const result = ocrService.parseReceiptText(
    "Monto: DOP 31,500.00\nReferencia 9752",
    [],
    [],
    accounts,
  );

  assert.equal(result.targetAccountSend, "9607299752");
  assert.equal(result.accountMatchContext, "global");
  assert.equal(result.confidence, 60);
});

test("rechaza una terminación de cuenta ambigua", () => {
  const result = ocrService.parseReceiptText(
    appEmpresasReceipt,
    [],
    [],
    [...accounts, { id: 11137, numeroCuenta: "1234569752" }],
  );

  assert.equal(result.targetAccountSend, undefined);
  assert.equal(result.accountError, "AMBIGUOUS_TARGET");
  assert.equal(result.accountMatchType, "ambiguous:lastFour");
});

test("extrae el monto principal de COMPROBANTE y excluye el impuesto DGII", () => {
  const result = ocrService.parseReceiptText(`
Transferir expresos
COMPROBANTE
RD$600.00
Tu transferencia ha sido realizada
Impuesto DGII 0.20%: RD$1.20
Total impuesto
RD$1.20
`);

  assert.equal(result.amount, "600.00");
  assert.equal(result.amountMatchType, "labeled");
  assert.equal(result.amountSelectionReason, "receiptHeader");
  assert.equal(result.requiresManualReview, false);
  assert.equal(result.isValid, true);
});

test("extrae el monto principal de VERIFICACIÓN", () => {
  const result = ocrService.parseReceiptText(`
Transferir expresos
VERIFICACIÓN
RD$500.00
Desde cuenta: Ahorros
`);

  assert.equal(result.amount, "500.00");
  assert.equal(result.amountMatchType, "labeled");
  assert.equal(result.amountSelectionReason, "receiptHeader");
  assert.equal(result.requiresManualReview, false);
});

test("prioriza el monto principal cuando existen varios importes", () => {
  const result = ocrService.parseReceiptText(`
COMPROBANTE RD$1,500.00
Balance disponible RD$25,000.00
Comisión: RD$15.00
ITBIS: RD$2.70
`);

  assert.equal(result.amount, "1500.00");
  assert.equal(result.amountSelectionReason, "receiptHeader");
  assert.equal(result.requiresManualReview, false);
});

test("normaliza variantes habituales del monto y separadores dominicanos", async (t) => {
  const variants = [
    ["COMPROBANTE RD$500.00", "500.00"],
    ["COMPROBANTE RD$ 500.00", "500.00"],
    ["COMPROBANTE RD 500.00", "500.00"],
    ["COMPROBANTE RD$500", "500.00"],
    ["COMPROBANTE 500.00", "500.00"],
    ["MONTO RD$5OO.OO", "500.00"],
    ["TOTAL RD$1,500.00", "1500.00"],
  ];

  for (const [text, expected] of variants) {
    await t.test(text, () => {
      const result = ocrService.parseReceiptText(text);
      assert.equal(result.amount, expected);
      assert.equal(result.requiresManualReview, false);
    });
  }
});

test("marca revisión manual cuando no existe un monto confiable", () => {
  const result = ocrService.parseReceiptText(`
COMPROBANTE DE TRANSFERENCIA
Fecha: 19/07/2026 10:34 p.m.
Referencia: 42745222833
Cuenta: 9607299752
Impuesto DGII 0.20%: RD$1.20
`);

  assert.equal(result.amount, null);
  assert.equal(result.amountError, "AMOUNT_NOT_FOUND");
  assert.equal(result.requiresManualReview, true);
  assert.equal(result.isValid, false);
});

test("usa la zona superior central para resolver importes sin etiquetas", () => {
  const blocks = [
    {
      paragraphs: [
        {
          lines: [
            {
              text: "RD$500.00",
              confidence: 92,
              bbox: { x0: 250, y0: 180, x1: 500, y1: 230 },
            },
            {
              text: "Saldo disponible RD$2,000.00",
              confidence: 94,
              bbox: { x0: 450, y0: 900, x1: 730, y1: 950 },
            },
          ],
        },
      ],
    },
  ];

  const result = ocrService.parseReceiptText(
    "RD$500.00\nSaldo disponible RD$2,000.00",
    [],
    [],
    [],
    "",
    { blocks, imageWidth: 750, imageHeight: 1200 },
  );

  assert.equal(result.amount, "500.00");
  assert.equal(result.amountSelectionReason, "upperCenter");
  assert.equal(result.requiresManualReview, false);
});

test("recupera el monto de App Empresas desde el recorte central", () => {
  const result = ocrService.parseReceiptText(
    appEmpresasReceipt.replace("DOP 31,500.00", ""),
    [],
    [],
    accounts,
    "",
    { focusedAmountText: "Monto:\nDOP 700.00" },
  );

  assert.equal(result.amount, "700.00");
  assert.equal(result.amountSelectionReason, "label");
  assert.equal(result.requiresManualReview, false);
});
