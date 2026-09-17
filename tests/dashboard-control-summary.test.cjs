const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const crm = fs.readFileSync(path.join(root, 'crm.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'p2-operational-polish.css'), 'utf8');

test('영업 대시보드 첫 화면은 금액, 문제, 병목, 담당자 개입 순서로 끝난다', () => {
  const money = crm.indexOf('id="d-money"');
  const issues = crm.indexOf('id="d-issues"');
  const bottleneck = crm.indexOf('id="d-bottleneck-summary"');
  const reps = crm.indexOf('id="d-rep-summary"');
  const analysis = crm.indexOf('id="d-analysis"');
  assert.ok(money < issues && issues < bottleneck && bottleneck < reps && reps < analysis);
  assert.match(crm, /function dashboardCompactMoney\(\)/);
  assert.match(crm, /function dashboardCompactIssues\(\)/);
  assert.match(crm, /function dashboardCompactBottlenecks\(\)/);
  assert.match(crm, /function dashboardCompactReps\(\)/);
});

test('대표 첫 화면은 네 개의 금액 KPI와 운영 예외만 보여준다', () => {
  assert.match(crm, /label:'Pipeline'/);
  assert.match(crm, /label:'수주임박'/);
  assert.match(crm, /label:'계약·수주'/);
  assert.match(crm, /label:'위험 금액'/);
  assert.match(crm, /label:'최초응대 지연'/);
  assert.match(crm, /<h3>담당자 확인 필요<\/h3>/);
  assert.match(css, /dashboard-compact-money>div\{grid-template-columns:repeat\(4/);
});

test('메인 관리위험은 판단만 하고 오늘 업무 처리 화면으로 연결한다', () => {
  assert.match(crm, /대표가 개입 여부를 판단하고, 실제 처리는 오늘 업무에서 이어갑니다/);
  assert.match(crm, /오늘 업무에서 처리 →/);
  assert.match(crm, /goPage\(\\'today\\'\)/);
});

test('모든 상세 분석은 역할별 탭에 보존한다', () => {
  for (const tab of ['전체현황', '영업흐름', '담당자', '사업유형', '병목', '추이', '집계 기준 ⓘ']) {
    assert.match(crm, new RegExp(tab));
  }
  for (const id of ['d-pipe', 'd-charts', 'd-origin', 'd-health', 'd-neck', 'd-trend', 'd-yoy']) {
    assert.match(crm, new RegExp(`id="${id}"`));
  }
  assert.match(crm, /function dashboardArrangeAnalysis\(\)/);
  assert.match(crm, /function paintDashboardAnalysisTabs\(\)/);
});

test('긴 집계 설명은 첫 화면이 아니라 집계 기준 패널에만 둔다', () => {
  assert.match(crm, /function dashboardAnalysisCriteria\(\)/);
  assert.match(crm, /견적문의 연결률/);
  assert.match(crm, /운영관리자는 개인 성과 순위에서 제외/);
  assert.match(crm, /id="dh-panel-criteria" role="tabpanel" hidden/);
});

test('대시보드 압축 UI는 PC와 모바일 레이아웃을 제공한다', () => {
  assert.match(css, /\.dashboard-compact-money>div\{display:grid;grid-template-columns:repeat\(5/);
  assert.match(css, /\.dashboard-compact-reps \.dashboard-rep-head,\.dashboard-rep-row/);
  assert.match(css, /@media\(max-width:760px\)\{\.dashboard-compact-money>header/);
  assert.match(css, /\.dashboard-analysis #d-analysis-tabs\{[^}]*overflow-x:auto/);
});
