'use strict';
/* 견적 금액 이름 · 가산 계산 (2026-10-11 design_handoff_quote_v3) — README 예시 숫자 그대로 */
const test=require('node:test'),assert=require('node:assert/strict'),Q=require('../quote-amounts.js');
test('README 예시: 기준금액 1.7억 → ㎡당 17,000 × 1,000㎡ = 1.87억 · 1.52배 = 2.584억',()=>{
 const a=Q.markup(170000000,{type:'area',value:17000,area:1000});assert.deepEqual([a.submit,a.added,a.pct,a.error],[187000000,17000000,10,'']);
 const m=Q.markup(170000000,{type:'multiplier',value:1.52});assert.deepEqual([m.submit,m.added,m.pct],[258400000,88400000,52]);
 assert.equal(Q.markup(170000000,{type:'flat',value:5000000}).submit,175000000);assert.equal(Q.markup(170000000,{type:'none'}).submit,170000000);
});
test('가산 뒤 10만원 아래 절삭 · 문자열 숫자(쉼표)도 읽는다',()=>{
 assert.equal(Q.markup('290,071,560',{type:'multiplier',value:'1.52'}).submit,440900000,'290071560 × 1.52 = 440908771.2 → 440,900,000');
 assert.equal(Q.floorStep(187099999),187000000);assert.equal(Q.floorStep(100000),100000);assert.equal(Q.floorStep(99999),0);
});
test('빠진 값은 계산하지 않고 이유를 돌려준다',()=>{
 assert.match(Q.markup(0,{type:'none'}).error,/기준금액이 없습니다/);
 assert.match(Q.markup(1e8,{type:'area',value:17000}).error,/적용 면적/);assert.match(Q.markup(1e8,{type:'area',area:100}).error,/㎡당 공과잡비/);
 assert.match(Q.markup(1e8,{type:'multiplier'}).error,/배수/);assert.match(Q.markup(1e8,{type:'flat'}).error,/더할 금액/);assert.match(Q.markup(1e8,{type:'x'}).error,/알 수 없는/);
 assert.equal(Q.markup(1e8,{type:'multiplier',value:1.52}).submit>0,true);assert.ok(Q.markup(1e8,{type:'area',value:0,area:0}).error!=='','면적 0 = 계산 안 함');
});
test('견적 금액 = 고객 제출금액, 아직 없으면 기존 amount(지금과 같은 숫자)',()=>{
 const legacy={version_no:1,amount:380000000,base_amount:380000000};
 assert.deepEqual([Q.baseOf(legacy),Q.submitOf(legacy),Q.amountOf(legacy),Q.confirmed(legacy)],[380000000,0,380000000,false]);
 const done={version_no:2,amount:290000000,base_amount:290000000,submit_amount:440900000,markup_type:'multiplier',markup_value:1.52,markup_display:'melt',status:'final'};
 assert.deepEqual([Q.amountOf(done),Q.hasMarkup(done),Q.confirmed(done)],[440900000,true,true]);
 assert.equal(Q.baseOf({amount:5e7}),5e7,'기준금액 칸이 없는 예전 줄은 amount 를 원본으로');
 assert.equal(Q.currentAmount([legacy,done,{version_no:3,amount:1e8,status:'draft'},{version_no:4,amount:1e8,status:'superseded'}]),440900000,'초안 · 대체됨은 견적 금액이 아니다');
 assert.equal(Q.currentAmount([]),0);
});
test('고객 서류에는 제출금액과 표시 방식만 — 기준금액 · 가산액 · %는 내부에만',()=>{
 const v={amount:290000000,base_amount:290000000,submit_amount:440900000,markup_type:'multiplier',markup_value:1.52,markup_display:'melt',markup_note:'공과잡비 포함'};
 assert.deepEqual(Q.customerView(v),{amount:440900000,display:'melt',vat:'별도'});assert.deepEqual(Object.keys(Q.customerView(v)).sort(),['amount','display','vat']);
 assert.deepEqual(Q.internalView(v),{base:290000000,submit:440900000,added:150900000,pct:52.03,type:'multiplier',value:1.52,area:null,note:'공과잡비 포함',confirmed:true});
 assert.equal(Q.customerView({amount:1e8}).display,'line');
});
test('확정 · 보낸 견적은 자동 재계산 금지 · 0원 · 수량 0 최종본 금지',()=>{
 assert.deepEqual(['draft','internal','final','superseded'].map(s=>Q.recalcAllowed({status:s})),[true,true,false,false]);assert.equal(Q.recalcAllowed(null),true);
 assert.deepEqual(Q.finalCheck({base_amount:0}),['적산 기준금액이 0원입니다']);
 assert.deepEqual(Q.finalCheck({base_amount:1e8,work_items:[{work:'옥상 방수',qty:0}]}),['수량이 0인 공종이 있습니다']);
 assert.deepEqual(Q.finalCheck({base_amount:1e8,markup_type:'multiplier',work_items:[{qty:100}]}),['가산을 정했으면 고객 제출금액을 확정해 주세요']);
 assert.deepEqual(Q.finalCheck({base_amount:1e8,submit_amount:1.5e8,markup_type:'multiplier',work_items:[{qty:100}]}),[]);
});
