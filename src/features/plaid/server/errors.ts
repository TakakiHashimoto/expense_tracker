import "server-only";

// Never log arbitrary strings from a provider, Error, request, or database.
// Unknown codes deliberately collapse to UNKNOWN_ERROR until reviewed here.
const PLAID_CODES = new Set([
  "ITEM_LOGIN_REQUIRED", "ITEM_LOCKED", "ITEM_NOT_SUPPORTED",
  "INVALID_ACCESS_TOKEN", "INVALID_PUBLIC_TOKEN", "INVALID_LINK_TOKEN",
  "INVALID_API_KEYS", "INVALID_REQUEST", "INVALID_FIELD", "MISSING_FIELDS",
  "INSTITUTION_DOWN", "INSTITUTION_NOT_RESPONDING", "INSTITUTION_NOT_AVAILABLE",
  "INTERNAL_SERVER_ERROR", "PLANNED_MAINTENANCE", "PRODUCT_NOT_READY",
  "PRODUCT_NOT_ENABLED", "RATE_LIMIT_EXCEEDED", "TRANSACTIONS_LIMIT",
  "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
]);
const OTHER_CODES = new Set([
  "23503", "23505", "23514", "42501", "PGRST116", "PGRST204",
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ECONNABORTED",
  "ERR_JWT_EXPIRED", "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED", "ERR_JWS_INVALID",
]);
const OPERATIONS = [
  "link_token", "exchange", "add_account", "refresh_accounts",
  "sync_transactions", "sync_all", "update_link_token", "webhook",
  "verify_webhook", "persist_accounts", "persist_transactions", "record_sync_failure",
] as const;
export type PlaidOperation = typeof OPERATIONS[number];

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown> : undefined;
}

export function getPlaidError(error: unknown): { error_code: string } | null {
  try {
    const data = record(record(record(error)?.response)?.data);
    const code = data?.error_code;
    return typeof code === "string" && PLAID_CODES.has(code)
      ? { error_code: code } : null;
  } catch {
    return null;
  }
}

export function logPlaidError(operation: PlaidOperation, error: unknown): void {
  let code = "UNKNOWN_ERROR";
  let httpStatus: number | undefined;
  try {
    const directCode = record(error)?.code;
    code = getPlaidError(error)?.error_code ??
      (typeof directCode === "string" && OTHER_CODES.has(directCode)
        ? directCode : "UNKNOWN_ERROR");
    const status = record(record(error)?.response)?.status;
    if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) {
      httpStatus = status;
    }
  } catch {
    // Logging must also tolerate malformed errors and throwing getters.
  }
  console.error({
    event: "plaid_operation_failed",
    operation: OPERATIONS.includes(operation) ? operation : "unknown",
    code,
    ...(httpStatus === undefined ? {} : { httpStatus }),
  });
}
