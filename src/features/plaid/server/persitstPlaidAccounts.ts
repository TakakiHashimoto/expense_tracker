import "server-only";

import { logPlaidError } from "./errors";
import { SupabaseClient } from "@supabase/supabase-js";
import { AccountBase } from "plaid";
import { toPlaidAccountPayload } from "./accountPayload";

import {
  isConfirmedCommitRejection,
  AccountFencingRejectedError,
  AccountCommitUnconfirmedError,
} from "./rpcCommitOutcome";

export async function persistPlaidAccounts({
  supabase,
  userId,
  plaidItemUuid,
  accounts,
  snapshotTime,
  leaseToken,
  expectedCursor,
}: {
  supabase: SupabaseClient;
  userId: string;
  plaidItemUuid: string;
  accounts: AccountBase[];
  snapshotTime: string;
  leaseToken: string;
  expectedCursor: string | null;
}): Promise<void> {
  const accountsToUpsert = toPlaidAccountPayload(accounts);

  let data: unknown;
  let error: unknown;
  let status: number;

  try {
    ({ data, error, status } = await supabase
      .rpc("commit_plaid_accounts", {
        p_user_id: userId,
        p_item_id: plaidItemUuid,
        p_lease_token: leaseToken,
        p_expected_cursor: expectedCursor,
        p_accounts: accountsToUpsert,
        p_snapshot_time: snapshotTime,
      })
      .retry(false));
  } catch (cause) {
    throw new AccountCommitUnconfirmedError(cause);
  }

  if (
    error !== null ||
    !Number.isInteger(status) ||
    !(status >= 200 && status < 300)
  ) {
    logPlaidError("persist_accounts", error);

    if (!isConfirmedCommitRejection(error, status)) {
      throw new AccountCommitUnconfirmedError(error);
    }

    throw new Error("Atomic Plaid account commit failed", { cause: error });
  }

  if (data === true) {
    return;
  }

  if (data === false) {
    throw new AccountFencingRejectedError();
  }

  throw new AccountCommitUnconfirmedError(
    new Error("Unexpected account commit response"),
  );
}
