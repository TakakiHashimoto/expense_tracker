import { logPlaidError } from "@/features/plaid/server/errors";
import { withPlaidErrorBoundary } from "../lib/error-boundary";
import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createPlaidClient, getPlaidError } from "../lib/plaid.helper";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { createServerRoleClient } from "@/lib/supabase/server-role";
import { SyncFailureError } from "@/features/plaid/server/syncFailureError";
import { SyncCommitUnconfirmedError } from "@/features/plaid/server/db";

async function handlePost(req: NextRequest) {
  const { plaidItemUuid } = await req.json();

  if (!plaidItemUuid) {
    return NextResponse.json(
      { error: "plaid item uuid is missing" },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const user = await grabUser(supabase);

    // get plaid id
    const { data: plaidItem, error: plaidError } = await supabase
      .from("plaid_items")
      .select("id, transactions_cursor")
      .eq("user_id", user.id)
      .eq("id", plaidItemUuid)
      .single();

    if (!plaidItem || plaidError) {
      return NextResponse.json(
        { error: "Failed to fetch plaid items" },
        { status: 400 },
      );
    }

    // get access token
    const serverSupabase = createServerRoleClient();

    const { data: accessToken, error: secretError } = await serverSupabase
      .from("plaid_item_secrets")
      .select("access_token")
      .eq("plaid_item_id", plaidItem.id)
      .single();

    if (!accessToken || secretError) {
      return NextResponse.json(
        { error: "Failed to fetch access token" },
        { status: 500 },
      );
    }

    const plaidClient = createPlaidClient();

    try {
      const result = await syncPlaidItem({
        supabase: serverSupabase,
        userId: user.id,
        plaidClient,
        plaidItemUuid: plaidItem.id,
        accessToken: accessToken.access_token,
        refreshAccount: true,
        refreshAccountsFirst: true,
      });

      if (result.status === "busy") {
        return NextResponse.json(
          {
            success: false,
            error: "SYNC_BUSY",
            accountRefreshSucceeded: false,
            accountRefreshStatus: "not_completed",
            transactionSyncStatus: "busy",
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        accountRefreshSucceeded: true,
        accountRefreshStatus: "succeeded",
        transactionSyncStatus: "synced",
        addedCount: result.addedCount,
        modifiedCount: result.modifiedCount,
        removedCount: result.removedCount,
      });
    } catch (syncError) {
      const originalError =
        syncError instanceof SyncFailureError
          ? syncError.originalError
          : syncError;

      const accountRefreshStatus =
        syncError instanceof SyncFailureError
          ? syncError.accountRefreshStatus
          : "not_completed";

      const accountRefreshSucceeded = accountRefreshStatus === "succeeded";

      const accountResult = { accountRefreshSucceeded, accountRefreshStatus };

      logPlaidError("refresh_accounts", originalError);

      if (originalError instanceof SyncCommitUnconfirmedError) {
        return NextResponse.json(
          {
            error: "TRANSACTION_SYNC_OUTCOME_UNCONFIRMED",
            ...accountResult,
            transactionSyncStatus: "unconfirmed",
          },
          { status: 500 },
        );
      }

      if (
        syncError instanceof SyncFailureError &&
        syncError.recordingStatus === "skipped"
      ) {
        return NextResponse.json(
          {
            error: "SYNC_SUPERSEDED",
            message: "This sync attempt is no longer valid.",
            ...accountResult,
          },
          { status: 409 },
        );
      }

      const plaidError = getPlaidError(originalError);
      const errorCode = plaidError?.error_code ?? "SYNC_FAILED";
      const requiresUpdate = errorCode === "ITEM_LOGIN_REQUIRED";

      if (
        requiresUpdate &&
        syncError instanceof SyncFailureError &&
        syncError.recordingStatus === "recorded"
      ) {
        return NextResponse.json(
          {
            error: "ITEM_LOGIN_REQUIRED",
            message: "Your bank connection needs to be updated.",
            plaidItemId: plaidItem.id,
            ...accountResult,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error:
            accountRefreshStatus === "unconfirmed"
              ? "Account refresh outcome is unconfirmed"
              : accountRefreshSucceeded
                ? "Failed to sync transactions"
                : "Failed to refresh accounts",
          ...accountResult,
        },
        { status: 500 },
      );
    }
  } catch (error) {
    // handle error
    logPlaidError("refresh_accounts", error);
    return NextResponse.json(
      { error: "Failed to refresh accounts" },
      { status: 500 },
    );
  }
}

export const POST = withPlaidErrorBoundary("refresh_accounts", handlePost);
