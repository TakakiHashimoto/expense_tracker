import { describe, expect, it } from "vitest";
import { groupTransactions } from "../domain/groupTransactions";
import type { TransactionInput } from "../domain/types";
import { netflixTransactions, amazonTransactions } from "./fixtures";

describe("groupTransactions", () => {
  it("groups transactions by account, merchant and currency", () => {
    const transactions = [...netflixTransactions, ...amazonTransactions];

    const result = groupTransactions(transactions);

    expect(result.size).toBe(2);

    const netflixKey = JSON.stringify([
      netflixTransactions[0].accountId,
      "netflix",
      "USD",
    ]);
    const amazonKey = JSON.stringify([
      amazonTransactions[0].accountId,
      "amazon",
      "USD",
    ]);

    expect(result.get(netflixKey)).toEqual(
      netflixTransactions.map((transaction) => ({
        ...transaction,
        merchantName: "netflix",
      })),
    );
    expect(result.get(amazonKey)).toEqual(
      amazonTransactions.map((transaction) => ({
        ...transaction,
        merchantName: "amazon",
      })),
    );
  });

  it("returns an empty Map for empty input", () => {
    expect(groupTransactions([])).toEqual(new Map());
  });

  it("groups merchant names regardless of case or surrounding whitespace", () => {
    const transactions = netflixTransactions.map((transaction, index) => ({
      ...transaction,
      merchantName: [" Netflix ", "NETFLIX", "\tnetflix\n"][index],
    }));

    const result = groupTransactions(transactions);

    expect(result.size).toBe(1);
    expect([...result.values()][0]).toEqual(
      netflixTransactions.map((transaction) => ({
        ...transaction,
        merchantName: "netflix",
      })),
    );
  });

  it.each([
    { field: "account", overrides: { accountId: "another-account" } },
    { field: "currency", overrides: { currency: "CAD" } },
  ])("keeps the same merchant separate by $field", ({ overrides }) => {
    const original = netflixTransactions[0];
    const other = { ...original, ...overrides, id: "other-transaction" };

    const result = groupTransactions([original, other]);

    expect(result.size).toBe(2);
    for (const transaction of [original, other]) {
      const key = JSON.stringify([
        transaction.accountId,
        "netflix",
        transaction.currency,
      ]);
      expect(result.get(key)).toEqual([
        { ...transaction, merchantName: "netflix" },
      ]);
    }
  });

  it.each<{ reason: string; overrides: Partial<TransactionInput> }>([
    { reason: "pending", overrides: { pending: true } },
    { reason: "removed", overrides: { removed: true } },
    { reason: "positive amount", overrides: { amountMinor: 1599 } },
    { reason: "zero amount", overrides: { amountMinor: 0 } },
    { reason: "null merchant", overrides: { merchantName: null } },
    { reason: "empty merchant", overrides: { merchantName: "" } },
    {
      reason: "whitespace-only merchant",
      overrides: { merchantName: " \t\n " },
    },
  ])("excludes transactions with $reason", ({ overrides }) => {
    const excluded = {
      ...netflixTransactions[0],
      ...overrides,
      id: "excluded-transaction",
    };

    expect(groupTransactions([excluded])).toEqual(new Map());
    expect(groupTransactions([...netflixTransactions, excluded])).toEqual(
      groupTransactions(netflixTransactions),
    );
  });

  it("does not mutate the input array or its transactions", () => {
    const transactions = netflixTransactions.map((transaction) => ({
      ...transaction,
      merchantName: " Netflix ",
    }));
    const before = structuredClone(transactions);

    groupTransactions(transactions);

    expect(transactions).toEqual(before);
  });
});
