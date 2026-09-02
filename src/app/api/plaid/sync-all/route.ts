// This page is for sync request from dashboard
import { recordSyncFailure } from "@/features/plaid/server/recordSyncFailure";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { createClient } from "@/lib/supabase/server";
import { createServerRoleClient } from "@/lib/supabase/server-role";
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

    const serverSupabase = createServerRoleClient();

    for (const plaidItem of data) {
      try {
        failedPlaidItemId = plaidItem.id;
        const { data: secret, error: secretError } = await serverSupabase
          .from("plaid_item_secrets")
          .select("access_token")
          .eq("plaid_item_id", plaidItem.id)
          .single();

        if (secretError || !secret?.access_token) {
          throw new Error("Failed to fetch Plaid access token");
        }

        const result = await syncPlaidItem({
          supabase: supabase,
          plaidItemUuid: plaidItem.id,
          plaidClient: client,
          userId: user.id,
          accessToken: secret.access_token,
          transactionCursor: plaidItem.transactions_cursor,
          refreshAccount: true,
        });

        addedCount += result.addedCount;
        modifiedCount += result.modifiedCount;
        removedCount += result.removedCount;
      } catch (syncError) {
        const plaidError = getPlaidError(syncError);
        const errorCode = plaidError?.error_code ?? "SYNC_FAILED";
        const requiresUpdate = errorCode === "ITEM_LOGIN_REQUIRED";
        try {
          await recordSyncFailure({
            supabase,
            userId: user.id,
            plaidItemUuid: plaidItem.id,
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
              plaidItemId: plaidItem.id,
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

    return NextResponse.json(
      { error: "Failed to sync dashboard transactions" },
      { status: 500 },
    );
  }
}
