const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'crm.html'), 'utf8');

test('pipeline loads and applies the construction-year source of truth', () => {
  assert.match(html, /construction-year\.js\?v=/);
  assert.match(html, /constructionYear:'전체'/);
  assert.match(html, /function constructionYearMatch\(d\)/);
  assert.match(html, /workMatches\(d,G\.workFilter\)&&constructionYearMatch\(d\)&&metricDealMatch/);
  assert.match(html, /공사 예정연도/);
  assert.match(html, /일정 미입력/);
});

test('external report makes the conversion denominator explicit', () => {
  assert.match(html, /external-performance\.js\?v=/);
  assert.match(html, /전환율 = 수주 ÷ 결정 완료\(수주\+실주·종결\)/);
  assert.match(html, /<th>수주 전환율<\/th>/);
  assert.match(html, /function externalPerformanceNames\(\)/);
  assert.match(html, /고영운/);
});

test('cross-screen drilldowns clear a stale planned-year filter', () => {
  assert.match(html, /function towerDrillReset\(\)\{[^}]*G\.constructionYear='전체'/);
});

test('source attribution keeps Apartment Square value after advisory conversion', () => {
  assert.match(html, /business-attribution\.js\?v=/);
  assert.match(html, /최초 유입 기여 · 기술자문 전환/);
  assert.match(html, /APARTMENT SQUARE → 기술자문/);
  assert.match(html, /서로 다른 분석축이므로 두 표의 합계를 더하지 않습니다/);
  assert.match(html, /won_amount만 집계/);
});

test('rep contract performance is based on close date and won_amount, with evidence drilldown', () => {
  assert.match(html, /contract-performance\.js\?v=/);
  assert.match(html, /function perfWonDeals\(name\)\{[^\n]*inPeriod\(wonDate\(d\)\)/);
  assert.match(html, /wonAmount=sumBy\(W,wonAmt\)/);
  assert.match(html, /계약완료 · 수주확정금액/);
  assert.match(html, /계약완료 근거 현장/);
  assert.match(html, /확정금액 미입력/);
  assert.match(html, /function reportWonDeals\(\)\{[^\n]*inPeriod\(wonDate\(d\)\)/);
  assert.match(html, /monthWonAmt=sumBy\(monthWon,wonAmt\)/);
  assert.doesNotMatch(html, /sumBy\(perfMonthWon\(n\),function\(d\)\{return wonAmt\(d\)\|\|oppAmt\(d\)\}\)/);
});
