#!/usr/bin/env python3
"""Local PostgREST/Auth integration; Python stdlib only, no hosted URLs accepted.

Run: python3 supabase/tests/p32_accounts_http.py
Credentials are captured from local CLI status, never printed or passed in argv.
Only generated UUID fixtures are removed. Hard-kill leftovers use the printed
p32-accounts-http-<run ID> prefix in auth email and external Plaid Item ID.
"""
from http.client import HTTPConnection, RemoteDisconnected
import json
from pathlib import Path
import runpy
import secrets
import socket
import socketserver
import subprocess
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid

utility = runpy.run_path(str(Path(__file__).resolve().parents[2] / "scripts/test-p32-stale-concurrency.py"))
Session, check = utility["Session"], utility["check"]


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError("HTTP redirect refused")


def main():
    status = subprocess.run(["npx", "supabase", "status", "-o", "json"], capture_output=True, text=True, timeout=30)
    check(status.returncode == 0, "Local CLI status failed (output withheld)")
    config = json.loads(status.stdout)
    base = config["API_URL"].rstrip("/")
    check(base in ("http://127.0.0.1:54321", "http://localhost:54321"), "Refusing non-local Supabase URL")
    # Also prove CLI status belongs to this project's database.
    db = urllib.parse.urlsplit(config["DB_URL"])
    check(db.hostname in ("127.0.0.1", "localhost") and db.port == 54322, "Unexpected DB endpoint")
    ports = json.loads(subprocess.check_output(["docker", "inspect", "--format", "{{json .NetworkSettings.Ports}}", "supabase_db_expense_tracker"], text=True))
    check(any(p["HostPort"] == "54322" for p in ports.get("5432/tcp", [])), "Local DB port/container mismatch")
    service, anon = config["SERVICE_ROLE_KEY"], config["ANON_KEY"]
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    synthetic_secret = "synthetic-access-" + uuid.uuid4().hex

    def http(path, body, token=service, method="POST"):
        check(path.startswith(("/rest/v1/rpc/", "/auth/v1/")), "Unexpected HTTP path")
        req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(), method=method,
                                     headers={"apikey": anon if token != service else service, "Authorization": "Bearer " + token, "Content-Type": "application/json"})
        try:
            response = opener.open(req, timeout=12)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read().decode()
            if path.startswith("/rest/"):
                check(all(secret not in raw for secret in (synthetic_secret, service, anon, "synthetic-public-token")), "Sensitive RPC response")
            return response.status, json.loads(raw) if raw else None

    def rpc(name, body, token=service):
        return http("/rest/v1/rpc/" + name, body, token)

    def pg_error(result, status_code, code):
        status, body = result
        check(status == status_code and isinstance(body, dict) and body.get("code") == code,
              f"Unexpected HTTP status/SQLSTATE (expected {status_code}/{code})")
        check(isinstance(body.get("message"), str) and all(body.get(k) is None or isinstance(body[k], str) for k in ("details", "hint")), "PostgREST error contract mismatch")

    run = "p32-accounts-http-" + uuid.uuid4().hex
    users = []
    control = Session()
    print("Run: " + run, flush=True)
    try:
        # A real Auth-created, confirmed user and password grant; not a forged JWT.
        password = secrets.token_urlsafe(32)
        email = run + "@example.invalid"
        code, auth = http("/auth/v1/admin/users", {"email": email, "password": password, "email_confirm": True})
        check(code in (200, 201), "Local Auth user creation failed")
        user = str(uuid.UUID(auth["id"]))
        users.append(user)
        code, login = http("/auth/v1/token?grant_type=password", {"email": email, "password": password}, anon)
        check(code == 200, "Local Auth login failed")
        jwt = login["access_token"]
        code, identity = http("/auth/v1/user", None, jwt, "GET")
        check(code == 200 and identity["id"] == user and identity["role"] == "authenticated", "JWT identity/role invalid")
        other = str(uuid.uuid4())
        users.append(other)
        control.query(f"INSERT INTO auth.users(id,email) VALUES ('{other}','{run}-other@example.invalid');")
        print("PASS Auth: real password-grant JWT, /user identity and authenticated role", flush=True)

        account = dict(plaid_account_id="synthetic-account", name="Synthetic", official_name="Synthetic bank", mask="1234",
                       type="depository", subtype="checking", currency="CAD", current_balance=100.25, available_balance=90.25)
        initialization = dict(p_user_id=user, p_plaid_item_id=run, p_access_token=synthetic_secret,
                              p_institution_id="synthetic-institution", p_institution_name="Synthetic institution",
                              p_accounts=[account], p_snapshot_time="2026-01-01T00:00:00Z")
        code, result = rpc("initialize_plaid_item", initialization)
        check(code == 200 and set(result) == {"status", "item_id"} and result["status"] == "created", "Init success shape")
        item = str(uuid.UUID(result["item_id"]))
        token = str(uuid.uuid4())

        def snapshot():
            return control.query(f"""SELECT jsonb_build_object(
              'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.plaid_items i WHERE user_id IN ('{user}','{other}')),
              'accounts',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.accounts a WHERE user_id IN ('{user}','{other}')),
              'secrets',(SELECT jsonb_agg(to_jsonb(s) ORDER BY plaid_item_id) FROM public.plaid_item_secrets s WHERE plaid_item_id IN
                (SELECT id FROM public.plaid_items WHERE user_id IN ('{user}','{other}'))));""")

        state = json.loads(snapshot())
        a = state["accounts"][0]
        check(len(state["items"]) == len(state["accounts"]) == len(state["secrets"]) == 1, "Initialization cardinality")
        check(state["items"][0]["sync_lock_token"] is None and state["items"][0]["sync_lock_expires_at"] is None, "Initial lease not cleared")
        check(state["secrets"][0]["access_token"] == synthetic_secret and all(a[k] == v for k, v in account.items())
              and a["user_id"] == user and a["plaid_item_id"] == item, "Initialization mapping")
        print("PASS initialization: HTTP 200 created; Item/Secret/Accounts mapping and cleared lease", flush=True)

        def lease(expiry="clock_timestamp()+interval '5 minutes'"):
            control.query(f"UPDATE public.plaid_items SET sync_lock_token='{token}',sync_lock_expires_at={expiry} WHERE id='{item}';")

        lease()
        body = dict(p_user_id=user, p_item_id=item, p_lease_token=token, p_expected_cursor=None,
                    p_accounts=[{**account, "current_balance": 222.5}], p_snapshot_time="2026-01-02T00:00:00Z")
        before = json.loads(snapshot())
        check(rpc("commit_plaid_accounts", body) == (200, True), "Account success response")
        after = json.loads(snapshot())
        check(after["items"] == before["items"] and after["secrets"] == before["secrets"]
              and after["accounts"][0]["id"] == a["id"] and after["accounts"][0]["current_balance"] == 222.5
              and after["accounts"][0]["balance_as_of"].startswith("2026-01-02"), "Account mapping/preservation failed")
        print("PASS accounts: HTTP 200 true; balance/snapshot updated, UUID/Item/Secret preserved", flush=True)

        for role, key, denied_status in (("anon", anon, 401), ("authenticated", jwt, 403)):
            for name, params in (("commit_plaid_accounts", body), ("initialize_plaid_item", {**initialization, "p_plaid_item_id": run + "-denied"})):
                before = snapshot()
                pg_error(rpc(name, params, key), denied_status, "42501")
                check(snapshot() == before, "Denied role changed DB")
                print(f"PASS {role} {name}: HTTP {denied_status} / 42501; DB unchanged", flush=True)

        for label, changes in (("wrong token", {"p_lease_token": str(uuid.uuid4())}),
                               ("wrong cursor", {"p_expected_cursor": "wrong"}),
                               ("cross-user", {"p_user_id": other})):
            before = snapshot()
            check(rpc("commit_plaid_accounts", {**body, **changes}) == (200, False), label + ": expected false")
            check(snapshot() == before, label + ": state changed")
            print("PASS " + label + ": HTTP 200 false; DB unchanged", flush=True)
        lease("clock_timestamp()-interval '1 second'")
        before = snapshot()
        check(rpc("commit_plaid_accounts", body) == (200, False) and snapshot() == before, "Expired lease accepted")
        print("PASS expiry: HTTP 200 false; DB unchanged", flush=True)
        lease()

        for label, invalid, error_code in (("empty payload", [], "P0001"),
                                           ("numeric exception", [{**account, "current_balance": "invalid-number"}], "22P02")):
            before = snapshot()
            pg_error(rpc("commit_plaid_accounts", {**body, "p_accounts": invalid}), 400, error_code)
            check(snapshot() == before, label + ": account exception not atomic")
            pg_error(rpc("initialize_plaid_item", {**initialization, "p_plaid_item_id": run + "-invalid", "p_accounts": invalid}), 400, error_code)
            check(snapshot() == before, label + ": initialization not atomic")
            print(f"PASS both RPCs {label}: HTTP 400 / {error_code}; full DB snapshot unchanged", flush=True)

        before = snapshot()
        check(rpc("initialize_plaid_item", {**initialization, "p_access_token": "synthetic-second", "p_accounts": [{**account, "current_balance": 999}]}) == (200, {"status": "already_connected"}), "Duplicate response")
        check(snapshot() == before, "Duplicate overwrote data")
        pg_error(rpc("initialize_plaid_item", {**initialization, "p_user_id": other}), 400, "P0001")
        check(snapshot() == before, "Cross-user init changed data")
        print("PASS duplicate: HTTP 200 already_connected; cross-user HTTP 400 / P0001; no overwrite", flush=True)

        # Real response loss: one-shot loopback relay commits the upstream RPC,
        # then closes the downstream socket without sending an HTTP response.
        # No fault injection in application/DB, no retry of the write.
        upstream = []
        class DropResponse(socketserver.BaseRequestHandler):
            def handle(self):
                self.request.settimeout(5)
                self.request.recv(4096)
                upstream.append(rpc("commit_plaid_accounts", {**body, "p_accounts": [{**account, "current_balance": 333}]}))
                self.request.shutdown(socket.SHUT_WR)

        with socketserver.TCPServer(("127.0.0.1", 0), DropResponse) as relay:
            relay.timeout = 5
            worker = threading.Thread(target=relay.handle_request)
            worker.start()
            client = HTTPConnection("127.0.0.1", relay.server_address[1], timeout=15)
            try:
                client.request("POST", "/response-loss")
                try:
                    client.getresponse()
                    raise AssertionError("Expected downstream response loss")
                except RemoteDisconnected:
                    pass
            finally:
                client.close()
                worker.join(timeout=15)
            check(not worker.is_alive() and upstream == [(200, True)], "Upstream commit did not complete")
        check(json.loads(snapshot())["accounts"][0]["current_balance"] == 333, "Response-loss commit missing")
        print("PASS real HTTP response loss: upstream committed, downstream disconnected, DB balance=333", flush=True)
    finally:
        control.close()
        if users:
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
                  AND NOT EXISTS(SELECT FROM auth.identities WHERE user_id IN ({ids}))
                  AND NOT EXISTS(SELECT FROM auth.sessions WHERE user_id IN ({ids}))
                  AND NOT EXISTS(SELECT FROM public.plaid_items WHERE plaid_item_id LIKE '{run}%')
                  AND NOT EXISTS(SELECT FROM public.accounts WHERE user_id IN ({ids}));""") == "t", "Cleanup incomplete")
                print("PASS cleanup: synthetic Auth users/identities/sessions and bank fixtures removed", flush=True)
            finally:
                cleanup.close()


if __name__ == "__main__":
    main()
