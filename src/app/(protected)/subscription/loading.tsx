import { SubscriptionShell } from "@/features/subscriptions/components/SubscriptionShell";

export default function SubscriptionsLoading() {
  return (
    <SubscriptionShell>
      <div role="status">
        <span className="sr-only">Loading subscriptions…</span>
        <div aria-hidden="true" className="space-y-10 motion-safe:animate-pulse">
          <div className="space-y-4">
            <div className="h-6 w-60 max-w-full rounded-full bg-surface-container" />
            <div className="h-12 w-72 max-w-full rounded-lg bg-surface-container" />
            <div className="h-5 w-full max-w-lg rounded bg-surface-container" />
          </div>
          <div className="space-y-5">
            <div className="h-7 w-80 max-w-full rounded bg-surface-container" />
            <div className="h-4 w-full max-w-xl rounded bg-surface-container" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-5">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="space-y-6 rounded-2xl bg-surface-container-low p-6">
                  <div className="h-4 w-32 max-w-full rounded bg-surface-container-high" />
                  <div className="h-10 w-44 max-w-full rounded bg-surface-container-high" />
                  <div className="h-4 w-36 max-w-full rounded bg-surface-container-high" />
                </div>
              ))}
            </div>
            <div className="h-12 rounded-xl bg-surface-container-lowest" />
          </div>
          <div className="space-y-5">
            <div className="h-7 w-72 max-w-full rounded bg-surface-container" />
            <div className="space-y-3 md:space-y-0">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-5 md:rounded-none md:first:rounded-t-2xl md:last:rounded-b-2xl">
                  <div className="size-10 shrink-0 rounded-xl bg-surface-container-high" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="h-4 w-36 max-w-full rounded bg-surface-container-high" />
                    <div className="h-3 w-24 max-w-full rounded bg-surface-container-high" />
                  </div>
                  <div className="h-4 w-20 shrink-0 rounded bg-surface-container-high" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SubscriptionShell>
  );
}
