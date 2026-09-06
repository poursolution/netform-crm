'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=require('../scripts/crm-inquiry-read-compat.cjs');
const direct=require('../scripts/crm-inquiry-direct-assign.cjs');
const stage=require('../scripts/crm-phase1.cjs');

const inquiry=stage.uid(5,5);
const deal=stage.uid(6,5);
const adminIndex=4;
const repIndex=0;

async function asActor(db,index,fn){
 await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${stage.mapping.accounts[index].auth_uid}';`);
 try{return await fn()}finally{await db.exec('RESET ROLE')}
}

test('snapshot and current UI evidence still support the candidate',()=>{
 const snapshot=read.loadSnapshot(),fn=read.validateSnapshot(snapshot),evidence=read.sourceEvidence();
 assert.equal(fn.signature,read.signature);
 assert.equal(evidence.length,7);
 assert.match(fn.definition,/SELECT i\.id,i\.assigned_to,i\.site_name,i\.status/);
});

test('candidate preserves scopes and excludes unconfirmed response content',()=>{
 const sql=read.candidate(read.loadSnapshot());
 assert.match(sql,/crm_security\.can_inquiry\(p_inquiry_id\)/);
 assert.match(sql,/WHERE crm_security\.can_inquiry\(i\.id\)/);
 assert.match(sql,/crm_security\.can_deal\(d\.id,false\)/);
 for(const field of ['d.primary_work','d.work_items','d.work_scope_type','d.work_summary','d.version'])assert.match(sql,new RegExp(field.replace('.','\\.')));
 assert.match(sql,/coalesce\(u\.name,i\.assignee_name\) AS assignee/);
 assert.match(sql,/i\.assigned_to/);
 assert.match(sql,/assignment_history/);
 const fn=read.definition();
 assert.doesNotMatch(fn,/parse_responses/);
 assert.doesNotMatch(fn,/AS responses/);
 assert.doesNotMatch(fn,/AS responder/);
 assert.doesNotMatch(fn,/SELECT\s+i\.raw(?:\s|,)/);
});

test('local PostgreSQL applies, enforces can_inquiry, returns aliases, and rolls back exactly',async()=>{
 const built=await read.build(),db=await direct.setup();
 try{
  const before=(await db.query("SELECT pg_get_functiondef('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure) d")).rows[0].d;
  const beforeAcl=(await db.query("SELECT proacl::text acl,pg_get_userbyid(proowner) owner,prosecdef FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure")).rows[0];
  await db.exec(built.candidate);
  const row=await asActor(db,adminIndex,async()=>(await db.query('SELECT public.crm_read_scoped_v2(NULL,1,NULL,$1) value',[inquiry])).rows[0].value.inquiries[0]);
  for(const key of ['id','row','sheet_row','brand','site','site_name','contact','contact_name','phone','assignee','assignee_name','assigned_to','status','received_at','created_at','at','site_id','work','work_type','assigned_at','first_response_at','responded_at','detail','assignment_history'])assert.ok(Object.hasOwn(row,key),key+' missing');
  for(const key of ['source','src','inquiry_type'])assert.ok(!Object.hasOwn(row,key),key+' should not be projected without a UI consumer');
  assert.equal(row.id,inquiry);
  assert.equal(row.assigned_to,stage.uid(1,5));
  assert.equal(row.assignee,'TEST ADMIN');
  assert.ok(Array.isArray(row.assignment_history));
  assert.ok(row.assignment_history.every(item=>item.inquiry_id===inquiry));
  assert.ok(!Object.hasOwn(row,'responses'));
  assert.ok(!Object.hasOwn(row,'responder'));
  const dealRow=await asActor(db,adminIndex,async()=>(await db.query('SELECT public.crm_read_scoped_v2(NULL,1,$1,NULL) value',[deal])).rows[0].value.deals[0]);
  for(const key of ['primary_work','work_items','work_scope_type','work_summary','version'])assert.ok(Object.hasOwn(dealRow,key),key+' Deal regression');
  await assert.rejects(asActor(db,repIndex,()=>db.query('SELECT public.crm_read_scoped_v2(NULL,1,NULL,$1)',[inquiry])),error=>error.code==='42501');
  const afterAcl=(await db.query("SELECT proacl::text acl,pg_get_userbyid(proowner) owner,prosecdef FROM pg_proc WHERE oid='public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure")).rows[0];
  assert.deepEqual(afterAcl,beforeAcl);
  await db.exec(built.rollback);
  const restored=(await db.query("SELECT pg_get_functiondef('public.crm_read_scoped_v2(uuid,integer,uuid,uuid)'::regprocedure) d")).rows[0].d;
  assert.equal(restored,before);
 }finally{await db.close()}
});

test('generated review and manifest keep response storage blocked and deployment unapplied',async()=>{
 await read.build();
 const review=fs.readFileSync(path.join(read.dir,'review.md'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(read.dir,'manifest.json'),'utf8'));
 assert.match(review,/응대 본문 BLOCKED/);
 assert.match(review,/can_inquiry/);
 assert.equal(manifest.project_ref,'rprechiaglyjaydkmxsu');
 assert.equal(manifest.status,'LOCAL_CANDIDATE_NOT_APPLIED');
 assert.deepEqual(manifest.blocked,['response_body_storage','response_actor_authority']);
});
