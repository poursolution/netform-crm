import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { projectSnapshot } from '../supabase/functions/technical-advisory-ingest/project.mjs';
import { normalizeProject } from '../supabase/functions/technical-advisory-ingest/normalize.mjs';
import { handler } from '../supabase/functions/technical-advisory-ingest/handler.mjs';

const fixture = () => ({ projectId: 'fixture-project', revision: '7', data: {
  aptName: '검증 현장', constructionName: '옥상방수', companyName: '검증 업체', managerName: '현재 담당',
  status: 'contract_writing', contractRecords: [], consultingContractAmount: '14,740,000',
  contractDate: '2026-10-02', siteInfo: { progressRate: 0 }
} });
test('documentless project preserves basics separately without manufacturing sales evidence', () => {
  const input = fixture(), before = structuredClone(input), basic = projectSnapshot(input);
  assert.equal(basic.site_name, '검증 현장');
  assert.equal(basic.work_name, '옥상방수');
  assert.equal(basic.company_name, '검증 업체');
  assert.equal(basic.current_source_manager, '현재 담당');
  assert.equal(basic.source_consulting_contract_amount, 14740000);
  assert.equal(basic.operations.completed, false);
  assert.deepEqual(normalizeProject(input), { source_project_id: input.projectId, review_reasons: ['DOCUMENT_HISTORY_REQUIRED'], contracts: [] });
  for (const key of ['sales_owner', 'recognized_contract_date', 'construction_contract_amount', 'crm_deal_id']) assert.ok(!(key in basic));
  assert.deepEqual(input, before);
});
test('unrelated source payload is not copied and invalid or absent amounts stay unknown', () => {
  const input = fixture(); input.data.secret = 'do-not-copy'; input.data.contactPhone = 'do-not-copy';
  for (const amount of [undefined, null, '', '1e7', -1, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    input.data.consultingContractAmount = amount;
    const basic = projectSnapshot(input);
    assert.equal(basic.source_consulting_contract_amount, null);
    assert.ok(!JSON.stringify(basic).includes('do-not-copy'));
  }
  input.data.consultingContractAmount = 0;
  assert.equal(projectSnapshot(input).source_consulting_contract_amount, 0);
});
test('same site names keep separate source identities and actual completion is not inferred', () => {
  const a = fixture(), b = fixture(); b.projectId = 'another-project'; b.data.constructionName = '외벽공사';
  a.data.siteInfo = { progressRate: 100, endDate: '2020-01-01' };
  assert.notEqual(projectSnapshot(a).source_project_id, projectSnapshot(b).source_project_id);
  assert.equal(projectSnapshot(a).operations.completed, false);
  assert.equal(projectSnapshot(a).operations.completion_date, null);
});
test('signed ingress passes project and unchanged contract/operations together; failures never acknowledge storage', async () => {
  const input = fixture(), body = JSON.stringify(input), secret = 'synthetic-key-for-tests-at-least-32-chars', timestamp = '1791050400';
  const signature = createHmac('sha256', secret).update(timestamp + '.' + body).digest('hex');
  const request = sig => new Request('https://example.invalid', { method: 'POST', body, headers: { 'x-crm-timestamp': timestamp, 'x-crm-signature': sig } });
  const calls = [], run = handler({ secret, now: () => Number(timestamp) * 1000, store: async (...args) => { calls.push(args); return { ok: true, project_result: 'STORED' }; } });
  assert.equal((await run(request('0'.repeat(64)))).status, 401); assert.equal(calls.length, 0);
  assert.equal((await run(request(signature))).status, 200);
  assert.deepEqual(calls[0][2], normalizeProject(input));
  assert.deepEqual(calls[0][4], projectSnapshot(input));
  assert.deepEqual(calls[0][3], calls[0][4].operations);
  const failed = handler({ secret, now: () => Number(timestamp) * 1000, store: async () => { throw Error('store failed'); } });
  assert.equal((await failed(request(signature))).status, 503);
});
