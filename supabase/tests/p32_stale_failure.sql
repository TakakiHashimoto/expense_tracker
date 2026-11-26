-- Local-only regression suite. Synthetic fixtures; every write rolls back.
-- docker exec -i supabase_db_expense_tracker psql -U postgres -d postgres -X < supabase/tests/p32_stale_failure.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION pg_temp.check_true(ok boolean, label text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
END;
$$;

DO $test$
DECLARE
  u uuid := gen_random_uuid();
  i uuid := gen_random_uuid();
  a uuid := gen_random_uuid();
  token uuid := gen_random_uuid();
  other_token uuid := gen_random_uuid();
  case_name text;
  before_item jsonb;
  before_account jsonb;
  before_tx jsonb;
  call_user uuid;
  call_item uuid;
  call_token uuid;
  call_cursor text;
  call_code text;
  call_update boolean;
  applied boolean;
  denied boolean;
  arg integer;
  fn regprocedure := 'public.record_plaid_sync_failure(uuid,uuid,uuid,text,text,boolean)'::regprocedure;
BEGIN
  INSERT INTO auth.users(id, email) VALUES (u, 'p32-stale-' || u || '@example.invalid');
  INSERT INTO public.plaid_items(id, user_id, plaid_item_id, transactions_cursor,
    sync_lock_token, sync_lock_expires_at, last_sync_status, last_sync_at)
  VALUES (i, u, 'p32-stale-' || i, 'cursor-X', token,
    clock_timestamp() + interval '5 minutes', 'succeeded', '2026-01-01Z');
  INSERT INTO public.accounts(id, user_id, plaid_item_id, plaid_account_id, type, name, current_balance)
  VALUES (a, u, i, 'synthetic-account', 'depository', 'Synthetic', 100);
  INSERT INTO public.transactions(user_id, account_id, plaid_item_id, plaid_transaction_id, amount, posted_date)
  VALUES (u, a, i, 'synthetic-transaction', -1, '2026-01-01');
  SELECT to_jsonb(x) INTO before_account FROM public.accounts x WHERE id = a;
  SELECT jsonb_agg(to_jsonb(x)) INTO before_tx FROM public.transactions x WHERE user_id = u;

  -- Ordinary and login failures change only the allowed Item fields.
  FOREACH call_update IN ARRAY ARRAY[false, true] LOOP
    SELECT to_jsonb(x) INTO before_item FROM public.plaid_items x WHERE id = i;
    EXECUTE 'SET LOCAL ROLE service_role';
    applied := public.record_plaid_sync_failure(u, i, token, 'cursor-X',
      CASE WHEN call_update THEN 'ITEM_LOGIN_REQUIRED' ELSE 'SYNC_FAILED' END, call_update);
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.check_true(applied, 'valid service_role lease');
    PERFORM pg_temp.check_true((SELECT last_sync_status = 'failed'
      AND last_sync_error = CASE WHEN call_update THEN 'ITEM_LOGIN_REQUIRED' ELSE 'SYNC_FAILED' END
      AND status = CASE WHEN call_update THEN 'error' ELSE 'active' END
      AND updated_at >= (before_item->>'updated_at')::timestamptz
      AND to_jsonb(x) - ARRAY['last_sync_status','last_sync_error','updated_at','status'] =
          before_item - ARRAY['last_sync_status','last_sync_error','updated_at','status']
      FROM public.plaid_items x WHERE id = i), 'exact permitted failure fields');
  END LOOP;
  RAISE NOTICE 'PASS: ordinary/login failure, service_role, cursor and last_sync_at preservation';

  FOREACH case_name IN ARRAY ARRAY['wrong token','no lease','null expiry','expired','replacement worker',
    'cursor mismatch','null versus nonnull cursor','revoked','wrong owner','missing item'] LOOP
    UPDATE public.plaid_items SET status = 'active', last_sync_status = 'succeeded',
      last_sync_error = NULL, transactions_cursor = 'cursor-X',
      sync_lock_token = token, sync_lock_expires_at = clock_timestamp() + interval '5 minutes'
      WHERE id = i;
    call_user := u; call_item := i; call_token := token; call_cursor := 'cursor-X';
    CASE case_name
      WHEN 'wrong token' THEN call_token := other_token;
      WHEN 'no lease' THEN UPDATE public.plaid_items SET sync_lock_token = NULL, sync_lock_expires_at = NULL WHERE id = i;
      WHEN 'null expiry' THEN UPDATE public.plaid_items SET sync_lock_expires_at = NULL WHERE id = i;
      WHEN 'expired' THEN UPDATE public.plaid_items SET sync_lock_expires_at = clock_timestamp() - interval '1 second' WHERE id = i;
      WHEN 'replacement worker' THEN UPDATE public.plaid_items SET sync_lock_token = other_token WHERE id = i;
      WHEN 'cursor mismatch' THEN call_cursor := 'older-cursor';
      WHEN 'null versus nonnull cursor' THEN call_cursor := NULL;
      WHEN 'revoked' THEN UPDATE public.plaid_items SET status = 'revoked' WHERE id = i;
      WHEN 'wrong owner' THEN call_user := gen_random_uuid();
      WHEN 'missing item' THEN call_item := gen_random_uuid();
    END CASE;
    SELECT to_jsonb(x) INTO before_item FROM public.plaid_items x WHERE id = i;
    applied := public.record_plaid_sync_failure(call_user, call_item, call_token, call_cursor, 'ITEM_LOGIN_REQUIRED', true);
    PERFORM pg_temp.check_true(NOT applied, case_name || ' rejected');
    PERFORM pg_temp.check_true((SELECT to_jsonb(x) = before_item FROM public.plaid_items x WHERE id = i), case_name || ' unchanged');
    RAISE NOTICE 'PASS: % rejected; entire Item unchanged', case_name;
  END LOOP;

  UPDATE public.plaid_items SET transactions_cursor = NULL WHERE id = i;
  PERFORM pg_temp.check_true(public.record_plaid_sync_failure(u, i, token, NULL, 'SYNC_FAILED', false), 'NULL cursor accepted');
  SELECT to_jsonb(x) INTO before_item FROM public.plaid_items x WHERE id = i;
  PERFORM pg_temp.check_true(NOT public.record_plaid_sync_failure(u, i, token, 'cursor-X', 'SYNC_FAILED', false), 'nonnull versus NULL rejected');
  PERFORM pg_temp.check_true((SELECT to_jsonb(x) = before_item FROM public.plaid_items x WHERE id = i), 'NULL cursor mismatch unchanged');
  RAISE NOTICE 'PASS: NULL cursor equality and both mismatch directions';

  PERFORM pg_temp.check_true((SELECT jsonb_agg(to_jsonb(x)) = before_tx FROM public.transactions x WHERE user_id = u), 'all failures leave transactions unchanged');
  PERFORM pg_temp.check_true((SELECT to_jsonb(x) = before_account FROM public.accounts x WHERE id = a), 'all failures leave accounts unchanged');

  -- New worker commits real transaction data, then releases its lease.
  UPDATE public.plaid_items SET sync_lock_token = other_token WHERE id = i;
  PERFORM public.commit_plaid_sync(u, i, other_token, NULL, 'cursor-new',
    '[{"transaction_id":"synthetic-transaction","account_id":"synthetic-account","amount":-2,"pending":false,"posted_date":"2026-01-01","category_kind":"expense","category_name":"Synthetic"}]', '[]', '[]');
  UPDATE public.plaid_items SET sync_lock_token = NULL, sync_lock_expires_at = NULL WHERE id = i;
  SELECT to_jsonb(x) INTO before_item FROM public.plaid_items x WHERE id = i;
  SELECT jsonb_agg(to_jsonb(x)) INTO before_tx FROM public.transactions x WHERE user_id = u;
  PERFORM pg_temp.check_true(NOT public.record_plaid_sync_failure(u, i, token, NULL, 'ITEM_LOGIN_REQUIRED', true), 'old worker after success');
  PERFORM pg_temp.check_true((SELECT to_jsonb(x) = before_item FROM public.plaid_items x WHERE id = i), 'new success unchanged');
  PERFORM pg_temp.check_true((SELECT jsonb_agg(to_jsonb(x)) = before_tx FROM public.transactions x WHERE user_id = u), 'new transaction unchanged');
  PERFORM pg_temp.check_true((SELECT to_jsonb(x) = before_account FROM public.accounts x WHERE id = a), 'account untouched');
  RAISE NOTICE 'PASS: newer commit/release preserved, financial rows unchanged';

  FOR arg IN 1..7 LOOP
    call_user := u; call_item := i; call_token := token; call_code := 'SYNC_FAILED'; call_update := false;
    CASE arg
      WHEN 1 THEN call_user := NULL;
      WHEN 2 THEN call_item := NULL;
      WHEN 3 THEN call_token := NULL;
      WHEN 4 THEN call_code := NULL;
      WHEN 5 THEN call_code := '';
      WHEN 6 THEN call_code := '   ';
      WHEN 7 THEN call_update := NULL;
    END CASE;
    denied := false;
    BEGIN
      PERFORM public.record_plaid_sync_failure(call_user, call_item, call_token, NULL, call_code, call_update);
    EXCEPTION WHEN raise_exception THEN denied := true;
    END;
    PERFORM pg_temp.check_true(denied, 'invalid argument rejected ' || arg);
    PERFORM pg_temp.check_true((SELECT to_jsonb(x) = before_item FROM public.plaid_items x WHERE id = i), 'invalid arguments unchanged');
  END LOOP;
  RAISE NOTICE 'PASS: 7 invalid arguments rejected without writes';

  FOREACH case_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    denied := false;
    EXECUTE format('SET LOCAL ROLE %I', case_name);
    BEGIN
      PERFORM public.record_plaid_sync_failure(u, i, token, NULL, 'SYNC_FAILED', false);
    EXCEPTION WHEN insufficient_privilege THEN denied := true;
    END;
    EXECUTE 'RESET ROLE';
    PERFORM pg_temp.check_true(denied, case_name || ' execution denied');
    PERFORM pg_temp.check_true(NOT has_function_privilege(case_name, fn, 'EXECUTE'), case_name || ' effective privilege absent');
    RAISE NOTICE 'PASS: % cannot execute', case_name;
  END LOOP;
  PERFORM pg_temp.check_true((SELECT NOT prosecdef AND proconfig = ARRAY['search_path=""'] FROM pg_proc WHERE oid = fn), 'invoker and empty search_path');
  PERFORM pg_temp.check_true(NOT EXISTS(SELECT FROM pg_proc p, LATERAL aclexplode(p.proacl) x WHERE p.oid = fn AND x.grantee = 0), 'PUBLIC privileges revoked');
  PERFORM pg_temp.check_true((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.plaid_items'::regclass), 'RLS preserved');
  PERFORM pg_temp.check_true(NOT has_table_privilege('authenticated', 'public.plaid_items', 'UPDATE'), 'P32-WRITE preserved');
  RAISE NOTICE 'PASS: invoker, search_path, PUBLIC ACL, RLS, P32-WRITE';
END;
$test$;
ROLLBACK;
\echo 'PASS: P32-STALE SQL regression suite; all fixtures rolled back'
