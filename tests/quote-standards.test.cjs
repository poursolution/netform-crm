'use strict';
/* 원가 기준 읽기 · 비교 · 승인 점검 · 견적 적용 — 실제 파일(조달청 제비율 2026.04.13 · 임금실태 조사표 2026 하반기 · 통합관리표 단가표(개인) 2026.08.12)에서 뽑은 칸으로 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const S=require('../quote-standards.js'),C=require('../quote-calc.js');
const fx=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',n),'utf8'));
const rates=S.parseCostRates(fx('cost-rates-cells-20260413.json').cells),wage=S.parseWageRows(fx('wage-2026h2-items.json')),mat=S.parseMaterialPrices(fx('material-prices-cells-20260812.json').cells);
const one=(arr,f)=>arr.find(f);
test('원가 요율: 적용시기와 원가계산서 요율이 파일 값 그대로(분수)',()=>{
 assert.equal(rates.effective_from,'2026-04-13');assert.match(rates.source,/조달청 간접공사비\(제비율\) 적용기준 · 적용시기 : 2026\. 04\. 13/);
 const g=(item,tier)=>one(rates.items,i=>i.item===item&&i.tier===(tier||''));
 assert.equal(g('간접노무비','10억 미만|6개월 이하').rate,0.175);assert.equal(g('간접노무비','10억 미만|36개월 초과').rate,0.194);assert.equal(g('기타경비','10억 미만|6개월 이하').rate,0.05);
 assert.equal(g('산재보험료').rate,0.0356);assert.equal(g('건강보험료').rate,0.03595);assert.equal(g('연금보험료').rate,0.0475);assert.equal(g('노인장기요양보험료').rate,0.1314);assert.equal(g('노인장기요양보험료').base_of,'건강보험료');
 assert.equal(g('석면분담금').rate,0.00006);assert.equal(g('임금채권부담금').rate,0.0009);assert.equal(g('퇴직공제부금비').rate,0.023);
 assert.equal(g('환경보전비','조경, 기타(전문, 개보수 공사)').rate,0.003);assert.equal(g('산업안전보건관리비','5억미만|건축공사').rate,0.0311);
 const s2=g('산업안전보건관리비','5억~50억미만|건축공사');assert.deepEqual([s2.rate,s2.fixed_amount],[0.0228,4325000]);
 assert.equal(rates.items.filter(i=>i.item==='간접노무비').length,20);
});
test('고용보험료 요율은 파일에 숫자가 없다 — 지어내지 않고 직접 입력으로 표시',()=>{
 const e=one(rates.items,i=>i.item==='고용보험료');assert.deepEqual([e.rate,e.manual],[null,true]);
 assert.ok(rates.items.filter(i=>i.manual).length===1);
});
test('노임: 공표일 4열 · 번호 · 직종 — 별표 직종과 값 없음(-)도 읽는다',()=>{
 assert.deepEqual(wage.dates,['2026-09-01','2026-01-01','2025-09-01','2025-01-01']);assert.equal(wage.rows.length,132);
 const w=n=>one(wage.rows,r=>r.trade===n);
 assert.deepEqual([w('특별인부').trade_no,w('특별인부').wages['2026-09-01'],w('특별인부').wages['2026-01-01']],['1003',228717,226122]);
 assert.deepEqual([w('보통인부').wages['2026-09-01'],w('보통인부').wages['2026-01-01']],[172698,172068],'솔밭 견적서 2026.1.1 = 226,122 · 172,068');
 assert.equal(w('방수공').wages['2026-09-01'],233163);assert.deepEqual([w('제도사').mark,w('제도사').wages['2026-09-01']],['*',242423]);
 assert.deepEqual([w('지붕잇기공').mark,w('지붕잇기공').wages['2026-09-01'],w('지붕잇기공').wages['2026-01-01']],['**',null,233250]);
 const rows=S.wageToRows(wage,'임금실태 조사표');assert.ok(rows.every(r=>r.daily_wage>0&&r.source));assert.equal(rows.some(r=>r.trade==='지붕잇기공'&&r.effective_from==='2026-09-01'),false,'값이 없는 칸은 줄을 만들지 않는다');
});
test('자재 단가: 시행일 · 포장 수량 — 통합관리표 단가표(개인)와 솔밭 견적서 단가가 맞는다',()=>{
 assert.equal(mat.price_date,'2026-08-12');assert.equal(mat.items.length,94);assert.equal(mat.notes.length,4,'준비중(0원) 4개는 건너뜀');
 const m=(n,sp)=>one(mat.items,i=>i.item===n&&(sp==null||i.spec===sp));
 const coat=m('POUR 코트재Ⅰ(회색)');assert.deepEqual([coat.unit_price,coat.pack_size],[178500,20]);
 assert.equal(C.materialUnit(coat.unit_price,coat.pack_size),9000,'솔밭 견적서 코트재 9,000원');
 const sheet=m('POUR 압축강화시트 0.7T','20cm*100m');assert.deepEqual([sheet.unit_price,sheet.pack_size],[85900,100]);assert.equal(C.materialUnit(sheet.unit_price,sheet.pack_size),900);
 const top=m('POUR 슈퍼복합압축시트 0.3T','1m*100m');assert.equal(C.materialUnit(top.unit_price,top.pack_size),2400);
 assert.equal(m('POUR PVC 시트 1.5T').pack_size,15);
});
test('이전 값과 비교: 새 항목 · 같음 · 오름 · 내림, 시행일 이전 값 중 가장 늦은 것과 비교',()=>{
 const cur=[{trade:'특별인부',daily_wage:224490,effective_from:'2025-09-01',status:'retired'},{trade:'특별인부',daily_wage:226122,effective_from:'2026-01-01',status:'active'},{trade:'특별인부',daily_wage:999,effective_from:'2026-09-01',status:'draft'}];
 const d=S.diff('labor',[{trade:'특별인부',daily_wage:228717,effective_from:'2026-09-01'},{trade:'방수공',daily_wage:233163,effective_from:'2026-09-01'},{trade:'특별인부',daily_wage:226122,effective_from:'2026-03-01'}],cur);
 assert.deepEqual(d.map(x=>[x.change,x.prev,x.next,x.pct]),[['up',226122,228717,1.15],['new',null,233163,null],['same',226122,226122,0]],'초안은 비교 대상이 아니다');
});
test('승인 점검: 출처 없음 · 값 비어 있음 · 시행일 없음이면 막힘',()=>{
 const ok=[{item:'산재보험료',tier:'',rate:0.0356,source:'조달청'}];assert.deepEqual(S.approvalProblems('cost',ok,'2026-04-13'),[]);
 assert.match(S.approvalProblems('cost',[{item:'고용보험료',rate:null,source:''}],'2026-04-13').join('|'),/출처가 없는 항목 1개.*값이 비어 있는 항목 1개: 고용보험료/);
 assert.match(S.approvalProblems('cost',ok,'').join('|'),/시행일/);assert.match(S.approvalProblems('labor',[],'2026-09-01').join('|'),/승인할 항목이 없습니다/);
});
test('견적에 적용: 견적일에 맞는 승인 기준을 골라 원가계산서 요율 · 노임으로',()=>{
 const now=rates.items.map(i=>Object.assign({},i,{status:'active'}));now.find(i=>i.item==='고용보험료').rate=0.0101;
 const old=now.filter(i=>i.item==='산재보험료').map(i=>Object.assign({},i,{rate:0.0350,effective_from:'2025-01-01',status:'retired'}));
 const all=now.concat(old);
 const r=S.toCalcRates(all,'2026-10-11');assert.deepEqual(r.missing,[]);assert.deepEqual([r.rates.indirectLabor,r.rates.accident,r.rates.employment,r.rates.health,r.rates.safety,r.rates.environment],[0.175,0.0356,0.0101,0.03595,0.0311,0.003]);
 assert.equal(S.toCalcRates(now,'2025-06-01').rates.accident,undefined,'시행일 전 견적에는 아직 없는 기준(2026-04 요율만 있으면 2025-06에는 없음)');assert.match(S.toCalcRates(now,'2025-06-01').missing.join(','),/산재보험료/);
 const early=S.toCalcRates(old,'2025-06-01');assert.equal(early.rates.accident,0.035);
 const labor=S.wageToRows(wage,'x').map(r=>Object.assign({},r,{status:'active'}));
 assert.equal(S.wageOn(labor,'특별인부','2026-10-11'),228717);assert.equal(S.wageOn(labor,'특별인부','2026-06-23'),226122,'솔밭 견적서(2026-06-23) = 2026.1.1 열');assert.equal(S.wageOn(labor,'특별인부','2024-01-01'),null);
 /* 새 기준으로 같은 솔밭 견적서를 다시 계산하면 노임만 달라진다(견적일 기준 선택) */
 const unit=[{kind:'mat',price:9000,qty:0.72},{kind:'lab',price:S.wageOn(labor,'특별인부','2026-06-23'),qty:0.05},{kind:'lab',price:S.wageOn(labor,'보통인부','2026-06-23'),qty:0.0452}];
 const u=C.unitCost(unit);assert.equal(u.lab,11306+7777,'2026-06-23 견적일 노임이면 엑셀 노무비 단가 11,306 + 7,777');
});
