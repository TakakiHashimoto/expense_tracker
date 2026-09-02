// call plai "/accounts/get" to get accounts
// sync accounts

import { grabUser } from "@/lib/getUser";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { AccountsGetRequest } from "plaid";
import { createPlaidClient, getPlaidError } from "../lib/plaid.helper";
import { persistPlaidAccounts } from "@/features/plaid/server/persitstPlaidAccounts";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { recordSyncFailure } from "@/features/plaid/server/recordSyncFailure";
import { createServerRoleClient } from "@/lib/supabase/server-role";

export async function POST(req: NextRequest) {
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

    // fetch accounts
    const plaidClient = createPlaidClient();
    const request: AccountsGetRequest = {
      access_token: accessToken.access_token,
    };
    try {
      const response = await plaidClient.accountsGet(request);
      const accounts = response.data.accounts;

      const snapshotTime = new Date().toISOString();
      // sync accounts to database
      await persistPlaidAccounts({
        supabase,
        userId: user.id,
        plaidItemUuid: plaidItem.id,
        accounts,
        snapshotTime,
      });

      // sync transactions
      let addedCount = 0;
      let removedCount = 0;
      let modifiedCount = 0;
      try {
        const result = await syncPlaidItem({
          supabase,
          userId: user.id,
          plaidClient,
          plaidItemUuid: plaidItem.id,
          accessToken: accessToken.access_token,
          refreshAccount: false,
          transactionCursor: plaidItem.transactions_cursor,
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

      return NextResponse.json({
        success: true,
        addedCount,
        modifiedCount,
        removedCount,
      });
    } catch (error) {
      // handle error
      console.error("Failed to add account", error);
      return NextResponse.json(
        { error: "Failed to add account" },
        { status: 500 },
      );
    }
  } catch (e) {
    console.error("Failed to refresh accounts", e);

    return NextResponse.json(
      { error: "Failed to refresh accounts" },
      { status: 500 },
    );
  }
}
