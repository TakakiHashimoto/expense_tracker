-- Local only: docker exec -i supabase_db_expense_tracker psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres < this file
-- All helpers and synthetic fixtures roll back, including on psql failure.
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF; END $$;
CREATE TEMP TABLE fixture AS SELECT gen_random_uuid() u, gen_random_uuid() other_u,
 gen_random_uuid() item,gen_random_uuid() other_item,gen_random_uuid() account,
 gen_random_uuid() other_account,gen_random_uuid() token,gen_random_uuid() manual,
 gen_random_uuid() foreign_category, 'p32-posted-'||gen_random_uuid()::text prefix;
INSERT INTO auth.users(id,email) SELECT u,prefix||'@example.invalid' FROM fixture
 UNION ALL SELECT other_u,prefix||'-other@example.invalid' FROM fixture;
INSERT INTO public.plaid_items(id,user_id,plaid_item_id,sync_lock_token,sync_lock_expires_at)
 SELECT item,u,prefix,token,clock_timestamp()+interval '10 minutes' FROM fixture
 UNION ALL SELECT other_item,other_u,prefix||'-other',token,clock_timestamp()+interval '10 minutes' FROM fixture;
INSERT INTO public.accounts(id,user_id,plaid_item_id,plaid_account_id,type,name)
 SELECT account,u,item,'account','depository','Synthetic' FROM fixture
 UNION ALL SELECT other_account,other_u,other_item,'other-account','depository','Synthetic' FROM fixture;
INSERT INTO public.categories(id,user_id,kind,name)
 SELECT manual,u,'expense','Manual' FROM fixture UNION ALL SELECT foreign_category,other_u,'expense','Foreign' FROM fixture;

CREATE FUNCTION pg_temp.tx(id text, pending boolean DEFAULT false, ref text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('transaction_id',prefix||id,'account_id','account','amount',CASE WHEN pending THEN -50 ELSE -52 END,
 'pending',pending,'pending_transaction_id',CASE WHEN ref IS NULL THEN NULL ELSE prefix||ref END,
 'posted_date','2026-11-01','posted_datetime','2026-11-01T12:00:00Z','authorized_date','2026-10-31',
 'authorized_datetime','2026-10-31T12:00:00Z','payment_channel','online','raw_category',jsonb_build_object('primary','GENERAL_MERCHANDISE'),
 'location',jsonb_build_object('city','Synthetic City'),'merchant','Posted merchant','name','Provider name','category_kind','expense','category_name','Auto') FROM fixture;
$$;
CREATE FUNCTION pg_temp.sync(a jsonb DEFAULT '[]', m jsonb DEFAULT '[]', r jsonb DEFAULT '[]') RETURNS void LANGUAGE plpgsql AS $$
DECLARE f record; c text;
BEGIN SELECT * INTO f FROM fixture; SELECT transactions_cursor INTO c FROM public.plaid_items WHERE id=f.item;
 PERFORM public.commit_plaid_sync(f.u,f.item,f.token,c,'next-'||gen_random_uuid(),a,m,r); END $$;
CREATE FUNCTION pg_temp.state() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('items',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.plaid_items t WHERE user_id IN (f.u,f.other_u)),
 'transactions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transactions t WHERE user_id IN (f.u,f.other_u)),
 'categories',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.categories t WHERE user_id IN (f.u,f.other_u))) FROM fixture f;
$$;
CREATE FUNCTION pg_temp.reject(a jsonb, message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE before jsonb:=pg_temp.state();
BEGIN
 BEGIN PERFORM pg_temp.sync(a); RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Unexpected acceptance';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> message THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(pg_temp.state()=before,'exact rollback: '||message);
END $$;

SELECT pg_temp.assert(NOT has_function_privilege('anon','public.commit_plaid_sync(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.commit_plaid_sync(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)','EXECUTE')
 AND has_function_privilege('service_role','public.commit_plaid_sync(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)','EXECUTE'),'RPC ACL');
SELECT pg_temp.assert(NOT has_column_privilege('authenticated','public.transactions','plaid_pending_transaction_id','UPDATE')
 AND NOT has_column_privilege('authenticated','public.transactions','plaid_pending_reconciled_at','UPDATE')
 AND NOT has_column_privilege('authenticated','public.transactions','amount','UPDATE')
 AND has_column_privilege('authenticated','public.transactions','category_id','UPDATE'),'column ACL');
SELECT pg_temp.assert(NOT prosecdef AND provolatile='v' AND proconfig=ARRAY['search_path=""']
 AND NOT EXISTS(SELECT FROM aclexplode(proacl) WHERE grantee=0 AND privilege_type='EXECUTE'), 'function attributes/public ACL')
 FROM pg_proc WHERE oid='public.commit_plaid_sync(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)'::regprocedure;
SELECT pg_temp.assert(relrowsecurity,'RLS') FROM pg_class WHERE oid='public.transactions'::regclass;

-- Normal transition, including removal before posted arrival and metadata read.
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('pending',true)));
UPDATE public.transactions SET category_id=f.manual,category_source='manual',note='Keep this note' FROM fixture f WHERE plaid_transaction_id=f.prefix||'pending';
SELECT pg_temp.sync(r=>jsonb_build_array(jsonb_build_object('transaction_id',prefix||'pending'))) FROM fixture;
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('posted',false,'pending')));
SELECT pg_temp.assert(t.category_id=f.manual AND t.category_source='manual' AND t.note='Keep this note'
 AND t.plaid_pending_transaction_id=f.prefix||'pending' AND t.plaid_pending_reconciled_at IS NOT NULL
 AND t.amount=-52 AND t.posted_date='2026-11-01' AND t.posted_datetime='2026-11-01T12:00:00Z'
 AND t.authorized_date='2026-10-31' AND t.authorized_datetime='2026-10-31T12:00:00Z'
 AND t.payment_channel='online' AND t.raw_category->>'primary'='GENERAL_MERCHANDISE'
 AND t.location->>'city'='Synthetic City' AND t.merchant='Posted merchant' AND t.name='Provider name','normal posted state')
 FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'posted';
SELECT pg_temp.assert(count(*)=1 AND sum(amount)=-52,'one active logical total') FROM public.transactions t,fixture f WHERE t.user_id=f.u AND NOT t.is_removed;
SELECT set_config('request.jwt.claim.sub',u::text,true) FROM fixture;
SELECT pg_temp.assert(expense=52 AND net=-52 AND income=0,'actual monthly summary') FROM public.get_monthly_transaction_summary('2026-11-01','2026-12-01');

-- Replay, old clients, NULL, deletion, reactivation and cleared notes.
UPDATE public.transactions SET note=NULL FROM fixture f WHERE plaid_transaction_id=f.prefix||'posted';
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('pending',true),pg_temp.tx('posted',false,'pending')));
SELECT pg_temp.sync(m=>jsonb_build_array(pg_temp.tx('posted')-'pending_transaction_id'));
SELECT pg_temp.sync(m=>jsonb_build_array(pg_temp.tx('posted')));
SELECT pg_temp.assert(t.note IS NULL AND t.category_id=f.manual AND t.plaid_pending_transaction_id=f.prefix||'pending','manual/reference/cleared note preserved') FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'posted';
SELECT pg_temp.sync(r=>jsonb_build_array(jsonb_build_object('transaction_id',prefix||'posted'))) FROM fixture;
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('pending',true)));
SELECT pg_temp.assert(bool_and(is_removed),'removed successor still supersedes pending') FROM public.transactions t,fixture f WHERE t.user_id=f.u;
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('posted')));
SELECT pg_temp.assert(count(*)=1 AND sum(amount)=-52,'posted reactivation') FROM public.transactions t,fixture f WHERE t.user_id=f.u AND NOT is_removed;
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('ordinary')));
SELECT pg_temp.sync(r=>jsonb_build_array(jsonb_build_object('transaction_id',prefix||'ordinary'))) FROM fixture;
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('ordinary')));
SELECT pg_temp.assert(NOT is_removed,'ordinary reactivation') FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'ordinary';

-- Different arrival orders, same batch, different arrays, duplicate ID.
DO $$ DECLARE n int; p jsonb; s jsonb;
BEGIN FOR n IN 1..5 LOOP
 p:=pg_temp.tx('order-p-'||n,true); s:=pg_temp.tx('order-s-'||n,false,'order-p-'||n);
 CASE n WHEN 1 THEN PERFORM pg_temp.sync(jsonb_build_array(p,s));
 WHEN 2 THEN PERFORM pg_temp.sync(jsonb_build_array(s,p));
 WHEN 3 THEN PERFORM pg_temp.sync(jsonb_build_array(s),jsonb_build_array(p));
 WHEN 4 THEN PERFORM pg_temp.sync(jsonb_build_array(s)); PERFORM pg_temp.sync(jsonb_build_array(p));
 WHEN 5 THEN PERFORM pg_temp.sync(jsonb_build_array(p,s),jsonb_build_array(s)); END CASE;
 PERFORM pg_temp.assert((SELECT count(*)=1 AND sum(amount)=-52 FROM public.transactions WHERE plaid_transaction_id IN(p->>'transaction_id',s->>'transaction_id') AND NOT is_removed),'order '||n);
 END LOOP; END $$;

-- Added posted + removed pending in one atomic batch, including manual metadata.
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('same-p',true)));
UPDATE public.transactions t SET category_id=f.manual,category_source='manual' FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'same-p';
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('same-s',false,'same-p')),r=>jsonb_build_array(jsonb_build_object('transaction_id',prefix||'same-p'))) FROM fixture;
SELECT pg_temp.assert(count(*)=1 AND sum(amount)=-52 AND bool_and(category_id=f.manual),'same-batch posted addition/pending removal') FROM public.transactions t,fixture f WHERE t.plaid_transaction_id IN(f.prefix||'same-p',f.prefix||'same-s') AND NOT is_removed;

-- Explicit manual NULL, posted manual wins, automatic pending never wins.
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('null-p',true),pg_temp.tx('winner-p',true),pg_temp.tx('winner-s'),pg_temp.tx('auto-p',true)));
UPDATE public.transactions t SET category_id=NULL,category_source='manual' FROM fixture f WHERE t.plaid_transaction_id IN(f.prefix||'null-p',f.prefix||'winner-s');
UPDATE public.transactions t SET category_id=f.manual,category_source='manual',note='Older note' FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'winner-p';
UPDATE public.transactions t SET note='Posted note' FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'winner-s';
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('null-s',false,'null-p'),pg_temp.tx('winner-s',false,'winner-p'),pg_temp.tx('auto-s',false,'auto-p')||'{"category_name":"Latest auto"}'));
SELECT pg_temp.assert(category_id IS NULL AND category_source='manual','manual NULL precedence') FROM public.transactions t,fixture f WHERE t.plaid_transaction_id IN(f.prefix||'null-s',f.prefix||'winner-s');
SELECT pg_temp.assert(note='Posted note','posted note wins') FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'winner-s';
SELECT pg_temp.assert(c.name='Latest auto' AND t.category_source='auto','latest posted automatic') FROM public.transactions t JOIN public.categories c ON c.id=t.category_id,fixture f WHERE t.plaid_transaction_id=f.prefix||'auto-s';
-- A distinct non-NULL posted manual choice wins; an existing NULL note stays cleared.
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('nonnull-p',true),pg_temp.tx('nonnull-s')));
UPDATE public.transactions t SET category_source='manual',category_id=f.manual,note='Older pending note' FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'nonnull-p';
UPDATE public.transactions t SET category_source='manual' FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'nonnull-s';
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('nonnull-s',false,'nonnull-p')));
SELECT pg_temp.assert(t.category_id<>f.manual AND t.category_source='manual' AND t.note IS NULL,'distinct posted manual and existing cleared note win') FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'nonnull-s';

-- A preexisting NULL note cannot be distinguished from an intentional clear.
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('late-s',false,'late-p')));
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('late-p',true)));
UPDATE public.transactions t SET note='Late note' FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'late-p';
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('late-p',true)));
SELECT pg_temp.assert(note IS NULL,'late note is not resurrected') FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'late-s';

-- Invalid shapes and known relationship conflicts: P0001, exact rollback.
DO $$ DECLARE bad jsonb; BEGIN
 FOR bad IN SELECT value FROM jsonb_array_elements('[""," ","\t\n",1,true,[],{}]'::jsonb) LOOP
 PERFORM pg_temp.reject(jsonb_build_array(pg_temp.tx('bad')||jsonb_build_object('pending_transaction_id',bad)),'Invalid pending transaction reference'); END LOOP;
END $$;
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('self',false,'self')),'Invalid pending transaction reference');
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('bad-p',true,'pending')),'Invalid pending transaction reference');
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('posted',false,'different')),'Conflicting pending transaction reference');
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('posted',true)),'Conflicting pending transaction reference');
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('second',false,'pending')),'Ambiguous pending transaction successors');
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('missing-a',false,'missing'),pg_temp.tx('missing-b',false,'missing')),'Ambiguous pending transaction successors');
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('nonpending',false,'ordinary')),'Invalid pending transaction relationship scope or state');
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('pending',false)),'Invalid pending transaction relationship scope or state');
-- Cross-account, cross-Item and cross-user known sources.
INSERT INTO public.accounts(user_id,plaid_item_id,plaid_account_id,type,name) SELECT u,item,'second-account','depository','Synthetic' FROM fixture;
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('scope-p',true)));
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('cross-account',false,'scope-p')||'{"account_id":"second-account"}'),'Invalid pending transaction relationship scope or state');
INSERT INTO public.transactions(user_id,account_id,plaid_item_id,plaid_transaction_id,pending,amount,posted_date)
 SELECT other_u,other_account,other_item,prefix||'foreign-p',true,-50,'2026-11-01' FROM fixture;
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('cross-user',false,'foreign-p')),'Invalid pending transaction relationship scope or state');
INSERT INTO public.plaid_items(user_id,plaid_item_id) SELECT u,prefix||'-same-user-item' FROM fixture;
INSERT INTO public.accounts(user_id,plaid_item_id,plaid_account_id,type,name) SELECT f.u,i.id,'same-user-account','depository','Synthetic' FROM fixture f JOIN public.plaid_items i ON i.plaid_item_id=f.prefix||'-same-user-item';
INSERT INTO public.transactions(user_id,account_id,plaid_item_id,plaid_transaction_id,pending,amount,posted_date)
 SELECT f.u,a.id,a.plaid_item_id,f.prefix||'other-item-p',true,-50,'2026-11-01' FROM fixture f JOIN public.accounts a ON a.user_id=f.u AND a.plaid_account_id='same-user-account';
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('cross-item',false,'other-item-p')),'Invalid pending transaction relationship scope or state');
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('bad-category-p',true)));
UPDATE public.transactions t SET category_source='manual',category_id=f.foreign_category FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'bad-category-p';
SELECT pg_temp.reject(jsonb_build_array(pg_temp.tx('bad-category-s',false,'bad-category-p')),'Invalid pending manual category owner');

-- Every fence is checked before writes; include full snapshots and status.
DO $$ DECLARE f record; before jsonb; c text; n int; msg text;
BEGIN SELECT * INTO f FROM fixture;
 FOR n IN 1..6 LOOP
 SELECT transactions_cursor INTO c FROM public.plaid_items WHERE id=f.item;
 IF n=4 THEN UPDATE public.plaid_items SET sync_lock_expires_at=clock_timestamp()-interval '1 second' WHERE id=f.item; END IF;
 IF n=5 THEN UPDATE public.plaid_items SET status='revoked' WHERE id=f.item; END IF;
 before:=pg_temp.state();
 msg:=CASE n WHEN 1 THEN 'Plaid Item not found' WHEN 2 THEN 'Sync lease is no longer valid' WHEN 3 THEN 'Sync cursor changed' WHEN 4 THEN 'Sync lease is no longer valid' WHEN 5 THEN 'Cannot sync a revoked Plaid Item' WHEN 6 THEN 'Plaid Item not found' END;
 BEGIN PERFORM public.commit_plaid_sync(CASE WHEN n=1 THEN f.other_u ELSE f.u END,CASE WHEN n=6 THEN f.other_item ELSE f.item END,
 CASE WHEN n=2 THEN gen_random_uuid() ELSE f.token END,CASE WHEN n=3 THEN 'old-cursor' ELSE c END,'bad-next',jsonb_build_array(pg_temp.tx('pending',true)),'[]','[]');
 RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Fence accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>msg THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(pg_temp.state()=before,'fence snapshot '||n);
 UPDATE public.plaid_items SET status='active',sync_lock_expires_at=clock_timestamp()+interval '10 minutes' WHERE id=f.item;
 END LOOP; END $$;

-- Constraints reject whitespace provider IDs and posted-only violations directly.
DO $$ BEGIN
 BEGIN UPDATE public.transactions SET plaid_pending_transaction_id=E'\t\n' WHERE plaid_transaction_id=(SELECT prefix||'posted' FROM fixture);
 RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Constraint accepted';
 EXCEPTION WHEN check_violation THEN IF SQLERRM NOT LIKE '%transactions_pending_reference_check%' THEN RAISE; END IF; END;
END $$;
-- Fault injection at four real execution boundaries. A sequence is deliberately
-- nontransactional evidence that earlier writes occurred before rollback.
CREATE TEMP SEQUENCE fault_seen;
CREATE FUNCTION pg_temp.fault() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE stage text:=current_setting('p32.stage',true); f record;
BEGIN
 SELECT * INTO f FROM fixture;
 IF (TG_TABLE_NAME='transactions' AND NEW.plaid_transaction_id=f.prefix||'fault-s'
     AND ((stage='upsert' AND TG_OP='INSERT') OR (stage='metadata' AND TG_OP='UPDATE' AND NEW.plaid_pending_reconciled_at IS NOT NULL)))
 OR (TG_TABLE_NAME='transactions' AND NEW.plaid_transaction_id=f.prefix||'fault-p' AND stage='deactivate' AND NEW.is_removed)
 THEN
   PERFORM nextval('pg_temp.fault_seen');
   RAISE EXCEPTION USING ERRCODE='P3201',MESSAGE='Injected reconciliation failure';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION pg_temp.cursor_fault() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('p32.stage',true)='cursor' AND NEW.id=(SELECT item FROM fixture) THEN
   PERFORM pg_temp.assert((SELECT is_removed FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'fault-p'),'deactivation occurred before cursor fault');
   PERFORM pg_temp.assert((SELECT t.category_id=f.manual AND t.note='Fault note' AND t.plaid_pending_reconciled_at IS NOT NULL FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'fault-s'),'metadata occurred before cursor fault');
   PERFORM nextval('pg_temp.fault_seen');
   RAISE EXCEPTION USING ERRCODE='P3201',MESSAGE='Injected reconciliation failure';
 END IF; RETURN NEW;
END $$;
SELECT pg_temp.sync(jsonb_build_array(pg_temp.tx('fault-p',true)));
UPDATE public.transactions t SET category_id=f.manual,category_source='manual',note='Fault note' FROM fixture f WHERE t.plaid_transaction_id=f.prefix||'fault-p';
CREATE TRIGGER p32_posted_fault AFTER INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION pg_temp.fault();
CREATE TRIGGER p32_posted_cursor_fault BEFORE UPDATE ON public.plaid_items FOR EACH ROW EXECUTE FUNCTION pg_temp.cursor_fault();
DO $$ DECLARE stage text; before jsonb; seq bigint;
BEGIN FOREACH stage IN ARRAY ARRAY['upsert','metadata','deactivate','cursor'] LOOP
 PERFORM set_config('p32.stage',stage,true); before:=pg_temp.state(); seq:=nextval('pg_temp.fault_seen');
 BEGIN PERFORM pg_temp.sync(jsonb_build_array(pg_temp.tx('fault-s',false,'fault-p')||'{"category_name":"Fault new category"}'));
 RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Fault did not fire';
 EXCEPTION WHEN SQLSTATE 'P3201' THEN IF SQLERRM<>'Injected reconciliation failure' THEN RAISE; END IF; END;
 PERFORM pg_temp.assert(currval('pg_temp.fault_seen')=seq+1,'fault boundary reached '||stage);
 PERFORM pg_temp.assert(pg_temp.state()=before,'full fault rollback '||stage);
 END LOOP;
 PERFORM set_config('p32.stage','off',true);
 PERFORM pg_temp.sync(jsonb_build_array(pg_temp.tx('fault-s',false,'fault-p')));
 PERFORM pg_temp.assert((SELECT is_removed FROM public.transactions t,fixture f WHERE t.plaid_transaction_id=f.prefix||'fault-p'),'valid retry succeeds');
END $$;
DROP TRIGGER p32_posted_fault ON public.transactions;
DROP TRIGGER p32_posted_cursor_fault ON public.plaid_items;
\echo 'PASS P32-POSTED: permissions, transitions, metadata, event order, replay, totals, invalid links, isolation, fences and exact rollback'
ROLLBACK;
