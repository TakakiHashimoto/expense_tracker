-- 1. Add synchronization lease columns

ALTER TABLE public.plaid_items
  ADD COLUMN IF NOT EXISTS sync_lock_token uuid;

ALTER TABLE public.plaid_items
  ADD COLUMN IF NOT EXISTS sync_lock_expires_at timestamptz;

-- 2. Reproduce the monthly transaction summary RPC

CREATE OR REPLACE FUNCTION public.get_monthly_transaction_summary(
  start_date date,
  end_date date
)
RETURNS TABLE (
  income numeric,
  expense numeric,
  net numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $function$
  SELECT
    COALESCE(
      SUM(t.amount) FILTER (WHERE t.amount > 0),
      0
    ) AS income,

    COALESCE(
      SUM(ABS(t.amount)) FILTER (WHERE t.amount < 0),
      0
    ) AS expense,

    COALESCE(
      SUM(t.amount),
      0
    ) AS net

  FROM public.transactions AS t
  WHERE t.user_id = auth.uid()
    AND t.posted_date >= start_date
    AND t.posted_date < end_date
    AND t.is_removed = false;
$function$;


-- 3. Preserve verified RPC execution permissions

GRANT EXECUTE
ON FUNCTION public.get_monthly_transaction_summary(date, date)
TO authenticated, anon;
