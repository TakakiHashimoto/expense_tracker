import type { SubscriptionRecency, TransactionInput } from "./types";

function parseCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  // Reject rollover such as February 30 instead of silently normalizing it.
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function lastDayOfMonth(date: Date): number {
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return end.getUTCDate();
}

function expectedPayment(last: Date, monthsAhead: number, monthEnd: boolean): Date {
  const expected = new Date(last);
  expected.setUTCDate(1);
  expected.setUTCMonth(expected.getUTCMonth() + monthsAhead);
  const lastDay = lastDayOfMonth(expected);
  expected.setUTCDate(monthEnd ? lastDay : Math.min(last.getUTCDate(), lastDay));
  return expected;
}

function addGraceDays(date: Date, graceDays: number): Date {
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + graceDays);
  return end;
}

function isSupportedDate(date: Date): boolean {
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() >= 1 &&
    date.getUTCFullYear() <= 9999
  );
}

/**
 * Estimates observation recency, never contractual activity or payment failure.
 * The caller supplies an already-detected triple and an explicit UTC calendar day.
 * Missing observations may reflect stale sync, delayed posting, missing history,
 * or merchant normalization. No clock, I/O, or mutation is used here.
 */
export function evaluateSubscriptionRecency(
  recurringTriple: readonly TransactionInput[],
  asOfDate: string,
  graceDays = 5,
): SubscriptionRecency {
  const unknown: SubscriptionRecency = {
    status: "unknown",
    nextExpectedPaymentDate: null,
  };
  const asOf = parseCalendarDate(asOfDate);
  if (
    !asOf ||
    recurringTriple.length !== 3 ||
    !Number.isSafeInteger(graceDays) ||
    graceDays < 0
  ) {
    return unknown;
  }

  const dates = recurringTriple
    .map(({ date }) => parseCalendarDate(date))
    .filter((date): date is Date => date !== null);
  if (dates.length !== 3) return unknown;

  dates.sort((a, b) => a.getTime() - b.getTime());
  const [first, second, last] = dates;
  if (
    monthIndex(second) !== monthIndex(first) + 1 ||
    monthIndex(last) !== monthIndex(second) + 1 ||
    last > asOf
  ) {
    return unknown;
  }

  // Prefer month-end when every observed payment falls on its month's last day.
  const monthEnd = dates.every((date) => date.getUTCDate() === lastDayOfMonth(date));
  const fixedDay = dates.every((date) => date.getUTCDate() === first.getUTCDate());
  if (!monthEnd && !fixedDay) return unknown;

  // Both expectations use the original anchor: February clamping must not cause
  // a fixed-day schedule to drift in March.
  const next = expectedPayment(last, 1, monthEnd);
  const secondExpected = expectedPayment(last, 2, monthEnd);
  const firstGraceEnd = addGraceDays(next, graceDays);
  const secondGraceEnd = addGraceDays(secondExpected, graceDays);
  if (![next, secondExpected, firstGraceEnd, secondGraceEnd].every(isSupportedDate)) {
    return unknown;
  }

  let status: SubscriptionRecency["status"];
  if (asOf < next) {
    status = "recent";
  } else if (asOf <= firstGraceEnd) {
    status = "grace_period";
  } else if (asOf > secondGraceEnd) {
    status = "long_unobserved";
  } else {
    status = "payment_not_observed";
  }

  return {
    status,
    // Always the FIRST expectation after the last observation, even if past.
    nextExpectedPaymentDate: next.toISOString().slice(0, 10),
  };
}
