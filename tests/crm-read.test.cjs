const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const R=require('../crm-read.js');
const url='https://example.supabase.co/rest/v1/rpc/crm_read_bundle';
const session={access_token:'test-token',user:{id:'actor-a'}};
const bundle=()=>({generated_at:'2026-09-05T10:00:00Z',deals:[],inquiries:[],dups:[],users:[],brands:{},leads:{},_crmRead:{version:1,actorId:'actor-a',scope:'own'}});
const client={auth:{getSession:async()=>({data:{session}})}};
const options=extra=>({client,url,key:'publishable-test',...extra});
test('Supabase POST only, verified token and public API key; zero rows allowed',async()=>{
 let calls=0;
 const result=await R.read(options({fetch:async(u,o)=>{
  calls++;assert.equal(u,url);assert.equal(o.method,'POST');assert.equal(o.body,'{}');
  assert.equal(o.headers.apikey,'publishable-test');assert.equal(o.headers.Authorization,'Bearer test-token');
  assert.equal(o.cache,'no-store');return new Response(JSON.stringify(bundle()));
 }}));
 assert.equal(calls,1);assert.deepEqual(result.deals,[]);
});
test('anonymous request never contacts any server',async()=>{
 let calls=0;
 await assert.rejects(R.read(options({client:{auth:{getSession:async()=>({data:{session:null}})}},fetch:async()=>calls++})),/로그인/);
 assert.equal(calls,0);
});
test('parallel loads share one network call, not mutable bundle instances',async()=>{
 let calls=0,release;
 const gate=new Promise(r=>release=r);
 const opt=options({fetch:async()=>{calls++;await gate;return new Response(JSON.stringify(bundle()))}});
 const a=R.read(opt),b=R.read(opt);await new Promise(r=>setImmediate(r));release();
 const [x,y]=await Promise.all([a,b]);assert.equal(calls,1);x.deals.push({id:'local'});assert.equal(y.deals.length,0);
});
test('HTTP failures do not retry or fall back to n8n',async()=>{
 for(const status of [401,403,404,429,500]){
  let calls=0;
  await assert.rejects(R.read(options({fetch:async()=>{calls++;return new Response('{}',{status})}})),new RegExp('HTTP '+status));
  assert.equal(calls,1);
 }
});
test('timeout aborts the request and releases the pending entry',async()=>{
 await assert.rejects(R.read(options({timeoutMs:5,fetch:async(u,o)=>new Promise((resolve,reject)=>{
  o.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')));
 })})),/시간이 초과/);
 assert.deepEqual((await R.read(options({fetch:async()=>new Response(JSON.stringify(bundle()))}))).deals,[]);
});
test('untrusted/malformed/unscoped response fails closed',()=>{
 for(const x of [null,[],{}, {...bundle(),deals:{}},{...bundle(),_crmRead:undefined},{...bundle(),generated_at:'bad'},
  {...bundle(),_crmRead:{version:1,actorId:'other',scope:'all'}}, {...bundle(),_crmRead:{version:2,actorId:'actor-a',scope:'all'}}])
  assert.throws(()=>R.validate(x,'actor-a'));
});
test('logout or account switch during a request discards its result',async()=>{
 let n=0;
 const changing={auth:{getSession:async()=>({data:{session:++n===1?session:null}})}};
 await assert.rejects(R.read(options({client:changing,fetch:async()=>new Response(JSON.stringify(bundle()))})),/계정이 바뀌어/);
});
test('existing PC response consumer is compatible',async()=>{
 const response=await R.response(options({fetch:async()=>new Response(JSON.stringify(bundle()))}));
 assert.equal(response.status,200);assert.deepEqual(JSON.parse(await response.text()),bundle());
});
test('PC and mobile use the same Production Supabase transport with legacy n8n write disabled',()=>{
 for(const file of ['crm.html','mobile.html']){
  const html=fs.readFileSync(require.resolve('../'+file),'utf8');
  assert.match(html,/<script src="crm-read\.js/);
  assert.match(html,/rest\/v1\/rpc\/crm_read_bundle/);
  assert.match(html,/<script src="\.\/phase1-config\.js"><\/script><script src="\.\/operational-adapter\.js"><\/script><script src="\.\/transport\.js"><\/script>/);
  assert.match(html,/var WRITE_API='urn:netform-crm:legacy-write-disabled'/);
  assert.doesNotMatch(html,/nfrnd\.app\.n8n\.cloud/);
  assert.match(html,/var SYNC_MS=120000/);
 }
 const mobile=fs.readFileSync(require.resolve('../mobile.html'),'utf8');
 assert.doesNotMatch(mobile,/fetch\(CRM_API/);
 const pc=fs.readFileSync(require.resolve('../crm.html'),'utf8');
 assert.doesNotMatch(pc,/var c=localStorage.getItem\(CACHE_KEY\)/);
});
test('SQL reader authorizes table UUIDs, not display names or email claims',()=>{
 const sql=fs.readFileSync(require.resolve('../sql/20260905_crm_direct_read.sql'),'utf8');
 assert.match(sql,/actor:=crm_private\.uuid_actor\(\)/);
 assert.match(sql,/join public\.deals d on d\.id::text=e->>'id'/);
 assert.match(sql,/uuid_can_read_deal\(d\.assignee_user_id,d\.crm_team_id\)/);
 assert.match(sql,/uuid_can_read_inquiry\(i\.assignee_user_id,i\.crm_team_id\)/);
 assert.doesNotMatch(sql,/assignee['"]?\s*=\s*actor\.name|auth\.jwt\(\).*email/);
 assert.match(sql,/revoke execute on function public\.crm_bundle\(\) from public,anon,authenticated/);
});
