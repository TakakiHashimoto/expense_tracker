import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sensitiveError, sentinels } from "./fixtures";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createServerRoleClient: vi.fn(), grabUser: vi.fn(),
  linkTokenCreate: vi.fn(), itemPublicTokenExchange: vi.fn(), accountsGet: vi.fn(),
  syncPlaidItem: vi.fn(), persistPlaidAccounts: vi.fn(), recordSyncFailure: vi.fn(), verifyPlaidWebhook: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/server-role", () => ({ createServerRoleClient: mocks.createServerRoleClient }));
vi.mock("@/lib/getUser", () => ({ grabUser: mocks.grabUser }));
vi.mock("plaid", () => ({
  Configuration: class {}, PlaidApi: class {
    linkTokenCreate = mocks.linkTokenCreate;
    itemPublicTokenExchange = mocks.itemPublicTokenExchange;
    accountsGet = mocks.accountsGet;
  },
  CountryCode: { Ca: "CA" }, Products: { Transactions: "transactions" }, PlaidEnvironments: { sandbox: "https://plaid.invalid" },
}));
vi.mock("@/features/plaid/server/syncPlaidItem", () => ({ syncPlaidItem: mocks.syncPlaidItem }));
vi.mock("@/features/plaid/server/persitstPlaidAccounts", () => ({ persistPlaidAccounts: mocks.persistPlaidAccounts }));
vi.mock("@/features/plaid/server/recordSyncFailure", () => ({ recordSyncFailure: mocks.recordSyncFailure }));
vi.mock("@/app/api/plaid/webhook/verifyWebhooks", () => ({ verifyPlaidWebhook: mocks.verifyPlaidWebhook }));

import { POST as link } from "@/app/api/plaid/link-token/route";
import { POST as exchange } from "@/app/api/plaid/exchange/route";
import { POST as add } from "@/app/api/plaid/add-account/route";
import { POST as refresh } from "@/app/api/plaid/refresh-accounts/route";
import { POST as sync } from "@/app/api/plaid/sync-transactions/route";
import { POST as syncAll } from "@/app/api/plaid/sync-all/route";
import { POST as repair } from "@/app/api/plaid/update-link-token/route";
import { POST as webhook } from "@/app/api/plaid/webhook/route";

const item = { id: "item-uuid", user_id: "user-uuid", plaid_item_id: "provider-item", transactions_cursor: null };
function database(owned = true) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-uuid" } }, error: null }) },
    from: vi.fn((table: string) => {
      const data = table === "plaid_item_secrets" ? { access_token: sentinels[0] } : owned ? item : null;
      const chain = {
        select: vi.fn(() => chain), eq: vi.fn(() => chain), insert: vi.fn(() => chain),
        update: vi.fn(() => chain), delete: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: owned ? [item] : [], error: null }).then(resolve),
      };
      return chain;
    }),
  };
}
function request(body: object = {}) {
  return new NextRequest("https://bankos.example/api/plaid/fixture", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}
const itemRequest = () => request({ plaid_item_uuid: item.id, plaidItemUuid: item.id });
const webhookRequest = () => request({ item_id: item.plaid_item_id, webhook_type: "TRANSACTIONS", webhook_code: "SYNC_UPDATES_AVAILABLE" });
const cases = [
  { name: "link-token", run: () => link(), failure: mocks.linkTokenCreate },
  { name: "exchange", run: () => exchange(request({ public_token: "fixture-public-token" })), failure: mocks.itemPublicTokenExchange },
  { name: "add-account", run: () => add(itemRequest()), failure: mocks.linkTokenCreate },
  { name: "refresh-accounts", run: () => refresh(itemRequest()), failure: mocks.accountsGet },
  { name: "sync-transactions", run: () => sync(itemRequest()), failure: mocks.syncPlaidItem },
  { name: "sync-all", run: () => syncAll(), failure: mocks.syncPlaidItem },
  { name: "update-link-token", run: () => repair(itemRequest()), failure: mocks.linkTokenCreate },
  { name: "webhook", run: () => webhook(webhookRequest()), failure: mocks.syncPlaidItem },
];

beforeEach(() => {
  mocks.createClient.mockResolvedValue(database());
  mocks.createServerRoleClient.mockReturnValue(database());
  mocks.grabUser.mockResolvedValue({ id: "user-uuid" });
  mocks.linkTokenCreate.mockResolvedValue({ data: { link_token: "fixture-link-token" } });
  mocks.itemPublicTokenExchange.mockResolvedValue({ data: { access_token: sentinels[0], item_id: "provider-item" } });
  mocks.accountsGet.mockResolvedValue({ data: { accounts: [] } });
  mocks.syncPlaidItem.mockResolvedValue({ status: "synced", addedCount: 2, modifiedCount: 1, removedCount: 0 });
  mocks.persistPlaidAccounts.mockResolvedValue(undefined);
  mocks.recordSyncFailure.mockResolvedValue(item);
  mocks.verifyPlaidWebhook.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.mocked(console.error).mockRestore(); });

describe.each(cases)("$name route", ({ run, failure }) => {
  it("preserves a successful response with fixtures", async () => {
    const response = await run();
    expect(response.status).toBe(200);
    const output = await response.text();
    expect(output.length).toBeGreaterThan(2);
    for (const secret of sentinels) expect(output).not.toContain(secret);
  });
  it("contains sensitive provider failures in logs and responses", async () => {
    failure.mockRejectedValue(sensitiveError());
    const response = await run();
    expect(response.status).toBe(500);
    expect(console.error).toHaveBeenCalled();
    const output = JSON.stringify(vi.mocked(console.error).mock.calls) + await response.text();
    for (const secret of sentinels) expect(output).not.toContain(secret);
    for (const call of vi.mocked(console.error).mock.calls) {
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject({ event: "plaid_operation_failed" });
    }
  });
});

it.each([add, refresh, sync, repair])("checks ownership before privileged secret access", async (route) => {
  mocks.createClient.mockResolvedValue(database(false));
  const response = await route(itemRequest());
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(mocks.createServerRoleClient).not.toHaveBeenCalled();
});

it("rejects unauthenticated sync-all before privileged access", async () => {
  const db = database();
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.createClient.mockResolvedValue(db);
  expect((await syncAll()).status).toBe(401);
  expect(mocks.createServerRoleClient).not.toHaveBeenCalled();
});

it("preserves login-required recovery without exposing the original error", async () => {
  mocks.syncPlaidItem.mockRejectedValue(sensitiveError("ITEM_LOGIN_REQUIRED"));
  const response = await sync(itemRequest());
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ error: "ITEM_LOGIN_REQUIRED", plaidItemId: item.id });
  expect(mocks.recordSyncFailure).toHaveBeenCalledWith(expect.objectContaining({ requiresUpdate: true, errorCode: "ITEM_LOGIN_REQUIRED" }));
});

it("preserves the busy-sync contract", async () => {
  mocks.syncPlaidItem.mockResolvedValue({ status: "busy" });
  expect((await sync(itemRequest())).status).toBe(409);
  const response = await webhook(webhookRequest());
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("30");
});

it("rejects unverified webhooks before database access", async () => {
  mocks.verifyPlaidWebhook.mockResolvedValue(false);
  expect((await webhook(webhookRequest())).status).toBe(401);
  expect(mocks.createServerRoleClient).not.toHaveBeenCalled();
});

it("contains unexpected failures outside the webhook sync catch", async () => {
  mocks.createServerRoleClient.mockImplementation(() => { throw sensitiveError(); });
  const response = await webhook(webhookRequest());
  expect(response.status).toBe(500);
  for (const secret of sentinels) expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
});
