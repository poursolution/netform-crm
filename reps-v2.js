/* 영업사원 관리 v2 (2026-10-01 디자인 핸드오프 'design_handoff_reps') — 영업사원 관리 메뉴(목록 + 사람별 창)만.
   목록: 안내 줄(상태 알약 · 더보기) → 진단(숫자 4 · 카드 3 · 관리자가 할 일) → 묶음 표(한 줄 = 한 사람)
   사람별 창(가운데 모달, 탭 없음): 왼쪽 상태 진단·흐름·핵심 숫자·이번 주 약속 / 오른쪽 지금 처리할 현장(줄 = 그 현장의 파이프라인 상세)
   데이터(repFlowData)·진단(repFlowDiagnosis)·업무량(repManagerLoadLevel)·관리자 약속 저장(repManagerSaveComment)은 기존 그대로.
   '팀 비교'·'계정 관리'는 그대로 두고 [··· 더보기]에서 연다. 끄기: G.repsV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GROUPS=[['critical','관리자 확인 필요','#e5484d','첫 연락 전 · 기한 초과 · 정체가 쌓인 사람'],['watch','확인 필요','#f5a524','진전 기록이 부족한 사람'],['ok','여유','#30a46c','흐름이 정상이거나 배정 여유가 있는 사람']];
 const GRID='minmax(0,1fr) 110px 80px 80px 90px minmax(0,1.4fr) 80px 84px',COLS=['상태','Pipeline','계약완료','첫 연락 전','막힌 곳','업무량'];
 const TAG={critical:['관리자 확인 필요','r'],watch:['확인 필요','b'],ok:['여유','g']};
 const enabled=()=>!root.G.repsV2Off;
 const eok=v=>root.eok(v);
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 function rows(){root.REP_MANAGER_ROWS=root.repFlowData(true);return root.REP_MANAGER_ROWS;}
 const team=n=>{try{const p=root.repProfile(n);return p.team==='gyeongnam'?'경남지사':p.employeeType==='EXTERNAL'?'외부 영업':'본사 영업';}catch(e){return '본사 영업';}};
 function stuck(r){const parts=[];if(r.overdue)parts.push('기한초과 '+r.overdue);if(r.stale)parts.push('정체 '+r.stale);if(r.noNext)parts.push('할 일 없음 '+r.noNext);if(!parts.length&&r.unresponded)return '신규 배정 미착수';if(!parts.length&&!r.weekTracked)return '단계 변경 기록 없음';return parts.join(' · ')||'막힌 곳 없음';}
 function diagnosis(R){
  const D=root.PipelineDiagnosis;if(!D)return '';
  const sum=f=>R.reduce((a,r)=>a+(Number(f(r))||0),0),pipe=sum(r=>r.pipeline),openN=sum(r=>r.current.length),noAmt=R.reduce((a,r)=>a+r.current.filter(d=>!root.oppAmt(d)).length,0),near=sum(r=>r.near),nearN=R.reduce((a,r)=>a+r.current.filter(d=>['compete','imminent','bidding','contract'].includes(root.dealStage(d))).length,0),risk=sum(r=>r.risk),un=sum(r=>r.unresponded),stale=sum(r=>r.stale),tracked=sum(r=>r.weekTracked);
  const K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''});
  const top=R.map(r=>({r,score:r.risk*5+r.unresponded*4+r.overdue*4+r.noNext*2+(r.weekTracked&&!r.weekAdvanced?5:0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
  const tasks=top.map(({r})=>{const main=r.unresponded>=r.overdue&&r.unresponded>0?['첫 연락 전 '+r.unresponded+'건','금요일까지 신규 배정 첫 연락 완료']:r.overdue?['기한초과 '+r.overdue+'건','기한 지난 다음 할 일부터 정리']:r.stale?['정체 '+r.stale+'건','장기 정체 현장 3건 진행·보류 정리']:['할 일 없음 '+r.noNext+'건','진행 현장마다 다음 할 일 등록'];return {basis:r.nm+' '+main[0],todo:main[1],who:r.nm+' · 이번 주',rep:r.nm};});
  return D.render({accent:'blue',
   kpis:[K('전체 진행',eok(pipe),openN+'건 · 금액 미입력 '+noAmt),K('가중 예상',eok(sum(r=>r.forecast)),'단계 확률 적용'),K('확정 임박',eok(near),nearN+'건 · 경쟁·입찰~계약','good'),K('조치 필요',risk+'건','첫 연락 전 '+un+' · 정체 '+stale,risk?'bad':'')],
   cards:[{title:'어디서 막혔나',desc:'팀 전체 병목',bars:[['첫 연락 전',un],['다음 할 일 없음',sum(r=>r.noNext)],['정체',stale],['기한 초과',sum(r=>r.overdue)],['금액 미입력',noAmt]].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]),empty:'막힌 곳이 없습니다'},
    {title:'누가 일이 몰렸나',desc:'담당별 Pipeline · 단위 억',bars:R.filter(r=>r.pipeline>0).sort((a,b)=>b.pipeline-a.pipeline).slice(0,5).map(r=>[r.nm,Math.round(r.pipeline/1e7)/10,r.current.length+'건']),empty:'진행 금액이 없습니다'},
    {title:'이번 주 진전',desc:'지난 7일 실제 기록',rows:[['신규 기회',sum(r=>r.weekNew),'+'+sum(r=>r.weekNew)],['단계 진전',sum(r=>r.weekAdvanced),tracked?'+'+sum(r=>r.weekAdvanced):'수집 중'],['수주',sum(r=>r.weekWon),'+'+sum(r=>r.weekWon)]]}],
   action:{title:'관리자가 할 일',desc:'코칭 · 약속',tasks}},{open:true,noToggle:true,taskButton:x=>{const c=root.repManagerComment(x.rep,root.repManagerWeekKey(0));return '<button type="button" class="it-btn'+(c?' ghost':'')+'" data-rv="promise" data-value="'+attr(x.rep)+'">'+(c?'약속 수정':'약속 등록')+'</button>'+(c?'<small class="it-done">이번 주 약속 · '+h(String(c.comment).slice(0,24))+'</small>':'');}});
 }
 function rowHtml(r){
  const t=TAG[r.diagnosis.k]||TAG.watch,load=root.repManagerLoadLevel(r);
  return '<div class="plv-row" role="row" tabindex="0" data-rv="open" data-value="'+attr(r.nm)+'" data-rep="'+attr(r.nm)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b>'+h(r.nm)+'</b><small>'+h(team(r.nm))+'</small></span>'
   +'<span class="plv-c"><em class="plv-tag '+t[1]+'">'+t[0]+'</em></span>'
   +'<span class="plv-c"><span class="'+(r.pipeline?'':'m')+'">'+h(eok(r.pipeline))+'</span></span>'
   +'<span class="plv-c"><span class="'+(r.wonAmount?'':'m')+'">'+h(eok(r.wonAmount))+'</span></span>'
   +'<span class="plv-c"><span class="'+(r.unresponded?'r':'m')+'">'+r.unresponded+'건</span></span>'
   +'<span class="plv-c"><span class="'+(/없음$/.test(stuck(r))&&!/할 일/.test(stuck(r))?'m':'a')+'" title="'+attr(r.diagnosis.text)+'">'+h(stuck(r))+'</span></span>'
   +'<span class="plv-c"><span class="'+(load.cls==='heavy'||load.cls==='busy'?'r':load.cls==='free'?'g':'')+'">'+h(load.label)+'</span></span>'
   +'<button type="button" class="plv-cta" data-rv="open" data-value="'+attr(r.nm)+'">업무 보기</button></div>';
 }
 function listHtml(R){
  const f=root.G.repsStatus||'all',period=root.repManagerPeriodWindow(),cy=Number(root.CUR_Y);
  const pills='<div class="plv-pills" role="group" aria-label="상태">'+[['all','전체',R.length]].concat(GROUPS.map(g=>[g[0],g[1],R.filter(r=>r.diagnosis.k===g[0]).length])).map(([v,t,n])=>'<button type="button" data-rv="status" data-value="'+v+'" aria-pressed="'+(f===v)+'"'+(n?'':' class="zero"')+'>'+h(t)+' <b>'+n+'</b></button>').join('')+'</div>';
  const menu='<details class="av-more"><summary>··· 더보기</summary><div class="av-menu"><button type="button" data-rv="team">팀 비교</button><button type="button" data-rv="account">계정 관리</button><label>조회 연도 <select data-rv-year aria-label="조회 연도">'+[String(cy),String(cy-1),String(cy-2),'전체'].map(y=>'<option'+(String(root.G.repManagerYear||cy)===y?' selected':'')+'>'+y+'</option>').join('')+'</select></label></div></details>';
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>영업사원</b><div class="plv-spacer"></div>'+pills+menu+'</div><p class="rv-basis">영업사원 '+R.length+'명 · '+h(period.label)+' 기준 <span>아래 숫자 · 카드 · 표는 모두 이 기준입니다</span></p>';
  const head='<div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>이름 · 소속</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>';
  const groups=GROUPS.filter(g=>f==='all'||g[0]===f).map(([id,title,color,desc])=>{const list=R.filter(r=>r.diagnosis.k===id).sort((a,b)=>b.risk-a.risk||b.unresponded-a.unresponded||b.pipeline-a.pipeline);return '<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+h(title)+'</b><span>'+list.length+'명</span><small>· '+h(desc)+'</small></div>'+(list.length?list.map(rowHtml).join(''):'<div class="plv-empty">해당하는 사람이 없습니다</div>');}).join('');
  return '<div id="reps-v2" class="plv" data-workspace="reps">'+intro+diagnosis(R)+'<div class="plv-table" role="table" aria-label="영업사원 목록">'+head+groups+'</div></div>';
 }
 function onClick(e){
  const b=e.target.closest('#reps-v2 [data-rv]');if(!b)return;const a=b.dataset.rv,v=b.dataset.value;
  if(a==='status'){root.G.repsStatus=v;root.paintRepManagement();}
  if(a==='team')root.repManagerView('team');
  if(a==='account'){b.closest('details')?.removeAttribute('open');root.AccountAdmin?.open?.();}
  if(a==='open')open(v);
  if(a==='promise'){open(v);setTimeout(()=>(document.querySelector('#repWindow.on [data-rw-f="promise"]')||document.querySelector('#repsDialog textarea'))?.focus(),50);}
 }
 function paint(host){
  host.innerHTML=listHtml(rows());
  if(!host.__rv){host.__rv=true;host.addEventListener('click',onClick);host.addEventListener('change',e=>{if(e.target.matches('[data-rv-year]')){root.G.repManagerYear=e.target.value;root.G.repManagerQuarter=0;root.paintRepManagement();}});host.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
  if(root.G.page==='repmanage'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='영업사원 관리';if(p)p.textContent='누구를 먼저 챙길지 — 흐름 · 병목 · 업무량 · 코칭 약속을 한 곳에서';}
  if(openRep)render();
 }
 /* ── 사람별 창 ── */
 let openRep=null,returnFocus=null;
 function node(){
  let m=document.getElementById('repsDialog');if(m)return m;
  m=document.createElement('div');m.id='repsDialog';m.className='rd-layer';m.innerHTML='<section class="rd-box" role="dialog" aria-modal="true" aria-labelledby="rdTitle"></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)close();});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  m.addEventListener('click',onDialogClick);
  document.body.append(m);return m;
 }
 function dialogHtml(r){
  const t=TAG[r.diagnosis.k]||TAG.watch,load=root.repManagerLoadLevel(r),week=root.repManagerWeekKey(0),c=root.repManagerComment(r.nm,week),idx=(typeof REP_INTERNAL!=='undefined'?REP_INTERNAL:root.REP_INTERNAL||[]).indexOf(r.nm);
  const flow=[['배정',r.assigned],['응대',r.responded],['기회',r.opps],['경쟁',r.compete],['수주',r.won]],base=Math.max(1,...flow.map(x=>x[1]));
  const left='<p class="rd-diag '+r.diagnosis.k+'">'+h(r.diagnosis.text)+'</p>'
   +'<div class="rd-block"><b>흐름</b>'+flow.map((x,i)=>'<div class="rd-flow"><span>'+x[0]+'</span><i><em class="'+(i===4?'g':'')+'" style="width:'+Math.max(x[1]?4:0,Math.round(x[1]*100/base))+'%"></em></i><b>'+x[1]+'</b></div>').join('')+'</div>'
   +'<div class="rd-three"><div><span>Pipeline</span><b>'+h(eok(r.pipeline))+'</b></div><div class="'+(r.risk?'bad':'')+'"><span>조치 필요</span><b>'+r.risk+'건</b></div><div class="'+(load.cls==='heavy'||load.cls==='busy'?'bad':load.cls==='free'?'good':'')+'"><span>업무량</span><b>'+h(load.label)+'</b></div></div>'
   +'<div class="rd-block rd-promise"><b>이번 주 약속</b><textarea id="rm-comment-'+idx+'" rows="3" maxlength="300" placeholder="예: 금요일까지 신규 배정 첫 연락 완료">'+h(c?c.comment:'')+'</textarea><div><button type="button" class="sv-primary" data-rd="save">저장</button>'+(c?'<small>'+(c.status==='done'?'완료 처리됨':'저장됨')+' · '+h(String(c.updated_at||'').slice(0,10))+'</small>':'')+'</div></div>';
  const list=r.riskDeals.slice().sort((a,b)=>root.oppAmt(b)-root.oppAmt(a));
  const right='<header><b>지금 처리할 현장</b><span>'+list.length+'건 · 금액 큰 순</span></header><div class="rd-list">'+(list.length?list.map(d=>'<button type="button" class="rd-row" data-rd="deal" data-value="'+attr(root.dealKey(d))+'"><b>'+h(d.site||'현장명 미입력')+'</b><em>'+h(root.perfIssueSummary(d))+'</em><span>'+h(root.oppAmt(d)?eok(root.oppAmt(d)):'금액 미입력')+'</span><u>처리</u></button>').join(''):'<p class="rd-none">조치가 필요한 현장이 없습니다.</p>')+'</div><button type="button" class="rd-all" data-rd="all">'+h(r.nm)+' 현장 전체보기 →</button>';
  return '<header class="rd-head"><h2 id="rdTitle">'+h(r.nm)+'</h2><em class="plv-tag '+t[1]+'">'+t[0]+'</em><span>'+h(team(r.nm))+'</span><button type="button" class="xdv-close" data-rd="close" aria-label="닫기">✕</button></header><div class="rd-body"><aside class="rd-left">'+left+'</aside><main class="rd-right">'+right+'</main></div>';
 }
 function render(){const r=(root.REP_MANAGER_ROWS||[]).find(x=>x.nm===openRep);if(!r){close();return;}node().querySelector('.rd-box').innerHTML=dialogHtml(r);}
 function open(name){if(root.RepWindow&&root.RepWindow.enabled()){root.RepWindow.open(name);return;}if(!(root.REP_MANAGER_ROWS||[]).some(x=>x.nm===name))rows();openRep=name;returnFocus=document.activeElement;const m=node();render();if(!openRep)return;m.classList.add('on');m.querySelector('.xdv-close')?.focus();}
 function close(restore){if(root.RepWindow&&root.RepWindow.isOpen())root.RepWindow.close(restore);const m=document.getElementById('repsDialog');if(m)m.classList.remove('on');const f=returnFocus;openRep=null;returnFocus=null;if(restore!==false&&f&&f.isConnected)f.focus?.({preventScroll:true});}
 function onDialogClick(e){
  const b=e.target.closest('[data-rd]');if(!b||!openRep)return;const a=b.dataset.rd,r=(root.REP_MANAGER_ROWS||[]).find(x=>x.nm===openRep);if(!r)return;
  if(a==='close')close();
  if(a==='save'){const ta=node().querySelector('textarea');if(!ta.value.trim()){ta.focus();return;}root.repManagerSaveComment(r.nm,'card');toast(r.nm+' · 이번 주 약속을 저장했습니다');}
  if(a==='deal'){const d=r.riskDeals.find(x=>root.dealKey(x)===b.dataset.value);if(d){close(false);root.G._detailPopup=true;root.drwDeal(JSON.stringify(d));}}
  if(a==='all'){const name=r.nm;close(false);root.CommonFilterBar?.setOwner(name);root.goPage('today');}
 }
 function boot(){
  const base=root.paintRepManagement;if(typeof base!=='function')return;
  root.paintRepManagement=function(){
   const host=document.getElementById('rep-management-root');
   if(!enabled()||root.G.repManagerView==='team'||!host){close(false);return base.apply(this,arguments);}
   try{paint(host);}catch(e){console.warn('[영업사원 v2]',e);return base.apply(this,arguments);}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.RepsV2={enabled,open,close};
})(window);
