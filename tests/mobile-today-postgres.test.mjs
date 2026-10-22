import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
/* 모바일 오늘 업무 가벼운 조회 v1(2026-10-22): 내 열린 영업건 · 내 문의만 · 카드 칸만 · 권한 함수로 다시 거름 · 한도 */
const sql=readFileSync(new URL('../sql/mobile-today-v1-20261022.sql',import.meta.url),'utf8');
const REP='22222222-2222-4222-8222-222222222222',REP_AUTH='bbbbbbbb-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333';
test('모바일 오늘 조회: 내 열린 건만 · 작은 투영 · 한도',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema crm_security; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create table public.users(user_id uuid primary key, name text not null, active boolean not null default true, auth_uid uuid);
   create table crm_security.access_review(user_id uuid primary key, reviewed_auth_uid uuid not null, permission_role text not null, approved boolean not null, expires_at timestamptz not null);
   create function crm_security.actor() returns table(user_id uuid, auth_uid uuid, display_name text, permission_role text) language sql stable as $$
    select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id where u.auth_uid=auth.uid() and u.active and r.approved and r.expires_at>now() $$;
   create table crm_security.hidden(id uuid primary key);
   create function crm_security.can_deal(p_id uuid, p_write boolean) returns boolean language sql stable as $$ select not exists(select 1 from crm_security.hidden h where h.id=p_id) $$;
   create function crm_security.can_inquiry(p_id uuid) returns boolean language sql stable as $$ select not exists(select 1 from crm_security.hidden h where h.id=p_id) $$;
   create table public.sites(site_id uuid primary key, site_name text, address text);
   create table public.organizations(id uuid primary key, name text);
   create table public.deals(id uuid primary key default gen_random_uuid(), site_id uuid, organization_id uuid, owner_id uuid, assignee_name text, stage_code text, stage_raw text, stage_group text, brand text, list_name text, list_fields jsonb default '{}'::jsonb,
    amount bigint, amount_unknown_reason text, created_at timestamptz default now(), updated_at timestamptz default now(), closed_at timestamptz, opened_at timestamptz, lifecycle_status text default 'active', outcome text, wake_up_at timestamptz,
    stage_entered_at timestamptz, last_activity_at timestamptz, last_customer_contact_at timestamptz, origin_inquiry_id uuid, origin_channel text, source text, service_type text, primary_work text, work_items jsonb, work_scope_type text, work_summary text,
    stage_checklist jsonb, stage_contexts jsonb default '{}'::jsonb, version integer default 0, office_phone text, manager_name text, manager_mobile text, manager_role text, person_key text);
   create table public.next_actions(id uuid primary key default gen_random_uuid(), deal_id uuid, action_type text, title text, due_at timestamptz, assignee_name text, status text);
   create table public.inquiries(id uuid primary key default gen_random_uuid(), site_id uuid, site_name text, brand text, inquiry_type text, work_type text, source_channel text, channel text, assigned_to uuid, assignee_name text, status text, deal_id uuid, opportunity_id uuid,
    received_at timestamptz, created_at timestamptz default now(), updated_at timestamptz, assigned_at timestamptz, first_response_at timestamptz, responded_at timestamptz, next_action_date date, contact_name text, phone text);
   insert into public.users values ('${REP}','이필선',true,'${REP_AUTH}'),('${OTHER}','한준엽',true,null);
   insert into crm_security.access_review values ('${REP}','${REP_AUTH}','rep',true,'infinity');
   insert into public.sites values ('aaaaaaaa-0000-4000-8000-000000000001','합성 아파트','합성시 1');
   insert into public.deals(id,site_id,owner_id,stage_code,brand,amount,manager_name,manager_mobile) values
    ('11111111-1111-4111-8111-000000000001','aaaaaaaa-0000-4000-8000-000000000001','${REP}','compete','POUR솔루션',100,'소장','01000000000'),
    ('11111111-1111-4111-8111-000000000002','aaaaaaaa-0000-4000-8000-000000000001','${REP}','sent','POUR솔루션',200,null,null),
    ('11111111-1111-4111-8111-000000000003',null,'${OTHER}','sent','POUR솔루션',300,null,null);
   insert into public.deals(id,owner_id,assignee_name,stage_code,lifecycle_status,outcome) values ('11111111-1111-4111-8111-000000000004','${REP}',null,'lost','closed','lost');
   insert into public.deals(id,owner_id,assignee_name,stage_code) values ('11111111-1111-4111-8111-000000000005',null,'이필선','consulting'),('11111111-1111-4111-8111-000000000006','${REP}',null,'rapport');
   insert into crm_security.hidden values ('11111111-1111-4111-8111-000000000006');
   insert into public.next_actions(deal_id,action_type,title,due_at,status) values ('11111111-1111-4111-8111-000000000001','전화','견적 검토 확인','2026-10-20T09:00:00Z','open'),('11111111-1111-4111-8111-000000000001','방문','끝난 일','2026-10-01T09:00:00Z','completed');
   insert into public.inquiries(id,site_name,assigned_to,status,phone) values ('99999999-1111-4111-8111-000000000001','문의 A','${REP}','배정완료','01000000001'),('99999999-1111-4111-8111-000000000002','문의 B','${OTHER}','배정완료','01000000002');
   insert into public.inquiries(id,site_name,assigned_to,assignee_name,status) values ('99999999-1111-4111-8111-000000000003','문의 C',null,'이필선','응대중');
  `);
  await db.exec(sql);await db.exec(sql);
  const as=uid=>db.exec(`select set_config('test.uid','${uid||''}',false);`);
  const one=async(q,args)=>(await db.query(q,args)).rows[0];
  const today=lim=>one('select public.crm_mobile_today_v1($1) as r',[lim==null?null:lim]).then(x=>x.r);
  await as('');await assert.rejects(today(),/forbidden/);
  await as(REP_AUTH);
  const r=await today();
  assert.equal(r.ok,true);assert.equal(r.scope,'actor_own_open_only');assert.equal(r.limit,500);
  assert.deepEqual(r.deals.map(d=>d.id),['11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000002','11111111-1111-4111-8111-000000000005'],'내 열린 건만(남 · 종료 · 권한 밖 제외) · 이름 담당도 포함');
  const d1=r.deals[0];
  assert.equal(d1.site_name,'합성 아파트');assert.equal(d1.site,'합성 아파트');assert.equal(d1.owner_name,'이필선');assert.equal(d1.assignee,'이필선');assert.equal(d1.amt,100);assert.equal(d1.call_phone,'01000000000');assert.equal(d1.has_contact,true);
  assert.deepEqual([d1.next_action.type,d1.next_action.text,d1.next_action.status],['전화','견적 검토 확인','open'],'열린 다음 할 일 하나');
  assert.deepEqual([d1.contacts,d1.activity_signals,d1.stage_history,d1.completed_actions,d1.quote_versions],[[],[],[],[],[]],'무거운 칸은 빈 배열');
  assert.equal(d1.mobile_today_partial,true);assert.equal(r.deals[1].next_action,null);
  assert.ok(!('lost_reason' in d1)&&!('attachments' in d1),'불필요한 칸 없음');
  assert.deepEqual(r.inquiries.map(i=>i.site_name),['문의 A','문의 C'],'내 문의만(이름 배정 포함)');
  assert.equal(r.inquiries[0].assignee_name,'이필선');
  const lim=await today(1);
  assert.equal(lim.deals.length,1);assert.equal(lim.truncated.deals,true);assert.equal(lim.limit,1);
  assert.equal((await today(5000)).limit,1000,'한도 최대 1000');
 }finally{await db.close();}
});
