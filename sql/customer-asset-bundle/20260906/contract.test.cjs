'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const a=require('./adapter-contract.js'),fx=require('./fixtures.json');
const root=path.resolve(__dirname,'../../..'),pc=fs.readFileSync(path.join(root,'crm.html'),'utf8'),mobile=fs.readFileSync(path.join(root,'mobile.html'),'utf8');

test('A01-A03 are currently reachable in Golden PC/mobile',()=>{
 for(const op of ['contact_upsert','contact_relationship','contact_move']){
  assert.match(pc,new RegExp(`pushWrite\\('${op}'`));
  assert.match(mobile,new RegExp(`pushWrite\\('${op}'`));
  assert.throws(()=>a.classifyWrite(op,fx[op]),e=>e.code==='OP_NEEDS_VERIFICATION');
 }
 assert.match(pc,/sms_consent/); assert.match(mobile,/send_blocked_reason/);
 assert.equal('to_site_id' in fx.contact_move,false);
 assert.equal('to_opportunity_id' in fx.contact_move,false);
});

test('only the existing scoped Deal contact read is normalized',()=>{
 const id=fx.contact_upsert.opportunity_id,out=a.normalizeRead(id);
 assert.deepEqual(out.params,{p_opportunity_id:id}); assert.equal(out.rpc,'crm_contacts_scoped_v2');
 assert.equal(out.verdict,'DERIVED_SAFE_LOCAL_READ'); assert.deepEqual(a.connected_operations,[]);
 assert.throws(()=>a.normalizeRead('not-a-uuid'),e=>e.code==='INVALID_OBJECT_ID');
});

test('read payload projects directly into current PC/mobile contacts and timeline shapes',()=>{
 const rows=[{id:'f6090500-0004-4000-8000-000000000001',person_key:'mobile:01012345678',name:'홍길동',role:'관리소장',phone:'0212345678',mobile:'01012345678',current_site:'A현장',site_name:'A현장',office_phone:'0212345678',started_at:'2026-01-01',ended_at:null,status:'current',assignment_history:[{site_name:'A현장',office_phone:'0212345678',started_at:'2026-01-01',ended_at:null,status:'current'}]}];
 const deal=a.projectDeal({id:fx.contact_upsert.opportunity_id,site:'A현장'},rows);
 assert.equal(deal.contacts[0].person_key,'mobile:01012345678');
 assert.equal(deal.contacts[0].office_phone,'0212345678');
 assert.deepEqual(a.timelineFor(deal.contacts,'mobile:01012345678'),[{site:'A현장',officeTel:'0212345678',from:'2026-01-01',to:'',status:'current'}]);
 assert.throws(()=>a.normalizeRows({}),e=>e.code==='INVALID_READ_PAYLOAD');
 assert.match(pc,/Array\.isArray\(item\.contacts\)/); assert.match(mobile,/Array\.isArray\(d\.contacts\)/);
 assert.match(pc,/x\.person_key/); assert.match(mobile,/x\.office_phone/);
});

test('candidate changes no public write endpoint and excludes unverified fields',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');
 assert.doesNotMatch(sql,/crm_write_command_v2/);
 assert.doesNotMatch(sql,/decision_role|relationship_tone|sms_consent|kakao_consent|custom_fields|emails/);
 assert.match(sql,/crm_security\.can_deal\(p_opportunity_id,false\)/);
 assert.match(sql,/crm_security\.can_deal\(h\.opportunity_id,false\)/);
 assert.match(sql,/REVOKE EXECUTE[\s\S]*PUBLIC,anon,authenticated,service_role/);
 assert.match(sql,/crm\.customer_asset_previous_oid/);
 assert.match(sql,/7e811c93e73ba945a0dfea164da55fcd/);
});

test('live preflight is read-only and canonical LF comparison resolves CRLF serialization without applying',()=>{
 const preflight=fs.readFileSync(path.join(__dirname,'preflight.sql'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
 const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'staging-preflight.json'),'utf8'));
 assert.match(preflight,/BEGIN TRANSACTION READ ONLY/);
 assert.match(preflight,/'oid',p\.oid/);
 assert.match(preflight,/'matches_expected'/);
 assert.doesNotMatch(preflight,/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE)\b/i);
 assert.match(preflight,/definition_md5_lf/);
 assert.equal(evidence.matches_expected,true);
 assert.equal(evidence.decision,'CANONICAL_MATCH_NOT_APPLIED');
 assert.equal(evidence.raw_definition_diff_explained,'CRLF_TO_LF_ONLY');
 assert.equal(manifest.status,'LOCAL_STAGING_READY_LIVE_PREFLIGHT_PASS_NOT_APPLIED');
 assert.equal(manifest.live_preflight.status,'PASS');
 assert.equal(manifest.live_preflight.oid,18065);
 assert.equal(manifest.live_preflight.actual_definition_md5,'415dc8fc1826aec86a0a916147480a71');
 assert.equal(manifest.live_preflight.actual_definition_md5_lf,'1a58be86503cb53bdc3a9a784eb4add2');
});
