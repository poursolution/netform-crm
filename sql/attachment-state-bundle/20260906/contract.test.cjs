'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const contract=require('./adapter-contract.js');
const root=path.resolve(__dirname,'../../..');
const deal='f6090500-0006-4000-8000-000000000001';

test('reachable PC/mobile source preserves T01-T03 controls',()=>{
 const pc=fs.readFileSync(path.join(root,'crm.html'),'utf8'),mobile=fs.readFileSync(path.join(root,'mobile.html'),'utf8');
 for(const source of [pc,mobile]){
  assert.match(source,/attachment_prepare/);assert.match(source,/attachment_complete/);
  assert.match(source,/method:'PUT'/);assert.match(source,/favorite_set/);assert.match(source,/opportunity_touch/);
 }
 assert.match(pc,/onclick="toggleExecFavorite\(\)"/);assert.match(mobile,/onclick="toggleFavoriteM\(\)"/);
});

test('T01/T02 fail closed while T03 strips client authority fields',()=>{
 assert.throws(()=>contract.normalize('attachment_prepare',deal,{}),/BLOCKED_STORAGE_CONTRACT/);
 assert.throws(()=>contract.normalize('attachment_complete',deal,{}),/BLOCKED_STORAGE_CONTRACT/);
 assert.throws(()=>contract.normalize('attachment_list',deal,{}),/BLOCKED_METADATA_RELATION/);
 assert.deepEqual(contract.normalize('favorite_set',deal,{opportunity_id:deal,user_key:'FORGED',favorite:true}).payload,{favorite:true});
 assert.deepEqual(contract.normalize('opportunity_touch',deal,{opportunity_id:deal,user_key:'FORGED',touch_kind:'view',touched_at:'1900-01-01T00:00:00Z'}).payload,{touch_kind:'view'});
 assert.throws(()=>contract.normalize('opportunity_touch',deal,{touch_kind:'delete'}),/INVALID_TOUCH_PAYLOAD/);
});

test('candidate contains no Storage or public endpoint DDL',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+)?storage\./i);
 assert.doesNotMatch(sql,/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.crm_attachments/i);
 assert.doesNotMatch(sql,/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\./i);
 assert.doesNotMatch(sql,/ALTER\s+FUNCTION\s+public\.crm_write_command_v2/i);
});

