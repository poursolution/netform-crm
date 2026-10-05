'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const personal=require('../sql/personal-state-compat/20260906/build.cjs'),s=require('../scripts/crm-phase1.cjs');
const sourceApproval="SET crm.operational_source_ref='rprechiaglyjaydkmxsu';\n",sourceSql=fs.readFileSync(path.join(__dirname,'../sql/operational-read-source/20260906/candidate.sql'),'utf8'),personalSql=fs.readFileSync(path.join(__dirname,'../sql/personal-state-compat/20260906/candidate.sql'),'utf8'),deal=s.uid(6,1),auth=s.mapping.accounts[0].auth_uid;
const rid=n=>`f6090600-0080-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(){const db=await personal.setup();await db.exec(personal.approval+personalSql);await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-action-bundle/20260906/staging-apply-after-personal.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-quote-version/20260906/staging-apply-after-action.sql'),'utf8'));await db.exec(sourceApproval+sourceSql);await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-next-complete/20260906/staging-apply-after-operational-source.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-stage-check/20260906/staging-apply-after-next-complete.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-transition/20260906/staging-apply-after-stage-check.sql'),'utf8'));return db;}
async function write(db,account,version,payload,request,op='transition'){await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);return (await db.query('SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[request,op,deal,version,JSON.stringify(payload)])).rows[0].a;}

const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261005072749_optional_contract_bid_result.sql'),'utf8');
const definitionSql="SELECT pg_get_functiondef('crm_security.crm_transition_validate_v1(text,jsonb,date)'::regprocedure) AS body";
test('direct contract skips PT/bidding without invented results; contract validation and actual history remain',async()=>{
 const db=await setup();try{
  await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261005063232_stage_transition_without_skip_reason.sql'),'utf8'));
  const fields={bid_result:'',contract_amount:100000000,contract_status:'체결 완료',contract_date:'2026-09-01'};
  const payload={from:'first_contact',to:'contract',transition_date:'2026-09-01',fields,skip_reason:'',memo:'',note:'직접 계약 체결'};
  await assert.rejects(write(db,0,1,payload,rid(201)),/invalid contract fields/);
  const before=(await db.query(definitionSql)).rows[0].body;
  await db.exec(migration);
  const after=(await db.query(definitionSql)).rows[0].body;
  assert.equal(after,before.replace(migration.split('$old$')[1],migration.split('$new$')[1]),'only the contract validation clause changes');
  const validate=values=>db.query("SELECT crm_security.crm_transition_validate_v1('contract',$1::jsonb,'2026-09-01'::date)",[JSON.stringify(values)]);
  for(const bid_result of [undefined,null,'','낙찰','우선협상','수의계약','확인중'])await validate({...fields,bid_result});
  for(const bid_result of [42,[],{},'임의 결과'])await assert.rejects(validate({...fields,bid_result}),e=>e.code==='22023');
  for(const key of ['contract_amount','contract_status','contract_date']){
   const missing={...fields};delete missing[key];await assert.rejects(validate(missing),e=>e.code==='22023');
  }
  await assert.rejects(validate({...fields,contract_amount:0}),e=>e.code==='22023');
  await assert.rejects(validate({...fields,contract_date:'2026-09-02'}),e=>e.code==='22023');
  await assert.rejects(write(db,1,1,payload,rid(202)),e=>e.code==='42501');
  const beforeDeal=(await db.query('SELECT stage_checklist FROM public.deals WHERE id=$1',[deal])).rows[0];
  const result=await write(db,0,1,payload,rid(203));assert.equal(result.to_stage,'contract');
  assert.equal((await write(db,0,1,payload,rid(203))).replayed,true);
  const row=(await db.query('SELECT stage_code,stage_contexts,stage_checklist FROM public.deals WHERE id=$1',[deal])).rows[0];
  assert.equal(row.stage_code,'contract');assert.deepEqual(Object.keys(row.stage_contexts),['contract']);
  assert.equal(row.stage_contexts.contract.fields.bid_result,'');assert.deepEqual(row.stage_checklist,beforeDeal.stage_checklist);
  const history=(await db.query('SELECT from_stage,to_stage FROM public.stage_history WHERE opportunity_id=$1',[deal])).rows;
  assert.deepEqual(history,[{from_stage:'first_contact',to_stage:'contract'}]);
  assert.equal((await db.query('SELECT count(*)::int n FROM crm_security.stage_transition_events WHERE deal_id=$1',[deal])).rows[0].n,1);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_transition_validate_v1(text,jsonb,date)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 }finally{await db.close();}
});
