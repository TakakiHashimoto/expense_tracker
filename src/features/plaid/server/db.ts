import "server-only";

import { normalizeCategory } from "@/lib/transactions.helper";
import { RemovedTransaction, Transaction } from "plaid";
import { createServerRoleClient } from "@/lib/supabase/server-role";
import { logPlaidError } from "./errors";
import { isConfirmedCommitRejection } from "./rpcCommitOutcome";

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

// A lost RPC response cannot establish whether the atomic commit succeeded.
export class SyncCommitUnconfirmedError extends Error {
  constructor(cause: unknown) {
    super("Plaid sync commit outcome is unconfirmed", { cause });
    this.name = "SyncCommitUnconfirmedError";
  }
}

// Only reviewed PostgreSQL rejections, paired with PostgREST's HTTP mapping.
// Constraint failures abort the request transaction; serialization/deadlock
// failures abort it as well. P0001 is the uncaught RAISE EXCEPTION used by
// commit_plaid_sync (including its lease/cursor/argument checks).
// https://docs.postgrest.org/en/v14/references/transactions.html#aborting-transactions
// https://docs.postgrest.org/en/v14/references/errors.html#http-status-codes

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
      pending_transaction_id: item.pending_transaction_id ?? null,
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
  let error;
  let status;
  try {
    // postgrest-js does not retry POST today. Disable retries explicitly:
    // a replay's rejection would not establish that the FIRST call rolled back.
    ({ error, status } = await adminClient
      .rpc("commit_plaid_sync", {
        p_user_id: userId,
        p_item_id: itemUuid,
        p_lease_token: leaseToken,
        p_expected_cursor: expectedCursor,
        p_next_cursor: cursor,
        p_added: normalizedAdded,
        p_modified: normalizedModified,
        p_removed: normalizedRemoved,
      })
      .retry(false));
  } catch (cause) {
    throw new SyncCommitUnconfirmedError(cause);
  }

  if (
    error !== null ||
    !Number.isInteger(status) ||
    !(status >= 200 && status < 300)
  ) {
    // PostgreSQL SQLSTATE または PostgREST エラーコード
    logPlaidError("persist_transactions", error);

    // Unknown codes (even five-character ones), shutdown, connection errors,
    // gateway errors and malformed responses are not evidence of rollback.
    // The cursor can stay unchanged even after a successful commit.
    if (!isConfirmedCommitRejection(error, status)) {
      throw new SyncCommitUnconfirmedError(error);
    }

    throw new Error("Atomic Plaid sync commit failed", { cause: error });
  }

  return { success: true, message: "Successfully updated database" };
}
