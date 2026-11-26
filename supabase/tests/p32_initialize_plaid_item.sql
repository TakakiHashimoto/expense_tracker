BEGIN;

-- 1. Verify function permissions

DO $$
DECLARE
  v_function text :=
    'public.initialize_plaid_item(uuid,text,text,text,text,jsonb,timestamptz)';
BEGIN
  IF has_function_privilege('anon', v_function, 'EXECUTE')
    OR has_function_privilege('authenticated', v_function, 'EXECUTE')
    OR NOT has_function_privilege('service_role', v_function, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: initialization RPC permissions';
  END IF;

  RAISE NOTICE 'PASS: initialization RPC permissions';
END;
$$;

-- 2. Create synthetic users

CREATE TEMP TABLE p32_init_fixture
ON COMMIT DROP
AS
SELECT
  gen_random_uuid() AS owner_id,
  gen_random_uuid() AS other_id;

INSERT INTO auth.users (
  id,
  email,
  aud,
  role,
  created_at,
  updated_at
)
SELECT
  u.id,
  'p32-init-' || u.id::text || '@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
FROM p32_init_fixture AS f
CROSS JOIN LATERAL (
  VALUES (f.owner_id), (f.other_id)
) AS u(id);

GRANT SELECT ON p32_init_fixture TO service_role;

SET LOCAL ROLE service_role;

-- 3. Execute initialization tests

DO $$
DECLARE
  v_user uuid;
  v_other_user uuid;
  v_item_uuid uuid;

  v_provider_id text :=
    'p32-init-' || gen_random_uuid()::text;

  v_failed_provider_id text :=
    'p32-failed-' || gen_random_uuid()::text;

  v_failed_token text :=
    'fixture-' || gen_random_uuid()::text;

  v_result jsonb;

  v_payload jsonb := '[
    {
      "plaid_account_id": "A",
      "name": "Checking",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 1500
    }
  ]'::jsonb;

BEGIN

  SELECT owner_id, other_id
  INTO STRICT v_user, v_other_user
  FROM pg_temp.p32_init_fixture;

  -- Test 1: Successful initialization

  v_result := public.initialize_plaid_item(
    v_user,
    v_provider_id,
    'fixture-token',
    'fixture-institution',
    'Fixture Bank',
    v_payload,
    clock_timestamp()
  );

  IF (v_result->>'status') IS DISTINCT FROM 'created' THEN
    RAISE EXCEPTION 'FAIL: initialization rejected';
  END IF;

  v_item_uuid := (v_result->>'item_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plaid_items
    WHERE id = v_item_uuid
      AND user_id = v_user
      AND plaid_item_id = v_provider_id
      AND status = 'active'
      AND transactions_cursor IS NULL
      AND sync_lock_token IS NULL
      AND sync_lock_expires_at IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: Item or initial lease state';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plaid_item_secrets
    WHERE plaid_item_id = v_item_uuid
      AND access_token = 'fixture-token'
  ) THEN
    RAISE EXCEPTION 'FAIL: Secret not persisted';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE plaid_item_id = v_item_uuid
      AND user_id = v_user
      AND plaid_account_id = 'A'
      AND current_balance = 1500
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'FAIL: Account not persisted';
  END IF;

  RAISE NOTICE 'PASS: Item, Secret and Accounts initialized';

  -- Test 2: Duplicate does not overwrite existing data

  v_result := public.initialize_plaid_item(
    v_user,
    v_provider_id,
    'replacement-token',
    NULL,
    NULL,
    jsonb_set(
      v_payload,
      '{0,current_balance}',
      '9999'::jsonb
    ),
    clock_timestamp()
  );

  IF (v_result->>'status')
    IS DISTINCT FROM 'already_connected'
  THEN
    RAISE EXCEPTION 'FAIL: Duplicate response';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.plaid_item_secrets
    WHERE plaid_item_id = v_item_uuid
      AND access_token = 'fixture-token'
  ) THEN
    RAISE EXCEPTION 'FAIL: Duplicate overwrote secret';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE plaid_item_id = v_item_uuid
      AND plaid_account_id = 'A'
      AND current_balance = 1500
  ) THEN
    RAISE EXCEPTION 'FAIL: Duplicate overwrote account';
  END IF;

  RAISE NOTICE 'PASS: Duplicate preserves existing data';

  -- Test 3: Another user cannot initialize the same Item

  BEGIN
    PERFORM public.initialize_plaid_item(
      v_other_user,
      v_provider_id,
      'other-token',
      NULL,
      NULL,
      v_payload,
      clock_timestamp()
    );

    RAISE EXCEPTION 'FAIL: Cross-user duplicate accepted';

  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Plaid connection cannot be initialized' THEN
      RAISE;
    END IF;
  END;

  IF EXISTS (
    SELECT 1
    FROM public.plaid_items
    WHERE user_id = v_other_user
  ) THEN
    RAISE EXCEPTION 'FAIL: Cross-user Item created';
  END IF;

  RAISE NOTICE 'PASS: Cross-user duplicate rejected';

  -- Test 4: Account failure rolls back Item and Secret

  BEGIN
    PERFORM public.initialize_plaid_item(
      v_user,
      v_failed_provider_id,
      v_failed_token,
      NULL,
      NULL,
      jsonb_set(
        v_payload,
        '{0,current_balance}',
        '"not-a-number"'::jsonb
      ),
      clock_timestamp()
    );

    RAISE EXCEPTION 'FAIL: Invalid balance accepted';

  EXCEPTION WHEN invalid_text_representation THEN
    -- Expected: numeric conversion fails during account persistence.
    NULL;
  END;

  IF EXISTS (
    SELECT 1
    FROM public.plaid_items
    WHERE plaid_item_id = v_failed_provider_id
  ) THEN
    RAISE EXCEPTION 'FAIL: Item survived failed initialization';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.plaid_item_secrets
    WHERE access_token = v_failed_token
  ) THEN
    RAISE EXCEPTION 'FAIL: Secret survived failed initialization';
  END IF;

  IF (
    SELECT count(*)
    FROM public.accounts
    WHERE user_id = v_user
  ) <> 1 THEN
    RAISE EXCEPTION 'FAIL: Unexpected persisted accounts';
  END IF;

  RAISE NOTICE 'PASS: Failed initialization is atomic';

  -- Existing but revoked/incomplete connections must never be advertised as
  -- already_connected. Each probe rolls its fixture mutation back as well.
  FOR v_result IN SELECT to_jsonb(x) FROM unnest(ARRAY['revoked','missing_secret','missing_accounts']) AS x LOOP
    BEGIN
      CASE v_result #>> '{}'
        WHEN 'revoked' THEN
          UPDATE public.plaid_items SET status='revoked' WHERE id=v_item_uuid;
        WHEN 'missing_secret' THEN
          DELETE FROM public.plaid_item_secrets WHERE plaid_item_id=v_item_uuid;
        WHEN 'missing_accounts' THEN
          DELETE FROM public.accounts WHERE plaid_item_id=v_item_uuid;
      END CASE;
      PERFORM public.initialize_plaid_item(v_user,v_provider_id,'replacement',NULL,NULL,v_payload,clock_timestamp());
      RAISE EXCEPTION 'FAIL: Revoked/incomplete duplicate accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Plaid connection cannot be initialized' THEN RAISE; END IF;
    END;
  END LOOP;
  RAISE NOTICE 'PASS: Revoked, missing-secret and missing-accounts duplicates rejected';

  RAISE NOTICE 'ALL INITIALIZATION TESTS PASSED';

END;
$$;

RESET ROLE;

ROLLBACK;
