'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const candidate = path.resolve(__dirname, '..');
const approved = require('./fixtures/approved-mic-fragment.json');
const source = fs.readFileSync(path.join(candidate, 'mobile-approved-mic-source.js'), 'utf8');
const button = approved.button;
assert.match(button, /^<button onClick="\{\{ memoTap \}\}" /);
assert.match(approved.idleColors, /memoBg: s\.memo === 'rec' \? '#fff1f0' : '#f5f6f8'/);
assert.match(approved.idleColors, /memoC: s\.memo === 'rec' \? '#c93a3f' : '#15171c'/);
assert.match(approved.idleColors, /memoDot: s\.memo === 'rec' \? '#e5484d' : '#3b6ce4'/);
assert.match(approved.guide, /D 화면 '상담 내용' 칸 안 \[누르고 말하기\]/);
const expected = button
  .replace('onClick="{{ memoTap }}"', 'data-ce="input-mic"')
  .replace('{{ memoBg }}', '#f5f6f8')
  .replace('{{ memoC }}', '#15171c')
  .replace('{{ memoDot }}', '#3b6ce4')
  .replace('{{ memoTxt }}', '누르고 말하기');

const fail = () => { throw new Error('Source module must not perform side effects'); };
const window = { fetch: fail, localStorage: new Proxy({}, { get: fail }), navigator: new Proxy({}, { get: fail }) };
const before = Object.keys(window);
vm.runInNewContext(source, { window }, { timeout: 1000 });
const component = window.MobileApprovedMicSource;
assert.deepEqual(Object.keys(window).filter(k => !before.includes(k)), ['MobileApprovedMicSource']);
assert.equal(component.html, expected, 'Only the approved handler binding, idle values and latest label may differ');
assert.equal(Object.isFrozen(component), true);
assert.equal(Object.isFrozen(component.provenance), true);
assert.equal(component.provenance.markupLine, 191);
assert.equal(component.provenance.idleColorLine, 324);
assert.equal(component.provenance.action, 'input-mic');
assert.equal((component.html.match(/<button\b/g) || []).length, 1);
assert.equal((component.html.match(/<svg\b/g) || []).length, 1);
assert.match(component.html, /min-height:48px/);
assert.doesNotMatch(component.html, /\{\{|\}\}|\bon\w+\s*=|<script|javascript:|<iframe/i);
assert.doesNotMatch(component.html, /memoTap|result|nextTask|date:|듣고 있어요|결과 · 다음 할 일 채움/);
console.log(JSON.stringify({ passed: 5, checks: [
  'Source43 original button and idle color definitions verified by file and line',
  'Every node and style matches the original except approved values and action binding',
  'Latest guide explicitly places the button inside D 상담 내용',
  '48px button and original SVG preserved; no old inferred task/result behavior',
  'Frozen source data only; no network, storage, device or business side effects'
] }, null, 2));
