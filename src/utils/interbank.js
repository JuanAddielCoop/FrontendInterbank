import { formatCurrency } from "./transactions.js";

const findImageValue = (obj) => {
  if (!obj || typeof obj !== "object") return undefined;
  for (const value of Object.values(obj)) {
    if (typeof value !== "string") continue;
    const v = value.trim();
    if (!v || v.length < 50) continue;
    if (v.startsWith("data:image/")) return v;
    if (/^[A-Za-z0-9+/=]+$/.test(v) && v.length > 100) return v;
  }
  return undefined;
};

export const INTERBANK_FALLBACK = [
  {
    id: "c8a01ad5-7bbf-4c48-9b1b-1760a2300001",
    name: "Maria Fernanda",
    description: "Pago proveedores internacionales",
    bankAccountName: "Banco Popular",
    transferetionTypeName: "Transferencia Interbancaria",
    amount: 12500,
    total: 12575,
    noAccountBank: "40300123456",
    noAccountCoop: "1760382856",
    noAccountCoopAdmin: "CAJ-CORP-001",
    identification: "40200358716",
    nameAccountBank: "Servicios del Caribe SRL",
    isSubmit: false,
    userAdminId: 0,
    isPriority: true,
    socioId: 7123,
    isCancelled: false,
    createdBy: "sistema",
    createdAt: "2025-11-08T14:05:12.000Z",
    updatedBy: null,
    updatedAt: null,
  },
  {
    id: "91e820d4-9050-4c9c-82f8-1760a2300002",
    name: "Jose Garcia",
    description: "Liquidación mensual",
    bankAccountName: "Banreservas",
    transferetionTypeName: "Transferencia Interbancaria",
    amount: 8300,
    total: 8310,
    noAccountBank: "20001000222",
    noAccountCoop: "1760382856",
    noAccountCoopAdmin: "CAJ-CORP-002",
    identification: "00115789634",
    nameAccountBank: "Consulting Group",
    isSubmit: true,
    userAdminId: 102,
    isPriority: false,
    socioId: 8911,
    isCancelled: false,
    createdBy: "analista01",
    createdAt: "2025-11-07T11:40:00.000Z",
    updatedBy: "admin02",
    updatedAt: "2025-11-07T12:05:00.000Z",
  },
  {
    id: "7f42cc21-4473-42f0-b22c-1760a2300003",
    name: "Lucia Mendez",
    description: "Adelanto nómina",
    bankAccountName: "BHD",
    transferetionTypeName: "Transferencia Interbancaria",
    amount: 5600,
    total: 5605,
    noAccountBank: "18000004567",
    noAccountCoop: "1760382856",
    noAccountCoopAdmin: "CAJ-CORP-003",
    identification: "40211883459",
    nameAccountBank: "Innovatech",
    isSubmit: false,
    userAdminId: null,
    isPriority: false,
    socioId: 6654,
    isCancelled: true,
    createdBy: "sistema",
    createdAt: "2025-11-06T08:10:00.000Z",
    updatedBy: "admin04",
    updatedAt: "2025-11-06T09:45:00.000Z",
  },
];

const pickValue = (...candidates) =>
  candidates.find(
    (value) => value !== undefined && value !== null && value !== "",
  );

export const normalizeInterbankTransfers = (transfers = []) =>
  transfers.map((transfer, index) => {
    const target = transfer?.transfer ?? transfer?.data ?? transfer;
    const amountValue = Number(
      pickValue(target.amount, target.monto, target.total),
    );
    const totalValue = Number(
      pickValue(target.total, target.montoTotal, target.amount, amountValue),
    );
    const bankAccountNumber = pickValue(
      target.noAccountBank,
      target.accountNumber,
      target.account,
      target.cuenta,
      target.cuentaBancaria,
      target.numeroCuenta,
      target.noCuentaBanco,
    );
    const coopAccountNumber = pickValue(
      target.noAccountCoop,
      target.cuentaCoop,
      target.cuentaCooperativa,
      target.numeroCuentaCoop,
      target.cuentaDestino,
    );
    const coopAdminAccount = pickValue(
      target.noAccountCoopAdmin,
      target.cuentaAdmin,
      target.accountAdmin,
      target.cuentaAdministradora,
    );
    const beneficiary = pickValue(
      target.beneficiary,
      target.beneficiario,
      target.destinatario,
      target.nameAccountBank,
      target.bankAccountName,
      target.nombreDestino,
      target.titular,
    );
    const bankAccountName = pickValue(
      target.bankAccountName,
      target.nameAccountBank,
      target.bankName,
      target.banco,
      target.entidad,
    );
    const accountType = pickValue(
      target.accountType,
      target.tipoCuenta,
      target.account_type,
      target.typeAccount,
    );
    const identification = pickValue(
      target.identification,
      target.cedula,
      target.document,
      target.documento,
      target.doc,
    );
    const invoiceImagePath =
      pickValue(
        target.imageUrl,
        target.invoiceUrl,
        target.facturaUrl,
        target.invoiceImage,
        target.facturaImagen,
        target.pathImage,
        target.imagePath,
        target.comprobantePath,
        target.vaucher,
        target.voucher,
        target.comprobante,
        target.imagen,
        target.base64Image,
        target.rawImage,
        target.foto,
        target.evidencia,
        target.img,
        target.data,
      ) ?? findImageValue(target);

    return {
      id: pickValue(
        target.id,
        target.transactionId,
        target.codigo,
        target.reference,
        `transfer-${index}`,
      ),
      name: pickValue(
        target.name,
        beneficiary,
        bankAccountName,
        "Transferencia",
      ),
      description: pickValue(
        target.description,
        target.detalle,
        target.descripcion,
        "Sin descripcion",
      ),
      bankAccountName: bankAccountName ?? "N/A",
      transferType: pickValue(
        target.transferetionTypeName,
        target.tipo,
        target.tipoTransferencia,
        "Interbancaria",
      ),
      amount: Number.isFinite(amountValue) ? amountValue : 0,
      total: Number.isFinite(totalValue)
        ? totalValue
        : Number.isFinite(amountValue)
          ? amountValue
          : 0,
      bankAccount: bankAccountNumber ?? "",
      coopAccount: coopAccountNumber ?? "",
      coopAdminAccount: coopAdminAccount ?? "",
      accountNumber: bankAccountNumber ?? "",
      nameAccountBank: beneficiary ?? "",
      accountType: accountType ?? "",
      receiptImage:
        target.receiptImage ||
        target.imageBase64 ||
        target.base64Url ||
        target.comprobante ||
        target.imagen ||
        target.base64Image ||
        target.rawImage ||
        target.foto ||
        target.evidencia ||
        target.img ||
        target.data ||
        findImageValue(target) ||
        "",
      imageUrl: invoiceImagePath ?? "",
      identification: identification ?? "",
      bankAccountHolder: beneficiary ?? bankAccountName ?? "",
      isSubmit: Boolean(target.isSubmit ?? target.approved),
      isPriority: Boolean(target.isPriority ?? target.priority),
      isCancelled: Boolean(target.isCancelled ?? target.cancelled),
      isPending:
        !(target.isCancelled ?? target.cancelled) &&
        !(target.isSubmit ?? target.approved),
      userAdminId: target.userAdminId ?? target.userId ?? "",
      socioId: pickValue(
        target.socioId,
        target.socio,
        target.memberId,
        target.member,
      ),
      createdBy: pickValue(
        target.createdBy,
        target.usuario,
        target.user,
        target.creator,
        "",
      ),
      updatedBy: target.updatedBy ?? "",
      createdAt: pickValue(
        target.createdAt,
        target.timestamp,
        target.fechaCreacion,
        target.fecha,
        null,
      ),
      updatedAt: pickValue(target.updatedAt, target.fechaActualizacion, null),
      raw: target,
    };
  });

const toHeaderBoolean = (value) => {
  if (value === "" || value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const setParamValue = (params, key, value) => {
  if (value === undefined || value === null || value === "") return;
  params[key] = value;
};

export const buildInterbankParams = (filters, pageNumber, pageSize) => {
  const params = {};

  setParamValue(params, "Name", filters.name);
  setParamValue(params, "SocioId", filters.socioId);
  setParamValue(params, "Identification", filters.identification);
  setParamValue(params, "NoAccountBank", filters.noAccountBank);
  setParamValue(params, "NoAccountCoop", filters.noAccountCoop);
  setParamValue(params, "UpdatedBy", filters.updatedBy);

  const submit = toHeaderBoolean(filters.isSubmit);
  if (submit !== undefined) setParamValue(params, "IsSubmit", submit);

  const priority = toHeaderBoolean(filters.isPriority);
  if (priority !== undefined) setParamValue(params, "IsPriority", priority);

  const cancelled = toHeaderBoolean(filters.isCancelled);
  if (cancelled !== undefined) setParamValue(params, "IsCancelled", cancelled);

  if (filters.createdAt) {
    setParamValue(
      params,
      "CreatedAt",
      new Date(filters.createdAt).toISOString(),
    );
  }
  if (filters.updatedAt) {
    setParamValue(
      params,
      "UpdatedAt",
      new Date(filters.updatedAt).toISOString(),
    );
  }

  setParamValue(params, "PageNumber", pageNumber);
  setParamValue(params, "PageSize", pageSize);

  return params;
};

export const buildInterbankStats = (transfers = []) =>
  transfers.reduce(
    (acc, transfer) => {
      acc.total += 1;
      if (transfer.isPriority) acc.priority += 1;
      if (transfer.isCancelled) {
        acc.cancelled += 1;
      } else {
        const value = Number.isFinite(transfer.total)
          ? transfer.total
          : transfer.amount;
        acc.totalAmount += value ?? 0;
        if (transfer.isSubmit) acc.approved += 1;
        else acc.pending += 1;
      }
      return acc;
    },
    {
      total: 0,
      pending: 0,
      approved: 0,
      cancelled: 0,
      priority: 0,
      totalAmount: 0,
    },
  );

export const formatInterbankStats = (stats) => [
  { label: "Totales", value: stats.total },
  { label: "Pendientes", value: stats.pending },
  { label: "Aprobadas", value: stats.approved },
  { label: "Canceladas", value: stats.cancelled },
  { label: "Prioridad", value: stats.priority },
  { label: "Monto", value: formatCurrency(stats.totalAmount) },
];
