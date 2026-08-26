# Expense Tracker: Current Architecture, Code Map, and Data Flows

Last reviewed directly from the repository on **August 26, 2026**.

This document explains the current implementation of the Expense Tracker, branded in much of the UI as **Obsidian Ledger**. It maps the architecture and runtime flows to the actual source files, describes the contracts between layers, and records the important failure modes and improvement opportunities visible in the code.

> Scope note: this is a code-reading summary, not a claim that every path has been exercised in production. The repository does not contain the Supabase SQL schema, migrations, RLS policies, or RPC definitions, so those database guarantees are identified as **required/assumed** rather than verified. No existing source file was modified while preparing this document.

## 1. Executive summary

This is a full-stack personal finance application built with Next.js, React, TypeScript, Supabase, and Plaid. Its implemented capabilities include:

- Public marketing, signup, email verification, login, and logout.
- Cookie-based Supabase sessions and a protected route group.
- Connecting one or more bank institutions through Plaid Link.
- Keeping Plaid access tokens on the server/database side.
- Persisting connected institutions, accounts, balances, categories, and transactions.
- Incremental transaction synchronization with Plaid cursors.
- Added, modified, and soft-removed transaction handling.
- One internal signed-amount convention: expense is negative and income is positive.
- Automatic category normalization with Plaid-category and merchant rules.
- Dashboard totals, recent transactions, account cards, and category breakdowns.
- Transaction searching, filtering, sorting, details, and manual category overrides.
- Institution/account pages with connection-health, retry, and repair actions.
- Monthly per-category budgets and calculated spending progress.
- A Plaid webhook endpoint with JWT signature and request-body hash verification.

The strongest architectural idea in the project is:

```text
raw Plaid or database data
        ↓
server-side ownership checks and domain normalization
        ↓
typed, UI-oriented return objects
        ↓
React rendering and browser interaction
```

The largest current production gaps are webhook registration and webhook persistence compatibility, missing checked-in database/RLS definitions, a hard-coded signup callback URL, non-transactional sync persistence, incomplete reconciliation of removed bank accounts, and a few correctness/UI issues described in Section 18.

## 2. Technology and runtime model

| Area                  | Actual technology                                   | Where it appears                              |
| --------------------- | --------------------------------------------------- | --------------------------------------------- |
| Application framework | Next.js 16 App Router                               | `src/app`, `next.config.ts`                   |
| UI runtime            | React 19 and TypeScript 5                           | `.tsx` files, `tsconfig.json`                 |
| Styling               | Tailwind CSS 4, custom CSS tokens, `tw-animate-css` | `src/app/globals.css`, `postcss.config.mjs`   |
| Authentication        | Supabase Auth                                       | `src/features/auth`, `src/lib/supabase/*`     |
| Database              | Supabase Postgres                                   | feature actions and Plaid persistence modules |
| Bank integration      | Plaid Node SDK and React Plaid Link                 | `src/app/api/plaid`, Plaid client components  |
| Time calculations     | Luxon, fixed dashboard zone `America/Vancouver`     | `src/lib/dateRanges.ts`, sync-time formatting |
| Notifications         | Sonner and React Toastify                           | root/protected layouts and client actions     |
| Icons                 | Lucide React and Google Material Symbols            | UI components                                 |

The package scripts are:

| Command         | Behavior                                        |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Starts Next.js development mode on port `3002`. |
| `npm run build` | Produces a production Next.js build.            |
| `npm run start` | Runs the production server.                     |
| `npm run lint`  | Runs ESLint.                                    |

There is currently no package script for unit, integration, or end-to-end tests.

## 3. Actual architecture

```text
                                      PLAID
                           Link tokens / exchange / sync
                                      ▲   │
                                      │   │ verified webhook
                                      │   ▼
Browser ───────► Next.js application and Route Handlers
   │                         │                  │
   │                         │                  └── service-role Supabase client
   │                         │                      (webhook only)
   │                         ▼
   │                session-aware Supabase client
   │                         │
   └────► Supabase Auth      ▼
          (browser SDK)  Supabase Postgres
                         auth.users
                         plaid_items ── plaid_item_secrets
                              │
                           accounts
                              │
                         transactions ── categories ── budgets
```

### Actual ownership boundaries

| Responsibility               | Current owner                                  | Actual code                                                  |
| ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Signup/login/resend          | Supabase Auth called by browser components     | `SignupForm`, `LoginForm`, `/verify-email`                   |
| Confirmation-code exchange   | Next.js route plus Supabase Auth               | `src/app/(auth)/auth/confirm/route.ts`                       |
| Session refresh              | Middleware and Supabase SSR                    | `src/middleware.ts`, `src/lib/supabase/proxy.ts`             |
| Protected-page gate          | Protected layout                               | `src/app/(protected)/layout.tsx`                             |
| Per-operation authentication | Server actions/handlers using `auth.getUser()` | `grabUser`, API handlers                                     |
| Per-user authorization       | Explicit `user_id` filters plus expected RLS   | feature actions and API routes                               |
| Plaid credentials/client     | Server Route Handlers                          | `src/app/api/plaid/lib/plaid.helper.ts` and several handlers |
| Plaid access-token storage   | `plaid_item_secrets`                           | exchange and sync handlers                                   |
| Amount sign normalization    | Transaction ingestion                          | `persistSyncResult()` in `src/features/plaid/server/db.ts`   |
| Automatic categories         | Ingestion/domain helper                        | `src/lib/transactions.helper.ts`                             |
| Manual category ownership    | Server action                                  | `updateTransactionCategory()`                                |
| Incremental sync pagination  | Plaid server module                            | `syncTransactions()`                                         |
| Account snapshot persistence | Plaid server module                            | `persistPlaidAccounts()`                                     |
| Dashboard aggregation        | Server/domain action and DB RPCs               | `src/features/dashboard/actions.ts`                          |
| Budget calculation           | Server action                                  | `getBudgets()`                                               |
| Formatting and interaction   | React components                               | feature `components` and `pages` folders                     |
| Webhook authenticity         | JWT signature plus SHA-256 body verification   | `verifyPlaidWebhook()`                                       |
| Webhook database authority   | Supabase service-role client                   | `server-role.ts`, webhook handler                            |

### Server/client boundary

Files named `*Client` are not automatically Client Components. A file is a Client Component only when it or an ancestor uses `"use client"`. For example, `DashboardClient.tsx`, `AccountPageClient.tsx`, `AccountDetailPageClient.tsx`, `TransactionPage.tsx`, and `BudgetDisplayPageClient.tsx` currently render on the server despite their names; they compose smaller interactive Client Components where necessary.

## 4. Route map

### Browser routes

| URL                             | Entry file                                                  | Access                                | Responsibility                                                                |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `/`                             | `src/app/(marketing)/page.tsx`                              | Public                                | Marketing hero, product process, security copy, contextual Get Started link.  |
| `/signup`                       | `src/app/(auth)/signup/page.tsx`                            | Public                                | Renders the client signup form.                                               |
| `/verify-email`                 | `src/app/(auth)/verify-email/page.tsx`                      | Public                                | Verification instructions and resend flow.                                    |
| `/auth/confirm`                 | `src/app/(auth)/auth/confirm/route.ts`                      | Public callback                       | Exchanges Supabase confirmation code for a session.                           |
| `/login`                        | `src/app/(auth)/login/page.tsx`                             | Public                                | Renders login and chooses onboarding destination.                             |
| `/connect-bank`                 | `src/app/(protected)/connect-bank/page.tsx`                 | Protected                             | First-bank connection page; redirects to dashboard if an item already exists. |
| `/dashboard`                    | `src/app/(protected)/dashboard/page.tsx`                    | Protected                             | Loads and displays the dashboard contract.                                    |
| `/transactions`                 | `src/app/(protected)/transactions/page.tsx`                 | Protected                             | URL-driven transaction search, filter, sort, statistics, and list.            |
| `/transactions/[transactionId]` | `src/app/(protected)/transactions/[transactionId]/page.tsx` | Protected                             | Transaction details and manual category editing.                              |
| `/accounts`                     | `src/app/(protected)/accounts/page.tsx`                     | Protected                             | Institutions, active accounts, balances, sync health, and actions.            |
| `/accounts/[accountId]`         | `src/app/(protected)/accounts/[accountId]/page.tsx`         | Protected                             | Account detail and account-specific transactions.                             |
| `/accounts/add-accounts`        | `src/app/(protected)/accounts/add-accounts/page.tsx`        | Protected                             | Adds/selects accounts within an already connected Plaid Item.                 |
| `/budgets`                      | `src/app/(protected)/budgets/page.tsx`                      | Protected                             | Budget analysis cards.                                                        |
| `/budgets/create-budget`        | `src/app/(protected)/budgets/create-budget/page.tsx`        | Protected                             | Creates a category/month budget.                                              |
| `/dev/seed`                     | `src/app/(protected)/dev/seed/page.tsx`                     | Protected; action is development-only | Destructive per-user sample-data reset and seed.                              |

The protected layout renders a sidebar for every protected route and checks Supabase JWT claims. Individual data operations then call `auth.getUser()` again and apply ownership filters.

### Plaid API routes

| Endpoint                            | Main input                                | Main output               | Purpose                                                  |
| ----------------------------------- | ----------------------------------------- | ------------------------- | -------------------------------------------------------- |
| `POST /api/plaid/link-token`        | Authenticated session                     | `{ link_token }`          | Creates Link for a new Item/institution.                 |
| `POST /api/plaid/exchange`          | `{ public_token, metadata }`              | `{ plaid_item_uuid }`     | Exchanges token and persists Item, secret, and accounts. |
| `POST /api/plaid/sync-transactions` | `{ plaid_item_uuid }`                     | Success and change counts | Synchronizes one owned Item.                             |
| `POST /api/plaid/sync-all`          | Authenticated session                     | Aggregate counts          | Synchronizes all Items owned by the user.                |
| `POST /api/plaid/update-link-token` | `{ plaid_item_uuid }`                     | `{ link_token }`          | Creates Link update mode for connection repair.          |
| `POST /api/plaid/add-account`       | `{ plaidItemUuid }`                       | `{ ok, link_token }`      | Creates update mode with account selection enabled.      |
| `POST /api/plaid/refresh-accounts`  | `{ plaidItemUuid }`                       | Transaction change counts | Refreshes the account snapshot, then transactions.       |
| `POST /api/plaid/webhook`           | Raw Plaid webhook and verification header | Acknowledgement/counts    | Verifies and handles transaction-update webhooks.        |

## 5. Core application contracts

### Internal money convention

Plaid uses positive numbers for money leaving an account and negative numbers for money entering it. `persistSyncResult()` flips the sign exactly once:

```text
Plaid +25 purchase  → application -25 expense
Plaid -1000 payroll → application +1000 income
```

The rest of the application expects:

- `amount < 0`: expense.
- `amount > 0`: income.
- Budgets are positive limits.
- Expense totals generally display `Math.abs(amount)`.

The sign conversion is correctly located in the ingestion layer, so dashboard, transaction, and budget code do not each need to understand Plaid's convention.

### Main typed output contracts

| Contract                                                        | Defined in                           | Consumer                                 |
| --------------------------------------------------------------- | ------------------------------------ | ---------------------------------------- |
| `DashboardData`                                                 | `src/features/dashboard/type.ts`     | `/dashboard` and dashboard presentation  |
| `TransactionsPageData`, `TransactionItem`, `TransactionFilters` | `src/features/transactions/types.ts` | transaction list and account-detail list |
| `TransactionRowType`                                            | `src/features/transactions/types.ts` | transaction detail presentation          |
| `AccountPageData`, `AccountPageInstitution`                     | `src/features/accounts/types.ts`     | `/accounts` and add-accounts page        |
| `AccountDetailData`, `AccountDetailPageData`                    | `src/features/accounts/types.ts`     | `/accounts/[accountId]`                  |
| `ConnectionHealth`, `HealthPresentation`                        | `src/features/accounts/types.ts`     | account health badges and actions        |
| `CategoryReturnType`                                            | `src/features/budgets/types.ts`      | budget creation                          |
| `BudgetAnalysisReturn`, `BudgetAnalysis`                        | `src/features/budgets/types.ts`      | budget display                           |

Most list actions reshape snake_case database rows into camelCase, UI-focused objects. Transaction detail is an exception: it returns a more database-shaped nested record directly to the presentation layer.

## 6. Database contract visible from code

No SQL is checked into this repository. The following table is reconstructed from selects, inserts, updates, upserts, and relationships in the application code.

| Table/function                                | Fields used by code                                                                                                                                                                                                                                                      | Role                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Supabase `auth.users`                         | user ID, email, JWT/session                                                                                                                                                                                                                                              | Identity source.                                                |
| `plaid_items`                                 | `id`, `user_id`, `plaid_item_id`, `institution_id`, `institution_name`, `transactions_cursor`, `status`, `last_sync_status`, `last_sync_error`, `last_sync_at`, `created_at`, `updated_at`                                                                               | Public connection metadata and sync state.                      |
| `plaid_item_secrets`                          | `plaid_item_id`, `access_token`                                                                                                                                                                                                                                          | Private Plaid access token separated from normal Item metadata. |
| `accounts`                                    | `id`, `user_id`, `plaid_item_id`, `plaid_account_id`, `name`, `official_name`, `mask`, `type`, `subtype`, `currency`, `current_balance`, `available_balance`, `balance_as_of`, `is_active`, `created_at`                                                                 | Account identity, balance snapshot, and active state.           |
| `categories`                                  | `id`, `user_id`, `name`, `kind`, `is_active`                                                                                                                                                                                                                             | Per-user income/expense classification.                         |
| `transactions`                                | `id`, `user_id`, `account_id`, `category_id`, `category_source`, `posted_at`, `amount`, `merchant`, `note`, `name`, `plaid_transaction_id`, `plaid_item_id`, `plaid_account_id`, `pending`, `authorized_at`, `payment_channel`, `raw_category`, `location`, `is_removed` | Imported financial activity and user category overrides.        |
| `budgets`                                     | `id`, `user_id`, `category_id`, `month`, `amount`                                                                                                                                                                                                                        | Positive monthly limits for expense categories.                 |
| `get_daily_expenses(start_ts)`                | RPC result expected to be numeric                                                                                                                                                                                                                                        | Dashboard's today total.                                        |
| `get_monthly_expense_total(start_ts, end_ts)` | RPC result expected to be numeric                                                                                                                                                                                                                                        | Dashboard's monthly expense total.                              |

### Required or implied database guarantees

The code relies on these constraints or policies, but they cannot be verified here:

- RLS must prevent users from reading or changing another user's rows.
- RPC functions must apply `auth.uid()` or equivalent ownership protection internally.
- `accounts` needs uniqueness on `(plaid_item_id, plaid_account_id)` for its upsert.
- `categories` needs uniqueness on `(user_id, kind, name)` for its upsert.
- `transactions` needs uniqueness on `(plaid_item_id, plaid_transaction_id)` for sync idempotency.
- `budgets` is expected to reject duplicate `(user_id, category_id, month)` rows with PostgreSQL error `23505`.
- `plaid_item_secrets` should allow one secret per Plaid Item and must be protected more strictly than normal user data.
- Foreign keys must connect Items, secrets, accounts, transactions, categories, and budgets.
- The exchange rollback assumes deleting a `plaid_items` row either cascades safely to newly inserted children or otherwise succeeds; the code does not verify the rollback result.

The server-side ownership predicates are valuable defense in depth, but they do not replace RLS because the public Supabase URL and publishable key are necessarily available to the browser.

## 7. Authentication and session data flows

### 7.1 Signup and email confirmation

**Purpose:** create a Supabase account, verify the email, and establish a server-readable session.

**Runtime flow:**

```text
/signup
→ SignupForm collects email/password
→ browser Supabase client calls auth.signUp()
→ Supabase sends confirmation email
→ email saved in sessionStorage for resend only
→ browser moves to /verify-email
→ user clicks emailed link
→ GET /auth/confirm?code=...
→ server exchanges code for session
→ Supabase session cookies are written
→ safe local redirect, defaulting to /connect-bank
```

**Files involved:**

- `src/features/auth/components/SignupForm.tsx`
- `src/app/(auth)/verify-email/page.tsx`
- `src/app/(auth)/auth/confirm/route.ts`
- `src/lib/supabase/browser.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/proxy.ts`

**Input contract:** form fields `email` and `password`; callback query `code` and optional local `next` path.

**Output contract:** Supabase user/session, then redirects. The confirmation handler blocks protocol-relative or external `next` targets.

**Authentication/authorization:** signup and callback are public by design. Supabase validates credentials and the confirmation code.

**Failure modes and edge cases:**

- Signup's `emailRedirectTo` is hard-coded to `http://localhost:3002/auth/confirm`, so deployed confirmation links will be wrong until made environment-aware.
- Resend uses `window.location.origin`, which is deployment-aware and therefore differs from initial signup.
- Resend depends on the email surviving in `sessionStorage`; direct visits show an error and redirect to signup.
- The inputs rely mostly on browser/Supabase validation and have no explicit `required`, length, or password-strength rules in the component.
- The callback maps missing/failed codes to login query parameters, but the login UI does not interpret those query parameters into dedicated messages.

**Why this design:** Supabase owns passwords and email verification; the application handles only UI state and the callback/session bridge.

**What to improve:** use an environment-derived application URL, add explicit accessible form validation/loading states, and unify callback error presentation.

### 7.2 Login, onboarding, protected routes, and logout

**Runtime flow:**

```text
/login
→ browser calls Supabase signInWithPassword()
→ session is established
→ client invokes getUserOnboardingState() server action
→ server validates user and counts owned plaid_items
→ zero Items: /connect-bank
→ one or more Items: /dashboard
→ middleware refreshes/propagates auth cookies on later requests
→ protected layout verifies JWT claims
→ individual reads/actions call auth.getUser() and filter by user_id
```

Logout calls `supabase.auth.signOut()` in `logoutUser()` and redirects to `/login`.

**Files involved:** `LoginForm.tsx`, `src/features/auth/actions.ts`, `src/middleware.ts`, `src/lib/supabase/proxy.ts`, `src/app/(protected)/layout.tsx`, `DashboardSidebar.tsx`, and `DashboardSidebarClient.tsx`.

**Output contract:** `getUserOnboardingState()` returns `{ ok: true, hasPlaidItems }` or `{ ok: false, error }`.

**Security behavior:** protected layout checks claims; data functions use verified `auth.getUser()` results. Middleware itself refreshes sessions but does not redirect unauthenticated requests.

**Failure modes/edge cases:**

- There are two exported `grabUser()` helpers—one in `src/lib/getUser.ts` and one in dashboard actions—which can drift.
- `getUserOnboardingState()` imports the dashboard version rather than the library version.
- Any `plaid_items` row counts as onboarded, including a failed/revoked connection.
- Both the protected layout and `DashboardClient` render `DashboardSidebar`, causing the dashboard to render the sidebar twice and make two user reads.

**Why this design:** a coarse layout gate gives consistent navigation protection, while operation-level authentication and ownership predicates protect the actual data boundary.

## 8. Initial Plaid bank-connection flow

**Purpose:** turn a user's bank authorization into an owned Plaid Item, secret token, account snapshot, and initial transactions.

**Runtime flow:**

```text
ConnectButtonComponent mounts
→ POST /api/plaid/link-token
→ server authenticates user
→ Plaid linkTokenCreate(Transactions, CA, 90 days)
→ browser receives link_token and enables button
→ user opens and completes Plaid Link
→ Plaid returns public_token + metadata to browser
→ POST /api/plaid/exchange
→ server authenticates user
→ Plaid exchanges public_token for access_token + external item_id
→ server checks duplicate Item for this user
→ server calls accounts/get
→ inserts plaid_items metadata
→ inserts access_token into plaid_item_secrets
→ upserts accounts
→ returns internal plaid_items.id as plaid_item_uuid
→ browser POSTs /api/plaid/sync-transactions
→ initial cursor-based transaction import
→ browser redirects to /dashboard
```

**Files involved:**

- `src/app/(protected)/connect-bank/page.tsx`
- `src/components/connectBank/ConnectBankClient.tsx`
- `src/components/connectBank/ConnectButtonComponent.tsx`
- `src/app/api/plaid/link-token/route.ts`
- `src/app/api/plaid/exchange/route.ts`
- `src/features/plaid/server/accounts.ts`
- `src/features/plaid/server/persitstPlaidAccounts.ts`
- one-item sync modules described in Section 10

**Input contracts:**

- Link-token route: authenticated session, no JSON body.
- Exchange route: `{ public_token: string, metadata?: Plaid Link metadata }`.
- Institution metadata is treated as nullable.

**Output contracts:** `{ link_token }`, then `{ plaid_item_uuid }`, then sync counts.

**Authentication/authorization:** both handlers authenticate. Duplicate detection is scoped to the current user and external Plaid Item ID. Multiple different institutions are supported; the dashboard's Add Bank button reuses this flow.

**Secret handling:** the access token is never returned to React. It is inserted into `plaid_item_secrets` and later read only inside server handlers. The code does not demonstrate application-level token encryption, so marketing claims about a specific at-rest algorithm cannot be verified from this repository.

**Failure modes/edge cases:**

- The new-Link request does not include a webhook URL, so newly connected Items are not registered for this repository's webhook by this flow.
- Plaid and Supabase writes are not one database transaction. The route attempts compensation by deleting the Item if secret/account persistence fails, but relies on unverified foreign-key cascade behavior and ignores rollback errors.
- A concurrent duplicate connect requires a database uniqueness constraint to be race-safe; the application check alone is not enough.
- A `409` duplicate response makes the client go directly to the dashboard.
- If the Item is stored but initial transaction sync fails, the UI retains the internal UUID and offers retry without reconnecting.
- Mounting `ConnectButtonComponent` requests a link token immediately, including when the Add Bank control appears in the dashboard header.

**Why this design:** the temporary public token may pass through the browser, while permanent credentials remain server-side. Metadata, secrets, and accounts have separate responsibilities.

**What to improve:** centralize Plaid client creation, validate request bodies with a schema, add the deployed webhook URL, make rollback durable/observable, and define the required uniqueness and cascade constraints in migrations.

## 9. Plaid Item secrets and connection health

**Purpose:** isolate permanent bank credentials and expose only non-secret connection state to normal UI queries.

`plaid_items` contains user-visible metadata, cursor, and status. `plaid_item_secrets` contains the access token. UI contracts receive the internal Item UUID and institution/health values, never the token.

`deriveConnectionHealth()` maps database state as follows:

| Database state                                               | UI health      | Available UI action |
| ------------------------------------------------------------ | -------------- | ------------------- |
| `status = revoked`                                           | `disconnected` | None                |
| `status = error` and `last_sync_error = ITEM_LOGIN_REQUIRED` | `needs_update` | Repair              |
| `last_sync_status = failed`                                  | `sync_failed`  | Retry sync          |
| Never synced or no `last_sync_at`                            | `never_synced` | Retry sync          |
| Otherwise                                                    | `healthy`      | None                |

**Actual files:** `src/features/accounts/lib/lib.accounts.ts`, account types/presentation, `recordSyncFailure.ts`, and Plaid handlers that retrieve secrets.

**Important security dependency:** browser-side Supabase clients use the public publishable key. Strong RLS on `plaid_item_secrets` is therefore essential. Normal sync routes first prove Item ownership through `plaid_items`, then fetch the secret by internal Item ID. The webhook uses the service-role key and bypasses RLS after verifying the webhook.

## 10. Manual transaction synchronization

### 10.1 One Item

**Runtime flow:**

```text
Client POSTs internal plaid_item_uuid
→ route authenticates user
→ selects owned plaid_items row and current cursor
→ loads matching secret access_token
→ syncPlaidItem()
   ├─ transactions/sync until has_more is false
   ├─ optional accounts/get and account upsert
   └─ persistSyncResult()
       ├─ added transactions
       ├─ modified transactions
       ├─ removed transaction soft-deletes
       └─ save cursor and successful sync state
→ return added/modified/removed counts
```

The route is `src/app/api/plaid/sync-transactions/route.ts`. Institution retry and repair components call it.

### 10.2 All Items

`POST /api/plaid/sync-all` authenticates, selects all owned Items, and loops sequentially. It loads each access token, calls the same `syncPlaidItem()` orchestrator, accumulates counts, and stops on the first error. Items completed before the failure remain committed.

The dashboard's `SyncDashboardButton` calls this route, shows a toast, then uses `router.refresh()` so server-rendered dashboard data is reloaded.

### 10.3 Pagination and persistence

**Files involved:**

- `src/features/plaid/server/sync.ts`: loops Plaid pages and returns `added`, `modified`, `removed`, and the newest cursor.
- `src/features/plaid/server/syncPlaidItem.ts`: coordinates transaction sync, optional account refresh, and persistence.
- `src/features/plaid/server/db.ts`: maps and stores transaction changes and sync state.
- `src/features/plaid/server/persitstPlaidAccounts.ts`: upserts account snapshots.
- `src/features/plaid/server/recordSyncFailure.ts`: records failure state.
- `src/lib/transactions.helper.ts`: category/business normalization.

**Database behavior:**

- Added/modified transactions are upserted by `(plaid_item_id, plaid_transaction_id)`.
- Each Plaid account ID is resolved to an internal account ID owned by the user and Item.
- Plaid amounts are negated at ingestion.
- Categories are upserted per `(user_id, kind, name)`.
- Modified transactions preserve a manual category when `category_source === "manual"`.
- Removed transactions are retained with `is_removed = true`.
- The cursor and success status update only after all change loops complete.
- On failure, callers attempt to store `last_sync_status = failed` and the Plaid error code. `ITEM_LOGIN_REQUIRED` also changes Item `status` to `error`.

**Idempotency:** transaction/category/account upserts and soft removal make ordinary retries mostly repeatable. Saving the cursor last also means partial failures re-request the same Plaid page. This is a useful recovery shape, provided the database constraints exist.

**Failure modes/edge cases:**

- Persistence performs many sequential queries: account lookup, category upsert, existing-category lookup, and transaction upsert per record. This is an N+1 pattern and can be slow.
- The complete sync is not atomic. A failure can leave some transactions/accounts written while the cursor remains old. A retry should repair most of this through upserts, but the intermediate state is observable.
- No per-Item lock prevents manual sync and webhook sync from racing with the same cursor.
- `last_sync_status` is never set to `syncing` at the start despite that value existing in types.
- `sync-all` stops at the first failed Item instead of returning per-Item results; previously completed Items stay updated.
- Account persistence upserts accounts returned by Plaid but never marks accounts missing from the new snapshot inactive.
- Replayed `added` records always set the category source to automatic; modified records explicitly preserve manual categories.
- `persistSyncResult()` re-authenticates with `grabUser(supabase)` instead of using its already known `userId`. That is redundant for user-session routes and breaks the webhook path described below.

## 11. Account refresh and account-selection flow

There are two different user intents:

1. **Add another institution:** the dashboard's `ConnectButtonComponent` uses a new Link token, public-token exchange, and creates another Plaid Item.
2. **Change selected accounts inside an existing institution:** `/accounts/add-accounts` uses Plaid update mode with `account_selection_enabled: true`.

**Runtime flow for existing Item account selection:**

```text
/accounts/add-accounts loads owned active accounts grouped by Item
→ user selects an institution
→ AddAccountButton POSTs /api/plaid/add-account
→ server verifies Item ownership and loads access_token
→ creates update-mode Link token with account selection enabled
→ client opens Plaid Link
→ after success, client POSTs /api/plaid/refresh-accounts
→ server calls accounts/get and upserts returned accounts
→ server also performs incremental transaction sync
→ client refreshes page
```

**Files involved:** add-accounts route/page/components, `src/app/api/plaid/add-account/route.ts`, `refresh-accounts/route.ts`, and Plaid account persistence.

**Current contract mismatch:** the refresh route returns **transaction** added/modified/removed counts. `AddAccountButton` labels those counts as if they were account changes. Also, because missing accounts are never marked inactive, the flow does not fully reconcile account removals.

## 12. Plaid webhook flow

### Intended and implemented route flow

```text
Plaid POSTs raw body + Plaid-Verification JWT
→ verify ES256 algorithm and key ID
→ retrieve/caches Plaid JWK
→ verify JWT age/signature
→ hash exact raw request body with SHA-256
→ constant-time compare with JWT request_body_sha256
→ parse body
→ ignore events other than TRANSACTIONS / SYNC_UPDATES_AVAILABLE
→ service-role Supabase client looks up Item by external item_id
→ load secret access_token
→ call the shared syncPlaidItem() pipeline
→ return counts or record connection failure
```

**Files involved:** `src/app/api/plaid/webhook/route.ts`, `verifyWebhooks.ts`, `plaidwebhook.type.ts`, `src/lib/supabase/server-role.ts`, the Plaid client helper, and shared sync modules.

**Authentication:** there is no user session, correctly. Plaid is authenticated by the signed verification JWT and exact raw-body hash.

**Authorization:** after verification, the service-role client maps Plaid's external `item_id` to the stored Item and its owning `user_id`.

### Current blockers and edge cases

- New Link tokens do not include a webhook URL, and no Item webhook-update call exists. Therefore automatic delivery is not configured by the current connection code.
- The webhook passes a service-role client into `syncPlaidItem()`, but `persistSyncResult()` calls `grabUser(supabase)`. A service-role client created without a user JWT has no signed-in user, so this path is expected to redirect/throw before transaction persistence. The shared persistence function should accept and use the already resolved `userId` instead.
- Sync work runs inline before responding. Large syncs can make webhook responses slow; a durable queue would be safer in production.
- Duplicate delivery is mostly tolerated by upserts, but concurrent delivery still has a cursor race because there is no Item lock.
- Non-transaction webhooks, including Item error events, are acknowledged and ignored.
- Invalid JSON after successful signature verification is not handled with a dedicated response.
- `SUPABASE_SERVICE_ROLE_KEY` is required for this path and must never be exposed to browser code.

The webhook verification implementation itself is a strong boundary: it restricts `alg` to ES256, requires `kid`, limits token age, checks the exact body hash, and uses constant-time comparison.

## 13. Dashboard data flow

**Purpose:** provide a single server-generated, UI-focused overview of the signed-in user's finances.

**Runtime flow:**

```text
GET /dashboard
→ protected layout verifies claims
→ getDashboardData() authenticates user
→ count user's plaid_items
→ if none, return onboarding empty state
→ calculate Vancouver today/month UTC boundaries
→ run six independent reads in Promise.all
   ├─ monthly income transactions
   ├─ 20 most recent transactions
   ├─ monthly expense total RPC
   ├─ daily expense RPC
   ├─ current-month expenses grouped in JS by category
   └─ connected accounts and institution names
→ reshape rows to DashboardData
→ render cards, accounts, recent transactions, category percentages
```

**Files involved:** `src/app/(protected)/dashboard/page.tsx`, `loading.tsx`, `src/features/dashboard/actions.ts`, `type.ts`, dashboard page/components, `src/lib/dateRanges.ts`, and formatting helpers.

**Input contract:** no request body. Time is calculated server-side using `America/Vancouver`.

**Output contract:** discriminated `DashboardData`:

- `{ ok: false, error }`
- `{ ok: true, hasPlaidItems: false }`
- `{ ok: true, hasPlaidItems: true, stats, recentTransactions, spendingByCategory, accounts }`

**Database contract:** all table queries explicitly filter `user_id`; the two RPC definitions must enforce the current user internally. Removed transactions are excluded with `is_removed IS NULL OR false` in direct dashboard queries.

**Business calculations:**

- Monthly income sums positive transaction amounts.
- Spending-by-category uses current-month negative transactions, converts each to absolute value, groups by normalized category name, and derives whole-number percentages.
- Recent activities is the number of rows in the 20-row recent set, not a lifetime count.
- Dashboard account rows are mapped to camelCase and include active state.

**Failure modes/edge cases:**

- Any rejected promise makes the entire dashboard load fail; there is no partial dashboard result.
- Recent transactions accept a date-range argument but do not use it, so they are the latest 20 across all dates.
- Monthly total/category total come from separate queries and may represent slightly different snapshots during concurrent sync.
- The RPC source is absent, so amount sign, removed-row filtering, end boundaries, and ownership cannot be audited here.
- The dashboard currently renders its own `DashboardSidebar` even though the protected layout already renders one.

**Why this design:** the server owns financial calculations and returns a stable React contract; independent queries run in parallel to reduce latency.

## 14. Transaction flows

### 14.1 List, search, filter, and sort

**Runtime flow:**

```text
GET /transactions?type=...&q=...&sort=...
→ page parses known filter/sort values and normalizes search text
→ getTransactionPageData() authenticates user
→ build Supabase query with user_id and is_removed=false
→ optionally add name/merchant search
→ optionally filter category kind or null category
→ order in database and limit to 50
→ map database rows to TransactionItem[]
→ group returned records by display date
→ calculate stats over the returned/filtered set
→ render rows and URL controls
```

**Actual correspondence:**

- Query parsing: `src/app/(protected)/transactions/page.tsx`, `parseTransactionTypeFilter()`, `parseTransactionTypeSort()`.
- Query and mapping: `src/features/transactions/actions.ts`.
- URL interaction: `Search.tsx`, `TransactionTypeFilter.tsx`, `TransactionSort.tsx`.
- Presentation: `TransactionPage.tsx`, `TransactionByDate.tsx`, `TransactionItem.tsx`, `TransactionStats.tsx`.

**Input contract:** query parameters `type=income|expense|uncategorized`, `sort=date_desc|date_asc|amount_desc|amount_asc`, and `q=<text>`. Unknown values fall back to all/newest.

**Output contract:** `{ ok: true, transactions: TransactionItem[] }` or `{ ok: false, error }`.

**Authentication/authorization:** `grabUser()` plus `.eq("user_id", user.id)`. Account and category joins are presentation metadata, not authorization boundaries.

**Important behavior:** search is implemented with a 400 ms URL-update debounce. Sorting/filtering are links that preserve other query parameters. Stats are calculated only from the current filtered, maximum-50-row result.

**Failure modes/edge cases:**

- This query uses `is_removed = false`, while several other pages allow both null and false. Older/seed rows with null may disappear from this list.
- There is no pagination; “View older activity” is currently an inert button.
- Group labels omit the year (`Aug, 26`), so records on the same month/day in different years can be merged into one displayed group.
- Search text is interpolated into Supabase's `.or()` filter syntax. Special filter characters may produce query errors; a safer query/RPC would avoid syntax construction.
- Income/expense filters use category `kind`, while row coloring sometimes uses amount sign. A manually mismatched category can make behavior inconsistent.

### 14.2 Transaction detail and manual category override

**Runtime flow:**

```text
GET /transactions/[id]
→ authenticate user
→ select active transaction where user_id and id both match
→ fetch user's categories
→ render details
→ user opens category select
→ updateTransactionCategory({ transactionId, categoryId })
→ server validates category ownership and active state
→ update owned, non-removed transaction
→ set category_source = manual
→ revalidate detail and transaction-list paths
```

**Files involved:** detail route page, `getTransactionDetail()`, `TransactionDetailPageClient.tsx`, `EditCategoryComponent.tsx`, and `server-actions.ts`.

**Authorization:** both the transaction read/update and category validation include the current user's ID. A guessed UUID cannot expose another user's transaction.

**Failure modes/edge cases:**

- `posted_at` can be a Plaid date-only value (`YYYY-MM-DD`), but the component unconditionally executes `posted_at.split("T")[1].split(...)`; date-only transactions can crash the detail render.
- Category read includes inactive categories, while the update action accepts only active categories. The UI can therefore offer a choice the server rejects.
- The server does not verify category `kind` against transaction amount sign.
- The update checks only Supabase `error`, not whether any transaction row was updated, so an unknown/removed ID may return `{ ok: true }`.
- Missing/not-owned detail IDs throw a generic error instead of rendering a deliberate 404.
- “Download Receipt” is presentational only.

**Why this design:** a user's manual category is marked as authoritative and the modified-transaction sync path preserves it.

## 15. Account and institution data flows

### 15.1 Accounts page

**Runtime flow:**

```text
GET /accounts
→ authenticate user
→ select owned active accounts joined to plaid_items
→ group rows by internal Plaid Item ID
→ derive connection health for each institution
→ map balances/account identity to AccountPageData
→ render institution sections, status, repair/retry controls, and account links
```

**Files involved:** account route, `src/features/accounts/actions.ts`, `types.ts`, `lib/lib.accounts.ts`, `AccountPageClient.tsx`, `AccountSection.tsx`, `AccountItem.tsx`, and sync/repair buttons.

**Output contract:** `{ ok: true, institutions: AccountPageInstitution[] }` or `{ ok: false, error }`.

**Important current state:** unlike the older `PROJECT_SUMMARY.md`, the accounts route is now wired to real grouped data; it is not a placeholder page.

**Edge cases:**

- The query begins from active accounts, so an Item with no active account rows cannot appear as an empty/disconnected institution section.
- “Total Assets” displays a count of accounts, not a monetary asset total.
- Only `needs_update` is included in the top “Action Required” count; `sync_failed` and `never_synced` are not.

### 15.2 Account detail

**Runtime flow:**

```text
GET /accounts/[accountId]?type=...&q=...&sort=...
→ authenticate and fetch account where id + user_id match
→ derive Item health
→ separately fetch transactions where account_id + user_id match
→ apply the same search/filter/sort rules as /transactions
→ render balances, health, repair/retry action, and up to 50 transactions
```

**Files involved:** dynamic account page, account actions, `AccountDetailPageClient.tsx`, `Transactions.tsx`, shared transaction controls/items, formatting helpers, repair button, and sync button.

**Authorization:** both account and transaction reads include `user_id`; the page also resolves the owned account before showing transactions.

**Failure/edge behavior:** account/query failures render inline error content rather than a route-level error or 404. The transaction list initially shows five rows and toggles all returned rows, but the server still caps the result at 50.

### 15.3 Repair flow

```text
sync returns ITEM_LOGIN_REQUIRED
→ record Item status/error
→ UI receives internal Item ID
→ POST /api/plaid/update-link-token verifies ownership
→ load access_token server-side
→ create Plaid update-mode Link token
→ user repairs connection in Plaid Link
→ UI retries one-Item sync
→ successful persistence resets Item status to active and clears error
```

This behavior appears in `SyncDashboardButton.tsx`, `RepairConnectionButton.tsx`, `update-link-token/route.ts`, `recordSyncFailure.ts`, and the one-Item sync route.

## 16. Budget data flows

### 16.1 Create a budget

**Runtime flow:**

```text
GET /budgets/create-budget
→ authenticate and fetch owned expense categories
→ user selects category, positive amount, and month
→ client formats month as currentYear-MM-01
→ addBudget() authenticates user
→ validate category ID, finite positive amount, real YYYY-MM-DD, and day 01
→ prove category belongs to user and has kind=expense
→ insert budget
→ map unique violation to friendly duplicate message
```

**Files involved:** create-budget route, `BudgetCreatePageClient.tsx`, `SelectCategoryButton.tsx`, `getCategories()`, and `addBudget()`.

**Input contract:** `{ categoryId: string, amount: number, month: YYYY-MM-01 }`.

**Output contract:** `{ ok: true }` or a structured validation/duplicate error for expected failures; some database/category failures throw.

**Authorization:** category lookup and inserted `user_id` use the authenticated user.

**Edge cases:** the UI offers only months in the current server/browser year, including already passed months, and remains on the creation page after success. There is no budget edit/delete flow.

### 16.2 Display and analyze budgets

**Runtime flow:**

```text
GET /budgets
→ authenticate user
→ fetch owned budgets joined to category
→ fetch all owned negative transactions
→ for each budget, calculate next month start
→ filter transactions by matching category and [month, nextMonth)
→ sum absolute expense values
→ derive spent, remaining, percentUsed, isOverSpending
→ return BudgetAnalysis[]
→ BudgetCard renders status, amounts, and progress
```

**Contract:** each `BudgetAnalysis` contains budget/category fields plus `spent`, `remaining`, `percentUsed`, and `isOverSpending`.

**Business rules:** remaining is clamped to zero; percent used is capped at 100 once the limit is reached or exceeded; card status is On Track through 80%, Warning above 80% and below 100%, otherwise Over Spending.

**Failure modes/edge cases:**

- The transaction query does not exclude `is_removed = true`, so removed Plaid expenses can count against budgets.
- It fetches every negative transaction for the user and filters once per budget in JavaScript, which grows poorly with history and budget count.
- Capping `percentUsed` at 100 hides how far over budget the user is; `isOverSpending` is calculated but not used by the card.
- Category kind and amount sign can be made inconsistent by manual category editing.
- Budget reads have no explicit ordering.

**Why this design:** budget analysis is server-side and React receives a complete display contract instead of recomputing finance rules.

## 17. Other application flows

### Marketing landing page

`src/app/(marketing)/page.tsx` composes `LandingHero`, `LandingProcess`, and `LandingSecurity` using `src/contents/landingData.ts`. `GetStartedButton` checks onboarding state on the server: unauthenticated visitors go to login, authenticated users without an Item go to connect-bank, and connected users go to the dashboard.

`DashboardMock` is the current hero visual. `PhoneMock` and `Description` exist but are not used by the live landing page. Public raster/SVG assets support these marketing experiments.

Some marketing copy describes AI categorization, net worth, subscription discovery, AES-256 protection, 12,000+ institution support, and bank-grade/read-only properties. The implemented categorization is deterministic rules, and several other claims are not demonstrated by this code. Production copy should be limited to verified capabilities.

### Development seed

`/dev/seed` submits the `seedData()` server action. The action refuses to run outside `NODE_ENV=development`, authenticates the user, deletes that user's transactions, categories, and accounts, inserts one TD account, one Food category, and one `-40` Save-On-Foods transaction, then redirects to dashboard.

It intentionally mutates data and can fail when other tables—such as budgets—still reference categories or when Plaid-linked foreign-key constraints require additional cleanup. It does not delete Plaid Items or secrets.

### Design system and global shell

`src/app/layout.tsx` loads Geist, Geist Mono, Poppins, additional Google font/material-symbol links, global CSS, and Sonner. `src/app/globals.css` defines the dark emerald fintech palette, type/spacing tokens, shared buttons, cards, and landing utilities. The protected layout separately mounts React Toastify, so two notification systems currently coexist.

Root metadata still uses Create Next App defaults. The sidebar contains working Dashboard, Transactions, Accounts, and Budgets links; Settings points to `#`, and the active-class check for Budgets incorrectly compares the pathname with `/settings`.

## 18. Failure and security review

### What the code currently protects well

- Permanent Plaid access tokens never enter React responses.
- Most reads and writes include both resource identifiers and authenticated `user_id`.
- Transaction/account detail cannot be fetched solely by a guessed UUID.
- Manual category selection validates category ownership and active state.
- Removed Plaid transactions are soft-deleted instead of erased.
- Sync upserts provide a useful idempotency foundation.
- Confirmation redirects reject external/protocol-relative targets.
- Webhooks verify signature, age, algorithm, key ID, and exact body hash.
- The service-role key is referenced only by a server module.

### Security guarantees that remain external or unverified

- RLS policies and RPC ownership logic are not in the repository.
- Unique constraints and foreign-key cascades are not in the repository.
- There is no evidence of application-level Plaid access-token encryption.
- Marketing security claims cannot be derived solely from the application code.
- Environment-secret configuration and rotation cannot be evaluated from ignored `.env` files.

### Highest-priority correctness/production findings

1. **Automatic webhook sync is not operational end to end by current code.** Link-token creation does not register the webhook, and persistence re-authenticates a service-role client that has no user session.
2. **Database security/integrity is not reproducible.** Migrations, RLS policies, constraints, and RPC definitions must be checked in or documented separately.
3. **Signup confirmation is environment-specific.** The hard-coded localhost callback breaks deployed signup.
4. **Sync is non-atomic and concurrency-unlocked.** Partial writes and racing cursor updates are possible.
5. **Account removal is not reconciled.** Account upsert never marks missing accounts inactive.
6. **Date-only transaction details can crash.** Detail rendering assumes every `posted_at` contains `T` and a time.
7. **Budget totals include removed rows.** `getBudgets()` lacks the normal `is_removed` condition.
8. **Removed-row semantics differ between pages.** Transaction list requires false, while dashboard/account queries accept null or false.
9. **Dashboard duplicates its sidebar.** Both protected layout and dashboard presentation render it.
10. **Manual category kind can disagree with amount sign.** This can affect transaction filters/stats and budget inclusion.
11. **Test coverage is planning-only.** TestSprite JSON describes test ideas, but no executable test suite/script is present.
12. **Current lint does not pass.** See Section 20.

## 19. Feature-by-feature interview map

| Interview question                                  | Short answer grounded in the code                                                                                                     | Main evidence                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Where is authentication owned?                      | Supabase Auth; browser forms create sessions, middleware refreshes them, protected layout checks claims, operations call `getUser()`. | auth components/actions, Supabase helpers, protected layout   |
| How is authorization enforced?                      | Server queries add `user_id` predicates; RLS is expected as a second boundary but is not checked in.                                  | dashboard/account/transaction/budget actions and Plaid routes |
| Why store Plaid secrets separately?                 | UI Item metadata can be queried without mixing it with access tokens; token reads stay in server routes.                              | `plaid_items`, `plaid_item_secrets`, exchange/sync handlers   |
| Where is the amount sign changed?                   | Exactly once during Plaid ingestion with `return -amount`.                                                                            | `persistSyncResult()`                                         |
| Why normalize during ingestion?                     | Every downstream feature can use negative expense/positive income without knowing Plaid semantics.                                    | dashboard, transactions, budgets                              |
| How are duplicates prevented?                       | Upserts target database uniqueness keys; the actual constraints must exist in Supabase.                                               | account/category/transaction upserts                          |
| What is the Plaid cursor for?                       | It marks the last consumed transaction change set, allowing incremental sync instead of refetching all history.                       | `syncTransactions()`, `plaid_items.transactions_cursor`       |
| What if Plaid sends the webhook twice?              | Upserts/soft deletes make sequential repeats mostly safe; concurrent repeats can still race the cursor.                               | sync and persistence modules                                  |
| How is a guessed account/transaction UUID blocked?  | Detail queries require both UUID and current `user_id`; RLS should provide another boundary.                                          | account/transaction actions                                   |
| Why is a budget positive while expense is negative? | Budget is a positive limit; expenses are converted to absolute values only when measuring usage.                                      | budget actions                                                |
| Why store month as `YYYY-MM-01`?                    | It creates a canonical month key and supports `[month, nextMonth)` date boundaries and uniqueness.                                    | `addBudget()`, `getNextMonthStart()`                          |
| What happens if sync fails halfway?                 | Some upserts may remain; cursor is not advanced; failure status is recorded; retry replays and upserts the page.                      | `persistSyncResult()`, `recordSyncFailure()`                  |
| Who calculates dashboard/budget values?             | Server/domain actions and DB RPCs; React receives formatted contracts and renders.                                                    | dashboard and budget actions/types                            |

## 20. Verification performed for this summary

`npm run lint` was run without auto-fix. It reported **1 error and 22 warnings**:

- Blocking error: `let result` should be `const` in `src/features/budgets/actions.ts`.
- Warnings include unused variables/imports in Plaid, landing, auth, dashboard, account, budget, and transaction files.
- Three Next.js warnings come from manually adding Google font links in `src/app/layout.tsx`.

No source was auto-fixed. A production build and live Supabase/Plaid integration tests were not run as part of this documentation-only request.

## 21. Five-minute demonstration story grounded in current code

| Time      | Demonstration                       | Technical point to explain                                                                           |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Landing/login and problem statement | Next.js application, Supabase identity, Plaid data ingestion.                                        |
| 0:30–1:20 | Dashboard                           | Server aggregates authenticated data into a typed `DashboardData` contract.                          |
| 1:20–2:05 | Transactions search/filter/detail   | URL-driven DB queries, per-user ownership, manual category override.                                 |
| 2:05–2:50 | Accounts and health                 | Items group accounts; stored sync errors drive retry/repair UI.                                      |
| 2:50–3:45 | Plaid connection/sync architecture  | Public token may reach browser; access token remains server-side; cursor makes sync incremental.     |
| 3:45–4:30 | Budgets                             | Positive limit compared server-side against absolute values of negative expenses.                    |
| 4:30–5:00 | Security and honest next steps      | Ownership predicates plus expected RLS; signed webhook; call out migrations/webhook deployment work. |

Useful accurate statements:

> “Plaid access tokens are stored in a separate server-read table and are never returned to React.”

> “Plaid and my domain use opposite amount signs, so I flip the amount once during ingestion. Every downstream feature then shares one convention.”

> “Detail queries match both the resource UUID and the authenticated user ID. RLS should be the second database boundary, although those policies still need to be checked into this repository.”

> “A manual transaction category is marked with `category_source = manual`, and modified Plaid records preserve that override.”

> “The transaction cursor lets synchronization request only changes. Upserts make retries mostly idempotent, while atomic persistence and cursor locking are the next reliability improvements.”

## 22. File-by-file code index

### Application routes and shell

| File                                                        | Current role                                                                           |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/app/layout.tsx`                                        | Root HTML, fonts, metadata, global CSS, and Sonner toaster.                            |
| `src/app/globals.css`                                       | Tailwind import, theme variables, design tokens, reusable utilities, and base styling. |
| `src/app/(marketing)/page.tsx`                              | Public landing composition.                                                            |
| `src/app/(auth)/login/page.tsx`                             | Login route wrapper.                                                                   |
| `src/app/(auth)/signup/page.tsx`                            | Signup route wrapper.                                                                  |
| `src/app/(auth)/verify-email/page.tsx`                      | Client resend-confirmation flow.                                                       |
| `src/app/(auth)/auth/confirm/route.ts`                      | Supabase confirmation-code callback and safe redirect.                                 |
| `src/app/(protected)/layout.tsx`                            | Claim check, protected sidebar, and Toastify container.                                |
| `src/app/(protected)/dashboard/page.tsx`                    | Dashboard server-data entry point.                                                     |
| `src/app/(protected)/dashboard/loading.tsx`                 | Dashboard loading skeleton.                                                            |
| `src/app/(protected)/transactions/page.tsx`                 | Parses list query parameters and loads transactions.                                   |
| `src/app/(protected)/transactions/[transactionId]/page.tsx` | Loads transaction and categories for detail.                                           |
| `src/app/(protected)/accounts/page.tsx`                     | Loads grouped institutions/accounts.                                                   |
| `src/app/(protected)/accounts/[accountId]/page.tsx`         | Loads account detail plus account-specific transactions.                               |
| `src/app/(protected)/accounts/add-accounts/page.tsx`        | Loads existing institutions for account selection.                                     |
| `src/app/(protected)/connect-bank/page.tsx`                 | First-bank gate and connection UI.                                                     |
| `src/app/(protected)/budgets/page.tsx`                      | Loads budget analysis.                                                                 |
| `src/app/(protected)/budgets/create-budget/page.tsx`        | Loads categories for budget creation.                                                  |
| `src/app/(protected)/dev/seed/page.tsx`                     | Form entry for the development seed action.                                            |
| `src/middleware.ts`                                         | Runs Supabase session propagation/refresh on matched requests.                         |

### Plaid Route Handlers

| File                                           | Current role                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/app/api/plaid/lib/plaid.helper.ts`        | Shared Plaid client and Plaid error extraction.                                  |
| `src/app/api/plaid/link-token/route.ts`        | New-Item Link token.                                                             |
| `src/app/api/plaid/exchange/route.ts`          | Public-token exchange and initial Item/secret/account persistence.               |
| `src/app/api/plaid/sync-transactions/route.ts` | Authenticated one-Item sync.                                                     |
| `src/app/api/plaid/sync-all/route.ts`          | Authenticated sequential all-Item sync.                                          |
| `src/app/api/plaid/update-link-token/route.ts` | Connection-repair Link update mode.                                              |
| `src/app/api/plaid/add-account/route.ts`       | Account-selection Link update mode.                                              |
| `src/app/api/plaid/refresh-accounts/route.ts`  | Account snapshot refresh and incremental transactions.                           |
| `src/app/api/plaid/webhook/route.ts`           | Verified Plaid transaction-update webhook handling.                              |
| `src/app/api/plaid/webhook/verifyWebhooks.ts`  | Plaid verification-key lookup/cache, JWT verification, and body-hash comparison. |
| `src/app/api/plaid/type/plaidwebhook.type.ts`  | Webhook-body type; currently imported but unused.                                |

### Supabase and shared library

| File                               | Current role                                             |
| ---------------------------------- | -------------------------------------------------------- |
| `src/lib/supabase/browser.ts`      | Publishable-key browser client.                          |
| `src/lib/supabase/server.ts`       | Cookie-aware server client for user-session operations.  |
| `src/lib/supabase/proxy.ts`        | Middleware client and cookie propagation.                |
| `src/lib/supabase/server-role.ts`  | Service-role client for signed webhook work.             |
| `src/lib/getUser.ts`               | Authenticated-user helper with login redirect.           |
| `src/lib/dateRanges.ts`            | Vancouver day/month boundaries converted to UTC ISO.     |
| `src/lib/transactions.helper.ts`   | Amount-kind/category mapping and merchant rules.         |
| `src/lib/categIconMap.ts`          | Normalized category-to-icon mapping.                     |
| `src/lib/formatError.ts`           | Extracts string/nested API error messages.               |
| `src/lib/formatTransactionDate.ts` | General transaction-date display.                        |
| `src/lib/formatValue.ts`           | CAD amount/count formatting and absolute amount display. |
| `src/declarations.d.ts`            | Allows CSS module imports to type-check.                 |

### Authentication feature

| File                                          | Current role                                        |
| --------------------------------------------- | --------------------------------------------------- |
| `src/features/auth/actions.ts`                | Onboarding Item count and logout server actions.    |
| `src/features/auth/components/LoginForm.tsx`  | Client login, error state, and onboarding redirect. |
| `src/features/auth/components/SignupForm.tsx` | Client signup and verification redirect.            |

### Plaid server/domain feature

| File                                                 | Current role                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/features/plaid/server/accounts.ts`              | Wrapper for Plaid `accounts/get`.                                                    |
| `src/features/plaid/server/sync.ts`                  | Cursor pagination and accumulated change sets.                                       |
| `src/features/plaid/server/syncPlaidItem.ts`         | One-Item sync orchestrator.                                                          |
| `src/features/plaid/server/db.ts`                    | Transaction normalization/persistence and successful cursor state.                   |
| `src/features/plaid/server/persitstPlaidAccounts.ts` | Account/balance snapshot upsert. The filename contains the existing `persitst` typo. |
| `src/features/plaid/server/recordSyncFailure.ts`     | Writes Item sync failure/repair state.                                               |

### Dashboard feature

| File                                                           | Current role                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/features/dashboard/actions.ts`                            | Auth, queries/RPCs, aggregation, and dashboard contract mapping.                         |
| `src/features/dashboard/type.ts`                               | Dashboard database-row and UI contract types.                                            |
| `src/features/dashboard/pages/DashboardClient.tsx`             | Dashboard result/empty/error presentation composition.                                   |
| `src/features/dashboard/components/DashboarHeader.tsx`         | Fixed header with Add Bank and Sync controls; filename has the existing `Dashboar` typo. |
| `src/features/dashboard/components/DashboardStats.tsx`         | Summary stat card.                                                                       |
| `src/features/dashboard/components/ConnectedAccounts.tsx`      | Dashboard account summary and link.                                                      |
| `src/features/dashboard/components/AccountItem.tsx`            | Compact dashboard account card.                                                          |
| `src/features/dashboard/components/RecentTransactions.tsx`     | Client show-five/show-all recent activity.                                               |
| `src/features/dashboard/components/RecentTransactionItem.tsx`  | Recent row, icon, sign, date, and detail link.                                           |
| `src/features/dashboard/components/SpendingByCategory.tsx`     | Category breakdown list/empty state.                                                     |
| `src/features/dashboard/components/CategoryBreakdownItem.tsx`  | Category amount, percentage, and progress bar.                                           |
| `src/features/dashboard/components/SyncDashboardButton.tsx`    | All-Item sync state machine and repair initiation.                                       |
| `src/features/dashboard/components/DashboardSidebar.tsx`       | Server user lookup for sidebar.                                                          |
| `src/features/dashboard/components/DashboardSidebarClient.tsx` | Path-aware navigation and logout form.                                                   |

### Transactions feature

| File                                                                   | Current role                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/features/transactions/types.ts`                                   | List/detail/filter/sort types and query parsers.                   |
| `src/features/transactions/actions.ts`                                 | Authenticated list and detail reads.                               |
| `src/features/transactions/server-actions.ts`                          | Owned manual category update and cache revalidation.               |
| `src/features/transactions/pages/TransactionPage.tsx`                  | List stats, date grouping, controls, rows, and empty/error states. |
| `src/features/transactions/components/Search.tsx`                      | Debounced URL search parameter.                                    |
| `src/features/transactions/components/TransactionTypeFilter.tsx`       | URL type-filter links.                                             |
| `src/features/transactions/components/TransactionSort.tsx`             | URL sort links.                                                    |
| `src/features/transactions/components/TransactionStats.tsx`            | Activity/income/expense card.                                      |
| `src/features/transactions/components/TransactionByDate.tsx`           | Date group.                                                        |
| `src/features/transactions/components/TransactionItem.tsx`             | Transaction list row.                                              |
| `src/features/transactions/components/TransactionDetailPageClient.tsx` | Detail presentation and edit modal state.                          |
| `src/features/transactions/components/EditCategoryComponent.tsx`       | Category selector and save control.                                |

### Accounts feature

| File                                                              | Current role                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/features/accounts/types.ts`                                  | Query rows, page contracts, and health types.                      |
| `src/features/accounts/actions.ts`                                | Grouped accounts, owned detail, and account-specific transactions. |
| `src/features/accounts/lib/lib.accounts.ts`                       | Connection-health derivation.                                      |
| `src/features/accounts/lib/formatCurrency.ts`                     | Account/budget currency formatter.                                 |
| `src/features/accounts/lib/formatSyncTime.ts`                     | Relative last-sync formatter.                                      |
| `src/features/accounts/pages/AccountPageClient.tsx`               | Account-page summary and institution sections.                     |
| `src/features/accounts/pages/AccountDetailPageClient.tsx`         | Account identity, balances, health, actions, and transactions.     |
| `src/features/accounts/pages/AddAccountsPageClient.tsx`           | Existing-institution selection state.                              |
| `src/features/accounts/components/AccountSection.tsx`             | Institution health and child accounts.                             |
| `src/features/accounts/components/AccountItem.tsx`                | Account list row and balance.                                      |
| `src/features/accounts/components/Transactions.tsx`               | Account-specific search/filter/sort and show-more state.           |
| `src/features/accounts/components/InstitutionSelectComponent.tsx` | Selectable institution tile.                                       |
| `src/features/accounts/components/RepairConnectionButton.tsx`     | Update-mode repair state machine.                                  |
| `src/features/accounts/components/SyncInstitutionButton.tsx`      | One-Item retry action.                                             |
| `src/components/addAccounts/AddAccountButton.tsx`                 | Account-selection Link and refresh workflow.                       |

### Budgets and development feature

| File                                                       | Current role                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| `src/features/budgets/types.ts`                            | Category, budget row, and analysis result types.                |
| `src/features/budgets/actions.ts`                          | Category read, budget validation/insert, and spending analysis. |
| `src/features/budgets/pages/BudgetCreatePageClient.tsx`    | Creation form interaction and server-action call.               |
| `src/features/budgets/pages/BudgetDisplayPageClient.tsx`   | Budget page layout and empty state.                             |
| `src/features/budgets/components/SelectCategoryButton.tsx` | Category choice tile.                                           |
| `src/features/budgets/components/BudgetCard.tsx`           | Budget status, amounts, and utilization bar.                    |
| `src/features/dev/seed/action.ts`                          | Development-only per-user destructive seed action.              |

### Shared connection, landing, and common UI

| File                                                    | Current role                                       |
| ------------------------------------------------------- | -------------------------------------------------- |
| `src/components/connectBank/ConnectBankClient.tsx`      | First-connection explanatory layout.               |
| `src/components/connectBank/ConnectButtonComponent.tsx` | New-Item Link/exchange/initial-sync state machine. |
| `src/components/common/Spinner.tsx`                     | Shared loading spinner.                            |
| `src/components/common/Logo.tsx`                        | Obsidian Ledger wordmark.                          |
| `src/components/common/DashboardMock.tsx`               | Static marketing dashboard mock.                   |
| `src/components/landingPage/LandingHero.tsx`            | Hero copy, CTA, and dashboard mock.                |
| `src/components/landingPage/LandingProcess.tsx`         | Three process cards from content data.             |
| `src/components/landingPage/LandingSecurity.tsx`        | Security copy and decorative network panel.        |
| `src/components/landingPage/GetStartedButton.tsx`       | Auth/onboarding-aware CTA destination.             |
| `src/components/landingPage/Description.tsx`            | Unused generic icon/title/description component.   |
| `src/components/PhoneImage.tsx`                         | Unused composited phone-frame mock.                |
| `src/contents/landingData.ts`                           | Marketing content model.                           |

### Project configuration, documentation, assets, and generated material

| File/group                            | Current role                                                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`   | Dependencies and four runtime/lint scripts.                                                                                                                                |
| `tsconfig.json`                       | Strict TypeScript, bundler resolution, `@/*` alias, no emit.                                                                                                               |
| `eslint.config.mjs`                   | Next Core Web Vitals and TypeScript lint rules.                                                                                                                            |
| `postcss.config.mjs`                  | Tailwind PostCSS plugin.                                                                                                                                                   |
| `next.config.ts`                      | Turbopack root configuration.                                                                                                                                              |
| `README.md`                           | Mostly unchanged Create Next App starter instructions; not an accurate project guide.                                                                                      |
| `PROJECT_SUMMARY.md`                  | Older handoff; several feature/status statements are now stale.                                                                                                            |
| `spec.md`                             | Earlier mentor/audit notes describing a less complete code state.                                                                                                          |
| `random_memo.md`                      | Plaid Quickstart notes, not application runtime code.                                                                                                                      |
| `public/*`                            | Marketing images and starter SVG assets; not all are used.                                                                                                                 |
| `testsprite_tests/*`, `.testsprite/*` | Generated PRD/test-plan/config material. These describe proposed tests and some stale expected behavior; they are not an executable test suite or runtime source of truth. |
| `.next/*`, `node_modules/*`           | Generated build/dependency content and intentionally outside the first-party code audit.                                                                                   |

## 23. Recommended next work, in order

These are recommendations only; they were not implemented as part of this document.

1. Check in Supabase migrations containing tables, foreign keys, unique constraints, RLS policies, secret-table policy, and both RPC definitions.
2. Repair webhook end-to-end behavior: configure webhook URLs on Items and remove session-dependent `grabUser()` from service-role persistence.
3. Make auth callback and Plaid webhook/base URLs environment-aware.
4. Add a per-Item synchronization lock and transactional/batched persistence function, preferably inside Postgres.
5. Reconcile account snapshots by marking missing/de-selected accounts inactive.
6. Fix date-only transaction detail parsing and standardize `is_removed` handling.
7. Exclude removed transactions from budgets and perform grouped budget aggregation in SQL.
8. Decide/enforce whether manual categories may cross income/expense kinds.
9. Remove the duplicate dashboard sidebar and standardize on Sonner or Toastify.
10. Add request-body validation, intentional 404/error routes, pagination, and per-Item sync results.
11. Turn key TestSprite journeys into executable tests for auth, authorization, Plaid idempotency, webhook verification, amount signs, manual overrides, and budgets.
12. Clear the lint failure/warnings, update product metadata/copy, and run a production build plus the new test suite before the live demonstration.
