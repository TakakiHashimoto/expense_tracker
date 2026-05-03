// 1. get logged in user => if !user, redirect them to login page
// 2. create "getDashboardData()", which is accumulative of many functions.
//    - getThisMonthExpenses(), getThisMonthIncome(), getTodayExpenses() etc
// 3. get expenses by category

"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SupabaseClient, type User } from "@supabase/supabase-js";
import {
  type Transaction,
  type DashboardData,
  type TransactionRow,
} from "./type";

export async function grabUser(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(); // getting a user using JWT

  if (error) {
    throw new Error("User not found");
  }
  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 *
 * @param user
 * @param supabase
 * @param firstDayOfMonth
 * @param firstDayOfNextMonth
 * @returns array of { account_id: string; category_id: string; posted_at: string; amount: number; merchant: string; note: string;} ;
 */
async function getThisMonthExpenses(
  user: User,
  supabase: SupabaseClient,
  firstDayOfMonth: Date,
  firstDayOfNextMonth: Date,
): Promise<Transaction[]> {
  // get this month expenses
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("id, account_id, category_id, posted_at, amount, merchant, note")
    .eq("user_id", user.id)
    .lt("amount", 0)
    .gte("posted_at", firstDayOfMonth.toISOString())
    .lt("posted_at", firstDayOfNextMonth.toISOString())
    .order("posted_at", { ascending: false });

  if (error) {
    console.log(error); // 'time zone "gmt-0800" not recognized'
    throw new Error("Failed to fetch monthly expenses");
  }

  return transactions ?? []; // data cab be []
}

async function getThisMonthIncome(
  user: User,
  supabase: SupabaseClient,
  firstDayOfMonth: Date,
  firstDayOfNextMonth: Date,
): Promise<Transaction[]> {
  const { data: income, error } = await supabase
    .from("transactions")
    .select("id, account_id, category_id, posted_at, amount, merchant, note")
    .eq("user_id", user.id)
    .gt("amount", 0)
    .gte("posted_at", firstDayOfMonth.toISOString())
    .lt("posted_at", firstDayOfNextMonth.toISOString())
    .order("posted_at", { ascending: false });

  if (error) {
    throw new Error("Failed to fetch this month income");
  }

  return income ?? [];
}

// get recent transactions
async function getRecentTransactions(
  user: User,
  supabase: SupabaseClient,
  firstDayOfMonth: Date,
  firstDayOfNextMonth: Date,
): Promise<TransactionRow[]> {
  const { data: recentTransactions, error } = await supabase
    .from("transactions")
    .select(
      "id, account_id, category_id, posted_at, amount, merchant, note,category:categories (name, kind)",
    )
    .eq("user_id", user.id)
    .or("is_removed.is.null,is_removed.eq.false")
    .order("posted_at", { ascending: false })
    .limit(20);

  // later add
  // .gte("posted_at", firstDayOfMonth.toISOString())
  // .lt("posted_at", firstDayOfNextMonth.toISOString())
  if (error) {
    throw new Error("Failed to fetch recent transactions");
  }

  console.log("recent transaction sample:", recentTransactions?.[0]);

  return (recentTransactions ?? []) as unknown as TransactionRow[];
}

// get today's expenses
async function getTodayExpenses(
  user: User,
  supabase: SupabaseClient,
  today: Date,
) {
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);
  const { data, error } = await supabase.rpc("get_daily_expenses", {
    start_ts: midnight.toISOString(),
  });
  console.log(data);
  // const { data: todayExpensesArr, error } = await supabase
  //   .from("transactions")
  //   .select("amount.sum()")
  //   .eq("user_id", user.id)
  //   .lt("amount", 0)
  //   .gte("posted_at", midnight);

  if (error) {
    console.log(error);
    throw new Error("Failed to fetch today's expenses");
  }

  return data;
}

// get total monthly expenses
async function getTotalMonthlyExpenses(
  user: User,
  supabase: SupabaseClient,
  firstDayOfMonth: Date,
  firstDayOfNextMonth: Date,
): Promise<number> {
  // here rpc is created and calling that rpc
  console.log(firstDayOfMonth.toISOString(), firstDayOfNextMonth.toISOString());
  const { data, error } = await supabase.rpc("get_monthly_expense_total", {
    start_ts: firstDayOfMonth.toISOString(),
    end_ts: firstDayOfNextMonth.toISOString(),
  });
  // const { data: monthlyExpenses, error } = await supabase
  //   .from("transactions")
  //   .select("amount.sum()")
  //   .eq("user_id", user.id)
  //   .lt("amount", 0)
  //   .gte("posted_at", firstDayOfMonth.toISOString())
  //   .lt("posted_at", firstDayOfNextMonth.toISOString());

  if (error) {
    throw new Error("Failed to fetch this month expenses");
  }

  // const totalExpenses = monthlyExpenses.reduce((sum, cur) => sum + cur.sum, 0);

  return data ?? 0;
}

// TODO: make sure to specify return value
export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  const { count, error: plaidItemsError } = await supabase
    .from("plaid_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (plaidItemsError) {
    return { ok: false, error: plaidItemsError.message };
  }

  if ((count ?? 0) === 0) {
    return { ok: true, hasPlaidItems: false };
  }

  const today = new Date(); // server time => What's wrong with server time?
  const firstDayOfMonth = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), 1),
  );
  const firstDayOfNextMonth = new Date(
    Date.UTC(today.getFullYear(), today.getMonth() + 1, 1),
  );

  const [
    monthlyExpenses,
    monthlyIncome,
    recentTransactions,
    monthlyTotoal,
    todayTotal,
  ] = await Promise.all([
    getThisMonthExpenses(user, supabase, firstDayOfMonth, firstDayOfNextMonth),
    getThisMonthIncome(user, supabase, firstDayOfMonth, firstDayOfNextMonth),
    getRecentTransactions(user, supabase, firstDayOfMonth, firstDayOfNextMonth),
    getTotalMonthlyExpenses(
      user,
      supabase,
      firstDayOfMonth,
      firstDayOfNextMonth,
    ),
    getTodayExpenses(user, supabase, today),
  ]);

  return {
    ok: true,
    hasPlaidItems: true,
    stats: {
      monthlySpending: monthlyTotoal,
      monthlyIncome: monthlyIncome.reduce((acc, cur) => acc + cur.amount, 0),
      todayTotal: todayTotal,
      recentActivities: recentTransactions.length,
    },
    recentTransactions: recentTransactions.map((tran) => {
      return {
        id: tran.id,
        name: tran.merchant ?? "Unknown Merchant",
        amount: tran.amount,
        date: tran.posted_at,
        categoryName: tran.category?.name ?? null,
        categoryKind: tran.category?.kind ?? null,
      };
    }),
  };
}
