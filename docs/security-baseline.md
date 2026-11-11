# BankOS Phase 1 security baseline

Reviewed as of November 10, 2026. Work is on `chore/bankos-security-baseline`,
created from a clean `feat/subscription` working tree. No migrations, production
database operations, live Plaid requests, deployment, subscription implementation
or AI implementation are part of this change.

**Changes**

- Next.js and its ESLint configuration are pinned to 16.4.6. React and React DOM
  are pinned together to 19.3.1. Next's resolved image dependency is sharp 0.35.5.
- The auth callback accepts application-relative destinations only. It rejects
  external/protocol-relative URLs, backslashes, control characters, malformed
  escapes and bypasses hidden behind repeated URL encoding. All decoded forms
  must remain same-origin. Invalid destinations fall back to `/connect-bank`.
  The original safe query string/fragment is preserved. Existing missing/invalid
  confirmation-code redirects remain unchanged.
- Plaid routes and domain helpers use a shared logger emitting only fixed event
  and operation names, explicitly allowlisted codes and numeric HTTP status.
  Messages, stacks, causes, headers, request IDs, user/item identifiers, HTTP
  configuration and payloads are deliberately excluded. Unknown codes become
  `UNKNOWN_ERROR`; unknown sync error codes are stored as `SYNC_FAILED`.
- All eight Plaid POST handlers have a final sanitized error boundary. Framework
  redirects retain their control-flow semantics. Unexpected provider exceptions
  no longer escape to Next's default raw exception logger.
- Privileged Supabase modules, Plaid domain modules, client factory and webhook
  verification use `server-only`. The browser Supabase client stays usable.

**Dependency decisions**

Official sources reviewed:

- [Next.js October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
- [Next.js current advisory list](https://github.com/vercel/next.js/security/advisories)
- [Server Actions denial of service](https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r)
- [Image-processing remote code execution](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)
- [minimatch glob amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- [Next.js stable registry metadata](https://registry.npmjs.org/next/latest)

The initial npm audit reported 22 findings: 1 critical, 12 high, 8 moderate and
1 low. Explicit framework upgrades followed by non-forced, compatible-range
`npm audit fix --ignore-scripts` resolved the runtime findings. No `--force` or
`--legacy-peer-deps` was used.

TypeScript ESLint 8.72.2 still requests minimatch 10.x, whose latest available
version remains affected. A narrowly scoped override under
`@typescript-eslint/typescript-estree` pins minimatch 11.0.1. This crosses that
parent's semver range intentionally; full lint and a project-aware parser smoke
check passed. Remove the override when the upstream dependency range supports
the security fix. Other consumers, including minimatch 3.x, are not overridden.

Important resolved versions:

| Package | Version |
| --- | --- |
| next / eslint-config-next / @next/eslint-plugin-next | 16.4.6 |
| react / react-dom | 19.3.1 |
| sharp | 0.35.5 |
| eslint | 9.39.4 |
| typescript-eslint and its parser/plugin packages | 8.72.2 |
| minimatch under typescript-estree | 11.0.1 |
| TypeScript | 5.9.3 |
| Vitest | 5.1.0 |
| @types/node | 24.19.2 |
| server-only | 0.0.1 |
| axios, used by Plaid | 1.21.1 |
| follow-redirects | 1.16.3 |
| form-data | 4.0.6 |
| ws, used by Supabase Realtime | 8.22.2 |
| postcss | 8.5.23 |
| @supabase/ssr / @supabase/supabase-js | 0.8.0 / 2.103.3 (unchanged) |
| plaid | 41.4.0 (unchanged) |

Additional compatible transitive fixes include Babel, browserslist,
baseline-browser-mapping, brace-expansion, js-yaml, nanoid, source-map-js and zod.
The complete dependency graph and integrity hashes are in `package-lock.json`.

Vitest 5 requires Node `^22.12.0 || ^24.0.0 || >=26.0.0`. The package now declares
that engine range and uses Node 24 typings. Node 20 environments must upgrade
before using this toolchain. Verification here used Node 24.13.1 and npm 11.8.0.

**Verification commands**

```sh
npm run typecheck
npm run lint
npm test
npm run build:security
npm audit
npm audit --omit=dev
npm ls --all
npx --no-install eslint src/lib/auth/redirect.ts --parser-options '{"project":"./tsconfig.json"}'
git diff --check
```

`build:security` copies application source/configuration to a temporary directory,
excludes all `.env` files, and supplies synthetic credentials in a clean child
environment. It runs the webpack production compiler, scans client artifacts
for privileged configuration and secret sentinels, and runs two intentionally
failing builds proving that client imports of the privileged Supabase and Plaid
entry points are rejected. It removes the temporary builds afterward. The
ordinary `build` script remains `next build`; the default Turbopack build is not
the compiler verified by this security check.

Vitest never loads `.env.local`; setup blocks fetch and Node HTTP/socket network
access. Auth and all eight Plaid endpoints run with mocked Supabase/Plaid
dependencies. JWT verification uses locally generated keys, and image processing
uses an in-memory fixture. Only the tests replace the `server-only` marker;
production compilation uses the real marker.

**Limits and compatibility**

- Safe callback destinations must remain application-relative, matching the
  prior accepted contract. Absolute same-origin URLs also fall back. Overlong
  values, malformed escapes and excessively nested encoding are rejected.
- Unknown Plaid codes lose their raw value until explicitly reviewed and added
  to the allowlist. This trades raw diagnostics for a bounded logging contract.
- Previously uncaught Plaid failures now produce a generic JSON 500 response.
  Existing success, busy and login-required responses are covered by tests.
- Five pre-existing lint warnings remain: the root font link, two unused `_day`
  variables and two unused budget-page catch variables.
- A clean npm audit is a point-in-time dependency check, not proof that the
  application is production-ready. The prior audit's schema drift, sync
  atomicity, financial semantics and operational gaps belong to later phases.
- No live login, financial institution, hosted RLS or deployment behavior was
  verified. No production credentials were used for tests or builds.

**Verification results**

- TypeScript passed. ESLint passed with the five pre-existing warnings.
- 120 automated tests passed across six test files.
- The isolated webpack production build passed; 50 client artifacts passed the
  secret/configuration scan. Both negative client-import compiler tests passed.
- Final full and production-only npm audits report zero vulnerabilities.
- The full npm dependency tree has no invalid/unsatisfied packages.
- The project-aware ESLint parser smoke check and `git diff --check` passed.

**Changed file inventory**

- `docs/security-baseline.md`
- `package-lock.json`
- `package.json`
- `scripts/security-build.mjs`
- `src/app/(auth)/auth/confirm/route.ts`
- `src/app/api/plaid/add-account/route.ts`
- `src/app/api/plaid/exchange/route.ts`
- `src/app/api/plaid/lib/error-boundary.ts`
- `src/app/api/plaid/lib/plaid.helper.ts`
- `src/app/api/plaid/link-token/route.ts`
- `src/app/api/plaid/refresh-accounts/route.ts`
- `src/app/api/plaid/sync-all/route.ts`
- `src/app/api/plaid/sync-transactions/route.ts`
- `src/app/api/plaid/update-link-token/route.ts`
- `src/app/api/plaid/webhook/route.ts`
- `src/app/api/plaid/webhook/verifyWebhooks.ts`
- `src/features/plaid/server/accounts.ts`
- `src/features/plaid/server/db.ts`
- `src/features/plaid/server/errors.ts`
- `src/features/plaid/server/persitstPlaidAccounts.ts`
- `src/features/plaid/server/recordSyncFailure.ts`
- `src/features/plaid/server/sync.ts`
- `src/features/plaid/server/syncLease.ts`
- `src/features/plaid/server/syncPlaidItem.ts`
- `src/features/plaid/server/unlockRelase.ts`
- `src/lib/auth/redirect.ts`
- `src/lib/supabase/proxy.ts`
- `src/lib/supabase/server-role.ts`
- `src/lib/supabase/server.ts`
- `tests/auth-redirect.test.ts`
- `tests/fixtures.ts`
- `tests/image-runtime.test.ts`
- `tests/plaid-errors.test.ts`
- `tests/plaid-routes.test.ts`
- `tests/server-boundaries.test.ts`
- `tests/server-only.ts`
- `tests/setup.ts`
- `tests/webhook-verification.test.ts`
- `vitest.config.mts`
