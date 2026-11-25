import type { ReactNode } from "react";

export function SubscriptionShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen min-w-0 px-4 pt-24 pb-12 text-on-surface sm:px-8 lg:pt-14 lg:pr-10 lg:pl-80">
      <div className="mx-auto w-full max-w-7xl space-y-10">{children}</div>
    </main>
  );
}
