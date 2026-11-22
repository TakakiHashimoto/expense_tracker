import { groupTransactions } from "./groupTransactions";
import type { TransactionInput, SubscriptionCandidate } from "./types";
import { findRecurringTriples } from "./findRecurringTriples";

export function detectSubscriptions(
  transactions: TransactionInput[],
): SubscriptionCandidate[] {
  const groups = groupTransactions(transactions);

  const candidates: SubscriptionCandidate[] = [];

  for (const group of groups.values()) {
    const recurringTriples = findRecurringTriples(group);

    for (const recurringTriple of recurringTriples) {
      const first = recurringTriple[0];
      const last = recurringTriple.at(-1);

      if (!first || !last || !first.merchantName) {
        continue;
      }

      const estimatedAmountMinor = recurringTriple
        .map((t) => Math.abs(t.amountMinor))
        .sort((a, b) => a - b)[1];

      const candidate: SubscriptionCandidate = {
        merchantName: first.merchantName.trim(),
        currency: first.currency,
        cadence: "monthly",
        estimatedAmountMinor,
        lastPaymentDate: last.date,
        transactionIds: recurringTriple.map((t) => t.id),
        confidence: 0.7,
        accountId: first.accountId,
      };

      candidates.push(candidate);
    }
  }

  return candidates;
}
