import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubscriptionDashboard } from "../components/SubscriptionDashboard";
import type { SubscriptionCandidate } from "../domain/types";

function candidate(
  overrides: Partial<SubscriptionCandidate> = {},
): SubscriptionCandidate {
  return {
    merchantName: "Netflix",
    accountId: "test-account",
    currency: "CAD",
    cadence: "monthly",
    estimatedAmountMinor: 1599,
    lastPaymentDate: "2026-10-15",
    transactionIds: ["test-transaction"],
    confidence: 0.7,
    ...overrides,
  };
}

function renderDashboard(candidates: SubscriptionCandidate[]) {
  return renderToStaticMarkup(
    createElement(SubscriptionDashboard, { candidates }),
  );
}

// Assert visible content without coupling tests to Tailwind classes or SVG markup.
function textContent(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function currencyCards(html: string) {
  return [...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(
    ([card]) => ({
      label: card.match(/aria-label="([^"]+)"/)?.[1],
      text: textContent(card),
    }),
  );
}

describe("SubscriptionDashboard server-side HTML", () => {
  it("renders the complete empty state without subscription rows or currency totals", () => {
    const html = renderDashboard([]);
    const text = textContent(html);

    expect(text).toContain("No subscriptions detected yet");
    expect(text).toContain(
      "We couldn't identify any recurring monthly payments from your recent transactions. As more transaction history becomes available, detected subscriptions will appear here.",
    );
    expect(text).toContain("No monthly estimate yet");
    expect(text).toContain("0 detected");
    expect(currencyCards(html)).toHaveLength(0);
    expect(html).not.toMatch(/<li\b/);
  });

  it("renders the merchant, estimated amount, currency, payment date, and cadence", () => {
    const html = renderDashboard([candidate()]);
    const rows = [...html.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)];

    expect(rows).toHaveLength(1);
    const row = rows[0][0];
    const text = textContent(row);
    expect(text).toContain("Netflix");
    expect(text).toContain("Estimated / month");
    expect(text).toContain("CA$15.99");
    expect(text).toContain("CAD");
    expect(text).toContain("Billing cadence monthly");
    expect(text).toContain("Last payment Oct 15, 2026");
    expect(row).toContain('<time dateTime="2026-10-15">Oct 15, 2026</time>');
    expect(textContent(html)).toContain("1 detected");
    expect(html).not.toContain("No subscriptions detected yet");
    expect(html).not.toContain("test-account");
    expect(html).not.toContain("test-transaction");
  });

  it("keeps CAD, USD, and JPY in separate estimated monthly totals", () => {
    const html = renderDashboard([
      candidate(),
      candidate({
        merchantName: "GitHub Copilot",
        currency: "USD",
        estimatedAmountMinor: 999,
      }),
      candidate({
        merchantName: "iCloud",
        currency: "JPY",
        estimatedAmountMinor: 1480,
      }),
    ]);
    const cards = currencyCards(html);

    expect(cards).toHaveLength(3);
    for (const [currency, amount] of [
      ["CAD", "CA$15.99"],
      ["USD", "US$9.99"],
      ["JPY", "¥1,480"],
    ]) {
      const card = cards.find(
        ({ label }) => label === `Estimated monthly spending in ${currency}`,
      );
      expect(card).toBeDefined();
      expect(card?.text).toContain(`${amount} estimated / month`);
      expect(card?.text).toContain("1 recurring payment detected");
    }
    expect(textContent(html)).toContain("3 detected");
  });

  it("sums candidates within each currency and displays per-currency and total counts", () => {
    const html = renderDashboard([
      candidate(),
      candidate({ merchantName: "Spotify", estimatedAmountMinor: 1099 }),
      candidate({
        merchantName: "Adobe Creative Cloud",
        estimatedAmountMinor: 1999,
      }),
      candidate({
        merchantName: "GitHub Copilot",
        currency: "USD",
        estimatedAmountMinor: 999,
      }),
      candidate({
        merchantName: "Cloud storage",
        currency: "USD",
        estimatedAmountMinor: 1499,
      }),
      candidate({
        merchantName: "iCloud",
        currency: "JPY",
        estimatedAmountMinor: 1480,
      }),
      candidate({
        merchantName: "Music",
        currency: "JPY",
        estimatedAmountMinor: 520,
      }),
    ]);
    const cards = currencyCards(html);

    expect(cards).toHaveLength(3);
    for (const [currency, amount, count] of [
      ["CAD", "CA$46.97", 3],
      ["USD", "US$24.98", 2],
      ["JPY", "¥2,000", 2],
    ] as const) {
      const card = cards.find(
        ({ label }) => label === `Estimated monthly spending in ${currency}`,
      );
      expect(card).toBeDefined();
      expect(card?.text).toContain(`${amount} estimated / month`);
      expect(card?.text).toContain(`${count} recurring payments detected`);
    }
    expect(textContent(html)).toContain("7 detected");
    expect([...html.matchAll(/<li\b/g)]).toHaveLength(7);
  });
});
