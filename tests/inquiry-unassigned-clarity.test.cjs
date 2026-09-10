'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'inquiry-assignment-clarity.js'), 'utf8');

function runtime() {
  const window = {
    itemPatch: () => ({}),
    inquiryCreatedAt: q => q.received_at || q.created_at || q.at || '',
    inquiryDate: q => q.received_at || q.created_at || q.at || '',
    inquiryRoutedOwner: q => q.assignee_name || q.assignee || '',
    dateTimeLabel: value => String(value),
    assignmentHistoryHTML: () => 'legacy-history',
    CUR_DETAIL: null,
    inqCtlAssignedAt: q => q.assigned_at || '',
    repDisplay: value => value,
    esc: value => String(value),
    todayInquiryEntry: q => ({ item: q }),
    repN: value => String(value || '').trim(),
    repProfile: name => ({ active: true, salesRep: ['김성민', '정정훈', '송보람'].includes(name), role: 'sales' }),
    inqKey: q => String(q.id || q.inquiry_id || ''),
    normSite: value => String(value || '').replace(/\s+/g, '').toLowerCase(),
    inqCtlWorkLabel: q => q.work || q.work_type || '',
    isClosedInq: q => /종결|휴지통/.test(String(q.status || '')),
    operationalInquiries: list => list || [],
    SALES_PEOPLE_MASTER: [],
    B: { users: [], deals: [], inquiries: [] },
    LOCAL: { deals: {}, inquiries: {} },
    loadLocal() {},
    migrateDealKeys() {},
    dealKey: d => String(d.id || ''),
    Phase1: { queue: { list: () => [] } },
    inqCtlRecordAssignment(q, to) { q.assignee = to; q.assigned_to = to; return 'request-1'; },
    G: {},
    paintTodayHome() {}
  };
  vm.runInNewContext(source, { window, Date, Number, String, Array, Object, RegExp, Math });
  return window;
}

test('unrecorded legacy rows stay explicit and are never guessed as auto-assignment failures', () => {
  const api = runtime();
  const meta = api.inquiryUnassignedMeta({ id: 'legacy', code: 'first_contact', status: '접수', created_at: '2026-09-01T00:00:00Z' });
  assert.equal(meta.code, 'unrecorded');
  assert.equal(meta.label, '사유 미기록 · 기존 데이터');
  assert.equal(meta.attemptLabel, '배정 시도 미기록');
  assert.equal(meta.attempted, false);
});

test('only persisted sync evidence becomes a concrete failure reason', () => {
  const api = runtime();
  const meta = api.inquiryUnassignedMeta({
    id: 'failed',
    created_at: '2026-09-10T00:00:00Z',
    assignment_sync: { status: 'failed', error_code: 'TARGET_USER_AMBIGUOUS', error_message: 'active user name matched more than once', attempted_at: '2026-09-10T00:01:00Z' }
  });
  assert.equal(meta.code, 'TARGET_USER_AMBIGUOUS');
  assert.equal(meta.label, '담당자 계정 일치 실패');
  assert.equal(meta.attempted, true);
  assert.match(meta.attemptLabel, /배정 시도 실패/);
});

test('manual unassignment keeps the recorded reason and actor timeline evidence', () => {
  const api = runtime();
  const meta = api.inquiryUnassignedMeta({
    id: 'returned',
    created_at: '2026-09-10T00:00:00Z',
    assignment_history: [{ to_owner: '미배정', from_owner: '김성민', reason: '담당 권역 재검토', changed_at: '2026-09-10T03:00:00Z' }]
  });
  assert.equal(meta.code, 'manual_unassign');
  assert.equal(meta.label, '수동 회수');
  assert.equal(meta.detail, '담당 권역 재검토');
});

test('unassigned records sort oldest first while assigned records keep recent-first behavior', () => {
  const api = runtime();
  const old = { id: 'old', created_at: '2026-09-01T00:00:00Z' };
  const fresh = { id: 'fresh', created_at: '2026-09-10T00:00:00Z' };
  assert.ok(api.inquiryAssignmentSort(old, fresh) < 0);
  const assignedOld = { ...old, assignee: '김성민' };
  const assignedFresh = { ...fresh, assignee: '김성민' };
  assert.ok(api.inquiryAssignmentSort(assignedOld, assignedFresh) > 0);
});

test('UI contract exposes a dedicated unassigned filter and immediate assignment action', () => {
  assert.match(source, /\['unassigned','미배정'\]/);
  assert.match(source, /사유 미기록 · 기존 데이터/);
  assert.match(source, /todayAssignInquiry/);
  assert.match(source, /inqCtlOpenAssign\('assign',key\)/);
  assert.match(source, /inq-ctl-assign-now/);
  assert.match(source, /배정 시도/);
  assert.match(source, /현재 결과/);
});

test('assigned_to UUID and legacy owner-name aliases resolve through one owner identity', () => {
  const api = runtime();
  const id = '11111111-1111-4111-8111-111111111111';
  api.B.users = [{ id, name: '김성민' }];
  assert.deepEqual(
    JSON.parse(JSON.stringify(api.inquiryOwnerIdentity({ assigned_to: id, assignee_name: '김성민' }))),
    { id, name: '김성민', assigned: true, source: 'assigned_to' }
  );
  assert.equal(api.inquiryRoutedOwner({ assigned_to: id, assignee: id }), '김성민');
  assert.equal(api.inquiryRoutedOwner({ owner_name: '정정훈' }), '정정훈');
  assert.equal(api.inquiryAssigned({ raw: { 담당자: '송보람' } }), true);
});

test('server assignment truth wins over stale localStorage assignment patches', () => {
  const api = runtime();
  const id = '22222222-2222-4222-8222-222222222222';
  api.B.users = [{ id, name: '김성민' }];
  api.B.inquiries = [{ id: 'assigned', assigned_to: id, assignee_name: '김성민', assignment_history: [] }];
  api.LOCAL.inquiries.assigned = { assigned_to: null, assignee_name: '', assignee: '' };
  api.mergeInquiryAssignmentTruth(api.B.inquiries[0], api.LOCAL.inquiries.assigned, 'assigned');
  assert.equal(api.inquiryRoutedOwner(api.B.inquiries[0]), '김성민');
  assert.equal(api.inquiryAssigned(api.B.inquiries[0]), true);

  api.B.inquiries = [{ id: 'unassigned', assigned_to: null, assignee_name: '', assignment_history: [] }];
  api.LOCAL.inquiries.unassigned = { assigned_to: '정정훈', assignee_name: '정정훈', assignee: '정정훈' };
  api.mergeInquiryAssignmentTruth(api.B.inquiries[0], api.LOCAL.inquiries.unassigned, 'unassigned');
  assert.equal(api.inquiryRoutedOwner(api.B.inquiries[0]), '');
  assert.equal(api.inquiryAssigned(api.B.inquiries[0]), false);
});

test('assignment and reassignment are reflected immediately before the server refresh', () => {
  const api = runtime();
  const q = { id: 'optimistic', assigned_to: null, assignee_name: '', assignment_history: [], _assignmentServerTruth: { seen: true, assigned: false } };
  api.inqCtlRecordAssignment(q, '김성민', '신규 배정');
  assert.equal(api.inquiryRoutedOwner(q), '김성민');
  api.inqCtlRecordAssignment(q, '정정훈', '담당 변경');
  assert.equal(api.inquiryRoutedOwner(q), '정정훈');
});

test('duplicate inquiry pairs use the assigned row as the single operational representative', () => {
  const api = runtime();
  const common = { site: '[서울 서초] 병원', phone: '010-1234-5678', brand: 'POUR솔루션', work: '옥상방수', created_at: '2026-09-10T01:00:00Z' };
  const rows = api.inquiryCanonicalRows([
    { ...common, id: 'empty', assigned_to: null, assignee_name: '', assignment_history: [] },
    { ...common, id: 'owned', assigned_to: '김성민', assignee_name: '김성민', assignment_history: [], created_at: '2026-09-10T02:00:00Z' },
    { ...common, id: 'later-legitimate', assigned_to: null, assignee_name: '', assignment_history: [], created_at: '2026-09-12T03:00:00Z' }
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'owned');
  assert.equal(api.inquiryAssigned(rows[0]), true);
  assert.deepEqual(Array.from(rows[0]._canonicalDuplicateIds), ['empty', 'owned']);
  assert.equal(rows[1].id, 'later-legitimate');
});
