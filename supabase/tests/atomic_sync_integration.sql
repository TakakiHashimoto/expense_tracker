-- BankOS Phase 3.1: isolated PostgreSQL integration tests.
-- Target ONLY the dedicated container: supabase_db_bankos_migration_test.
-- Entire suite runs inside a transaction and ends with ROLLBACK.
-- Requires the base schema, lease migration, and commit_plaid_sync migration.
\set ON_ERROR_STOP on
\echo 'BankOS Phase 3.1 integration tests: starting (all fixture changes will roll back)'

BEGIN;

DO $bankos_test$
DECLARE
  v_user uuid := gen_random_uuid();
  v_item uuid := gen_random_uuid();
  v_account uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_new_token uuid := gen_random_uuid();
  v_txid text := 'bankos-test-tx-' || replace(gen_random_uuid()::text, '-', '');
  v_txid_rollback text := 'bankos-rollback-tx-' || replace(gen_random_uuid()::text, '-', '');
  v_txid_bad text := 'bankos-invalid-tx-' || replace(gen_random_uuid()::text, '-', '');
  v_base jsonb;
  v_modified jsonb;
  v_probe jsonb;
  v_invalid jsonb;
  v_manual_category_id uuid;
  v_row_count integer;
  v_amount numeric;
  v_source text;
  v_category_id uuid;
  v_cursor text;
  v_removed boolean;
  v_seen_expected_error boolean;
BEGIN
  -- A fresh isolated DB should contain no pre-existing user/banking data.
  IF EXISTS (SELECT 1 FROM auth.users)
    OR EXISTS (SELECT 1 FROM public.plaid_items)
    OR EXISTS (SELECT 1 FROM public.accounts)
    OR EXISTS (SELECT 1 FROM public.categories)
    OR EXISTS (SELECT 1 FROM public.transactions)
  THEN
    RAISE EXCEPTION 'Safety check failed: expected an EMPTY isolated test database';
  END IF;

  -- All of these fixtures are automatically discarded at the final ROLLBACK.
  INSERT INTO auth.users
    (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
  VALUES
    (v_user, '00000000-0000-0000-0000-000000000000'::uuid,
     'authenticated', 'authenticated',
     'bankos-' || replace(v_user::text, '-', '') || '@example.invalid',
     '', clock_timestamp(), clock_timestamp());

  INSERT INTO public.plaid_items
    (id, user_id, plaid_item_id, status, transactions_cursor,
     sync_lock_token, sync_lock_expires_at)
  VALUES
    (v_item, v_user, 'fixture-item-' || v_item::text, 'active', 'cursor-0',
     v_token, clock_timestamp() + interval '10 minutes');

  INSERT INTO public.accounts
    (id, user_id, type, name, currency, plaid_item_id, plaid_account_id)
  VALUES
    (v_account, v_user, 'depository', 'Fixture Checking', 'CAD',
     v_item, 'fixture-plaid-account');

  v_base := jsonb_build_object(
    'transaction_id', v_txid,
    'account_id', 'fixture-plaid-account',
    'amount', -15.99,
    'category_kind', 'expense',
    'category_name', 'Subscriptions',
    'merchant', 'Netflix',
    'pending', false,
    'posted_date', '2026-11-01',
    'posted_datetime', NULL,
    'authorized_date', NULL,
    'authorized_datetime', NULL,
    'payment_channel', 'online',
    'raw_category', jsonb_build_object('primary', 'ENTERTAINMENT'),
    'name', 'NETFLIX.COM',
    'location', jsonb_build_object('country', 'CA')
  );

  -- TEST 1: one valid sync must atomically insert category/transaction and advance cursor.
  PERFORM public.commit_plaid_sync(
    v_user, v_item, v_token, 'cursor-0', 'cursor-1',
    jsonb_build_array(v_base), '[]'::jsonb, '[]'::jsonb);

  SELECT COUNT(*) INTO v_row_count
  FROM public.transactions
  WHERE user_id = v_user AND plaid_item_id = v_item AND plaid_transaction_id = v_txid;

  SELECT amount, category_source, category_id
  INTO v_amount, v_source, v_category_id
  FROM public.transactions
  WHERE user_id = v_user AND plaid_item_id = v_item AND plaid_transaction_id = v_txid;

  SELECT transactions_cursor INTO v_cursor
  FROM public.plaid_items WHERE id = v_item;

  IF v_row_count <> 1 OR v_amount <> -15.99 OR v_source <> 'auto'
     OR v_category_id IS NULL OR v_cursor IS DISTINCT FROM 'cursor-1' THEN
    RAISE EXCEPTION 'FAIL 1: normal insertion or cursor update';
  END IF;
  RAISE NOTICE 'PASS 1: category + transaction + cursor committed together';

  -- TEST 2: manual category must remain manual when a modified sync is applied.
  INSERT INTO public.categories (user_id, kind, name)
  VALUES (v_user, 'expense', 'My Manual Category')
  RETURNING id INTO v_manual_category_id;

  UPDATE public.transactions
     SET category_id = v_manual_category_id, category_source = 'manual'
   WHERE plaid_item_id = v_item AND plaid_transaction_id = v_txid;

  v_modified := v_base || jsonb_build_object('amount', -18.50, 'category_name', 'Entertainment');
  PERFORM public.commit_plaid_sync(
    v_user, v_item, v_token, 'cursor-1', 'cursor-2',
    '[]'::jsonb, jsonb_build_array(v_modified), '[]'::jsonb);

  SELECT amount, category_source, category_id
  INTO v_amount, v_source, v_category_id
  FROM public.transactions
  WHERE plaid_item_id = v_item AND plaid_transaction_id = v_txid;

  IF v_amount <> -18.50 OR v_source <> 'manual'
     OR v_category_id IS DISTINCT FROM v_manual_category_id THEN
    RAISE EXCEPTION 'FAIL 2: manually selected category was overwritten';
  END IF;
  RAISE NOTICE 'PASS 2: modified amount; manual category preserved';

  -- TEST 3: replay of same provider transaction must upsert, not create a duplicate.
  PERFORM public.commit_plaid_sync(
    v_user, v_item, v_token, 'cursor-2', 'cursor-3',
    jsonb_build_array(v_base), '[]'::jsonb, '[]'::jsonb);

  SELECT COUNT(*) INTO v_row_count
  FROM public.transactions
  WHERE plaid_item_id = v_item AND plaid_transaction_id = v_txid;

  SELECT category_source, category_id INTO v_source, v_category_id
  FROM public.transactions
  WHERE plaid_item_id = v_item AND plaid_transaction_id = v_txid;

  IF v_row_count <> 1 OR v_source <> 'manual'
     OR v_category_id IS DISTINCT FROM v_manual_category_id THEN
    RAISE EXCEPTION 'FAIL 3: replay introduced duplicates or reset manual category';
  END IF;
  RAISE NOTICE 'PASS 3: replay-safe upsert and manual category protection';

  -- TEST 4: removed provider transaction becomes soft-deleted.
  PERFORM public.commit_plaid_sync(
    v_user, v_item, v_token, 'cursor-3', 'cursor-4',
    '[]'::jsonb, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('transaction_id', v_txid)));

  SELECT is_removed INTO v_removed FROM public.transactions
   WHERE plaid_item_id = v_item AND plaid_transaction_id = v_txid;
  IF v_removed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL 4: removed transaction was not soft deleted';
  END IF;
  RAISE NOTICE 'PASS 4: removed transaction is soft deleted';

  -- TEST 5: later replay reactivates the same transaction row.
  PERFORM public.commit_plaid_sync(
    v_user, v_item, v_token, 'cursor-4', 'cursor-5',
    jsonb_build_array(v_base), '[]'::jsonb, '[]'::jsonb);

  SELECT is_removed, category_source, category_id
  INTO v_removed, v_source, v_category_id
  FROM public.transactions
  WHERE plaid_item_id = v_item AND plaid_transaction_id = v_txid;
  IF v_removed IS DISTINCT FROM false OR v_source <> 'manual'
     OR v_category_id IS DISTINCT FROM v_manual_category_id THEN
    RAISE EXCEPTION 'FAIL 5: replay did not reactivate existing transaction safely';
  END IF;
  RAISE NOTICE 'PASS 5: replay restores soft-deleted transaction safely';

  -- TEST 6: first row valid, second row has a missing account. All changes must roll back.
  v_probe := v_base || jsonb_build_object(
    'transaction_id', v_txid_rollback, 'category_name', 'Rollback Probe');
  v_invalid := v_base || jsonb_build_object(
    'transaction_id', v_txid_bad, 'account_id', 'account-does-not-exist');

  v_seen_expected_error := false;
  BEGIN
    PERFORM public.commit_plaid_sync(
      v_user, v_item, v_token, 'cursor-5', 'cursor-should-not-save',
      jsonb_build_array(v_probe, v_invalid), '[]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Plaid account not found%' THEN
      v_seen_expected_error := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_seen_expected_error THEN
    RAISE EXCEPTION 'FAIL 6: invalid account should have raised';
  END IF;
  IF EXISTS (SELECT 1 FROM public.transactions WHERE plaid_transaction_id = v_txid_rollback)
    OR EXISTS (SELECT 1 FROM public.categories WHERE user_id = v_user AND name = 'Rollback Probe')
    OR (SELECT transactions_cursor FROM public.plaid_items WHERE id = v_item) IS DISTINCT FROM 'cursor-5'
  THEN
    RAISE EXCEPTION 'FAIL 6: partial insert or cursor advance survived failure';
  END IF;
  RAISE NOTICE 'PASS 6: mid-batch error rolls back inserts, category, and cursor';

  -- TEST 7: wrong worker's lease token must be rejected.
  v_seen_expected_error := false;
  BEGIN
    PERFORM public.commit_plaid_sync(
      v_user, v_item, v_new_token, 'cursor-5', 'cursor-bad-token',
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Sync lease is no longer valid%' THEN
      v_seen_expected_error := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_seen_expected_error THEN
    RAISE EXCEPTION 'FAIL 7: wrong token was accepted';
  END IF;
  RAISE NOTICE 'PASS 7: incorrect lease token rejected';

  -- TEST 8: an expired lease token must be rejected.
  UPDATE public.plaid_items
     SET sync_lock_expires_at = clock_timestamp() - interval '1 minute'
   WHERE id = v_item;

  v_seen_expected_error := false;
  BEGIN
    PERFORM public.commit_plaid_sync(
      v_user, v_item, v_token, 'cursor-5', 'cursor-expired',
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Sync lease is no longer valid%' THEN
      v_seen_expected_error := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_seen_expected_error THEN
    RAISE EXCEPTION 'FAIL 8: expired token was accepted';
  END IF;
  RAISE NOTICE 'PASS 8: expired lease rejected';

  -- TEST 9: stale worker cannot commit after another worker replaces the lease.
  UPDATE public.plaid_items
     SET sync_lock_token = v_new_token,
         sync_lock_expires_at = clock_timestamp() + interval '10 minutes'
   WHERE id = v_item;

  v_seen_expected_error := false;
  BEGIN
    PERFORM public.commit_plaid_sync(
      v_user, v_item, v_token, 'cursor-5', 'cursor-stale',
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Sync lease is no longer valid%' THEN
      v_seen_expected_error := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_seen_expected_error THEN
    RAISE EXCEPTION 'FAIL 9: stale worker was accepted';
  END IF;

  -- The current worker still can commit.
  PERFORM public.commit_plaid_sync(
    v_user, v_item, v_new_token, 'cursor-5', 'cursor-6',
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
  IF (SELECT transactions_cursor FROM public.plaid_items WHERE id = v_item)
     IS DISTINCT FROM 'cursor-6' THEN
    RAISE EXCEPTION 'FAIL 9: current worker could not advance cursor';
  END IF;
  RAISE NOTICE 'PASS 9: stale worker rejected; current worker succeeds';

  -- TEST 10: even valid token cannot commit on an old expected cursor.
  v_seen_expected_error := false;
  BEGIN
    PERFORM public.commit_plaid_sync(
      v_user, v_item, v_new_token, 'cursor-5', 'cursor-regressed',
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Sync cursor changed%' THEN
      v_seen_expected_error := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_seen_expected_error THEN
    RAISE EXCEPTION 'FAIL 10: outdated cursor was accepted';
  END IF;
  RAISE NOTICE 'PASS 10: expected cursor mismatch rejected';

  -- TEST 11: revoked items cannot be reactivated by a sync commit.
  UPDATE public.plaid_items SET status = 'revoked' WHERE id = v_item;
  v_seen_expected_error := false;
  BEGIN
    PERFORM public.commit_plaid_sync(
      v_user, v_item, v_new_token, 'cursor-6', 'cursor-revoked',
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Cannot sync a revoked Plaid Item%' THEN
      v_seen_expected_error := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_seen_expected_error THEN
    RAISE EXCEPTION 'FAIL 11: revoked item was reactivated';
  END IF;
  RAISE NOTICE 'PASS 11: revoked item rejected';

  RAISE NOTICE 'ALL 11 SQL RPC TESTS PASSED — testing transaction now rolls back';
END;
$bankos_test$;

ROLLBACK;
\echo 'ROLLBACK complete. All inserted test fixtures discarded.'

-- Expected: every count is still zero.
SELECT 'auth.users' AS table_name, COUNT(*) AS remaining_rows FROM auth.users
UNION ALL SELECT 'plaid_items', COUNT(*) FROM public.plaid_items
UNION ALL SELECT 'accounts', COUNT(*) FROM public.accounts
UNION ALL SELECT 'categories', COUNT(*) FROM public.categories
UNION ALL SELECT 'transactions', COUNT(*) FROM public.transactions;
