import { NextRequest, NextResponse } from "next/server";
import { PlaidWebhookBody } from "../type/plaidwebhook.type";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { recordSyncFailure } from "@/features/plaid/server/recordSyncFailure";
import { createPlaidClient, getPlaidError } from "../lib/plaid.helper";
import { createServerRoleClient } from "@/lib/supabase/server-role";

// TODO production: verify Plaid-Verification header before trusting payload.

export async function POST(req: NextRequest) {
  let body: PlaidWebhookBody;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.item_id) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

  if (
    body.webhook_type !== "TRANSACTIONS" ||
    body.webhook_code !== "SYNC_UPDATES_AVAILABLE"
  ) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  console.log("Plaid webhook received", {
    webhook_type: body.webhook_type,
    webhook_code: body.webhook_code,
    item_id: body.item_id,
  });

  const supabase = createServerRoleClient();

  // get information needed for syncPlaidItem
  const { data: plaidItem, error: plaidError } = await supabase
    .from("plaid_items")
    .select("id, user_id, plaid_item_id, transactions_cursor")
    .eq("plaid_item_id", body.item_id)
    .single();

  if (!plaidItem || plaidError) {
    console.error("Webhook item not found", plaidError);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { data: secret, error: secretError } = await supabase
    .from("plaid_item_secrets")
    .select("access_token")
    .eq("plaid_item_id", plaidItem.id)
    .single();

  if (!secret || secretError) {
    console.error("Webhook secret not found", secretError);
    return NextResponse.json(
      { error: "Missing access token" },
      { status: 500 },
    );
  }

  const client = createPlaidClient();
  try {
    const result = await syncPlaidItem({
      supabase,
      userId: plaidItem.user_id,
      plaidClient: client,
      plaidItemUuid: plaidItem.id,
      accessToken: secret.access_token,
      transactionCursor: plaidItem.transactions_cursor,
      refreshAccount: true,
    });

    return NextResponse.json({
      ok: true,
      added: result.addedCount,
      modified: result.modifiedCount,
      removed: result.removedCount,
    });
  } catch (e) {
    const plaidError = getPlaidError(e);
    const errorCode = plaidError?.error_code ?? "SYNC_FAILED";
    const requiresUpdate = errorCode === "ITEM_LOGIN_REQUIRED";
    try {
      await recordSyncFailure({
        supabase,
        userId: plaidItem.user_id,
        plaidItemUuid: plaidItem.id,
        errorCode,
        requiresUpdate,
      });
    } catch (recordError) {
      console.error("Failed to record sync failure", recordError);
      return NextResponse.json(
        { error: "Failed to record sync failure" },
        { status: 500 },
      );
    }

    if (requiresUpdate) {
      return NextResponse.json({
        ok: true,
        error: "ITEM_LOGIN_REQUIRED",
        message: "Your bank connection needs to be updated.",
        plaidItemId: plaidItem.id,
      });
    }

    console.error("Plaid Item synchronization failed", e);

    return NextResponse.json(
      { error: "Failed to sync transactions" },
      { status: 500 },
    );
  }
}
