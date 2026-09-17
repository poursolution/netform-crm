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

function pcLink(deal, inquiries) {
  const context = {B: {inquiries}};
  vm.createContext(context);
  vm.runInContext(functionSource(pc, 'inqOfDeal'), context);
  return JSON.parse(JSON.stringify(context.inqOfDeal(deal)));
}

test('Deal inquiry linkage prefers explicit lineage and reverse Deal references', () => {
  const inquiries = [
    {id: 'q-origin', site: '다른 표기'},
    {id: 'q-reverse', opportunity_id: 'd-2'},
    {id: 'q-site', site_id: 'site-a'}
  ];
  assert.deepEqual(pcLink({id: 'd-1', origin_inquiry_id: 'q-origin', site_id: 'site-a'}, inquiries).map(x => x.id), ['q-origin']);
  assert.deepEqual(pcLink({id: 'd-2'}, inquiries).map(x => x.id), ['q-reverse']);
});

test('canonical Site ID can collect Site inquiries but equal names alone cannot', () => {
  const inquiries = [
    {id: 'q-a', site: '동명아파트', site_id: 'site-a'},
    {id: 'q-b', site: '동명아파트', site_id: 'site-b'},
    {id: 'q-name', site: '동명아파트'}
  ];
  assert.deepEqual(pcLink({id: 'd-a', site: '동명아파트', site_id: 'site-a'}, inquiries).map(x => x.id), ['q-a']);
  assert.deepEqual(pcLink({id: 'd-unlinked', site: '동명아파트'}, inquiries), []);
});

test('mobile response timeline has the same canonical-only linkage order', () => {
  const fn = functionSource(mobile, 'respOf');
  assert.match(fn, /originInquiryId\|\|d\.origin_inquiry_id/);
  assert.match(fn, /q\.opportunity_id\|\|q\.deal_id/);
  assert.match(fn, /d\.cleanup_site_id\|\|d\.site_id\|\|d\.siteId/);
  assert.doesNotMatch(fn, /q\.site&&q\.site===d\.nm/);
});
