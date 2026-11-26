import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";

interface RecordItemErrorArgs {
  supabase: SupabaseClient;
  userId: string;
  plaidItemUuid: string;
}

export async function recordItemError({
  supabase,
  userId,
  plaidItemUuid,
}: RecordItemErrorArgs): Promise<boolean> {
  const { data, error } = await supabase
    .from("plaid_items")
    .update({
      last_sync_status: "failed",
      last_sync_error: "ITEM_LOGIN_REQUIRED",
      status: "error",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", plaidItemUuid)
    .neq("status", "revoked")
    .select("id")
    .maybeSingle();

  if (error) {
    // The webhook boundary owns sanitized logging.
    throw new Error("Failed to record Plaid Item error", { cause: error });
  }

  return data !== null;
}
