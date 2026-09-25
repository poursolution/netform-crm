const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const crm = fs.readFileSync(path.join(__dirname, '..', 'crm.html'), 'utf8');

test('관리자 견적문의 기본 표는 가로 1310px 강제폭 없이 핵심 6열만 쓴다', () => {
  assert.doesNotMatch(crm, /\.inq-ctl-row\{[^}]*min-width:1310px/);
  assert.match(crm, /\.inq-ctl-row\{grid-template-columns:40px 78px minmax\(250px,1\.7fr\)[^}]*min-width:0/);
  assert.match(crm, /현장·문의정보/);
  assert.match(crm, /연락·상태·다음 할 일/);
});

test('공종과 상담담당은 삭제하지 않고 현장 보조정보로 합친다', () => {
  assert.match(crm, /siteMeta=\[inqCtlContactLabel\(q\),q\.brand\|\|'사업유형 미지정',work,consultant\?'상담 '\+consultant:''\]/);
  assert.match(crm, /inq-ctl-state-stack/);
  assert.match(crm, /inqCtlOpenSingle\(this\.dataset\.k\)/);
});
