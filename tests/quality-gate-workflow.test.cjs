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
    'report-priority-layout.test.cjs',
    'site-asq-canonical-linkage.test.cjs',
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
