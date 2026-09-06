'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const build=require('./build.cjs'),contract=require('./adapter-contract.js');
const root=path.resolve(__dirname,'../../..'),deal='f6090500-0006-4000-8000-000000000001';
function loadAdapter(source){const ctx={globalThis:{},module:{exports:{}},exports:{}};vm.runInNewContext(source,ctx);return ctx.module.exports;}
function loadModule(source){const ctx={globalThis:{},module:{exports:{}},exports:{},console};vm.runInNewContext(source,ctx);return ctx.module.exports;}

test('PC/mobile reachable payloads normalize to server-owned personal state',()=>{
 const pc=fs.readFileSync(path.join(root,'crm.html'),'utf8'),mobile=fs.readFileSync(path.join(root,'mobile.html'),'utf8');
 for(const source of [pc,mobile]){assert.match(source,/pushWrite\('favorite_set'/);assert.match(source,/pushWrite\('opportunity_touch'/);assert.match(source,/user_key:/);assert.match(source,/touched_at:/);}
 assert.deepEqual(contract.normalize('favorite_set',deal,0,{opportunity_id:deal,user_key:'FORGED',favorite:true}).payload,{favorite:true});
 assert.deepEqual(contract.normalize('opportunity_touch',deal,0,{opportunity_id:deal,user_key:'FORGED',touch_kind:'view',touched_at:'1900-01-01T00:00:00Z'}).payload,{touch_kind:'view'});
 assert.throws(()=>contract.normalize('opportunity_touch',deal,0,{touch_kind:'delete'}),/INVALID_TOUCH_PAYLOAD/);
});

test('candidate adapter extends exactly six operations and validates personal ACKs',()=>{
 const {adapter}=build.patchUi(),api=loadAdapter(adapter);
 assert.deepEqual([...api.operations],['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change','favorite_set','opportunity_touch']);
 const command={request_id:'00000000-0000-4000-8000-000000000001',operation:'favorite_set',object_id:deal,expected_version:0,payload:{favorite:true},auth_uid:'00000000-0000-4000-8000-000000000002',user_id:'00000000-0000-4000-8000-000000000003'};
 const ack={contract_version:1,ok:true,request_id:command.request_id,operation:command.operation,object_id:deal,actor_auth_uid:command.auth_uid,actor_user_id:command.user_id,favorite:true,touch_kind:null,last_viewed_at:null,last_worked_at:null,view_count:0,server_at:'2026-09-06T00:00:00Z',replayed:false};
 assert.equal(api.validateAck(ack,command),ack);assert.throws(()=>api.validateAck({...ack,favorite:false},command),/ACK_CONTRACT_MISMATCH/);
 assert.equal(JSON.stringify(api.normalize('opportunity_touch',deal,0,{opportunity_id:deal,user_key:'FORGED',touch_kind:'work',touched_at:'FORGED'}).payload),JSON.stringify({touch_kind:'work'}));
});

test('candidate overlay uses sentinel zero, maps mobile read-back, and patchUi is read-only',()=>{
 const {overlay}=build.patchUi();
 assert.match(overlay,/personal=new Set\(\['favorite_set','opportunity_touch'\]\)/);
 assert.match(overlay,/op\.startsWith\('inquiry_'\)\|\|personal\.has\(op\)\?0/);
 assert.match(overlay,/favorite:!!d\.favorite,last_viewed_at:d\.last_viewed_at\|\|null,last_worked_at/);
 assert.match(overlay,/if\(personal\.has\(q\.operation\)\)applyPersonalAck\(q\)/);
 assert.doesNotMatch(build.patchUi.toString(),/writeFileSync|staging-operational/);
});

test('candidate overlay queues sentinel zero and applies server ACK to PC/mobile state',async()=>{
 const {adapter:adapterSource,overlay:overlaySource}=build.patchUi(),adapter=loadAdapter(adapterSource),overlay=loadModule(overlaySource),rows=[];
 const pcDeal={id:deal,favorite:false},mobileDeal={id:deal,favorite:false},listeners={};
 const rootWindow={OperationalAdapter:adapter,B:{deals:[pcDeal]},DEALS:[mobileDeal],WRITE_Q:[],console,addEventListener:(n,f)=>{listeners[n]=f},updateSyncBadge(){},updatePendingBadge(){},Phase1:{profile:{},queue:{enqueue(op,id,version,payload){const n=adapter.normalize(op,id,version,payload),q={request_id:'00000000-0000-4000-8000-000000000010',operation:n.operation,object_id:n.object_id,expected_version:n.expected_version,payload:n.payload,auth_uid:'00000000-0000-4000-8000-000000000002',user_id:'00000000-0000-4000-8000-000000000003',status:'pending'};rows.push(q);return q;},list:()=>rows,async flush(){for(const q of rows)if(q.status==='pending'){q.status='done';q.ack={contract_version:1,ok:true,request_id:q.request_id,operation:q.operation,object_id:q.object_id,actor_auth_uid:q.auth_uid,actor_user_id:q.user_id,favorite:true,touch_kind:null,last_viewed_at:null,last_worked_at:null,view_count:0,server_at:'2026-09-06T00:00:00Z',replayed:false};}return rows;}}}};
 overlay.install(rootWindow);rootWindow.pushWrite('favorite_set',{opportunity_id:deal,user_key:'FORGED',favorite:true});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(rows.length,1);assert.equal(rows[0].expected_version,0);assert.equal(JSON.stringify(rows[0].payload),JSON.stringify({favorite:true}));assert.equal(pcDeal.favorite,true);assert.equal(mobileDeal.favorite,true);
});

test('UI diff targets generator sources only',()=>{
 const diff=fs.readFileSync(path.join(__dirname,'ui-minimal.diff'),'utf8');
 assert.match(diff,/sql\/operational-ui\/20260906\/operational-adapter\.js/);
 assert.match(diff,/sql\/operational-ui\/20260906\/operational-overlay\.js/);
 assert.match(diff,/sql\/operational-ui\/20260906\/build\.cjs/);
 assert.match(diff,/sql\/operational-ui\/20260906\/ui\.test\.cjs/);
 assert.match(diff,/sql\/operational-ui\/20260906\/review\.md/);
 assert.doesNotMatch(diff,/staging-operational\/crm\.html|staging-operational\/mobile\.html/);
});

test('recorded read-only Staging canonical comparison enables exact live target guards without applying',()=>{
 const evidence=JSON.parse(fs.readFileSync(path.join(__dirname,'staging-preflight.json'),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'),'utf8'));
 assert.equal(evidence.mode,'READ_ONLY');
 assert.equal(evidence.matches_expected,true);
 assert.equal(evidence.decision,'CANONICAL_TOKEN_MATCH_TARGET_GUARDS_READY_NOT_APPLIED');
 assert.equal(evidence.semantic_token_compare.write.match,true);
 assert.equal(evidence.semantic_token_compare.read.match,true);
 assert.equal(manifest.status,'LOCAL_APPLY_READY_LIVE_CANONICAL_PREFLIGHT_PASS_NOT_APPLIED');
 assert.equal(manifest.live_preflight.status,'CANONICAL_PASS');
 assert.equal(manifest.live_preflight.exact_raw_apply_guard,true);
 assert.equal(manifest.live_preflight.cross_engine_full_snapshot_guard,false);
 assert.equal(manifest.staging_ddl_dml_performed,false);
});
