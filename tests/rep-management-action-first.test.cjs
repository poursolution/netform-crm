const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crm = fs.readFileSync(path.join(__dirname, '..', 'crm.html'), 'utf8');

test('영업사원 관리 첫 업무영역은 오늘 관리자 개입으로 재배치한다', () => {
  assert.match(crm, /_managerActionFirstPaint=paintRepManagement/);
  assert.match(crm, /h\.textContent==='오늘 관리자 확인'/);
  assert.match(crm, /shell\.insertBefore\(intervention,command\?command\.nextSibling:shell\.firstChild\)/);
});

test('기존 관리 기능을 보존하면서 큰 소개영역만 압축한다', () => {
  assert.match(crm, /shell\.classList\.add\('manager-action-first'\)/);
  assert.match(crm, /\.rm-shell\.manager-action-first \.rm-command-head\{[^}]*padding:13px 17px 10px/);
  assert.match(crm, /\.rm-shell\.manager-action-first \.rm-command \.eyebrow,\.rm-shell\.manager-action-first \.rm-command p\{display:none\}/);
  for (const feature of ['담당자 영업 흐름', '고객관리 지원', '현재 Stage 분포', '실행 관리', '업무량 균형', '이번 주 관리자 코멘트']) {
    assert.match(crm, new RegExp(feature));
  }
});
