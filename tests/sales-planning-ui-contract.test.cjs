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
