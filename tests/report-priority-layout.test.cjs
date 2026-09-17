const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crm = fs.readFileSync(path.join(__dirname, '..', 'crm.html'), 'utf8');

test('리포트 메뉴와 화면 제목에서 중복 대표 보고 명칭을 제거한다', () => {
  assert.match(crm, /data-p="report"[^>]*>[\s\S]*?<span class="ic">📈<\/span>리포트<\/div>/);
  assert.match(crm, /report:\['리포트','매출·담당자별 실적·미래매출·위험을 한 화면에서 확인'\]/);
  assert.doesNotMatch(crm, /리포트 · 대표 보고/);
  assert.doesNotMatch(crm, /대표 보고 근거 목록/);
});

test('매출 요약 다음에 담당자별 실적을 우선 배치한다', () => {
  const render = crm.slice(crm.indexOf("root.innerHTML='<div class=\"ceo-report\""), crm.indexOf('paintReport=paintReportV2'));
  const command = render.indexOf('ceo-command');
  const reps = render.indexOf('id="ceo-reps"');
  const trend = render.indexOf('id="ceo-trend"');
  const pipeline = render.indexOf('id="ceo-pipeline"');
  assert.ok(command >= 0 && reps > command && trend > reps && pipeline > trend);
  assert.match(render, /담당자별 실적/);
  assert.match(render, /누적 수주<\/th><th>이번 달<\/th><th>진행 파이프라인<\/th><th>가중 예상/);
});

test('담당자가 없는 영업도 담당자별 실적 표에서 빠지지 않는다', () => {
  assert.match(crm, /function reportUnassignedRepRow\(/);
  assert.match(crm, /미배정 Pipeline/);
  assert.match(crm, /reps\+reportUnassignedRepRow\(won,monthWon,open,raw,month\)/);
  assert.match(crm, /위험 · 미배정 포함/);
});
