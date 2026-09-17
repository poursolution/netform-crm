const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('crm.html','utf8');
const evidence=require('../site-address-evidence.js');

assert.match(html,/siteAddress:'전체'/);
assert.match(html,/s\.canonicalAddress=x&&x\.address/);
assert.match(html,/G\.siteAddress==='완료'&&!!s\.canonicalAddress/);
assert.match(html,/G\.siteAddress==='후보'&&!s\.canonicalAddress&&!!s\.addressSuggestion/);
assert.match(html,/G\.siteAddress==='미입력'&&!s\.canonicalAddress&&!s\.addressSuggestion/);
assert.match(html,/SiteAddressEvidence\.suggest\(s\.addresses\)/);
assert.match(html,/site-address-evidence\.js/);
assert.match(html,/addressMissing=all\.length-addressDone-addressCandidates/);
assert.match(html,/canonical 주소 '\+addressDone\+' \/ '\+all\.length\+' · 확인 후보 '\+addressCandidates\+' · 미입력 '\+addressMissing/);
assert.match(html,/주소상태<select onchange="G\.siteAddress=this\.value/);
assert.match(html,/주소 확인 후보 · /);
assert.match(html,/blob=\[s\.name,s\.canonicalAddress\|\|''/);
assert.match(html,/canonical Site 주소 입력 진행률/);

assert.equal(evidence.suggest(['경기 수원시 팔달구 1','경기  수원시 팔달구 1']), '경기 수원시 팔달구 1');
assert.equal(evidence.suggest(['경기 수원시 팔달구 1','경기 수원시, 팔달구 1']), '경기 수원시, 팔달구 1');
assert.equal(evidence.suggest(['경기 수원시 팔달구 1','경기 용인시 수지구 1']), '');
assert.equal(evidence.suggest(['','미입력']), '');

console.log('PASS customer assets expose canonical Site address progress and filtering');
