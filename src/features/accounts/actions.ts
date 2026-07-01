import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import {
  AccountQueryRowType,
  AccountPageData,
  AccountPageInstitution,
  AccountDetailDataRow,
  AccountDetailData,
} from "./types";
import { deriveConnectionHealth } from "./lib/lib.accounts";

export async function getAccountPageData(): Promise<AccountPageData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  // insutitution name, accounts

  const { data: accountData, error: accountError } = await supabase
    .from("accounts")
    .select(
      "id, type, subtype, name,currency, current_balance , plaid_item: plaid_items!inner(id, institution_name,status,last_sync_status,last_sync_error,last_sync_at), mask",
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .returns<AccountQueryRowType[]>();

  if (accountError) {
    console.error("Failed to fetch account data", accountError);
    return {
      ok: false,
      error: accountError.message || "Failed to fetch account data",
    };
  }

  const accountMap = new Map<string, AccountPageInstitution>();

  // reshape returned data into AccountPageInstitution
  for (const account of accountData) {
    const plaidItemId = account.plaid_item?.id || "Unknown";
    const institutionName = account.plaid_item?.institution_name || "Unknown";
    const syncStatus = account.plaid_item?.last_sync_status || "never_synced";

    const existingInstitution = accountMap.get(plaidItemId);

    // define health: If last_sync_status === "succeed"
    const health = deriveConnectionHealth({
      connectionStatus: account.plaid_item.status,
      syncStatus: syncStatus,
      lastSyncedAt: account.plaid_item.last_sync_at,
      lastSyncError: account.plaid_item.last_sync_error,
    });

    const reshaped: AccountPageInstitution = existingInstitution ?? {
      plaidItemId,
      institutionName,
      connectionStatus: account.plaid_item.status,
      syncStatus: syncStatus,
      health: health,
      lastSyncError: account.plaid_item.last_sync_error,
      lastSyncedAt: account.plaid_item.last_sync_at,
      accounts: [],
    };

    reshaped.accounts.push({
      id: account.id,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      currency: account.currency,
      currentBalance: account.current_balance,
    });

    accountMap.set(plaidItemId, reshaped);
  }

  const institutions = Array.from(accountMap.values());

  return { ok: true, institutions };
}

export async function getAccountDetailData(
  accountId: string,
): Promise<AccountDetailData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  try {
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select(
        "id, type, name, currenct, is_active, mask, subtype, current_balance, available_balance, institution: plaid_items!inner(id, institution_name, status, last_sync_at, last_sync_status, last_sync_error)",
      )
      .eq("user_id", user.id)
      .eq("id", accountId)
      .single()
      .returns<AccountDetailDataRow>();

    if (!accountData || accountError) {
      console.error("Failed to fetch account detail info", accountError);
      throw new Error("Failed to fetch account detail information");
    }

    return { ok: true, account: accountData };
  } catch (e) {
    console.error("Server Error while fetch account detail info", e);
    return { ok: false, error: "Failed to fetch account detail information" };
  }
}
