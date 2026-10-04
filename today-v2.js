/* 오늘 업무 v2 (2026-10-01 디자인 핸드오프 'design_handoff_today_inquiry' ④)
   ① 미배정 알림 한 줄 → ② 담당자별 현황(문의 응대 + 파이프라인 진행을 한 표로) → ③ 업무 목록(견적문의/파이프라인 전환, 묶음 표) → 과거 영업 정리.
   집계·목록·열기는 기존 TodayWorkQueue(data·repSummary·matches·open·backlogCard·urgentCards)를 그대로 쓴다.
   담당자·브랜드·검색은 공통 고정 필터줄과 같은 상태. 저장 경로는 건드리지 않는다. 끄기: G.todayV2Off=true(예전 화면). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const T=()=>root.TodayWorkQueue,PER=20;
 const GROUPS={inquiry:[['unassigned','미배정','#e5484d','담당자를 정해 문의를 인계하세요',x=>x.unassigned],['response','첫 연락 늦음','#f08c2e','배정 후 아직 첫 연락 전',x=>x.responseLate],['processing','후속 늦음','#f5a524','첫 연락 후 다음 연락이 밀린 건',x=>x.processingLate],['rest','예정된 문의','#c4c8d0','기한 안에 있는 건',()=>true]],
  pipeline:[['overdue','기한 초과','#e5484d','다음 할 일 날짜가 지난 건',x=>x.overdue],['missing','다음 할 일 없음','#f5a524','다음 할 일이나 날짜가 없는 건',x=>x.missingNext],['stale','장기 정체','#c27c0e','단계에 오래 머문 건',x=>x.stale||x.longContact],['rest','오늘·예정','#c4c8d0','기한 안에 있는 건',()=>true]]};
 const FILTERS={inquiry:[['all','전체'],['unassigned','미배정'],['response','첫 연락 늦음'],['processing','후속 늦음']],pipeline:[['all','전체'],['overdue','기한 초과'],['missing','다음 할 일 없음'],['stale','장기 정체']]};
 const KIND={inquiry:'견적문의',pipeline:'파이프라인',relationship:'관계관리',expansion:'확장관리',manager:'관리자 요청'};
 function st(){const g=root.G;if(!g.todayV2)g.todayV2={panel:'inquiry',limits:{}};return g.todayV2;}
 function enabled(){return root.G.page==='today'&&!root.G.todayV2Off&&!!T()&&typeof T().repSummary==='function';}
 const money=n=>{n=Number(n)||0;if(!n)return '';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const num=(v,cls)=>v?'<span class="'+(cls||'')+'">'+h(v)+'</span>':'<span class="z">–</span>';
 const days=hours=>Number.isFinite(hours)&&hours>0?Math.max(1,Math.floor(hours/24)):0;
 function brandOk(x){try{return root.SalesFilterState.matchesBrand(x.item.brand||root.inquiryBrandOf?.(x.item)||'');}catch(e){return true;}}
 function alertRow(S,P,X){
  const years=T().repYearOptions(X),u=S.unassigned;
  const period='<label class="tv-period"><select aria-label="현황판 연도" data-tv="year">'+years.map(y=>'<option value="'+attr(y)+'"'+(P.year===y?' selected':'')+'>'+h(y==='전체'?'전체 연도':y==='미입력'?'연도 미입력':y)+'</option>').join('')+'</select><i>·</i><select aria-label="현황판 분기" data-tv="quarter">'+[[0,'연간'],[1,'1분기'],[2,'2분기'],[3,'3분기'],[4,'4분기']].map(q=>'<option value="'+q[0]+'"'+(P.quarter===q[0]?' selected':'')+'>'+q[1]+'</option>').join('')+'</select></label>';
  return '<section class="tv-alert'+(u.count?'':' calm')+'" aria-label="미배정 알림"><i class="tv-dot"></i><span>'+(u.count?'<b>미배정 문의 '+u.count+'건</b> · 가장 오래된 건 '+days(u.maxLag)+'일 지남'+(u.site?' ('+h(u.site)+')':''):'<b>미배정 문의가 없습니다</b>')+'</span><span class="tv-spacer"></span>'+period+(u.count?'<button type="button" class="tv-red" data-tv="unassigned">미배정만 보기</button>':'')+'</section>';
 }
 function board(S,owner){
  const map=new Map(),row=o=>{let r=map.get(o);if(!r){r={owner:o,inq:null,pipe:null};map.set(o,r);}return r;};
  S.inquiry.forEach(r=>{row(r.owner).inq=r;});S.pipeline.forEach(r=>{row(r.owner).pipe=r;});
  const rows=[...map.values()].map(r=>{const i=r.inq||{},p=r.pipe||{};r.late=(i.response||0)+(i.processing||0)+(p.overdue||0)+(p.stale||0);return r;}).sort((a,b)=>b.late-a.late||root.repCompare(a.owner,b.owner));
  const body=rows.map(r=>{const i=r.inq||{},p=r.pipe||{},sel=owner===r.owner,iLag=days(i.maxLag),pLag=days(p.maxLag);
   return '<div class="tv-brow'+(sel?' sel':'')+'" role="button" tabindex="0" data-tv="owner" data-v="'+attr(r.owner)+'"><span class="tv-name"><i class="'+(r.late>=10?'r':r.late>=1?'y':'g')+'"></i>'+h(r.owner)+'</span>'
    +num(i.total)+num(i.response,'bad')+num(i.processing,'bad')+num(iLag?iLag+'일':'',iLag>=100?'bad':'')+'<i class="tv-vline"></i>'
    +num(p.total)+num(money(p.amount))+num(p.overdue,'bad')+num(p.stale,'warn')+num(pLag?pLag+'일':'',pLag>=100?'bad':'')+'<span class="tv-go">'+(sel?'전체 보기':'업무 보기 ›')+'</span></div>';}).join('');
  return '<section class="tv-board" aria-label="담당자별 현황"><header><b>담당자별 현황</b><span>늦은 건이 많은 순 · 행을 누르면 아래 목록이 그 담당자로 좁혀집니다</span>'+(owner&&owner!=='전체'?'<button type="button" class="tv-clear" data-tv="owner" data-v="전체">'+h(owner)+' 선택 해제 ✕</button>':'')+'</header>'
   +'<div class="tv-bgroups"><span></span><span class="inq">견적문의 응대</span><i></i><span class="pipe">파이프라인 진행</span><span></span></div>'
   +'<div class="tv-bhead"><span>담당자</span><span>담당</span><span>첫 연락 늦음</span><span>후속 늦음</span><span>최장 경과</span><i class="tv-vline"></i><span>진행</span><span>금액</span><span>기한 초과</span><span>장기 정체</span><span>최장 정체</span><span></span></div>'
   +(body||'<div class="tv-empty">표시할 담당자가 없습니다</div>')+'</section>';
 }
 function rowHtml(x,admin){
  const inquiry=x.panel==='inquiry',site=x.item.site||x.item.site_name||'현장명 미입력';
  const sub=inquiry?(x.item.contact_name||x.item.contact||root.inqCtlContactLabel?.(x.item)||'고객 미입력'):(root.contactInfo?.(x.item)?.managerName||x.item.brand||'');
  const kind=inquiry?(x.kind==='manager'?'관리자 요청':root.inqCtlFirstResponseAt?.(x.item)?'문의 · 후속 연락':'신규 문의'):(KIND[x.kind]||'파이프라인')+(x.stage?' · '+x.stage:'');
  const age=days(x.lag),ageText=x.panel==='pipeline'&&x.dueDays!==null&&x.dueDays!==undefined&&x.dueDays>=0?(x.dueDays===0?'오늘':x.dueDays+'일 남음'):age?age+'일':'오늘';
  const why=x.unassigned?'첫 연락 기록 없음':x.reason||x.recent||'';
  const assign=x.unassigned&&admin;
  return '<div class="tv-row" role="button" tabindex="0" data-key="'+attr(x.key)+'"><div class="tv-c"><b>'+h(site)+'</b><span>'+h(sub)+'</span></div><span class="tv-kind">'+h(kind)+'</span><span class="tv-owner'+(x.unassigned?' none':'')+'">'+h(x.owner||'미배정')+'</span>'
   +'<div class="tv-c tv-task"><b>'+h(x.unassigned?'담당자 지정 후 인계':x.next||'다음 할 일 확인')+'</b><span>'+h(why)+'</span></div><span class="tv-age'+(age>=14?' hot':'')+'">'+h(ageText)+'</span>'
   +'<button type="button" class="tv-cta'+(assign?' fill':'')+'" data-key="'+attr(x.key)+'">'+(assign?'배정':'처리')+'</button></div>';
 }
 function list(X,rows,admin){
  const s=st(),panel=s.panel,statusKey=panel==='inquiry'?'todayInquiryStatus':'todayPipelineStatus',active=root.G[statusKey]||'all',src=rows[panel];
  const seg='<div class="tv-seg" role="group" aria-label="업무 목록 전환">'+[['inquiry','견적문의 관리'],['pipeline','파이프라인 관리']].map(p=>'<button type="button" data-tv="panel" data-v="'+p[0]+'" aria-pressed="'+(panel===p[0])+'">'+p[1]+' <b>'+rows[p[0]].length+'</b></button>').join('')+'</div>';
  const pills='<div class="tv-pills" role="group" aria-label="상태 필터">'+FILTERS[panel].map(f=>'<button type="button" data-tv="status" data-v="'+f[0]+'" aria-pressed="'+(active===f[0])+'">'+f[1]+' <b>'+src.filter(x=>T().matches(x,f[0])).length+'</b></button>').join('')+'</div>';
  const filtered=src.filter(x=>T().matches(x,active)),used=new Set();
  const groups=GROUPS[panel].map(g=>{const items=filtered.filter(x=>!used.has(x.key)&&g[4](x));items.forEach(x=>used.add(x.key));return [g,items.sort((a,b)=>(b.lag||0)-(a.lag||0)||String(a.key).localeCompare(String(b.key)))];}).filter(([g,items])=>g[0]!=='rest'||items.length);
  const body=groups.map(([g,items])=>{const limit=s.limits[panel+':'+g[0]]||PER,part=items.slice(0,limit),more=items.length-part.length;
   return '<div class="tv-ghead"><i style="background:'+g[2]+'"></i><b>'+h(g[1])+'</b><span>'+items.length+'건</span><small>· '+h(g[3])+'</small></div>'+(items.length?part.map(x=>rowHtml(x,admin)).join(''):'<div class="tv-empty">해당하는 업무가 없습니다</div>')+(more>0?'<button type="button" class="tv-more" data-tv="more" data-v="'+panel+':'+g[0]+'">+ '+more+'건 더보기</button>':'');}).join('');
  return '<section class="tv-list" aria-label="업무 목록"><div class="tv-lhead">'+seg+'<span class="tv-spacer"></span>'+pills+'</div><div class="tv-table"><div class="tv-thead"><span>현장 · 고객</span><span>구분</span><span>담당</span><span>지금 할 일</span><span>경과</span><span></span></div>'+body+'</div></section>';
 }
 function render(){
  const page=document.getElementById('pg-today');if(!page)return;let host=document.getElementById('today-v2');
  /* 예전 화면은 끄기 스위치(G.todayV2Off)이거나 새 화면을 그릴 수 없을 때만 보인다 — 자료를 받는 동안에는 예전 화면을 보여 주지 않는다(깜빡임) */
  const legacy=!!root.G.todayV2Off||!T()||typeof T().repSummary!=='function';page.classList.toggle('today-legacy',legacy);
  if(!enabled()||!root.B){if(legacy){page.classList.remove('today-v2');host?.remove();}return;}
  const X=T().data(),G=root.G,admin=X.admin,owner=admin?(G.todayQueueOwner||'전체'):'전체',q=String(G.todayQueueSearch||'').trim().toLowerCase();
  const scoped=x=>(owner==='전체'||x.owner===owner)&&brandOk(x)&&(!q||[x.item.site,x.item.site_name,x.owner,x.reason,x.next,x.item.contact_name,x.item.phone].join(' ').toLowerCase().includes(q));
  const rows={inquiry:X.inquiry.filter(scoped),pipeline:X.pipeline.filter(scoped)};
  let top='';
  if(admin){const P=T().repPeriod(),S=T().repSummary(X,P);top=alertRow(S,P,X)+board(S,owner);}
  else{const all=rows.inquiry.concat(rows.pipeline),urgent=T().pickUrgent(all);top=T().urgentCards(all,urgent);}
  page.classList.add('today-v2');
  if(!host){host=document.createElement('div');host.id='today-v2';const old=document.getElementById('today-home-root');(old?.parentElement||page).insertBefore(host,old||null);host.addEventListener('click',click);host.addEventListener('change',change);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.tv-row,.tv-brow')){e.preventDefault();e.target.click();}});}
  /* 영업사원으로 열었을 때: 급한 곳 카드 + 묶음 표(today-rep-v2.js). 관리자 화면은 그대로 */
  /* 관제탑(2026-10-03 today_tower): 역할별 한 틀 — 켜져 있으면 영업사원 · 관리자 모두 이 화면. 끄면 아래 예전 두 화면 */
  const tower=root.TodayTower&&root.TodayTower.enabled();
  /* v3(2026-10-04 today_v3): 역할별 5화면 — 큰 숫자 · 띠 · 묶음 3개 · 밀린 건 정리. 끄면 아래 관제탑 */
  if(tower&&root.TodayV3&&root.TodayV3.enabled()){host.innerHTML=root.TodayV3.html(X,rows.inquiry.concat(rows.pipeline),(X.backlog||[]).filter(scoped));return;}
  host.innerHTML=(tower?root.TodayTower.html(X,rows.inquiry.concat(rows.pipeline)):!admin&&root.TodayRepV2&&root.TodayRepV2.enabled()?root.TodayRepV2.html(rows.inquiry.concat(rows.pipeline),(X.D||[]).filter(d=>scoped({item:d,owner:root.repN(d.assignee)}))):top+list(X,rows,admin))+T().backlogCard((X.backlog||[]).filter(scoped),admin);
 }
 function setOwner(v){if(root.CommonFilterBar)root.CommonFilterBar.setOwner(v);else root.G.todayQueueOwner=v;st().limits={};root.paint();}
 function click(e){
  if(e.target.closest('.twq-backlog,.twq-urgent,.trv,.tt,.tv3'))return;/* 과거 영업 정리·긴급 카드는 기존 단추 그대로 */
  const cta=e.target.closest('.tv-cta');if(cta){e.stopPropagation();return T().open(cta.dataset.key);}
  const b=e.target.closest('[data-tv]');
  if(b&&b.tagName!=='SELECT'){const k=b.dataset.tv,v=b.dataset.v,s=st();
   if(k==='owner')return setOwner(v==='전체'||(root.G.todayQueueOwner===v)?'전체':v);
   if(k==='panel'){s.panel=v;return render();}
   if(k==='status'){root.G[s.panel==='inquiry'?'todayInquiryStatus':'todayPipelineStatus']=v;s.limits={};return render();}
   if(k==='more'){s.limits[v]=(s.limits[v]||PER)+PER;return render();}
   if(k==='unassigned'){s.panel='inquiry';root.G.todayInquiryStatus='unassigned';s.limits={};setOwner('전체');document.querySelector('#today-v2 .tv-list')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  }
  const row=e.target.closest('.tv-row');if(row&&!e.target.closest('button,select,input'))T().open(row.dataset.key);
 }
 function change(e){const k=e.target.dataset?.tv;if(k==='year'||k==='quarter'){T().repPeriodSet(k,e.target.value);}}
 /* 기존 화면이 다시 그려질 때마다 새 화면도 그린다(기존 render는 내부에서 직접 불리므로 결과 DOM 변화를 본다) */
 function boot(){
  const old=document.getElementById('today-home-root');if(!old)return;let t=null;
  new MutationObserver(()=>{if(t)return;t=setTimeout(()=>{t=null;try{render();}catch(err){document.getElementById('pg-today')?.classList.remove('today-v2');document.getElementById('pg-today')?.classList.add('today-legacy');document.getElementById('today-v2')?.remove();if(root.console)root.console.warn('today v2: '+err.message);}},0);}).observe(old,{childList:true});
  const base=root.paintTodayHome;if(typeof base==='function')root.paintTodayHome=function(){const r=base.apply(this,arguments);try{render();}catch(err){document.getElementById('pg-today')?.classList.remove('today-v2');document.getElementById('pg-today')?.classList.add('today-legacy');document.getElementById('today-v2')?.remove();}return r;};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.TodayV2={render,enabled};
})(window);
