const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const crm = fs.readFileSync(path.join(root, 'crm.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'p2-operational-polish.css'), 'utf8');

test('영업사원 관리 첫 화면은 팀 KPI, 관리자 개입, 담당자 카드로 압축한다', () => {
  assert.match(crm, /function repManagerPeopleView\(interventions\)/);
  assert.match(crm, /오늘 관리자 확인/);
  assert.match(crm, /담당자별 관리 현황/);
  assert.match(crm, /REP_MANAGER_ROWS\.map\(repManagerCard\)/);
  assert.match(crm, /사람별 관리/);
  assert.match(crm, /팀 비교/);
});

test('담당자 상세는 필요한 정보를 삭제하지 않고 다섯 탭으로 보존한다', () => {
  for (const tab of ['현황', '문제현장', '활동·진전', '업무량', '코칭·약속']) {
    assert.match(crm, new RegExp(tab));
  }
  for (const feature of ['담당자 영업 흐름', '실행 관리', '고객관리 지원', '최근 활동', '업무량 균형', '관리자 약속']) {
    assert.match(crm, new RegExp(feature));
  }
  assert.match(crm, /function repManagerSetDrawerTab\(tab\)/);
  assert.match(crm, /function repManagerRenderDrawer\(\)/);
});

test('팀 비교에는 Stage, 움직임, 실행, 업무량 비교가 유지된다', () => {
  assert.match(crm, /repManagerStageGrid\(\)/);
  assert.match(crm, /repManagerMovementTable\(\)/);
  assert.match(crm, /repManagerExecutionTable\(\)/);
  assert.match(crm, /repManagerLoadTable\(\)/);
});

test('관제판과 Drawer는 PC와 모바일 레이아웃을 제공한다', () => {
  assert.match(css, /\.rm-people-grid\{display:grid;grid-template-columns:repeat\(2/);
  assert.match(css, /\.rm-drawer-tabs\{[^}]*grid-template-columns:repeat\(5/);
  assert.match(css, /@media\(max-width:760px\)\{\.rm-control-title/);
  assert.match(css, /\.rm-people-grid\{grid-template-columns:1fr\}/);
});
