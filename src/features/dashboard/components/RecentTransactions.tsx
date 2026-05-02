import { type RecentTransaction } from "../type";
import RecentTransactionItem from "./RecentTransactionItem";

type TransactionsType = { transactions: RecentTransaction[] };

function RecentTransactions({ transactions }: TransactionsType) {
  return (
    <div className="bg-surface-container-low rounded-3xl p-8">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-bold text-slate-100">
          Recent Transactions
        </h3>
        <button className="text-sm text-primary font-semibold hover:opacity-80 transition-opacity">
          See All
        </button>
      </div>
      <div className="flex flex-col gap-6">
        {transactions.map((t) => (
          <RecentTransactionItem
            key={t.id}
            shop={t.name}
            category={t.categoryName}
            categoryKind={t.categoryKind}
            date={t.date}
            amount={t.amount}
          />
        ))}
      </div>
    </div>
  );
}

export default RecentTransactions;

// [] of below
// { id: string;
//   name: string;
//   amount: number;
//   date: string;
//   categoryName: string | null;
//   categoryKind: "income" | "expense" | null; }
