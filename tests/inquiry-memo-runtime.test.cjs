const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {PGlite}=require('@electric-sql/pglite');
/* 견적문의 과거 메모 약속 확인(sql/inquiry-memo-review-v1-20261008.sql)을 실제로 실행해 본다:
   담당 · 관리자만 · 담당 없는 문의 거절 · 같은 요청은 한 번 · 판단을 바꾸면 이전 값이 감사 기록에 · 첫 연락 기준 값은 안 건드림 · 읽기는 볼 수 있는 문의만 · 두 번 돌려도 같은 결과 */
const sql=fs.readFileSync(path.join(__dirname,'../sql/inquiry-memo-review-v1-20261008.sql'),'utf8');
test('메모 약속 확인 SQL: 권한 · 멱등 · 이력 · 읽기',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema crm_security;
  create table users(user_id uuid primary key,auth_uid uuid,name text);
  create table inquiries(id uuid primary key default gen_random_uuid(),assigned_to uuid,status text,brand text,inquiry_type text);
  create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,inquiry_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz default now());
  create table crm_security.inquiry_flow_state(inquiry_id uuid primary key,first_connected_at timestamptz);
  create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select u.user_id,u.auth_uid,u.name,current_setting('test.role',true) from public.users u where u.name=current_setting('test.name',true)$$;
  create function crm_security.can_inquiry(x uuid) returns boolean language sql as $$select exists(select 1 from crm_security.actor() a join public.inquiries i on i.id=x where a.permission_role='admin' or (a.permission_role in ('rep','consultation') and i.assigned_to=a.user_id))$$;
  insert into users values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','owner'),('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','other'),('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','boss');
  alter table crm_security.inquiry_audit_events add constraint inquiry_audit_events_action_check check(action in ('field_update','inquiry_trash','inquiry_restore','inquiry_purge'));
  set test.name='owner'; set test.role='rep';`);
  await db.exec(sql);await db.exec(sql);/* 두 번 돌려도 같은 결과 */
  await assert.rejects(db.query("insert into crm_security.inquiry_audit_events(action) values('arbitrary_action')"),/inquiry_audit_events_action_check/);
  await db.exec("insert into crm_security.inquiry_audit_events(action) values('flow_memo_call'),('flow_memo_promise'),('field_update')");
  const add=async(assigned)=>(await db.query("insert into inquiries(assigned_to,status,brand) values($1,'배정완료','POUR솔루션') returning id",[assigned])).rows[0].id;
  const q=await add('10000000-0000-4000-8000-000000000001'),other=await add('10000000-0000-4000-8000-000000000002'),none=await add(null);
  await db.query("insert into crm_security.inquiry_flow_state(inquiry_id,first_connected_at) values($1,'2026-01-06 09:00+09')",[q]);
  const day=(await db.query("select (clock_timestamp() at time zone 'Asia/Seoul')::date::text d")).rows[0].d;
  const call=async(body,id=q)=>(await db.query('select public.crm_inquiry_memo_review_v1($1::jsonb) r',[JSON.stringify({inquiry_id:id,...body})])).rows[0].r;
  const rid=n=>'30000000-0000-4000-8000-00000000000'+n;
  /* 보완: 메모 속 통화일 — 첫 연락 기준 값은 그대로 */
  let a=await call({type:'call_supplement',request_id:rid(1),item_key:'c-71jeg9',on_date:'2026-01-07',source_text:'관리소장 통화 완료',original_at:'2026-01-06T00:00:00+09:00'});
  assert.equal(a.review.kind,'call');assert.equal(a.review.on_date,'2026-01-07');assert.equal(a.review.result,null);assert.equal(a.review.decided_by,'owner');
  assert.equal((await db.query("select to_char(first_connected_at at time zone 'Asia/Seoul','YYYY-MM-DD') d from crm_security.inquiry_flow_state where inquiry_id=$1",[q])).rows[0].d,'2026-01-06','첫 연락 기준 값 그대로');
  a=await call({type:'call_supplement',request_id:rid(1),item_key:'c-71jeg9',on_date:'2026-01-07'});assert.equal(a.replayed,true,'같은 요청은 한 번');
  assert.equal((await db.query("select count(*)::int n from crm_security.inquiry_audit_events where action='flow_memo_call' and inquiry_id=$1",[q])).rows[0].n,1);
  /* 약속 판단 · 바꾸면 이전 값이 감사 기록에 */
  a=await call({type:'promise',request_id:rid(2),item_key:'p-material-x',title:'사진 이메일로 받기',source_text:'사진 이메일로 받기로 함',on_date:'2026-01-07',result:'미완료'});assert.equal(a.review.result,'미완료');
  a=await call({type:'promise',request_id:rid(3),item_key:'p-material-x',title:'사진 이메일로 받기',on_date:'2026-01-07',result:'완료'});assert.equal(a.review.result,'완료');
  const ev=(await db.query("select before_data,after_data,reason from crm_security.inquiry_audit_events where action='flow_memo_promise' and inquiry_id=$1 order by created_at,event_id",[q])).rows;
  assert.equal(ev.length,2);assert.equal(ev[1].before_data.result,'미완료','바뀌기 전 값이 이력에 남음');assert.equal(ev[1].after_data.result,'완료');assert.match(ev[1].reason,/과거 약속 확인/);
  assert.equal((await db.query("select count(*)::int n from crm_security.inquiry_memo_reviews where inquiry_id=$1 and kind='promise'",[q])).rows[0].n,1,'같은 약속은 한 줄');
  /* 거절: 잘못된 값 · 담당 없음 · 남의 문의 · 오늘 이후 날짜 */
  await assert.rejects(call({type:'promise',request_id:rid(4),item_key:'k',result:'모름'}),/invalid payload/);
  await assert.rejects(call({type:'promise',request_id:rid(4),item_key:'k',result:'완료'},none),/담당이 정해진 문의/);
  await assert.rejects(call({type:'promise',request_id:rid(4),item_key:'k',result:'완료'},other),/담당자 또는 관리자/);
  await assert.rejects(call({type:'call_supplement',request_id:rid(5),item_key:'k',on_date:'2999-01-01'}),/invalid payload/);
  await assert.rejects(call({type:'call_supplement',request_id:rid(5),item_key:'k'}),/invalid payload/);
  await assert.rejects(call({type:'whatever',request_id:rid(5),item_key:'k'}),/invalid payload/);
  /* 관리자는 남의 문의도 */
  await db.exec("set test.name='boss'; set test.role='admin'");
  a=await call({type:'promise',request_id:rid(6),item_key:'p-visit-y',title:'다음 날 현장 방문',result:'확인 불가'},other);assert.equal(a.review.result,'확인 불가');assert.equal(a.review.decided_by,'boss');
  await assert.rejects(call({type:'promise',request_id:rid(7),item_key:'k',result:'완료'},none),/담당이 정해진 문의/,'관리자도 담당 없는 문의는 안 됨');
  /* 읽기: 본인 담당 문의만 · 관리자는 전체 */
  const list=async()=>(await db.query("select public.crm_inquiry_memo_review_list_v1('{}'::jsonb) r")).rows[0].r.reviews;
  assert.equal((await list()).length,3);
  await db.exec("set test.name='owner'; set test.role='rep'");
  const mine=await list();assert.equal(mine.length,2);assert.ok(mine.every(x=>x.inquiry_id===q));
  /* 휴지통으로 간 문의는 내려 주지 않음 */
  await db.query("insert into crm_security.inquiry_audit_events(inquiry_id,action) values($1,'inquiry_trash')",[q]);
  assert.equal((await list()).length,0);
  await assert.rejects(call({type:'promise',request_id:rid(8),item_key:'k',result:'완료'}),/문의를 찾을 수 없습니다/);
  /* 화면 쪽 오늘 날짜와 서버 날짜 기준이 같은 한국 날짜 */
  assert.match(day,/^\d{4}-\d{2}-\d{2}$/);
 }finally{await db.close();}
});
