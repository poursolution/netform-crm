const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('mobile.html', 'utf8');
const start = source.indexOf('function saveManagerMoveM(');
const end = source.indexOf('\nfunction ', start + 1);
const fn = source.slice(start, end);

test('mobile manager move never copies a contact to a Deal found by Site name', () => {
  assert.notEqual(start, -1);
  assert.doesNotMatch(fn, /DEALS\.filter/);
  assert.doesNotMatch(fn, /target\.contact|target\.manager_mobile/);
  assert.match(fn, /canonical Site 연결을 확인/);
});

test('mobile manager move closes only one exact source Site history', () => {
  assert.match(fn, /sourceSiteId=String\(d\.site_id\|\|d\.siteId\|\|''\)/);
  assert.match(fn, /sourceSiteId\?hid===sourceSiteId/);
  assert.match(fn, /sourceHistory\.length===1/);
  assert.match(fn, /site_id:sourceSiteId\|\|undefined/);
});

test('mobile destination remains review-required until a canonical Site is chosen', () => {
  assert.match(fn, /site_link_status:'review_required'/);
  assert.match(fn, /p\.linkWarning=/);
  assert.match(fn, /pushWrite\('contact_move'/);
  assert.doesNotMatch(fn, /site_id:[^,}]*to/);
});
