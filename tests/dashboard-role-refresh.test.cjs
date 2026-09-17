const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crm = fs.readFileSync(path.join(__dirname, '..', 'crm.html'), 'utf8');
const overrides = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'phase11-ui-overrides.cjs'), 'utf8');

test('dashboard role switch repaints role-specific metrics and sections', () => {
  const expected = /function setHomeRole\(r\)\{[^\n]+G\.homeRole=r;Phase1\.mode\(r==='sales'\?'rep':'admin'\);paintDash\(\);\}/;
  assert.match(crm, expected);
  assert.match(overrides, /Phase1\.mode\(r==='sales'\?'rep':'admin'\);paintDash\(\);/);
});

test('read freshness and write synchronization use distinct labels', () => {
  assert.match(crm, /🟢 저장 동기화 완료/);
  assert.match(crm, /조회 데이터 상태는 왼쪽에서 확인/);
  assert.doesNotMatch(crm, /🟢 서버 동기화 완료/);
});
