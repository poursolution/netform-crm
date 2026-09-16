const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('crm.html','utf8');

assert.match(html,/siteAddress:'전체'/);
assert.match(html,/s\.canonicalAddress=x&&x\.address/);
assert.match(html,/G\.siteAddress==='완료'&&!!s\.canonicalAddress/);
assert.match(html,/G\.siteAddress==='미입력'&&!s\.canonicalAddress/);
assert.match(html,/canonical 주소 '\+addressDone\+' \/ '\+all\.length\+' · 미입력 '\+addressMissing/);
assert.match(html,/주소상태<select onchange="G\.siteAddress=this\.value/);
assert.match(html,/esc\(s\.canonicalAddress\|\|'주소 미입력'\)/);
assert.match(html,/canonical Site 주소 입력 진행률/);

console.log('PASS customer assets expose canonical Site address progress and filtering');
