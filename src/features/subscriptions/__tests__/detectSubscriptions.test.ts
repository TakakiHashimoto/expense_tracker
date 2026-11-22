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
          transactionIds: spotifyTransactions.map(
            (transaction) => transaction.id,
          ),
          confidence: 0.7,
        },
      ]),
    );
  });

  it("returns an empty array for empty input", () => {
    expect(detectSubscriptions([])).toEqual([]);
  });

  it("detects multiple subscriptions from the same merchant", () => {
    const appleTransactions: TransactionInput[] = netflixTransactions.flatMap(
      (tx) => [
        {
          ...tx,
          id: `icloud-${tx.date}`,
          date: `${tx.date.slice(0, 7)}-05`,
          merchantName: "Apple",
          amountMinor: -299,
        },
        {
          ...tx,
          id: `music-${tx.date}`,
          merchantName: "Apple",
          amountMinor: -1099,
        },
      ],
    );

    const result = detectSubscriptions(appleTransactions);

    expect(result).toHaveLength(2);

    expect(
      result
        .map((candidate) => candidate.estimatedAmountMinor)
        .sort((a, b) => a - b),
    ).toEqual([299, 1099]);
  });

  it("does not split six monthly payments into two subscriptions", () => {
    const dates = [
      "2026-05-15",
      "2026-06-15",
      "2026-07-15",
      "2026-08-15",
      "2026-09-15",
      "2026-10-15",
    ];

    const transactions = dates.map((date, index) => ({
      ...netflixTransactions[0],
      id: `netflix-${index}`,
      date,
    }));

    const result = detectSubscriptions(transactions);

    expect(result).toHaveLength(1);
    expect(result[0].lastPaymentDate).toBe("2026-10-15");
    expect(result[0].transactionIds).toEqual([
      "netflix-3",
      "netflix-4",
      "netflix-5",
    ]);
  });

  it("detects distinct recurring amounts on the same billing day", () => {
    const months = ["2026-08", "2026-09", "2026-10"];

    const transactions: TransactionInput[] = months.flatMap((month) => [
      {
        ...netflixTransactions[0],
        id: `icloud-${month}`,
        date: `${month}-15`,
        merchantName: "Apple",
        amountMinor: -299,
      },
      {
        ...netflixTransactions[0],
        id: `music-${month}`,
        date: `${month}-15`,
        merchantName: "Apple",
        amountMinor: -1099,
      },
    ]);

    const result = detectSubscriptions(transactions);

    expect(result).toHaveLength(2);

    expect(
      result
        .map((candidate) => candidate.estimatedAmountMinor)
        .sort((a, b) => a - b),
    ).toEqual([299, 1099]);
  });

  it("detects month-end and fixed-day subscriptions without sharing transactions", () => {
    const monthEnds = ["2026-01-31", "2026-02-28", "2026-03-31"];

    const fixedDays = ["2026-01-28", "2026-02-28", "2026-03-28"];

    const transactions: TransactionInput[] = [
      ...monthEnds.map((date) => ({
        ...netflixTransactions[0],
        id: `music-${date}`,
        date,
        merchantName: "Apple",
        amountMinor: -1099,
      })),
      ...fixedDays.map((date) => ({
        ...netflixTransactions[0],
        id: `icloud-${date}`,
        date,
        merchantName: "Apple",
        amountMinor: -299,
      })),
    ];

    const result = detectSubscriptions(transactions);

    expect(result).toHaveLength(2);

    expect(
      result
        .map((candidate) => candidate.estimatedAmountMinor)
        .sort((a, b) => a - b),
    ).toEqual([299, 1099]);

    // 6つの異なるTransactionが重複使用されていない
    const allIds = result.flatMap((c) => c.transactionIds);

    expect(new Set(allIds).size).toBe(6);
  });

  it("returns deterministic results regardless of input order", () => {
    const months = ["2026-08", "2026-09", "2026-10"];

    const transactions: TransactionInput[] = months.flatMap((month) => [
      {
        ...netflixTransactions[0],
        id: `music-${month}`,
        date: `${month}-15`,
        merchantName: "Apple",
        amountMinor: -1099,
      },
      {
        ...netflixTransactions[0],
        id: `icloud-${month}`,
        date: `${month}-15`,
        merchantName: "Apple",
        amountMinor: -299,
      },
    ]);

    const normal = detectSubscriptions(transactions);
    const reversed = detectSubscriptions([...transactions].reverse());

    expect(reversed).toEqual(normal);
  });
});
