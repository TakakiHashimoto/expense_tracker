import { getPlaidError, logPlaidError } from "@/features/plaid/server/errors";
import { withPlaidErrorBoundary } from "../lib/error-boundary";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { createClient } from "@/lib/supabase/server";
import { createServerRoleClient } from "@/lib/supabase/server-role";
import { NextResponse } from "next/server";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { SyncFailureError } from "@/features/plaid/server/syncFailureError";

const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidEnv = process.env.PLAID_ENV || "sandbox";
const plaidSecret = process.env.PLAID_SECRET;

async function handlePost() {
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
      .select("id")
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
    // track how many item is busy
    let busyItemCount = 0;
    let syncedCount = 0;
    const failedItems: Array<{
      plaidItemId: string;
      error: "SYNC_SUPERSEDED" | "ITEM_LOGIN_REQUIRED" | "SYNC_FAILED";
    }> = [];

    const serverSupabase = createServerRoleClient();

    for (const plaidItem of data) {
      try {
        const { data: secret, error: secretError } = await serverSupabase
          .from("plaid_item_secrets")
          .select("access_token")
          .eq("plaid_item_id", plaidItem.id)
          .single();

        if (secretError || !secret?.access_token) {
          throw new Error("Failed to fetch Plaid access token");
        }

        const result = await syncPlaidItem({
          supabase: serverSupabase,
          plaidItemUuid: plaidItem.id,
          plaidClient: client,
          userId: user.id,
          accessToken: secret.access_token,
          refreshAccount: true,
        });

        // if status is busy, skip this item
        if (result.status === "busy") {
          busyItemCount += 1;
          continue;
        }

        addedCount += result.addedCount;
        modifiedCount += result.modifiedCount;
        removedCount += result.removedCount;
        syncedCount += 1;
      } catch (syncError) {
        const originalError =
          syncError instanceof SyncFailureError ? syncError.originalError : syncError;
        logPlaidError("sync_all", originalError);
        let error: "SYNC_SUPERSEDED" | "ITEM_LOGIN_REQUIRED" | "SYNC_FAILED" = "SYNC_FAILED";
        if (syncError instanceof SyncFailureError) {
          if (syncError.recordingStatus === "skipped") {
            error = "SYNC_SUPERSEDED";
          } else if (
            syncError.recordingStatus === "recorded" &&
            getPlaidError(originalError)?.error_code === "ITEM_LOGIN_REQUIRED"
          ) {
            error = "ITEM_LOGIN_REQUIRED";
          }
        }
        failedItems.push({ plaidItemId: plaidItem.id, error });
      }
    }
    // Process every Item while preserving non-2xx errors for existing clients.
    if (failedItems.length > 0) {
      const failure =
        failedItems.find((item) => item.error === "SYNC_FAILED") ??
        failedItems.find((item) => item.error === "ITEM_LOGIN_REQUIRED") ??
        failedItems[0];
      return NextResponse.json(
        {
          success: false,
          error: failure.error === "SYNC_FAILED" ? "Failed to sync transactions" : failure.error,
          message: failure.error === "ITEM_LOGIN_REQUIRED"
            ? "Your bank connection needs to be updated."
            : "Some bank connections could not be synchronized. Please retry.",
          ...(failure.error === "ITEM_LOGIN_REQUIRED" ? { plaidItemId: failure.plaidItemId } : {}),
          addedCount,
          modifiedCount,
          removedCount,
          busyItemCount,
          syncedItemCount: syncedCount,
          failedItems,
        },
        { status: failure.error === "SYNC_FAILED" ? 500 : 409 },
      );
    }
    return NextResponse.json({
      success: true,
      addedCount,
      modifiedCount,
      removedCount,
      busyItemCount,
      syncedItemCount: syncedCount,
    });
  } catch (e) {
    logPlaidError("sync_all", e);

    return NextResponse.json(
      { error: "Failed to sync dashboard transactions" },
      { status: 500 },
    );
  }
}

export const POST = withPlaidErrorBoundary("sync_all", handlePost);
