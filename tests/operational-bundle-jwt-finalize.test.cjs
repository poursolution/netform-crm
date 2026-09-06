'use strict';

// Offline finalizer. It never connects to Supabase; it joins the JWT run artifact
// with a separately captured, read-only Supabase connector evidence artifact.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const REF='rprechiaglyjaydkmxsu';
const PRODUCTION_REF='ymfbmpnizxvqsamnczow';
const JWT_FILE=path.resolve(__dirname,'../docs/operational-cutover-20260906/operational-bundle-jwt-results.json');
const FINAL_FILE=path.resolve(__dirname,'../docs/operational-cutover-20260906/operational-bundle-final.json');
const evidencePath=process.env.STAGING_OPERATIONAL_PRIVATE_EVIDENCE_FILE;
const enabled=process.env.CRM_FINALIZE_OPERATIONAL_BUNDLE==='1'&&Boolean(evidencePath);

function sortedKeys(value){return Object.keys(value||{}).sort();}
function exactOnes(value,label){
 assert.ok(value&&!Array.isArray(value)&&typeof value==='object',`${label} missing`);
 assert.ok(Object.keys(value).length>0,`${label} is empty`);
 for(const [key,count] of Object.entries(value)){assert.match(key,/\S/,`${label} empty key`);assert.equal(count,1,`${label}.${key} must equal 1`);}
}
function noSecrets(value){
 const walk=node=>{if(!node||typeof node!=='object')return;for(const [key,child] of Object.entries(node)){
  assert.doesNotMatch(key,/password|access[_-]?token|refresh[_-]?token|service[_-]?role|secret[_-]?key|database[_-]?url/i,
   `evidence contains prohibited secret field ${key}`);walk(child);
 }};walk(value);
}

if(!enabled)test('finalize operational bundle private evidence',{
 skip:'SKIP (not PASS): set CRM_FINALIZE_OPERATIONAL_BUNDLE=1 and STAGING_OPERATIONAL_PRIVATE_EVIDENCE_FILE'
},()=>{});
else test('finalize operational bundle private evidence',()=>{
 const jwt=JSON.parse(fs.readFileSync(JWT_FILE,'utf8'));
 const evidence=JSON.parse(fs.readFileSync(path.resolve(evidencePath),'utf8'));
 noSecrets(jwt);noSecrets(evidence);
 const serialized=JSON.stringify({jwt,evidence});
 assert.equal(serialized.includes(PRODUCTION_REF),false,'Production evidence prohibited');
 assert.doesNotMatch(serialized,/https?:\/\/[^"\s]*n8n/i,'n8n evidence prohibited');
 assert.equal(jwt.project_ref,REF);assert.equal(evidence.project_ref,REF);
 assert.equal(jwt.status,'JWT_PASS_PRIVATE_EVIDENCE_PENDING','JWT run is not ready for private finalization');
 assert.equal(jwt.fail,0);assert.equal(jwt.skip,0);assert.equal(jwt.restore?.status,'PASS');
 assert.equal(jwt.n8n_requests,0);assert.equal(jwt.production_requests,0);
 assert.equal(evidence.run_id,jwt.run_id,'private evidence belongs to another JWT run');
 assert.equal(evidence.source,'supabase_connector_read_only');
 assert.equal(evidence.read_only,true,'connector evidence must attest read-only capture');
 assert.match(evidence.captured_at||'',/^\d{4}-\d{2}-\d{2}T/);

 exactOnes(evidence.receipt_counts,'receipt_counts');
 exactOnes(evidence.deal_audit_counts,'deal_audit_counts');
 exactOnes(evidence.inquiry_audit_counts,'inquiry_audit_counts');
 exactOnes(evidence.assignment_history_counts,'assignment_history_counts');
 exactOnes(evidence.business_history_counts,'business_history_counts');
 assert.deepEqual(sortedKeys(evidence.receipt_counts),[...new Set(jwt.request_ids)].sort(),'request IDs differ');
 assert.deepEqual(sortedKeys(evidence.deal_audit_counts),[...new Set(jwt.deal_audit_event_ids)].sort(),'deal audit IDs differ');
 assert.deepEqual(sortedKeys(evidence.inquiry_audit_counts),[...new Set(jwt.inquiry_audit_event_ids)].sort(),'Inquiry audit IDs differ');
 assert.deepEqual(sortedKeys(evidence.assignment_history_counts),[...new Set(jwt.public_history_tokens.assignment)].sort(),
  'assignment history tokens differ');
 assert.deepEqual(sortedKeys(evidence.business_history_counts),[...new Set(jwt.public_history_tokens.business)].sort(),
  'business history tokens differ');
 assert.equal(evidence.private_schema_usage_authenticated,false,'private schema ACL was weakened');
 assert.equal(evidence.private_schema_usage_anon,false,'private schema ACL was weakened');

 const final={project_ref:REF,run_id:jwt.run_id,status:'FINAL_PRIVATE_EVIDENCE_PASS',completed_at:new Date().toISOString(),
  jwt_result:path.relative(path.dirname(FINAL_FILE),JWT_FILE).replaceAll('\\','/'),
  private_evidence:path.relative(path.dirname(FINAL_FILE),path.resolve(evidencePath)).replaceAll('\\','/'),
  receipt_count:Object.keys(evidence.receipt_counts).length,
  deal_audit_count:Object.keys(evidence.deal_audit_counts).length,
  inquiry_audit_count:Object.keys(evidence.inquiry_audit_counts).length,
  restore_status:jwt.restore.status,n8n_requests:0,production_requests:0};
 fs.writeFileSync(FINAL_FILE,JSON.stringify(final,null,2));
});
