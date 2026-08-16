import { keepPreviousData } from "@tanstack/react-query";

export const BANK_INBOUND_KEY = ["bank-inbound"];
export const BANK_INBOUND_DASHBOARD_KEY = ["bank-inbound-dashboard"];
export const BANK_INBOUND_STALE_TIME = 30_000;
export const BANK_INBOUND_GC_TIME = 5 * 60_000;

export const getBankInboundQueryKey = ({ filters, pageNumber, pageSize }) => [
  ...BANK_INBOUND_KEY,
  { filters, pageNumber, pageSize },
];

export const getBankInboundDashboardQueryKey = (filters) => [
  ...BANK_INBOUND_DASHBOARD_KEY,
  { filters },
];

export const canPrefetchNextBankInboundPage = (data, pageSize) =>
  Array.isArray(data?.data) && data.data.length === pageSize;

export const createBankInboundQueryOptions = ({
  filters,
  pageNumber,
  pageSize,
  fetchPage,
}) => ({
  queryKey: getBankInboundQueryKey({ filters, pageNumber, pageSize }),
  queryFn: ({ signal }) =>
    fetchPage({ filters, pageNumber, pageSize, signal }),
  placeholderData: keepPreviousData,
  staleTime: BANK_INBOUND_STALE_TIME,
  gcTime: BANK_INBOUND_GC_TIME,
});
