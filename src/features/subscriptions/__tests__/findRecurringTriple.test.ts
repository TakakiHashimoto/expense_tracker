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

    const result = findRecurringTriple([...netflixTransactions, extra]);

    expect(result).not.toBeNull();
    expect(result?.map((t) => t.id).sort()).toEqual(
      netflixTransactions.map((t) => t.id).sort(),
    );
  });

  it("detects month-end payments", () => {
    const dates = ["2026-01-31", "2026-02-28", "2026-03-31"];

    const transactions = dates.map((date, index) => ({
      ...netflixTransactions[0],
      id: `month-end-${index}`,
      date,
    }));

    expect(findRecurringTriple(transactions)).not.toBeNull();
  });

  it("rejects unstable payment amounts", () => {
    const transactions = netflixTransactions.map((transaction, index) => ({
      ...transaction,
      amountMinor: [-1599, -3000, -5000][index],
    }));

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

    expect(result?.map((t) => t.id)).toEqual(["aug", "sep", "oct"]);
  });

  it("detects recurring payments across years", () => {
    const transactions = [
      makeTx("dec", "2025-12-15", -1599),
      makeTx("jan", "2026-01-15", -1599),
      makeTx("feb", "2026-02-15", -1599),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual(["dec", "jan", "feb"]);
  });

  it("handles leap-year month-end payments", () => {
    const transactions = [
      makeTx("jan", "2024-01-31", -1599),
      makeTx("feb", "2024-02-29", -1599),
      makeTx("mar", "2024-03-31", -1599),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual(["jan", "feb", "mar"]);
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

  it("selects the latest recurring triple regardless of input order", () => {
    const earlier = [
      makeTx("aug-05", "2026-08-05", -1599),
      makeTx("sep-05", "2026-09-05", -1599),
      makeTx("oct-05", "2026-10-05", -1599),
    ];

    const later = [
      makeTx("aug-25", "2026-08-25", -1599),
      makeTx("sep-25", "2026-09-25", -1599),
      makeTx("oct-25", "2026-10-25", -1599),
    ];

    const expected = ["aug-25", "sep-25", "oct-25"];

    // Pattern Aを先に渡す
    const result1 = findRecurringTriple([...earlier, ...later]);

    // Pattern Bを先に渡す
    const result2 = findRecurringTriple([...later, ...earlier]);

    expect(result1?.map((t) => t.id)).toEqual(expected);
    expect(result2?.map((t) => t.id)).toEqual(expected);
  });

  it("falls back to the latest valid triple when newer payments are invalid", () => {
    const transactions = [
      makeTx("jul", "2026-07-15", -1599),
      makeTx("aug", "2026-08-15", -1599),
      makeTx("sep", "2026-09-15", -1599),
      makeTx("oct-invalid", "2026-10-15", -4999),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual(["jul", "aug", "sep"]);
  });

  it("prefers month-end over an earlier same-day pattern", () => {
    const transactions = [
      makeTx("aug-25", "2026-08-25", -1599),
      makeTx("sep-25", "2026-09-25", -1599),
      makeTx("oct-25", "2026-10-25", -1599),
      makeTx("aug-end", "2026-08-31", -1599),
      makeTx("sep-end", "2026-09-30", -1599),
      makeTx("oct-end", "2026-10-31", -1599),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual(["aug-end", "sep-end", "oct-end"]);
  });

  it("uses transaction IDs for deterministic same-day ties", () => {
    const transactions = [
      makeTx("aug-b", "2026-08-15", -1599),
      makeTx("sep-b", "2026-09-15", -1599),
      makeTx("oct-b", "2026-10-15", -1599),
      makeTx("aug-a", "2026-08-15", -1599),
      makeTx("sep-a", "2026-09-15", -1599),
      makeTx("oct-a", "2026-10-15", -1599),
    ];

    const expected = ["aug-a", "sep-a", "oct-a"];

    expect(findRecurringTriple(transactions)?.map((t) => t.id)).toEqual(
      expected,
    );

    expect(
      findRecurringTriple([...transactions].reverse())?.map((t) => t.id),
    ).toEqual(expected);
  });

  it("prefers the latest valid three-month window", () => {
    const transactions = [
      makeTx("jul", "2026-07-15", -1599),
      makeTx("aug", "2026-08-15", -1599),
      makeTx("sep", "2026-09-15", -1599),
      makeTx("oct", "2026-10-15", -1599),
    ];

    const result = findRecurringTriple(transactions);

    expect(result?.map((t) => t.id)).toEqual(["aug", "sep", "oct"]);
  });

  it("finds a valid triple among multiple amount candidates deterministically", () => {
    const transactions = [
      makeTx("aug", "2026-08-15", -1599),

      makeTx("sep-invalid", "2026-09-15", -1690),
      makeTx("sep-a", "2026-09-15", -1650),
      makeTx("sep-b", "2026-09-15", -1599),

      makeTx("oct-invalid", "2026-10-15", -1750),
      makeTx("oct-a", "2026-10-15", -1660),
      makeTx("oct-b", "2026-10-15", -1550),
    ];

    const expected = ["aug", "sep-a", "oct-a"];

    expect(findRecurringTriple(transactions)?.map((tx) => tx.id)).toEqual(
      expected,
    );

    expect(
      findRecurringTriple([...transactions].reverse())?.map((tx) => tx.id),
    ).toEqual(expected);
  });
});
