import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const domain = readdirSync(resolve(root, "src/features/plaid/server"))
  .filter((name) => name.endsWith(".ts"))
  .map((name) => `src/features/plaid/server/${name}`);

it.each([
  ...domain,
  "src/lib/supabase/server-role.ts", "src/lib/supabase/server.ts", "src/lib/supabase/proxy.ts",
  "src/app/api/plaid/lib/plaid.helper.ts", "src/app/api/plaid/lib/error-boundary.ts",
  "src/app/api/plaid/webhook/verifyWebhooks.ts",
])("requires a server-only marker on %s", (path) => {
  expect(readFileSync(resolve(root, path), "utf8")).toMatch(/^import "server-only";/);
});

it("keeps raw console calls out of Plaid handlers and domain helpers", () => {
  const handlers = readdirSync(resolve(root, "src/app/api/plaid"))
    .filter((name) => !["lib", "type"].includes(name))
    .map((name) => `src/app/api/plaid/${name}/route.ts`);
  for (const path of [...handlers, ...domain.filter((path) => !path.endsWith("/errors.ts")), "src/app/api/plaid/webhook/verifyWebhooks.ts"]) {
    expect(readFileSync(resolve(root, path), "utf8"), path).not.toMatch(/console\s*\./);
  }
});
