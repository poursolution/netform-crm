/* 계약완료 실적은 예상금액이 아니라 확정일과 won_amount만으로 계산한다. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ContractPerformance = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';

  function cleanDate(value) {
    if (!value) return '';
    const text = String(value);
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  function wonEventDate(deal) {
    const history = [];
    [deal && deal.stageHistory, deal && deal.stage_history].forEach(function (rows) {
      if (Array.isArray(rows)) history.push.apply(history, rows);
    });
    return history.map(function (event) {
      const target = String(event.to || event.after || event.new_stage || event.stage_code || '').toLowerCase();
      return target === 'won' || /수주\s*(?:성공|확정|완료)/.test(target)
        ? cleanDate(event.at || event.changed_at || event.created_at)
        : '';
    }).filter(Boolean).sort().pop() || '';
  }

  function dateOf(deal) {
    return cleanDate(deal && (
      deal.closed || deal.closed_at || deal.wonAt || deal.won_at || deal.contractCompletedAt ||
      deal.contract_completed_at
    )) || wonEventDate(deal);
  }

  function hasWonAmount(deal) {
    if (!deal) return false;
    const values = Object.prototype.hasOwnProperty.call(deal, 'won_amount')
      ? [deal.won_amount]
      : [deal.wonAmt, deal.wonAmount];
    return values.some(function (value) {
      return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
    });
  }

  function amountOf(deal) {
    if (!hasWonAmount(deal)) return 0;
    const values = Object.prototype.hasOwnProperty.call(deal, 'won_amount')
      ? [deal.won_amount]
      : [deal.wonAmt, deal.wonAmount];
    const value = values.find(function (item) {
      return item !== null && item !== undefined && item !== '' && Number.isFinite(Number(item));
    });
    return Math.max(0, Number(value) || 0);
  }

  function inPeriod(date, year, quarter) {
    if (!date) return false;
    if (String(year || '전체') !== '전체' && date.slice(0, 4) !== String(year)) return false;
    if (!Number(quarter || 0)) return true;
    return Math.ceil(Number(date.slice(5, 7)) / 3) === Number(quarter);
  }

  function summarize(deals, reps, options) {
    options = options || {};
    const won = typeof options.isWon === 'function' ? options.isWon : function (deal) {
      return String(deal && (deal.outcome || deal.code || deal.stage_code)).toLowerCase() === 'won';
    };
    const ownerOf = options.ownerOf || function (deal) { return String(deal && (deal.assignee || deal.owner_name) || ''); };
    const names = Array.isArray(reps) ? reps.slice() : [];
    const rows = new Map(names.map(function (name) {
      return [name, { name, count: 0, amount: 0, missingAmountCount: 0, deals: [] }];
    }));
    const undated = [];

    (deals || []).filter(won).forEach(function (deal) {
      const name = ownerOf(deal);
      if (names.length && !rows.has(name)) return;
      if (!rows.has(name)) rows.set(name, { name, count: 0, amount: 0, missingAmountCount: 0, deals: [] });
      const date = dateOf(deal);
      if (!date) { undated.push(deal); return; }
      if (!inPeriod(date, options.year, options.quarter)) return;
      const row = rows.get(name);
      row.count += 1;
      row.amount += amountOf(deal);
      row.deals.push(deal);
      if (!hasWonAmount(deal)) row.missingAmountCount += 1;
    });

    const list = Array.from(rows.values());
    return {
      rows: list,
      totalCount: list.reduce(function (sum, row) { return sum + row.count; }, 0),
      totalAmount: list.reduce(function (sum, row) { return sum + row.amount; }, 0),
      missingAmountCount: list.reduce(function (sum, row) { return sum + row.missingAmountCount; }, 0),
      missingDateCount: undated.length,
      undated
    };
  }

  return { cleanDate, dateOf, hasWonAmount, amountOf, inPeriod, summarize };
});
