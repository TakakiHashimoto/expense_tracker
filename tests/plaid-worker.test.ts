import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaidApi } from "plaid";
import { sensitiveError, sentinels } from "./fixtures";

const mocks = vi.hoisted(() => ({ acquire: vi.fn(), sync: vi.fn(), fetch: vi.fn(), accounts: vi.fn(), commit: vi.fn(), record: vi.fn(), release: vi.fn() }));
vi.mock("@/features/plaid/server/syncLease", () => ({ aquireSyncLease: mocks.acquire }));
vi.mock("@/features/plaid/server/sync", () => ({ syncTransactions: mocks.sync }));
vi.mock("@/features/plaid/server/accounts", () => ({ fetchPlaidAccounts: mocks.fetch }));
vi.mock("@/features/plaid/server/persitstPlaidAccounts", () => ({ persistPlaidAccounts: mocks.accounts }));
vi.mock("@/features/plaid/server/db", async (importOriginal) => ({ ...await importOriginal<object>(), persistSyncResult: mocks.commit }));
vi.mock("@/features/plaid/server/recordSyncFailure", () => ({ recordSyncFailure: mocks.record }));
vi.mock("@/features/plaid/server/unlockRelase", () => ({ unlockLease: mocks.release }));
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { SyncFailureError } from "@/features/plaid/server/syncFailureError";
import { SyncCommitUnconfirmedError } from "@/features/plaid/server/db";

const args = { supabase: {} as SupabaseClient, plaidClient: {} as PlaidApi, userId: "user", plaidItemUuid: "item", accessToken: sentinels[0], refreshAccount: true };
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.acquire.mockResolvedValue({ acquired: true, token: "original-token", cursor: "original-cursor" });
  mocks.sync.mockResolvedValue({ added: [], modified: [], removed: [], cursor: "next-cursor" });
  mocks.fetch.mockResolvedValue([]);
  mocks.record.mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

it("commits with the acquired fence, never records failure on success, and releases", async () => {
  expect(await syncPlaidItem(args)).toEqual({ status: "synced", addedCount: 0, modifiedCount: 0, removedCount: 0 });
  expect(mocks.commit).toHaveBeenCalledWith(expect.objectContaining({ leaseToken: "original-token", expectedCursor: "original-cursor" }));
  expect(mocks.record).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith({ supabase: args.supabase, userId: "user", plaidItemUuid: "item", token: "original-token" });
});
it("does nothing after a busy lease", async () => {
  mocks.acquire.mockResolvedValue({ acquired: false });
  expect(await syncPlaidItem(args)).toEqual({ status: "busy" });
  for (const fn of [mocks.sync, mocks.record, mocks.release]) expect(fn).not.toHaveBeenCalled();
});
it("preserves a pre-acquisition failure without recording or releasing", async () => {
  const error = sensitiveError();
  mocks.acquire.mockRejectedValue(error);
  await expect(syncPlaidItem(args)).rejects.toBe(error);
  expect(mocks.record).not.toHaveBeenCalled();
  expect(mocks.release).not.toHaveBeenCalled();
});
it.each([true, false, "error"])("propagates recording outcome %s and original error", async (outcome) => {
  const original = sensitiveError("ITEM_LOGIN_REQUIRED");
  mocks.sync.mockRejectedValue(original);
  if (outcome === "error") mocks.record.mockRejectedValue(new Error("record failure", { cause: { code: "23514", details: sentinels } }));
  else mocks.record.mockResolvedValue(outcome);
  const error = await syncPlaidItem(args).catch((e) => e);
  expect(error).toBeInstanceOf(SyncFailureError);
  expect(error.originalError).toBe(original);
  expect(error.cause).toBe(original);
  expect(error.recordingStatus).toBe(outcome === true ? "recorded" : outcome === false ? "skipped" : "failed");
  expect(mocks.record).toHaveBeenCalledExactlyOnceWith({ supabase: args.supabase, userId: "user", plaidItemUuid: "item", leaseToken: "original-token", expectedCursor: "original-cursor", errorCode: "ITEM_LOGIN_REQUIRED", requiresUpdate: true });
  expect(mocks.record.mock.invocationCallOrder[0]).toBeLessThan(mocks.release.mock.invocationCallOrder[0]);
  if (outcome === "error") {
    const recordingLogs = vi.mocked(console.error).mock.calls.filter(([entry]) => entry.operation === "record_sync_failure");
    expect(recordingLogs).toHaveLength(1);
    expect(recordingLogs[0][0].code).toBe("23514");
  }
  for (const secret of sentinels) expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
});
it.each(["sync", "fetch", "accounts", "commit"] as const)("records generic failure at %s", async (stage) => {
  mocks[stage].mockRejectedValue(new Error("fixture"));
  await expect(syncPlaidItem(args)).rejects.toMatchObject({ recordingStatus: "recorded" });
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ errorCode: "SYNC_FAILED", requiresUpdate: false }));
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("waits for failure recording before releasing the lease", async () => {
  let finish!: (value: boolean) => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  mocks.sync.mockRejectedValue(new Error("fixture"));
  mocks.record.mockImplementation(() => { entered(); return new Promise<boolean>((resolve) => { finish = resolve; }); });
  const pending = syncPlaidItem(args).catch((error) => error);
  await started;
  expect(mocks.release).not.toHaveBeenCalled();
  finish(false);
  expect((await pending).recordingStatus).toBe("skipped");
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("forwards a null lease cursor and can skip account refresh", async () => {
  mocks.acquire.mockResolvedValue({ acquired: true, token: "original-token", cursor: null });
  mocks.commit.mockRejectedValue(new Error("fixture"));
  await expect(syncPlaidItem({ ...args, refreshAccount: false })).rejects.toMatchObject({ recordingStatus: "recorded" });
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ expectedCursor: null }));
});
it("does not overwrite a possibly committed sync when its RPC response is lost", async () => {
  const error = new SyncCommitUnconfirmedError(sensitiveError());
  mocks.commit.mockRejectedValue(error);
  await expect(syncPlaidItem(args)).rejects.toMatchObject({ originalError: error, recordingStatus: "failed" });
  expect(mocks.record).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
});
it.each([true, false])("release/logging failure cannot mask sync success=%s", async (success) => {
  const original = sensitiveError();
  if (!success) mocks.sync.mockRejectedValue(original);
  mocks.release.mockRejectedValue(sensitiveError());
  vi.mocked(console.error).mockImplementation(() => { throw new Error("logging sink failed"); });
  if (success) {
    await expect(syncPlaidItem(args)).resolves.toMatchObject({ status: "synced" });
    expect(mocks.record).not.toHaveBeenCalled();
  } else {
    await expect(syncPlaidItem(args)).rejects.toMatchObject({ originalError: original });
  }
});
