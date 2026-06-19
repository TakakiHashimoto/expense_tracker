import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import {
  AccountQueryRowType,
  AccountPageData,
  AccountPageInstitution,
} from "./types";

export async function getAccountPageData(): Promise<AccountPageData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  // insutitution name, accounts
  try {
    const { data: accountData, error: accountError } = await supabase
      .from("accounts")
      .select(
        "id, type, subtype, name, current_balance , plaid_item: plaid_items(id, institution_name, last_sync_at, status), mask",
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .returns<AccountQueryRowType[]>();

    if (accountError) {
      console.error("Failed to fetch account data", accountError);
      throw new Error("Failed to fetch account data");
    }

    const accountMap = new Map<string, AccountPageInstitution>();

    // reshape returned data into AccountPageInstitution

    for (const account of accountData) {
      const plaidItemId = account.plaid_item?.id || "Unknown";
      const institutionName = account.plaid_item?.institution_name || "Unknown";

      const reshaped: AccountPageInstitution = {
        plaidItemId,
        institutionName,
        status: account.plaid_item?.status || "unknown",
        lastSyncedAt: account.plaid_item?.last_sync_at || "unknown",
        accounts: [],
      };

      reshaped.accounts.push({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        currentBalance: account.current_balance,
      });

      accountMap.set(plaidItemId, reshaped);
    }

    const institutions = Array.from(accountMap.values());

    return { ok: true, institutions };
  } catch (e) {
    console.error("Server error", e);
    return { ok: false, error: "Failed to fetch account information" };
  }
}
