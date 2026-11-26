CREATE FUNCTION public.record_plaid_sync_failure(
  p_user_id uuid,
  p_item_id uuid,
  p_lease_token uuid,
  p_expected_cursor text,
  p_error_code text,
  p_requires_update boolean
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
BEGIN
  -- Validate required arguments.
  IF p_user_id IS NULL
     OR p_item_id IS NULL
     OR p_lease_token IS NULL
     OR NULLIF(btrim(p_error_code), '') IS NULL
     OR p_requires_update IS NULL
  THEN
    RAISE EXCEPTION 'Invalid sync failure arguments';
  END IF;

  -- Lock the item before checking the current lease.
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

  -- Reject expired or superseded workers.
  IF v_token IS DISTINCT FROM p_lease_token
     OR v_expiry IS NULL
     OR v_expiry <= clock_timestamp()
  THEN
    RETURN false;
  END IF;

  -- Reject failures based on an outdated cursor.
  IF v_cursor IS DISTINCT FROM p_expected_cursor THEN
    RETURN false;
  END IF;

  -- Never overwrite a revoked item.
  IF v_item_status = 'revoked' THEN
    RETURN false;
  END IF;

  UPDATE public.plaid_items AS i
  SET
    last_sync_status = 'failed',
    last_sync_error = p_error_code,
    updated_at = clock_timestamp(),
    status = CASE
      WHEN p_requires_update THEN 'error'
      ELSE i.status
    END
  WHERE i.id = p_item_id
    AND i.user_id = p_user_id
    AND i.sync_lock_token = p_lease_token;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_plaid_sync_failure(
  uuid, uuid, uuid, text, text, boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_plaid_sync_failure(
  uuid, uuid, uuid, text, text, boolean
) TO service_role;