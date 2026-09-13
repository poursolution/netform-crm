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
  assert.match(js, /관리필요.*초과.*오늘/);
  assert.match(css, /\.relm-pipelines\{display:grid;grid-template-columns:repeat\(3/);
});

test('pipeline counts share the scoped relationship set but ignore only the selected pipeline', () => {
  assert.match(js, /stageBase=base\(scoped,true\),raw=base\(scoped\)/);
  assert.match(js, /if\(!ignoreType&&REL_CODES\.indexOf\(G\.relationshipType\)>=0/);
});

test('expansion list restores the previous operational context', () => {
  for (const label of ['선택기간 거래', '전체연도 기한도래', '기존 수주 공종', '계약일', '준공일', '당시 영업담당']) {
    assert.ok(expansion.includes(label), label);
  }
  assert.match(expansion, /상세 목록/);
});
