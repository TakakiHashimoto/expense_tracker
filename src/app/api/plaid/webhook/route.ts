import { NextRequest, NextResponse } from "next/server";
import { PlaidWebhookBody } from "../type/plaidwebhook.type";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { recordSyncFailure } from "@/features/plaid/server/recordSyncFailure";
import { createPlaidClient, getPlaidError } from "../lib/plaid.helper";
import { createServerRoleClient } from "@/lib/supabase/server-role";
import { verifyPlaidWebhook } from "./verifyWebhooks";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const isVerified = await verifyPlaidWebhook({
    rawBody,
    plaidVerificationHeader: req.headers.get("plaid-verification"),
  });

  if (!isVerified) {
    return NextResponse.json(
      { error: "Invalid Plaid webhook signature" },
      { status: 401 },
    );
  }
  const body = JSON.parse(rawBody) as PlaidWebhookBody;

  if (!body.item_id) {
    return NextResponse.json({ error: "Missing item id" }, { status: 400 });
  }

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

  if (
    body.webhook_type === "ITEM" &&
    body.webhook_code === "ERROR" &&
    body.error?.error_code === "ITEM_LOGIN_REQUIRED"
  ) {
    await recordSyncFailure({
      supabase,
      userId: plaidItem.user_id,
      plaidItemUuid: plaidItem.id,
      errorCode: "ITEM_LOGIN_REQUIRED",
      requiresUpdate: true,
    });

    return NextResponse.json(
      { ok: true, message: "Login is required" },
      { status: 200 },
    );
  }

  if (
    body.webhook_type === "ITEM" &&
    body.webhook_code === "USER_PERMISSION_REVOKED"
  ) {
    const { error } = await supabase
      .from("plaid_items")
      .update({ status: "revoked", updated_at: new Date().toISOString() })
      .eq("id", plaidItem.id)
      .eq("user_id", plaidItem.user_id);
    if (error) {
      throw new Error("Failed to change status for this item");
    }

    return NextResponse.json(
      { ok: true, message: "This item has become revoked" },
      { status: 200 },
    );
  }

  if (body.webhook_type === "ITEM" && body.webhook_code === "LOGIN_REPAIRED") {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("plaid_items")
      .update({ status: "active", last_sync_error: null, updated_at: now })
      .eq("id", plaidItem.id)
      .eq("user_id", plaidItem.user_id);

    if (error) {
      throw new Error("Failed to record repaired Plaid Item", { cause: error });
    }

    return NextResponse.json({ ok: true });
  }

  if (
    body.webhook_type === "TRANSACTIONS" &&
    body.webhook_code === "SYNC_UPDATES_AVAILABLE"
  ) {
    //

    console.log("Plaid webhook received", {
      webhook_type: body.webhook_type,
      webhook_code: body.webhook_code,
      item_id: body.item_id,
    });

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
        refreshAccount: true,
      });

      if (result.status === "busy") {
        return NextResponse.json(
          { ok: false, retry: true, reason: "SYNC_ALREADY_IN_PROGRESS" },
          { status: 429, headers: { "Retry-After": "30" } },
        );
      }

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

  return NextResponse.json({ ok: true, ignored: true });
}
