import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import { createHash, timingSafeEqual } from "node:crypto";
import { createPlaidClient } from "../lib/plaid.helper";

const keyCache = new Map<string, JWK>();

function sha256Hex(input: string) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");

  if (aBuffer.length !== bBuffer.length) return false;

  return timingSafeEqual(aBuffer, bBuffer);
}

async function getVerificationKey(kid: string) {
  const cachedKey = keyCache.get(kid);

  if (cachedKey) {
    return cachedKey;
  }

  const plaidClient = createPlaidClient();

  const response = await plaidClient.webhookVerificationKeyGet({ key_id: kid });

  const key = response.data.key as JWK;
  keyCache.set(kid, key);

  return key;
}

export async function verifyPlaidWebhook(input: {
  rawBody: string;
  plaidVerificationHeader: string | null;
}) {
  const { rawBody, plaidVerificationHeader } = input;

  if (!plaidVerificationHeader) {
    return false;
  }

  try {
    const protectedHeader = decodeProtectedHeader(plaidVerificationHeader);

    if (protectedHeader.alg !== "ES256") {
      return false;
    }

    if (!protectedHeader.kid) {
      return false;
    }

    const jwk = await getVerificationKey(protectedHeader.kid);
    const key = await importJWK(jwk, "ES256");

    const { payload } = await jwtVerify(plaidVerificationHeader, key, {
      algorithms: ["ES256"],
      maxTokenAge: "5 min",
    });

    if (typeof payload.request_body_sha256 !== "string") {
      return false;
    }

    const actualBodyHash = sha256Hex(rawBody);

    return constantTimeEqual(actualBodyHash, payload.request_body_sha256);
  } catch (error) {
    console.error("Plaid webhook verification failed", error);
    return false;
  }
}
