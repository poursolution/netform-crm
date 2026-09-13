const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const js=fs.readFileSync('relationship-management.js','utf8');
const css=fs.readFileSync('relationship-management.css','utf8');

test('관계관리 첫 화면은 3개 관계유형과 4개 관리상태의 관제판이다',()=>{
  for(const text of ['유대고객','침묵관리','대기고객','기한 초과','오늘 연락','일정 없음','예정'])assert.match(js,new RegExp(text));
  assert.match(css,/grid-template-columns:142px repeat\(3,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(js,/slice\(0,15\)/);
});

test('관제 셀은 최대 3개 현장만 예고하고 전체 고객은 drawer에서 처리한다',()=>{
  assert.match(js,/items\.slice\(0,3\)/);
  assert.match(js,/relationshipManagementOpenCell/);
  assert.match(js,/relationshipManagementCloseCell/);
  assert.match(js,/📞 전화/);
  assert.match(js,/연락 기록/);
  assert.match(css,/max-height:100%/);
});
