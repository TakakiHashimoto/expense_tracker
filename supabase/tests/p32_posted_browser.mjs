// Local-only automated Chrome test. Prerequisite: a production build with the
// verified local Supabase URL/key, PLAID_ENV=sandbox and synthetic Plaid keys.
// Run: node supabase/tests/p32_posted_browser.mjs
// Requires google-chrome, Docker and the existing local Supabase stack.
// Uses a fresh Chrome profile, blocks nonlocal page requests, and cleans fixtures.
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,existsSync,rmSync,writeFileSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const check=(ok,msg)=>{if(!ok) throw Error(msg)};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const cli=spawnSync('node_modules/.bin/supabase',['status','-o','json'],{encoding:'utf8'});
check(cli.status===0,'Local status failed'); const c=JSON.parse(cli.stdout);
check(['http://127.0.0.1:54321','http://localhost:54321'].includes(c.API_URL),'Nonlocal API');
const ports=JSON.parse(spawnSync('docker',['inspect','--format','{{json .NetworkSettings.Ports}}','supabase_db_expense_tracker'],{encoding:'utf8'}).stdout);
check(ports['5432/tcp'].some(p=>p.HostPort==='54322'),'Wrong DB');
function sql(query){const r=spawnSync('docker',['exec','-i','supabase_db_expense_tracker','psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8'});check(r.status===0,'Local SQL failed: '+r.stderr);return r.stdout.trim()}
async function http(path,body,method='POST'){const r=await fetch(c.API_URL+path,{method,headers:{apikey:c.SERVICE_ROLE_KEY,Authorization:'Bearer '+c.SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});check(r.ok,'Local HTTP '+r.status);const t=await r.text();return t?JSON.parse(t):null;}
const run='p32-posted-browser-'+randomUUID(), password=randomBytes(32).toString('hex');
const item=randomUUID(),account=randomUUID(),token=randomUUID(),category=randomUUID();
let user,server,chrome,ws; const profile=mkdtempSync(join(tmpdir(),'p32-chrome-'));
let serverLog='';
try {
 user=(await http('/auth/v1/admin/users',{email:run+'@example.invalid',password,email_confirm:true})).id;
 sql(`INSERT INTO public.plaid_items(id,user_id,plaid_item_id,sync_lock_token,sync_lock_expires_at,transactions_cursor) VALUES ('${item}','${user}','${run}','${token}',clock_timestamp()+interval '10 minutes','old');
 INSERT INTO public.accounts(id,user_id,plaid_item_id,plaid_account_id,type,name,current_balance,currency) VALUES ('${account}','${user}','${item}','account','depository','Browser synthetic account',100,'CAD');
 INSERT INTO public.categories(id,user_id,kind,name) VALUES ('${category}','${user}','expense','Browser manual');`);
 const tx=(id,pending,ref)=>({transaction_id:run+id,account_id:'account',amount:pending?-50:-52,pending,pending_transaction_id:ref?run+ref:null,posted_date:'2026-11-28',merchant:pending?'Pending synthetic':'Posted synthetic',name:pending?'Pending synthetic':'Posted synthetic',category_kind:'expense',category_name:'Browser auto'});
 async function sync(added,cursor,next){await http('/rest/v1/rpc/commit_plaid_sync',{p_user_id:user,p_item_id:item,p_lease_token:token,p_expected_cursor:cursor,p_next_cursor:next,p_added:added,p_modified:[],p_removed:[]})}
 await sync([tx('-p',true)],'old','pending');
 const pendingId=sql(`SELECT id FROM public.transactions WHERE plaid_transaction_id='${run}-p';`);
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 Object.assign(env,{NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:c.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:c.SERVICE_ROLE_KEY,PLAID_SECRET:'P32_BUILD_PLAID_SECRET',PLAID_CLIENT_ID:'P32_BUILD_CLIENT_ID',PLAID_ENV:'sandbox',APP_BASE_URL:'http://127.0.0.1:3002'});
 server=spawn('node',['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3002'],{env,stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
 for(let i=0;i<100;i++){check(server.exitCode===null,'Owned server exited; refusing another server');try{if(serverLog.includes('Ready') && (await fetch('http://127.0.0.1:3002/login')).ok)break;}catch{} await delay(100);check(i<99,'Server startup failed')}
 chrome=spawn('/usr/bin/google-chrome',['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});
 for(let i=0;i<100&&!existsSync(join(profile,'DevToolsActivePort'));i++){await delay(100);check(i<99,'Chrome startup failed')}
 const port=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
 const page=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map();const errors=[];
 function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(Error(m.error.message));else p.resolve(m.result)}
  else if(m.method==='Fetch.requestPaused'){const u=new URL(m.params.request.url);send(u.hostname==='127.0.0.1'||u.hostname==='localhost'?'Fetch.continueRequest':'Fetch.failRequest',{requestId:m.params.requestId,...(u.hostname==='127.0.0.1'||u.hostname==='localhost'?{}:{errorReason:'BlockedByClient'})}).catch(()=>{})}
  else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
 };
 await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});check(!r.exceptionDetails,'Browser expression failed');return r.result.value}
 async function wait(expression,label){for(let i=0;i<120;i++){try{if(await evaluate(expression))return;}catch{}await delay(100)}throw Error('Browser timeout: '+label)}
 async function go(path,text){await send('Page.navigate',{url:'http://127.0.0.1:3002'+path});await wait(`location.pathname===${JSON.stringify(path)} && document.readyState==='complete' && document.body.innerText.includes(${JSON.stringify(text)})`,path)}
 await go('/login','Login');
 await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(run+'@example.invalid')};document.querySelector('[name=password]').value=${JSON.stringify(password)};document.querySelector('form').requestSubmit()`);
 await wait("location.pathname==='/dashboard' && document.body.innerText.includes('Pending synthetic')",'login/dashboard');
 console.log('PASS browser: real login, authenticated dashboard and pending fixture');
 await go('/transactions','Pending synthetic');await go('/transactions/'+pendingId,'Pending synthetic');
 async function edit(){await evaluate("[...document.querySelectorAll('button')].find(b=>b.querySelector('svg.lucide-pencil')).click()");await wait("!!document.querySelector('select')",'category editor')}
 async function save(){await evaluate(`document.querySelector('select').value=${JSON.stringify(category)};document.querySelector('select').dispatchEvent(new Event('change',{bubbles:true}))`);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Save Category').click()")}
 await edit();await save();await wait("document.body.innerText.includes('Successfully updated category')",'category success');
 check(sql(`SELECT category_id='${category}' AND category_source='manual' FROM public.transactions WHERE id='${pendingId}';`)==='t','Browser category database write');
 console.log('PASS browser: active category edit -> Server Action -> PostgreSQL -> success toast');
 // Keep the old pending editor open while the real RPC supersedes it.
 await edit();await sync([tx('-s',false,'-p')],'pending','posted');
 await save();await wait("document.body.innerText.includes('Could not update category. Refresh the transaction list')",'stale edit recovery');
 console.log('PASS browser: stale pending edit shows recovery failure after real reconciliation');
 const postedId=sql(`SELECT id FROM public.transactions WHERE plaid_transaction_id='${run}-s';`);
 await go('/transactions/'+postedId,'Posted synthetic');check(await evaluate("document.body.innerText.includes('Browser manual')"),'Inherited category UI');
 await go('/transactions','Posted synthetic');check(!(await evaluate("document.body.innerText.includes('Pending synthetic')")),'Pending list duplicate');
 await go('/accounts/'+account,'Posted synthetic');check(!(await evaluate("document.body.innerText.includes('Pending synthetic')")),'Pending account duplicate');
 await go('/dashboard','Posted synthetic');check(!(await evaluate("document.body.innerText.includes('Pending synthetic')")),'Pending dashboard duplicate');
 const valid=sql(`SELECT count(*)=1 AND sum(amount)=-52 FROM public.transactions WHERE user_id='${user}' AND NOT is_removed;`);check(valid==='t','Financial total');
 // Authenticated invalid input stops before any provider request.
 check(await evaluate("fetch('/api/plaid/sync-transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)")===400,'Sync route validation');
 console.log('PASS browser: inherited posted category, list/account/dashboard exclusion, active total -52, sync route validation');
 writeFileSync('/tmp/p32-posted-browser.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 check(errors.length===0,'Unexpected browser runtime exception');
 console.log('PASS browser: no uncaught runtime exceptions; screenshot /tmp/p32-posted-browser.png');
} finally {
 ws?.close();chrome?.kill();server?.kill();
 if(user){sql(`BEGIN; DELETE FROM public.transactions WHERE user_id='${user}';DELETE FROM public.accounts WHERE user_id='${user}';DELETE FROM public.plaid_items WHERE user_id='${user}';DELETE FROM public.categories WHERE user_id='${user}';COMMIT;`);await http('/auth/v1/admin/users/'+user,undefined,'DELETE');check(sql(`SELECT NOT EXISTS(SELECT FROM auth.users WHERE id='${user}') AND NOT EXISTS(SELECT FROM auth.sessions WHERE user_id='${user}') AND NOT EXISTS(SELECT FROM public.transactions WHERE user_id='${user}');`)==='t','Browser fixture cleanup');console.log('PASS browser cleanup: synthetic user, sessions and bank data removed')}
 await delay(300);rmSync(profile,{recursive:true,force:true});
 // No auth forms, cookies or request headers are logged.
}
