/* 모바일 탭 정리 — 오늘 / 내 현장 / 기록 · 등록 / 일정 (2026-10-10 design_handoff_mobile_all 4 · 5번)
   · 기록 · 등록: '어느 현장에 기록하나요?' — 방금 열었던 현장을 먼저(현장 유지), 아래에 내 현장 최근 순, 그 아래에 새 현장 등록(기존 화면 그대로).
   · 일정: 내 다음 업무를 날짜순으로 — 기한 지남 / 오늘 / 내일 / 이번 주 / 그 뒤. 줄을 누르면 그 현장 상세, 방문 일정은 방문 결과 입력(MobileEntry), [일정 변경]은 날짜만 바꾸기.
   · 뒤로 가기: 목록에서 상세로 들어갔다 돌아오면 목록 위치(스크롤)를 되돌린다.
   화면을 그리는 기존 함수와 저장 · 배정 · 등록 로직은 그대로 두고, 그려진 뒤에 덧붙인다(mobile-v2.js 와 같은 방식). 끄기: G.mobileHubOff=true */
(function(root){
 'use strict';
 const enabled=()=>!(root.G&&(root.G.mobileHubOff||root.G.mobileV2Off));
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const kst=n=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+(n||0)*864e5));}catch(e){return new Date(Date.now()+(n||0)*864e5).toISOString().slice(0,10);}};
 const WK='일월화수목금토';
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));if(!m)return '';const x=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return (+m[2])+'.'+(+m[3])+' ('+WK[x.getUTCDay()]+')';};
 const dayNo=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?Date.UTC(+m[1],+m[2]-1,+m[3])/864e5:NaN;};
 const day=v=>String(v||'').slice(0,10);
 const openNext=d=>{const a=d&&d.nextAction;return a&&a.status==='open'&&String(a.text||a.type||'').trim()?a:null;};
 const mine=()=>{try{return (root.myDeals?root.myDeals():[]).filter(d=>typeof root.isOpen!=='function'||root.isOpen(d));}catch(e){return [];}};
 const lastAt=d=>{let t=0;[].concat(d.activities||[]).forEach(a=>{const v=Date.parse(a&&(a.at||a.occurred_at)||'');if(Number.isFinite(v)&&v>t)t=v;});[d.lastAt,d.contactAt].forEach(x=>{const v=Date.parse(x||'');if(Number.isFinite(v)&&v>t)t=v;});return t;};
 const dayOf=t=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(t));}catch(e){return new Date(t).toISOString().slice(0,10);}};
 const lastLine=d=>{let best=null;(d.activities||[]).forEach(a=>{const v=Date.parse(a&&(a.at||a.occurred_at)||'');if(Number.isFinite(v)&&!/^[a-z0-9_]+$/.test(String(a.type||''))&&(!best||v>best.t))best={t:v,type:String(a.type||'기록')};});return best?md(dayOf(best.t))+' '+best.type:'기록 없음';};
 const stage=d=>{try{return root.stageLabel(d.code);}catch(e){return '';}};
 const contact=d=>{try{const c=root.contactInfoM(d);return c.name?c.name+(c.role?' '+c.role:''):'';}catch(e){return '';}};
 /* ── 기록 · 등록 ── */
 function hubHtml(){
  const G=root.G,list=mine().sort((a,b)=>lastAt(b)-lastAt(a)),last=G._lastDeal!=null?list.find(d=>String(d.id)===String(G._lastDeal)):null,rest=list.filter(d=>d!==last).slice(0,last?5:6);
  const card=(d,now)=>'<button type="button" class="mh-card'+(now?' now':'')+'" data-mh="open" data-id="'+attr(d.id)+'">'+(now?'<em>방금 열었던 현장 · 이어서 기록</em>':'')+'<small>'+h(stage(d))+(d.brand?' · '+h(d.brand):'')+'</small><b>'+h(d.nm)+'</b><span>'+h([contact(d),'최근 '+lastLine(d)].filter(Boolean).join(' · '))+'</span></button>';
  return '<section class="mh-hub" aria-label="기록할 현장 고르기"><div class="mt-head mv-title"><h1>어느 현장에 기록하나요?</h1><p>기록 · 등록 · 열려 있는 현장을 먼저 고르세요</p></div>'
   +(last?card(last,true):'')+(rest.length?'<div class="mh-list">'+rest.map(d=>card(d,false)).join('')+'</div>':(last?'':'<p class="mh-none">기록할 현장이 없습니다 — 아래에서 새 현장을 등록하세요</p>'))
   +'<button type="button" class="mh-more" data-mh="mine">내 현장 전체 보기 ›</button><h2 class="mh-sub">새 현장 등록</h2></section>';
 }
 /* ── 일정 ── */
 function scheduleRows(){
  const T=kst(0),tn=dayNo(T),sun=tn+((7-new Date(T+'T00:00:00Z').getUTCDay())%7);
  const rows=mine().map(d=>{const a=openNext(d);if(!a)return null;const due=day(a.due_at||a.due||d.nextActionDue);if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return null;return {d,a,due,n:dayNo(due)};}).filter(Boolean).sort((x,y)=>x.n-y.n||String(x.d.nm).localeCompare(String(y.d.nm),'ko'));
  const G=[['late','기한 지남',x=>x.n<tn],['today','오늘',x=>x.n===tn],['tomorrow','내일',x=>x.n===tn+1],['week','이번 주',x=>x.n>tn+1&&x.n<=sun],['later','다음 주 이후',x=>x.n>sun]];
  return {T,sun,groups:G.map(([k,l,f])=>({k,l,rows:rows.filter(f)})).filter(g=>g.rows.length),total:rows.length};
 }
 const isVisit=a=>/방문|실측|미팅/.test(String(a.type||'')+' '+String(a.text||''));
 function scheduleHtml(){
  const S=scheduleRows(),late=(S.groups.find(g=>g.k==='late')||{rows:[]}).rows.length;
  const row=x=>'<div class="mh-row'+(x.n<dayNo(S.T)?' late':'')+'"><button type="button" class="mh-main" data-mh="'+(isVisit(x.a)&&x.n<=dayNo(S.T)?'visit':'open')+'" data-id="'+attr(x.d.id)+'"><i>'+h(md(x.due))+'</i><span><b>'+h(x.d.nm)+'</b><small>'+h([x.a.type||'',String(x.a.text||'').replace(/^\s*고객\s*약속\s*:?\s*/,''),/약속/.test(String(x.a.type||'')+String(x.a.text||''))?'고객 합의':''].filter(Boolean).join(' · '))+'</small></span></button><button type="button" class="mh-move" data-mh="move" data-id="'+attr(x.d.id)+'" aria-label="일정 변경">일정 변경</button></div>';
  return '<section class="mh-sched" aria-label="일정"><div class="sec-h"><h2>일정 '+S.total+'건</h2><span>'+(late?'기한 지남 '+late+' · ':'')+'오늘 '+md(S.T)+'</span></div>'
   +(S.groups.length?S.groups.map(g=>'<div class="mh-grp"><h3>'+h(g.l)+' <em>'+g.rows.length+'</em></h3><div class="mh-rows">'+g.rows.map(row).join('')+'</div></div>').join(''):'<p class="mh-none">앞으로 잡힌 일정이 없습니다 — 현장에서 결과를 남기며 다음 업무를 잡아 주세요</p>')+'</section>';
 }
 function apply(){
  if(!enabled())return;
  const G=root.G,scr=root.document.getElementById('scr'),body=scr&&scr.querySelector('.body');
  if(!body||!G||!G.user||G.deal||G.sub||G.mode!=='rep')return;
  if(G.tab==='find'&&!body.querySelector('.mh-hub')){const t=body.querySelector(':scope>.mv-title'),el=root.document.createElement('div');el.innerHTML=hubHtml();if(t)t.remove();body.prepend(el.firstElementChild);}
  if(G.tab==='my'&&!body.querySelector('.mh-sched')){const t=body.querySelector(':scope>.mv-title'),el=root.document.createElement('div');el.innerHTML=scheduleHtml();(t||body.firstElementChild).after(el.firstElementChild);}
 }
 function go(id,after){
  const G=root.G;G.deal=id;G.sub=null;root.render();
  if(after)root.setTimeout(after,300);
 }
 root.document.addEventListener('click',e=>{
  const b=e.target.closest('#scr [data-mh]');if(!b||!enabled())return;const a=b.dataset.mh,id=b.dataset.id;
  if(a==='open')return go(id);
  if(a==='mine'){const G=root.G;G.tab='mine';G.deal=null;G.sub=null;return root.render();}
  if(a==='visit')return go(id,()=>{if(root.MobileEntry)root.MobileEntry.open({ch:'방문'});else if(root.dealCallSheetM)root.dealCallSheetM();});
  if(a==='move')return go(id,()=>{if(root.MobileEntry&&root.MobileEntry.reschedule)root.MobileEntry.reschedule();});
 });
 /* 현장 유지 · 목록 위치 복원 */
 const scroller=()=>root.document.querySelector('.phone-body');
 let pos={},prevDeal=null,prevTab=null;
 function boot(){
  const base=root.render;if(typeof base!=='function')return;
  root.render=function(){
   const G=root.G;let restore=null;
   if(enabled()&&G){
    const el=scroller();
    if(G.deal!=null&&prevDeal==null&&el&&G.user)pos[prevTab||G.tab]=el.scrollTop;/* 목록 → 상세: 떠나기 전 위치 */
    if(G.deal==null&&prevDeal!=null&&!G.sub&&pos[G.tab]!=null)restore=pos[G.tab];/* 상세 → 같은 탭 목록 */
    if(G.deal!=null)G._lastDeal=G.deal;
   }
   const r=base.apply(this,arguments);
   try{if(enabled()&&root.G){prevDeal=root.G.deal;prevTab=root.G.tab;apply();if(restore!=null){const el=scroller();if(el){const sb=el.style.scrollBehavior;el.style.scrollBehavior='auto';el.scrollTop=restore;el.style.scrollBehavior=sb;}}}}catch(e){console.warn('[모바일 탭]',e);}
   return r;
  };
  try{if(enabled()&&root.G){prevDeal=root.G.deal;prevTab=root.G.tab;apply();}}catch(e){}
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot);else boot();
 root.MobileHub=Object.freeze({enabled,apply,scheduleRows,hubHtml,scheduleHtml});
})(window);
