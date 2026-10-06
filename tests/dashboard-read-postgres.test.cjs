const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite'),read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('dashboard company scope is read-only, reviewed role gated, paginated and separate from own scope',async()=>{
 const db=new PGlite(),rep='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create schema crm_security;");
  await db.exec(read('tests/fixtures/dashboard-read-schema.sql'));
  await db.exec(`create function crm_security.actor() returns table(user_id uuid,auth_uid uuid,display_name text,permission_role text) language sql stable as $$
   select '${rep}'::uuid,'${rep}'::uuid,'synthetic',current_setting('test.role',true) where current_setting('test.role',true)<>'' $$;
   create function crm_security.can_deal(target uuid,writing boolean default false) returns boolean language sql stable as $$
   select exists(select 1 from public.deals d,crm_security.actor() a where d.id=target and (a.permission_role='admin' or d.owner_id=a.user_id)) $$;
   set test.role='rep';`);
  await db.exec("create function crm_security.inquiry_flow_state_json(x uuid) returns jsonb language sql stable as $$select to_jsonb(s) from crm_security.inquiry_flow_state s where s.inquiry_id=x$$;");
  await db.exec(read('sql/dashboard-read-all-20261007.sql'));await db.exec(read('sql/dashboard-read-all-20261007.sql'));
  const q1='20000000-0000-4000-8000-000000000001',q2='20000000-0000-4000-8000-000000000002';
  for(const [id,owner] of [[q1,rep],[q2,other]]){
   await db.query("insert into deals(id,owner_id,brand,stage_code,amount) values($1,$2,'POUR솔루션','contact',100)",[id,owner]);
   await db.query("insert into inquiries(id,assigned_to,brand,status,phone) values($1,$2,'POUR공법','접수','PRIVATE')",[id,owner]);
   await db.query("insert into crm_security.contract_sales(contract_id,deal_id,sales_owner,sales_owner_name,contract_date,contract_amount,version,balance) values($1,$1,$2,'담당',current_date,100,1,100)",[id,owner]);
   await db.query("insert into crm_security.contract_sales_events(contract_id,deal_id,event_id,sequence,kind,effective_date,amount_delta) values($1,$1,$1,1,'signed',current_date,100)",[id]);
  }
  const readPage=async(domain,after=null,limit=100)=>(await db.query("select public.crm_dashboard_source_v1($1,$2,$3) r",[domain,after,limit])).rows[0].r;
  await db.exec('set role authenticated');
  let page=await readPage('deal_core',null,1);assert.equal(page.items.length,1);assert.equal(page.pagination.has_more,true);
  page=await readPage('deal_core',page.pagination.next_cursor,1);assert.equal(page.items[0].id,q2);assert.equal(page.pagination.has_more,false);
  page=await readPage('inquiry_core');assert.equal(page.items.length,2);assert.ok(page.items.every(x=>!('phone' in x)));
  assert.equal(page.scope_completeness,'dashboard_all_read_only');
  const ledger=(await db.query("select public.crm_dashboard_contracts_v1(null,200) r")).rows[0].r;
  assert.equal(ledger.items.length,2);assert.equal(ledger.items.reduce((s,r)=>s+r.balance,0),200);
  assert.equal(ledger.items.find(r=>r.deal_id===q2).sales_owner,other,'historical attribution unchanged');
  await db.exec('reset role');
  assert.equal((await db.query("select crm_security.can_deal($1,true) yes",[q2])).rows[0].yes,false,'foreign write predicate remains false');
  assert.equal((await db.query("select crm_security.can_deal($1,false) yes",[q2])).rows[0].yes,false,'existing ordinary read predicate remains own');
  await db.exec("set test.role='consultation';set role authenticated");await assert.rejects(readPage('deal_core'),/forbidden/);
  await assert.rejects(db.query("select public.crm_dashboard_contracts_v1(null,200)"),/forbidden/);
  await db.exec("reset role;set test.role='';set role authenticated");await assert.rejects(readPage('inquiry_core'),/forbidden/);
  await db.exec("reset role;set test.role='rep';set role anon");await assert.rejects(readPage('deal_core'),/permission denied/);
  await db.exec("reset role;set role authenticated");await assert.rejects(readPage('contacts'),/unsupported/);await assert.rejects(readPage('deal_core',null,0),/invalid limit/);
  await assert.rejects(db.query("update public.deals set amount=0"),/permission denied/);
  await db.exec("reset role");assert.equal((await db.query("select sum(amount)::int n from deals")).rows[0].n,200);
 }finally{await db.close();}
});
