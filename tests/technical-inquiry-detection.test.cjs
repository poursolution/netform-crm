'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function classifier(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const names = ['inquiryBrandOf', 'inquiryTextOf', 'isTechnicalInquiry'];
  const functions = names.map(name => {
    const match = source.match(new RegExp(`function ${name}\\(q\\)\\{[^\\n]+\\}`));
    assert.ok(match, `${file}: ${name} must exist`);
    return match[0];
  });
  const context = {};
  vm.runInNewContext(functions.join(';'), context);
  return context;
}

for (const file of ['crm.html']) {
  test(`${file} recognizes structured and raw-text technical inquiries`, () => {
    const { inquiryBrandOf, isTechnicalInquiry } = classifier(file);
    const rawTechnical = {
      brand: 'POUR솔루션',
      raw: { 문의내용: '도장공법에 대해 기술자문 문의주심.' }
    };
    assert.equal(inquiryBrandOf(rawTechnical), 'POUR솔루션');
    assert.equal(isTechnicalInquiry(rawTechnical), true);
    assert.equal(isTechnicalInquiry({ brand: 'POUR솔루션', business_type: '기술자문' }), true);
    assert.equal(isTechnicalInquiry({ brand: '기술자문', business_type: '견적문의' }), false);
    assert.equal(isTechnicalInquiry({ brand: '기술자문' }), true);
    assert.equal(isTechnicalInquiry({ brand: 'POUR솔루션', raw: { 문의내용: '옥상 방수 견적 요청' } }), false);
    assert.equal(isTechnicalInquiry({ brand: 'POUR솔루션', raw: { 문의내용: '기술자문 아님. 자재 견적 요청' } }), false);
  });
}
