/* 관리팀 KPI v2 (2026-10-01 디자인 핸드오프 'design_handoff_kpi') — 관리팀 KPI 메뉴만.
   위쪽 공통 틀: 안내 줄 → 숫자 4(목표·문제 건수) → 분석 카드 3(어디서 멈췄나 · 병목 구간 · 기록이 되고 있나) → 약속 카드 → 담당별 묶음 표
   약속 카드: 기본 약속 12개를 지금 CRM 기록으로 잰다(hit/total) + '지금 내가 할 것' 목록 — 버튼은 기존 배정·상세·관리자 약속·경남지사 확인 창으로 연결.
   집계는 기존 managementStats / RecordingKPI / repFlowData / expansionRecords / gnData 그대로. 저장하지 않는다.
   ※ 저장소가 필요한 것(약속 직접 추가·AI 추천, 최근 4주 결과·연속 미달 주 수, 처리 기록, 강제 적용 플래그)은 스키마 확인 뒤에 붙인다 — 지금은 '이번 주'만 잰다. 강제 적용은 없다(꺼짐).
   끄기: G.kpiV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GROUPS=[['act','조치 필요','#e5484d','미응대 · 정체가 쌓인 담당'],['low','기록 부족 · 지표 참고용','#9ca3af','기록률 70% 미만 — 숫자보다 기록부터'],['ok','정상','#30a46c','목표 범위 안']];
 const GRID='minmax(0,1fr) repeat(6,minmax(0,52px)) minmax(0,70px) 76px',COLS=['진행','미응대','할 일 없음','기한초과','정체','미입력','기록률'];
 const BUCKETS=['배정 · 응대','진행 관리','기록 · 데이터','코칭','고객 관리'];
 const enabled=()=>!root.G.kpiV2Off;
 const pct=(a,b)=>b?Math.round(a*1000/b)/10:null;
 const names=()=>(root.PERFORMANCE_TARGET_NAMES||[]).slice();
 const dealName=d=>d.site||'현장명 미입력';
 /* ── 약속 12개: 지금 기록으로 잰다. item = {label, why, act:[버튼, 종류, 값]} ── */
 function promises(S){
  const out=[],P=(bucket,text,how,target,force,hit,total,items,unit,note)=>out.push({bucket,text,how,target,force,hit,total,items:items||[],unit:unit||'건',note:note||''});
  const inqItem=(q,why,btn)=>({label:q.site||'현장명 미입력',why,act:[btn,'inq',root.inqKey(q)]}),dealItem=(d,why,btn)=>({label:dealName(d),why,act:[btn,'deal',root.dealKey(d)]});
  const days=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?Math.max(0,Math.floor((Date.now()-t)/864e5)):null;};
  const sameDay=(S.sameDayAssigned||[]).length;
  P('배정 · 응대','견적문의는 그날 담당을 정한다','당일 배정 ÷ 접수',95,'오후 5시 자동 배정',sameDay,S.Q.length,S.unassigned.slice(0,6).map(q=>inqItem(q,'미배정 '+(days(root.inquiryCreatedAt(q))??'?')+'일','담당 정하기')));
  const assigned=S.Q.filter(root.inquiryAssigned),noResp=S.noResponse;
  P('배정 · 응대','배정되면 '+(root.INQUIRY_RESPONSE_SLA_HOURS||2)+'시간 안에 첫 전화','시간 내 연락 기록 ÷ 배정',90,'무응답 시 자동 재배정',S.responseRate==null?0:Math.round(S.responseRate*assigned.length/100),assigned.length,noResp.slice(0,6).map(q=>inqItem(q,(root.repN(root.inquiryRoutedOwner?.(q)||q.assignee)||'담당')+' · 첫 연락 없음','담당에게 전화')));
  const rk=root.RecordingKPI?root.RecordingKPI.stats('전체',0):{deals:0,activeN:0},low=names().map(n=>({n,s:root.RecordingKPI?root.RecordingKPI.stats(n,0):{activity:null,deals:0}})).filter(x=>x.s.deals&&x.s.activity!=null&&x.s.activity<70);
  P('기록 · 데이터','통화하면 결과를 남긴다','7일 내 기록 있는 진행 건 ÷ 진행',70,'회의 안건',rk.activeN||0,rk.deals||0,low.slice(0,6).map(x=>({label:x.n,why:'활동 기록률 '+x.s.activity+'%',act:['기록 요청','rep',x.n]})));
  let R=[];try{R=root.repFlowData(true);}catch(e){R=[];}
  const crit=R.filter(r=>r.diagnosis.k==='critical'),week=root.repManagerWeekKey?root.repManagerWeekKey(0):'',kept=crit.filter(r=>root.repManagerComment(r.nm,week));
  P('코칭','막힌 담당과 매주 1:1','약속 저장 담당 ÷ 조치 필요 담당',100,'팀장 알림',kept.length,crit.length,crit.filter(r=>!root.repManagerComment(r.nm,week)).slice(0,6).map(r=>({label:r.nm,why:r.diagnosis.text,act:['1:1 약속 쓰기','promise',r.nm]})),'명');
  const D=S.D,amt=d=>root.oppAmt(d),big=l=>l.slice().sort((a,b)=>amt(b)-amt(a));
  P('진행 관리','진행 건엔 다음 할 일이 항상 있다','다음 할 일 있는 건 ÷ 진행',95,'없으면 단계 이동 불가',D.length-S.nextMissing.length,D.length,big(S.nextMissing).slice(0,6).map(d=>dealItem(d,root.repN(d.assignee)+' · 다음 할 일 없음','할 일 지정 요청')));
  const resolved=(root.LOCAL?.resolvedStale||[]).filter(x=>Date.now()-new Date(x.at).getTime()<7*864e5).length;
  P('진행 관리','30일+ 멈춘 건은 이번 주 정리','정체 해소 ÷ 정체',50,'회의 안건',resolved,resolved+S.stale.length,big(S.stale).slice(0,6).map(d=>dealItem(d,root.repN(d.assignee)+' · '+(typeof root.stageAge==='function'&&root.stageAge(d)!=null?root.stageAge(d)+'일 정체':'장기 정체'),'정리 요청')));
  P('진행 관리','견적은 방문 후 3일 안 발송','3일 내 견적 ÷ 방문',90,'회의 안건',0,0,[],'건','방문 기록과 견적 발송 기록을 잇는 기준이 아직 없어 측정 준비 중입니다');
  P('기록 · 데이터','금액 · 공종 · 연락처를 채운다','필수정보 완성 ÷ 진행',95,'저장 시 필수',D.length-S.incomplete.length,D.length,big(S.incomplete).slice(0,6).map(d=>dealItem(d,root.repN(d.assignee)+' · 필수정보 '+(root.crmRequiredMissing?root.crmRequiredMissing(d):'')+'개 비어 있음','기록 요청')));
  const lost=(root.B?.deals||[]).filter(d=>(root.outcomeOf?root.outcomeOf(d):d.outcome)==='lost'),reasonOf=d=>d.lost_reason||d.stage_contexts?.lost?.fields?.close_reason||'',q0=new Date(Date.now()-90*864e5).toLocaleDateString('en-CA')/* 분기 첫 주에 비지 않게 최근 90일 */,lostQ=lost.filter(d=>String(d.closed_at||d.closed||'').slice(0,10)>=q0);
  P('기록 · 데이터','실주하면 사유를 남긴다','사유 있는 실주 ÷ 최근 90일 실주',100,'회의 안건',lostQ.filter(reasonOf).length,lostQ.length,lostQ.filter(d=>!reasonOf(d)).slice(0,6).map(d=>dealItem(d,root.repN(d.assignee)+' · 사유 없음','사유 요청')));
  let X=[];try{X=root.expansionRecords().filter(r=>!root.ExpansionFlow.converted(r)&&root.ExpansionFlow.status(r)!=='보류');}catch(e){X=[];}
  P('고객 관리','준공 고객 한 달 안 하자 점검 연락','연락 기록 있는 준공 고객 ÷ 준공 고객',90,'준공 시 확장관리 자동 생성',X.filter(r=>r.lastContactAt).length,X.length,X.filter(r=>!r.lastContactAt).slice(0,6).map(r=>({label:r.site,why:(r.owner||'미배정')+' · 접촉 기록 없음',act:['연락 기록','exp',r.id]})),'곳');
  let T=[];const G=root.G,old=G.campaignCategory;try{G.campaignCategory='all';T=root.campaignAllTargets();}catch(e){T=[];}finally{G.campaignCategory=old;}
  P('고객 관리','통화할 때 수신 동의를 받는다','동의 확보 ÷ 연락처',70,'연락 결과에 동의 필수',T.filter(t=>t.contact.smsConsent&&t.contact.consentAt).length,T.length,[],'명');
  let GN=[];try{GN=root.gnData().Q.map(q=>({q,f:root.GyeongnamV2.facts(q)}));}catch(e){GN=[];}
  const gnStall=GN.filter(x=>x.f.group!=='ok'),asked=x=>{const p=root.itemPatch(x.q,'inq')||{};return [...(x.q.activities||[]),...(p.activities||[])].some(a=>String(a.note||'').startsWith('[지사 확인 요청]')&&Date.now()-Date.parse(a.at||a.created_at||0)<7*864e5);};
  P('고객 관리','경남지사 넘긴 건 7일마다 확인','확인 ÷ 멈춘 넘긴 건',100,'본사 회수 검토',gnStall.filter(asked).length,gnStall.length,gnStall.filter(x=>!asked(x)).slice(0,6).map(x=>({label:x.q.site||'현장명 미입력',why:'넘긴 지 '+(x.f.days??'?')+'일 · '+(x.f.rep?'지사 응대 없음':'지사 미착수'),act:['지사에 확인 요청','gn',root.inqKey(x.q)]})));
  out.forEach((p,i)=>{p.id='kp'+i;p.rate=pct(p.hit,p.total);p.kept=p.total>0&&p.rate>=p.target;p.pending=!p.total;});
  return out;
 }
 function promiseHtml(list){
  const f=root.G.kpiBucket||'all',shown=list.filter(p=>f==='all'||p.bucket===f),todo=list.reduce((a,p)=>a+p.items.length,0),kept=list.filter(p=>p.kept).length;
  const pills='<div class="plv-pills" role="group" aria-label="약속 묶음">'+[['all','전체']].concat(BUCKETS.map(b=>[b,b])).map(([v,t])=>'<button type="button" data-kv="bucket" data-value="'+attr(v)+'" aria-pressed="'+(f===v)+'">'+h(t)+'</button>').join('')+'</div>';
  const cards=shown.map(p=>{
   const state=p.pending?['측정 준비 중','m']:p.kept?['지킴','g']:['진행 중','o'];
   const items=p.items.map(it=>'<li><span>'+h(it.label)+'</span><em>'+h(it.why)+'</em><button type="button" data-kv="act" data-kind="'+attr(it.act[1])+'" data-value="'+attr(it.act[2])+'">'+h(it.act[0])+'</button></li>').join('');
   return '<article class="kv-card'+(p.kept?' kept':'')+'" data-promise="'+p.id+'"><header><small>'+h(p.bucket)+'</small><em class="plv-tag '+state[1]+'">'+state[0]+'</em></header><h4>“'+h(p.text)+'”</h4>'
    +'<div class="kv-result"><b>'+(p.pending?'–':p.hit.toLocaleString('ko-KR')+' / '+p.total.toLocaleString('ko-KR'))+'</b><span>'+h(p.unit)+(p.rate==null?'':' · '+p.rate+'%')+' · 목표 '+p.target+'%</span><small>'+h(p.note||'재는 법: '+p.how)+'</small></div>'
    +'<div class="kv-weeks" aria-label="최근 4주"><i title="3주 전 — 기록 없음"></i><i title="2주 전 — 기록 없음"></i><i title="지난주 — 기록 없음"></i><i class="'+(p.pending?'':p.kept?'ok':'no')+'" title="이번 주"></i><span>이번 주부터 측정 · 지난 주 결과는 주간 저장이 켜지면 쌓입니다</span></div>'
    +(p.items.length?'<div class="kv-todo"><b>지금 내가 할 것 <u>'+p.items.length+'</u></b><ul>'+items+'</ul></div>':p.kept?'<div class="kv-todo done">이번 주 할 일 끝</div>':'')
    +'<p class="kv-rule">안 하면 → 1주 팀장 알림 · 2주 팀장 회의 안건 · 3주 '+h(p.force)+' <i>(강제 적용은 꺼져 있습니다)</i></p></article>';
  }).join('');
  return '<section class="kv-promises" id="kv-promises"><header><div><b>이번 주 관리팀 약속 '+list.length+'가지</b><span>아래 할 일을 처리하면 숫자가 바로 올라갑니다</span></div><em class="kv-left">오늘 내가 할 것 '+todo+'개 남음</em><span class="kv-kept">지킨 약속 '+kept+' / '+list.length+'</span><button type="button" class="sv-ghost" data-kv="settings">✦ KPI 설정</button></header>'+pills+'<div class="kv-grid">'+cards+'</div></section>';
 }
 function topHtml(S){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const collecting=S.D.length>0&&S.nextMissing.length===S.D.length,K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''});
  const v=(x,suffix)=>x==null?'수집 중':x+'%';
  const stages=(root.PD_COLS||[]).map((c,i)=>[c.t,S.D.filter(d=>root.pdStageIndex(d)===i).length]).filter(x=>x[1]>0);
  const rk=root.RecordingKPI?root.RecordingKPI.stats('전체',0):null;
  const rec=rk?[['첫 연락 기록률',rk.first==null?0:rk.first,'최근 14일 배정 '+rk.inq+'건 중 '+rk.firstN+'건'],['활동 기록률',rk.activity==null?0:rk.activity,'진행 '+rk.deals+'건 중 7일 내 '+rk.activeN+'건'],['다음 할 일 등록률',rk.next==null?0:rk.next,'진행 '+rk.deals+'건 중 '+rk.nextN+'건']]:[];
  return D.render({accent:'blue',
   kpis:[K('당일 배정률',v(S.assignRate),'목표 95% · 문제 '+(S.Q.length-(S.sameDayAssigned||[]).length)+'건',S.assignRate!=null&&S.assignRate<95?'bad':''),K('첫 연락 '+(root.INQUIRY_RESPONSE_SLA_HOURS||2)+'시간 내',v(S.responseRate),'목표 90% · 문제 '+S.noResponse.length+'건',S.responseRate!=null&&S.responseRate<90?'bad':''),K('다음 할 일 지정률',collecting?'수집 중':S.nextRate+'%','목표 95% · 문제 '+S.nextMissing.length+'건',!collecting&&S.nextRate<95?'bad':''),K('장기정체 비율',collecting?'수집 중':S.staleRate+'%','목표 10% 이하 · 문제 '+S.stale.length+'건',!collecting&&S.staleRate>10?'bad':'')],
   cards:[{title:'어디서 멈췄나',desc:'즉시 조치 필요',bars:[['미배정',S.unassigned.length],['미응대',S.noResponse.length],['다음 할 일 없음',S.nextMissing.length],['장기정체',S.stale.length],['CRM 필수정보 미입력',S.incomplete.length]].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),empty:'멈춘 곳이 없습니다'},{title:'병목 구간',desc:'단계별 진행 건수',bars:stages.sort((a,b)=>b[1]-a[1]),empty:'진행 중인 현장이 없습니다'},{title:'기록이 되고 있나',desc:'첫 2주 핵심 · 목표 70% · 단위 %',rows:rec.map(r=>[r[0],r[1]+'%',r[2]])}],
   action:{title:'',desc:'',tasks:[]}},{open:root.G.plvDiagShut!==true}).replace(/<section class="pd-action">[\s\S]*?<\/section>/,'');
 }
 function tableHtml(){
  const f=root.G.kpiGroup||'all';
  const rows=names().map(n=>{const x=root.managementStats(n),rk=root.RecordingKPI?root.RecordingKPI.stats(n,0):{activity:null},prev=root.RecordingKPI?root.RecordingKPI.stats(n,7):{activity:null},issues=x.noResponse.length+x.nextMissing.length+x.overdue.length+x.stale.length;return {n,x,rate:rk.activity,prev:prev.activity,group:issues>0&&x.D.length>0?'act':(rk.activity==null||rk.activity<70)?'low':'ok'};});
  const num=(n,red)=>'<span class="plv-c"><span class="'+(n?(red?'r':''):'m')+'">'+n+'</span></span>';
  const rowHtml=r=>'<div class="plv-row" role="row" tabindex="0" data-kv="rep" data-value="'+attr(r.n)+'" data-rep="'+attr(r.n)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b>'+h(r.n)+'</b><small>본사 영업</small></span>'+num(r.x.D.length,false)+num(r.x.noResponse.length,true)+num(r.x.nextMissing.length,true)+num(r.x.overdue.length,true)+num(r.x.stale.length,true)+num(r.x.incomplete.length,true)
   +'<span class="plv-c"><span class="'+(r.rate==null?'m':r.rate>=70?'g':r.rate>=50?'a':'r')+'">'+(r.rate==null?'대상 없음':r.rate+'%'+(r.prev!=null&&r.prev!==r.rate?' '+(r.rate>r.prev?'▲':'▼')+Math.abs(r.rate-r.prev):''))+'</span></span><button type="button" class="plv-cta" data-kv="rep" data-value="'+attr(r.n)+'">문제 현장</button></div>';
  const pills='<div class="plv-pills" role="group" aria-label="담당 상태">'+[['all','전체',rows.length]].concat(GROUPS.map(g=>[g[0],g[1].split(' · ')[0],rows.filter(r=>r.group===g[0]).length])).map(([v,t,n])=>'<button type="button" data-kv="group" data-value="'+v+'" aria-pressed="'+(f===v)+'">'+h(t)+' <b>'+n+'</b></button>').join('')+'</div>';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>담당</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const body=GROUPS.filter(g=>f==='all'||g[0]===f).map(([id,title,color,desc])=>{const list=rows.filter(r=>r.group===id).sort((a,b)=>(b.x.noResponse.length+b.x.stale.length)-(a.x.noResponse.length+a.x.stale.length));return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length+'명</span><small>· '+h(desc)+'</small></div>'+(list.length?list.map(rowHtml).join(''):'<div class="plv-empty">해당하는 담당이 없습니다</div>');}).join('');
  return '<div class="kv-tablehead"><b>담당별</b>'+pills+'</div><div class="plv-table" role="table" aria-label="담당별 KPI">'+head+body+'</div>';
 }
 function html(){
  const S=root.managementStats(root.targetNameFilter()),list=promises(S);
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>관리팀 KPI</b><span>영업이 멈추지 않게 — 배정 → 첫 연락 → 다음 할 일 → 정체 해소 → 데이터 완성</span></div>';
  return '<div id="kpi-v2" class="plv" data-workspace="kpi">'+intro+topHtml(S)+promiseHtml(list)+tableHtml()+'</div>';
 }
 function openRep(name,focus){if(root.RepsV2&&root.RepsV2.enabled()){root.RepsV2.open(name);if(document.getElementById('repsDialog')?.classList.contains('on')){if(focus)setTimeout(()=>document.querySelector('#repsDialog textarea')?.focus(),50);return;}}root.goPerfRep?.(name);}
 function settings(){
  document.getElementById('kvSettings')?.remove();const m=document.createElement('div');m.id='kvSettings';m.className='it-layer';
  m.innerHTML='<section class="it-box" role="dialog" aria-modal="true" aria-labelledby="kvSetTitle"><header><small>관리팀 KPI</small><h2 id="kvSetTitle">KPI 설정 — 저장소 확인 뒤에 열립니다</h2></header><div class="it-body"><p class="kv-setnote">약속을 직접 만들거나 AI 추천을 추가하려면 새 저장소(약속 정의 · 주간 결과 · 처리 기록)가 필요합니다. 스키마를 확인받은 뒤에 켭니다.</p><ul class="kv-setlist"><li><b>AI 추천 KPI</b> — 진단 숫자 · 병목 · 실주 사유 · 정체 목록으로 주 1회 생성(서버 함수에서 Claude API 호출)</li><li><b>직접 만들기</b> — 약속 문장 · 재는 법 · 목표 · 주기 · 책임 · 안 되면</li><li><b>최근 4주 · 연속 미달 주 수</b> — 주간 결과 저장이 켜지면 쌓입니다</li><li><b>강제 적용</b> — 플래그만 두고 기본은 꺼 둡니다</li></ul></div><footer><button type="button" class="it-btn ghost" data-close>닫기</button></footer></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)m.remove();});m.addEventListener('click',e=>{if(e.target.closest('[data-close]'))m.remove();});m.addEventListener('keydown',e=>{if(e.key==='Escape')m.remove();});
  document.body.append(m);m.querySelector('button').focus();
 }
 function onClick(e){
  const pd=e.target.closest('[data-pd="toggle"]');if(pd&&pd.closest('#kpi-v2')){root.G.plvDiagShut=root.G.plvDiagShut!==true;root.paintMgmt();return;}
  const b=e.target.closest('#kpi-v2 [data-kv]');if(!b)return;const a=b.dataset.kv,v=b.dataset.value;
  if(a==='bucket'){root.G.kpiBucket=v;root.paintMgmt();}
  if(a==='group'){root.G.kpiGroup=v;root.paintMgmt();}
  if(a==='settings')settings();
  if(a==='rep')openRep(v);
  if(a==='act'){
   const k=b.dataset.kind;
   if(k==='inq'||k==='gn')root.InquiryWorkbench.openFrom(v,'mgmt');
   if(k==='deal'){const d=(root.B.deals||[]).find(x=>root.dealKey(x)===v);if(d){root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}}
   if(k==='rep')openRep(v);
   if(k==='promise')openRep(v,true);
   if(k==='exp')root.ExpansionPool.open(v);
  }
 }
 function boot(){
  const base=root.paintMgmt;if(typeof base!=='function')return;
  root.paintMgmt=function(){
   const host=document.getElementById('mgmt-root');
   if(!enabled()||!host)return base.apply(this,arguments);
   try{host.innerHTML=html();if(!host.__kv){host.__kv=true;host.addEventListener('click',onClick);host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
    if(root.G.page==='mgmt'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='관리팀 KPI';if(p)p.textContent='영업이 멈추지 않게 — 배정 → 첫 연락 → 다음 할 일 → 정체 해소 → 데이터 완성';}
   }catch(e){console.warn('[관리팀 KPI v2]',e);return base.apply(this,arguments);}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.KpiV2={enabled,promises};
})(window);
