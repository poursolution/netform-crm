/* 오늘 업무 4구역 (2026-10-10 design_handoff_day_zones · 시안 '하루 업무 구역 · 마감 요약' · '기록 부족 vs 영업 정체') — 배치 그대로, 목록만 4구역으로.
   지금 처리(오늘 연락 · 마감 · 방문 · 약속 — 지연 · 평가 포함) / 회신 대기(고객 답 · 자료 · 내부 승인 대기 — 다음 확인일 유지 · 지연 아님) / 정보 보완(기록만 — 지연 · 평가 제외) / 약속 누락(응대 기록 속 고객 약속인데 연결된 업무 없음 — promise_gap ①).
   줄 = 현장 · 단계 · (요청 꼬리표) / 할 일 / 먼저 하는 이유(진단 문구 = 할 행동 · 4-3) + 근거 / 버튼 1개. 이유를 누르면 근거 보기(적용 규칙 · 기준일 · 관련 기록 · 빠진 것).
   관리자 요청은 기존 줄의 꼬리표("송보람 요청 · 18:00") — 같은 행동 업무가 없을 때만 새 줄. 필터로 숨은 내 요청이 있으면 맨 위 한 줄.
   판정 · 숫자는 관제탑(TodayTower.classify) · PipelineJudge 그대로 쓴다 — 여기서는 나누고 이름 붙이고 그릴 뿐. 영업관리(mgr) 화면은 기존 카드 묶음을 건드리지 않는다(2026-10-05 "카드 어디 가고").
   끄기: G.dayZonesOff=true → 예전 묶음 3개 */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.DayZones=api;})(typeof window==='undefined'?globalThis:window,function(root){
 'use strict';
 const R=root,h=v=>R.esc?R.esc(String(v==null?'':v)):String(v==null?'':v),attr=v=>R.escAttr?R.escAttr(String(v==null?'':v)):String(v==null?'':v);
 const on=role=>!(R.G&&R.G.dayZonesOff)&&role!=='mgr';
 const st=()=>{const g=R.G||(R.G={});return g.dayZones||(g.dayZones={zone:'now',why:'',pg:{},done:{}});};
 const KST=d=>{const t=new Date((d||new Date()).getTime()+9*36e5);return t.toISOString().slice(0,10);};
 const md=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(s||''));return m?Number(m[2])+'.'+Number(m[3]):'';};
 const cut=(v,n)=>{v=String(v||'').replace(/\s+/g,' ').trim();return v.length>n?v.slice(0,n-1)+'…':v;};
 /* ── 4-3 진단 문구 = 할 행동(상태 단정 대신). 관제탑 사유 열쇠(rk) → [행동, 누르면 열리는 것] ── */
 const ACTION={first:['활동 여부 확인 필요','기존 통화 · 메모 · 이력 확인 뒤 결과 등록 — 기록 없음 ≠ 연락 안 함'],promise:['약속 이행 확인 필요','약속 원문 · 날짜 확인 → 했음 / 못 함 · 사유 / 날짜 변경'],stall:['다음 행동 등록 필요','목적 · 예정일 · 담당 입력'],month:['진행 판단 필요','근거 보기 → 계속 / 대기 · 사유 / 보류 / 실주'],silent:['진행 판단 필요','견적 발송 후 후속 — 근거 보기 → 계속 / 대기 / 보류 / 실주'],stallbig:['진행 판단 필요','고액 건 후속 — 근거 보기'],long:['관계 연락 필요','장기관리 2개월 연락일'],data:['정보 보완 필요','결정 일정 · 경쟁사 · 결정권자 입력'],contract:['계약 정보 입력 필요','계약일 · 금액 · 계약서'],fix:['이관 기록 확인 필요','확인 전 기한 · 성과 판정 제외'],deadline:['마감 준비','제안 · 입찰 준비 상태 확인 · 제출일 확정'],quote:['견적 요청 등록 필요','물량 산출 기한 넘김'],site:['현장 확인 필요','착공 현장 주 1회 방문'],after:['사후 연락 필요','준공 D+30'],decide:['결정 · 지원 응답 필요','담당이 기다리는 결정'],transfer:['낙찰결과 등록 필요','타사 이관 결과'],tfapprove:['실적 인정 대기','관리자 인정 뒤 실적 반영'],assign:['담당 배정 필요','배정 기준 넘김']};
 const action=i=>{if(i.rk==='promise'&&i.x&&i.x.dueDays===0)return '오늘 약속 · 연락';const a=ACTION[i.rk];return a?a[0]:String(i.missTxt||'확인 필요');};
 const opens=i=>{const a=ACTION[i.rk];return a?a[1]:'';};
 /* 정보 보완(기록만 · 지연 · 평가 제외) */
 const INFO=new Set(['data','contract','fix','tfapprove']);
 /* ── 회신 대기: 대기 사유 + 다음 확인일이 있는 영업건(확인일에 지금 처리로) ── */
 function waitDate(d){const v=d.expected_resume_at||d.wake_up_at||d.relationship_hold_until||'';const s=String(v||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';}
 function waitingOf(d){let reason=String(d.waiting_reason||'').trim(),due=waitDate(d);if(!reason&&!due){try{const a=R.actionObj?R.actionObj(d,R.itemPatch(d,'deal')):null,m=a&&/^고객 회신 대기:\s*(.+)$/.exec(String(a.text||''));if(m){reason=m[1].trim();const k=String(a.due||a.due_at||'').slice(0,10);due=/^\d{4}-\d{2}-\d{2}$/.test(k)?k:'';}}catch(e){}}if(!reason&&!due)return null;const today=KST();return {reason:reason||'대기 사유 미기록',due,future:!!due&&due>=today,indefinite:!!reason&&!due};}
 /* 같은 이유로 몇 번째 대기인가: 최근 60일 응대 기록 중 회신 대기(결과 · 글) 횟수 */
 function waitCount(d){try{const since=Date.now()-DAYS_BACK*864e5;return [].concat(d.activities||[],(R.itemPatch(d,'deal')||{}).activities||[]).filter(a=>Date.parse(a.at||a.occurred_at||'')>=since&&/회신\s*대기|회신대기/.test(String(a.result||'')+' '+String(a.note||''))).length;}catch(e){return 0;}}
 /* ── 약속 누락(promise_gap ①): 응대 기록 속 고객 약속(InquiryMemo.parse)인데 그 뒤 연결된 다음 행동이 없는 건 ── */
 const DAYS_BACK=60;
 function promiseGaps(deals,me,team){
  const IM=R.InquiryMemo;if(!IM||!IM.parse)return [];const out=[],S=st(),since=Date.now()-DAYS_BACK*864e5;
  (deals||[]).forEach(d=>{
   try{if(!R.isOpen(d))return;const owner=R.repN(d.assignee)||'';if(!team&&owner!==me)return;
    const acts=[].concat(d.activities||[],(R.itemPatch(d,'deal')||{}).activities||[]).filter(a=>a&&a.note&&Date.parse(a.at||a.occurred_at||'')>=since).sort((a,b)=>String(b.at||b.occurred_at).localeCompare(String(a.at||a.occurred_at)));
    const marks=acts.filter(a=>/^\[약속 확인\]/.test(String(a.note||''))).map(a=>String(a.note));
    const next=R.actionObj?R.actionObj(d,R.itemPatch(d,'deal')):null,nextAt=next&&(next.due||next.due_at)?String(next.due||next.due_at).slice(0,10):'';
    acts.forEach(a=>{if(/^\[(약속 확인|내부 요청|내부)\]/.test(String(a.note||'')))return;const at=a.at||a.occurred_at,day=String(at||'').slice(0,10);let P=[];try{P=IM.parse(String(a.note||''),at).promises||[];}catch(e){P=[];}
     P.forEach(p=>{const title=String(p.title||p.text||'').trim();if(!title)return;const key='pg:'+String(d.id)+':'+day+':'+title.slice(0,30);
      if(S.done[key]||marks.some(m=>m.includes(title.slice(0,20))))return;
      /* 연결된 업무가 있나: 응대 뒤에 등록된 다음 행동(기한이 응대일 이후) */
      if(nextAt&&nextAt>=day)return;
      out.push({key,d,owner,day,title,due:p.due?String(p.due).slice(0,10):'',type:p.type||''});});});
   }catch(e){}
  });
  const seen=new Set();return out.filter(g=>{if(seen.has(g.key))return false;seen.add(g.key);return true;}).sort((a,b)=>String(a.day).localeCompare(String(b.day)));
 }
 /* ── 요청 꼬리표: 내게 온 열린 요청(요청 엔진) → 영업건 · 문의 id 로 ── */
 function reqMap(){const m=new Map();try{const W=R.WorkRequest;if(!W||!W.enabled())return m;(W.state().list||[]).forEach(r=>{if(!r.to_me||!['sent','seen','working'].includes(r.status))return;const k=(r.target_type==='inquiry'?'inq:':'deal:')+String(r.target_id);(m.get(k)||m.set(k,[]).get(k)).push(r);});}catch(e){}return m;}
 /* 꼬리표: 기한이 지났으면 '요청자 요청 · n시간 지남'(빨강) · 아니면 기한 */
 const reqLate=r=>{const t=Date.parse(r&&r.due_at||'');return Number.isFinite(t)&&t<Date.now();};
 const reqTag=r=>{const t=Date.parse(r.due_at||''),who=(r.requested_by||'관리자')+' 요청 · ';if(Number.isFinite(t)&&t<Date.now()){const hrs=Math.max(1,Math.round((Date.now()-t)/36e5));return who+(hrs<48?hrs+'시간 지남':Math.round(hrs/24)+'일 지남');}return who+(r.due_label||md(r.due_at)||'');};
 const reqTagHtml=r=>'<span class="dz-req'+(reqLate(r)?' late':'')+'" title="'+attr((r.asks||[]).join(' · ')||r.label)+'">'+h(reqTag(r))+'</span>';
 const reqMemo=r=>String(r&&(r.memo||(r.asks||[]).join(' · ')||r.label)||'').replace(/\s+/g,' ').trim();
 /* 공통 필터(브랜드 = SalesFilterState · 담당 = G.todayQueueOwner · 검색 = G.todayQueueSearch)를 항목에도 똑같이 — 관제탑이 보탠 열린 영업건은 필터를 거치지 않아 여기서 한 번 더 */
 function scopeOk(item,owner){try{const G=R.G||{};const brand=item.brand||(R.inquiryBrandOf?R.inquiryBrandOf(item):'')||'';if(R.SalesFilterState&&!R.SalesFilterState.matchesBrand(brand))return false;const o=G.todayQueueOwner&&G.todayQueueOwner!=='전체'?G.todayQueueOwner:'';if(o&&owner&&owner!==o)return false;const q=String(G.todayQueueSearch||'').trim().toLowerCase();if(q&&![item.site,item.site_name,owner,item.contact_name,item.phone].join(' ').toLowerCase().includes(q))return false;return true;}catch(e){return true;}}
 /* ── 구역 나누기: 관제탑 항목(V.groups) + 회신 대기 + 약속 누락 ── */
 function build(V,X){
  const me=V.me,team=V.team,items=V.groups.filter(g=>!g.aux).flatMap(g=>g.items),RQ=reqMap();
  const keyOf=i=>i.x.type==='deal'?'deal:'+String(i.x.item.id):i.x.type==='inq'?'inq:'+String(i.x.item.id):i.key;
  const now=[],wait=[],info=[],seen=new Set();
  items.forEach(i=>{seen.add(keyOf(i));if(!scopeOk(i.x.item,i.x.owner))return;i.reqs=RQ.get(keyOf(i))||[];const w=i.x.type==='deal'?waitingOf(i.x.item):null;
   if(w&&w.future&&!['deadline','decide','contract','assign','tfapprove','transfer'].includes(i.rk)){i.wait=w;wait.push(i);}
   else if(INFO.has(i.rk))info.push(i);else now.push(i);});
  /* 회신 대기 중 관제탑 항목이 아닌 영업건(대기 사유 + 확인일이 있어 지연으로 세지 않는 것) */
  (X.D||[]).forEach(d=>{try{if(!R.isOpen(d))return;const owner=R.repN(d.assignee)||'';if(!team&&owner!==me)return;const k='deal:'+String(d.id);if(seen.has(k))return;const w=waitingOf(d);if(!w||!w.future)return;seen.add(k);if(!scopeOk(d,owner))return;
   wait.push({key:k,x:{type:'deal',item:d,owner},i:{site:d.site||d.site_name||'현장명 미입력',brand:d.brand||''},st:'',sName:(()=>{try{return R.stageLabel(R.dealStage(d));}catch(e){return '';}})(),rk:'wait',missTxt:'고객 회신 대기',short:'',act:'확인일 변경',done:'',reqs:RQ.get(k)||[],wait:w,brand:d.brand||''});}catch(e){}});
  /* 관리자 요청인데 같은 행동 업무가 없는 건 → 지금 처리에 요청 줄 하나 */
  RQ.forEach((rs,k)=>{if(seen.has(k))return;const r=rs[0];let item=null;try{item=k.startsWith('inq:')?R.inqCtlFind(String(r.target_id),false):((R.B&&R.B.deals)||[]).find(d=>String(d.id)===String(r.target_id));}catch(e){}if(!item)return;seen.add(k);if(!scopeOk(item,me))return;
   now.push({key:k,x:{type:k.startsWith('inq:')?'inq':'deal',item,owner:me},i:{site:r.site||item.site||item.site_name||'',brand:r.brand||item.brand||''},st:'',sName:'',rk:'req',missTxt:(rs[0].asks||[]).join(' · ')||r.label,short:'',act:'열어서 처리',done:'',reqs:rs,brand:r.brand||item.brand||'',reqOnly:true});});
  /* 무기한 대기(4-3 기록 상태): 대기 사유는 있는데 확인일이 없는 건 — 따로 보여 주고 확인일을 정하게 한다 */
  const nowait=[];(X.D||[]).forEach(d=>{try{if(!R.isOpen(d))return;const owner=R.repN(d.assignee)||'';if(!team&&owner!==me)return;const w=waitingOf(d);if(!w||!w.indefinite||!scopeOk(d,owner))return;const k='deal:'+String(d.id);nowait.push({key:k,x:{type:'deal',item:d,owner},i:{site:d.site||d.site_name||'현장명 미입력',brand:d.brand||''},st:'',sName:(()=>{try{return R.stageLabel(R.dealStage(d));}catch(e){return '';}})(),rk:'nowait',missTxt:'무기한 대기',short:'',act:'확인일 정하기',done:'',reqs:RQ.get(k)||[],wait:w,brand:d.brand||''});}catch(e){}});
  {const w=i=>(i.reqs&&i.reqs.length)?(i.reqs.some(reqLate)?2:1):0;const idx=new Map(now.map((x,n)=>[x,n]));now.sort((a,b)=>w(b)-w(a)||idx.get(a)-idx.get(b));}
  try{const DW=R.DayWord;if(DW&&DW.on())DW.infoRows(me,seen,scopeOk).forEach(r=>info.push(r));}catch(e){}
  const gaps=promiseGaps(X.D||[],me,team).filter(g=>scopeOk(g.d,g.owner));
  return {now,wait,info,gaps,nowait,me,team,total:now.length+wait.length+info.length+gaps.length};
 }
 /* ── 근거 보기(4-3 ⑤): 적용 규칙(기준 버전) · 기준일 · 관련 기록(고객 접촉 / 내부 메모) · 빠진 것 ── */
 function evidence(i){
  const d=i.x.item,deal=i.x.type==='deal',ver=(()=>{try{return R.CRMRules.version().label;}catch(e){return '기준';}})(),C=R.CRMRules;
  const ruleOf={first:'첫 연락 '+(C?C.get('first_contact_hours'):2)+'시간 안(배정 시각부터)',silent:'견적 발송 후 '+(C?C.get('quote_followup_days'):7)+'일 안 후속(실제 발송일부터)',month:'활동 없음 '+(C?C.get('inactive_days'):7)+'일 · 관계관리 30일 미접촉',stallbig:'고액 건 · 견적 후 후속 없음',long:'장기 대기 '+(C?C.get('long_wait_contact_days'):60)+'일(달력 2개월 환산 확인 필요)',stall:'다음 행동 · 날짜 필수',promise:'등록된 다음 연락일 지남',data:'단계별 필수값',contract:'계약일 · 금액 · 계약서',deadline:'마감 D-7부터 준비',quote:'물량 산출 기한(견적 예정일)',wait:'대기 사유 + 다음 확인일 → 확인일까지 지연 아님'}[i.rk]||String(i.missTxt||'');
  let contact=0,memo=0,last='',lastMemo='';
  if(deal){const acts=[].concat(d.activities||[],(()=>{try{return (R.itemPatch(d,'deal')||{}).activities||[];}catch(e){return [];}})());acts.forEach(a=>{let ok=false;try{ok=!!R.isMeaningfulContact(a.type,a.note,a.result||'',a.meaningful);}catch(e){}const at=String(a.at||a.occurred_at||'').slice(0,10);if(/메모/.test(String(a.type||''))||/^\[/.test(String(a.note||''))){memo++;if(at>lastMemo)lastMemo=at;}else if(ok){contact++;if(at>last)last=at;}});}
  let base='';try{if(i.rk==='first')base='접수 '+md(R.inquiryCreatedAt(d));else if(deal){const s=d.stage_entered_at||d.stageAt;base=s?'단계 진입 '+md(s)+(i.days?' → '+i.days+'일':''):(i.days?'마지막 응대 뒤 '+i.days+'일':'');}}catch(e){}
  const miss=[];if(deal){let a=null;try{a=R.actionObj(d,R.itemPatch(d,'deal'));}catch(e){}if(!a||!a.text)miss.push('다음 행동');if(!String(d.waiting_reason||'').trim()&&/month|silent|stallbig|stall/.test(i.rk))miss.push('대기 사유');}
  return {contact,rule:rule(ruleOf,ver),base:base||'기준일 계산 없음',records:deal?((last?md(last)+' 고객 접촉':'고객 접촉 기록 없음')+' · 고객 접촉 '+contact+'회'+(memo?' · 내부 메모 '+memo+'건(접촉 아님'+(lastMemo?' · '+md(lastMemo):'')+')':'')):'문의 응대 기록은 상세에서',missing:miss.length?miss.join(' · '):'없음'};
 }
 const rule=(t,ver)=>t+' ('+ver+')';
 /* ── §2 팝업: 새 배정(내게 새로 배정된 견적문의 · 첫 연락 전 · 아직 확인 안 함) — 다른 요청은 알림 목록 · 꼬리표. 확인은 이 PC 에 남긴다(localStorage) */
 const ACK_KEY='crm.dz.assignSeen.v1';
 function acked(){try{return JSON.parse(R.localStorage.getItem(ACK_KEY)||'{}');}catch(e){return {};}}
 function ackAssign(id){try{const a=acked();a[String(id)]=Date.now();R.localStorage.setItem(ACK_KEY,JSON.stringify(a));}catch(e){}}
 function newAssigns(me){try{const a=acked(),since=Date.now()-7*864e5;return (R.B&&R.B.inquiries||[]).filter(q=>{try{if(a[String(q.id)])return false;if(R.repN(R.inquiryRoutedOwner(q))!==me)return false;const at=Date.parse(R.inqCtlAssignedAt(q)||'');if(!Number.isFinite(at)||at<since)return false;if(R.inqCtlFirstResponseAt(q))return false;if(typeof R.isClosedInq==='function'&&R.isClosedInq(q))return false;return true;}catch(e){return false;}}).sort((x,y)=>String(y.assigned_at||'').localeCompare(String(x.assigned_at||'')));}catch(e){return [];}}
 /* 줄에 붙은 요청 번호(위쪽 큰 카드를 그리지 않아도 되는 요청) */
 function reqRowIds(){const s=new Set();if(!LAST)return s;/* 지금 처리 줄에 붙은 요청만(그 줄 아래에서 입력할 수 있는 것) */LAST.now.forEach(i=>(i.reqs||[]).forEach(r=>s.add(r.id)));return s;}
 /* §2 도착 팝업(처음 한 번): 중요 요청 — 아직 담당 확인(seen) 전이고 이 PC 에서 팝업을 본 적 없는 것 */
 function newRequests(){try{const W=R.WorkRequest;if(!W||!W.enabled()||!W.incoming)return [];const a=acked();return W.incoming().filter(r=>r.status==='sent'&&W.isImportant(r)&&!W.isSpecial(r)&&!a['rq:'+r.id]);/* 인계 · 지사 확인은 위쪽 카드가 그대로 보이므로 팝업을 겹쳐 띄우지 않는다 */}catch(e){return [];}}
 function popupHtml(me){
  const L=newAssigns(me),RN=newRequests();if(!L.length&&!RN.length)return '';
  if(!L.length){const W=R.WorkRequest,rq=r=>'<div class="dz-pop-row"><b>'+h(r.site||'현장명 미입력')+'</b><span>'+h((r.requested_by||'관리자')+' 요청 · '+reqMemo(r))+'</span><small>기한 '+h(W.dueTxt(r))+'</small><div><button type="button" class="pri" data-dz="rqgo" data-id="'+attr(r.id)+'">응대 시작</button><button type="button" data-dz="rqok" data-id="'+attr(r.id)+'">확인 · 나중에 처리</button></div></div>';
   return '<div class="dz-pop" role="dialog" aria-label="새 요청"><div class="dz-pop-box"><header><b>새 요청 '+RN.length+'건</b><span>확인하면 목록 줄의 빨간 꼬리표로 남습니다 · 닫기만으로는 확인 처리되지 않음</span></header>'+RN.slice(0,5).map(rq).join('')+(RN.length>5?'<p class="dz-pop-more">외 '+(RN.length-5)+'건은 목록 줄 꼬리표에서</p>':'')+'</div></div>';}const H=(()=>{try{return R.CRMRules.get('first_contact_hours');}catch(e){return 2;}})();
  const row=q=>{const at=Date.parse(R.inqCtlAssignedAt(q)||''),due=Number.isFinite(at)?new Date(at+H*36e5):null,left=due?Math.round((due.getTime()-Date.now())/6e4):null;const dueTxt=due?(due.getMonth()+1)+'.'+due.getDate()+' '+String(due.getHours()).padStart(2,'0')+':'+String(due.getMinutes()).padStart(2,'0')+(left==null?'':left>=0?' · '+left+'분 남음':' · '+(-left)+'분 지남'):'배정 시각 미기록';
   return '<div class="dz-pop-row"><b>'+h(q.site||q.site_name||'현장명 미입력')+'</b><span>'+h((q.brand||'')+' · '+(q.memo||q.content||q.request||'문의 내용 미입력'))+'</span><small>첫 연락 기한 '+h(dueTxt)+' (배정 후 '+H+'시간)</small><div><button type="button" class="pri" data-dz="popgo" data-id="'+attr(q.id)+'">응대 시작</button><button type="button" data-dz="popok" data-id="'+attr(q.id)+'">확인 · 나중에 처리</button></div></div>';};
  return '<div class="dz-pop" role="dialog" aria-label="새 배정"><div class="dz-pop-box"><header><b>새 배정 '+L.length+'건</b><span>첫 연락은 배정 후 '+H+'시간 안 · 팝업은 새 배정 · 긴급 기한 변경 · 중요 요청에만</span>'+(L.length>1?'<button type="button" data-dz="popall">모두 확인</button>':'')+'</header>'+L.slice(0,5).map(row).join('')+(L.length>5?'<p>외 '+(L.length-5)+'건은 오늘 업무 목록에서</p>':'')+'</div></div>';
 }
 /* ── 그리기 ── */
 const ZONES=[['now','지금 처리','오늘 연락 · 마감 · 방문 · 약속','할 일','기한','처리 후 다음 건 · 지연 · 평가 포함'],['wait','회신 대기','내가 할 일 없음 · 확인일만','기다리는 것','다음 확인일','대기 중은 지연으로 안 셈 · 확인일에 지금 처리로 올라옴'],['info','정보 보완','고객 연락 아님 · 기록만','빠진 것','이유','평가 · 지연에 안 셈 · 하루 몇 건씩 나눠 처리'],['gaps','약속 누락','약속은 있는데 업무 없음','약속 원문','응대일','[업무로 만들기] 또는 [이미 함] · 응대 완료 ≠ 약속 완료']];
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const PER=20;
 const INLINE=()=>!!(R.G&&R.G.rowInlineKeep);
 /* 줄 · 단추 → 상세 창. 오늘 업무 대기열에 있는 건은 그 길(필터 · 스크롤 복귀 포함), 없는 건(묶음 요청으로 보탠 종료 건 등)은 바로 연다 */
 function openItem(i,act){
  (i.reqs||[]).forEach(r=>{try{R.WorkRequest.markSeen(r.id);}catch(e){}});
  let inQ=false;try{const D=R.TodayWorkQueue.data();inQ=D.rows.some(r=>r.key===i.key)||(D.backlog||[]).some(r=>r.key===i.key);}catch(e){}
  const later=()=>{if(act&&i.x.type==='deal')setTimeout(()=>{try{R.DealDetailV3&&R.DealDetailV3.openFrom&&R.DealDetailV3.openFrom(act);}catch(e){}},300);};
  if(inQ){try{R.TodayWorkQueue.open(i.key,act==='activity'?'contact':undefined);}catch(e){}if(act==='stagefields')later();return;}
  if(i.x.type==='deal'){try{R.G._detailPopup=true;R.drwDeal(JSON.stringify(i.x.item));}catch(e){}later();return;}
  try{R.TodayWorkQueue.open(i.key,act==='activity'?'contact':undefined);}catch(e){}
 }
 const findItem=key=>LAST?[].concat(LAST.now,LAST.wait,LAST.info,LAST.nowait||[]).find(x=>x.key===key)||null:null;
 function rowHtml(i,zone,S){
  const k=attr(i.key),bc=BRAND[i.brand||(i.i&&i.i.brand)]||'#9aa0ab',tags=(i.reqs||[]).slice(0,2).map(reqTagHtml).join(''),rq0=(i.reqs||[])[0]||null,WRQ=R.WorkRequest;
  let task,why,sub,wc,btn;
  if(zone==='nowait'){task=i.wait.reason;why='무기한 대기';sub='확인일 없음 · 확인일을 정하면 회신 대기로';wc='#6b7280';btn='확인일 정하기';}
  else if(zone==='wait'){const n=waitCount(i.x.item);task=i.wait.reason;why=n>=3?'같은 이유 '+n+'번째 대기':'고객 회신 대기';sub='확인 '+md(i.wait.due)+(n>=3?' · 재알림 대신 다음 셋 중 하나':'');wc=n>=3?'#8a5a00':'#6b7280';btn='확인일 변경';i.wait3=n>=3;}
  else if(zone==='info'){task=String(i.done||i.missTxt||'');why=action(i);sub=String(i.missTxt||'')+(i.short&&!/^(0일|오늘|-|—)$/.test(i.short)?' · '+i.short:'');wc='#6b7280';btn=i.act||'입력';if(i.bulk){why=i.bulk.why;sub=i.bulk.sub;wc='#2a52b8';}}
  else{task=i.reqOnly?String(i.missTxt||''):String((i.x&&i.x.next)||i.done||i.missTxt||'');why=i.reqOnly?'관리자 요청':action(i);sub=i.reqOnly?((i.reqs[0]&&i.reqs[0].memo)||''):(i.rk==='deadline'&&i.deadline?i.deadline.what+' '+md(i.deadline.date):String(i.missTxt||'')+(i.short&&!/^(0일|오늘|-|—)$/.test(i.short)?' · '+i.short:''));wc=/now|today/.test(i.urg||'')||i.rk==='deadline'?'#b42318':i.rk==='promise'?'#8a5a00':'#15171c';btn=i.reqOnly?'열어서 처리':(i.act||'전화');}
  /* 4-3: CRM 에 접촉 기록이 없는 건은 '지연'으로 단정하지 않는다 — 활동 여부부터 확인(상황 4가지) */
  const DX=R.DayExtra&&R.DayExtra.on()?R.DayExtra:null;let chk=false;if(DX&&zone==='now'&&!i.reqOnly&&DX.needsCheck(i)){why=DX.WORD;btn='활동 확인';wc='#15171c';chk=true;}
  const whyBtn=INLINE()?'<button type="button" class="dz-why" data-dz="why" data-key="'+k+'" style="color:'+wc+'" aria-expanded="'+(S.why===i.key)+'">'+h(why)+'</button>':(()=>{let tt='';try{const e=evidence(i);tt=[e.rule,e.base,e.records].filter(Boolean).join(' · ');}catch(x){}return '<button type="button" class="dz-why" data-dz="go" data-key="'+k+'" style="color:'+wc+'" title="'+attr(tt)+'">'+h(why)+'</button>';})();
  const ev=INLINE()&&S.why===i.key?(()=>{const e=evidence(i);return '<div class="dz-ev"><span>'+h(why)+' · 왜?</span><div><i>적용 규칙</i><b>'+h(e.rule)+'</b><i>기준일</i><b>'+h(e.base)+'</b><i>관련 기록</i><b>'+h(e.records)+'</b><i>빠진 것</i><b class="'+(e.missing==='없음'?'':'amb')+'">'+h(e.missing)+'</b>'+(DX&&i.x.type==='deal'?DX.progressHtml(i.x.item,e.contact||0):'')+(opens(i)?'<i>누르면</i><b>'+h(opens(i))+'</b>':'')+'</div></div>';})():'';
  return '<div class="dz-row" data-key="'+k+'" style="border-left-color:'+bc+'"><div class="c1"><b title="'+attr(i.i.site)+'">'+h(i.i.site)+'</b><div><span>'+h(i.sName||'')+'</span>'+tags+'</div></div><span class="c2" title="'+attr(task)+'">'+h(task)+(rq0&&!i.reqOnly&&reqMemo(rq0)?'<small class="dz-reqmemo" title="'+attr(reqMemo(rq0))+'">요청 · '+h(cut(reqMemo(rq0),46))+'</small>':'')+'</span><div class="c3">'+whyBtn+'<small title="'+attr(sub)+'">'+h(sub)+'</small></div>'
   +(i.bulk?'<button type="button" data-dz="go" data-key="'+k+'" data-act="stagefields">'+h(btn)+'</button>':INLINE()&&rq0&&WRQ&&WRQ.inlineHtml&&!WRQ.isSpecial(rq0)&&!(R.G&&R.G.reqCardKeep)&&zone==='now'?'<button type="button" data-dz="req" data-key="'+k+'" aria-expanded="'+(S.reqOpen===i.key)+'">'+h(i.reqOnly?'처리하기':btn)+'</button>':i.reqOnly?'<button type="button" data-dz="go" data-key="'+k+'" data-act="activity">'+h(btn)+'</button>':zone==='wait'&&i.wait3?'<span class="dz-btns dz-w3"><button type="button" data-dz="open" data-key="'+k+'" data-act="contact">결정권자에게 연락</button><button type="button" data-dz="judge" data-key="'+k+'">관리자 판단 요청</button><button type="button" data-dz="hold" data-key="'+k+'">보류로 전환</button></span>':(zone==='wait'||zone==='nowait')?'<button type="button" data-dz="open" data-key="'+k+'" data-act="next">'+h(btn)+'</button>':chk?(INLINE()?'<button type="button" data-dz="chk" data-key="'+k+'" aria-expanded="'+!!(S.chk&&S.chk.key===i.key)+'">'+h(btn)+'</button>':'<button type="button" data-dz="go" data-key="'+k+'" data-act="activity">'+h(btn)+'</button>'):'<button type="button" data-t3="act" data-key="'+k+'" data-act="'+attr(i.act||'전화')+'"'+(i.i&&i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>'+h(btn)+'</button>')+'</div>'+ev+(DX&&INLINE()?DX.chkHtml(i,S):'')+(INLINE()&&rq0&&S.reqOpen===i.key&&WRQ&&WRQ.inlineHtml&&zone==='now'?'<div class="dz-reqform">'+(i.reqs||[]).map(r=>WRQ.inlineHtml(r.id)).join('')+'</div>':'');
 }
 function gapHtml(g,S){
  const k=attr(g.key),bc=BRAND[g.d.brand]||'#9aa0ab',busy=S.busy===g.key,ask=S.ask===g.key;
  return '<div class="dz-row dz-gap" data-key="'+k+'" style="border-left-color:'+bc+'"><div class="c1"><b title="'+attr(g.d.site||'')+'">'+h(g.d.site||g.d.site_name||'현장명 미입력')+'</b><div><span>'+h(g.owner||'미배정')+' · '+h(md(g.day))+' 응대 완료</span></div></div><span class="c2"><mark>"'+h(cut(g.title,60))+'"</mark></span><div class="c3"><span class="dz-gapwhy">업무 없음</span><small>'+h(g.due?'약속 날짜 '+md(g.due):'날짜 없음 · AI 제안 3일 후')+' · 응대 완료 ≠ 약속 완료</small></div>'
   +'<span class="dz-btns"><button type="button" class="pri" data-dz="mk" data-key="'+k+'"'+(busy?' disabled':'')+'>'+(busy?'등록 중…':'업무로 만들기')+'</button><button type="button" data-dz="'+(INLINE()?'did':'go')+'" data-key="'+k+'" data-act="activity"'+(busy?' disabled':'')+'>이미 함</button></span></div>'
   +(ask&&INLINE()?'<div class="dz-ask"><span>이미 함 · 근거 한 줄</span><input data-dz-in="note" maxlength="120" placeholder="예: 10.7 사진 받아 견적 발송함" value="'+attr(S.note||'')+'">'+[['완료','완료'],['미완료','미완료'],['확인 불가','확인 불가']].map(x=>'<button type="button" data-dz="didsave" data-key="'+k+'" data-v="'+x[0]+'"'+(busy?' disabled':'')+'>'+x[1]+'</button>').join('')+'<button type="button" data-dz="didclose">닫기</button>'+(S.err?'<em>'+h(S.err)+'</em>':'')+'</div>':'');
 }
 function hiddenHtml(Z,all){
  /* 필터(브랜드 · 담당 · 검색)로 숨은 내 요청: 전체(unscoped) 항목에는 있는데 지금 목록에는 없는 요청 대상 */
  try{const RQ=reqMap();if(!RQ.size)return '';let n=0;RQ.forEach((rs,k)=>{const r=rs[0];let item=null;try{item=k.startsWith('inq:')?R.inqCtlFind(String(r.target_id),false):((R.B&&R.B.deals)||[]).find(d=>String(d.id)===String(r.target_id));}catch(e){}if(item&&!scopeOk(item,R.repN(item.assignee)||''))n++;});const G=R.G||{};let brands=[];try{brands=(R.SalesFilterState&&R.SalesFilterState.state().brands)||[];}catch(e){}if(!brands.length&&G.brand&&G.brand!=='전체')brands=[G.brand];const f=[brands.join(' · '),G.todayQueueOwner&&G.todayQueueOwner!=='전체'?G.todayQueueOwner:'',String(G.todayQueueSearch||'').trim()?'검색':''].filter(Boolean);
   if(!n||!f.length)return '';return '<div class="dz-hidden"><b>필터 때문에 숨은 내 요청 '+n+'건</b><span>('+h(f.join(' · '))+' 필터 중)</span><button type="button" data-dz="unhide">보기</button></div>';}catch(e){return '';}
 }
 function html(Z,_S,pass){const S=st();/* 상태(구역 · 근거 보기 · 쪽)는 이 모듈 것 하나만 쓴다 */
  const P=R.ListPager;
  const lists={now:Z.now.filter(pass),wait:Z.wait.filter(pass),info:Z.info.filter(pass),gaps:Z.gaps},DX=R.DayExtra&&R.DayExtra.on()?R.DayExtra:null;if(!DX){S.rs='';S.closing=false;}
  if(!lists[S.zone]&&S.zone!=='now')S.zone='now';
  const tabs='<div class="dz-tabs" role="tablist">'+ZONES.map(z=>'<button type="button" role="tab" data-dz="zone" data-v="'+z[0]+'" aria-selected="'+(S.zone===z[0])+'"><span>'+h(z[1])+' <b'+(z[0]==='now'&&lists.now.length?' class="r"':'')+'>'+lists[z[0]].length+'</b></span><small>'+h(z[2])+'</small></button>').join('')+'</div>';
  const z=ZONES.find(x=>x[0]===S.zone)||ZONES[0],rz=z[0]==='now'&&DX&&S.rs==='nowait'?'nowait':z[0],list=rz==='nowait'?(Z.nowait||[]).filter(pass):z[0]==='now'&&DX&&S.rs?lists.now.filter(i=>DX.passRs(i,S)):lists[z[0]],pg=P?P.cut(list,P.page(S,'z'+z[0]),PER):{rows:list.slice(0,PER)};
  const head='<div class="dz-head"><span>현장</span><span>'+h(z[3])+'</span><span>먼저 하는 이유 · '+h(z[4])+'</span><span></span></div>';
  const rows=pg.rows.length?pg.rows.map(i=>z[0]==='gaps'?gapHtml(i,S):rowHtml(i,rz,S)).join(''):'<p class="dz-empty">'+(z[0]==='now'?'지금 처리할 건이 없습니다.':z[0]==='wait'?'회신을 기다리는 건이 없습니다.':z[0]==='info'?'보완할 기록이 없습니다.':'연결된 업무가 없는 약속이 없습니다.')+'</p>';
  return popupHtml(Z.me)+hiddenHtml(Z)+'<section class="dz" data-zone="'+z[0]+'">'+tabs+(DX?'<div class="dx-bar">'+DX.stripHtml(Z,S)+'<i></i><button type="button" class="dx-closebtn" data-dz="close" aria-pressed="'+!!S.closing+'">오늘 마감</button></div>':'')+(DX&&S.closing?DX.closeHtml(Z,LASTX,S):'<div class="dz-table">'+head+rows+(P&&pg.pages>1?P.html(pg,{ns:'dz',v:'z'+z[0],small:true}):'')+'<div class="dz-note">'+h(rz==='nowait'?'대기 사유만 있고 확인일이 없는 건 · 확인일을 정하면 회신 대기로 옮겨집니다':z[5])+'</div></div>')+'</section>';
 }
 /* ── 누르기 ── */
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const rerender=()=>{try{R.TodayV2.render();}catch(e){try{R.paint();}catch(e2){}}};
 let LAST=null,LASTX=null;
 function onRow(e){
  if(INLINE()||!e.target.closest)return;const row=e.target.closest('#today-v2 .dz .dz-row');if(!row||e.target.closest('button,a,input,select,textarea,label,mark'))return;const key=row.dataset.key,it=findItem(key);
  if(it){openItem(it,'');return;}const g=LAST&&LAST.gaps.find(x=>x.key===key);if(g){try{R.G._detailPopup=true;R.drwDeal(JSON.stringify(g.d));}catch(err){}}
 }
 function onClick(e){
  const b=e.target.closest('#today-v2 [data-dz]');if(!b||b.disabled)return;e.preventDefault();e.stopPropagation();const S=st(),a=b.dataset.dz,key=b.dataset.key;
  if(R.DayExtra&&R.DayExtra.on()&&R.DayExtra.onAction(a,b,S,LAST,LASTX))return;
  if(a==='req'){S.reqOpen=S.reqOpen===key?'':key;S.why='';S.chk=null;return rerender();}
  if(a==='go'){const it=findItem(key);if(it){openItem(it,b.dataset.act||'');return;}const g=LAST&&LAST.gaps.find(x=>x.key===key);if(g){try{R.G._detailPopup=true;R.drwDeal(JSON.stringify(g.d));}catch(err){}if(b.dataset.act)setTimeout(()=>{try{R.DealDetailV3&&R.DealDetailV3.openFrom&&R.DealDetailV3.openFrom(b.dataset.act);}catch(x){}},300);}return;}
  if(a==='rqgo'||a==='rqok'){const id=b.dataset.id;ackAssign('rq:'+id);try{R.WorkRequest.markSeen(id);}catch(e){}if(a==='rqgo'){const it=LAST&&LAST.now.find(x=>(x.reqs||[]).some(r=>r.id===id));S.zone='now';S.rs='';S.closing=false;if(it){if(INLINE())S.reqOpen=it.key;else{rerender();openItem(it,'activity');return;}}}return rerender();}
  if(a==='zone'){S.zone=b.dataset.v;S.why='';S.reqOpen='';S.rs='';S.chk=null;S.closing=false;if(R.ListPager)R.ListPager.reset(S);return rerender();}
  if(a==='why'){S.why=S.why===key?'':key;return rerender();}
  if(a==='page'){if(R.ListPager)R.ListPager.set(S,b.dataset.v,b.dataset.page);return rerender();}
  if(a==='unhide'){const G=R.G;try{if(R.SalesFilterState)R.SalesFilterState.selectBrand('전체');}catch(e){}G.brand='전체';try{R.CommonFilterBar&&R.CommonFilterBar.setOwner&&R.CommonFilterBar.setOwner('전체');}catch(e){}G.todayQueueOwner='전체';try{R.CommonFilterBar&&R.CommonFilterBar.setSearch&&R.CommonFilterBar.setSearch('');}catch(e){}G.todayQueueSearch='';G.q='';try{R.paint();}catch(e){rerender();}return;}
  if(a==='open'){try{R.TodayWorkQueue.open(key,b.dataset.act||undefined);}catch(e){}return;}
  if(a==='judge'||a==='hold'){const it=LAST&&[].concat(LAST.wait,LAST.now).find(x=>x.key===key);if(!it||it.x.type!=='deal')return;const d=it.x.item;
   if(a==='judge'){const D=R.DealDetailV3;if(!D||!D.memo){toast('상세 저장 기능을 불러오지 못했습니다','warn');return;}const n=waitCount(d);Promise.resolve(D.memo(d,'[지원 요청] 같은 이유로 '+n+'번째 회신 대기 · 관리자 판단 요청 — '+String(it.wait&&it.wait.reason||''),{})).then(()=>{toast('관리자 판단을 요청했습니다 · 관리자 오늘 업무에 결정 요청으로 뜹니다');rerender();}).catch(e=>toast('요청하지 못했습니다: '+String(e&&e.message||e),'warn'));return;}
   /* 보류로 전환 = 상세 열고 단계 바꾸기(대기 · 보류) */
   try{R.G._detailPopup=true;R.drwDeal(JSON.stringify(d));setTimeout(()=>{try{R.StageTransitionUI.open(d,false,'waiting');}catch(e){}},350);}catch(e){}return;}
  if(a==='popgo'||a==='popok'){const id=b.dataset.id;ackAssign(id);if(a==='popgo'){try{R.TodayWorkQueue.open('inq:'+id,'contact');}catch(e){}}return rerender();}
  if(a==='popall'){(newAssigns(LAST&&LAST.me||'')||[]).forEach(q=>ackAssign(String(q.id)));return rerender();}
  const g=LAST&&LAST.gaps.find(x=>x.key===key);if(!g)return;
  if(a==='did'){S.ask=key;S.note='';S.err='';return rerender();}
  if(a==='didclose'){S.ask='';S.err='';return rerender();}
  if(a==='mk')return makeTask(g);
  if(a==='didsave')return markDone(g,b.dataset.v);
 }
 /* [업무로 만들기] = 그 영업건의 다음 행동 등록(기존 저장 길 DealDetailV3.next) · 기한 = 약속 날짜(없으면 3일 후 제안) */
 async function makeTask(g){
  const S=st(),D=R.DealDetailV3;if(S.busy)return;if(!D||!D.next){toast('상세 저장 기능을 불러오지 못했습니다','warn');return;}
  const due=g.due&&g.due>=KST()?g.due:KST(new Date(Date.now()+3*864e5));S.busy=g.key;S.err='';rerender();
  try{await D.next(g.d,{type:/방문/.test(g.title)?'방문':/자료|견적|사진|메일/.test(g.title)?'후속접촉':'전화',text:'고객 약속: '+cut(g.title,60),due,P:{}});S.done[g.key]=true;toast('업무로 등록했습니다 · '+cut(g.title,30)+' · '+md(due));}
  catch(e){toast('등록하지 못했습니다: '+String(e&&e.message||e),'warn');}
  S.busy='';rerender();
 }
 /* [이미 함] = 근거 한 줄 + 완료 / 미완료 / 확인 불가 → 내부 메모 '[약속 확인] …'(다음 행동은 건드리지 않음) */
 async function markDone(g,v){
  const S=st(),D=R.DealDetailV3;if(S.busy)return;const note=String(S.note||'').trim();if(!note){S.err='근거 한 줄을 적어 주세요';return rerender();}
  if(!D||!D.memo){toast('상세 저장 기능을 불러오지 못했습니다','warn');return;}
  S.busy=g.key;S.err='';rerender();
  try{await D.memo(g.d,'[약속 확인] '+v+' · "'+cut(g.title,40)+'" — '+note,{});S.done[g.key]=true;S.ask='';toast('약속 확인을 남겼습니다 · '+v);}
  catch(e){S.err='저장하지 못했습니다: '+String(e&&e.message||e);}
  S.busy='';rerender();
 }
 if(typeof document!=='undefined'){document.addEventListener('click',onClick,true);document.addEventListener('click',onRow);document.addEventListener('click',e=>{/* [전화] 등 줄 · 카드의 단추로 여는 것도 요청을 본 것 */if(INLINE()||!e.target.closest)return;const b=e.target.closest('#today-v2 .dz .dz-row [data-t3="act"], #today-v2 .dz-cards [data-t3="act"]');if(!b)return;const it=findItem(b.dataset.key);if(it)(it.reqs||[]).forEach(r=>{try{R.WorkRequest.markSeen(r.id);}catch(x){}});},true);document.addEventListener('input',e=>{const t=e.target;if(t&&t.matches&&t.matches('#today-v2 [data-dz-in="note"]'))st().note=t.value;},true);}
 return {on,reqRowIds,reqTagHtml,reqMemo,newRequests,build:(V,X)=>{LASTX=X;return (LAST=build(V,X));},html,evidence,action,ACTION,waitingOf,waitCount,promiseGaps,reqMap,reqTag,newAssigns,ackAssign,ZONES,state:st,last:()=>LAST};
});
