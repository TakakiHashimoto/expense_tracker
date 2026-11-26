#!/usr/bin/env python3
"""Real local-only account races. Run: python3 supabase/tests/p32_accounts_concurrency.py.

Reuses the STALE psql marker/timeout utility; no third-party dependencies.
Hard-kill leftovers are identified by the printed run ID in auth.users.email
and plaid_items.plaid_item_id (p32-accounts-concurrency-<run ID> prefix).
Only generated user UUIDs are eligible for cleanup.
"""
import json
from pathlib import Path
import runpy
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

utility = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/test-p32-stale-concurrency.py"))
Session, check = utility["Session"], utility["check"]


def main():
    run = "p32-accounts-concurrency-" + uuid.uuid4().hex
    users = [str(uuid.uuid4()), str(uuid.uuid4())]
    token_a, token_b = str(uuid.uuid4()), str(uuid.uuid4())
    sessions = []
    pool = ThreadPoolExecutor(max_workers=1)
    print("Run: " + run, flush=True)
    try:
        for _ in range(3):
            sessions.append(Session())
        observer, holder, contender = sessions
        check(len({s.pid for s in sessions}) == 3, "Need independent connections")
        print(f"Sessions: observer={observer.pid}, holder={holder.pid}, contender={contender.pid}", flush=True)
        for i, user in enumerate(users):
            observer.query(f"INSERT INTO auth.users(id,email) VALUES ('{user}','{run}-{i}@example.invalid');")
        holder.query("SET ROLE service_role;")
        contender.query("SET ROLE service_role;")

        def payload(balance):
            return json.dumps([dict(plaid_account_id="synthetic-account", name="Synthetic", type="depository",
                                   currency="CAD", current_balance=balance, available_balance=balance)])

        def initialize(case, user=users[0], balance=100, secret="first"):
            return (f"SELECT public.initialize_plaid_item('{user}','{run}-{case}',"
                    f"'synthetic-{secret}',NULL,NULL,'{payload(balance)}',clock_timestamp());")

        item = json.loads(holder.query(initialize("fence")))["item_id"]

        def accounts(token=token_a, cursor="cursor-X", balance=999):
            return (f"SELECT public.commit_plaid_accounts('{users[0]}','{item}','{token}',"
                    f"'{cursor}','{payload(balance)}','2026-01-01Z');")

        def snapshot(session=observer):
            return json.loads(session.query(f"""SELECT jsonb_build_object(
              'item',(SELECT to_jsonb(i) FROM public.plaid_items i WHERE id='{item}'),
              'accounts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.accounts a WHERE plaid_item_id='{item}'),
              'transactions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transactions t WHERE user_id='{users[0]}')
            );"""))

        def reset(expiry="clock_timestamp()+interval '5 minutes'"):
            observer.query(f"""UPDATE public.plaid_items SET status='active',transactions_cursor='cursor-X',
              sync_lock_token='{token_a}',sync_lock_expires_at={expiry} WHERE id='{item}';""")

        def blocked(label):
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if observer.query(f"""SELECT EXISTS(SELECT FROM pg_stat_activity
                  WHERE pid={contender.pid} AND state='active' AND wait_event_type='Lock'
                  AND {holder.pid}=ANY(pg_blocking_pids(pid)));""") == "t":
                    print(f"LOCK {label}: contender {contender.pid} blocked by holder {holder.pid}", flush=True)
                    return
                time.sleep(0.02)
            raise AssertionError(label + ": lock wait not observed")

        # query() returns only after its SQL completion marker: holder is ready.
        reset("clock_timestamp()-interval '1 second'")
        original_id = snapshot()["accounts"][0]["id"]
        holder.query("BEGIN;")
        check(holder.query(f"""UPDATE public.plaid_items SET sync_lock_token='{token_b}',
          sync_lock_expires_at=clock_timestamp()+interval '5 minutes'
          WHERE id='{item}' AND sync_lock_expires_at<clock_timestamp() RETURNING id;""") == item, "Replacement failed")
        check(holder.query(accounts(token_b, balance=200)) == "t", "B accounts rejected")
        expected = snapshot(holder)
        pending = pool.submit(contender.query, accounts())
        blocked("1 stale worker")
        holder.query("COMMIT;")
        check(pending.result(5) == "f", "Old worker accepted")
        state = snapshot()
        check(state == expected, "Stale waiter changed the committed replacement snapshot")
        check(state["accounts"][0]["id"] == original_id and state["accounts"][0]["current_balance"] == 200
              and state["item"]["sync_lock_token"] == token_b, "New state lost")
        check(contender.query(accounts()) == "f" and snapshot() == state, "Late stale write changed state")
        print("PASS 1: replacement commit preserves UUID, balance, cursor and newer lease", flush=True)

        reset("clock_timestamp()+interval '3 seconds'")
        before = snapshot()
        holder.query(f"BEGIN; SELECT id FROM public.plaid_items WHERE id='{item}' FOR UPDATE;")
        pending = pool.submit(contender.query, accounts())
        blocked("2 expiry")
        check(observer.query(f"SELECT sync_lock_expires_at>clock_timestamp() FROM public.plaid_items WHERE id='{item}';") == "t", "Lease expired BEFORE observed blocking")
        observer.query(f"SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM(sync_lock_expires_at-clock_timestamp())))+0.05) FROM public.plaid_items WHERE id='{item}';")
        check(observer.query(f"SELECT sync_lock_expires_at<=clock_timestamp() FROM public.plaid_items WHERE id='{item}';") == "t", "DB expiry not reached")
        holder.query("COMMIT;")
        check(pending.result(5) == "f" and snapshot() == before, "Expired waiter changed state")
        print("PASS 2: valid at observed wait, expired by database clock, rejected after lock", flush=True)

        for label, change in [("3 cursor", "transactions_cursor='cursor-Y'"), ("4 revoke", "status='revoked'")]:
            reset()
            before = snapshot()
            holder.query(f"BEGIN; UPDATE public.plaid_items SET {change} WHERE id='{item}';")
            pending = pool.submit(contender.query, accounts())
            blocked(label)
            holder.query("COMMIT;")
            check(pending.result(5) == "f", label + ": stale worker accepted")
            after = snapshot()
            check(after["accounts"] == before["accounts"] and after["transactions"] == before["transactions"], label + ": data changed")
            check(after["item"]["transactions_cursor" if label.startswith("3") else "status"] == ("cursor-Y" if label.startswith("3") else "revoked"), label + ": fence lost")
            print("PASS " + label + ": lock-first change committed, waiter rejected", flush=True)

        for case in ("duplicate", "rollback", "cross-user"):
            holder.query("BEGIN;")
            first = json.loads(holder.query(initialize(case)))
            check(first["status"] == "created", "First init failed")
            sql = initialize(case, users[1] if case == "cross-user" else users[0], 777, "second")
            if case == "cross-user":
                # Catch only the expected exception, leaving the session usable.
                sql = "DO $$ BEGIN BEGIN PERFORM " + sql.removeprefix("SELECT ").removesuffix(";") + "; RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Cross-user accepted'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'Plaid connection cannot be initialized' THEN RAISE; END IF; END; END $$; SELECT 'rejected';"
            pending = pool.submit(contender.query, sql)
            blocked("5 " + case + " unique index")
            holder.query("ROLLBACK;" if case == "rollback" else "COMMIT;")
            result = pending.result(5)
            expected = "created" if case == "rollback" else "already_connected"
            check(result == "rejected" if case == "cross-user" else json.loads(result)["status"] == expected, case + ": unexpected result")
            secret, balance = ("second", 777) if case == "rollback" else ("first", 100)
            check(observer.query(f"""SELECT count(*)=1 AND bool_and(i.user_id='{users[0]}' AND i.sync_lock_token IS NULL AND i.sync_lock_expires_at IS NULL
              AND (SELECT count(*)=1 AND bool_and(access_token='synthetic-{secret}') FROM public.plaid_item_secrets WHERE plaid_item_id=i.id)
              AND (SELECT count(*)=1 AND bool_and(current_balance={balance}) FROM public.accounts WHERE plaid_item_id=i.id))
              FROM public.plaid_items i WHERE plaid_item_id='{run}-{case}';""") == "t", case + ": cardinality/secret/balance/lease mismatch")
            print("PASS 5 " + case + ": unique-index wait, expected outcome, one Item/Secret/account, cleared lease", flush=True)

        # Actual production RPCs; direct conditional UPDATE models lease acquisition.
        reset()
        check(contender.query(accounts(balance=300)) == "t", "First account commit failed")
        before = snapshot()
        holder.query(f"BEGIN; UPDATE public.plaid_items SET sync_lock_token='{token_b}' WHERE id='{item}';")
        sql = f"""DO $$ BEGIN BEGIN
          PERFORM public.commit_plaid_sync('{users[0]}','{item}','{token_a}','cursor-X','cursor-Y','[]','[]','[]');
          RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Stale transaction commit accepted';
          EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'Sync lease is no longer valid' THEN RAISE; END IF;
          END; END $$; SELECT 'rejected';"""
        pending = pool.submit(contender.query, sql)
        blocked("6 accounts then transaction fence change")
        holder.query("COMMIT;")
        check(pending.result(5) == "rejected", "Transaction fence not enforced")
        after = snapshot()
        check(after["accounts"] == before["accounts"] and after["transactions"] == before["transactions"]
              and after["item"]["transactions_cursor"] == "cursor-X" and after["item"]["sync_lock_token"] == token_b, "Ordering corrupted data")
        print("PASS 6: committed accounts survive later fenced transaction rejection", flush=True)

        # A duplicate racing a pending revoke waits on the conflicting Item;
        # it must read the revoked state and cannot report already_connected.
        holder.query(f"BEGIN; UPDATE public.plaid_items SET status='revoked' WHERE id='{item}';")
        sql = "DO $$ BEGIN BEGIN PERFORM " + initialize("fence").removeprefix("SELECT ").removesuffix(";") + "; RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Revoked duplicate accepted'; EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM <> 'Plaid connection cannot be initialized' THEN RAISE; END IF; END; END $$; SELECT 'rejected';"
        pending = pool.submit(contender.query, sql)
        blocked("7 duplicate during revoke")
        expected = snapshot(holder)
        holder.query("COMMIT;")
        check(pending.result(5) == "rejected" and snapshot() == expected, "Duplicate changed revoked Item")
        print("PASS 7: concurrent revoke commits before duplicate validation; duplicate rejected without writes", flush=True)
    finally:
        for session in reversed(sessions[1:]):
            session.close()
        pool.shutdown(wait=True, cancel_futures=True)
        if sessions:
            sessions[0].close()
            cleanup = Session()
            try:
                ids = ",".join("'" + u + "'" for u in users)
                cleanup.query(f"""BEGIN;
                  DELETE FROM public.transactions WHERE user_id IN ({ids});
                  DELETE FROM public.accounts WHERE user_id IN ({ids});
                  DELETE FROM public.categories WHERE user_id IN ({ids});
                  DELETE FROM public.plaid_item_secrets WHERE plaid_item_id IN (SELECT id FROM public.plaid_items WHERE user_id IN ({ids}));
                  DELETE FROM public.plaid_items WHERE user_id IN ({ids});
                  DELETE FROM auth.users WHERE id IN ({ids}); COMMIT;""")
                check(cleanup.query(f"""SELECT NOT EXISTS(SELECT FROM auth.users WHERE id IN ({ids}))
                  AND NOT EXISTS(SELECT FROM public.plaid_items WHERE plaid_item_id LIKE '{run}%')
                  AND NOT EXISTS(SELECT FROM public.accounts WHERE user_id IN ({ids}))
                  AND NOT EXISTS(SELECT FROM public.transactions WHERE user_id IN ({ids}))
                  AND NOT EXISTS(SELECT FROM public.categories WHERE user_id IN ({ids}));""") == "t", "Cleanup incomplete")
                print("PASS cleanup: all run-scoped fixtures removed", flush=True)
            finally:
                cleanup.close()


if __name__ == "__main__":
    main()
