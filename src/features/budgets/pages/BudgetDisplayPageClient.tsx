import Link from "next/link";
import { BudgetAnalysis } from "../types";
import BudgetCard from "../components/BudgetCard";

type Props = { budgets: BudgetAnalysis[] };

function BudgetDisplayPageClient({ budgets }: Props) {
  return (
    <main className="flex-1 lg:ml-78 p-12 max-w-container-max mx-auto ">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="font-display-lg text-display-lg text-on-surface mb-2">
            Budgets
          </h2>
          <p className="text-body-lg font-body-lg text-slate-muted max-w-2xl">
            Manage your capital allocation across lifestyle and investment
            categories with precision.
          </p>
        </div>
        <Link href={"/budgets/create-budget"} className="btn-primary">
          <span className="material-symbols-outlined">add</span>
          Add Budget
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {budgets.length === 0 ? (
          <div>
            <h3>No budgets yet</h3>
            <p>Create your first monthly category budget.</p>
          </div>
        ) : (
          budgets.map((bdg) => <BudgetCard key={bdg.id} budget={bdg} />)
        )}
      </div>
      {/* TODO: Add later */}
      {/* <section className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 glass-panel rounded-3xl p-card-padding">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h4 className="font-headline-md text-headline-md text-on-surface">
                Budget Utilization
              </h4>
              <p className="text-body-md text-slate-muted">
                Comparative spend analysis across last 6 months.
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface text-label-bold font-label-bold border border-white/5">
                Monthly
              </button>
              <button className="px-4 py-2 rounded-lg text-slate-muted text-label-bold font-label-bold hover:bg-surface-container-high transition-colors">
                Quarterly
              </button>
            </div>
          </div>
          <div className="h-64 flex items-end gap-4 w-full px-4">
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[40%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[55%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[75%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[65%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-surface-container-highest rounded-t-lg h-[85%] relative group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg"></div>
            </div>
            <div className="flex-1 bg-primary/80 rounded-t-lg h-[92%] relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-on-surface text-surface text-[10px] px-2 py-1 rounded font-bold">
                Current
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-4 text-label-bold font-label-bold text-slate-muted">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </div>
        <div className="lg:col-span-4 glass-panel rounded-3xl p-card-padding flex flex-col">
          <h4 className="font-headline-md text-headline-md text-on-surface mb-2">
            Portfolio Insights
          </h4>
          <p className="text-body-md text-slate-muted mb-8">
            AI-driven observations on your liquidity.
          </p>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">
                  trending_down
                </span>
              </div>
              <div>
                <p className="text-on-surface font-label-bold text-label-bold">
                  Spending Reduced
                </p>
                <p className="text-body-md text-slate-muted">
                  Dining expenses decreased by 12% compared to last month.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 shrink-0 bg-tertiary/10 text-tertiary rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">
                  priority_high
                </span>
              </div>
              <div>
                <p className="text-on-surface font-label-bold text-label-bold">
                  Limit Approaching
                </p>
                <p className="text-body-md text-slate-muted">
                  Housing utilities are trending 5% higher than budgeted.
                </p>
              </div>
            </div>
            <button className="w-full mt-4 py-3 rounded-xl border border-white/5 bg-surface-container-low text-on-surface font-label-bold text-label-bold hover:bg-surface-container-high transition-all">
              View Detailed Audit
            </button>
          </div>
        </div>
      </section> */}
    </main>
  );
}

export default BudgetDisplayPageClient;
