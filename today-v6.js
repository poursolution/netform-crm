/* PC 오늘 업무 v6 (2026-10-20 대표 확정 design_handoff_pc_today_v6 · 시안 'PC 오늘 업무 v6' — design_handoff_pc_today_inquiry 의 오늘 업무 부분을 대체)
   파이프라인 단계 화면과 같은 틀: 제목 한 줄 → 5칸 탭(전체 · 기한 지남 · 오늘 처리 · 회신 대기 · 기록 보완) → 왼쪽 오늘 진단 · 기록 없음 3가지 / 오른쪽 먼저 처리할 곳 카드 → 처리할 업무 줄.
   · 어느 건이 어느 칸인지 = 오늘 업무 4구역 판정 그대로(DayZones · DayZoneRules — PC · 모바일 같은 함수). 이 파일은 그리기만 한다.
   · 카드 · 줄 같은 표기: 현장 + 경과 숫자 한 번(확인된 기한 기준 · 없으면 '기한 ?') / 할 일 / [견적문의 · 파이프라인] 꼬리표 · 브랜드 · 단계. 경과 · 기한 문구를 두 번 쓰지 않는다.
   · 색은 브랜드 색(왼쪽 띠 · 브랜드 이름)과 빨강(기한 지난 경과 숫자 · 기한 지남 탭 숫자)만. 꼬리표 · 요청 꼬리표 · 진단 문구 · [결과 기록] 버튼은 회색 계열.
   · 카드 · 줄을 누르면 기존 상세 창(가운데 새 창): 견적문의 = 견적문의 상세 · 파이프라인 = 영업건 상세, 결과 기록까지 그 창에서. 줄 아래 펼침 · 하단 패널 없음.
   숫자: 큰 숫자 규칙은 그대로(오늘 업무 배지 = 오늘 처리 + 기한 초과), 탭 숫자 = 각 구역 건수, 기록 없음 3가지 = PipelineJudge.tally · missCounts(파이프라인 단계 화면과 같은 함수).
   끄기: G.todayV6Off=true → 예전 v3 화면(큰 숫자 · 4구역 목록) */
(function(root){
 'use strict';
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pad=n=>String(n).padStart(2,'0'),PER=20,CARDS=8;
 const on=()=>!(root.G&&root.G.todayV6Off);
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const hm=v=>{const t=new Date(v||'');if(!Number.isFinite(t.getTime()))return '';const k=new Date(t.getTime()+9*36e5);return pad(k.getUTCHours())+':'+pad(k.getUTCMinutes());};
 const kday=v=>{const t=new Date(v==null?Date.now():v);return new Date(t.getTime()+9*36e5).toISOString().slice(0,10);};
 const span=ms=>{const hrs=Math.max(1,Math.floor(ms/36e5));return hrs<24?hrs+'시간':Math.floor(hrs/24)+'일';};
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 function dealAction(d){try{return root.actionObj?root.actionObj(d,root.itemPatch?root.itemPatch(d,'deal'):undefined):null;}catch(e){return null;}}
 /* 문의 첫 연락 기준 시각 = 배정(없으면 접수) + 운영 기준 시간 — 4구역 · 모바일과 같은 계산(DayZoneRules.inqLate) */
 function inqDeadline(q){const t=Date.parse(q&&(q.sales_assigned_at||q.assigned_at||q.assignedAt||q.at||q.created_at)||'');if(!Number.isFinite(t))return null;const hr=Number(root.OPS_RULES&&root.OPS_RULES.responseSlaHours)||2;return t+hr*36e5;}
 /* 경과 숫자 한 번: 확인된 기한(다음 업무 · 관리자 요청 · 문의 첫 연락 기준)이 지난 만큼 · 오늘이면 시각 · 없으면 '기한 ?' */
 function elapsed(i,zone){
  if(zone==='wait')return {t:i.wait&&i.wait.due?md(i.wait.due):'확인일 ?',k:'g',why:'고객 회신 대기 · 지연 아님'};
  if(zone==='fix')return {t:'보완',k:'g',why:'기록만 채움 · 평가 제외'};
  const x=i.x||{},RU=root.DayZoneRules,now=Date.now(),r=(i.reqs||[])[0],rt=r?Date.parse(r.due_at||''):NaN;
  let day='',at='';if(x.type==='deal'){const a=dealAction(x.item);const raw=a?String(a.due||a.due_at||''):'';day=RU?RU.dayOf(raw):'';at=/T\d{2}:\d{2}/.test(raw)&&!/T00:00(:00)?(\.0+)?(Z|\+00:00|\+09:00)?$/.test(raw)?hm(/Z|[+-]\d{2}:\d{2}$/.test(raw)?raw:raw+'+09:00'):'';}else if(x.due&&RU)day=RU.dayOf(x.due);
  const dd=RU&&day?RU.diff(day):null;
  if(dd!=null&&dd<0)return {t:(-dd)+'일',k:'r',why:'기한 '+md(day)};
  if(Number.isFinite(rt)&&rt<now)return {t:span(now-rt),k:'r',why:'요청 기한 '+md(kday(rt))+' '+hm(r.due_at)};
  if(x.type==='inq'){const first=i.rk==='first'||i.rk==='assign'||!!x.overdue,dl=first?inqDeadline(x.item):null;if(dl&&dl<now)return {t:span(now-dl),k:'r',why:'첫 연락 기준 '+md(kday(dl))+' '+hm(dl)};if(dl)return {t:hm(dl),k:'',why:'첫 연락 기준 '+hm(dl)+'까지'};}
  if(dd===0)return {t:at||'오늘',k:'',why:'기한 오늘'+(at?' '+at:'')};
  if(Number.isFinite(rt)&&kday(rt)===kday())return {t:hm(r.due_at),k:'',why:'요청 기한 오늘 '+hm(r.due_at)};
  if(dd!=null)return {t:md(day),k:'g',why:'기한 '+md(day)};
  if(Number.isFinite(rt))return {t:md(kday(rt)),k:'g',why:'요청 기한 '+md(kday(rt))};
  return {t:'기한 ?',k:'g',why:'확인된 기한 없음'};
 }
 const taskOf=(i,zone)=>{const x=i.x||{};if(x.type==='deal'){const a=dealAction(x.item);if(a&&a.text)return String(a.text).replace(/^\s*고객\s*약속\s*:\s*/,'고객 약속 · ');}if(zone==='wait')return '회신 확인';return String(x.next||i.missTxt||'다음 업무 확인');};
 const kindOf=i=>i.x&&i.x.type==='inq'?'견적문의':'파이프라인';
 const brandOf=i=>String(i.brand||(i.i&&i.i.brand)||'').trim();
 const colorOf=i=>BRAND[brandOf(i)]||'#9aa0ab';
 const stageOf=i=>i.x&&i.x.type==='inq'?(i.rk==='assign'?'배정 전':'첫 연락'):String(i.sName||'').trim();
 /* 지금 상황: 대기 사유 · 보완할 것 · 마지막 기록(PC · 모바일 같은 기록) */
 function nowOf(i,zone){
  if(zone==='wait')return (i.wait&&i.wait.reason)||'고객 회신 대기';
  if(zone==='fix')return String(i.missTxt||'기록 보완');
  const x=i.x||{},d=x.item||{},acts=(Array.isArray(d.activities)?d.activities:[]).slice().sort((p,q)=>String(q.occurred_at||q.at||'').localeCompare(String(p.occurred_at||p.at||''))),a=acts[0];
  if(a)return md(kday(a.occurred_at||a.at))+' '+String(a.note||a.type||'기록').replace(/\s+/g,' ').slice(0,48);
  if(i.i&&i.i.recent)return String(i.i.recent);
  return x.type==='inq'?'접수만 · 연락 기록 없음':(root.ContactState?root.ContactState.NONE:'CRM 연락 기록 없음');
 }
 const reqTxt=i=>{const r=(i.reqs||[])[0];if(!r)return '';try{return root.DayZones&&root.DayZones.reqTag?root.DayZones.reqTag(r):(r.requested_by||'관리자')+' 요청';}catch(e){return (r.requested_by||'관리자')+' 요청';}};
 const tagLine=i=>'<span class="sub"><em class="kd">'+kindOf(i)+'</em><b style="color:'+colorOf(i)+'">'+h(brandOf(i)||'브랜드 미입력')+'</b>'+(stageOf(i)?' · '+h(stageOf(i)):'')+'</span>';
 const openAttr=(i,ctx)=>' data-t6="open" data-key="'+h(i.key)+'" data-far="'+(ctx.team&&i.x&&i.x.owner!==ctx.me?1:0)+'"';
 function card(i,zone,ctx){const e=elapsed(i,zone);return '<button type="button" class="tv6-card"'+openAttr(i,ctx)+' style="border-left-color:'+colorOf(i)+'" title="'+h(e.why)+'"><span class="t"><b>'+h(i.i&&i.i.site||'현장명 미입력')+'</b><b class="d '+e.k+'">'+h(e.t)+'</b></span><span class="k">'+h(taskOf(i,zone))+'</span>'+tagLine(i)+'</button>';}
 function row(i,zone,ctx){const e=elapsed(i,zone),rq=reqTxt(i);
  return '<div class="tv6-row" role="button" tabindex="0"'+openAttr(i,ctx)+' style="border-left-color:'+colorOf(i)+'"><div class="c1"><span class="t"><b>'+h(i.i&&i.i.site||'현장명 미입력')+'</b><b class="d '+e.k+'" title="'+h(e.why)+'">'+h(e.t)+'</b></span>'+tagLine(i)+'</div><div class="c2"><b>'+h(taskOf(i,zone))+'</b></div><div class="c3"><span>'+h(nowOf(i,zone))+'</span>'+(rq?'<em class="rq">'+h(rq)+'</em>':'')+'</div><button type="button" class="go"'+openAttr(i,ctx)+'>결과 기록</button></div>';}
 const TABS=[['all','전체','오늘 업무 모두'],['late','기한 지남','확인된 기한이 지난 것'],['now','오늘 처리','오늘 마감 · 고객 약속'],['wait','회신 대기','고객 답 기다림 · 지연 아님'],['fix','기록 보완','기록만 채움 · 평가 제외']];
 const promised=i=>i.rk==='promise'||!!(i.x&&i.x.promise)||/^\s*고객\s*약속/.test(taskOf(i));
 /* 그리기 — ctx = {Z,S,role,team,me,pass,week,back,word} */
 function html(ctx){
  const Z=ctx.Z,S=ctx.S,pass=ctx.pass||(()=>true);
  const L={late:(Z.late||[]).filter(pass),now:(Z.now||[]).filter(pass),wait:(Z.wait||[]).filter(pass),fix:(Z.fix||[]).filter(pass)};
  const all=[].concat(L.late.map(i=>[i,'late']),L.now.map(i=>[i,'now']),L.wait.map(i=>[i,'wait']),L.fix.map(i=>[i,'fix']));
  const N={all:all.length,late:L.late.length,now:L.now.length,wait:L.wait.length,fix:L.fix.length};
  if(!TABS.some(t=>t[0]===S.t6tab))S.t6tab='all';
  const t=new Date(),stamp=(t.getMonth()+1)+'.'+t.getDate()+' '+pad(t.getHours())+':'+pad(t.getMinutes());
  const title='<div class="tv6-title"><b>오늘 업무</b><span>오늘 할 일 · 기한 지난 일 · 회신 기다리는 일 · 기록만 채울 일 · '+stamp+' 기준</span></div>'+(ctx.word||'');
  const tabs='<div class="tv6-tabs" role="tablist">'+TABS.map(([k,l,s])=>'<button type="button" role="tab" data-t6="tab" data-v="'+k+'" aria-selected="'+(S.t6tab===k)+'"><b class="n'+(k==='late'&&N.late?' r':'')+'">'+N[k]+'</b><b>'+l+'</b><span>'+s+'</span></button>').join('')+'</div>';
  /* 왼쪽: 오늘 진단 */
  const act=L.late.concat(L.now),withReq=act.filter(i=>(i.reqs||[]).length).length,prom=L.now.filter(promised).length,unk=act.filter(i=>elapsed(i,L.late.includes(i)?'late':'now').t==='기한 ?').length;
  const wk=ctx.week||null;
  let miss=null;try{const J=root.PipelineJudge;if(J&&J.on()&&J.tally)miss=J.missCounts(J.tally(all.filter(([i])=>i.x&&i.x.type==='deal').map(([i])=>i.x.item)));}catch(e){miss=null;}
  const diag='<aside class="tv6-left"><section class="tv6-box"><header><b>오늘 진단</b><span>'+N.all+'건</span></header>'
   +'<div class="tv6-now"><span>지금 먼저</span><b>기한 지남 '+N.late+' · 오늘 처리 '+N.now+'</b><dl><dt>관리자 요청 붙은 것</dt><dd>'+withReq+'건</dd><dt>고객 약속 오늘</dt><dd>'+prom+'건</dd><dt>기한 미확인</dt><dd>'+unk+'건</dd></dl>'+(N.late?'<button type="button" class="lnk" data-t6="tab" data-v="late">다음 · 기한 지난 것부터 결과 기록</button>':N.now?'<button type="button" class="lnk" data-t6="tab" data-v="now">다음 · 오늘 처리부터 결과 기록</button>':'')+'</div>'
   +(wk?'<div class="tv6-wk"><span>'+h(wk.label)+'</span><b>'+h(wk.v)+'</b><small>'+h(wk.goal)+'</small></div>':'')+'</section>'
   +(miss?'<section class="tv6-box"><header><b>기록 없음 3가지</b><span>오늘 업무의 영업건</span></header>'+[['현재 업무 미수행',miss.cur,'기한 있고 넘김 · 담당 평가 · 지연 포함'],['과거 자료 미확인',miss.past,'이관 전 기록 · 보완 대상 · 평가 제외'],['해당 없음',miss.na,'그 단계에 기한이 없음 · 집계 제외']].map(([a,n,s])=>'<div class="tv6-miss"><b>'+a+' '+n+'</b><span>'+s+'</span></div>').join('')+'</section>':'')+'</aside>';
  /* 오른쪽: 먼저 처리할 곳 카드(기한 지남 · 오늘 처리) → 처리할 업무 줄 */
  const top=act.slice(0,CARDS);
  const cards=top.length?'<section class="tv6-box tv6-top dz-cards" aria-label="먼저 처리할 곳"><header><b>먼저 처리할 곳</b><span>'+top.length+'건'+(act.length>top.length?' · 전체 '+act.length+'건은 아래 목록':'')+' · 누르면 상세 창에서 결과 기록</span></header><div class="tv6-cards">'+top.map(i=>card(i,L.late.includes(i)?'late':'now',ctx)).join('')+'</div></section>':'';
  const list=S.t6tab==='all'?all:all.filter(p=>p[1]===S.t6tab),P=root.ListPager,pg=P?P.cut(list,S.t6page||1,PER):{rows:list.slice(0,PER),pages:1};
  const empty={all:'오늘 처리할 건이 없습니다.',late:'기한이 지난 건이 없습니다.',now:'오늘 처리할 건이 없습니다.',wait:'회신을 기다리는 건이 없습니다.',fix:'보완할 기록이 없습니다.'}[S.t6tab];
  const rows='<div class="tv6-lh"><b>처리할 업무 <span>'+list.length+'건</span></b><small>기한 지남 → 고객 약속 · 마감 → 들어온 순서 · 줄을 누르면 결과 기록</small></div>'
   +'<div class="tv6-list">'+(pg.rows.length?pg.rows.map(([i,z])=>row(i,z,ctx)).join(''):'<p class="tv6-empty">'+empty+'</p>')+'</div>'
   +(P&&pg.pages>1?P.html(pg,{ns:'t6',small:true}):'');
  return title+tabs+'<div class="tv6-body">'+diag+'<div class="tv6-right">'+cards+rows+(ctx.back||'')+'</div></div>';
 }
 /* 동작: 상세 창(가운데 새 창)으로. 내 건 = 응대 기록부터, 다른 담당 건(팀 화면) = 상세 */
 function onClick(e){
  const b=e.target.closest('#today-v2 [data-t6]');if(!b)return;e.stopPropagation();
  const S=root.G&&root.G.today3;if(!S)return;const a=b.dataset.t6;
  if(a==='tab'){S.t6tab=b.dataset.v;S.t6page=1;try{root.TodayV2.render();}catch(err){}return;}
  if(a==='page'){S.t6page=Number(b.dataset.page)||1;try{root.TodayV2.render();}catch(err){}return;}
  if(a==='open'){try{root.TodayWorkQueue.open(b.dataset.key,b.dataset.far==='1'?undefined:'contact');}catch(err){}}
 }
 if(typeof document!=='undefined'){document.addEventListener('click',onClick,true);document.addEventListener('keydown',e=>{const t=e.target;if((e.key==='Enter'||e.key===' ')&&t&&t.matches&&t.matches('#today-v2 .tv6-row[data-t6="open"]')){e.preventDefault();t.click();}});}
 root.TodayV6={on,html,elapsed,taskOf,nowOf,TABS};
})(window);
