import type { TransactionInput } from "./types";

export function isAmountStable(transactions: TransactionInput[]): boolean {
  if (transactions.length < 3) {
    return false;
  }

  const firstPayment = transactions[0].amountMinor;

  if (firstPayment >= 0) {
    return false;
  }

  const tolerance = Math.abs(firstPayment) * 0.05;

  return transactions.every((transaction) => {
    const difference = Math.abs(transaction.amountMinor - firstPayment);

    return transaction.amountMinor < 0 && difference <= tolerance;
  });
}
