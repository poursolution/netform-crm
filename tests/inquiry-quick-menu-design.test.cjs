'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync(require.resolve('../crm.html'),'utf8');

function source(name,next){
  const start=html.indexOf('function '+name+'(');
  const end=html.indexOf('\nfunction '+next+'(',start);
  assert.notEqual(start,-1,name+' 함수를 찾을 수 없습니다.');
  assert.notEqual(end,-1,next+' 함수 경계를 찾을 수 없습니다.');
  return html.slice(start,end);
}

test('빠른 처리 모달은 핵심·운영·정리 행동을 시각적으로 분리한다',()=>{
  const code=source('inqCtlOpenMenu','inqCtlMenuDo');
  assert.match(code,/inq-quick-hero/);
  assert.match(code,/inq-quick-primary/);
  assert.match(code,/inq-quick-section/);
  assert.match(code,/inq-quick-danger/);
  assert.ok(code.indexOf('영업담당 배정')<code.indexOf('상세 처리'));
  assert.ok(code.indexOf('운영 처리')<code.indexOf('정리 작업'));
});

test('기존 빠른 처리 기능을 모두 유지한다',()=>{
  const code=source('inqCtlOpenMenu','inqCtlMenuDo');
  assert.doesNotThrow(()=>new Function('return ('+code+')'));
  for(const mode of ['detail','consultant','assign','reassign','store','hold','unassign','duplicate','trash']){
    assert.match(code,new RegExp('\\b'+mode+'\\b'),mode+' 동작이 누락되었습니다.');
  }
});

test('모바일에서는 핵심 행동과 운영 버튼이 반응형으로 재배치된다',()=>{
  assert.match(html,/@media\(max-width:640px\)\{\.inq-quick-primary\{grid-template-columns:1fr\}/);
  assert.match(html,/\.inq-quick-tools\{grid-template-columns:1fr 1fr\}/);
});
