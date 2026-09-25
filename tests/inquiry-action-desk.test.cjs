const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const crm=fs.readFileSync(path.join(root,'crm.html'),'utf8');
const css=fs.readFileSync(path.join(root,'p2-operational-polish.css'),'utf8');

test('견적문의 목록은 상태 대신 문제·문제경과·즉시행동을 사용한다',()=>{
  assert.match(crm,/function inqCtlProblem\(q\)/);
  assert.match(crm,/담당자 없음/);
  assert.match(crm,/첫 연락 없음/);
  assert.match(crm,/견적 발송 예정일 초과/);
  assert.match(crm,/다음 행동일 초과/);
  assert.match(crm,/지금 문제/);
  assert.match(crm,/지금 할 일/);
});

test('미배정과 미응대는 목록에서 바로 처리한다',()=>{
  assert.match(crm,/inqCtlOpenAssign\(\\'assign\\',this\.dataset\.k\)/);
  assert.match(crm,/function inqCtlQuickCall\(k\)/);
  assert.match(crm,/📞 전화/);
  assert.match(crm,/응대 기록/);
});

test('견적문의 모든 표면은 가로 스크롤과 강제 최소폭을 제거한다',()=>{
  assert.match(css,/\.inq-ctl-scroll\{overflow-y:auto!important;overflow-x:hidden!important\}/);
  assert.match(css,/\.inq-tech-row\{min-width:0!important\}/);
  assert.match(css,/\.sp-wrap\.mine[\s\S]*minmax\(0,1\.38fr\)/);
  assert.match(css,/@media\(max-width:820px\)[\s\S]*grid-template-areas/);
});
