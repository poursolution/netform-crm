import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { fixture } from './aligo-database-fixture.mjs';

const sql = readFileSync(new URL('../sql/technical-advisory-project-read.sql', import.meta.url), 'utf8');
const admin = '10000000-0000-4000-8000-000000000001';
const rep = '10000000-0000-4000-8000-000000000002';
const stranger = '10000000-0000-4000-8000-000000000003';
const branch = '10000000-0000-4000-8000-000000000004';
const deal = '20000000-0000-4000-8000-000000000001';
const deletedDeal = '20000000-0000-4000-8000-000000000002';
const otherDeal = '20000000-0000-4000-8000-000000000003';
const doc = '30000000-0000-4000-8000-000000000001';
const expiredDoc = '30000000-0000-4000-8000-000000000002';

test('project basics read: bounded, authorized, independent of documents and read only', async t => {
 const db = new PGlite();
 try {
  await db.exec(fixture);
  await db.exec(`
   alter table public.deals add column owner_id uuid;
   create table crm_security.object_scope(user_id uuid,deal_id uuid,expires_at timestamptz,can_write boolean);
   create or replace function crm_security.can_deal(target uuid,writing boolean)
   returns boolean language sql stable security definer set search_path='' as $$
    select exists(select 1 from crm_security.actor() a join public.deals d on d.id=target
      where a.permission_role='admin' or (a.permission_role='rep' and d.owner_id=a.user_id)
      or (a.permission_role='branch' and exists(select 1 from crm_security.object_scope s
       where s.user_id=a.user_id and s.deal_id=d.id and s.expires_at>now() and (not writing or s.can_write))))
   $$;
   create table crm_security.advisory_project_snapshots(project_id text primary key,revision numeric(25,0),snapshot jsonb,received_at timestamptz default now());
   alter table crm_security.advisory_project_snapshots enable row level security;
   create table crm_security.advisory_deal_links(project_id text primary key,deal_id uuid);
   create table public.advisory_deals(advisory_id uuid primary key);
   create table crm_security.advisory_record_links(project_id text,document_id text,advisory_id uuid);
   create table crm_security.advisory_read_grants(advisory_id uuid,user_id uuid,expires_at timestamptz);
   create table crm_security.contract_sales_events(id int primary key,amount_delta bigint);
   insert into crm_security.contract_sales_events values(1,1000000000);
  `);
  for (const [id, role] of [[admin,'admin'],[rep,'rep'],[stranger,'rep'],[branch,'branch']]) {
   await db.query('insert into public.users values($1,$1,$2,$3,true)', [id, id === rep ? '원본 담당' : role, role]);
   await db.query("insert into crm_security.access_review values($1,$1,$2,$2,true,now()+interval '1 day')", [id, role]);
  }
  await db.query('insert into public.deals(id,owner_id) values($1,$2),($3,$4)', [deal, rep, otherDeal, stranger]);
  await db.query('insert into crm_security.advisory_deal_links values($1,$2),($3,$4),($5,$6)',
   ['p01',deal,'p04',deletedDeal,'p05',otherDeal]);
  await db.query('insert into public.advisory_deals values($1),($2)', [doc,expiredDoc]);
  await db.query('insert into crm_security.advisory_record_links values($1,$2,$3),($4,$5,$6)',
   ['p02','document-1',doc,'p03','document-2',expiredDoc]);
  await db.query("insert into crm_security.advisory_read_grants values($1,$2,now()+interval '1 day'),($3,$2,now()-interval '1 day')",
   [doc,rep,expiredDoc]);
  for (let n=1;n<=23;n++) {
   const id='p'+String(n).padStart(2,'0');
   await db.query('insert into crm_security.advisory_project_snapshots(project_id,revision,snapshot) values($1,$2,$3)',
    [id,'1234567890123456789012345',{
     source_project_id: 'untrusted-payload-id',
     site_name: '같은 현장명',work_name:'옥상 방수',company_name:'원본 업체',current_source_manager:'원본 담당',
     source_project_status:'contract_writing',source_printed_contract_date:null,
     source_consulting_contract_amount:n===1?null:0,
     operations:{schema_version:2,source_status:'contract_writing',completed:false,progress_rate:null,start_date:null,completion_date:null,private_url:'do-not-return'},
     contracts:[{private_document:'do-not-return'}],raw:{secret:'do-not-return'},document_url:'do-not-return'
    }]);
  }
  await db.query("insert into crm_security.object_scope values($1,$2,now()+interval '1 day',false),($1,$3,now()-interval '1 day',true)",[branch,otherDeal,deal]);
  await db.exec(sql);
  const login = async id => {
   await db.exec('reset role');
   await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
   await db.exec('set role authenticated');
  };
  const read = async (after=null,dealId=null) =>
   (await db.query('select public.crm_advisory_project_read_v1($1,$2) value',[after,dealId])).rows[0].value;
  const ids = r => r.items.map(i=>i.source_project_id);
  const state = async () => {
   await db.exec('reset role');
   return (await db.query(`select jsonb_build_object(
    'basics',(select jsonb_agg(t order by project_id) from crm_security.advisory_project_snapshots t),
    'deals',(select jsonb_agg(t order by id) from public.deals t),
    'ledger',(select jsonb_agg(t order by id) from crm_security.contract_sales_events t),
    'grants',(select jsonb_agg(t order by advisory_id) from crm_security.advisory_read_grants t)
   ) value`)).rows[0].value;
  };
  const before = await state();
  await t.test('admin gets documentless projects in stable pages of 20 without merging equal names', async () => {
   await login(admin);
   const first=await read();
   assert.equal(first.items.length,20); assert.equal(first.next_cursor,'p20');
   const last=await read(first.next_cursor);
   assert.deepEqual(ids(last),['p21','p22','p23']); assert.equal(last.next_cursor,null);
   assert.equal(new Set([...ids(first),...ids(last)]).size,23);
   assert.deepEqual(await read('p23'),{ok:true,items:[],next_cursor:null});
   assert.deepEqual(ids(await read(null,deal)),['p01']);
   await assert.rejects(read(null,deletedDeal),/forbidden/);
   await assert.rejects(read('x'.repeat(257)),/INVALID_CURSOR/);
   await assert.rejects(read('p01\n'),/INVALID_CURSOR/);
  });
  await t.test('only allowlisted source facts, exact IDs, precise revisions and unknown amounts', async () => {
   await login(admin);
   const r=await read();
   const first=r.items[0];
   assert.equal(first.source_project_id,'p01');
   assert.equal(first.revision,'1234567890123456789012345');
   assert.equal(first.source_consulting_contract_amount,null);
   assert.equal(r.items[1].source_consulting_contract_amount,0);
   assert.equal(first.source_printed_contract_date,null);
   assert.equal(first.operations.completed,false);
   assert.equal(JSON.stringify(r).includes('do-not-return'),false);
   assert.equal('contracts' in first,false);
   assert.equal('sales_owner' in first,false);
  });
  await t.test('rep uses exact live Deal access or existing unexpired advisory grant', async () => {
   await login(rep);
   assert.deepEqual(ids(await read()),['p01','p02']);
   assert.deepEqual(ids(await read(null,deal)),['p01']);
   assert.deepEqual(ids(await read('p01')),['p02']);
   await assert.rejects(read(null,otherDeal),/forbidden/);
   await assert.rejects(read(null,deletedDeal),/forbidden/);
   await login(stranger);
   assert.deepEqual(ids(await read()),['p05']);
  });
  await t.test('branch uses existing unexpired Deal scope including read-only scope', async () => {
   await login(branch);
   assert.deepEqual(ids(await read()),['p05']);
   assert.deepEqual(ids(await read(null,otherDeal)),['p05']);
   await assert.rejects(read(null,deal),/forbidden/);
  });
  await t.test('anonymous, missing and expired actors cannot read; raw tables stay private', async () => {
   await login(null);
   await assert.rejects(read(),/forbidden/);
   await login(rep);
   await assert.rejects(db.query('select * from crm_security.advisory_project_snapshots'),/permission denied/);
   await db.exec('reset role; set role anon');
   await assert.rejects(read(),/permission denied/);
   await db.exec('reset role');
   await db.query("update crm_security.access_review set expires_at=now()-interval '1 day' where user_id=$1",[rep]);
   await login(rep); await assert.rejects(read(),/forbidden/);
   await db.exec('reset role');
   await db.query("update crm_security.access_review set expires_at=now()+interval '1 day' where user_id=$1",[rep]);
  });
  await t.test('read leaves source observations, Deals, grants and contract ledger unchanged', async () => {
   assert.deepEqual(await state(),before);
   const props=(await db.query("select provolatile,prosecdef,proconfig from pg_proc where oid='public.crm_advisory_project_read_v1(text,uuid)'::regprocedure")).rows[0];
   assert.equal(props.provolatile,'s');
   assert.equal(props.prosecdef,true);
   assert.ok(props.proconfig.some(p=>p.startsWith('search_path=')));
  });
 } finally { await db.close(); }
});