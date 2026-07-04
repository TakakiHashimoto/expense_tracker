"use server";

import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import {
  BudgetAnalysisReturn,
  BudgetsRowType,
  CategoryReturnType,
} from "./types";

function isValidMonthDate(input: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return false;
  }

  const date = new Date(`${input}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === input;
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

  if (!month.endsWith("-01")) {
    return { ok: false, error: "Month must be the first day of the month" };
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
    .eq("user_id", user.id)
    .returns<BudgetsRowType[]>();

  if (!budgetData || budgetError) {
    return { ok: false, error: "Failed to fetch budgets" };
  }

  const { data: transactions, error: transactionError } = await supabase
    .from("transactions")
    .select("id, category_id, amount, posted_at")
    .eq("user_id", user.id);

  if (!transactions || transactionError) {
    return { ok: false, error: "Failed to fetch transactions" };
  }

  let result = [];
  for (const budget of budgetData) {
    const month = budget.month.split("-")[1];
    const thisMonthTransactionsForCateg = transactions.filter((tra) => {
      return (
        tra.category_id === budget.category.id && tra.posted_at.includes(month)
      );
    });

    const thisMonthSpending = thisMonthTransactionsForCateg.reduce(
      (sum, cur) => {
        return sum + cur.amount;
      },
      0,
    );

    const remaining = budget.amount - thisMonthSpending;
    const percentUsed =
      remaining > 0
        ? Math.floor((thisMonthSpending / budget.amount) * 100)
        : 100;
    const analysis = {
      spent: thisMonthSpending,
      remaining: remaining > 0 ? remaining : 0,
      percentUsed,
      isOverSpending: percentUsed > 80 ? true : false,
    };

    const returnData = { ...budget, ...analysis };
    result.push(returnData);
  }

  console.log(result);

  return { ok: true, data: result };
}
