'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crm = fs.readFileSync(path.resolve(__dirname, '..', 'crm.html'), 'utf8');

test('오늘업무는 관리자와 영업사원의 정보 구조를 권한으로 분기한다', () => {
  assert.match(crm, /function todayIsAdmin\(\)/);
  assert.match(crm, /inqCtlIsAdmin/);
  assert.doesNotMatch(crm, /todayIsAdmin[^{]*\{[^}]*송보람/);
  assert.match(crm, /if\(X\.admin\)/);
  assert.match(crm, /today-home today-admin/);
  assert.match(crm, /today-home today-rep/);
});

test('관리자 화면은 견적문의와 파이프라인 두 업무함만 1차 분류로 사용한다', () => {
  assert.match(crm, /오늘 관리자 개입/);
  assert.match(crm, /오늘 관리가 필요한 현장을 견적문의와 영업 파이프라인으로 구분하여 보여줍니다/);
  assert.match(crm, /todayAdminBoard\('inquiry','견적문의 관리'/);
  assert.match(crm, /todayAdminBoard\('pipeline','파이프라인 관리'/);
  assert.match(crm, /새로 들어온 문의 중 현재 처리가 필요한 건/);
  assert.match(crm, /이미 영업이 시작된 현장 중 진행이 멈추거나 확인이 필요한 건/);
  assert.doesNotMatch(crm, /function todaySetView\(/);
  assert.doesNotMatch(crm, /todayLane\('inquiry'/);
});

test('관리자 견적문의는 가로 스크롤이나 14건 절단 없이 한 페이지 행 목록으로 표시한다', () => {
  assert.match(crm, /function todayInquiryBoard\(title,desc,rows\)/);
  assert.match(crm, /today-inquiry-head/);
  assert.match(crm, /현장명<\/span><span>담당자<\/span><span>문의일<\/span><span>현재 상태<\/span><span>관리 필요 사유<\/span><span>경과<\/span><span>조치/);
  assert.match(crm, /shown\.map\(todayInquiryRow\)/);
  assert.doesNotMatch(crm, /todayInquiryBoard[^{]*\{[^}]*slice\(0,14\)/);
  assert.match(crm, /\.today-board\.inquiry \.today-board-list\{max-height:none;overflow:visible\}/);
  assert.match(crm, /\.today-inquiry-table\{width:100%;overflow:hidden\}/);
});

test('관리자 견적문의 필터는 전체를 기본으로 하고 실무 상태별로 좁힐 수 있다', () => {
  assert.match(crm, /function todaySetInquiryFilter\(v\)/);
  assert.match(crm, /\['all','unanswered','quote','material','dispatch','delayed'\]/);
  for (const label of ['전체', '미응대', '견적대기', '자료대기', '발송대기', '지연']) assert.match(crm, new RegExp(label));
});

test('모든 업무카드는 관리 필요 사유와 최근 행동 및 다음 조치를 표시한다', () => {
  assert.match(crm, /today-work-main/);
  assert.match(crm, /x\.reason/);
  assert.match(crm, /x\.recent/);
  assert.match(crm, /다음 조치 ·/);
  assert.match(crm, /다음 행동일 .*일 초과/);
  assert.match(crm, /고객 회신 후 후속조치 없음/);
  assert.match(crm, /견적 발송 후 .*일 경과/);
  assert.match(crm, /function todayInquiryMissing\(q\)/);
  assert.match(crm, /문의 핵심정보 누락/);
});

test('영업사원은 본인 데이터만 계산하고 우선순위를 오늘 업무보다 먼저 배치한다', () => {
  assert.match(crm, /admin\|\|inquirySalesOwner\(q\)===me\|\|inquiryConsultant\(q\)===me/);
  assert.match(crm, /admin\|\|repN\(d\.assignee\)===me/);
  const priority = crm.indexOf('<section class="today-rep-priority">');
  const routine = crm.indexOf('<section class="today-rep-routine">');
  assert.ok(priority > 0 && routine > priority);
  assert.match(crm, /상단 우선순위에 포함되지 않은 오늘 예정 일반 업무/);
  assert.match(crm, /중복 항목 제외/);
});

test('관리자 모바일 화면은 견적문의와 파이프라인 탭으로 전환한다', () => {
  assert.match(crm, /function todaySetAdminBoard\(v\)/);
  assert.match(crm, /class="today-admin-switch"/);
  assert.match(crm, /data-mobile-view/);
  assert.match(crm, /today-admin-boards\[data-mobile-view="inquiry"\]/);
});
