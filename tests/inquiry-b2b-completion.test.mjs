import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../sql/inquiry-b2b-completion.sql',import.meta.url),'utf8');
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
async function setup(){
 const d=new PGlite();await d.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;create schema crm_security;create schema private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table public.users(user_id uuid primary key,auth_uid uuid,name text,active bool default true);
 create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,permission_role text,approved bool);
 create table crm_security.object_scope(user_id uuid,inquiry_id uuid);
 create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql security definer as $$
 select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r using(user_id)
 where u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid$$;
 create function crm_security.can_inquiry(p_id uuid) returns bool language sql security definer as $$
 select exists(select 1 from crm_security.actor() a where a.permission_role='admin' or exists(select 1 from crm_security.object_scope s where s.user_id=a.user_id and s.inquiry_id=p_id))$$;
 create table public.inquiries(id uuid primary key,sheet_row int,phone text,brand text,status text,work_type text,raw jsonb,updated_at timestamptz default now(),assigned_to uuid,assignee_name text,deal_id uuid,opportunity_id uuid,qualified_at timestamptz,next_action_date date,close_reason text,first_response_at timestamptz,responded_at timestamptz);
 create table public.next_actions(id uuid primary key,inquiry_id uuid,status text,updated_at timestamptz);
 create table crm_security.inquiry_audit_events(event_id uuid primary key default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,inquiry_id uuid,action text check(action in ('close','inquiry_trash','inquiry_restore','inquiry_purge')),before_data jsonb,after_data jsonb,reason text,created_at timestamptz);
 create table crm_security.command_receipts(actor_auth_uid uuid,request_id uuid,actor_user_id uuid,operation text check(operation='inquiry_status'),object_id uuid,expected_version int,payload jsonb,ack jsonb,created_at timestamptz,primary key(actor_auth_uid,request_id));
 create function crm_security.crm_write_command_v2_pre_aligo_20260919(uuid,text,uuid,integer,jsonb) returns jsonb language sql as $$select '{"delegated":true}'::jsonb$$;
 create function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) returns jsonb language sql security definer as $$select crm_security.crm_write_command_v2_pre_aligo_20260919($1,$2,$3,$4,$5)$$;
 revoke all on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) from public;
 grant execute on function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) to authenticated;
 insert into users values('${id(1)}','${id(11)}','조재연',true),('${id(2)}','${id(12)}','관리자',true),('${id(3)}','${id(13)}','다른 담당',true);
 insert into crm_security.access_review values('${id(1)}','${id(11)}','rep',true),('${id(2)}','${id(12)}','admin',true),('${id(3)}','${id(13)}','rep',true);
 insert into inquiries(id,sheet_row,phone,brand,status,work_type,raw,updated_at,assigned_to,assignee_name,next_action_date) values('${id(20)}',12,'00000000000','POUR공법','접수','협약문의','{"문의내용":"협약 관련 문의","응대내용":"기존 메모"}','2026-01-01T00:00:00Z','${id(1)}','조재연','2026-12-01');
 insert into crm_security.object_scope values('${id(1)}','${id(20)}'),('${id(3)}','${id(20)}');
 insert into next_actions values('${id(30)}','${id(20)}','open',now());`);
 await d.exec(sql);return d;
}
const payload=(o={})=>({intent:'b2b_complete',result:'협약완료',expected_updated_at:'2026-01-01T00:00:00Z',note:'',...o});
async function call(d,p=payload(),req=40,actor=11){await d.exec(`reset role;select set_config('request.jwt.claim.sub','${actor?id(actor):''}',false);set role authenticated;`);try{return(await d.query('select public.crm_write_command_v2($1,\'inquiry_status\',$2,0,$3) r',[id(req),id(20),JSON.stringify(p)])).rows[0].r;}finally{await d.exec('reset role');}}
test('선택 메모로 완료, 원문·담당·첫응대 보존, 후속업무 취소, 이력 및 전송대기 원자 저장',async()=>{const d=await setup();try{
 const a=await call(d);assert.equal(a.status,'협약완료');assert.equal(a.sync_status,'pending');
 const i=(await d.query('select * from inquiries')).rows[0];assert.equal(i.assignee_name,'조재연');assert.equal(i.first_response_at,null);assert.equal(i.next_action_date,null);assert.match(i.raw.응대내용,/기존 메모/);assert.equal(i.raw.문의내용,'협약 관련 문의');assert.equal(i.deal_id,null);assert.equal(i.opportunity_id,null);
 assert.equal((await d.query('select status from next_actions')).rows[0].status,'cancelled');
 for(const table of ['crm_security.inquiry_audit_events','crm_security.command_receipts','private.inquiry_b2b_sync_outbox'])assert.equal((await d.query('select count(*)::int n from '+table)).rows[0].n,1);
 assert.equal((await call(d)).replayed,true);await assert.rejects(call(d,payload({note:'다른 내용'})),/REQUEST_ID_REUSE/);
 assert.equal((await d.query('select count(*)::int n from private.inquiry_b2b_sync_outbox')).rows[0].n,1);
}finally{await d.close();}});
test('협약/해결/종결만 허용하고 공사/미확정/낡은 화면/완료/삭제/전환 상태를 거절',async()=>{const d=await setup();try{
 for(const result of ['해결완료','종결']){await d.exec("update inquiries set status='접수',updated_at='2026-01-01T00:00:00Z'");assert.equal((await call(d,payload({result}),result==='종결'?42:41)).status,result);}
 await assert.rejects(call(d,payload(),43),/B2B_STATE_CONFLICT/);
 await assert.rejects(call(d,payload({result:'수주'}),44),/INVALID_B2B_COMPLETION/);
 await d.exec("update inquiries set status='접수',updated_at='2026-01-01T00:00:00Z',work_type='옥상방수',raw='{}'");await assert.rejects(call(d,payload(),45),/AGREEMENT_INQUIRY_REQUIRED/);
 await d.exec("update inquiries set work_type='협약문의'");await assert.rejects(call(d,payload({expected_updated_at:'2025-01-01'}),46),/B2B_STATE_CONFLICT/);
 await d.exec(`update inquiries set deal_id='${id(80)}'`);await assert.rejects(call(d,payload(),47),/B2B_STATE_CONFLICT/);
 await d.exec(`update inquiries set deal_id=null;insert into crm_security.inquiry_audit_events(inquiry_id,action,created_at) values('${id(20)}','inquiry_trash',now())`);await assert.rejects(call(d,payload(),48),/B2B_STATE_CONFLICT/);
}finally{await d.close();}});
test('인증·기존 권한·담당자 일치 강제, 비담당 읽기 권한으로는 완료 불가, 관리자 허용',async()=>{const d=await setup();try{
 await assert.rejects(call(d,payload(),50,0),/forbidden/);await assert.rejects(call(d,payload(),51,13),/forbidden/);
 await d.exec('update crm_security.access_review set approved=false');await assert.rejects(call(d,payload(),52),/forbidden/);
 await d.exec('update crm_security.access_review set approved=true');assert.equal((await call(d,payload(),53,12)).ok,true);
 const acl=(await d.query("select has_function_privilege('anon','public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)','execute') a,has_function_privilege('authenticated','crm_security.crm_inquiry_b2b_complete_command_v1(uuid,uuid,jsonb)','execute') b,has_table_privilege('authenticated','private.inquiry_b2b_sync_outbox','select') c")).rows[0];assert.deepEqual(acl,{a:false,b:false,c:false});
}finally{await d.close();}});
