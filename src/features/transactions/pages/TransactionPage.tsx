import { formatAmount } from "@/lib/formatValue";
import {
  TransactionFilters,
  TransactionItem,
  TransactionsPageData,
} from "../types";
import TransactionStats from "../components/TransactionStats";
import TransactionByDate from "../components/TransactionByDate";
import Link from "next/link";

type Props = {
  transactions: TransactionsPageData;
  filters: TransactionFilters;
};

// {
//   id: string;
//   name: string;
//   amount: number;
//   date: string;
//   categoryName: string | null;
//   categoryKind: "income" | "expense" | null;
//   accountName: string | null;
//   institutionName: string | null;
// };

const activeFilterClass = "bg-surface-container-highest text-primary";

const inactiveFilterClass = "text-on-surface-variant hover:text-on-surface";

const dateMonthMap: Record<string, string> = {
  "01": "Jan",
  "02": "Feb",
  "03": "Mar",
  "04": "Apr",
  "05": "May",
  "06": "Jun",
  "07": "Jul",
  "08": "Aug",
  "09": "Sep",
  "10": "Oct",
  "11": "Nov",
  "12": "Dec",
};

function TransactionPageClient({ transactions, filters }: Props) {
  if (!transactions.ok) {
    return (
      <div className="pt-32 pb-20 px-10 max-w-7xl mx-auto">
        <h1 className="text-4xl font-black tracking-tight text-on-surface">
          Transactions
        </h1>
        <p className="mt-4 text-tertiary">{transactions.error}</p>
      </div>
    );
  }

  function convertDate(date: string) {
    const extractedDate = date.split("T")[0];
    const [, monthNum, day] = extractedDate.split("-");
    const month = dateMonthMap[monthNum] ?? monthNum; // May
    return `${month}, ${day}`;
  }

  const transactionData = transactions.transactions;

  const dateMap = new Map<string, TransactionItem[]>();

  for (const transaction of transactionData) {
    const convertedDate = convertDate(transaction.date);

    const currentGroup = dateMap.get(convertedDate) ?? [];
    currentGroup.push(transaction);

    dateMap.set(convertedDate, currentGroup);
  }

  const totalActivityAmount = transactionData.reduce(
    (sum, cur) => sum + Math.abs(cur.amount),
    0,
  );

  const totalIncome = transactionData.filter(
    (t) => t.categoryKind === "income",
  );
  const totalIncomeAmount = totalIncome.reduce(
    (sum, cur) => sum + Math.abs(cur.amount),
    0,
  );

  const totalExpense = transactionData.filter(
    (t) => t.categoryKind === "expense",
  );
  const totalExpenseAmount = totalExpense.reduce(
    (sum, cur) => sum + Math.abs(cur.amount),
    0,
  );

  type Title = "Total Activity" | "Total Income" | "Total Expense";

  const transactionStatsMap: { title: Title; amount: string }[] = [
    { title: "Total Activity", amount: formatAmount(totalActivityAmount) },
    { title: "Total Income", amount: formatAmount(totalIncomeAmount) },
    { title: "Total Expense", amount: formatAmount(totalExpenseAmount) },
  ];

  return (
    <div className="pt-32 pb-20 px-10 max-w-7xl mx-auto space-y-10">
      <section>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">
          Transactions
        </h1>
        <p className="text-on-surface-variant mt-2 text-lg">
          Your latest account activity across all linked assets.
        </p>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {transactionStatsMap.map((item) => (
          <TransactionStats
            key={item.title}
            title={item.title}
            amount={item.amount}
          />
        ))}
      </section>
      <section className="flex flex-col md:flex-row gap-6 items-end justify-between">
        <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-2 rounded-xl w-full max-w-md transition-all focus-within:bg-surface-container-low group">
          <span className="material-symbols-outlined text-on-surface-variant group-focus-within:text-primary transition-colors">
            search
          </span>
          <input
            className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full placeholder:text-on-surface-variant/40"
            placeholder="Search merchants, categories, or amounts..."
            type="text"
          />
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low p-1.5 rounded-xl">
          <Link
            href="/transactions"
            className={`px-6 py-2 rounded-lg text-sm font-semibold ${filters.type === "all" ? activeFilterClass : inactiveFilterClass} transition-all`}
          >
            All
          </Link>
          <Link
            href="/transactions?type=income"
            className={`px-6 py-2 rounded-lg text-sm font-semibold ${filters.type === "income" ? activeFilterClass : inactiveFilterClass} transition-all`}
          >
            Income
          </Link>
          <Link
            href="/transactions?type=expense"
            className={`px-6 py-2 rounded-lg text-sm font-semibold ${filters.type === "expense" ? activeFilterClass : inactiveFilterClass} transition-all`}
          >
            Expenses
          </Link>
          <Link
            href="/transactions?type=uncategorized"
            className={`px-6 py-2 rounded-lg text-sm font-semibold ${filters.type === "uncategorized" ? activeFilterClass : inactiveFilterClass} transition-all`}
          >
            Uncategorized
          </Link>
        </div>
      </section>
      {transactionData.length === 0 ? (
        <section className="rounded-2xl bg-surface-container-low p-8">
          <p className="text-on-surface-variant">
            No transactions found yet. Try syncing your bank from the dashboard.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {Array.from(dateMap.entries()).map(
            ([key, value]) =>
              value.length > 0 && (
                <TransactionByDate
                  key={key}
                  convertedDate={key}
                  transactions={value}
                />
              ),
          )}
        </section>
      )}

      {transactionData.length > 0 && (
        <footer className="flex justify-center pt-10 pb-20">
          <button className="px-10 py-4 bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-all rounded-full text-sm font-bold active:scale-95">
            View older activity
          </button>
        </footer>
      )}
    </div>
  );
}

export default TransactionPageClient;
