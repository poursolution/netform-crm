/* 견적문의 응대 문자 큐 v1 (2026-10-03): 요청(담당자 · 관리자 · 종결 금지 · 010 · 24시간 3건) → 실행기 claim(승인된 요청자만, 24시간 지나면 취소) → 결과 전이. pglite */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../sql/inquiry-sms-reply-v1-20261003.sql',import.meta.url),'utf8');
const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222',REP='33333333-3333-4333-8333-333333333333',REPA='44444444-4444-4444-8444-444444444444';
const Q1='aaaaaaaa-0000-4000-8000-000000000001',Q2='aaaaaaaa-0000-4000-8000-000000000002',Q3='aaaaaaaa-0000-4000-8000-000000000003',W='99999999-9999-4999-8999-999999999999';
async function db(){
 const d=new PGlite();
 await d.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema crm_security;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,permission_role text,source_role text,approved boolean,expires_at timestamptz);
 create table public.inquiries(id uuid primary key,phone text,status text,assigned_to uuid,deleted_at timestamptz);
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
  select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
  where u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now() $$;
 insert into public.users values('${U}','${A}','송보람','admin',true),('${REP}','${REPA}','이필선','rep',true);
 insert into crm_security.access_review values('${U}','${A}','admin','admin',true,now()+interval '1 day'),('${REP}','${REPA}','rep','rep',true,now()+interval '1 day');
 insert into public.inquiries values('${Q1}','010-1234-5678','배정완료','${REP}',null),('${Q2}','02-123-4567','접수',null,null),('${Q3}','010-9999-0000','종결','${REP}',null);`);
 await d.exec(sql);
 return d;
}
const as=async(d,auth,fn)=>{await d.query(`select set_config('request.jwt.claim.sub','${auth||''}',false)`);return fn();};
const req=(d,p)=>d.query('select public.crm_inquiry_sms_request_v1($1::jsonb) r',[JSON.stringify(p)]).then(r=>r.rows[0].r);
const rid=n=>'bbbbbbbb-0000-4000-8000-00000000000'+n;
test('요청: 담당자 OK · 남 거부 · 종결 거부 · 010 아님 거부 · 중복 request_id 는 같은 행 · 24시간 3건',async()=>{
 const d=await db();
 const ok=await as(d,REPA,()=>req(d,{inquiry_id:Q1,request_id:rid(1),text:'안녕하세요 넷폼 이필선입니다.'}));
 assert.equal(ok.ok,true);assert.equal(ok.status,'queued');assert.equal(ok.phone,'01012345678');
 const dup=await as(d,REPA,()=>req(d,{inquiry_id:Q1,request_id:rid(1),text:'다른 글'}));assert.equal(dup.duplicate,true);assert.equal(dup.id,ok.id);
 await assert.rejects(as(d,A,()=>req(d,{inquiry_id:Q3,request_id:rid(2),text:'x'})),/종결된 문의/);
 await assert.rejects(as(d,A,()=>req(d,{inquiry_id:Q2,request_id:rid(3),text:'x'})),/휴대폰 번호\(010\)/);
 await d.exec(`insert into public.users values('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','정정훈','rep',true);insert into crm_security.access_review values('55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666','rep','rep',true,now()+interval '1 day')`);
 await assert.rejects(as(d,'66666666-6666-4666-8666-666666666666',()=>req(d,{inquiry_id:Q1,request_id:rid(4),text:'x'})),/담당자 또는 관리자만/);
 await as(d,A,()=>req(d,{inquiry_id:Q1,request_id:rid(5),text:'2'}));await as(d,A,()=>req(d,{inquiry_id:Q1,request_id:rid(6),text:'3'}));
 await assert.rejects(as(d,A,()=>req(d,{inquiry_id:Q1,request_id:rid(7),text:'4'})),/24시간 안 3건/);
 const list=await as(d,REPA,()=>d.query('select public.crm_inquiry_sms_list_v1($1::jsonb) r',[JSON.stringify({inquiry_id:Q1})]).then(r=>r.rows[0].r));
 assert.equal(list.rows.length,3);assert.equal(list.rows[0].status,'queued');
 await assert.rejects(as(d,'',()=>req(d,{inquiry_id:Q1,request_id:rid(8),text:'x'})),/forbidden/);
});
test('실행기: claim → sending(승인된 요청자만) → submitted → sent · 24시간 지난 요청 취소 · 결과 전이 검사',async()=>{
 const d=await db();
 const a=await as(d,REPA,()=>req(d,{inquiry_id:Q1,request_id:rid(1),text:'첫 문자'}));
 await d.exec(`insert into crm_security.inquiry_sms_requests(request_id,inquiry_id,phone,body,requested_by,requested_by_auth,requested_by_name,created_at) values('${rid(9)}','${Q1}','01012345678','오래된 요청','${REP}','${REPA}','이필선',now()-interval '25 hours')`);
 await d.query(`select set_config('request.jwt.claim.sub','',false)`);
 const c=await d.query('select public.crm_sms_worker_claim_inquiry_v1($1::uuid,10) r',[W]).then(r=>r.rows[0].r);
 assert.equal(c.contract_version,1);assert.equal(c.items.length,1,'24시간 지난 것은 집지 않음');const it=c.items[0];
 assert.equal(it.receiver,'01012345678');assert.equal(it.type,'SMS');assert.equal(it.status,'sending');assert.equal(it.id,a.id);
 const old=await d.query(`select status,last_error from crm_security.inquiry_sms_requests where request_id='${rid(9)}'`);assert.deepEqual(old.rows[0],{status:'cancelled',last_error:'EXPIRED_24H'});
 const p=await d.query('select public.crm_sms_worker_pending_inquiry_v1($1::uuid) r',[W]).then(r=>r.rows[0].r);assert.equal(p.items.length,1);
 await assert.rejects(d.query('select public.crm_sms_worker_result_inquiry_v1($1::uuid,$2::uuid,$3::uuid,$4,$5,$6)',[W,it.id,'00000000-0000-4000-8000-000000000000','sent','123',null]),/claim conflict/);
 const r1=await d.query('select public.crm_sms_worker_result_inquiry_v1($1::uuid,$2::uuid,$3::uuid,$4,$5,$6) r',[W,it.id,it.claim_token,'submitted','1456000001',null]).then(r=>r.rows[0].r);assert.equal(r1.status,'submitted');
 const r2=await d.query('select public.crm_sms_worker_result_inquiry_v1($1::uuid,$2::uuid,$3::uuid,$4,$5,$6) r',[W,it.id,it.claim_token,'sent','1456000001',null]).then(r=>r.rows[0].r);assert.equal(r2.status,'sent');
 await assert.rejects(d.query('select public.crm_sms_worker_result_inquiry_v1($1::uuid,$2::uuid,$3::uuid,$4,$5,$6)',[W,it.id,it.claim_token,'failed','1456000001','X']),/terminal conflict/);
 const list=await as(d,A,()=>d.query('select public.crm_inquiry_sms_list_v1($1::jsonb) r',[JSON.stringify({inquiry_id:Q1})]).then(r=>r.rows[0].r));
 assert.equal(list.rows.find(x=>x.id===it.id).status,'sent');assert.ok(list.rows.find(x=>x.id===it.id).delivered_at);
 /* 요청자가 승인 해제되면 집지 않는다 */
 await as(d,A,()=>req(d,{inquiry_id:Q1,request_id:rid(2),text:'둘째'}));
 await d.exec(`update crm_security.access_review set approved=false where user_id='${U}'`);
 await d.query(`select set_config('request.jwt.claim.sub','',false)`);
 const c2=await d.query('select public.crm_sms_worker_claim_inquiry_v1($1::uuid,10) r',[W]).then(r=>r.rows[0].r);assert.equal(c2.items.length,0);
});
