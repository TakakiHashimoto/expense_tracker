import Search from "@/features/transactions/components/Search";
import TransactionItemRow from "@/features/transactions/components/TransactionItem";
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
          {transactions.map((t) => (
            <TransactionItemRow key={t.id} transaction={t} />
          ))}
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
