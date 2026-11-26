import "server-only";

import { SupabaseClient } from "@supabase/supabase-js";

interface RecordSyncFailureArgs {
  supabase: SupabaseClient;
  userId: string;
  plaidItemUuid: string;
  leaseToken: string;
  expectedCursor: string | null;
  errorCode: string;
  requiresUpdate: boolean;
}

export async function recordSyncFailure({
  supabase,
  userId,
  plaidItemUuid,
  leaseToken,
  expectedCursor,
  errorCode,
  requiresUpdate,
}: RecordSyncFailureArgs): Promise<boolean> {
  const { data, error } = await supabase.rpc("record_plaid_sync_failure", {
    p_user_id: userId,
    p_item_id: plaidItemUuid,
    p_lease_token: leaseToken,
    p_expected_cursor: expectedCursor,
    p_error_code: errorCode,
    p_requires_update: requiresUpdate,
  });

  if (error) {
    // The worker logs once, while it still owns the failure-recording outcome.
    throw new Error("Failed to record Plaid sync failure", { cause: error });
  }

  if (typeof data !== "boolean") {
    throw new Error("Invalid sync failure RPC response");
  }

  return data;
}
