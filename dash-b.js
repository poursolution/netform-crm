/* 영업 대시보드 v2 (2026-10-04 디자인 핸드오프 'design_handoff_dashboard') — 전체 현황 · 컨트롤타워 · 성과 분석
   기존 SalesInsights.render 를 감싸 #si-dash · #si-control · #si-perf 를 시안 화면으로 바꾼다. 끄기: G.dashBOff=true → 예전 화면.
   지표는 주간 브리핑 · 월간 리포트와 같은 함수(BriefB.lib)로 계산한다 —
     계약실적 = 계약 체결일 기준 원장(체결 · 변경 · 취소 합) · 기술자문 낙찰은 따로 집계해 '별도'라고 적는다
     영업 메이드율 = 수주 ÷ (수주 + 파이프라인 실주) · 배드핏 · 진행 중 제외 / 문의 적합률 = 적합 ÷ 문의 / 문의 → 계약 = 수주 ÷ 문의 / 확정 전환율 = 2달 전 달 문의 중 지금까지 계약
   조치 필요 · 문제 표는 기존 분류(SalesInsights.rows 의 issues: overdue · contact · missing · stale · stall)를 그대로 쓴다.
   세 화면은 전 직원이 본다(화면 쪽 담당자 제한 없음 — 서버가 준 범위 그대로). [할 일 지정] · [담당자에게 알림]만 관리자 · 팀장.
   할 일 지정 = 기존 일괄 등록 창(PipelineBatch.openRows 'next') · 열기 = 기존 상세 · 근거 = 기존 근거 창. 알림은 문구 복사까지(개별 발송 경로 없음).
   담당자 꼬리표 기준(OPS_RULES 로 조정): 막힘 = 기한 지남 dashBlockedOverdue(5)건 이상 또는 진행 5건 이상인데 절반 이상 멈춤 · 접촉 끊김 = 마지막 기록 dashContactLostDays(14)일 넘음 · 메이드율 낮음 = dashLowMadePct(50)% 미만(종료 dashMinClosed(5)건 이상). */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const PAGES=['dash','control','perf'],SI=()=>R.SalesInsights,BL=()=>R.BriefB&&R.BriefB.lib,PS=()=>R.PipelineStages;
 const BR=[['석민이앤씨','#e8590c'],['POUR솔루션','#1f9d55'],['POUR공법','#7048e8'],['아파트스퀘어','#3b6ce4']],BRC=Object.fromEntries(BR);
 const HEAD={dash:['영업 대시보드','전체 영업 흐름과 지금 관리가 필요한 지점 · 전 직원 공개'],control:['컨트롤타워','확인이 필요한 영업 건을 찾아 바로 조치 · 전 직원 공개'],perf:['성과 분석','실적 · 메이드율 · 패턴을 같은 기준으로 · 전 직원 공개']};
 const LINKS={dash:[['컨트롤타워','control'],['성과 분석','perf']],control:[['전체 현황','dash'],['성과 분석','perf']],perf:[['전체 현황','dash'],['컨트롤타워','control']]};
 const RULE=()=>R.OPS_RULES||{},FIRST_H=()=>Number(RULE().towerFirstResponseHours)||2,CONTACT_D=()=>Number(RULE().contactWarnDays)||7;
 const LOSTCUT=()=>Number(RULE().dashContactLostDays)||14,LOWMADE=()=>Number(RULE().dashLowMadePct)||50,BLOCK_OD=()=>Number(RULE().dashBlockedOverdue)||5,MINCLOSED=()=>Number(RULE().dashMinClosed)||5,MINREC=10;
 function enabled(){return !R.G.dashBOff&&!!SI()&&typeof SI().state==='function'&&!!BL();}
 function st(){const g=R.G;if(!g.dashB)g.dashB={sec:'perf',selP:null,selC:null,touched:false};return g.dashB;}
 const F=()=>SI().state();
 const canAssign=()=>{try{return !!(R.inqCtlIsAdmin?R.inqCtlIsAdmin():R.todayIsAdmin());}catch(e){return false;}};
 const toast=m=>{if(typeof R.toast==='function')R.toast(m);};
 const pad=n=>String(n).padStart(2,'0');
 const mk=(y,m)=>{const d=new Date(y,m-1,1);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-01';};
 const md=k=>Number(k.slice(5,7))+'/'+Number(k.slice(8,10));
 const won=n=>Number(n)>0?R.fmtAmt(Number(n)):'0원';
 const eok=n=>{n=Number(n)||0;return n>=1e8?(Math.round(n/1e7)/10)+'억':n>0?Math.round(n/1e4).toLocaleString('ko-KR')+'만':'0';};
 const pt=v=>v==null?'아직 없음':v.toFixed(1)+'%';
 const siteShort=s=>String(s||'현장명 미입력').replace(/^\s*\[[^\]]*\]\s*/,'');
 const none='<span class="db-none">아직 없음</span>';
 function period(){
  const f=F(),now=R.G.dashBNow?new Date(R.G.dashBNow):new Date(),ty=now.getFullYear(),tm=now.getMonth()+1,td=now.getDate(),y=Number(f.year)||ty,q=Number(f.quarter)||0;
  return {y,q,a:q?mk(y,(q-1)*3+1):mk(y,1),b:q?mk(y,q*3+1):mk(y+1,1),ty,tm,td,now,today:ty+'-'+pad(tm)+'-'+pad(td),label:y+'년 '+(q?q+'분기':'연간'),thisYear:y===ty&&!q};
 }
 /* 영업 기록(고객 접점 · 메모): 단계 · 배정 같은 시스템 기록은 뺀다 */
 function acts(deals,K){
  const out=[],seen=new Set();
  deals.forEach(d=>{const p=R.itemPatch(d.item,'deal')||{};[...(d.item.activities||[]),...(p.activities||[])].forEach(x=>{const at=x.at||x.occurred_at||x.created_at;if(!at)return;const k=d.key+':'+(x.id||at+'|'+(x.note||x.result||''));if(seen.has(k))return;seen.add(k);if(/단계전환|상태변경|배정|예약|체크|데이터정리/.test(String(x.type||'')))return;out.push({at:String(at),k:K(at),owner:d.owner,site:d.site,type:String(x.type||'기록'),text:String(x.note||x.result||''),amt:Number(d.expected||d.wonAmount||0),key:d.key});});});
  return out.filter(x=>x.k).sort((a,b)=>b.at.localeCompare(a.at));
 }
 function week(P){const d=new Date(P.ty,P.tm-1,P.td),mon=new Date(d);mon.setDate(d.getDate()-((d.getDay()+6)%7));const days=[];for(let i=0;i<7;i++){const x=new Date(mon);x.setDate(mon.getDate()+i);days.push(x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate()));}return days;}
 /* 이번 주(월–일) 영업 기록 — 맨 위 '주간 활동' 카드 · 사람 탭 '이번 주 영업 기록' · 활동 탭이 같이 쓴다(같은 기록 · 같은 기간이라 숫자가 서로 다를 수 없다) */
 function weekActs(C){const W=week(C.P),rows=C.names.map(n=>{const my=C.A.filter(x=>x.owner===n),wk=my.filter(x=>W.includes(x.k));return {n,my,wk,t:wk.length};});return {W,rows,total:rows.reduce((s,r)=>s+r.t,0),zero:rows.filter(r=>!r.t).map(r=>r.n),list:rows.reduce((l,r)=>l.concat(r.wk),[])};}
 /* 기록 종류: 통화(시도 / 연결) · 문자 · 카카오 · 방문 · 견적 · 자료 — 그 밖(메모 등)은 건수에만 든다 */
 function actKind(x){
  const ty=String(x.type||''),tx=String(x.text||'');let res='';try{const l=R.InquiryFlow&&R.InquiryFlow.readLine?R.InquiryFlow.readLine(tx):null;res=l?String(l.res||''):'';}catch(e){}
  if(/방문|미팅|현설|실측/.test(ty))return 'visit';
  if(/견적|제안|자료/.test(ty))return 'quote';
  if(/문자|카카오|메일|메시지|SMS/i.test(ty))return 'msg';
  if(/전화|통화|부재/.test(ty))return /부재|통화불가|번호오류/.test(ty+' '+res)||/^(부재|전화 시도|안 ?받)/.test(tx)?'try':'call';
  return 'etc';
 }
 function overdueDays(d){try{const nx=R.briefNext(d.item),t=nx&&nx.due?R.daysTo(nx.due):null;return t!==null&&t<0?-t:0;}catch(e){return 0;}}
 function ageOf(d){try{const a=R.stageAge(d.item);return a==null?0:a;}catch(e){return 0;}}
 function core(){
  const B=BL(),K=B.K,P=period(),target=R.targetNameFilter(),AD=R.briefScopeDeals(target,false),AQ=R.briefScopeInquiries(target,false),L=B.ledger(target);
  const inR=(k,a,b)=>!!k&&k>=a&&k<b,rows=SI().rows(false,true),deals=rows.deals,active=deals.filter(d=>d.active),risk=active.filter(d=>d.issues.length),cnt=k=>active.filter(d=>d.issues.includes(k)).length;
  const q=AQ.filter(x=>inR(K(R.inquiryCreatedAt(x)),P.a,P.b)),bad=q.filter(B.badfit),fit=q.length-bad.length;
  const loss=AD.filter(d=>B.isLoss(d)&&inR(B.closedKey(d),P.a,P.b)),con=B.contractsIn(L,P.a,P.b,null,'direct');
  /* 타사 이관 수주(관리자 인정분 · 낙찰일 기준): 수주실적에 합산하고 화면에서는 자사와 나눠 적는다 */
  const DT=R.DealTransfer&&R.DealTransfer.enabled()?R.DealTransfer:null,tf=DT?DT.wonIn(P.a,P.b,target):{count:0,amount:0,list:[]},tfLost=DT?DT.lostIn(P.a,P.b,target):0;
  /* 협약시공사 수주 · 기술자문(낙찰일 기준 · 낙찰금액): 이 화면에서 확정한 건 + 확정된 기술자문 낙찰실적. 수주실적 = 직접 + 협약 · 기술자문 + 타사 이관 */
  const DW=R.DealWin&&R.DealWin.enabled()?R.DealWin:null,pt=DW?DW.partnerIn(P.a,P.b,target):{count:0,amount:0,revenue:0,unknown:0,list:[]},made=L.ready?B.made(con.count,loss.length+tfLost,tf.count,pt.count):null;
  const names=(target?[target]:(R.PERFORMANCE_TARGET_NAMES||[])).slice(),A=acts(deals,K);
  return {B,K,P,target,AD,AQ,L,inR,rows,deals,active,risk,cnt,q,bad,fit,loss,con,made,names,A,DT,tf,tfLost,DW,pt,won:con.count+pt.count+tf.count,perf:con.net+pt.amount+tf.amount};
 }
 /* 기술자문 낙찰(확정분 · 낙찰확정일 기준 · VAT 별도) — 계약 원장과 겹치는 건은 기존 규칙대로 뺀다. 관리자 화면에서만 읽힌다 */
 function advisory(C){
  if(C.DW){const l=C.pt.list;return {rows:l.map(x=>({attribution:{origin_business:x.brand,performance_owner:x.owner,bid_amount:x.amount}})),n:l.length,sum:C.pt.amount,merged:true};}
  const S=SI();if(!S.advisory||!S.advMatch)return null;const list=S.advisory();if(!Array.isArray(list))return null;const P=C.P;
  const rows=S.advisoryPerformance?.(list,{brand:R.G.brand||'전체',owner:C.target||'전체'},k=>!!k&&k>=P.a&&k<P.b);if(!rows)return null;
  return {rows,n:rows.length,sum:rows.reduce((s,x)=>s+(Number(x.attribution.bid_amount)||0),0)};
 }
 /* 계약 임박: 경쟁 · 임박 · 입찰 + 계약 체결 전 — 기한 가까운 순 */
 function nearList(C){
  const {B,K,P,AD}=C,fld=(d,c,k)=>{const p=R.itemPatch(d,'deal')||{},x=(d.stage_contexts||p.stage_contexts||{})[c];return x&&x.fields?x.fields[k]:'';};
  return AD.filter(R.isOpen).filter(d=>{const c=R.dealStage(d);return ['compete','imminent','bidding'].includes(c)||(c==='contract'&&fld(d,'contract','contract_status')!=='체결 완료');}).map(d=>{
   const c=R.dealStage(d),raw=c==='bidding'?['입찰 마감',fld(d,'bidding','bid_deadline')]:c==='compete'?['PT · 협의',fld(d,'compete','meeting_date')]:c==='imminent'?['계약 예정',fld(d,'imminent','expected_contract')]:['계약 예정',fld(d,'contract','contract_date')],k=K(raw[1]);
   let work='';try{work=R.dealWorkSummary(d);}catch(e){}
   const amount=Number(fld(d,'contract','contract_amount')||0)||Number(d.amount||d.amt||0)||Number(R.oppAmt(d)||0),dd=k?B.between(P.today,k):null;
   return {d,amount,k,dd,hot:dd!==null&&dd>=0&&dd<=7,late:dd!==null&&dd<0,due:k?raw[0]+' '+md(k):R.stageLabel(c)+' · 기한 미등록',sub:[work&&!/미분류|미기록/.test(work)?work:'',d.brand||'',R.repN(d.assignee)||'미배정'].filter(Boolean).join(' · ')};
  }).sort((a,b)=>(a.k||'9999').localeCompare(b.k||'9999')||b.amount-a.amount);
 }
 /* 담당자별: 계약 · 메이드율 · 진행 · 손볼 건 · 마지막 기록 + 꼬리표(막힘 / 접촉 끊김 / 메이드율 낮음 / 정상)와 그 이유 */
 function people(C){
  const {B,P,L,active,loss,A,names}=C,W=week(P),ms=mk(P.ty,P.tm),me=mk(P.ty,P.tm+1);/* 계약 = 자사 계약실적 + 인정된 타사 이관 수주 */
  return names.map(n=>{
   const mine=active.filter(d=>d.owner===n),c=B.contractsIn(L,P.a,P.b,n,'direct'),cm=B.contractsIn(L,ms,me,n,'direct'),l=loss.filter(d=>R.repN(d.assignee)===n),tfp=C.DT?C.DT.wonIn(P.a,P.b,n):{count:0,amount:0},tfm=C.DT?C.DT.wonIn(ms,me,n):{count:0,amount:0},ptp=C.DW?C.DW.partnerIn(P.a,P.b,n):{count:0,amount:0},ptm=C.DW?C.DW.partnerIn(ms,me,n):{count:0,amount:0},w=c.count+ptp.count+tfp.count;
   const made=L.ready&&(w+l.length)?B.made(c.count,l.length,tfp.count,ptp.count):null;
   const fix=mine.filter(d=>d.issues.length),od=mine.filter(d=>d.issues.includes('overdue')),stall=mine.filter(d=>d.issues.includes('stall')),odMax=Math.max(0,...od.map(overdueDays));
   const my=A.filter(x=>x.owner===n),last=my[0]||null,lastK=last?last.k:'',lastDays=lastK?Math.max(0,B.between(lastK,P.today)):null,wk=my.filter(x=>x.k>=W[0]&&x.k<=W[6]).length;
   const top=list=>{const t=B.tally(list,d=>d.stageLabel)[0];return t?{l:t[0],n:t[1]}:null;};
   let tag='정상',sev=0,why='';
   if(od.length>=BLOCK_OD()){const t=top(od);tag='막힘';sev=3;why='기한 지난 건 '+od.length+'건 · 최장 '+odMax+'일'+(t?' — '+t.l+' 단계에 '+t.n+'건 몰림':'');}
   else if(mine.length>=5&&stall.length/mine.length>=0.5){const t=top(stall);tag='막힘';sev=3;why=(t?t.l+' 단계에 '+t.n+'건('+Math.round(t.n/mine.length*100)+'%) 정체':'진행 멈춤 '+stall.length+'건')+' — 연락과 다음 할 일이 끊김';}
   else if(mine.length&&(lastDays===null||lastDays>LOSTCUT())){tag='접촉 끊김';sev=2;why=(lastK?md(lastK)+' 이후 기록 없음':'영업 기록 없음')+' · 이번 주 활동 '+wk+'건 — 접촉이 끊김';}
   else if(made!==null&&made<LOWMADE()&&w+l.length>=MINCLOSED()){const tr=B.tally(l,B.lossReason)[0];tag='메이드율 낮음';sev=1;why='실주 '+l.length+'건 · 수주 '+w+'건'+(tr?' — 가장 많은 실주 사유: '+tr[0]+' '+tr[1]+'건':'');}
   return {n,prog:mine.length,exp:mine.reduce((s,d)=>s+(Number(d.expected)||0),0),yr:c.net+ptp.amount+tfp.amount,pt:ptp.amount,tf:tfp.amount,w,l:l.length,made,mo:cm.net+ptm.amount+tfm.amount,fix:fix.length,od:od.length,odMax,last,lastK,lastDays,wk,tag,sev,why,my};
  });
 }
 const agoText=p=>p.lastDays===null?'기록 없음':p.lastDays===0?'오늘':p.lastDays===1?'어제':p.lastDays+'일 전';
 const agoColor=p=>p.lastDays===null||p.lastDays>LOSTCUT()?'#b42318':p.lastDays>7?'#b45309':'#15171c';
 const TAGC={'막힘':'#d14a3f','접촉 끊김':'#e0a43a','메이드율 낮음':'#e0a43a'};

 /* ── 공통: 바로가기 · 기준 문구 · 연도 · 연간/분기 · LIVE ── */
 function toolbar(page,C){
  const P=C.P,years=new Set([String(P.ty),String(P.ty-1),String(P.y)]);(C.L.rows||[]).forEach(r=>(r.events||[]).forEach(e=>{const y=String(e.effective_date||'').slice(0,4);if(/^20\d\d$/.test(y))years.add(y);}));
  const live=pad(P.now.getMonth()+1)+'.'+pad(P.now.getDate())+' '+pad(P.now.getHours())+':'+pad(P.now.getMinutes());
  return '<div class="db-tool">'+LINKS[page].map(l=>'<button type="button" class="db-link" data-db="go" data-v="'+l[1]+'">'+l[0]+' ↗</button>').join('')+'<span class="db-basis">'+h(P.label+' 접수 · 계약실적 / 파이프라인 · 조치 필요는 현재 기준')+'</span><i class="db-sp"></i><select class="db-year" data-db="year" aria-label="연도">'+[...years].sort().reverse().map(y=>'<option value="'+y+'"'+(String(P.y)===y?' selected':'')+'>'+y+'년</option>').join('')+'</select><div class="db-seg" role="group" aria-label="기간">'+[[0,'연간'],[1,'1분기'],[2,'2분기'],[3,'3분기'],[4,'4분기']].map(([v,t])=>'<button type="button" data-db="quarter" data-v="'+v+'" aria-pressed="'+(P.q===v)+'">'+t+'</button>').join('')+'</div><span class="db-live"><i></i>LIVE '+live+'</span></div>';
 }

 /* ── 1. 전체 현황 ── */
 function dash(C){
  const S=st(),N=nearList(C),PP=people(C),{B,P,L,active,risk,cnt,q,bad,fit,con,made,A,names}=C;
  const ms=mk(P.ty,P.tm),cm=B.contractsIn(L,ms,mk(P.ty,P.tm+1),null,'direct'),pmD=new Date(P.ty,P.tm-2,1),pm=B.contractsIn(L,mk(P.ty,P.tm-1),ms),exp=active.reduce((s,d)=>s+(Number(d.expected)||0),0);
  const WA=weekActs(C),wkA=WA.list,zero=WA.zero.length,adv=advisory(C);
  const val=(ready,n,text)=>!ready?['불러오는 중','mut']:n>0?[text,'']:['아직 없음','mut'];
  const tfm=C.DT?C.DT.wonIn(ms,mk(P.ty,P.tm+1),C.target):{count:0,amount:0},ptm=C.DW?C.DW.partnerIn(ms,mk(P.ty,P.tm+1),C.target):{count:0,amount:0},k1=val(L.ready,cm.net+ptm.amount+tfm.amount,won(cm.net+ptm.amount+tfm.amount)),k2=val(L.ready,C.perf,won(C.perf)),k3=val(true,exp,won(exp));
  const cards=[
   ['이번 달 계약 ('+P.tm+'월)',k1[0],k1[1],P.tm+'월 '+P.td+'일째'+(cm.count+ptm.count>0?' · 계약 '+(cm.count+ptm.count)+'건':'')+' · '+(pmD.getMonth()+1)+'월 '+(pm.net>0?won(pm.net):'없음'),P.y===P.ty?'cs-month':'',P.tm],
   [P.thisYear?'올해 수주실적':P.label+' 수주실적',k2[0],k2[1],'직접 수주 '+(con.net>0?won(con.net):'없음')+'('+con.count+'건) · 협약 · 기술자문 '+(C.pt.amount>0?won(C.pt.amount)+'('+C.pt.count+'건)':'없음')+' · 타사 이관 '+(C.tf.amount>0?won(C.tf.amount)+'('+C.tf.count+'건)':'없음')+(adv&&adv.n&&!adv.merged?' · 기술자문 낙찰 '+won(adv.sum)+' 별도':''),'ev','contract'],
   ['진행 중 파이프라인',k3[0],k3[1],'진행 '+active.length+'건','ev','active'],
   ['견적문의',q.length+'건','','적합 '+fit+' · '+B.closedText(bad,'n'),'ev','inquiries'],
   ['조치 필요',risk.length+'건',risk.length?'red':'','기한 지남 '+cnt('overdue')+' · 다음 할 일 없음 '+cnt('missing'),'go','control'],
   ['주간 활동',wkA.length+'건',zero?'red':'','이번 주 · '+names.length+'명 중 '+zero+'명 0건','ev','activity']];
  const kpis='<div class="db-kpis">'+cards.map(c=>'<button type="button" class="db-kpi"'+(c[4]?' data-db="'+c[4]+'" data-v="'+attr(c[5])+'"':' disabled')+'><span>'+h(c[0])+'</span><div><b class="'+c[2]+'">'+h(c[1])+'</b><small>'+h(c[3])+'</small></div></button>').join('')+'</div>';
  /* '오늘 먼저 볼 것' 검은 띠는 뺐다(2026-10-04 대표) — 같은 숫자가 위 카드에 있고, 계약 임박은 파이프라인 탭에서 본다 */
  const secs=[['perf','성과','문의 → 계약 · 추이 · 브랜드'],['people','사람','담당자별 · 이번 주 기록'],['pipe','파이프라인','단계 · 계약 임박'],['act','활동','최근 기록']];
  const tabs='<div class="db-secs" role="tablist">'+secs.map(t=>'<button type="button" role="tab" aria-selected="'+(S.sec===t[0])+'" data-db="sec" data-v="'+t[0]+'">'+t[1]+'<span>'+t[2]+'</span></button>').join('')+'</div>';
  return kpis+tabs+(S.sec==='people'?secPeople(C,PP):S.sec==='pipe'?secPipe(C,N):S.sec==='act'?secAct(C):secPerf(C));
 }
 function brandRows(C){
  const {B,P,L,q,loss}=C;
  const brands=BR.concat([...new Set((L.rows||[]).filter(r=>(r.events||[]).some(e=>e.effective_date>=P.a&&e.effective_date<P.b)).map(r=>String(r.brand||'').trim()||'브랜드 미기록'))].filter(name=>!BRC[name]).map(name=>[name,'#9ca3af']));
  return brands.map(([name,c])=>{let net=0,w=0;(L.rows||[]).forEach(r=>{if((String(r.brand||'').trim()||'브랜드 미기록')!==name)return;(r.events||[]).forEach(e=>{const k=e.effective_date;if(!(k>=P.a&&k<P.b))return;net+=e.amount_delta;if(e.kind==='signed')w++;});});
   const bq=q.filter(x=>String(x.brand||(R.inquiryBrandOf?R.inquiryBrandOf(x):'')||'')===name),fit=bq.length-bq.filter(B.badfit).length,lo=loss.filter(d=>d.brand===name).length;
   return {name,c,net,w,q:bq.length,fit,lo,made:w+lo?B.made(w,lo):null};});
 }
 /* ── 5차 블록 1(2026-10-05 영업분석블록.dc.html): 영업 Funnel + 단계별 전주 대비 — 성과 탭의 '견적문의가 계약까지' 자리. 끄기: G.dashFunnelOff=true → 예전 흐름 5칸 ── */
 let SMAP=null;
 const sCode=v=>{v=String(v||'').trim();if(!v)return '';if(!SMAP){SMAP={};const S=R.STAGE_MASTER||{};Object.keys(S).forEach(k=>{SMAP[k]=k;[S[k].name,S[k].was].forEach(n=>{if(n&&!SMAP[n])SMAP[n]=k;});});}return SMAP[v]||v;};
 const gOf=c=>{try{return PS().group(c)||(/^(won|lost|badfit|nocontact)/.test(c)?(c==='won'?'won':'lost'):'');}catch(e){return '';}};
 /* 영업건의 단계 이동 기록(날짜순): {k 날짜, from 묶음, to 묶음} */
 function stageEvents(d,K){try{return (R.briefAllStageEvents(d)||[]).map(x=>({k:K(x.at||x.changed_at||x.created_at),from:gOf(sCode(x.from||x.before||x.old_stage)),to:gOf(sCode(x.to||x.after||x.new_stage))})).filter(x=>x.k).sort((a,b)=>a.k.localeCompare(b.k));}catch(e){return [];}}
 function madeFx(C){const {L,con,loss}=C;if(!L.ready)return '계약 원장을 불러오는 중';return (C.pt.count||C.tf.count||C.tfLost?'(직접 '+con.count+' + 협약 · 기술자문 '+C.pt.count+' + 타사 이관 '+C.tf.count+') ÷ (직접 '+con.count+' + 협약 · 기술자문 '+C.pt.count+' + 타사 이관 '+C.tf.count+' + 실주 '+(loss.length+C.tfLost)+')':'수주 '+con.count+' ÷ (수주 '+con.count+' + 실주 '+loss.length+')')+' · 배드핏 제외';}
 function funnelV2(C){
  const {B,K,P,AD,L,q,bad,fit,loss,made,active}=C,FOLLOW=Number(RULE().inquiryFollowDays)||7;
  const quotedD=AD.filter(d=>B.quoteIn(d,P.a,P.b)),quotes=quotedD.length,comp=AD.filter(d=>B.entered(d,'competition',P.a,P.b)).length;
  const lossN=loss.length+(C.tfLost||0),done=C.won+lossN,compOpen=active.filter(d=>PS().group(d.stage)==='competition').length;
  const fitOpen=q.filter(x=>{if(B.badfit(x))return false;try{return !R.inqCtlConverted(x);}catch(e){return true;}}),noFirst=fitOpen.filter(x=>{try{return !R.inqCtlFirstResponseAt(x);}catch(e){return false;}}).length;
  const sentKey=d=>{const cx=d.stage_contexts||(R.itemPatch(d,'deal')||{}).stage_contexts||{};return K(cx.sent&&cx.sent.fields&&cx.sent.fields.sent_date||'');};
  const noFollow=quotedD.filter(d=>{if(!R.isOpen(d)||PS().group(R.dealStage(d))==='competition')return false;const sd=sentKey(d);if(!sd||B.between(sd,P.today)<=FOLLOW)return false;const l=B.lastActKey(d,B.addDays(P.today,1));return !l||l<=sd;}).length;
  const cat=d=>{let c='';try{c=R.CRMRules.lostCategory(R.CRMRules.lostReason?R.CRMRules.lostReason(B.lossReason(d)):B.lossReason(d));}catch(e){}return c||'사유 미기록';};
  const lossCats=B.tally(loss,cat).slice(0,3).map(x=>x[0]+' '+x[1]).join(' · ');
  const pc=(a,b)=>pt(B.pct(a,b)),d3=Math.max(0,fit-quotes),d4=Math.max(0,quotes-comp);
  const cols=[
   {l:'견적문의',n:q.length,rate:'',drop:null,why:''},
   {l:'적합 문의',n:fit,rate:'적합률 '+pc(fit,q.length),drop:bad.length,why:B.closedText(bad,'n')},
   {l:'견적 발송',n:quotes,rate:fit&&quotes<=fit?'견적 진행 '+pc(quotes,fit):'기간 안 견적 발송',drop:d3,why:d3?'아직 견적 전 · 첫 연락 전 '+noFirst+' · 응대 중 '+Math.max(0,fitOpen.length-noFirst):''},
   {l:'경쟁 · 입찰',n:comp,rate:quotes&&comp<=quotes?'입찰 전환 '+pc(comp,quotes):'기간 안 경쟁 · 입찰 진입',drop:d4,why:d4?(noFollow?'견적 후 '+FOLLOW+'일 후속 없음 '+noFollow+' · ':'')+'아직 진행 중':''},
   {l:'결과 확정',n:L.ready?done:null,rate:'진행 중 '+compOpen,drop:compOpen,why:compOpen?'아직 결과 전':''},
   {l:'수주',n:L.ready?C.won:null,rate:'메이드율 '+pt(made)+' (실주 '+lossN+')',drop:lossN,why:lossN?'실주 '+lossN+(lossCats?' · '+lossCats:''):''}];
  const max=Math.max(1,...cols.map(c=>c.n||0)),big=d3||d4?(d4>=d3?3:2):-1;
  const bar=(c,i)=>'<div class="db-f6c"><div class="bar"><i style="height:'+(c.n?Math.max(3,Math.round(c.n/max*118)):0)+'px;background:'+(i===0?'#9aa0ab':i===big?'#d14a3f':i===5?'#1f9d55':'#3b6ce4')+'"></i></div><span>'+c.l+'</span><b>'+(c.n===null?'<small>불러오는 중</small>':c.n+'<small>건</small>')+'</b><em class="'+(i===big?'red':'')+'">'+h(c.rate)+'</em>'+(c.drop?'<div class="dr"><b>빠짐 '+c.drop+'건</b><span>'+h(c.why)+'</span></div>':'')+'</div>';
  const badTop=B.tally(bad,B.badfitReason).slice(0,2).map(x=>x[0]).join(' · ');
  const notes=[['문의 품질',bad.length?B.closedText(bad)+'이 문의 → 적합에서 빠짐. 영업 실패가 아니라 유입 품질 문제'+(badTop?' ('+badTop+')':''):'문의 → 적합에서 빠진 건이 없습니다',''],
   ['가장 큰 이탈',big<0?'칸 사이에 빠진 건이 없습니다':cols[big-1].l+' → '+cols[big].l+' '+cols[big].drop+'건'+(big===3&&noFollow?'. 견적 후 '+FOLLOW+'일 후속이 없던 건이 '+noFollow+'건':''),big<0?'':'red'],
   ['영업력',!L.ready?'계약 원장을 불러오는 중입니다':done?'결과 확정 '+done+'건 중 '+C.won+'건 수주 ('+pt(made)+')':'결과가 난 영업이 아직 없습니다','']];
  return '<section class="db-card db-f6"><div class="db-ch"><b>'+h(P.label)+' 영업 Funnel</b><span>'+h(P.label)+' 접수 문의 · 기간 안 영업 이동 · 칸 사이 = 빠진 건과 이유</span><i class="db-sp"></i><span class="mr">영업 메이드율 <b>'+pt(made)+'</b> · Bad Fit 제외</span></div><div class="db-f6g">'+cols.map(bar).join('')+'</div>'
   +'<div class="db-f6n">'+notes.map(n=>'<div class="'+n[2]+'"><b>'+n[0]+'</b> · '+h(n[1])+(n[0]==='영업력'&&L.ready?'<small class="db-f6x">'+h(madeFx(C))+'</small>':'')+'</div>').join('')+'</div></section>';
 }
 /* 단계별 전주 대비: 최근 7일과 그 전 7일을 단계 이동 기록에서 센다(따로 저장한 값 없이 기록에서 다시 계산). 정체 = 그 시점에 열려 있고 14일 넘게 기록이 없는 건 */
 function weekTable(C){
  const {B,K,P,AD,AQ}=C,STG=[['consulting','컨설팅 설계'],['sent','자료 발송완료'],['relationship','관계관리'],['competition','경쟁 · 입찰'],['construction','계약 · 시공']],ORD=STG.map(s=>s[0]),STALE_D=14;
  const end=B.addDays(P.today,1),a1=B.addDays(P.today,-6),a0=B.addDays(P.today,-13),inW=(k,a,b)=>!!k&&k>=a&&k<b;
  const E=AD.map(d=>({d,ev:stageEvents(d,K),ck:K(d.created),closed:R.isOpen(d)?'':(B.closedKey(d)||'')}));
  const groupAt=(x,T)=>{if(x.ck&&x.ck>=T)return '';let g=x.ev.length?x.ev[0].from:gOf(R.dealStage(x.d));x.ev.forEach(e=>{if(e.k<T)g=e.to;});if(!x.ev.length&&x.closed&&x.closed<T)return 'closed';return g;};
  const staleAt=(x,T)=>{if(x.closed&&x.closed<T)return false;const l=B.lastActKey(x.d,T);return !!l&&B.between(l,B.addDays(T,-1))>STALE_D;};
  const count=(a,b,T)=>{const r={};ORD.forEach(g=>r[g]=[0,0,0,0,0]);const tot=[0,0,0,0,0];
   E.forEach(x=>{
    ORD.forEach(g=>{if(B.entered(x.d,g,a,b)){r[g][0]++;tot[0]++;}});
    x.ev.forEach(e=>{if(!inW(e.k,a,b)||!ORD.includes(e.from))return;if(ORD.includes(e.to)&&ORD.indexOf(e.to)>ORD.indexOf(e.from)){r[e.from][1]++;tot[1]++;}});
    const g=groupAt(x,T);if(ORD.includes(g)&&staleAt(x,T)){r[g][2]++;tot[2]++;}
    if(x.closed&&inW(x.closed,a,b)){const col=R.isWon(x.d)?3:B.isLoss(x.d)?4:-1;if(col<0)return;const last=x.ev.slice().reverse().find(e=>ORD.includes(e.from)&&!ORD.includes(e.to)),from=last?last.from:(col===3?'construction':'');if(from)r[from][col]++;tot[col]++;}});
   return {r,tot};};
  const now=count(a1,end,end),prev=count(a0,a1,a1);
  const inqNew=(a,b)=>AQ.filter(x=>inW(K(R.inquiryCreatedAt(x)),a,b)).length,inqConv=(a,b)=>AD.filter(d=>inW(K(d.created),a,b)&&!!(d.origin_inquiry_id||d.originInquiryId)).length;
  const openQ=AQ.filter(x=>{try{if(R.inqCtlConverted(x))return false;if(typeof R.isClosedInq==='function'&&R.isClosedInq(x))return false;}catch(e){}return true;}),inqStale=openQ.filter(x=>{const k=K(x.lastActivity||R.inquiryCreatedAt(x));return !!k&&B.between(k,P.today)>STALE_D;}).length;
  const diff=(v,p,k)=>{if(p===null)return '';const d=v-p;if(!d)return '';const good=k===2||k===4?d<0:d>0;return '<em class="'+(good?'up':'dn')+'">'+(d>0?'▲':'▼')+Math.abs(d)+'</em>';};
  const row=(l,v,p,tot)=>'<span class="wl'+(tot?' tot':'')+'">'+l+'</span>'+v.map((n,k)=>'<span class="wv'+(tot?' tot':'')+'">'+n+' '+diff(n,p?p[k]:null,k)+'</span>').join('');
  const iq=[inqNew(a1,end),inqConv(a1,end),inqStale,0,0],iqp=[inqNew(a0,a1),inqConv(a0,a1),null,0,0];
  const totN=now.tot.map((v,k)=>v+(k<3?iq[k]:0)),totP=prev.tot.map((v,k)=>k===2?null:v+(k<2?iqp[k]:0));
  const up=STG.map(s=>({l:s[1],d:now.r[s[0]][2]-prev.r[s[0]][2]})).sort((x,y)=>y.d-x.d)[0],wonRow=STG.map(s=>({l:s[1],n:now.r[s[0]][3]})).sort((x,y)=>y.n-x.n)[0];
  const moved=totN[0]+totN[1]+totN[3]+totN[4];
  const note=!moved&&!(up&&up.d)?'최근 7일 동안 단계 이동 · 결과 기록이 없습니다'+(totN[2]?' · 14일 넘게 멈춘 건 '+totN[2]+'건':''):[up&&up.d>0?up.l+' 정체가 그 전 7일보다 '+up.d+'건 늘었습니다':'',wonRow&&wonRow.n?wonRow.l+'에서 '+wonRow.n+'건이 수주로 넘어갔습니다':'',iq[0]?'새 견적문의 '+iq[0]+'건':''].filter(Boolean).join(' · ')||'최근 7일 단계 이동 '+totN[1]+'건 · 새로 들어온 건 '+totN[0]+'건';
  return '<section class="db-card flush db-wks"><div class="db-ch pad"><b>단계별 전주 대비</b><span>최근 7일('+md(a1)+' – '+md(P.today)+') · 숫자 옆 = 그 전 7일과 차이 · 단계 이동 기록에서 계산</span></div><div class="db-wk" role="table" aria-label="단계별 최근 7일 이동">'
   +['단계','새로 들어옴','다음 단계로','정체 (14일+)','수주','실주'].map((l,i)=>'<span class="wh'+(i?' r':'')+'">'+l+'</span>').join('')
   +row('견적문의',iq,iqp)+STG.map(s=>row(s[1],now.r[s[0]],prev.r[s[0]])).join('')+row('합계',totN,totP,true)+'</div><p class="db-whonote">'+h(note)+'</p></section>';
 }
 function secPerf(C){
  const {B,K,P,AD,AQ,L,inR,q,bad,fit,loss,con,made}=C;
  const quotes=AD.filter(d=>B.quoteIn(d,P.a,P.b)).length,conv=AD.filter(d=>inR(K(d.created),P.a,P.b)).length;
  const fun=[['견적문의',q.length+'건','전체 접수'],['적합 문의',fit+'건',B.closedText(bad,'ex')],['견적 발송',quotes+'건',fit&&quotes<=fit?'적합의 '+pt(B.pct(quotes,fit)):'기간 안 견적 발송'],['영업건 전환',conv+'건','파이프라인 진입'],['수주',L.ready?C.won+'건'+(C.perf>0?' · '+won(C.perf):''):'불러오는 중','실주 '+(loss.length+C.tfLost)+'건'+(C.pt.count?' · 협약 · 기술자문 '+C.pt.count+'건 포함':'')+(C.tf.count?' · 타사 이관 '+C.tf.count+'건 포함':'')]];
  const cd=new Date(P.ty,P.tm-3,1),cym=cd.getFullYear()+'-'+pad(cd.getMonth()+1),coM=cd.getMonth()+1,cohort=AQ.filter(x=>K(R.inquiryCreatedAt(x)).slice(0,7)===cym),cw=L.ready?cohort.filter(x=>B.inquiryContract(x,L,AD)).length:0;
  const rates=[['영업 메이드율',pt(made),madeFx(C),'#15171c'],['문의 적합률',pt(B.pct(fit,q.length)),'적합 '+fit+' ÷ 문의 '+q.length,'#c9cdd5'],['문의 → 계약 전환율',L.ready?pt(B.pct(C.won,q.length)):'불러오는 중','수주 '+C.won+' ÷ 문의 '+q.length,'#c9cdd5'],['확정 전환율 ('+coM+'월 문의)',L.ready&&cohort.length?pt(B.pct(cw,cohort.length)):'아직 없음',coM+'월 문의 '+cohort.length+'건 중 지금까지 '+cw+'건 계약','#c9cdd5']];
  const top=(list,fn)=>{const t=B.tally(list,fn),a=t.slice(0,3),rest=t.slice(3).reduce((s,x)=>s+x[1],0);return a.map(x=>x[0]+' '+x[1]).concat(rest?['그 외 '+rest]:[]).join(' · ')||'해당 없음';};
  const funnelOld=()=>'<section class="db-card"><div class="db-ch"><b>견적문의가 계약까지</b><em>새 지표</em><span>'+h(P.label+' · 문의 접수 기준')+'</span></div>'
   +'<div class="db-fun">'+fun.map((u,i)=>'<div class="'+(i===fun.length-1?'last':'')+'"><span>'+u[0]+'</span><b>'+h(u[1])+'</b><small>'+h(u[2])+'</small></div>').join('')+'</div>'
   +'<div class="db-rates">'+rates.map(t=>'<div style="border-left-color:'+t[3]+'"><span>'+h(t[0])+'</span><b'+(/없음|불러/.test(t[1])?' class="mut"':'')+'>'+h(t[1])+'</b><small>'+h(t[2])+'</small></div>').join('')+'</div>'
   +'<div class="db-two"><div class="g"><b>견적문의 '+h(B.closedText(bad))+' <span>· 영업 실패 아님 · 메이드율 제외</span></b><p>'+h(top(bad,B.badfitReason))+'</p></div><div class="r"><b>파이프라인 실주 '+loss.length+'건 <span>· 영업기회 상실 · 메이드율 포함</span></b><p>'+h(top(loss,B.lossReason))+'</p></div></div></section>';
  const funnel=R.G.dashFunnelOff?funnelOld():funnelV2(C)+weekTable(C);
  /* 월별 계약실적 · 견적문의 */
  const y=P.y,M=[];for(let m=1;m<=12;m++){const a=mk(y,m),b=mk(y,m+1),c=B.contractsIn(L,a,b),qn=AQ.filter(x=>inR(K(R.inquiryCreatedAt(x)),a,b)).length;M.push({m,net:c.net,qn,cur:y===P.ty&&m===P.tm,fut:y>P.ty||(y===P.ty&&m>P.tm)});}
  const past=M.filter(x=>!x.fut&&!x.cur),max=Math.max(1,...M.filter(x=>!x.fut).map(x=>x.net)),qmax=Math.max(1,...M.map(x=>x.qn)),avg=past.length?past.reduce((s,x)=>s+x.net,0)/past.length:0;
  const hi=past.slice().sort((a,b)=>b.net-a.net)[0],lo=past.slice().sort((a,b)=>a.net-b.net)[0],cur=M.find(x=>x.cur);
  const col=x=>{const label=x.fut?'':x.cur?(x.net>0?eok(x.net):'진행 중'):(x.net>0?eok(x.net):'없음'),px=x.fut?0:x.cur?Math.max(10,Math.round(x.net/max*72)):x.net>0?Math.max(2,Math.round(x.net/max*72)):0;return '<button type="button" class="db-col'+(x.cur?' cur':'')+(x.fut?' fut':'')+(!x.fut&&!x.cur&&!(x.net>0)?' zero':'')+'" data-db="cs-month" data-v="'+x.m+'"'+(x.fut?' disabled':'')+' aria-label="'+x.m+'월 계약실적 '+(label||'없음')+'"><span>'+label+'</span><i style="height:'+px+'px"></i></button>';};
  const qcol=x=>'<button type="button" class="db-qcol'+(x.cur?' cur':'')+'" data-db="inq-month" data-v="'+x.m+'"'+(x.fut?' disabled':'')+' aria-label="'+x.m+'월 견적문의 '+x.qn+'건"><i style="height:'+(x.fut?0:Math.max(2,Math.round(x.qn/qmax*18)))+'px"></i><span>'+(x.fut?'':x.qn+'건')+'</span></button>';
  const foot=!L.ready?'계약 원장을 불러오는 중입니다.':(hi&&hi.net>0?'최고 '+hi.m+'월 '+eok(hi.net)+' · 최저 '+lo.m+'월 '+(lo.net>0?eok(lo.net):'없음'):'지난 달 계약실적이 아직 없습니다')+(cur?' · <b>'+cur.m+'월은 '+P.td+'일째라 진행 중</b> (점선 막대)':'');
  const chart='<section class="db-card db-month"><div class="db-ch"><b>월별 계약실적 · 견적문의</b><span>계약 체결일 · 문의 접수일 기준 · 월 클릭 = 근거</span><i class="db-sp"></i><span class="db-leg"><span><i style="background:#3b6ce4"></i>계약실적</span><span><i style="background:#8fd1ac"></i>견적문의</span><span><i class="db-dl"></i>월평균 '+(avg>0?eok(avg):'없음')+'</span></span></div>'
   +'<div class="db-bars"><span class="avg" style="bottom:'+Math.round(avg/max*72)+'px"'+(avg>0?'':' hidden')+'></span>'+M.map(col).join('')+'</div><div class="db-qbars">'+M.map(qcol).join('')+'</div><div class="db-mlab">'+M.map(x=>'<span class="'+(x.cur?'cur':x.fut?'fut':'')+'">'+x.m+'월</span>').join('')+'</div><p>'+foot+'</p></section>';
  const BRW=brandRows(C),tot=BRW.reduce((s,b)=>s+Math.max(0,b.net),0);
  const brand='<section class="db-card db-brand"><div class="db-ch"><b>브랜드별 계약실적</b><i class="db-sp"></i><span>'+h((P.thisYear?'올해 누적 ':P.label+' ')+(L.ready?(tot>0?won(tot):'아직 없음'):'불러오는 중'))+'</span></div><div class="db-share">'+BRW.map(b=>'<span style="width:'+(tot>0?Math.max(0,b.net)/tot*100:0).toFixed(1)+'%;background:'+b.c+'"></span>').join('')+'</div>'
   +BRW.map(b=>'<button type="button" class="db-brow" data-db="brand-ev" data-v="'+attr(b.name)+'"><div><i style="background:'+b.c+'"></i><b>'+h(b.name)+'</b><span class="db-sp"></span><b class="'+(b.net>0?'':'mut')+'">'+(b.net>0?h(won(b.net)):'수주 없음')+'</b><em>'+(b.net>0&&tot>0?Math.round(b.net/tot*100)+'%':'')+'</em></div><small>문의 '+b.q+' · 수주 '+b.w+' · 메이드율 <b class="'+(b.made!==null&&b.made<LOWMADE()?'red':'')+'">'+(b.made===null?'—':b.made.toFixed(1)+'%')+'</b>'+(!b.w&&b.fit>0?' · 적합 문의는 있는데 계약 전환 0':'')+'</small></button>').join('')+'</section>';
  return funnel+'<div class="db-row">'+chart+brand+'</div>';
 }
 function secPeople(C,PP){
  const {P,cnt,names,A}=C,rows=PP.filter(p=>p.prog||p.w||p.l||p.yr>0).sort((a,b)=>b.sev-a.sev||b.fix-a.fix),ymax=Math.max(1,...rows.map(p=>p.yr));
  const chips=[['진행 멈춤',cnt('stall')],['기한 지남',cnt('overdue')],['다음 할 일 없음',cnt('missing')],['장기 정체',cnt('stale')]];
  const row=p=>{const c=TAGC[p.tag],tot=p.w+p.l;return '<div class="db-prow" style="border-left-color:'+(c||'transparent')+'"><div class="g"><div class="nm"><button type="button" data-db="person" data-v="'+attr(p.n)+'">'+h(p.n)+'</button><em style="'+(c?'color:#fff;background:'+c:'')+'">'+p.tag+'</em></div>'
   +'<div class="bar"><b class="'+(p.yr>0?'':'mut')+'">'+(p.yr>0?h(won(p.yr)):'아직 없음')+(p.pt>0?' <small class="db-tf">협약 · 기술자문 '+h(won(p.pt))+' 포함</small>':'')+(p.tf>0?' <small class="db-tf">타사 이관 '+h(won(p.tf))+' 포함</small>':'')+'</b><span><i style="width:'+(p.yr>0?Math.max(1,Math.round(p.yr/ymax*100)):0)+'%"></i></span></div>'
   +'<div class="bar"><div><b class="'+(p.made!==null&&p.made<LOWMADE()?'red':'')+'">'+(p.made===null?'—':p.made.toFixed(1)+'%')+'</b><small>수주 '+p.w+' · 실주 '+p.l+'</small></div><span class="wl"><i style="width:'+(tot?p.w/tot*100:0)+'%"></i><u style="width:'+(tot?p.l/tot*100:0)+'%"></u></span></div>'
   +'<div class="two"><b>'+p.prog+'건</b><small>예상 '+(p.exp>0?h(won(p.exp)):'아직 없음')+'</small></div>'
   +'<div class="two"><b style="color:'+agoColor(p)+'">'+agoText(p)+'</b><small>'+h((p.last?siteShort(p.last.site):'-')+' · 이번 주 '+p.wk+'건')+'</small></div></div>'
   +(p.why?'<div class="why"><b style="color:'+c+'">왜 막혔나</b><span>'+h(p.why)+'</span><em>손볼 건 '+p.fix+'</em></div>':'')+'</div>';};
  const W=week(P),DL=['월','화','수','목','금','토','일'];
  const heat=names.map(n=>{const my=A.filter(x=>x.owner===n),cells=W.map(k=>my.filter(x=>x.k===k).length),t=cells.reduce((a,b)=>a+b,0),p=PP.find(x=>x.n===n)||{lastDays:null,lastK:''};return {n,cells,t,p};}).sort((a,b)=>a.t-b.t);
  const total=heat.reduce((s,r)=>s+r.t,0),zero=heat.filter(r=>!r.t).length;
  const hrow=r=>'<div class="db-heat'+(r.t?'':' zero')+'"><div class="who"><b>'+h(r.n)+'</b><span>이번 주 '+r.t+'건</span></div><div class="cells">'+r.cells.map((v,i)=>'<div><span class="'+(v?'on':i>=5?'we':'')+'">'+(v||'')+'</span><small>'+DL[i]+'</small></div>').join('')+'</div><div class="last"><span>마지막 기록</span><b style="color:'+(r.p.lastDays===null||r.p.lastDays>LOSTCUT()?'#b42318':'#15171c')+'">'+(r.p.lastDays===null?'기록 없음':agoText(r.p)+' ('+md(r.p.lastK)+')')+'</b></div></div>';
  return '<section class="db-card flush"><div class="db-ch pad"><b>담당자별</b><span>막힌 사람이 위 · 이름 클릭 = 성과 분석</span><i class="db-sp"></i>'+chips.map(c=>'<span class="db-chip">'+c[0]+' <b>'+c[1]+'</b></span>').join('')+'</div>'
   +'<div class="db-phead"><span>담당자</span><span>'+(P.thisYear?'올해 수주실적':P.label+' 수주실적')+'</span><span>수주 · 실주 · 메이드율</span><span>진행 · 예상금액</span><span>최근 활동</span></div>'
   +(rows.length?rows.map(row).join(''):'<p class="db-empty">진행 · 수주 기록이 있는 담당자가 없습니다.</p>')
   +'<div class="db-foot">수주실적 = 직접 수주(계약실적 · 계약 체결일 기준) + 협약시공사 수주 · 기술자문(낙찰금액) + 인정된 타사 이관 수주(낙찰금액 · VAT 별도) · 메이드율 = 수주 ÷ (수주 + 실주) · '+LOWMADE()+'% 미만 빨강</div></section>'
   +'<section class="db-card"><div class="db-ch"><b>이번 주 영업 기록</b><span>'+md(W[0])+'(월) – '+md(W[6])+'(일)</span><i class="db-sp"></i><b class="'+(zero?'red':'')+'" style="font-size:13px">팀 전체 '+total+'건 · '+heat.length+'명 중 '+zero+'명이 이번 주 기록 0건</b></div><div class="db-heats">'+heat.map(hrow).join('')+'</div></section>';
 }
 const FLOW=['consulting','sent','relationship','competition','construction'];
 function secPipe(C,N){
  const {active,risk,deals}=C,defs=PS().definitions.filter(d=>FLOW.includes(d.key)),exp=active.reduce((s,d)=>s+(Number(d.expected)||0),0);
  const flow=defs.map(d=>{const list=active.filter(x=>PS().group(x.stage)===d.key),fix=list.filter(x=>x.issues.length).length,amt=list.reduce((s,x)=>s+(Number(x.expected)||0),0);return '<button type="button" class="db-stage'+(list.length>100?' wide':'')+'" data-db="stage" data-v="'+d.key+'"><span><b>'+d.number+'</b>'+h(d.label.replace(/단계$/,''))+'</span><div><b>'+list.length+'건</b><small>'+(amt>0?h(won(amt)):'금액 없음')+'</small></div><em class="'+(list.length&&fix/list.length>0.5?'red':'')+'">조치 필요 '+fix+'</em><i><u style="width:'+(list.length?Math.round(fix/list.length*100):0)+'%"></u></i></button>';}).join('');
  const out=d=>{try{return R.outcomeOf(d.item);}catch(e){return 'open';}},wonN=deals.filter(d=>d.won).length,lostN=deals.filter(d=>['lost','badfit','nocontact'].includes(out(d))).length,expN=deals.filter(d=>String(d.item.code||'')==='expansion').length;
  const hot=N.filter(n=>n.hot),sum=l=>l.reduce((s,n)=>s+n.amount,0),top=N.slice(0,4),rest=N.slice(4);
  const card=n=>{const badge=n.dd===null?'기한 없음':n.dd<0?'D+'+(-n.dd):'D-'+n.dd,red=n.hot||n.late;return '<button type="button" class="db-near" data-db="open" data-v="deal:'+attr(R.dealKey(n.d))+'" style="border-left-color:'+(BRC[n.d.brand]||'#9ca3af')+'"><div><em class="'+(red?'hot':'')+'">'+badge+'</em><span>'+h(n.due)+'</span><i class="db-sp"></i><b>'+(n.amount>0?h(won(n.amount)):'금액 없음')+'</b></div><b>'+h(n.d.site||'현장명 미입력')+'</b><small>'+h(n.sub)+'</small></button>';};
  /* 누가 어느 단계를 쥐고 있나(2026-10-05 영업 대시보드 v2 시안 보강): 담당 × 5단계 진행 건수 · 진할수록 많음 · 괄호 = 그중 조치 필요 */
  const SH={consulting:'컨설팅',sent:'자료 발송',relationship:'관계관리',competition:'경쟁·입찰',construction:'계약·시공'};
  const who=[...new Set(active.map(d=>d.owner||'미배정'))].map(o=>{const mine=active.filter(d=>(d.owner||'미배정')===o),cells=defs.map(df=>{const l=mine.filter(x=>PS().group(x.stage)===df.key);return {n:l.length,f:l.filter(x=>x.issues.length).length};});return {o,cells,t:mine.length};}).sort((a,b)=>(a.o==='미배정')-(b.o==='미배정')||b.t-a.t||a.o.localeCompare(b.o,'ko'));
  const cmax=Math.max(1,...who.flatMap(r=>r.cells.map(c=>c.n)));let worst=null;who.forEach(r=>r.cells.forEach((c,i)=>{if(c.f&&(!worst||c.f>worst.c.f))worst={r,c,i};}));
  const stT=defs.map((df,i)=>({l:SH[df.key]||df.label,f:who.reduce((s,r)=>s+r.cells[i].f,0)})).sort((a,b)=>b.f-a.f)[0];
  const whoNote=worst?worst.r.o+' '+(SH[defs[worst.i].key]||defs[worst.i].label)+' '+worst.c.n+'건 중 '+worst.c.f+'건이 조치 필요'+(stT&&stT.f>worst.c.f?' · 조치 필요는 '+stT.l+' 단계가 가장 많음('+stT.f+'건)':''):'조치가 필요한 건이 없습니다';
  const whoSec='<section class="db-card flush db-whos"><div class="db-ch pad"><b>누가 어느 단계를 쥐고 있나</b><span>진행 건수 · 진할수록 많음 · 괄호 = 그중 조치 필요</span></div>'
   +(who.length?'<div class="db-who" role="table" aria-label="담당자별 단계 진행 건수"><span class="wh">담당</span>'+defs.map(df=>'<span class="wh r">'+h(SH[df.key]||df.label)+'</span>').join('')+'<span class="wh r">합계</span>'
    +who.map(r=>'<span class="wn'+(r.o==='미배정'?' red':'')+'">'+h(r.o)+'</span>'+r.cells.map(c=>'<span class="wc" style="background:rgba(59,108,228,'+(0.06+Math.min(1,c.n/cmax)*0.34).toFixed(2)+')">'+c.n+(c.f?'<em> ('+c.f+')</em>':'')+'</span>').join('')+'<span class="wt">'+r.t+'</span>').join('')+'</div><p class="db-whonote">'+h(whoNote)+'</p>':'<p class="db-empty">진행 중인 영업건이 없습니다.</p>')+'</section>';
  /* 단계에 평균 며칠 머무나: 세로선 = 운영 기준(stage_dwell_days) · 넘으면 빨강 */
  const DWL=(R.CRMRules&&R.CRMRules.PHASE3&&R.CRMRules.PHASE3.stage_dwell_days)||{inq:2,cons:7,sent:14,rel:60,bid:30,con:14},DK={consulting:'cons',sent:'sent',relationship:'rel',competition:'bid',construction:'con'};
  const HINT={inq:'배정 · 첫 연락이 늦는 구간',cons:'미팅 · 견적 준비가 늦는 구간',sent:'견적 후 후속이 늦는 구간',rel:'정기 연락이 끊기는 구간',bid:'결정 일정이 밀리는 구간',con:'계약 · 인계가 늦는 구간'};
  const avgOf=l=>l.length?Math.round(l.reduce((s,v)=>s+v,0)/l.length):null,nowT=C.P.now.getTime();
  const openQ=C.rows.inquiries.filter(x=>{const q=x.item;try{if(R.inqCtlConverted(q))return false;if(typeof R.isClosedInq==='function'&&R.isClosedInq(q))return false;}catch(e){}return true;}).map(x=>{const t=Date.parse(R.inquiryCreatedAt(x.item)||'');return Number.isFinite(t)?Math.max(0,Math.floor((nowT-t)/864e5)):null;}).filter(v=>v!==null);
  const dw=[{k:'inq',l:'견적문의',d:avgOf(openQ),g:DWL.inq}].concat(defs.map(df=>({k:DK[df.key],l:SH[df.key]==='컨설팅'?'컨설팅 설계':(SH[df.key]||df.label),d:avgOf(active.filter(x=>PS().group(x.stage)===df.key).map(ageOf)),g:DWL[DK[df.key]]})));
  const dmax=Math.max(60,...dw.map(x=>Math.max(x.d||0,x.g||0))),over=dw.filter(x=>x.d!==null&&x.d>x.g).sort((a,b)=>(b.d-b.g)-(a.d-a.g))[0];
  const dwSec='<section class="db-card db-dwells"><div class="db-ch"><b>단계에 평균 며칠 머무나</b><span>세로선 = 기준</span></div>'+dw.map(x=>{const o2=x.d!==null&&x.d>x.g;return '<div class="db-dwell"><span>'+h(x.l)+'</span><i>'+(x.d===null?'':'<u style="width:'+Math.min(100,Math.round(x.d/dmax*100))+'%;background:'+(o2?'#d14a3f':'#3b6ce4')+'"></u>')+'<s style="left:'+Math.min(100,Math.round(x.g/dmax*100))+'%"></s></i><b class="'+(o2?'red':x.d===null?'mut':'')+'">'+(x.d===null?'건 없음':x.d+'일')+'</b></div>';}).join('')
   +'<p class="db-dwnote">'+h(over?over.l+' 단계가 기준('+over.g+'일)보다 '+(over.d-over.g)+'일 길게 머묾 · '+HINT[over.k]:'모든 단계가 기준 안에 있습니다')+'</p></section>';
  return '<section class="db-card"><div class="db-ch"><b>진행 중 '+active.length+'건'+(exp>0?' · '+h(won(exp)):'')+'</b><span>단계 클릭 = 그 단계 목록 · 빨간 숫자 = 조치 필요</span></div><div class="db-flow">'+flow+'</div><div class="db-ended"><span>끝난 영업 <i>· 전체 기간 누적</i></span><span>수주 <b>'+wonN+'</b></span><span>실주 <b>'+lostN+'</b></span>'+(expN?'<span>확장관리로 이어짐 <b>'+expN+'</b></span>':'')+'<i class="db-sp"></i><span>조치 필요 합계 <b class="red">'+risk.length+'</b></span></div></section>'
   +'<div class="db-pipe2">'+whoSec+dwSec+'</div>'
   +'<section class="db-card"><div class="db-ch"><b>계약 임박 · 다음 달 전망</b><span>경쟁 · 입찰 · 계약 검토 '+N.length+'건'+(sum(N)>0?' · '+h(won(sum(N))):'')+' · 기한 가까운 순</span></div>'+(N.length?'<div class="db-nears">'+top.map(card).join('')+'</div><p class="db-note">위 '+top.length+'건 '+(sum(top)>0?h(won(sum(top))):'금액 없음')+(rest.length?' · 나머지 '+rest.length+'건 '+(sum(rest)>0?h(won(sum(rest))):'금액 없음'):'')+' · 이번 주 기한 '+hot.length+'건'+(sum(hot)>0?' '+h(won(sum(hot))):'')+'</p>':'<p class="db-empty">경쟁 · 입찰 · 계약 검토 단계에 있는 건이 없습니다.</p>')+'</section>';
 }
 function actExtra(C){
  const {B,P}=C,WA=weekActs(C),W=WA.W,names=C.names,all=WA.list,K4=['call','msg','visit','quote'],AC=['#3b6ce4','#9ab6f2','#1f9d55','#e0a43a'],AL=['통화','문자 · 카카오','방문','견적 · 자료'];
  const kinds=all.map(x=>({x,k:actKind(x)})),n=k=>kinds.filter(y=>y.k===k).length,calls=n('call')+n('try');
  /* 기록 없는 날: 담당 × 지난 영업일(월~금, 오늘까지) 중 기록이 없는 날 수 */
  const days=W.slice(0,5).filter(k=>k<=P.today),slots=names.length*days.length,filled=WA.rows.reduce((s,r)=>s+days.filter(k=>r.wk.some(x=>x.k===k)).length,0),empty=slots-filled;
  const kpi=[['통화',calls,'전화 시도 '+calls+' · 실제 연결 '+n('call'),''],['문자 · 카카오',n('msg'),'응대 기록 기준',''],['현장 방문',n('visit'),'1차 미팅 · 재방문',''],['견적 · 자료 발송',n('quote'),'견적 · 제안서',''],['기록 없는 날',empty+'일',names.length+'명 × '+days.length+'영업일 = '+slots+'일 중',empty?'red':'']];
  const PP=people(C),lastOf=nm=>PP.find(p=>p.n===nm)||{lastDays:null,lastK:''};
  const ppl=WA.rows.map(r=>({r,p:lastOf(r.n),seg:K4.map(k=>r.wk.filter(x=>{const kk=actKind(x);return k==='call'?(kk==='call'||kk==='try'):kk===k;}).length)})).sort((a,b)=>a.r.t-b.r.t||(b.p.lastDays===null?-1:b.p.lastDays)-(a.p.lastDays===null?-1:a.p.lastDays)||a.r.n.localeCompare(b.r.n,'ko'));
  const pmax=Math.max(1,...ppl.map(x=>x.r.t));
  /* 활동이 결과로 이어졌나 — 이번 주 기록만. 대상이 없으면 회색 '측정 대상 없음' */
  const dealOf=key=>C.deals.find(d=>d.key===key),uniq=l=>[...new Set(l)];
  const conKeys=uniq(kinds.filter(y=>y.k==='call'||y.k==='visit').map(y=>y.x.key)),conNext=conKeys.filter(k=>{const d=dealOf(k);try{const nx=d&&R.briefNext(d.item);return !!(nx&&nx.text&&(nx.due||nx.due_at));}catch(e){return false;}}).length;
  const visAll=uniq(kinds.filter(y=>y.k==='visit').map(y=>y.x.key)),visKeys=visAll.filter(k=>{const d=dealOf(k);return !!d&&['consulting','sent'].includes(PS().group(d.stage));}),visQ=visKeys.filter(k=>{const d=dealOf(k),it=d&&d.item,cx=it&&(it.stage_contexts||(R.itemPatch(it,'deal')||{}).stage_contexts)||{},f=cx.consulting&&cx.consulting.fields||{};const vk=kinds.filter(y=>y.k==='visit'&&y.x.key===k).map(y=>y.x.k).sort()[0];return !!(f.quote_request||f.quote_due)||(!!it&&B.quoteIn(it,vk,B.addDays(vk,4)));}).length;
  const sentD=C.deals.filter(d=>{try{return B.quoteIn(d.item,W[0],B.addDays(W[6],1));}catch(e){return false;}}),sentF=sentD.filter(d=>{const cx=d.item.stage_contexts||(R.itemPatch(d.item,'deal')||{}).stage_contexts||{},sd=B.K(cx.sent&&cx.sent.fields&&cx.sent.fields.sent_date||'')||W[0];return C.A.some(x=>x.key===d.key&&x.k>sd&&['call','try','msg','visit'].includes(actKind(x)));}).length;
  const conv=[['전화 시도 → 실제 연결',calls,n('call'),calls?calls+'건 중 '+n('call')+'건'+(n('call')?'':' · 모두 부재'):'이번 주 통화 0건 · 측정 대상 없음'],['연결 → 다음 할 일 등록',conKeys.length,conNext,conKeys.length?'연결된 현장 '+conKeys.length+'곳 중 '+conNext+'곳':'이번 주 연결 0건 · 측정 대상 없음'],['방문 → 3일 안 견적 요청',visKeys.length,visQ,visKeys.length?'방문한 현장 '+visKeys.length+'곳 중 '+visQ+'곳':(visAll.length?'견적 전 단계 방문 0건':'이번 주 방문 0건')+' · 측정 대상 없음'],['견적 발송 → 7일 안 후속',sentD.length,sentF,sentD.length?'이번 주 발송 '+sentD.length+'건 중 '+sentF+'건 후속':'이번 주 발송 0건 · 측정 대상 없음']];
  const S=st(),asked=S.actAsk===W[0],can=canAssign(),zn=WA.zero.length;
  const band='<section class="db-actband'+(zn?' warn':'')+'"><div><b>이번 주 영업 기록 '+WA.total+'건 — '+names.length+'명 중 '+(zn?zn+'명이 0건':'모두 기록함')+'</b><span>'+(zn?'활동이 없었던 게 아니라 CRM에 안 남았을 가능성이 큽니다. 기록이 없으면 아래 전환율도 잴 수 없습니다.':md(W[0])+'(월) – '+md(W[6])+'(일) · 맨 위 주간 활동 카드 · 사람 탭과 같은 기록')+'</span></div>'+(zn&&can?'<button type="button" data-db="act-ask"'+(asked?' disabled':'')+'>'+(asked?'요청 보냄 ✓':zn+'명에게 기록 요청')+'</button>':'')+'</section>';
  const cards='<div class="db-aks">'+kpi.map(k=>'<div class="db-ak"><span>'+k[0]+'</span><b class="'+k[3]+'">'+k[1]+'</b><small>'+h(k[2])+'</small></div>').join('')+'</div>';
  const pplSec='<section class="db-card flush db-aps"><div class="db-ch pad"><b>담당자별 이번 주 활동</b><span>'+md(W[0])+' – '+md(W[6])+' · 기록 없는 사람 먼저 · 마지막 기록 오래된 순</span></div>'
   +ppl.map(x=>'<div class="db-ap"><b>'+h(x.r.n)+'</b><i>'+x.seg.map((v,i)=>v?'<u style="width:'+(v/pmax*100).toFixed(1)+'%;background:'+AC[i]+'"></u>':'').join('')+'</i><b class="t'+(x.r.t?'':' red')+'">'+x.r.t+'</b><span>마지막 기록 '+(x.p.lastDays===null?'없음':agoText(x.p)+' ('+md(x.p.lastK)+')')+'</span></div>').join('')
   +'<div class="db-apleg">'+AL.map((l,i)=>'<span><i style="background:'+AC[i]+'"></i>'+l+'</span>').join('')+'</div></section>';
  const convSec='<section class="db-card db-convs"><div class="db-ch"><b>활동이 결과로 이어졌나</b></div>'+conv.map(c=>{const none=!c[1],p=none?0:Math.round(c[2]/c[1]*100),col=none?'#c9cdd5':p<50?'#d14a3f':'#3b6ce4';return '<div class="db-conv"><div><span>'+c[0]+'</span><b style="color:'+(none?'#9ca3af':p<50?'#b42318':'#15171c')+'">'+(none?'—':p+'%')+'</b></div><i><u style="width:'+p+'%;background:'+col+'"></u></i><small>'+h(c[3])+'</small></div>';}).join('')+'<p class="db-dwnote">기록이 쌓이면 이 칸이 채워집니다 · 회색 = 이번 주 측정 대상 없음</p></section>';
  return band+cards+'<div class="db-pipe2">'+pplSec+convSec+'</div>';
 }
 /* [n명에게 기록 요청]: 그 사람들의 오늘 업무 '관리자 한마디'에 한 줄(관리팀 KPI 요청과 같은 저장 길 KpiB.requestLine) */
 function askRecords(){
  if(!canAssign())return;const C=core(),WA=weekActs(C),S=st();if(!WA.zero.length||S.actAsk===WA.W[0])return;
  const line='영업 기록 — 이번 주('+md(WA.W[0])+' – '+md(WA.W[6])+') CRM 기록 0건 · 통화 · 방문 · 견적 내용을 남겨 주세요';let sent=0;
  WA.zero.forEach(n=>{try{if(R.KpiB&&R.KpiB.requestLine&&R.KpiB.requestLine(n,line))sent++;}catch(e){}});
  if(sent){S.actAsk=WA.W[0];toast(sent+'명의 오늘 업무에 기록 요청을 남겼습니다');}
  else{const text='[영업 기록 요청] '+WA.zero.join(' · ')+' — '+line;const done=()=>toast('요청 문구를 복사했습니다 — 잔디에 붙여 넣어 보내세요');try{navigator.clipboard.writeText(text).then(done,done);}catch(e){done();}}
  render();
 }
 function secAct(C){
  const A=C.A.slice(0,40),G=[];A.forEach(x=>{let g=G.find(z=>z.k===x.k);if(!g){g={k:x.k,items:[]};G.push(g);}if(g.items.length<5)g.items.push(x);});
  const dl=k=>{const d=new Date(k+'T00:00:00');return d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate()+' ('+'일월화수목금토'[d.getDay()]+')';};
  return actExtra(C)+'<section class="db-card"><div class="db-ch"><b>최근 활동</b><span>날짜별 · 행 클릭 = 현장 상세</span><i class="db-sp"></i><button type="button" class="db-more" data-db="ev" data-v="activity-all">전체 보기 →</button></div>'
   +(G.length?'<div class="db-feed">'+G.slice(0,8).map(g=>'<div class="db-fg"><span>'+dl(g.k)+'</span><div>'+g.items.map(f=>'<button type="button" data-db="open" data-v="'+attr(f.key)+'"><em>'+h(f.type.slice(0,6))+'</em><b class="'+(f.owner==='미배정'?'red':'')+'">'+h(f.owner||'미배정')+'</b><span>'+h(siteShort(f.site)+(f.text?' · '+f.text:''))+'</span><b class="amt">'+(f.amt>0?h(won(f.amt)):'')+'</b></button>').join('')+'</div></div>').join('')+'</div>':'<p class="db-empty">영업 기록이 아직 없습니다.</p>')+'</section>';
 }

 /* ── 2. 컨트롤타워 ── */
 let LAST=null;
 function ctlModel(C){
  const {B,K,P,active}=C,now=P.now.getTime(),liveK=String(RULE().liveFrom||'');
  const COLS=[['unasg','미배정',3],['first','첫 연락 지연',3],['due','기한 지남',3],['seven','마지막 연락 '+CONTACT_D()+'일+',2],['next','다음 할 일 없음',1],['stall','장기 정체',1]];
  const inq=C.rows.inquiries.filter(x=>{const q=x.item;try{if(R.inqCtlConverted(q))return false;if(typeof R.isClosedInq==='function'&&R.isClosedInq(q))return false;}catch(e){}return !B.badfit(q);});
  const days=x=>{const t=Date.parse(R.inquiryCreatedAt(x.item)||'');return Number.isFinite(t)?Math.max(0,Math.floor((now-t)/864e5)):0;};
  const cells={},put=(o,c,x,kind,d,stage,reason)=>{(cells[o+'|'+c]=cells[o+'|'+c]||[]).push({key:x.key,site:x.site,owner:o,kind,d,stage,reason,x,col:c});};
  inq.forEach(x=>{const q=x.item;let asg=false;try{asg=!!R.inquiryAssigned(q);}catch(e){}
   if(!asg)return put('미배정','unasg',x,'inq',days(x),'견적문의','담당자 없음');
   let first='';try{first=R.inqCtlFirstResponseAt(q);}catch(e){}if(first)return;
   const t=Date.parse((R.inquiryAssignedAt&&R.inquiryAssignedAt(q))||q.assigned_at||R.inquiryCreatedAt(q)||'');if(!Number.isFinite(t)||(now-t)/36e5<=FIRST_H())return;
   if(liveK&&K(R.inquiryCreatedAt(q))<liveK)return;/* Live 기준일 이전 이관분은 첫 연락 지연으로 세지 않는다 */
   put(x.owner||'미배정','first',x,'inq',days(x),'견적문의','배정 후 CRM 연락 기록 없음');});
  active.forEach(d=>{const o=d.owner||'미배정',age=ageOf(d);
   if(d.issues.includes('overdue'))put(o,'due',d,'deal',overdueDays(d),d.stageLabel,'기한 지남');
   if(d.issues.includes('contact')){let m=null;try{m=R.relationshipMeta(d.item);}catch(e){}const n=m&&m.days!=null?m.days:0;put(o,'seven',d,'deal',n,d.stageLabel,'마지막 연락 '+n+'일 전');}
   if(d.issues.includes('missing'))put(o,'next',d,'deal',age,d.stageLabel,'다음 할 일 없음');
   if(d.issues.includes('stale'))put(o,'stall',d,'deal',age,d.stageLabel,'단계 '+age+'일째');});
  const n=(o,c)=>(cells[o+'|'+c]||[]).length,owners=[...new Set(Object.keys(cells).map(k=>k.split('|')[0]))],tot=o=>COLS.reduce((s,c)=>s+n(o,c[0]),0);
  owners.sort((a,b)=>(a==='미배정')-(b==='미배정')||tot(b)-tot(a));
  const colT=c=>owners.reduce((s,o)=>s+n(o,c),0);
  const pick=(p,c)=>{let out=[];owners.forEach(o=>{if(p&&o!==p)return;COLS.forEach(cc=>{if(c&&cc[0]!==c)return;out=out.concat(cells[o+'|'+cc[0]]||[]);});});if(!c){const seen=new Set();out=out.slice().sort((a,b)=>b.d-a.d).filter(it=>!seen.has(it.key)&&seen.add(it.key));}return out.slice().sort((a,b)=>b.d-a.d);};
  return {COLS,cells,owners,n,tot,colT,pick};
 }
 const WHYC={unasg:'견적문의가 들어왔는데 담당이 없습니다. 배정이 먼저입니다.',first:()=>'배정 후 '+FIRST_H()+'시간 안에 첫 연락을 못 했습니다.',due:'다음 할 일 날짜가 지났는데 기록이 없습니다.',seven:()=>'마지막 연락 후 '+CONTACT_D()+'일이 넘었습니다.',next:'다음 할 일이 비어 있어 아무도 챙기지 않는 건입니다.',stall:'단계가 오래 그대로입니다.'};
 function shade(v,sev){if(!v)return ['#fafbfc','#c9cdd5'];const k=Math.min(1,v/50);if(sev===3)return ['rgba(209,74,63,'+(0.18+k*0.72).toFixed(2)+')',k>0.25||v>=10?'#fff':'#8f1d14'];if(sev===2)return ['rgba(224,164,58,'+(0.2+k*0.6).toFixed(2)+')','#5c3a00'];return ['rgba(17,26,46,'+(0.06+k*0.32).toFixed(2)+')','#15171c'];}
 function ctl(C){
  const S=st(),M=LAST=ctlModel(C),{B,P,active,AQ,K}=C,can=canAssign();
  if(!S.touched&&!S.selP&&!S.selC){const c=['due','first','unasg'].find(k=>M.colT(k)>0);S.selC=c||null;}
  if(S.selP&&!M.owners.includes(S.selP))S.selP=null;
  const col=k=>M.pick(null,k),maxD=l=>Math.max(0,...l.map(x=>x.d)),due=col('due'),un=col('unasg'),fi=col('first');
  const topOwner=l=>{const t=B.tally(l,x=>x.owner)[0];return t?t[0]+' '+t[1]:'';};
  const liveK=String(RULE().liveFrom||'');
  const hero=[['오늘 새로 끊긴 건',fi.length,(liveK?md(liveK)+' 이후 · ':'')+'첫 연락 지연','first'],['기한 지남',due.length,due.length?'최장 '+maxD(due)+'일'+(topOwner(due)?' · '+topOwner(due):''):'기한을 넘긴 건이 없습니다','due'],['미배정 문의',un.length,un.length?'최장 '+maxD(un)+'일 대기':'미배정 문의가 없습니다','unasg']];
  /* 가장 먼저: 오늘 손댈 세 열에서 가장 큰 칸 */
  let best=null;M.owners.forEach(o=>['unasg','first','due'].forEach(c=>{const v=M.n(o,c);if(v&&(!best||v>best.v))best={o,c,v};}));
  let firstLine='오늘 손대야 할 건이 없습니다';
  if(best){const l=M.pick(best.o,best.c),t=B.tally(l,x=>x.stage)[0],lab=M.COLS.find(c=>c[0]===best.c)[1];firstLine=best.c==='unasg'?'미배정 문의 '+best.v+'건 — 가장 오래된 건 '+maxD(l)+'일 대기. 배정이 먼저입니다':best.o+' '+lab+' '+best.v+'건'+(t?' — '+t[0]+' 단계에 몰려 있습니다':'')+' (최장 '+maxD(l)+'일)';}
  const top='<div class="db-hero">'+hero.map(k=>'<button type="button" class="db-hk'+(S.selC===k[3]&&!S.selP?' on':'')+'" data-db="cell" data-v="|'+k[3]+'"><span>'+k[0]+'</span><b class="'+(k[1]?'red':'mut')+'">'+k[1]+'</b><small>'+h(k[2])+'</small></button>').join('')+'<div class="db-first"><span>가장 먼저</span><b>'+h(firstLine)+'</b><small>표에서 칸을 누르면 옆(좁은 화면은 아래) 목록에 그 건들이 나옵니다</small></div></div>';
  const TOPC={3:'#d14a3f',2:'#e0a43a',1:'#9aa0ab'};
  const grid='<div class="db-mx" role="table" aria-label="담당자별 문제 건수"><span class="h"></span>'+M.COLS.map(c=>'<button type="button" class="hc'+(S.selC===c[0]&&!S.selP?' on':'')+'" style="border-top-color:'+TOPC[c[2]]+'" data-db="cell" data-v="|'+c[0]+'"><span>'+h(c[1])+'</span><small>'+M.colT(c[0])+'건</small></button>').join('')+'<span class="h r">지시</span>'
   +M.owners.map(o=>'<button type="button" class="rn'+(S.selP===o&&!S.selC?' on':'')+'" data-db="cell" data-v="'+attr(o)+'|"><b class="'+(o==='미배정'?'red':'')+'">'+h(o)+'</b><small>합계 '+M.tot(o)+'</small></button>'
    +M.COLS.map(c=>{const v=M.n(o,c[0]),sh=shade(v,c[2]);return '<button type="button" class="cl" data-db="cell" data-v="'+attr(o)+'|'+c[0]+'" aria-label="'+attr(o+' '+c[1]+' '+v+'건')+'"><span style="background:'+sh[0]+';color:'+sh[1]+(S.selP===o&&S.selC===c[0]?';outline:2px solid #15171c':'')+'">'+(v||'·')+'</span></button>';}).join('')
    +'<span class="as">'+(can?'<button type="button" data-db="assign-row" data-v="'+attr(o)+'">지정</button>':'')+'</span>').join('')+'</div>';
  const risks=[['견적 발송 · 영업 미전환',C.rows.inquiries.filter(x=>{try{return !!R.isAwaitingPromotion(x.item);}catch(e){return false;}}).length],[B.closedWord()+' 사유 미입력',C.bad.filter(x=>B.badfitReason(x)==='사유 미기록').length],['실주 사유 미입력',C.loss.filter(d=>B.lossReason(d)==='사유 미기록').length]].filter(x=>x[1]>0);
  const table='<section class="db-card flush db-table"><div class="db-ch pad"><b>누가 · 무엇이 끊겼나</b><span>칸 = 건수 · 진할수록 많음 · 빨간 열 = 오늘 손대야 함</span></div>'+(M.owners.length?grid:'<p class="db-empty">끊긴 건이 없습니다.</p>')+'<div class="db-risk"><b>데이터 위험</b>'+(risks.length?risks.map(r=>'<span>'+r[0]+' '+r[1]+'</span>').join(''):'<i>없음</i>')+'</div></section>';
  const list=M.pick(S.selP,S.selC),cdef=M.COLS.find(c=>c[0]===S.selC),why=cdef?(typeof WHYC[cdef[0]]==='function'?WHYC[cdef[0]]():WHYC[cdef[0]]):S.selP?S.selP+'님 담당 건 중 문제가 있는 전체입니다.':'칸을 하나 골라 주세요.';
  const hasSel=!!(S.selP||S.selC);
  const side='<section class="db-card flush db-sel"><div class="hd"><div><b>'+h((S.selP||'전체')+' · '+(cdef?cdef[1]:'모든 문제'))+'</b><b class="red">'+(hasSel?list.length:0)+'건</b><i class="db-sp"></i>'+(hasSel?'<button type="button" class="lnk" data-db="clear">선택 해제</button>':'')+'</div><span>'+h(why)+'</span>'
   +(can?'<div class="db-btns"><button type="button" class="dark" data-db="assign"'+(hasSel&&list.length?'':' disabled')+'>이 '+(hasSel?list.length:0)+'건 할 일 지정</button><button type="button" data-db="notify"'+(hasSel&&list.length?'':' disabled')+'>담당자에게 알림</button></div>':'<small class="db-perm">할 일 지정 · 알림은 관리자 · 팀장만 할 수 있습니다</small>')+'</div>'
   +(hasSel?list.slice(0,6).map(x=>'<div class="it"><div><b>'+h(x.site)+'</b><span>'+h(x.owner+' · '+x.stage+' · '+x.reason)+'</span></div><b class="red">'+x.d+'일</b><button type="button" data-db="open" data-v="'+attr(x.key)+'">열기</button></div>').join(''):'')
   +'<div class="mr">'+(!hasSel?'표에서 칸 · 이름 · 열을 누르세요':list.length>6?'외 '+(list.length-6)+'건 · 오래된 순':list.length?'오래된 순':'해당 건 없음')+'</div></section>';
  /* 점검 지표 */
  const ms=mk(P.ty,P.tm),mq=AQ.filter(x=>{try{return K(R.inquiryCreatedAt(x))>=ms&&R.inquiryAssigned(x);}catch(e){return false;}}),inTime=mq.filter(x=>{let f='';try{f=R.inqCtlFirstResponseAt(x);}catch(e){}const t=Date.parse(f||''),a=Date.parse((R.inquiryAssignedAt&&R.inquiryAssignedAt(x))||x.assigned_at||R.inquiryCreatedAt(x)||'');return Number.isFinite(t)&&Number.isFinite(a)&&(t-a)/36e5<=FIRST_H();});
  const health=[['다음 할 일 등록률',B.pct(active.filter(d=>!d.issues.includes('missing')).length,active.length),95],['기록 당일 입력',null,0],[B.closedWord()+' 사유 입력률',B.pct(C.bad.filter(x=>B.badfitReason(x)!=='사유 미기록').length,C.bad.length),90],['실주 사유 입력률',B.pct(C.loss.filter(d=>B.lossReason(d)!=='사유 미기록').length,C.loss.length),90],['첫 연락 '+FIRST_H()+'시간 안',B.pct(inTime.length,mq.length),80],['견적 3일 안 발송',null,0]];
  const strip='<section class="db-card db-health"><b>점검 지표</b>'+health.map(m=>'<span>'+h(m[0])+' <b class="'+(m[1]===null?'mut':m[1]<m[2]*0.8?'red':m[1]<m[2]?'amb':'')+'">'+(m[1]===null?'아직 없음':m[1].toFixed(1)+'%')+'</b></span>').join('')+'</section>';
  return top+'<div class="db-ctl">'+table+side+'</div>'+strip+(R.G.ctlExtraOff?'':ctlExtra(C));
 }
 /* ── 컨트롤타워 '추가 분석'(5차 블록 6 · 7 · 5 — 2026-10-05 영업분석블록.dc.html · 영업 대시보드 v2.dc.html 의 자리): 진단 → 인사이트 → 액션 / 지금 잡아야 할 현장 / 관계 변화. 하나씩 보기.
    숫자 · 문장은 전부 자료에서(기록이 없으면 그렇게 적는다). [요청] = 담당자 오늘 업무 '관리자 한마디'에 한 줄(KpiB.requestLine) — 남긴 뒤에만 '보냄 ✓'. 끄기: G.ctlExtraOff=true ── */
 const BIG=()=>Number(RULE().dashBigDealAmount)||3e8;
 /* 우선도(시안 값 · 운영하며 조정 — OPS_RULES.dashPriority 로 바꾼다): 기본 + 가점 − 감점, cut 이상만 보인다. 화면에는 점수를 적지 않는다 */
 const PRI=()=>Object.assign({base:50,cut:70,amount:25,timing:20,near:20,quote:10,decider:10,silent:-15,competitor:-10,manager:-15,noinfo:-20,silentDays:7},RULE().dashPriority||{});
 const cxOf=d=>{let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}return d.stage_contexts||p.stage_contexts||{};};
 const fldAny=(d,k)=>{const c=cxOf(d);for(const s of Object.keys(c)){const v=c[s]&&c[s].fields&&c[s].fields[k];if(v)return v;}return d[k]||'';};
 const estOf=d=>{try{return Number(R.CRMRules.amounts(d).estimated)||0;}catch(e){return Number(d.amount!=null?d.amount:d.amt)||0;}};
 const sentKeyOf=(d,K)=>{const c=cxOf(d);return K((c.sent&&c.sent.fields&&c.sent.fields.sent_date)||'');};
 const CONTACT_T=/전화|통화|방문|문자|카카오|메일|미팅/;
 const contactActs=(d,K)=>{let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}const seen=new Set();return [...(d.activities||[]),...(p.activities||[])].filter(x=>{if(!x||!CONTACT_T.test(String(x.type||''))||/전화 시도/.test(String(x.note||'')))return false;const k=x.id||(x.type+'|'+(x.at||x.occurred_at));if(seen.has(k))return false;seen.add(k);return true;}).map(x=>({k:K(x.at||x.occurred_at||''),type:String(x.type||'')})).filter(x=>x.k).sort((a,b)=>a.k.localeCompare(b.k));};
 const chgOf=d=>{try{return R.ChangeEvent&&R.ChangeEvent.list?R.ChangeEvent.list(d):[];}catch(e){return [];}};
 const hasDecider=d=>{const cs=Array.isArray(d.contacts)?d.contacts:[];return cs.some(c=>/회장|입대의|동대표|대표회의/.test(String(c&&(c.role||c.manager_role||c.position||c.title)||'')))||!!String(fldAny(d,'decision_maker')||'').trim();};
 const quotesOf=d=>{let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}const v=d.quote_versions||d.quoteVersions||p.quoteVersions;return Array.isArray(v)?v.filter(Boolean):[];};
 /* 견적 뒤 후속: 영업 Funnel 과 같은 정의(견적 발송 → 경쟁 · 입찰, 견적 후 n일 후속 없음) + 후속 여부별 입찰 전환 */
 function quoteFollow(C){
  const {B,K,P,AD}=C,FOLLOW=Number(RULE().inquiryFollowDays)||7,quotedD=AD.filter(d=>B.quoteIn(d,P.a,P.b)),inComp=d=>B.entered(d,'competition',P.a,P.b),comp=AD.filter(inComp).length;
  const nfD=quotedD.filter(d=>{if(!R.isOpen(d)||PS().group(R.dealStage(d))==='competition')return false;const sd=sentKeyOf(d,K);if(!sd||B.between(sd,P.today)<=FOLLOW)return false;const l=B.lastActKey(d,B.addDays(P.today,1));return !l||l<=sd;});
  const fo={n:0,c:0},nf={n:0,c:0};quotedD.forEach(d=>{const sd=sentKeyOf(d,K);if(!sd||B.between(sd,P.today)<=FOLLOW)return;const end=B.addDays(sd,FOLLOW),g=contactActs(d,K).some(x=>x.k>sd&&x.k<=end)?fo:nf;g.n++;if(inComp(d)||PS().group(R.dealStage(d))==='competition')g.c++;});
  return {FOLLOW,quotes:quotedD.length,comp,d4:Math.max(0,quotedD.length-comp),nfD,fo,nf};
 }
 /* 변화가 결과에 준 영향: 올해 결과가 난 현장(수주 · 파이프라인 실주)에서 변화가 있던 현장과 없던 현장의 실주율 */
 function impact(C){
  const {B,P,AD}=C,closed=AD.filter(d=>(R.isWon(d)||B.isLoss(d))&&String(B.closedKey(d)||'').slice(0,4)===String(P.ty)),has=(d,t)=>chgOf(d).some(e=>e.type===t);
  const rate=l=>l.length?Math.round(l.filter(d=>B.isLoss(d)).length/l.length*100):null;
  return [['manager','관리소장 변경 후',d=>has(d,'관리소장 변경')],['requote','견적 2회 이상 수정',d=>quotesOf(d).length>=3],['competitor','새 경쟁사 등장',d=>has(d,'경쟁업체 등장')],['decider','결정권자 변경',d=>has(d,'입대의 회장 변경')]].map(([k,l,fn])=>{const w=closed.filter(fn),wo=closed.filter(d=>!fn(d));return {k,l,a:rate(w),b:rate(wo),na:w.length,nb:wo.length};});
 }
 /* 진단 → 인사이트 → 액션: 지금 자료에서 보이는 문제만(없으면 줄을 만들지 않는다) */
 function diagRows(C){
  const {B,K,P,active}=C,rows=[],own=d=>d.owner||'미배정',top=(l,fn)=>B.tally(l,fn)[0]||null,real=l=>[...new Set(l.filter(o=>o&&o!=='미배정'))];
  const late=active.map(d=>{const c=cxOf(d.item),qk=K((c.consulting&&c.consulting.fields&&c.consulting.fields.quote_due)||'');return qk&&!sentKeyOf(d.item,K)&&qk<P.today?{d,qk,days:B.between(qk,P.today)}:null;}).filter(Boolean);
  if(late.length){const t=top(late,x=>own(x.d)),mine=late.filter(x=>own(x.d)===t[0]),avg=Math.round(mine.reduce((s,x)=>s+x.days,0)/mine.length*10)/10,talk=mine.filter(x=>contactActs(x.d.item,K).some(a=>a.k>x.qk)).length;
   rows.push({id:'quote',a:t[0]+' · 견적 지연 '+mine.length+'건',as:'견적 예정일 대비 평균 +'+avg+'일',i:talk*2>=mine.length?'병목은 고객 연락이 아니라 견적 작성 · 회신 쪽 ('+mine.length+'건 중 '+talk+'건은 예정일 뒤에도 연락 기록 있음)':mine.length+'건 중 '+(mine.length-talk)+'건은 예정일 뒤 연락 기록도 없음 — 견적과 고객 연락이 같이 멈춤',x:'견적 지연 '+mine.length+'건 발송일 다시 잡기',to:real([t[0]]),list:mine.map(x=>x.d)});}
  const big=active.filter(d=>estOf(d.item)>=BIG()&&d.issues.includes('stale'));
  if(big.length){const t=top(big,own),mine=big.filter(d=>own(d)===t[0]).sort((a,b)=>estOf(b.item)-estOf(a.item)),noDec=mine.filter(d=>!hasDecider(d.item)).length,eN=Math.floor(BIG()/1e8);
   rows.push({id:'big',a:t[0]+' · '+eN+'억 이상 장기정체 '+mine.length+'건',as:mine.slice(0,2).map(d=>siteShort(d.site)+' '+eok(estOf(d.item))).join(' · ')+(mine.length>2?' 외 '+(mine.length-2)+'건':''),
    i:noDec===mine.length?(mine.length>1?mine.length+'건 모두 ':'')+'관리소장만 접촉 · 회장 · 입대의 연락처와 결정권자 기록 0':noDec?mine.length+'건 중 '+noDec+'건은 회장 · 입대의 연락처와 결정권자 기록이 없음':'결정권자 기록은 있음 — 단계가 그대로(최장 '+Math.max(0,...mine.map(ageOf))+'일)',
    x:noDec?'회장 미팅 일정 확보 · 팀장 동행':'다음 단계로 갈 조건 확인 · 팀장 동행',to:real([t[0]]),list:mine});}
  const mgr=active.map(d=>{const e=chgOf(d.item).filter(x=>x.type==='관리소장 변경').pop();if(!e||contactActs(d.item,K).some(a=>a.k>e.date))return null;return {d,days:Math.max(0,B.between(e.date,P.today))};}).filter(Boolean);
  if(mgr.length){const im=impact(C)[0],avg=Math.round(mgr.reduce((s,x)=>s+x.days,0)/mgr.length);
   rows.push({id:'mgr',a:'관리소장 변경 후 미접촉 '+mgr.length+'건',as:'변경 이벤트 후 평균 '+avg+'일 연락 없음',i:im.a!==null&&im.b!==null?'소장 변경 현장 실주율 '+im.a+'% — 변화 없는 현장 '+im.b+'%':'올해 결과가 난 소장 변경 현장이 아직 없어 실주율 비교는 보류',x:mgr.length+'건 기존 견적 · 공법 재확인 통화',to:real(mgr.map(x=>own(x.d))),list:mgr.map(x=>x.d)});}
  const qf=quoteFollow(C);
  if(qf.d4>0){const nfRows=qf.nfD.map(d=>C.deals.find(r=>String(r.item.id)===String(d.id))).filter(Boolean);
   rows.push({id:'q2b',a:'견적 → 입찰 이탈 '+qf.d4+'건',as:'견적 후 '+qf.FOLLOW+'일 후속 없던 건 '+qf.nfD.length,i:qf.fo.n&&qf.nf.n?qf.FOLLOW+'일 안에 후속한 건은 '+qf.fo.n+'건 중 '+qf.fo.c+'건이 입찰로 · 후속 없던 건은 '+qf.nf.n+'건 중 '+qf.nf.c+'건':'후속 여부를 비교할 기록(견적 발송일 · 연락 기록)이 아직 부족합니다',x:nfRows.length?'견적 후 후속 없는 '+nfRows.length+'건 후속 통화':'이번 주 견적 발송 건 후속 일정 확인',to:real(nfRows.map(own)),list:nfRows});}
  return rows;
 }
 /* 지금 잡아야 할 현장: 우선도 cut 이상만 · 한 문장 이유 · [근거]를 누르면 가감점 */
 function priList(C){
  const {K,active}=C,W=PRI(),near=new Map(nearList(C).map(n=>[String(n.d.id),n]));
  return active.map(d=>{const it=d.item,f=[],amt=estOf(it);let s=W.base;const add=(p,l,k)=>{if(!p)return;s+=p;f.push({p,l,k});};
   if(amt>=BIG())add(W.amount,Math.floor(amt/1e8)+'억 이상','amount');
   const tm=String(fldAny(it,'expected_timing')||it.construction_plan||'').trim();if(tm&&!/미정|미확인|모름/.test(tm))add(W.timing,'공사시기 확정','timing');
   const n=near.get(String(it.id));if(n&&n.hot)add(W.near,n.due.replace(/\s*\d+\/\d+$/,'')+' D-'+n.dd,'near');
   if(sentKeyOf(it,K))add(W.quote,'견적 발송','quote');
   const dec=hasDecider(it);if(dec)add(W.decider,'결정권자 접촉','decider');
   let m=null;try{m=R.relationshipMeta(it);}catch(e){}const sil=m&&m.days!=null?Number(m.days):null;if(sil!==null&&sil>W.silentDays)add(W.silent,sil+'일 무응답','silent');
   if(String(fldAny(it,'competitor')||'').trim())add(W.competitor,'경쟁사 있음','competitor');
   if(chgOf(it).some(e=>e.type==='관리소장 변경'))add(W.manager,'소장 변경','manager');
   if(n&&!n.k&&R.dealStage(it)==='contract')add(W.noinfo,'계약정보 없음','noinfo');
   const g=k=>f.find(v=>v.k===k),up=g('near')||g('timing')||g('amount')||g('quote'),dn=g('silent')||g('noinfo')||g('manager')||g('competitor');
   const one=up&&dn?up.l+(up.k==='near'?'인데 ':' · ')+(dn.k==='silent'?sil+'일째 고객 반응 없음':dn.l):f.filter(v=>v.p>0).slice(0,2).map(v=>v.l).join(' · ');
   const act=dn&&dn.k==='silent'?'후속 연락':dn&&dn.k==='noinfo'?'정보 입력':dn&&dn.k==='manager'?'재확인 통화':!dec?'회장 접촉':up&&up.k==='near'?'준비 확인':'열기';
   return {d,s,f,amt,one,act};}).filter(x=>x.s>=W.cut).sort((a,b)=>b.s-a.s||b.amt-a.amt);
 }
 /* 이번 주 달라진 것: 최근 7일(오늘 포함)에 생긴 변화만 — 전주 = 그 전 7일(단계별 전주 대비 표와 같은 기간) */
 function changeWeek(C){
  const {B,K,P,AD,AQ,L}=C,end=B.addDays(P.today,1),a1=B.addDays(P.today,-6),a0=B.addDays(P.today,-13),inW=(k,a,b)=>!!k&&k>=a&&k<b,row=d=>C.deals.find(r=>String(r.item.id)===String(d.id)),rows=l=>l.map(row).filter(Boolean),CD=CONTACT_D();
  const nq=AQ.filter(x=>inW(K(R.inquiryCreatedAt(x)),a1,end)),pq=AQ.filter(x=>inW(K(R.inquiryCreatedAt(x)),a0,a1)).length,dq=nq.length-pq;
  const con=B.contractsIn(L,a1,end,null,'direct'),ptw=C.DW?C.DW.partnerIn(a1,end,C.target):{count:0,amount:0},tfw=C.DT?C.DT.wonIn(a1,end,C.target):{count:0,amount:0},wonA=(con.net||0)+ptw.amount+tfw.amount;
  const lost=AD.filter(d=>B.isLoss(d)&&inW(B.closedKey(d),a1,end)),lostA=lost.reduce((s,d)=>s+estOf(d),0);
  const ev=[];AD.forEach(d=>chgOf(d).forEach(e=>{if(inW(e.date,a1,end))ev.push({d,e});}));
  const mgr=ev.filter(x=>x.e.type==='관리소장 변경'),mgrTodo=mgr.filter(x=>R.isOpen(x.d)&&!contactActs(x.d,K).some(a=>a.k>x.e.date)).length,cmp=ev.filter(x=>x.e.type==='경쟁업체 등장'),cmpTop=B.tally(cmp,x=>String(x.e.to||'').trim()||'미기록')[0];
  const rq=[];AD.forEach(d=>{const v=quotesOf(d);v.forEach((q,i)=>{if(!i||!inW(K(q.created_at||q.sent_at||''),a1,end))return;const p=Number(v[i-1].amount)||0,n=Number(q.amount)||0;rq.push({d,pc:p>0&&n>0?(n-p)/p*100:null});});});
  const rqPc=rq.filter(x=>x.pc!==null),rqAvg=rqPc.length?Math.round(rqPc.reduce((s,x)=>s+x.pc,0)/rqPc.length):null;
  const stuck=[],freed=[];AD.forEach(d=>{const a=contactActs(d,K);if(!a.length)return;const last=a[a.length-1];
   if(R.isOpen(d)&&B.between(last.k,P.today)>CD&&inW(B.addDays(last.k,CD+1),a1,end))stuck.push(d);
   for(let i=a.length-1;i>0;i--){if(!inW(a[i].k,a1,end))break;if(B.between(a[i-1].k,a[i].k)>CD){freed.push({d,type:a[i].type});break;}}});
  const stTop=B.tally(rows(stuck),r=>r.stageLabel)[0],frTop=B.tally(freed,x=>x.type)[0],inqRows=nq.map(x=>C.rows.inquiries.find(r=>String(r.item.id)===String(x.id))).filter(Boolean);
  return {a1,end,tiles:[
   ['new','신규 문의',nq.length,'cw-ink',dq?(dq>0?'▲':'▼')+Math.abs(dq):'전주와 같음',inqRows],
   ['won','수주 전환',L.ready?con.count+ptw.count+tfw.count:null,'cw-ok',wonA>0?eok(wonA):'',[]],
   ['lost','실주',lost.length,'cw-bad',lostA>0?eok(lostA):'',rows(lost)],
   ['mgr','관리소장 변경',mgr.length,'cw-bad',mgr.length?'재확인 필요 '+mgrTodo:'',rows(mgr.map(x=>x.d))],
   ['requote','견적금액 변경',rq.length,'cw-ink',rqAvg===null?'':'평균 '+(rqAvg>0?'+':rqAvg<0?'−':'')+Math.abs(rqAvg)+'%',rows(rq.map(x=>x.d))],
   ['comp','새 경쟁사 등장',cmp.length,'cw-bad',cmpTop?cmpTop[0]+' '+cmpTop[1]:'',rows(cmp.map(x=>x.d))],
   ['stuck',CD+'일+ 정체 신규',stuck.length,'cw-bad',stTop?stTop[0]+' '+stTop[1]:'',rows(stuck)],
   ['freed','정체 해소',freed.length,'cw-ok',frTop?frTop[0]+' '+frTop[1]:'',rows(freed.map(x=>x.d))]]};
 }
 let LASTX=null;
 function ctlExtra(C){
  const S=st(),P=C.P,can=canAssign(),CT=['진단 → 인사이트 → 액션','지금 잡아야 할 현장','관계 변화'],t=Math.max(0,Math.min(2,Number(S.cx)||0));S.dxSent=S.dxSent||{};
  const head='<div class="db-cxt"><b>추가 분석</b>'+CT.map((l,i)=>'<button type="button" data-db="cx" data-v="'+i+'" aria-pressed="'+(t===i)+'">'+l+'</button>').join('')+'<i></i><span>하나씩 보기</span></div>';
  let body='';LASTX={};
  if(t===0){const rows=LASTX.diag=diagRows(C);
   body='<div class="db-dx"><div class="db-dxh">'+[['1','진단','데이터'],['2','인사이트','왜 그런지'],['3','액션','오늘 누구에게 무엇을']].map(x=>'<div><em>'+x[0]+'</em><b>'+x[1]+'</b><span>'+x[2]+'</span></div>').join('')+'</div>'
    +(rows.length?rows.map(r=>{const sent=!!S.dxSent[r.id+'|'+P.today],lab=sent?'보냄 ✓':!r.to.length?'목록 보기':r.to.length===1?r.to[0]+'에게 요청':'담당 '+r.to.length+'명에게 요청';
      return '<div class="db-dxr"><button type="button" class="db-dx1" data-db="dx-list" data-v="'+r.id+'" title="해당 건 보기"><b>'+h(r.a)+'</b><span>'+h(r.as)+'</span></button><div class="db-dx2"><em>AI</em><span>'+h(r.i)+'</span></div><div class="db-dx3"><span><b>'+h(r.x)+'</b></span>'+(!r.to.length&&!r.list.length?'':'<button type="button" class="'+(sent?'db-dxd':'')+'" data-db="'+(r.to.length?'dx-ask':'dx-list')+'" data-v="'+r.id+'"'+(r.to.length&&!sent&&!can?' disabled title="요청은 관리자 · 팀장만 할 수 있습니다"':sent?' disabled':'')+'>'+h(lab)+'</button>')+'</div></div>';}).join(''):'<p class="db-empty">지금 자료에서 짚을 문제가 없습니다.</p>')+'</div>';}
  else if(t===1){const all=priList(C),list=all.slice(0,6);LASTX.pri=list;
   body='<div class="db-pr"><div class="db-prh"><i></i><b>지금 잡아야 할 현장 '+all.length+'곳</b><span>점수는 숨기고 결론만 · 근거는 눌러서</span></div>'
    +(list.length?list.map(x=>{const op=S.priOpen===x.d.key;return '<div class="db-prr"><div class="db-prl"><i style="background:'+(BRC[x.d.item.brand]||'#9aa0ab')+'"></i><div class="db-prn"><b>'+h(x.d.site)+'</b><span>'+h((x.d.owner||'미배정')+' · '+(x.amt>0?eok(x.amt):'금액 미입력'))+'</span></div><span class="db-pro">'+h(x.one)+'</span><span class="db-prb"><button type="button" class="db-prw" data-db="pri-why" data-v="'+attr(x.d.key)+'" aria-expanded="'+op+'">'+(op?'근거 접기':'근거')+'</button><button type="button" class="db-prg" data-db="open" data-v="'+attr(x.d.key)+'">'+h(x.act)+'</button></span></div>'
      +(op?'<div class="db-prf">'+x.f.map(v=>'<span class="'+(v.p>0?'db-pru':'db-prd')+'"><b>'+(v.p>0?'+':'−')+Math.abs(v.p)+'</b> '+h(v.l)+'</span>').join('')+'</div>':'')+'</div>';}).join('')+(all.length>list.length?'<div class="db-prm">외 '+(all.length-list.length)+'곳</div>':''):'<p class="db-empty">지금 우선도 기준을 넘는 현장이 없습니다.</p>')
    +'<div class="db-prt">우선도 = 금액 · 공사시기 확정 · 회의 임박 · 견적 발송 · 결정권자 접촉(+) − 무응답 · 경쟁 공법(−) · '+PRI().cut+'점 이상만 이 묶음 · 화면엔 점수 없음</div></div>';}
  else{const W=LASTX.chg=changeWeek(C),im=impact(C);
   body='<div class="db-cw"><section><b class="db-cwt">이번 주 달라진 것 <span>상태가 아니라 변화만 · 누르면 해당 현장</span></b><div class="db-cwg">'+W.tiles.map(x=>'<button type="button" data-db="cw-tile" data-v="'+x[0]+'"'+(x[5].length?'':' disabled')+'><span>'+h(x[1])+'</span><b class="'+(x[2]===null?'mut':x[2]?x[3]:'mut')+'">'+(x[2]===null?'불러오는 중':x[2])+'</b><small>'+h(x[4])+'</small></button>').join('')+'</div></section>'
    +'<section><b class="db-cwt">변화가 결과에 준 영향 <span>올해 · 결과가 난 현장</span></b>'+im.map(x=>'<div class="db-cwi"><b>'+h(x.l)+'</b><span class="db-cwb"><u><i class="cw-a" style="width:'+(x.a||0)+'%"></i></u><u><i class="cw-b" style="width:'+(x.b||0)+'%"></i></u></span><span class="db-cwp">'+(x.a===null?'<small>기록 없음</small>':'<b>'+x.a+'%</b> / '+(x.b===null?'—':x.b+'%'))+'</span></div>').join('')+'<span class="db-cwl">빨강 = 변화가 있던 현장 실주율 · 회색 = 변화 없던 현장 실주율</span></section></div>';}
  return '<section class="db-card flush db-cx">'+head+body+'</section>';
 }
 function dxAsk(id){
  if(!canAssign()||!LASTX||!LASTX.diag)return;const r=LASTX.diag.find(x=>x.id===id),S=st(),P=period();if(!r||!r.to.length)return;const key=id+'|'+P.today;if(S.dxSent&&S.dxSent[key])return;
  const line='컨트롤타워 — '+r.a+' · '+r.x;let sent=0;r.to.forEach(n=>{try{if(R.KpiB&&R.KpiB.requestLine&&R.KpiB.requestLine(n,line))sent++;}catch(e){}});
  if(sent){(S.dxSent=S.dxSent||{})[key]=true;toast(sent+'명의 오늘 업무에 요청을 남겼습니다');render();}else toast('요청을 남기지 못했습니다 — 잠시 뒤 다시 시도해 주세요');
 }
 function cxList(kind,id){
  if(!LASTX)return;const X=SI();
  if(kind==='diag'){const r=(LASTX.diag||[]).find(x=>x.id===id);if(r&&r.list.length)X.openEvidence(r.a,r.as,evRows(r.list));return;}
  const t=LASTX.chg&&LASTX.chg.tiles.find(x=>x[0]===id);if(t&&t[5].length)X.openEvidence('이번 주 달라진 것 · '+t[1],md(LASTX.chg.a1)+' 이후 '+t[5].length+'건',evRows(t[5]));
 }

 /* ── 3. 성과 분석 ── */
 function pendingStats(){
  const deals=SI().rows(true,true).deals,ts=v=>Date.parse(v||''),hist=it=>(it.stageHistory||it.stage_history||[]).map(x=>({to:String(x.to||x.to_stage||''),t:ts(x.at||x.changed_at)})).filter(x=>Number.isFinite(x.t)),ac=it=>(it.activities||it.activity_signals||[]).map(x=>({type:String(x.type||''),note:String(x.note||''),t:ts(x.at||x.occurred_at)})).filter(x=>Number.isFinite(x.t));
  const contact=x=>/전화|통화|방문|문자|카카오|메일|미팅/.test(x.type)&&!/전화 시도/.test(x.note),oc=d=>{try{return R.outcomeOf(d.item);}catch(e){return 'open';}};
  const SENT=['sent','compete','imminent','bidding','contract','construction','completion','won'],COMP=['compete','imminent','bidding'],code=d=>String(d.item.stage_code||d.item.code||'');
  const fu=deals.filter(d=>{const s=hist(d.item).filter(x=>x.to==='sent').sort((a,b)=>a.t-b.t)[0];return !!s&&ac(d.item).some(x=>contact(x)&&x.t>s.t)&&['won','lost'].includes(oc(d));}),fuW=fu.filter(d=>oc(d)==='won').length;
  const visited=deals.filter(d=>ac(d.item).some(x=>/방문/.test(x.type)||/^방문|현장 ?방문/.test(x.note))),toQ=visited.filter(d=>hist(d.item).some(x=>SENT.includes(x.to))||SENT.includes(code(d))).length;
  const comp=deals.filter(d=>(hist(d.item).some(x=>COMP.includes(x.to))||COMP.includes(code(d)))&&['won','lost'].includes(oc(d))),cw=comp.filter(d=>oc(d)==='won').length;
  const pc=(a,b)=>b?Math.round(a/b*100)+'%':'—';
  return [['견적 후 첫 후속 → 수주',fu.length,pc(fuW,fu.length)],['현장 방문 → 견적',visited.length,pc(toQ,visited.length)],['경쟁 · PT · 입찰 → 수주',comp.length,pc(cw,comp.length)]];
 }
 /* 유입 브랜드 → 낙찰 시공사 → 수주실적 · 매출: 수주실적 = 낙찰금액, 매출 = 회사에 실제 들어오는 금액(직접 계약 · 기술자문 · POUR 계약). 타사 이관은 매출 없음 */
 function matrixRows(C){
  const {P,L}=C,m=new Map(),add=(brand,company,type,n,amt,rev,unknown)=>{const k=brand+'\u0001'+company+'\u0001'+type,v=m.get(k)||{brand,company,type,n:0,amt:0,rev:0,unknown:0};v.n+=n;v.amt+=amt;v.rev+=rev;v.unknown+=unknown||0;m.set(k,v);};
  (L.rows||[]).forEach(r=>{if(r.advisory_id||C.DW?.isPartnerDeal?.(r.deal_id))return;const brand=String(r.brand||'').trim()||'브랜드 미기록';let w=null;try{w=C.DW&&C.DW.of({id:r.deal_id});}catch(e){}const company=w&&w.win_status==='confirmed'&&w.won_type==='own'&&w.award_company?String(w.award_company):brand;(r.events||[]).forEach(e=>{const k=e.effective_date;if(!(k>=P.a&&k<P.b))return;add(brand,company,'직접 수주',e.kind==='signed'?1:0,Number(e.amount_delta)||0,Number(e.amount_delta)||0);});});
  C.pt.list.forEach(x=>add(x.brand,x.company,'협약 · 기술자문',x.signedCount,x.amount,x.revenue,x.revKnown?0:1));
  C.tf.list.forEach(x=>add(String(x.brand||'').trim()||'브랜드 미기록',String(x.t&&(x.t.award_company||x.t.transfer_company)||'').trim()||'업체 미기록','타사 이관',1,x.amount,0));
  const BO=BR.map(b=>b[0]),TO=['직접 수주','협약 · 기술자문','타사 이관'],bi=b=>{const i=BO.indexOf(b);return i<0?99:i;};
  return [...m.values()].filter(v=>v.n>0||v.amt!==0).sort((a,b)=>bi(a.brand)-bi(b.brand)||a.brand.localeCompare(b.brand)||TO.indexOf(a.type)-TO.indexOf(b.type)||b.amt-a.amt);
 }
 function matrix(C){
  const {P,L}=C,rows=L.ready?matrixRows(C):[],TG={'직접 수주':['#15171c','#eef0f3'],'협약 · 기술자문':['#b4530b','#fff1e6'],'타사 이관':['#1d3f99','#eef3fe']};
  const tot=rows.reduce((s,r)=>({n:s.n+r.n,amt:s.amt+r.amt,rev:s.rev+r.rev,unknown:s.unknown+r.unknown}),{n:0,amt:0,rev:0,unknown:0}),own=rows.filter(r=>r.type==='직접 수주').reduce((s,r)=>s+r.rev,0),ptRows=rows.filter(r=>r.type==='협약 · 기술자문'),ptAmt=ptRows.reduce((s,r)=>s+r.amt,0),ptRev=ptRows.reduce((s,r)=>s+r.rev,0);
  const ratio=(rev,amt)=>amt>0?Math.round(rev/amt*100):null,money=v=>v>0?eok(v):v<0?'-'+eok(-v):'-';
  const head='<div class="db-ch pad"><b>유입 브랜드 → 낙찰 시공사 → 수주실적 · 매출</b><span>'+h(P.label)+' · 수주실적 = 낙찰금액 · 매출 = 회사에 실제 들어오는 금액(직접 계약 · 기술자문 · POUR 계약)</span></div>';
  if(!L.ready)return '<section class="db-card flush db-bxs">'+head+'<p class="db-empty">계약 원장을 불러오는 중입니다.</p></section>';
  if(!rows.length)return '<section class="db-card flush db-bxs">'+head+'<p class="db-empty">'+h(P.label)+' 수주가 아직 없습니다.</p></section>';
  const tops=[['수주실적 (낙찰금액)',money(tot.amt),tot.n+'건 · 영업 성과 · 인센티브 기준'],['회사 매출',money(tot.rev),'직접 계약 '+money(own)+' + 기술자문 · POUR '+money(ptRev)],['협약 · 기술자문 비중',tot.amt>0?Math.round(ptAmt/tot.amt*100)+'%':'—','수주실적 중 협약시공사 낙찰 '+money(ptAmt)]];
  let prev='';const body=rows.map(r=>{const first=r.brand!==prev;prev=r.brand;const c=BRC[r.brand]||'#9aa0ab',t=TG[r.type],ra=ratio(r.rev,r.amt),noRev=r.type==='협약 · 기술자문'&&r.unknown===r.n;
   return '<span class="bxb" style="color:'+c+'">'+(first?'<i style="background:'+c+'"></i>'+h(r.brand):'')+'</span><span class="bxc" title="'+attr(r.company)+'">'+h(r.company)+'</span><span><em style="color:'+t[0]+';background:'+t[1]+'">'+r.type+'</em></span><span class="bxr">'+r.n+'</span><span class="bxr bxw">'+money(r.amt)+'</span><span class="bxr bxw bxg">'+(r.type==='타사 이관'?'-':noRev?'미입력':money(r.rev))+'</span><span class="bxa'+(ra!==null&&ra<60?' bxl':'')+'">'+(r.type==='타사 이관'||noRev||ra===null?'-':ra+'%<u><i style="width:'+Math.max(0,Math.min(100,ra))+'%"></i></u>')+'</span>';}).join('');
  const tr=ratio(tot.rev,tot.amt),total='<span class="bxz">합계</span><span class="bxz"></span><span class="bxz"></span><span class="bxz bxr">'+tot.n+'</span><span class="bxz bxr">'+money(tot.amt)+'</span><span class="bxz bxr bxg">'+money(tot.rev)+'</span><span class="bxz">'+(tr===null?'-':tr+'%')+'</span>';
  const byB=new Map();rows.forEach(r=>{const v=byB.get(r.brand)||{all:0,pt:0,co:new Map()};v.all+=r.amt;if(r.type==='협약 · 기술자문'){v.pt+=r.amt;v.co.set(r.company,(v.co.get(r.company)||0)+r.amt);}byB.set(r.brand,v);});
  const topB=[...byB].filter(x=>x[1].pt>0).sort((a,b)=>b[1].pt-a[1].pt)[0],topC=topB?[...topB[1].co].sort((a,b)=>b[1]-a[1])[0]:null;
  const note=(topB?topB[0]+'로 들어온 수주실적 '+money(topB[1].all)+' 중 '+money(topB[1].pt)+'('+Math.round(topB[1].pt/topB[1].all*100)+'%)'+(topB[1].co.size===1&&topC?'가 '+topC[0]+' 낙찰':'가 협약시공사 낙찰')+' · 기술자문 구조라 회사 매출은 수주실적보다 작게 잡힙니다.':'협약시공사 · 기술자문 수주가 없어 수주실적과 회사 매출이 같습니다.')+' 매출 비율 = 매출 ÷ 수주실적.'+(tot.unknown?' 기술자문 · POUR 계약금액이 아직 입력되지 않은 '+tot.unknown+'건은 매출에 들어가지 않았습니다.':'');
  return '<section class="db-card flush db-bxs">'+head+'<div class="db-bxt">'+tops.map(t=>'<div><span>'+t[0]+'</span><b>'+h(t[1])+'</b><small>'+h(t[2])+'</small></div>').join('')+'</div><div class="db-bx">'+['유입 브랜드','낙찰 시공사','수주 유형'].map(l=>'<span class="bxh">'+l+'</span>').join('')+'<span class="bxh bxr">건수</span><span class="bxh bxr">수주실적</span><span class="bxh bxr">매출</span><span class="bxh">매출 비율</span>'+body+total+'</div><p class="db-bxn">'+h(note)+'</p></section>';
 }
 /* 문의 코호트 전환율(2차 기능 6): 같은 달에 들어온 문의가 결국 몇 건 계약됐나 — 접수 월 기준 최근 6개월. 수주 판정은 주간 브리핑의 '확정 전환율'과 같은 함수 */
 function inquiryFate(C,x){const B=C.B;if(B.badfit(x))return 'badfit';if(C.L.ready&&B.inquiryContract(x,C.L,C.AD))return 'won';let d=null;try{d=R.linkedDeal(x);}catch(e){}if(d&&B.isLoss(d))return 'lost';return 'open';}
 function cohort(C){
  const {K,P,AQ,L}=C,rows=[];for(let i=5;i>=0;i--){const d=new Date(P.ty,P.tm-1-i,1),ym=d.getFullYear()+'-'+pad(d.getMonth()+1),q=AQ.filter(x=>K(R.inquiryCreatedAt(x)).slice(0,7)===ym),f=q.map(x=>inquiryFate(C,x));rows.push({m:(d.getMonth()+1)+'월',q:q.length,fit:f.filter(v=>v!=='badfit').length,won:f.filter(v=>v==='won').length,open:f.filter(v=>v==='open').length,lost:f.filter(v=>v==='lost').length,old:i>=(R.CRMRules?R.CRMRules.PHASE2.cohort_compare_after_months:3)});}
  const head='<div class="db-ch"><b>접수 월별 · 같은 달에 들어온 문의가 결국 몇 건 계약됐나</b><span>최근 6개월 · 확정 전환율 = 수주 ÷ 문의</span></div>',max=Math.max(30,...rows.map(r=>r.q?r.won/r.q*100:0));
  const body=rows.map(r=>{const rate=r.q?Math.round(r.won/r.q*1000)/10:null;return '<span class="cow">'+r.m+'</span><span class="cor">'+r.q+'</span><span class="cor">'+r.fit+'</span><span class="cor cow">'+(L.ready?r.won:'—')+'</span><span class="cor com">'+(L.ready?r.open:'—')+'</span><span class="cor">'+r.lost+'</span><span class="cow cob">'+(!L.ready?'불러오는 중':rate===null?'문의 없음':rate.toFixed(1)+'%<u><i style="width:'+Math.round(rate/max*100)+'%"></i></u>')+'</span>';}).join('');
  return '<section class="db-card db-cos">'+head+'<div class="db-co">'+['접수 월','문의','적합','수주','진행 중','실주'].map((l,i)=>'<span class="coh'+(i?' cor':'')+'">'+l+'</span>').join('')+'<span class="coh">확정 전환율</span>'+body+'</div><p class="db-con">최근 달은 아직 진행 중이 많아 전환율이 낮게 보입니다. '+(R.CRMRules?R.CRMRules.PHASE2.cohort_compare_after_months:3)+'개월 지난 달끼리 비교하세요.</p></section>';
 }
 /* 유입경로 → 계약(2차 기능 7): 견적문의의 '유입경로' 값 기준 — 어디서 계약되는 문의가 들어오나 */
 const channelOf=q=>{const r=q&&q.raw&&typeof q.raw==='object'?q.raw:{};return String(r['유입경로']||q.source_channel||q.channel||r['상담채널']||'').trim()||'유입경로 미기록';};
 function channel(C){
  const {P,q,L}=C,m=new Map();q.forEach(x=>{const k=channelOf(x),v=m.get(k)||{l:k,q:0,fit:0,won:0},f=inquiryFate(C,x);v.q++;if(f!=='badfit')v.fit++;if(f==='won')v.won++;m.set(k,v);});
  const rows=[...m.values()].sort((a,b)=>b.q-a.q||a.l.localeCompare(b.l)),head='<div class="db-ch"><b>어디서 계약되는 문의가 들어오나</b><span>'+h(P.label)+' 접수 · 견적문의 유입경로 값 기준</span></div>';
  if(!rows.length)return '<section class="db-card db-cos">'+head+'<p class="db-empty">'+h(P.label)+' 접수된 견적문의가 없습니다.</p></section>';
  const rate=r=>r.q?Math.round(r.won/r.q*100):0,body=rows.map(r=>{const p=rate(r);return '<span class="cow" title="'+attr(r.l)+'">'+h(r.l)+'</span><span class="cor">'+r.q+'</span><span class="cor">'+r.fit+'</span><span class="cor cow">'+(L.ready?r.won:'—')+'</span><span class="cow cob cog'+(p>=40?' hi':'')+'">'+(L.ready?p+'%<u><i style="width:'+Math.max(2,Math.min(100,Math.round(p/60*100)))+'%"></i></u>':'불러오는 중')+'</span>';}).join('');
  const top=rows[0],best=rows.filter(r=>r.q>=3&&r.won>0).sort((a,b)=>rate(b)-rate(a))[0],known=rows.filter(r=>r.l!=='유입경로 미기록').length;
  const note=!L.ready?'계약 원장을 불러오는 중입니다.':!known?'견적문의에 유입경로가 아직 기록되지 않았습니다 — 문의 상세의 유입경로를 채우면 경로별로 나뉩니다.':!best?'문의는 '+top.l+'가 가장 많습니다('+top.q+'건). 아직 3건 이상 들어온 경로 중 수주로 이어진 곳이 없습니다.':'문의는 '+top.l+'가 가장 많고('+top.q+'건), 계약으로 이어지는 비율은 '+best.l+'가 가장 높습니다('+rate(best)+'% · '+best.q+'건 중 '+best.won+'건).';
  return '<section class="db-card db-cos">'+head+'<div class="db-chn">'+['유입경로','문의','적합','수주'].map((l,i)=>'<span class="coh'+(i?' cor':'')+'">'+l+'</span>').join('')+'<span class="coh">문의 → 수주</span>'+body+'</div><p class="db-con">'+h(note)+'</p></section>';
 }
 function perf(C){
  const {B,P,L,active,con,made,q}=C,ALL=people(C),PP=ALL.filter(p=>p.prog||p.w||p.l||p.yr>0),ms=mk(P.ty,P.tm),cm=B.contractsIn(L,ms,mk(P.ty,P.tm+1),null,'direct');
  const extra=(a,b)=>(C.DW?C.DW.partnerIn(a,b,C.target).amount:0)+(C.DT?C.DT.wonIn(a,b,C.target).amount:0);/* 협약 · 기술자문 + 타사 이관 */
  let sum=0,n=0;for(let m=1;m<=12;m++){if(P.y>P.ty||(P.y===P.ty&&m>=P.tm))continue;sum+=B.contractsIn(L,mk(P.y,m),mk(P.y,m+1),null,'direct').net+extra(mk(P.y,m),mk(P.y,m+1));n++;}
  const avg=n?sum/n:0,gauge=L.ready&&avg>0&&P.y===P.ty?Math.round((cm.net+extra(ms,mk(P.ty,P.tm+1)))/avg*100):null,exp=active.reduce((s,d)=>s+(Number(d.expected)||0),0);
  const low=PP.filter(p=>p.made!==null&&p.made<LOWMADE()&&p.w+p.l>=MINCLOSED());
  cm.net+=extra(ms,mk(P.ty,P.tm+1));
  const s1=!L.ready?'계약 원장을 불러오는 중입니다.':h(P.label)+' 수주실적 <b>'+(C.perf>0?h(won(C.perf)):'아직 없음')+'</b>'+(avg>0?' · 월평균 '+h(won(avg)):'')+'. '+(P.y===P.ty?P.tm+'월은 <b>'+P.td+'일째 · '+(cm.net>0?h(won(cm.net)):'아직 없음')+'</b>. ':'')+(exp>0?'파이프라인 '+h(won(exp))+(avg>0?'은 월평균의 <b>'+(exp/avg).toFixed(1)+'개월치</b>입니다.':'이 진행 중입니다.'):'진행 중인 파이프라인 금액이 없습니다.');
  const s2=made===null?'':'영업 메이드율 '+made.toFixed(1)+'%'+(low.length?' · '+low.map(p=>p.n+' '+p.made.toFixed(1)+'%').join(' · ')+' — 기준 '+LOWMADE()+'% 아래입니다.':' · 종료 '+MINCLOSED()+'건 이상인 담당자 중 '+LOWMADE()+'% 아래는 없습니다.');
  const g=gauge===null?0:Math.min(100,gauge);
  const verdict='<section class="db-card db-verdict"><div class="ring" style="background:conic-gradient(#3b6ce4 0 '+g+'%,#eef0f3 '+g+'% 100%)"><div><b>'+(gauge===null?'—':gauge+'%')+'</b><span>월평균 대비</span></div></div><div class="tx"><span>'+s1+'</span>'+(s2?'<span class="'+(low.length?'amb':'mut')+'">'+h(s2)+'</span>':'')+'</div><div class="rt"><b class="'+(L.ready&&C.perf>0?'':'mut')+'">'+(L.ready?(C.perf>0?h(won(C.perf)):'아직 없음'):'불러오는 중')+'</b><span>'+(P.thisYear?'연 누적':h(P.label))+' · 수주 '+C.won+'건'+(C.pt.count||C.tf.count?' ('+[C.pt.count?'협약 · 기술자문 '+C.pt.count+'건 · '+h(won(C.pt.amount)):'',C.tf.count?'타사 이관 '+C.tf.count+'건 · '+h(won(C.tf.amount)):''].filter(Boolean).join(' / ')+')':'')+'</span><small>메이드율 <b>'+pt(made)+'</b> · 문의→계약 <b>'+(L.ready?pt(B.pct(C.won,q.length)):'—')+'</b></small></div></section>';
  const ranked=PP.slice().sort((a,b)=>b.yr-a.yr||b.w-a.w);
  const card=(p,i)=>{const first=i===0&&p.yr>0,badge=first?'1위':p.sev?'주의':(i+1)+'위',bc=first?'#3b6ce4':p.sev?'#e0a43a':'#9aa0ab',lowM=p.made!==null&&p.made<LOWMADE(),deg=p.made===null?0:p.made;
   return '<div class="db-pc"><div class="hd"><em style="background:'+bc+'">'+badge+'</em><button type="button" data-db="person" data-v="'+attr(p.n)+'">'+h(p.n)+'</button><i class="db-sp"></i><span>'+(p.lastK||'-')+'</span></div><div class="bd"><div class="ring" style="background:conic-gradient('+(lowM?'#d14a3f':'#3b6ce4')+' 0 '+deg+'%,#eef0f3 '+deg+'% 100%)"><div><b class="'+(lowM?'red':'')+'">'+(p.made===null?'-':p.made.toFixed(1)+'%')+'</b><span>메이드율</span></div></div>'
    +'<div class="kv"><span>'+(P.thisYear?'올해 수주실적':'기간 수주실적')+' <b>'+(p.yr>0?h(won(p.yr)):'아직 없음')+'</b></span><span>'+P.tm+'월 <b>'+(p.mo>0?h(won(p.mo)):'아직 없음')+'</b></span><span>수주 · 실주 <b>'+p.w+' · '+p.l+'</b></span><span>진행 <b>'+p.prog+'건</b></span><span>주간 활동 <b>'+p.wk+'건</b></span><span>손볼 건 <b class="red">'+p.fix+'건</b></span></div></div><p class="'+(lowM||p.fix>10?'red':'')+'">'+h(p.why||(p.fix?'손볼 건 '+p.fix+'건':'막힌 곳 없음'))+'</p></div>';};
  const quiet=ALL.filter(p=>!PP.includes(p)).map(p=>p.n);
  /* 기술자문 낙찰실적 */
  const adv=advisory(C),PAL=['#111a2e','#3b6ce4','#7c9be8','#9aa0ab','#c9cdd5','#e3e6ec'];
  const bars=(title,fn,brandColor)=>{const m=new Map();adv.rows.forEach(x=>{const k=fn(x)||'미지정',v=m.get(k)||{n:0,v:0};v.n++;v.v+=Number(x.attribution.bid_amount)||0;m.set(k,v);});let items=[...m].sort((a,b)=>b[1].v-a[1].v);if(items.length>5){const rest=items.slice(4).reduce((s,x)=>({n:s.n+x[1].n,v:s.v+x[1].v}),{n:0,v:0});items=items.slice(0,4).concat([['그 외',rest]]);}
   return '<div class="tb"><span>'+title+'</span><div class="db-share lg">'+items.map((x,i)=>'<span style="width:'+(adv.sum>0?x[1].v/adv.sum*100:0).toFixed(1)+'%;background:'+((brandColor&&BRC[x[0]])||PAL[i%PAL.length])+'"></span>').join('')+'</div><div class="lg2">'+items.map((x,i)=>'<div><i style="background:'+((brandColor&&BRC[x[0]])||PAL[i%PAL.length])+'"></i><span>'+h(x[0])+' <small>'+x[1].n+'건</small></span><b>'+h(won(x[1].v))+'</b></div>').join('')+'</div></div>';};
  const tech='<section class="db-card db-c3"><div class="db-ch"><b>기술자문 낙찰실적</b><span>'+(adv&&adv.merged?'협약시공사 수주 · 수주실적에 합산':'영업 계약과 별도 집계')+'</span></div>'+(adv&&adv.n?'<div class="big"><b>'+h(won(adv.sum))+'</b><span>확정 '+adv.n+'건</span></div>'+bars('원천 브랜드',x=>x.attribution.origin_business||'기술자문 직접영업',true)+bars('귀속 담당자',x=>x.attribution.performance_owner,false):'<div class="big"><b class="mut">아직 없음</b><span>'+(adv?h(P.label)+' 확정 0건':'관리자 화면에서 집계됩니다')+'</span></div>')+(R.ContractSalesUI&&R.ContractSalesUI.advisorySync&&canAssign()?'<button type="button" class="db-more btm" data-db="advisory">기술자문 낙찰실적 관리 →</button>':'')+'</section>';
  const mb=PP.filter(p=>p.made!==null).sort((a,b)=>b.made-a.made),far=mb.filter(p=>made!==null&&p.made<=made-15&&p.w+p.l>=MINCLOSED()),few=PP.filter(p=>p.w+p.l>0&&p.w+p.l<3);
  const madeNote=(far.length?'팀 평균보다 15%p 이상 낮음: '+far.map(p=>p.n).join(' · ')+' — 실주 '+far.reduce((s,p)=>s+p.l,0)+'건.':mb.length?'팀 평균보다 15%p 이상 낮은 담당자가 없습니다.':'종료된 영업이 아직 없습니다.')+(few.length?' 종료 건이 적어 아직 판단하기 이름: '+few.map(p=>p.n+'('+(p.w+p.l)+'건)').join(' · ')+'.':'');
  const madeCard='<section class="db-c3 db-card"><div class="db-q"><span>누가 따낸 영업을 계약으로 잘 마무리하나?</span><b>담당자별 메이드율 <small>배드핏 제외'+(made!==null?' · 점선 = 팀 평균 '+made.toFixed(1)+'%':'')+'</small></b></div><div class="db-mb">'+(mb.length?mb.map(p=>{const lo2=p.made<LOWMADE();return '<div><b>'+h(p.n)+'</b><span><i style="width:'+Math.max(1,p.made)+'%;background:'+(lo2?'#d14a3f':'#3b6ce4')+'"></i>'+(made!==null?'<u style="left:'+made+'%"></u>':'')+'</span><b class="'+(lo2?'red':'')+'">'+p.made.toFixed(1)+'%</b></div>';}).join(''):'<p class="db-empty">'+none+'</p>')+'</div><p class="note">'+h(madeNote)+'</p></section>';
  const BRW=brandRows(C),qmax=Math.max(1,...BRW.map(b=>b.q)),zero=BRW.filter(b=>b.fit>0&&!b.w);
  const brandCard='<section class="db-c3 db-card"><div class="db-q"><span>문의는 많은데 계약으로 안 이어지는 브랜드는?</span><b>브랜드별 문의 → 수주</b></div><div class="bfun">'+BRW.map(b=>'<div><div><i style="background:'+b.c+'"></i><b>'+h(b.name)+'</b><span class="db-sp"></span><small>문의 '+b.q+' → 적합 '+b.fit+' → 수주 '+b.w+'</small><b class="m '+(!b.w||(b.made!==null&&b.made<LOWMADE())?'red':'')+'">'+(b.w?(b.made===null?'—':b.made.toFixed(1)+'%'):'수주 없음')+'</b></div><span class="bar"><i style="width:'+(b.w/qmax*100).toFixed(1)+'%;background:'+b.c+'"></i><i style="width:'+(Math.max(0,b.fit-b.w)/qmax*100).toFixed(1)+'%;background:'+b.c+';opacity:.35"></i></span></div>').join('')+'</div><p class="note '+(zero.length?'red':'')+'">'+h(zero.length?zero.map(b=>b.name).join(' · ')+' — 적합 문의 '+zero.reduce((s,b)=>s+b.fit,0)+'건, 수주 0건. 문의는 들어오는데 계약까지 이어지지 않습니다.':'적합 문의가 있는 브랜드는 모두 수주가 나왔습니다.')+'</p></section>';
  const pend=pendingStats();
  const pending='<div class="db-pending"><b>아직 판단 못 하는 것</b><span class="mut">기록이 '+MINREC+'건 쌓이면 자동으로 보입니다</span>'+pend.map(p=>p[1]>=MINREC?'<span>'+p[0]+' <b>'+p[2]+'</b> <small>'+p[1]+'건 기준</small></span>':'<span>'+p[0]+' <i><u style="width:'+Math.min(100,p[1]*10)+'%"></u></i><b>'+p[1]+'/'+MINREC+'</b></span>').join('')+'</div>';
  return verdict+(ranked.length?'<div class="db-pcs">'+ranked.map(card).join('')+'</div>':'<p class="db-empty">진행 · 수주 기록이 있는 담당자가 없습니다.</p>')+(quiet.length?'<span class="db-quiet">진행 · 수주 기록 없음: '+h(quiet.join(' · '))+'</span>':'')+'<div class="db-row3">'+tech+madeCard+brandCard+'</div>'+matrix(C)+cohort(C)+channel(C)+pending;
 }

 function render(){
  const page=R.G.page,host=document.getElementById('si-'+page),pg=document.getElementById('pg-'+page);if(!host||!pg)return;
  pg.classList.add('si-active','db-on');
  try{if(R.CommonFilterBar)R.CommonFilterBar.mount(page);}catch(e){}
  const t=document.getElementById('ptitle'),s=document.getElementById('psub');if(t)t.textContent=HEAD[page][0];if(s)s.textContent=HEAD[page][1];document.querySelector('.mhead')?.classList.add('cf-title');
  const C=core();try{if(SI().advisoryLoad)SI().advisoryLoad();}catch(e){}
  host.innerHTML='<div class="db-shell" data-page="'+page+'">'+toolbar(page,C)+(page==='dash'?dash(C):page==='control'?ctl(C):R.PerfV3&&R.PerfV3.enabled()?R.PerfV3.html(C):perf(C))/* 성과 분석 v3(perf-v3.js) · 끄면 예전 화면 */+'</div>';
  host.onclick=onClick;host.onchange=onChange;host.onkeydown=null;
 }
 function evRows(list){return list.map(SI().evRow);}
 function assign(owner){
  if(!canAssign()||!LAST)return;const S=st(),list=owner?LAST.pick(owner,null):LAST.pick(S.selP,S.selC),ids=new Set(list.filter(it=>it.kind==='deal').map(it=>String(it.x.item.id)));
  if(!ids.size){if(list.some(it=>it.kind==='inq')){toast('문의 건은 견적문의 화면에서 배정으로 처리합니다');R.goPage('inq');}return;}
  if(!R.PipelineBatch||!R.PipelineBatch.openRows)return;
  const rows2=((R.PipelineWorkspace&&R.PipelineWorkspace.rows({}))||[]).filter(r=>r.item&&ids.has(String(r.item.id)));
  if(!rows2.length){toast('지정할 파이프라인 건을 찾지 못했습니다');return;}
  R.PipelineBatch.openRows(rows2,'next');
 }
 function notify(){
  if(!canAssign()||!LAST)return;const S=st(),list=LAST.pick(S.selP,S.selC);if(!list.length)return;const col=LAST.COLS.find(c=>c[0]===S.selC);
  const text='[컨트롤타워] '+(S.selP||'전체')+' · '+(col?col[1]:'모든 문제')+' '+list.length+'건 확인 부탁드립니다.\n'+list.slice(0,6).map(it=>'· '+it.site+' ('+it.reason+' · '+it.d+'일)').join('\n')+(list.length>6?'\n외 '+(list.length-6)+'건':'');
  const done=()=>toast('알림 문구를 복사했습니다 — 잔디에 붙여 넣어 보내세요');try{navigator.clipboard.writeText(text).then(done,done);}catch(e){done();}
 }
 function onClick(e){
  const b=e.target.closest('[data-db]');if(!b||b.tagName==='SELECT'||b.disabled)return;const a=b.dataset.db,v=b.dataset.v,S=st(),f=F(),X=SI();
  if(a==='go')return R.goPage(v);
  if(a==='quarter'){f.quarter=Number(v);f.month=0;return R.paint();}
  if(a==='sec'){S.sec=v;return render();}
  if(a==='cell'){const i=v.lastIndexOf('|');S.selP=v.slice(0,i)||null;S.selC=v.slice(i+1)||null;S.touched=true;return render();}
  if(a==='clear'){S.selP=null;S.selC=null;S.touched=true;return render();}
  if(a==='open')return X.openRecord(v);
  if(a==='person'){R.SalesScope.change('owner',v);R.SalesFilterState.sync();return R.G.page==='perf'?R.paint():R.goPage('perf');}
  if(a==='stage'){try{R.PipelineWorkspace.open(v);}catch(err){R.goPage('pipe');}return;}
  if(a==='assign')return assign(null);
  if(a==='assign-row')return assign(v);
  if(a==='notify')return notify();
  if(a==='act-ask')return askRecords();
  if(a==='cx'){S.cx=Number(v)||0;return render();}
  if(a==='dx-ask')return dxAsk(v);
  if(a==='dx-list')return cxList('diag',v);
  if(a==='cw-tile')return cxList('chg',v);
  if(a==='pri-why'){S.priOpen=S.priOpen===v?null:v;return render();}
  if(a==='advisory'){try{R.ContractSalesUI.advisorySync();}catch(err){}return;}
  const C=core(),P=C.P;
  if(a==='cs-month')return X.openEvidence(P.y+'년 '+v+'월 계약 근거','계약 체결 · 변경 · 취소 원장 기록',X.contractEvidence({month:Number(v)}));
  if(a==='inq-month'){const a0=mk(P.y,Number(v)),b0=mk(P.y,Number(v)+1),list=evRows(C.rows.inquiries.filter(x=>{const k=C.K(R.inquiryCreatedAt(x.item));return k>=a0&&k<b0;}));return X.openEvidence(P.y+'년 '+v+'월 문의 근거','접수 기준 '+list.length+'건',list);}
  if(a==='brand-ev')return X.openEvidence(v+' 계약 근거','계약 원장 기록',X.contractEvidence({brand:v}));
  if(a==='ev'){
   if(v==='contract')return X.openEvidence(P.label+' 계약 근거','계약 체결 · 변경 · 취소 원장 기록',X.contractEvidence({}));
   if(v==='active')return X.openEvidence('진행 파이프라인 · '+C.active.length+'건','현재 진행 중',C.active.map(x=>Object.assign(X.evRow(x),{reason:x.reason||'진행 중'})));
   if(v==='inquiries'){const list=evRows(C.rows.inquiries.filter(x=>C.inR(C.K(R.inquiryCreatedAt(x.item)),P.a,P.b)));return X.openEvidence('견적문의 · '+list.length+'건',P.label+' 접수 기준',list);}
   if(v==='activity'||v==='activity-all'){const list=(v==='activity'?weekActs(C).list:C.A.slice(0,60)).map(x=>({site:x.site,owner:x.owner,stageLabel:x.type,reason:x.k+(x.text?' · '+x.text:''),amt:x.amt,key:x.key}));return X.openEvidence(v==='activity'?'최근 7일 영업 기록':'최근 영업 기록',list.length+'건',list);}
  }
 }
 function onChange(e){const el=e.target;if(el.dataset&&el.dataset.db==='year'){const f=F();f.year=el.value;f.month=0;R.paint();}}
 const base=SI()&&SI().render;
 if(typeof base==='function'){
  SI().render=function(){
   const page=R.G.page;
   if(PAGES.includes(page)&&R.B&&enabled()){try{return render();}catch(err){if(R.console)R.console.warn('dash-b: '+err.message);}}
   if(PAGES.includes(page)){const pg=document.getElementById('pg-'+page);if(pg){pg.classList.remove('db-on');pg.querySelector(':scope>.cf-bar')?.remove();}}
   return base.apply(this,arguments);
  };
  const again=()=>{if(enabled()&&PAGES.includes(R.G.page)&&R.B){try{render();}catch(e){}}};
  root.addEventListener('contract-sales:changed',again);document.addEventListener('contract-sales:changed',again);
 }
 root.DashB={enabled,render,core,people,ctlModel,period,nearList,channelOf,weekActs,actKind,stageEvents,diagRows,priList,changeWeek,impact,lib:{brandRows,matrixRows,inquiryFate,pendingStats,eok,won,mk,BRC,MINREC,LOWMADE,MINCLOSED}};
})(window);
