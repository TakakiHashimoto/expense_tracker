import { detectMonthlyPattern } from "./detectMonthlyPattern";
import { isAmountStable } from "./isAmountStable";
import type { TransactionInput } from "./types";

type MonthBucket = { lastDay: number; byDay: Map<number, TransactionInput[]> };

// Sorted transactionsから許容範囲内の金額を探す
function findAmountMatch(
  transactions: TransactionInput[],
  referenceAmount: number,
): TransactionInput | null {
  const tolerance = Math.abs(referenceAmount) * 0.05;
  const minAmount = referenceAmount - tolerance;
  const maxAmount = referenceAmount + tolerance;

  // Binary Search: minAmount以上になる最初の位置
  let left = 0;
  let right = transactions.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);

    if (transactions[mid].amountMinor < minAmount) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  const candidate = transactions[left];

  if (candidate && candidate.amountMinor <= maxAmount) {
    return candidate;
  }

  return null;
}

// 3か月分の候補から有効な3件を探す
function findMatchingTriple(
  firstMonth: TransactionInput[],
  secondMonth: TransactionInput[],
  thirdMonth: TransactionInput[],
): TransactionInput[] | null {
  for (const first of firstMonth) {
    const second = findAmountMatch(secondMonth, first.amountMinor);

    const third = findAmountMatch(thirdMonth, first.amountMinor);

    if (!second || !third) {
      continue;
    }

    const triple = [first, second, third];

    if (detectMonthlyPattern(triple) && isAmountStable(triple)) {
      return triple;
    }
  }

  return null;
}

export function findRecurringTriple(
  transactions: TransactionInput[],
): TransactionInput[] | null {
  if (transactions.length < 3) {
    return null;
  }

  // Step 1: 月と日ごとに取引を分類
  const months = new Map<number, MonthBucket>();

  for (const transaction of transactions) {
    if (
      !Number.isSafeInteger(transaction.amountMinor) ||
      transaction.amountMinor >= 0
    ) {
      continue;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(transaction.date);

    if (!match) {
      continue;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (year < 100 || month < 1 || month > 12) {
      continue;
    }

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    if (day < 1 || day > lastDay) {
      continue;
    }

    const monthIndex = year * 12 + (month - 1);

    let bucket = months.get(monthIndex);

    if (!bucket) {
      bucket = { lastDay, byDay: new Map() };
      months.set(monthIndex, bucket);
    }

    const payments = bucket.byDay.get(day) ?? [];
    payments.push(transaction);
    bucket.byDay.set(day, payments);
  }

  // Step 2: 各日の取引を金額順にソート
  for (const bucket of months.values()) {
    for (const payments of bucket.byDay.values()) {
      payments.sort((a, b) => a.amountMinor - b.amountMinor);
    }
  }

  // Step 3: 新しい月から3か月連続の候補を調べる
  const monthIndices = [...months.keys()].sort((a, b) => b - a);

  for (const monthIndex of monthIndices) {
    const first = months.get(monthIndex)!;
    const second = months.get(monthIndex + 1);
    const third = months.get(monthIndex + 2);

    if (!second || !third) {
      continue;
    }

    // Case A: 毎月同じ日に支払い
    for (const [day, firstPayments] of first.byDay) {
      const secondPayments = second.byDay.get(day);
      const thirdPayments = third.byDay.get(day);

      if (!secondPayments || !thirdPayments) {
        continue;
      }

      const triple = findMatchingTriple(
        firstPayments,
        secondPayments,
        thirdPayments,
      );

      if (triple) {
        return triple;
      }
    }

    // Case B: 毎月の月末日に支払い
    const triple = findMatchingTriple(
      first.byDay.get(first.lastDay) ?? [],
      second.byDay.get(second.lastDay) ?? [],
      third.byDay.get(third.lastDay) ?? [],
    );

    if (triple) {
      return triple;
    }
  }

  return null;
}
