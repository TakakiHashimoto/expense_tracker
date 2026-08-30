import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import {
  TransactionDetail,
  TransactionFilters,
  TransactionsPageData,
} from "./types";

type TransactionQueryRowType = {
  id: string;
  amount: number | string;
  merchant: string | null;
  name: string | null;
  posted_date: string;
  category_id: string | null;
  category: { name: string | null; kind: "income" | "expense" | null } | null;
  account: {
    name: string | null;
    plaid_item: { institution_name: string | null } | null;
  } | null;
};

type TransactionDetailQueryRow = {
  id: string;
  amount: number | string;
  merchant: string | null;
  note: string | null;
  name: string | null;

  posted_date: string;
  posted_datetime: string | null;

  payment_channel: string | null;
  pending: boolean;

  category: {
    id: string;
    name: string | null;
    kind: "income" | "expense" | null;
  } | null;

  institution_name: { institution_name: string | null } | null;

  account: { name: string | null; type: string; mask: number } | null;
};

type ArgumentType = { filters: TransactionFilters; q: string };

export async function getTransactionPageData({
  filters,
  q,
}: ArgumentType): Promise<TransactionsPageData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  const shouldFilterCategoryKind =
    filters.type === "income" || filters.type === "expense";

  const categorySelect = shouldFilterCategoryKind
    ? "category: categories!inner(name, kind)"
    : "category: categories(name, kind)";

  const sortColumnName =
    filters.sort === "amount_asc" || filters.sort === "amount_desc"
      ? "amount"
      : "posted_date";
  const sortOrder =
    filters.sort === "amount_asc" || filters.sort === "date_asc"
      ? { ascending: true }
      : { ascending: false };

  // shape the query first before actually fetching data
  let query = supabase
    .from("transactions")
    .select(
      `id, name, merchant, amount, posted_date, category_id, ${categorySelect}, account: accounts(name, plaid_item: plaid_items(institution_name))`,
    )
    .eq("user_id", user.id)
    .eq("is_removed", false);

  if (q) {
    query = query.or(`name.ilike.%${q}%,merchant.ilike.%${q}%`);
  }

  if (filters.type === "uncategorized") {
    query = query.is("category_id", null);
  }

  if (filters.type === "income") {
    query = query.eq("category.kind", "income");
  }

  if (filters.type === "expense") {
    query = query.eq("category.kind", "expense");
  }

  const { data: transactionData, error: transactionError } = await query
    .order(sortColumnName, sortOrder)
    .limit(50)
    .returns<TransactionQueryRowType[]>();

  if (transactionError) {
    console.error("Failed to fetch transactions", transactionError);
    return { ok: false, error: "Failed to fetch transactions" };
  }

  const result = transactionData.map((t) => ({
    id: t.id,
    name: t.name ?? "Unknown",
    merchant: t.merchant ?? "Unknown merchant",
    amount: Number(t.amount),
    postedDate: t.posted_date,
    categoryId: t.category_id,
    categoryName: t.category?.name ?? null,
    categoryKind: t.category?.kind ?? null,
    accountName: t.account?.name ?? null,
    institutionName: t.account?.plaid_item?.institution_name ?? null,
  }));

  return { ok: true, transactions: result };
}

export async function getTransactionDetail(transactionId: string) {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  const { data: transactionData, error: transactionError } = await supabase
    .from("transactions")
    .select(
      "id, amount, merchant, note, name, payment_channel, posted_date, posted_datetime, pending, category: categories(id, name, kind), institution_name: plaid_items(institution_name), account: accounts(name, type, mask)",
    )
    .eq("user_id", user.id)
    .eq("id", transactionId)
    .eq("is_removed", false)
    .single()
    .returns<TransactionDetailQueryRow>();

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

    category: transactionData.category,

    institutionName: transactionData.institution_name?.institution_name ?? null,

    account: transactionData.account
      ? {
          name: transactionData.account.name,
          type: transactionData.account.type,
          mask: transactionData.account.mask,
        }
      : null,
  };

  return { transaction, categories: categData };
}
