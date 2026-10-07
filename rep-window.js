/* 영업사원 관리 · 사람 창 v2 (2026-10-04 design_handoff_rep_window · 영업사원 관리 창 v2.dc.html) — 사람을 눌렀을 때 뜨는 창만. 목록 · 다른 메뉴는 그대로.
   머리: 이름 · 소속 · 상태 꼬리표 + 숫자 4개(진행 금액 · 손볼 건 · 메이드율 · 업무량)
   왼쪽(판단 → 코칭): 가장 큰 병목 한 문장 + 보조 한 줄 → 흐름 막대(배정 → 응대 → 기회 → 경쟁 → 수주) + 가장 많이 빠지는 구간 → 이번 주 코칭 · 한 가지(첫 응대 · 다음 행동 · 견적 지연 · 약속 미이행) → 지난 코칭 · 이번 주 결과(전 → 후)
   오른쪽(손볼 건): 사유별 묶음(다음 할 일 없음 · 날짜 지남 · 첫 연락 전 · 30일 넘게 같은 단계) — 묶음 제목에 사유 · 건수 · 걸린 금액 · [일괄 요청] 1개, 펼치면 금액 큰 순 5건 + 전체 보기. 줄에서는 사유를 되풀이하지 않는다.
   ■ 자료는 목록과 같은 한 줄(repFlowData 의 r) · 메이드율은 대시보드와 같은 함수(BriefB.lib.made = CRMRules.madeRate) · 견적 지연은 관리팀 KPI '방문 후 3일 견적'과 같은 건(KpiB.stageItems).
   ■ 코칭 저장 · 일괄 요청은 기존 '주간 관리자 한마디'(rep_manager_comment) 한 길 — 새 저장소 없음. 담당자 오늘 업무(모바일 '관리자 한마디')에 그대로 뜬다.
     코칭 한 줄: "[코칭 · 주제] 약속 문장 (지표 전 → 목표)". 다음 주부터 같은 지표를 다시 계산해 '이번 주 결과'로 보여 준다(월요일 자동 확인).
   ■ 숫자는 전부 자료에서 계산한다. 잴 수 없으면 '아직 잴 수 없음'.
   끄기: G.repWindowOff=true → 예전 사람별 창(reps-v2). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const RED='#b42318',AMB='#c0392b',INK='#15171c',GREEN='#1f7a4d',GRAY='#9ca3af';
 const enabled=()=>!root.G.repWindowOff&&!!root.RepsV2;
 const RULE=()=>(root.CRMRules&&root.CRMRules.PHASE5&&root.CRMRules.PHASE5.coaching_box)||{topics:['첫 응대','다음 행동','견적 지연','약속 미이행']};
 const eok=v=>root.eok(v),num=v=>Number(v)||0,pct=(a,b)=>b?Math.round(a*100/b):null;
 const toast=(m,t)=>{if(typeof root.toast==='function')root.toast(m,t);};
 const team=n=>{try{const p=root.repProfile(n);return p.team==='gyeongnam'?'경남지사':p.employeeType==='EXTERNAL'?'외부 영업':'본사 영업';}catch(e){return '본사 영업';}};
 const title=n=>{try{const p=root.repProfile(n);return String(p.title||p.position||'').trim();}catch(e){return '';}};
 const TAG={critical:['관리자 확인 필요','r'],watch:['확인 필요','a'],ok:['여유','g']};
 const LOAD={'관리부하':'관리 부하'};
 const amt=d=>num(root.oppAmt(d));
 const nextOf=d=>{try{return root.actionObj(d,root.itemPatch(d,'deal'));}catch(e){return null;}};
 const issues=d=>{try{return root.issueSet(d)||[];}catch(e){return [];}};
 const mdOf=v=>{const d=new Date(v);return Number.isFinite(d.getTime())?(d.getMonth()+1)+'.'+d.getDate():'';};
 /* ── 손볼 건: 사유별 묶음. 한 건은 한 묶음에만(다음 할 일 없음 → 날짜 지남 → 30일 넘게 같은 단계) ── */
 function inquiriesOf(r){
  try{const w=root.repManagerPeriodWindow();return root.operationalInquiries((root.B&&root.B.inquiries)||[]).filter(q=>!(q.deleted_at||q.deletedAt)&&root.inquiryRoutedOwner(q)===r.nm&&root.repFlowIn(root.inquiryAssignedAt(q)||root.inquiryCreatedAt(q),w));}catch(e){return [];}
 }
 function groups(r){
  const cur=r.current||[],noNext=cur.filter(d=>issues(d).includes('nextMissing')),over=cur.filter(d=>!noNext.includes(d)&&issues(d).includes('overdue')),used=new Set(noNext.concat(over)),stale=(r.riskDeals||[]).filter(d=>!used.has(d)),inq=inquiriesOf(r),first=inq.filter(q=>!root.inquiryResponded(q));
  const overDays=d=>{const n=nextOf(d),v=n&&n.due?root.daysTo(n.due):null;return v!==null&&v<0?-v:0;},stay=d=>{try{return num(root.stageAge(d));}catch(e){return 0;}};
  const sum=l=>l.reduce((a,d)=>a+amt(d),0),money=(l,pre)=>{const s=sum(l);return s?pre+eok(s):'금액 미정';},byAmt=l=>l.slice().sort((a,b)=>amt(b)-amt(a));
  const G=[];
  if(noNext.length)G.push({k:'nonext',t:'다음 할 일 없음',n:noNext.length,c:RED,amt:money(noNext,'진행 '),bulk:'다음 할 일 등록 요청',kind:'deal',rows:byAmt(noNext).map(d=>({d,note:'날짜 없음'}))});
  if(over.length)G.push({k:'overdue',t:'다음 할 일 날짜 지남',n:over.length,c:AMB,amt:money(over,'진행 ')+' · 최장 '+Math.max(...over.map(overDays))+'일',bulk:'날짜 다시 잡기 요청',kind:'deal',rows:byAmt(over).map(d=>({d,note:overDays(d)+'일 지남'}))});
  if(first.length)G.push({k:'first',t:'신규 배정 · 첫 연락 전',n:first.length,c:RED,amt:money(first,'예상 '),bulk:'첫 연락 요청',kind:'inq',rows:byAmt(first).map(d=>({d,note:'배정 후 CRM 연락 기록 없음'}))});
  if(stale.length)G.push({k:'stale',t:'30일 넘게 같은 단계',n:stale.length,c:AMB,amt:money(stale,'진행 '),bulk:'진행 · 보류 정리 요청',kind:'deal',rows:byAmt(stale).map(d=>({d,note:stay(d)+'일째'}))});
  return {G,cur,noNext,over,first,stale,inq,overMax:over.length?Math.max(...over.map(overDays)):0,total:G.reduce((a,g)=>a+g.n,0)};
 }
 /* ── 메이드율: 대시보드 '담당자별 메이드율'과 같은 식(직접 수주 + 협약 · 기술자문 + 인정된 타사 이관) ÷ (+ 실주) · 배드핏 제외 · 영업사원 관리의 조회 기간 ── */
 function made(n){
  try{const B=root.BriefB&&root.BriefB.lib;if(!B)return null;const w=root.repManagerPeriodWindow(),a=w.start,b=w.end,L=B.ledger(null);if(!L||!L.ready)return null;
   const inR=k=>!!k&&k>=a&&k<b,c=B.contractsIn(L,a,b,n,'direct').count,l=root.briefScopeDeals(null,false).filter(d=>B.isLoss(d)&&root.repN(d.assignee)===n&&inR(B.closedKey(d))).length;
   const DT=root.DealTransfer&&root.DealTransfer.enabled()?root.DealTransfer:null,DW=root.DealWin&&root.DealWin.enabled()?root.DealWin:null,t=DT?DT.wonIn(a,b,n).count:0,p=DW?DW.partnerIn(a,b,n).count:0;
   return (c+t+p+l)?B.made(c,l,t,p):null;}catch(e){return null;}
 }
 /* ── 가장 큰 병목 한 문장 + 보조 한 줄 ── */
 function neck(r,M){
  const c=M.cur.length,cand=[];
  if(M.noNext.length)cand.push({k:'nonext',n:M.noNext.length,main:'진행 '+c+'건 중 '+M.noNext.length+'건이 다음 할 일 없음',sub:'다음 할 일 없는 건도 '+M.noNext.length+'건'});
  if(M.over.length)cand.push({k:'overdue',n:M.over.length,main:'진행 '+c+'건 중 '+M.over.length+'건이 다음 할 일 날짜 지남',sub:'다음 할 일 날짜 지난 건도 '+M.over.length+'건 · 최장 '+M.overMax+'일'});
  if(M.first.length)cand.push({k:'first',n:M.first.length,main:'신규 배정 '+M.inq.length+'건 중 '+M.first.length+'건이 아직 첫 연락 전',sub:'신규 배정 '+M.first.length+'건도 아직 첫 연락 전'});
  if(M.stale.length)cand.push({k:'stale',n:M.stale.length,main:'진행 '+c+'건 중 '+M.stale.length+'건이 30일 넘게 같은 단계',sub:'30일 넘게 같은 단계인 건도 '+M.stale.length+'건'});
  if(!cand.length)return {ok:true,k:'',main:'지금 막힌 곳이 없습니다',sub:(r.diagnosis&&r.diagnosis.text)||''};
  const top=cand.slice().sort((a,b)=>b.n-a.n)[0],rest=cand.filter(x=>x!==top),second=rest.find(x=>x.k==='first')||rest.slice().sort((a,b)=>b.n-a.n)[0];
  return {ok:false,k:top.k,main:top.main,sub:second?second.sub:''};
 }
 /* ── 흐름 + 가장 많이 빠지는 구간(이웃한 두 단계의 차가 가장 큰 곳) ── */
 function flow(r){
  const F=[['배정',num(r.assigned)],['응대',num(r.responded)],['기회',num(r.opps)],['경쟁',num(r.compete)],['수주',num(r.won)]],base=Math.max(1,...F.map(x=>x[1]));let bi=-1,bd=0;
  for(let i=0;i<F.length-1;i++){const d=F[i][1]-F[i+1][1];if(d>bd){bd=d;bi=i;}}
  return {F,base,drop:bi<0?(F.some(x=>x[1])?'줄어든 구간 없음':'이 기간 기록 없음'):F[bi][0]+' → '+F[bi+1][0]+'에서 가장 많이 빠짐 ('+F[bi][1]+' → '+F[bi+1][1]+')'};
 }
 /* ── 이번 주 코칭 · 한 가지: 주제마다 근거 숫자(자료에서) + 약속 문장 + 다음 주에 다시 잴 지표 ── */
 function firstHours(M){
  const hrs=M.inq.map(q=>{try{const a=Date.parse(root.inquiryAssignedAt(q)||root.inquiryCreatedAt(q)||''),b=Date.parse(root.inqCtlFirstResponseAt(q)||'');return Number.isFinite(a)&&Number.isFinite(b)&&b>=a?(b-a)/36e5:null;}catch(e){return null;}}).filter(x=>x!=null);
  return hrs.length?Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length*10)/10:null;
 }
 function quoteStats(r){
  try{const K=root.KpiB;if(!K||typeof K.stageItems!=='function')return null;const met=K.stageItems().filter(it=>it.stage==='consulting'&&it.bucket==='done'&&root.repN(it.row.item.assignee)===r.nm),late=met.filter(it=>it.rs.includes('nodue'));
   return {met:met.length,late:late.length,avg:late.length?Math.round(late.reduce((a,it)=>a+num(it.stall),0)/late.length):null};}catch(e){return null;}
 }
 function topics(r,M){
  const T=RULE().topics,OK='현재 양호 · 유지',avg=firstHours(M),q=quoteStats(r);
  let qd=3,qt=80,warn=80;try{qd=Number(root.PipelineStageB.rules().quote)||3;}catch(e){}try{qt=Number(root.KpiB.DEF[5][4])||80;}catch(e){}try{warn=Math.round(Number(root.CRMRules.PHASE2.promise_keeping.warn_below)*100)||80;}catch(e){}
  const c=M.cur.length,miss=M.noNext.length,rate=pct(c-miss,c),step=Math.min(10,miss),f=M.first.length;
  const due=M.cur.filter(d=>{const n=nextOf(d);return !!(n&&n.due);}),kept=due.filter(d=>root.daysTo(nextOf(d).due)>=0),keep=pct(kept.length,due.length),qr=q&&q.met?pct(q.met-q.late,q.met):null;
  return [
   {l:T[0],ai:f?'신규 배정 '+f+'건 · '+(avg!=null?'평균 첫 연결 '+avg+'시간':'첫 연결 기록 없음'):(M.inq.length?'신규 배정 '+M.inq.length+'건 모두 첫 연락 완료'+(avg!=null?' · 평균 첫 연결 '+avg+'시간':''):'이 기간 신규 배정 없음'),txt:f?'금요일까지 신규 배정 '+f+'건 첫 연락 완료':OK,m:{l:'첫 연락 전',u:'건',v:f,to:0,lower:true}},
   {l:T[1],ai:c?'진행 '+c+'건 중 '+miss+'건 다음 할 일 없음 (등록률 '+rate+'%)':'진행 중인 현장 없음',txt:miss?'이번 주 금액 큰 '+step+'건부터 다음 할 일 · 날짜 등록':OK,m:{l:'다음 할 일 등록률',u:'%',v:rate,to:c?pct(c-miss+step,c):null}},
   {l:T[2],ai:!q||!q.met?'미팅 완료 건이 없어 아직 잴 수 없음':q.late?'방문 후 견적 요청 없이 평균 '+q.avg+'일 · 미팅 완료 '+q.met+'건 중 '+q.late+'건':'미팅 완료 '+q.met+'건 모두 '+qd+'일 안 견적 요청',txt:q&&q.met&&!q.late?OK:'방문 후 '+qd+'일 안에 견적 요청 등록',m:{l:'방문 후 '+qd+'일 견적',u:'%',v:qr,to:qr==null?null:Math.max(qt,qr)}},
   {l:T[3],ai:due.length?'약속 '+due.length+'건 중 '+kept.length+'건 기한 내 ('+keep+'%)':'날짜가 있는 다음 할 일이 없어 아직 잴 수 없음',txt:due.length&&keep<warn?'기한 지난 약속 '+(due.length-kept.length)+'건 이번 주 안에 완료 · 날짜 다시 잡기':OK,m:{l:'약속 기한 내',u:'%',v:keep,to:keep==null?null:Math.max(warn,keep)}}];
 }
 /* ── 주간 관리자 한마디(기존 저장 경로) 읽고 쓰기 ── */
 const week=o=>root.repManagerWeekKey(o||0);
 const commentOf=(rep,wk)=>{try{return root.repManagerComment(rep,wk);}catch(e){return null;}};
 const linesOf=c=>String((c&&c.comment)||'').split('\n').map(s=>s.trim()).filter(Boolean);
 const isReq=s=>/^· \[/.test(s);
 const COACH=/^\[코칭 · ([^\]]+)\]\s*(.*?)(?:\s*\(([^()]*?) (\d+(?:\.\d+)?)(%|건)(?: → (\d+(?:\.\d+)?)(?:%|건)| 유지)\))?$/;
 function coachLine(t,txt){const m=t.m,tail=m&&m.v!=null&&m.to!=null?' ('+m.l+' '+m.v+m.u+(m.v===m.to?' 유지':' → '+m.to+m.u)+')':'';return '[코칭 · '+t.l+'] '+String(txt).trim()+tail;}
 function parse(comment){
  const lines=linesOf({comment});
  for(const s of lines){const m=COACH.exec(s);if(m)return {topic:m[1],txt:m[2],m:m[3]?{l:m[3],from:Number(m[4]),u:m[5],to:m[6]!=null?Number(m[6]):Number(m[4])}:null};}
  const free=lines.filter(s=>!isReq(s));return free.length?{free:free.join(' ')}:null;
 }
 function write(rep,text){
  const wk=week(0),actor=(root.ME&&root.ME.name)||'관리자',at=root.isoNow(),row={rep_name:rep,week_start:wk,comment:text,status:'open',created_by:actor,updated_at:at};
  const local=root.repManagerLocalComments().filter(x=>!(x.rep_name===rep&&x.week_start===wk));local.push(row);
  root.Phase1.storage.setItem(root.REP_MANAGER_COMMENT_KEY||'netform_crm_rep_manager_comments_v1',JSON.stringify(local));
  root.pushWrite('rep_manager_comment',{rep_name:rep,week_start:wk,comment:text,status:'open',created_by:actor,updated_at:at});
 }
 /* 지난 코칭 = 이번 주보다 앞선 주에 남긴 가장 최근 것 */
 function past(rep){
  const wk=week(0),wkOf=x=>String(x.week_start||x.weekStart||'').slice(0,10);
  try{const all=root.repManagerComments().filter(x=>(x.rep_name||x.rep)===rep&&wkOf(x)&&wkOf(x)<wk).sort((a,b)=>wkOf(b).localeCompare(wkOf(a)));
   for(const c of all){const p=parse(c.comment);if(p)return Object.assign(p,{at:mdOf(c.updated_at||c.updatedAt||wkOf(c))});}}catch(e){}
  return null;
 }
 /* ── 그리기 ── */
 let cur=null,st=null,returnFocus=null;
 const rowOf=()=>(root.REP_MANAGER_ROWS||[]).find(x=>x.nm===cur)||null;
 function html(r){
  const M=groups(r),t=TAG[r.diagnosis.k]||TAG.watch,load=root.repManagerLoadLevel(r),mr=made(r.nm),N=neck(r,M),FL=flow(r),T=topics(r,M),thisWeek=commentOf(r.nm,week(0)),saved=parse(thisWeek&&thisWeek.comment),savedIdx=saved&&saved.topic?T.findIndex(x=>x.l===saved.topic):-1;
  if(st.c==null)st.c=savedIdx>=0?savedIdx:({first:0,nonext:1,overdue:3,stale:1}[N.k]??1);
  if(!st.open)st.open=M.G.length?{[M.G[0].k]:true}:{};
  const sel=T[st.c],txt=st.txt!=null?st.txt:(savedIdx===st.c&&saved.txt?saved.txt:sel.txt),tm=team(r.nm),tt=title(r.nm),role=[tm,tt&&tt.replace(/\s+/g,'')!==tm.replace(/\s+/g,'')?tt:''].filter(Boolean).join(' · ');
  const loadC=load.cls==='heavy'||load.cls==='busy'?AMB:load.cls==='free'?GREEN:INK;
  const kpi=[['진행 금액',eok(r.pipeline),INK],['손볼 건',M.total+'건',M.total?RED:INK],['메이드율',mr==null?'–':mr.toFixed(1)+'%',INK],['업무량',LOAD[load.label]||load.label,loadC]];
  const head='<header class="rw-head"><div class="rw-who"><b id="rwTitle">'+h(r.nm)+'</b><span>'+h(role)+'</span><em class="'+t[1]+'">'+t[0]+'</em></div><div class="rw-sp"></div>'+kpi.map(k=>'<div class="rw-kpi"><span>'+k[0]+'</span><b style="color:'+k[2]+'">'+h(k[1])+'</b></div>').join('')+'<button type="button" class="rw-x" data-rw="close" aria-label="닫기">×</button></header>';
  /* 지난 코칭 · 이번 주 결과 */
  const P=past(r.nm);let pastHtml;
  if(!P)pastHtml='<span class="none">아직 없습니다 · 저장하면 다음 주 월요일부터 결과가 보입니다</span>';
  else if(P.m){const now=(T.find(x=>x.l===P.topic)||{m:{}}).m,v=now.v,reached=v!=null&&(now.lower?v<=P.m.to:v>=P.m.to),better=v!=null&&(now.lower?v<P.m.from:v>P.m.from);
   pastHtml='<span>"'+h(P.m.l+' '+P.m.from+P.m.u+(P.m.from===P.m.to?' 유지':' → '+P.m.to+P.m.u))+'" <small>· '+h(P.at)+'</small></span><div class="rw-res"><span>이번 주 결과</span><b style="color:'+(v==null?GRAY:reached?GREEN:better?AMB:RED)+'">'+h(P.m.from+P.m.u+' → '+(v==null?'–':v+P.m.u))+'</b></div>';}
  else pastHtml='<span>"'+h(P.txt||P.free)+'" <small>· '+h(P.at)+'</small></span><div class="rw-res"><span>이번 주 결과</span><b style="color:'+GRAY+'">숫자 기준 없음</b></div>';
  const left='<div class="rw-neck'+(N.ok?' ok':'')+'"><span>가장 큰 병목</span><b>'+h(N.main)+'</b>'+(N.sub?'<span>'+h(N.sub)+'</span>':'')+'</div>'
   +'<div class="rw-flow"><b>흐름</b>'+FL.F.map((x,i)=>'<div class="rw-fl"><span>'+x[0]+'</span><i><u class="'+(i===4?'g':'')+'" style="width:'+Math.round(x[1]/FL.base*100)+'%"></u></i><b>'+x[1]+'</b></div>').join('')+'<span class="rw-drop">'+h(FL.drop)+'</span></div>'
   +'<div class="rw-co"><b>이번 주 코칭 · 한 가지</b><div class="rw-chips">'+T.map((x,i)=>'<button type="button" data-rw="pick" data-i="'+i+'" aria-pressed="'+(st.c===i)+'">'+h(x.l)+'</button>').join('')+'</div>'
   +'<span class="rw-ai"><b>AI</b>'+h(sel.ai)+'</span><input type="text" data-rw-f="promise" maxlength="200" aria-label="이번 주 약속" value="'+attr(txt)+'">'
   +'<div class="rw-cof"><span>'+(savedIdx>=0?'저장됨 '+h(mdOf(thisWeek.updated_at||thisWeek.updatedAt||''))+' · 월요일 자동 확인':'다음 주 월요일 결과 자동 확인')+'</span><button type="button" data-rw="save">코칭 저장</button></div></div>'
   +'<div class="rw-past"><b>지난 코칭</b>'+pastHtml+'</div>';
  const reqs=linesOf(thisWeek).filter(isReq);
  const right='<div class="rw-rh"><b>지금 처리할 현장 '+M.total+'건</b><span>사유별로 묶음 · 금액 큰 순</span></div>'+(M.G.length?M.G.map(g=>{
    const op=!!st.open[g.k],all=!!st.all[g.k],shown=op?(all?g.rows:g.rows.slice(0,5)):[],sent=reqs.some(s=>s.includes('[요청] '+g.bulk));
    return '<div class="rw-g" data-g="'+g.k+'"><div class="rw-gh"><b>'+h(g.t)+'</b><b style="color:'+g.c+'">'+g.n+'건</b><span>'+h(g.amt)+'</span><div class="rw-sp"></div><button type="button" class="rw-bulk'+(sent?' done':'')+'" data-rw="bulk" data-g="'+g.k+'"'+(sent?' disabled':'')+'>'+(sent?'요청함':h(g.bulk))+'</button><button type="button" class="rw-tg" data-rw="toggle" data-g="'+g.k+'" aria-expanded="'+op+'">'+(op?'접기 ▴':'보기 ▾')+'</button></div>'
     +shown.map(x=>'<div class="rw-row"><b>'+h(x.d.site||'현장명 미입력')+'</b><span>'+h(x.note)+'</span><b class="a">'+h(amt(x.d)?eok(amt(x.d)):'-')+'</b><a href="#" data-rw="row" data-g="'+g.k+'" data-i="'+g.rows.indexOf(x)+'">열기</a></div>').join('')
     +(op&&!all&&g.rows.length>5?'<button type="button" class="rw-all" data-rw="all" data-g="'+g.k+'">나머지 '+(g.rows.length-5)+'건 전체 보기</button>':'')+'</div>';
   }).join(''):'<p class="rw-none">지금 손볼 건이 없습니다.</p>');
  return head+'<div class="rw-body"><aside class="rw-left">'+left+'</aside><section class="rw-right">'+right+'</section></div>';
 }
 function node(){
  let m=document.getElementById('repWindow');if(m)return m;
  m=document.createElement('div');m.id='repWindow';m.className='rw-layer';m.innerHTML='<section class="rw-box" role="dialog" aria-modal="true" aria-labelledby="rwTitle"></section>';
  m.addEventListener('mousedown',e=>{if(e.target===m)close();});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
  m.addEventListener('click',onClick);
  m.addEventListener('input',e=>{if(e.target.matches('[data-rw-f="promise"]')&&st)st.txt=e.target.value;});
  document.body.append(m);return m;
 }
 function render(){const r=rowOf();if(!r){close(false);return;}node().querySelector('.rw-box').innerHTML=html(r);}
 function open(name){
  if(!(root.REP_MANAGER_ROWS||[]).some(x=>x.nm===name))root.REP_MANAGER_ROWS=root.repFlowData(true);
  cur=name;st={c:null,txt:null,open:null,all:{}};returnFocus=document.activeElement;const m=node();render();if(!cur)return;
  m.classList.add('on');m.querySelector('.rw-x')?.focus();
 }
 function close(restore){const m=document.getElementById('repWindow');if(m)m.classList.remove('on');const f=returnFocus;cur=null;st=null;returnFocus=null;if(restore!==false&&f&&f.isConnected)f.focus?.({preventScroll:true});}
 function onClick(e){
  const b=e.target.closest('[data-rw]');if(!b||!cur)return;const a=b.dataset.rw,r=rowOf();if(!r)return;
  if(a==='close'){close();return;}
  if(a==='pick'){st.c=Number(b.dataset.i);st.txt=null;render();return;}
  if(a==='toggle'){st.open[b.dataset.g]=!st.open[b.dataset.g];render();return;}
  if(a==='all'){st.all[b.dataset.g]=true;render();return;}
  const M=groups(r);
  if(a==='save'){
   const inp=node().querySelector('[data-rw-f="promise"]'),txt=(inp&&inp.value||'').trim();if(!txt){inp&&inp.focus();return;}
   const t=topics(r,M)[st.c],keep=linesOf(commentOf(r.nm,week(0))).filter(isReq);
   write(r.nm,[coachLine(t,txt)].concat(keep).join('\n'));st.txt=null;
   toast(r.nm+' · 이번 주 코칭을 저장했습니다 · 다음 주 월요일에 결과가 보입니다');root.paintRepManagement();return;
  }
  const g=M.G.find(x=>x.k===b.dataset.g);if(!g)return;
  if(a==='bulk'){
   const lines=linesOf(commentOf(r.nm,week(0)));if(lines.some(s=>s.includes('[요청] '+g.bulk)))return;
   write(r.nm,lines.concat('· [요청] '+g.bulk+' — '+g.t+' '+g.n+'건'+(g.amt&&g.amt!=='금액 미정'?' · '+g.amt:'')).join('\n'));
   /* 다음 할 일 등록 요청은 관리팀 KPI 3번의 같은 요청으로도 남긴다(그 화면에서 '요청함'으로 보이게) */
   try{const o=root.OpsStore;if(g.k==='nonext'&&o&&typeof o.has==='function'&&o.has('crm_kpi_action_log_v1'))Promise.resolve(o.rpc('crm_kpi_action_log_v1',{promise_key:'kpi:3',action:'등록 요청',target_type:'person',target_id:String(r.nm).slice(0,80),target_name:String(r.nm).slice(0,200),note:('다음 할 일 없음 '+g.n+'건').slice(0,500)})).catch(()=>{});}catch(err){}
   toast(r.nm+' 오늘 업무에 요청을 남겼습니다 · '+g.bulk);root.paintRepManagement();return;
  }
  if(a==='row'){
   e.preventDefault();const it=g.rows[Number(b.dataset.i)];if(!it)return;close(false);root.G._detailPopup=true;
   if(g.kind==='inq')root.drwInq(JSON.stringify(it.d));else root.drwDeal(JSON.stringify(it.d));
  }
 }
 function boot(){
  const base=root.paintRepManagement;if(typeof base!=='function'||base.__rw)return;
  const wrapped=function(){const r=base.apply(this,arguments);if(cur){try{if(enabled())render();else close(false);}catch(e){console.warn('[영업사원 창 v2]',e);}}return r;};
  wrapped.__rw=true;root.paintRepManagement=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.RepWindow={enabled,open,close,groups,topics,neck,flow,made,parse,coachLine,isOpen:()=>!!cur};
})(window);
