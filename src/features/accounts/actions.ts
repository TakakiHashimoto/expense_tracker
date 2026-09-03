import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import {
  AccountQueryRowType,
  AccountPageData,
  AccountPageInstitution,
  AccountDetailDataRow,
  AccountDetailData,
  AccountDetailPageData,
} from "./types";
import { deriveConnectionHealth } from "./lib/lib.accounts";
import { TransactionFilters } from "../transactions/types";

type TransactionQueryRowType = {
  id: string;
  merchant: string | null;
  name: string | null;
  amount: number | string;
  posted_date: string;
  category_id: string | null;
  category: { name: string | null; kind: "income" | "expense" | null } | null;
  account: {
    name: string | null;
    plaid_item: { institution_name: string | null } | null;
  } | null;
};

export async function getAccountPageData(): Promise<AccountPageData> {
  const supabase = await createClient();
  const user = await grabUser(supabase);

  // insutitution name, accounts

  const { data: accountData, error: accountError } = await supabase
    .from("accounts")
    .select(
      "id, type, subtype, name,currency, current_balance , plaid_item: plaid_items!accounts_user_id_plaid_item_id_fkey!inner(id, institution_name,status,last_sync_status,last_sync_error,last_sync_at), mask",
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
    const plaidItemId = account.plaid_item?.id;
    const institutionName = account.plaid_item?.institution_name ?? "Unknown";

    const existingInstitution = accountMap.get(plaidItemId);

    const connectionStatus = account.plaid_item.status ?? "error";
    const syncStatus = account.plaid_item?.last_sync_status || "never_synced";

    const health = deriveConnectionHealth({
      connectionStatus: connectionStatus,
      syncStatus: syncStatus,
      lastSyncedAt: account.plaid_item.last_sync_at,
      lastSyncError: account.plaid_item.last_sync_error,
    });

    const reshaped: AccountPageInstitution = existingInstitution ?? {
      plaidItemId,
      institutionName,
      connectionStatus: connectionStatus,
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
        "id, type, name, currency, is_active, mask, subtype, current_balance, available_balance, institution: plaid_items!accounts_user_id_plaid_item_id_fkey!inner(id, institution_name, status, last_sync_at, last_sync_status, last_sync_error)",
      )
      .eq("user_id", user.id)
      .eq("id", accountId)
      .single()
      .returns<AccountDetailDataRow>();

    if (!accountData || accountError) {
      console.error("Failed to fetch account detail info", accountError);
      throw new Error("Failed to fetch account detail information");
    }

    const syncStatus =
      accountData.institution.last_sync_status ?? "never_synced";

    const health = deriveConnectionHealth({
      connectionStatus: accountData.institution.status,
      syncStatus,
      lastSyncedAt: accountData.institution.last_sync_at,
      lastSyncError: accountData.institution.last_sync_error,
    });

    const account: AccountDetailPageData = {
      id: accountData.id,
      name: accountData.name,
      type: accountData.type || "Unknown",
      subtype: accountData.subtype,
      mask: accountData.mask,
      currency: accountData.currency,
      currentBalance: accountData.current_balance,
      availableBalance: accountData.available_balance,
      institution: {
        id: accountData.institution.id,
        institutionName: accountData.institution.institution_name || "Unknown",
        status: accountData.institution.status,
        lastSyncStatus: syncStatus,
        lastSyncError: accountData.institution.last_sync_error,
        lastSyncAt: accountData.institution.last_sync_at,
      },
      health,
    };

    return { ok: true, account: account };
  } catch (e) {
    console.error("Server Error while fetch account detail info", e);
    return { ok: false, error: "Failed to fetch account detail information" };
  }
}

// get recent transactions for specfic account
export async function getAccountSpecificTransaction({
  accountId,
  filters,
  q,
}: {
  accountId: string;
  filters: TransactionFilters;
  q: string;
}) {
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
      `id, name, merchant, amount, posted_date, category_id, ${categorySelect}, account: accounts!transactions_user_id_account_id_fkey(name, plaid_item: plaid_items!accounts_user_id_plaid_item_id_fkey(institution_name))`,
    )
    .eq("user_id", user.id)
    .eq("account_id", accountId)
    .or("is_removed.is.null,is_removed.eq.false");

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
