/* 공사예정은 명시된 계획만 사용한다. 계약/착공/접촉 시점과 혼동하지 않는다. */
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
    const candidates = [
      deal.planned_construction_year,
      deal.construction_planned_year,
      deal.planned_construction_date,
      deal.construction_planned_at
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const year = validYear(candidates[i]);
      if (year) return { year, source: 'direct' };
    }
    const saved = String(fields(contexts, 'waiting').reason || '').match(/^공사예정 (20\d{2})년 · /);
    if (saved) return { year: saved[1], source: 'waiting' };
    const projected = String(deal.relate_planned_construction_year || '').trim();
    if (/^20[0-9]{2}$/.test(projected)) return { year: projected, source: 'relate_plan' };
    const originalFields = deal.list_fields || {};
    const importedYears = new Set();
    Object.values(originalFields).forEach(function (field) {
      if (!field || field.name !== '공사계획년도') return;
      const values = Array.isArray(field.value) ? field.value : [field.value];
      values.forEach(function (value) {
        if (/^20[0-9]{2}$/.test(String(value || '').trim())) importedYears.add(String(value).trim());
      });
    });
    if (importedYears.size === 1) return { year: Array.from(importedYears)[0], source: 'relate_plan' };
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
