import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import { TransactionsPageData } from "./types";

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
  amount: number | string;
  posted_at: string;
  category: { name: string | null; kind: "income" | "expense" | null } | null;
  account: {
    name: string | null;
    plaid_item: { institution_name: string | null } | null;
  } | null;
};

export async function getTransactionPageData(): Promise<TransactionsPageData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);
  const { data: transactionData, error: transactionError } = await supabase
    .from("transactions")
    .select(
      "id, merchant, amount, posted_at, category: categories(name, kind), account: accounts(name, plaid_item: plaid_items(institution_name))",
    )
    .eq("user_id", user.id)
    .eq("is_removed", false)
    .order("posted_at", { ascending: false })
    .limit(50)
    .returns<TransactionQueryRowType[]>();

  if (transactionError) {
    console.error("Failed to fetch transactions", transactionError);
    return { ok: false, error: "Failed to fetch transactiondata" };
  }

  const result = transactionData.map((t) => ({
    id: t.id,
    name: t.merchant ?? "Unknown merchant",
    amount: Number(t.amount),
    date: t.posted_at,
    categoryName: t.category?.name ?? null,
    categoryKind: t.category?.kind ?? null,
    accountName: t.account?.name ?? null,
    institutionName: t.account?.plaid_item?.institution_name ?? null,
  }));

  return { ok: true, transactions: result };
}
