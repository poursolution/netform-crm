/* 브랜드별 발신 v1(2026-10-22): 실행기 큐 항목에 sender_brand(캠페인 = 영업건 유입 브랜드 → brand, 문의 문자 = 문의 brand)가 붙는다 · 나머지 모양 그대로. pglite */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const inq=readFileSync(new URL('../sql/inquiry-sms-reply-v1-20261003.sql',import.meta.url),'utf8');
const brand=readFileSync(new URL('../sql/sms-sender-brand-v1-20261022.sql',import.meta.url),'utf8');
const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222';
const Q1='aaaaaaaa-0000-4000-8000-000000000001',Q2='aaaaaaaa-0000-4000-8000-000000000002',W='99999999-9999-4999-8999-999999999999';
const C1='cccccccc-0000-4000-8000-000000000001',D1='dddddddd-0000-4000-8000-000000000001',D2='dddddddd-0000-4000-8000-000000000002',CT1='eeeeeeee-0000-4000-8000-000000000001',CT2='eeeeeeee-0000-4000-8000-000000000002';
async function db(){
 const d=new PGlite();
 await d.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema crm_security;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,permission_role text,source_role text,approved boolean,expires_at timestamptz);
 create table public.inquiries(id uuid primary key,phone text,status text,assigned_to uuid,deleted_at timestamptz,brand text);
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
  select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
  where u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now() $$;
 insert into public.users values('${U}','${A}','송보람','admin',true);
 insert into crm_security.access_review values('${U}','${A}','admin','admin',true,now()+interval '1 day');
 insert into public.inquiries values('${Q1}','010-1234-5678','배정완료','${U}',null,'아파트스퀘어'),('${Q2}','010-2222-3333','배정완료','${U}',null,null);
 -- 캠페인 큐(실행기가 보는 칸만)
 create table public.deals(id uuid primary key,contact_id uuid,person_key text,brand text,origin_business text);
 create table public.contacts(id uuid primary key,person_key text,mobile text,phone text);
 create table public.contact_assignments(person_key text,opportunity_id uuid,status text,ended_at timestamptz);
 create table crm_security.contact_compat_state(contact_id uuid,deal_id uuid,sms_consent boolean,consent_at timestamptz,send_blocked boolean,opt_out_at timestamptz);
 create table crm_security.sms_campaigns(id uuid primary key,status text,created_by_user_id uuid,created_by_auth_uid uuid);
 create table crm_security.sms_campaign_recipients(id uuid primary key default gen_random_uuid(),campaign_id uuid,deal_id uuid,contact_id uuid,person_key text,phone text,personalized_body text,status text default 'queued',attempt_count int default 0,available_at timestamptz default now(),claimed_at timestamptz,worker_id uuid,claim_token uuid,provider_message_id text,updated_at timestamptz default now());
 create function crm_security.crm_sms_worker_claim_v1(p_worker_id uuid,p_allowed_receivers text[],p_limit integer) returns jsonb language sql as $$ select '{}'::jsonb $$;
 create function crm_security.crm_sms_worker_pending_v1(p_worker_id uuid) returns jsonb language sql as $$ select '{}'::jsonb $$;
 insert into public.deals values('${D1}','${CT1}','p1','POUR솔루션','POUR공법'),('${D2}','${CT2}','p2',null,null);
 insert into public.contacts values('${CT1}','p1','010-0000-0001',null),('${CT2}','p2','010-0000-0002',null);
 insert into crm_security.contact_compat_state values('${CT1}','${D1}',true,now()-interval '1 day',false,null),('${CT2}','${D2}',true,now()-interval '1 day',false,null);
 insert into crm_security.sms_campaigns values('${C1}','queued','${U}','${A}');
 insert into crm_security.sms_campaign_recipients(campaign_id,deal_id,contact_id,person_key,phone,personalized_body) values('${C1}','${D1}','${CT1}','p1','01000000001','POUR공법 고객에게'),('${C1}','${D2}','${CT2}','p2','01000000002','브랜드 없는 고객에게');`);
 await d.exec(inq);await d.exec(brand);await d.exec(brand);
 return d;
}
const as=async(d,auth,fn)=>{await d.query(`select set_config('request.jwt.claim.sub','${auth||''}',false)`);return fn();};
test('문의 문자 claim · pending 에 문의 브랜드가 붙는다(없으면 null)',async()=>{
 const d=await db();
 const rid=n=>'bbbbbbbb-0000-4000-8000-00000000000'+n;
 await as(d,A,()=>d.query('select public.crm_inquiry_sms_request_v1($1::jsonb) r',[JSON.stringify({inquiry_id:Q1,request_id:rid(1),text:'스퀘어 문의 답'})]));
 await as(d,A,()=>d.query('select public.crm_inquiry_sms_request_v1($1::jsonb) r',[JSON.stringify({inquiry_id:Q2,request_id:rid(2),text:'브랜드 없는 문의 답'})]));
 await d.query(`select set_config('request.jwt.claim.sub','',false)`);
 const c=(await d.query('select crm_security.crm_sms_worker_claim_inquiry_v1($1,$2) r',[W,10])).rows[0].r;
 assert.equal(c.contract_version,1);assert.equal(c.items.length,2);
 const byMsg=Object.fromEntries(c.items.map(x=>[x.message,x]));
 assert.equal(byMsg['스퀘어 문의 답'].sender_brand,'아파트스퀘어');assert.equal(byMsg['브랜드 없는 문의 답'].sender_brand,null);
 assert.deepEqual(Object.keys(byMsg['스퀘어 문의 답']).sort(),['claim_token','id','message','provider_message_id','receiver','sender_brand','status','type']);
 const p=(await d.query('select crm_security.crm_sms_worker_pending_inquiry_v1($1) r',[W])).rows[0].r;
 assert.equal(p.items.length,2);assert.ok(p.items.every(x=>'sender_brand' in x));
});
test('캠페인 claim · pending 에 영업건 유입 브랜드(origin_business → brand)가 붙는다',async()=>{
 const d=await db();
 const c=(await d.query('select crm_security.crm_sms_worker_claim_v1($1,$2::text[],$3) r',[W,['01000000001','01000000002'],10])).rows[0].r;
 assert.equal(c.contract_version,1);assert.equal(c.items.length,2);
 const byMsg=Object.fromEntries(c.items.map(x=>[x.message,x]));
 assert.equal(byMsg['POUR공법 고객에게'].sender_brand,'POUR공법','유입 브랜드가 먼저');assert.equal(byMsg['브랜드 없는 고객에게'].sender_brand,null);
 assert.deepEqual(Object.keys(byMsg['POUR공법 고객에게']).sort(),['claim_token','id','message','provider_message_id','receiver','sender_brand','status','type']);
 const p=(await d.query('select crm_security.crm_sms_worker_pending_v1($1) r',[W])).rows[0].r;
 assert.equal(p.items.length,2);assert.equal(p.items.find(x=>x.message==='POUR공법 고객에게').sender_brand,'POUR공법');
 await assert.rejects(d.query('select crm_security.crm_sms_worker_claim_v1($1,$2::text[],$3) r',[W,['0212345678'],10]),/invalid worker claim/);
});
