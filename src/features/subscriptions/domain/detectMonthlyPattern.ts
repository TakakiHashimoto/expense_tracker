import type { TransactionInput } from "./types";

type MonthPayments = { days: Set<number>; lastDay: number };

// detect monthly patterns
export function detectMonthlyPattern(
  transactions: TransactionInput[],
): boolean {
  if (transactions.length < 3) {
    return false;
  }

  // Step 1: Group payment days by calendar month
  const months = new Map<number, MonthPayments>();

  for (const transaction of transactions) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(transaction.date);

    if (!match) {
      continue;
    }

    const year = Number(match[1]); // 2026
    const month = Number(match[2]); // 8
    const day = Number(match[3]); // 15

    if (month < 1 || month > 12) {
      continue;
    }

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    if (day < 1 || day > lastDay) {
      continue;
    }

    const monthIndex = year * 12 + (month - 1); // 2026 * 12 + 8, 2026 * 12 + 9, 2026 * 12 + 10

    const existing = months.get(monthIndex);

    if (existing) {
      existing.days.add(day);
    } else {
      months.set(monthIndex, { days: new Set([day]), lastDay });
    }
  }

  // Step 2: Search for three consecutive months
  for (const [monthIndex, first] of months) {
    const second = months.get(monthIndex + 1);
    const third = months.get(monthIndex + 2);

    // if they are consecutive, we get second and third, if they are absent that means they are not cosecutive
    if (!second || !third) {
      continue;
    }

    // Step 3a: Same payment day in all three months
    const sameDay = [...first.days].some(
      (day) => second.days.has(day) && third.days.has(day),
    );

    // Step 3b: Payment on the last day of each month
    const allMonthEnd =
      first.days.has(first.lastDay) &&
      second.days.has(second.lastDay) &&
      third.days.has(third.lastDay);

    if (sameDay || allMonthEnd) {
      return true;
    }
  }

  return false;
}
