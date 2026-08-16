import { performance } from "node:perf_hooks";

import { loadInterbankTransfersProgressively } from "../src/modules/interbank/interbankLoader.js";

const PAGE_SIZE = 5;
const TOTAL_PAGES = 10;
const REQUEST_DELAY_MS = 20;

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchPage = async (pageNumber) => {
  await delay(REQUEST_DELAY_MS);
  const count = pageNumber === TOTAL_PAGES ? 2 : PAGE_SIZE;
  return Array.from({ length: count }, (_, index) => ({
    id: `${pageNumber}-${index}`,
  }));
};

const serialStarted = performance.now();
let serialRequests = 0;
for (let pageNumber = 1; pageNumber <= 100; pageNumber += 1) {
  serialRequests += 1;
  const page = await fetchPage(pageNumber);
  if (page.length < PAGE_SIZE) break;
}
const serialFinished = performance.now();

let current = [];
let progressiveRequests = 0;
let firstUsableMs = null;
const progressiveStarted = performance.now();
const result = await loadInterbankTransfersProgressively({
  pageSize: PAGE_SIZE,
  maxPages: 100,
  concurrency: 3,
  getCurrent: () => current,
  publish: (records) => {
    current = records;
    if (firstUsableMs === null) firstUsableMs = performance.now() - progressiveStarted;
  },
  fetchPage: async (pageNumber) => {
    progressiveRequests += 1;
    return fetchPage(pageNumber);
  },
});
const progressiveFinished = performance.now();

console.log(
  JSON.stringify(
    {
      fixture: {
        totalPages: TOTAL_PAGES,
        pageSize: PAGE_SIZE,
        requestDelayMs: REQUEST_DELAY_MS,
      },
      before: {
        firstUsableMs: Math.round(serialFinished - serialStarted),
        fullSyncMs: Math.round(serialFinished - serialStarted),
        requests: serialRequests,
        concurrency: 1,
      },
      after: {
        firstUsableMs: Math.round(firstUsableMs),
        fullSyncMs: Math.round(progressiveFinished - progressiveStarted),
        requests: progressiveRequests,
        concurrency: 3,
        status: result.status,
      },
    },
    null,
    2,
  ),
);
