import { SupabaseClient } from "@supabase/supabase-js";

export async function aquireSyncLease({
  plaidItemUuid,
  supabase,
  userId,
}: {
  plaidItemUuid: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const token = crypto.randomUUID();
  const now = new Date();

  const expiresAt = new Date(now.getTime() + 1000 * 60 * 5).toISOString();

  const { data, error } = await supabase
    .from("plaid_items")
    .update({ sync_lock_token: token, sync_lock_expires_at: expiresAt })
    .eq("id", plaidItemUuid)
    .eq("user_id", userId)
    .or(
      `sync_lock_expires_at.is.null,sync_lock_expires_at.lt.${now.toISOString()}`,
    )
    .select("transactions_cursor")
    .maybeSingle();

  if (error) {
    throw new Error("Failed to acquire Plaid sync lease", { cause: error });
  }

  // if lock_token was not empty or if now time was within the expires time, that means still in session = no data
  if (!data) {
    return { acquired: false as const };
  }

  return { acquired: true as const, token, cursor: data.transactions_cursor };
}
