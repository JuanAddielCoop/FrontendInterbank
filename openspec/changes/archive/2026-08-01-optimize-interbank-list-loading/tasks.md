## 1. Baseline and Characterization

- [x] 1.1 Add `node:test` characterization coverage for existing InterBank and BankInbound parameter construction, response normalization, ordering, filters, and page-size behavior.
- [x] 1.2 Add a repeatable measurement script or documented procedure that records time to first usable page, full synchronization time, and request count against a configured environment, then capture the pre-change baseline.

## 2. Progressive InterBank Loader

- [x] 2.1 Extract a testable InterBank page request primitive that preserves `/InterBank/Transactions`, `buildInterbankParams(DEFAULT_FILTERS, pageNumber, API_PAGE_SIZE)`, authorization, and abort signals.
- [x] 2.2 Implement page-1-first publication followed by ordered batches with a conservative fixed concurrency limit, terminal-page detection, and the existing maximum-page guard.
- [x] 2.3 Implement ID-based deterministic snapshot merging that deduplicates API pages and preserves newer mutation or SignalR records.
- [x] 2.4 Add synchronization generation and abort checks so cancelled or superseded loads cannot publish stale batches or start additional work.
- [x] 2.5 Expose initial, background, complete, and incomplete synchronization states from `useInterbankTransfers` while preserving its array data contract and local filtering behavior.

## 3. InterBank User Experience and Cache Integration

- [x] 3.1 Update `InterbankDashboard` to stop blocking after page 1, display a non-blocking background synchronization state, and retain partial records after a later-page failure.
- [x] 3.2 Update InterBank mutation and SignalR cache helpers as needed to remain compatible with progressive page merges and verify that concurrent inserts and updates are not lost.
- [x] 3.3 Verify final local pagination, quick/advanced filters, role restrictions, summary totals, confirm/cancel actions, and manual refresh behavior against a complete synchronized snapshot.

## 4. BankInbound Cache and Prefetch

- [x] 4.1 Replace the ineffective React Query v5 `keepPreviousData` option with `placeholderData: keepPreviousData` and add explicit finite freshness and garbage-collection settings for BankInbound pages.
- [x] 4.2 Prefetch the next eligible BankInbound page after a full successful page while reusing the existing query key, active filters, `PageNumber`, and `PageSize` contract.
- [x] 4.3 Update BankInbound loading presentation to retain current rows during transitions and distinguish initial pending state from a background page fetch.

## 5. Automated Verification

- [x] 5.1 Add controlled-delay tests proving InterBank page 1 is published before history completion and request concurrency never exceeds the configured limit.
- [x] 5.2 Add tests for terminal-page handling, safety-limit handling, deterministic ordering, duplicate IDs, partial failures, retries, cancellation, and stale-generation suppression.
- [x] 5.3 Add tests proving SignalR/mutation updates survive background merges and final filters, pagination, and summary values remain correct.
- [x] 5.4 Add BankInbound tests for retained page data, adjacent-page prefetch, query deduplication, cancellation, and unchanged request parameters.

## 6. Performance and Release Validation

- [x] 6.1 Run the complete automated test suite and production build, resolving regressions without weakening the performance requirements.
- [x] 6.2 Repeat the baseline measurement in the same environment and record the before/after initial availability, full synchronization, request count, and selected concurrency limit.
- [ ] 6.3 Manually verify both list flows on desktop and mobile, including slow-network loading, background failure/retry, filters, pagination, actions, and real-time updates.
