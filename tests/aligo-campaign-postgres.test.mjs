import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase/migrations/20260919114702_aligo_campaign_worker.sql',import.meta.url),'utf8');
const fixture=`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema crm_security;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.users(user_id uuid primary key,auth_uid uuid,name text,role text,active boolean);
create table crm_security.access_review(user_id uuid,reviewed_auth_uid uuid,permission_role text,source_role text,approved boolean,expires_at timestamptz);
create table public.contacts(id uuid primary key,person_key text,mobile text,phone text);
create table public.deals(id uuid primary key,organization_id uuid,contact_id uuid,person_key text);
create table public.contact_assignments(person_key text,opportunity_id uuid,status text,ended_at date);
create table crm_security.contact_compat_state(contact_id uuid,deal_id uuid,sms_consent boolean,consent_at timestamptz,send_blocked boolean,opt_out_at timestamptz,primary key(contact_id,deal_id));
create table crm_security.command_receipts(actor_auth_uid uuid,request_id uuid,actor_user_id uuid,operation text,object_id uuid,expected_version integer,payload jsonb,ack jsonb,created_at timestamptz,constraint command_receipts_operation_check check(operation in ('relationship_contact','contact_upsert')),primary key(actor_auth_uid,request_id));
create table public.activities(id uuid default gen_random_uuid(),deal_id uuid,organization_id uuid,actor_name text,type text,detail jsonb,occurred_at timestamptz);
create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable security definer set search_path='' as $$
 select u.user_id,u.auth_uid,u.name,r.permission_role from public.users u join crm_security.access_review r on r.user_id=u.user_id
 where u.auth_uid=auth.uid() and u.active and r.approved and r.reviewed_auth_uid=u.auth_uid and r.source_role=u.role and r.expires_at>now()
 and (select count(*) from public.users x where x.auth_uid=u.auth_uid)=1 $$;
create function crm_security.can_deal(uuid,boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from crm_security.actor() a where a.permission_role='admin') $$;
create function public.crm_write_command_v2(uuid,text,uuid,integer,jsonb) returns jsonb language sql as $$ select '{"delegated":true}'::jsonb $$;
create function public.crm_operational_source_v1(text,uuid,integer) returns jsonb language sql as $$ select '{"delegated":true}'::jsonb $$;
grant usage on schema public,auth to authenticated,service_role;
`;
test('Postgres migration enforces consent, claim ownership, idempotency, outcome identity and privileges',async()=>{
 const db=new PGlite();
 try{
 await db.exec(fixture);
 await db.exec('begin;'+migration+'commit;');
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222';
 const D='33333333-3333-4333-8333-333333333333',C='44444444-4444-4444-8444-444444444444';
 const CMP='55555555-5555-4555-8555-555555555555',REQ='66666666-6666-4666-8666-666666666666',W='77777777-7777-4777-8777-777777777777';
 await db.query("insert into public.users values($1,$2,'synthetic','admin',true)",[U,AU]);
 await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day')",[U,AU]);
 await db.query("insert into public.contacts values($1,'mobile:01000000000','01000000000','01000000000')",[C]);
 await db.query("insert into public.deals values($1,null,$2,'mobile:01000000000')",[D,C]);
 await db.query("insert into crm_security.contact_compat_state values($1,$2,true,now()-interval '1 hour',false,null)",[C,D]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[AU]);
 const payload={campaign_id:'synthetic',category_key:'test',category_label:'test',category_group:'test',template_key:'custom',body:'synthetic',status:'queued',recipient_count:1,excluded_count:0,recipients:[{opportunity_id:D,person_key:'mobile:01000000000',phone:'01000000000',site_name:'test',contact_name:'test',owner:'test',personalized_body:'synthetic'}]};
 const create=async(p=payload,req=REQ,cmp=CMP)=>(await db.query('select public.crm_write_command_v2($1,\'campaign_create\',$2,0,$3::jsonb) result',[req,cmp,JSON.stringify(p)])).rows[0].result;
 await db.exec('set role authenticated');
 const ack=await create(); assert.equal(ack.status,'queued');assert.equal((await create()).replayed,true);
 await assert.rejects(create({...payload,body:'changed'}),/REQUEST_ID_REUSE/);
 await assert.rejects(db.query('select public.crm_sms_worker_claim_v1($1,$2,10)',[W,['01000000000']]),/permission denied/);
 await db.exec('reset role; set role service_role');
 const call=async(name,args,values)=>(await db.query('select public.'+name+'('+args+') result',values)).rows[0].result;
 let result=await call('crm_sms_worker_claim_v1','$1,$2,10',[W,['01011111111']]);assert.equal(result.items.length,0);
 await db.exec('reset role; update crm_security.contact_compat_state set send_blocked=true; set role service_role');
 result=await call('crm_sms_worker_claim_v1','$1,$2,10',[W,['01000000000']]);assert.equal(result.items.length,0);
 await db.exec('reset role; update crm_security.contact_compat_state set send_blocked=false; set role service_role');
 result=await call('crm_sms_worker_claim_v1','$1,$2,10',[W,['01000000000']]);assert.equal(result.items.length,1);
 const row=result.items[0];assert.equal(row.status,'sending');
 assert.equal((await call('crm_sms_worker_claim_v1','$1,$2,10',[W,['01000000000']])).items.length,0);
 const record=(status,mid='123',token=row.claim_token)=>call('crm_sms_worker_result_v1','$1,$2,$3,$4,$5,null',[W,row.id,token,status,mid]);
 await assert.rejects(record('sent','123',REQ),/claim conflict/);
 await record('submitted');await assert.rejects(record('sent','999'),/provider identity conflict/);
 await record('sent');await record('sent');await assert.rejects(record('submitted'),/terminal conflict/);
 await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from public.activities')).rows[0].n,1);
 await db.exec('set role authenticated');
 const read=(await db.query("select public.crm_operational_source_v1('campaign_core',null,100) result")).rows[0].result;
 assert.equal(read.items[0].sent_count,1);assert.equal(read.items[0].status,'sent');
 assert.equal((await db.query("select public.crm_operational_source_v1('deal_core',null,100) result")).rows[0].result.delegated,true);
 await db.exec('reset role; update crm_security.access_review set permission_role=\'rep\'; set role authenticated');
 await assert.rejects(db.query("select public.crm_operational_source_v1('campaign_core',null,100)"),/forbidden/);
 }finally{await db.close();}
});
