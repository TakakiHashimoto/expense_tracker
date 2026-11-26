BEGIN;

-- ==========================================
-- 1. Verify RPC permissions
-- ==========================================

SELECT
  rolname AS role_name,
  has_function_privilege(
    rolname,
    'public.commit_plaid_accounts(uuid,uuid,uuid,text,jsonb,timestamptz)',
    'EXECUTE'
  ) AS can_execute
FROM pg_roles
WHERE rolname IN (
  'anon',
  'authenticated',
  'service_role'
)
ORDER BY rolname;

DO $$
DECLARE
  v_function text :=
    'public.commit_plaid_accounts(uuid,uuid,uuid,text,jsonb,timestamptz)';
BEGIN
  IF has_function_privilege('anon', v_function, 'EXECUTE')
     OR has_function_privilege('authenticated', v_function, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_function, 'EXECUTE')
  THEN
    RAISE EXCEPTION 'FAIL: RPC permissions';
  END IF;

  RAISE NOTICE 'PASS: RPC permissions';
END;
$$;

-- ==========================================
-- 2. Create synthetic users
-- ==========================================

CREATE TEMP TABLE p32_fixture
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
  'p32-' || u.id::text || '@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
FROM p32_fixture AS f
CROSS JOIN LATERAL (
  VALUES (f.owner_id), (f.other_id)
) AS u(id);

GRANT SELECT ON p32_fixture TO service_role;

-- Execute subsequent tests using service_role privileges.

SET LOCAL ROLE service_role;

-- ==========================================
-- 3. Account persistence regression tests
-- ==========================================

DO $$
DECLARE
  v_user uuid;
  v_other_user uuid;

  v_item uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();

  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();

  v_snapshot_time timestamptz := clock_timestamp();

  v_result boolean;
  v_before jsonb;
  v_after jsonb;
  v_case text;

  v_payload jsonb := '[
    {
      "plaid_account_id": "A",
      "name": "Account A",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 1500
    },
    {
      "plaid_account_id": "B",
      "name": "Account B",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 2500
    },
    {
      "plaid_account_id": "D",
      "name": "Account D",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 4000
    }
  ]'::jsonb;

  v_rejected_payload jsonb := '[
    {
      "plaid_account_id": "A",
      "name": "Rejected Account A",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 9999
    }
  ]'::jsonb;

BEGIN

  SELECT owner_id, other_id
  INTO STRICT v_user, v_other_user
  FROM pg_temp.p32_fixture;

  -- ========================================
  -- Create a Plaid Item with a valid lease
  -- ========================================

  INSERT INTO public.plaid_items (
    id,
    user_id,
    plaid_item_id,
    status,
    transactions_cursor,
    sync_lock_token,
    sync_lock_expires_at
  )
  VALUES (
    v_item,
    v_user,
    'p32-' || v_item::text,
    'active',
    NULL,
    v_token,
    clock_timestamp() + interval '10 minutes'
  );

  -- ========================================
  -- Create existing accounts
  -- ========================================

  INSERT INTO public.accounts (
    id,
    user_id,
    plaid_item_id,
    plaid_account_id,
    name,
    type,
    currency,
    current_balance,
    is_active
  )
  VALUES
    (
      v_a, v_user, v_item,
      'A', 'Account A',
      'depository', 'CAD', 1000, true
    ),
    (
      v_b, v_user, v_item,
      'B', 'Account B',
      'depository', 'CAD', 2000, false
    ),
    (
      v_c, v_user, v_item,
      'C', 'Account C',
      'depository', 'CAD', 3000, true
    );

  -- ========================================
  -- Test 1: Valid account snapshot
  -- ========================================

  v_result := public.commit_plaid_accounts(
    v_user,
    v_item,
    v_token,
    NULL,
    v_payload,
    v_snapshot_time
  );

  IF v_result IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: Valid snapshot rejected';
  END IF;

  RAISE NOTICE 'PASS: Valid lease accepted';

  -- Account A: Updated, UUID preserved

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = v_a
      AND plaid_item_id = v_item
      AND plaid_account_id = 'A'
      AND current_balance = 1500
      AND balance_as_of = v_snapshot_time
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'FAIL: Account A update';
  END IF;

  RAISE NOTICE 'PASS: Account A updated, UUID preserved';

  -- Account B: Reactivated, UUID preserved

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = v_b
      AND plaid_item_id = v_item
      AND plaid_account_id = 'B'
      AND current_balance = 2500
      AND balance_as_of = v_snapshot_time
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'FAIL: Account B reactivation';
  END IF;

  RAISE NOTICE 'PASS: Account B reactivated';

  -- Account C: Missing from snapshot, deactivated

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = v_c
      AND plaid_item_id = v_item
      AND plaid_account_id = 'C'
      AND current_balance = 3000
      AND is_active = false
  ) THEN
    RAISE EXCEPTION 'FAIL: Account C deactivation';
  END IF;

  RAISE NOTICE 'PASS: Account C deactivated';

  -- Account D: Newly inserted

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE user_id = v_user
      AND plaid_item_id = v_item
      AND plaid_account_id = 'D'
      AND current_balance = 4000
      AND balance_as_of = v_snapshot_time
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'FAIL: Account D insertion';
  END IF;

  RAISE NOTICE 'PASS: Account D inserted';

  IF (
    SELECT count(*)
    FROM public.accounts
    WHERE plaid_item_id = v_item
  ) <> 4 THEN
    RAISE EXCEPTION 'FAIL: Unexpected account count';
  END IF;

  RAISE NOTICE 'PASS: Account count';

  -- ========================================
  -- Save database state before rejection tests
  -- ========================================

  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
  INTO v_before
  FROM public.accounts AS a
  WHERE a.plaid_item_id = v_item;

  -- ========================================
  -- Test 2-6: Fencing rejection
  -- ========================================

  FOREACH v_case IN ARRAY ARRAY[
    'wrong_token',
    'wrong_cursor',
    'wrong_user',
    'expired_lease',
    'revoked_item'
  ]
  LOOP

    UPDATE public.plaid_items
    SET
      sync_lock_expires_at = CASE
        WHEN v_case = 'expired_lease'
          THEN clock_timestamp() - interval '1 second'
        ELSE clock_timestamp() + interval '10 minutes'
      END,
      status = CASE
        WHEN v_case = 'revoked_item'
          THEN 'revoked'
        ELSE 'active'
      END
    WHERE id = v_item;

    v_result := public.commit_plaid_accounts(
      CASE
        WHEN v_case = 'wrong_user'
          THEN v_other_user
        ELSE v_user
      END,
      v_item,
      CASE
        WHEN v_case = 'wrong_token'
          THEN gen_random_uuid()
        ELSE v_token
      END,
      CASE
        WHEN v_case = 'wrong_cursor'
          THEN 'incorrect-cursor'
        ELSE NULL
      END,
      v_rejected_payload,
      clock_timestamp()
    );

    IF v_result IS DISTINCT FROM false THEN
      RAISE EXCEPTION 'FAIL: % was not rejected', v_case;
    END IF;

    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
    INTO v_after
    FROM public.accounts AS a
    WHERE a.plaid_item_id = v_item;

    IF v_after IS DISTINCT FROM v_before THEN
      RAISE EXCEPTION 'FAIL: % modified accounts', v_case;
    END IF;

    RAISE NOTICE
      'PASS: % rejected without modifying accounts',
      v_case;

  END LOOP;

  RAISE NOTICE 'ALL P32-ACCOUNTS BASIC TESTS PASSED';

END;
$$;

RESET ROLE;

ROLLBACK;