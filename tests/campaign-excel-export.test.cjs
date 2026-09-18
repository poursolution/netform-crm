const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Exporter=require('../campaign-excel-export.js');

test('campaign Excel CSV keeps Korean, leading-zero phones, and neutralizes formulas',()=>{
  const out=Exporter.csv([{key:'name',label:'고객명'},{key:'phone',label:'휴대전화'}],[{name:'=HYPERLINK("bad")',phone:"'01012345678"}]);
  assert.ok(out.startsWith('\ufeff'));
  assert.match(out,/고객명/);
  assert.match(out,/"'=HYPERLINK/);
  assert.match(out,/01012345678/);
});

test('CRM exposes admin-only Lunar New Year history export with stage and owner filters',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
  assert.match(html,/campaignStage:'전체'/);
  assert.match(html,/파이프라인 단계/);
  assert.match(html,/function campaignHistoryTargets\(/);
  assert.match(html,/ME&&ME\.role==='admin'/);
  assert.match(html,/설 명절 엑셀 내보내기/);
  assert.match(html,/운영단계\(7단계\)/);
  assert.match(html,/발송대표여부/);
  assert.match(html,/동일번호 이력수/);
});
