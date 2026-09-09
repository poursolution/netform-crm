/* 외부 영업은 진행 건과 종료 판단 건을 분리해 전환율의 분모를 명확히 한다. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ExternalPerformance = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  function summarize(names, deals, helpers) {
    const ownerOf = helpers.ownerOf;
    const isOpen = helpers.isOpen;
    const isWon = helpers.isWon;
    const amountOf = helpers.amountOf;
    const weightedOf = helpers.weightedOf;
    const isRisk = helpers.isRisk;
    return (names || []).map(function (name) {
      const all = (deals || []).filter(function (deal) { return ownerOf(deal) === name; });
      const won = all.filter(isWon);
      const open = all.filter(isOpen);
      const decided = all.filter(function (deal) { return !isOpen(deal); });
      const lost = decided.filter(function (deal) { return !isWon(deal); });
      return {
        name,
        allCount: all.length,
        wonCount: won.length,
        wonAmount: won.reduce(function (total, deal) { return total + amountOf(deal); }, 0),
        decidedCount: decided.length,
        lostCount: lost.length,
        conversionRate: decided.length ? Math.round(won.length / decided.length * 100) : null,
        openCount: open.length,
        openAmount: open.reduce(function (total, deal) { return total + amountOf(deal); }, 0),
        weightedAmount: weightedOf(open),
        riskCount: open.filter(isRisk).length
      };
    });
  }

  return { summarize };
});
