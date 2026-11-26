import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { PlaidApi } from "plaid";
import { sensitiveError, sentinels } from "./fixtures";

// Exercise the installed SDK, real persistSyncResult, traceSyncStage and worker.
// Only the HTTP transport and the other worker stages are replaced.
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), client: vi.fn(), acquire: vi.fn(), sync: vi.fn(),
  fetchAccounts: vi.fn(), accounts: vi.fn(), record: vi.fn(), release: vi.fn(),
}));
vi.mock("@/lib/supabase/server-role", () => ({ createServerRoleClient: mocks.client }));
vi.mock("@/features/plaid/server/syncLease", () => ({ aquireSyncLease: mocks.acquire }));
vi.mock("@/features/plaid/server/sync", () => ({ syncTransactions: mocks.sync }));
vi.mock("@/features/plaid/server/accounts", () => ({ fetchPlaidAccounts: mocks.fetchAccounts }));
vi.mock("@/features/plaid/server/persitstPlaidAccounts", () => ({ persistPlaidAccounts: mocks.accounts }));
vi.mock("@/features/plaid/server/recordSyncFailure", () => ({ recordSyncFailure: mocks.record }));
vi.mock("@/features/plaid/server/unlockRelase", () => ({ unlockLease: mocks.release }));
import { persistSyncResult, SyncCommitUnconfirmedError } from "@/features/plaid/server/db";
import { syncPlaidItem } from "@/features/plaid/server/syncPlaidItem";
import { SyncFailureError } from "@/features/plaid/server/syncFailureError";

const args = {
  userId: "user", itemUuid: "item", leaseToken: "token",
  expectedCursor: "same-cursor", cursor: "same-cursor",
  added: [], modified: [], removed: [],
};
function sdkClient() {
  return createClient("https://supabase.invalid", "fixture-service-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: mocks.fetch },
  });
}
function worker() {
  return syncPlaidItem({
    supabase: mocks.client(), userId: args.userId, plaidItemUuid: args.itemUuid,
    plaidClient: {} as PlaidApi, accessToken: sentinels[0], refreshAccount: false,
  });
}
function errorResponse(code: unknown, status: number) {
  return Response.json({ code, message: "fixture", details: null, hint: null }, { status });
}
function expectOneCommitPost() {
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const [url, init] = mocks.fetch.mock.calls[0];
  expect(url).toBe("https://supabase.invalid/rest/v1/rpc/commit_plaid_sync");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toMatchObject({
    p_lease_token: "token", p_expected_cursor: "same-cursor", p_next_cursor: "same-cursor",
  });
}
function expectNoFailureWrite(error: unknown) {
  expect(error).toBeInstanceOf(SyncFailureError);
  expect(error).toMatchObject({ recordingStatus: "failed" });
  expect((error as SyncFailureError).originalError).toBeInstanceOf(SyncCommitUnconfirmedError);
  expect(mocks.record).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledExactlyOnceWith({
    supabase: mocks.client(), userId: "user", plaidItemUuid: "item", token: "token",
  });
  expectOneCommitPost();
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.client.mockReturnValue(sdkClient());
  mocks.acquire.mockResolvedValue({ acquired: true, token: "token", cursor: "same-cursor" });
  mocks.sync.mockResolvedValue({ added: [], modified: [], removed: [], cursor: "same-cursor" });
  mocks.record.mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

it("accepts a confirmed commit even if the cursor did not change", async () => {
  mocks.fetch.mockResolvedValue(new Response(null, { status: 204 }));
  await expect(persistSyncResult(args)).resolves.toMatchObject({ success: true });
  expectOneCommitPost();
});

const unconfirmed = [
  { code: "57P01", status: 500 }, // admin_shutdown
  { code: "57P02", status: 500 }, // crash_shutdown
  { code: "ZZZZZ", status: 400 }, // unknown but SQLSTATE-shaped
  { code: "08000", status: 503 },
  { code: "08006", status: 503 },
  { code: "08007", status: 503 },
  { code: "40003", status: 500 },
  { code: "PGRST000", status: 503 },
  { code: "42501", status: 403 }, // intentionally outside the minimal allowlist
  { code: "57014", status: 500 },
  { code: "", status: 502 },
  { code: 12345, status: 500 },
  { code: null, status: 500 },
  { code: "23514", status: 502 }, // known code does not authenticate a gateway error
  { code: "P0001", status: 503 },
];
describe.each(unconfirmed)("unconfirmed $code / HTTP $status", ({ code, status }) => {
  it("preserves the SDK error as the cause", async () => {
    mocks.fetch.mockResolvedValue(errorResponse(code, status));
    const error = await persistSyncResult(args).catch((e) => e);
    expect(error).toBeInstanceOf(SyncCommitUnconfirmedError);
    expect(error.cause).toMatchObject({ code, message: "fixture" });
    expectOneCommitPost();
  });
  it("cannot reach failure recording through the worker", async () => {
    mocks.fetch.mockResolvedValue(errorResponse(code, status));
    expectNoFailureWrite(await worker().catch((e) => e));
  });
});

const rejected = [
  { code: "23502", status: 400 },
  { code: "23503", status: 409 },
  { code: "23505", status: 409 },
  { code: "23514", status: 400 },
  { code: "40001", status: 500 },
  { code: "40P01", status: 500 },
  { code: "P0001", status: 400 },
];
it.each(rejected)("records failure after reviewed rejection $code / $status", async ({ code, status }) => {
  mocks.fetch.mockResolvedValue(errorResponse(code, status));
  const error = await worker().catch((e) => e);
  expect(error).toBeInstanceOf(SyncFailureError);
  expect(error.recordingStatus).toBe("recorded");
  expect(error.originalError).not.toBeInstanceOf(SyncCommitUnconfirmedError);
  expect(error.originalError.cause).toMatchObject({ code });
  expect(mocks.record).toHaveBeenCalledExactlyOnceWith({
    supabase: mocks.client(), userId: "user", plaidItemUuid: "item",
    leaseToken: "token", expectedCursor: "same-cursor", errorCode: "SYNC_FAILED", requiresUpdate: false,
  });
  expect(mocks.record.mock.invocationCallOrder[0]).toBeLessThan(mocks.release.mock.invocationCallOrder[0]);
  expectOneCommitPost();
});

it.each([null, false, { code: "23514" }])("does not trust a malformed error body %j", async (body) => {
  mocks.fetch.mockResolvedValue(Response.json(body, { status: 400 }));
  expectNoFailureWrite(await worker().catch((e) => e));
});
it("treats a gateway HTML response as unconfirmed", async () => {
  mocks.fetch.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
  expectNoFailureWrite(await worker().catch((e) => e));
});
it("treats transport exceptions as unconfirmed, even when they carry an allowlisted code", async () => {
  mocks.fetch.mockRejectedValue(Object.assign(sensitiveError(), { code: "23514" }));
  const error = await worker().catch((e) => e);
  expectNoFailureWrite(error);
  // Default SDK behavior: network failure is a resolved error with code '' / status 0.
  expect(error.originalError.cause.code).toBe("");
  for (const secret of sentinels) expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
});
it("also contains a rejected RPC promise", async () => {
  const cause = sensitiveError();
  const retry = vi.fn().mockRejectedValue(cause);
  mocks.client.mockReturnValue({ rpc: vi.fn().mockReturnValue({ retry }) });
  await expect(persistSyncResult(args)).rejects.toMatchObject({ name: "SyncCommitUnconfirmedError", cause });
  expect(retry).toHaveBeenCalledWith(false);
});
it("does not overwrite a same-cursor commit when its successful response body is lost", async () => {
  let committed = false;
  mocks.fetch.mockImplementation(async () => {
    committed = true; // Synthetic transport: server finished, then the body stream failed.
    const response = new Response(null, { status: 200 });
    vi.spyOn(response, "text").mockRejectedValue(new Error("response lost after commit"));
    return response;
  });
  expectNoFailureWrite(await worker().catch((e) => e));
  expect(committed).toBe(true);
});
it("does not read transaction counts or run fallible logging after confirmed commit", async () => {
  let committed = false;
  const added = new Proxy([], {
    get(target, key, receiver) {
      if (committed && key === "length") throw new Error("post-commit count read");
      return Reflect.get(target, key, receiver);
    },
  });
  mocks.sync.mockResolvedValue({ added, modified: [], removed: [], cursor: "same-cursor" });
  mocks.fetch.mockImplementation(async () => {
    committed = true;
    return new Response(null, { status: 204 });
  });
  mocks.release.mockRejectedValue(sensitiveError());
  vi.mocked(console.error).mockImplementation(() => { throw new Error("logging sink failed"); });
  await expect(worker()).resolves.toEqual({ status: "synced", addedCount: 0, modifiedCount: 0, removedCount: 0 });
  expect(committed).toBe(true);
  expect(mocks.record).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
  expectOneCommitPost();
});
it.each([503, 520])("the installed SDK never retries default RPC POST on HTTP %s", async (status) => {
  mocks.fetch.mockResolvedValue(errorResponse("PGRST000", status));
  await sdkClient().rpc("commit_plaid_sync", {}); // No explicit .retry(false).
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.fetch.mock.calls[0][1].method).toBe("POST");
});
it("the installed SDK never retries default RPC POST after a network exception", async () => {
  mocks.fetch.mockRejectedValue(new Error("connection lost"));
  const result = await sdkClient().rpc("commit_plaid_sync", {});
  expect(result.status).toBe(0);
  expect(result.error?.code).toBe("");
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
});
it("explicitly disables retries for the atomic commit request", async () => {
  const retry = vi.fn().mockResolvedValue({ error: null, status: 204 });
  mocks.client.mockReturnValue({ rpc: vi.fn().mockReturnValue({ retry }) });
  await persistSyncResult(args);
  expect(retry).toHaveBeenCalledExactlyOnceWith(false);
});
