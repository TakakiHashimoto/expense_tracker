import { type RecentTransaction } from "../type";
import RecentTransactionItem from "./RecentTransactionItem";

type TransactionsType = { transactions: RecentTransaction[] };

function RecentTransactions({ transactions }: TransactionsType) {
  return (
    <div className="flex flex-col gap-1">
      {transactions.map((t) => (
        <RecentTransactionItem
          key={t.id}
          shop={t.name}
          category={t.categoryName}
          date={t.date}
          amount={t.amount}
        />
      ))}
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
