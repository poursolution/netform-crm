const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const js = fs.readFileSync('relationship-management.js', 'utf8');
const css = fs.readFileSync('relationship-management.css', 'utf8');
const expansion = fs.readFileSync('expansion-pool.js', 'utf8');

test('relationship management exposes three independently selectable work pipelines', () => {
  assert.match(js, /stageNames=\{rapport:'유대고객',silent:'침묵관리',waiting:'대기고객'\}/);
  assert.match(js, /REL_CODES\.map\(function\(code\)/);
  assert.match(js, /relationshipManagementSetType/);
  assert.match(js, /기한 초과.*오늘 연락.*일정 없음.*예정/);
  assert.match(css, /\.relm-type-tabs/);
});

test('pipeline counts share the scoped relationship set but ignore only the selected pipeline', () => {
  assert.match(js, /stageBase=base\(scoped,true\),raw=base\(scoped\)/);
  assert.match(js, /if\(!ignoreType&&REL_CODES\.indexOf\(G\.relationshipType\)>=0/);
});

test('assignee selection is placed in the relationship header before pipeline selection', () => {
  const owner = js.indexOf('relm-owner-top');
  const pipelines = js.indexOf('relm-type-tabs');
  assert.ok(owner >= 0 && pipelines > owner);
  assert.match(js, /relationshipManagementSetOwner\(this\.value\)/);
  assert.match(css, /\.relm-heading-actions/);
});

test('relationship work uses type-specific cards instead of the seven-column table', () => {
  assert.doesNotMatch(js, /<table class="relm-table"/);
  assert.doesNotMatch(js, /class="relm-pager"/);
  assert.match(js, /function relationshipCard/);
  assert.match(js, /관계 목적/);
  assert.match(js, /응답 정체/);
  assert.match(js, /고객 발언/);
  assert.match(js, /slice\(0,15\)/);
});

test('expansion list restores the previous operational context', () => {
  for (const label of ['선택기간 거래', '전체연도 기한도래', '기존 수주 공종', '계약일', '준공일', '당시 영업담당']) {
    assert.ok(expansion.includes(label), label);
  }
  assert.match(expansion, /상세 목록/);
});
