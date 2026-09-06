'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const contract=require('./contract.js'),fixtures=require('./fixtures.json');
const root=path.resolve(__dirname,'../../..');
const pc=fs.readFileSync(path.join(root,'crm.html'),'utf8');
const mobile=fs.readFileSync(path.join(root,'mobile.html'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'candidate.sql'),'utf8');
const review=fs.readFileSync(path.join(__dirname,'review.md'),'utf8');

test('Golden reachable operational reads remain the calculation oracle',()=>{
 for(const token of ['dashboardDealScope','towerBase','wonInPeriod','performanceStats','gnData','paintGyeongnam','paintReportV2'])assert.ok(pc.includes(token),token);
 for(const token of ['buildToday','rToday','rMine','rCtrl','crmAskM','rSearch','rPerf','rRpt'])assert.ok(mobile.includes(token),token);
 assert.match(mobile,/slice\(0\s*,\s*60\)/);
 assert.match(mobile,/slice\(0\s*,\s*20\)/);
});

test('only actor-scoped source rows are classified safe',()=>{
 assert.equal(contract.verdicts.pc_dashboard_source,'DERIVED_SAFE_PRIVATE_FRAGMENT');
 assert.equal(contract.verdicts.mobile_mine,'DERIVED_SAFE_PRIVATE_FRAGMENT');
 for(const key of ['pc_dashboard_kpi','pc_performance','pc_report','pc_gyeongnam','mobile_today','mobile_control','mobile_search','c03_full_read'])assert.equal(contract.verdicts[key],'NEEDS_VERIFICATION',key);
 assert.deepEqual(contract.connected_operations,[]);assert.deepEqual(contract.connected_reads,[]);
 assert.deepEqual(fixtures.connected_operations,[]);assert.deepEqual(fixtures.connected_reads,[]);
});

test('normalizer is fail closed for blocked domains, cursors and limits',()=>{
 for(const f of fixtures.requests){
  if(f.expected){const v=contract.normalize(f.domain,f.after,f.limit);assert.equal(v.private_function,'crm_security.crm_operational_read_fragment_v1');assert.equal(v.scope_completeness,'actor_authorized_rows_only');}
  else assert.throws(()=>contract.normalize(f.domain,f.after,f.limit),e=>e.code===f.expected_error);
 }
});

test('candidate is private, minimally projected and preserves public contracts',()=>{
 assert.doesNotMatch(sql,/CREATE(?: OR REPLACE)? FUNCTION public\./i);
 assert.doesNotMatch(sql,/CREATE(?: OR REPLACE)? FUNCTION public\.crm_read_scoped_v2/i);
 assert.match(sql,/crm_security\.can_deal\(d\.id,false\)/);
 assert.match(sql,/crm_security\.can_inquiry\(i\.id\)/);
 assert.match(sql,/REVOKE EXECUTE[\s\S]*PUBLIC,anon,authenticated,service_role/);
 assert.doesNotMatch(sql,/ac\.detail->>/);
 for(const forbidden of fixtures.blocked_fields)assert.equal(sql.includes(forbidden),false,forbidden);
 assert.match(review,/scope_completeness='actor_authorized_rows_only'/);
 assert.match(review,/회사 전체 집계로 표시하면 안 된다/);
});
