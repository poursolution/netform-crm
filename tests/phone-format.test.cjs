const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function formatter(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const phoneN = source.match(/function phoneN\(v\)\{[^\n]+\}/);
  const phoneFmt = source.match(/function phoneFmt\(v\)\{[^\n]+\}/);
  assert.ok(phoneN && phoneFmt, `${file}: phone helpers must exist`);
  const context = {};
  vm.runInNewContext(`${phoneN[0]};${phoneFmt[0]}`, context);
  return context.phoneFmt;
}

for (const file of [
  'crm.html',
  'mobile.html',
  'staging-operational-full/crm.html',
  'staging-operational-full/mobile.html',
]) {
  test(`${file} displays Korean phone numbers consistently`, () => {
    const format = formatter(file);
    assert.equal(format('+821027463347'), '010-2746-3347');
    assert.equal(format('01027463347'), '010-2746-3347');
    assert.equal(format('010-2746-3347'), '010-2746-3347');
  });
}
