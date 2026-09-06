'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('read-only Staging projection preflight is pinned to the allowed project',()=>{
 const p=JSON.parse(read('docs/operational-cutover-20260906/staging-read-projection-preflight-20260906.json'));
 assert.equal(p.project_id,'rprechiaglyjaydkmxsu');assert.equal(p.project_name,'netform-crm-staging');assert.equal(p.mode,'READ_ONLY');assert.equal(p.staging_ddl_dml_performed,false);assert.equal(p.production_requests,0);assert.equal(p.n8n_requests,0);
 assert.equal(p.scope_functions.company_all_implicit,false);assert.ok(p.current_public_read.deal_fields.includes('work_summary'));assert.ok(!p.current_public_read.deal_fields.includes('site_name'));assert.ok(p.missing_current_chain_relations.includes('crm_security.quote_versions'));
});
test('matrix separates actor-scoped screens from unresolved company and branch scopes',()=>{
 const m=read('docs/operational-cutover-20260906/read-projection-matrix.md');
 for(const id of ['O07S','O07D','O07P','O07R','O07G','O08M','O08T','O08C','O08S','O08A','C03'])assert.match(m,new RegExp(id));
 assert.match(m,/actor_authorized_rows_only/);assert.match(m,/company_all/);assert.match(m,/C03_FULL/);
});
test('basic and advanced mobile search use the Staging actor-scoped projection',()=>{
 const csv=read('docs/operational-cutover-20260906/coverage-matrix.csv'),manifest=JSON.parse(read('sql/operational-read-source/20260906/manifest.json'));
 assert.match(csv,/"O08S"[^\n]+"STAGING_JWT_E2E_PASS_20260906"/);assert.match(csv,/"O08A"[^\n]+"STAGING_JWT_E2E_PASS_20260906"/);
 assert.ok(manifest.connected_reads_candidate.includes('O08S'));assert.ok(manifest.still_blocked.includes('O08A'));
});
test('GO read audit is pinned to Staging and records no mutations or forbidden traffic',()=>{
 const p=JSON.parse(read('docs/operational-cutover-20260906/go-read-audit-20260907.json'));
 assert.equal(p.project_ref,'rprechiaglyjaydkmxsu');assert.equal(p.status,'PASS');assert.equal(p.business_dml,false);assert.equal(p.staging_ddl,false);assert.equal(p.production_requests,0);assert.equal(p.n8n_requests,0);
 for(const key of ['quote_amount','won_amount','activity_signals','contacts'])assert.ok(p.deal_core_verified_fields.includes(key));
 assert.ok(p.contact_history_verified_fields.includes('assignment_history'));
});
test('local source preserves Golden identity and contact fields without claiming global scope',()=>{
 const sql=read('sql/operational-read-source/20260906/candidate.sql'),ui=read('sql/operational-read-source/20260906/operational-overlay.candidate.js');
 for(const token of ['d.amount','d.created_at','d.manager_name','AS contacts'])assert.ok(sql.includes(token),token);
 assert.match(ui,/nm:d\.site\|\|d\.site_name/);assert.match(ui,/rep:d\.assignee\|\|d\.owner_name/);assert.doesNotMatch(ui,/company_all/);
});
