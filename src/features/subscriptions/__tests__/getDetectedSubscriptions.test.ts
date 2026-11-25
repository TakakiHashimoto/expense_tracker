import { describe, expect, it, vi } from "vitest";
import { getDetectedSubscriptions } from "../server/getDetectedSubscriptions";
import { getSubscriptionTransactions } from "../server/getSubscriptionTransactions";

vi.mock("../server/getSubscriptionTransactions", () => ({
  getSubscriptionTransactions: vi.fn(),
}));

describe("getDetectedSubscriptions", () => {
  it("fetches, converts, and detects subscriptions", async () => {
    const rows = [
      {
        id: "aug",
        account_id: "account_1",
        merchant: "Netflix",
        amount: -15.99,
        posted_date: "2026-08-15",
        pending: false,
        is_removed: false,
        account: { currency: "USD" },
      },
      {
        id: "sep",
        account_id: "account_1",
        merchant: "Netflix",
        amount: -15.99,
        posted_date: "2026-09-15",
        pending: false,
        is_removed: false,
        account: { currency: "USD" },
      },
      {
        id: "oct",
        account_id: "account_1",
        merchant: "Netflix",
        amount: -15.99,
        posted_date: "2026-10-15",
        pending: false,
        is_removed: false,
        account: { currency: "USD" },
      },
    ];

    vi.mocked(getSubscriptionTransactions).mockResolvedValue(rows);

    const result = await getDetectedSubscriptions("2026-05-01");

    expect(getSubscriptionTransactions).toHaveBeenCalledWith("2026-05-01");

    expect(result).toHaveLength(1);
    expect(result[0].merchantName).toBe("netflix");
    expect(result[0].estimatedAmountMinor).toBe(1599);
    expect(result[0].cadence).toBe("monthly");
    expect(result[0].transactionIds).toEqual(["aug", "sep", "oct"]);
  });
});
