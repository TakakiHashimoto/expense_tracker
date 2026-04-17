import { getUser } from "@/features/dashboard/actions";
import { createClient } from "@/lib/supabase/server";
import { PlaidApi, Transaction, RemovedTransaction } from "plaid";

export async function syncTransactions(
  accessToken: string,
  cursor: string,
  client: PlaidApi,
) {
  // getting all the transaction data that matches with the access token =

  let added: Transaction[] = []; // this is a mixed transaction, checking, saving etc with 1 bank
  let modified: Transaction[] = [];
  let removed: RemovedTransaction[] = [];
  let hasMore = true;
  while (hasMore) {
    // get transaction data
    const request = cursor
      ? { access_token: accessToken, cursor: cursor }
      : { access_token: accessToken };
    const response = await client.transactionsSync(request);
    const data = response.data;
    cursor = data.next_cursor;

    added = added.concat(data.added);
    modified = modified.concat(data.modified);
    removed = removed.concat(data.removed);
    hasMore = data.has_more;
  }

  // return necessary data:
  return { added, modified, removed, cursor };
}
