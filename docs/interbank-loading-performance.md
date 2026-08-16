# InterBank List Loading Performance

## Scope

The benchmark compares the previous serial history loader with the progressive bounded loader using the same pages, page size, and fixed per-request latency. It measures frontend scheduling only; backend and network latency must be measured separately in the target environment.

## Reproduce

Run:

```sh
npm run benchmark:list-loading
```

The fixture contains ten pages, a page size of five, 20 ms latency per request, and a partial terminal page. The command reports:

- Time until the first records can be displayed.
- Time until the complete history is synchronized.
- Request count.
- Maximum configured concurrency.

## Baseline

Before the change, requests were serial and React Query received no records until every page completed. For `P` pages with average request latency `L`, both first usable time and full synchronization time were approximately `P * L`, with `P` requests and concurrency 1.

## Optimized Behavior

The optimized loader publishes page 1 after approximately `L`, then loads remaining pages in ordered batches with concurrency 3. Full synchronization is approximately `L + ceil((P - 1) / 3) * L`, excluding rendering overhead. It preserves the same request parameters and may make at most two speculative requests beyond a terminal page.

Record the command output below whenever the concurrency value or loading algorithm changes. Live development or staging measurements require valid credentials and should use the browser Network and Performance panels with identical filters and data volume.

## Recorded Result

Local controlled run on 2026-08-01:

| Loader | First usable | Full sync | Requests | Concurrency |
| --- | ---: | ---: | ---: | ---: |
| Serial baseline | 305 ms | 305 ms | 10 | 1 |
| Progressive | 30 ms | 122 ms | 10 | 3 |

The controlled fixture improved first usable time by about 90% and full synchronization by about 59%. These values validate frontend scheduling and are not production latency guarantees.
