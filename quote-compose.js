/* 공법견적 · 간단견적 계산 (2026-10-11 design_handoff_quote_v3 6단계) — 화면은 이 함수 결과만 그린다
   공법 + 수량(㎡) → 공법 기준(재료 · 노무 구성) × 견적일에 맞는 승인 기준(자재 단가 · 노임 · 요율) → 직접공사비 → 원가계산서(QuoteCalc.fromDirect) → 적산 기준금액
   · 자재 단가 = 단가표 포장 단가 ÷ 포장 수량 → 100원 단위 올림(QuoteCalc.materialUnit) · 단가표를 거치지 않는 재료는 고정 단가
   · 기준에 없는 항목은 '간단 항목'(수량 × 단가)으로 더한다 — 재료비로 합산
   · 견적일에 승인된 기준이 없으면 계산하지 않고 missing 에 적는다(지어내지 않는다)
   · 서버(crm_quote_compose_calc_v1)가 같은 순서 · 같은 절삭으로 다시 계산해 다르면 저장을 거절한다. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.QuoteCompose=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const need=n=>{const m=typeof module==='object'&&module.exports?require('./'+n+'.js'):null;return m;};
 const calc=()=>root.QuoteCalc||need('quote-calc'),std=()=>root.QuoteStandards||need('quote-standards');
 const n0=v=>{const n=Number(String(v==null?'':v).replace(/,/g,''));return Number.isFinite(n)?n:0;};
 const latest=(rows,keyFn,key,dateKey,date)=>(rows||[]).filter(r=>r.status!=='draft'&&keyFn(r)===key&&String(r[dateKey]||'')<=String(date||'9999')).sort((a,b)=>String(b[dateKey]).localeCompare(String(a[dateKey])))[0]||null;
 /* 공법 기준 1개 → 1㎡당 줄(재료 · 노무 · 경비) */
 function specLines(spec,ctx){
  const C=calc(),lines=[],missing=[],basis={};
  for(const m of spec.composition.materials||[]){
   if(m.fixed!=null){lines.push({kind:'mat',name:m.name,price:n0(m.fixed),qty:m.qty});continue;}
   const row=latest(ctx.material,r=>r.item+'|'+(r.spec||''),m.ref.item+'|'+m.ref.spec,'price_date',ctx.date);
   if(!row){missing.push('자재 단가 · '+m.ref.item+(m.ref.spec?' ('+m.ref.spec+')':''));continue;}
   basis.material=basis.material&&basis.material>row.price_date?basis.material:row.price_date;
   lines.push({kind:'mat',name:m.name,price:C.materialUnit(row.unit_price,m.ref.divisor||1),qty:m.qty});
  }
  for(const l of spec.composition.labor||[]){
   const row=latest(ctx.labor,r=>r.trade,l.trade,'effective_from',ctx.date);
   if(!row){missing.push('노임 · '+l.trade);continue;}
   basis.labor=basis.labor&&basis.labor>row.effective_from?basis.labor:row.effective_from;
   lines.push({kind:'lab',name:l.name,price:Number(row.daily_wage),qty:l.qty});
  }
  for(const x of spec.composition.misc||[])lines.push({kind:'misc',name:x.name,of:x.of,pct:x.pct});
  return {lines,missing,basis};
 }
 /* input: {date, items:[{method,area}], extras:[{name,qty,unit,price}], generalPct, profitPct, durationDays, retire, health, tiers}
    standards: {method:[…], material:[…], labor:[…], cost:[…]} (서버 목록 그대로) */
 function compose(input,standards){
  const C=calc(),S=std(),date=input.date,missing=[],rows=[],basis={};
  let mat=0,lab=0,exp=0;
  for(const it of input.items||[]){
   const area=n0(it.area);if(!(area>0))continue;
   const spec=latest(standards.method,r=>r.method,it.method,'effective_from',date);
   if(!spec){missing.push('공법 기준 · '+it.method);continue;}
   const sl=specLines(spec,{material:standards.material,labor:standards.labor,date});missing.push(...sl.missing);Object.assign(basis,{method:spec.effective_from});
   for(const k of ['material','labor'])if(sl.basis[k])basis[k]=basis[k]&&basis[k]>sl.basis[k]?basis[k]:sl.basis[k];
   const u=C.unitCost(sl.lines),m=C.INT(u.mat*area),l=C.INT(u.lab*area),e=C.INT(u.exp*area);
   mat+=m;lab+=l;exp+=e;rows.push({kind:'method',method:it.method,area,unit:{mat:u.mat,lab:u.lab,exp:u.exp},amount:{mat:m,lab:l,exp:e},lines:sl.lines.map((x,i)=>Object.assign({},x,{amount:u.rows[i]?u.rows[i].amount:0}))});
  }
  let extra=0;
  for(const x of input.extras||[]){const q=n0(x.qty),p=n0(x.price);if(!(q>0&&p>0))continue;const a=C.INT(q*p);extra+=a;rows.push({kind:'extra',name:x.name,qty:q,unitName:x.unit||'',price:p,amount:{mat:a,lab:0,exp:0}});}
  mat+=extra;
  const cr=S.toCalcRates(standards.cost,date,input.tiers);missing.push(...cr.missing.map(x=>'원가 요율 · '+x));
  if(Object.keys(cr.basis).length)basis.cost=Object.values(cr.basis).sort().pop();
  const sheet=C.fromDirect({mat,lab,exp,rates:cr.rates,generalPct:n0(input.generalPct),profitPct:n0(input.profitPct),durationDays:input.durationDays===''||input.durationDays==null?undefined:n0(input.durationDays),health:typeof input.health==='boolean'?input.health:undefined,retire:!!input.retire});
  return {ok:!missing.length&&sheet.base>0&&rows.length>0,missing:[...new Set(missing)],rows,sheet,basis,rates:cr.rates};
 }
 /* 간단견적: 항목 · 수량 · 단위 · 단가 · 합계 — 원가계산서 없음 */
 function simple(items){
  const C=calc(),rows=[];let total=0;
  for(const x of items||[]){const q=n0(x.qty),p=n0(x.price);if(!(q>0&&p>0))continue;const a=C.INT(q*p);total+=a;rows.push({name:String(x.name||'').trim(),qty:q,unit:x.unit||'',price:p,amount:a});}
  return {ok:total>0&&rows.every(r=>r.name),rows,total};
 }
 return {compose,simple,specLines};
});
