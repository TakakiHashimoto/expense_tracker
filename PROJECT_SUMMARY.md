# Expense Tracker Project Handoff

Last reviewed from the repository on **June 21, 2026**.

## 1. Project overview

This project is a full-stack personal expense tracker currently branded in parts of the UI as **Obsidian Ledger**. A user can create an account, verify their email, connect a Canadian bank through Plaid, import transactions, and review spending through a dashboard and transaction history.

The application follows this main flow:

1. A visitor reads the landing page and creates an account.
2. Supabase sends an email-verification link.
3. The callback creates the authenticated Supabase session and cookies.
4. On login, the app checks whether the user has a connected Plaid item.
5. A new user is sent to `/connect-bank`; an existing user is sent to `/dashboard`.
6. Plaid Link returns a temporary public token to the browser.
7. The server exchanges it for a private access token, stores the bank connection and accounts, then performs the first transaction sync.
8. The dashboard and transactions page query the user's stored Supabase data.

## 2. Tech stack

### Frontend and application framework

- **Next.js 16 App Router** for pages, layouts, Route Handlers, server rendering, and server actions
- **React 19** and **TypeScript 5**
- **Tailwind CSS 4** with a custom dark fintech token system in `src/app/globals.css`
- **Lucide React** and Google Material Symbols for icons
- **Sonner** for dashboard sync notifications
- **React Toastify** is also mounted in the protected layout
- **Luxon** for timezone-aware date ranges

### Authentication and database

- **Supabase Auth** for email/password signup, email confirmation, login, logout, sessions, and cookies
- **Supabase Postgres** for application data
- **`@supabase/ssr`** for browser/server clients and middleware session refresh

### Banking integration

- **Plaid Node SDK** for link tokens, public-token exchange, update mode, and transaction sync
- **React Plaid Link** for opening Plaid Link in the browser
- Current Plaid configuration requests the `Transactions` product for Canadian institutions and asks for up to 90 days of history

### Local scripts

| Command         | Purpose                                       |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Start Next.js development mode on port `3002` |
| `npm run build` | Create a production build                     |
| `npm run start` | Run the production server                     |
| `npm run lint`  | Run ESLint                                    |

### Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV` (defaults to `sandbox`)

## 3. Architecture

The repository is organized by route and feature:

- `src/app` contains App Router pages, layouts, middleware entry points, and API Route Handlers.
- `src/features/auth` contains authentication actions and forms.
- `src/features/dashboard` loads and displays financial summaries.
- `src/features/transactions` loads, filters, groups, and displays transaction history.
- `src/features/accounts` contains the in-progress Accounts page data layer and UI.
- `src/features/plaid/server` contains reusable Plaid sync and database-persistence logic.
- `src/lib` contains Supabase clients, user lookup, date ranges, formatting, and category normalization.

Most protected data is loaded on the server. Client components are used where browser state or interaction is needed, such as forms, Plaid Link, resend-email controls, sync buttons, and toasts.

## 4. Application routes

| Route           | Access                                | What it does                                                                                                                                     | Current status                                                                        |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `/`             | Public                                | Marketing landing page with the product pitch, process, security section, and calls to action                                                    | Implemented                                                                           |
| `/signup`       | Public                                | Creates a Supabase email/password account, saves the email temporarily, and sends the user to verification                                       | Implemented                                                                           |
| `/verify-email` | Public                                | Tells the user to verify their email and can resend the Supabase signup email                                                                    | Implemented                                                                           |
| `/auth/confirm` | Public callback                       | Exchanges the Supabase email callback code for a session and safely redirects                                                                    | Implemented                                                                           |
| `/login`        | Public                                | Signs in with Supabase and sends the user to bank connection or dashboard based on onboarding state                                              | Implemented                                                                           |
| `/connect-bank` | Protected                             | Opens Plaid Link, exchanges the returned token, performs the initial sync, and redirects to the dashboard                                        | Implemented                                                                           |
| `/dashboard`    | Protected                             | Shows monthly spending, today's spending, monthly income, recent activity count, connected accounts, recent transactions, and category breakdown | Implemented                                                                           |
| `/transactions` | Protected                             | Shows the latest 50 active transactions, summary totals, date groups, and URL-based type filters                                                 | Implemented; search and “View older activity” are visual only                         |
| `/accounts`     | Protected                             | Intended to show institutions, account balances, connection health, and last-sync information                                                    | In progress; query exists, route returns a placeholder, detailed UI uses mock content |
| `/dev/seed`     | Protected and development-only action | Deletes the signed-in user's sample transactions/categories/accounts and inserts one sample account, category, and transaction                   | Development utility                                                                   |

All routes pass through middleware so Supabase can validate and refresh auth cookies. The protected route-group layout additionally checks JWT claims and redirects unauthenticated users to `/login`.

## 5. API routes

All application API endpoints currently use `POST`.

### `POST /api/plaid/link-token`

Creates a new Plaid Link token for the authenticated user.

- Uses the Supabase user ID as Plaid's `client_user_id`.
- Requests Canadian institutions, English language, the Transactions product, and 90 days of transactions.
- Returns `{ link_token }`.

### `POST /api/plaid/exchange`

Finishes a new bank connection.

Request body:

```json
{ "public_token": "temporary Plaid token", "metadata": "Plaid Link metadata" }
```

What it does:

- Requires an authenticated user and Plaid credentials.
- Prevents the user from adding another connection when a Plaid item already exists.
- Exchanges the public token for an access token and Plaid item ID.
- Inserts the institution into `plaid_items`.
- Inserts the private access token into `plaid_item_secrets`.
- Inserts the returned bank accounts into `accounts`.
- Rolls back the new Plaid item if the secret/account writes fail.
- Returns `{ plaid_item_uuid }`, using the app's internal database UUID rather than Plaid's external item ID.

### `POST /api/plaid/sync-transactions`

Syncs one Plaid item, primarily for the initial connect-bank flow.

Request body:

```json
{ "plaid_item_uuid": "internal plaid_items.id" }
```

It verifies that the item belongs to the signed-in user, loads its cursor and secret access token, downloads every page of changes from Plaid, persists the changes, and returns added/modified/removed counts.

### `POST /api/plaid/sync-all`

Syncs every Plaid item owned by the authenticated user from the dashboard.

- Loads every item and cursor.
- Loads each private access token.
- Syncs and persists changes item by item.
- Returns totals and the number of synced items.
- Converts Plaid's `ITEM_LOGIN_REQUIRED` error into HTTP `409`, including the affected internal item ID so the UI can start repair mode.

### `POST /api/plaid/update-link-token`

Creates a Plaid Link token in update mode for an existing bank connection.

Request body:

```json
{ "plaid_item_uuid": "internal plaid_items.id" }
```

The route confirms ownership, fetches the access token, and returns a new `{ link_token }`. The dashboard then opens Plaid Link in update mode and retries the sync after a successful repair.

## 6. Main user actions and behavior

### Sign up and verify email

- `SignupForm` calls `supabase.auth.signUp()`.
- The verification callback is currently hard-coded to `http://localhost:3002/auth/confirm`.
- The submitted email is kept in `sessionStorage` for resending verification.
- `/auth/confirm` rejects unsafe external `next` redirects, exchanges the code for a session, and redirects to the requested safe route or `/dashboard`.

### Log in and choose the next screen

- `LoginForm` calls `signInWithPassword()`.
- `getUserOnboardingState()` counts the user's rows in `plaid_items`.
- No connected item means redirect to `/connect-bank`; otherwise redirect to `/dashboard`.

### Log out

- `logoutUser()` calls Supabase `signOut()` and redirects to `/login`.
- The action is used from the dashboard sidebar.

### Connect a bank

- The protected page rejects unauthenticated users.
- If the user already has a Plaid item, it redirects to `/dashboard`.
- The client creates a link token, opens Plaid Link, exchanges the public token, and calls the one-item sync endpoint.
- Loading, exchange, sync, retry, and error states are represented in the connect-bank client.
- A failed initial transaction sync can be retried without reconnecting the bank.

### Sync the dashboard

- The header's Sync Bank button calls `/api/plaid/sync-all`.
- Success is shown with a Sonner toast and `router.refresh()` reloads server-rendered dashboard data.
- When Plaid says login is required, an Update Bank Connection action appears.
- That action creates an update link token, opens Plaid Link, then syncs again after repair.

### Browse and filter transactions

- The page reads the `type` query parameter.
- Supported filters are `all`, `income`, `expense`, and `uncategorized`.
- The server fetches the latest 50 non-removed transactions and applies the selected filter.
- The UI calculates total activity, income, and expenses from the returned set.
- Transactions are grouped by date and display merchant, category, account, institution, and amount information.
- The search box and older-activity button do not have behavior yet.

### View accounts

- `getAccountPageData()` fetches active accounts and their related Plaid institution.
- It groups accounts by Plaid item and returns institution name, connection status, last sync time, mask, type/subtype, and current balance.
- This data is not yet connected to the `/accounts` UI; that is the current work in progress.

### Seed development data

- The server action is blocked outside development mode.
- It deletes the current user's transactions, categories, and accounts.
- It creates one TD Bank account, one Food expense category, and one `-40` Save-On-Foods transaction.
- It then redirects to `/dashboard`.

## 7. Plaid sync and normalization logic

### Incremental sync

`syncTransactions()` calls Plaid's transaction-sync API repeatedly until `has_more` is false. It accumulates three change lists—`added`, `modified`, and `removed`—and returns the newest cursor.

### Amount convention

Plaid treats positive values as money leaving an account. This application flips the sign while importing:

- **Negative amount = expense**
- **Positive amount = income**

The rest of the app relies on this internal convention.

### Category normalization

During import, the app creates or reuses a per-user category. Rules currently include:

- Payroll/income → Salary
- Refunds → Refund
- Food, transport, entertainment, general merchandise, utilities, and payments → matching friendly categories
- Merchant rules for businesses such as Walmart, Costco, Starbucks, Uber, Amazon, Netflix, BC Hydro, Rogers, and others
- Fallbacks → Other Income or Other Expense

Categories are upserted on the unique combination of user, kind, and name.

### Persistence behavior

- Added and modified Plaid transactions are upserted by Plaid item and transaction ID.
- Plaid account IDs are resolved to the app's internal account UUID.
- Removed Plaid transactions are soft-deleted with `is_removed: true`.
- Successful syncs save the latest cursor in `plaid_items.transactions_cursor`.
- Dashboard and transaction queries exclude removed transactions.

## 8. Current data model

The code currently uses these Supabase tables:

| Table                 | Responsibility                                                 | Important fields used by the app                                                                                                 |
| --------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Supabase `auth.users` | User identity and session ownership                            | user ID, email/session data                                                                                                      |
| `plaid_items`         | One connected financial institution/item                       | `id`, `user_id`, external `plaid_item_id`, institution ID/name, cursor, status, last sync time                                   |
| `plaid_item_secrets`  | Private Plaid credentials separated from regular item metadata | `plaid_item_id`, `access_token`                                                                                                  |
| `accounts`            | Individual checking, savings, credit, or other accounts        | user/item IDs, Plaid account ID, name, type, subtype, mask, active state, balance                                                |
| `categories`          | User-owned normalized income/expense categories                | `user_id`, `kind`, `name`                                                                                                        |
| `transactions`        | Imported financial activity                                    | ownership/account/category IDs, date, amount, merchant, Plaid IDs, pending status, raw category, channel, location, removed flag |

The dashboard also expects two database RPC functions:

- `get_daily_expenses(start_ts)`
- `get_monthly_expense_total(start_ts, end_ts)`

## 9. Dashboard data and UI

`getDashboardData()` is the dashboard orchestrator. After confirming the user has a Plaid item, it runs its independent queries in parallel and returns one UI-focused object.

The dashboard currently shows:

- This month's total spending
- Today's spending total
- This month's income
- Count of the 20 most recent activities
- Connected accounts with institution, type, mask, and active state
- The 20 most recent transactions
- Current-month expense totals grouped by category with percentages
- A fixed sidebar, header, sync/repair controls, empty states, loading skeleton, and error state

Date boundaries use **America/Vancouver** and are converted to UTC ISO timestamps before querying.

## 10. Design system

The project uses a dark, polished fintech style described as “Quiet Authority” in earlier project work:

- Near-black navy backgrounds
- Layered dark surface containers instead of heavy divider lines
- Emerald green as the primary action/accent color
- Light blue secondary and soft coral error colors
- Poppins/Geist/Inter typography
- Rounded cards, restrained glass effects, generous spacing, and subtle gradients

The canonical tokens live in `src/app/globals.css`, including `background`, `surface-container-*`, `on-surface`, `primary`, `secondary`, `tertiary`, and outline colors.

## 11. Work completed so far

The Git history and current code show these major stages:

1. Bootstrapped the Next.js application and built the landing page.
2. Added Supabase signup, email confirmation, login, logout, session refresh, and protected layouts.
3. Added onboarding redirects based on whether a bank is connected.
4. Built Plaid Link token creation, public-token exchange, secure access-token storage, account storage, and duplicate-connection prevention.
5. Built paginated incremental transaction sync, database persistence, soft removal, cursors, amount conversion, and category normalization.
6. Added error handling and rollback behavior around bank connection and sync.
7. Built the dashboard data contract, statistic cards, recent transactions, category breakdown, connected accounts, sidebar, loading state, and dark-theme polish.
8. Added timezone-aware monthly/today calculations with Luxon and database RPC totals.
9. Added dashboard-wide sync, sync result notifications, and Plaid connection-repair mode.
10. Built the transaction-history route, typed query mapping, date grouping, summary statistics, empty state, and URL filters.
11. Started the Accounts feature by adding its types, Supabase query, institution grouping, error handling, and an initial UI draft.

## 12. Current limitations and next work

These are the clearest items for a partner to know before continuing:

- The Accounts feature is unfinished: wire `getAccountPageData()` into `AccountPageClient` and replace the hard-coded example institutions/accounts with real mapped data.
- The sidebar's Reports and Settings links are placeholders (`#`); Accounts navigation also needs review.
- Transaction search and “View older activity” are presentation-only.
- The transaction route currently caps results at 50 and filters that set in application code rather than applying all filters/pagination in the database.
- The exchange route currently prevents more than one Plaid item per user, although the rest of the data model and sync-all endpoint can represent multiple items.
- Signup's callback URL is hard-coded to localhost and must become environment-aware before deployment.
- Root metadata still says “Create Next App” and should be updated to the product name and description.
- Both Sonner and React Toastify are present; feedback could eventually be standardized on one system.
- There is no checked-in SQL schema/migration folder, so a new collaborator needs the Supabase project schema, RLS policies, unique constraints, and RPC definitions separately.
- The repository does not currently define automated unit/integration test scripts.
- The project includes temporary/manual test artifacts and an older `spec.md`; this document describes the current live implementation more accurately.

## 13. Suggested next milestone

The most natural next milestone is to finish the Accounts page end to end:

1. Render `AccountPageClient` from `/accounts` using the real grouped institution data.
2. Replace mock health, balance, count, and last-sync values.
3. Reuse the existing Plaid repair workflow for institutions needing an update.
4. Link account rows to filtered transactions.
5. Add the Accounts route to the sidebar and verify empty/error/loading states.

After that, production readiness should focus on environment-aware callback URLs, checked-in database migrations/RLS documentation, transaction pagination/search, metadata, and automated tests.
