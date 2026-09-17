const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('crm.html', 'utf8');

function functionSource(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, name + ' function should exist');
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

test('dashboard inquiry conversion counts explicit lineage only', () => {
  const inquiries = [
    { id: 'q-linked', site: '동명아파트', assignee: '담당' },
    { id: 'q-same-name', site: '동명아파트', assignee: '담당' }
  ];
  const deals = [
    { id: 'd-linked', site: '동명아파트', origin_inquiry_id: 'q-linked', won: true },
    { id: 'd-unrelated', site: '동명아파트', won: true }
  ];
  const context = {
    B: { deals },
    inqBase: () => inquiries,
    repN: value => value,
    inqKey: inquiry => inquiry.id,
    isWon: deal => deal.won === true
  };

  vm.createContext(context);
  vm.runInContext(
    functionSource('inquiryDealRefs') + '\n' +
    functionSource('dealInquiryRefs') + '\n' +
    functionSource('linkedDeal') + '\n' +
    functionSource('inqMadeStats'),
    context
  );

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.inqMadeStats())),
    { _n: 2, _made: 1, '담당': { n: 2, made: 1, won: 1 } }
  );
});

test('dashboard explains the explicit inquiry ID basis', () => {
  assert.match(source, /원본 문의 ID 기준으로 Pipeline과 연결/);
  assert.doesNotMatch(functionSource('inqMadeStats'), /normSite/);
});

test('connection diagnostics use the live operational read and write paths', () => {
  const start = source.indexOf('async function runOperationalDiag');
  const operational = source.slice(start, source.indexOf('\nasync function runDiag', start));
  assert.match(functionSource('runDiag'), /return runOperationalDiag\(box\)/);
  assert.match(operational, /crm_read_scoped_v2 · deal_core \+ inquiry_core/);
  assert.match(operational, /LAST_OPERATIONAL_READ_ERROR/);
  assert.match(operational, /crm_write_command_v2 · 사용자별 멱등 명령 큐/);
  assert.doesNotMatch(operational, /crm_read_bundle|기존 n8n 유지/);
});
