import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateSubscriptionRecency } from "../domain/evaluateSubscriptionRecency";
import type { TransactionInput } from "../domain/types";
import { netflixTransactions } from "./fixtures";

function triple(dates: string[]): TransactionInput[] {
  return dates.map((date, index) => ({
    ...netflixTransactions[0],
    id: `payment-${index}`,
    date,
  }));
}

const unknown = { status: "unknown", nextExpectedPaymentDate: null };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("evaluateSubscriptionRecency", () => {
  it.each([
    ["2026-10-15", "recent"],
    ["2026-11-14", "recent"],
    ["2026-11-15", "grace_period"],
    ["2026-11-20", "grace_period"],
    ["2026-11-21", "payment_not_observed"],
    ["2026-12-14", "payment_not_observed"],
    ["2026-12-15", "payment_not_observed"],
    ["2026-12-20", "payment_not_observed"],
    ["2026-12-21", "long_unobserved"],
    ["2028-01-01", "long_unobserved"],
  ])("evaluates fixed-day payments on %s as %s", (asOfDate, status) => {
    expect(evaluateSubscriptionRecency(netflixTransactions, asOfDate)).toEqual({
      status,
      nextExpectedPaymentDate: "2026-11-15",
    });
  });

  it.each([
    ["2026-11-14", "recent"],
    ["2026-11-15", "grace_period"],
    ["2026-11-16", "payment_not_observed"],
    ["2026-12-15", "payment_not_observed"],
    ["2026-12-16", "long_unobserved"],
  ])("handles zero grace on %s as %s", (asOfDate, status) => {
    expect(evaluateSubscriptionRecency(netflixTransactions, asOfDate, 0)).toEqual({
      status,
      nextExpectedPaymentDate: "2026-11-15",
    });
  });

  it.each([
    ["2026-11-17", "grace_period"],
    ["2026-11-18", "payment_not_observed"],
    ["2026-12-17", "payment_not_observed"],
    ["2026-12-18", "long_unobserved"],
  ])("uses custom grace at the exact boundary %s", (asOfDate, status) => {
    expect(evaluateSubscriptionRecency(netflixTransactions, asOfDate, 2).status).toBe(status);
  });

  it.each([
    {
      dates: ["2023-11-30", "2023-12-31", "2024-01-31"],
      asOf: "2024-02-29", next: "2024-02-29", status: "grace_period",
    },
    {
      dates: ["2025-11-30", "2025-12-31", "2026-01-31"],
      asOf: "2026-02-28", next: "2026-02-28", status: "grace_period",
    },
    {
      dates: ["2024-01-31", "2024-02-29", "2024-03-31"],
      asOf: "2024-04-30", next: "2024-04-30", status: "grace_period",
    },
    {
      dates: ["2026-09-30", "2026-10-31", "2026-11-30"],
      asOf: "2027-01-05", next: "2026-12-31", status: "grace_period",
    },
    {
      dates: ["2026-09-30", "2026-10-31", "2026-11-30"],
      asOf: "2027-01-06", next: "2026-12-31", status: "payment_not_observed",
    },
    {
      dates: ["2026-09-30", "2026-10-31", "2026-11-30"],
      asOf: "2027-02-05", next: "2026-12-31", status: "payment_not_observed",
    },
    {
      dates: ["2026-09-30", "2026-10-31", "2026-11-30"],
      asOf: "2027-02-06", next: "2026-12-31", status: "long_unobserved",
    },
    {
      dates: ["2026-10-15", "2026-11-15", "2026-12-15"],
      asOf: "2027-01-15", next: "2027-01-15", status: "grace_period",
    },
    {
      dates: ["2026-01-28", "2026-02-28", "2026-03-28"],
      asOf: "2026-04-28", next: "2026-04-28", status: "grace_period",
    },
    {
      dates: ["2025-11-30", "2025-12-30", "2026-01-30"],
      asOf: "2026-02-28", next: "2026-02-28", status: "grace_period",
    },
    {
      dates: ["2023-11-30", "2023-12-30", "2024-01-30"],
      asOf: "2024-02-29", next: "2024-02-29", status: "grace_period",
    },
    {
      dates: ["2025-11-30", "2025-12-30", "2026-01-30"],
      asOf: "2026-04-04", next: "2026-02-28", status: "payment_not_observed",
    },
    {
      dates: ["2025-11-30", "2025-12-30", "2026-01-30"],
      asOf: "2026-04-05", next: "2026-02-28", status: "long_unobserved",
    },
    {
      dates: ["0099-10-15", "0099-11-15", "0099-12-15"],
      asOf: "0100-01-15", next: "0100-01-15", status: "grace_period",
    },
  ])("uses calendar months for $dates as of $asOf", ({ dates, asOf, next, status }) => {
    expect(evaluateSubscriptionRecency(triple(dates), asOf)).toEqual({
      status,
      nextExpectedPaymentDate: next,
    });
  });

  it.each([
    "", "not-a-date", "2026-2-15", "2026-02-29", "2026-02-30",
    "2026-00-15", "2026-13-15", "2026-10-00", "2026-10-32",
    "2026-10-15T00:00:00Z", "0000-01-01", "10000-01-01",
  ])("returns unknown for an invalid evaluation or payment date: %s", (date) => {
    expect(evaluateSubscriptionRecency(netflixTransactions, date)).toEqual(unknown);
    expect(evaluateSubscriptionRecency(
      triple(["2026-08-15", date, "2026-10-15"]), "2026-11-15",
    )).toEqual(unknown);
  });

  it.each([
    [],
    ["2026-08-15", "2026-09-15"],
    ["2026-07-15", "2026-08-15", "2026-09-15", "2026-10-15"],
    ["2026-08-15", "2026-08-15", "2026-10-15"],
    ["2026-07-15", "2026-09-15", "2026-10-15"],
    ["2026-08-15", "2026-09-16", "2026-10-15"],
  ])("returns unknown for a non-monthly triple %j", (...dates) => {
    expect(evaluateSubscriptionRecency(triple(dates), "2026-11-15")).toEqual(unknown);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER])(
    "returns unknown for invalid or unrepresentable grace %s",
    (graceDays) => {
      expect(evaluateSubscriptionRecency(netflixTransactions, "2026-11-15", graceDays)).toEqual(unknown);
    },
  );

  it("returns unknown for a future last payment even when input is unsorted", () => {
    const payments = triple(["2026-10-15", "2026-08-15", "2026-09-15"]);
    expect(evaluateSubscriptionRecency(payments, "2026-10-14")).toEqual(unknown);
  });

  it("returns unknown when the expected schedule exceeds supported calendar years", () => {
    expect(evaluateSubscriptionRecency(
      triple(["9999-09-30", "9999-10-31", "9999-11-30"]), "9999-12-01",
    )).toEqual(unknown);
  });

  it("is deterministic across input order and wall clocks without mutating the triple", () => {
    const payments = Object.freeze(netflixTransactions.map((tx) => Object.freeze({ ...tx })));
    const before = JSON.stringify(payments);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2000-01-01T00:00:00Z"));
    const expected = evaluateSubscriptionRecency(payments, "2026-11-20");
    vi.setSystemTime(new Date("2040-12-31T23:59:59Z"));
    for (const indices of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
      expect(evaluateSubscriptionRecency(indices.map((i) => payments[i]), "2026-11-20")).toEqual(expected);
    }
    expect(JSON.stringify(payments)).toBe(before);
  });

  it.each(["UTC", "America/Vancouver", "Pacific/Honolulu", "Asia/Tokyo"])(
    "keeps grace boundaries unchanged across daylight saving in %s",
    (timeZone) => {
      vi.stubEnv("TZ", timeZone);
      const payments = triple(["2025-12-03", "2026-01-03", "2026-02-03"]);
      expect(evaluateSubscriptionRecency(payments, "2026-03-08").status).toBe("grace_period");
      expect(evaluateSubscriptionRecency(payments, "2026-03-09").status).toBe("payment_not_observed");
    },
  );
});
