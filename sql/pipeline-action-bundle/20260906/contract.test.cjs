'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const adapter=require('./adapter-contract.js');
const fixtures=require('./fixtures.json').reachable;
const root=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Golden UI evidence contains the reachable operation families',()=>{
 const pc=read('crm.html'),mobile=read('mobile.html');
 for(const op of ['amount','next_action','next_action_complete','activity','contact'])
  assert.match(pc+mobile,new RegExp(`pushWrite\\(['\"]${op}['\"]`),`missing reachable ${op}`);
 assert.match(pc,/quote_amount\s*:/); assert.match(pc,/won_amount\s*:/);
 assert.match(mobile,/action_id\s*:/); assert.match(pc,/meaningful_contact\s*:/);
});

test('only strict base next_action and activity payloads normalize locally',()=>{
 for(const key of ['next_action_pc','next_action_mobile','activity_pc','activity_mobile']){
  const x=fixtures[key],out=adapter.classify(x.op,x.payload);
  assert.equal(out.operation,x.op); assert.equal(out.object_id,x.payload.opportunity_id);
  assert.equal(out.verdict,'DERIVED_SAFE_LOCAL_HELPER');
  assert.equal(out.requires_parent_correlation,true);
 }
 assert.deepEqual(adapter.connected_operations,[],'helpers must not be public-dispatch connected');
});

test('ambiguous meanings and extended next-action shapes fail closed',()=>{
 for(const key of ['amount_pc','next_action_complete_mobile','next_action_complete_pc','contact_pc'])
  assert.throws(()=>adapter.classify(fixtures[key].op,fixtures[key].payload),e=>e.code==='OP_NEEDS_VERIFICATION');
 for(const key of ['next_action_scheduled_message','next_action_mobile_postpone'])
  assert.throws(()=>adapter.classify(fixtures[key].op,fixtures[key].payload),e=>e.code==='UNMAPPED_PAYLOAD_FIELD');
 assert.throws(()=>adapter.classify('unknown_operation',{}),e=>e.code==='OP_NOT_IN_BUNDLE');
});

test('candidate is private-only and documents the composition gate',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');
 const review=fs.readFileSync(path.join(__dirname,'review.md'),'utf8');
 assert.doesNotMatch(sql,/CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+public\.crm_write_command_v2/i);
 assert.match(sql,/REVOKE EXECUTE[\s\S]*authenticated[\s\S]*service_role/i);
 assert.match(review,/parent_write_id|parent request|parent command/i);
 assert.match(review,/NEEDS_VERIFICATION/);
});
