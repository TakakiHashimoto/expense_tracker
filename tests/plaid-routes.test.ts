import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sensitiveError, sentinels } from "./fixtures";
import { SyncFailureError } from "@/features/plaid/server/syncFailureError";
import { SyncCommitUnconfirmedError } from "@/features/plaid/server/db";
import { AccountCommitUnconfirmedError } from "@/features/plaid/server/rpcCommitOutcome";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServerRoleClient: vi.fn(),
  grabUser: vi.fn(),
  linkTokenCreate: vi.fn(),
  itemPublicTokenExchange: vi.fn(),
  accountsGet: vi.fn(),
  syncPlaidItem: vi.fn(),
  persistPlaidAccounts: vi.fn(),
  recordSyncFailure: vi.fn(),
  recordItemError: vi.fn(),
  verifyPlaidWebhook: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/server-role", () => ({
  createServerRoleClient: mocks.createServerRoleClient,
}));
vi.mock("@/lib/getUser", () => ({ grabUser: mocks.grabUser }));
vi.mock("plaid", () => ({
  Configuration: class {},
  PlaidApi: class {
    linkTokenCreate = mocks.linkTokenCreate;
    itemPublicTokenExchange = mocks.itemPublicTokenExchange;
    accountsGet = mocks.accountsGet;
  },
  CountryCode: { Ca: "CA" },
  Products: { Transactions: "transactions" },
  PlaidEnvironments: { sandbox: "https://plaid.invalid" },
}));
vi.mock("@/features/plaid/server/syncPlaidItem", () => ({
  syncPlaidItem: mocks.syncPlaidItem,
}));
vi.mock("@/features/plaid/server/persitstPlaidAccounts", () => ({
  persistPlaidAccounts: mocks.persistPlaidAccounts,
}));
vi.mock("@/features/plaid/server/recordSyncFailure", () => ({
  recordSyncFailure: mocks.recordSyncFailure,
}));
vi.mock("@/features/plaid/server/recordItemError", () => ({
  recordItemError: mocks.recordItemError,
}));
vi.mock("@/app/api/plaid/webhook/verifyWebhooks", () => ({
  verifyPlaidWebhook: mocks.verifyPlaidWebhook,
}));

import { POST as link } from "@/app/api/plaid/link-token/route";
import { POST as exchange } from "@/app/api/plaid/exchange/route";
import { POST as add } from "@/app/api/plaid/add-account/route";
import { POST as refresh } from "@/app/api/plaid/refresh-accounts/route";
import { POST as sync } from "@/app/api/plaid/sync-transactions/route";
import { POST as syncAll } from "@/app/api/plaid/sync-all/route";
import { POST as repair } from "@/app/api/plaid/update-link-token/route";
import { POST as webhook } from "@/app/api/plaid/webhook/route";

const item = {
  id: "item-uuid",
  user_id: "user-uuid",
  plaid_item_id: "provider-item",
  transactions_cursor: null,
};
function database(owned = true, items = [item]) {
  return {
    rpc: vi
      .fn()
      .mockReturnValue({
        retry: vi
          .fn()
          .mockResolvedValue({
            data: {
              status: "created",
              item_id: "00000000-0000-4000-8000-000000000001",
            },
            error: null,
            status: 200,
          }),
      }),

    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({
          data: { user: { id: "user-uuid" } },
          error: null,
        }),
    },
    from: vi.fn((table: string) => {
      const data =
        table === "plaid_item_secrets"
          ? { access_token: sentinels[0] }
          : owned
            ? item
            : null;
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue({ data, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data: owned ? items : [], error: null }).then(
            resolve,
          ),
      };
      return chain;
    }),
  };
}
function request(body: object = {}) {
  return new NextRequest("https://bankos.example/api/plaid/fixture", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const itemRequest = () =>
  request({ plaid_item_uuid: item.id, plaidItemUuid: item.id });
const webhookRequest = () =>
  request({
    item_id: item.plaid_item_id,
    webhook_type: "TRANSACTIONS",
    webhook_code: "SYNC_UPDATES_AVAILABLE",
  });
const cases = [
  { name: "link-token", run: () => link(), failure: mocks.linkTokenCreate },
  {
    name: "exchange",
    run: () => exchange(request({ public_token: "fixture-public-token" })),
    failure: mocks.itemPublicTokenExchange,
  },
  {
    name: "add-account",
    run: () => add(itemRequest()),
    failure: mocks.linkTokenCreate,
  },
  {
    name: "refresh-accounts",
    run: () => refresh(itemRequest()),
    failure: mocks.syncPlaidItem,
  },

  {
    name: "sync-transactions",
    run: () => sync(itemRequest()),
    failure: mocks.syncPlaidItem,
  },
  { name: "sync-all", run: () => syncAll(), failure: mocks.syncPlaidItem },
  {
    name: "update-link-token",
    run: () => repair(itemRequest()),
    failure: mocks.linkTokenCreate,
  },
  {
    name: "webhook",
    run: () => webhook(webhookRequest()),
    failure: mocks.syncPlaidItem,
  },
];

beforeEach(() => {
  vi.clearAllMocks();

  mocks.createClient.mockResolvedValue(database());
  mocks.createServerRoleClient.mockReturnValue(database());
  mocks.grabUser.mockResolvedValue({ id: "user-uuid" });
  mocks.linkTokenCreate.mockResolvedValue({
    data: { link_token: "fixture-link-token" },
  });
  mocks.itemPublicTokenExchange.mockResolvedValue({
    data: { access_token: sentinels[0], item_id: "provider-item" },
  });
  mocks.accountsGet.mockResolvedValue({
    data: {
      accounts: [
        {
          account_id: "fixture-account",
          name: "Checking",
          official_name: null,
          mask: "1234",
          type: "depository",
          subtype: "checking",
          balances: {
            current: 1500,
            available: 1200,
            limit: null,
            iso_currency_code: "CAD",
            unofficial_currency_code: null,
          },
        },
      ],
    },
  });
  mocks.syncPlaidItem.mockResolvedValue({
    status: "synced",
    addedCount: 2,
    modifiedCount: 1,
    removedCount: 0,
  });
  mocks.persistPlaidAccounts.mockResolvedValue(undefined);
  mocks.recordSyncFailure.mockResolvedValue(item);
  mocks.recordItemError.mockResolvedValue(true);
  mocks.verifyPlaidWebhook.mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.mocked(console.error).mockRestore();
});

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
    const output =
      JSON.stringify(vi.mocked(console.error).mock.calls) +
      (await response.text());
    for (const secret of sentinels) expect(output).not.toContain(secret);
    for (const call of vi.mocked(console.error).mock.calls) {
      expect(call).toHaveLength(1);
      expect(call[0]).toMatchObject({ event: "plaid_operation_failed" });
    }
  });
});

it.each([add, refresh, sync, repair])(
  "checks ownership before privileged secret access",
  async (route) => {
    mocks.createClient.mockResolvedValue(database(false));
    const response = await route(itemRequest());
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(mocks.createServerRoleClient).not.toHaveBeenCalled();
  },
);

it("rejects unauthenticated sync-all before privileged access", async () => {
  const db = database();
  db.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.createClient.mockResolvedValue(db);
  expect((await syncAll()).status).toBe(401);
  expect(mocks.createServerRoleClient).not.toHaveBeenCalled();
});

it("preserves login-required recovery without exposing the original error", async () => {
  mocks.syncPlaidItem.mockRejectedValue(
    new SyncFailureError(sensitiveError("ITEM_LOGIN_REQUIRED"), "recorded"),
  );

  const response = await sync(itemRequest());

  expect(response.status).toBe(409);

  expect(await response.json()).toMatchObject({
    error: "ITEM_LOGIN_REQUIRED",
    plaidItemId: item.id,
  });

  expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
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
  mocks.createServerRoleClient.mockImplementation(() => {
    throw sensitiveError();
  });
  const response = await webhook(webhookRequest());
  expect(response.status).toBe(500);
  for (const secret of sentinels)
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      secret,
    );
});

it.each([
  { name: "sync-transactions", run: () => sync(itemRequest()) },
  { name: "sync-all", run: () => syncAll() },
  { name: "refresh-accounts", run: () => refresh(itemRequest()) },
  { name: "verified webhook", run: () => webhook(webhookRequest()) },
])("$name uses Service Role Client for synchronization", async ({ run }) => {
  // Create a distinct Service Role mock.
  const adminClient = database();

  mocks.createServerRoleClient.mockReturnValue(adminClient);

  const response = await run();

  expect(response.status).toBe(200);

  // Synchronization must receive the privileged client.
  expect(mocks.syncPlaidItem).toHaveBeenCalledWith(
    expect.objectContaining({ supabase: adminClient }),
  );
});

it("exchange initializes all records through one privileged RPC", async () => {
  const adminClient = database();

  mocks.createServerRoleClient.mockReturnValue(adminClient);

  const response = await exchange(
    request({ public_token: "fixture-public-token" }),
  );

  expect(response.status).toBe(200);

  expect(await response.json()).toEqual({
    plaid_item_uuid: "00000000-0000-4000-8000-000000000001",
  });

  expect(adminClient.rpc).toHaveBeenCalledExactlyOnceWith(
    "initialize_plaid_item",
    {
      p_user_id: "user-uuid",
      p_plaid_item_id: "provider-item",
      p_access_token: sentinels[0],
      p_institution_id: null,
      p_institution_name: null,
      p_snapshot_time: expect.any(String),
      p_accounts: [
        {
          plaid_account_id: "fixture-account",
          name: "Checking",
          official_name: null,
          mask: "1234",
          type: "depository",
          subtype: "checking",
          currency: "CAD",
          current_balance: 1500,
          available_balance: 1200,
        },
      ],
    },
  );

  const builder = adminClient.rpc.mock.results[0].value;

  expect(builder.retry).toHaveBeenCalledExactlyOnceWith(false);

  expect(adminClient.from).not.toHaveBeenCalled();
  expect(mocks.persistPlaidAccounts).not.toHaveBeenCalled();

  expect(mocks.accountsGet.mock.invocationCallOrder[0]).toBeLessThan(
    adminClient.rpc.mock.invocationCallOrder[0],
  );
});

it("exchange preserves the duplicate connection response", async () => {
  const adminClient = database();

  adminClient.rpc.mockReturnValue({
    retry: vi
      .fn()
      .mockResolvedValue({
        data: { status: "already_connected" },
        error: null,
        status: 200,
      }),
  });

  mocks.createServerRoleClient.mockReturnValue(adminClient);

  const response = await exchange(
    request({ public_token: "fixture-public-token" }),
  );

  expect(response.status).toBe(409);

  expect(await response.json()).toMatchObject({
    error: "This bank connection is already connected.",
    code: "ALREADY_CONNECTED",
  });

  expect(adminClient.from).not.toHaveBeenCalled();
});

it("exchange does not delete records after confirmed rollback", async () => {
  const adminClient = database();

  adminClient.rpc.mockReturnValue({
    retry: vi
      .fn()
      .mockResolvedValue({
        data: null,
        error: {
          code: "P0001",
          message: "Initialization failed",
          details: null,
          hint: null,
        },
        status: 400,
      }),
  });

  mocks.createServerRoleClient.mockReturnValue(adminClient);

  const response = await exchange(
    request({ public_token: "fixture-public-token" }),
  );

  expect(response.status).toBe(500);
  expect(adminClient.rpc).toHaveBeenCalledOnce();
  expect(adminClient.from).not.toHaveBeenCalled();
});

it("exchange preserves an unconfirmed initialization after transport failure", async () => {
  const adminClient = database();

  adminClient.rpc.mockReturnValue({
    retry: vi.fn().mockRejectedValue(sensitiveError()),
  });

  mocks.createServerRoleClient.mockReturnValue(adminClient);

  const response = await exchange(
    request({ public_token: "fixture-public-token" }),
  );

  expect(response.status).toBe(503);

  const body = await response.json();

  expect(body.code).toBe("CONNECTION_OUTCOME_UNCONFIRMED");

  expect(adminClient.rpc).toHaveBeenCalledOnce();
  expect(adminClient.from).not.toHaveBeenCalled();

  for (const secret of sentinels) {
    expect(JSON.stringify(body)).not.toContain(secret);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      secret,
    );
  }
});

it.each([
  { data: null, error: null, status: 200 },
  { data: { status: "created" }, error: null, status: 200 },
  {
    data: { status: "created", item_id: "invalid-uuid" },
    error: null,
    status: 200,
  },
  {
    data: null,
    error: {
      code: "PGRST000",
      message: "Connection unavailable",
      details: null,
      hint: null,
    },
    status: 503,
  },
])("exchange rejects unconfirmed RPC responses %#", async (rpcResponse) => {
  const adminClient = database();

  adminClient.rpc.mockReturnValue({
    retry: vi.fn().mockResolvedValue(rpcResponse),
  });

  mocks.createServerRoleClient.mockReturnValue(adminClient);

  const response = await exchange(
    request({ public_token: "fixture-public-token" }),
  );

  expect(response.status).toBe(503);

  expect(await response.json()).toMatchObject({
    code: "CONNECTION_OUTCOME_UNCONFIRMED",
  });

  expect(adminClient.rpc).toHaveBeenCalledOnce();
  expect(adminClient.from).not.toHaveBeenCalled();
});

it("exchange does not initialize records when account fetch fails", async () => {
  mocks.accountsGet.mockRejectedValue(sensitiveError());

  const response = await exchange(
    request({ public_token: "fixture-public-token" }),
  );

  expect(response.status).toBe(500);
  expect(mocks.createServerRoleClient).not.toHaveBeenCalled();
});

it.each([
  { name: "sync-transactions", run: () => sync(itemRequest()) },
  { name: "sync-all", run: () => syncAll() },
  { name: "refresh-accounts", run: () => refresh(itemRequest()) },
])("$name leaves failure recording to the worker", async ({ run }) => {
  // User Clientとは異なるオブジェクト
  const adminClient = database();

  mocks.createServerRoleClient.mockReturnValue(adminClient);

  // Plaid同期処理の失敗を再現
  mocks.syncPlaidItem.mockRejectedValue(new Error("Simulated sync failure"));

  const response = await run();

  expect(response.status).toBe(500);

  expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
  expect(mocks.recordItemError).not.toHaveBeenCalled();
});

const syncRoutes = [
  { name: "sync", run: () => sync(itemRequest()) },
  { name: "refresh", run: () => refresh(itemRequest()) },
  { name: "all", run: () => syncAll() },
];

describe.each(syncRoutes)("$name fenced failure responses", ({ name, run }) => {
  it.each([
    {
      code: "ITEM_LOGIN_REQUIRED",
      recording: "recorded",
      status: 409,
      error: "ITEM_LOGIN_REQUIRED",
    },
    {
      code: "INSTITUTION_DOWN",
      recording: "recorded",
      status: 500,
      error: "Failed to sync transactions",
    },
    {
      code: "ITEM_LOGIN_REQUIRED",
      recording: "skipped",
      status: 409,
      error: "SYNC_SUPERSEDED",
    },
    {
      code: "INSTITUTION_DOWN",
      recording: "skipped",
      status: 409,
      error: "SYNC_SUPERSEDED",
    },
    {
      code: "ITEM_LOGIN_REQUIRED",
      recording: "failed",
      status: 500,
      error: "Failed to sync transactions",
    },
    {
      code: "INSTITUTION_DOWN",
      recording: "failed",
      status: 500,
      error: "Failed to sync transactions",
    },
  ] as const)(
    "$code / $recording",
    async ({ code, recording, status, error }) => {
      mocks.syncPlaidItem.mockRejectedValue(
        new SyncFailureError(
          sensitiveError(code),
          recording,
          name === "refresh" ? "succeeded" : "not_requested",
        ),
      );

      const response = await run();

      expect(response.status).toBe(status);

      const body = await response.json();

      expect(body.error).toBe(error);

      if (name === "refresh") {
        expect(body).toMatchObject({
          accountRefreshSucceeded: true,
          accountRefreshStatus: "succeeded",
        });
      }

      if (error !== "ITEM_LOGIN_REQUIRED") {
        expect(body.plaidItemId).toBeUndefined();
      }

      expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
      expect(mocks.recordItemError).not.toHaveBeenCalled();

      expect(console.error).toHaveBeenCalledWith(
        expect.objectContaining({ code }),
      );

      for (const secret of sentinels) {
        expect(
          JSON.stringify(body) +
            JSON.stringify(vi.mocked(console.error).mock.calls),
        ).not.toContain(secret);
      }
    },
  );

  it("does not prompt repair for unwrapped pre-acquisition errors", async () => {
    mocks.syncPlaidItem.mockRejectedValue(
      sensitiveError("ITEM_LOGIN_REQUIRED"),
    );

    expect((await run()).status).toBe(500);
    expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
  });
});
it.each(["skipped", "recorded", "failed"] as const)(
  "sync-all continues other Items after %s",
  async (recording) => {
    mocks.createClient.mockResolvedValue(
      database(true, [
        item,
        { ...item, id: "second" },
        { ...item, id: "third" },
      ]),
    );
    mocks.syncPlaidItem
      .mockRejectedValueOnce(
        new SyncFailureError(sensitiveError("ITEM_LOGIN_REQUIRED"), recording),
      )
      .mockResolvedValueOnce({ status: "busy" });
    const response = await syncAll();
    expect(response.status).toBe(recording === "failed" ? 500 : 409);
    expect(await response.json()).toMatchObject({
      success: false,
      syncedItemCount: 1,
      busyItemCount: 1,
      addedCount: 2,
      failedItems: [
        {
          plaidItemId: item.id,
          error:
            recording === "skipped"
              ? "SYNC_SUPERSEDED"
              : recording === "failed"
                ? "SYNC_FAILED"
                : "ITEM_LOGIN_REQUIRED",
        },
      ],
    });
    expect(mocks.syncPlaidItem).toHaveBeenCalledTimes(3);
  },
);
it("aggregates multiple failures and prioritizes unconfirmed failures over repair prompts", async () => {
  mocks.createClient.mockResolvedValue(
    database(true, [item, { ...item, id: "second" }]),
  );
  mocks.syncPlaidItem
    .mockRejectedValueOnce(
      new SyncFailureError(sensitiveError("ITEM_LOGIN_REQUIRED"), "recorded"),
    )
    .mockRejectedValueOnce(new SyncFailureError(sensitiveError(), "failed"));
  const response = await syncAll();
  expect(response.status).toBe(500);
  const body = await response.json();
  expect(body.failedItems).toHaveLength(2);
  expect(body.plaidItemId).toBeUndefined();
});
it("reports refresh busy without claiming account success", async () => {
  mocks.syncPlaidItem.mockResolvedValue({ status: "busy" });

  const response = await refresh(itemRequest());

  expect(response.status).toBe(409);

  expect(await response.json()).toMatchObject({
    success: false,
    error: "SYNC_BUSY",
    accountRefreshSucceeded: false,
    accountRefreshStatus: "not_completed",
    transactionSyncStatus: "busy",
  });

  expect(mocks.accountsGet).not.toHaveBeenCalled();
  expect(mocks.persistPlaidAccounts).not.toHaveBeenCalled();
});

it("retains the aggregate busy contract", async () => {
  mocks.syncPlaidItem.mockResolvedValue({ status: "busy" });

  const response = await syncAll();

  expect(await response.json()).toMatchObject({
    success: true,
    busyItemCount: 1,
    syncedItemCount: 0,
  });
});
it.each([
  { code: "ITEM_LOGIN_REQUIRED", recording: "recorded", status: 200 },
  { code: "INSTITUTION_DOWN", recording: "recorded", status: 500 },
  { code: "ITEM_LOGIN_REQUIRED", recording: "skipped", status: 429 },
  { code: "INSTITUTION_DOWN", recording: "skipped", status: 429 },
  { code: "ITEM_LOGIN_REQUIRED", recording: "failed", status: 500 },
  { code: "INSTITUTION_DOWN", recording: "failed", status: 500 },
] as const)(
  "webhook $code / $recording",
  async ({ code, recording, status }) => {
    mocks.syncPlaidItem.mockRejectedValue(
      new SyncFailureError(sensitiveError(code), recording),
    );
    const response = await webhook(webhookRequest());
    expect(response.status).toBe(status);
    const body = await response.json();
    if (recording === "skipped") {
      expect(body).toEqual({
        ok: false,
        retry: true,
        reason: "SYNC_SUPERSEDED",
      });
      expect(response.headers.get("retry-after")).toBe("30");
    }
    expect(mocks.recordItemError).not.toHaveBeenCalled();
    expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
    for (const secret of sentinels)
      expect(JSON.stringify(body)).not.toContain(secret);
  },
);
it("does not acknowledge an unrecorded unwrapped webhook login failure", async () => {
  mocks.syncPlaidItem.mockRejectedValue(sensitiveError("ITEM_LOGIN_REQUIRED"));
  expect((await webhook(webhookRequest())).status).toBe(500);
  expect(mocks.recordItemError).not.toHaveBeenCalled();
});
const itemErrorRequest = () =>
  request({
    item_id: item.plaid_item_id,
    webhook_type: "ITEM",
    webhook_code: "ERROR",
    error: { error_code: "ITEM_LOGIN_REQUIRED" },
  });
it.each([true, false])(
  "uses only the verified ITEM ERROR path for Item writes (%s)",
  async (recorded) => {
    mocks.recordItemError.mockResolvedValue(recorded);
    const response = await webhook(itemErrorRequest());
    expect(response.status).toBe(200);
    if (!recorded)
      expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(mocks.recordItemError).toHaveBeenCalledExactlyOnceWith({
      supabase: mocks.createServerRoleClient.mock.results[0].value,
      userId: item.user_id,
      plaidItemUuid: item.id,
    });
    expect(mocks.syncPlaidItem).not.toHaveBeenCalled();
  },
);
it("returns a retryable error when an Item event write is unconfirmed", async () => {
  mocks.recordItemError.mockRejectedValue(sensitiveError());
  expect((await webhook(itemErrorRequest())).status).toBe(500);
});
it("verifies the raw body before handling an Item error", async () => {
  mocks.verifyPlaidWebhook.mockResolvedValue(false);
  const req = itemErrorRequest();
  const rawBody = await req.clone().text();
  expect((await webhook(req)).status).toBe(401);
  expect(mocks.verifyPlaidWebhook).toHaveBeenCalledWith({
    rawBody,
    plaidVerificationHeader: null,
  });
  expect(mocks.recordItemError).not.toHaveBeenCalled();
});
it.each([sync, refresh])(
  "does not use privileged access when user lookup fails",
  async (route) => {
    mocks.grabUser.mockRejectedValue(new Error("Unauthenticated"));
    expect((await route(itemRequest())).status).toBeGreaterThanOrEqual(400);
    expect(mocks.createServerRoleClient).not.toHaveBeenCalled();
  },
);

it("delegates account refresh to the shared worker", async () => {
  const response = await refresh(itemRequest());

  expect(response.status).toBe(200);

  expect(mocks.syncPlaidItem).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      refreshAccount: true,
      refreshAccountsFirst: true,
    }),
  );

  expect(mocks.accountsGet).not.toHaveBeenCalled();
  expect(mocks.persistPlaidAccounts).not.toHaveBeenCalled();

  expect(await response.json()).toMatchObject({
    success: true,
    accountRefreshSucceeded: true,
    accountRefreshStatus: "succeeded",
    transactionSyncStatus: "synced",
  });
});

it.each([
  {
    recording: "skipped",
    accountStatus: "not_completed",
    httpStatus: 409,
    error: "SYNC_SUPERSEDED",
  },
  {
    recording: "failed",
    accountStatus: "unconfirmed",
    httpStatus: 500,
    error: "Account refresh outcome is unconfirmed",
  },
  {
    recording: "recorded",
    accountStatus: "succeeded",
    httpStatus: 500,
    error: "Failed to sync transactions",
  },
  {
    recording: "recorded",
    accountStatus: "not_completed",
    httpStatus: 500,
    error: "Failed to refresh accounts",
  },
] as const)(
  "reports refresh outcome $accountStatus / $recording",
  async ({ recording, accountStatus, httpStatus, error }) => {
    mocks.syncPlaidItem.mockRejectedValue(
      new SyncFailureError(
        new Error("Simulated refresh failure"),
        recording,
        accountStatus,
      ),
    );

    const response = await refresh(itemRequest());

    expect(response.status).toBe(httpStatus);

    expect(await response.json()).toMatchObject({
      error,
      accountRefreshSucceeded: accountStatus === "succeeded",
      accountRefreshStatus: accountStatus,
    });

    expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
    expect(mocks.recordItemError).not.toHaveBeenCalled();
  },
);

it("preserves transaction commit uncertainty after accounts succeeded", async () => {
  mocks.syncPlaidItem.mockRejectedValue(new SyncFailureError(
    new SyncCommitUnconfirmedError(new TypeError("Response lost")), "failed", "succeeded",
  ));
  const response = await refresh(itemRequest());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: "TRANSACTION_SYNC_OUTCOME_UNCONFIRMED",
    accountRefreshSucceeded: true,
    accountRefreshStatus: "succeeded",
    transactionSyncStatus: "unconfirmed",
  });
  expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
  expect(mocks.recordItemError).not.toHaveBeenCalled();
});

it("keeps account commit uncertainty distinct from transaction uncertainty", async () => {
  mocks.syncPlaidItem.mockRejectedValue(new SyncFailureError(
    new AccountCommitUnconfirmedError(new TypeError("Response lost")), "failed", "unconfirmed",
  ));
  const response = await refresh(itemRequest());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: "Account refresh outcome is unconfirmed",
    accountRefreshSucceeded: false,
    accountRefreshStatus: "unconfirmed",
  });
  expect(mocks.recordSyncFailure).not.toHaveBeenCalled();
});
