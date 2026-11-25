import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubscriptionDashboard } from "../components/SubscriptionDashboard";
import type { SubscriptionCandidate, SubscriptionRecency } from "../domain/types";

const candidate: SubscriptionCandidate = {
  merchantName: "Netflix",
  accountId: "test-account",
  currency: "CAD",
  cadence: "monthly",
  estimatedAmountMinor: 1599,
  lastPaymentDate: "2026-10-15",
  transactionIds: ["aug", "sep", "oct"],
  confidence: 0.7,
};

const cases: [SubscriptionRecency["status"], string][] = [
  ["recent", "Recent payment observed"],
  ["grace_period", "Within payment observation grace period"],
  ["payment_not_observed", "Expected payment not observed"],
  ["long_unobserved", "No payment observed through two expected cycles"],
  ["unknown", "Payment recency unknown"],
];

describe("SubscriptionDashboard payment observations", () => {
  it.each(cases)("renders %s as an observation with a qualified estimate", (status, label) => {
    const nextExpectedPaymentDate = status === "unknown" ? null : "2026-11-15";
    const html = renderToStaticMarkup(createElement(SubscriptionDashboard, {
      candidates: [{ ...candidate, recency: { status, nextExpectedPaymentDate } }],
    }));

    expect(html).toContain(label);
    expect(html).toContain("CA$15.99");
    expect(html).toContain("1 detected");
    if (nextExpectedPaymentDate) {
      expect(html).toContain("Expected after last payment (estimate):");
      expect(html).toContain('<time dateTime="2026-11-15">Nov 15, 2026</time>');
    } else {
      expect(html).not.toContain("Expected after last payment (estimate):");
    }
    expect(html).toContain("Payment observations do not confirm an active or cancelled subscription, or an unpaid bill.");
    for (const limitation of ["stale Plaid synchronization", "delayed posting", "missing history", "merchant normalization"]) {
      expect(html).toContain(limitation);
    }
  });

  it("renders unevaluated legacy candidates as unknown without inventing an expected date", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionDashboard, {
      candidates: [candidate],
    }));
    expect(html).toContain("Payment recency unknown");
    expect(html).not.toContain("Expected after last payment (estimate):");
  });

  it("keeps separate observations for multiple subscriptions from the same merchant", () => {
    const html = renderToStaticMarkup(createElement(SubscriptionDashboard, {
      candidates: [
        { ...candidate, recency: { status: "recent", nextExpectedPaymentDate: "2026-11-15" } },
        {
          ...candidate, transactionIds: ["other-aug", "other-sep", "other-oct"],
          recency: { status: "payment_not_observed", nextExpectedPaymentDate: "2026-11-05" },
        },
      ],
    }));
    const rows = [...html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map(([row]) => row);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Recent payment observed");
    expect(rows[0]).not.toContain("Expected payment not observed");
    expect(rows[1]).toContain("Expected payment not observed");
    expect(rows[1]).not.toContain("Recent payment observed");
    expect(html).toContain("CA$31.98");
  });
});
