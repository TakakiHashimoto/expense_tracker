-- P32-WRITE: Remove anonymous access to financial tables.
-- Financial data requires authenticated or trusted server access.

REVOKE ALL PRIVILEGES
ON TABLE
    public.plaid_items,
    public.accounts,
    public.transactions
FROM anon;