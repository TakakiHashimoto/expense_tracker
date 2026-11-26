
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ==========================================
-- 1. Create synthetic fixtures
-- ==========================================

CREATE TEMP TABLE p32_accounts_atomic_fixture
ON COMMIT DROP
AS
SELECT
  gen_random_uuid() AS owner_id,
  gen_random_uuid() AS other_id,
  gen_random_uuid() AS target_item,
  gen_random_uuid() AS sibling_item,
  gen_random_uuid() AS foreign_item,
  gen_random_uuid() AS target_token,
  gen_random_uuid() AS sibling_token,
  gen_random_uuid() AS foreign_token,
  gen_random_uuid() AS manual_account_id,
  true AS fault_enabled;

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
  'p32-atomic-' || u.id::text || '@example.invalid',
  'authenticated',
  'authenticated',
  now(),
  now()
FROM p32_accounts_atomic_fixture AS f
CROSS JOIN LATERAL (
  VALUES (f.owner_id), (f.other_id)
) AS u(id);

GRANT SELECT, UPDATE
ON pg_temp.p32_accounts_atomic_fixture
TO service_role;


-- ==========================================
-- 2. Create test-only fault injection trigger
-- ==========================================

CREATE FUNCTION public.p32_test_accounts_fault()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Only affect the synthetic target Item.

  IF NOT EXISTS (
    SELECT 1
    FROM pg_temp.p32_accounts_atomic_fixture AS f
    WHERE f.target_item = NEW.plaid_item_id
      AND f.owner_id = NEW.user_id
      AND f.fault_enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.plaid_account_id IS DISTINCT FROM 'C' THEN
    RETURN NEW;
  END IF;

  -- Confirm that the previous UPSERT statement
  -- has already updated Account A.

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE user_id = NEW.user_id
      AND plaid_item_id = NEW.plaid_item_id
      AND plaid_account_id = 'A'
      AND current_balance = 1500
      AND is_active = true
  ) THEN
    RAISE EXCEPTION
      'FAIL: Account A was not updated before fault';
  END IF;

  -- Confirm that Account B was reactivated.

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE user_id = NEW.user_id
      AND plaid_item_id = NEW.plaid_item_id
      AND plaid_account_id = 'B'
      AND current_balance = 2500
      AND is_active = true
  ) THEN
    RAISE EXCEPTION
      'FAIL: Account B was not reactivated before fault';
  END IF;

  -- Confirm that Account D was inserted.

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE user_id = NEW.user_id
      AND plaid_item_id = NEW.plaid_item_id
      AND plaid_account_id = 'D'
      AND current_balance = 4000
      AND is_active = true
  ) THEN
    RAISE EXCEPTION
      'FAIL: Account D was not inserted before fault';
  END IF;

  RAISE NOTICE
    'PASS: Previous UPSERT changes are visible inside the trigger';

  -- Intentionally fail only after confirming
  -- that the previous writes occurred.

  RAISE EXCEPTION USING
    ERRCODE = 'P3201',
    MESSAGE = 'P32 intentional account deactivation failure';

END;
$$;

REVOKE ALL
ON FUNCTION public.p32_test_accounts_fault()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.p32_test_accounts_fault()
TO service_role;

CREATE TRIGGER p32_test_accounts_fault_trigger
AFTER UPDATE OF is_active
ON public.accounts
FOR EACH ROW
WHEN (
  OLD.is_active IS TRUE
  AND NEW.is_active IS FALSE
)
EXECUTE FUNCTION public.p32_test_accounts_fault();


-- ==========================================
-- 3. Execute tests as service_role
-- ==========================================

SET LOCAL ROLE service_role;

DO $$
DECLARE
  f pg_temp.p32_accounts_atomic_fixture%ROWTYPE;

  v_result boolean;
  v_caught boolean;

  v_before jsonb;
  v_after jsonb;
  v_protected_before jsonb;
  v_protected_after jsonb;

  v_case record;
  v_state text;
  v_message text;

  v_snapshot_time timestamptz := clock_timestamp();

  v_payload jsonb := '[
    {
      "plaid_account_id": "A",
      "name": "Account A Updated",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 1500
    },
    {
      "plaid_account_id": "B",
      "name": "Account B Reactivated",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 2500
    },
    {
      "plaid_account_id": "D",
      "name": "Account D New",
      "type": "depository",
      "currency": "CAD",
      "current_balance": 4000
    }
  ]'::jsonb;

BEGIN

  SELECT *
  INTO STRICT f
  FROM pg_temp.p32_accounts_atomic_fixture;


  -- ========================================
  -- 4. Create Items
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
  VALUES
    (
      f.target_item,
      f.owner_id,
      'p32-atomic-' || f.target_item::text,
      'active',
      NULL,
      f.target_token,
      clock_timestamp() + interval '10 minutes'
    ),
    (
      f.sibling_item,
      f.owner_id,
      'p32-atomic-' || f.sibling_item::text,
      'active',
      NULL,
      f.sibling_token,
      clock_timestamp() + interval '10 minutes'
    ),
    (
      f.foreign_item,
      f.other_id,
      'p32-atomic-' || f.foreign_item::text,
      'active',
      NULL,
      f.foreign_token,
      clock_timestamp() + interval '10 minutes'
    );


  -- ========================================
  -- 5. Create Account fixtures
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

    -- Target Item
    (
      gen_random_uuid(), f.owner_id, f.target_item,
      'A', 'Account A Original',
      'depository', 'CAD', 1000, true
    ),
    (
      gen_random_uuid(), f.owner_id, f.target_item,
      'B', 'Account B Original',
      'depository', 'CAD', 2000, false
    ),
    (
      gen_random_uuid(), f.owner_id, f.target_item,
      'C', 'Account C Original',
      'depository', 'CAD', 3000, true
    ),

    -- Same user, different Item.
    -- Deliberately reuse Plaid Account IDs.

    (
      gen_random_uuid(), f.owner_id, f.sibling_item,
      'A', 'Sibling Account A',
      'depository', 'CAD', 7000, true
    ),
    (
      gen_random_uuid(), f.owner_id, f.sibling_item,
      'C', 'Sibling Account C',
      'depository', 'CAD', 8000, true
    ),

    -- Different user, different Item.

    (
      gen_random_uuid(), f.other_id, f.foreign_item,
      'A', 'Foreign Account A',
      'depository', 'CAD', 9000, true
    ),
    (
      gen_random_uuid(), f.other_id, f.foreign_item,
      'C', 'Foreign Account C',
      'depository', 'CAD', 10000, true
    ),

    -- Account not linked to Plaid.

    (
      f.manual_account_id, f.owner_id, NULL,
      NULL, 'Manual Account',
      'depository', 'CAD', 5000, true
    );


  -- Save the complete state of all test Accounts.

  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
  INTO v_before
  FROM public.accounts AS a
  WHERE a.user_id IN (f.owner_id, f.other_id);

  -- Save Accounts that must never be modified
  -- by a successful Target Item synchronization.

  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
  INTO v_protected_before
  FROM public.accounts AS a
  WHERE a.user_id IN (f.owner_id, f.other_id)
    AND a.plaid_item_id IS DISTINCT FROM f.target_item;


  -- ========================================
  -- 6. Atomic rollback after successful UPSERT
  -- ========================================

  v_caught := false;

  BEGIN

    v_result := public.commit_plaid_accounts(
      f.owner_id,
      f.target_item,
      f.target_token,
      NULL,
      v_payload,
      v_snapshot_time
    );

  EXCEPTION
    WHEN SQLSTATE 'P3201' THEN
      v_caught := true;
  END;

  IF NOT v_caught THEN
    RAISE EXCEPTION
      'FAIL: Expected fault was not triggered';
  END IF;

  RAISE NOTICE
    'PASS: Expected deactivation fault was caught';

  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
  INTO v_after
  FROM public.accounts AS a
  WHERE a.user_id IN (f.owner_id, f.other_id);

  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION
      'FAIL: Account changes survived rollback';
  END IF;

  RAISE NOTICE
    'PASS: All Account changes were rolled back';

  -- Disable the fault for subsequent tests.

  UPDATE pg_temp.p32_accounts_atomic_fixture
  SET fault_enabled = false;


  -- ========================================
  -- 7. Invalid payload tests
  -- ========================================

  FOR v_case IN

    SELECT *
    FROM (
      VALUES

        (
          'sql_null',
          NULL::jsonb,
          'P0001',
          'Accounts payload must be an array'
        ),
        (
          'json_null',
          'null'::jsonb,
          'P0001',
          'Accounts payload must be an array'
        ),
        (
          'empty_array',
          '[]'::jsonb,
          'P0001',
          'Accounts snapshot must not be empty'
        ),
        (
          'invalid_json_shape',
          '{}'::jsonb,
          'P0001',
          'Accounts payload must be an array'
        ),
        (
          'invalid_array_element',
          '[null]'::jsonb,
          'P0001',
          'Invalid account payload'
        ),
        (
          'missing_account_id',
          jsonb_build_array(
            (v_payload -> 0) - 'plaid_account_id'
          ),
          'P0001',
          'Invalid account payload'
        ),
        (
          'blank_account_id',
          jsonb_set(
            v_payload,
            '{0,plaid_account_id}',
            '" "'::jsonb
          ),
          'P0001',
          'Invalid account payload'
        ),
        (
          'missing_name',
          jsonb_build_array(
            (v_payload -> 0) - 'name'
          ),
          'P0001',
          'Invalid account payload'
        ),
        (
          'missing_type',
          jsonb_build_array(
            (v_payload -> 0) - 'type'
          ),
          'P0001',
          'Invalid account payload'
        ),
        (
          'missing_currency',
          jsonb_build_array(
            (v_payload -> 0) - 'currency'
          ),
          'P0001',
          'Invalid account payload'
        ),
        (
          'duplicate_account_ids',
          jsonb_build_array(
            v_payload -> 0,
            v_payload -> 0
          ),
          'P0001',
          'Duplicate Plaid account IDs'
        ),
        (
          'invalid_balance',
          jsonb_set(
            v_payload,
            '{0,current_balance}',
            '"not-a-number"'::jsonb
          ),
          '22P02',
          NULL::text
        )

    ) AS cases(
      case_name,
      payload,
      expected_state,
      expected_message
    )

  LOOP

    v_caught := false;

    BEGIN

      v_result := public.commit_plaid_accounts(
        f.owner_id,
        f.target_item,
        f.target_token,
        NULL,
        v_case.payload,
        v_snapshot_time
      );

    EXCEPTION
      WHEN OTHERS THEN

        GET STACKED DIAGNOSTICS
          v_state = RETURNED_SQLSTATE,
          v_message = MESSAGE_TEXT;

        IF v_state IS DISTINCT FROM v_case.expected_state
          OR (
            v_case.expected_message IS NOT NULL
            AND v_message IS DISTINCT FROM
                v_case.expected_message
          )
        THEN
          RAISE;
        END IF;

        v_caught := true;

    END;

    IF NOT v_caught THEN
      RAISE EXCEPTION
        'FAIL: Invalid payload was not rejected: %',
        v_case.case_name;
    END IF;

    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
    INTO v_after
    FROM public.accounts AS a
    WHERE a.user_id IN (f.owner_id, f.other_id);

    IF v_after IS DISTINCT FROM v_before THEN
      RAISE EXCEPTION
        'FAIL: Invalid payload modified Accounts: %',
        v_case.case_name;
    END IF;

    RAISE NOTICE
      'PASS: Invalid payload rejected: %',
      v_case.case_name;

  END LOOP;


  -- ========================================
  -- 8. Cross-item fencing
  -- ========================================

  -- Use the Target Item token against a
  -- different Item owned by the same user.

  v_result := public.commit_plaid_accounts(
    f.owner_id,
    f.sibling_item,
    f.target_token,
    NULL,
    v_payload,
    v_snapshot_time
  );

  IF v_result IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'FAIL: Cross-item lease was accepted';
  END IF;

  RAISE NOTICE
    'PASS: Cross-item lease rejected';


  -- ========================================
  -- 9. Cross-user isolation
  -- ========================================

  -- Even a correct Item token must not
  -- authorize a different user.

  v_result := public.commit_plaid_accounts(
    f.owner_id,
    f.foreign_item,
    f.foreign_token,
    NULL,
    v_payload,
    v_snapshot_time
  );

  IF v_result IS DISTINCT FROM false THEN
    RAISE EXCEPTION
      'FAIL: Cross-user request was accepted';
  END IF;

  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
  INTO v_after
  FROM public.accounts AS a
  WHERE a.user_id IN (f.owner_id, f.other_id);

  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION
      'FAIL: Rejected isolation requests modified Accounts';
  END IF;

  RAISE NOTICE
    'PASS: Cross-user request rejected';

  RAISE NOTICE
    'PASS: Rejected isolation requests preserved all Accounts';


  -- ========================================
  -- 10. Successful commit after injected fault
  -- ========================================

  v_result := public.commit_plaid_accounts(
    f.owner_id,
    f.target_item,
    f.target_token,
    NULL,
    v_payload,
    v_snapshot_time
  );

  IF v_result IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'FAIL: Valid snapshot rejected after fault removal';
  END IF;

  IF (
    SELECT count(*)
    FROM public.accounts
    WHERE user_id = f.owner_id
      AND plaid_item_id = f.target_item
      AND balance_as_of = v_snapshot_time
      AND is_active = true
      AND (
        (plaid_account_id = 'A' AND current_balance = 1500)
        OR
        (plaid_account_id = 'B' AND current_balance = 2500)
        OR
        (plaid_account_id = 'D' AND current_balance = 4000)
      )
  ) <> 3 THEN
    RAISE EXCEPTION
      'FAIL: Target Account UPSERT results are incorrect';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE user_id = f.owner_id
      AND plaid_item_id = f.target_item
      AND plaid_account_id = 'C'
      AND current_balance = 3000
      AND is_active = false
  ) THEN
    RAISE EXCEPTION
      'FAIL: Target Account C was not deactivated';
  END IF;

  IF (
    SELECT count(*)
    FROM public.accounts
    WHERE plaid_item_id = f.target_item
  ) <> 4 THEN
    RAISE EXCEPTION
      'FAIL: Unexpected Target Item account count';
  END IF;

  RAISE NOTICE
    'PASS: Valid snapshot succeeds after fault removal';


  -- ========================================
  -- 11. Verify successful-write isolation
  -- ========================================

  SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
  INTO v_protected_after
  FROM public.accounts AS a
  WHERE a.user_id IN (f.owner_id, f.other_id)
    AND a.plaid_item_id IS DISTINCT FROM f.target_item;

  IF v_protected_after IS DISTINCT FROM v_protected_before THEN
    RAISE EXCEPTION
      'FAIL: Successful sync modified protected Accounts';
  END IF;

  RAISE NOTICE
    'PASS: Same-user different Item preserved';

  RAISE NOTICE
    'PASS: Other-user Item preserved';

  RAISE NOTICE
    'PASS: Duplicate Account IDs across Items isolated';

  RAISE NOTICE
    'PASS: Unlinked Account preserved';

  RAISE NOTICE
    'ALL P32-ACCOUNTS ATOMICITY AND ISOLATION TESTS PASSED';

END;
$$;

RESET ROLE;

-- Remove all synthetic fixtures and test-only DDL.

ROLLBACK;
