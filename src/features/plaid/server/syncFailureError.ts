import "server-only";

// "failed" means unconfirmed, never proof that the database did not commit.
export type FailureRecordingStatus = "recorded" | "skipped" | "failed";

export class SyncFailureError extends Error {
  constructor(
    public readonly originalError: unknown,
    public readonly recordingStatus: FailureRecordingStatus,
  ) {
    super("Plaid sync failed", { cause: originalError });

    this.name = "SyncFailureError";
  }
}
