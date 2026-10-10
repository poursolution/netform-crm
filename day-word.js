/* 오늘 업무 · 관리자 한마디를 종류별로 (2026-10-10 대표 핸드오프 design_handoff_day_zones §4-4 끝 줄 · 시안 '오늘 업무 · 요청 카드 제거')
   화면 맨 위 분홍 상자를 없애고, 같은 자료(주간 관리자 한마디 rep_manager_comment · 저장 길 그대로)를 종류별로 다른 곳에 보인다.
    묶음 요청(한 줄에 '제목 — n건: …') = 진행 막대 아래 한 줄 + 정보 보완 구역 줄(지연 · 평가 아님). 여러 묶음의 대상이 겹치면 영업건 단위로 한 번만.
    건별 요청(요청 엔진)     = 도착 팝업 + 줄 꼬리표(day-zones.js · work-request.js 그대로)
    공지 · 코칭 · 사람에게 온 요청 = 종 알림(누르면 목록 · 읽으면 끝). 코칭은 오른쪽 '내 이번 주' 칸에도.
   묶음 요청의 대상은 지금 자료로 다시 계산한다(관리팀 KPI 와 같은 함수 KpiV7.stageGroups · KpiB.compute) — 이미 채운 건은 빠지고, 겹치는 건은 저절로 한 번만 남는다.
   새 서버 함수 · 새 칸 없음. 끄기: G.dayWordOff=true → 예전 분홍 상자 그대로. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DayWord=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const R=root,h=v=>R.esc?R.esc(String(v==null?'':v)):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),attr=v=>R.escAttr?R.escAttr(String(v==null?'':v)):h(v);
 const on=()=>!(R.G&&R.G.dayWordOff);
 const md=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Number(m[2])+'.'+Number(m[3]):'';};
 /* 줄머리 [공지] [요청] [KPI 요청] [코칭] 이 있으면 그대로, 없으면 글로 판단(요청 · 요망 · 해 주세요 = 업무 요청, 그 외 = 코칭) — 예전 상자와 같은 규칙 */
 const kindOf=l=>{const m=/^\[?(공지|업무 요청|KPI 요청|요청|코칭)\]?\s*[:·]?\s*/.exec(l);if(m)return [/요청/.test(m[1])?'업무 요청':m[1],l.slice(m[0].length)];return [/요청|요망|해 ?주세요|부탁/.test(l)?'업무 요청':'코칭',l];};
 const BULK=/^(.*?)\s+—\s+(\d+)건:\s*(.*)$/;
 function parse(text){
  return String(text||'').split('\n').map(x=>x.replace(/^·\s*/,'').trim()).filter(Boolean).map(raw=>{const k=kindOf(raw),m=k[0]==='업무 요청'?BULK.exec(k[1]):null;return {kind:k[0],text:k[1],raw,bulk:m&&Number(m[2])>=2?{title:m[1].trim(),n:Number(m[2])}:null};});
 }
 function comment(me){
  if(!me||typeof R.repManagerComment!=='function')return null;
  let c=null;try{c=R.repManagerComment(me,R.repManagerWeekKey(0));}catch(e){}
  return c&&c.status!=='done'&&String(c.comment||'').trim()?c:null;
 }
 const meta=c=>({by:String(c.created_by||c.createdBy||'관리자'),at:md(String(c.updated_at||c.updatedAt||c.created_at||'').slice(0,10))});
 /* 제목 → 지금 남은 대상(내 것만). 단계 사유 요청 = '단계 · 사유' / KPI 요청 = 지표 이름. 못 찾으면 null(보낸 건수만 안다) */
 let CACHE={at:0,key:'',map:null};
 function targetMap(me){
  const key=me+'|'+((R.B&&R.B.deals||[]).length)+'|'+((R.B&&R.B.inquiries||[]).length);
  if(CACHE.map&&CACHE.key===key&&Date.now()-CACHE.at<6e4)return CACHE.map;
  const m=new Map(),own=t=>String(R.repN?R.repN(t.owner):t.owner||'')===me,shape=t=>({kind:t.kind,id:String(t.id),name:String(t.name||t.what||'')});
  try{(R.KpiV7.stageGroups(new Set())||[]).forEach(g=>(g.rules||[]).forEach(x=>{m.set(g.label+' · '+x.t,(x.targets||[]).filter(t=>t.kind!=='rep'&&own(t)).map(shape));}));}catch(e){}
  try{const K=R.KpiB,C=K.compute();(K.DEF||[]).forEach((d,i)=>{const M=C.M&&C.M[i];if(M&&!m.has(d[0]))m.set(d[0],(M.todos||[]).filter(t=>t.kind!=='rep'&&own(t)).map(shape));});}catch(e){}
  CACHE={at:Date.now(),key,map:m};return m;
 }
 const keyOf=t=>(t.kind==='deal'?'deal:':'inq:')+t.id;
 /* 묶음 요청: 대상이 겹치는 줄끼리 한 묶음(영업건 단위로 한 번만) */
 function bulks(me){
  const c=comment(me);if(!c)return [];
  const L=parse(c.comment).filter(l=>l.bulk);if(!L.length)return [];
  const TM=targetMap(me),G=[],M=meta(c);
  L.forEach(l=>{
   const T=TM.has(l.bulk.title)?TM.get(l.bulk.title):null,keys=T?T.map(keyOf):null;
   let g=G.find(x=>keys?(x.keys&&(x.title===l.bulk.title||keys.some(k=>x.keys.has(k)))):(!x.keys&&x.title===l.bulk.title));
   if(!g){g={title:l.bulk.title,titles:[],keys:keys?new Set():null,items:new Map(),m:0,sum:0,sent:[],by:M.by,at:M.at};G.push(g);}
   g.m++;g.sent.push(l.bulk.n);const fresh=!g.titles.includes(l.bulk.title);if(fresh)g.titles.push(l.bulk.title);/* 같은 제목을 두 번 보낸 것은 같은 대상이라 겹침 수에 다시 더하지 않는다 */
   if(keys){if(fresh)g.sum+=keys.length;T.forEach(t=>{const k=keyOf(t);g.keys.add(k);const it=g.items.get(k)||{kind:t.kind,id:t.id,name:t.name,labels:[]};if(!it.labels.includes(l.bulk.title))it.labels.push(l.bulk.title);g.items.set(k,it);});}
  });
  return G.map(g=>Object.assign(g,{n:g.keys?g.keys.size:Math.max.apply(null,g.sent),dup:g.keys?g.sum-g.keys.size:null,resolved:!!g.keys})).filter(g=>g.n>0);
 }
 /* 진행 막대 아래 한 줄 */
 function lineHtml(me){
  if(!on())return '';const G=bulks(me);if(!G.length)return '';
  return G.map((g,i)=>{
   const extra=[g.m>1?'요청 '+g.m+'건':'',g.dup?'겹치는 '+g.dup+'건 합침':g.m>1&&g.resolved?'같은 건은 한 번만 셈':'',!g.resolved?'보낸 건수 기준':'',g.resolved&&Math.max.apply(null,g.sent)>g.n?'보낸 '+g.sent.join(' · ')+'건 중 남은 것':''].filter(Boolean).join(' · ');
   return '<div class="dwd-bulk" data-n="'+g.n+'"><em>묶음 요청</em><span class="w"><b>'+h(g.by+(g.at?' · '+g.at:''))+'</b> · '+h(g.title)+(g.titles.length>1?' 외 '+(g.titles.length-1):'')+' <b>'+g.n+'건</b>'+(extra?' <small>('+h(extra)+')</small>':'')+'</span><span class="to">→ 정보 보완에서 처리 · 지연 · 평가 아님</span><i></i>'+(i===0?'<button type="button" data-dwd="info">정보 보완 열기 ›</button>':'')+'</div>';}).join('');
 }
 /* 정보 보완 구역에 보탤 줄(이미 다른 구역에 있는 건은 그 줄에 맡긴다) */
 function infoRows(me,seen,scopeOk){
  if(!on())return [];const out=[],done=new Set();
  bulks(me).forEach(g=>{if(!g.keys)return;g.items.forEach((t,k)=>{
   if(done.has(k)||(seen&&seen.has(k)))return;done.add(k);
   let item=null;try{item=t.kind==='deal'?((R.B&&R.B.deals)||[]).find(d=>String(d.id)===t.id):R.inqCtlFind(t.id,false);}catch(e){}
   if(!item)return;if(scopeOk&&!scopeOk(item,me))return;if(seen)seen.add(k);
   let sName='';try{sName=t.kind==='deal'?R.stageLabel(R.dealStage(item)):'견적문의';}catch(e){}
   const what=t.labels.map(x=>x.replace(/^.*?\s·\s/,'')).join(' · ');
   out.push({key:k,x:{type:t.kind==='deal'?'deal':'inq',item,owner:me},i:{site:item.site||item.site_name||t.name||'현장명 미입력',brand:item.brand||''},st:'',sName,rk:'bulk',missTxt:what,short:'',act:'입력',done:what,reqs:[],brand:item.brand||'',bulk:{why:'묶음 요청 · '+g.by+(g.at?' '+g.at:''),sub:'기록만 · 지연 · 평가 아님'}});
  });});
  return out;
 }
 /* ── 종 알림: 공지 · 코칭 · 사람에게 온 요청(영업건에 붙지 않은 한 줄) ── */
 const SEEN_KEY='crm.dwd.seen.v1';
 const seenMap=()=>{try{return JSON.parse(R.localStorage.getItem(SEEN_KEY)||'{}');}catch(e){return {};}};
 const idOf=(me,l)=>{let wk='';try{wk=R.repManagerWeekKey(0);}catch(e){}return wk+'|'+me+'|'+l.raw;};
 const meName=()=>{try{return R.repN(R.ME&&R.ME.name)||String(R.ME&&R.ME.name||'');}catch(e){return '';}};
 function notes(me){
  me=me||meName();const c=comment(me);if(!c)return [];
  const S=seenMap(),M=meta(c);
  return parse(c.comment).filter(l=>!l.bulk).map(l=>({kind:l.kind==='업무 요청'?'요청':l.kind,text:l.text,by:M.by,at:M.at,id:idOf(me,l),seen:!!S[idOf(me,l)]}));
 }
 function markRead(me){try{const S=seenMap(),now=Date.now();Object.keys(S).forEach(k=>{if(now-S[k]>30*864e5)delete S[k];});notes(me).forEach(n=>{S[n.id]=now;});R.localStorage.setItem(SEEN_KEY,JSON.stringify(S));}catch(e){}}
 const KC={'공지':'#6b7280','요청':'#2a52b8','코칭':'#1f7a4d'};
 function reqCount(){try{const W=R.WorkRequest;return W&&W.enabled()&&W.incoming?W.incoming().filter(r=>r.status==='sent').length:0;}catch(e){return 0;}}
 function popHtml(me){
  const N=notes(me),rq=reqCount(),B=bulks(me||meName());
  const row=n=>'<div class="dwd-n'+(n.seen?'':' new')+'"><em style="color:'+KC[n.kind]+'">'+h(n.kind)+'</em><span>'+h(n.text)+'</span><small>'+h(n.by+(n.at?' · '+n.at:''))+'</small></div>';
  return '<header><b>알림</b><button type="button" data-dwd="close" aria-label="닫기">×</button></header>'
   +(rq?'<button type="button" class="dwd-go" data-dwd="today">미확인 요청 '+rq+'건 · 오늘 업무 줄에서 처리 ›</button>':'')
   +(B.length?'<button type="button" class="dwd-go" data-dwd="info">묶음 요청 '+B.reduce((s,g)=>s+g.n,0)+'건 · 정보 보완에서 처리 ›</button>':'')
   +(N.length?N.map(row).join(''):(rq||B.length?'':'<p class="dwd-none">새 알림이 없습니다</p>'))
   +'<footer>공지는 읽으면 끝 · 코칭은 오늘 업무 오른쪽 \'내 이번 주\'에도 남습니다</footer>';
 }
 function closePop(){const p=document.getElementById('dwd-pop');if(p)p.remove();}
 function openPop(){
  const el=document.querySelector('.ib');if(!el)return;closePop();const me=meName();
  const p=document.createElement('div');p.id='dwd-pop';p.className='dwd-pop';p.setAttribute('role','dialog');p.setAttribute('aria-label','알림');p.innerHTML=popHtml(me);document.body.append(p);
  const r=el.getBoundingClientRect();p.style.top=Math.round(r.bottom+8)+'px';p.style.right=Math.max(12,Math.round(window.innerWidth-r.right))+'px';
  p.addEventListener('click',e=>{const b=e.target.closest('[data-dwd]');if(!b)return;const a=b.dataset.dwd;closePop();if(a==='today'||a==='info')goZone(a==='info'?'info':'now');});
  markRead(me);bell();
 }
 function goZone(z){try{if(R.DayZones){const Z=R.DayZones.state();Z.zone=z;Z.rs='';Z.closing=false;Z.why='';Z.reqOpen='';}if(R.G.page!=='today')R.goPage('today');else{try{R.TodayV2.render();}catch(e){R.paint();}}setTimeout(()=>{try{const n=document.querySelector('#today-v2 .dz');if(n)n.scrollIntoView({block:'start',behavior:'smooth'});}catch(e){}},60);}catch(e){}}
 /* 종 옆 숫자: 안 읽은 공지 · 코칭 · 요청 줄 수. 누르면 목록(요청 엔진의 '미확인 요청 n'은 그대로 옆에) */
 function bell(){
  try{const el=document.querySelector('.ib');if(!el)return;const act=on()?notes(meName()):[],n=act.filter(x=>!x.seen).length;
   let b=el.querySelector('.dwd-belln');
   if(!on()||!act.length){if(b)b.remove();el.classList.remove('dwd-bell-on');return;}
   el.classList.add('dwd-bell-on');el.setAttribute('role','button');el.tabIndex=0;
   if(n){if(!b){b=document.createElement('b');b.className='dwd-belln';el.append(b);}const t='새 알림 '+n;if(b.textContent!==t)b.textContent=t;}else if(b)b.remove();
   if(!el.__dwd){el.__dwd=true;
    /* 요청 엔진의 '누르면 오늘 업무로'보다 먼저 받는다 — 공지 · 코칭이 있으면 목록을 띄우고, 오늘 업무로 가는 길은 목록 안에 둔다 */
    el.addEventListener('click',e=>{if(!on()||!notes(meName()).length)return;e.stopImmediatePropagation();e.preventDefault();if(document.getElementById('dwd-pop'))closePop();else openPop();},true);
    document.addEventListener('mousedown',e=>{const p=document.getElementById('dwd-pop');if(p&&!p.contains(e.target)&&!e.target.closest('.ib'))closePop();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closePop();});}
  }catch(e){}
 }
 /* 오른쪽 '내 이번 주' 칸에 남는 코칭 */
 function coachHtml(me){
  if(!on())return '';const C=notes(me).filter(n=>n.kind==='코칭');if(!C.length)return '';
  return '<div class="dwd-coach"><b>이번 주 코칭</b>'+C.slice(-3).map(n=>'<span title="'+attr(n.text)+'">'+h(n.text)+'</span>').join('')+'<small>'+h(C[0].by+(C[0].at?' · '+C[0].at:''))+(C.length>3?' · 외 '+(C.length-3)+'줄':'')+'</small></div>';
 }
 if(typeof document!=='undefined'){
  /* 진행 막대 아래 [정보 보완 열기 ›] */
  document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('#today-v2 [data-dwd="info"]');if(!b)return;e.preventDefault();e.stopPropagation();goZone('info');},true);
  /* 종은 어느 화면에서나: 한마디 자료를 가끔 다시 읽고(5분 간격은 TodayV3.loadWord 가 지킨다) 숫자를 맞춘다 */
  const tick=()=>{try{if(on()&&R.ME&&R.TodayV3&&R.TodayV3.loadWord)R.TodayV3.loadWord();}catch(e){}bell();};
  setTimeout(tick,4000);setInterval(tick,60000);
 }
 return {on,parse,kindOf,comment,bulks,lineHtml,infoRows,notes,markRead,bell,popHtml,openPop,closePop,coachHtml,goZone,_reset:()=>{CACHE={at:0,key:'',map:null};}};
});
