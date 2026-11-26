import "server-only";

const COMMIT_REJECTION_STATUS = new Map<string, number>([
  ["23502", 400], // not_null_violation
  ["23503", 409], // foreign_key_violation
  ["23505", 409], // unique_violation
  ["23514", 400], // check_violation
  ["40001", 500], // serialization_failure
  ["40P01", 500], // deadlock_detected
  ["P0001", 400], // raise_exception
]);

export function isConfirmedCommitRejection(
  error: unknown,
  status: number,
): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const fields = error as Record<string, unknown>;

  return (
    Number.isInteger(status) &&
    typeof fields.code === "string" &&
    typeof fields.message === "string" &&
    (fields.details === null || typeof fields.details === "string") &&
    (fields.hint === null || typeof fields.hint === "string") &&
    COMMIT_REJECTION_STATUS.get(fields.code) === status
  );
}

export class AccountFencingRejectedError extends Error {
  constructor() {
    super("Plaid account persistence rejected by fencing");
    this.name = "AccountFencingRejectedError";
  }
}

export class AccountCommitUnconfirmedError extends Error {
  constructor(cause: unknown) {
    super("Plaid account commit outcome is unconfirmed", { cause });
    this.name = "AccountCommitUnconfirmedError";
  }
}
