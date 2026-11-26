import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordSyncFailure } from "@/features/plaid/server/recordSyncFailure";
import { recordItemError } from "@/features/plaid/server/recordItemError";
import { SyncFailureError } from "@/features/plaid/server/syncFailureError";
import { sensitiveError } from "./fixtures";

const identity = { userId: "user", plaidItemUuid: "item" };
const failure = { ...identity, leaseToken: "original-token", expectedCursor: "original-cursor", errorCode: "ITEM_LOGIN_REQUIRED", requiresUpdate: true };
const client = (value: unknown) => value as SupabaseClient;
afterEach(() => vi.restoreAllMocks());

it.each([true, false])("forwards the acquired fence and returns %s", async (data) => {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  expect(await recordSyncFailure({ ...failure, supabase: client({ rpc }) })).toBe(data);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("record_plaid_sync_failure", {
    p_user_id: "user", p_item_id: "item", p_lease_token: "original-token",
    p_expected_cursor: "original-cursor", p_error_code: "ITEM_LOGIN_REQUIRED", p_requires_update: true,
  });
});
it("preserves a null cursor", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  await recordSyncFailure({ ...failure, expectedCursor: null, supabase: client({ rpc }) });
  expect(rpc.mock.calls[0][1].p_expected_cursor).toBeNull();
});
it.each([null, undefined, "true", 1, {}, []])("rejects an unexpected RPC response: %j", async (data) => {
  const rpc = vi.fn().mockResolvedValue({ data, error: null });
  await expect(recordSyncFailure({ ...failure, supabase: client({ rpc }) })).rejects.toThrow("Invalid sync failure RPC response");
});
it("preserves database errors and leaves logging to the worker without raw output", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = sensitiveError();
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  await expect(recordSyncFailure({ ...failure, supabase: client({ rpc }) })).rejects.toMatchObject({ cause: error });
  expect(log).not.toHaveBeenCalled();
});
it.each(["recorded", "skipped", "failed"] as const)("preserves the original error and %s outcome", (status) => {
  const originalError = sensitiveError();
  const error = new SyncFailureError(originalError, status);
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(SyncFailureError);
  expect(error.originalError).toBe(originalError);
  expect(error.cause).toBe(originalError);
  expect(error.recordingStatus).toBe(status);
});

function itemClient(data: unknown, error: unknown = null) {
  const chain = {
    update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  const from = vi.fn().mockReturnValue(chain);
  return { chain, from, supabase: client({ from }) };
}
it.each([{ id: "item" }, null])("records only scoped, non-revoked Item errors: %j", async (data) => {
  const db = itemClient(data);
  expect(await recordItemError({ ...identity, supabase: db.supabase })).toBe(data !== null);
  expect(db.from).toHaveBeenCalledWith("plaid_items");
  expect(db.chain.eq.mock.calls).toEqual([["user_id", "user"], ["id", "item"]]);
  expect(db.chain.neq).toHaveBeenCalledWith("status", "revoked");
  expect(db.chain.update).toHaveBeenCalledWith({ last_sync_status: "failed", last_sync_error: "ITEM_LOGIN_REQUIRED", status: "error", updated_at: expect.any(String) });
});
it("propagates Item write errors for sanitized webhook logging", async () => {
  const error = sensitiveError();
  const db = itemClient(null, error);
  await expect(recordItemError({ ...identity, supabase: db.supabase })).rejects.toMatchObject({ cause: error });
});
