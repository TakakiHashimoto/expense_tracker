import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";
import { syncTransactions } from "./sync";
import { PlaidApi } from "plaid";
import { fetchPlaidAccounts } from "./accounts";
import { persistPlaidAccounts } from "./persitstPlaidAccounts";
import { persistSyncResult } from "./db";
import { aquireSyncLease } from "./syncLease";
import { unlockLease } from "./unlockRelase";

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

export async function syncPlaidItem({
  supabase,
  userId,
  plaidClient,
  plaidItemUuid,
  accessToken,
  refreshAccount,
}: ArgTypes): Promise<SyncPlaidItemResult> {
  // aquire owner ship and whoever owns owenership gets cursor.
  const lease = await aquireSyncLease({ plaidItemUuid, supabase, userId });

  // if operation is locked
  if (!lease.acquired) {
    return { status: "busy" as const };
  }

  try {
    const { added, modified, removed, cursor } = await syncTransactions(
      accessToken,
      lease.cursor,
      plaidClient,
    );

    // You are renewing accouts as well.
    if (refreshAccount) {
      // fetch latest accounts
      const accounts = await fetchPlaidAccounts(plaidClient, accessToken);
      const snapshotTime = new Date().toISOString();
      await persistPlaidAccounts({
        supabase,
        userId: userId,
        plaidItemUuid: plaidItemUuid,
        accounts,
        snapshotTime,
      });
    }

    // transaction syncing is integrated to one big db transaction to maintain atomicity
    await persistSyncResult({
      userId,
      itemUuid: plaidItemUuid,
      leaseToken: lease.token,
      expectedCursor: lease.cursor,
      cursor,
      added,
      modified,
      removed,
    });
    return {
      status: "synced" as const,
      addedCount: added.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
    };
  } finally {
    try {
      await unlockLease({
        plaidItemUuid,
        userId,
        supabase,
        token: lease.token,
      });
    } catch (error) {
      console.error("Failed to release Plaid sync lease", {
        plaidItemUuid,
        message:
          error instanceof Error ? error.message : "Unknown cleanup error",
      });
    }
  }
}
