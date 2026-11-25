// minor unit example
// • USD $10.95 → 1095 (cents)
// • EUR €25.00 → 2500 (cents)

export type TransactionInput = {
  id: string;
  merchantName: string | null;
  amountMinor: number;
  accountId: string;
  currency: string;
  date: string;
  pending: boolean;
  removed: boolean;
};

export type SubscriptionRecency = {
  status:
    | "recent"
    | "grace_period"
    | "payment_not_observed"
    | "long_unobserved"
    | "unknown";
  nextExpectedPaymentDate: string | null;
};

export type SubscriptionCandidate = {
  merchantName: string | null;
  currency: string;
  cadence: "monthly"; // means a regular rhythm, pattern like "monthly"
  estimatedAmountMinor: number;
  lastPaymentDate: string;
  transactionIds: string[];
  confidence: number;
  accountId: string; // which account pays for it (TD checking account)
  // Optional for legacy detection-only callers; the server always evaluates it.
  recency?: SubscriptionRecency;
};
