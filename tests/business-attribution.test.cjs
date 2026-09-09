const test = require('node:test');
const assert = require('node:assert/strict');
const Attribution = require('../business-attribution.js');

const helpers = {
  target: '기술자문',
  isOpen: deal => deal.state === 'open',
  isWon: deal => deal.state === 'won',
  amountOf: deal => deal.won_amount || deal.amount || deal.quote_amount || 0,
  wonAmountOf: deal => deal.won_amount || 0
};

test('ASQ origin remains attributed after the current business becomes technical advisory', () => {
  const rows = Attribution.summarize([
    { origin_business: '아파트스퀘어', current_business: '기술자문', state: 'open', amount: 100 },
    { originBusiness: '아파트스퀘어', currentBusiness: '기술자문', state: 'won', amount: 90, won_amount: 70 },
    { originBusiness: '아파트스퀘어', currentBusiness: '아파트스퀘어', state: 'open', amount: 30 },
    { originBusiness: '기술자문', currentBusiness: '기술자문', state: 'open', amount: 20 }
  ], helpers);
  const asq = rows.find(row => row.origin === '아파트스퀘어');
  assert.deepEqual(asq, {
    origin: '아파트스퀘어', count: 3, amount: 200,
    convertedCount: 2, convertedAmount: 170,
    convertedOpenCount: 1, convertedOpenAmount: 100,
    convertedWonCount: 1, convertedWonAmount: 70, wonAmountMissingCount: 0
  });
});

test('actual won attribution never guesses from expected amount', () => {
  const [row] = Attribution.summarize([
    { brand: '아파트스퀘어', current_business: '기술자문', state: 'won', amount: 500 }
  ], helpers);
  assert.equal(row.convertedAmount, 500);
  assert.equal(row.convertedWonAmount, 0);
  assert.equal(row.wonAmountMissingCount, 1);
});
