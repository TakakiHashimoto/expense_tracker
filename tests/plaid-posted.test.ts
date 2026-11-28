import { beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { PlaidApi, Transaction } from "plaid";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/supabase/server-role", () => ({ createServerRoleClient: mocks.client }));
import { persistSyncResult } from "@/features/plaid/server/db";
import { syncTransactions } from "@/features/plaid/server/sync";
const args = { userId: "user", itemUuid: "item", leaseToken: "token", expectedCursor: "old", cursor: "new", added: [], modified: [], removed: [] };
function tx(reference: string | null | undefined, amount = 52): Transaction {
  return { transaction_id: "posted", account_id: "account", amount, pending: false,
    pending_transaction_id: reference, date: "2026-11-01", name: "Synthetic" } as Transaction;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.fetch.mockResolvedValue(new Response(null, { status: 204 }));
  mocks.client.mockReturnValue(createClient("https://supabase.invalid", "fixture", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: mocks.fetch },
  }));
});
it.each(["added", "modified"] as const)("forwards %s posted references through the installed SDK", async (field) => {
  await persistSyncResult({ ...args, [field]: [tx("pending")] });
  const payload = JSON.parse(mocks.fetch.mock.calls[0][1].body);
  expect(Object.keys(payload).sort()).toEqual(["p_user_id","p_item_id","p_lease_token","p_expected_cursor","p_next_cursor","p_added","p_modified","p_removed"].sort());
  expect(payload[`p_${field}`][0]).toMatchObject({ pending_transaction_id: "pending", amount: -52 });
});
it.each([null, undefined])("normalizes absent reference %s to NULL", async (reference) => {
  await persistSyncResult({ ...args, added: [tx(reference, -25)] });
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).p_added[0]).toMatchObject({ pending_transaction_id: null, amount: 25 });
});
it("collects posted additions and pending removals across actual pagination before one RPC", async () => {
  const transactionsSync = vi.fn()
    .mockResolvedValueOnce({ data: { added: [tx("pending")], modified: [], removed: [], has_more: true, next_cursor: "page2" } })
    .mockResolvedValueOnce({ data: { added: [], modified: [tx("pending", 53)], removed: [{ transaction_id: "pending" }], has_more: false, next_cursor: "final" } });
  const result = await syncTransactions("synthetic", "old", { transactionsSync } as unknown as PlaidApi);
  await persistSyncResult({ ...args, ...result });
  expect(transactionsSync.mock.calls.map(([r]) => r.cursor)).toEqual(["old", "page2"]);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
  expect(body.p_next_cursor).toBe("final");
  expect(body.p_added).toHaveLength(1);
  expect(body.p_modified[0]).toMatchObject({ amount: -53, pending_transaction_id: "pending" });
  expect(body.p_removed).toEqual([{ transaction_id: "pending" }]);
});
