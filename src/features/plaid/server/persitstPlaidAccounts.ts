import { SupabaseClient } from "@supabase/supabase-js";
import { AccountBase } from "plaid";

export async function persistPlaidAccounts({
  supabase,
  userId,
  plaidItemUuid,
  accounts,
  snapshotTime,
}: {
  supabase: SupabaseClient;
  userId: string;
  plaidItemUuid: string;
  accounts: AccountBase[];
  snapshotTime: string;
}) {
  const addAccounts = accounts.map((account) => ({
    user_id: userId,
    plaid_item_id: plaidItemUuid,
    plaid_account_id: account.account_id,
    name: account.name,
    official_name: account.official_name,
    mask: account.mask,
    type: account.type,
    subtype: account.subtype,
    currency:
      account.balances.iso_currency_code ??
      account.balances.unofficial_currency_code,
    current_balance: account.balances.current,
    available_balance: account.balances.available,
    balance_as_of: snapshotTime,
    is_active: true,
  }));

  const { error } = await supabase
    .from("accounts")
    .upsert(addAccounts, { onConflict: "plaid_item_id,plaid_account_id" });

  if (error) {
    console.error("Failed to persist plaid accounts", error);
    throw new Error("Failed to persist Plaid accounts", { cause: error });
  }
}
