// here in this page syncs transactions data which is associated with access-token

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { recordSyncFailure } from "@/features/plaid/server/recordSyncFailure";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { grabUser } from "@/lib/getUser";
import { createServerRoleClient } from "@/lib/supabase/server-role";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

export type PlaidErrorResponse = {
  response?: { data?: { error_code?: string; error_message?: string } };
};

function getPlaidError(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error) {
    return (error as PlaidErrorResponse).response?.data ?? null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!plaidClientId || !plaidSecret) {
      return NextResponse.json(
        { error: "Missing Plaid Credentials" },
        { status: 500 },
      );
    }
    const supabase = await createClient();
    const user = await grabUser(supabase);
    const { plaid_item_uuid } = await request.json(); // This is internal DB plaid_items_id = plaid_items.id

    if (!plaid_item_uuid) {
      return NextResponse.json(
        { error: "Missing plaid item uuid" },
        { status: 400 },
      );
    }

    // fetching transaction cursor, which is needed for transaction syncing
    const { data: cursorData, error: cursorError } = await supabase
      .from("plaid_items")
      .select("id, transactions_cursor")
      .eq("id", plaid_item_uuid)
      .eq("user_id", user.id)
      .single();

    if (cursorError || !cursorData) {
      throw new Error("Failed to fetch plaid items");
    }

    const serverRoleSupabase = createServerRoleClient();

    const transactionCursor = cursorData.transactions_cursor;

    const { data, error: secretError } = await serverRoleSupabase
      .from("plaid_item_secrets")
      .select("access_token")
      .eq("plaid_item_id", cursorData.id)
      .single();

    if (secretError || !data) {
      return NextResponse.json({ error: "Couldn't find " }, { status: 404 });
    }

    // You also need access token for transaction syncing
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

    try {
      const data = await syncPlaidItem({
        supabase,
        userId: user.id,
        plaidClient: client,
        plaidItemUuid: cursorData.id,
        accessToken: access_token,
        transactionCursor: transactionCursor,
        refreshAccount: true,
      });

      return NextResponse.json({
        success: true,
        addedCount: data.addedCount,
        removedCount: data.removedCount,
        modifiedCount: data.modifiedCount,
      });
    } catch (syncError) {
      // When sycn failed, update sync status in plaid_items db
      const plaidError = getPlaidError(syncError);
      const errorCode = plaidError?.error_code ?? "SYNC_FAILED";
      const requiresUpdate = errorCode === "ITEM_LOGIN_REQUIRED";
      try {
        await recordSyncFailure({
          supabase,
          userId: user.id,
          plaidItemUuid: cursorData.id,
          errorCode,
          requiresUpdate,
        });
      } catch (recordError) {
        console.error("Failed to record sync failure", recordError);
      }

      if (requiresUpdate) {
        return NextResponse.json(
          {
            error: "ITEM_LOGIN_REQUIRED",
            message: "Your bank connection needs to be updated.",
            plaidItemId: plaid_item_uuid,
          },
          { status: 409 },
        );
      }

      console.error("Plaid Item synchronization failed", syncError);

      return NextResponse.json(
        { error: "Failed to sync transactions" },
        { status: 500 },
      );
    }
  } catch (e) {
    console.error("Sync transactions failed", e);
    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 },
    );
  }
}
