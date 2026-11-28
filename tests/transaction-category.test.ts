import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), client: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/getUser", () => ({ grabUser: async () => ({ id: "user" }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { updateTransactionCategory } from "@/features/transactions/server-actions";
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.client.mockReturnValue(createClient("https://supabase.invalid", "fixture", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: mocks.fetch },
  }));
});
afterEach(() => vi.restoreAllMocks());
it("succeeds only with a returned affected row, scoped to owner and active row", async () => {
  mocks.fetch.mockResolvedValue(Response.json([{ id: "transaction" }]));
  await expect(updateTransactionCategory({ transactionId: "transaction", categoryId: null })).resolves.toEqual({ ok: true });
  const [url, init] = mocks.fetch.mock.calls[0];
  expect(url).toContain("user_id=eq.user"); expect(url).toContain("is_removed=eq.false");
  expect(url).toContain("id=eq.transaction"); expect(url).toContain("select=id");
  expect(new Headers(init.headers).get("prefer")).toContain("return=representation");
  expect(JSON.parse(init.body)).toEqual({ category_id: null, category_source: "manual" });
  expect(mocks.revalidate).toHaveBeenCalledTimes(2);
});
it.each(["removed pending", "nonexistent", "cross-user"])("rejects zero affected rows for %s", async () => {
  mocks.fetch.mockResolvedValue(Response.json([]));
  await expect(updateTransactionCategory({ transactionId: "transaction", categoryId: null })).rejects.toThrow("Refresh the transaction list");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("preserves category ownership validation", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ code: "PGRST116", message: "No category" }, { status: 406 }));
  await expect(updateTransactionCategory({ transactionId: "transaction", categoryId: "foreign" })).rejects.toThrow("Invalid category");
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.fetch.mock.calls[0][0]).toContain("user_id=eq.user");
});
it("validates an owned active category then updates", async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ id: "category" })).mockResolvedValueOnce(Response.json([{ id: "transaction" }]));
  await expect(updateTransactionCategory({ transactionId: "transaction", categoryId: "category" })).resolves.toEqual({ ok: true });
  expect(mocks.fetch.mock.calls[0][0]).toContain("is_active=eq.true");
});
it("retains database error handling", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ code: "42501", message: "denied" }, { status: 403 }));
  await expect(updateTransactionCategory({ transactionId: "transaction", categoryId: null })).rejects.toThrow("Failed to update transaction category");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
