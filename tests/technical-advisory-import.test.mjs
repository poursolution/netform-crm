import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProject, prepareImport } from '../server/technical-advisory/normalize.mjs';
const source = () => ({ projectId: 'fixture-project', data: {
  aptName: '검증 현장', managerName: '현재 담당자', contractDate: '2026-09-01',
  crosscheck: { execAmount: 90000000 }, modusign: { documentId: 'doc-1' },
  contractRecords: [{ documentId: 'doc-1', type: 'initial_contract', contractAmount: 10000000,
    status: 'completed', completedAt: '2026-09-03T01:00:00Z' }]
} });
test('signed record never automatically creates performance or infers signing date/owner', () => {
  const row = normalizeProject(source()).contracts[0];
  assert.equal(row.performance_eligible, false);
  assert.equal(row.recognized_contract_date, null);
  assert.equal(row.sales_owner, null);
  assert.equal(row.crm_deal_id, null);
  assert.equal(row.source_printed_contract_date, '2026-09-01');
});
test('missing contract amount never falls back to execution amount', () => {
  const p = source(); delete p.data.contractRecords[0].contractAmount;
  const row = normalizeProject(p).contracts[0];
  assert.equal(row.document_amount, null);
  assert.ok(row.review_reasons.includes('DOCUMENT_AMOUNT_REQUIRED'));
});
test('sent, mock, amendments and inconsistent document amounts remain review-only', () => {
  const p = source(); p.data.modusign.mock = true; p.data.consultingContractAmount = 20000000;
  Object.assign(p.data.contractRecords[0], { status: 'sent', type: 'change_contract' });
  const reasons = normalizeProject(p).contracts[0].review_reasons;
  for (const reason of ['SIGNING_NOT_COMPLETED', 'MOCK_PROJECT', 'CONTRACT_CHAIN_REVIEW_REQUIRED', 'CURRENT_DOCUMENT_AMOUNT_CONFLICT']) assert.ok(reasons.includes(reason));
});
test('duplicate document is coalesced; conflicting copies and duplicate projects fail closed', () => {
  const p = source(); p.data.contractRecords.push({ ...p.data.contractRecords[0] });
  assert.equal(normalizeProject(p).contracts.length, 1);
  p.data.contractRecords[1].contractAmount = 2;
  assert.throws(() => normalizeProject(p), /CONFLICTING_DOCUMENT_DUPLICATE/);
  assert.throws(() => prepareImport([source(), source()]), /DUPLICATE_PROJECT/);
});
test('unsafe URLs are removed and empty history is explicitly unverified', () => {
  const p = source(); p.data.contractRecords[0].documentUrl = 'javascript:alert(1)';
  assert.equal(normalizeProject(p).contracts[0].document_url, null);
  p.data.contractRecords = [];
  assert.deepEqual(normalizeProject(p).review_reasons, ['DOCUMENT_HISTORY_REQUIRED']);
});
test('historical records do not borrow the latest contract amount', () => {
  const p = source(); p.data.modusign.documentId = 'new-doc'; p.data.consultingContractAmount = 20000000;
  assert.ok(!normalizeProject(p).contracts[0].review_reasons.includes('CURRENT_DOCUMENT_AMOUNT_CONFLICT'));
});
