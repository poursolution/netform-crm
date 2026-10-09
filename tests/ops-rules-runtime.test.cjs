const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {PGlite}=require('@electric-sql/pglite');
/* 운영 기준 v2(sql/ops-rules-v2-20261010.sql)를 실제로 실행해 본다:
   관리자만 저장 · 새 항목 범위 · 중요 요청 종류는 빈 목록 허용(다른 목록은 1개 이상) · 지원되지 않는 적용 범위는 변경 전에 거절 · contract 2 · 두 번 돌려도 같은 결과 */
const v1=fs.readFileSync(path.join(__dirname,'../sql/ops-rules-v1-20261004.sql'),'utf8'),v2=fs.readFileSync(path.join(__dirname,'../sql/ops-rules-v2-20261010.sql'),'utf8');
test('운영 기준 v2 SQL: 권한 · 범위 · 빈 목록 · 적용 범위 이력',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema crm_security;
  create table users(user_id uuid primary key,auth_uid uuid,name text,active boolean default true);
  create table crm_settings(key text primary key,value jsonb not null,updated_by uuid,updated_at timestamptz not null default now());
  create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select u.user_id,u.auth_uid,u.name,current_setting('test.role',true) from public.users u where u.name=current_setting('test.name',true)$$;
  insert into users values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','송보람',true),('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','이필선',true);
  set test.name='송보람'; set test.role='admin';`);
  await db.exec(v1);/* 운영에는 v1 이 먼저 적용돼 있다 */
  await db.exec(v2);await db.exec(v2);/* 두 번 돌려도 같은 결과 */
  const call=async body=>(await db.query('select public.crm_ops_rules_v1($1::jsonb) r',[JSON.stringify(body)])).rows[0].r;
  let r=await call({});assert.equal(r.ok,true);assert.equal(r.contract,2);assert.equal(r.version,0);assert.deepEqual(r.rules,{});
  /* 새 항목 · 적용 범위 */
  await assert.rejects(call({set:{ongoing_unreachable_attempts:4,record_deadline_hour:11},apply:{effective_on:'2026-10-13',scope:'진행 중 영업건',existing:'keep'}}),/저장하지 않았습니다/);
  assert.equal((await call({})).version,0);
  r=await call({set:{ongoing_unreachable_attempts:4,record_deadline_hour:11}});
  assert.equal(r.changed,2);assert.equal(r.version,2);assert.equal(r.rules.ongoing_unreachable_attempts,4);assert.equal(r.rules.record_deadline_hour,11);
  assert.equal(r.history.length,2);assert.equal(r.history[0].effective_on,null);assert.equal(r.history[0].scope,null);assert.equal(r.history[0].existing,null);assert.equal(r.history[0].by,'송보람');
  /* 중요 요청 종류: 비어 있어도 됨 · 다른 목록은 1개 이상 */
  r=await call({set:{important_request_kinds:['첫 연락 요청']}});assert.deepEqual(r.rules.important_request_kinds,['첫 연락 요청']);
  r=await call({set:{important_request_kinds:[]}});assert.deepEqual(r.rules.important_request_kinds,[]);assert.equal(r.changed,1);
  await assert.rejects(call({set:{reasons_lost:[]}}),/1~20개/);
  /* 범위 · 모르는 항목 · 틀린 적용 값은 거절 */
  await assert.rejects(call({set:{record_deadline_hour:20}}),/범위를 벗어난 값/);
  await assert.rejects(call({set:{ongoing_unreachable_attempts:0}}),/범위를 벗어난 값/);
  await assert.rejects(call({set:{first_contact_hours:5}}),/바꿀 수 없는 항목/);
  await assert.rejects(call({set:{assign_minutes:40},apply:{existing:'delete'}}),/저장하지 않았습니다/);
  await assert.rejects(call({set:{assign_minutes:40},apply:{effective_on:'13/10/2026'}}),/저장하지 않았습니다/);
  await assert.rejects(call({set:{assign_minutes:40},apply:'keep'}),/저장하지 않았습니다/);
  /* 적용 범위 없이도 저장된다(예전 화면) · 같은 값은 이력에 안 남음 */
  r=await call({set:{assign_minutes:40}});assert.equal(r.changed,1);assert.equal(r.history[0].effective_on,null);
  r=await call({set:{assign_minutes:40}});assert.equal(r.changed,0);
  const n=(await db.query('select count(*)::int n from public.crm_rule_history')).rows[0].n;assert.equal(n,5);assert.equal(r.version,5);
  /* 관리자가 아니면 읽기만 */
  await db.exec("set test.name='이필선'; set test.role='rep'");
  r=await call({});assert.equal(r.rules.assign_minutes,40);
  await assert.rejects(call({set:{assign_minutes:30}}),/관리자만/);
 }finally{await db.close();}
});
