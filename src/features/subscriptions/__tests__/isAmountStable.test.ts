import { describe, expect, it } from "vitest";
import { isAmountStable } from "../domain/isAmountStable";
import { netflixTransactions, amazonTransactions } from "./fixtures";

describe("isAmountStable", () => {
  it("accepts identical monthly amounts", () => {
    expect(isAmountStable(netflixTransactions)).toBe(true);
  });

  it("rejects unstable amounts", () => {
    expect(isAmountStable(amazonTransactions)).toBe(false);
  });

  it("rejects fewer than three transactions", () => {
    expect(isAmountStable(netflixTransactions.slice(0, 2))).toBe(false);
  });

  it("accepts amounts varying within 5%, including the boundary", () => {
    // Both $19.00 and $21.00 are exactly 5% away from $20.00.
    const amounts = [-2000, -1900, -2100];
    const transactions = netflixTransactions.map((transaction, index) => ({
      ...transaction,
      amountMinor: amounts[index],
    }));

    expect(isAmountStable(transactions)).toBe(true);
  });

  it("rejects amounts varying by more than 5%", () => {
    // $21.01 exceeds the 5% tolerance from $20.00 by one cent.
    const amounts = [-2000, -2000, -2101];
    const transactions = netflixTransactions.map((transaction, index) => ({
      ...transaction,
      amountMinor: amounts[index],
    }));

    expect(isAmountStable(transactions)).toBe(false);
  });

  it("rejects a significantly different fourth payment", () => {
    const transactions = [
      ...netflixTransactions,
      {
        ...netflixTransactions[0],
        id: "netflix-2026-11-15",
        date: "2026-11-15",
        amountMinor: -4999,
      },
    ];

    expect(isAmountStable(transactions)).toBe(false);
  });
});
