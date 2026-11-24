import "server-only";

import { getSubscriptionTransactions } from "./getSubscriptionTransactions";
import { toTransactionInput } from "./toTransactionInput";
import { detectSubscriptions } from "../domain/detectSubscriptions";

import type { TransactionInput, SubscriptionCandidate } from "../domain/types";

export async function getDetectedSubscriptions(
  fromDate: string,
): Promise<SubscriptionCandidate[]> {
  // One UTC calendar date for all candidates, even if fetching crosses midnight.
  const asOfDate = new Date().toISOString().slice(0, 10);

  // Step 1: DBから取引を取得
  const rows = await getSubscriptionTransactions(fromDate);

  // Step 2: DB RowをDomain Modelに変換
  const transactions: TransactionInput[] = [];

  for (const row of rows) {
    const transaction = toTransactionInput(row);

    if (transaction) {
      transactions.push(transaction);
    }
  }

  // Step 3: Subscriptionを検出
  return detectSubscriptions(transactions, asOfDate);
}
