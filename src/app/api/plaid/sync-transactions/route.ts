// here in this page syncs transactions data which is associated with access-token

import { grabUser } from "@/features/dashboard/actions";
import { syncTransactions } from "@/features/plaid/server/sync";

import { persistSyncResult } from "@/features/plaid/server/db";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await grabUser(supabase);
    const { plaid_item_uuid } = await request.json(); // This is internal DB plaid_items_id

    if (!plaid_item_uuid) {
      return NextResponse.json(
        { error: "Missing plaid item uuid" },
        { status: 400 },
      );
    }

    const { data: cursorData, error: cursorError } = await supabase
      .from("plaid_items")
      .select("id, transactions_cursor")
      .eq("id", plaid_item_uuid)
      .eq("user_id", user.id)
      .single();

    if (cursorError || !cursorData) {
      throw new Error("Failed to fetch plaid items");
    }

    const transactionCursor = cursorData.transactions_cursor;

    const { data, error: secretError } = await supabase
      .from("plaid_item_secrets")
      .select("access_token")
      .eq("plaid_item_id", plaid_item_uuid)
      .single();

    if (secretError || !data) {
      return NextResponse.json({ error: "Couldn't find " }, { status: 404 });
    }
    const access_token = data.access_token;

    if (!access_token) {
      return NextResponse.json(
        { error: "access_token not found" },
        { status: 404 },
      );
    }

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

    await persistSyncResult(added, modified, removed, cursor, plaid_item_uuid);
    // add those item to database.
    return NextResponse.json({
      success: true,
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
    });
  } catch (e) {
    console.error("Sync transactions failed", e);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 },
    );
  }
}
