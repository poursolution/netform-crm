const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('crm.html', 'utf8');

test('inquiry assignee count excludes closed inquiries like the active inquiry total', () => {
  const start = html.indexOf('inqBase=function(withRep,withClosed)');
  const end = html.indexOf('\ninqBrandChips=', start);
  assert.ok(start >= 0 && end > start, 'inqBase source must exist');
  const source = html.slice(start, end);

  assert.match(source, /withClosed\|\|!isClosedInq\(q\)\|\|INQ_STORE_STATUSES\.includes/);
});

test('production shell keeps the inquiry count asset and a current build cache key', () => {
  const index = fs.readFileSync('index.html', 'utf8');
  assert.match(index, /APP_BUILD\s*=\s*'20260913-[^']+'/);
  assert.match(html, /inquiry-workbench\.js\?v=20260913-inquiry-count-1/);
});
