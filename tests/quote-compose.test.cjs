'use strict';
/* 공법견적 · 간단견적 계산 — 실제 파일에서 읽은 공법 기준 · 자재 단가 · 노임 · 요율로 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const S=require('../quote-standards.js'),C=require('../quote-calc.js'),Q=require('../quote-compose.js');
const fx=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',n),'utf8'));
const act=rows=>rows.map(r=>Object.assign({},r,{status:'active'}));
const sheets=fx('method-sheets-20260825.json'),mp=S.parseMethodSpecs(sheets);
const std={
 method:act(mp.specs.map(s=>({method:s.method,composition:s.composition,effective_from:mp.effective_from,source:'x'}))),
 material:act(S.parseMaterialPrices(fx('material-prices-cells-20260812.json').cells).items),
 labor:act(S.wageToRows(S.parseWageRows(fx('wage-2026h2-items.json')),'x')),
 cost:act(S.parseCostRates(fx('cost-rates-cells-20260413.json').cells).items.map(i=>i.manual?Object.assign({},i,{rate:0.0101,source:'직접 입력'}):i))
};
test('공법 기준: 싱글 1㎡당 구성이 견적일 자재 단가(100원 올림) · 노임으로 계산된다',()=>{
 const spec=std.method.find(m=>m.method==='싱글'),r=Q.specLines(spec,{material:std.material,labor:std.labor,date:'2026-10-11'});
 assert.deepEqual(r.missing,[]);
 const u=C.unitCost(r.lines);
 assert.equal(u.mat,7200+1800+1880+870+870+2400+540,'코트재 9,000×0.8 · 중도 · 상도 9,400×0.2 · 파우더 5,800×0.15 ×2 · 시트 2,400 · 시트 900×0.6');
 assert.equal(u.lab,25158+13815,'특별인부 228,717×0.11 · 보통인부 172,698×0.08 (2026.9.1 열)');
 assert.equal(u.exp,311,'잡재료비 재료비 2%');
});
test('견적일에 맞는 노임: 2026-06-23 견적은 2026.1.1 열 — 단 자재 단가가 그날 아직 없으면 계산하지 않는다',()=>{
 const spec=std.method.find(m=>m.method==='싱글'),r=Q.specLines(spec,{material:std.material,labor:std.labor,date:'2026-06-23'});
 assert.ok(r.missing.some(x=>/자재 단가 · POUR 코트재Ⅰ/.test(x)),'자재 단가표 시행일(2026-08-12) 이전 견적은 단가 없음');
 assert.equal(r.lines.find(l=>l.name==='특수방수공').price,226122);
});
test('compose: 싱글 3,960㎡ → 원가계산서 → 적산 기준금액(10만원 절삭) · 일반관리비 · 이윤은 입력',()=>{
 const out=Q.compose({date:'2026-10-11',items:[{method:'싱글',area:3960}],generalPct:0.03,profitPct:0.12,durationDays:90},std);
 assert.deepEqual(out.missing,[]);assert.equal(out.ok,true);
 const sp=std.method.find(m=>m.method==='싱글'),u=C.unitCost(Q.specLines(sp,{material:std.material,labor:std.labor,date:'2026-10-11'}).lines);
 assert.deepEqual([out.sheet.directMaterial,out.sheet.directLabor,out.sheet.expense],[C.INT(u.mat*3960),C.INT(u.lab*3960),C.INT(u.exp*3960)]);
 assert.equal(out.sheet.base,Math.floor(out.sheet.supply/100000)*100000);assert.ok(out.sheet.general>0&&out.sheet.profit>0);assert.ok(out.sheet.health>0,'공사기간 90일 → 건강 · 연금 · 요양 포함');assert.equal(out.sheet.retire,0,'퇴직공제는 기본 제외');
 assert.deepEqual(out.basis,{method:'2026-08-12',material:'2026-08-12',labor:'2026-09-01',cost:'2026-04-13'});
 const short=Q.compose({date:'2026-10-11',items:[{method:'싱글',area:3960}],generalPct:0.03,profitPct:0.12,durationDays:20},std);assert.equal(short.sheet.health+short.sheet.pension+short.sheet.care,0,'30일 미만은 제외');
});
test('여러 공법 + 기준에 없는 간단 항목(재료비로 합산)',()=>{
 const a=Q.compose({date:'2026-10-11',items:[{method:'싱글',area:1000},{method:'우레탄',area:200}],extras:[{name:'캐노피 방수',qty:2,unit:'개소',price:800000}],generalPct:0,profitPct:0},std);
 const one=Q.compose({date:'2026-10-11',items:[{method:'싱글',area:1000}],generalPct:0,profitPct:0},std);
 assert.equal(a.rows.length,3);assert.equal(a.rows[2].amount.mat,1600000);assert.ok(a.sheet.directMaterial>one.sheet.directMaterial+1600000);
});
test('기준이 없으면 계산하지 않고 이유를 알려 준다',()=>{
 assert.match(Q.compose({date:'2026-10-11',items:[{method:'없는공법',area:10}]},std).missing.join('|'),/공법 기준 · 없는공법/);
 const noRate=Q.compose({date:'2026-10-11',items:[{method:'싱글',area:10}]},Object.assign({},std,{cost:[]}));assert.equal(noRate.ok,false);assert.match(noRate.missing.join('|'),/원가 요율 · 간접노무비/);
 assert.equal(Q.compose({date:'2026-10-11',items:[]},std).ok,false);
});
test('간단견적: 항목 · 수량 · 단위 · 단가 → 합계(원가계산서 없음)',()=>{
 const r=Q.simple([{name:'균열 보수',qty:12,unit:'m',price:15000},{name:'배수구 교체',qty:3,unit:'개',price:42500},{name:'',qty:0,price:0}]);
 assert.deepEqual([r.rows.length,r.total,r.ok],[2,12*15000+3*42500,true]);
 assert.equal(Q.simple([{name:'',qty:1,price:1000}]).ok,false,'이름 없는 항목은 막힘');assert.equal(Q.simple([]).ok,false);
});
