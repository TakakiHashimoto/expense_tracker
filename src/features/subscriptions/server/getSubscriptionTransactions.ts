import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

export type SubscriptionDbRow = Pick<
  TransactionRow,
  | "id"
  | "account_id"
  | "merchant"
  | "amount"
  | "posted_date"
  | "pending"
  | "is_removed"
> & { account: { currency: string } | null };

const PAGE_SIZE = 500;

export async function getSubscriptionTransactions(
  fromDate: string,
): Promise<SubscriptionDbRow[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const transactions: SubscriptionDbRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        `
        id,
        account_id,
        merchant,
        amount,
        posted_date,
        pending,
        is_removed,
        account:accounts!transactions_user_id_account_id_fkey(
          currency
        )
      `,
      )
      .eq("user_id", user.id)
      .eq("pending", false)
      .eq("is_removed", false)
      .lt("amount", 0)
      .gte("posted_date", fromDate)
      .order("posted_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    transactions.push(...data);

    if (data.length < PAGE_SIZE) {
      break;
    }
  }

  return transactions;
}
