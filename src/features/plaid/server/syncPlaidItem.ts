import { SupabaseClient } from "@supabase/supabase-js";
import { syncTransactions } from "./sync";
import { PlaidApi } from "plaid";
import { fetchPlaidAccounts } from "./accounts";
import { persistPlaidAccounts } from "./persitstPlaidAccounts";
import { persistSyncResult } from "./db";

interface ArgTypes {
  supabase: SupabaseClient;
  userId: string;
  plaidClient: PlaidApi;
  plaidItemUuid: string;
  accessToken: string;
  transactionCursor: string;
  refreshAccount: boolean;
}

export async function syncPlaidItem({
  supabase,
  userId,
  plaidClient,
  plaidItemUuid,
  accessToken,
  transactionCursor,
  refreshAccount = true,
}: ArgTypes) {
  const { added, modified, removed, cursor } = await syncTransactions(
    accessToken,
    transactionCursor,
    plaidClient,
  );

  const accounts = await fetchPlaidAccounts(plaidClient, accessToken);
  const snapshotTime = new Date().toISOString();

  refreshAccount &&
    (await persistPlaidAccounts({
      supabase,
      userId: userId,
      plaidItemUuid: plaidItemUuid,
      accounts,
      snapshotTime,
    }));

  await persistSyncResult(added, modified, removed, cursor, plaidItemUuid);
  // add those item to database.
}
