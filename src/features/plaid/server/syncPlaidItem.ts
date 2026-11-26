import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";
import { syncTransactions } from "./sync";
import { PlaidApi } from "plaid";
import { fetchPlaidAccounts } from "./accounts";
import { persistPlaidAccounts } from "./persitstPlaidAccounts";
import { persistSyncResult, SyncCommitUnconfirmedError } from "./db";
import { aquireSyncLease } from "./syncLease";
import { unlockLease } from "./unlockRelase";
import { getPlaidError, logPlaidError, type PlaidOperation } from "./errors";
import {
  SyncFailureError,
  type FailureRecordingStatus,
} from "./syncFailureError";

import { recordSyncFailure } from "./recordSyncFailure";

interface ArgTypes {
  supabase: SupabaseClient;
  userId: string;
  plaidClient: PlaidApi;
  plaidItemUuid: string;
  accessToken: string;
  refreshAccount: boolean;
}

type SyncPlaidItemResult =
  | { status: "busy" }
  | {
      status: "synced";
      addedCount: number;
      modifiedCount: number;
      removedCount: number;
    };

async function traceSyncStage<T>(
  stage: PlaidOperation,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logPlaidError(stage, error);
    throw error;
  }
}

export async function syncPlaidItem({
  supabase,
  userId,
  plaidClient,
  plaidItemUuid,
  accessToken,
  refreshAccount,
}: ArgTypes): Promise<SyncPlaidItemResult> {
  // aquire owner ship and whoever owns owenership gets cursor.
  const lease = await traceSyncStage("acquire_lease", () =>
    aquireSyncLease({ plaidItemUuid, supabase, userId }),
  );

  // if operation is locked
  if (!lease.acquired) {
    return { status: "busy" as const };
  }

  try {
    const { added, modified, removed, cursor } = await traceSyncStage(
      "plaid_transactions",
      () => syncTransactions(accessToken, lease.cursor, plaidClient),
    );

    // You are renewing accouts as well.
    if (refreshAccount) {
      // fetch latest accounts
      const accounts = await traceSyncStage("fetch_accounts", () =>
        fetchPlaidAccounts(plaidClient, accessToken),
      );
      const snapshotTime = new Date().toISOString();
      await traceSyncStage("persist_accounts", () =>
        persistPlaidAccounts({
          supabase,
          userId,
          plaidItemUuid,
          accounts,
          snapshotTime,
        }),
      );
    }

    // Compute the response before commit; no fallible follow-up work belongs
    // in this catch after a confirmed atomic commit.
    const result = {
      status: "synced" as const,
      addedCount: added.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
    };
    // transaction syncing is integrated to one big db transaction to maintain atomicity
    await traceSyncStage("atomic_commit", () =>
      persistSyncResult({
        userId,
        itemUuid: plaidItemUuid,
        leaseToken: lease.token,
        expectedCursor: lease.cursor,
        cursor,
        added,
        modified,
        removed,
      }),
    );
    return result;
  } catch (syncError) {
    if (syncError instanceof SyncCommitUnconfirmedError) {
      throw new SyncFailureError(syncError, "failed");
    }
    const plaidError = getPlaidError(syncError);
    const errorCode = plaidError?.error_code ?? "SYNC_FAILED";
    const requiresUpdate = errorCode === "ITEM_LOGIN_REQUIRED";

    let recordingStatus: FailureRecordingStatus = "failed";

    try {
      const recorded = await recordSyncFailure({
        supabase,
        userId,
        plaidItemUuid,
        leaseToken: lease.token,
        expectedCursor: lease.cursor,
        errorCode,
        requiresUpdate,
      });

      recordingStatus = recorded ? "recorded" : "skipped";
    } catch (recordError) {
      logPlaidError("record_sync_failure", recordError);
    }

    throw new SyncFailureError(syncError, recordingStatus);
  } finally {
    try {
      await unlockLease({
        plaidItemUuid,
        userId,
        supabase,
        token: lease.token,
      });
    } catch (error) {
      logPlaidError("release_lease", error);
    }
  }
}
