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

export type SubscriptionCandidate = {
  merchantName: string | null;
  currency: string;
  cadence: "monthly"; // means a regular rhythm, pattern like "monthly"
  estimatedAmountMinor: number;
  lastPaymentDate: string;
  transactionIds: string[];
  confidence: number;
  accountId: string; // which account pays for it (TD checking account)
};
