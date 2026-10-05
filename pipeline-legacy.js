/* 과거 이관 · 분류 전 — 파이프라인 맨 아래의 따로 보는 목록 (2026-10-05 대표 승인 · design_handoff_consistency ③)
   예전 시스템에서 옮겨 온 자료 중 현재 CRM 단계가 정해지지 않은 건(판정은 PipelineScope.isLegacy 하나).
   진행 · 실주 · Bad Fit · 보류 어느 쪽도 아니다 — 진행 건수 · 전환율 · 메이드율에 들어가지 않는다.
   [영업 재개] = 상세 창의 단계 바꾸기(새 단계 + 그 단계 필수 정보 + 다음 할 일 날짜를 같이 받는 기존 전환 창)로 간다. 저장되면 그때부터 진행 건.
   서버에 단계 값이 비어 있는 자료는 서버가 전환을 받지 못한다(출발 단계 값이 필요) → 버튼을 잠그고 이유를 적는다.
   목록은 한 쪽 20건 + 쪽 번호(ListPager). 예전 단계별로 좁혀 볼 수 있다. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const P=()=>root.PipelineScope,LP=()=>root.ListPager;
 const st=()=>root.G.plg||(root.G.plg={tab:'all'});
 const NO_CODE='서버에 단계 값이 비어 있는 자료입니다 — 서버 보완 뒤에 영업 재개를 할 수 있습니다';
 function hasRecord(d){try{const a=root.actionObj?root.actionObj(d,root.itemPatch(d,'deal')):null;if(a&&(a.text||a.due))return true;}catch(e){}
  if(Array.isArray(d.activities)&&d.activities.length)return true;try{const m=root.relationshipMeta?root.relationshipMeta(d):null;return !!(m&&m.meaningfulAt);}catch(e){return false;}}
 const ym=v=>{const m=/^(\d{4})-(\d{2})/.exec(String(v||''));return m?m[1]+'.'+(+m[2]):'';};
 function model(rows){
  const items=(rows||[]).map(r=>{const d=r.item;return {r,d,key:r.key,old:P().oldStage(d),can:P().canResume(d),rec:hasRecord(d),created:String(d.created||d.created_at||'')};});
  const count=new Map();items.forEach(i=>count.set(i.old,(count.get(i.old)||0)+1));
  const order=Object.values(P().OLD),tabs=[...count.entries()].sort((a,b)=>{const i=order.indexOf(a[0]),j=order.indexOf(b[0]);return (i<0?99:i)-(j<0?99:j)||b[1]-a[1]||String(a[0]).localeCompare(String(b[0]),'ko');});
  return {items,tabs};
 }
 function rowHtml(i){
  const d=i.d,r=i.r,bits=[d.brand||'브랜드 미지정','예전 단계 '+i.old,'기존 담당 '+(r.owner||'미배정'),ym(i.created)?'예전 등록 '+ym(i.created):''].filter(Boolean);
  return '<div class="plg-row" role="row" tabindex="0" data-plg="open" data-key="'+attr(i.key)+'"><div class="plg-a"><b title="'+attr(r.site)+'">'+h(r.site)+'</b><span>'+h(bits.join(' · '))+'</span></div>'
   +'<div class="plg-b">'+(i.rec?'<em>CRM 기록 있음</em>':'')+(i.can?'':'<small>'+h('단계 값 없음 · 서버 보완 필요')+'</small>')+'</div>'
   +'<button type="button" data-plg="resume" data-key="'+attr(i.key)+'"'+(i.can?'':' disabled title="'+attr(NO_CODE)+'"')+'>영업 재개</button></div>';
 }
 function html(rows){
  const S=st(),M=model(rows);if(S.tab!=='all'&&!M.tabs.some(t=>t[0]===S.tab))S.tab='all';
  const list=(S.tab==='all'?M.items:M.items.filter(i=>i.old===S.tab)).slice().sort((a,b)=>Number(b.rec)-Number(a.rec)||String(b.created).localeCompare(String(a.created))||String(a.r.site).localeCompare(String(b.r.site),'ko'));
  const pg=LP().cut(list,LP().page(S,'list:'+S.tab),20);
  const tab=(k,l,n)=>'<button type="button" role="tab" aria-selected="'+(S.tab===k)+'" data-plg="tab" data-v="'+attr(k)+'">'+h(l)+' <b>'+n+'</b></button>';
  return '<div id="pipeline-legacy" class="plg"><div class="plg-head"><b>'+h(P().LABEL)+'</b><span>'+M.items.length.toLocaleString('ko-KR')+'건</span></div>'
   +'<p class="plg-note">예전 시스템에서 옮겨 온 자료 중 <b>현재 CRM 단계가 정해지지 않은 건</b>입니다. 진행 · 실주 · Bad Fit · 보류 어느 쪽도 아니며, 진행 건수와 전환율 · 메이드율 계산에 들어가지 않습니다. <b>[영업 재개]</b>에서 단계 · 다음 행동 · 날짜를 정하면 그때부터 진행 건이 됩니다.</p>'
   +'<div class="plg-tabs" role="tablist" aria-label="예전 단계">'+tab('all','전체',M.items.length)+M.tabs.map(t=>tab(t[0],t[0],t[1])).join('')+'</div>'
   +'<div class="plg-list" role="table" aria-label="'+attr(P().LABEL)+'">'+(pg.rows.length?pg.rows.map(rowHtml).join(''):'<div class="plg-empty">해당하는 자료가 없습니다.</div>')+LP().html(pg,{ns:'plg',unit:'건'})+'</div></div>';
 }
 function openDeal(key,resume){
  const d=(root.B&&root.B.deals||[]).find(x=>String(x.id||root.dealKey(x))===String(key));if(!d)return;
  root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));
  if(resume)setTimeout(()=>{try{root.DealDetailV3&&root.DealDetailV3.openFrom&&root.DealDetailV3.openFrom('stage');}catch(e){}},250);
 }
 function onClick(e){
  const b=e.target.closest('#pipeline-legacy [data-plg]');if(!b)return;const a=b.dataset.plg,S=st();
  if(a==='tab'){S.tab=b.dataset.v;LP().reset(S);root.paint();return;}
  if(a==='page'){LP().set(S,'list:'+S.tab,Number(b.dataset.page)||1);root.paint();return;}
  if(a==='resume'){e.stopPropagation();if(!b.disabled)openDeal(b.dataset.key,true);return;}
  if(a==='open'&&!e.target.closest('button'))openDeal(b.dataset.key,false);
 }
 document.addEventListener('click',onClick);
 document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const r=e.target.closest&&e.target.closest('#pipeline-legacy .plg-row');if(r&&e.target===r){e.preventDefault();openDeal(r.dataset.key,false);}});
 root.PipelineLegacy={html,model,open:openDeal};
})(window);
