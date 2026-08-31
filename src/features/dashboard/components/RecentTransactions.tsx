"use client";

import { useState } from "react";
import { type RecentTransaction } from "../type";
import RecentTransactionItem from "./RecentTransactionItem";

type TransactionsType = { transactions: RecentTransaction[] };

function RecentTransactions({ transactions }: TransactionsType) {
  const [showAll, setIsShowAll] = useState(false);

  const displayTransactions = showAll ? transactions : transactions.slice(0, 5);

  if (transactions.length === 0) {
    return (
      <div className="bg-surface-container-low rounded-3xl p-8">
        <h3 className="text-xl font-bold text-slate-100 mb-4">
          Recent Transactions
        </h3>
        <p className="text-sm text-on-surface-variant">
          No transactions found yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container-low rounded-3xl p-8">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-bold text-slate-100">
          Recent Transactions
        </h3>
        {transactions.length > 5 && (
          <button
            className="text-sm text-primary font-semibold hover:opacity-80 transition-opacity"
            onClick={() => setIsShowAll((prev) => !prev)}
          >
            {showAll ? "Show less" : "Show All"}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-6">
        {displayTransactions.map((t) => (
          <RecentTransactionItem
            id={t.id}
            key={t.id}
            shop={t.name}
            category={t.categoryName}
            categoryKind={t.categoryKind}
            date={t.postedDate}
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
