const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'ops-rules.js'),'utf8');
const fixture=`create role anon;create role authenticated;create schema crm_security;
create table users(user_id uuid primary key,auth_uid uuid,name text,active boolean default true);
create table crm_settings(key text primary key,value jsonb not null,updated_by uuid,updated_at timestamptz not null default now());
create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select u.user_id,u.auth_uid,u.name,current_setting('test.role',true) from public.users u where u.name='Test Admin'$$;
insert into users values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Test Admin',true);
set test.role='admin';`;
async function database(version){const db=new PGlite();await db.exec(fixture);await db.exec(fs.readFileSync(path.join(root,'sql/ops-rules-v1-20261004.sql'),'utf8'));if(version===2){const sql=fs.readFileSync(path.join(root,'sql/ops-rules-v2-20261010.sql'),'utf8');await db.exec(sql);await db.exec(sql);}return db;}
const call=(db,p)=>db.query('select public.crm_ops_rules_v1($1::jsonb) r',[JSON.stringify(p)]).then(r=>r.rows[0].r);
function client(rpc){const w={OPS_RULES:{},OpsStore:{has:()=>true,rpc},dispatchEvent(){}};w.window=w;vm.runInNewContext(source,w);return w;}
const kstToday=()=>new Date(Date.now()+9*36e5).toISOString().slice(0,10);
for(const version of [1,2])test('server fixture '+version+': unsupported apply commands never reach write RPC; drafts stay intact',async()=>{
 const db=await database(version);try{
  await call(db,{set:{assign_minutes:40}});let writes=0;
  const w=client((n,p)=>{if(p.set)writes++;return call(db,p)});await w.CRMRules.load(true);
  const before=JSON.stringify(await call(db,{}));
  for(const existing of ['keep','recalc','ask'])for(const effective_on of ['2099-01-01','2026-10-10','2000-01-01']){
   const changes={assign_minutes:10},application={effective_on,scope:'new inquiries',existing},draft=JSON.stringify({changes,application});
   await assert.rejects(w.CRMRules.save(changes,application),/아직 연결되지 않아 저장하지 않았습니다/);
   assert.equal(JSON.stringify({changes,application}),draft);assert.equal(w.CRMRules.get('assign_minutes'),40);assert.equal(w.OPS_RULES.inquiryAssignMinutes,40);
  }
  for(const invalid of [{},false,'keep'])await assert.rejects(w.CRMRules.save({assign_minutes:10},invalid),/저장하지 않았습니다/);
  assert.equal(writes,0);assert.equal(JSON.stringify(await call(db,{})),before);
 }finally{await db.close();}
});
test('server independently rejects unsupported apply, without changing settings/history',async()=>{
 const db=await database(2);try{await call(db,{set:{assign_minutes:40}});const before=JSON.stringify(await call(db,{}));
  for(const application of [null,{},false,{effective_on:'2099-01-01',scope:'new only'},{effective_on:'2000-01-01',scope:'past'},...['keep','recalc','ask',null].map(existing=>({effective_on:kstToday(),scope:'scope',existing})),{effective_on:kstToday(),scope:'\t\n'},{effective_on:kstToday(),scope:'x'.repeat(301)},{effective_on:kstToday(),scope:[]},{effective_on:kstToday(),scope:'ok',unknown:true}]){
   await assert.rejects(call(db,{set:{assign_minutes:10,record_deadline_hour:11},apply:application}),e=>e.code==='22023');
   assert.equal(JSON.stringify(await call(db,{})),before);
  }
 }finally{await db.close();}
});
test('today KST and exact scope are persisted and acknowledged; no-op preserves history',async()=>{
 const db=await database(2);try{
  await db.exec("set timezone='America/Los_Angeles'");
  const application={effective_on:kstToday(),scope:'검토 대상 설명 / 배정 기준'},w=client((n,p)=>call(db,p));
  await w.CRMRules.load();await w.CRMRules.save({assign_minutes:40},application);
  const r=await call(db,{set:{assign_minutes:50},apply:application});
  assert.equal(r.contract,3);assert.deepEqual(r.apply,application);assert.equal(r.history[0].effective_on,application.effective_on);assert.equal(r.history[0].scope,application.scope);assert.equal(r.history[0].existing,null);
  assert.equal(w.CRMRules.get('assign_minutes'),40);const n=r.version;
  const again=await call(db,{set:{assign_minutes:50},apply:application});assert.equal(again.changed,0);assert.equal(again.version,n);assert.deepEqual(again.apply,application);
  await db.exec("set test.role='rep'");await assert.rejects(call(db,{set:{assign_minutes:60},apply:application}),e=>e.code==='42501');
 }finally{await db.close();}
});
test('v1/v2 read capabilities prevent apply writes before server upgrade',async()=>{
 for(const contract of [1,2]){let writes=0;const w=client(async(n,p)=>{if(p.set)writes++;return {ok:true,contract,rules:{assign_minutes:40}}});await w.CRMRules.load();
  await assert.rejects(w.CRMRules.save({assign_minutes:10},{effective_on:kstToday(),scope:'scope'}),/contract 3/);assert.equal(writes,0);assert.equal(w.CRMRules.get('assign_minutes'),40);
 }
});
test('apply ACK must preserve exact conditions and contract before publishing values',async()=>{
 const ap={effective_on:kstToday(),scope:'scope'};
 for(const response of [{contract:2,apply:ap},{contract:3},{contract:3,apply:{...ap,scope:'other'}},{contract:3,apply:{...ap,effective_on:'2000-01-01'}},{contract:3,apply:{...ap,existing:'keep'}}]){
  const w=client(async(n,p)=>p.set?{ok:true,rules:{assign_minutes:10},...response}:{ok:true,contract:3,rules:{assign_minutes:40}});await w.CRMRules.load();
  await assert.rejects(w.CRMRules.save({assign_minutes:10},ap),/적용 조건/);assert.equal(w.CRMRules.get('assign_minutes'),40);
 }
});
test('null application from legacy UI keeps immediate save compatibility',async()=>{
 const db=await database(1);try{const w=client((n,p)=>call(db,p));await w.CRMRules.load();await w.CRMRules.save({assign_minutes:40},null);assert.equal(w.CRMRules.get('assign_minutes'),40);}finally{await db.close();}
});
test('apply input is captured before awaiting and mutations cannot alter the acknowledgement contract',async()=>{
 const pending=deferred(),ap={effective_on:kstToday(),scope:'scope'};let sent;
 const w=client((n,p)=>{if(!p.set)return Promise.resolve({ok:true,contract:3,rules:{assign_minutes:40}});sent=JSON.parse(JSON.stringify(p));return pending.promise});await w.CRMRules.load();
 const saving=w.CRMRules.save({assign_minutes:10},ap);ap.scope='changed';pending.resolve({ok:true,contract:3,rules:{assign_minutes:10},apply:sent.apply});await saving;assert.equal(w.CRMRules.get('assign_minutes'),10);assert.equal(sent.apply.scope,'scope');
});
test('KST contract uses next date after UTC 15:00, independently of browser timezone',async()=>{
 const NativeDate=Date;class FixedDate extends NativeDate{constructor(...a){super(...(a.length?a:['2026-10-09T15:01:00Z']))}static now(){return NativeDate.parse('2026-10-09T15:01:00Z')}};
 let sent;const w={Date:FixedDate,OPS_RULES:{},dispatchEvent(){},OpsStore:{has:()=>true,rpc:async(n,p)=>{sent=p;return {ok:true,contract:3,rules:{assign_minutes:p.set?10:40},apply:p.apply}}}};w.window=w;vm.runInNewContext(source,w);await w.CRMRules.load();
 await assert.rejects(w.CRMRules.save({assign_minutes:10},{effective_on:'2026-10-09',scope:'scope'}),/오늘/);
 await w.CRMRules.save({assign_minutes:10},{effective_on:'2026-10-10',scope:'scope'});assert.equal(sent.apply.effective_on,'2026-10-10');
});
test('legacy immediate value saves still work and non-admin writes remain forbidden',async()=>{
 const db=await database(2);try{const w=client((n,p)=>call(db,p));await w.CRMRules.load();await w.CRMRules.save({assign_minutes:40});assert.equal(w.CRMRules.get('assign_minutes'),40);
  await db.exec("set test.role='rep'");await assert.rejects(w.CRMRules.save({assign_minutes:50}),e=>e.code==='42501');assert.equal(w.CRMRules.get('assign_minutes'),40);assert.equal((await call(db,{})).rules.assign_minutes,40);
 }finally{await db.close();}
});
test('malformed or unconfirmed save ACK cannot reset the last confirmed client values',async()=>{
 for(const bad of [{},null,{ok:false,rules:{assign_minutes:10}},{ok:true,rules:[]},{ok:true,rules:{assign_minutes:30}}]){
  const w=client(async(n,p)=>p.set?bad:{ok:true,rules:{assign_minutes:40}});await w.CRMRules.load();await assert.rejects(w.CRMRules.save({assign_minutes:10}),/저장 결과/);assert.equal(w.CRMRules.get('assign_minutes'),40);
 }
});
test('network failure preserves the last confirmed client settings',async()=>{
 const w=client(async(n,p)=>{if(p.set)throw new Error('connection lost');return {ok:true,rules:{assign_minutes:40}}});await w.CRMRules.load();await assert.rejects(w.CRMRules.save({assign_minutes:10}),/connection lost/);assert.equal(w.CRMRules.get('assign_minutes'),40);
});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
const ack=(value,version)=>({ok:true,rules:{assign_minutes:value},version});
test('late read cannot overwrite an acknowledged save or its version',async()=>{
 const old=deferred();let reads=0;
 const w=client((n,p)=>p.set?Promise.resolve(ack(10,2)):++reads===1?Promise.resolve(ack(40,1)):old.promise);
 await w.CRMRules.load();const reading=w.CRMRules.load(true);await w.CRMRules.save({assign_minutes:10});
 old.resolve(ack(40,1));await reading;
 assert.equal(w.CRMRules.get('assign_minutes'),10);assert.equal(w.OPS_RULES.inquiryAssignMinutes,10);assert.equal(w.CRMRules.version().n,2);
});
test('read started before a write cannot publish stale values while the write is pending',async()=>{
 const old=deferred(),writing=deferred();let reads=0;
 const w=client((n,p)=>p.set?writing.promise:++reads===1?Promise.resolve(ack(40,2)):old.promise);
 await w.CRMRules.load();const reading=w.CRMRules.load(true),saving=w.CRMRules.save({assign_minutes:10});
 old.resolve(ack(30,1));await reading;assert.equal(w.CRMRules.get('assign_minutes'),40);
 writing.resolve(ack(10,3));await saving;assert.equal(w.CRMRules.get('assign_minutes'),10);
});
test('concurrent loads share the pending read instead of resolving with defaults',async()=>{
 const pending=deferred();let reads=0,secondDone=false;
 const w=client(()=>{reads++;return pending.promise});const first=w.CRMRules.load(true),second=w.CRMRules.load(true).then(v=>{secondDone=true;return v});
 await Promise.resolve();assert.equal(secondDone,false);assert.equal(reads,1);
 pending.resolve(ack(40,1));await first;await second;assert.equal(w.CRMRules.get('assign_minutes'),40);
});
test('overlapping saves are rejected and a failed write releases the guard',async()=>{
 const pending=deferred();let writes=0;
 const w=client((n,p)=>{if(!p.set)return Promise.resolve(ack(40,1));writes++;return writes===1?pending.promise:Promise.resolve(ack(20,2))});
 await w.CRMRules.load();const first=w.CRMRules.save({assign_minutes:10});
 const firstFailure=assert.rejects(first,/connection lost/);
 await assert.rejects(w.CRMRules.save({assign_minutes:20}),/저장 중/);assert.equal(writes,1);
 pending.reject(new Error('connection lost'));await firstFailure;assert.equal(w.CRMRules.get('assign_minutes'),40);
 await w.CRMRules.save({assign_minutes:20});assert.equal(writes,2);assert.equal(w.CRMRules.get('assign_minutes'),20);
});
test('load during a write waits for its confirmed result without starting another read',async()=>{
 const pending=deferred();let reads=0,readDone=false;
 const w=client((n,p)=>p.set?pending.promise:(reads++,Promise.resolve(ack(40,1))));await w.CRMRules.load();
 const saving=w.CRMRules.save({assign_minutes:10}),reading=w.CRMRules.load(true).then(()=>{readDone=true});
 await Promise.resolve();assert.equal(readDone,false);assert.equal(reads,1);
 pending.resolve(ack(10,2));await saving;await reading;assert.equal(w.CRMRules.get('assign_minutes'),10);
});
