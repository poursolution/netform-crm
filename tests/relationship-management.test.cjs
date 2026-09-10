'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'..','relationship-management.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','relationship-management.css'),'utf8');
const stage=fs.readFileSync(path.join(__dirname,'..','stage-transition.js'),'utf8');
const stageUI=fs.readFileSync(path.join(__dirname,'..','stage-transition-ui.js'),'utf8');

test('관계관리는 파이프라인과 분리된 실행 페이지로 연결된다',()=>{
 assert.match(html,/data-p="relationship"/);
 assert.match(html,/id="pg-relationship"/);
 assert.match(html,/relationship-management\.css/);
 assert.match(html,/relationship-management\.js/);
 assert.match(html,/G\.page==='relationship'\)paintRelationshipManagement\(\)/);
 assert.match(html,/if\(k==='rel'\)\{goPage\('relationship'\);return\}/);
 assert.match(js,/REL_CODES=\['rapport','silent','waiting'\]/);
});

test('관계관리 페이지는 사유·다음 연락·실행·복귀를 한 화면에서 제공한다',()=>{
 for(const label of ['관계관리 사유','다음 연락','연락 완료','일정 변경','상담 기록','담당자 변경','파이프라인 복귀'])assert.match(js,new RegExp(label));
 assert.match(js,/relationshipManagementOpen/);
 assert.match(js,/StageTransitionUI\.open\(d,false,'first_contact'\)/);
 assert.match(js,/과거 유입 연도와 관계없이/);
 assert.doesNotMatch(js,/inPeriod\(/);
});

test('관계관리 진입은 사유와 기존 다음 행동 기한을 함께 요구한다',()=>{
 assert.match(stage,/relationship_reason','관계관리 사유','select',true/);
 assert.match(stage,/contact_date','다음 접촉일','date',true/);
 assert.match(stage,/contact_date','재접촉 예정일','date',true/);
 assert.match(stage,/기타 관계관리 사유를 직접 입력해 주세요/);
 assert.match(stageUI,/relationshipReason/);
 assert.match(stageUI,/relationshipEnteredAt/);
 assert.match(stageUI,/pushWrite\(terminal\?'close':'transition'/);
});

test('담당자는 자신의 관계업무를 보고 관리자는 7일 이상 지연만 개입한다',()=>{
 assert.match(js,/if\(!admin\)rows=rows\.filter/);
 assert.match(js,/m\.dueDays<=-7/);
 assert.match(js,/m\.days>=90/);
 assert.match(html,/relationshipManagerEscalation/);
 assert.match(css,/\.relm-kpis/);
 assert.match(css,/@media\(max-width:760px\)/);
});
