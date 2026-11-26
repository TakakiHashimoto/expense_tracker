import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unlockLease } from "@/features/plaid/server/unlockRelase";
import { aquireSyncLease } from "@/features/plaid/server/syncLease";

function database(data: unknown = null, error: unknown = null) {
  const chain = {
    update: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  const from = vi.fn().mockReturnValue(chain);
  return { chain, from, supabase: { from } as unknown as SupabaseClient };
}
const identity = { plaidItemUuid: "item", userId: "user" };
it("scopes release to the original token as well as user and Item", async () => {
  const db = database();
  await unlockLease({ ...identity, token: "old-token", supabase: db.supabase });
  expect(db.from).toHaveBeenCalledWith("plaid_items");
  expect(db.chain.update).toHaveBeenCalledWith({ sync_lock_token: null, sync_lock_expires_at: null });
  expect(db.chain.eq.mock.calls).toEqual([["id", "item"], ["user_id", "user"], ["sync_lock_token", "old-token"]]);
});
it("propagates release errors", async () => {
  const error = { code: "23514" };
  await expect(unlockLease({ ...identity, token: "old-token", supabase: database(null, error).supabase })).rejects.toMatchObject({ cause: error });
});
it.each([null, { transactions_cursor: null }, { transactions_cursor: "cursor-X" }])("returns only the cursor from the acquired row: %j", async (data) => {
  const db = database(data);
  const result = await aquireSyncLease({ ...identity, supabase: db.supabase });
  expect(db.chain.eq.mock.calls).toEqual([["id", "item"], ["user_id", "user"]]);
  expect(db.chain.or).toHaveBeenCalledWith(expect.stringContaining("sync_lock_expires_at.is.null,sync_lock_expires_at.lt."));
  if (data) {
    expect(result).toEqual({ acquired: true, token: db.chain.update.mock.calls[0][0].sync_lock_token, cursor: data.transactions_cursor });
  } else expect(result).toEqual({ acquired: false });
});
