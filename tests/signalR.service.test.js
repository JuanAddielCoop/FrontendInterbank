import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TRANSFER_HUB_EVENTS,
  handleSignalREvent,
} from '../src/services/signalR.service.js'

test('subscribes to the interbank event emitted by the API', () => {
  assert.ok(TRANSFER_HUB_EVENTS.includes('InterbankTransferCreated'))
})

test('subscribes to every BankInbound event emitted by the API', () => {
  assert.ok(TRANSFER_HUB_EVENTS.includes('BankInboundCreated'))
  assert.ok(TRANSFER_HUB_EVENTS.includes('BankInboundSubmitted'))
  assert.ok(TRANSFER_HUB_EVENTS.includes('BankInboundCancelled'))
})

test('InterbankTransferCreated seeds and updates the interbank cache', () => {
  let cache
  const queryClient = {
    setQueryData(_queryKey, updater) {
      cache = updater(cache)
    },
  }

  handleSignalREvent(queryClient, 'InterbankTransferCreated', {
    id: 'transfer-1',
    name: 'Socio Uno',
    amount: 1500,
    total: 1525,
    bankAccountName: 'Banco Uno',
    isSubmit: false,
    isCancelled: false,
  })

  assert.equal(cache.length, 1)
  assert.equal(cache[0].id, 'transfer-1')
  assert.equal(cache[0].amount, 1500)

  handleSignalREvent(queryClient, 'InterbankTransferCreated', {
    id: 'transfer-1',
    name: 'Socio Uno',
    amount: 2000,
    total: 2025,
  })

  assert.equal(cache.length, 1)
  assert.equal(cache[0].amount, 2000)
})

test('BankInbound events update visible records and refresh list metrics', () => {
  let cache = {
    data: [{ id: 'inbound-1', amount: 1500, isConfirm: 'PENDIENTE' }],
    pageNumber: 1,
    pageSize: 10,
  }
  const invalidatedKeys = []
  const queryClient = {
    setQueriesData(_filters, updater) {
      cache = updater(cache)
    },
    invalidateQueries({ queryKey }) {
      invalidatedKeys.push(queryKey)
      return Promise.resolve()
    },
  }

  handleSignalREvent(queryClient, 'BankInboundSubmitted', {
    id: 'inbound-1',
    amount: 1500,
    isConfirm: 'CONFIRMADO',
    updatedBy: 'Admin',
    updatedAt: '2026-08-02T10:00:00Z',
  })

  assert.equal(cache.data[0].isConfirm, 'CONFIRMADO')
  assert.equal(cache.data[0].updatedBy, 'Admin')
  assert.deepEqual(invalidatedKeys, [
    ['bank-inbound'],
    ['bank-inbound-dashboard'],
  ])
})
