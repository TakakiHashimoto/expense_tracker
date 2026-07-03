import Search from "@/features/transactions/components/Search";
import TransactionSort from "@/features/transactions/components/TransactionSort";
import TransactionTypeFilter from "@/features/transactions/components/TransactionTypeFilter";
import {
  TransactionFilters,
  TransactionItem,
} from "@/features/transactions/types";

type Props = { transactions: TransactionItem[]; filters: TransactionFilters };

function Transactions({ transactions, filters }: Props) {
  return (
    <section className="xl:col-span-8 space-y-6">
      <h3 className="font-bold text-4xl text-on-surface tracking-tight my-6">
        Recent Transactions for this account
      </h3>
      <div className="glass-panel rounded-xl overflow-hidden bg-surface-container border-0">
        <div className="p-4 flex flex-col items-center gap-4 bg-surface-container-high">
          <Search placeholder="Search..." />
          <div className="flex gap-2">
            <TransactionSort sort={filters.sort} />
            <TransactionTypeFilter filterType={filters.type} />
          </div>
        </div>
        <div className="divide-y-0">
          <div className="flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-slate-muted"
                  data-icon="devices"
                >
                  devices
                </span>
              </div>
              <div>
                <h4 className="font-body-lg text-body-lg text-on-surface group-hover:text-primary transition-colors">
                  Apple Store
                </h4>
                <p className="text-slate-muted font-body-md text-body-md">
                  Jun 18 • Electronics
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-body-lg text-body-lg text-on-surface block">
                -$1,299.00
              </span>
              <span className="text-slate-muted font-label-bold text-label-bold uppercase">
                Pending
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-slate-muted"
                  data-icon="local_cafe"
                >
                  local_cafe
                </span>
              </div>
              <div>
                <h4 className="font-body-lg text-body-lg text-on-surface group-hover:text-primary transition-colors">
                  Starbucks
                </h4>
                <p className="text-slate-muted font-body-md text-body-md">
                  Jun 17 • Dining
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-body-lg text-body-lg text-on-surface block">
                -$4.50
              </span>
              <span className="text-slate-muted font-label-bold text-label-bold uppercase invisible">
                Cleared
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between p-5 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                <span
                  className="material-symbols-outlined"
                  data-icon="payments"
                >
                  payments
                </span>
              </div>
              <div>
                <h4 className="font-body-lg text-body-lg text-on-surface group-hover:text-primary transition-colors">
                  Acme Corp Payroll
                </h4>
                <p className="text-slate-muted font-body-md text-body-md">
                  Jun 15 • Direct Deposit
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-body-lg text-body-lg text-primary block">
                +$3,500.00
              </span>
              <span className="text-slate-muted font-label-bold text-label-bold uppercase invisible">
                Cleared
              </span>
            </div>
          </div>
        </div>
        <div className="p-4 bg-surface-container-low text-center rounded-b-xl">
          <button className="text-primary font-label-bold text-label-bold uppercase hover:text-primary-fixed transition-colors">
            View All Transactions
          </button>
        </div>
      </div>
    </section>
  );
}

export default Transactions;
