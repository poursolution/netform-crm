const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const js = fs.readFileSync('relationship-management.js', 'utf8');
const css = fs.readFileSync('relationship-management.css', 'utf8');
const expansion = fs.readFileSync('expansion-pool.js', 'utf8');

test('relationship management exposes three independently selectable work pipelines', () => {
  assert.match(js, /types=\[\['rapport','유대고객'\],\['silent','침묵관리'\],\['waiting','대기고객'\]\]/);
  assert.match(js, /matrixRows\(rows,code,state\)/);
  assert.match(js, /relationshipManagementOpenCell/);
  assert.match(js, /기한 초과.*오늘 연락.*일정 없음.*예정/);
  assert.match(css, /\.relm-type-tabs/);
});

test('pipeline counts share the scoped relationship set but ignore only the selected pipeline', () => {
  assert.match(js, /stageBase=base\(scoped,true\)\.sort\(compare\)/);
  assert.match(js, /if\(!ignoreType&&REL_CODES\.indexOf\(G\.relationshipType\)>=0/);
});

test('assignee selection is placed in the relationship header before pipeline selection', () => {
  assert.match(js,/relm-heading-actions[\s\S]*relm-matrix-wrap/);
  assert.match(js, /relationshipManagementSetOwner\(this\.value\)/);
  assert.match(css, /\.relm-heading-actions/);
});

test('relationship work uses a fixed-height type by status matrix instead of a long card board', () => {
  assert.doesNotMatch(js, /<table class="relm-table"/);
  assert.doesNotMatch(js, /class="relm-pager"/);
  assert.match(js, /function matrixCell/);
  assert.match(js, /function matrixDrawer/);
  assert.match(js, /관리상태 × 관계유형/);
  assert.match(js, /90일\+/);
  assert.match(js, /재개시점 없음/);
  assert.match(css, /\.relm-matrix\{/);
  assert.match(css, /\.relm-matrix-drawer\{/);
});

test('expansion keeps its board and uses a compact comparison list', () => {
  for (const label of ['선택기간 거래', '전체연도 기한도래', '기존 수주 공종', '계약일', '준공일', '당시 영업담당']) {
    assert.ok(expansion.includes(label), label);
  }
  assert.match(expansion, /전체목록/);
  assert.match(expansion, /class="exp-compact-row/);
});
