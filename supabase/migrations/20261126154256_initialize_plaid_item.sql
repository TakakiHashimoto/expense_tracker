CREATE FUNCTION public.initialize_plaid_item(
  p_user_id uuid,
  p_plaid_item_id text,
  p_access_token text,
  p_institution_id text,
  p_institution_name text,
  p_accounts jsonb,
  p_snapshot_time timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_item_id uuid;
  v_lease_token uuid := gen_random_uuid();
  v_committed boolean;
BEGIN

  -- 1. Validate arguments

  IF p_user_id IS NULL
    OR p_plaid_item_id IS NULL
    OR btrim(p_plaid_item_id) = ''
    OR p_access_token IS NULL
    OR btrim(p_access_token) = ''
    OR p_snapshot_time IS NULL
  THEN
    RAISE EXCEPTION 'Invalid Plaid initialization arguments';
  END IF;

  -- 2. Create the Item with its initial lease

  INSERT INTO public.plaid_items (
    user_id,
    plaid_item_id,
    institution_id,
    institution_name,
    transactions_cursor,
    status,
    last_sync_status,
    last_sync_error,
    sync_lock_token,
    sync_lock_expires_at
  )
  VALUES (
    p_user_id,
    p_plaid_item_id,
    p_institution_id,
    p_institution_name,
    NULL,
    'active',
    'never_synced',
    NULL,
    v_lease_token,
    clock_timestamp() + interval '5 minutes'
  )
  ON CONFLICT (plaid_item_id) DO NOTHING
  RETURNING id INTO v_item_id;

  -- 3. Handle an existing connection safely

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.plaid_items AS i
      WHERE i.plaid_item_id = p_plaid_item_id
        AND i.user_id = p_user_id
        AND i.status <> 'revoked'
        AND EXISTS (
          SELECT 1
          FROM public.plaid_item_secrets AS s
          WHERE s.plaid_item_id = i.id
        )
        AND EXISTS (
          SELECT 1
          FROM public.accounts AS a
          WHERE a.plaid_item_id = i.id
            AND a.user_id = p_user_id
            AND a.plaid_account_id IS NOT NULL
        )
    ) THEN
      RETURN jsonb_build_object(
        'status', 'already_connected'
      );
    END IF;

    RAISE EXCEPTION 'Plaid connection cannot be initialized';
  END IF;

  -- 4. Store the access token

  INSERT INTO public.plaid_item_secrets (
    plaid_item_id,
    access_token
  )
  VALUES (
    v_item_id,
    p_access_token
  );

  -- 5. Reuse existing fenced account persistence

  v_committed := public.commit_plaid_accounts(
    p_user_id,
    v_item_id,
    v_lease_token,
    NULL,
    p_accounts,
    p_snapshot_time
  );

  IF v_committed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Initial account commit rejected';
  END IF;

  -- 6. Release the initial lease

  UPDATE public.plaid_items
  SET
    sync_lock_token = NULL,
    sync_lock_expires_at = NULL
  WHERE id = v_item_id
    AND user_id = p_user_id
    AND sync_lock_token = v_lease_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Initial lease release failed';
  END IF;

  -- 7. Return the initialized Item UUID

  RETURN jsonb_build_object(
    'status', 'created',
    'item_id', v_item_id
  );

END;
$$;

REVOKE ALL ON FUNCTION public.initialize_plaid_item(
  uuid, text, text, text, text, jsonb, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.initialize_plaid_item(
  uuid, text, text, text, text, jsonb, timestamptz
) TO service_role;