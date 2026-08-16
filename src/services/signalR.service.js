import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import QUERY_KEYS from '../modules/shared/queryKeys.js'
import {
  BANK_INBOUND_DASHBOARD_KEY,
  BANK_INBOUND_KEY,
} from '../modules/bankInbound/bankInboundQuery.js'
import { normalizeInterbankTransfers } from '../utils/interbank.js'
import { formatCurrency } from '../utils/transactions.js'

let connection = null
let cachedToken = ''
let cachedHubUrl = ''
let startingPromise = null

export const TRANSFER_HUB_EVENTS = Object.freeze([
  'InterbankTransferCreated',
  'BankInboundCreated',
  'BankInboundSubmitted',
  'BankInboundCancelled',
  'NewTransfer',
  'TransferNotification',
  'NotificationCreated',
  'TransferCreated',
  'ReceiveTransferNotification',
  'IncomingTransaction',
  'OutgoingTransaction',
  'Deposit',
  'Withdrawal',
  'Reversal',
])

const setQueryArray = (queryClient, queryKey, updater) =>
  queryClient.setQueriesData({ queryKey, exact: false }, (prev = []) => {
    const base = Array.isArray(prev) ? prev : []
    return updater(base)
  })

const upsertTransaction = (queryClient, transaction) => {
  setQueryArray(queryClient, QUERY_KEYS.transactions, (prev) => {
    const exists = prev.some((item) => item.id === transaction.id)
    if (exists) {
      return prev.map((item) => (item.id === transaction.id ? { ...item, ...transaction } : item))
    }
    return [transaction, ...prev]
  })
}

const adjustAccountBalance = (queryClient, accountId, delta) => {
  if (!accountId || !Number.isFinite(delta)) return
  setQueryArray(queryClient, QUERY_KEYS.accounts, (prev) =>
    prev.map((account) =>
      account.id === accountId || account.accountNumber === accountId
        ? { ...account, balance: Number(account.balance ?? 0) + delta }
        : account,
    ),
  )
}

const upsertInterbankTransfer = (queryClient, payload) => {
  const [normalized] = normalizeInterbankTransfers([payload])
  if (!normalized) return
  queryClient.setQueryData(QUERY_KEYS.interbankTransfers, (prev = []) => {
    const base = Array.isArray(prev) ? prev : []
    const exists = base.some((transfer) => transfer.id === normalized.id)
    if (exists) {
      return base.map((transfer) =>
        transfer.id === normalized.id ? { ...transfer, ...normalized } : transfer,
      )
    }
    return [normalized, ...base]
  })
}

const refreshBankInbound = (queryClient, payload) => {
  queryClient.setQueriesData({ queryKey: BANK_INBOUND_KEY, exact: false }, (previous) => {
    if (!previous || !Array.isArray(previous.data)) return previous
    const exists = previous.data.some((record) => record.id === payload?.id)
    if (!exists) return previous

    return {
      ...previous,
      data: previous.data.map((record) =>
        record.id === payload.id ? { ...record, ...payload } : record,
      ),
    }
  })

  void queryClient.invalidateQueries({ queryKey: BANK_INBOUND_KEY })
  void queryClient.invalidateQueries({ queryKey: BANK_INBOUND_DASHBOARD_KEY })
}

const applyAccountingEffect = (queryClient, eventName, payload) => {
  const amount =
    typeof payload?.amount === 'number'
      ? payload.amount
      : typeof payload?.total === 'number'
        ? payload.total
        : 0
  const transaction = {
    id: payload?.id ?? payload?.transactionId ?? payload?.codigo ?? payload?.reference,
    type: payload?.type ?? eventName,
    amount,
    accountId: payload?.accountId ?? payload?.originAccountId ?? payload?.destinationAccountId,
    direction: payload?.direction ?? 'unknown',
    createdAt: payload?.createdAt ?? payload?.timestamp ?? new Date().toISOString(),
    raw: payload,
  }
  upsertTransaction(queryClient, transaction)

  if (eventName === 'Deposit' || payload?.direction === 'deposit') {
    adjustAccountBalance(queryClient, payload?.accountId ?? payload?.destinationAccountId, amount)
    return
  }

  if (eventName === 'Withdrawal' || payload?.direction === 'withdrawal') {
    adjustAccountBalance(queryClient, payload?.accountId ?? payload?.originAccountId, -amount)
    return
  }

  const isIncoming =
    eventName === 'IncomingTransaction' || payload?.direction === 'incoming' || payload?.isIncoming
  const isOutgoing =
    eventName === 'OutgoingTransaction' || payload?.direction === 'outgoing' || payload?.isOutgoing

  if (isIncoming) {
    adjustAccountBalance(queryClient, payload?.destinationAccountId ?? payload?.accountId, amount)
    return
  }

  if (isOutgoing) {
    adjustAccountBalance(queryClient, payload?.originAccountId ?? payload?.accountId, -amount)
  }
}

export const handleSignalREvent = (queryClient, eventName, payload) => {
  if (eventName.toLowerCase().includes('transfer')) {
    upsertInterbankTransfer(queryClient, payload)
  }

  if (eventName.startsWith('BankInbound')) {
    refreshBankInbound(queryClient, payload)
  }

  if (
    ['IncomingTransaction', 'OutgoingTransaction', 'Deposit', 'Withdrawal', 'Reversal'].includes(
      eventName,
    )
  ) {
    applyAccountingEffect(queryClient, eventName, payload)
  }

  if (eventName === 'Reversal' && payload?.originalTransactionId) {
    setQueryArray(queryClient, QUERY_KEYS.transactions, (prev) =>
      prev.map((entry) =>
        entry.id === payload.originalTransactionId
          ? { ...entry, reversed: true, reversedAt: new Date().toISOString() }
          : entry,
      ),
    )
  }
}

const buildNotification = (eventName, payload) => {
  const amount =
    typeof payload?.amount === 'number'
      ? payload.amount
      : typeof payload?.total === 'number'
        ? payload.total
        : undefined

  const transferId =
    payload?.transferId ??
    payload?.transferID ??
    payload?.transactionId ??
    payload?.transactionID ??
    payload?.id ??
    payload?.codigo ??
    payload?.reference ??
    null

  const isTransferEvent =
    (eventName || '').toLowerCase().includes('transfer') ||
    Boolean(transferId) ||
    payload?.tipoTransferencia ||
    payload?.transferetionTypeName

  return {
    title: payload?.title ?? payload?.subject ?? eventName,
    message:
      payload?.message ??
      payload?.description ??
      (amount !== undefined ? `Actualizacion por ${formatCurrency(amount)}.` : 'Nuevo evento.'),
    meta: {
      transferId,
      type: payload?.direction ?? payload?.type ?? (isTransferEvent ? 'interbank-transfer' : eventName),
      eventName,
    },
    timestamp: payload?.timestamp ?? payload?.createdAt ?? Date.now(),
  }
}

export const startSignalR = async ({ hubUrl, token, queryClient, onEvent, onNotification, onStatusChange }) => {
  if (!hubUrl || !token) return null
  if (startingPromise && connection && cachedToken === token && cachedHubUrl === hubUrl) {
    return startingPromise
  }
  if (connection && cachedToken === token && cachedHubUrl === hubUrl) return connection
  if (connection) await stopSignalR()

  cachedToken = token
  cachedHubUrl = hubUrl
  const currentConnection = new HubConnectionBuilder()
    .withUrl(hubUrl, {
      accessTokenFactory: () => token,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Error)
    .build()
  connection = currentConnection

  const publishStatus = (status) => {
    if (onStatusChange) onStatusChange(status)
  }

  const onPayload = (eventName, payload) => {
    handleSignalREvent(queryClient, eventName, payload)
    if (onNotification) {
      onNotification(buildNotification(eventName, payload))
    }
    if (onEvent) onEvent({ eventName, payload })
  }

  TRANSFER_HUB_EVENTS.forEach((eventName) => {
    currentConnection.on(eventName, (payload) => onPayload(eventName, payload))
  })

  currentConnection.onreconnecting(() => publishStatus('reconnecting'))
  currentConnection.onreconnected(() => publishStatus('connected'))
  currentConnection.onclose(() => publishStatus('disconnected'))

  const startConnection = async () => {
    publishStatus('connecting')
    const retryDelays = [0, 2000, 5000, 10000]

    for (const delay of retryDelays) {
      if (connection !== currentConnection) return null
      if (delay > 0) {
        publishStatus('reconnecting')
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
      if (connection !== currentConnection) return null

      try {
        await currentConnection.start()
        publishStatus('connected')
        return currentConnection
      } catch (err) {
        console.error('SignalR connection error', err)
      }
    }

    if (connection === currentConnection) {
      connection = null
      cachedToken = ''
      cachedHubUrl = ''
      publishStatus('error')
    }
    return null
  }

  const currentStart = startConnection()
  startingPromise = currentStart
  try {
    return await currentStart
  } finally {
    if (startingPromise === currentStart) startingPromise = null
  }
}

export const stopSignalR = async () => {
  const currentConnection = connection
  connection = null
  cachedToken = ''
  cachedHubUrl = ''
  startingPromise = null

  if (currentConnection) {
    try {
      await currentConnection.stop()
    } catch {
      /* ignore stop errors */
    }
  }
}
