/* 최초 유입과 현재 사업유형을 분리해 같은 영업기회를 두 관점으로 집계한다. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BusinessAttribution = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  function clean(value, fallback) {
    const text = String(value == null ? '' : value).trim();
    return text || fallback;
  }

  function originOf(deal) {
    return clean(deal && (deal.originBusiness || deal.origin_business),
      clean(deal && deal.brand, '미기록'));
  }

  function currentOf(deal) {
    return clean(deal && (deal.currentBusiness || deal.current_business),
      clean(deal && deal.brand, '미지정'));
  }

  function summarize(deals, helpers) {
    const target = helpers.target || '기술자문';
    const isWon = helpers.isWon;
    const isOpen = helpers.isOpen;
    const amountOf = helpers.amountOf;
    const wonAmountOf = helpers.wonAmountOf;
    const groups = new Map();

    (deals || []).forEach(function (deal) {
      const origin = originOf(deal);
      if (!groups.has(origin)) groups.set(origin, {
        origin, count: 0, amount: 0, convertedCount: 0, convertedAmount: 0,
        convertedOpenCount: 0, convertedOpenAmount: 0,
        convertedWonCount: 0, convertedWonAmount: 0, wonAmountMissingCount: 0
      });
      const row = groups.get(origin);
      const amount = Number(amountOf(deal) || 0);
      row.count += 1;
      row.amount += amount;
      if (currentOf(deal) !== target) return;
      row.convertedCount += 1;
      row.convertedAmount += amount;
      if (isOpen(deal)) {
        row.convertedOpenCount += 1;
        row.convertedOpenAmount += amount;
      }
      if (isWon(deal)) {
        const wonAmount = Number(wonAmountOf(deal) || 0);
        row.convertedWonCount += 1;
        row.convertedWonAmount += wonAmount;
        if (!wonAmount) row.wonAmountMissingCount += 1;
      }
    });

    return Array.from(groups.values()).sort(function (a, b) {
      return b.convertedAmount - a.convertedAmount || b.amount - a.amount || a.origin.localeCompare(b.origin, 'ko');
    });
  }

  return { originOf, currentOf, summarize };
});
