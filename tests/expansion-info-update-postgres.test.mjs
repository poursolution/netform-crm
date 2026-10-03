/* 확장관리 관리 정보 빈 칸 입력 v1 (2026-10-03): 준공일 · 현재 담당만, 담당 범위 안 · 현재 담당은 관리자만, 기록이 없으면 만들고 있으면 고침, 활동 · 감사. pglite */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../sql/expansion-info-update-v1-20261003.sql',import.meta.url),'utf8');
const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222',REP='33333333-3333-4333-8333-333333333333',REPA='44444444-4444-4444-8444-444444444444';
const D1='aaaaaaaa-0000-4000-8000-000000000001',D2='aaaaaaaa-0000-4000-8000-000000000002';
async function db(){
 const d=new PGlite();
 await d.exec(`create role anon; create role authenticated; create schema auth; create schema crm_security;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,permission_role text,source_role text,approved boolean,expires_at timestamptz);
 create table public.deals(id uuid primary key,site text,site_id uuid,organization_id uuid,assignee text);
 create table public.crm_expansion_pool(id uuid primary key default gen_random_uuid(),source_opportunity_id uuid unique,site_id uuid,site_name text,completion_date date,owner_name text,expansion_status text,updated_at timestamptz default now());
 create table public.activities(id uuid default gen_random_uuid(),deal_id uuid,organization_id uuid,actor_name text,type text,detail jsonb,occurred_at timestamptz);
 create table crm_security.audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,actor_name text,deal_id uuid,action text,before_data jsonb,after_data jsonb,reason text,created_at timestamptz);
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
  select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id where u.auth_uid=auth.uid() and u.active and r.approved $$;
 create function crm_security.can_deal(uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from crm_security.actor() a where a.permission_role='admin' or exists(select 1 from public.deals d where d.id=$1 and d.assignee=a.display_name)) $$;
 insert into public.users values('${U}','${A}','송보람','admin',true),('${REP}','${REPA}','이필선','rep',true);
 insert into crm_security.access_review values('${U}','${A}','admin','admin',true,now()+interval '1 day'),('${REP}','${REPA}','rep','rep',true,now()+interval '1 day');
 insert into public.deals values('${D1}','가양우방아파트',null,null,'이필선'),('${D2}','남의 현장',null,null,'황윤선');
 insert into public.crm_expansion_pool(source_opportunity_id,site_name,expansion_status) values('${D1}','가양우방아파트','신규 대상');`);
 await d.exec(sql);return d;
}
const as=async(d,auth,fn)=>{await d.query(`select set_config('request.jwt.claim.sub','${auth||''}',false)`);return fn();};
const call=(d,p)=>d.query('select public.crm_expansion_info_update_v1($1::jsonb) r',[JSON.stringify(p)]).then(r=>r.rows[0].r);
test('담당자: 준공일 입력 OK · 담당 밖 거부 · 날짜 형식 · 현재 담당은 관리자만 · 등록 사용자만 · 활동 · 감사',async()=>{
 const d=await db();
 const ok=await as(d,REPA,()=>call(d,{source_opportunity_id:D1,field:'completion_date',value:'2026-01-05'}));
 assert.equal(ok.ok,true);assert.equal(ok.field,'completion_date');
 const row=await d.query(`select completion_date::text cd from public.crm_expansion_pool where source_opportunity_id='${D1}'`);assert.equal(row.rows[0].cd,'2026-01-05');
 await assert.rejects(as(d,REPA,()=>call(d,{source_opportunity_id:D1,field:'completion_date',value:'1/5'})),/YYYY-MM-DD/);
 await assert.rejects(as(d,REPA,()=>call(d,{source_opportunity_id:D2,field:'completion_date',value:'2026-01-05'})),/forbidden/);
 await assert.rejects(as(d,REPA,()=>call(d,{source_opportunity_id:D1,field:'owner_name',value:'이필선'})),/관리자만/);
 await assert.rejects(as(d,A,()=>call(d,{source_opportunity_id:D1,field:'owner_name',value:'아무개'})),/등록된 사용자/);
 const own=await as(d,A,()=>call(d,{source_opportunity_id:D1,field:'owner_name',value:'이필선'}));assert.equal(own.ok,true);
 await assert.rejects(as(d,A,()=>call(d,{source_opportunity_id:D1,field:'won_amount',value:'100'})),/invalid payload/,'수주 금액 · 계약일은 여기서 못 바꿈');
 const acts=await d.query(`select type,detail->>'result' r from public.activities order by occurred_at`);assert.deepEqual(acts.rows,[{type:'업무',r:'준공일 2026-01-05'},{type:'업무',r:'현재 담당 이필선'}]);
 const au=await d.query(`select action,before_data->>'completion_date' b from crm_security.audit_events order by created_at`);assert.equal(au.rows.length,2);assert.equal(au.rows[0].action,'expansion_info_update');assert.equal(au.rows[1].b,'2026-01-05');
});
test('확장 기록이 아직 없는 수주 건이면 만든다(관리자)',async()=>{
 const d=await db();
 const r=await as(d,A,()=>call(d,{source_opportunity_id:D2,field:'completion_date',value:'2026-03-01'}));assert.equal(r.ok,true);
 const row=await d.query(`select site_name,expansion_status,completion_date::text cd from public.crm_expansion_pool where source_opportunity_id='${D2}'`);assert.deepEqual(row.rows[0],{site_name:'남의 현장',expansion_status:'신규 대상',cd:'2026-03-01'});
});
