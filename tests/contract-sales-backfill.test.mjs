import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from './aligo-database-fixture.mjs';

const ledger=readFileSync(new URL('../supabase/migrations/20260920160000_contract_sales_ledger.sql',import.meta.url),'utf8');
const backfill=readFileSync(new URL('../supabase/migrations/20260920213000_contract_sales_backfill_won.sql',import.meta.url),'utf8');
const rollback=readFileSync(new URL('../supabase/rollback/20260920213000_contract_sales_backfill_won.sql',import.meta.url),'utf8');

// 과거 수주 초기 이관: 확인되는 건만 올리고, 수기 기록과 확인 불가 건은 건드리지 않는다.
test('contract ledger backfill: verified wins only, manual records untouched, safe rollback',async()=>{
 const db=new PGlite();
 const U='11111111-1111-4111-8111-111111111111',AU='22222222-2222-4222-8222-222222222222';
 const W1='a1111111-1111-4111-8111-111111111111'; // 계약 단계 날짜 + 금액 + 담당 → 이관
 const W2='a2222222-2222-4222-8222-222222222222'; // 준공일 경로 → 이관 (이후 수기 변경을 얹는다)
 const W3='a3333333-3333-4333-8333-333333333333'; // 종결일 경로 → 이관
 const S1='b1111111-1111-4111-8111-111111111111'; // 금액 0 → 제외
 const S2='b2222222-2222-4222-8222-222222222222'; // 날짜 전무 → 제외
 const S3='b3333333-3333-4333-8333-333333333333'; // 담당자 없음 → 제외
 const M1='c1111111-1111-4111-8111-111111111111'; // 백필 전 수기 서명 → 그대로 정본
 try{
  await db.exec(fixture+`alter table public.deals add column owner_id uuid;alter table public.deals add column site_id uuid;alter table public.deals add column list_fields jsonb default '{}'::jsonb;alter table public.deals add column brand text;alter table public.deals add column stage_contexts jsonb default '{}'::jsonb;alter table public.deals add column outcome text;alter table public.deals add column won_amount numeric;alter table public.deals add column completion_date date;alter table public.deals add column closed_at timestamptz;create table public.sites(site_id uuid primary key,site_name text);create table public.organizations(id uuid primary key,name text);`);
  await db.exec(ledger);
  await db.query("insert into public.users values($1,$2,'황윤선','admin',true)",[U,AU]);
  await db.query("insert into crm_security.access_review values($1,$2,'admin','admin',true,now()+interval '1 day')",[U,AU]);
  const deal=(id,fields)=>db.query(`insert into public.deals(id,owner_id,list_fields,brand,outcome,won_amount,completion_date,closed_at,stage_contexts) values($1,$2,$3,'시험','won',$4,$5,$6,$7)`,
   [id,fields.owner===null?null:U,JSON.stringify({site_name:'현장 '+id.slice(0,2)}),fields.amount,fields.completion||null,fields.closed||null,JSON.stringify(fields.ctx||{})]);
  await deal(W1,{amount:250000000,ctx:{contract:{fields:{contract_date:'2025-03-02'}}}});
  await deal(W2,{amount:74000000,completion:'2025-06-10'});
  await deal(W3,{amount:52000000,closed:'2025-08-01T09:00:00Z'});
  await deal(S1,{amount:0,completion:'2025-01-01'});
  await deal(S2,{amount:10000000});
  await deal(S3,{amount:10000000,completion:'2025-01-01',owner:null});
  // 수기 기록이 먼저 있는 딜 — 백필이 덮으면 안 된다.
  await deal(M1,{amount:99000000,completion:'2025-02-01'});
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[AU]);await db.exec('set role authenticated');
  const manual={deal_id:M1,request_id:crypto.randomUUID(),kind:'signed',effective_date:'2025-02-03',amount_delta:88000000,expected_version:0,reason:'수기 계약 확인'};
  await db.query('select public.crm_contract_sales_write_v1($1::jsonb)',[JSON.stringify(manual)]);
  await db.exec('reset role');

  await db.exec(backfill);
  const rows=(await db.query('select deal_id,contract_date::text d,contract_amount,version,balance from crm_security.contract_sales order by deal_id')).rows;
  assert.equal(rows.length,4,'three backfilled + one manual');
  const byId=Object.fromEntries(rows.map(r=>[r.deal_id,r]));
  assert.equal(byId[W1].d,'2025-03-02');assert.equal(Number(byId[W1].contract_amount),250000000);
  assert.equal(byId[W2].d,'2025-06-10');
  assert.equal(byId[W3].d,'2025-08-01');
  assert.equal(Number(byId[M1].contract_amount),88000000,'manual record is untouched');
  for(const id of [S1,S2,S3])assert.equal(byId[id],undefined,'unverified win stays out of the ledger');
  const events=(await db.query("select deal_id,sequence,kind,reason from crm_security.contract_sales_events order by deal_id,sequence")).rows;
  assert.equal(events.filter(e=>e.reason.startsWith('과거 수주 초기 이관')).length,3);
  assert.ok(events.every(e=>e.sequence===1),'backfill emits a single signed event per deal');
  // 재실행해도 중복이 생기지 않는다.
  await db.exec(backfill);
  assert.equal((await db.query('select count(*)::int n from crm_security.contract_sales')).rows[0].n,4,'backfill is idempotent');
  // 백필 위에 수기 변경을 얹은 딜은 롤백에서도 보존된다.
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[AU]);await db.exec('set role authenticated');
  await db.query('select public.crm_contract_sales_write_v1($1::jsonb)',[JSON.stringify({deal_id:W2,request_id:crypto.randomUUID(),kind:'amended',effective_date:'2025-07-01',amount_delta:6000000,expected_version:1,reason:'증액 확인'})]);
  await db.exec('reset role');
  await db.exec(rollback);
  const left=(await db.query('select deal_id from crm_security.contract_sales order by deal_id')).rows.map(r=>r.deal_id);
  assert.deepEqual(left.sort(),[W2,M1].sort(),'rollback removes only untouched backfill rows');
 }finally{await db.close()}
});
