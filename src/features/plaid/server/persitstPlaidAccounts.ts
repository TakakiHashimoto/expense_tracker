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
  // first get existing accounts for this plaidItem
  const { data: existingAccounts, error: existingAccountsError } =
    await supabase
      .from("accounts")
      .select("id, plaid_account_id, is_active")
      .eq("user_id", userId)
      .eq("plaid_item_id", plaidItemUuid);

  if (existingAccountsError) {
    throw new Error("Failed to fetch existing accounts data");
  }

  // if new accounts = insert, already exists = update
  const accountsToUpsert = accounts.map((account) => ({
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
    .upsert(accountsToUpsert, { onConflict: "plaid_item_id,plaid_account_id" });

  if (error) {
    console.error("Failed to persist plaid accounts", error);
    throw new Error("Failed to persist Plaid accounts", { cause: error });
  }

  const currentPlaidAccountIds = new Set(
    accounts.map((account) => account.account_id),
  );

  const missingAccounts = existingAccounts.filter(
    (account) =>
      account.plaid_account_id !== null &&
      !currentPlaidAccountIds.has(account.plaid_account_id),
  );

  const missingAccountIds = missingAccounts.map((account) => account.id);

  // deactivate missing accounts from new plaid accounts
  if (missingAccountIds.length > 0) {
    const { error } = await supabase
      .from("accounts")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("plaid_item_id", plaidItemUuid)
      .in("id", missingAccountIds);

    if (error) {
      throw new Error("Failed to deactivate missing Plaid accounts", {
        cause: error,
      });
    }
  }
}
