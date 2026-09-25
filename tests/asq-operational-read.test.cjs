'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overlay=require('../operational-overlay.js');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('operational shell preserves ASQ rows for PC and mobile consumers',()=>{
  const row={id:'00000000-0000-4000-8000-000000000001',opportunity_id:'00000000-0000-4000-8000-000000000002',asq_project_id:'ASQ-1'};
  const bundle=overlay.shell({deals:[],inquiries:[],asq_projects:[row]});
  assert.deepEqual(bundle.asq_projects,[row]);
  assert.strictEqual(bundle.asqProjects,bundle.asq_projects);
});

test('both transports allow and map the ASQ operational domain',()=>{
  for(const file of ['transport.js','pc-manager-transport.js']){
    const source=read(file);
    assert.match(source,/knownDomains=\[[^\]]*'asq_project'/,file);
    assert.match(source,/asq_projects=rows\.asq_project\|\|\[\]/,file);
    assert.match(source,/asq_projects,asqProjects:asq_projects/,file);
  }
});

test('ASQ domain refresh reaches the pages that can open customer or deal details',()=>{
  const source=read('operational-overlay.js');
  for(const page of ['today','dash','pipe','sites','relationship','expansion'])
    assert.match(source,new RegExp(page+":\\['asq_project'|"+page+":\\['expansion_pool','asq_project'"),page);
  assert.match(source,/domain==='asq_project'/);
  assert.match(source,/next\.asq_projects=next\.asqProjects=mapped\.asq_projects/);
  /* 휴대폰 첫 로딩도 연결 프로젝트를 받는다 — 2026-09-26부터 영업·문의와 따로 받아 실패해도 핵심 데이터를 막지 않는다 */
  assert.match(source,/coreDomains\.concat\('asq_project'\)|scoped\(\['asq_project'\]/);
});

test('production migration exposes only actor-authorized ASQ rows and keeps sync service-only',()=>{
  const sql=read('supabase/migrations/20260919090000_asq_operational_read.sql');
  const cursorFix=read('supabase/migrations/20260919093000_fix_asq_operational_cursor.sql');
  assert.match(sql,/p_domain<>'asq_project'/);
  assert.match(sql,/crm_security\.can_deal\(l\.opportunity_id,false\)/);
  assert.match(cursorFix,/create or replace function public\.crm_operational_source_v1/);
  assert.doesNotMatch(cursorFix,/max\(x\.id\)/i);
  assert.match(cursorFix,/items->-1->>'id'/);
  assert.match(sql,/revoke all on table public\.crm_asq_project_links from public, anon, authenticated/);
  assert.match(sql,/revoke all on function public\.crm_asq_project_sync\(jsonb\) from public, anon, authenticated/);
  assert.match(sql,/grant execute on function public\.crm_asq_project_sync\(jsonb\) to service_role/);
  assert.doesNotMatch(sql,/select l\.\*/);
  assert.doesNotMatch(sql,/raw_payload[^\n]+from public\.crm_asq_project_links/);
});
