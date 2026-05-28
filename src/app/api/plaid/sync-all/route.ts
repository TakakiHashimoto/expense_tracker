// This page is for sync request from dashboard

import { persistSyncResult } from "@/features/plaid/server/db";
import { syncTransactions } from "@/features/plaid/server/sync";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

type PlaidErrorResponse = {
  response?: { data?: { error_code?: string; error_message?: string } };
};

function getPlaidError(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as PlaidErrorResponse).response?.data ?? null;
  }

  return null;
}

export async function POST() {
  let failedPlaidItemId: string | null = null;
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 404 },
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "User is not authenticated" },
        { status: 401 },
      );
    }

    const { data, error: plaidError } = await supabase
      .from("plaid_items")
      .select("id, transactions_cursor")
      .eq("user_id", user.id);

    if (plaidError) {
      return NextResponse.json(
        { error: "Failed to fetch plaid items" },
        { status: 500 },
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No connected bank found" },
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

    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    for (const plaidItem of data) {
      failedPlaidItemId = plaidItem.id;
      const { data: secret, error: secretError } = await supabase
        .from("plaid_item_secrets")
        .select("access_token")
        .eq("plaid_item_id", plaidItem.id)
        .single();

      if (secretError || !secret?.access_token) {
        throw new Error("Failed to fetch Plaid access token");
      }

      console.log({
        plaidItemId: plaidItem.id,
        hasCursor: Boolean(plaidItem.transactions_cursor),
      });

      const { added, modified, removed, cursor } = await syncTransactions(
        secret.access_token,
        plaidItem.transactions_cursor,
        client,
      );

      await persistSyncResult(added, modified, removed, cursor, plaidItem.id);
      addedCount += added.length;
      modifiedCount += modified.length;
      removedCount += removed.length;
    }
    return NextResponse.json({
      success: true,
      addedCount,
      modifiedCount,
      removedCount,
      syncedItemCount: data.length,
    });
  } catch (e) {
    console.error("Sync all transactions failed", e);
    if (e && typeof e === "object" && "response" in e) {
      console.error((e as any).response?.data);
    }

    const plaidError = getPlaidError(e);
    if (plaidError?.error_code === "ITEM_LOGIN_REQUIRED") {
      return NextResponse.json({
        error: "ITEM_LOGIN_REQUIRED",
        message: "Your bank connection needs to be updated.",
        plaidItemId: failedPlaidItemId,
      });
    }
    return NextResponse.json(
      { error: "Failed to sync dashboard transactions" },
      { status: 500 },
    );
  }
}
