/* 영업 대시보드 3화면 · 시각화 (2026-10-20 대표 확정 design_handoff_dashboard_visual — 예전 dashboard v3 화면 구성을 대체)
   세 화면 상단은 같다: 공통 필터줄(전체 · 브랜드 칩 · 담당자 · 검색 = CommonFilterBar) + dash-b 의 toolbar(다른 두 화면 ↗ · 기준 한 줄 · 연도 · 연간/분기 · LIVE).
   숫자는 dash-b.js 와 같은 자료 함수(core · people · ctlModel · brandRows · weekActs · stageEvents)에서 계산한다 — 이 파일은 그리기만.
     계약실적 = 계약 원장(직접 계약 · 체결일) · 기술자문 낙찰(협약 · 기술자문 낙찰금액)은 따로 적고 합치지 않는다 · 메이드율 = 결과 확정 건 기준(수주 ÷ (수주 + 실주) · 배드핏 제외)
     기록이 없는 사람 · 칸은 0 이 아니라 '기록 미확인'. 원장을 불러오는 중이면 '불러오는 중'.
   색: 브랜드 색 · 파랑(데이터) · 빨강(지연 · 개입)만. 막대 · 원은 0.24초 안에 자란다(움직임 줄이기 설정이면 멈춤 · CSS).
   끄기: G.dashVisOff=true → 예전 v3 화면 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const BLUE='#3b6ce4',BL2='#8fb0ee',BL3='#c9d6f5',GRAY='#9aa0ab',RED='#b42318';
 const on=()=>!(R.G&&R.G.dashVisOff);
 const st=()=>{const g=R.G;if(!g.dashVis)g.dashVis={who:null,stg:null,m:null,cell:null,p:null,sending:false};return g.dashVis;};
 const GROUPS=[['inq','견적문의'],['consulting','컨설팅 설계'],['sent','자료 발송'],['relationship','관계관리'],['competition','경쟁 · 입찰'],['construction','계약 · 시공'],['won','수주']];
 const pct=(a,b)=>b>0?Math.max(0,Math.min(100,a/b*100)):0;
 const head=(t,s)=>'<div class="dv-h"><b>'+h(t)+'</b>'+(s?'<span>'+h(s)+'</span>':'')+'</div>';
 const bar=(w,c,cls)=>'<span class="dv-bar'+(cls?' '+cls:'')+'"><i style="width:'+w.toFixed(1)+'%;background:'+c+'"></i></span>';
 function donut(parts,center,sub){
  const tot=parts.reduce((s,p)=>s+p[0],0);let acc=0;
  const g=tot?parts.map(p=>{const a=acc/tot*360,b=(acc+=p[0])/tot*360;return p[1]+' '+a.toFixed(1)+'deg '+b.toFixed(1)+'deg';}).join(','):'#eef0f3 0 360deg';
  return '<div class="dv-donut" style="background:conic-gradient('+g+')"><div><b>'+h(center)+'</b><span>'+h(sub)+'</span></div></div>';
 }
 const stageGroup=d=>{try{return R.PipelineStages.group(R.dealStage(d.item))||'';}catch(e){return '';}};
 const openInq=C=>C.rows.inquiries.filter(x=>{const q=x.item;try{if(R.inqCtlConverted(q))return false;if(typeof R.isClosedInq==='function'&&R.isClosedInq(q))return false;}catch(e){}return !C.B.badfit(q);});
 const nextDay=(B,k)=>B.addDays?B.addDays(k,1):k;
 /* 담당자 한 사람의 이번 달 · 기간 계약실적과 기술자문 낙찰(합치지 않음) */
 function personMoney(C,L,n,a,b){const c=C.B.contractsIn(C.L,a,b,n,'direct'),p=C.DW?C.DW.partnerIn(a,b,n):{count:0,amount:0};return {net:c.net,count:c.count,pt:p.amount,ptn:p.count};}

 /* ── 전체 현황: 활동 → 진행 → 성과 ── */
 function dash(C,X){
  const S=st(),{B,P,L,K}=C,PP=X.people(C),who=S.who&&C.names.includes(S.who)?S.who:null,ms=X.mk(P.ty,P.tm),me=X.mk(P.ty,P.tm+1),WA=X.weekActs(C),W=WA.W,inW=k=>!!k&&k>=W[0]&&k<=W[6];
  const chips='<div class="dv-people" role="group" aria-label="담당자 기준">'+[null].concat(C.names).map(n=>'<button type="button" data-dv="who" data-v="'+attr(n||'')+'" aria-pressed="'+(who===n)+'">'+h(n||'전체')+'</button>').join('')+'</div>';
  /* 큰 숫자: 이번 달 계약실적(직접 계약 · 체결일) + 목표 막대 */
  const mon=who?personMoney(C,L,who,ms,me):(()=>{const c=B.contractsIn(L,ms,me,C.target,'direct');return {net:c.net,count:c.count};})();
  const target=Number((R.OPS_RULES||{}).monthTarget)||0,heroV=!L.ready?'불러오는 중':mon.net>0?X.eok(mon.net):'0';
  const hero='<section class="dv-card dv-hero"><span class="dv-l">'+P.tm+'월 계약'+(who?' · '+h(who):'')+'</span><div class="dv-big"><b>'+h(heroV)+'</b><span>'+(L.ready?mon.count+'건':'')+'</span></div>'
   +(target>0&&!who?'<div class="dv-goal">'+bar(pct(mon.net,target),BLUE)+'<span>목표 '+h(X.eok(target))+'</span></div>':'<div class="dv-goal"><span class="dv-mut">'+(who?'담당자 목표는 따로 정하지 않음':'월 목표값 입력 후 막대 표시')+'</span></div>')+'</section>';
  /* 메이드율 도넛: 결과 확정 건 기준 */
  const pw=who?PP.find(p=>p.n===who):null,wn=pw?pw.w:C.won,ls=pw?pw.l:C.loss.length+(C.tfLost||0),made=pw?pw.made:C.made;
  const madeCard='<section class="dv-card dv-made">'+(L.ready?donut(wn+ls?[[wn,BLUE],[ls,'#d9dde4']]:[],made===null||made===undefined?'기록 미확인':made.toFixed(1)+'%','메이드율'):donut([],'불러오는 중','메이드율'))+'<div class="dv-leg"><span><i style="background:'+BLUE+'"></i>수주 '+wn+'</span><span><i style="background:#d9dde4"></i>실주 '+ls+'</span><span class="dv-mut">결과 확정 건 기준 · 배드핏 제외</span></div></section>';
  /* 올해(기간) 누적: 계약실적 · 기술자문 낙찰 따로 */
  const yr=who?personMoney(C,L,who,P.a,P.b):{net:C.con.net,count:C.con.count,pt:C.pt.amount,ptn:C.pt.count},mx=Math.max(yr.net,yr.pt,1);
  const ytd='<section class="dv-card dv-ytd"><span class="dv-l">'+h(P.thisYear?'올해 누적':P.label+' 누적')+'</span>'
   +[['계약실적',yr.net,yr.count,BLUE],['기술자문 낙찰 (별도)',yr.pt,yr.ptn,GRAY]].map(r=>'<div class="dv-ytdr"><div><span>'+r[0]+'</span><b>'+(!L.ready?'불러오는 중':r[1]>0?h(X.eok(r[1]))+' · '+r[2]+'건':'아직 없음')+'</b></div>'+bar(L.ready?pct(r[1],mx):0,r[3],'thick')+'</div>').join('')
   +'<span class="dv-mut">계약실적과 기술자문 낙찰은 합산하지 않음</span></section>';
  /* 영업 흐름 7칸 + 이번 주 들어온 수 */
  const active=C.active,inqs=openInq(C),grp={};active.forEach(d=>{const g=stageGroup(d);(grp[g]=grp[g]||[]).push(d);});
  const entered=g=>active.filter(d=>stageGroup(d)===g&&(X.stageEvents(d.item,K)||[]).some(e=>e.to===g&&inW(e.k))).length;
  const wonP=L.ready?B.contractsIn(L,P.a,P.b,C.target,'direct').count:null,wonW=L.ready?B.contractsIn(L,W[0],nextDay(B,W[6]),C.target,'direct').count:null;
  const FN=GROUPS.map(([g,l])=>g==='inq'?[g,l,inqs.length,C.AQ.filter(x=>inW(K(R.inquiryCreatedAt(x)))).length]:g==='won'?[g,l,wonP,wonW]:[g,l,(grp[g]||[]).length,entered(g)]);
  const lostW=C.AD.filter(d=>B.isLoss(d)&&inW(B.closedKey(d))).length,badW=C.AQ.filter(x=>B.badfit(x)&&inW(K(R.inquiryCreatedAt(x)))).length;
  const flow='<section class="dv-card">'+head('영업 흐름','지금 건수 · +이번 주 들어온 수 · 단계를 누르면 아래 담당자 칸이 그 단계로')+'<div class="dv-flow">'+FN.map((f,i)=>'<div class="dv-fs"><button type="button" data-dv="stg" data-v="'+f[0]+'" aria-pressed="'+(S.stg===f[0])+'"><span>'+h(f[1])+'</span><b>'+(f[2]===null?'—':f[2])+'</b><small>'+(f[3]===null?'불러오는 중':'+'+f[3]+' 이번 주')+'</small></button>'+(i<FN.length-1?'<i>›</i>':'')+'</div>').join('')+'</div><div class="dv-out"><span></span>↘ 실주 '+lostW+' · 배드핏 '+badW+' (이번 주 · 흐름 밖으로)</div></section>';
  /* 월별 계약 막대 */
  const months=[];for(let m=1;m<=12;m++){if(P.y>P.ty||(P.y===P.ty&&m>P.tm))break;const c=L.ready?B.contractsIn(L,X.mk(P.y,m),X.mk(P.y,m+1),who||C.target,'direct'):{net:0,count:0};months.push({m,net:c.net,n:c.count});}
  const mmax=Math.max(1,...months.map(x=>x.net)),sel=months.find(x=>x.m===S.m)||months[months.length-1]||null;
  const mcard='<section class="dv-card">'+head('월별 계약',(who?who+' · ':'')+'계약실적 · 막대를 누르면 그 달')+(L.ready&&months.length?'<div class="dv-cols">'+months.map(x=>'<button type="button" data-dv="m" data-v="'+x.m+'" aria-pressed="'+(sel&&sel.m===x.m)+'"><small>'+(x.net>0?h(X.eok(x.net)):'')+'</small><i style="height:'+Math.max(x.net>0?3:0,x.net/mmax*100).toFixed(1)+'%"></i><span>'+x.m+'월</span></button>').join('')+'</div><p class="dv-sel">'+(sel?'<b>'+P.y+'년 '+sel.m+'월</b> · '+(sel.net>0?h(X.won(sel.net)):'계약 없음')+' · 계약 '+sel.n+'건':'')+'</p>':'<p class="dv-mut">'+(L.ready?'이 기간 자료가 없습니다':'계약 원장을 불러오는 중')+'</p>')+'</section>';
  /* 진행 금액 단면: 단계 층 · 아래로 갈수록 계약에 가까움 */
  const LY=GROUPS.slice(0,6).map(([g,l],i)=>{const list=g==='inq'?[]:(grp[g]||[]),amt=list.reduce((s,d)=>s+(Number(d.expected)||0),0);return {g,l,amt,n:g==='inq'?inqs.length:list.length,i};}),lmax=Math.max(1,...LY.map(x=>x.amt)),LC=['#eef0f3','#dfe6f8','#c9d6f5','#a9c0f2','#7c9be8',BLUE];
  const layers='<section class="dv-card">'+head('진행 금액 단면','단계별로 잘라 본 진행 중 예상금액')+'<div class="dv-layers">'+LY.map(x=>'<div style="width:'+Math.max(30,Math.sqrt(x.amt/lmax)*100).toFixed(1)+'%;background:'+LC[x.i]+';color:'+(x.i>=4?'#fff':'#15171c')+'"><span>'+h(x.l)+' · '+x.n+'건</span><b>'+(x.g==='inq'?'금액 미정':x.amt>0?h(X.eok(x.amt)):'금액 미정')+'</b></div>').join('')+'</div><span class="dv-mut">아래로 갈수록 계약에 가까움 · 합계 '+h(X.eok(LY.reduce((s,x)=>s+x.amt,0)))+'</span></section>';
  /* 담당자 × 단계 원 + 이번 주 한 일(연결 · 방문 · 견적 발송) */
  const cnt=(n,g)=>g==='inq'?inqs.filter(x=>x.owner===n).length:g==='won'?(PP.find(p=>p.n===n)||{w:0}).w:active.filter(d=>d.owner===n&&stageGroup(d)===g).length;
  const cmax=Math.max(1,...C.names.map(n=>Math.max(...GROUPS.map(([g])=>cnt(n,g)))));
  const actOf=n=>{const r=WA.rows.find(x=>x.n===n);if(!r||!r.my.length)return null;const k={call:0,visit:0,quote:0};r.wk.forEach(x=>{const t=X.actKind(x);if(k[t]!=null)k[t]++;});return k;};
  const amax=Math.max(1,...C.names.map(n=>{const a=actOf(n);return a?Math.max(a.call,a.visit,a.quote):0;}));
  const grid='<section class="dv-card">'+head('담당자 × 단계','원 크기 = 건수 · '+(S.stg?(GROUPS.find(x=>x[0]===S.stg)||[0,''])[1]+' 강조':'단계를 누르면 강조'))+'<div class="dv-grid" style="--cols:'+GROUPS.length+'"><span></span>'+GROUPS.map(([g,l])=>'<span class="gh'+(S.stg===g?' on':'')+'">'+h(l)+'</span>').join('')+'<span class="gh">이번 주 한 일</span>'
   +C.names.map(n=>{const dim=who&&who!==n?' dim':'',a=actOf(n);return '<b class="gn'+dim+'">'+h(n)+'</b>'+GROUPS.map(([g,l])=>{const v=cnt(n,g),sz=v?Math.round(16+Math.sqrt(v/cmax)*26):0;return '<span class="gc'+dim+(S.stg&&S.stg!==g?' fade':'')+'">'+(v?'<i title="'+attr(n+' · '+l+' '+v+'건')+'" style="width:'+sz+'px;height:'+sz+'px;background:'+(S.stg===g?BLUE:GRAY)+'">'+v+'</i>':'')+'</span>';}).join('')
    +'<span class="ga'+dim+'">'+(a?'<u style="height:'+pct(a.call,amax).toFixed(0)+'%;background:'+BLUE+'"></u><u style="height:'+pct(a.visit,amax).toFixed(0)+'%;background:'+BL2+'"></u><u style="height:'+pct(a.quote,amax).toFixed(0)+'%;background:'+BL3+'"></u><small>'+a.call+' · '+a.visit+' · '+a.quote+'</small>':'<small class="dv-mut">기록 미확인</small>')+'</span>';}).join('')+'</div>'
   +'<div class="dv-leg row"><span><i style="background:'+BLUE+'"></i>연결</span><span><i style="background:'+BL2+'"></i>방문</span><span><i style="background:'+BL3+'"></i>견적 발송</span><span class="dv-mut">이번 주 기록 · 기록이 없는 사람은 \'기록 미확인\'(0 아님)</span></div></section>';
  return chips+'<div class="dv-row3">'+hero+madeCard+ytd+'</div>'+flow+'<div class="dv-row2">'+mcard+layers+'</div>'+grid;
 }

 /* ── 컨트롤타워: 어디에 개입하나 ── */
 function sentList(){const W=R.WorkRequest;if(!W||typeof W.state!=='function')return null;let ok=false;try{ok=!!W.enabled();}catch(e){}if(!ok)return null;const since=Date.now()-30*864e5;return (W.state().list||[]).filter(r=>r&&r.by_me&&r.status!=='cancelled'&&(Date.parse(r.created_at||'')||Date.now())>=since);}
 const canSend=()=>{try{const W=R.WorkRequest,O=R.OpsStore;return !!(W&&W.enabled()&&O&&O.has(W.RPC.create)&&R.todayIsAdmin&&R.todayIsAdmin());}catch(e){return false;}};
 let LASTM=null;
 function control(C,X){
  const S=st(),M=LASTM=X.ctlModel(C),{B,P}=C,un=M.colT('unasg'),fi=M.colT('first'),du=M.colT('due'),n=un+fi+du;
  const hero='<section class="dv-card dv-hero"><span class="dv-l">오늘 개입할 곳</span><div class="dv-big"><b class="'+(n?'red':'')+'">'+n+'</b><span>건</span></div><span class="dv-s">미배정 '+un+' · 첫 연락 지연 '+fi+' · 기한 지남 '+du+'</span></section>';
  const SL=sentList(),done=SL?SL.filter(r=>r.status==='done'||r.status==='replied').length:0,wait=SL?SL.filter(r=>r.status==='absent').length:0,todo=SL?SL.length-done-wait:0;
  const req='<section class="dv-card dv-made">'+(SL===null?donut([],'확인 불가','요청 처리'):donut(SL.length?[[done,BLUE],[wait,BL3],[todo,'#d9dde4']]:[],SL.length?Math.round(done/SL.length*100)+'%':'기록 미확인','요청 처리'))+'<div class="dv-leg"><span><i style="background:'+BLUE+'"></i>완료 '+done+'</span><span><i style="background:'+BL3+'"></i>고객 답 대기 '+wait+'</span><span><i style="background:#d9dde4"></i>담당 미처리 '+todo+'</span><span class="dv-mut">'+(SL===null?'요청 기록을 불러오지 못했습니다':'내가 보낸 요청 · 최근 30일')+'</span></div></section>';
  const dues=M.pick(null,'due'),AG=[['1–3일',1,3,'#f0c2c2'],['4–7일',4,7,'#e3a3a3'],['8–30일',8,30,'#d47a7a'],['30일+',31,1e9,RED]].map(a=>[a[0],dues.filter(x=>x.d>=a[1]&&x.d<=a[2]).length,a[3]]),amx=Math.max(1,...AG.map(a=>a[1]));
  const age='<section class="dv-card"><span class="dv-l">기한 지난 기간</span>'+AG.map(a=>'<div class="dv-hb"><span>'+a[0]+'</span>'+bar(pct(a[1],amx),a[2])+'<b>'+a[1]+'</b></div>').join('')+'<span class="dv-mut">다음 할 일 기한이 지난 영업건 '+dues.length+'건</span></section>';
  const sentN=SL?SL.length:null,seen=SL?SL.filter(r=>r.status!=='sent').length:null,work=SL?SL.filter(r=>r.status==='working'||r.status==='absent').length:null;
  const flow='<section class="dv-card">'+head('요청 처리 흐름',SL===null?'요청 기록을 불러오지 못했습니다':'내가 보낸 요청 · 최근 30일')+'<div class="dv-flow">'+[['보냄',sentN],['담당 확인',seen],['처리 중',work],['완료',SL?done:null]].map((f,i,a)=>'<div class="dv-fs"><div class="'+(i===3?'end':'')+'"><span>'+f[0]+'</span><b>'+(f[1]===null?'—':f[1])+'</b></div>'+(i<a.length-1?'<i>›</i>':'')+'</div>').join('')+'</div>'+(SL&&wait?'<div class="dv-out"><span></span>↘ 고객 답 대기 '+wait+' · 다시 요청하지 않음</div>':'')+'</section>';
  /* 담당자 × 문제 열지도 */
  const SEVC=['#fdecec','#f8d4d4','#f0b4b4','#e58e8e'],GRC=['#f3f4f6','#e5e7eb','#d1d5db','#9ca3af'];
  const shade=(v,sev)=>!v?'#fafbfc':(sev===3?SEVC:GRC)[Math.min(3,Math.ceil(v/Math.max(1,maxCell)*4)-1)];
  let maxCell=1;M.owners.forEach(o=>M.COLS.forEach(c=>{maxCell=Math.max(maxCell,M.n(o,c[0]));}));
  const heat='<section class="dv-card">'+head('담당자 × 문제','진할수록 건수가 많음 · 칸을 누르면 그 건 목록')+(M.owners.length?'<div class="dv-heat" style="--cols:'+M.COLS.length+'"><span></span>'+M.COLS.map(c=>'<span class="hh">'+h(c[1])+'</span>').join('')
   +M.owners.map(o=>'<b class="hn'+(o==='미배정'?' red':'')+'">'+h(o)+'</b>'+M.COLS.map(c=>{const v=M.n(o,c[0]),k=o+'|'+c[0];return '<button type="button" data-dv="cell" data-v="'+attr(k)+'" aria-pressed="'+(S.cell===k)+'" style="background:'+shade(v,c[2])+';color:'+(c[2]===3&&v?RED:'#374151')+'"'+(v?'':' disabled')+'>'+(v||'')+'</button>';}).join('')).join('')+'</div>':'<p class="dv-mut">문제 있는 건이 없습니다</p>');
  let selBox='';if(S.cell){const i=S.cell.lastIndexOf('|'),o=S.cell.slice(0,i),c=S.cell.slice(i+1),list=M.pick(o,c),col=M.COLS.find(x=>x[0]===c);if(list.length)selBox='<div class="dv-selbox"><b>'+h(o+' · '+(col?col[1]:'')+' '+list.length+'건')+'</b>'+list.slice(0,6).map(x=>'<button type="button" data-dv="open" data-v="'+attr(x.key)+'">'+h(String(x.site||'').replace(/^\s*\[[^\]]*\]\s*/,''))+' <small>'+x.d+'일</small></button>').join('')+(list.length>6?'<small class="dv-mut">외 '+(list.length-6)+'건</small>':'')+'<i></i>'+(canSend()&&o!=='미배정'?'<button type="button" class="send" data-dv="send"'+(S.sending?' disabled':'')+'>요청 보내기</button>':'<small class="dv-mut">'+(o==='미배정'?'미배정은 견적문의에서 배정':'요청은 관리자 · 팀장만')+'</small>')+'</div>';}
  /* 이번 주 처리 · 남은 일(월~금) */
  const WA=X.weekActs(C),days=WA.W.slice(0,5),dn='월화수목금',openDue=k=>C.active.filter(d=>{try{const nx=R.briefNext(d.item);return nx&&String(nx.due||'').slice(0,10)===k;}catch(e){return false;}}).length;
  const DV=days.map((k,i)=>({l:dn[i],a:WA.list.filter(x=>x.k===k).length,b:openDue(k),k})),dmx=Math.max(1,...DV.map(x=>Math.max(x.a,x.b)));
  const week='<section class="dv-card">'+head('이번 주 처리 · 남은 일','처리 = 그날 영업 기록 · 남음 = 그날 기한인데 아직 열린 다음 할 일')+'<div class="dv-pair">'+DV.map(x=>'<div title="'+attr(x.l+' 처리 '+x.a+' · 남음 '+x.b)+'"><span><i style="height:'+pct(x.a,dmx).toFixed(0)+'%;background:'+BLUE+'"></i><i style="height:'+pct(x.b,dmx).toFixed(0)+'%;background:#e3a3a3"></i></span><small>'+x.l+' '+x.a+'·'+x.b+'</small></div>').join('')+'</div><div class="dv-leg row"><span><i style="background:'+BLUE+'"></i>처리</span><span><i style="background:#e3a3a3"></i>남음</span></div></section>';
  return '<div class="dv-row3">'+hero+req+age+'</div>'+flow+heat.replace(/<\/section>$/,'')+selBox+'</section>'+week;
 }
 async function sendCell(){
  const S=st(),M=LASTM;if(!M||!S.cell||S.sending||!canSend())return;const i=S.cell.lastIndexOf('|'),o=S.cell.slice(0,i),c=S.cell.slice(i+1),col=M.COLS.find(x=>x[0]===c),list=M.pick(o,c).slice(0,20),W=R.WorkRequest,O=R.OpsStore;
  if(!list.length||o==='미배정')return;const due=new Date(),same=due.getHours()<17;if(same)due.setHours(17,0,0,0);else{due.setDate(due.getDate()+1);due.setHours(12,0,0,0);}
  S.sending=true;R.DashB.render();let ok=0,dup=0,fail=0;
  for(const x of list){const it=(x.x&&x.x.item)||{};try{await O.rpc(W.RPC.create,{target_type:x.kind==='inq'?'inquiry':'deal',target_id:String(it.id||String(x.key).replace(/^(inq|deal):/,'')),site:x.site||'',brand:it.brand||'',kind:c==='first'?'first':'follow',label:'컨트롤타워 · '+(col?col[1]:'확인'),to_scope:'user',to_name:o,asks:[x.reason||(col?col[1]:'확인')],due_at:due.toISOString(),due_label:same?'오늘 17:00':'내일 12:00',memo:'컨트롤타워 요청 — '+(col?col[1]:'')});ok++;}catch(e){if(/이미 답을 기다리는/.test(String(e&&e.message||e)))dup++;else fail++;}}
  S.sending=false;try{W.load(true);}catch(e){}if(typeof R.toast==='function')R.toast(o+'님 오늘 업무에 요청 '+ok+'건을 보냈습니다'+(dup?' · 이미 요청한 '+dup+'건 제외':'')+(fail?' · 실패 '+fail+'건':''),fail?'warn':undefined);R.DashB.render();
 }

 /* ── 성과 분석: 왜 이런 결과인가 ── */
 function perf(C,X){
  const S=st(),{B,P,L,K,AD}=C,FOLLOW=Number((R.OPS_RULES||{}).inquiryFollowDays)||7;
  const hero='<section class="dv-card dv-hero"><span class="dv-l">'+h(P.thisYear?'올해 계약실적':P.label+' 계약실적')+'</span><div class="dv-big"><b>'+h(!L.ready?'불러오는 중':C.con.net>0?X.eok(C.con.net):'0')+'</b><span>'+(L.ready?C.con.count+'건':'')+'</span></div><span class="dv-s">기술자문 낙찰(별도 · 합산 안 함) '+(C.pt.amount>0?h(X.eok(C.pt.amount))+' · '+C.pt.count+'건':'없음')+(C.tf.count?' · 타사 이관 수주 '+C.tf.count+'건 별도':'')+'</span></section>';
  /* 깔때기는 같은 문의 집단만 따라간다(기간 안 접수 문의 → 적합 → 연결된 영업건에 견적 기록 → 계약) — 다른 집단을 섞으면 칸이 거꾸로 넓어진다 */
  const fitQ=C.q.filter(x=>!B.badfit(x)),dealOf=x=>{try{return R.linkedDeal(x);}catch(e){return null;}},quoted=fitQ.filter(x=>{const d=dealOf(x);if(!d)return false;try{return B.quoteIn(d,'0000-01-01','9999-12-31');}catch(e){return false;}}).length,wonQ=L.ready?fitQ.filter(x=>{try{return X.inquiryFate(C,x)==='won';}catch(e){return false;}}).length:null;
  const F=[['문의',C.q.length],['적합',fitQ.length],['견적 발송',quoted],['계약',wonQ]],FC=['#eef0f3',BL3,'#7c9be8',BLUE],fmx=Math.max(1,C.q.length);
  const fun='<section class="dv-card"><span class="dv-l">문의 → 계약</span><div class="dv-fun">'+F.map((f,i)=>'<div style="width:'+Math.max(34,Math.sqrt((f[1]||0)/fmx)*100).toFixed(1)+'%;background:'+FC[i]+';color:'+(i>=2?'#fff':'#15171c')+'"><span>'+f[0]+'</span><b>'+(f[1]===null?'—':f[1])+'</b></div>').join('')+'</div><span class="dv-mut">'+h(P.label)+' 접수 문의 집단만 따라감 · 견적 발송 = 연결된 영업건의 견적 기록 · 계약 = 그 문의가 계약까지(브리핑 · 리포트와 같은 판정)</span></section>';
  const LR=B.tally(C.loss,B.lossReason).slice(0,5),lmx=Math.max(1,...LR.map(x=>x[1]));
  const lost='<section class="dv-card"><span class="dv-l">실주 원인</span>'+(LR.length?LR.map(x=>'<div class="dv-hb"><span title="'+attr(x[0])+'">'+h(x[0])+'</span>'+bar(pct(x[1],lmx),x[0]==='사유 미기록'?'#d9dde4':GRAY)+'<b>'+x[1]+'</b></div>').join(''):'<p class="dv-mut">'+h(P.label)+' 실주가 없습니다</p>')+'</section>';
  /* 수주 · 실주 흐름 비교: 평균 일수(문의 → 방문 · 견적 · 견적 뒤 첫 후속 · 결과) */
  const contacts=d=>{let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}return [...(d.activities||[]),...(p.activities||[])].map(x=>({k:K(x.at||x.occurred_at||''),t:String(x.type||''),n:String(x.note||'')})).filter(x=>x.k&&/전화|통화|방문|문자|카카오|메일|미팅/.test(x.t)&&!/전화 시도/.test(x.n)).sort((a,b)=>a.k.localeCompare(b.k));};
  const span=(a,b)=>a&&b?Math.max(0,B.between(a,b)):null,avg=l=>{const v=l.filter(x=>x!=null);return v.length?Math.round(v.reduce((s,x)=>s+x,0)/v.length):null;};
  const pathOf=(list,closeK)=>{const rows=list.map(d=>{const c0=K(d.created||d.created_at||''),cs=contacts(d),ev=X.stageEvents(d,K)||[],sent=(ev.find(e=>e.to==='sent')||{}).k,visit=(cs.find(x=>/방문|미팅|실측/.test(x.t))||{}).k,after=sent?(cs.find(x=>x.k>sent)||{}).k:null;return {visit:span(c0,visit),sent:span(c0,sent),gap:span(sent,after),close:span(c0,closeK(d))};});return {n:list.length,visit:avg(rows.map(r=>r.visit)),sent:avg(rows.map(r=>r.sent)),gap:avg(rows.map(r=>r.gap)),close:avg(rows.map(r=>r.close))};};
  const wonD=C.deals.filter(r=>r.won&&C.inR(K(r.wonAt||''),P.a,P.b)).map(r=>r.item),WP=pathOf(wonD,d=>K(R.wonDate(d)||'')),LP=pathOf(C.loss,d=>B.closedKey(d));
  const steps=(p,lost)=>{const s=['문의'];if(p.visit!=null)s.push(p.visit+'일 방문');if(p.sent!=null)s.push(p.sent+'일 견적');if(p.gap!=null)s.push('견적 뒤 '+p.gap+'일 첫 후속');s.push((p.close!=null?p.close+'일 ':'')+(lost?'실주':'수주'));return s;};
  const badGap=LP.gap!=null&&(LP.gap>FOLLOW||(WP.gap!=null&&LP.gap>WP.gap));
  const path='<section class="dv-card">'+head('수주까지 걸린 흐름','평균 일수 · 수주 / 실주 비교 · '+h(P.label)+' 결과 난 건')+[['수주',WP,false],['실주',LP,true]].map(([l,p,lo])=>'<div class="dv-path"><b class="'+(lo?'':'blue')+'">'+l+' <small>'+p.n+'건</small></b>'+(p.n?steps(p,lo).map((t,i,a)=>'<span class="'+(lo&&badGap&&/첫 후속/.test(t)?'bad':'')+'">'+h(t)+'</span>'+(i<a.length-1?'<i>›</i>':'')).join(''):'<span class="dv-mut">기록 미확인</span>')+(p.n&&p.n<3?'<small class="dv-mut">표본 적음 · 판단 보류</small>':'')+'</div>').join('')+(badGap?'<span class="dv-mut">실주 쪽 견적 뒤 첫 후속이 '+LP.gap+'일 — 기준 '+FOLLOW+'일보다 깁니다</span>':'')+'</section>';
  /* 담당자 산점도: 위아래 = 메이드율 · 원 크기 = 계약실적 */
  const PP=X.people(C).map(p=>Object.assign({},p,{con:L.ready?B.contractsIn(L,P.a,P.b,p.n,'direct').net:0})),plot=PP.filter(p=>p.made!==null&&p.made!==undefined),rest=PP.filter(p=>!(p.made!==null&&p.made!==undefined)).map(p=>p.n),cmx=Math.max(1,...plot.map(p=>p.con));
  const cur=plot.find(p=>p.n===S.p)||plot.slice().sort((a,b)=>b.con-a.con)[0]||null;
  const sc='<section class="dv-card">'+head('담당자 · 메이드율 × 실적','원 크기 = 계약실적 · 누르면 상세')+(plot.length?'<div class="dv-scatter"><span class="y1">100%</span><span class="y0">0%</span><span class="mid"></span>'+plot.map((p,i)=>{const r=Math.round(20+Math.sqrt(p.con/cmx)*30);return '<button type="button" data-dv="p" data-v="'+attr(p.n)+'" aria-pressed="'+(cur&&cur.n===p.n)+'" title="'+attr(p.n+' · 메이드율 '+p.made.toFixed(1)+'%')+'" style="left:'+((i+0.5)/plot.length*100).toFixed(1)+'%;bottom:'+p.made.toFixed(1)+'%;width:'+r+'px;height:'+r+'px;background:'+(p.made<50?GRAY:BLUE)+'">'+h(p.n.slice(-2))+'</button>';}).join('')+'</div>'+(cur?'<p class="dv-sel"><b>'+h(cur.n)+'</b> · 메이드율 '+cur.made.toFixed(1)+'% ('+cur.w+' / '+(cur.w+cur.l)+') · 계약실적 '+(cur.con>0?h(X.eok(cur.con)):'아직 없음')+'</p>':''):'<p class="dv-mut">결과가 확정된 담당자가 아직 없습니다</p>')+(rest.length?'<span class="dv-mut">결과 확정 전(기록 미확인): '+h(rest.join(' · '))+'</span>':'')+'</section>';
  const BRW=X.brandRows(C),bq=Math.max(1,...BRW.map(b=>b.q));
  const br='<section class="dv-card">'+head('브랜드별 문의 → 수주',P.label)+BRW.map(b=>'<div class="dv-br"><div><span><i style="background:'+b.c+'"></i>'+h(b.name)+'</span><b>'+(b.q?(Math.round(b.w/b.q*1000)/10)+'%':'문의 없음')+'</b></div><span class="dv-bar thick"><i class="q" style="width:'+pct(b.q,bq).toFixed(1)+'%"></i><i style="width:'+pct(b.w,bq).toFixed(1)+'%;background:'+b.c+'"></i></span><small>문의 '+b.q+' · 수주 '+b.w+'</small></div>').join('')+'</section>';
  return '<div class="dv-row3">'+hero+fun+lost+'</div>'+path+'<div class="dv-row2">'+sc+br+'</div>';
 }
 function html(page,C,X){return '<div class="dv" data-page="'+page+'">'+(page==='dash'?dash(C,X):page==='control'?control(C,X):perf(C,X))+'</div>';}
 /* 누름: 처리했으면 true(dash-b 의 클릭 처리로 넘기지 않음) */
 function onClick(e){
  const b=e.target.closest('[data-dv]');if(!b||b.disabled)return false;const S=st(),a=b.dataset.dv,v=b.dataset.v;
  if(a==='who'){S.who=v||null;S.m=null;}else if(a==='stg'){S.stg=S.stg===v?null:v;}else if(a==='m'){S.m=Number(v)||null;}else if(a==='cell'){S.cell=S.cell===v?null:v;}else if(a==='p'){S.p=v;}
  else if(a==='open'){try{R.SalesInsights.openRecord(v);}catch(err){}return true;}else if(a==='send'){sendCell();return true;}else return false;
  try{R.DashB.render();}catch(err){}return true;
 }
 root.DashVisual={on,html,onClick,state:st};
})(window);
