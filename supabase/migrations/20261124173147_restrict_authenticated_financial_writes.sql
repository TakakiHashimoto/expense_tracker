
-- P32-WRITE: Restrict authenticated financial writes

-- 1. Plaid Items
-- Users can read their own items through RLS,
-- but cannot modify Plaid-managed state.

REVOKE INSERT, UPDATE, DELETE, MAINTAIN
ON TABLE public.plaid_items
FROM authenticated;


-- 2. Accounts
-- Account snapshots are managed by trusted server operations.

REVOKE INSERT, UPDATE, DELETE, MAINTAIN
ON TABLE public.accounts
FROM authenticated;


-- 3. Transactions
-- Remove unrestricted write access.

REVOKE INSERT, UPDATE, DELETE, MAINTAIN
ON TABLE public.transactions
FROM authenticated;


-- 4. Preserve manual category editing
-- Existing Server Action updates these two columns.

GRANT UPDATE (category_id, category_source)
ON TABLE public.transactions
TO authenticated;
