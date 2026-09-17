'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');

const workflow=fs.readFileSync('.github/workflows/quality-gate.yml','utf8');

test('quality gate runs for master changes and merge queues',()=>{
  assert.match(workflow,/push:\n\s+branches: \[master\]/);
  assert.match(workflow,/pull_request:\n\s+branches: \[master\]/);
  assert.match(workflow,/merge_group:/);
  assert.match(workflow,/permissions:\n\s+contents: read/);
});

test('quality gate covers the repaired customer asset and manager request paths',()=>{
  for(const file of [
    'quality-gate-workflow.test.cjs',
    'customer-asset-return-key.test.cjs',
    'site-address-filter-static.test.cjs',
    'site-linked-assets-static.test.cjs',
    'site-master-address-update-static.test.cjs',
    'manager-request-today-source.test.cjs',
    'manager-request-evidence.test.cjs',
    'today-work-clarity.test.cjs',
    'data-cleanup.test.cjs'
  ]) assert.match(workflow,new RegExp(file.replaceAll('.','\\.')));
});

test('quality gate assembles and verifies the deployable release',()=>{
  assert.match(workflow,/node scripts\/build-production-ui\.cjs/);
  assert.match(workflow,/node scripts\/verify-production-manifest\.cjs \.\.\/deploy\/netform-crm-production-pages/);
  assert.match(workflow,/name: quality-gate/);
  assert.match(workflow,/timeout-minutes: 10/);
});
