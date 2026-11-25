import { afterEach, expect, it, vi } from "vitest";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { createHash, randomUUID } from "node:crypto";
import { sensitiveError, sentinels } from "./fixtures";

const mocks = vi.hoisted(() => ({ webhookVerificationKeyGet: vi.fn() }));
vi.mock("@/app/api/plaid/lib/plaid.helper", () => ({ createPlaidClient: () => mocks }));
import { verifyPlaidWebhook } from "@/app/api/plaid/webhook/verifyWebhooks";

afterEach(() => { vi.mocked(console.error).mockRestore?.(); });

async function signedFixture(ageSeconds = 0) {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const key = await exportJWK(publicKey);
  mocks.webhookVerificationKeyGet.mockResolvedValue({ data: { key } });
  const rawBody = JSON.stringify({ item_id: "fixture-item", webhook_code: "SYNC_UPDATES_AVAILABLE" });
  const token = await new SignJWT({ request_body_sha256: createHash("sha256").update(rawBody).digest("hex") })
    .setProtectedHeader({ alg: "ES256", kid: randomUUID() })
    .setIssuedAt(Math.floor(Date.now() / 1000) - ageSeconds)
    .sign(privateKey);
  return { rawBody, plaidVerificationHeader: token };
}

it("accepts a cryptographically valid fixture without calling Plaid", async () => {
  expect(await verifyPlaidWebhook(await signedFixture())).toBe(true);
});
it("rejects a tampered body", async () => {
  const fixture = await signedFixture();
  expect(await verifyPlaidWebhook({ ...fixture, rawBody: fixture.rawBody + " " })).toBe(false);
});
it("rejects expired signatures without logging JWT contents", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const fixture = await signedFixture(600);
  expect(await verifyPlaidWebhook(fixture)).toBe(false);
  expect(JSON.stringify(log.mock.calls)).not.toContain(fixture.plaidVerificationHeader);
});
it("rejects a missing verification header", async () => {
  expect(await verifyPlaidWebhook({ rawBody: "{}", plaidVerificationHeader: null })).toBe(false);
  expect(mocks.webhookVerificationKeyGet).not.toHaveBeenCalled();
});
it("does not expose failed verification-key request configuration", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const fixture = await signedFixture();
  mocks.webhookVerificationKeyGet.mockRejectedValue(sensitiveError());
  expect(await verifyPlaidWebhook(fixture)).toBe(false);
  for (const secret of sentinels) expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
});
