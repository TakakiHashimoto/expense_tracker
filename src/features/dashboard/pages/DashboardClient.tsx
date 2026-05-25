import { type DashboardData } from "../type";
import DashboardStats from "../components/DashboardStats";
import { formatValue } from "@/lib/formatValue";
import Link from "next/link";
import RecentTransactions from "../components/RecentTransactions";
import SpendingByCategory from "../components/SpendingByCategory";
import DashboardSidebar from "../components/DashboardSidebar";

type Props = { initialValue: DashboardData };

export default function DashboardClient({ initialValue }: Props) {
  if (!initialValue.ok) {
    return (
      <div className="space-y-5 flex flex-col items-center">
        <p className="text-tertiary text-3xl">
          Error Occurred while fetching your data
        </p>
        <Link href="/dashboard" className="">
          Try again
        </Link>
      </div>
    );
  }

  if (!initialValue.hasPlaidItems) {
    return (
      <div className="">
        <p>You don't have your account connected</p>
        <Link
          href="/connect-bank"
          className="w-fit bg-linear-to-r from-primary to-primary-container text-on-primary px-10 py-5 rounded-xl font-bold text-lg active:scale-95 transition-transform shadow-[0_0_20px_rgba(78,222,163,0.15)] flex items-center gap-3"
        >
          Connect your bank here
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <DashboardSidebar />
      <div className="flex flex-col gap-3 px-4 md:px-8 xl:px-12 pb-12 pt-4 ml-72">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <DashboardStats
            title="THIS MONTH SPENDING"
            value={formatValue(initialValue.stats.monthlySpending, "money")}
            type="monthly-spending"
          />
          <DashboardStats
            title="TODAY"
            value={formatValue(initialValue.stats.todayTotal, "money")}
            type="today-total"
          />
          <DashboardStats
            title="MONTHLY INCOME"
            value={formatValue(initialValue.stats.monthlyIncome, "money")}
            type="monthly-income"
          />
          <DashboardStats
            title="RECENT ACTIVITIES"
            value={formatValue(initialValue.stats.recentActivities, "count")}
            type="recent-activities"
          />
        </section>

        {/* Recent transactions */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <RecentTransactions
              transactions={initialValue.recentTransactions}
            />
          </div>

          <SpendingByCategory
            spendingByCategory={initialValue.spendingByCategory}
          />
        </section>
      </div>
    </div>
  );
}
