import type { TransactionInput } from "./types";

export function groupTransactions(
  transactions: TransactionInput[],
): Map<string, TransactionInput[]> {
  // 1. Filter eligible transactions
  const filteredT = transactions.filter(
    (t) => !t.removed && !t.pending && t.amountMinor < 0,
  );
  // 2. Normalize merchant names

  // 3. Group by accountId + merchantName + currency
  const groupedT = new Map<string, TransactionInput[]>();
  for (const transaction of filteredT) {
    const normalizedMerchant = transaction.merchantName?.trim().toLowerCase();

    if (!normalizedMerchant) {
      continue;
    }
    const key = JSON.stringify([
      transaction.accountId,
      normalizedMerchant,
      transaction.currency,
    ]);

    const existing = groupedT.get(key);

    const normalizedTransaction = {
      ...transaction,
      merchantName: normalizedMerchant,
    };

    if (existing) {
      existing.push(normalizedTransaction);
    } else {
      groupedT.set(key, [normalizedTransaction]);
    }
  }
  // 4. Return Map
  return groupedT;
}
