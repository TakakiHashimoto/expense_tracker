#!/usr/bin/env python3
"""Local PostgreSQL concurrency regression, using only Python stdlib and Docker.

Run: python3 scripts/test-p32-stale-concurrency.py
Requires the existing local Supabase container and P32-STALE migration.
Uses three independent psql sessions, synthetic UUID-scoped data, observed lock
barriers, bounded waits, and finally cleanup. Never accepts a remote DB URL.
"""
import json
import queue
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

CONTAINER = "supabase_db_expense_tracker"


class Session:
    def __init__(self):
        self.process = subprocess.Popen(
            ["docker", "exec", "-i", CONTAINER, "psql", "-X", "-qAt",
             "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1,
        )
        self.lines = queue.Queue()
        def read():
            for line in self.process.stdout:
                self.lines.put(line.rstrip("\n"))
            self.lines.put(None)
        threading.Thread(target=read, daemon=True).start()
        self.query("SET statement_timeout='12s'; SET lock_timeout='10s'; "
                   "SET idle_in_transaction_session_timeout='20s'; "
                   "SET default_transaction_isolation='read committed';")
        self.pid = int(self.query("SELECT pg_backend_pid();"))

    def query(self, sql, timeout=15):
        marker = "done_" + uuid.uuid4().hex
        self.process.stdin.write(sql + "\nSELECT '" + marker + "';\n")
        self.process.stdin.flush()
        output = []
        deadline = time.monotonic() + timeout
        while True:
            line = self.lines.get(timeout=max(0.01, deadline - time.monotonic()))
            if line is None:
                raise RuntimeError("psql exited: " + "\n".join(output))
            if line == marker:
                return "\n".join(output)
            output.append(line)

    def close(self):
        if self.process.poll() is None:
            try:
                self.process.stdin.write("ROLLBACK;\n\\q\n")
                self.process.stdin.flush()
                self.process.wait(timeout=3)
            except (BrokenPipeError, subprocess.TimeoutExpired):
                self.process.terminate()
                self.process.wait(timeout=3)
        self.process.stdin.close()
        self.process.stdout.close()


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def main():
    # Confirm the exact local container before any writes; never print its env.
    info = json.loads(subprocess.check_output(
        ["docker", "inspect", "--format", "{{json .Config.Image}}", CONTAINER], text=True))
    check("supabase/postgres:" in info, "Unexpected local container image")
    sessions = []
    u, item, account, token_a, token_b = [str(uuid.uuid4()) for _ in range(5)]
    pool = ThreadPoolExecutor(max_workers=1)
    control = None
    try:
        for _ in range(3):
            sessions.append(Session())
        control, a, b = sessions
        check(len({s.pid for s in sessions}) == 3, "Independent connections required")
        check(control.query("SELECT to_regprocedure('public.record_plaid_sync_failure(uuid,uuid,uuid,text,text,boolean)') IS NOT NULL;") == "t", "Missing migration")
        check(control.query("SHOW transaction_isolation;") == "read committed", "Wrong isolation")
        print("PostgreSQL " + control.query("SHOW server_version;") + "; three independent READ COMMITTED sessions", flush=True)
        control.query(f"""
          BEGIN;
          INSERT INTO auth.users(id,email) VALUES ('{u}', 'p32-concurrency-{u}@example.invalid');
          INSERT INTO public.plaid_items(id,user_id,plaid_item_id,transactions_cursor)
            VALUES ('{item}','{u}','p32-concurrency-{item}','cursor-X');
          INSERT INTO public.accounts(id,user_id,plaid_item_id,plaid_account_id,type,name,current_balance)
            VALUES ('{account}','{u}','{item}','synthetic-account','depository','Synthetic',100);
          COMMIT;
        """)
        for worker in (a, b):
            worker.query("SET ROLE service_role;")

        def reset(expiry="clock_timestamp() + interval '5 minutes'"):
            control.query(f"""UPDATE public.plaid_items SET status='active',
              transactions_cursor='cursor-X', last_sync_status='succeeded', last_sync_error=NULL,
              last_sync_at='2026-01-01Z', sync_lock_token='{token_a}', sync_lock_expires_at={expiry}
              WHERE id='{item}' AND user_id='{u}';""")

        def failure(token=token_a, cursor="cursor-X"):
            return f"SELECT public.record_plaid_sync_failure('{u}','{item}','{token}','{cursor}','ITEM_LOGIN_REQUIRED',true);"

        def snapshot():
            return json.loads(control.query(f"""SELECT json_build_object(
              'item', (SELECT to_jsonb(i) FROM public.plaid_items i WHERE id='{item}'),
              'accounts', (SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.accounts a WHERE user_id='{u}'),
              'transactions', (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.transactions t WHERE user_id='{u}'),
              'categories', (SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.categories c WHERE user_id='{u}')
            );"""))

        def blocked(waiter, holder):
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if control.query(f"SELECT {holder.pid} = ANY(pg_blocking_pids({waiter.pid}));") == "t":
                    return
                time.sleep(0.02)
            raise AssertionError("RPC never observed waiting for the holder's row lock")

        def unchanged(before, label):
            check(snapshot() == before, label + ": state changed")

        reset()
        before = snapshot()
        check(a.query(failure()) == "t", "A: valid lease rejected")
        after = snapshot()
        check(after["item"]["status"] == "error" and after["item"]["last_sync_status"] == "failed"
              and after["item"]["last_sync_error"] == "ITEM_LOGIN_REQUIRED", "A: failure not recorded")
        for key in ("last_sync_status", "last_sync_error", "status", "updated_at"):
            after["item"].pop(key)
            before["item"].pop(key)
        check(after == before, "A: unrelated state changed")
        print("PASS A: valid lease records exactly the failure fields", flush=True)

        reset("clock_timestamp() - interval '1 second'")
        before = snapshot()
        check(a.query(failure()) == "f", "B: expired lease accepted")
        unchanged(before, "B")
        print("PASS B: expired lease without replacement rejected", flush=True)

        # B takes the expired lease using the application's conditional UPDATE.
        check(b.query(f"""UPDATE public.plaid_items SET sync_lock_token='{token_b}',
          sync_lock_expires_at=clock_timestamp()+interval '5 minutes'
          WHERE id='{item}' AND user_id='{u}' AND sync_lock_expires_at < clock_timestamp()
          RETURNING transactions_cursor;""") == "cursor-X", "C: B did not acquire")
        before = snapshot()
        check(a.query(failure()) == "f", "C: old token accepted")
        unchanged(before, "C")
        # The application's old-token release must also leave B's lease intact.
        a.query(f"UPDATE public.plaid_items SET sync_lock_token=NULL,sync_lock_expires_at=NULL WHERE id='{item}' AND user_id='{u}' AND sync_lock_token='{token_a}';")
        unchanged(before, "C old-token release")
        print("PASS C: replacement lease protected from old failure and release", flush=True)

        b.query("BEGIN;")
        b.query(f"""SELECT public.commit_plaid_sync('{u}','{item}','{token_b}','cursor-X','cursor-Y',
          '[{{"transaction_id":"synthetic-tx","account_id":"synthetic-account","amount":-5,"pending":false,"posted_date":"2026-01-01","category_kind":"expense","category_name":"Synthetic"}}]', '[]','[]');""")
        pending = pool.submit(a.query, failure())
        blocked(a, b)
        b.query(f"UPDATE public.plaid_items SET sync_lock_token=NULL,sync_lock_expires_at=NULL WHERE id='{item}' AND sync_lock_token='{token_b}'; COMMIT;")
        check(pending.result(timeout=5) == "f", "D: stale worker accepted after commit")
        before = snapshot()
        check(before["item"]["last_sync_status"] == "succeeded" and before["item"]["transactions_cursor"] == "cursor-Y", "D: new success lost")
        check(len(before["transactions"]) == 1 and before["transactions"][0]["amount"] == -5, "D: transaction lost")
        check(a.query(failure()) == "f", "D: late failure accepted")
        unchanged(before, "D")
        print("PASS D: observed lock wait; newer atomic commit, release, cursor and transaction preserved", flush=True)

        # Application lifecycle: commit RPC and lease release are separate
        # transactions. Test both an advancing and an unchanged Plaid cursor.
        for next_cursor in ("cursor-Y", "cursor-X"):
            reset("clock_timestamp() - interval '1 second'")
            check(b.query(f"""UPDATE public.plaid_items SET sync_lock_token='{token_b}',
              sync_lock_expires_at=clock_timestamp()+interval '5 minutes'
              WHERE id='{item}' AND user_id='{u}' AND sync_lock_expires_at < clock_timestamp()
              RETURNING transactions_cursor;""") == "cursor-X", "D2: B did not acquire expired lease")
            # No BEGIN: this RPC commits before the next command is sent.
            b.query(f"""SELECT public.commit_plaid_sync('{u}','{item}','{token_b}','cursor-X','{next_cursor}',
              '[{{"transaction_id":"synthetic-tx","account_id":"synthetic-account","amount":-7,"pending":false,"posted_date":"2026-01-01","category_kind":"expense","category_name":"Synthetic"}}]', '[]','[]');""")
            before = snapshot()  # Separate connection sees the committed state.
            check(before["item"]["last_sync_status"] == "succeeded"
                  and before["item"]["transactions_cursor"] == next_cursor
                  and before["item"]["last_sync_error"] is None, "D2: committed success missing")
            check(before["item"]["sync_lock_token"] == token_b, "D2: lease released too early")
            check(control.query(f"SELECT sync_lock_expires_at > clock_timestamp() FROM public.plaid_items WHERE id='{item}';") == "t", "D2: B lease must still be valid")
            check(len(before["transactions"]) == 1 and before["transactions"][0]["amount"] == -7, "D2: transaction not committed")
            check(a.query(failure()) == "f", "D2: stale failure accepted before release")
            unchanged(before, "D2 before release")  # Includes the entire lease.
            b.query(f"UPDATE public.plaid_items SET sync_lock_token=NULL,sync_lock_expires_at=NULL WHERE id='{item}' AND user_id='{u}' AND sync_lock_token='{token_b}';")
            expected = before
            expected["item"]["sync_lock_token"] = None
            expected["item"]["sync_lock_expires_at"] = None
            unchanged(expected, "D2 after separate release")
            print(f"PASS D2 ({next_cursor}): committed success and live B lease preserved until separate release", flush=True)

        # Establish actual lock wait BEFORE expiry, then wait using database time.
        reset("clock_timestamp() + interval '3 seconds'")
        before = snapshot()
        b.query(f"BEGIN; SELECT id FROM public.plaid_items WHERE id='{item}' FOR UPDATE;")
        pending = pool.submit(a.query, failure())
        blocked(a, b)
        check(control.query(f"SELECT sync_lock_expires_at > clock_timestamp() FROM public.plaid_items WHERE id='{item}';") == "t", "E: RPC was not blocked before expiry")
        control.query(f"SELECT pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM (sync_lock_expires_at-clock_timestamp()))) + 0.05) FROM public.plaid_items WHERE id='{item}';")
        b.query("COMMIT;")
        check(pending.result(timeout=5) == "f", "E: lease expiring during wait accepted")
        unchanged(before, "E")
        print("PASS E: pg_blocking_pids observed before expiry; expiry after row-lock wait rejected", flush=True)

        reset()
        b.query(f"BEGIN; UPDATE public.plaid_items SET status='revoked' WHERE id='{item}';")
        pending = pool.submit(a.query, failure())
        blocked(a, b)
        b.query("COMMIT;")
        check(pending.result(timeout=5) == "f", "F1: revoked item restored")
        before = snapshot()
        check(before["item"]["status"] == "revoked" and before["item"]["last_sync_status"] == "succeeded", "F1: revoked state corrupted")
        check(a.query(failure()) == "f", "F1: late error accepted")
        unchanged(before, "F1")
        print("PASS F1: revocation locks first; waiting failure rejected", flush=True)

        reset()
        a.query("BEGIN;")
        check(a.query(failure()) == "t", "F2: valid failure rejected")
        pending = pool.submit(b.query, f"UPDATE public.plaid_items SET status='revoked' WHERE id='{item}';")
        blocked(b, a)
        a.query("COMMIT;")
        pending.result(timeout=5)
        before = snapshot()
        check(before["item"]["status"] == "revoked" and before["item"]["last_sync_status"] == "failed", "F2: revocation not final")
        check(a.query(failure()) == "f", "F2: subsequent failure restored item")
        unchanged(before, "F2")
        print("PASS F2: failure locks first; later revocation wins and remains protected", flush=True)
    finally:
        # Closing workers rolls back outstanding transactions and releases locks
        # before cleanup, including on assertion failure or interrupt.
        for session in reversed(sessions[1:]):
            session.close()
        pool.shutdown(wait=True, cancel_futures=True)
        if control is not None:
            # Reconnect so even a failed control statement / timeout cannot
            # prevent cleanup through an already-aborted psql connection.
            control.close()
            control = Session()
            try:
                control.query(f"""BEGIN;
                  DELETE FROM public.transactions WHERE user_id='{u}';
                  DELETE FROM public.accounts WHERE user_id='{u}';
                  DELETE FROM public.categories WHERE user_id='{u}';
                  DELETE FROM public.plaid_items WHERE id='{item}' AND user_id='{u}';
                  DELETE FROM auth.users WHERE id='{u}';
                  COMMIT;
                """)
                check(control.query(f"""SELECT NOT EXISTS(SELECT FROM auth.users WHERE id='{u}')
                  AND NOT EXISTS(SELECT FROM public.plaid_items WHERE user_id='{u}')
                  AND NOT EXISTS(SELECT FROM public.accounts WHERE user_id='{u}')
                  AND NOT EXISTS(SELECT FROM public.transactions WHERE user_id='{u}')
                  AND NOT EXISTS(SELECT FROM public.categories WHERE user_id='{u}');""") == "t", "Fixture cleanup incomplete")
                print("PASS cleanup: no synthetic user, Item, account, category or transaction remains", flush=True)
            finally:
                control.close()
        elif sessions:
            sessions[0].close()


if __name__ == "__main__":
    main()
