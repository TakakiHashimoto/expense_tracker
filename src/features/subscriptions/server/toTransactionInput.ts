import type { TransactionInput } from "../domain/types";
import type { SubscriptionDbRow } from "./getSubscriptionTransactions";

export function toTransactionInput(
  row: SubscriptionDbRow,
): TransactionInput | null {
  // 1. Accountから通貨情報を取得
  const currency = row.account?.currency?.toUpperCase();

  // 2. MVPで対応する通貨の換算倍率
  let scale: number;

  switch (currency) {
    case "USD":
    case "CAD":
      scale = 100;
      break;
    case "JPY":
      scale = 1;
      break;
    default:
      return null;
  }

  // 3. 必須データの検証
  if (!row.merchant?.trim()) {
    return null;
  }

  if (!Number.isFinite(row.amount) || row.amount >= 0) {
    return null;
  }

  // 4. Major Unit → Minor Unit
  const scaled = row.amount * scale;
  const amountMinor = Math.round(scaled);

  // 5. 不正確な金額の変換を防ぐ
  if (
    !Number.isSafeInteger(amountMinor) ||
    Math.abs(scaled - amountMinor) > 1e-7
  ) {
    return null;
  }

  // 6. Domain Modelへ変換
  return {
    id: row.id,
    accountId: row.account_id,
    merchantName: row.merchant.trim(),
    amountMinor,
    currency,
    date: row.posted_date,
    pending: row.pending,
    removed: row.is_removed,
  };
}
