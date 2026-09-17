const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const adapter = require('../operational-adapter.js');

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

test('live PC contact commands carry the canonical Site ID', () => {
  const moduleSource = fs.readFileSync('pc-primary-contact.js', 'utf8');
  const calls = moduleSource.match(/site_id:item\.cleanup_site_id\|\|item\.site_id\|\|item\.siteId\|\|null/g) || [];
  assert.equal(calls.length, 2);
});

test('contact command contract preserves a valid Site ID and rejects an invalid one', () => {
  const dealId = '11111111-1111-4111-8111-111111111111';
  const siteId = '22222222-2222-4222-8222-222222222222';
  const payload = {opportunity_id: dealId, site_id: siteId, person_key: 'mobile:01012345678', site_name: '한빛아파트', manager_name: '김소장', manager_mobile: '01012345678', manager_role: '관리소장'};
  assert.equal(adapter.normalize('contact_upsert', dealId, 0, payload).payload.site_id, siteId);
  assert.throws(() => adapter.normalize('contact_upsert', dealId, 0, {...payload, site_id: 'same-name-only'}), /INVALID_CONTACT_PAYLOAD/);
});
