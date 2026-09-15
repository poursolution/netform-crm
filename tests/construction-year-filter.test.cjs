const test = require('node:test');
const assert = require('node:assert/strict');
const ConstructionYear = require('../construction-year.js');

test('operational projection survives the PC bundle adapter into year filters', () => {
  const overlay = require('../operational-overlay.js');
  const bundle = overlay.shell({deals:[{id:'fixture',site_name:'테스트 현장',stage_code:'waiting',relate_planned_construction_year:'2024'}]});
  assert.equal(bundle.deals[0].relate_planned_construction_year,'2024');
  assert.equal(ConstructionYear.yearOf(bundle.deals[0]),'2024');
  assert.equal(ConstructionYear.matches(bundle.deals[0],'2024'),true);
  assert.ok(ConstructionYear.options(bundle.deals,2026).includes('2024'));
});

test('Relate named plan field preserves historical years without guessing opaque IDs', () => {
  assert.deepEqual(ConstructionYear.valueOf({relate_planned_construction_year:'2023'}), {year:'2023',source:'relate_plan'});
  const field = value => ({ arbitraryId: { name: '공사계획년도', value } });
  assert.deepEqual(ConstructionYear.valueOf({list_fields:field('2024')}), {year:'2024',source:'relate_plan'});
  assert.equal(ConstructionYear.yearOf({list_fields:field(['2024','2025'])}), '미입력');
  assert.equal(ConstructionYear.yearOf({list_fields:{x:{name:'계약년도',value:'2024'}}}), '미입력');
  assert.equal(ConstructionYear.yearOf({list_fields:field('2024~2025')}), '미입력');
});

test('does not infer a plan from actual construction or contract dates', () => {
  const deal = {
    stageContexts: {
      construction: { fields: { start_date: '2028-03-04' } },
      contract: { fields: { contract_date: '2027-12-20' } },
      imminent: { fields: { expected_contract: '2027-10-01' } }
    }
  };
  assert.deepEqual(ConstructionYear.valueOf(deal), { year: '', source: 'missing' });
});

test('rejects unrelated dates and ambiguous first-contact timing', () => {
  for (const deal of [
    { contract_date: '2024-01-01', start_date: '2025-01-01' },
    { construction_started_at: '2025-01-01', constructionStart: '2025-01-01' },
    { stage_contexts: { contract: { fields: { contract_date: '2027-05-01' } } } },
    { stageContexts: { imminent: { fields: { expected_contract: '2029-01-09' } } } },
    { stageContexts: { first_contact: { fields: { expected_timing: '2030년 상반기 예정' } } } }
  ]) assert.equal(ConstructionYear.yearOf(deal), '미입력');
});

test('explicit plan and saved follow-up plan use the same resolver', () => {
  const deal = { stage_contexts: { waiting: { fields: { reason: '공사예정 2031년 · 예산 편성 대기' } } } };
  assert.deepEqual(ConstructionYear.valueOf(deal), { year: '2031', source: 'waiting' });
  assert.equal(ConstructionYear.matches(deal, '2031'), true);
  assert.equal(ConstructionYear.valueOf({ ...deal, planned_construction_year: '2028' }).year, '2028');
  for (const key of ['planned_construction_year', 'construction_planned_year', 'planned_construction_date', 'construction_planned_at']) {
    assert.equal(ConstructionYear.yearOf({ [key]: '2023-05-01' }), '2023');
  }
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
    ConstructionYear.options([{ planned_construction_year: '2025' }, { planned_construction_date: '2031-02-01' }], '2026'),
    ['전체', '2025', '2026', '2027', '2028', '2031', '미입력']
  );
});
