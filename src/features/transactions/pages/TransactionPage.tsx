import { formatAmount, formatValue } from "@/lib/formatValue";
import {
  TransactionFilters,
  TransactionItem,
  TransactionsPageData,
} from "../types";
import TransactionStats from "../components/TransactionStats";
import TransactionByDate from "../components/TransactionByDate";
import Search from "../components/Search";
import TransactionTypeFilter from "../components/TransactionTypeFilter";
import TransactionSort from "../components/TransactionSort";
import Link from "next/link";
import { Calendar, CircleChevronLeft, CircleChevronRight } from "lucide-react";

type Props = {
  transactions: TransactionsPageData;
  filters: TransactionFilters;
  month: string;
  q: string;
};

type Title = "Net" | "Income" | "Spending";

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

function getNextMonth(input: string) {
  // We want "2026-09" like this
  const [year, month] = input.split("-");
  const nextMonth = Number(month) + 1;

  if (nextMonth > 12) {
    return `${Number(year) + 1}-01`;
  }

  return `${year}-${String(nextMonth).padStart(2, "0")}`;
}

function getPrevMonth(input: string) {
  const [year, month] = input.split("-");
  const nextMonth = Number(month) - 1;

  if (nextMonth < 1) {
    return `${Number(year) - 1}-12`;
  }

  return `${year}-${String(nextMonth).padStart(2, "0")}`;
}

function formatDate(input: string) {
  const [year, month] = input.split("-");
  const displayMonth = dateMonthMap[month];
  return `${displayMonth} ${year}`;
}

function convertDate(postedDate: string) {
  const [, monthNum, day] = postedDate.split("-");
  const month = dateMonthMap[monthNum] ?? monthNum; // May
  return `${month}, ${day}`;
}

function TransactionPageClient({ transactions, filters, month, q }: Props) {
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

  function buildMonthHref(targetMonth: string) {
    const params = new URLSearchParams();

    params.set("month", targetMonth);

    if (filters.type !== "all") {
      params.set("type", filters.type);
    }

    if (filters.sort !== "date_desc") {
      params.set("sort", filters.sort);
    }

    if (q) {
      params.set("q", q);
    }

    // EX) month=2026-09&type=expense&sort=amount_desc&q=coffee
    return `/transactions?${params.toString()}`;
  }

  const transactionData = transactions.transactions;

  const dateMap = new Map<string, TransactionItem[]>();

  for (const transaction of transactionData) {
    const postedDate = transaction.postedDate;

    const currentGroup = dateMap.get(postedDate) ?? [];
    currentGroup.push(transaction);

    dateMap.set(postedDate, currentGroup);
  }

  const transactionStatsMap: { title: Title; amount: string }[] = [
    { title: "Net", amount: formatValue(transactions.summary.net, "money") },
    { title: "Income", amount: formatAmount(transactions.summary.income) },
    { title: "Spending", amount: formatAmount(transactions.summary.expense) },
  ];

  const prevMonth = getPrevMonth(month);
  const nextMonth = getNextMonth(month);
  const formattedDate = formatDate(month);

  const hasActiveFilter = q !== "" || filters.type !== "all";

  return (
    <div className="pt-20 px-4 pb-20 max-w-7xl mx-auto space-y-10 lg:pt-15 lg:pl-70 lg:pr-10">
      <section>
        <h1 className="text-4xl font-black tracking-tight text-on-surface">
          Transactions
        </h1>
        <p className="text-on-surface-variant mt-2 text-lg">
          Review your income, spending, and transactions for{" "}
          <span className="text-on-surface font-bold text-2xl">
            {formattedDate}
          </span>
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
      <section className="flex flex-col gap-6 items-center justify-between">
        <div className="flex lg:flex-row flex-col justify-between items-center w-full gap-3">
          <div className="flex items-center gap-1 bg-surface-container-low border border-white/10 rounded-xl p-1.5 shadow-sm w-full justify-center">
            <Link
              href={buildMonthHref(prevMonth)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
              aria-label="Previous Month"
            >
              <CircleChevronLeft className="material-symbols-outlined text-[20px]" />
            </Link>
            <Link
              href={buildMonthHref(month)}
              className="flex items-center gap-2 px-3"
            >
              <Calendar className="material-symbols-outlined text-primary text-[18px]" />
              <span className="font-label-bold text-label-bold text-on-surface tracking-wide uppercase">
                {formattedDate}
              </span>
            </Link>
            <Link
              href={buildMonthHref(nextMonth)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-muted hover:text-on-surface hover:bg-surface-container-high transition-colors"
              aria-label="Next Month"
            >
              <CircleChevronRight className="material-symbols-outlined text-[20px]" />
            </Link>
          </div>
          <Search placeholder="Search..." />
        </div>
        <div className="flex gap-2 flex-col lg:flex-row justify-center items-center">
          <TransactionSort sort={filters.sort} />
          <TransactionTypeFilter filterType={filters.type} />
        </div>
      </section>
      {transactionData.length === 0 ? (
        <section className="rounded-2xl bg-surface-container-low p-8">
          <p className="text-on-surface-variant">
            {hasActiveFilter
              ? "No transactions match"
              : "No transactions found for this month"}
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {Array.from(dateMap.entries()).map(
            ([key, value]) =>
              value.length > 0 && (
                <TransactionByDate
                  key={key}
                  convertedDate={convertDate(key)}
                  transactions={value}
                />
              ),
          )}
        </section>
      )}
    </div>
  );
}

export default TransactionPageClient;
