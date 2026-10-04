import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {operationalSnapshot,lifecycleDecision} from '../server/technical-advisory/lifecycle.mjs';
const sql=readFileSync(new URL('../sql/technical-advisory-lifecycle.sql',import.meta.url),'utf8');
test('SQL and runtime agree on confirmed completion; replay is idempotent and performance remains untouched',async()=>{
 const db=new PGlite(),id='11111111-1111-4111-8111-111111111111';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create schema crm_security;
   create table crm_security.advisory_snapshots(project_id text primary key);
   create table crm_security.advisory_deal_links(project_id text primary key,deal_id uuid);
   create table public.deals(id uuid primary key,stage_code text,stage_group text,stage_raw text,lifecycle_status text,outcome text,amount bigint,won_amount bigint,completion_date date,closed_at timestamptz,stage_entered_at timestamptz,version int);
   create table crm_security.contract_sales_events(event_id int,amount_delta bigint);
   insert into crm_security.contract_sales_events values(1,1000000000);
   create function public.crm_advisory_ingest_v1(text,text,jsonb) returns jsonb language plpgsql as $$begin
    perform pg_advisory_xact_lock(hashtextextended($1,0));
    insert into crm_security.advisory_snapshots values($1) on conflict do nothing;
    return '{"ok":true}'::jsonb;end$$;`);
  await db.exec(sql);
  const today=(await db.query("select ((now() at time zone 'Asia/Seoul')::date)::text as d")).rows[0].d;
  let rev=0;
  const call=async(ops,revision=String(++rev))=>(await db.query('select public.crm_advisory_ingest_v2($1,$2,$3,$4) ack',['synthetic',revision,{},ops])).rows[0].ack;
  await db.query('insert into public.deals(id,stage_code,amount,won_amount,version) values($1,$2,$3,$4,1)',[id,'contract',999,1000000000]);
  await db.query('insert into crm_security.advisory_deal_links values($1,$2)',['synthetic',id]);
  for(const input of [
   {siteInfo:{progressRate:100,completionDate:'2020-01-01'}},
   {siteInfo:{isCompleted:true}},
   {siteInfo:{isCompleted:true,endDate:'2020-01-01'}},
   {siteInfo:{isCompleted:true,completionDate:'2999-01-01'}},
   {status:'contract_completed',siteInfo:{startDate:'2020-01-01'}},
   {siteInfo:{progressRate:25}},
   {siteInfo:{isCompleted:true,completionDate:'2020-01-01'}}
  ]){
   const ops=operationalSnapshot(input),decision=lifecycleDecision(ops,today),ack=await call(ops);
   assert.equal(ack.target_stage,decision.stage);
   if(!decision.stage)assert.equal(ack.operational_result,decision.reason);
  }
  let row=(await db.query('select * from public.deals')).rows[0];assert.equal(row.stage_code,'won');assert.equal(Number(row.won_amount),1e9,'never replace performance with current expected amount');
  const count=Number((await db.query('select count(*) n from crm_security.advisory_stage_events')).rows[0].n);
  assert.equal((await call(operationalSnapshot({siteInfo:{isCompleted:true,completionDate:'2020-01-01'}}),String(rev))).operational_result,'ALREADY_CURRENT');
  assert.equal(Number((await db.query('select count(*) n from crm_security.advisory_stage_events')).rows[0].n),count);
  assert.equal((await call(operationalSnapshot({siteInfo:{progressRate:10}}),'1')).operational_result,'STALE_REVISION');
  const ledger=(await db.query('select * from crm_security.contract_sales_events')).rows;assert.deepEqual(ledger,[{event_id:1,amount_delta:1000000000}]);
  // Closed/manual choices cannot be overwritten even after a valid source transition.
  await db.exec("update public.deals set stage_code='lost'");
  assert.match((await call(operationalSnapshot({siteInfo:{isCompleted:true,completionDate:'2020-01-01'}}))).operational_result,/MANUAL_STAGE_CHANGE_REVIEW|CLOSED_DEAL_REVIEW/);
  await db.exec('set role anon');await assert.rejects(call(operationalSnapshot({status:'contract_completed'})),/permission denied/);await db.exec('reset role');
  assert.equal((await db.query("select has_function_privilege('authenticated','public.crm_advisory_ingest_v2(text,text,jsonb,jsonb)','execute') allowed")).rows[0].allowed,false);
 }finally{await db.close()}
});
test('v1 operations cannot use a scheduled end date to win; same-revision upgrade preserves review',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema crm_security;
   create table crm_security.advisory_snapshots(project_id text primary key);
   create table crm_security.advisory_deal_links(project_id text,deal_id uuid);
   create table public.deals(id uuid,stage_code text,stage_group text,stage_raw text,lifecycle_status text,outcome text,amount bigint,won_amount bigint,completion_date date,closed_at timestamptz,stage_entered_at timestamptz,version int);
   insert into crm_security.advisory_snapshots values('legacy');
   create function public.crm_advisory_ingest_v1(text,text,jsonb) returns jsonb language sql as $$select '{"ok":true}'::jsonb$$;
   insert into public.deals(id,stage_code) values('11111111-1111-4111-8111-111111111111','contract');
   insert into crm_security.advisory_deal_links values('legacy','11111111-1111-4111-8111-111111111111');`);
  await db.exec(sql);
  const call=async ops=>(await db.query("select public.crm_advisory_ingest_v2('legacy','1','{}',$1) ack",[ops])).rows[0].ack;
  assert.equal((await call({schema_version:1,completed:true,completion_date:'2020-01-01'})).operational_result,'COMPLETION_FACTS_REQUIRED');
  assert.equal((await call(operationalSnapshot({siteInfo:{isCompleted:true,endDate:'2020-01-01'}}))).operational_result,'COMPLETION_FACTS_REQUIRED');
  await assert.rejects(call(operationalSnapshot({siteInfo:{isCompleted:true,completionDate:'2020-01-01'}})),/OPERATIONAL_REVISION_CONFLICT/);
 }finally{await db.close()}
});
