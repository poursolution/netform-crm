const test = require('node:test');
const assert = require('node:assert/strict');
const ContractPerformance = require('../contract-performance.js');

const options = {
  year: '2026',
  quarter: 0,
  isWon: deal => deal.state === 'won',
  ownerOf: deal => deal.owner
};

test('contract performance uses close date and confirmed won amount only', () => {
  const result = ContractPerformance.summarize([
    { id: 1, owner: '황윤선', state: 'won', closed_at: '2026-03-20T10:00:00Z', amount: 900, won_amount: 700 },
    { id: 2, owner: '황윤선', state: 'won', closed_at: '2025-12-31', created_at: '2026-01-02', amount: 500, won_amount: 400 },
    { id: 3, owner: '황윤선', state: 'open', closed_at: '2026-04-01', amount: 300, won_amount: 250 }
  ], ['황윤선'], options);
  assert.equal(result.totalCount, 1);
  assert.equal(result.totalAmount, 700);
  assert.deepEqual(result.rows[0].deals.map(row => row.id), [1]);
});

test('missing won amount is visible and never replaced with expected amount', () => {
  const result = ContractPerformance.summarize([
    { id: 1, owner: '이필선', state: 'won', closed_at: '2026-07-02', amount: 1200 }
  ], ['이필선'], options);
  assert.equal(result.totalCount, 1);
  assert.equal(result.totalAmount, 0);
  assert.equal(result.missingAmountCount, 1);
  assert.equal(ContractPerformance.hasWonAmount({ won_amount: 0 }), true);
  assert.equal(ContractPerformance.hasWonAmount({ won_amount: null, wonAmount: 0 }), false);
});

test('quarter filter and won stage history fallback use the actual won event', () => {
  const result = ContractPerformance.summarize([
    { id: 1, owner: '한준엽', state: 'won', created_at: '2025-01-01', won_amount: 50, stage_history: [{ from: 'contract', to: 'won', at: '2026-05-05' }] },
    { id: 2, owner: '한준엽', state: 'won', won_amount: 80, stageHistory: [{ from: 'contract', to: 'won', at: '2026-09-05' }] }
  ], ['한준엽'], { ...options, quarter: 2 });
  assert.equal(result.totalCount, 1);
  assert.equal(result.totalAmount, 50);
});

test('won rows without a confirmation date do not leak into a selected year', () => {
  const result = ContractPerformance.summarize([
    { id: 1, owner: '정정훈', state: 'won', created_at: '2026-08-01', won_amount: 100 }
  ], ['정정훈'], options);
  assert.equal(result.totalCount, 0);
  assert.equal(result.missingDateCount, 1);
});
