import { getTransactionPageData } from "@/features/transactions/actions";
import TransactionPageClient from "@/features/transactions/pages/TransactionPage";
import {
  parseTransactionTypeFilter,
  parseTransactionTypeSort,
} from "@/features/transactions/types";
import { getDashboardDateRange } from "@/lib/dateRanges";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{
    type?: string;
    q?: string;
    sort?: string;
    month?: string | string[];
  }>;
};

function parseMonthParam(input: string): string | null {
  // validate YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(input)) {
    return null;
  }
  // validate month 01-12
  const [year, month] = input.split("-");
  //year is 1 < year < 9999 and 01 < month < 12
  const numYear = Number(year);
  const numMonth = Number(month);

  // validate year
  if (numYear < 1 || numYear > 9999) {
    return null;
  }

  // validate month
  if (!(numMonth <= 12 && numMonth >= 1)) {
    return null;
  }

  const displayMonth = numMonth;

  return `${year}-${String(displayMonth).padStart(2, "0")}-01`;
}

async function TransactionPage({ searchParams }: Props) {
  // This is how Nexjs catches the params
  const params = await searchParams;
  const filters = {
    type: parseTransactionTypeFilter(params.type),
    sort: parseTransactionTypeSort(params.sort),
  };

  const normalizedQuery = params.q?.trim().toLowerCase() || "";

  const selectedMonth = params.month;

  const range = getDashboardDateRange();
  const thisMonthStart = range.monthStartDate.slice(0, 7); // 2026-09

  if (typeof selectedMonth !== "string" || !selectedMonth) {
    redirect(`/transactions?month=${thisMonthStart}`);
  }

  const transactionMonth = parseMonthParam(selectedMonth);
  // if undefined, this month
  if (!transactionMonth) {
    redirect(`/transactions?month=${thisMonthStart}`);
  }

  const transactions = await getTransactionPageData({
    filters,
    q: normalizedQuery,
    month: transactionMonth,
  });

  return (
    <TransactionPageClient
      transactions={transactions}
      filters={filters}
      month={selectedMonth}
      q={normalizedQuery}
    />
  );
}

export default TransactionPage;
