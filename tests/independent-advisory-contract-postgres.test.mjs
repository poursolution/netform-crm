import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';
const oldSql=readFileSync(new URL('../supabase/migrations/20260920160000_contract_sales_ledger.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261004120614_independent_advisory_contract_ledger.sql',import.meta.url),'utf8');
const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222';
const V='44444444-4444-4444-8444-444444444444',AV='55555555-5555-4555-8555-555555555555';
const D='33333333-3333-4333-8333-333333333333',AD='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',S='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
test('verified advisory contract shares canonical events without a Deal; legacy, ACL, replay, attribution and dated reversals survive',async()=>{
 const db=new PGlite();
 const call=async(name,p)=>(await db.query('select '+name+'($1::jsonb) result',[p])).rows[0].result;
 const read=async(cursor=null,limit=200)=>(await db.query('select public.crm_contract_sales_read_v2($1,$2) result',[cursor,limit])).rows[0].result;
 const as=async(auth,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[auth]);await db.exec('set role '+role)};
 try{
  await db.exec(fixture+`
   alter table public.deals add column owner_id uuid;
   alter table public.deals add column site_id uuid;
   alter table public.deals add column list_fields jsonb default '{}';
   alter table public.deals add column brand text;
   alter table public.deals add column stage_contexts jsonb default '{}';
   create table public.sites(site_id uuid primary key,site_name text);
   create table public.organizations(id uuid primary key,name text);
   create table public.advisory_deals(advisory_id uuid primary key,site_id uuid);
   create table crm_security.advisory_attribution(advisory_id uuid primary key,decision text,award_type text,
    version int,source_deal_id uuid,bid_amount bigint,performance_owner text,site_id uuid,origin_business text);
  `);
  await db.exec(oldSql);
  await db.query("insert into public.users values($1,$2,'검증담당','admin',true),($3,$4,'다른직원','rep',true)",[U,AU,V,AV]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day'),($3,$4,'rep','rep',true,now()+interval '1 day')",[U,AU,V,AV]);
  await db.query("insert into public.deals(id,owner_id,brand) values($1,$2,'기존영업')",[D,U]);
  await as(AU);
  await call('public.crm_contract_sales_write_v1',{deal_id:D,request_id:crypto.randomUUID(),kind:'signed',effective_date:'2020-01-01',amount_delta:300,expected_version:0,reason:'기존 계약'});
  await db.exec('reset role');
  const before=(await db.query('select * from crm_security.contract_sales_events')).rows[0];
  await db.exec(migration);
  const after=(await db.query('select * from crm_security.contract_sales_events')).rows[0];
  for(const key of Object.keys(before))assert.deepEqual(after[key],before[key]);
  assert.equal(after.contract_id,D);
  await db.query("insert into public.sites values($1,'독립 계약 합성현장')",[S]);
  await db.query('insert into public.advisory_deals values($1,$2)',[AD,S]);
  await db.query("insert into crm_security.advisory_attribution values($1,'confirmed','bid',1,null,885000000,'검증담당',$2,'기술자문 직접영업')",[AD,S]);
  const p={advisory_id:AD,attribution_version:1,target_kind:'independent_advisory',target_deal_id:null,
   contract_kind:'apartment_construction',signed:true,amount_basis:'construction_vat_exclusive',
   contract_date:'2020-08-20',construction_amount:885000000,sales_owner_name:'검증담당',
   existing_deal_search_completed:true,other_ledger_search_completed:true,matching_existing_deal_ids:[],other_matching_ledger_ids:[],
   ...Object.fromEntries(['signing_evidence','date_evidence','amount_evidence','owner_at_signing_evidence','same_contract_evidence',
    'existing_deal_search_evidence','duplicate_search_evidence','source_message_url','reviewed_by','reviewed_on'].map(k=>[k,'합성 검증 근거'])),
   construction_contract_key:'synthetic-contract-1'};
  await assert.rejects(call('crm_security.import_advisory_contract_v1',{...p,attribution_version:0}),/ATTRIBUTION_REVIEW_REQUIRED/);
  await assert.rejects(call('crm_security.import_advisory_contract_v1',{...p,date_evidence:''}),/INCOMPLETE_CONTRACT_EVIDENCE/);
  await assert.rejects(call('crm_security.import_advisory_contract_v1',{...p,construction_amount:885000001}),/CONFIRMED_AMOUNT_CONFLICT/);
  await assert.rejects(call('crm_security.import_advisory_contract_v1',{...p,sales_owner_name:'다른직원'}),/VERIFIED_OWNER_REQUIRED/);
  await assert.rejects(call('crm_security.import_advisory_contract_v1',{...p,contract_date:'2999-01-01'}),/INVALID_CONTRACT_DATE/);
  await db.query('update public.deals set site_id=$1 where id=$2',[S,D]);
  await assert.rejects(call('crm_security.import_advisory_contract_v1',p),/EXISTING_DEAL_REVIEW_REQUIRED/);
  await db.query('update public.deals set site_id=null where id=$1',[D]);
  const imported=await call('crm_security.import_advisory_contract_v1',p);
  assert.equal(imported.replayed,false);
  assert.equal((await call('crm_security.import_advisory_contract_v1',p)).replayed,true);
  await assert.rejects(call('crm_security.import_advisory_contract_v1',{...p,contract_date:'2020-08-21'}),/IMPORT_EVIDENCE_CONFLICT/);
  assert.equal((await db.query('select count(*)::int n from public.deals')).rows[0].n,1,'no fake opportunity');
  const importedEvent=(await db.query('select * from crm_security.contract_sales_events where contract_id=$1',[imported.contract_id])).rows[0];
  assert.equal(importedEvent.actor_auth_uid,null,'system import does not impersonate employee');
  assert.equal(importedEvent.import_id,imported.import_id);
  await as(AU);
  assert.equal((await read()).items.length,2);
  const page1=await read(null,1),page2=await read(page1.next_cursor,1);
  assert.equal(page1.has_more,true);assert.equal(page2.has_more,false);
  assert.notEqual(page1.items[0].contract_id,page2.items[0].contract_id);
  assert.equal((await db.query('select public.crm_contract_sales_read_v1() result')).rows[0].result.items.length,1,'legacy read remains Deal-only');
  await assert.rejects(call('crm_security.import_advisory_contract_v1',p),/permission denied/);
  await assert.rejects(db.exec('select * from crm_security.contract_sales_imports'),/permission denied/);
  await call('public.crm_contract_sales_write_v1',{deal_id:D,request_id:crypto.randomUUID(),kind:'amended',effective_date:'2020-02-01',amount_delta:50,expected_version:1,reason:'기존 계약 증액'});
  const adj={contract_id:imported.contract_id,request_id:crypto.randomUUID(),kind:'amended',effective_date:'2020-09-01',amount_delta:10000000,expected_version:1,reason:'서명된 변경계약'};
  await call('public.crm_contract_sales_adjust_v2',adj);
  assert.equal((await call('public.crm_contract_sales_adjust_v2',adj)).replayed,true);
  await assert.rejects(call('public.crm_contract_sales_adjust_v2',{...adj,request_id:crypto.randomUUID()}),/CONTRACT_VERSION_CONFLICT/);
  await assert.rejects(call('public.crm_contract_sales_adjust_v2',{...adj,request_id:crypto.randomUUID(),expected_version:2,effective_date:'2020-08-01'}),/INVALID_CONTRACT_DATE/);
  await call('public.crm_contract_sales_adjust_v2',{contract_id:imported.contract_id,request_id:crypto.randomUUID(),kind:'cancelled',effective_date:'2020-10-01',expected_version:2,reason:'취소 계약'});
  const row=(await read()).items.find(x=>x.contract_id===imported.contract_id);
  assert.equal(row.contract_amount,885000000);assert.equal(row.contract_date,'2020-08-20');assert.equal(row.sales_owner,U);
  assert.equal(row.events[2].amount_delta,-895000000);assert.equal(row.balance,0);assert.equal(row.deal_id,null);
  await as(AV);assert.equal((await read()).items.length,0);
  await assert.rejects(call('public.crm_contract_sales_adjust_v2',{...adj,expected_version:3,request_id:crypto.randomUUID()}),/forbidden/);
  await as(AU,'anon');await assert.rejects(read(),/permission denied/);
  await as(AU,'service_role');await assert.rejects(call('crm_security.import_advisory_contract_v1',p),/permission denied/);
  await db.exec('reset role');await db.query("update crm_security.access_review set permission_role='rep' where user_id=$1",[U]);
  await db.query("update crm_security.advisory_attribution set performance_owner='다른직원' where advisory_id=$1",[AD]);
  await as(AU);assert.equal((await read()).items.length,2,'frozen owner retains independent contract access');
 }finally{await db.close()}
});
