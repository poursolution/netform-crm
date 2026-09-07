'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=__dirname,root=path.resolve(dir,'../../..');
const contract=require('./adapter-contract.js');

const expected=['X01','X02','X03','A05','O01','O02','O03','O04','O05','O06'];
assert.deepEqual(Object.keys(contract.verdicts),expected);
for(const id of expected.filter(x=>x!=='O03')) assert.equal(contract.classify(id).verdict,'NEEDS_VERIFICATION');
assert.deepEqual(contract.classify('O03'),{verdict:'CONFIRMED',mode:'LOCAL_ONLY'});
assert.deepEqual(contract.connected_operations,[]);
assert.deepEqual(contract.database_candidates,[]);

assert.deepEqual(contract.normalizeAnnualGoalInput('60',2026),{cancelled:false,storage_key:'nf_year_goal_2026',amount:6000000000});
assert.deepEqual(contract.normalizeAnnualGoalInput('1.234',2026),{cancelled:false,storage_key:'nf_year_goal_2026',amount:123400000});
assert.deepEqual(contract.normalizeAnnualGoalInput('invalid',2026),{cancelled:false,storage_key:'nf_year_goal_2026',amount:0});
assert.deepEqual(contract.normalizeAnnualGoalInput(null,2026),{cancelled:true,storage_key:'nf_year_goal_2026'});
assert.throws(()=>contract.normalizeAnnualGoalInput('1',0),/Invalid goal year/);

const dashboardPreflight=JSON.parse(fs.readFileSync(path.join(root,'docs/operational-cutover-20260906/staging-dashboard-state-preflight-20260906.json'),'utf8'));
assert.equal(dashboardPreflight.project_ref,'rprechiaglyjaydkmxsu');
assert.equal(dashboardPreflight.mode,'READ_ONLY');
assert.equal(dashboardPreflight.relation.name,'dashboard_state');
assert.equal(dashboardPreflight.relation.row_count,0);
assert.equal(dashboardPreflight.relation.rls_enabled,true);
assert.deepEqual(dashboardPreflight.relation.policies,[{name:'allow all',command:'ALL',roles:['public'],qual:'true',with_check:'true'}]);
assert.equal(dashboardPreflight.conclusion.reuse_for_annual_goal,false);
assert.equal(dashboardPreflight.writes_performed,0);
assert.equal(dashboardPreflight.production_requests,0);
assert.equal(dashboardPreflight.n8n_requests,0);

const crm=fs.readFileSync(path.join(root,'crm.html'),'utf8');
const mobile=fs.readFileSync(path.join(root,'mobile.html'),'utf8');
const expansion=fs.readFileSync(path.join(root,'expansion-pool.js'),'utf8');
const cleanup=fs.readFileSync(path.join(root,'data-cleanup-ui.js'),'utf8');
const exporter=fs.readFileSync(path.join(root,'crm-export.js'),'utf8');
for(const evidence of [
  "pushWrite('expansion_pool_update'", "SB.rpc('crm_expansion_note'", "op:'expansion_quote_convert'",
  "rpc('crm_cleanup_preview'", "rpc('crm_cleanup_apply'", "pushWrite('rep_manager_comment'",
  "pushWrite('customer_support_action'", "Phase1.storage.setItem(goalKey()", "crm_export_create",
  "function nudgeSelected()"
]) assert.ok([crm,expansion,cleanup,exporter].some(x=>x.includes(evidence)),`missing reachable evidence: ${evidence}`);
for(const evidence of ['G.set.quiet=!G.set.quiet','PDF 미리보기 생성 (목업)','병합 요청 기록 — 관리자 확인 후 처리 (목업)']) assert.ok(mobile.includes(evidence));

const snap=JSON.parse(fs.readFileSync(path.join(root,'sql/inquiry-direct-assign/20260906/after.json'),'utf8'));
const signatures=[...(snap.public.functions||[]),...(snap.private.functions||[])].map(x=>x.signature||'').join('\n');
const relations=[...(snap.public.relations||[]),...(snap.private.relations||[])].map(x=>x.name||x.relname||'').join('\n');
for(const absent of ['crm_expansion_','crm_cleanup_','crm_export_create','rep_manager_comment','customer_support_action']){
  assert.ok(!signatures.includes(absent));
  assert.ok(!relations.includes(absent));
}

for(const name of ['candidate.sql','rollback.sql']){
  const sql=fs.readFileSync(path.join(dir,name),'utf8');
  assert.ok(!/\b(create|alter|drop|insert|update|delete|grant|revoke|truncate)\b\s+(table|function|schema|on|into|from)/i.test(sql),`${name} must be a no-op`);
  assert.ok(!/crm_write_command_v2\s*\(/i.test(sql),`${name} must not replace the dispatcher`);
}
console.log('operational-auxiliary contract: 20 PASS');
