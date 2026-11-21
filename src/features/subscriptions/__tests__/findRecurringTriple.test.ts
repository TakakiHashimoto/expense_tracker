import { describe, expect, it } from "vitest";
import { findRecurringTriple } from "../domain/findRecurringTriple";
import type { TransactionInput } from "../domain/types";
import { netflixTransactions, amazonTransactions } from "./fixtures";

describe("findRecurringTriple", () => {
  function makeTx(
    id: string,
    date: string,
    amountMinor: number,
  ): TransactionInput {
    return {
      id,
      date,
      amountMinor,
      accountId: "account_1",
      merchantName: "Netflix",
      currency: "USD",
      pending: false,
      removed: false,
    };
  }

  it("finds regular Netflix payments", () => {
    const result = findRecurringTriple(netflixTransactions);

    expect(result?.map((t) => t.id)).toEqual(
      netflixTransactions.map((t) => t.id),
    );
  });

  it("rejects irregular Amazon purchases", () => {
    expect(findRecurringTriple(amazonTransactions)).toBeNull();
  });

  it("finds recurring payments despite an extra purchase", () => {
    const extra = {
      ...netflixTransactions[0],
      id: "netflix-extra",
      date: "2026-10-10",
      amountMinor: -4999,
    };

    const result = findRecurringTriple([
      ...netflixTransactions,
      extra,
    ]);

    expect(result).not.toBeNull();
    expect(result?.map((t) => t.id).sort()).toEqual(
      netflixTransactions.map((t) => t.id).sort(),
    );
  });

  it("detects month-end payments", () => {
    const dates = [
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ];

    const transactions = dates.map((date, index) => ({
      ...netflixTransactions[0],
      id: `month-end-${index}`,
      date,
    }));

    expect(findRecurringTriple(transactions)).not.toBeNull();
  });

  it("rejects unstable payment amounts", () => {
    const transactions = netflixTransactions.map(
      (transaction, index) => ({
        ...transaction,
        amountMinor: [-1599, -3000, -5000][index],
      }),
    );

    expect(findRecurringTriple(transactions)).toBeNull();
  });

  it("handles multiple payments on the same day", () => {
    const transactions = [
      makeTx("aug", "2026-08-15", -1599),
      makeTx("sep-extra", "2026-09-15", -4999),
      makeTx("sep", "2026-09-15", -1599),
      makeTx("oct", "2026-10-15", -1599),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual([
      "aug",
      "sep",
      "oct",
    ]);
  });

  it("detects recurring payments across years", () => {
    const transactions = [
      makeTx("dec", "2025-12-15", -1599),
      makeTx("jan", "2026-01-15", -1599),
      makeTx("feb", "2026-02-15", -1599),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual([
      "dec",
      "jan",
      "feb",
    ]);
  });

  it("handles leap-year month-end payments", () => {
    const transactions = [
      makeTx("jan", "2024-01-31", -1599),
      makeTx("feb", "2024-02-29", -1599),
      makeTx("mar", "2024-03-31", -1599),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual([
      "jan",
      "feb",
      "mar",
    ]);
  });

  it("does not mutate the original transactions", () => {
    const transactions = [
      makeTx("oct", "2026-10-15", -1599),
      makeTx("aug", "2026-08-15", -1599),
      makeTx("sep", "2026-09-15", -1599),
    ];

    const original = structuredClone(transactions);

    findRecurringTriple(transactions);

    expect(transactions).toEqual(original);
  });
});
