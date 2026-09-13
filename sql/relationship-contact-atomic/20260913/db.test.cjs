'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bundle=require('../../operational-bundle/20260906/build.cjs');
const s=require('../../../scripts/crm-phase1.cjs');
const deal=s.uid(6,1),request=n=>`f6091300-0013-4000-8000-${String(n).padStart(12,'0')}`;
const payload=()=>({activity:{type:'전화',note:'고객 통화 완료',result:'다음 주 재확인',occurred_at:'2026-09-13T01:00:00Z',meaningful_contact:true},next_action:{type:'전화',text:'공사계획 재확인',due_at:'2026-09-20'}});
async function call(db,id,version,p=payload(),account=0){
 await db.exec(`SET request.jwt.claim.sub='${s.mapping.accounts[account].auth_uid}';`);
 return (await db.query('SELECT crm_security.crm_relationship_contact_candidate($1,$2,$3,$4) a',[request(id),deal,version,JSON.stringify(p)])).rows[0].a;
}
async function snapshot(db){return (await db.query(`SELECT jsonb_build_object(
 'deal',(SELECT to_jsonb(d) FROM public.deals d WHERE id=$1),
 'activities',(SELECT count(*) FROM public.activities),
 'next',(SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM public.next_actions n),
 'audit',(SELECT count(*) FROM crm_security.audit_events),
 'receipts',(SELECT count(*) FROM crm_security.command_receipts)) s`,[deal])).rows[0].s;}
test('relationship atomic save local database contract',async t=>{
 const db=await bundle.setup();try{
  await db.exec(bundle.approval+bundle.compose());
  await db.exec("SET crm.pipeline_action_ref='rprechiaglyjaydkmxsu';\n"+fs.readFileSync(path.join(__dirname,'../../pipeline-action-bundle/20260906/candidate.sql'),'utf8'));
  const beforePublic=(await db.query("SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) def")).rows[0];
  await db.exec("SET crm.relationship_contact_lab='local-only';\n"+fs.readFileSync(path.join(__dirname,'helper.local.sql'),'utf8'));
  await db.query("UPDATE public.deals SET stage_code='rapport' WHERE id=$1",[deal]);
  await t.test('private only; public endpoint unchanged',async()=>{
   assert.deepEqual((await db.query("SELECT pg_get_functiondef('public.crm_write_command_v2(uuid,text,uuid,integer,jsonb)'::regprocedure) def")).rows[0],beforePublic);
   for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_function_privilege($1,'crm_security.crm_relationship_contact_candidate(uuid,uuid,integer,jsonb)','EXECUTE') allowed",[role])).rows[0].allowed,false);
  });
  await t.test('second write failure rolls back activity, timestamps, version, audit and receipts',async()=>{
   const before=await snapshot(db),p=payload();p.next_action.text='';
   await assert.rejects(call(db,1,1,p),e=>e.code==='22023');assert.deepEqual(await snapshot(db),before);
  });
  let ack;
  await t.test('contact and next date save together with linked server IDs',async()=>{
   ack=await call(db,2,1);assert.equal(ack.version,3);assert.equal(ack.replayed,false);
   const row=(await db.query('SELECT source_activity_id,title,due_at::date::text FROM public.next_actions WHERE id=$1',[ack.next_action_id])).rows[0];
   assert.deepEqual(row,{source_activity_id:ack.activity_id,title:'공사계획 재확인',due_at:'2026-09-20'});
  });
  await t.test('lost response replay and changed payload do not duplicate or overwrite',async()=>{
   const before=await snapshot(db);assert.equal((await call(db,2,1)).replayed,true);
   const p=payload();p.next_action.text='다른 요청';await assert.rejects(call(db,2,1,p),e=>e.code==='PT409');
   assert.deepEqual(await snapshot(db),before);
  });
  await t.test('stale version and foreign owner fail without writes',async()=>{
   const before=await snapshot(db);await assert.rejects(call(db,3,1),e=>e.code==='PT409');
   await assert.rejects(call(db,4,3,payload(),1),e=>e.code==='42501');assert.deepEqual(await snapshot(db),before);
  });
  await t.test('invalid fields and impossible or backwards dates fail without writes',async()=>{
   const before=await snapshot(db);
   for(const mutate of [p=>p.actor_id='forged',p=>delete p.activity.meaningful_contact,p=>p.next_action.assignee='TEST INTERNAL_REP',p=>p.next_action.due_at='2026-02-30',p=>p.next_action.due_at='2026-09-12',p=>p.activity.occurred_at='infinity']){
    const p=payload();mutate(p);await assert.rejects(call(db,5,3,p),e=>e.code==='22023');
   }assert.deepEqual(await snapshot(db),before);
  });
  await t.test('unsuccessful call preserves last successful contact',async()=>{
   const before=(await snapshot(db)).deal.last_customer_contact_at,p=payload();p.activity.note='전화 시도 - 부재';p.activity.meaningful_contact=false;p.activity.occurred_at='2026-09-14T01:00:00Z';
   await call(db,6,3,p);assert.equal((await snapshot(db)).deal.last_customer_contact_at,before);
  });
  await t.test('multiple open actions are preserved rather than silently cancelled',async()=>{
   await db.query("INSERT INTO public.next_actions(deal_id,action_type,title,due_at,assignee_name,status) VALUES($1,'회의','별도 약속','2026-09-21','TEST INTERNAL_REP','open')",[deal]);
   const before=await snapshot(db);await assert.rejects(call(db,8,5),e=>e.code==='PT409');
   assert.deepEqual(await snapshot(db),before);
   await db.query("DELETE FROM public.next_actions WHERE deal_id=$1 AND title='별도 약속'",[deal]);
  });
  await t.test('database failure after both child writes also rolls everything back',async()=>{
   await db.exec(`CREATE FUNCTION public.lab_contact_link_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'lab link failure'; END $$;
    CREATE TRIGGER lab_contact_link_failure BEFORE UPDATE OF source_activity_id ON public.next_actions FOR EACH ROW EXECUTE FUNCTION public.lab_contact_link_failure();`);
   const before=await snapshot(db);await assert.rejects(call(db,9,5),e=>e.code==='P0001');
   assert.deepEqual(await snapshot(db),before);
   await db.exec('DROP TRIGGER lab_contact_link_failure ON public.next_actions; DROP FUNCTION public.lab_contact_link_failure();');
  });
  await t.test('inactive and expired accounts cannot write even with a JWT subject',async()=>{
   for(const change of [
    `UPDATE public.users SET active=false WHERE auth_uid='${s.mapping.accounts[0].auth_uid}'`,
    `UPDATE crm_security.access_review SET expires_at=now()-interval '1 day' WHERE reviewed_auth_uid='${s.mapping.accounts[0].auth_uid}'`
   ]){
    const before=await snapshot(db);await db.exec('BEGIN;'+change);
    try{await assert.rejects(call(db,10,5),e=>e.code==='42501');}finally{await db.exec('ROLLBACK');}
    assert.deepEqual(await snapshot(db),before);
   }
  });
  await t.test('missing one durable child receipt does not repair itself by writing another activity',async()=>{
   const before=await snapshot(db);await db.exec('BEGIN');
   try{
    await db.query('DELETE FROM crm_security.command_receipts WHERE request_id=$1',[ack.next_request_id]);
    await assert.rejects(call(db,2,1),e=>e.code==='PT409');
   }finally{await db.exec('ROLLBACK');}
   assert.deepEqual(await snapshot(db),before);
  });
  await t.test('closed or non-relationship deals cannot create a fresh contact bundle',async()=>{
   await db.query("UPDATE public.deals SET stage_code='first_contact' WHERE id=$1",[deal]);const before=await snapshot(db);
   await assert.rejects(call(db,7,5),e=>e.code==='22023');assert.deepEqual(await snapshot(db),before);
  });
 }finally{await db.close();}
});
