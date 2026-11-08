'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const workflow=fs.readFileSync('.github/workflows/quality-gate.yml','utf8');
const packageJson=JSON.parse(fs.readFileSync('package.json','utf8'));

test('quality gate runs for master changes and merge queues',()=>{
  assert.match(workflow,/push:\r?\n\s+branches: \[master\]/);
  assert.match(workflow,/pull_request:\r?\n\s+branches: \[master\]/);
  assert.match(workflow,/merge_group:/);
  assert.match(workflow,/permissions:\r?\n\s+contents: read/);
});

test('quality gate covers the repaired customer asset and manager request paths',()=>{
  for(const file of [
    'quality-gate-workflow.test.cjs',
    'customer-asset-return-key.test.cjs',
    'dashboard-inquiry-lineage.test.cjs',
    'site-person-history-linkage.cjs',
    'contact-card-current-site.test.cjs',
    'mobile-contact-current-site.test.cjs',
    'report-priority-layout.test.cjs',
    'site-asq-canonical-linkage.test.cjs',
    'manager-move-canonical-safety.test.cjs',
    'manager-move-history-site-id.test.cjs',
    'contact-save-site-id.test.cjs',
    'detail-next-completion.test.cjs',
    'today-next-completion.test.cjs',
    'mobile-today-next-completion.test.cjs',
    'issue-completion-order.test.cjs',
    'inquiry-next-completion.test.cjs',
    'inquiry-next-set.test.cjs',
    'inquiry-bulk-next.test.cjs',
    'inquiry-check-order.test.cjs',
    'site-address-filter-static.test.cjs',
    'site-linked-assets-static.test.cjs',
    'site-master-address-update-static.test.cjs',
    'manager-request-today-source.test.cjs',
    'manager-request-evidence.test.cjs',
    'today-work-clarity.test.cjs',
    'data-cleanup.test.cjs',
    'data-cleanup-write.test.cjs',
    'relationship-contact-production-migration.test.cjs',
    'campaign-excel-export.test.cjs',
    'gyeongnam-action-first.test.cjs',
    'rep-management-action-first.test.cjs',
    'pipeline-filter-layout.test.cjs'
  ]) assert.match(packageJson.scripts['test:contracts'],new RegExp(file.replaceAll('.','\\.')));
});

test('quality gate assembles and verifies the deployable release',()=>{
  assert.match(workflow,/node scripts\/build-production-ui\.cjs/);
  assert.match(workflow,/node scripts\/verify-production-manifest\.cjs \.\.\/deploy\/netform-crm-production-pages/);
  assert.match(workflow,/name: quality-gate/);
  assert.match(workflow,/timeout-minutes: 15/);
});

/* 2026-11-08 병합 시간 줄이기: 브라우저 검사를 4대로 나누고, 필수 검사 quality-gate 는 모두 통과했는지만 모은다 */
test('quality gate splits the browser smoke across four machines and gathers the result',()=>{
  assert.match(workflow,/shard: \[1, 2, 3, 4\]/);
  assert.match(workflow,/SMOKE_SHARD: \$\{\{ matrix\.shard \}\}\/4/);
  assert.match(workflow,/needs: \[checks, smoke\]/);
  assert.match(workflow,/if: always\(\)/);
  assert.equal((workflow.match(/run: bash scripts\/ci-scope\.sh/g)||[]).length,2,'두 작업 모두 같은 발표 전용 판단을 쓴다');
});

const {spawnSync}=require('node:child_process');
const smoke=(cmds,env)=>spawnSync(process.execPath,['scripts/run-smoke.cjs',...cmds],{encoding:'utf8',env:Object.assign({},process.env,{SMOKE_JOBS:'2'},env)});
test('smoke shards cover every check exactly once',()=>{
  const cmds=Array.from({length:11},(_,i)=>'node -e "console.log(\'c'+i+'\')" scripts/fake-'+i+'.cjs');
  const seen=[];
  for(let k=1;k<=4;k++){const r=smoke(cmds,{SMOKE_SHARD:k+'/4'});assert.equal(r.status,0,r.stdout+r.stderr);for(const m of r.stdout.matchAll(/fake-(\d+)\.cjs/g))seen.push(Number(m[1]));}
  assert.deepEqual(seen.sort((a,b)=>a-b),Array.from({length:11},(_,i)=>i));
});
test('a failing smoke check is retried once and still fails when it keeps failing',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const flag=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'smoke-')),'once');
  const flakyCmd='node -e "const f=process.argv[1];if(!require(\'fs\').existsSync(f)){require(\'fs\').writeFileSync(f,\'1\');process.exit(1)}" '+JSON.stringify(flag);
  const r=smoke([flakyCmd]);
  assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/다시 돌려 통과: 1/);
  const bad=smoke(['node -e "process.exit(1)"']);
  assert.equal(bad.status,1);assert.match(bad.stdout,/RETRY/);
  const off=smoke(['node -e "process.exit(1)"'],{SMOKE_RETRY:'0'});
  assert.equal(off.status,1);assert.doesNotMatch(off.stdout,/RETRY/);
});

test('quality gate exercises critical PC screens in a real browser',()=>{
  assert.match(workflow,/run: npm ci/);
  assert.match(workflow,/npx playwright install --with-deps chromium/);
  assert.match(workflow,/run: npm run smoke:pc/);
  assert.match(packageJson.scripts['smoke:pc'],/verify-today-work-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/verify-mobile-today-completion-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/verify-customer-asset-pagination-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/verify-customer-asset-return-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/pc-typography-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/pc-organization-history-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/site-record-review-browser\.test\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/pipeline-controls-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/verify-pipeline-filter-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/verify-rep-management-browser\.cjs/);
  assert.match(packageJson.scripts['smoke:pc'],/verify-gyeongnam-management-browser\.cjs/);
});
