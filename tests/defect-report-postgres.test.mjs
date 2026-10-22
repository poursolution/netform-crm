import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
/* 하자 사진 간이 접수 v1(2026-10-22): 접수 = 표 한 행 + 응대 기록 '[하자] …' 표식 · 같은 request_id 는 같은 행 · 권한 · 목록 */
const sql=readFileSync(new URL('../sql/defect-report-v1-20261022.sql',import.meta.url),'utf8');
const REP='22222222-2222-4222-8222-222222222222',REP_AUTH='bbbbbbbb-2222-4222-8222-222222222222';
const OTHER='33333333-3333-4333-8333-333333333333',OTHER_AUTH='cccccccc-3333-4333-8333-333333333333';
const D1='11111111-1111-4111-8111-000000000001',D2='11111111-1111-4111-8111-000000000002',S1='aaaaaaaa-0000-4000-8000-000000000001';
test('하자 접수: 행 + 응대 기록 표식 · 중복 요청 · 권한 · 목록',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema crm_security; create schema auth;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create table public.users(user_id uuid primary key, name text not null, email text, active boolean not null default true, auth_uid uuid);
   create table crm_security.access_review(user_id uuid primary key, reviewed_auth_uid uuid not null, permission_role text not null, approved boolean not null, expires_at timestamptz not null);
   create function crm_security.actor() returns table(user_id uuid, auth_uid uuid, display_name text, permission_role text) language sql stable as $$
    select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id where u.auth_uid=auth.uid() and u.active and r.approved and r.expires_at>now() $$;
   create table public.sites(site_id uuid primary key, site_name text);
   create table public.deals(id uuid primary key, site_id uuid, organization_id uuid, owner_id uuid, assignee_name text, last_activity_at timestamptz, updated_at timestamptz);
   create function crm_security.can_deal(p_id uuid, p_write boolean) returns boolean language sql stable as $$ select exists(select 1 from public.deals d where d.id=p_id and (d.owner_id=(select user_id from crm_security.actor()) or (select permission_role from crm_security.actor())='admin')) $$;
   create table public.activities(id uuid primary key default gen_random_uuid(), deal_id uuid, organization_id uuid, actor_email text, actor_name text, type text, detail jsonb, occurred_at timestamptz);
   insert into public.users values ('${REP}','이필선','rep@x',true,'${REP_AUTH}'),('${OTHER}','한준엽','o@x',true,'${OTHER_AUTH}');
   insert into crm_security.access_review values ('${REP}','${REP_AUTH}','rep',true,'infinity'),('${OTHER}','${OTHER_AUTH}','rep',true,'infinity');
   insert into public.sites values ('${S1}','합성 아파트');
   insert into public.deals(id,site_id,owner_id) values ('${D1}','${S1}','${REP}'),('${D2}',null,'${OTHER}');
  `);
  await db.exec(sql);await db.exec(sql);
  const as=uid=>db.exec(`select set_config('test.uid','${uid||''}',false);`);
  const one=async(q,args)=>(await db.query(q,args)).rows[0];
  const create=p=>one('select public.crm_defect_report_create_v1($1::jsonb) as r',[JSON.stringify(p)]).then(x=>x.r);
  const list=p=>one('select public.crm_defect_report_list_v1($1::jsonb) as r',[JSON.stringify(p||{})]).then(x=>x.r);
  const REQ='55555555-5555-4555-8555-555555555555';
  await as('');await assert.rejects(create({request_id:REQ,deal_id:D1,part:'옥상'}),/forbidden/);
  await as(REP_AUTH);
  await assert.rejects(create({request_id:REQ,deal_id:D1,part:'지붕'}),/invalid payload/);
  await assert.rejects(create({request_id:REQ,deal_id:D1,part:'옥상'}),/사진이나 내용/);
  await assert.rejects(create({request_id:REQ,deal_id:D1,part:'옥상',memo:'x',photo_path:'../etc'}),/invalid payload/);
  await assert.rejects(create({request_id:REQ,deal_id:D2,part:'옥상',memo:'남의 건'}),/forbidden/);
  const r=await create({request_id:REQ,deal_id:D1,part:'옥상',urgent:true,memo:'우수관 주변 누수',photo_path:REP_AUTH+'/'+D1+'/1.jpg'});
  assert.equal(r.ok,true);assert.equal(r.status,'접수');assert.equal(r.duplicate,false);assert.ok(r.activity_id);
  assert.match(r.note,/^\[하자\] 옥상 · 우수관 주변 누수 · 긴급 · 사진 1장 \| 접수 \d{4}-\d{2}-\d{2} \| 담당 이필선 \| 약속 없음 \| 미해결$/,'기존 표식 그대로: '+r.note);
  const act=await one(`select type,detail from public.activities where id='${r.activity_id}'`);
  assert.equal(act.type,'하자');assert.equal(act.detail.note,r.note);assert.equal(act.detail.defect_part,'옥상');assert.equal(act.detail.meaningful_contact,false);
  const dup=await create({request_id:REQ,deal_id:D1,part:'외벽',memo:'다른 내용'});
  assert.equal(dup.duplicate,true);assert.equal(dup.id,r.id,'같은 요청은 같은 행');
  assert.equal((await one('select count(*)::int n from crm_security.defect_reports')).n,1);
  assert.equal((await one('select count(*)::int n from public.activities')).n,1,'기록도 한 번');
  const L=await list({});assert.equal(L.items.length,1);assert.equal(L.items[0].site_name,'합성 아파트');assert.equal(L.items[0].part,'옥상');assert.equal(L.items[0].urgent,true);
  assert.equal((await list({deal_id:D2})).items.length,0);
  await as(OTHER_AUTH);assert.equal((await list({})).items.length,0,'남의 영업건 접수는 안 보인다');
 }finally{await db.close();}
});
