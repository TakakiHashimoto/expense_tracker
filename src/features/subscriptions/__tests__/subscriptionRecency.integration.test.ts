import { afterEach, describe, expect, it, vi } from "vitest";
import { detectSubscriptions } from "../domain/detectSubscriptions";
import { getDetectedSubscriptions } from "../server/getDetectedSubscriptions";
import { getSubscriptionTransactions } from "../server/getSubscriptionTransactions";
import { netflixTransactions } from "./fixtures";

vi.mock("../server/getSubscriptionTransactions", () => ({
  getSubscriptionTransactions: vi.fn(),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("subscription recency integration (mocked database)", () => {
  it("adds recency without changing detection, amounts, or selected transactions", () => {
    const legacy = detectSubscriptions(netflixTransactions);
    const evaluated = detectSubscriptions(netflixTransactions, "2026-11-20");

    expect(evaluated.map(({ recency, ...candidate }) => {
      expect(recency).toEqual({
        status: "grace_period",
        nextExpectedPaymentDate: "2026-11-15",
      });
      return candidate;
    })).toEqual(legacy);
    expect(legacy[0]).not.toHaveProperty("recency");
  });

  it.each(["2026-10-14", "invalid"])("retains candidates with unknown recency as of %s", (asOf) => {
    const result = detectSubscriptions(netflixTransactions, asOf);
    expect(result).toHaveLength(1);
    expect(result[0].recency).toEqual({ status: "unknown", nextExpectedPaymentDate: null });
    expect(result[0].estimatedAmountMinor).toBe(1599);
  });

  it("evaluates separate recurring triples for the same merchant independently", () => {
    const payments = netflixTransactions.flatMap((tx) => [
      { ...tx, id: `early-${tx.id}`, date: `${tx.date.slice(0, 7)}-05`, amountMinor: -299 },
      { ...tx, id: `late-${tx.id}` },
    ]);
    const result = detectSubscriptions(payments, "2026-11-12");
    expect(result).toHaveLength(2);
    expect(result.find((c) => c.estimatedAmountMinor === 299)?.recency).toEqual({
      status: "payment_not_observed", nextExpectedPaymentDate: "2026-11-05",
    });
    expect(result.find((c) => c.estimatedAmountMinor === 1599)?.recency).toEqual({
      status: "recent", nextExpectedPaymentDate: "2026-11-15",
    });
  });

  it("resolves one UTC date before fetching, even when the request crosses midnight", async () => {
    vi.stubEnv("TZ", "America/Vancouver");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T23:59:59Z"));
    vi.mocked(getSubscriptionTransactions).mockImplementationOnce(async () => {
      vi.setSystemTime(new Date("2026-11-21T00:00:01Z"));
      return netflixTransactions.flatMap((tx) => ["Netflix", "Spotify"].map((merchant) => ({
        id: `${merchant}-${tx.id}`, account_id: tx.accountId, merchant,
        amount: -15.99, posted_date: tx.date, pending: false, is_removed: false,
        account: { currency: "USD" },
      })));
    });

    const result = await getDetectedSubscriptions("2026-05-01");
    expect(getSubscriptionTransactions).toHaveBeenCalledWith("2026-05-01");
    expect(result).toHaveLength(2);
    expect(result.map((candidate) => candidate.recency)).toEqual([
      { status: "grace_period", nextExpectedPaymentDate: "2026-11-15" },
      { status: "grace_period", nextExpectedPaymentDate: "2026-11-15" },
    ]);
  });

  it("uses the UTC day rather than the server's local day", async () => {
    vi.stubEnv("TZ", "America/Vancouver");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T00:00:01Z"));
    vi.mocked(getSubscriptionTransactions).mockResolvedValueOnce(netflixTransactions.map((tx) => ({
      id: tx.id, account_id: tx.accountId, merchant: tx.merchantName,
      amount: -15.99, posted_date: tx.date, pending: false, is_removed: false,
      account: { currency: "USD" },
    })));
    const result = await getDetectedSubscriptions("2026-05-01");
    expect(result[0].recency?.status).toBe("payment_not_observed");
  });
});
