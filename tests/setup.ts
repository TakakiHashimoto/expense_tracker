import { vi } from "vitest";
import http from "node:http";
import https from "node:https";
import net from "node:net";

// Never load .env files or permit a fixture to contact Plaid/Supabase.
Object.assign(process.env, {
  PLAID_ENV: "sandbox",
  PLAID_CLIENT_ID: "fixture-client-id",
  PLAID_SECRET: "SENTINEL_PLAID_SECRET",
  SUPABASE_SERVICE_ROLE_KEY: "SENTINEL_SERVICE_ROLE_KEY",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.invalid",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
  APP_BASE_URL: "https://bankos.example",
});
const denyNetwork = () => { throw new Error("Network disabled in security tests"); };
vi.spyOn(globalThis, "fetch").mockImplementation(denyNetwork);
vi.spyOn(http, "request").mockImplementation(denyNetwork);
vi.spyOn(https, "request").mockImplementation(denyNetwork);
vi.spyOn(http, "get").mockImplementation(denyNetwork);
vi.spyOn(https, "get").mockImplementation(denyNetwork);
vi.spyOn(net.Socket.prototype, "connect").mockImplementation(denyNetwork);
