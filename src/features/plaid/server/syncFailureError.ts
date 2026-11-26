import "server-only";

// "failed" means unconfirmed, never proof that the database did not commit.
export type FailureRecordingStatus = "recorded" | "skipped" | "failed";

export type AccountRefreshStatus =
  | "not_requested"
  | "not_completed"
  | "succeeded"
  | "unconfirmed";

export class SyncFailureError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly recordingStatus: FailureRecordingStatus,
    public readonly accountRefreshStatus: AccountRefreshStatus = "not_requested",
  ) {
    super("Plaid sync failed", { cause: originalError });

    this.name = "SyncFailureError";
  }
}
