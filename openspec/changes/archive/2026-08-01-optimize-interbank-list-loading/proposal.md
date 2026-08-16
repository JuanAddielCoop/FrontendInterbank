## Why

The InterBank screen waits for a sequential download of up to 100 API pages before showing any transfer, while BankInbound does not fully benefit from React Query v5 page retention and prefetching. Users need both lists to become usable after the first relevant response without changing the existing API parameters or losing the complete dataset, filters, summaries, or real-time updates.

## What Changes

- Make the first InterBank page available as soon as its request completes, then load the remaining pages in the background with bounded concurrency and deterministic ordering.
- Preserve the current InterBank request parameter names, values, endpoint contract, complete-dataset behavior, local filters, summary calculations, and SignalR cache updates.
- Retain the visible BankInbound page while another page loads and prefetch an eligible adjacent page using the same endpoint and parameters.
- Define consistent cache freshness, request cancellation, deduplication, loading, background-sync, and error behavior for both lists.
- Add repeatable tests and performance measurements that compare request count and time to first usable page against the current implementation.

## Capabilities

### New Capabilities
- `interbank-list-performance`: Progressive, cached, cancellable, and measurable loading behavior for the BankInbound and InterBank lists while preserving their API contracts and final data accuracy.

### Modified Capabilities

None.

## Impact

- Affected frontend areas include the BankInbound service/query/page and the InterBank query, dashboard, pagination, summary, and real-time cache integration.
- Existing `/BankInbound` and `/InterBank/Transactions` endpoints and query parameter contracts remain unchanged.
- TanStack React Query remains the cache and request lifecycle mechanism; no new runtime dependency is expected.
- Backend performance remains an external factor, so acceptance measurements distinguish frontend time to first usable page from full background synchronization time.
