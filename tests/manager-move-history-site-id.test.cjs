const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

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

test('manager move closes only one exact source Site history', () => {
  const fn = functionSource('saveManagerMove');
  assert.match(fn, /sourceSiteId=item\.cleanup_site_id\|\|item\.site_id\|\|item\.siteId/);
  assert.match(fn, /String\(hid\)===String\(sourceSiteId\)/);
  assert.match(fn, /sourceHistory\.length===1/);
  assert.match(fn, /site_link_status:'review_required'/);
  assert.doesNotMatch(fn, /history\.forEach\(function\(h\)\{if\(!h\.to&&normSite/);
});
