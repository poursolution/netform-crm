const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('crm.html', 'utf8');
const start = source.indexOf('function saveManagerMove(');
const end = source.indexOf('\nfunction ', start + 1);
const fn = source.slice(start, end);

test('manager move never copies a contact to a Deal selected by Site name', () => {
  assert.notEqual(start, -1);
  assert.doesNotMatch(fn, /\(B\.deals\|\|\[\]\)\.filter/);
  assert.doesNotMatch(fn, /target\.contact|tp\.contact/);
  assert.match(fn, /현장 연결을 확인/);
});

test('manager move still preserves the source history and queues the audited command', () => {
  assert.match(fn, /person\.history\.push/);
  assert.match(fn, /pushWrite\('contact_move'/);
  assert.match(fn, /기존 현장 기록은 유지/);
});
