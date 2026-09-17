const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('mobile.html', 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is incomplete`);
}

function harness(seed = {}) {
  let stored = JSON.stringify(seed);
  const context = {
    PERSON_KEY: 'nf_mobile_people_v1',
    Phase1: {storage: {getItem: () => stored, setItem: (_key, value) => { stored = value; }}},
    normSiteM: value => String(value || '').replace(/\s+/g, '').toLowerCase(),
    isoNow: () => '2026-09-17T06:00:00.000Z'
  };
  vm.createContext(context);
  vm.runInContext(`${functionSource('peopleM')};${functionSource('savePeopleM')};${functionSource('upsertPersonM')}`, context);
  return {context, read: () => JSON.parse(stored)};
}

test('mobile contact history stores the canonical Site ID', () => {
  const h = harness();
  h.context.upsertPersonM({personKey: 'mobile:01012345678', name: '김소장'}, '한빛아파트', '0311234567', '2026-09-17', 'site-a');
  assert.equal(h.read()['mobile:01012345678'].history[0].site_id, 'site-a');
});

test('mobile promotes one legacy name-only history but never ambiguous rows', () => {
  const key = 'mobile:01012345678';
  const unique = harness({[key]: {history: [{site: '한빛아파트', from: '2024-01-01', to: ''}]}});
  unique.context.upsertPersonM({personKey: key}, '한빛아파트', '', '2026-09-17', 'site-a');
  assert.equal(unique.read()[key].history.length, 1);
  assert.equal(unique.read()[key].history[0].site_id, 'site-a');

  const ambiguous = harness({[key]: {history: [{site: '한빛아파트', from: '2023-01-01', to: ''}, {site: '한빛아파트', from: '2024-01-01', to: ''}]}});
  ambiguous.context.upsertPersonM({personKey: key}, '한빛아파트', '', '2026-09-17', 'site-b');
  const rows = ambiguous.read()[key].history;
  assert.equal(rows.length, 3);
  assert.equal(rows[0].site_id, undefined);
  assert.equal(rows[1].site_id, undefined);
  assert.equal(rows[2].site_id, 'site-b');
});

test('mobile final contact save passes the Deal Site ID and new Deals do not inherit by name', () => {
  assert.match(source, /upsertPersonM\(\{name:name,mobile:mobile,personKey:key\},d\.nm,office,at,d\.site_id\|\|d\.siteId\|\|''\)/);
  assert.doesNotMatch(source, /site_id:sameSite&&sameSite\.site_id\|\|null/);
  assert.match(source, /var nd=normalizeDeal\(\{id:'new-'\+Date\.now\(\),site_id:null/);
});
