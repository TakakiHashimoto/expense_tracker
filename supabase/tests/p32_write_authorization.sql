\set ON_ERROR_STOP on

-- P32-WRITE: Authorization regression tests
-- LOCAL DATABASE ONLY
-- All fixtures are rolled back.

BEGIN;

-- Verify the complete anonymous and authenticated
-- financial write permission contract.

DO $$
DECLARE
    target_table text;
    target_column text;
    permission text;
    expected_update boolean;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'public.plaid_items',
        'public.accounts',
        'public.transactions'
    ]
    LOOP
        -- Anonymous users must have no table privileges.
        FOREACH permission IN ARRAY ARRAY[
            'SELECT',
            'INSERT',
            'UPDATE',
            'DELETE',
            'TRUNCATE',
            'REFERENCES',
            'TRIGGER',
            'MAINTAIN'
        ]
        LOOP
            IF has_table_privilege(
                'anon', target_table, permission
            ) THEN
                RAISE EXCEPTION
                    'FAIL: anon has % on %',
                    permission, target_table;
            END IF;
        END LOOP;

        -- Authenticated users must retain read access.
        IF NOT has_table_privilege(
            'authenticated', target_table, 'SELECT'
        ) THEN
            RAISE EXCEPTION
                'FAIL: authenticated SELECT denied on %',
                target_table;
        END IF;

        -- Authenticated users must not have broad writes.
        FOREACH permission IN ARRAY ARRAY[
            'INSERT',
            'UPDATE',
            'DELETE',
            'TRUNCATE',
            'MAINTAIN'
        ]
        LOOP
            IF has_table_privilege(
                'authenticated', target_table, permission
            ) THEN
                RAISE EXCEPTION
                    'FAIL: authenticated has % on %',
                    permission, target_table;
            END IF;
        END LOOP;

        -- Verify every column, including future columns.
        FOR target_column IN
            SELECT attname::text
            FROM pg_attribute
            WHERE attrelid = target_table::regclass
              AND attnum > 0
              AND NOT attisdropped
        LOOP
            IF has_column_privilege(
                'anon', target_table, target_column, 'SELECT'
            ) OR has_column_privilege(
                'anon', target_table, target_column, 'INSERT'
            ) OR has_column_privilege(
                'anon', target_table, target_column, 'UPDATE'
            ) OR has_column_privilege(
                'anon', target_table, target_column, 'REFERENCES'
            ) THEN
                RAISE EXCEPTION
                    'FAIL: anon column access on %.%',
                    target_table, target_column;
            END IF;

            IF has_column_privilege(
                'authenticated',
                target_table,
                target_column,
                'INSERT'
            ) THEN
                RAISE EXCEPTION
                    'FAIL: authenticated column INSERT on %.%',
                    target_table, target_column;
            END IF;

            expected_update :=
                target_table = 'public.transactions'
                AND target_column IN (
                    'category_id',
                    'category_source'
                );

            IF has_column_privilege(
                'authenticated',
                target_table,
                target_column,
                'UPDATE'
            ) IS DISTINCT FROM expected_update THEN
                RAISE EXCEPTION
                    'FAIL: unexpected UPDATE permission on %.%',
                    target_table, target_column;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE
        'PASS: Complete financial access permission contract';
END $$;

-- Verify database privileges.
DO $$
BEGIN
  IF has_table_privilege(
    'authenticated', 'public.plaid_items', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'FAIL: plaid_items UPDATE allowed';
  END IF;

  IF has_table_privilege(
    'authenticated', 'public.accounts', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'FAIL: accounts UPDATE allowed';
  END IF;

  IF has_table_privilege(
    'authenticated', 'public.transactions', 'INSERT'
  ) OR has_table_privilege(
    'authenticated', 'public.transactions', 'DELETE'
  ) THEN
    RAISE EXCEPTION 'FAIL: transaction writes allowed';
  END IF;

  IF has_column_privilege(
    'authenticated', 'public.transactions', 'amount', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'FAIL: amount UPDATE allowed';
  END IF;

  IF NOT has_column_privilege(
    'authenticated', 'public.transactions', 'category_id', 'UPDATE'
  ) OR NOT has_column_privilege(
    'authenticated', 'public.transactions', 'category_source', 'UPDATE'
  ) THEN
    RAISE EXCEPTION 'FAIL: category UPDATE not allowed';
  END IF;

  RAISE NOTICE 'PASS: Database privilege restrictions';
END $$;

-- Use an existing LOCAL test user.
SELECT id::text AS owner_id
FROM auth.users
LIMIT 1 \gset

SELECT gen_random_uuid()::text AS other_id \gset

-- Create rollback-only fixtures.
INSERT INTO public.plaid_items (user_id, plaid_item_id)
VALUES (
  :'owner_id'::uuid,
  'p32-test-' || gen_random_uuid()::text
)
RETURNING id AS item_id \gset

INSERT INTO public.accounts
  (user_id, plaid_item_id, type, name, currency)
VALUES (
  :'owner_id'::uuid,
  :'item_id'::uuid,
  'depository',
  'P32 Test Account',
  'CAD'
)
RETURNING id AS account_id \gset

INSERT INTO public.categories (user_id, kind, name)
VALUES (
  :'owner_id'::uuid,
  'expense',
  'p32-test-' || gen_random_uuid()::text
)
RETURNING id AS category_id \gset

INSERT INTO public.transactions
  (user_id, account_id, plaid_item_id,
   category_id, amount, posted_date)
VALUES (
  :'owner_id'::uuid,
  :'account_id'::uuid,
  :'item_id'::uuid,
  NULL,
  -10.00,
  CURRENT_DATE
)
RETURNING id AS tx_id \gset

SELECT
  set_config('p32.item_id', :'item_id', true),
  set_config('p32.account_id', :'account_id', true),
  set_config('p32.tx_id', :'tx_id', true),
  set_config('p32.category_id', :'category_id', true);

-- Simulate an authenticated user.
SET LOCAL ROLE authenticated;

SELECT set_config(
  'request.jwt.claim.sub', :'owner_id', true
);

-- Denied operations.
DO $$
BEGIN
  BEGIN
    UPDATE public.plaid_items
    SET transactions_cursor = 'FAKE'
    WHERE false;

    RAISE EXCEPTION 'FAIL: Cursor update permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Cursor update denied';
  END;

  BEGIN
    UPDATE public.plaid_items
    SET sync_lock_token = NULL
    WHERE false;

    RAISE EXCEPTION 'FAIL: Lease update permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Lease update denied';
  END;

  BEGIN
    UPDATE public.accounts
    SET current_balance = 999999
    WHERE false;

    RAISE EXCEPTION 'FAIL: Balance update permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Balance update denied';
  END;

  BEGIN
    UPDATE public.transactions
    SET amount = 999999
    WHERE false;

    RAISE EXCEPTION 'FAIL: Amount update permitted';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Amount update denied';
  END;
END $$;

-- Owner may edit category.
DO $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.transactions
  SET
    category_id = current_setting('p32.category_id')::uuid,
    category_source = 'manual'
  WHERE id = current_setting('p32.tx_id')::uuid;

  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed <> 1 THEN
    RAISE EXCEPTION 'FAIL: Owner category update';
  END IF;

  RAISE NOTICE 'PASS: Owner category update';
END $$;

-- Another user cannot edit owner's transaction.
SELECT set_config(
  'request.jwt.claim.sub', :'other_id', true
);

DO $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.transactions
  SET category_source = 'auto'
  WHERE id = current_setting('p32.tx_id')::uuid;

  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed <> 0 THEN
    RAISE EXCEPTION 'FAIL: Cross-user modification';
  END IF;

  RAISE NOTICE 'PASS: Cross-user update denied';
END $$;

-- Trusted service role may update Plaid-managed data.
SET LOCAL ROLE service_role;

DO $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.plaid_items
  SET transactions_cursor = 'TEST_CURSOR'
  WHERE id = current_setting('p32.item_id')::uuid;

  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed <> 1 THEN
    RAISE EXCEPTION 'FAIL: Service item update';
  END IF;

  UPDATE public.accounts
  SET current_balance = 123.45
  WHERE id = current_setting('p32.account_id')::uuid;

  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed <> 1 THEN
    RAISE EXCEPTION 'FAIL: Service account update';
  END IF;

  RAISE NOTICE 'PASS: Service role writes';
END $$;

ROLLBACK;
