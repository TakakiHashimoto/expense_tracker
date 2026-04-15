// here in this page syncs transactions data which is associated with access-token

import { getUser } from "@/features/dashboard/actions";
import { syncTransactions } from "@/features/plaid/server/sync";

import { persistSyncResult } from "@/features/plaid/server/db";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getUser(supabase);
  const { plaid_item_id } = await request.json();

  const { data } = await supabase
    .from("plaid_item_secrets")
    .select("access_token")
    .eq("plaid_item_id", plaid_item_id);
  const access_token = data?.[0].access_token;

  const { data: cursorData } = await supabase
    .from("plaid_items")
    .select("transactions_cursor")
    .eq("id", plaid_item_id);

  const transactionCursor = cursorData?.[0].transactions_cursor;
  const config = new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": plaidClientId,
        "PLAID-SECRET": plaidSecret,
      },
    },
  });

  const client = new PlaidApi(config);
  const { added, modified, removed, cursor } = await syncTransactions(
    access_token,
    transactionCursor,
    client,
  );

  await persistSyncResult(added, modified, removed, cursor, plaid_item_id);
  // add those item to database.
}
