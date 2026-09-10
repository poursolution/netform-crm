'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/parity-20260905');
const inventory=JSON.parse(fs.readFileSync(path.join(dir,'source-inventory.json'),'utf8'));
const matrix=JSON.parse(fs.readFileSync(path.join(dir,'parity-matrix.json'),'utf8'));
const phase1=JSON.parse(fs.readFileSync(path.join(root,'staging-phase1/source-manifest.json'),'utf8'));
const production=JSON.parse(fs.readFileSync(path.join(root,'production-ui-manifest.json'),'utf8'));
const candidatePath=path.join(root,'local-release-candidate-manifest.json');
const candidate=fs.existsSync(candidatePath)?JSON.parse(fs.readFileSync(candidatePath,'utf8')):null;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,maxBuffer:30*1024*1024});
test('Golden SHA remains an ancestor and every local overlay matches production or the explicit local candidate',()=>{
assert.equal(inventory.golden.commit,matrix.golden_commit);
assert.doesNotThrow(()=>git('merge-base','--is-ancestor',matrix.golden_commit,'HEAD'));
for(const f of inventory.manifest){const name=f.file.startsWith('local/')&&f.file.slice(6),latest=name&&phase1.files.find(x=>x.file===name),deployed=name&&production.files_sha256[name];const data=f.file.startsWith('golden/')?git('show',matrix.golden_commit+':'+f.file.slice(7)):fs.readFileSync(path.join(root,name)),actual=sha(data),approved=deployed||latest?.source_sha256||f.sha256;if(actual!==approved){assert.ok(candidate,'local overlay drift requires an explicit release-candidate manifest');assert.equal(candidate.status,'LOCAL_RELEASE_CANDIDATE_NOT_DEPLOYED');assert.equal(candidate.production_applied,false);assert.equal(candidate.runtime_files_sha256[name],actual,`untracked local overlay drift: ${f.file}`);}}
});
test('local release-candidate hashes are complete, current and never represented as production',()=>{
if(!candidate)return;
assert.equal(candidate.base_commit,git('rev-parse','HEAD').toString().trim());
assert.equal(candidate.production_applied,false);assert.equal(candidate.production_database_applied,false);assert.equal(candidate.external_systems_changed,false);
for(const group of ['runtime_files_sha256','database_candidates_sha256'])for(const [file,digest] of Object.entries(candidate[group])){assert.ok(fs.existsSync(path.join(root,file)),file);assert.equal(sha(fs.readFileSync(path.join(root,file))),digest,file);}
assert.ok(candidate.database_candidates_sha256['supabase/migrations/20260911090000_harden_inquiry_ingest_idempotency.sql']);
});
test('all Golden HTML/SQL/README files inventoried; local overlays explicitly separated',()=>{
const files=git('ls-tree','-r','--name-only',matrix.golden_commit).toString().trim().split('\n').filter(f=>/\.(html|js|md|sql)$/.test(f));
assert.deepEqual(inventory.manifest.filter(f=>f.file.startsWith('golden/')).map(f=>f.file.slice(7)).sort(),files.sort());
assert.ok(!files.includes('crm-read.js'));assert.ok(inventory.manifest.some(f=>f.file==='local/crm-read.js'));
});
test('every feature has verified source anchors and exactly one approved state',()=>{
const states=new Set(['EXACT_PARITY','V2_IMPLEMENTED_NOT_UI_CONNECTED','CONTRACT_MISSING','UI_MISSING','TEST_MISSING']);
assert.equal(new Set(matrix.feature_rows.map(x=>x.id)).size,matrix.feature_count);
for(const f of matrix.feature_rows){assert.ok(states.has(f.status));for(const k of ['name','read','write','v2','gap','test'])assert.ok(f[k],f.id+':'+k);assert.ok(f.evidence.length);for(const e of f.evidence){assert.ok(inventory.functions.some(x=>x.file===e.file&&x.name===e.name&&x.line===e.line),f.id+':'+e.name);}}
});
test('all literal write/RPC operations represented; all control occurrences retained',()=>{
const ops=fs.readFileSync(path.join(dir,'operation-parity-matrix.csv'),'utf8'),controls=fs.readFileSync(path.join(dir,'control-parity-matrix.csv'),'utf8');
for(const op of new Set(inventory.writes.map(x=>x.operation)))assert.ok(ops.includes('"'+op+'"'),op);
for(const c of inventory.controls)assert.ok(controls.includes('"'+c.id+'"'),c.id);
assert.equal(matrix.control_occurrences,inventory.controls.length);
assert.equal(matrix.unique_literal_operations,new Set(inventory.writes.map(x=>x.operation)).size);
});
test('NO-GO and unproved coverage remain explicit; local checks are not UI/JWT parity tests',()=>{
assert.equal(matrix.parity_verdict,'NO-GO');assert.equal(matrix.semantic_inventory_100_percent,false);assert.equal(matrix.status_counts.EXACT_PARITY,0);
assert.equal(matrix.remote_database_actions_this_stage,1);assert.equal(matrix.phase1_update.staging_only,true);assert.equal(matrix.phase1_update.exact_parity_claimed,false);assert.ok(matrix.unresolved_control_occurrences>0);
assert.equal(Object.values(matrix.status_counts).reduce((a,b)=>a+b,0),matrix.feature_count);
assert.ok(fs.readFileSync(path.join(dir,'missing-and-freeze.md'),'utf8').includes('미적용·보류'));
});
