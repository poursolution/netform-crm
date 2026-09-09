const test = require('node:test');
const assert = require('node:assert/strict');
const ConstructionYear = require('../construction-year.js');

test('prefers the actual construction date over earlier planning evidence', () => {
  const deal = {
    stageContexts: {
      construction: { fields: { start_date: '2028-03-04' } },
      contract: { fields: { contract_date: '2027-12-20' } },
      imminent: { fields: { expected_contract: '2027-10-01' } }
    }
  };
  assert.deepEqual(ConstructionYear.valueOf(deal), { year: '2028', source: 'construction' });
});

test('falls back through contract, imminent, and first-contact evidence', () => {
  assert.equal(ConstructionYear.yearOf({ stage_contexts: { contract: { fields: { contract_date: '2027-05-01' } } } }), '2027');
  assert.equal(ConstructionYear.yearOf({ stageContexts: { imminent: { fields: { expected_contract: '2029-01-09' } } } }), '2029');
  assert.equal(ConstructionYear.yearOf({ stageContexts: { first_contact: { fields: { expected_timing: '2030년 상반기 예정' } } } }), '2030');
});

test('keeps missing schedule data visible as a first-class filter', () => {
  const missing = { site: '일정 미확인 현장' };
  assert.equal(ConstructionYear.yearOf(missing), '미입력');
  assert.equal(ConstructionYear.matches(missing, '미입력'), true);
  assert.equal(ConstructionYear.matches(missing, '2027'), false);
  assert.equal(ConstructionYear.matches(missing, '전체'), true);
});

test('options include actual years, the planning horizon, and missing', () => {
  assert.deepEqual(
    ConstructionYear.options([{ start_date: '2025-04-01' }, { contract_date: '2031-02-01' }], '2026'),
    ['전체', '2025', '2026', '2027', '2028', '2031', '미입력']
  );
});
