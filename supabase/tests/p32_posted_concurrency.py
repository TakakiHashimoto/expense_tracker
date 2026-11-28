#!/usr/bin/env python3
"""Seven real PostgreSQL races; stdlib only; run from repository root."""
from concurrent.futures import ThreadPoolExecutor
import time
import uuid
from p32_posted_support import Session, Fixture, check, rejected


def main():
    sessions, fixtures = [], []
    pool = ThreadPoolExecutor(max_workers=2)
    try:
        sessions = [Session() for _ in range(3)]
        observer, holder, contender = sessions
        check(len({s.pid for s in sessions}) == 3, 'Independent sessions required')

        def blocked(waiter, owner, label):
            deadline = time.monotonic()+5
            while time.monotonic()<deadline:
                if observer.query(f"SELECT {owner.pid}=ANY(pg_blocking_pids({waiter.pid}));") == 't':
                    print('LOCK '+label, flush=True)
                    return
                time.sleep(.02)
            raise AssertionError('No observed lock: '+label)

        def fixture(posted=False):
            f = Fixture(observer); fixtures.append(f)
            observer.query(f.sync(added=[f.tx('-p',True)] + ([f.tx('-s')] if posted else [])))
            f.reset()
            return f

        def final(f, category, posted=True):
            state = f.snapshot()
            rows = {t['plaid_transaction_id']: t for t in state['transactions']}
            p = rows[f.run+'-p']
            check(p['is_removed'] is posted and p['pending'] and p['amount']==-50, 'Pending state')
            check(state['item']['transactions_cursor']==('new' if posted else 'old'), 'Cursor')
            if posted:
                s=rows[f.run+'-s']
                check(len(rows)==2 and not s['is_removed'] and not s['pending'] and s['amount']==-52
                      and s['category_source']=='manual' and s['category_id']==category
                      and s['plaid_pending_transaction_id']==f.run+'-p' and s['plaid_pending_reconciled_at'] is not None,'Posted exact metadata')
            return state

        # C01: manual edit owns the pending lock, sync must observe committed edit.
        f=fixture()
        holder.query('BEGIN;'+f.edit('-p'))
        pending=pool.submit(contender.query,f.sync(added=[f.tx('-s',ref='-p')]))
        blocked(contender,holder,'C01 pending edit before sync')
        holder.query('COMMIT;'); pending.result(5)
        final(f,f.category)
        print('PASS C01 latest manual category inherited',flush=True)

        # C02: commit has locked and removed pending; UPDATE rechecks predicate.
        f=fixture(); observer.query(f.edit('-p'))
        holder.query('BEGIN;'+f.sync(added=[f.tx('-s',ref='-p')]))
        expected=f.snapshot(holder)
        pending=pool.submit(contender.query,f.edit('-p'))
        blocked(contender,holder,'C02 late pending category edit')
        holder.query('COMMIT;')
        check(pending.result(5)=='','Late edit must return zero rows')
        check(f.snapshot()==expected,'Late edit changed committed state')
        final(f,f.category)
        print('PASS C02 zero affected rows and exact snapshot',flush=True)

        # C03: preexisting posted row edited concurrently; posted manual wins.
        f=fixture(posted=True)
        observer.query(f.edit('-p'))
        holder.query('BEGIN;'+f.edit('-s').replace("category_id='"+f.category+"'",'category_id=NULL'))
        pending=pool.submit(contender.query,f.sync(added=[f.tx('-s',ref='-p')]))
        blocked(contender,holder,'C03 posted category edit')
        holder.query('COMMIT;'); pending.result(5)
        final(f,None)
        # Opposite ordering: user edit waits, then replaces inherited category.
        holder.query('BEGIN;'+f.sync(modified=[f.tx('-s',ref='-p')],cursor='new',next_cursor='new'))
        pending=pool.submit(contender.query,f.edit('-s'))
        blocked(contender,holder,'C03 posted edit after sync')
        holder.query('COMMIT;'); check(bool(pending.result(5)),'Posted edit lost')
        final(f,f.category)
        print('PASS C03 both posted edit orderings',flush=True)

        # C04: current worker commits under new lease; stale waiter cannot replay.
        f=fixture(); observer.query(f.edit('-p')); new_token=str(uuid.uuid4())
        holder.query(f"BEGIN; UPDATE public.plaid_items SET sync_lock_token='{new_token}' WHERE id='{f.item}';"+f.sync(added=[f.tx('-s',ref='-p')],token=new_token))
        expected=f.snapshot(holder)
        pending=pool.submit(contender.query,rejected(f.sync(added=[f.tx('-p',True)]),'Sync lease is no longer valid'))
        blocked(contender,holder,'C04 stale lease')
        holder.query('COMMIT;'); check(pending.result(5)=='rejected','Stale accepted')
        check(f.snapshot()==expected,'Stale worker changed snapshot')
        print('PASS C04 stale worker cannot reconcile/reactivate',flush=True)

        # C05: two independent Items can commit while the first holds its locks.
        f=fixture(); g=fixture(); observer.query(f.edit('-p')); observer.query(g.edit('-p'))
        holder.query('BEGIN;'+f.sync(added=[f.tx('-s',ref='-p')]))
        expected=f.snapshot(holder)
        contender.query(g.sync(added=[g.tx('-s',ref='-p')]))
        final(g,g.category)
        check(f.snapshot()['item']['transactions_cursor']=='old','Uncommitted Item leaked')
        holder.query('COMMIT;'); check(f.snapshot()==expected,'Cross-Item write')
        final(f,f.category)
        print('PASS C05 concurrent independent Items isolated',flush=True)

        # C06: database clock expiry while blocked on Item, not request-start now().
        f=fixture()
        observer.query(f"UPDATE public.plaid_items SET sync_lock_expires_at=clock_timestamp()+interval '2 seconds' WHERE id='{f.item}';")
        before=f.snapshot()
        holder.query(f"BEGIN; SELECT id FROM public.plaid_items WHERE id='{f.item}' FOR UPDATE;")
        pending=pool.submit(contender.query,rejected(f.sync(added=[f.tx('-s',ref='-p')]),'Sync lease is no longer valid'))
        blocked(contender,holder,'C06 lease expiry')
        check(observer.query(f"SELECT sync_lock_expires_at>clock_timestamp() FROM public.plaid_items WHERE id='{f.item}';")=='t','Expired before wait')
        observer.query(f"SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM(sync_lock_expires_at-clock_timestamp())))+.05) FROM public.plaid_items WHERE id='{f.item}';")
        holder.query('COMMIT;'); check(pending.result(5)=='rejected','Expired accepted')
        check(f.snapshot()==before,'Expiry changed snapshot')
        print('PASS C06 expiry rechecked after Item lock',flush=True)

        # C07: a cursor trigger pauses after reconciliation using an advisory
        # lock barrier. The late category edit blocks, then sees full rollback.
        f=fixture(); before=f.snapshot(); gate=int(uuid.uuid4().hex[:7],16)
        holder.query(f"""CREATE FUNCTION pg_temp.p32_fault() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN IF NEW.id='{f.item}' THEN
            IF NOT EXISTS(SELECT FROM public.transactions WHERE plaid_transaction_id='{f.run}-p' AND is_removed)
              THEN RAISE EXCEPTION 'Expected earlier deactivation'; END IF;
            PERFORM pg_advisory_xact_lock({gate});
            RAISE EXCEPTION 'Injected cursor failure'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER p32_posted_concurrency_fault BEFORE UPDATE ON public.plaid_items FOR EACH ROW EXECUTE FUNCTION pg_temp.p32_fault();""")
        observer.query(f'SELECT pg_advisory_lock({gate});')
        failing=pool.submit(holder.query,rejected(f.sync(added=[f.tx('-s',ref='-p')]),'Injected cursor failure'))
        blocked(holder,observer,'C07 fault barrier after reconciliation')
        waiting=pool.submit(contender.query,f.edit('-p'))
        blocked(contender,holder,'C07 legitimate edit waiting')
        observer.query(f'SELECT pg_advisory_unlock({gate});')
        check(failing.result(5)=='rejected','Fault missing'); check(bool(waiting.result(5)),'Legitimate edit lost')
        holder.query('DROP TRIGGER p32_posted_concurrency_fault ON public.plaid_items; DROP FUNCTION pg_temp.p32_fault();')
        after=f.snapshot(); expected=before
        expected['transactions'][0]['category_id']=f.category
        expected['transactions'][0]['category_source']='manual'
        check(after==expected,'Fault exposed partial writes')
        final(f,f.category,False)
        print('PASS C07 full rollback observed by waiting legitimate edit',flush=True)
    finally:
        # Close lock holders before cleanup, even on failed assertions.
        for s in reversed(sessions): s.close()
        pool.shutdown(wait=True,cancel_futures=True)
        # A trigger referencing a temp function disappears with its session.
        for f in reversed(fixtures): f.cleanup()
        print('PASS cleanup: all concurrency fixtures removed',flush=True)


if __name__=='__main__': main()
