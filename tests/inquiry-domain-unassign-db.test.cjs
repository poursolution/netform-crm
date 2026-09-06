'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const domain=require('../scripts/crm-inquiry-domain-candidate.cjs');
const s=require('../scripts/crm-phase1.cjs');
const inquiry=s.uid(5,5),internal=s.uid(1,1),admin=s.uid(1,5);
const adminAuth=s.mapping.accounts[4].auth_uid;
const request=n=>s.uid(20,n);

async function rpc(db,id,reason,account=4,extra={}){
 await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);
 try{
  return (await db.query(
   'SELECT public.crm_inquiry_unassign_command_v1($1,$2,$3) a',
   [id,inquiry,JSON.stringify({reason,...extra})]
  )).rows[0].a;
 }finally{await db.exec('RESET ROLE');}
}

async function prepared(){
 domain.build();
 const db=await domain.setup();
 const dispatcher=(await db.query(
  "SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) d"
 )).rows[0].d;
 await db.exec(domain.candidate);
 return {db,dispatcher};
}

test('manifest keeps the safe candidate separate from blocked inquiry meanings',()=>{
 const manifest=domain.build();
 assert.equal(manifest.project_ref,'rprechiaglyjaydkmxsu');
 assert.equal(manifest.status,'DERIVED_SAFE_LOCAL_CANDIDATE_NOT_APPLIED');
 assert.deepEqual(manifest.derived_safe,['inquiry_unassign']);
 for(const intent of ['response_update','branch_handoff','branch_owner_assign'])assert.ok(manifest.blocked.includes(intent));
 for(const digest of Object.values(manifest.files))assert.match(digest,/^[0-9a-f]{64}$/);
});

test('DERIVED_SAFE inquiry_unassign persists only server-owned state and evidence',async t=>{
 const {db,dispatcher}=await prepared();
 try{
  await db.query(
   "UPDATE public.inquiries SET assigned_to=$2,assigned_at=now(),status='배정완료',first_response_at=NULL,responded_at=NULL WHERE id=$1",
   [inquiry,internal]);

  const first=request(1);
  await t.test('unresponded assignment is cleared and status returns to 접수',async()=>{
   const a=await rpc(db,first,'  담당 권역 변경  ');
   assert.equal(a.ok,true);assert.equal(a.operation,'inquiry_unassign');
   assert.equal(a.actor_auth_uid,adminAuth);assert.equal(a.actor_user_id,admin);
   assert.equal(a.changed,true);assert.equal(a.assigned_to,null);assert.equal(a.status,'접수');
   const row=(await db.query('SELECT assigned_to,assigned_at,status FROM public.inquiries WHERE id=$1',[inquiry])).rows[0];
   assert.deepEqual(row,{assigned_to:null,assigned_at:null,status:'접수'});
   const h=(await db.query(
    'SELECT from_owner,to_owner,reason,actor_name FROM public.assignment_history WHERE inquiry_id=$1 ORDER BY changed_at DESC LIMIT 1',[inquiry])).rows[0];
   assert.deepEqual(h,{from_owner:'TEST INTERNAL_REP',to_owner:'미배정',reason:'담당 권역 변경',actor_name:'TEST ADMIN'});
   const audit=(await db.query(
    "SELECT actor_auth_uid,actor_user_id,action,reason FROM crm_security.inquiry_audit_events WHERE inquiry_id=$1 AND action='inquiry_unassign'",[inquiry])).rows[0];
   assert.deepEqual(audit,{actor_auth_uid:adminAuth,actor_user_id:admin,action:'inquiry_unassign',reason:'담당 권역 변경'});
  });

  await t.test('same request replays without duplicate history or audit',async()=>{
   const a=await rpc(db,first,'담당 권역 변경');assert.equal(a.replayed,true);
   assert.equal((await db.query("SELECT count(*)::int n FROM public.assignment_history WHERE inquiry_id=$1 AND to_owner='미배정'",[inquiry])).rows[0].n,1);
   assert.equal((await db.query("SELECT count(*)::int n FROM crm_security.inquiry_audit_events WHERE inquiry_id=$1 AND action='inquiry_unassign'",[inquiry])).rows[0].n,1);
  });

  await t.test('request id reuse with another payload is 409',async()=>{
   await assert.rejects(rpc(db,first,'다른 사유'),e=>e.code==='PT409');
  });

  await t.test('reason is mandatory and an already-unassigned retryable action is a no-op',async()=>{
   await assert.rejects(rpc(db,request(5),'   '),e=>e.code==='22023');
   const h=(await db.query("SELECT count(*)::int n FROM public.assignment_history WHERE inquiry_id=$1 AND to_owner='미배정'",[inquiry])).rows[0].n;
   const a=await rpc(db,request(6),'화면 재확인');
   assert.equal(a.changed,false);assert.equal(a.assigned_to,null);
   assert.equal((await db.query("SELECT count(*)::int n FROM public.assignment_history WHERE inquiry_id=$1 AND to_owner='미배정'",[inquiry])).rows[0].n,h);
   assert.equal((await db.query("SELECT count(*)::int n FROM crm_security.inquiry_audit_events WHERE inquiry_id=$1 AND action='inquiry_unassign'",[inquiry])).rows[0].n,1);
  });

  await t.test('responded inquiry keeps status while assignment is cleared',async()=>{
   await db.query(
    "UPDATE public.inquiries SET assigned_to=$2,assigned_at=now(),status='응대중',first_response_at=now(),responded_at=NULL WHERE id=$1",
    [inquiry,internal]);
   const a=await rpc(db,request(2),'업무량 조정');assert.equal(a.status,'응대중');
   assert.equal((await db.query('SELECT status FROM public.inquiries WHERE id=$1',[inquiry])).rows[0].status,'응대중');
  });

  await t.test('client actor/time/status fields and non-admin caller are rejected',async()=>{
   await assert.rejects(rpc(db,request(3),'사유',4,{changed_by:'FORGED'}),e=>e.code==='22023');
   await db.query("UPDATE public.inquiries SET assigned_to=$2,assigned_at=now(),status='배정완료' WHERE id=$1",[inquiry,internal]);
   await assert.rejects(rpc(db,request(4),'사유',1),e=>e.code==='42501');
   assert.equal((await db.query('SELECT assigned_to FROM public.inquiries WHERE id=$1',[inquiry])).rows[0].assigned_to,internal);
  });

  await t.test('frozen Dispatcher definition is byte-for-byte unchanged',async()=>{
   const after=(await db.query(
    "SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) d"
   )).rows[0].d;
   assert.equal(after,dispatcher);
  });
 }finally{await db.close();}
});

test('rollback archives unassign evidence and restores the two allowlists',async()=>{
 const {db}=await prepared();
 try{
  await db.query(
   "UPDATE public.inquiries SET assigned_to=$2,assigned_at=now(),status='배정완료',first_response_at=NULL,responded_at=NULL WHERE id=$1",
   [inquiry,internal]);
  await rpc(db,request(9),'rollback evidence');
  await db.exec(domain.rollback);
  assert.equal((await db.query(
   "SELECT to_regprocedure('public.crm_inquiry_unassign_command_v1(uuid,uuid,jsonb)') IS NULL gone")).rows[0].gone,true);
  assert.equal((await db.query(
   "SELECT count(*)::int n FROM crm_inquiry_unassign_archive.command_receipts WHERE operation='inquiry_unassign'")).rows[0].n,1);
  assert.equal((await db.query(
   "SELECT count(*)::int n FROM crm_inquiry_unassign_archive.inquiry_audit_events WHERE action='inquiry_unassign'")).rows[0].n,1);
  assert.equal((await db.query(
   "SELECT pg_get_constraintdef(oid,true) d FROM pg_constraint WHERE conrelid='crm_security.command_receipts'::regclass AND conname='command_receipts_operation_check'")).rows[0].d,
   "CHECK (operation = ANY (ARRAY['opportunity_work_set'::text, 'inquiry_assign'::text]))");
  assert.equal((await db.query('SELECT assigned_to FROM public.inquiries WHERE id=$1',[inquiry])).rows[0].assigned_to,null);
  assert.equal((await db.query("SELECT count(*)::int n FROM public.assignment_history WHERE inquiry_id=$1 AND to_owner='미배정'",[inquiry])).rows[0].n,1);
 }finally{await db.close();}
});
