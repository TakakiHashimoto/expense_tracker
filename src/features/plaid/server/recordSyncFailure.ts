// This function is for recording failure into db when sync failed
// Update last_sync_error, last_sync_status, updated_at
// If it's a ITEM_LOGIN_REQUIRED, status: "need_update"

import { SupabaseClient } from "@supabase/supabase-js";

export async function recordSyncFailure({
  supabase,
  userId,
  plaidItemUuid,
  errorCode,
  requiresUpdate,
}: {
  supabase: SupabaseClient;
  userId: string;
  plaidItemUuid: string;
  errorCode: string;
  requiresUpdate: boolean;
}) {
  const updateData = requiresUpdate
    ? {
        last_sync_status: "failed",
        updated_at: new Date().toISOString(),
        last_sync_error: errorCode,
        status: "needs_update",
      }
    : {
        last_sync_status: "failed",
        updated_at: new Date().toISOString(),
        last_sync_error: errorCode,
      };
  const { data, error } = await supabase
    .from("plaid_items")
    .update(updateData)
    .eq("user_id", userId)
    .eq("id", plaidItemUuid)
    .select("id")
    .single();

  if (!data || error) {
    throw new Error("Failed to record plaid_items failure");
  }

  return data;
}
