import { describe, expect, it } from "vitest";
import { detectSubscriptions } from "../domain/detectSubscriptions";
import type { SubscriptionCandidate, TransactionInput } from "../domain/types";
import { netflixTransactions, amazonTransactions } from "./fixtures";

describe("detectSubscriptions", () => {
  const netflixCandidate: SubscriptionCandidate = {
    merchantName: "netflix",
    accountId: netflixTransactions[0].accountId,
    currency: "USD",
    cadence: "monthly",
    estimatedAmountMinor: 1599,
    lastPaymentDate: "2026-10-15",
    transactionIds: netflixTransactions.map((transaction) => transaction.id),
    confidence: 0.7,
  };

  it("returns one candidate for three recurring Netflix payments", () => {
    const result = detectSubscriptions(netflixTransactions);

    expect(result).toEqual([netflixCandidate]);
  });

  it("returns no candidates for irregular Amazon purchases", () => {
    expect(detectSubscriptions(amazonTransactions)).toEqual([]);
  });

  it("detects only Netflix when Netflix and Amazon transactions are mixed", () => {
    const result = detectSubscriptions([
      ...netflixTransactions,
      ...amazonTransactions,
    ]);

    expect(result).toEqual([netflixCandidate]);
  });

  it("returns two candidates for recurring Netflix and Spotify payments", () => {
    const spotifyTransactions: TransactionInput[] = netflixTransactions.map(
      (transaction) => ({
        ...transaction,
        id: `spotify-${transaction.date}`,
        merchantName: "Spotify",
        amountMinor: -1099,
      }),
    );

    const result = detectSubscriptions([
      ...netflixTransactions,
      ...spotifyTransactions,
    ]);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        netflixCandidate,
        {
          merchantName: "spotify",
          accountId: spotifyTransactions[0].accountId,
          currency: "USD",
          cadence: "monthly",
          estimatedAmountMinor: 1099,
          lastPaymentDate: "2026-10-15",
          transactionIds: spotifyTransactions.map((transaction) => transaction.id),
          confidence: 0.7,
        },
      ]),
    );
  });

  it("returns an empty array for empty input", () => {
    expect(detectSubscriptions([])).toEqual([]);
  });
});
