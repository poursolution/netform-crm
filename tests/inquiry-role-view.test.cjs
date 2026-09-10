'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crm = fs.readFileSync(path.resolve(__dirname, '..', 'crm.html'), 'utf8');

test('견적문의는 관리자 운영 화면과 담당자 내 문의 화면을 분리한다', () => {
  assert.match(crm, /var INQ_MINE_TABS=\['내 할 일','전체','배정완료','응대중','영업전환','스토어 이관','보류'\]/);
  assert.match(crm, /function inqCtlRoleView\(\)/);
  assert.match(crm, /function inqCtlSetRoleView\(v\)/);
  assert.match(crm, />관리자 운영<\/button>/);
  assert.match(crm, />내 문의<\/button>/);
  assert.match(crm, /MY INQUIRY DESK/);
  assert.match(crm, /내게 배정된 문의 중 최초응대와 오늘 할 일을 먼저 처리합니다/);
  assert.match(crm, /G\._inqRoleApplied!==role/);
  assert.match(crm, /G\.inqBucket=role==='admin'\?'전체':'내 할 일'/);
  assert.match(crm, /G\.inqView=role==='admin'\?'console':'split'/);
  assert.match(crm, /\['split','한 화면 처리'\]/);
});

test('담당자 화면은 본인의 영업 또는 상담 문의만 포함하고 할 일을 먼저 계산한다', () => {
  assert.match(crm, /function inqCtlRoleMatch\(q\)/);
  assert.match(crm, /inquirySalesOwner\(q\)===me\|\|inquiryConsultant\(q\)===me/);
  assert.match(crm, /&&inqCtlRoleMatch\(q\)/);
  assert.match(crm, /function inqCtlNeedsAction\(q\)/);
  assert.match(crm, /if\(!inqCtlFirstResponseAt\(q\)\)return true/);
  assert.match(crm, /if\(!a\)return true/);
  assert.match(crm, /if\(tab==='내 할 일'\)return inqCtlNeedsAction\(q\)/);
});

test('관리자 전용 정리 기능은 담당자 화면에서 숨기고 실행도 차단한다', () => {
  assert.match(crm, /if\(inqCtlRoleView\(\)!=='admin'\)return \[\]/);
  assert.match(crm, /bulk=admin\?'<div class="inq-ctl-bulk">/);
  assert.match(crm, /admin\?'<button class="'\+\(G\.inqAct==='rep'/);
  assert.match(crm, /adminOnly=\['consultant','assign','reassign','unassign','trash','duplicate'\]/);
  assert.match(crm, /adminOnly\.indexOf\(mode\)>=0&&!inqCtlIsAdmin\(\)/);
  assert.match(crm, /이 작업은 관리자 화면에서만 처리할 수 있습니다/);
});

test('담당자 빠른 목록은 중복 담당자 열을 제거한 7개 판단축을 사용한다', () => {
  assert.match(crm, /inq-ctl-row mine-row/);
  assert.match(crm, /header=admin\?/);
  assert.match(crm, /<span>최초응대<\/span><span>상태·Next<\/span><span>처리<\/span>/);
  assert.match(crm, /\.inq-ctl-row\.mine-row\{grid-template-columns:/);
});
