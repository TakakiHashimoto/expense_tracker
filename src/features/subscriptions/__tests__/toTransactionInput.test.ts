import { describe, expect, it } from "vitest";
import { toTransactionInput } from "../server/toTransactionInput";
import type { SubscriptionDbRow } from "../server/getSubscriptionTransactions";

function makeRow(
  overrides: Partial<SubscriptionDbRow> = {},
): SubscriptionDbRow {
  return {
    id: "tx_1",
    account_id: "account_1",
    merchant: "Netflix",
    amount: -15.99,
    posted_date: "2026-10-15",
    pending: false,
    is_removed: false,
    account: { currency: "CAD" },
    ...overrides,
  };
}

describe("toTransactionInput", () => {
  it("converts CAD major units to minor units", () => {
    const result = toTransactionInput(makeRow());

    expect(result).toEqual({
      id: "tx_1",
      accountId: "account_1",
      merchantName: "Netflix",
      amountMinor: -1599,
      currency: "CAD",
      date: "2026-10-15",
      pending: false,
      removed: false,
    });
  });

  it("converts USD to cents", () => {
    const result = toTransactionInput(
      makeRow({ amount: -25.5, account: { currency: "USD" } }),
    );

    expect(result?.amountMinor).toBe(-2550);
  });

  it("does not multiply JPY amounts", () => {
    const result = toTransactionInput(
      makeRow({ amount: -1500, account: { currency: "JPY" } }),
    );

    expect(result?.amountMinor).toBe(-1500);
  });

  it("rejects missing or unsupported currency", () => {
    expect(toTransactionInput(makeRow({ account: null }))).toBeNull();

    expect(
      toTransactionInput(makeRow({ account: { currency: "XYZ" } })),
    ).toBeNull();
  });

  it("rejects empty merchant names", () => {
    expect(toTransactionInput(makeRow({ merchant: null }))).toBeNull();

    expect(toTransactionInput(makeRow({ merchant: "   " }))).toBeNull();
  });

  it("rejects invalid expense amounts", () => {
    for (const amount of [0, 15.99, NaN, Infinity]) {
      expect(toTransactionInput(makeRow({ amount }))).toBeNull();
    }
  });

  it("rejects unsupported fractional minor units", () => {
    const result = toTransactionInput(makeRow({ amount: -15.999 }));

    expect(result).toBeNull();
  });

  it("does not mutate the database row", () => {
    const row = makeRow({ merchant: " Netflix " });
    const original = structuredClone(row);

    const result = toTransactionInput(row);

    expect(row).toEqual(original);
    expect(result?.merchantName).toBe("Netflix");
  });
});
