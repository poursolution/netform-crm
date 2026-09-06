'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const adapter=require('./adapter-contract.js'),fixtures=require('./fixtures.json');
const root=path.resolve(__dirname,'../../..');
const transport=fs.readFileSync(path.join(root,'staging-operational/transport.js'),'utf8');
const overlay=fs.readFileSync(path.join(root,'staging-operational/operational-overlay.js'),'utf8');
const candidate=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');

test('existing PC and mobile calls collapse to the same four RPC args',()=>{
 assert.match(overlay,/Phase1\.read\('operational',\{limit:100\}\)/);
 assert.match(transport,/rpc\('crm_read_scoped_v2',\{p_after:args\.after\|\|null,p_limit:limit,p_deal_id:args\.deal_id\|\|null,p_inquiry_id:args\.inquiry_id\|\|null\}\)/);
 assert.deepEqual(fixtures.existing_ui_calls[0].current_rpc_args,fixtures.existing_ui_calls[1].current_rpc_args);
});

test('minimal UI discriminator normalizes but cannot be sent through current RPC',()=>{
 const dashboard=adapter.normalize('pc_dashboard','operational',{limit:100});
 const mine=adapter.normalize('mobile_mine','operational',{limit:100});
 assert.equal(dashboard.resource,'dashboard_source');assert.equal(mine.resource,'mine_source');
 for(const intent of [dashboard,mine])assert.throws(()=>adapter.toCurrentRpc(intent),e=>e.code==='PUBLIC_READ_SELECTOR_UNAVAILABLE');
 assert.throws(()=>adapter.normalize('mobile_today','operational'),e=>e.code==='READ_SCREEN_NOT_DERIVED_SAFE');
 assert.deepEqual(adapter.connected_reads,[]);
});

test('future envelope requires explicit scope, completeness and pagination markers',()=>{
 const intent=adapter.normalize('mobile_mine','operational');
 const valid={resource:'mine_source',scope_completeness:'actor_authorized_rows_only',pagination:{completeness:'partial',has_more:true,next_cursor:'f6090500-0006-4000-8000-000000000001'}};
 assert.equal(adapter.validateEnvelope(valid,intent),valid);
 for(const bad of [{...valid,resource:'dashboard_source'},{...valid,scope_completeness:'company_all'},{...valid,pagination:{completeness:'complete',has_more:true,next_cursor:null}}])assert.throws(()=>adapter.validateEnvelope(bad,intent));
});

test('candidate and rollback are read-only and cannot alter or expose public API',()=>{
 for(const sql of [candidate,fs.readFileSync(path.join(__dirname,'rollback.sql'),'utf8')]){
  assert.match(sql,/BEGIN READ ONLY/);assert.doesNotMatch(sql,/CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE/i);
 }
 assert.match(candidate,/md5\(pg_get_functiondef\(p\.oid\)\)<>'919c4abff86e37beeb62ccb15beba33e'/);
 assert.match(candidate,/'connected_reads',jsonb_build_array\(\)/);
});
