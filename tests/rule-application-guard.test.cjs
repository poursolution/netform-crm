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
for(const version of [1,2])test('server v'+version+': apply commands never reach write RPC; existing values and drafts stay intact',async()=>{
 const db=await database(version);try{
  await call(db,{set:{assign_minutes:40}});let writes=0;
  const w=client((n,p)=>{if(p.set)writes++;return call(db,p)});await w.CRMRules.load(true);
  const before=JSON.stringify(await call(db,{}));
  for(const existing of ['keep','recalc','ask'])for(const effective_on of ['2099-01-01','2026-10-10','2000-01-01']){
   const changes={assign_minutes:10},application={effective_on,scope:'new inquiries',existing},draft=JSON.stringify({changes,application});
   await assert.rejects(w.CRMRules.save(changes,application),/아직 연결되지 않아 저장하지 않았습니다/);
   assert.equal(JSON.stringify({changes,application}),draft);assert.equal(w.CRMRules.get('assign_minutes'),40);assert.equal(w.OPS_RULES.inquiryAssignMinutes,40);
  }
  for(const invalid of [null,{},false,'keep'])await assert.rejects(w.CRMRules.save({assign_minutes:10},invalid),/저장하지 않았습니다/);
  assert.equal(writes,0);assert.equal(JSON.stringify(await call(db,{})),before);
 }finally{await db.close();}
});
test('server independently rejects apply from old clients, without changing settings/history',async()=>{
 const db=await database(2);try{await call(db,{set:{assign_minutes:40}});const before=JSON.stringify(await call(db,{}));
  for(const application of [null,{},false,{effective_on:'2099-01-01',scope:'new only',existing:'keep'},{existing:'recalc'},{existing:'ask'}]){
   await assert.rejects(call(db,{set:{assign_minutes:10,record_deadline_hour:11},apply:application}),e=>e.code==='22023');
   assert.equal(JSON.stringify(await call(db,{})),before);
  }
 }finally{await db.close();}
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
