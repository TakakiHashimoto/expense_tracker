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

export async function getRecentTransactions(): Promise<TransactionsPageData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);
  const { data: transactionData, error: transactionError } = await supabase
    .from("transactions")
    .select(
      "id, merchant, amount, posted_at, category: categories(name, kind), account: accounts(name, plaid_item: plaid_items(institution_name))",
    )
    .eq("user_id", user.id)
    .order("posted_at", { ascending: false })
    .limit(50);

  if (transactionError) {
    console.error("Failed to fetch transactions", transactionError);
    return { ok: false, error: "Failed to fetch transactiondata" };
  }

  const result = transactionData.map((t) => ({
    id: t.id,
    name: t.merchant ?? "Unknown merchant",
    amount: Number(t.amount),
    date: t.posted_at,
    categoryName: t.category[0]?.name ?? null,
    categoryKind: t.category[0]?.kind ?? null,
    accountName: t.account[0]?.name ?? null,
    institutionName: t.account[0]?.plaid_item[0].institution_name ?? null,
  }));

  return { ok: true, transactions: result };
}
