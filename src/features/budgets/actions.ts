"use server";

import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import {
  BudgetAnalysis,
  BudgetAnalysisReturn,
  CategoryReturnType,
} from "./types";

function isValidMonthDate(input: string) {
  // regex structure
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return false;
  }

  // split
  const [year, month, day] = input.split("-");
  // convert year/month/day
  const numYear = Number(year);
  const numMonth = Number(month);
  const numDay = Number(day);

  // validate year
  if (numYear < 1 || numYear > 9999) {
    return false;
  }

  // validate month
  if (!(numMonth <= 12 && numMonth >= 1)) {
    return false;
  }
  // require day === 1
  if (numDay !== 1) {
    return false;
  }

  return true;
}

function getNextMonthStart(input: string) {
  const [year, month, _day] = input.split("-");
  const numYear = Number(year);
  const numMonth = Number(month);

  if (!isValidMonthDate(input)) {
    throw new Error(`Invalid budget month: ${input}`);
  }

  if (numMonth === 12) {
    if (numYear === 9999) {
      throw new Error("Budget month exceeds supported year range");
    }
    const nextYear = String(numYear + 1).padStart(4, "0");
    return `${nextYear}-01-01`;
  }

  const displayMonth = numMonth + 1;

  return `${year}-${String(displayMonth).padStart(2, "0")}-01`;
}

/**
 * @params categoryId, amount, month
 */
export async function addBudget({
  categoryId,
  amount,
  month,
}: {
  categoryId: string;
  amount: number;
  month: string;
}) {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  if (!categoryId) {
    return { ok: false, error: "Category is required" };
  }

  // validate amount
  if (!Number.isFinite(amount)) {
    return { ok: false, error: "Amount must be a valid number" };
  }
  if (amount <= 0) {
    return { ok: false, error: "Amount needs to be a positive number" };
  }

  // check if category exists
  const { data: categoryData, error: categoryError } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", user.id)
    .eq("id", categoryId)
    .eq("kind", "expense")
    .single();

  if (!categoryData || categoryError) {
    console.error(categoryError);
    throw new Error("Failed to fetch category");
  }

  const validCategoryId = categoryData.id;

  // validate month
  const isValidMonth = isValidMonthDate(month);
  if (!isValidMonth) {
    return { ok: false, error: "Invalid month format" };
  }

  // add budget to database
  const { error: budgetError } = await supabase
    .from("budgets")
    .insert({
      user_id: user.id,
      category_id: validCategoryId,
      month: month,
      amount: amount,
    });

  if (budgetError) {
    if (budgetError.code === "23505") {
      return {
        ok: false,
        error: "A budget for this category already exists for this month",
      };
    }
    throw new Error("Failed to add budget");
  }

  return { ok: true };
}

export async function getCategories(): Promise<CategoryReturnType> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  const { data: categoryData, error: categoryError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("kind", "expense");

  if (!categoryData || categoryError) {
    console.error(categoryError);
    return { ok: false, error: "Failed to fetch categories" };
  }

  return { ok: true, categories: categoryData };
}

export async function getBudgets(): Promise<BudgetAnalysisReturn> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  const { data: budgetData, error: budgetError } = await supabase
    .from("budgets")
    .select("id, amount, month, category: categories(id, name, kind)")
    .eq("user_id", user.id);

  if (!budgetData || budgetError) {
    return { ok: false, error: "Failed to fetch budgets" };
  }

  const { data: transactions, error: transactionError } = await supabase
    .from("transactions")
    .select("id, category_id, amount, posted_date")
    .eq("user_id", user.id)
    .or("is_removed.is.null,is_removed.eq.false")
    .lt("amount", 0);

  if (!transactions || transactionError) {
    return { ok: false, error: "Failed to fetch transactions" };
  }

  let result: BudgetAnalysis[] = [];

  for (const budget of budgetData) {
    if (budget.category.kind !== "expense") {
      throw new Error(`Budget ${budget.id} references a non-expense category`);
    }
    // month is a date: "2026-08-01"
    const month = budget.month;
    const nextMonthStart = getNextMonthStart(month);
    const thisMonthTransactionsForCateg = transactions.filter((tra) => {
      return (
        tra.posted_date !== null &&
        tra.category_id === budget.category.id &&
        tra.posted_date >= month &&
        tra.posted_date < nextMonthStart
      );
    });

    const thisMonthSpending = thisMonthTransactionsForCateg.reduce(
      (sum, cur) => {
        return sum + Math.abs(cur.amount);
      },
      0,
    );

    const remaining = budget.amount - thisMonthSpending;
    const percentUsed =
      remaining > 0
        ? Math.floor((thisMonthSpending / budget.amount) * 100)
        : 100;

    const returnData: BudgetAnalysis = {
      id: budget.id,
      month: budget.month,
      amount: budget.amount,

      category: {
        id: budget.category.id,
        name: budget.category.name,
        kind: budget.category.kind,
      },

      spent: thisMonthSpending,
      remaining: remaining > 0 ? remaining : 0,
      percentUsed,
      isOverSpending: thisMonthSpending > budget.amount,
    };
    result.push(returnData);
  }

  return { ok: true, data: result };
}
