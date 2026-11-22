import { CalendarSync, Clock3, Info, ScanLine, Wallet } from "lucide-react";
import type { SubscriptionCandidate } from "../domain/types";
import {
  formatSubscriptionAmount,
  formatSubscriptionDate,
} from "./formatSubscription";
import { SubscriptionShell } from "./SubscriptionShell";

const currencyNames = new Intl.DisplayNames("en-US", { type: "currency" });

export function SubscriptionDashboard({
  candidates,
}: {
  candidates: SubscriptionCandidate[];
}) {
  const totals = new Map<string, { amountMinor: number; count: number }>();

  for (const candidate of candidates) {
    const total = totals.get(candidate.currency) ?? { amountMinor: 0, count: 0 };
    total.amountMinor += candidate.estimatedAmountMinor;
    total.count += 1;
    totals.set(candidate.currency, total);
  }

  return (
    <SubscriptionShell>
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          <ScanLine aria-hidden="true" size={14} />
          Automatically detected from transactions
        </div>
        <div>
          <h1 className="font-headline-lg sm:font-display-lg">Subscriptions</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-on-surface-variant">
            A clearer view of your recurring payments. Explore monthly patterns
            identified in your recent transaction history.
          </p>
        </div>
      </header>

      <section aria-labelledby="spending-heading" className="space-y-5">
        <div>
          <h2 id="spending-heading" className="font-headline-md">
            Estimated Monthly Spending
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Estimates by billing currency. Currencies are never combined or converted.
          </p>
        </div>

        {totals.size > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-5">
            {[...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) => (
              <article
                key={currency}
                aria-label={`Estimated monthly spending in ${currency}`}
                className="min-w-0 rounded-2xl border border-outline-variant/30 bg-linear-to-br from-surface-container to-surface-container-low p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-xs font-semibold tracking-wider text-on-surface-variant uppercase">
                    {currency} · {currencyNames.of(currency)}
                  </h3>
                  <Wallet aria-hidden="true" size={17} className="shrink-0 text-primary" />
                </div>
                <p className="mt-6 text-3xl leading-tight font-bold tracking-tight wrap-anywhere tabular-nums xl:text-4xl">
                  {formatSubscriptionAmount(total.amountMinor, currency)}
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">estimated / month</p>
                <div className="mt-6 border-t border-outline-variant/30 pt-4 text-xs text-on-surface-variant">
                  <span className="font-semibold text-primary">{total.count}</span>{" "}
                  recurring {total.count === 1 ? "payment" : "payments"} detected
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
            <p className="font-medium">No monthly estimate yet</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              Currency totals will appear when recurring payments are detected.
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-xl bg-surface-container-lowest px-4 py-3 text-xs leading-relaxed text-on-surface-variant">
          <Info aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-secondary" />
          <p>
            Estimates reflect historical payment patterns, not confirmed active
            subscriptions. Actual charges may change.
          </p>
        </div>
      </section>

      <section aria-labelledby="subscriptions-heading" className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="subscriptions-heading" className="font-headline-md">
            Detected Subscriptions
          </h2>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {candidates.length} detected
          </span>
        </div>

        {candidates.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-outline-variant/30 bg-surface-container-low px-6 py-14 text-center sm:py-20">
            <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CalendarSync aria-hidden="true" size={28} />
            </div>
            <h3 className="text-xl font-semibold">No subscriptions detected yet</h3>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-on-surface-variant">
              We couldn&apos;t identify any recurring monthly payments from your
              recent transactions. As more transaction history becomes available,
              detected subscriptions will appear here.
            </p>
          </div>
        ) : (
          <div>
            <div
              aria-hidden="true"
              className="mb-3 hidden grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 px-5 text-xs font-medium tracking-wide text-on-surface-variant uppercase md:grid"
            >
              <span>Merchant</span>
              <span>Billing cadence</span>
              <span>Last payment</span>
              <span className="text-right">Estimated amount</span>
            </div>
            <ul className="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-outline-variant/30 md:bg-surface-container-low">
              {candidates.map((candidate) => {
                const merchant = candidate.merchantName?.trim() || "Unknown merchant";
                const monogram = Array.from(merchant)[0].toLocaleUpperCase("en-US");

                return (
                  <li
                    key={JSON.stringify([candidate.accountId, candidate.merchantName, candidate.currency])}
                    className="grid min-w-0 grid-cols-2 items-center gap-x-4 gap-y-5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] md:rounded-none md:border-0 md:border-b md:last:border-b-0"
                  >
                    <div className="order-1 flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary"
                      >
                        {monogram}
                      </span>
                      <h3 className="min-w-0 text-sm leading-relaxed font-semibold wrap-anywhere">
                        {merchant}
                      </h3>
                    </div>
                    <div className="order-3 min-w-0 md:order-2">
                      <p className="mb-1 text-xs text-on-surface-variant md:sr-only">Billing cadence</p>
                      <span className="inline-block rounded-md bg-surface-container-high px-2 py-1 text-xs font-medium text-on-surface-variant capitalize">
                        {candidate.cadence}
                      </span>
                    </div>
                    <div className="order-4 min-w-0 text-right md:order-3 md:text-left">
                      <p className="mb-1 text-xs text-on-surface-variant md:sr-only">Last payment</p>
                      <div className="flex items-center justify-end gap-2 text-sm text-on-surface-variant md:justify-start">
                        <Clock3 aria-hidden="true" size={13} className="hidden shrink-0 text-secondary md:block" />
                        <time dateTime={candidate.lastPaymentDate}>
                          {formatSubscriptionDate(candidate.lastPaymentDate)}
                        </time>
                      </div>
                    </div>
                    <div className="order-2 min-w-0 text-right md:order-4">
                      <p className="mb-1 text-xs text-on-surface-variant md:sr-only">Estimated / month</p>
                      <p className="text-sm font-semibold wrap-anywhere tabular-nums">
                        {formatSubscriptionAmount(candidate.estimatedAmountMinor, candidate.currency)}
                      </p>
                      <p className="mt-1 text-xs text-on-surface-variant">{candidate.currency}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <p className="text-xs leading-relaxed text-on-surface-variant">
          Recurring payments are identified from payment timing and merchant
          descriptions in your recent transaction history. BankOS does not manage
          or alter your merchant agreements.
        </p>
      </section>
    </SubscriptionShell>
  );
}
