import { afterEach, expect, it, vi } from "vitest";
import { getPlaidError, logPlaidError } from "@/features/plaid/server/errors";
import { withPlaidErrorBoundary } from "@/app/api/plaid/lib/error-boundary";
import { redirect } from "next/navigation";
import { sensitiveError, sentinels } from "./fixtures";

afterEach(() => { vi.mocked(console.error).mockRestore?.(); });

it("logs only allowlisted diagnostics, never nested HTTP error contents", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  logPlaidError("exchange", sensitiveError());
  expect(log).toHaveBeenCalledExactlyOnceWith({ event: "plaid_operation_failed", operation: "exchange", code: "INSTITUTION_DOWN", httpStatus: 503 });
  for (const secret of sentinels) expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  expect(getPlaidError(sensitiveError("ITEM_LOGIN_REQUIRED"))).toEqual({ error_code: "ITEM_LOGIN_REQUIRED" });
});

it.each([null, "SENTINEL_ACCESS_TOKEN", sensitiveError("SENTINEL_ACCESS_TOKEN"), { code: "SENTINEL_ACCESS_TOKEN" }, { response: { status: "SENTINEL_ACCESS_TOKEN" } }])("drops unknown error data", (error) => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  logPlaidError("sync_transactions", error);
  expect(JSON.stringify(log.mock.calls)).not.toContain("SENTINEL");
  expect(getPlaidError(error)).toBeNull();
});

it("tolerates throwing getters without exposing or propagating their errors", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = { get response() { throw sensitiveError(); } };
  expect(() => logPlaidError("webhook", error)).not.toThrow();
  expect(JSON.stringify(log.mock.calls)).not.toContain("SENTINEL");
});

it("keeps useful database and transport codes", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  logPlaidError("persist_accounts", { code: "23505", details: sentinels });
  expect(log.mock.calls[0][0]).toMatchObject({ code: "23505" });
});

it("contains unhandled exceptions without exposing them to the framework", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const handler = withPlaidErrorBoundary("webhook", async () => { throw sensitiveError(); });
  const response = await handler();
  expect(response.status).toBe(500);
  const output = JSON.stringify(log.mock.calls) + await response.text();
  for (const secret of sentinels) expect(output).not.toContain(secret);
});

it("preserves framework authentication redirects", async () => {
  const handler = withPlaidErrorBoundary("add_account", async () => redirect("/login"));
  await expect(handler()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
});
