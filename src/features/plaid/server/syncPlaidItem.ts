import { SupabaseClient } from "@supabase/supabase-js";
import { syncTransactions } from "./sync";
import { PlaidApi } from "plaid";
import { fetchPlaidAccounts } from "./accounts";
import { persistPlaidAccounts } from "./persitstPlaidAccounts";
import { persistSyncResult } from "./db";
import { aquireSyncLease } from "./syncLease";

interface ArgTypes {
  supabase: SupabaseClient;
  userId: string;
  plaidClient: PlaidApi;
  plaidItemUuid: string;
  accessToken: string;
  refreshAccount: boolean;
}

export async function syncPlaidItem({
  supabase,
  userId,
  plaidClient,
  plaidItemUuid,
  accessToken,
  refreshAccount,
}: ArgTypes) {
  // aquire owner ship and whoever owns owenership gets cursor.
  const lease = await aquireSyncLease({ plaidItemUuid, supabase, userId });

  // if operation is locked
  if (!lease.acquired) {
    return;
  }

  try {
    const { added, modified, removed, cursor } = await syncTransactions(
      accessToken,
      lease.cursor,
      plaidClient,
    );

    // You are renewing accouts as well.
    if (refreshAccount) {
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

    await persistSyncResult(
      supabase,
      added,
      modified,
      removed,
      cursor,
      plaidItemUuid,
    );
    return {
      addedCount: added.length,
      modifiedCount: modified.length,
      removedCount: removed.length,
    };
  } finally {
    // once the transaction is finished, release the lease
  }
}
