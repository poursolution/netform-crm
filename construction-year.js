/* 공사 예정연도는 별도 임시값을 만들지 않고 이미 저장된 단계 근거에서 파생한다. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ConstructionYear = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  function fields(contexts, key) {
    const context = contexts && contexts[key];
    return context && typeof context === 'object'
      ? (context.fields && typeof context.fields === 'object' ? context.fields : context)
      : {};
  }

  function validYear(value) {
    const match = String(value == null ? '' : value).match(/(?:^|[^0-9])(20[0-9]{2})(?:[^0-9]|$)/);
    return match ? match[1] : '';
  }

  function valueOf(deal) {
    deal = deal || {};
    const contexts = deal.stageContexts || deal.stage_contexts || {};
    const construction = fields(contexts, 'construction');
    const contract = fields(contexts, 'contract');
    const imminent = fields(contexts, 'imminent');
    const firstContact = fields(contexts, 'first_contact');
    const candidates = [
      deal.planned_construction_year,
      deal.construction_planned_year,
      deal.planned_construction_date,
      deal.construction_planned_at,
      deal.construction_started_at,
      deal.constructionStart,
      deal.start_date,
      construction.start_date,
      deal.contract_date,
      contract.contract_date,
      imminent.expected_contract,
      firstContact.expected_timing
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const year = validYear(candidates[i]);
      if (year) return { year, source: i < 5 ? 'direct' : i < 8 ? 'construction' : i < 10 ? 'contract' : i === 10 ? 'imminent' : 'first_contact' };
    }
    return { year: '', source: 'missing' };
  }

  function yearOf(deal) {
    return valueOf(deal).year || '미입력';
  }

  function matches(deal, selected) {
    return !selected || selected === '전체' || yearOf(deal) === String(selected);
  }

  function options(deals, currentYear) {
    const years = new Set();
    (deals || []).forEach(function (deal) {
      const year = valueOf(deal).year;
      if (year) years.add(year);
    });
    const now = Number(currentYear) || new Date().getFullYear();
    [now, now + 1, now + 2].forEach(function (year) { years.add(String(year)); });
    return ['전체'].concat(Array.from(years).sort()).concat(['미입력']);
  }

  return { fields, validYear, valueOf, yearOf, matches, options };
});
