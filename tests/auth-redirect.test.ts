import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

const auth = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: auth.createClient }));
import { GET } from "@/app/(auth)/auth/confirm/route";

const origin = "https://bankos.example";
const unsafe = [
  "https://evil.example", "https://bankos.example.evil.example", "https://bankos.example@evil.example",
  "//evil.example", "/\\evil.example", "\\\\evil.example", "/%5cevil.example",
  "/%255cevil.example", "/%2fevil.example", "/%252fevil.example",
  "%2f%2fevil.example", "%252f%252fevil.example", "https%3A%2F%2Fevil.example",
  "/\t/evil.example", "/%09/evil.example", "/%250a/evil.example", "/%00evil",
  " /dashboard", "javascript:alert(1)", "data:text/html,hello", "/%zz",
  "/%E0%A4%A", "/..//evil.example", "/%2e%2e//evil.example",
  "/%2525252525252fevil.example", "/" + "a".repeat(2049),
];

describe("auth redirect validation", () => {
  it.each(unsafe)("rejects %s", (value) => {
    expect(getSafeAuthRedirect(value, origin).href).toBe(origin + "/connect-bank");
  });
  it.each(["/dashboard", "/connect-bank", "/login", "/transactions?month=2026-11", "/accounts/abc#details", "/transactions?q=caf%C3%A9", "/transactions?q=coffee%20shop"])("preserves %s", (value) => {
    expect(getSafeAuthRedirect(value, origin).href).toBe(origin + value);
  });
  it("defaults absent destinations", () => {
    expect(getSafeAuthRedirect(null, origin).pathname).toBe("/connect-bank");
  });
});

describe("email confirmation route (mocked auth)", () => {
  beforeEach(() => {
    auth.createClient.mockResolvedValue({ auth });
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  });
  it("exchanges the code and preserves the intended application destination", async () => {
    const result = await GET(new Request(origin + "/auth/confirm?code=fixture-code&next=%2Fdashboard"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("fixture-code");
    expect(result.headers.get("location")).toBe(origin + "/dashboard");
  });
  it.each(unsafe)("keeps callback redirects same-origin for %s", async (value) => {
    const url = new URL("/auth/confirm", origin);
    url.searchParams.set("code", "fixture-code");
    url.searchParams.set("next", value);
    const response = await GET(new Request(url));
    expect(response.headers.get("location")).toBe(origin + "/connect-bank");
  });
  it("does not exchange a missing code", async () => {
    const response = await GET(new Request(origin + "/auth/confirm"));
    expect(response.headers.get("location")).toBe(origin + "/login?error=missing_code");
    expect(auth.createClient).not.toHaveBeenCalled();
  });
  it("preserves the failed-confirmation login flow", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });
    const response = await GET(new Request(origin + "/auth/confirm?code=expired"));
    expect(response.headers.get("location")).toBe(origin + "/login?error=confirm_failed");
  });
});
