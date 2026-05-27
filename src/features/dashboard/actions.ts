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
  type SpendingByCategory,
  type DashboardAccount,
} from "./type";
import { DashboardDateRange, getDashboardDateRange } from "@/lib/dateRanges";

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
  range: DashboardDateRange,
): Promise<TransactionRow[]> {
  // get this month expenses
  // I am supposed to put .gte("posted_at", firstDayOfMonth.toISOString()) but for demonstrorate purpose
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select(
      "id, account_id, category_id, posted_at, amount, merchant, note, category:categories(name, kind)",
    )
    .eq("user_id", user.id)
    .or("is_removed.is.null,is_removed.eq.false")
    .lt("amount", 0)
    .gte("posted_at", "2026-04-23 00:00:00+00")
    .lt("posted_at", range.nextMonthStartIso)
    .order("posted_at", { ascending: false });

  if (error) {
    console.error(error); // 'time zone "gmt-0800" not recognized'
    throw new Error("Failed to fetch monthly expenses");
  }

  return (transactions ?? []) as unknown as TransactionRow[]; // data cab be []
}

async function getThisMonthIncome(
  user: User,
  supabase: SupabaseClient,
  range: DashboardDateRange,
): Promise<Transaction[]> {
  const { data: income, error } = await supabase
    .from("transactions")
    .select("id, account_id, category_id, posted_at, amount, merchant, note")
    .eq("user_id", user.id)
    .or("is_removed.is.null,is_removed.eq.false")
    .gt("amount", 0)
    .gte("posted_at", range.monthStartIso)
    .lt("posted_at", range.nextMonthStartIso)
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
  range: DashboardDateRange,
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
  // .gte("posted_at", range.monthStartIso)
  // .lt("posted_at", range.nextMonthStartIso)
  if (error) {
    throw new Error("Failed to fetch recent transactions");
  }

  return (recentTransactions ?? []) as unknown as TransactionRow[];
}

// get today's expenses
async function getTodayExpenses(
  user: User,
  supabase: SupabaseClient,
  range: DashboardDateRange,
) {
  const { data, error } = await supabase.rpc("get_daily_expenses", {
    start_ts: range.todayStartIso,
  });
  console.log(data);
  // const { data: todayExpensesArr, error } = await supabase
  //   .from("transactions")
  //   .select("amount.sum()")
  //   .eq("user_id", user.id)
  //   .lt("amount", 0)
  //   .gte("posted_at", midnight);

  if (error) {
    console.error(error);
    throw new Error("Failed to fetch today's expenses");
  }

  return data;
}

// get total monthly expenses
async function getTotalMonthlyExpenses(
  user: User,
  supabase: SupabaseClient,
  range: DashboardDateRange,
): Promise<number> {
  // here rpc is created and calling that rpc

  const { data, error } = await supabase.rpc("get_monthly_expense_total", {
    start_ts: range.monthStartIso,
    end_ts: range.nextMonthStartIso,
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

// Get spendings by category
async function getSpendingByCategory(
  user: User,
  supabase: SupabaseClient,
  range: DashboardDateRange,
): Promise<SpendingByCategory[]> {
  // [ { categoryName:string, amount: number, percentage: number }...  ]

  // this return [] of TransactionRow
  // You only need this 1 db query
  const thisMonthSpendings = await getThisMonthExpenses(user, supabase, range);

  const categAmountMap = new Map<string, number>();

  // creating a map for each category: { "Food", 40... } etc
  for (const spending of thisMonthSpendings) {
    const categName = spending.category?.name ?? "Uncategorized";

    const currentAmount = categAmountMap.get(categName) ?? 0;

    categAmountMap.set(categName, currentAmount + Math.abs(spending.amount));
  }

  const totalThisMonthSpendingAmount = Array.from(
    categAmountMap.values(),
  ).reduce((sum, cur) => sum + cur, 0);

  const result = Array.from(categAmountMap.entries())
    .map(([categName, amount]) => ({
      categoryName: categName,
      amount: amount,
      percentage:
        totalThisMonthSpendingAmount === 0
          ? 0
          : Math.round((amount / totalThisMonthSpendingAmount) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);

  return result;
}

async function getDashboardAccounts(
  user: User,
  supabase: SupabaseClient,
): Promise<DashboardAccount[]> {
  type AccountRow = {
    id: string;
    name: string | null;
    type: string | null;
    subtype: string | null;
    is_active: boolean;
    mask: string | null;
    plaid_item: { institution_name: string | null } | null;
  };

  const { data: accountsData, error: accountsError } = await supabase
    .from("accounts")
    .select(
      "id, name, type, subtype, is_active, mask, plaid_item:plaid_items(institution_name)",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (accountsError) {
    throw new Error("Failed to fetch accounts");
  }

  const accountRows = (accountsData ?? []) as unknown as AccountRow[];

  const result = accountRows.map((account) => ({
    id: account.id,
    name: account.name ?? "Unknown account",
    type: account.type,
    subtype: account.subtype,
    mask: account.mask,
    isActive: account.is_active,
    institutionName: account.plaid_item?.institution_name ?? null,
  }));

  return result;
}

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

  const range = getDashboardDateRange("America/Vancouver");

  const [
    monthlyIncome,
    recentTransactions,
    monthlyTotal,
    todayTotal,
    spendingByCategory,
    dashboardAccounts,
  ] = await Promise.all([
    getThisMonthIncome(user, supabase, range),
    getRecentTransactions(user, supabase, range),
    getTotalMonthlyExpenses(user, supabase, range),
    getTodayExpenses(user, supabase, range),
    getSpendingByCategory(user, supabase, range),
    getDashboardAccounts(user, supabase),
  ]);

  return {
    ok: true,
    hasPlaidItems: true,
    stats: {
      monthlySpending: monthlyTotal,
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
    spendingByCategory,
    accounts: dashboardAccounts,
  };
}
