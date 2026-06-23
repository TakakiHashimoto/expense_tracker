import { formatAmount } from "@/lib/formatValue";
import {
  TransactionFilters,
  TransactionItem,
  TransactionsPageData,
} from "../types";
import TransactionStats from "../components/TransactionStats";
import TransactionByDate from "../components/TransactionByDate";
import Link from "next/link";
import Search from "../components/Search";
import TransactionTypeFilter from "../components/TransactionTypeFilter";
import TransactionSort from "../components/TransactionSort";

type Props = {
  transactions: TransactionsPageData;
  filters: TransactionFilters;
};

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
    <div className="pt-15 pb-20 px-10 max-w-7xl mx-auto space-y-10">
      <Link href="/dashboard">GO BACK</Link>
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
        <Search placeholder="Search..." />
        <TransactionSort sort={filters.sort} />
        <TransactionTypeFilter filterType={filters.type} />
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
