import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
/* 지원 업무 종결 v1(2026-10-22): 제약 확장 · 종결 명령 · 전송 함수 갈림 — 합성 표(운영 표의 필요한 칸만) 위에서 검사 */
const sql=readFileSync(new URL('../sql/deal-close-support-v1-20261022.sql',import.meta.url),'utf8');
const REP='22222222-2222-4222-8222-222222222222',REP_AUTH='bbbbbbbb-2222-4222-8222-222222222222';
const DEAL='33333333-3333-4333-8333-333333333333',ORG='44444444-4444-4444-8444-444444444444';

test('지원 업무 종결: support 종료값 · 명령 · 전송 갈림',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema crm_security; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create table public.users(user_id uuid primary key, name text not null, email text, role text not null default 'rep', active boolean not null default true, auth_uid uuid);
   create table crm_security.access_review(user_id uuid primary key, reviewed_auth_uid uuid not null, source_role text, permission_role text not null, approved boolean not null, expires_at timestamptz not null);
   create function crm_security.actor() returns table(user_id uuid, auth_uid uuid, display_name text, permission_role text) language sql stable as $$
    select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id where u.auth_uid=auth.uid() and u.active and r.approved and r.expires_at>now() $$;
   create table crm_security.object_scope(user_id uuid, deal_id uuid);
   create function crm_security.can_deal(p_id uuid, p_write boolean) returns boolean language sql stable as $$ select true $$;
   create table public.deals(id uuid primary key, organization_id uuid, stage_code text, stage_raw text, stage_group text, lifecycle_status text not null default 'active', outcome text,
    closed_at timestamptz, stage_entered_at timestamptz, stage_contexts jsonb not null default '{}'::jsonb, last_activity_at timestamptz, lost_reason text, lost_kind text, badfit_type text,
    next_action text, next_action_date date, updated_at timestamptz, version integer not null default 0,
    constraint deals_outcome_check check (outcome is null or outcome in ('won','lost','badfit','nocontact')),
    constraint deals_closed_stage_consistent check (stage_code is null or stage_code not in ('won','lost','badfit_lead','badfit_pipe','nocontact') or lifecycle_status='closed'));
   create table public.next_actions(id uuid primary key default gen_random_uuid(), deal_id uuid, status text, completed_at timestamptz, updated_at timestamptz, created_at timestamptz default now());
   create table public.stage_history(id uuid primary key default gen_random_uuid(), opportunity_id uuid, from_stage text, to_stage text, reason text, actor_id uuid, actor_name text, changed_at timestamptz);
   create table public.activities(id uuid primary key default gen_random_uuid(), deal_id uuid, organization_id uuid, actor_email text, actor_name text, type text, detail jsonb, occurred_at timestamptz);
   create table crm_security.deal_close_events(event_id uuid primary key default gen_random_uuid(), request_id uuid not null unique, deal_id uuid not null, from_stage text not null,
    outcome text not null check(outcome in ('lost','badfit','nocontact')), closed_date date not null, category text not null, detail text not null, reason_source text not null,
    actor_auth_uid uuid not null, actor_user_id uuid not null, recorded_at timestamptz not null, stage_history_id uuid not null, activity_id uuid not null, completed_action_ids jsonb not null);
   create table crm_security.audit_events(event_id uuid primary key default gen_random_uuid(), actor_auth_uid uuid, actor_user_id uuid, actor_name text, deal_id uuid, action text, before_data jsonb, after_data jsonb, reason text, created_at timestamptz);
   create table crm_security.command_receipts(actor_auth_uid uuid, request_id uuid, actor_user_id uuid, operation text, object_id uuid, expected_version integer, payload jsonb, ack jsonb, primary key(actor_auth_uid,request_id));
   create function public.crm_write_command_v2(p_request_id uuid,p_operation text,p_object_id uuid,p_expected_version integer,p_payload jsonb) returns jsonb language sql as $$ select jsonb_build_object('ok',true,'route','previous','operation',p_operation) $$;
   insert into public.users values ('${REP}','이필선','rep@x','rep',true,'${REP_AUTH}');
   insert into crm_security.access_review values ('${REP}','${REP_AUTH}','rep','rep',true,'infinity');
   insert into public.deals(id,organization_id,stage_code,stage_group,version) values ('${DEAL}','${ORG}','compete','경쟁·임박',3);
   insert into public.next_actions(deal_id,status) values ('${DEAL}','open');
  `);
  await db.exec(sql);await db.exec(sql);/* 다시 실행해도 안전 */
  const as=uid=>db.exec(`select set_config('test.uid','${uid||''}',false);`);
  const one=async(sql,args)=>(await db.query(sql,args)).rows[0];
  const write=(op,payload,req='55555555-5555-4555-8555-555555555555',ver=3)=>one('select public.crm_write_command_v2($1::uuid,$2,$3::uuid,$4,$5::jsonb) as r',[req,op,DEAL,ver,JSON.stringify(payload)]).then(x=>x.r);
  const good={from:'compete',outcome:'support',closed_date:null,category:'PT 지원',detail:'입대의 PT 지원 완료 · 시공사는 타사',reason_source:'structured',note:'PT 지원 · 입대의 PT 지원 완료 · 시공사는 타사'};

  /* 제약: support 가 들어간다 · 다른 값은 막힌다 */
  await assert.rejects(db.exec(`update public.deals set outcome='other' where id='${DEAL}'`),/deals_outcome_check/);
  assert.match((await one("select pg_get_constraintdef(oid) d from pg_constraint where conname='deals_closed_stage_consistent'")).d,/'support'/);
  assert.match((await one("select pg_get_constraintdef(oid) d from pg_constraint where conname='deal_close_events_outcome_check'")).d,/'support'/);

  /* 전송 갈림: support 가 아니면 이전 함수로 */
  await as(REP_AUTH);
  assert.equal((await write('close',{...good,outcome:'lost'})).route,'previous');
  assert.equal((await write('transition',{to:'sent'})).route,'previous');

  /* 로그인 없음 · 잘못된 종류 · 짧은 내용 · 종료 단계에서 */
  await as('');await assert.rejects(write('close',good),/forbidden/);
  await as(REP_AUTH);
  await assert.rejects(write('close',{...good,category:'아무거나'}),/invalid close category/);
  await assert.rejects(write('close',{...good,detail:'짧다'}),/invalid support close payload/);
  await assert.rejects(write('close',{...good,from:'lost'}),/invalid support close payload/);
  await assert.rejects(write('close',{...good,from:'sent'}),/close state conflict/);
  await assert.rejects(write('close',good,'55555555-5555-4555-8555-555555555555',2),/version conflict/);

  /* 종결 */
  const ack=await write('close',good);
  assert.equal(ack.ok,true);assert.equal(ack.outcome,'support');assert.equal(ack.stage_code,'support');assert.equal(ack.lifecycle_status,'closed');assert.equal(ack.version,4);assert.equal(ack.replayed,false);
  const d=await one(`select stage_code,stage_raw,stage_group,lifecycle_status,outcome,lost_reason,badfit_type,version,stage_contexts from public.deals where id='${DEAL}'`);
  assert.deepEqual([d.stage_code,d.stage_raw,d.stage_group,d.lifecycle_status,d.outcome,d.lost_reason,d.badfit_type,d.version],['support','지원 업무 종결','closed','closed','support',null,null,4]);
  assert.equal(d.stage_contexts.support.fields.close_reason,'PT 지원');assert.equal(d.stage_contexts.support.terminal,true);
  assert.equal((await one(`select count(*)::int n from public.next_actions where deal_id='${DEAL}' and status='open'`)).n,0,'열린 다음 할 일은 완료 처리');
  assert.deepEqual((await one(`select to_stage,reason from public.stage_history where opportunity_id='${DEAL}'`)),{to_stage:'support',reason:'PT 지원 · 입대의 PT 지원 완료 · 시공사는 타사'});
  const ev=await one(`select outcome,category,from_stage from crm_security.deal_close_events where deal_id='${DEAL}'`);
  assert.deepEqual(ev,{outcome:'support',category:'PT 지원',from_stage:'compete'});
  assert.equal((await one(`select type,detail->>'note' as n from public.activities where deal_id='${DEAL}'`)).n,'support');

  /* 같은 요청 다시 = 재생(replayed) · 다른 내용으로 같은 요청 번호 = 거절 */
  assert.equal((await write('close',good)).replayed,true);
  await assert.rejects(write('close',{...good,detail:'다른 내용으로 다시 보냄'}),/REQUEST_ID_REUSE/);
  /* 이미 닫힌 건은 다시 못 닫는다 */
  await assert.rejects(write('close',good,'66666666-6666-4666-8666-666666666666',4),/close state conflict/);
 }finally{await db.close();}
});
