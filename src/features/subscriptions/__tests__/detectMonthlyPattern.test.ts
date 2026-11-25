import { describe, expect, it } from "vitest";
import { detectMonthlyPattern } from "../domain/detectMonthlyPattern";
import type { TransactionInput } from "../domain/types";
import { netflixTransactions, amazonTransactions } from "./fixtures";

function transactionsOn(dates: string[]): TransactionInput[] {
  return dates.map((date, index) => ({
    ...netflixTransactions[0],
    id: `monthly-payment-${index}`,
    date,
  }));
}

describe("detectMonthlyPattern", () => {
  it("accepts payments on the same day in three consecutive months", () => {
    expect(detectMonthlyPattern(netflixTransactions)).toBe(true);
  });

  it("rejects irregular purchases", () => {
    expect(detectMonthlyPattern(amazonTransactions)).toBe(false);
  });

  it.each([0, 1, 2])("rejects input with only %i transactions", (count) => {
    expect(detectMonthlyPattern(netflixTransactions.slice(0, count))).toBe(false);
  });

  it.each([
    {
      name: "accepts consecutive months across a year boundary",
      dates: ["2026-12-15", "2027-01-15", "2027-02-15"],
      expected: true,
    },
    {
      name: "accepts month-end payments with different month lengths",
      dates: ["2026-01-31", "2026-02-28", "2026-03-31"],
      expected: true,
    },
    {
      name: "accepts month-end payments in a leap year",
      dates: ["2028-01-31", "2028-02-29", "2028-03-31"],
      expected: true,
    },
    {
      name: "accepts transactions supplied out of chronological order",
      dates: ["2026-10-15", "2026-08-15", "2026-09-15"],
      expected: true,
    },
    {
      name: "rejects matching days when a month is missing",
      dates: ["2026-08-15", "2026-10-15", "2026-11-15"],
      expected: false,
    },
    {
      name: "rejects different payment days that are not all month-end",
      dates: ["2026-08-15", "2026-09-16", "2026-10-15"],
      expected: false,
    },
    {
      name: "does not count duplicate payments as separate months",
      dates: ["2026-08-15", "2026-08-15", "2026-09-15"],
      expected: false,
    },
    {
      name: "finds a later monthly pattern among additional purchases",
      dates: [
        "2026-06-02",
        "2026-08-03",
        "2026-08-15",
        "2026-09-07",
        "2026-09-15",
        "2026-10-15",
      ],
      expected: true,
    },
  ])("$name", ({ dates, expected }) => {
    expect(detectMonthlyPattern(transactionsOn(dates))).toBe(expected);
  });

  it.each([
    "not-a-date",
    "2026-2-15",
    "2026-02-15T00:00:00Z",
    "2026-00-15",
    "2026-13-15",
    "2026-02-00",
    "2026-02-29",
    "2026-02-31",
  ])("does not use invalid date %s to complete a pattern", (date) => {
    // January and March alone cannot form three consecutive payment months.
    const transactions = transactionsOn(["2026-01-31", date, "2026-03-31"]);

    expect(detectMonthlyPattern(transactions)).toBe(false);
  });

  it("ignores invalid dates when a valid monthly pattern exists", () => {
    const transactions = [
      ...transactionsOn(["not-a-date", "2026-09-31"]),
      ...netflixTransactions,
    ];

    expect(detectMonthlyPattern(transactions)).toBe(true);
  });

  it("does not mutate the input array or its transactions", () => {
    const transactions = transactionsOn([
      "2026-10-15",
      "2026-08-15",
      "2026-09-15",
    ]);
    const before = structuredClone(transactions);

    detectMonthlyPattern(transactions);

    expect(transactions).toEqual(before);
  });
});
