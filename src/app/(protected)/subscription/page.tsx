import { notFound } from "next/navigation";
import { SubscriptionDashboard } from "@/features/subscriptions/components/SubscriptionDashboard";
import { getDetectedSubscriptions } from "@/features/subscriptions/server/getDetectedSubscriptions";

export default async function SubscriptionsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const now = new Date();
  const fromDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1),
  )
    .toISOString()
    .slice(0, 10);

  const candidates = await getDetectedSubscriptions(fromDate);

  return <SubscriptionDashboard candidates={candidates} />;
}
