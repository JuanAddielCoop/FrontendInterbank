## Context

`useInterbankTransfers` currently requests pages 1 through 100 in a serial loop with a fixed `PageSize` of 200. Its React Query promise resolves only after the loop ends, so a user viewing ten rows waits for the complete history. Filtering, pagination, summary calculation, mutation updates, and SignalR updates all operate on the resulting array.

BankInbound already requests one server page at a time, but its React Query v5 configuration uses the removed `keepPreviousData` option. Page transitions can therefore replace useful content with a loading state, and adjacent pages are not prefetched. Global query defaults keep data indefinitely, so each list must explicitly define freshness appropriate to operational data.

The existing endpoints, parameter names, parameter values, response normalization, and authorization flow are constraints. The final InterBank snapshot must remain complete because filters and summaries are calculated locally and the backend summary endpoint is unavailable.

## Goals / Non-Goals

**Goals:**

- Render a usable InterBank first page immediately after page 1 returns instead of waiting for the complete history.
- Reduce full-history synchronization time through bounded parallel requests without overwhelming the API.
- Keep the final normalized InterBank dataset complete, ordered, deduplicated, and compatible with local filters, summaries, mutations, and SignalR events.
- Make BankInbound page navigation reuse cached content and anticipate the next valid page.
- Preserve all existing HTTP parameter names, values, and endpoint contracts.
- Make loading performance and concurrency behavior testable with deterministic mocked requests.

**Non-Goals:**

- Changing backend endpoints, adding response metadata, changing page sizes, or introducing new query parameters.
- Replacing local InterBank filtering or summary calculation with new backend APIs.
- Virtualizing the rendered lists or redesigning their visual layout.
- Guaranteeing a fixed wall-clock response time independent of network and backend latency.

## Decisions

### Publish InterBank data progressively into the existing array cache

The loader will request page 1 first, normalize it, and publish it to the existing `QUERY_KEYS.interbankTransfers` array cache before starting the remaining work. It will expose separate synchronization metadata from the hook so the dashboard can distinguish initial loading from background synchronization without changing the array shape consumed by filters, mutations, and SignalR.

This is preferred over replacing the cache with an object or `useInfiniteQuery`, both of which would require broader changes to every cache updater. Keeping the array contract minimizes regression risk.

### Fetch remaining pages in ordered, bounded batches

After page 1, the loader will request consecutive page-number batches with a small fixed concurrency limit. A batch is merged in page-number order, normalized, and published once. The first response shorter than `API_PAGE_SIZE` identifies the terminal page; responses beyond it from the same speculative batch are discarded. The existing `MAX_API_PAGES` remains a safety limit.

Bounded batches are preferred over the current serial loop because they reduce aggregate latency, and over unbounded `Promise.all` because history size is unknown and the latter could create 100 simultaneous requests. The exact concurrency constant will be covered by tests and can be tuned without changing the API contract.

### Merge snapshots by stable identity

Each progressive publication will merge records by transfer ID, retain deterministic API page order, and preserve newer records already inserted or updated by mutations and SignalR while synchronization is running. A synchronization generation will prevent a cancelled or superseded load from publishing stale batches.

Replacing the full cache after every batch was rejected because it could erase a real-time event received between requests.

### Separate initial and background states

The dashboard will show its normal skeleton only until the first page is available. Once records exist, it will keep them interactive and show a non-blocking synchronization indication while later pages load. A later-page failure will retain loaded records, mark synchronization as incomplete, and allow manual retry; a page-1 failure will continue to use the existing blocking error state.

This avoids hiding useful data while remaining explicit that local filters and summary totals are provisional until synchronization completes.

### Use React Query v5 page retention and prefetch for BankInbound

BankInbound will use `placeholderData: keepPreviousData` for transitions and explicit finite `staleTime`/`gcTime` values appropriate to operational records. After a successful full page, the page will prefetch the next page using the exact same filter and pagination parameter builder. Existing cache entries and in-flight requests will be deduplicated by the query key.

Prefetching every possible page was rejected because it would recreate the InterBank over-fetching problem and provide little benefit beyond the user's likely next action.

### Measure behavior rather than backend-independent milliseconds

Automated tests will use controlled request delays to assert that InterBank data becomes available after page 1, remaining request concurrency never exceeds its limit, final ordering and completeness are preserved, and BankInbound navigation reuses/prefetches cache entries. A documented before/after measurement against the configured environment will record time to first usable page, full synchronization time, and request count.

A universal millisecond service-level target is not selected because frontend code cannot control backend or network latency.

## Risks / Trade-offs

- [Speculative batches can request a few pages beyond the end] -> Discard pages beyond the first terminal response and cap over-fetching at concurrency minus one requests.
- [Concurrent writes can overwrite SignalR or mutation updates] -> Merge by stable ID and protect publications with a synchronization generation instead of replacing the cache blindly.
- [Filters and summaries are provisional during background loading] -> Display synchronization state and recompute from each published snapshot until complete.
- [Concurrent requests can increase short-term backend load] -> Use a conservative fixed limit, preserve cancellation, and verify the maximum with tests and runtime measurements.
- [Indefinite global cache defaults can serve old records] -> Override freshness and garbage-collection settings for these query keys and keep manual refresh available.
- [The API may not guarantee stable page ordering while records are added] -> Deduplicate by ID, preserve page order, and rely on SignalR/manual refresh for records that move between pages during a synchronization window.

## Migration Plan

1. Add characterization tests for current parameter construction, normalization, filter behavior, cache updates, and pagination.
2. Introduce the progressive InterBank loader and synchronization metadata behind the existing hook interface.
3. Adapt the dashboard's loading/error indication without changing filters or action behavior.
4. Add BankInbound retention, freshness, and adjacent-page prefetching.
5. Compare development/staging measurements before and after, then deploy through the normal frontend release process.
6. Roll back by restoring the serial InterBank loader and removing BankInbound prefetch configuration; no data or API migration is required.

## Open Questions

- Confirm during implementation whether the backend guarantees a stable default ordering for `/InterBank/Transactions`; if not, preserve current observed order and document the limitation rather than adding a parameter.
- Tune the initial concurrency limit using staging measurements, starting conservatively and retaining the tested upper bound.
