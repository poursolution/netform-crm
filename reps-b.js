/* 영업사원 관리 — 파이프라인 B안 틀 (2026-10-03 대표: "영업사원 관리도 비슷하게 가도 될 거 같아")
   한 줄 = 한 사람. StageBoard 공용 부품으로 왼쪽 팀 진단(관리자 확인 필요 · 확인 필요 · 여유 막대 3칸 · 숫자 3개 · 왜 멈춰 있나 · 관리자가 할 일 · 이번 주 진전) / 오른쪽 확인할 사람(리스트 · 보드).
   데이터(repFlowData) · 진단(repFlowDiagnosis) · 업무량(repManagerLoadLevel) · 사람별 창 · 관리자 약속 저장은 reps-v2 그대로. 팀 비교 · 계정 관리는 [··· 더보기].
   끄기: G.repsBOff=true → 영업사원 v2 묶음 표. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const SB=()=>root.StageBoard,V=()=>root.RepsV2;
 const RED='#d93a3a',INK='#374151';
 const enabled=()=>!root.G.repsBOff&&!root.G.repsV2Off&&!!root.StageBoard&&!!root.RepsV2;
 const eok=v=>root.eok(v);
 const team=n=>{try{const p=root.repProfile(n);return p.team==='gyeongnam'?'경남지사':p.employeeType==='EXTERNAL'?'외부 영업':'본사 영업';}catch(e){return '본사 영업';}};
 const CFG={id:'reps-b',name:'영업사원 관리',unit:'명',stallFmt:n=>'조치 '+n+'건',stallName:'조치 필요',stallDesc:'사람당 평균 조치 필요 건수',stallRed:3,listTitle:'확인할 사람',openLabel:'업무 보기',diagTitle:'팀 진단',noAmount:true,
  desc:()=>'누구를 먼저 챙길지 — 첫 연락 · 기한 · 정체 · 다음 할 일 · 이번 주 전진으로 사람별 상태를 보고 코칭 약속을 남기는 곳 · 신규 배정은 '+(Number((root.OPS_RULES||{}).inquiryAssignMinutes)||30)+'분 안 배정 · 첫 응대 2시간',
  axis:'관리자 확인',
  S:[['critical','관리자 확인 필요','#15171c','오늘 코칭 약속 · 현장 정리'],['watch','확인 필요','#8a909c','진전 기록 확인'],['ok','여유 · 흐름 정상','#d5d9e0','배정 여유 · 수주 근접']],
  RS:{first3:['첫 연락 전 3건 이상',RED,'코칭 약속','신규 배정 첫 연락이 밀림 — 금요일까지 첫 연락 완료를 약속으로 남기고 확인','promise'],
      risk4:['위험 4건 · 이번 주 전진 0',RED,'코칭 약속','위험 현장이 쌓였는데 이번 주 단계 전진이 없음 — 현장 3건 진행 · 보류 정리 약속','promise'],
      overdue:['다음 할 일 기한 초과',RED,'업무 보기','기한 지난 다음 할 일부터 정리(완료 · 날짜 변경 · 보류)','open'],
      first:['첫 연락 전 있음',INK,'업무 보기','신규 배정 건의 첫 연락 진행 확인','open'],
      stale:['정체 현장 있음',INK,'업무 보기','장기 정체 현장은 진행 · 보류 · 실주 중 하나로 정리','open'],
      nonext:['다음 할 일 없는 현장',INK,'업무 보기','진행 현장마다 다음 행동 + 날짜 등록(완료만 선택 불가)','open'],
      noadv:['이번 주 단계 전진 없음',INK,'업무 보기','이번 주 전진 0 — 경쟁 · 계약으로 넘길 현장 확인','open'],
      heavy:['업무량 많음',INK,'재배정 검토','업무량이 몰린 사람 — 신규 배정 조절 · 재배정 검토','open'],
      promise:['이번 주 코칭 약속 없음',INK,'약속 등록','확인이 필요한 사람에게 이번 주 약속을 남겨 다음 주 확인','promise']},
  kpi2:(inB)=>{const un=inB.reduce((a,i)=>a+i.extra.r.unresponded,0),ov=inB.reduce((a,i)=>a+i.extra.r.overdue,0);return ['첫 연락 전 · 기한 초과',un+'건 · '+ov+'건','팀 전체 합계'];},
  kpi3:(inB)=>{const adv=inB.reduce((a,i)=>a+(i.extra.r.weekAdvanced||0),0),won=inB.reduce((a,i)=>a+(i.extra.r.weekWon||0),0),tracked=inB.some(i=>i.extra.r.weekTracked);return ['이번 주 진전',tracked?adv+'건':'수집 중','단계 전진 · 수주 '+won+'건'];}
 };
 function stuck(r){const parts=[];if(r.overdue)parts.push('기한초과 '+r.overdue);if(r.stale)parts.push('정체 '+r.stale);if(r.noNext)parts.push('할 일 없음 '+r.noNext);if(!parts.length&&r.unresponded)return '신규 배정 미착수';if(!parts.length&&!r.weekTracked)return '단계 변경 기록 없음';return parts.join(' · ')||'막힌 곳 없음';}
 function item(r){
  const k=r.diagnosis.k,load=root.repManagerLoadLevel(r),c=root.repManagerComment(r.nm,root.repManagerWeekKey(0));
  const sub=stuck(r)+(r.unresponded?' · 첫 연락 전 '+r.unresponded+'건':'')+' · 진행 '+r.current.length+'건'+(c?' · 약속 있음':'');
  const rs=[];
  if(r.unresponded>=3)rs.push('first3');
  if(r.risk>=4&&r.weekTracked&&r.weekAdvanced===0)rs.push('risk4');
  if(r.overdue>0)rs.push('overdue');
  if(r.unresponded>0&&r.unresponded<3)rs.push('first');
  if(r.stale>0)rs.push('stale');
  if(r.noNext>0)rs.push('nonext');
  if(r.weekTracked&&r.weekAdvanced===0&&r.current.length)rs.push('noadv');
  if(load.cls==='heavy'||load.cls==='busy')rs.push('heavy');
  if(k!=='ok'&&!c)rs.push('promise');
  return {key:r.nm,site:r.nm,brand:'',brandText:team(r.nm),owner:'업무량 '+load.label,amountText:'Pipeline '+eok(r.pipeline),bucket:k,sub,rs,stall:Number(r.risk)||0,extra:{r}};
 }
 function topHtml(R){
  const period=root.repManagerPeriodWindow(),cy=Number(root.CUR_Y);
  const menu='<details class="av-more"><summary>··· 더보기</summary><div class="av-menu"><button type="button" data-rb="team">팀 비교</button><button type="button" data-rb="account">계정 관리</button><label>조회 연도 <select data-rb-year aria-label="조회 연도">'+[String(cy),String(cy-1),String(cy-2),'전체'].map(y=>'<option'+(String(root.G.repManagerYear||cy)===y?' selected':'')+'>'+y+'</option>').join('')+'</select></label></div></details>';
  return '<div class="plv-intro rb-top"><i style="background:#64748b"></i><b>영업사원</b><span>'+R.length+'명 · '+h(period.label)+' 기준</span><div class="plv-spacer"></div>'+menu+'</div>';
 }
 function sideHtml(R){
  const sum=f=>R.reduce((a,r)=>a+(Number(f(r))||0),0);
  const load=R.filter(r=>r.pipeline>0).sort((a,b)=>b.pipeline-a.pipeline).slice(0,5);
  return '<div class="psb-box rb-load"><header><b>누가 일이 몰렸나</b><span>Pipeline · 진행 건수</span></header>'+(load.length?load.map(r=>'<div class="psb-act"><span>'+h(r.nm)+' · '+h(eok(r.pipeline))+'</span><p>진행 '+r.current.length+'건 · 조치 필요 '+r.risk+'건 · 업무량 '+h(root.repManagerLoadLevel(r).label)+'</p></div>').join(''):'<p class="psb-none">진행 금액이 없습니다</p>')+'</div>'
   +'<div class="psb-box rb-week"><header><b>이번 주 진전</b><span>지난 7일 실제 기록</span></header><div class="psb-act"><span>신규 기회 '+sum(r=>r.weekNew)+'</span><p>단계 전진 '+sum(r=>r.weekAdvanced)+' · 수주 '+sum(r=>r.weekWon)+'</p></div></div>';
 }
 function open(key,act){
  V().open(key);
  if(act==='promise')setTimeout(()=>(document.querySelector('#repWindow.on [data-rw-f="promise"]')||document.querySelector('#repsDialog textarea'))?.focus(),80);
 }
 function paint(host){
  const R=root.REP_MANAGER_ROWS||root.repFlowData(true),S=SB().state('reps');
  CFG.topHtml=topHtml(R);CFG.sideHtml=sideHtml(R);
  host.innerHTML=SB().html(CFG,R.map(item),S);
  SB().bind(host,{state:()=>SB().state('reps'),cfg:()=>CFG,paint:()=>root.paintRepManagement(),open});
  if(!host.__rb){host.__rb=true;host.addEventListener('click',e=>{const b=e.target.closest('[data-rb]');if(!b)return;if(b.dataset.rb==='team')root.repManagerView('team');if(b.dataset.rb==='account'){b.closest('details')?.removeAttribute('open');root.AccountAdmin?.open?.();}});host.addEventListener('change',e=>{if(e.target.matches('[data-rb-year]')){root.G.repManagerYear=e.target.value;root.G.repManagerQuarter=0;root.paintRepManagement();}});}
  if(root.G.page==='repmanage'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='영업사원 관리';if(p)p.textContent='왼쪽 팀 진단 → 오른쪽 확인할 사람 · 빨강 사유부터 — 코칭 약속은 사람별 창에서';}
  document.getElementById('pg-repmanage')?.classList.add('rb-on');
 }
 function boot(){
  const base=root.paintRepManagement;if(typeof base!=='function'||base.__rb)return;
  const wrapped=function(){
   const r=base.apply(this,arguments);const host=document.getElementById('rep-management-root');
   if(!enabled()||!host||!host.querySelector('#reps-v2'))return r;
   try{paint(host);}catch(e){console.warn('[영업사원 B안]',e);}
   return r;
  };
  wrapped.__rb=true;root.paintRepManagement=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.RepsB={enabled,CFG,item};
})(window);
