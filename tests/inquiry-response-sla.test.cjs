'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const crm = fs.readFileSync(path.join(__dirname, '..', 'crm.html'), 'utf8');
const lines = crm.split(/\r?\n/);
const constant = lines.find(line => line.startsWith('var INQUIRY_RESPONSE_SLA_HOURS='));
const hours = lines.find(line => line.startsWith('function todayHoursFrom('));
const late = lines.find(line => line.startsWith('function inquiryResponseLate('));

assert.ok(constant, 'missing inquiry response SLA constant');
assert.ok(hours, 'missing elapsed-hours helper');
assert.ok(late, 'missing inquiry response SLA helper');

const context = {
  inquiryAssigned: q => q.assigned,
  inquiryResponded: q => q.responded,
  inquiryAssignedAt: q => q.assignedAt,
  inquiryCreatedAt: q => q.createdAt
};
vm.createContext(context);
vm.runInContext([constant, hours, late].join('\n'), context);

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

test('최초응대 SLA는 회의에서 확정한 2시간 단일 기준을 사용', () => {
  assert.equal(context.INQUIRY_RESPONSE_SLA_HOURS, 2);
  assert.equal(context.inquiryResponseLate({assigned: true, responded: false, assignedAt: minutesAgo(119)}), false);
  assert.equal(context.inquiryResponseLate({assigned: true, responded: false, assignedAt: minutesAgo(121)}), true);
});

test('응대완료와 미배정은 지연으로 만들지 않고 배정시각 누락은 위험으로 표시', () => {
  assert.equal(context.inquiryResponseLate({assigned: true, responded: true, assignedAt: minutesAgo(180)}), false);
  assert.equal(context.inquiryResponseLate({assigned: false, responded: false, assignedAt: minutesAgo(180)}), false);
  assert.equal(context.inquiryResponseLate({assigned: true, responded: false}), true);
});

test('오늘업무·관리 KPI·견적문의 목록이 같은 SLA 기준을 공유', () => {
  assert.doesNotMatch(crm, /배정 후 3시간/);
  assert.doesNotMatch(crm, /배정 후 24시간 이내 최초 응대/);
  assert.match(crm, /withinHours\(inquiryAssignedAt\(q\)\|\|inquiryCreatedAt\(q\),inquiryRespondedAt\(q\),INQUIRY_RESPONSE_SLA_HOURS\)/);
  assert.match(crm, /delayed=Q\.filter\(inquiryResponseLate\)/);
  assert.match(crm, /late=inquiryResponseLate\(q\)/);
  assert.match(crm, /noResponse=kind==='inq'&&inquiryResponseLate\(item\)/);
  assert.doesNotMatch(crm, /if\(noResponse&&a>=1\)/);
});
