'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const compiler=require('../sql/operational-full-local-candidate/20260906/disposable-fixture.cjs');

const root=path.resolve(__dirname,'..');
const dir=path.join(root,'sql','operational-full-local-candidate','20260906');
const runId='stg-e2e-20260906t120000z-a1b2c3d4';

test('compiler refuses to run without a captured catalog',()=>{
 const out=path.join(os.tmpdir(),'crm-fixture-missing-'+Date.now());
 const run=spawnSync(process.execPath,[path.join(dir,'build-staging-disposable-fixture.cjs'),'missing-catalog.json',runId,out],{cwd:root,encoding:'utf8'});
 assert.notEqual(run.status,0);
 assert.match(run.stderr,/captured catalog is required/);
});

test('allocation is deterministic, unique, and never reuses canonical UUIDs',()=>{
 const plan=require('../docs/operational-cutover-20260906/staging-mutation-e2e-plan.json');
 const fixture=require('../sql/baseline/20260905/synthetic/fixture.json');
 const a=compiler.allocate(runId,plan),b=compiler.allocate(runId,plan);
 assert.deepEqual(a,b);
 const ids=[...a.entities,...a.requests].map(x=>x.id),canonical=new Set(JSON.stringify(fixture).match(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi)||[]);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ids){assert.match(id,/^[0-9a-f-]{36}$/);assert.equal(canonical.has(id),false);}
 assert.ok(a.entities.filter(x=>x.scenario_id==='mobile-inquiry-response-outcomes'&&x.kind==='inquiry').length===3);
 assert.ok(a.entities.some(x=>x.scenario_id==='pipeline-close-won-expansion'&&x.stage_code==='completion'));
 assert.ok(a.entities.some(x=>x.scenario_id==='pipeline-waiting-context'&&x.stage_code==='waiting'));
 assert.equal(a.entities.some(x=>x.scenario_id==='technical-inquiry-transfer'&&x.kind==='deal'),false);
});

test('generated SQL is exact-target, transactional, fixture-owned, and Storage-SQL-free',()=>{
 const source=fs.readFileSync(path.join(dir,'disposable-fixture.cjs'),'utf8');
 const runbook=fs.readFileSync(path.join(dir,'staging-disposable-fixture-runbook.md'),'utf8');
 assert.match(source,/rprechiaglyjaydkmxsu/);
 assert.match(source,/fixture ownership mismatch/);
 assert.match(source,/catalog drift/);
 assert.match(source,/DELETE FROM/);
 assert.doesNotMatch(source,/DELETE FROM storage\.objects/i);
 assert.match(runbook,/Storage API/);
 assert.match(runbook,/does not authorize Staging apply/);
 assert.doesNotMatch(source,/https?:\/\/[^'"\s]*n8n/i);
});

test('compiler rejects a production capture before writing output',()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'crm-fixture-prod-'));
 const capture=path.join(output,'capture.json'),destination=path.join(output,'generated');
 fs.writeFileSync(capture,JSON.stringify({project_ref:'ymfbmpnizxvqsamnczow'}));
 const run=spawnSync(process.execPath,[path.join(dir,'build-staging-disposable-fixture.cjs'),capture,runId,destination],{cwd:root,encoding:'utf8'});
 assert.notEqual(run.status,0);
 assert.equal(fs.existsSync(destination),false);
});
