"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { SubscriptionShell } from "@/features/subscriptions/components/SubscriptionShell";

export default function SubscriptionsError({ reset }: { reset: () => void }) {
  return (
    <SubscriptionShell>
      <header>
        <h1 className="font-headline-lg sm:font-display-lg">Subscriptions</h1>
      </header>
      <section aria-labelledby="subscription-error-heading" className="flex flex-col items-center rounded-2xl border border-outline-variant/30 bg-surface-container-low px-6 py-16 text-center">
        <div className="mb-6 rounded-2xl bg-tertiary/10 p-4 text-tertiary">
          <CircleAlert aria-hidden="true" size={28} />
        </div>
        <h2 id="subscription-error-heading" className="font-headline-md">
          Unable to load subscriptions
        </h2>
        <p className="mt-3 max-w-md text-base leading-relaxed text-on-surface-variant">
          We couldn&apos;t load your recurring payments right now. Please try again.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="btn-primary mt-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-reduce:transform-none motion-reduce:transition-none"
        >
          <RotateCcw aria-hidden="true" size={18} />
          Try again
        </button>
      </section>
    </SubscriptionShell>
  );
}
