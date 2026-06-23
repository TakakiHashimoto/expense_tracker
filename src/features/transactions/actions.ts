import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import { TransactionFilters, TransactionsPageData } from "./types";

//   id: string;
//   name: string;
//   amount: number;
//   date: string;
//   categoryName: string | null;
//   categoryKind: "income" | "expense" | null;
//   accountName: string | null;
//   institutionName: string | null;

type TransactionQueryRowType = {
  id: string;
  merchant: string | null;
  name: string | null;
  amount: number | string;
  posted_at: string;
  category_id: string | null;
  category: { name: string | null; kind: "income" | "expense" | null } | null;
  account: {
    name: string | null;
    plaid_item: { institution_name: string | null } | null;
  } | null;
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
      : "posted_at";
  const sortOrder =
    filters.sort === "amount_asc" || filters.sort === "date_asc"
      ? { ascending: true }
      : { ascending: false };

  // shape the query first before actually fetching data
  let query = supabase
    .from("transactions")
    .select(
      `id, name, merchant, amount, posted_at, category_id, ${categorySelect}, account: accounts(name, plaid_item: plaid_items(institution_name))`,
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
    date: t.posted_at,
    categoryId: t.category_id,
    categoryName: t.category?.name ?? null,
    categoryKind: t.category?.kind ?? null,
    accountName: t.account?.name ?? null,
    institutionName: t.account?.plaid_item?.institution_name ?? null,
  }));

  return { ok: true, transactions: result };
}
