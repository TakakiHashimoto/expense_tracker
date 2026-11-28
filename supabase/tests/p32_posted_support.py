"""Shared local-only test fixtures. No credentials, remote DSNs or external data."""
import json
from pathlib import Path
import runpy
import subprocess
import uuid

utility = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/test-p32-stale-concurrency.py'))
check = utility['check']


class Session(utility['Session']):
    def __init__(self):
        # Every connection is pinned to this container, with its exposed port
        # verified before any mutation; callers cannot supply a DSN.
        ports = json.loads(subprocess.check_output(['docker', 'inspect', '--format', '{{json .NetworkSettings.Ports}}', 'supabase_db_expense_tracker'], text=True))
        check(any(p['HostPort'] == '54322' for p in ports['5432/tcp']), 'Unexpected local database target')
        super().__init__()
        check(self.query('SELECT current_database();') == 'postgres', 'Unexpected database')


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def rejected(sql, message):
    return ("DO $$ BEGIN BEGIN PERFORM " + sql.removeprefix('SELECT ').removesuffix(';') +
            "; RAISE EXCEPTION USING ERRCODE='P3202',MESSAGE='Unexpected acceptance'; "
            "EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM<>" + quote(message) +
            " THEN RAISE; END IF; END; END $$; SELECT 'rejected';")


class Fixture:
    def __init__(self, control, user=None):
        self.control = control
        self.run = 'p32-posted-' + uuid.uuid4().hex
        self.user, self.item, self.account, self.token, self.category = [str(uuid.uuid4()) for _ in range(5)]
        self.owns_user = user is None
        if user is not None:
            self.user = str(uuid.UUID(user))
        control.query('BEGIN;')
        if self.owns_user:
            control.query(f"INSERT INTO auth.users(id,email) VALUES ('{self.user}','{self.run}@example.invalid');")
        control.query(f"""INSERT INTO public.plaid_items(id,user_id,plaid_item_id,sync_lock_token,sync_lock_expires_at,transactions_cursor)
          VALUES ('{self.item}','{self.user}','{self.run}','{self.token}',clock_timestamp()+interval '10 minutes','old');
          INSERT INTO public.accounts(id,user_id,plaid_item_id,plaid_account_id,type,name)
          VALUES ('{self.account}','{self.user}','{self.item}','account','depository','Synthetic');
          INSERT INTO public.categories(id,user_id,kind,name) VALUES ('{self.category}','{self.user}','expense','{self.run}-manual');""")
        control.query('COMMIT;')

    def tx(self, suffix, pending=False, ref=None):
        return dict(transaction_id=self.run+suffix, account_id='account', amount=-50 if pending else -52,
                    pending=pending, pending_transaction_id=self.run+ref if ref else None,
                    posted_date='2026-11-01', merchant='Synthetic', category_kind='expense', category_name=self.run+'-auto')

    def args(self, added=None, modified=None, removed=None, cursor='old', next_cursor='new', token=None):
        return dict(p_user_id=self.user,p_item_id=self.item,p_lease_token=token or self.token,
                    p_expected_cursor=cursor,p_next_cursor=next_cursor,p_added=added or [],p_modified=modified or [],p_removed=removed or [])

    def sync(self, **kwargs):
        return 'SELECT public.commit_plaid_sync('+','.join(quote(json.dumps(v) if isinstance(v,list) else v) for v in self.args(**kwargs).values())+');'

    def snapshot(self, session=None):
        return json.loads((session or self.control).query(f"""SELECT jsonb_build_object(
         'item',(SELECT to_jsonb(i) FROM public.plaid_items i WHERE id='{self.item}'),
         'transactions',(SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY plaid_transaction_id),'[]') FROM public.transactions t WHERE plaid_item_id='{self.item}'),
         'categories',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.categories c WHERE user_id='{self.user}'));"""))

    def reset(self):
        self.control.query(f"UPDATE public.plaid_items SET transactions_cursor='old',status='active',sync_lock_token='{self.token}',sync_lock_expires_at=clock_timestamp()+interval '10 minutes' WHERE id='{self.item}';")

    def edit(self, suffix, category=None):
        return f"UPDATE public.transactions SET category_id='{category or self.category}',category_source='manual' WHERE user_id='{self.user}' AND plaid_transaction_id='{self.run+suffix}' AND is_removed=false RETURNING id;"

    def cleanup(self):
        # Fresh connection also verifies the target before cleanup writes.
        session = Session()
        try:
            session.query(f"""BEGIN;
             DELETE FROM public.transactions WHERE plaid_item_id='{self.item}';
             DELETE FROM public.accounts WHERE plaid_item_id='{self.item}';
             DELETE FROM public.plaid_items WHERE id='{self.item}';
             DELETE FROM public.categories WHERE user_id='{self.user}' AND name LIKE '{self.run}%';
             """ + (f"DELETE FROM auth.users WHERE id='{self.user}';" if self.owns_user else '') + 'COMMIT;')
            check(session.query(f"SELECT NOT EXISTS(SELECT FROM public.transactions WHERE plaid_item_id='{self.item}') AND NOT EXISTS(SELECT FROM public.plaid_items WHERE id='{self.item}') AND NOT EXISTS(SELECT FROM public.accounts WHERE plaid_item_id='{self.item}') AND NOT EXISTS(SELECT FROM public.categories WHERE user_id='{self.user}' AND name LIKE '{self.run}%');") == 't','Fixture cleanup incomplete')
            if self.owns_user:
                check(session.query(f"SELECT NOT EXISTS(SELECT FROM auth.users WHERE id='{self.user}');") == 't','User cleanup incomplete')
        finally:
            session.close()
