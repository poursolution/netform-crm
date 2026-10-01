/* 주간 브리핑 v2 (2026-10-01 디자인 핸드오프 'design_handoff_brief') — 주간 브리핑 메뉴(#p=brief)의 '주간 의사결정판'만. 월간 일정 탭은 기존 그대로.
   구성: 안내 줄(주차) → 숫자 4 → 분석 카드 3(움직임 · 이번 주 꼭 할 일 · 위험) → 지난주 판정 + 잔디 카드 → 이번 주 회의 안건(과제 등록) → 담당자 주간 현황(→ 영업사원 창)
   집계·판정은 기존 주간 브리핑과 같은 함수·같은 식(briefScopeDeals / briefWeekWindow / briefIsRisk / PipelineMetrics …).
   ※ 저장·자동화가 필요한 것(월 08:30 스냅샷, 지난 주차 보기, Claude API 문장·안건 초안, 잔디 발송 n8n)은 구조 확인 뒤에 붙인다 — 지금은 '이번 주'를 실시간 계산으로 보여 주고, 다시 보내기는 잠겨 있다.
   끄기: G.briefV2Off=true → 예전 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const GRID='minmax(0,1fr) 80px 110px 80px 80px 60px 70px 84px',COLS=['지난주 수주','진행 Pipeline','가중 예상','이번 주 일정','진전','위험'];
 const enabled=()=>!root.G.briefV2Off;
 const sum=(l,f)=>l.reduce((a,x)=>a+(Number(f(x))||0),0);
 function data(){
  const R=root,target=R.targetNameFilter(),w=R.briefWeekWindow(),D=R.briefScopeDeals(target,true,true),Q=R.briefScopeInquiries(target,true,true),all=R.briefScopeDeals(target,false),inPrev=v=>R.briefInWindow(v,w.prevStartKey,w.startKey);
  const wins=all.filter(d=>R.isWon(d)&&R.wonDate(d)&&inPrev(R.wonDate(d))),newQ=R.briefScopeInquiries(target,false).filter(q=>inPrev(R.inquiryCreatedAt(q)));
  const schedule=D.filter(d=>R.briefScheduledThisWeek(d,w)),revenue=schedule.filter(R.briefIsRevenueAction),follow=schedule.filter(d=>!R.briefIsRevenueAction(d)),newResponse=Q.filter(q=>!R.inquiryResponded(q));
  const risk=D.filter(R.briefIsRisk).sort((a,b)=>R.briefRiskScore(b)-R.briefRiskScore(a));
  const noResponse=Q.filter(q=>R.inquiryAssigned(q)&&!R.inquiryResponded(q)),newNoResponse=newQ.filter(q=>R.inquiryAssigned(q)&&!R.inquiryResponded(q));
  const pm=R.PipelineMetrics&&R.PipelineMetrics.summary?R.PipelineMetrics.summary(target?{owner:target}:undefined):null;
  const names=target?[target]:(R.PERFORMANCE_TARGET_NAMES||[]);
  const reps=names.map(n=>{const rd=R.briefScopeDeals(n,true,true),rall=R.briefScopeDeals(n,false);return {n,won:rall.filter(d=>R.isWon(d)&&R.wonDate(d)&&inPrev(R.wonDate(d))),open:rd,weighted:R.weightedAmount(rd),sched:rd.filter(d=>R.briefScheduledThisWeek(d,w)).length,adv:rall.filter(d=>R.briefAdvancedLastWeek(d,w)).length,risk:rd.filter(R.briefIsRisk).length};});
  return {target,w,D,Q,wins,newQ,schedule,revenue,follow,newResponse,risk,noResponse,newNoResponse,pm,reps,
   newOpp:all.filter(d=>inPrev(d.created)),advanced:all.filter(d=>R.briefAdvancedLastWeek(d,w)),pt:all.filter(d=>R.briefEnteredRank(d,w,7)),bid:all.filter(d=>R.briefEnteredRank(d,w,9)),contract:all.filter(d=>R.briefEnteredRank(d,w,10)),
   closed:all.filter(d=>d.code!=='won'&&!R.isOpen(d)&&inPrev(d.closed||d.updated||d.created)),
   unassigned:Q.filter(q=>!R.inquiryAssigned(q)),/* 다음 할 일 없음 = 관리팀 KPI와 같은 계산(managementStats) */nextMissing:R.managementStats(target).nextMissing,overdue:D.filter(d=>R.issueSet(d).includes('overdue')),stale:D.filter(d=>R.issueSet(d).includes('stale')),noAmount:D.filter(R.briefNoAmount),silentHot:D.filter(R.briefSilentHot)};
 }
 /* 판정 문장: 기존 판정 순서 그대로 + 이동할 화면 */
 function verdicts(x){
  const R=root,v=[],moved=x.advanced.length+x.pt.length+x.bid.length+x.contract.length;
  if(x.wins.length)v.push({tone:'g',text:'지난주 수주 '+x.wins.length+'건 · '+R.reportWonAmount(x.wins)+' — 계약 체결 기준',go:'파이프라인 · 수주',act:"PipelineWorkspace.open('won')"});
  else if(!moved)v.push({tone:'r',text:'지난주 수주 0건 · 단계 진전 0건 — 판단할 근거가 없음(단계 변경 기록이 없습니다)',go:'관리팀 KPI',act:"goPage('mgmt')"});
  else v.push({tone:'a',text:'지난주 수주 0건 — 파이프라인 전진 여부를 확인',go:'파이프라인',act:"PipelineWorkspace.open('all')"});
  if(moved)v.push({tone:'g',text:'단계 전진 '+x.advanced.length+'건'+(x.contract.length?' · 계약협의 진입 '+x.contract.length+'건':x.bid.length?' · 입찰 진입 '+x.bid.length+'건':'')+' — 흐름 살아있음',go:'파이프라인',act:"PipelineWorkspace.open('all')"});
  if(x.newQ.length)v.push({tone:x.newNoResponse.length?'a':'g',text:'신규 유입 '+x.newQ.length+'건'+(x.newNoResponse.length?' — 이 중 최초 미응대 '+x.newNoResponse.length+'건 우선 처리':' — 신규 응대 정상')+(x.noResponse.length>x.newNoResponse.length?' · 누적 미응대 '+x.noResponse.length+'건':''),go:'견적문의',act:"goPage('inq')"});
  else if(x.noResponse.length)v.push({tone:'a',text:'이번 주 신규 유입 없음 · 누적 미응대 '+x.noResponse.length+'건',go:'견적문의',act:"goPage('inq')"});
  if(x.silentHot.length)v.push({tone:'r',text:'입찰·계약 단계인데 최근 활동 없는 현장 '+x.silentHot.length+'건 — 오늘 상태 확인',go:'해당 현장',act:"briefGoIssue('briefSilentHot')"});
  if(x.risk.length)v.push({tone:'r',text:'위험 현장 '+x.risk.length+'건 — TOP '+Math.min(5,x.risk.length)+'부터 조치',go:'위험 현장',act:"briefGoIssue('overdue')"});
  return v;
 }
 function agenda(x){
  const R=root,out=[],moved=x.advanced.length+x.pt.length+x.bid.length+x.contract.length,top=x.reps.slice().sort((a,b)=>b.risk-a.risk)[0];
  if(!x.wins.length&&!moved)out.push({basis:'지난주 수주 0 · 진전 0',todo:'단계 변경 기록이 없어 판단 불가 → 연락 결과 기록부터 (관리팀 KPI)',who:'회의 · 관리팀',label:'기록 없음',count:0});
  if(x.noResponse.length){const by=new Map();x.noResponse.forEach(q=>{const o=R.repN(R.inquiryRoutedOwner?.(q)||q.assignee)||'미배정';by.set(o,(by.get(o)||0)+1);});const who=[...by].sort((a,b)=>b[1]-a[1]).slice(0,3);out.push({basis:'신규 미응대 '+x.noResponse.length+'건',todo:who.map(w=>w[0]+' '+w[1]).join(' · ')+' — 금요일까지 첫 연락',who:'담당 '+who.length+'명 · 금요일',label:'미응대',count:x.noResponse.length});}
  if(x.unassigned.length)out.push({basis:'미배정 '+x.unassigned.length+'건',todo:'오늘 안에 담당 정하기',who:'관리팀 · 오늘',label:'미배정',count:x.unassigned.length});
  if(x.silentHot.length)out.push({basis:'입찰 · 계약인데 활동 없음 '+x.silentHot.length+'건',todo:'오늘 상태 확인 · 대표 보고',who:'담당 · 오늘',label:'입찰·계약 활동 없음',count:x.silentHot.length});
  if(x.risk.length)out.push({basis:'위험 '+x.risk.length+'건 중 TOP '+Math.min(5,x.risk.length),todo:'다음 할 일 · 기한 확정 ('+(x.risk[0].site||'현장')+(x.risk.length>1?' 외 '+(Math.min(5,x.risk.length)-1):'')+')',who:(top&&top.risk?top.n:'담당')+' · 이번 주',label:'위험 TOP',count:x.risk.length});
  if(x.nextMissing.length)out.push({basis:'다음 할 일 없음 '+x.nextMissing.length+'건',todo:'진행 건마다 다음 할 일과 날짜 지정',who:'전 담당 · 이번 주',label:'다음 할 일 없음',count:x.nextMissing.length});
  return out.slice(0,6);
 }
 function nextMonday(){const d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));return (d.getMonth()+1)+'월 '+d.getDate()+'일 (월) 08:30';}
 function html(x){
  const R=root,D=R.PipelineDiagnosis,K=(label,value,sub,tone)=>({label,value,sub,tone:tone||''}),amount=v=>R.briefAmount(v);
  const pmCount=x.pm?x.pm.count:x.D.length,pmTotal=x.pm?x.pm.total:sum(x.D,R.oppAmt),pmW=x.pm?x.pm.weighted:R.weightedAmount(x.D);
  const V=verdicts(x),A=agenda(x),range=R.briefRange(x.w.start,x.w.end);
   const moves=[['신규 영업기회',x.newOpp.length],['단계 진전',x.advanced.length],['경쟁 · PT 진입',x.pt.length],['입찰 진입',x.bid.length],['계약협의 진입',x.contract.length],['수주',x.wins.length],['실주 · 종료',x.closed.length]].filter(b=>b[1]>0);
   /* 움직임이 0건이면 빈 카드 대신 0을 나열하고 관리팀 KPI로 잇는다 */
   const moveCard=moves.length?{title:'지난주 무엇이 움직였나',desc:'단계 변경 기록 기준',bars:moves}:{title:'지난주 무엇이 움직였나',desc:'단계 변경 기록 기준',rows:[['신규 영업기회',0,''],['단계 진전',0,''],['경쟁 · 입찰 진입',0,''],['수주',0,'']],foot:'<button type="button" class="bv-foot" onclick="goPage(\'mgmt\')">단계 변경 기록이 없어 판단 불가 <em>→ 관리팀 KPI</em></button>'};
  R.BRIEF_CACHE=[];R.G.briefFrom=x.w.startKey;R.G.briefTo=x.w.endKey;
  const intro='<div class="plv-intro"><i style="background:#64748b"></i><b>주간 브리핑</b><span>'+h(range)+' · 매주 월요일 08:30 자동 생성 → 잔디 발송</span><div class="plv-spacer"></div><div class="bv-view" role="group" aria-label="보기 전환"><button type="button" aria-pressed="true">주간 의사결정판</button><button type="button" aria-pressed="false" onclick="setBriefView(\'month\')">월간 일정</button></div><label class="bv-week">주차 <select aria-label="주차 선택" disabled title="지난 주차 보기는 주간 스냅샷 저장이 켜지면 열립니다"><option>이번 주 · '+h(range)+'</option></select></label><button type="button" class="sv-ghost" onclick="goPage(\'control\')">컨트롤타워에서 지시 →</button></div>';
  const top=D.render({accent:'blue',
   kpis:[K('지난주 수주',x.wins.length+'건 · '+R.reportWonAmount(x.wins),'계약금액 기준',x.wins.length?'good':'bad'),K('신규 유입',x.newQ.length+'건',x.newNoResponse.length?'이 중 미응대 '+x.newNoResponse.length+'건':'신규 응대 정상',x.newNoResponse.length?'warn':''),K('진행 Pipeline',pmCount+'건 · '+amount(pmTotal),'가중 예상 '+amount(pmW)),K('위험 현장',x.risk.length+'건','대표 · 관리자 확인 필요',x.risk.length?'bad':'')],
   cards:[moveCard,
    {title:'이번 주 꼭 할 일',desc:'일정 · 후속 · 신규응대 — 아래에서 펼쳐 보기',bars:[['매출 임박',x.revenue.length],['후속관리',x.follow.length],['신규응대 (첫 연락)',x.newResponse.length]].filter(b=>b[1]>0),empty:'이번 주에 잡힌 일정이 없습니다'},
    {title:'어디가 위험한가',desc:'회의에서 볼 숫자',rows:[['미배정',x.unassigned.length,'오늘 배정'],['최초 미응대',x.noResponse.length,x.newNoResponse.length?x.newNoResponse.length+'건이 지난주 신규':'누적'],['다음 할 일 없음',x.nextMissing.length,'지정 필요'],['기한초과',x.overdue.length,'오늘 처리'],['장기정체',x.stale.length,'진행·보류 정리'],['예상금액 미입력',x.noAmount.length,'금액 확인'],['입찰·계약 활동 없음',x.silentHot.length,'상태 확인']].filter(r=>r[1]>0),empty:'위험 항목이 없습니다'}],
   action:{title:'이번 주 회의 안건',desc:'결정하고 담당 · 기한을 정하세요',tasks:A}},{open:true,noToggle:true,scope:'brief'});
  /* 판정 + 잔디 카드를 안건(행동 카드) 앞에 끼운다 */
  const lists='<div class="bv-lists">'+[['매출 임박',x.revenue,'deal'],['후속관리',x.follow,'deal'],['신규응대',x.newResponse,'inq']].map(([t,l,k])=>'<details class="bv-list"><summary>'+t+' <b>'+l.length+'건</b></summary><div class="brief-action-list">'+R.briefActionRows(l,k)+'</div></details>').join('')+'</div>';
  const verd='<section class="bv-verdict"><div class="bv-v"><header><b>지난주 판정</b><span>문장을 누르면 해당 화면으로 이동합니다</span></header>'+V.map(v=>'<button type="button" class="bv-line '+v.tone+'" onclick="'+attr(v.act)+'"><span>'+h(v.text)+'</span><em>→ '+h(v.go)+'</em></button>').join('')+'</div>'
   +'<aside class="bv-jandi"><header><b>잔디 발송</b><span>관리자 · 팀장</span></header><div class="bv-msg"><b>[주간 영업 브리핑] '+h(range)+'</b>'+V.slice(0,3).map(v=>'<span>· '+h(v.text)+'</span>').join('')+'<em>CRM에서 열기 →</em></div><dl><div><dt>발송 시각</dt><dd>매주 월요일 08:30</dd></div><div><dt>다음 발송</dt><dd>'+h(nextMonday())+'</dd></div><div><dt>상태</dt><dd class="bv-off">자동화 연결 전</dd></div></dl><div class="bv-btns"><button type="button" class="sv-ghost" disabled title="잔디 발송(n8n) 연결 뒤에 켜집니다">지금 다시 보내기</button><button type="button" class="sv-primary" data-bv="meeting">회의 모드</button></div></aside></section>';
  const i=top.indexOf('<section class="pd-action">'),body=i>=0?top.slice(0,i)+lists+verd+top.slice(i):top+lists+verd;
  /* 담당자 주간 현황 */
  const rowHtml=r=>'<div class="plv-row" role="row" tabindex="0" data-bv="rep" data-value="'+attr(r.n)+'" data-rep="'+attr(r.n)+'" style="grid-template-columns:'+GRID+'"><span class="plv-c plv-site"><b>'+h(r.n)+'</b><small>본사 영업</small></span>'
   +'<span class="plv-c"><span class="'+(r.won.length?'g':'m')+'">'+h(r.won.length?R.reportWonAmount(r.won):'0원')+'</span></span>'
   +'<span class="plv-c"><span class="'+(r.open.length?'':'m')+'">'+(r.open.length?r.open.length+'건 · '+h(amount(sum(r.open,R.oppAmt))):'0건')+'</span></span>'
   +'<span class="plv-c"><span class="'+(r.weighted?'':'m')+'">'+h(r.weighted?amount(r.weighted):'0원')+'</span></span>'
   +'<span class="plv-c"><span class="'+(r.sched?'':'m')+'">'+r.sched+'건</span></span><span class="plv-c"><span class="'+(r.adv?'g':'m')+'">'+r.adv+'건</span></span>'
   +'<span class="plv-c"><span class="'+(r.risk?'r':'g')+'">'+r.risk+'</span></span><button type="button" class="plv-cta" data-bv="rep" data-value="'+attr(r.n)+'">이 사람 보기</button></div>';
  const groups=[['risk','이번 주 챙길 사람','#e5484d','위험 현장이 많은 순',x.reps.filter(r=>r.risk>0).sort((a,b)=>b.risk-a.risk)],['ok','이상 없음','#30a46c','위험 0',x.reps.filter(r=>!r.risk)]];
  const table='<div class="kv-tablehead"><b>담당자 주간 현황</b></div><div class="plv-table" role="table" aria-label="담당자 주간 현황"><div class="plv-thead" role="row" style="grid-template-columns:'+GRID+'"><span>담당</span>'+COLS.map(c=>'<span>'+h(c)+'</span>').join('')+'<span></span></div>'+groups.map(([id,t,color,desc,list])=>'<div class="plv-ghead" data-plv-group="'+id+'"><i style="background:'+color+'"></i><b>'+t+'</b><span>'+list.length+'명</span><small>· '+desc+'</small></div>'+(list.length?list.map(rowHtml).join(''):'<div class="plv-empty">해당하는 사람이 없습니다</div>')).join('')+'</div>';
  return '<div id="brief-v2" class="plv" data-workspace="brief">'+intro+body+table+'</div>';
 }
 /* 회의 모드: 판정과 안건만 큰 글씨 전체화면 */
 function meeting(){
  const x=data(),V=verdicts(x),A=agenda(x);document.getElementById('bvMeeting')?.remove();
  const m=document.createElement('div');m.id='bvMeeting';m.className='bv-meeting';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label','회의 모드');
  m.innerHTML='<header><b>주간 영업회의 · '+h(root.briefRange(x.w.start,x.w.end))+'</b><button type="button" data-close>회의 모드 끝내기 (Esc)</button></header><section><h2>지난주 판정</h2>'+V.map(v=>'<p class="'+v.tone+'">'+h(v.text)+'</p>').join('')+'</section><section><h2>이번 주 안건</h2><ol>'+A.map(a=>'<li><b>'+h(a.basis)+'</b><span>'+h(a.todo)+'</span><em>'+h(a.who)+'</em></li>').join('')+'</ol></section>';
  const end=()=>{m.remove();window.removeEventListener('keydown',onKey,true);},onKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();end();}};
  m.addEventListener('click',e=>{if(e.target.closest('[data-close]'))end();});window.addEventListener('keydown',onKey,true);
  document.body.append(m);m.querySelector('button').focus();
 }
 function onClick(e){
    const b=e.target.closest('#brief-v2 [data-bv]');if(!b)return;
  if(b.dataset.bv==='meeting')meeting();
  if(b.dataset.bv==='rep'){const n=b.dataset.value;if(root.RepsV2&&root.RepsV2.enabled()){root.RepsV2.open(n);if(document.getElementById('repsDialog')?.classList.contains('on'))return;}root.briefFocusRep?.(n,'brief-reps');}
 }
 function boot(){
  const base=root.paintBrief;if(typeof base!=='function')return;
  root.paintBrief=function(){
   const week=document.getElementById('b-week'),month=document.getElementById('b-month'),pg=document.getElementById('pg-brief');
    /* 새 화면에서는 예전 파란 안내 띠를 감추고, 주간 보기에서는 전환 줄도 안내 줄 안으로 옮긴다 */
    if(pg){pg.classList.toggle('bv-on',enabled());pg.classList.toggle('bv-weekview',enabled()&&root.G.briefView!=='month');}
   if(!enabled()||!week||root.G.briefView==='month'||!root.PipelineDiagnosis)return base.apply(this,arguments);
   try{root.briefViewButtons?.();if(month)month.style.display='none';week.style.display='block';week.innerHTML=html(data());
    if(!week.__bv){week.__bv=true;week.addEventListener('click',onClick);week.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList?.contains('plv-row')){e.preventDefault();e.target.click();}});}
   }catch(e){console.warn('[주간 브리핑 v2]',e);return base.apply(this,arguments);}
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.BriefV2={enabled,data,verdicts,agenda,meeting};
})(window);
