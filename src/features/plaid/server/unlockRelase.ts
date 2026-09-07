import { SupabaseClient } from "@supabase/supabase-js";

export async function unlockLease({
  plaidItemUuid,
  userId,
  supabase,
  token,
}: {
  plaidItemUuid: string;
  userId: string;
  supabase: SupabaseClient;
  token: string;
}) {
  // release the lock: (plaidItemUuid and userId matches)

  const { error } = await supabase
    .from("plaid_items")
    .update({ sync_lock_token: null, sync_lock_expires_at: null })
    .eq("id", plaidItemUuid)
    .eq("user_id", userId)
    .eq("sync_lock_token", token);

  if (error) {
    throw new Error("Failed to release Plaid sync lease", { cause: error });
  }
}
