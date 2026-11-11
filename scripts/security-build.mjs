import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Build a copy with no .env files and synthetic credentials. This command must
// never render pages against the developer's actual Supabase/Plaid projects.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = mkdtempSync(join(tmpdir(), "bankos-security-build-"));
const env = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "LANG", "SSL_CERT_FILE", "NODE_EXTRA_CA_CERTS"].flatMap(
    (key) => process.env[key] ? [[key, process.env[key]]] : [],
  ),
);
const secrets = ["BUILD_SENTINEL_SERVICE_ROLE", "BUILD_SENTINEL_PLAID_SECRET", "BUILD_SENTINEL_CLIENT_ID"];
Object.assign(env, {
  NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.invalid",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: secrets[0], PLAID_SECRET: secrets[1], PLAID_CLIENT_ID: secrets[2],
  PLAID_ENV: "sandbox", APP_BASE_URL: "https://bankos.example",
});

function prepare(name) {
  const target = join(temporary, name);
  mkdirSync(target);
  for (const file of ["src", "public", "package.json", "package-lock.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"]) {
    cpSync(join(root, file), join(target, file), { recursive: true });
  }
  symlinkSync(join(root, "node_modules"), join(target, "node_modules"), "dir");
  return target;
}

function build(target) {
  return spawnSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
    cwd: target, env, encoding: "utf8", maxBuffer: 10 * 1024 * 1024,
  });
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

try {
  const target = prepare("application");
  console.log("Building isolated application with synthetic credentials (webpack production compiler)...");
  const result = build(target);
  if (result.error) throw new Error(`Could not start production compiler: ${result.error.code}`);
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.status !== 0) throw new Error("Isolated production build failed");

  const clientDirectory = join(target, ".next/static");
  if (!existsSync(clientDirectory)) throw new Error("Missing client build artifacts");
  let count = 0;
  for (const path of files(clientDirectory)) {
    if (!/\.(js|map)$/.test(path)) continue;
    const contents = readFileSync(path, "utf8");
    if ([...secrets, "SUPABASE_SERVICE_ROLE_KEY", "PLAID_SECRET", "PLAID_CLIENT_ID"].some((secret) => contents.includes(secret))) {
      throw new Error("Privileged configuration found in client artifacts");
    }
    count += 1;
  }
  console.log(`PASS: ${count} client artifacts contain no privileged configuration or secret sentinels.`);

  // Real Next compiler regression: a client component must not import either
  // privileged entry point. Test each independently so one cannot mask another.
  for (const [name, module, symbol] of [
    ["supabase", "@/lib/supabase/server-role", "createServerRoleClient"],
    ["plaid", "@/app/api/plaid/lib/plaid.helper", "createPlaidClient"],
  ]) {
    const probe = prepare(`boundary-${name}`);
    for (const group of ["(marketing)", "(auth)", "(protected)"]) {
      rmSync(join(probe, "src/app", group), { recursive: true, force: true });
    }
    writeFileSync(join(probe, "src/app/layout.tsx"), "export default function Layout({children}: {children: React.ReactNode}) { return <html><body>{children}</body></html>; }\n");
    writeFileSync(join(probe, "src/app/page.tsx"), `"use client";\nimport { ${symbol} } from ${JSON.stringify(module)};\nexport default function Page() { return <button onClick={() => ${symbol}()}>Boundary probe</button>; }\n`);
    const rejected = build(probe);
    if (rejected.error) throw new Error(`Could not start boundary compiler: ${rejected.error.code}`);
    const output = (rejected.stdout ?? "") + (rejected.stderr ?? "");
    if (rejected.status === 0 || !/server-only/.test(output) || !/Client Component|Server Component/.test(output)) {
      process.stderr.write(output);
      throw new Error(`Compiler did not reject the ${name} client import as expected`);
    }
    console.log(`PASS: Next compiler rejects client imports of the privileged ${name} module.`);
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
