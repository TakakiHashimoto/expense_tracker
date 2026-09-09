import { getBudgets } from "@/features/budgets/actions";
import BudgetDisplayPageClient from "@/features/budgets/pages/BudgetDisplayPageClient";
import { getDashboardDateRange } from "@/lib/dateRanges";
import { redirect } from "next/navigation";

function parseBudgetMonthParam(input: string): string | null {
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

async function page({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  // get month from params and pass it to getBudgets(month)
  const params = await searchParams;
  const selectedMonth = params.month;

  const range = getDashboardDateRange();
  const thisMonthStart = range.monthStartDate.slice(0, 7); // 2026-09

  if (typeof selectedMonth !== "string" || !selectedMonth) {
    redirect(`/budgets?month=${thisMonthStart}`);
  }

  const budgetMonth = parseBudgetMonthParam(selectedMonth);
  // if undefined, this month
  if (!budgetMonth) {
    redirect(`/budgets?month=${thisMonthStart}`);
  }

  const res = await getBudgets(budgetMonth);
  if (!res.ok) {
    return (
      <div>
        <p>{res.error}</p>
      </div>
    );
  }

  return <BudgetDisplayPageClient budgets={res.data} month={selectedMonth} />;
}

export default page;
