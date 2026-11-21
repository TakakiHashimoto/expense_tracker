import { groupTransactions } from "./groupTransactions";
import { findRecurringTriple } from "./findRecurringTriple";
import type { TransactionInput, SubscriptionCandidate } from "./types";

export function detectSubscriptions(
  transactions: TransactionInput[],
): SubscriptionCandidate[] {
  const groups = groupTransactions(transactions);

  const candidates: SubscriptionCandidate[] = [];

  for (const group of groups.values()) {
    // findRecurringTriple()を実行する
    const recurringTriple = findRecurringTriple(group);
    // nullの場合はスキップする
    if (!recurringTriple) {
      continue;
    }

    // 3件からSubscriptionCandidateを生成する
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

  return candidates;
}
