#!/usr/bin/env python3
"""Real local Auth and PostgREST tests; no hosted endpoints or credential output."""
import json
import secrets
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid
from p32_posted_support import Session, Fixture, check


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('Redirect refused')


def main():
    result=subprocess.run(['node_modules/.bin/supabase','status','-o','json'],capture_output=True,text=True,timeout=30)
    check(result.returncode==0,'Local CLI status failed; output withheld')
    config=json.loads(result.stdout)
    base=config['API_URL'].rstrip('/')
    check(base in ('http://127.0.0.1:54321','http://localhost:54321'),'Nonlocal API refused')
    db=urllib.parse.urlsplit(config['DB_URL'])
    check(db.hostname in ('127.0.0.1','localhost') and db.port==54322,'Nonlocal database refused')
    service,anon=config['SERVICE_ROLE_KEY'],config['ANON_KEY']
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    control=Session(); fixtures=[]; users=[]; tokens=[]

    def http(path,body=None,token=service,method='POST'):
        check(path.startswith(('/rest/v1/','/auth/v1/')),'Unexpected path')
        req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),method=method,
            headers={'apikey':service if token==service else anon,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation'})
        try: response=opener.open(req,timeout=12)
        except urllib.error.HTTPError as error: response=error
        with response:
            raw=response.read().decode()
            if path.startswith('/rest/'):
                check(all(s not in raw for s in (service,anon,*tokens)),'Credential in REST response')
            return response.status,json.loads(raw) if raw else None

    def rpc(args,token=service): return http('/rest/v1/rpc/commit_plaid_sync',args,token)
    def error(response,status,code,message=None):
        actual,body=response
        check(actual==status and body.get('code')==code,'Unexpected HTTP status or SQLSTATE')
        check(all(body.get(k) is None or isinstance(body[k],str) for k in ('details','hint')),'Error shape')
        if message: check(body.get('message')==message,'Unexpected error contract')

    try:
        for _ in range(2):
            email='p32-posted-http-'+uuid.uuid4().hex+'@example.invalid'; password=secrets.token_urlsafe(32)
            code,user=http('/auth/v1/admin/users',dict(email=email,password=password,email_confirm=True))
            check(code in (200,201),'Auth user creation failed'); users.append(str(uuid.UUID(user['id'])))
            code,login=http('/auth/v1/token?grant_type=password',dict(email=email,password=password),anon)
            check(code==200,'Password grant failed'); tokens.append(login['access_token'])
            code,identity=http('/auth/v1/user',token=tokens[-1],method='GET')
            check(code==200 and identity['id']==users[-1],'JWT identity mismatch')
        f=Fixture(control,users[0]); fixtures.append(f)
        g=Fixture(control,users[1]); fixtures.append(g)
        initial=f.snapshot()
        for token,status in ((anon,401),(tokens[0],403)):
            error(rpc(f.args(added=[f.tx('-p',True)]),token),status,'42501')
            check(f.snapshot()==initial,'Denied RPC mutated database')
        print('PASS HTTP anon/authenticated RPC denied; real Auth JWTs',flush=True)

        # Old application omits the field entirely.
        old=f.tx('-p',True); del old['pending_transaction_id']
        check(rpc(f.args(added=[old]))[0]==204,'Service old-style payload failed')
        pending_id=f.snapshot()['transactions'][0]['id']
        path='/rest/v1/transactions?id=eq.'+pending_id+'&user_id=eq.'+f.user+'&is_removed=eq.false&select=id'
        before=f.snapshot()
        for column,value in [('plaid_pending_transaction_id','forbidden'),('plaid_pending_reconciled_at','2026-11-01T00:00:00Z'),('amount',-999)]:
            error(http(path,{column:value},tokens[0],'PATCH'),403,'42501')
            check(f.snapshot()==before,'Protected field changed')
        check(http(path,{'category_id':f.category,'category_source':'manual'},tokens[1],'PATCH')==(200,[]),'Cross-user edit succeeded')
        check(f.snapshot()==before,'Cross-user edit mutated state')
        code,rows=http(path,{'category_id':f.category,'category_source':'manual'},tokens[0],'PATCH')
        check(code==200 and rows==[{'id':pending_id}],'Owned category update did not return affected row')
        print('PASS HTTP protected fields denied; owner edit returns one row; cross-user zero',flush=True)

        check(rpc(f.args(added=[f.tx('-s',ref='-p')],cursor='new',next_cursor='posted'))[0]==204,'Reconciliation failed')
        state=f.snapshot(); byid={t['plaid_transaction_id']:t for t in state['transactions']}
        check(byid[f.run+'-p']['is_removed'] and byid[f.run+'-s']['category_id']==f.category
              and byid[f.run+'-s']['category_source']=='manual' and state['item']['transactions_cursor']=='posted','Reconciled state')
        check(http(path,{'category_id':None,'category_source':'manual'},tokens[0],'PATCH')==(200,[]),'Removed edit did not return zero')
        check(f.snapshot()==state,'Removed edit changed state')
        code,summary=http('/rest/v1/rpc/get_monthly_transaction_summary',dict(start_date='2026-11-01',end_date='2026-12-01'),tokens[0])
        check(code==200 and summary==[{'income':0,'expense':52,'net':-52}],'Real authenticated monthly totals')
        print('PASS HTTP transition, inherited manual category, removed edit zero, monthly total -52',flush=True)

        error(rpc(f.args(added=[f.tx('-bad',ref='-bad')],cursor='posted')),400,'P0001','Invalid pending transaction reference')
        check(f.snapshot()==state,'Invalid reference advanced cursor/changed state')
        error(rpc(f.args(added=[f.tx('-second',ref='-p')],cursor='posted')),400,'P0001','Ambiguous pending transaction successors')
        check(f.snapshot()==state,'Ambiguity left partial upsert/category/cursor')
        error(rpc(f.args(added=[f.tx('-p',True)],cursor='old')),400,'P0001','Sync cursor changed')
        check(f.snapshot()==state,'Stale cursor changed state')
        error(rpc(f.args(added=[f.tx('-p',True)],cursor='posted',token=str(uuid.uuid4()))),400,'P0001','Sync lease is no longer valid')
        check(f.snapshot()==state,'Stale lease changed state')
        print('PASS HTTP invalid/ambiguous data and fences reject atomically with P0001/400',flush=True)
        check(rpc(f.args(added=[f.tx('-p',True)],modified=[f.tx('-s')],cursor='posted',next_cursor='replayed'))[0]==204,'Replay failed')
        state=f.snapshot(); byid={t['plaid_transaction_id']:t for t in state['transactions']}
        check(byid[f.run+'-p']['is_removed'] and byid[f.run+'-s']['plaid_pending_transaction_id']==f.run+'-p','NULL erased reference or revived pending')
        print('PASS HTTP replay and NULL compatibility',flush=True)
    finally:
        for f in reversed(fixtures): f.cleanup()
        for user in users:
            code,_=http('/auth/v1/admin/users/'+user,method='DELETE')
            check(code in (200,204),'Synthetic Auth user cleanup failed')
            check(control.query(f"SELECT NOT EXISTS(SELECT FROM auth.users WHERE id='{user}') AND NOT EXISTS(SELECT FROM auth.sessions WHERE user_id='{user}');")=='t','Auth/session cleanup incomplete')
        control.close()
        print('PASS cleanup: banking fixtures, Auth users and sessions removed',flush=True)


if __name__=='__main__': main()
