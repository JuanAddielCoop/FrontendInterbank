# Spec: interbank-list-performance

## Purpose

Define responsive, resilient, and verifiable loading behavior for InterBank and BankInbound transaction lists while preserving existing request contracts.

## Requirements

### Requirement: Progressive InterBank availability
The system SHALL make normalized records from the first `/InterBank/Transactions` page available to the list as soon as that page succeeds, without waiting for remaining history pages.

#### Scenario: First page succeeds before history synchronization
- **WHEN** InterBank page 1 returns while later pages have not completed
- **THEN** the system displays the available page-1 transfers and marks remaining history synchronization as non-blocking background work

#### Scenario: First page fails
- **WHEN** the initial InterBank page request fails and no cached records are available
- **THEN** the system displays the existing list error state and offers manual retry

### Requirement: Complete bounded InterBank synchronization
The system SHALL load the remaining InterBank pages with a fixed concurrency bound, stop at the first page containing fewer records than the unchanged API page size or at the existing safety limit, and produce the same complete normalized record set as a successful serial load.

#### Scenario: Multiple history pages exist
- **WHEN** the InterBank endpoint returns multiple full pages followed by a partial page
- **THEN** the system fetches remaining pages without exceeding the configured concurrency limit and publishes all records in deterministic page order

#### Scenario: Speculative requests pass the terminal page
- **WHEN** requests in the same bounded batch include page numbers after the first partial page
- **THEN** the system excludes those later page responses from the completed snapshot

#### Scenario: Safety limit is reached
- **WHEN** every requested page through the existing maximum page limit is full
- **THEN** the system stops issuing requests at that limit and reports synchronization as incomplete rather than starting an unbounded load

### Requirement: Existing request contract preservation
The system MUST preserve the existing BankInbound and InterBank endpoint paths, authorization behavior, query parameter names, and parameter values during the optimization.

#### Scenario: Optimized InterBank request is issued
- **WHEN** the optimized loader requests any InterBank page
- **THEN** it sends the same parameters produced by `buildInterbankParams(DEFAULT_FILTERS, pageNumber, API_PAGE_SIZE)` for that page

#### Scenario: Optimized BankInbound request is issued
- **WHEN** BankInbound loads or prefetches a page
- **THEN** it sends the same active filters, `PageNumber`, and `PageSize` values used before the optimization

### Requirement: Safe cancellation and cache merging
The system SHALL prevent cancelled or superseded list loads from publishing stale data and SHALL preserve newer mutation or SignalR updates when background pages are merged.

#### Scenario: InterBank refresh supersedes background synchronization
- **WHEN** a manual refresh starts before an earlier background synchronization completes
- **THEN** responses from the earlier synchronization do not replace data published by the newer refresh

#### Scenario: Real-time transfer arrives during synchronization
- **WHEN** SignalR inserts or updates a transfer while background pages are loading
- **THEN** subsequent page merges retain the newer real-time record and avoid duplicate IDs

#### Scenario: Component stops consuming a request
- **WHEN** React Query aborts an in-flight BankInbound or InterBank request
- **THEN** the loader stops eligible remaining work and does not publish the aborted response

### Requirement: Resilient partial InterBank results
The system SHALL retain usable InterBank records when a request after page 1 fails and SHALL indicate that the full snapshot is incomplete.

#### Scenario: Background page fails
- **WHEN** page 1 has been displayed and a later InterBank page request fails
- **THEN** the displayed records remain available, synchronization is marked incomplete, and the user can retry manually

#### Scenario: Background synchronization completes
- **WHEN** all InterBank pages through the terminal page complete successfully
- **THEN** filters, pagination, and summary metrics operate on the complete normalized dataset and the background indicator clears

### Requirement: Responsive BankInbound pagination
The system SHALL retain the current BankInbound records while a newly selected page loads and SHALL prefetch an eligible next page without duplicating cached or in-flight requests.

#### Scenario: User changes BankInbound page
- **WHEN** the selected BankInbound page is not yet cached
- **THEN** the current records remain visible with a non-destructive fetching state until the requested page resolves

#### Scenario: Current BankInbound page can have a successor
- **WHEN** a successful BankInbound page contains the requested full page size
- **THEN** the system prefetches the next page using the same active filters and request parameters

#### Scenario: Next BankInbound page is already cached
- **WHEN** an adjacent page has fresh cached data
- **THEN** navigating to it reuses that data without issuing a duplicate network request

### Requirement: Verifiable loading performance
The system SHALL include repeatable automated checks and a documented measurement procedure for initial availability, full synchronization, request count, ordering, and concurrency.

#### Scenario: Controlled InterBank latency test runs
- **WHEN** page 1 and subsequent pages are assigned deterministic artificial delays
- **THEN** the test proves page-1 records become available before the delayed history completes and proves the concurrency limit is never exceeded

#### Scenario: Performance comparison is recorded
- **WHEN** the optimized lists are verified in a configured development or staging environment
- **THEN** the implementation records before-and-after time to first usable page, full synchronization time, and request count without claiming backend-independent timing guarantees
