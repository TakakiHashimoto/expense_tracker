CREATE FUNCTION public.commit_plaid_accounts(
  p_user_id uuid,
  p_item_id uuid,
  p_lease_token uuid,
  p_expected_cursor text,
  p_accounts jsonb,
  p_snapshot_time timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cursor text;
  v_token uuid;
  v_expiry timestamptz;
  v_item_status text;
  v_upserted_count bigint;
BEGIN

  -- 1. Validate arguments
  IF p_user_id IS NULL
   OR p_item_id IS NULL
   OR p_lease_token IS NULL
   OR p_snapshot_time IS NULL
  THEN
    RAISE EXCEPTION 'Invalid account persistence arguments';
  END IF;

  -- 2. Validate account payload
  IF jsonb_typeof(p_accounts) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Accounts payload must be an array';
  END IF;

  IF jsonb_array_length(p_accounts) = 0 THEN
    RAISE EXCEPTION 'Accounts snapshot must not be empty';
  END IF;

  IF EXISTS (
  SELECT 1
  FROM jsonb_array_elements(p_accounts) AS a(value)
  WHERE jsonb_typeof(a.value)
          IS DISTINCT FROM 'object'
     OR jsonb_typeof(a.value -> 'plaid_account_id')
          IS DISTINCT FROM 'string'
     OR NULLIF(btrim(a.value ->> 'plaid_account_id'), '') IS NULL
     OR jsonb_typeof(a.value -> 'name')
          IS DISTINCT FROM 'string'
     OR NULLIF(btrim(a.value ->> 'name'), '') IS NULL
     OR jsonb_typeof(a.value -> 'type')
          IS DISTINCT FROM 'string'
     OR NULLIF(btrim(a.value ->> 'type'), '') IS NULL
     OR jsonb_typeof(a.value -> 'currency')
          IS DISTINCT FROM 'string'
     OR NULLIF(btrim(a.value ->> 'currency'), '') IS NULL
) THEN
  RAISE EXCEPTION 'Invalid account payload';
END IF;

IF EXISTS (
  SELECT 1
  FROM jsonb_array_elements(p_accounts) AS a(value)
  GROUP BY a.value ->> 'plaid_account_id'
  HAVING COUNT(*) > 1
) THEN
  RAISE EXCEPTION 'Duplicate Plaid account IDs';
END IF;

  -- 3. Acquire row lock and validate lease
  SELECT
  i.transactions_cursor,
  i.sync_lock_token,
  i.sync_lock_expires_at,
  i.status
INTO
  v_cursor,
  v_token,
  v_expiry,
  v_item_status
FROM public.plaid_items AS i
WHERE i.id = p_item_id
  AND i.user_id = p_user_id
FOR UPDATE;

IF NOT FOUND THEN
  RETURN false;
END IF;

IF v_token IS DISTINCT FROM p_lease_token
   OR v_expiry IS NULL
   OR v_expiry <= clock_timestamp()
   OR v_cursor IS DISTINCT FROM p_expected_cursor
   OR v_item_status = 'revoked'
THEN
  RETURN false;
END IF;

  -- 4. Upsert accounts
  INSERT INTO public.accounts AS target (
  user_id,
  plaid_item_id,
  plaid_account_id,
  name,
  official_name,
  mask,
  type,
  subtype,
  currency,
  current_balance,
  available_balance,
  balance_as_of,
  is_active
)
SELECT
  p_user_id,
  p_item_id,
  a.plaid_account_id,
  a.name,
  a.official_name,
  a.mask,
  a.type,
  a.subtype,
  a.currency,
  a.current_balance,
  a.available_balance,
  p_snapshot_time,
  true
FROM jsonb_to_recordset(p_accounts) AS a(
  plaid_account_id text,
  name text,
  official_name text,
  mask text,
  type text,
  subtype text,
  currency text,
  current_balance numeric,
  available_balance numeric
)
ON CONFLICT (plaid_item_id, plaid_account_id)
DO UPDATE SET
  name = EXCLUDED.name,
  official_name = EXCLUDED.official_name,
  mask = EXCLUDED.mask,
  type = EXCLUDED.type,
  subtype = EXCLUDED.subtype,
  currency = EXCLUDED.currency,
  current_balance = EXCLUDED.current_balance,
  available_balance = EXCLUDED.available_balance,
  balance_as_of = EXCLUDED.balance_as_of,
  is_active = true
WHERE target.user_id = p_user_id;

GET DIAGNOSTICS v_upserted_count = ROW_COUNT;

IF v_upserted_count <> jsonb_array_length(p_accounts) THEN
  RAISE EXCEPTION 'Account persistence row count mismatch';
END IF;

  -- 5. Deactivate missing accounts
UPDATE public.accounts AS a
SET is_active = false
WHERE a.user_id = p_user_id
  AND a.plaid_item_id = p_item_id
  AND a.plaid_account_id IS NOT NULL
  AND a.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_accounts) AS incoming(
      plaid_account_id text
    )
    WHERE incoming.plaid_account_id = a.plaid_account_id
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_plaid_accounts(
  uuid, uuid, uuid, text, jsonb, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.commit_plaid_accounts(
  uuid, uuid, uuid, text, jsonb, timestamptz
) TO service_role;