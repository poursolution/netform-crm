'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {PGlite}=require('@electric-sql/pglite');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const id='40000000-0000-4000-8000-000000000001',owner='10000000-0000-4000-8000-000000000001',boss='10000000-0000-4000-8000-000000000002';
const actionId='20000000-0000-4000-8000-000000000001',rid=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema crm_security; create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text);
 create table crm_security.access_review(reviewed_auth_uid uuid);
 create table crm_security.object_scope(user_id uuid,inquiry_id uuid);
 create table public.inquiries(id uuid primary key,assigned_to uuid,assignee_name text,status text,brand text,inquiry_type text,next_action_date date,updated_at timestamptz);
 create table public.next_actions(id uuid primary key default gen_random_uuid(),inquiry_id uuid,action_type text,title text,due_at timestamptz,assignee_name text,status text,created_at timestamptz,updated_at timestamptz);
 create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,inquiry_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz default now(),constraint inquiry_audit_events_action_check check(action in ('inquiry_next_set','inquiry_trash','inquiry_restore','inquiry_purge')));
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select auth.uid(),auth.uid(),'synthetic',current_setting('test.role') where auth.uid() is not null and current_setting('test.role')<>''$$;
 create function crm_security.can_inquiry(x uuid) returns boolean language sql as $$select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=x where a.permission_role='admin' or i.assigned_to=a.user_id)$$;
 set test.uid='${owner}'; set test.role='rep';
 insert into public.users values('${owner}','${owner}','synthetic'),('${boss}','${boss}','boss');
 insert into public.inquiries(id,assigned_to,assignee_name,status,brand) values('${id}','${owner}','synthetic','배정완료','POUR솔루션');`);
 await db.exec(read('sql/inquiry-memo-review-v1-20261008.sql'));
 await db.exec(read('sql/inquiry-memo-followup-v1-20261009.sql'));
 return db;
}
const call=async(db,p)=>(await db.query('select public.crm_inquiry_memo_followup_v1($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
const review=async(db,p)=>(await db.query('select public.crm_inquiry_memo_review_v1($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
const today=async db=>(await db.query("select (clock_timestamp() at time zone 'Asia/Seoul')::date::text d")).rows[0].d;
const body=async(db,n=1)=>({inquiry_id:id,request_id:rid(n),type:'promise',item_key:'p-photo',title:'사진 받기',source_text:'사진을 보내주신다',on_date:'2026-01-07',result:'미완료',next_action:{text:'[과거 약속] 사진 받기 다시 확인',due:await today(db),expected:null}});
const counts=async db=>(await db.query(`select (select count(*)::int from public.next_actions) actions,(select count(*)::int from crm_security.inquiry_memo_reviews) reviews,(select count(*)::int from crm_security.inquiry_audit_events) audits,(select count(*)::int from crm_security.inquiry_memo_followup_receipts) receipts`)).rows[0];
const insertAction=async(db,due='2026-01-08T06:00:00Z',title='기존 방문')=>{
 await db.query("insert into public.next_actions(id,inquiry_id,action_type,title,due_at,assignee_name,status) values($1,$2,'방문',$3,$4,'synthetic','open')",[actionId,id,title,due]);
 return {id:actionId,text:title,type:'방문',due:(await db.query("select ($1::timestamptz at time zone 'Asia/Seoul')::date::text d",[due])).rows[0].d};
};

test('DB: one commit writes both, replay creates no action/audit, changed request ID body rejected',async()=>{
 const db=await setup();try{
  const p=await body(db),r=await call(db,p);assert.equal(r.review.result,'미완료');assert.equal(r.next_action.status,'open');
  assert.deepEqual(await counts(db),{actions:1,reviews:1,audits:2,receipts:1});
  assert.equal((await call(db,p)).replayed,true);assert.deepEqual(await counts(db),{actions:1,reviews:1,audits:2,receipts:1});
  await assert.rejects(call(db,{...p,next_action:{...p.next_action,text:'다른 업무'}}),/같은 요청 ID/);
 }finally{await db.close();}
});
test('DB: existing overdue/future date, full timestamp, action identity/type and original work survive',async()=>{
 for(const due of ['2026-01-08T06:00:00Z','2030-01-08T06:00:00Z']){
  const db=await setup();try{
   const expected=await insertAction(db,due),p=await body(db);p.next_action={text:'[과거 약속] 사진 받기 다시 확인 (기존: 기존 방문)',due:expected.due,expected};
   const r=await call(db,p);assert.equal(r.next_action.id,actionId);assert.equal(r.next_action.type,'방문');assert.equal(Date.parse(r.next_action.due_at),Date.parse(due));
   assert.deepEqual(await counts(db),{actions:1,reviews:1,audits:2,receipts:1});
   const audit=(await db.query("select before_data,after_data from crm_security.inquiry_audit_events where action='inquiry_next_set'")).rows[0];
   assert.equal(audit.before_data.next_action.text,'기존 방문');assert.equal(audit.after_data.next_action_id,actionId);
  }finally{await db.close();}
 }
});
test('DB: stale snapshot, multiple actions and changed date fail before any review is saved',async()=>{
 const db=await setup();try{
  const expected=await insertAction(db),p=await body(db);
  for(const next of [{...p.next_action},{text:'new',due:expected.due,expected:{...expected,text:'stale'}},{text:'new',due:await today(db),expected}]){
   await assert.rejects(call(db,{...p,next_action:next}),/기존 할 일이 변경/);
  }
  await db.query("insert into public.next_actions(inquiry_id,title,status) values($1,'second','open')",[id]);
  await assert.rejects(call(db,{...p,next_action:{text:'new',due:expected.due,expected}}),/여러 할 일/);
  assert.deepEqual(await counts(db),{actions:2,reviews:0,audits:0,receipts:0});
 }finally{await db.close();}
});
test('DB: failures in action, action audit, and receipt roll back both writes and all history',async()=>{
 for(const table of ['public.next_actions','crm_security.inquiry_audit_events','crm_security.inquiry_memo_followup_receipts']){
  const db=await setup();try{
   await db.exec(`create function crm_security.test_reject() returns trigger language plpgsql as $$begin raise exception 'synthetic fail';end$$;
    create trigger reject before insert on ${table} for each row ${table.endsWith('inquiry_audit_events')?"when (new.action='inquiry_next_set')":''} execute function crm_security.test_reject();`);
   await assert.rejects(call(db,await body(db)),/synthetic fail/);assert.deepEqual(await counts(db),{actions:0,reviews:0,audits:0,receipts:0});
   assert.equal((await db.query('select count(*)::int n from crm_security.inquiry_memo_receipts')).rows[0].n,0);
  }finally{await db.close();}
 }
});
test('DB: A → completed B → replay A and changed next action never return stale success',async()=>{
 const db=await setup();try{
  const p=await body(db);await call(db,p);
  const b={...p,request_id:rid(2),result:'완료'};delete b.next_action;await review(db,b);
  await assert.rejects(call(db,p),/이미 처리한 이전 요청/);
  assert.equal((await db.query('select result from crm_security.inquiry_memo_reviews')).rows[0].result,'완료');
  await db.exec("update public.next_actions set status='completed'");await assert.rejects(call(db,p),/처리 후 할 일이 변경/);
  assert.deepEqual(await counts(db),{actions:1,reviews:1,audits:3,receipts:1});
 }finally{await db.close();}
});
test('DB: legacy review-only receipt cannot be repurposed into a followup write',async()=>{
 const db=await setup();try{
  const p=await body(db),old={...p};delete old.next_action;await review(db,old);
  await assert.rejects(call(db,p),/이미 사용한 판단 요청/);assert.equal((await counts(db)).actions,0);
 }finally{await db.close();}
});
test('DB: current owner/role/closed/trash/auth checks precede replay; table and anon RPC stay private',async()=>{
 const db=await setup();try{
  const p=await body(db);await call(db,p);
  await db.exec(`update public.inquiries set assigned_to='${boss}'`);await assert.rejects(call(db,p),/forbidden/);
  await db.exec(`update public.inquiries set assigned_to='${owner}',status='실주'`);await assert.rejects(call(db,p),/종료되거나/);
  await db.exec("update public.inquiries set status='배정완료'; set test.role='viewer'");await assert.rejects(call(db,p),/forbidden/);
  await db.exec("set test.role='rep'; set test.uid=''");await assert.rejects(call(db,p),/forbidden/);
  await db.exec(`set test.uid='${owner}'; insert into crm_security.inquiry_audit_events(inquiry_id,action) values('${id}','inquiry_trash')`);await assert.rejects(call(db,p),/종료되거나/);
  for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_table_privilege($1,'crm_security.inquiry_memo_followup_receipts','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_inquiry_memo_followup_v1(jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});

function client(){
 const patch={},sent=[],q={id,raw:{응대내용:'사진은 메일로 보내주신다.'}};let split=0;
 const ctx={Intl,Date,Map,WeakMap,Set,Math,JSON,G:{},ME:{name:'synthetic'},inquiryAssigned:()=>true,inqCtlIsAdmin:()=>true,repN:x=>x||'',inqKey:q=>q.id,itemPatch:()=>patch,detailPatchFor:()=>patch,saveLocal(){},actionObj:()=>q.nextActionObj||null,InquiryCommand:{run:()=>{split++;return true;}},localStorage:{getItem:()=>null,setItem(){}}};
 const ok=b=>({ok:true,inquiry_id:id,request_id:b.request_id,review:{kind:'promise',item_key:b.item_key,result:'미완료',decided_at:'2026-10-09'},next_action:{id:actionId,type:'전화',text:b.next_action.text,due:b.next_action.due,due_at:b.next_action.due+'T00:00:00+09:00',assignee:'synthetic',status:'open'}});
 let reply=async b=>ok(b);ctx.OpsStore={has:()=>true,rpc:async(n,b)=>{sent.push({name:n,body:b});return reply(b);}};
 vm.createContext(ctx);vm.runInContext(read('inquiry-memo.js'),ctx);const M=ctx.InquiryMemo,key=M.scan(q).promises[0].key;
 return {M,q,patch,ctx,sent,key,ok,split:()=>split,reply:f=>{reply=f;},save:()=>M.run('promise',q,{key,res:'미완료'})};
}
test('client: only one atomic RPC, no optimistic followup or judgment before ACK',async()=>{
 const t=client();let resolve;t.reply(b=>new Promise(r=>{resolve=()=>r(t.ok(b));}));const pending=t.save();await new Promise(r=>setImmediate(r));
 assert.equal(t.split(),0);assert.equal(t.q.nextActionObj,undefined);assert.equal(t.M.pendingN(t.q),1);assert.equal(t.patch.activities,undefined);
 assert.equal(t.sent[0].name,'crm_inquiry_memo_followup_v1');resolve();assert.equal(await pending,true);
 assert.equal(t.q.nextActionObj.id,actionId);assert.equal(t.M.pendingN(t.q),0);assert.equal(t.patch.activities.length,1);
});
test('client: lost response retries same ID/body; other decisions blocked until resolved',async()=>{
 const t=client();t.reply(async()=>{throw Error('network failed');});await assert.rejects(t.save(),/network/);
 assert.equal(t.q.nextActionObj,undefined);assert.equal(t.M.pendingN(t.q),1);
 assert.throws(()=>t.M.run('promise',t.q,{key:t.key,res:'완료'}),/저장 확인이 남아/);
 t.reply(async b=>t.ok(b));await t.save();assert.deepEqual(t.sent[1].body,t.sent[0].body);assert.equal(t.split(),0);
});
test('client: malformed review or action ACK publishes neither; missing gate never splits writes',async()=>{
 for(const mutate of [r=>{r.review.result='완료';},r=>{r.next_action.text='wrong';},r=>{r.request_id=rid(99);},r=>{r.next_action.status='completed';}]){
  const t=client();t.reply(async b=>{const r=t.ok(b);mutate(r);return r;});await assert.rejects(t.save(),/확인 응답/);
  assert.equal(t.q.nextActionObj,undefined);assert.equal(t.M.pendingN(t.q),1);assert.equal(t.patch.activities,undefined);
 }
 const t=client();t.ctx.OpsStore.has=n=>n!=='crm_inquiry_memo_followup_v1';assert.throws(()=>t.save(),/서버 저장 연결/);assert.equal(t.sent.length,0);assert.equal(t.split(),0);
});
test('client: unconfirmed local action is blocked; real existing action includes optimistic lock snapshot',async()=>{
 const t=client();t.q.nextActionObj={text:'existing',due:'2026-01-08',type:'방문'};
 await assert.rejects(t.save(),/기존 할 일의 서버 확인/);assert.equal(t.sent.length,0);
 t.q.nextActionObj.id=actionId;t.reply(async b=>({...t.ok(b),next_action:{...t.ok(b).next_action,type:'방문'}}));await t.save();
 assert.deepEqual(JSON.parse(JSON.stringify(t.sent[0].body.next_action.expected)),{id:actionId,text:'existing',type:'방문',due:'2026-01-08'});
 assert.equal(t.q.nextActionObj.due,'2026-01-08');assert.match(t.q.nextActionObj.text,/existing/);
});
