const test = require('node:test');
const assert = require('node:assert/strict');
const ExternalPerformance = require('../external-performance.js');

const helpers = {
  ownerOf: deal => deal.owner,
  isOpen: deal => deal.state === 'open',
  isWon: deal => deal.state === 'won',
  amountOf: deal => deal.amount || 0,
  weightedOf: deals => deals.reduce((total, deal) => total + (deal.amount || 0) * 0.5, 0),
  isRisk: deal => !!deal.risk
};

test('conversion rate uses decided opportunities, never the open pipeline', () => {
  const rows = ExternalPerformance.summarize(['고영운'], [
    { owner: '고영운', state: 'won', amount: 100 },
    { owner: '고영운', state: 'lost', amount: 80 },
    { owner: '고영운', state: 'open', amount: 300, risk: true },
    { owner: '고영운', state: 'open', amount: 200 }
  ], helpers);
  assert.deepEqual(rows[0], {
    name: '고영운', allCount: 4, wonCount: 1, wonAmount: 100,
    decidedCount: 2, lostCount: 1, conversionRate: 50,
    openCount: 2, openAmount: 500, weightedAmount: 250, riskCount: 1
  });
});

test('registered external rep remains visible before the first opportunity', () => {
  const [row] = ExternalPerformance.summarize(['고영운'], [], helpers);
  assert.equal(row.name, '고영운');
  assert.equal(row.allCount, 0);
  assert.equal(row.conversionRate, null);
});
