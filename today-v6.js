/* PC 오늘 업무 v6 (2026-10-20 대표 확정 design_handoff_pc_today_v6 + 같은 날 대표 보완 "숫자 범위 · 업무 분류부터 통일")
   · '오늘 업무' 숫자는 하나: 실행 업무 = 기한 지남 + 오늘 처리(왼쪽 메뉴 배지 · 첫 탭 · 기본 목록이 같은 범위). 회신 대기 · 기록 보완은 자기 탭에서만.
   · 같은 업무를 두 번 보여주지 않는다: 위 카드 복제 없이 한 목록 안의 순서로.
     순서 = 기한 지남(넘긴 날 많은 순 → 같은 날이면 기한 시각 → 들어온 순서) → 오늘 처리(고객 약속 · 마감 시각 순 → 시각 없는 것은 약속 먼저 → 들어온 순서).
   · 숫자 한 가지 뜻: '넘긴 날' = 확인된 업무 기한(다음 업무 · 관리자 요청 · 첫 연락 전 문의의 첫 연락 기준)을 넘긴 날 수(한국 날짜). 같은 날 넘김 = '오늘'.
     오늘 처리 = 그 시각(없으면 '오늘'). 접수 후 · 배정 후 경과를 섞지 않는다. 기준은 목록 머리에 한 번만 적는다.
   · 업무 구분 = 4구역 판정 그대로(DayZones · DayZoneRules — PC · 모바일 같은 함수). 첫 응대가 된 문의는 '첫 연락'이 아니라 '응대 중'.
   · 진단 · 기록 없음 같은 설명 칸은 두지 않는다 — 현장 · 이번 할 일 · 기한 · 결과 기록만.
   · 색: 브랜드(띠 · 이름) · 빨강(넘긴 날 · 기한 지남 탭 숫자)만. 줄 · [결과 기록] = 상세 창 응대 기록으로. 전화 · 문자 · 첫마디 없음.
   끄기: G.todayV6Off=true → 예전 v3 화면 */
(function(root){
 'use strict';
 const h=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pad=n=>String(n).padStart(2,'0'),PER=20;
 const on=()=>!(root.G&&root.G.todayV6Off);
 const md=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const hm=ms=>{const k=new Date(ms+9*36e5);return pad(k.getUTCHours())+':'+pad(k.getUTCMinutes());};
 const kday=v=>{const t=new Date(v==null?Date.now():v);return new Date(t.getTime()+9*36e5).toISOString().slice(0,10);};
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 function dealAction(d){try{return root.actionObj?root.actionObj(d,root.itemPatch?root.itemPatch(d,'deal'):undefined):null;}catch(e){return null;}}
 const responded=i=>{const x=i.x||{};if(x.type!=='inq')return false;try{return !!(root.inqCtlFirstResponseAt&&root.inqCtlFirstResponseAt(x.item));}catch(e){return false;}};
 /* 시각이 실린 값만 시각(날짜만 · 자정 · 23:59 = 하루 기한) */
 function timeOf(raw){const s=String(raw||'');if(!/T\d{2}:\d{2}/.test(s))return null;const n=Date.parse(/Z|[+-]\d{2}:\d{2}$/.test(s)?s:s+'+09:00');if(!Number.isFinite(n))return null;const k=hm(n);return k==='00:00'||k==='23:59'?null:n;}
 /* 확인된 기한 후보: {day, at} — 영업건 다음 업무 · 관리자 요청 · 문의(첫 연락 전이면 첫 연락 기준, 응대 중이면 다음 행동일) */
 function deadlines(i){
  const x=i.x||{},RU=root.DayZoneRules,out=[];if(!RU)return out;
  if(x.type==='deal'){const a=dealAction(x.item),raw=a?String(a.due||a.due_at||''):'';const day=RU.dayOf(raw);if(day)out.push({day,at:timeOf(a&&(a.scheduled_at||raw))});}
  else if(x.type==='inq'){
   if(!responded(i)){const q=x.item||{},t=Date.parse(q.sales_assigned_at||q.assigned_at||q.assignedAt||q.at||q.created_at||''),hr=Number(root.OPS_RULES&&root.OPS_RULES.responseSlaHours)||2;if(Number.isFinite(t)){const dl=t+hr*36e5;out.push({day:kday(dl),at:dl});}}
   else if(x.due){const day=RU.dayOf(x.due);if(day)out.push({day,at:timeOf(x.due)});}
  }
  (i.reqs||[]).forEach(r=>{const t=Date.parse(r&&r.due_at||'');if(Number.isFinite(t))out.push({day:kday(t),at:t});});
  return out;
 }
 const today=()=>kday();
 const daysPast=day=>Math.round((Date.parse(today()+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/864e5);
 /* 이 건의 기준 기한 하나: 기한 지남 = 가장 먼저 넘긴 것, 오늘 처리 = 오늘 가장 이른 것 */
 function basis(i,zone){
  const D=deadlines(i),now=Date.now(),T=today();
  if(zone==='late'){const past=D.filter(d=>d.day<T||(d.day===T&&d.at!=null&&d.at<now)).sort((a,b)=>a.day.localeCompare(b.day)||((a.at||0)-(b.at||0)));return past[0]||null;}
  const td=D.filter(d=>d.day===T).sort((a,b)=>(a.at==null?Infinity:a.at)-(b.at==null?Infinity:b.at));return td[0]||null;
 }
 /* 숫자 한 가지 뜻 */
 /* 숫자에 기준 글자를 붙인다(2026-10-20 대표 "기준도 없고"): 기한 지남 = 'n일 지남'(확인된 업무 기한부터) · 오늘 처리 = 'HH:MM까지' / '오늘 중' · 기한 없음 = '기한 미확인' — 접수 · 배정 경과는 쓰지 않는다 */
 function elapsed(i,zone){
  if(zone==='wait')return {t:i.wait&&i.wait.due?md(i.wait.due)+' 확인':'확인일 미정',k:'g'};
  if(zone==='fix')return {t:'—',k:'g'};
  const b=basis(i,zone);
  if(zone==='late'){if(!b)return {t:'기한 미확인',k:'g'};const n=daysPast(b.day);return {t:n>=1?n+'일 지남':'오늘 지남',k:'r',n:Math.max(0,n),at:b.at};}
  if(!b)return {t:'기한 미확인',k:'g'};
  return {t:b.at!=null?hm(b.at)+'까지':'오늘 중',k:'',at:b.at};
 }
 const promised=i=>i.rk==='promise'||!!(i.x&&i.x.promise)||/^\s*고객\s*약속/.test(String(((dealAction((i.x||{}).item)||{}).text)||''));
 const arrived=i=>{const q=(i.x||{}).item||{},t=Date.parse(q.assigned_at||q.created_at||q.at||q.created||'');return Number.isFinite(t)?t:Infinity;};
 /* 처리 순서 */
 function order(list){
  const L=list.filter(p=>p[1]==='late').map(p=>[p,elapsed(p[0],'late')]),N=list.filter(p=>p[1]==='now').map(p=>[p,elapsed(p[0],'now')]);
  L.sort((a,b)=>((b[1].n==null?-1:b[1].n)-(a[1].n==null?-1:a[1].n))||((a[1].at==null?Infinity:a[1].at)-(b[1].at==null?Infinity:b[1].at))||(arrived(a[0][0])-arrived(b[0][0])));
  N.sort((a,b)=>((a[1].at==null?Infinity:a[1].at)-(b[1].at==null?Infinity:b[1].at))||((promised(b[0][0])?1:0)-(promised(a[0][0])?1:0))||(arrived(a[0][0])-arrived(b[0][0])));
  return L.map(x=>x[0]).concat(N.map(x=>x[0]));
 }
 const taskOf=(i,zone)=>{const x=i.x||{};if(x.type==='deal'){const a=dealAction(x.item);if(a&&a.text)return String(a.text).replace(/^\s*고객\s*약속\s*:\s*/,'고객 약속 · ');}if(zone==='wait')return '회신 확인';
  /* 응대 중 문의 = 그 문의에 잡힌 다음 업무(견적 범위 · 금액 확인 등)가 이번 할 일 — 보완 안내 문구보다 먼저 */
  if(x.type==='inq'&&responded(i)){let a=null;try{a=root.actionObj?root.actionObj(x.item,root.itemPatch?root.itemPatch(x.item,'inq'):undefined):null;}catch(e){}if(a&&a.text&&!/^후속 조치$/.test(String(a.text)))return String(a.text);if(/첫\s*연락/.test(String(x.next||'')))return '후속 연락';}return String(x.next||i.missTxt||'다음 업무 확인');};
 const kindOf=i=>i.x&&i.x.type==='inq'?'견적문의':'파이프라인';
 const brandOf=i=>String(i.brand||(i.i&&i.i.brand)||'').trim();
 const colorOf=i=>BRAND[brandOf(i)]||'#9aa0ab';
 const stageOf=i=>i.x&&i.x.type==='inq'?(responded(i)?'응대 중':i.rk==='assign'?'배정 전':'첫 연락'):String(i.sName||'').trim();
 /* 지금 상황: 대기 사유 · 보완할 것 · 마지막 기록(PC · 모바일 같은 기록) */
 function nowOf(i,zone){
  if(zone==='wait')return (i.wait&&i.wait.reason)||'고객 회신 대기';
  if(zone==='fix')return String(i.missTxt||'기록 보완');
  const x=i.x||{},d=x.item||{},acts=(Array.isArray(d.activities)?d.activities:[]).slice().sort((p,q)=>String(q.occurred_at||q.at||'').localeCompare(String(p.occurred_at||p.at||''))),a=acts[0];
  if(a)return md(kday(a.occurred_at||a.at))+' '+String(a.note||a.type||'기록').replace(/\s+/g,' ').slice(0,48);
  if(i.i&&i.i.recent)return String(i.i.recent);
  return x.type==='inq'?(responded(i)?'첫 응대 기록됨 · 상세 내용 없음':'접수만 · 연락 기록 없음'):(root.ContactState?root.ContactState.NONE:'CRM 연락 기록 없음');
 }
 const reqTxt=i=>{const r=(i.reqs||[])[0];if(!r)return '';return (r.requested_by||'관리자')+' 요청';};
 /* 팀 화면(영업관리 · 팀장 · 상무 · 대표)은 줄마다 담당자 이름 */const tagLine=(i,ctx)=>'<span class="sub"><em class="kd">'+kindOf(i)+'</em><b style="color:'+colorOf(i)+'">'+h(brandOf(i)||'브랜드 미입력')+'</b>'+(stageOf(i)?' · '+h(stageOf(i)):'')+(ctx&&ctx.team?' · 담당 '+h((i.x&&i.x.owner)||'미배정'):'')+'</span>';
 const openAttr=(i,ctx)=>' data-t6="open" data-key="'+h(i.key)+'" data-far="'+(ctx.team&&i.x&&i.x.owner!==ctx.me?1:0)+'"';
 function row(i,zone,ctx){const e=elapsed(i,zone),rq=reqTxt(i);
  return '<div class="tv6-row" role="button" tabindex="0"'+openAttr(i,ctx)+' data-zone="'+zone+'" style="border-left-color:'+colorOf(i)+'"><div class="c1"><span class="t"><b>'+h(i.i&&i.i.site||'현장명 미입력')+'</b><b class="d '+e.k+'">'+h(e.t)+'</b></span>'+tagLine(i,ctx)+'</div><div class="c2"><b>'+h(taskOf(i,zone))+'</b></div><div class="c3"><span>'+h(nowOf(i,zone))+'</span>'+(rq?'<em class="rq">'+h(rq)+'</em>':'')+'</div><button type="button" class="go"'+openAttr(i,ctx)+'>결과 기록</button></div>';}
 /* 2026-10-20 대표 "오늘업무 시안 제대로 반영해": 시안(design_handoff_pc_today_v6) 배치 그대로 — 제목 → 5칸 탭(전체 · 기한 지남 · 오늘 처리 · 회신 대기 · 기록 보완) → 왼쪽 오늘 진단 · 기록 없음 3가지 / 오른쪽 먼저 처리할 곳 카드 → 처리할 업무 줄.
    유지: 숫자 기준 글자(n일 지남 · HH:MM까지 · 오늘 중 · 기한 미확인) · 목록 제목은 흰 틀 안 · 칸 머리 · 팀 화면 담당자 이름 · 정렬(기한 지남 → 약속 · 마감 → 들어온 순서) */
 const TABS=[['all','전체','오늘 업무 모두'],['late','기한 지남','확인된 기한이 지난 것'],['now','오늘 처리','오늘 마감 · 고객 약속'],['wait','회신 대기','고객 답 기다림 · 지연 아님'],['fix','기록 보완','기록만 채움 · 평가 제외']];
 const CARDS=6;
 function card(i,zone,ctx){const e=elapsed(i,zone);return '<button type="button" class="tv6-card"'+openAttr(i,ctx)+' data-zone="'+zone+'" style="border-left-color:'+colorOf(i)+'"><span class="t"><b>'+h(i.i&&i.i.site||'현장명 미입력')+'</b><b class="d '+e.k+'">'+h(e.t)+'</b></span><span class="k">'+h(taskOf(i,zone))+'</span>'+tagLine(i,ctx)+'</button>';}
 /* 그리기 — ctx = {Z,S,role,team,me,pass,week,back,word} */
 function html(ctx){
  const Z=ctx.Z,S=ctx.S,pass=ctx.pass||(()=>true);
  const L={late:(Z.late||[]).filter(pass),now:(Z.now||[]).filter(pass),wait:(Z.wait||[]).filter(pass),fix:(Z.fix||[]).filter(pass)};
  const pairs=k=>L[k].map(i=>[i,k]),act=order(pairs('late').concat(pairs('now'))),all=act.concat(pairs('wait'),pairs('fix'));
  const N={all:all.length,late:L.late.length,now:L.now.length,wait:L.wait.length,fix:L.fix.length};
  if(!TABS.some(t=>t[0]===S.t6tab))S.t6tab='all';
  const t=new Date(),stamp=(t.getMonth()+1)+'.'+t.getDate()+' '+pad(t.getHours())+':'+pad(t.getMinutes());
  const title='<div class="tv6-title"><b>오늘 업무</b><span>오늘 할 일 · 기한 지난 일 · 회신 기다리는 일 · 기록만 채울 일 · '+stamp+' 기준</span></div>'+(ctx.word||'');
  const tabs='<div class="tv6-tabs" role="tablist">'+TABS.map(([k,l,s])=>'<button type="button" role="tab" data-t6="tab" data-v="'+k+'" aria-selected="'+(S.t6tab===k)+'"><b class="n'+(k==='late'&&N.late?' r':'')+'">'+N[k]+'</b><b>'+l+'</b><span>'+s+'</span></button>').join('')+'</div>';
  /* 왼쪽: 오늘 진단 + 기록 없음 3가지 */
  const actItems=act.map(p=>p[0]),withReq=actItems.filter(i=>(i.reqs||[]).length).length,prom=L.now.filter(promised).length,unk=act.filter(([i,z])=>elapsed(i,z).t==='기한 미확인').length;
  const wk=ctx.week||null;
  let miss=null;try{const J=root.PipelineJudge;if(J&&J.on()&&J.tally)miss=J.missCounts(J.tally(all.filter(([i])=>i.x&&i.x.type==='deal').map(([i])=>i.x.item)));}catch(e){miss=null;}
  const diag='<aside class="tv6-left"><section class="tv6-box"><header><b>오늘 진단</b><span>'+N.all+'건</span></header>'
   +'<div class="tv6-now"><span>지금 먼저</span><b>기한 지남 '+N.late+' · 오늘 처리 '+N.now+'</b><dl><dt>관리자 요청 붙은 것</dt><dd>'+withReq+'건</dd><dt>고객 약속 오늘</dt><dd>'+prom+'건</dd><dt>기한 미확인</dt><dd>'+unk+'건</dd></dl>'+(N.late?'<button type="button" class="lnk" data-t6="tab" data-v="late">다음 · 기한 지난 것부터 결과 기록</button>':N.now?'<button type="button" class="lnk" data-t6="tab" data-v="now">다음 · 오늘 처리부터 결과 기록</button>':'')+'</div>'
   +(wk?'<div class="tv6-wk"><span>'+h(wk.label)+'</span><b>'+h(wk.v)+'</b><small>'+h(wk.goal||'')+'</small></div>':'')+'</section>'
   +(miss?'<section class="tv6-box"><header><b>기록 없음 3가지</b></header>'+[['현재 업무 미수행',miss.cur,'기한 있고 넘김 · 담당 평가 · 지연 포함'],['과거 자료 미확인',miss.past,'이관 전 기록 · 보완 대상 · 평가 제외'],['해당 없음',miss.na,'그 단계에 필요 없는 정보 · 집계 제외']].map(([a,n,s])=>'<div class="tv6-miss"><b>'+a+' '+n+'</b><span>'+s+'</span></div>').join('')+'</section>':'')+'</aside>';
  /* 오른쪽: 먼저 처리할 곳 카드(기한 지남 · 오늘 처리만, 정렬 순서 앞에서) → 처리할 업무 줄 */
  const top=act.slice(0,CARDS);
  const cards=top.length?'<section class="tv6-box tv6-top dz-cards" aria-label="먼저 처리할 곳"><header><b>먼저 처리할 곳</b><span>'+top.length+'건 · 누르면 바로 결과 기록</span></header><div class="tv6-cards">'+top.map(([i,z])=>card(i,z,ctx)).join('')+'</div></section>':'';
  const list=S.t6tab==='all'?all:all.filter(p=>p[1]===S.t6tab),P=root.ListPager,pg=P?P.cut(list,S.t6page||1,PER):{rows:list.slice(0,PER),pages:1};
  const empty={all:'오늘 처리할 건이 없습니다.',late:'기한이 지난 건이 없습니다.',now:'오늘 처리할 건이 없습니다.',wait:'회신을 기다리는 건이 없습니다.',fix:'보완할 기록이 없습니다.'}[S.t6tab];
  const rows='<div class="tv6-list"><div class="tv6-lh"><b>처리할 업무 <span>'+list.length+'건</span></b><small>기한 지남 → 고객 약속 · 마감 → 들어온 순서 · 줄을 누르면 결과 기록 · 기한 기준 = 확인된 업무 기한(고객 약속 · 요청 마감 · 다음 업무 날짜)</small></div>'
   +'<div class="tv6-colh" aria-hidden="true"><span>현장 · 기한 기준</span><span>이번 할 일</span><span>마지막 기록 · 요청</span><span></span></div>'+(pg.rows.length?pg.rows.map(([i,z])=>row(i,z,ctx)).join(''):'<p class="tv6-empty">'+empty+'</p>')+'</div>'
   +(P&&pg.pages>1?P.html(pg,{ns:'t6',small:true}):'');
  return title+tabs+'<div class="tv6-body">'+diag+'<div class="tv6-right">'+cards+rows+(ctx.back||'')+'</div></div>';
 } /* 동작: 상세 창(가운데 새 창)으로. 내 건 = 응대 기록부터, 다른 담당 건(팀 화면) = 상세 */
 function onClick(e){
  const b=e.target.closest('#today-v2 [data-t6]');if(!b)return;e.stopPropagation();
  const S=root.G&&root.G.today3;if(!S)return;const a=b.dataset.t6;
  if(a==='tab'){S.t6tab=b.dataset.v;S.t6page=1;try{root.TodayV2.render();}catch(err){}return;}
  if(a==='page'){S.t6page=Number(b.dataset.page)||1;try{root.TodayV2.render();}catch(err){}return;}
  if(a==='open'){try{root.TodayWorkQueue.open(b.dataset.key,b.dataset.far==='1'?undefined:'contact');}catch(err){}}
 }
 if(typeof document!=='undefined'){document.addEventListener('click',onClick,true);document.addEventListener('keydown',e=>{const t=e.target;if((e.key==='Enter'||e.key===' ')&&t&&t.matches&&t.matches('#today-v2 .tv6-row[data-t6="open"]')){e.preventDefault();t.click();}});}
 root.TodayV6={on,html,elapsed,order,taskOf,nowOf,stageOf,TABS,card};
})(window);
