const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const pc = fs.readFileSync('crm.html', 'utf8');
const mobile = fs.readFileSync('mobile.html', 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

const deals = [
  {id: 'd-a1', site: '동명아파트', nm: '동명아파트', site_id: 'site-a', manager_mobile: '01012345678'},
  {id: 'd-a2', site: '동명아파트', nm: '동명아파트', site_id: 'site-a', manager_mobile: '01012345678'},
  {id: 'd-b', site: '동명아파트', nm: '동명아파트', site_id: 'site-b', manager_mobile: '01012345678'}
];

test('PC contact lookup keeps same-name Sites separate and deduplicates one Site ID', () => {
  const context = {
    B: {deals},
    phoneN: value => String(value || '').replace(/\D/g, ''),
    contactInfo: deal => ({mobile: deal.manager_mobile}),
    itemPatch: () => ({}),
    normSite: value => String(value || '').replace(/\s/g, ''),
    CleanupCore: {norm: value => String(value || '')},
    detailAddress: deal => deal.address || ''
  };
  vm.createContext(context);
  vm.runInContext(functionSource(pc, 'contactExistingDeals'), context);
  assert.deepEqual(Array.from(context.contactExistingDeals('010-1234-5678'), x => x.id), ['d-a1', 'd-b']);
});

test('mobile contact lookup uses the same Site identity rule', () => {
  const context = {
    DEALS: deals,
    phoneN: value => String(value || '').replace(/\D/g, ''),
    contactInfoM: deal => ({mobile: deal.manager_mobile}),
    normSiteM: value => String(value || '').replace(/\s/g, '')
  };
  vm.createContext(context);
  vm.runInContext(functionSource(mobile, 'contactDealsM'), context);
  assert.deepEqual(Array.from(context.contactDealsM('010-1234-5678'), x => x.id), ['d-a1', 'd-b']);
});

test('fallback person histories retain canonical Site IDs on both surfaces', () => {
  assert.match(functionSource(pc, 'contactHistoryHTML'), /site_id:d\.cleanup_site_id\|\|d\.site_id\|\|d\.siteId\|\|undefined/);
  assert.match(functionSource(mobile, 'contactHistoryM'), /site_id:x\.cleanup_site_id\|\|x\.site_id\|\|x\.siteId\|\|undefined/);
});
