/* 견적 금액 이름 · 가산 계산 (2026-10-11 design_handoff_quote_v3 README '1. 금액 이름' · '3-5 가산 → 고객 제출금액')
   직접공사비 → 공급가액 → 적산 기준금액(원본 보존) → 영업 가산 → 고객 제출금액(= 파이프라인 · 리포트 · 발송의 '견적 금액', VAT 별도).
   이 파일은 화면도 저장도 하지 않는다 — 이름과 읽기 규칙, 가산 계산(순수 함수)만. 서버 함수(2단계~)와 같은 산식이어야 하며, 화면마다 따로 계산하지 않는다.
   · 가산 방식 4가지: area(㎡당 공과잡비 × 적용면적) · multiplier(배수) · flat(정액 더하기) · none. 가산 뒤 10만원 아래 절삭.
   · 기준금액은 영업이 고칠 수 없다(이 파일은 기준금액을 바꾸는 함수를 두지 않는다). 가산액 · %는 내부 화면에서만 — 고객 서류용 값에는 넣지 않는다(customerView).
   · 예전 견적(기준 4개 버전 · 가산 없음): 제출금액이 비어 있으면 기존 amount 가 '견적 금액'(지금과 같은 숫자) — 가산이 확정되면 그때 제출금액이 견적 금액이 된다. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.QuoteAmounts=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const NAMES=Object.freeze({direct:'직접공사비',supply:'공급가액',base:'적산 기준금액',submit:'고객 제출금액',quote:'견적 금액'});
 const METHODS=Object.freeze([['area','㎡당 공과잡비'],['multiplier','배수'],['flat','정액 더하기'],['none','가산 없음']]);
 const DISPLAY=Object.freeze([['line','공과잡비 별도 줄'],['melt','단가에 녹여 한 금액']]);
 const STEP=100000;/* 10만원 아래 절삭 = 엑셀 총공사비(E30)와 같은 규칙 */
 const num=v=>{if(v==null||v==='')return NaN;const n=Number(String(v).replace(/[,\s원]/g,''));return Number.isFinite(n)?n:NaN;};
 const pos=v=>{const n=num(v);return n>0?n:0;};
 const floorStep=(n,step)=>{step=step||STEP;return Math.floor(Math.round(n*100)/100/step)*step;};
 /* 수정본 하나에서 읽는 금액들 */
 const baseOf=v=>{if(!v)return 0;return pos(v.base_amount)||pos(v.amount);};
 const submitOf=v=>v?pos(v.submit_amount):0;
 const hasMarkup=v=>!!(v&&v.markup_type&&v.markup_type!=='none'&&submitOf(v));
 const confirmed=v=>submitOf(v)>0;
 /* '견적 금액' = 고객 제출금액, 아직 없으면 기존 amount(= 지금과 같은 숫자) */
 const amountOf=v=>submitOf(v)||pos(v&&v.amount)||baseOf(v);
 /* 가산 계산: 입력 {type,value,area} + 기준금액 → {markup, amount(절삭 전), submit(절삭 후), pct, error} */
 function markup(base,o){
  const b=pos(base),type=o&&o.type||'none',val=num(o&&o.value),area=num(o&&o.area),out={type,base:b,added:0,raw:b,submit:0,pct:0,step:STEP,error:''};
  if(!b){out.error='적산 기준금액이 없습니다';return out;}
  if(type==='none'){out.raw=b;}
  else if(type==='area'){if(!(val>=0)){out.error='㎡당 공과잡비를 넣어 주세요';return out;}if(!(area>0)){out.error='적용 면적(㎡)을 넣어 주세요';return out;}out.raw=b+area*val;}
  else if(type==='multiplier'){if(!(val>0)){out.error='배수를 넣어 주세요';return out;}out.raw=b*val;}
  else if(type==='flat'){if(!(val>=0)){out.error='더할 금액을 넣어 주세요';return out;}out.raw=b+val;}
  else{out.error='알 수 없는 가산 방식입니다';return out;}
  out.submit=floorStep(out.raw);out.added=out.submit-b;out.pct=b?Math.round((out.submit/b-1)*10000)/100:0;
  if(!(out.submit>0))out.error='제출금액이 0원 이하입니다';
  return out;
 }
 /* 가산 여러 방식을 같이 적용 (대표 2026-10-11 "둘다 적용해서 할 수 있게") — 순서는 배수 → ㎡당 → 정액 → 10만원 아래 절삭.
    items: [{type:'multiplier'|'area'|'flat', value, area}] (같은 방식은 한 번만). 서버 crm_quote_submit_confirm_v1 이 같은 순서로 다시 계산해 다르면 거절한다. */
 const ORDER=['multiplier','area','flat'];
 function markupMulti(base,items){
  const b=pos(base),out={base:b,steps:[],raw:b,added:0,submit:0,pct:0,step:STEP,error:''};
  if(!b){out.error='적산 기준금액이 없습니다';return out;}
  const list=(Array.isArray(items)?items:[]).filter(x=>x&&x.type&&x.type!=='none');
  const seen={};for(const x of list){if(!ORDER.includes(x.type)){out.error='알 수 없는 가산 방식입니다';return out;}if(seen[x.type]){out.error='같은 가산 방식은 한 번만 쓸 수 있습니다';return out;}seen[x.type]=1;}
  let raw=b;
  for(const type of ORDER){
   const x=list.find(i=>i.type===type);if(!x)continue;const val=num(x.value),area=num(x.area);let next=raw;
   if(type==='multiplier'){if(!(val>0)){out.error='배수를 넣어 주세요';return out;}next=raw*val;}
   else if(type==='area'){if(!(val>=0)){out.error='㎡당 공과잡비를 넣어 주세요';return out;}if(!(area>0)){out.error='적용 면적(㎡)을 넣어 주세요';return out;}next=raw+area*val;}
   else{if(!(val>=0)){out.error='더할 금액을 넣어 주세요';return out;}next=raw+val;}
   out.steps.push({type,value:val,area:type==='area'?area:null,added:Math.round((next-raw)*100)/100});raw=next;
  }
  out.raw=raw;out.submit=floorStep(raw);out.added=out.submit-b;out.pct=Math.round((out.submit/b-1)*10000)/100;
  if(!(out.submit>0))out.error='제출금액이 0원 이하입니다';
  return out;
 } /* 고객 서류에 내는 값: 제출금액(과 표시 방식)만 — 기준금액 · 가산액 · %는 내보내지 않는다 */
 function customerView(v){return {amount:amountOf(v),display:v&&v.markup_display==='melt'?'melt':'line',vat:'별도'};}
 /* 내부 화면 줄 */
 function internalView(v){const b=baseOf(v),s=submitOf(v);return {base:b,submit:s,added:s?s-b:0,pct:s&&b?Math.round((s/b-1)*10000)/100:0,type:v&&v.markup_type||'',value:v&&v.markup_value!=null?Number(v.markup_value):null,area:v&&v.markup_area!=null?Number(v.markup_area):null,note:v&&v.markup_note||'',confirmed:!!s};}
 /* 확정된 수정본은 절대 자동으로 다시 계산하지 않는다(새 기준 · 새 기준금액은 새 수정본만) — 다시 계산해도 되는 상태 */
 const recalcAllowed=v=>!v||['draft','internal'].includes(String(v.status||''));
 /* 최종본으로 저장해도 되는가: 0원 · 수량 0 견적은 막는다 */
 function finalCheck(v){const e=[];if(!(baseOf(v)>0))e.push('적산 기준금액이 0원입니다');if(v&&Array.isArray(v.work_items)&&v.work_items.some(w=>w&&!(num(w.qty)>0)))e.push('수량이 0인 공종이 있습니다');if(v&&v.markup_type&&v.markup_type!=='none'&&!(submitOf(v)>0))e.push('가산을 정했으면 고객 제출금액을 확정해 주세요');return e;}
 /* 영업건의 견적 목록에서 지금 '견적 금액': 가장 최근 최종 수정본(없으면 가장 큰 버전) */
 function currentAmount(list){const L=(Array.isArray(list)?list:[]).filter(x=>x&&String(x.status||'final')!=='superseded'&&String(x.status||'final')!=='draft').sort((a,b)=>Number(b.version_no||0)-Number(a.version_no||0));return L.length?amountOf(L[0]):0;}
 return {NAMES,METHODS,DISPLAY,STEP,num,floorStep,baseOf,submitOf,amountOf,hasMarkup,confirmed,markup,markupMulti,ORDER,customerView,internalView,recalcAllowed,finalCheck,currentAmount};
});
