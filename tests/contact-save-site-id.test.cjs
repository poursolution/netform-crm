const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('crm.html', 'utf8');

test('existing Deal contact saves pass canonical Site ID into person history', () => {
  const calls = source.match(/upsertPerson\(c,item\.site,office,at,item\.cleanup_site_id\|\|item\.site_id\|\|item\.siteId\|\|' '\)/g) || [];
  assert.equal(calls.length, 0, 'guard against an accidental spaced empty fallback');
  const exact = source.match(/upsertPerson\(c,item\.site,office,at,item\.cleanup_site_id\|\|item\.site_id\|\|item\.siteId\|\|''\)/g) || [];
  assert.equal(exact.length, 4);
});

test('new Deal creation remains unlinked until a canonical Site exists', () => {
  assert.match(source, /upsertPerson\(contact,site,officeTel,at\)/);
});
