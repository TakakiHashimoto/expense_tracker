import "server-only";

import { normalizeCategory } from "@/lib/transactions.helper";
import { RemovedTransaction, Transaction } from "plaid";
import { createServerRoleClient } from "@/lib/supabase/server-role";
import { logPlaidError } from "./errors";

type PersistSyncResultArgs = {
  userId: string;
  itemUuid: string;
  leaseToken: string;
  expectedCursor: string | null;
  cursor: string | null;
  added: Transaction[];
  modified: Transaction[];
  removed: RemovedTransaction[];
};

// take Plaid’s sync changes and apply those changes into your own database
export async function persistSyncResult({
  userId,
  itemUuid,
  leaseToken,
  expectedCursor,
  cursor,
  added,
  modified,
  removed,
}: PersistSyncResultArgs) {
  function toSyncPayload(item: Transaction) {
    const amount = -item.amount;

    const category = normalizeCategory({
      amount,
      rawCategory: item.personal_finance_category?.primary ?? "",
      rawDetail: item.personal_finance_category?.detailed ?? "",
      merchantName: item.merchant_name ?? "",
    });

    return {
      transaction_id: item.transaction_id,
      account_id: item.account_id,
      amount,
      category_kind: category.kind,
      category_name: category.name,

      merchant: item.merchant_name ?? null,
      pending: item.pending,
      posted_date: item.date,
      posted_datetime: item.datetime ?? null,
      authorized_date: item.authorized_date ?? null,
      authorized_datetime: item.authorized_datetime ?? null,
      payment_channel: item.payment_channel ?? null,
      raw_category: item.personal_finance_category ?? null,
      name: item.name,
      location: item.location ?? null,
    };
  }

  const normalizedAdded = added.map(toSyncPayload);
  const normalizedModified = modified.map(toSyncPayload);

  const normalizedRemoved = removed.map((item) => ({
    transaction_id: item.transaction_id,
  }));

  if (cursor === null) {
    throw new Error("Plaid sync returned no final cursor");
  }

  const adminClient = createServerRoleClient();

  // syncing logic is now operated in one big rpc to maintain atomicity
  const { error } = await adminClient.rpc("commit_plaid_sync", {
    p_user_id: userId,
    p_item_id: itemUuid,
    p_lease_token: leaseToken,
    p_expected_cursor: expectedCursor,
    p_next_cursor: cursor,
    p_added: normalizedAdded,
    p_modified: normalizedModified,
    p_removed: normalizedRemoved,
  });

  if (error) {
    // PostgreSQL SQLSTATE または PostgREST エラーコード
    logPlaidError("persist_transactions", error);

    throw new Error("Atomic Plaid sync commit failed", { cause: error });
  }

  return { success: true, message: "Successfully updated database" };
}
