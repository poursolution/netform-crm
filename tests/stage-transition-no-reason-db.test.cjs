'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const personal=require('../sql/personal-state-compat/20260906/build.cjs'),s=require('../scripts/crm-phase1.cjs');
const sourceApproval="SET crm.operational_source_ref='rprechiaglyjaydkmxsu';\n",sourceSql=fs.readFileSync(path.join(__dirname,'../sql/operational-read-source/20260906/candidate.sql'),'utf8'),personalSql=fs.readFileSync(path.join(__dirname,'../sql/personal-state-compat/20260906/candidate.sql'),'utf8'),deal=s.uid(6,1),auth=s.mapping.accounts[0].auth_uid;
const rid=n=>`f6090600-0080-4000-8000-${String(n).padStart(12,'0')}`;
async function setup(){const db=await personal.setup();await db.exec(personal.approval+personalSql);await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-action-bundle/20260906/staging-apply-after-personal.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-quote-version/20260906/staging-apply-after-action.sql'),'utf8'));await db.exec(sourceApproval+sourceSql);await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-next-complete/20260906/staging-apply-after-operational-source.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-stage-check/20260906/staging-apply-after-next-complete.sql'),'utf8'));await db.exec(fs.readFileSync(path.join(__dirname,'../sql/pipeline-transition/20260906/staging-apply-after-stage-check.sql'),'utf8'));return db;}
async function write(db,account,version,payload,request,op='transition'){await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);return (await db.query('SELECT public.crm_write_command_v2($1,$2,$3,$4,$5) a',[request,op,deal,version,JSON.stringify(payload)])).rows[0].a;}

const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261005063232_stage_transition_without_skip_reason.sql'),'utf8');
const definitionSql="SELECT pg_get_functiondef('crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)'::regprocedure) AS body";
test('skip and backwards require no explanation; required data, permissions and audit survive',async()=>{
 const db=await setup();try{
  const before=(await db.query(definitionSql)).rows[0].body;
  const skip={from:'first_contact',to:'compete',transition_date:'2026-09-01',fields:{competition_type:'경쟁견적'},skip_reason:'',memo:'',note:'경쟁 상황 확인'};
  await assert.rejects(write(db,0,1,skip,rid(101)),/transition exception reason is required/);
  await db.exec(migration);
  const after=(await db.query(definitionSql)).rows[0].body;
  assert.equal(after,before.replace(" IF to_value<>'waiting' AND NOT standard AND length(skip_value)<5\n THEN RAISE EXCEPTION 'transition exception reason is required' USING ERRCODE='22023'; END IF;",' -- Skip/backward explanation is optional; structured stage data and history remain required.'));
  assert.equal((await write(db,0,1,skip,rid(102))).to_stage,'compete');
  const back={...skip,from:'compete',to:'consulting',fields:{quote_request:'수정 견적',quote_due:'2026-09-12'}};
  await assert.rejects(write(db,0,2,{...back,fields:{}},rid(103)),e=>e.code==='22023');
  await assert.rejects(write(db,1,2,back,rid(104)),e=>e.code==='42501');
  await assert.rejects(write(db,0,1,back,rid(105)),e=>e.code==='PT409');
  assert.equal((await write(db,0,2,back,rid(106))).to_stage,'consulting');
  assert.equal((await write(db,0,2,back,rid(106))).replayed,true);
  assert.equal((await db.query('SELECT count(*)::int n FROM crm_security.stage_transition_events WHERE deal_id=$1',[deal])).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.stage_history WHERE opportunity_id=$1',[deal])).rows[0].n,2);
  for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_deal_transition_command_v1(uuid,uuid,integer,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
 }finally{await db.close();}
});
