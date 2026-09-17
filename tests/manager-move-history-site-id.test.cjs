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

test('person history accepts and preserves a canonical Site ID', () => {
  const fn = functionSource('upsertPerson');
  assert.match(fn, /siteId/);
  assert.match(fn, /site_id:sid\|\|undefined/);
  assert.match(fn, /same\.site_id=sid/);
  assert.match(fn, /cur=sid\?null:/);
});

test('one legacy name-only history is promoted without creating a duplicate', () => {
  const people = {
    person: {
      id: 'person',
      name: '김소장',
      mobile: '01012345678',
      role: '관리소장',
      currentSite: '동명아파트',
      history: [{ site: '동명아파트', from: '2024-01-01', to: '', status: 'current' }]
    }
  };
  const context = {
    peopleStore: () => people,
    normSite: value => String(value || '').replace(/\s/g, ''),
    isoNow: () => '2026-09-17T00:00:00Z'
  };
  vm.createContext(context);
  vm.runInContext(functionSource('upsertPerson'), context);
  context.upsertPerson(
    { personKey: 'person', name: '김소장', mobile: '01012345678', role: '관리소장' },
    '동명아파트',
    '0311234567',
    '2026-09-17T00:00:00Z',
    'site-a'
  );
  assert.equal(people.person.history.length, 1);
  assert.equal(people.person.history[0].site_id, 'site-a');
});

test('ambiguous legacy histories are not silently assigned to a Site ID', () => {
  const histories = [
    { site: '동명아파트', from: '2024-01-01', to: '', status: 'current' },
    { site: '동명아파트', from: '2025-01-01', to: '', status: 'current' }
  ];
  const people = { person: { id: 'person', history: histories } };
  const context = {
    peopleStore: () => people,
    normSite: value => String(value || '').replace(/\s/g, ''),
    isoNow: () => '2026-09-17T00:00:00Z'
  };
  vm.createContext(context);
  vm.runInContext(functionSource('upsertPerson'), context);
  context.upsertPerson({ personKey: 'person' }, '동명아파트', '', '2026-09-17T00:00:00Z', 'site-a');
  assert.equal(histories[0].site_id, undefined);
  assert.equal(histories[1].site_id, undefined);
  assert.equal(people.person.history.filter(history => history.site_id === 'site-a').length, 1);
  assert.equal(people.person.history.length, 3);
});

test('manager move closes only one exact source Site history', () => {
  const fn = functionSource('saveManagerMove');
  assert.match(fn, /sourceSiteId=item\.cleanup_site_id\|\|item\.site_id\|\|item\.siteId/);
  assert.match(fn, /String\(hid\)===String\(sourceSiteId\)/);
  assert.match(fn, /sourceHistory\.length===1/);
  assert.match(fn, /site_link_status:'review_required'/);
  assert.doesNotMatch(fn, /history\.forEach\(function\(h\)\{if\(!h\.to&&normSite/);
});
