const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');

test('salesperson flow shows confirmed won amount instead of near-stage pipeline amount',()=>{
  assert.match(html,/repFlowDataBeforeWonAmountFix[\s\S]*r\.wonDeals=r\.deals\.filter[\s\S]*r\.wonAmount=sumBy\(r\.wonDeals,wonAmt\)/);
  assert.match(html,/function repManagerFlowRow\(r,i\)[^\n]+<span>확정 수주<\/span><b>'\+eok\(r\.wonAmount\)/);
  assert.doesNotMatch(html,/function repManagerFlowRow\(r,i\)[^\n]+<span>경쟁 이후<\/span><b>'\+eok\(r\.near\)/);
  assert.match(html,/head\[3\]\.textContent='계약완료 실적'/);
});

test('salesperson coaching drawer uses the same confirmed won amount',()=>{
  assert.match(html,/repManagerOpenDrawerBeforeWonAmountFix[\s\S]*<span>계약완료 · 확정금액<\/span><b>'\+eok\(r\.wonAmount\)/);
  assert.match(html,/계약완료 근거 현장/);
});
