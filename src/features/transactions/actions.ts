import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import {
  TransactionDetail,
  TransactionFilters,
  TransactionsPageData,
  CategoryType,
  TransactionItem,
} from "./types";

type TransactionDetailReturn = {
  transaction: TransactionDetail;
  categories: CategoryType[];
};

type ArgumentType = { filters: TransactionFilters; q: string; month: string };

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
    throw new Error(`Invalid month: ${input}`);
  }

  if (numMonth === 12) {
    if (numYear === 9999) {
      throw new Error("Month exceeds supported year range");
    }
    const nextYear = String(numYear + 1).padStart(4, "0");
    return `${nextYear}-01-01`;
  }

  const displayMonth = numMonth + 1;

  return `${year}-${String(displayMonth).padStart(2, "0")}-01`;
}

export async function getTransactionPageData({
  filters,
  q,
  month,
}: ArgumentType): Promise<TransactionsPageData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  if (!isValidMonthDate(month)) {
    return { ok: false, error: "Invalid month" };
  }

  const sortColumnName =
    filters.sort === "amount_asc" || filters.sort === "amount_desc"
      ? "amount"
      : "posted_date";
  const sortOrder =
    filters.sort === "amount_asc" || filters.sort === "date_asc"
      ? { ascending: true }
      : { ascending: false };

  const nextMonthStart = getNextMonthStart(month);

  const { data: monthlyTransactionData, error: monthlyTransactionError } =
    await supabase
      .from("transactions")
      .select("amount")
      .eq("user_id", user.id)
      .eq("is_removed", false)
      .gte("posted_date", month)
      .lt("posted_date", nextMonthStart);

  if (monthlyTransactionError) {
    console.error(
      "Failed to fetch monthly transaction summary",
      monthlyTransactionError,
    );

    return { ok: false, error: "Failed to fetch transaction summary" };
  }

  let income = 0;
  let expense = 0;
  let net = 0;

  for (const transaction of monthlyTransactionData) {
    const amount = Number(transaction.amount);

    net += amount;

    if (amount > 0) {
      income += amount;
    } else if (amount < 0) {
      expense += Math.abs(amount);
    }
  }

  // shape the query first before actually fetching data
  let query = supabase
    .from("transactions")
    .select(
      `id, name, merchant, amount, posted_date, category_id, category: categories(name, kind), account: accounts!transactions_user_id_account_id_fkey(name, plaid_item: plaid_items!accounts_user_id_plaid_item_id_fkey(institution_name))`,
    )
    .eq("user_id", user.id)
    .eq("is_removed", false)
    .gte("posted_date", month)
    .lt("posted_date", nextMonthStart);

  if (q) {
    query = query.or(`name.ilike.%${q}%,merchant.ilike.%${q}%`);
  }

  if (filters.type === "uncategorized") {
    query = query.is("category_id", null);
  }

  if (filters.type === "income") {
    query = query.gt("amount", 0);
  }

  if (filters.type === "expense") {
    query = query.lt("amount", 0);
  }

  const { data: transactionData, error: transactionError } = await query.order(
    sortColumnName,
    sortOrder,
  );

  if (transactionError) {
    console.error("Failed to fetch transactions", transactionError);
    return { ok: false, error: "Failed to fetch transactions" };
  }

  const result = transactionData.map((t): TransactionItem => {
    const categoryKind = t.category?.kind ?? null;

    if (
      categoryKind !== null &&
      categoryKind !== "income" &&
      categoryKind !== "expense"
    ) {
      throw new Error(
        `Transaction ${t.id} has invalid category kind: ${categoryKind}`,
      );
    }

    return {
      id: t.id,
      name: t.name ?? "Unknown",
      merchant: t.merchant ?? "Unknown merchant",
      amount: Number(t.amount),
      postedDate: t.posted_date,
      categoryId: t.category_id,
      categoryName: t.category?.name ?? null,
      categoryKind,
      accountName: t.account?.name ?? null,
      institutionName: t.account?.plaid_item?.institution_name ?? null,
    };
  });

  return { ok: true, transactions: result, summary: { income, expense, net } };
}

export async function getTransactionDetail(
  transactionId: string,
): Promise<TransactionDetailReturn> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  const { data: transactionData, error: transactionError } = await supabase
    .from("transactions")
    .select(
      "id, amount, merchant, note, name, payment_channel, posted_date, posted_datetime, pending, category: categories(id, name, kind), institution_name: plaid_items!transactions_user_id_plaid_item_id_fkey(institution_name), account: accounts!transactions_user_id_account_id_fkey(name, type, mask)",
    )
    .eq("user_id", user.id)
    .eq("id", transactionId)
    .eq("is_removed", false)
    .single();

  if (!transactionData || transactionError) {
    console.error("Failed to fetch transaction data", transactionError);
    throw new Error("Failed to fetch transaction data");
  }

  const { data: categData, error: categError } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("user_id", user.id);

  if (!categData || categError) {
    console.error("Failed to fetch categories", categError);
    throw new Error("Failed to fetch categories");
  }

  const categories: CategoryType[] = categData.map((category) => {
    if (category.kind !== "income" && category.kind !== "expense") {
      throw new Error(
        `Category ${category.id} has invalid kind: ${category.kind}`,
      );
    }

    return { id: category.id, name: category.name, kind: category.kind };
  });

  let transactionCategory: TransactionDetail["category"] = null;

  if (transactionData.category) {
    const kind = transactionData.category.kind;

    if (kind !== "income" && kind !== "expense") {
      throw new Error(
        `Transaction ${transactionData.id} has invalid category kind: ${kind}`,
      );
    }

    transactionCategory = {
      id: transactionData.category.id,
      name: transactionData.category.name,
      kind,
    };
  }

  const transaction: TransactionDetail = {
    id: transactionData.id,
    amount: Number(transactionData.amount),
    merchant: transactionData.merchant,
    note: transactionData.note,
    name: transactionData.name,

    postedDate: transactionData.posted_date,
    postedDatetime: transactionData.posted_datetime,

    paymentChannel: transactionData.payment_channel,
    pending: transactionData.pending,

    category: transactionCategory,

    institutionName: transactionData.institution_name?.institution_name ?? null,

    account: transactionData.account
      ? {
          name: transactionData.account.name,
          type: transactionData.account.type,
          mask: transactionData.account.mask,
        }
      : null,
  };

  return { transaction, categories };
}
