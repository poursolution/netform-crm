'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const sql=fs.readFileSync(path.join(__dirname,'../sql/inquiry-memo-review-v1-20261008.sql'),'utf8');
const owner='10000000-0000-4000-8000-000000000001',boss='10000000-0000-4000-8000-000000000002';
const id='40000000-0000-4000-8000-000000000001';
const rid=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0');
const body=(n,res='미완료')=>({inquiry_id:id,type:'promise',request_id:rid(n),item_key:'p-photo',title:'사진 받기',source_text:'고객이 사진을 보내주신다',on_date:'2026-01-07',result:res});
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create schema crm_security;
 create table public.inquiries(id uuid primary key,assigned_to uuid,status text,brand text,inquiry_type text);
 create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,inquiry_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz default now(),constraint inquiry_audit_events_action_check check(action in ('field_update','inquiry_trash','inquiry_restore','inquiry_purge')));
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select current_setting('test.uid')::uuid,current_setting('test.uid')::uuid,'synthetic',current_setting('test.role') where current_setting('test.role')<>''$$;
 create function crm_security.can_inquiry(x uuid) returns boolean language sql as $$select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=x where a.permission_role='admin' or i.assigned_to=a.user_id)$$;
 set test.uid='${owner}'; set test.role='rep';
 insert into public.inquiries values('${id}','${owner}','배정완료','POUR솔루션',null);`);
 await db.exec(sql);
 return db;
}
const call=async(db,p)=>(await db.query('select public.crm_inquiry_memo_review_v1($1::jsonb) r',[JSON.stringify(p)])).rows[0].r;
const state=async db=>(await db.query(`select result,request_id from crm_security.inquiry_memo_reviews where inquiry_id='${id}' and kind='promise' and item_key='p-photo'`)).rows[0];
const counts=async db=>(await db.query('select (select count(*)::int from crm_security.inquiry_memo_receipts) receipts,(select count(*)::int from crm_security.inquiry_audit_events) events')).rows[0];

test('A → B → A 재전송은 최신 판단·감사 기록을 되돌리지 않는다',async()=>{
 const db=await setup();try{
  await call(db,body(1));await call(db,body(2,'완료'));
  await assert.rejects(call(db,body(1)),/이미 처리한 이전 요청/);
  assert.deepEqual(await state(db),{result:'완료',request_id:rid(2)});
  assert.deepEqual(await counts(db),{receipts:2,events:2});
  const replay=await call(db,body(2,'완료'));assert.equal(replay.replayed,true);assert.equal(replay.review.result,'완료');
  assert.deepEqual(await counts(db),{receipts:2,events:2});
  const history=(await db.query('select after_data from crm_security.inquiry_audit_events order by created_at')).rows;
  assert.equal(history[0].after_data.request_id,rid(1));assert.equal(history[1].after_data.request_id,rid(2));
 }finally{await db.close();}
});
test('같은 요청 ID의 다른 결과·근거·항목·작성자 재사용은 거절한다',async()=>{
 const db=await setup();try{
  await call(db,body(1));
  for(const change of [{result:'완료'},{item_key:'other'},{on_date:'2026-01-08'},{source_text:'다른 원문'},{title:'다른 약속'},{original_at:'2026-01-01T00:00:00Z'}]){
   await assert.rejects(call(db,{...body(1),...change}),/같은 요청 ID/);
  }
  await db.exec(`set test.uid='${boss}'; set test.role='admin'`);
  await assert.rejects(call(db,body(1)),/같은 요청 ID/);
  assert.deepEqual(await state(db),{result:'미완료',request_id:rid(1)});
  assert.deepEqual(await counts(db),{receipts:1,events:1});
 }finally{await db.close();}
});
test('재전송도 현재 담당·휴지통·로그인 권한을 먼저 확인한다',async()=>{
 const db=await setup();try{
  await call(db,body(1));
  await db.exec(`update public.inquiries set assigned_to='${boss}' where id='${id}'`);
  await assert.rejects(call(db,body(1)),/담당자 또는 관리자/);
  await db.exec(`set test.role='admin'; insert into crm_security.inquiry_audit_events(inquiry_id,action) values('${id}','inquiry_trash')`);
  await assert.rejects(call(db,body(1)),/문의를 찾을 수 없습니다/);
  await db.exec("set test.role=''");await assert.rejects(call(db,body(1)),/forbidden/);
 }finally{await db.close();}
});
test('영수증 저장 실패는 판단과 감사 기록도 함께 되돌린다',async()=>{
 const db=await setup();try{
  await db.exec(`create function crm_security.test_reject_receipt() returns trigger language plpgsql as $$begin raise exception 'synthetic receipt failure';end$$;
  create trigger test_reject before insert on crm_security.inquiry_memo_receipts for each row execute function crm_security.test_reject_receipt();`);
  await assert.rejects(call(db,body(1)),/synthetic receipt failure/);
  assert.equal(await state(db),undefined);assert.deepEqual(await counts(db),{receipts:0,events:0});
  await db.exec('drop trigger test_reject on crm_security.inquiry_memo_receipts');
  await call(db,body(1));assert.deepEqual(await counts(db),{receipts:1,events:1});
 }finally{await db.close();}
});
test('기존 마지막 요청을 이관하고 SQL 재실행해도 영수증을 덮어쓰지 않는다',async()=>{
 const db=await setup();try{
  await db.query(`insert into crm_security.inquiry_memo_reviews(inquiry_id,kind,item_key,title,source_text,on_date,result,decided_by_user_id,decided_by,request_id) values($1,'promise','p-photo','사진 받기','고객이 사진을 보내주신다','2026-01-07','미완료',$2,'synthetic',$3)`,[id,owner,rid(1)]);
  await db.exec(sql);assert.equal((await call(db,body(1))).replayed,true);
  await call(db,body(2,'완료'));await db.exec(sql);
  await assert.rejects(call(db,body(1)),/이미 처리한 이전 요청/);
  assert.deepEqual(await state(db),{result:'완료',request_id:rid(2)});
  assert.deepEqual(await counts(db),{receipts:2,events:1});
 }finally{await db.close();}
});
test('통화 날짜 보완 재전송도 최신 날짜를 유지하며 표 직접 접근은 차단한다',async()=>{
 const db=await setup();try{
  const a={inquiry_id:id,type:'call_supplement',request_id:rid(1),item_key:'call-1',on_date:'2026-01-07',source_text:'통화 완료'};
  await call(db,a);await call(db,{...a,request_id:rid(2),on_date:'2026-01-08'});
  await assert.rejects(call(db,a),/이미 처리한 이전 요청/);
  assert.equal((await db.query('select on_date::text d from crm_security.inquiry_memo_reviews')).rows[0].d,'2026-01-08');
  for(const role of ['anon','authenticated']){
   const p=(await db.query(`select has_table_privilege($1,'crm_security.inquiry_memo_receipts','SELECT,INSERT,UPDATE,DELETE') allowed`,[role])).rows[0];assert.equal(p.allowed,false);
  }
  const r=(await db.query("select relrowsecurity from pg_class where oid='crm_security.inquiry_memo_receipts'::regclass")).rows[0];assert.equal(r.relrowsecurity,true);
  assert.equal((await db.query("select has_function_privilege('anon','public.crm_inquiry_memo_review_v1(jsonb)','EXECUTE') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
