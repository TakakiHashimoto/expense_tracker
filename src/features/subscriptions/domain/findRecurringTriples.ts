import { findRecurringTriple } from "./findRecurringTriple";
import type { TransactionInput } from "./types";

export function findRecurringTriples(
  transactions: TransactionInput[],
): TransactionInput[][] {
  const byDay = new Map<number, TransactionInput[]>();
  const monthEnd: TransactionInput[] = [];

  // 1. Calendar dayごとに分割する
  for (const tx of transactions) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tx.date);

    if (!match) continue;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (year < 100 || month < 1 || month > 12) continue;

    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

    if (day < 1 || day > lastDay) continue;

    const payments = byDay.get(day) ?? [];
    payments.push(tx);
    byDay.set(day, payments);

    // Month-endにも分類する。
    // 例: Feb 28は固定28日パターンにも使える。
    if (day === lastDay) {
      monthEnd.push(tx);
    }
  }

  // Month-endを優先し、その後は日付の降順
  const groups = [
    monthEnd,
    ...[...byDay.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, payments]) => payments),
  ];

  const consumedIds = new Set<string>();
  const results: TransactionInput[][] = [];

  for (const group of groups) {
    let remaining = group.filter((tx) => !consumedIds.has(tx.id));

    while (remaining.length >= 3) {
      const triple = findRecurringTriple(remaining);

      if (!triple) break;

      results.push(triple);

      const referenceAmount = triple[0].amountMinor;
      const tolerance = Math.abs(referenceAmount) * 0.05;

      // 選択されたTripleの3件だけでなく、
      // 同じ請求日・料金帯の全取引を消費する。
      const matchedIds = new Set(
        remaining
          .filter(
            (tx) =>
              Number.isSafeInteger(tx.amountMinor) &&
              tx.amountMinor < 0 &&
              Math.abs(tx.amountMinor - referenceAmount) <= tolerance,
          )
          .map((tx) => tx.id),
      );

      for (const id of matchedIds) {
        consumedIds.add(id);
      }

      remaining = remaining.filter((tx) => !matchedIds.has(tx.id));
    }
  }

  return results.sort(
    (a, b) =>
      b[b.length - 1].date.localeCompare(a[a.length - 1].date) ||
      a[0].id.localeCompare(b[0].id),
  );
}
