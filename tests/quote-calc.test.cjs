'use strict';
/* 견적 원가계산 대조 — 인천 솔밭아파트 옥상 싱글 방수 견적서 엑셀 3건(원가계산서 칸 E6~E30)과 같은 결과 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),C=require('../quote-calc.js');
const RK={G10:'indirectLabor',G13:'accident',G14:'employment',G18:'safety',G19:'asbestos',G20:'wageClaim',G21:'otherExp',G22:'environment',G23:'retire'};
function run(i){
 const fx=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','quote-solbat-'+i+'.json'),'utf8'));
 const lines=fx.lines.filter(l=>l.qty).map(l=>{
  if(/잡재료비/.test(l.name))return {name:l.name,kind:'misc',of:'mat',pct:0.02};
  return {name:l.name,kind:l.mat?'mat':l.lab?'lab':'exp',qty:l.qty,price:l.mat||l.lab||l.exp};
 });
 const rates={};for(const k in RK)rates[RK[k]]=fx.rates[k];
 return {fx,out:C.costSheet({area:fx.qty,lines,rates,generalPct:fx.rates.G26,profitPct:fx.rates.G27,retire:false,health:false})};
}
const MAP={E8:'directMaterial',E9:'directLabor',E10:'indirectLabor',E11:'labor',E12:'expense',E13:'accident',E14:'employment',E18:'safety',E19:'asbestos',E20:'wageClaim',E21:'otherExp',E22:'environment',E23:'retire',E24:'subtotalC',E25:'sum',E26:'general',E27:'profit',E28:'supply',E30:'base'};
for(const i of [1,2,3])test('솔밭 견적서 '+i+' — 원가계산서 모든 칸이 엑셀과 같다',()=>{
 const {fx,out}=run(i);
 for(const [cell,key] of Object.entries(MAP))assert.equal(out[key],fx.exp[cell],fx.file+' '+cell+' '+key);
});
test('총공사비 = 공급가액 10만원 아래 절삭 · 단수정리 음수',()=>{
 const {out}=run(2);assert.deepEqual([out.supply,out.base,out.rounding],[182172502,182100000,-72502]);
});
test('건강 · 연금 · 요양은 옵션 · 일반관리비 · 이윤은 입력(비우면 0)',()=>{
 const a=C.costSheet({area:100,unit:{mat:1000,lab:2000,exp:0}}),b=C.costSheet({area:100,unit:{mat:1000,lab:2000,exp:0},health:true});
 assert.equal(a.health+a.pension+a.care+a.general+a.profit,0);assert.equal(b.health,Math.floor(200000*0.03595));assert.ok(b.sum>a.sum);
});

test('자재 단가 = 포장 단가 ÷ 포장 수량, 100원 단위 올림 — 통합관리표 단가표(개인) → 솔밭 견적서 단가',()=>{
 const M=C.materialUnit;
 assert.equal(M(178500,20),9000);/* 코트재 8,925 */
 assert.equal(M(187800,20),9400);/* 상도코트재 9,390 */
 assert.equal(M(116000,20),5800);/* 106 파우더 */
 assert.equal(M(236300,100),2400);/* 슈퍼복합압축시트 2,363 */
 assert.equal(M(85900,100),900);/* 압축강화시트 859 */
 assert.equal(M(178500,20,50),8950);assert.equal(M(0,20),0);assert.equal(M(100,0),0);
});
