import type { TransactionInput } from "../domain/types";

export const netflixTransactions: TransactionInput[] = [
  // August 15  - $15.99
  {
    id: "netflix-2026-08-15",
    merchantName: "Netflix",
    accountId: "46aa223f-83c7-407d-93aa-72aeeb9a1a47",
    amountMinor: -1599,
    currency: "USD",
    date: "2026-08-15",
    pending: false,
    removed: false,
  },
  // September 15 - $15.99
  {
    id: "netflix-2026-09-15",
    merchantName: "Netflix",
    accountId: "46aa223f-83c7-407d-93aa-72aeeb9a1a47",
    amountMinor: -1599,
    currency: "USD",
    date: "2026-09-15",
    pending: false,
    removed: false,
  },
  // October 15 - $15.99
  {
    id: "netflix-2026-10-15",
    merchantName: "Netflix",
    accountId: "46aa223f-83c7-407d-93aa-72aeeb9a1a47",
    amountMinor: -1599,
    currency: "USD",
    date: "2026-10-15",
    pending: false,
    removed: false,
  },
];

export const amazonTransactions: TransactionInput[] = [
  // August 3 - $24.99
  {
    id: "amazon-2026-08-03",
    merchantName: "Amazon",
    accountId: "46aa223f-83c7-407d-93aa-72aeeb9a1a47",
    amountMinor: -2499,
    currency: "USD",
    date: "2026-08-03",
    pending: false,
    removed: false,
  },
  // August 11 - $87.45
  {
    id: "amazon-2026-08-11",
    merchantName: "Amazon",
    accountId: "46aa223f-83c7-407d-93aa-72aeeb9a1a47",
    amountMinor: -8745,
    currency: "USD",
    date: "2026-08-11",
    pending: false,
    removed: false,
  },
  // October 22 - $13.50
  {
    id: "amazon-2026-10-22",
    merchantName: "Amazon",
    accountId: "46aa223f-83c7-407d-93aa-72aeeb9a1a47",
    amountMinor: -1350,
    currency: "USD",
    date: "2026-10-22",
    pending: false,
    removed: false,
  },
];
