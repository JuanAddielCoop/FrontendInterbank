import { Landmark, PiggyBank, Wallet } from 'lucide-react'

const currencyFormatter = new Intl.NumberFormat('es-DO', {
  style: 'currency',
  currency: 'DOP',
})

export const formatCurrency = (value = 0) => currencyFormatter.format(value)

export const formatDate = (value) => {
  if (!value) return 'Fecha no disponible'

  return new Date(value).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const formatTime = (value) => {
  if (!value) return '--:--'

  return new Date(value).toLocaleTimeString('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export const FALLBACK_TRANSACTIONS = [
  {
    id: 'TRX-1760-001',
    tipoTransaccion: 5,
    cuentaOrigen: 'CAJ-CORP-001',
    cuentaDestino: '1760382856',
    monto: 7000,
    fecha: '2025-10-15T11:36:39.367Z',
    estado: 'Completado',
    notas: 'Deposito de ahorro - Tipo: Normal',
  },
  {
    id: 'TRX-1760-002',
    tipoTransaccion: 5,
    cuentaOrigen: '1760382856',
    cuentaDestino: '1756078321',
    monto: 4500,
    fecha: '2025-10-10T09:12:00Z',
    estado: 'Completado',
    notas: 'Transferencia corporativa',
  },
  {
    id: 'TRX-9081',
    type: 'transfer',
    description: 'Pago nomina regional',
    counterpartyName: 'Servicios del Caribe',
    amount: -12500,
    status: 'completed',
    accountNumber: '2450-001234-5',
    timestamp: '2025-11-08T15:40:00Z',
  },
  {
    id: 'TRX-9082',
    type: 'deposit',
    description: 'Deposito Agencia Piantini',
    counterpartyName: 'Caja principal',
    amount: 32000,
    status: 'completed',
    accountNumber: '2450-001234-5',
    timestamp: '2025-11-07T10:15:00Z',
  },
  {
    id: 'TRX-9083',
    type: 'withdrawal',
    description: 'Retiro cajero corporativo',
    counterpartyName: 'ATM 24h',
    amount: -2500,
    status: 'completed',
    accountNumber: '2450-001998-3',
    timestamp: '2025-11-06T09:05:00Z',
  },
  {
    id: 'TRX-9084',
    type: 'transfer',
    description: 'Pago proveedores internacionales',
    counterpartyName: 'Global Imports',
    amount: -5800,
    status: 'processing',
    accountNumber: '2450-001998-3',
    timestamp: '2025-11-05T13:20:00Z',
  },
]

const TYPE_MAP = {
  1: 'deposit',
  2: 'withdrawal',
  3: 'payment',
  4: 'transfer',
  5: 'transfer',
}

const resolveType = (transaction) => {
  const rawType =
    Number(transaction.tipoTransaccion ?? transaction.tipo ?? transaction.transactionType) ??
    null

  if (!Number.isNaN(rawType) && TYPE_MAP[rawType]) {
    return TYPE_MAP[rawType]
  }

  return String(transaction.type ?? transaction.category ?? 'transfer').toLowerCase()
}

const determineDirection = (transaction, focusAccount, amount) => {
  if (focusAccount) {
    if (String(transaction.cuentaDestino) === focusAccount) return 'in'
    if (String(transaction.cuentaOrigen) === focusAccount) return 'out'
  }

  if (transaction.direction) return transaction.direction
  if (transaction.isSender === true) return 'out'
  if (transaction.isSender === false) return 'in'

  return amount >= 0 ? 'in' : 'out'
}

const resolveAccountNumber = (transaction, focusAccount) =>
  String(
    transaction.accountNumber ??
      transaction.account ??
      transaction.numeroCuenta ??
      transaction.cuentaDestino ??
      transaction.cuentaOrigen ??
      focusAccount ??
      '0000000000',
  )

const resolveCounterparty = (transaction, direction) => {
  if (transaction.counterpartyName) return transaction.counterpartyName
  if (transaction.accountName) return transaction.accountName

  if (direction === 'in') {
    return transaction.cuentaOrigen ?? 'Cuenta origen no disponible'
  }

  return transaction.cuentaDestino ?? 'Cuenta destino no disponible'
}

export const normalizeTransactions = (transactions = [], focusAccount) =>
  transactions.map((transaction, index) => {
    const rawAmount =
      Number(
        transaction.monto ??
          transaction.amount ??
          transaction.displayAmount ??
          transaction.transferData?.monto ??
          transaction.value ??
          0,
      ) || 0

    const direction = determineDirection(transaction, focusAccount, rawAmount)
    const signedAmount = direction === 'out' ? -Math.abs(rawAmount) : Math.abs(rawAmount)

    return {
      id: String(transaction.id ?? transaction.reference ?? `trx-${index}`),
      amount: Math.abs(rawAmount),
      displayAmount: signedAmount,
      direction,
      description:
        transaction.notas ??
        transaction.descripcion ??
        transaction.description ??
        transaction.title ??
        transaction.transferData?.observaciones ??
        'Transaccion',
      counterpartyName: resolveCounterparty(transaction, direction),
      type: resolveType(transaction),
      status: String(transaction.estado ?? transaction.status ?? 'completed').toLowerCase(),
      accountNumber: resolveAccountNumber(transaction, focusAccount),
      timestamp:
        transaction.fecha ??
        transaction.timestamp ??
        transaction.date ??
        transaction.rawDate ??
        new Date().toISOString(),
      raw: transaction,
    }
  })

const iconMap = {
  deposit: { Icon: PiggyBank, badgeClass: 'bg-emerald-500/10 text-emerald-300' },
  withdrawal: { Icon: Wallet, badgeClass: 'bg-rose-500/10 text-rose-300' },
  transfer: { Icon: Landmark, badgeClass: 'bg-sky-500/10 text-sky-300' },
}

export const getTransactionAppearance = (type = 'transfer', direction = 'in') => {
  const key = iconMap[type] ? type : 'transfer'
  const { Icon, badgeClass } = iconMap[key]
  const amountClass = direction === 'in' ? 'text-green-400' : 'text-red-400'
  const sign = direction === 'in' ? '+' : '-'

  return {
    Icon,
    badgeClass,
    amountClass,
    sign,
  }
}

const isWithinRange = (timestamp, range = 'all') => {
  if (range === 'all') return true

  const compareDate = new Date(timestamp).getTime()
  const now = Date.now()

  const ranges = {
    today: 1,
    '7d': 7,
    '30d': 30,
  }

  const days = ranges[range]
  if (!days) return true

  const diff = now - days * 24 * 60 * 60 * 1000
  return compareDate >= diff
}

export const filterTransactions = (transactions, filters) =>
  transactions.filter((transaction) => {
    const search = filters.search?.toLowerCase() ?? ''
    const matchesSearch =
      !search ||
      transaction.description.toLowerCase().includes(search) ||
      transaction.counterpartyName.toLowerCase().includes(search) ||
      transaction.id.toLowerCase().includes(search)

    const matchesType =
      (filters.type ?? 'all') === 'all' || transaction.type === filters.type

    const accountFilter = filters.account ?? 'all'
    const matchesAccount =
      accountFilter === 'all' || transaction.accountNumber === accountFilter

    const matchesDate = isWithinRange(transaction.timestamp, filters.dateRange ?? 'all')

    const minAmount = Number(filters.minAmount) || null
    const maxAmount = Number(filters.maxAmount) || null
    const absoluteAmount = transaction.amount

    const matchesMin = minAmount === null || absoluteAmount >= minAmount
    const matchesMax = maxAmount === null || absoluteAmount <= maxAmount

    return (
      matchesSearch &&
      matchesType &&
      matchesAccount &&
      matchesDate &&
      matchesMin &&
      matchesMax
    )
  })

export const sortTransactions = (transactions, sortBy, sortOrder) => {
  const sorted = [...transactions]

  sorted.sort((a, b) => {
    if (sortBy === 'amount') {
      return sortOrder === 'asc'
        ? a.displayAmount - b.displayAmount
        : b.displayAmount - a.displayAmount
    }

    if (sortBy === 'description') {
      return sortOrder === 'asc'
        ? a.description.localeCompare(b.description)
        : b.description.localeCompare(a.description)
    }

    return sortOrder === 'asc'
      ? new Date(a.timestamp) - new Date(b.timestamp)
      : new Date(b.timestamp) - new Date(a.timestamp)
  })

  return sorted
}

export const buildTransactionStats = (transactions) => {
  const totals = transactions.reduce(
    (acc, transaction) => {
      if (transaction.direction === 'in') {
        acc.incoming += transaction.amount
      } else {
        acc.outgoing += transaction.amount
      }
      return acc
    },
    { incoming: 0, outgoing: 0 },
  )

  return {
    total: transactions.length,
    incoming: totals.incoming,
    outgoing: totals.outgoing,
  }
}
