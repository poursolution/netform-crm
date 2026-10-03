'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
test('gongjong merge: atomic quote preservation, ACL, version/replay, ledger and duplicate protection',async()=>{
 const db=new PGlite();const user='10000000-0000-4000-8000-000000000001',s='20000000-0000-4000-8000-000000000001',t='20000000-0000-4000-8000-000000000002';
 try{
  // Existing actor/row-scope helpers are fixture dependencies. SQL under test is real.
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema crm_security;
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create table public.users(user_id uuid,auth_uid uuid);
   create table crm_security.access_review(reviewed_auth_uid uuid);
   create table crm_security.object_scope(user_id uuid,deal_id uuid);
   create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql as $$select u.user_id,u.auth_uid,'검증 사용자'::text,'admin'::text from public.users u where u.auth_uid=auth.uid()$$;
   create function crm_security.can_deal(id uuid,write boolean) returns boolean language sql as $$select exists(select 1 from crm_security.object_scope s where s.user_id=auth.uid() and s.deal_id=id)$$;
   create table public.deals(id uuid primary key,site_id uuid,owner_id uuid,version int,amount numeric,quote_amount numeric,primary_work text,work_items jsonb,work_scope_type text,work_summary text,updated_at timestamptz default now());
   create table crm_security.contract_sales(deal_id uuid primary key);
   create table crm_security.audit_events(event_id uuid default gen_random_uuid(),actor_auth_uid uuid,actor_user_id uuid,actor_name text,deal_id uuid,action text,before_data jsonb,after_data jsonb,reason text);
   create table public.crm_quote_versions(id uuid primary key default gen_random_uuid(),opportunity_id uuid references public.deals(id),version_no int,amount numeric check(amount>0),reason text,created_by text,created_at timestamptz default now(),write_id text unique,unique(opportunity_id,version_no));
   insert into public.users values('${user}','${user}');set test.uid='${user}';
   insert into public.deals(id,site_id,owner_id,version,amount,quote_amount,work_items,primary_work) values('${s}','30000000-0000-4000-8000-000000000001','${user}',1,120,120,'[]',''),('${t}','30000000-0000-4000-8000-000000000001','${user}',1,200,200,'["옥상>우레탄"]','옥상>우레탄');
   insert into crm_security.object_scope values('${user}','${s}'),('${user}','${t}');
   insert into public.crm_quote_versions(opportunity_id,version_no,amount,reason) values('${s}',1,100,'최초 견적'),('${s}',2,120,'변경 견적'),('${t}',1,200,'기존 견적');`);
  const baseline=fs.readFileSync(path.resolve(__dirname,'../sql/business-v2/rollback.sql'),'utf8');
  const existing=baseline.match(/CREATE OR REPLACE FUNCTION public\.crm_work_set_scoped_v2[\s\S]+?\$function\$\s*;/)[0];await db.exec(existing);
  await db.exec(fs.readFileSync(path.resolve(__dirname,'../sql/gongjong-merge-v1-20261003.sql'),'utf8'));
  const req={source_id:s,target_id:t,source_version:1,target_version:1,request_id:'40000000-0000-4000-8000-000000000001',work_items:['옥상>우레탄'],primary_work:'옥상>우레탄'};
  const call=async p=>(await db.query('select public.crm_gongjong_merge_v1($1::jsonb) as result',[JSON.stringify(p)])).rows[0].result;
  await assert.rejects(call({...req,source_version:0}),/최신 기록/);
  await db.exec(`delete from crm_security.object_scope where deal_id='${t}'`);await assert.rejects(call(req),/forbidden/);
  await db.exec(`insert into crm_security.object_scope values('${user}','${t}');insert into crm_security.contract_sales values('${s}')`);await assert.rejects(call(req),/계약 기록/);
  await db.exec(`delete from crm_security.contract_sales`);
  await assert.rejects(call({...req,work_items:['옥상>우레탄','재도장>외부']}),/세부 공종/);
  await db.exec(`update public.deals set site_id=null where id='${s}'`);await assert.rejects(call(req),/현장 ID/);
  await db.exec(`update public.deals set site_id='30000000-0000-4000-8000-000000000001' where id='${s}'`);
  const ack=await call(req);assert.equal(ack.ok,true);assert.equal(ack.quote_count,2);
  assert.deepEqual(await call(req),ack,'same request returns same ACK');
  assert.equal((await db.query('select count(*)::int n from public.crm_quote_versions')).rows[0].n,5);
  assert.deepEqual((await db.query('select amount,version from public.deals order by id')).rows.map(x=>[Number(x.amount),x.version]),[[120,2],[200,2]],'amounts preserved, versions advance');
  assert.equal((await db.query('select count(*)::int n from crm_security.gongjong_merges')).rows[0].n,1);
  const links=(await db.query("select public.crm_gongjong_links_v1('{}') as x")).rows[0].x;assert.equal(links.links.length,1);
  await assert.rejects(call({...req,work_items:['옥상>PVC']}),/REQUEST_ID_REUSE/);
  await assert.rejects(call({...req,source_version:2,target_version:2,request_id:'40000000-0000-4000-8000-000000000002'}),/이미 합쳐진/);
  await db.exec(`delete from crm_security.object_scope where deal_id='${s}'`);
  assert.equal((await db.query("select public.crm_gongjong_links_v1('{}') as x")).rows[0].x.links.length,0,'no cross-scope link leak');
  const acl=(await db.query("select has_function_privilege('anon','public.crm_gongjong_merge_v1(jsonb)','EXECUTE') anon,has_table_privilege('authenticated','crm_security.gongjong_merges','SELECT') direct")).rows[0];assert.deepEqual(acl,{anon:false,direct:false});
  await db.exec("set test.uid=''");await assert.rejects(db.query("select public.crm_gongjong_links_v1('{}')"),/forbidden/);
 }finally{await db.close();}
});
