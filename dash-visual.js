/* 영업 대시보드 3화면 · 시각화 (2026-10-20 대표 확정 design_handoff_dashboard_visual + 같은 날 대표 '세 화면 정보 구성 · 집계 기준' 정리안)
   세 화면이 답하는 질문을 나눈다(같은 자료 · 다른 질문):
     전체 현황 = 직원들이 지금 어떻게 영업하고 있나 — 핵심 실적 · 담당자별 '이번 주 활동 → 영업 진척 → 보유 파이프라인 → 이번 달 계약' 한 줄 · 주요 진행 요약
     컨트롤타워 = 어디에 개입하고 무엇을 처리하나 — 처리 대상(문제 → 근거 → 담당 → 요청 상태) · 담당자별 부담 · 대기와 미처리 구분 · 요청 추적 · 기록 확인 분리 · 관리자 판단
     성과 분석 = 성과가 어디서 나왔고 어떤 차이가 있나 — 계약실적 추이 · 담당자 비교(분자/분모) · 활동 → 결과 · 문의 전환 · 사유(확인/미확인) · 브랜드 · 유입경로 · 단계 소요
   세 화면 상단은 같다(공통 필터줄 + dash-b toolbar). 숫자는 dash-b.js 와 같은 자료 함수에서 — 이 파일은 그리기 · 나누기만.
   공통 기준: 계약실적 = 계약 원장(체결일 · 확정 공사금액 · 귀속자) · 기술자문 낙찰은 따로(합치지 않음) · 메이드율 = 화면에 산식을 그대로 적음(산식 변경 없음)
     활동 = 실제 활동자 기준(기록의 actor — 없으면 '활동자 미확인', 영업건 담당으로 넘겨짚지 않음) · '이번 주' = 월~일(날짜를 적음) · 활동 횟수 / 현장 수 / 영업건 수 / 계약 수를 섞지 않음
     0 · 불러오는 중 · 확인 불가 · 기록 미확인 · 대상 없음을 구분 · 같은 숫자를 누르면 같은 조건의 근거 목록(기존 근거 창)
   색: 브랜드 · 파랑 · 빨강만. 막대 · 원은 0.24초 안에 자람(움직임 줄이기 설정이면 멈춤). 끄기: G.dashVisOff=true → 예전 v3 화면 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const BLUE='#3b6ce4',BL2='#8fb0ee',BL3='#c9d6f5',GRAY='#9aa0ab',RED='#b42318',PER=20;
 const on=()=>!(R.G&&R.G.dashVisOff);
 const st=()=>{const g=R.G;if(!g.dashVis)g.dashVis={who:null,stg:null,m:null,cell:null,sum:1,tg:1,sending:false};return g.dashVis;};
 const GROUPS=[['inq','견적문의'],['consulting','컨설팅 설계'],['sent','자료 발송'],['relationship','관계관리'],['competition','경쟁 · 입찰'],['construction','계약 · 시공'],['won','수주']];
 const GL=Object.fromEntries(GROUPS);
 const pct=(a,b)=>b>0?Math.max(0,Math.min(100,a/b*100)):0;
 const head=(t,s)=>'<div class="dv-h"><b>'+h(t)+'</b>'+(s?'<span>'+h(s)+'</span>':'')+'</div>';
 const bar=(w,c,cls)=>'<span class="dv-bar'+(cls?' '+cls:'')+'"><i style="width:'+w.toFixed(1)+'%;background:'+c+'"></i></span>';
 const ev=(v,inner,extra)=>'<button type="button" class="dv-ev" data-db="'+(extra||'ev')+'" data-v="'+attr(v)+'" title="근거 목록">'+inner+'</button>';
 const site=s=>String(s||'현장명 미입력').replace(/^\s*\[[^\]]*\]\s*/,'');
 const pager=(n,page,act)=>{const pages=Math.ceil(n/PER);if(pages<=1)return '';let o='<div class="dv-pg">';for(let i=1;i<=Math.min(pages,9);i++)o+='<button type="button" data-dv="'+act+'" data-v="'+i+'" aria-pressed="'+(i===page)+'">'+i+'</button>';return o+'</div>';};
 function donut(parts,center,sub){
  const tot=parts.reduce((s,p)=>s+p[0],0);let acc=0;
  const g=tot?parts.map(p=>{const a=acc/tot*360,b=(acc+=p[0])/tot*360;return p[1]+' '+a.toFixed(1)+'deg '+b.toFixed(1)+'deg';}).join(','):'#eef0f3 0 360deg';
  return '<div class="dv-donut" style="background:conic-gradient('+g+')"><div><b>'+h(center)+'</b><span>'+h(sub)+'</span></div></div>';
 }
 const stageGroup=d=>{try{return R.PipelineStages.group(R.dealStage(d.item))||'';}catch(e){return '';}};
 const openInq=C=>C.rows.inquiries.filter(x=>{const q=x.item;try{if(R.inqCtlConverted(q))return false;if(typeof R.isClosedInq==='function'&&R.isClosedInq(q))return false;}catch(e){}return !C.B.badfit(q);});
 const nextDay=(B,k)=>B.addDays?B.addDays(k,1):k;
 const md=k=>Number(String(k).slice(5,7))+'.'+Number(String(k).slice(8,10));
 /* 이번 주(월~일) 기록 — 실제 활동자 기준. 같은 기록은 한 번(PC · 모바일 같은 id) */
 function weekRecords(C,X,W){
  const out=[],seen=new Set(),inW=k=>!!k&&k>=W[0]&&k<=W[6];
  C.deals.forEach(d=>{let p={};try{p=R.itemPatch(d.item,'deal')||{};}catch(e){}[...(d.item.activities||[]),...(p.activities||[])].forEach(x=>{if(!x)return;const at=x.at||x.occurred_at||x.created_at,k=C.K(at||'');if(!inW(k))return;const id=d.key+':'+(x.id||at+'|'+(x.note||''));if(seen.has(id))return;seen.add(id);if(/단계전환|상태변경|배정|예약|체크|데이터정리/.test(String(x.type||'')))return;
   const kind=X.actKind({type:x.type,text:x.note||x.result||''}),rawA=String(x.actor||x.actor_name||x.user_name||x.created_by_name||x.recorded_by||'').trim(),actor=rawA?(R.repN?R.repN(rawA):rawA):'';out.push({k,at:String(at),actor:actor||'',kind,d,site:d.site,key:d.key});});});
  return out.sort((a,b)=>b.at.localeCompare(a.at));
 }
 /* 이번 주 영업 진척(영업건 담당 기준 · 근거 있는 것만): 자료 발송 · 경쟁 · 입찰 · 계약 · 시공 진입 = 그 주에 그 영업건 기록이 있거나 단계 날짜가 그 주 / 계약 = 원장 체결 */
 function weekProgress(C,X,W,recs){
  const inW=k=>!!k&&k>=W[0]&&k<=W[6],hasRec=new Set(recs.map(r=>r.key)),out=[];
  C.deals.forEach(d=>{const evs=(X.stageEvents(d.item,C.K)||[]).filter(e=>inW(e.k)&&['sent','competition','construction'].includes(e.to));if(!evs.length)return;
   let cx={};try{cx=d.item.stage_contexts||(R.itemPatch(d.item,'deal')||{}).stage_contexts||{};}catch(e){}
   const dated=Object.keys(cx).some(s=>{const f=cx[s]&&cx[s].fields||{};return Object.keys(f).some(k=>/date|_at$/.test(k)&&inW(C.K(String(f[k]||''))));});
   if(!hasRec.has(d.key)&&!dated)return;const last=evs[evs.length-1];out.push({owner:d.owner,to:last.to,d,key:d.key,site:d.site});});
  return out;
 }
 function signedIn(C,a,b,owner){const out=[];(C.L.rows||[]).forEach(r=>{if(r.advisory_id)return;const o=String(r.sales_owner_name||'');if(owner&&o!==owner)return;(r.events||[]).forEach(e=>{if(e.kind==='signed'&&e.effective_date>=a&&e.effective_date<b)out.push({owner:o,deal:r.deal_id,amt:Number(e.amount_delta)||0});});});return out;}

 /* ── 전체 현황 ── */
 function dash(C,X){
  const S=st(),{B,P,L,K}=C,PP=X.people(C),who=S.who&&C.names.includes(S.who)?S.who:null,ms=X.mk(P.ty,P.tm),me=X.mk(P.ty,P.tm+1),W=X.weekActs(C).W,wl=md(W[0])+'–'+md(W[6]);
  const chips='<div class="dv-people" role="group" aria-label="담당자 기준"><span class="dv-mut">큰 숫자 · 도넛 기준</span>'+[null].concat(C.names).map(n=>'<button type="button" data-dv="who" data-v="'+attr(n||'')+'" aria-pressed="'+(who===n)+'">'+h(n||'전체')+'</button>').join('')+'</div>';
  /* 2026-10-29 대표 "기술자문이랑 합친 실적": 큰 숫자 = 매출(계약실적 + 기술자문 낙찰 확정분 + 인정된 타사 이관) — 구성은 아래 줄에. 끄기 G.advMergeOff = 예전(계약실적만) */
  const MERGE=!(R.G&&R.G.advMergeOff),mon0=B.contractsIn(L,ms,me,who||C.target,'direct'),mpt=MERGE&&C.DW?C.DW.partnerIn(ms,me,who||C.target):{count:0,amount:0},mtf=MERGE&&C.DT?C.DT.wonIn(ms,me,who||C.target):{count:0,amount:0},mon={net:mon0.net+mpt.amount+mtf.amount,count:mon0.count},target=Number((R.OPS_RULES||{}).monthTarget)||0;
  const hero='<section class="dv-card dv-hero"><span class="dv-l">'+P.tm+'월 '+(MERGE?'매출 실적':'계약실적')+(who?' · '+h(who):'')+'</span><div class="dv-big">'+(L.ready?ev(String(P.tm),'<b>'+h(mon.net>0?X.eok(mon.net):'0')+'</b><span>계약 '+mon0.count+'건'+(mpt.count?' · 기술자문 '+mpt.count+'건':'')+(mtf.count?' · 타사 이관 '+mtf.count+'건':'')+'</span>','cs-month'):'<b class="mut">불러오는 중</b>')+'</div>'
   +(target>0&&!who?'<div class="dv-goal">'+bar(pct(mon.net,target),BLUE)+'<span>목표 '+h(X.eok(target))+'</span></div>':'<div class="dv-goal"><span class="dv-mut">'+(who?'담당자 목표는 따로 정하지 않음':'월 목표값 입력 후 막대 표시')+' · '+(MERGE?'계약 체결일 · 기술자문 낙찰확정일 기준':'계약 원장 체결일 기준')+'</span></div>')+'</section>';
  const pw=who?PP.find(p=>p.n===who):null,wn=pw?pw.w:C.won,ls=pw?pw.l:C.loss.length+(C.tfLost||0),made=pw?pw.made:C.made;
  const fx=pw?'수주 '+wn+' ÷ (수주 '+wn+' + 실주 '+ls+')':(C.pt.count||C.tf.count?'(계약 '+C.con.count+' + 협약 · 기술자문 '+C.pt.count+' + 타사 이관 '+C.tf.count+') ÷ (그 수주 + 실주 '+ls+')':'수주 '+C.con.count+' ÷ (수주 '+C.con.count+' + 실주 '+ls+')');
  const madeCard='<section class="dv-card dv-made">'+(L.ready?donut(wn+ls?[[wn,BLUE],[ls,'#d9dde4']]:[],made==null?'대상 없음':made.toFixed(1)+'%','메이드율'):donut([],'불러오는 중','메이드율'))+'<div class="dv-leg"><span><i style="background:'+BLUE+'"></i>수주 '+wn+'</span><span><i style="background:#d9dde4"></i>실주 '+ls+'</span><span class="dv-mut">'+h(fx)+' · 결과 확정 건 · 배드핏 제외 · '+h(P.label)+'</span></div></section>';
  const yr=who?(()=>{const c=B.contractsIn(L,P.a,P.b,who,'direct'),p=C.DW?C.DW.partnerIn(P.a,P.b,who):{count:0,amount:0},t=C.DT?C.DT.wonIn(P.a,P.b,who):{count:0,amount:0};return {net:c.net,count:c.count,pt:p.amount,ptn:p.count,tf:t.amount,tfn:t.count};})():{net:C.con.net,count:C.con.count,pt:C.pt.amount,ptn:C.pt.count,tf:C.tf.amount,tfn:C.tf.count};
  const ysum=yr.net+yr.pt+(yr.tf||0),mx=MERGE?Math.max(ysum,1):Math.max(yr.net,yr.pt,1);
  const yrows=MERGE?[['매출 합계',ysum,yr.count+yr.ptn+(yr.tfn||0),'#15171c','contract'],['계약실적',yr.net,yr.count,BLUE,'contract'],['기술자문 낙찰',yr.pt,yr.ptn,GRAY,'tech']].concat(yr.tf>0?[['타사 이관',yr.tf,yr.tfn,GRAY,'contract']]:[]):[['계약실적',yr.net,yr.count,BLUE,'contract'],['기술자문 낙찰 (별도)',yr.pt,yr.ptn,GRAY,'tech']];
  const ytd='<section class="dv-card dv-ytd"><span class="dv-l">'+h(P.thisYear?'올해 누적':P.label+' 누적')+'</span>'
   +yrows.map(r=>'<div class="dv-ytdr"><div><span>'+r[0]+'</span>'+(!L.ready?'<b class="mut">불러오는 중</b>':r[1]>0?ev(r[4],'<b>'+h(X.eok(r[1]))+' · '+r[2]+'건</b>'):'<b class="mut">아직 없음</b>')+'</div>'+bar(L.ready?pct(r[1],mx):0,r[3],'thick')+'</div>').join('')
   +'<span class="dv-mut">'+(MERGE?'매출 = 계약실적(원장 · 체결일) + 기술자문 낙찰(확정분 · 낙찰확정일 · VAT 별도) · 같은 계약은 한 번만':'계약실적(원장 · 체결일)과 기술자문 낙찰(낙찰금액)은 합산하지 않음')+'</span></section>';
  /* 영업 흐름: 지금 보유 + 이번 주 이동(근거 있는 진척만) */
  const recs=weekRecords(C,X,W),prog=weekProgress(C,X,W,recs),active=C.active,inqs=openInq(C),grp={};active.forEach(d=>{const g=stageGroup(d);(grp[g]=grp[g]||[]).push(d);});
  const signedW=L.ready?signedIn(C,W[0],nextDay(B,W[6])):null,inW=k=>!!k&&k>=W[0]&&k<=W[6];
  const FN=GROUPS.map(([g,l])=>g==='inq'?[g,l,inqs.length,C.AQ.filter(x=>inW(K(R.inquiryCreatedAt(x)))).length,'접수']:g==='won'?[g,l,L.ready?C.con.count:null,signedW?signedW.length:null,'계약']:[g,l,(grp[g]||[]).length,['sent','competition','construction'].includes(g)?prog.filter(p=>p.to===g).length:null,'진입']);
  const lostW=C.AD.filter(d=>B.isLoss(d)&&inW(B.closedKey(d))).length;
  const flow='<section class="dv-card">'+head('영업 흐름','큰 숫자 = 지금 보유 · 아래 = 이번 주('+wl+') 이동 · 진입은 기록 · 단계 날짜로 확인된 것만')+'<div class="dv-flow">'+FN.map((f,i)=>'<div class="dv-fs"><button type="button" data-dv="stg" data-v="'+f[0]+'" aria-pressed="'+(S.stg===f[0])+'"><span>'+h(f[1])+'</span><b>'+(f[2]===null?'—':f[2])+'</b><small>'+(f[3]===null?(f[0]==='won'?'불러오는 중':'—'):'+'+f[3]+' '+f[4])+'</small></button>'+(i<FN.length-1?'<i>›</i>':'')+'</div>').join('')+'</div><div class="dv-out"><span></span>↘ 이번 주 실주 '+lostW+'건 (흐름 밖으로)</div></section>';
  /* 담당자별 이번 주: 활동 → 진척 → 보유 → 이번 달 계약 */
  const mons=L.ready?signedIn(C,ms,me):[];
  const rows=C.names.map(n=>{const mine=recs.filter(r=>r.actor===n),k={call:0,visit:0,quote:0};mine.forEach(r=>{if(k[r.kind]!=null)k[r.kind]++;});const pg=prog.filter(p=>p.owner===n),hold=active.filter(d=>d.owner===n),hg={};hold.forEach(d=>{const g=stageGroup(d);hg[g]=(hg[g]||0)+1;});const top=Object.entries(hg).sort((a,b)=>b[1]-a[1]).slice(0,2);const mm=mons.filter(x=>x.owner===n);return {n,k,any:mine.length,pg,hold:hold.length,hg,top,mn:mm.length,ma:mm.reduce((s,x)=>s+x.amt,0)};});
  const amax=Math.max(1,...rows.map(r=>Math.max(r.k.call,r.k.visit,r.k.quote))),noActor=recs.filter(r=>!r.actor).length;
  const PG={sent:'견적 진행',competition:'입찰 · 경쟁 진입',construction:'계약 · 시공 진입'};
  const people='<section class="dv-card">'+head('담당자별 이번 주','활동('+wl+' · 실제 활동자) → 영업 진척(근거 있는 단계 진입) → 보유 파이프라인(지금) → '+P.tm+'월 계약')+'<div class="dv-ptab"><span class="ph">담당</span><span class="ph">이번 주 활동 · 연결 · 방문 · 견적 발송</span><span class="ph">영업 진척</span><span class="ph">보유 파이프라인</span><span class="ph">'+P.tm+'월 계약</span>'
   +rows.map(r=>{const dim=who&&who!==r.n?' dim':'';const pgT=r.pg.length?Object.entries(r.pg.reduce((m,p)=>{m[p.to]=(m[p.to]||0)+1;return m;},{})).map(([g,c])=>PG[g]+' '+c).join(' · '):'';return '<b class="pn'+dim+'">'+h(r.n)+'</b><span class="pa'+dim+'">'+(r.any||r.k.call+r.k.visit+r.k.quote?'<span class="pb"><u style="height:'+pct(r.k.call,amax).toFixed(0)+'%;background:'+BLUE+'"></u><u style="height:'+pct(r.k.visit,amax).toFixed(0)+'%;background:'+BL2+'"></u><u style="height:'+pct(r.k.quote,amax).toFixed(0)+'%;background:'+BL3+'"></u></span><small>연결 '+r.k.call+' · 방문 '+r.k.visit+' · 견적 '+r.k.quote+'</small>':'<small class="dv-mut">기록 미확인</small>')+'</span><span class="pp'+dim+'">'+(pgT?h(pgT):'<small class="dv-mut">확인된 진척 없음</small>')+'</span><span class="ph2'+dim+'">'+(S.stg&&S.stg!=='inq'&&S.stg!=='won'?h(GL[S.stg])+' '+(r.hg[S.stg]||0)+'건 <small>전체 '+r.hold+'건</small>':r.hold?r.hold+'건 <small>'+h(r.top.map(([g,c])=>(GL[g]||g)+' '+c).join(' · '))+'</small>':'<small class="dv-mut">보유 없음</small>')+'</span><span class="pm'+dim+'">'+(!L.ready?'<small class="dv-mut">불러오는 중</small>':r.mn?r.mn+'건 · '+h(X.eok(r.ma)):'<small class="dv-mut">없음</small>')+'</span>';}).join('')+'</div>'
   +'<div class="dv-leg row"><span><i style="background:'+BLUE+'"></i>고객 실제 연결</span><span><i style="background:'+BL2+'"></i>방문</span><span><i style="background:'+BL3+'"></i>견적 발송</span><span class="dv-mut">내부 메모 · 정보 수정 · 연락 시도는 활동 수에 넣지 않음 · 기록이 없으면 \'기록 미확인\'(미수행 아님)'+(noActor?' · 활동자 미확인 기록 '+noActor+'건은 사람에 넣지 않음':'')+'</span></div></section>';
  /* 주요 진행 내용 요약: 담당 · 현장 · 이번에 한 일 · 확인된 결과 (원문 · 평가 문장 없음) */
  const did={call:'고객 연결',visit:'방문',quote:'견적 발송'},res=key=>{const p=prog.find(x=>x.key===key);if(p)return PG[p.to];return '';};
  const items=recs.filter(r=>did[r.kind]),seenK=new Set(),uniq=items.filter(r=>{const k=r.actor+'|'+r.key+'|'+r.kind;if(seenK.has(k))return false;seenK.add(k);return true;}),page=Math.min(S.sum||1,Math.max(1,Math.ceil(uniq.length/PER)));
  const summary='<section class="dv-card">'+head('주요 진행 내용','이번 주('+wl+') · 담당 · 현장 · 한 일 · 확인된 결과 · 같은 현장 같은 일은 한 줄')+(uniq.length?'<div class="dv-sum">'+uniq.slice((page-1)*PER,page*PER).map(r=>'<button type="button" data-dv="open" data-v="'+attr(r.key)+'"><b>'+h(r.actor||'활동자 미확인')+'</b><span>'+h(site(r.site))+'</span><em>'+did[r.kind]+'</em><small>'+h(res(r.key)||'—')+'</small><u>'+md(r.k)+'</u></button>').join('')+'</div>'+pager(uniq.length,page,'sum'):'<p class="dv-mut">이번 주 고객 연결 · 방문 · 견적 발송 기록이 없습니다(기록 미확인)</p>')+'</section>';
  /* 진행 금액 단면 */
  const LY=GROUPS.slice(1,6).map(([g,l],i)=>{const list=grp[g]||[],amt=list.reduce((s,d)=>s+(Number(d.expected)||0),0);return {l,amt,n:list.length,i};}),lmax=Math.max(1,...LY.map(x=>x.amt)),LC=['#dfe6f8','#c9d6f5','#a9c0f2','#7c9be8',BLUE];
  const layers='<section class="dv-card">'+head('진행 금액 단면','지금 보유 · 단계별 예상금액')+'<div class="dv-layers">'+LY.map(x=>'<div style="width:'+Math.max(34,Math.sqrt(x.amt/lmax)*100).toFixed(1)+'%;background:'+LC[x.i]+';color:'+(x.i>=3?'#fff':'#15171c')+'"><span>'+h(x.l)+' · '+x.n+'건</span><b>'+(x.amt>0?h(X.eok(x.amt)):'금액 미정')+'</b></div>').join('')+'</div><span class="dv-mut">아래로 갈수록 계약에 가까움 · 합계 '+h(X.eok(LY.reduce((s,x)=>s+x.amt,0)))+' · 예상금액(계약실적 아님)</span></section>';
  return chips+'<div class="dv-row3">'+hero+madeCard+ytd+'</div>'+flow+people+'<div class="dv-row2">'+summary+layers+'</div>';
 }

 /* ── 컨트롤타워 ── */
 const RQS=[['sent','미확인'],['seen','확인 후 미착수'],['working','진행'],['absent','회신 대기'],['done','완료'],['cancelled','취소']];
 function sentList(){const W=R.WorkRequest;if(!W||typeof W.state!=='function')return null;let ok=false;try{ok=!!W.enabled();}catch(e){}if(!ok)return null;const since=Date.now()-30*864e5;return (W.state().list||[]).filter(r=>r&&r.by_me&&(Date.parse(r.created_at||'')||Date.now())>=since).map(r=>Object.assign({},r,{st:r.status==='replied'?'done':r.status}));}
 const canSend=()=>{try{const W=R.WorkRequest,O=R.OpsStore;return !!(W&&W.enabled()&&O&&O.has(W.RPC.create)&&R.todayIsAdmin&&R.todayIsAdmin());}catch(e){return false;}};
 const reqLabel=r=>{if(!r)return '';const l=(RQS.find(x=>x[0]===r.st)||[0,r.st])[1],late=!['done','cancelled'].includes(r.st)&&Date.parse(r.due_at||'')<Date.now();return l+(late?' · 기한 초과':'');};
 let LASTM=null,LASTT=null;
 function control(C,X){
  const S=st(),M=LASTM=X.ctlModel(C),{B,P}=C,SL=sentList(),reqOf=key=>{if(!SL)return null;const id=String(key).replace(/^(inq|deal):/,'');return SL.filter(r=>String(r.target_id)===id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))[0]||null;};
  /* 처리할 대상: 미배정 · 첫 연락 지연 · 기한 초과 + 제출 · 계약 마감 3일 안 — 영업건 하나는 한 줄(문제가 여럿이면 함께 적음) */
  const map=new Map(),add=(key,o)=>{const v=map.get(key);if(v){v.probs.push(o.prob);v.d=Math.max(v.d,o.d||0);}else map.set(key,Object.assign({probs:[o.prob]},o));};
  [['unasg','미배정','배정'],['first','첫 연락 지연','첫 연락'],['due','기한 초과','결과 기록 · 다음 일정']].forEach(([c,lab,act])=>M.pick(null,c).forEach(x=>add(x.key,{key:x.key,site:x.site,owner:x.owner,prob:lab,why:x.reason+(x.d?' · '+x.d+'일':''),act,d:x.d,kind:x.kind,x:x.x,col:c})));
  X.nearList(C).filter(n=>n.dd!==null&&n.dd>=0&&n.dd<=3).forEach(n=>{const row=C.deals.find(r=>r.item===n.d);if(row)add(row.key,{key:row.key,site:row.site,owner:row.owner,prob:'마감 임박',why:n.due+(n.dd===0?' · 오늘':' · D-'+n.dd),act:'제출 · 계약 준비 확인',d:0,kind:'deal',x:row,col:'near'});});
  const T=LASTT=[...map.values()].sort((a,b)=>(b.probs.includes('기한 초과')?1:0)-(a.probs.includes('기한 초과')?1:0)||b.d-a.d),items=T.reduce((s,t)=>s+t.probs.length,0),tp=Math.min(S.tg||1,Math.max(1,Math.ceil(T.length/PER)));
  const hero='<section class="dv-card dv-hero"><span class="dv-l">지금 처리할 대상</span><div class="dv-big"><b class="'+(T.length?'red':'')+'">'+T.length+'</b><span>영업건 · 문제 항목 '+items+'개</span></div><span class="dv-s">미배정 '+M.colT('unasg')+' · 첫 연락 지연 '+M.colT('first')+' · 기한 초과 '+M.colT('due')+' · 마감 임박 '+T.filter(t=>t.probs.includes('마감 임박')).length+'</span></section>';
  /* 요청 추적: 6단계 + 기한 초과 */
  const cnt=k=>SL?SL.filter(r=>r.st===k).length:0,lateN=SL?SL.filter(r=>!['done','cancelled'].includes(r.st)&&Date.parse(r.due_at||'')<Date.now()).length:0,live=SL?SL.filter(r=>r.st!=='cancelled'):[];
  const req='<section class="dv-card dv-made">'+(SL===null?donut([],'확인 불가','요청 처리'):donut(live.length?[[cnt('done'),BLUE],[cnt('absent'),BL3],[cnt('sent')+cnt('seen')+cnt('working'),'#d9dde4']]:[],live.length?Math.round(cnt('done')/live.length*100)+'%':'대상 없음','요청 완료'))+'<div class="dv-leg"><span><i style="background:'+BLUE+'"></i>완료 '+cnt('done')+'</span><span><i style="background:'+BL3+'"></i>회신 대기 '+cnt('absent')+'</span><span><i style="background:#d9dde4"></i>담당 처리 전 · 중 '+(cnt('sent')+cnt('seen')+cnt('working'))+'</span>'+(lateN?'<span class="red">기한 초과 '+lateN+'</span>':'')+'<span class="dv-mut">'+(SL===null?'요청 기록을 불러오지 못했습니다':'내가 보낸 요청 · 최근 30일 · 취소 '+cnt('cancelled')+'건 제외')+'</span></div></section>';
  const dues=M.pick(null,'due'),AG=[['1–3일',1,3,'#f0c2c2'],['4–7일',4,7,'#e3a3a3'],['8–30일',8,30,'#d47a7a'],['30일+',31,1e9,RED]].map(a=>[a[0],dues.filter(x=>x.d>=a[1]&&x.d<=a[2]).length,a[3]]),amx=Math.max(1,...AG.map(a=>a[1]));
  const age='<section class="dv-card"><span class="dv-l">기한 초과 기간</span>'+AG.map(a=>'<div class="dv-hb"><span>'+a[0]+'</span>'+bar(pct(a[1],amx),a[2])+'<b>'+a[1]+'</b></div>').join('')+'<span class="dv-mut">확인된 다음 할 일 기한이 지난 영업건 '+dues.length+'건(기록 확인 대상 제외)</span></section>';
  const flow='<section class="dv-card">'+head('요청 처리 추적',SL===null?'요청 기록을 불러오지 못했습니다':'미확인 → 확인 후 미착수 → 진행 → 회신 대기 → 완료 · 취소는 따로')+'<div class="dv-flow">'+RQS.map((f,i,a)=>'<div class="dv-fs"><div class="'+(f[0]==='done'?'end':'')+'"><span>'+f[1]+'</span><b>'+(SL===null?'—':cnt(f[0]))+'</b></div>'+(i<a.length-2?'<i>›</i>':i===a.length-2?'<i></i>':'')+'</div>').join('')+'</div>'+(lateN?'<div class="dv-out red"><span></span>기한 초과 '+lateN+'건 (완료 · 취소 전)</div>':'')+'</section>';
  /* 처리 대상 목록: 문제 → 근거 → 누가 무엇을 → 요청했나 → 결과 */
  const list='<section class="dv-card">'+head('처리 대상','문제 → 근거 → 담당 · 필요한 조치 → 요청 상태 · 한 쪽 '+PER+'건')+(T.length?'<div class="dv-tg"><span class="th">현장</span><span class="th">문제</span><span class="th">근거</span><span class="th">담당 · 조치</span><span class="th">요청</span>'+T.slice((tp-1)*PER,tp*PER).map(t=>{const r=reqOf(t.key);return '<button type="button" class="tr" data-dv="open" data-v="'+attr(t.key)+'"><b>'+h(site(t.site))+'</b><span class="pr">'+h(t.probs.join(' · '))+'</span><span>'+h(t.why)+'</span><span>'+h((t.owner||'미배정')+' · '+t.act)+'</span><span class="'+(r&&/기한 초과/.test(reqLabel(r))?'red':'')+'">'+h(r?reqLabel(r):'요청 없음')+'</span></button>';}).join('')+'</div>'+pager(T.length,tp,'tg'):'<p class="dv-mut">지금 처리할 대상이 없습니다</p>')+'</section>';
  /* 담당자별 처리 부담(영업건 수와 문제 항목 수를 나눔) */
  let maxCell=1;M.owners.forEach(o=>M.COLS.forEach(c=>{maxCell=Math.max(maxCell,M.n(o,c[0]));}));
  const SEVC=['#fdecec','#f8d4d4','#f0b4b4','#e58e8e'],GRC=['#f3f4f6','#e5e7eb','#d1d5db','#9ca3af'],shade=(v,sev)=>!v?'#fafbfc':(sev===3?SEVC:GRC)[Math.min(3,Math.ceil(v/maxCell*4)-1)];
  const heat='<section class="dv-card">'+head('담당자별 처리 부담','칸 = 문제 항목 수 · 이름 옆 = 고유 영업건 수 · 칸을 누르면 그 건 목록')+(M.owners.length?'<div class="dv-heat" style="--cols:'+M.COLS.length+'"><span></span>'+M.COLS.map(c=>'<span class="hh">'+h(c[1])+'</span>').join('')
   +M.owners.map(o=>'<b class="hn'+(o==='미배정'?' red':'')+'">'+h(o)+' <small>'+M.unique(o)+'건</small></b>'+M.COLS.map(c=>{const v=M.n(o,c[0]),k=o+'|'+c[0];return '<button type="button" data-dv="cell" data-v="'+attr(k)+'" aria-pressed="'+(S.cell===k)+'" style="background:'+shade(v,c[2])+';color:'+(c[2]===3&&v?RED:'#374151')+'"'+(v?'':' disabled')+'>'+(v||'')+'</button>';}).join('')).join('')+'</div>':'<p class="dv-mut">문제 있는 건이 없습니다</p>');
  let selBox='';if(S.cell){const i=S.cell.lastIndexOf('|'),o=S.cell.slice(0,i),c=S.cell.slice(i+1),l=M.pick(o,c),col=M.COLS.find(x=>x[0]===c);if(l.length)selBox='<div class="dv-selbox"><b>'+h(o+' · '+(col?col[1]:'')+' '+l.length+'건')+'</b>'+l.slice(0,6).map(x=>{const r=reqOf(x.key);return '<button type="button" data-dv="open" data-v="'+attr(x.key)+'">'+h(site(x.site))+' <small>'+x.d+'일'+(r?' · 요청 '+h(reqLabel(r)):'')+'</small></button>';}).join('')+(l.length>6?'<small class="dv-mut">외 '+(l.length-6)+'건</small>':'')+'<i></i>'+(canSend()&&o!=='미배정'?'<button type="button" class="send" data-dv="send"'+(S.sending?' disabled':'')+'>요청 보내기</button>':'<small class="dv-mut">'+(o==='미배정'?'미배정은 견적문의에서 배정':'요청은 관리자 · 팀장만')+'</small>')+'</div>';}
  /* 대기와 미처리 구분: 고객 회신 대기 · 내부 자료 대기 · 담당 미착수 · 처리 중 — 대기를 담당 지연으로 세지 않음 */
  const waitOf=d=>String(d.item.waiting_reason||'').trim(),INT=/견적팀|물량|내부|자료 ?준비|단가|도면|설계/;
  const wC=C.active.filter(d=>waitOf(d)&&!INT.test(waitOf(d))).length,wI=C.active.filter(d=>waitOf(d)&&INT.test(waitOf(d))).length;
  const wait='<section class="dv-card"><span class="dv-l">대기와 미처리 구분</span>'+[['고객 회신 대기',wC,'대기 사유 · 지연 아님'],['내부 자료 대기',wI,'견적팀 · 자료 준비 등'],['담당 미착수',SL?cnt('sent')+cnt('seen'):null,'보낸 요청 중 착수 전'],['처리 중',SL?cnt('working'):null,'보낸 요청 진행 중']].map(x=>'<div class="dv-kv"><span>'+x[0]+'<small>'+x[2]+'</small></span><b>'+(x[1]===null?'—':x[1])+'</b></div>').join('')+'</section>';
  /* 기록 확인 · 자료 보완(실제 지연과 분리) */
  const rec='<section class="dv-card"><span class="dv-l">기록 확인 · 자료 보완</span>'+[['연락 기록 미확인',M.chk.length,'이관 전 날짜만 있음 · 지연으로 세지 않음','|sevenchk'],['다음 할 일 없음',M.colT('next'),'기록만 채우면 됨','|next']].map(x=>'<div class="dv-kv"><span>'+x[0]+'<small>'+x[2]+'</small></span><b>'+x[1]+'</b></div>').join('')+'</section>';
  /* 관리자 판단이 필요한 건: 기한 변경 요청 기록 · 지원 요청 */
  const since=B.addDays?B.addDays(P.today,-13):P.today,chg=[];C.deals.forEach(d=>{let p={};try{p=R.itemPatch(d.item,'deal')||{};}catch(e){}[...(d.item.activities||[]),...(p.activities||[])].forEach(x=>{if(x&&/\[기한 변경/.test(String(x.note||''))&&C.K(x.at||x.occurred_at||'')>=since)chg.push(d);});});
  let sup=null;try{sup=R.WorkRequest&&R.WorkRequest.enabled()?(R.WorkRequest.state().list||[]).filter(r=>r.to_me&&r.kind==='support'&&['sent','seen','working'].includes(r.status)).length:null;}catch(e){sup=null;}
  const adm='<section class="dv-card"><span class="dv-l">관리자 판단이 필요한 건</span>'+[['기한 변경 요청',new Set(chg.map(d=>d.key)).size,'최근 14일 · 원래 기한 · 새 기한 · 사유가 기록된 건'],['지원 요청',sup,'나에게 온 지원 요청 · 처리 전']].map(x=>'<div class="dv-kv"><span>'+x[0]+'<small>'+x[2]+'</small></span><b>'+(x[1]===null?'—':x[1])+'</b></div>').join('')+'</section>';
  return '<div class="dv-row3">'+hero+req+age+'</div>'+flow+list+heat.replace(/<\/section>$/,'')+selBox+'</section><div class="dv-row3">'+wait+rec+adm+'</div>';
 }
 async function sendCell(){
  const S=st(),M=LASTM;if(!M||!S.cell||S.sending||!canSend())return;const i=S.cell.lastIndexOf('|'),o=S.cell.slice(0,i),c=S.cell.slice(i+1),col=M.COLS.find(x=>x[0]===c),list=M.pick(o,c).slice(0,20),W=R.WorkRequest,O=R.OpsStore;
  if(!list.length||o==='미배정')return;const due=new Date(),same=due.getHours()<17;if(same)due.setHours(17,0,0,0);else{due.setDate(due.getDate()+1);due.setHours(12,0,0,0);}
  S.sending=true;R.DashB.render();let ok=0,dup=0,fail=0;
  for(const x of list){const it=(x.x&&x.x.item)||{};try{await O.rpc(W.RPC.create,{target_type:x.kind==='inq'?'inquiry':'deal',target_id:String(it.id||String(x.key).replace(/^(inq|deal):/,'')),site:x.site||'',brand:it.brand||'',kind:c==='first'?'first':'follow',label:'컨트롤타워 · '+(col?col[1]:'확인'),to_scope:'user',to_name:o,asks:[x.reason||(col?col[1]:'확인')],due_at:due.toISOString(),due_label:same?'오늘 17:00':'내일 12:00',memo:'컨트롤타워 요청 — '+(col?col[1]:'')});ok++;}catch(e){if(/이미 답을 기다리는/.test(String(e&&e.message||e)))dup++;else fail++;}}
  S.sending=false;try{W.load(true);}catch(e){}if(typeof R.toast==='function')R.toast(o+'님 오늘 업무에 요청 '+ok+'건을 보냈습니다'+(dup?' · 이미 요청한 '+dup+'건 제외':'')+(fail?' · 실패 '+fail+'건':''),fail?'warn':undefined);R.DashB.render();
 }

 /* ── 성과 분석 ── */
 function perf(C,X){
  const S=st(),{B,P,L,K,AD}=C,FOLLOW=Number((R.OPS_RULES||{}).inquiryFollowDays)||7,MINREC=10;
  /* 2026-10-29 대표 "기술자문이랑 합친 실적": 큰 숫자 · 추이 · 담당자 비교 = 매출(계약실적 + 기술자문 낙찰 확정분 + 인정된 타사 이관). 끄기 G.advMergeOff */
  const MERGE=!(R.G&&R.G.advMergeOff),tot=C.con.net+C.pt.amount+C.tf.amount;
  const hero=MERGE?'<section class="dv-card dv-hero"><span class="dv-l">'+h(P.thisYear?'올해 매출 실적':P.label+' 매출 실적')+'</span><div class="dv-big">'+(L.ready?ev('contract','<b>'+h(tot>0?X.eok(tot):'0')+'</b><span>'+(C.con.count+C.pt.count+C.tf.count)+'건</span>'):'<b class="mut">불러오는 중</b>')+'</div><span class="dv-s">계약실적 '+(C.con.net>0?h(X.eok(C.con.net))+' · '+C.con.count+'건':'없음')+' + 기술자문 낙찰 '+(C.pt.amount>0?ev('tech',h(X.eok(C.pt.amount))+' · '+C.pt.count+'건'):'없음')+(C.tf.count?' + 타사 이관 '+h(X.eok(C.tf.amount))+' · '+C.tf.count+'건':'')+'</span></section>'
   :'<section class="dv-card dv-hero"><span class="dv-l">'+h(P.thisYear?'올해 계약실적':P.label+' 계약실적')+'</span><div class="dv-big">'+(L.ready?ev('contract','<b>'+h(C.con.net>0?X.eok(C.con.net):'0')+'</b><span>계약 '+C.con.count+'건</span>'):'<b class="mut">불러오는 중</b>')+'</div><span class="dv-s">기술자문 낙찰(별도 · 합산 안 함) '+(C.pt.amount>0?h(X.eok(C.pt.amount))+' · '+C.pt.count+'건':'없음')+(C.tf.count?' · 타사 이관 수주 '+C.tf.count+'건 별도':'')+'</span></section>';
  /* 계약실적 추이(월) + 체결 · 변경 · 취소 — 합산이면 그 달 기술자문 낙찰 · 타사 이관도 막대에 */
  const months=[];for(let m=1;m<=12;m++){if(P.y>P.ty||(P.y===P.ty&&m>P.tm))break;const a=X.mk(P.y,m),b=X.mk(P.y,m+1),c=L.ready?B.contractsIn(L,a,b,C.target,'direct'):{net:0,count:0},p=MERGE&&L.ready&&C.DW?C.DW.partnerIn(a,b,C.target):{count:0,amount:0},t=MERGE&&L.ready&&C.DT?C.DT.wonIn(a,b,C.target):{count:0,amount:0};months.push({m,net:c.net+p.amount+t.amount,n:c.count+p.count+t.count});}
  const mmax=Math.max(1,...months.map(x=>x.net)),sel=months.find(x=>x.m===S.m)||months[months.length-1]||null,evs={signed:0,changed:0,cancelled:0};(L.rows||[]).forEach(r=>{if(r.advisory_id)return;(r.events||[]).forEach(e=>{if(e.effective_date>=P.a&&e.effective_date<P.b){const k=/cancel|취소/.test(e.kind)?'cancelled':e.kind==='signed'?'signed':'changed';evs[k]++;}});});
  const trend='<section class="dv-card">'+head(MERGE?'매출 실적 추이':'계약실적 추이',h(P.y+'년')+(MERGE?' · 계약 체결일 · 기술자문 낙찰확정일':' · 원장 체결일')+' · 막대를 누르면 그 달 · 숫자를 누르면 근거')+(L.ready&&months.length?'<div class="dv-cols">'+months.map(x=>'<button type="button" data-dv="m" data-v="'+x.m+'" aria-pressed="'+(sel&&sel.m===x.m)+'"><small>'+(x.net>0?h(X.eok(x.net)):'')+'</small><i style="height:'+Math.max(x.net>0?3:0,x.net/mmax*100).toFixed(1)+'%"></i><span>'+x.m+'월</span></button>').join('')+'</div><p class="dv-sel">'+(sel?ev(String(sel.m),'<b>'+P.y+'년 '+sel.m+'월</b> · '+(sel.net>0?h(X.won(sel.net)):'계약 없음')+' · 계약 '+sel.n+'건','cs-month'):'')+' · '+h(P.label)+' 원장 기록 체결 '+evs.signed+' · 변경 '+evs.changed+' · 취소 '+evs.cancelled+'</p>':'<p class="dv-mut">'+(L.ready?'이 기간 자료가 없습니다':'계약 원장을 불러오는 중')+'</p>')+'</section>';
  /* 담당자별 성과 비교: 계약실적 · 수주 · 실주 · 메이드율(분자/분모) */
  const PP=X.people(C).map(p=>Object.assign({},p,{con:L.ready?(()=>{const c=B.contractsIn(L,P.a,P.b,p.n,'direct');if(!MERGE)return c;const q=C.DW?C.DW.partnerIn(P.a,P.b,p.n):{count:0,amount:0},t=C.DT?C.DT.wonIn(P.a,P.b,p.n):{count:0,amount:0};return {net:c.net+q.amount+t.amount,count:c.count+q.count+t.count};})():{net:0,count:0}})).sort((a,b)=>MERGE?b.con.net-a.con.net:0),cmx=Math.max(1,...PP.map(p=>p.con.net));
  const cmp='<section class="dv-card">'+head('담당자별 성과 비교',h(P.label)+' · 같은 기간 · 메이드율 옆 = 대상 건수')+'<div class="dv-cmp"><span class="th">담당</span><span class="th">'+(MERGE?'매출 실적':'계약실적')+'</span><span class="th">수주 · 실주</span><span class="th">메이드율</span>'+PP.map(p=>'<b>'+h(p.n)+'</b><span class="cv">'+bar(pct(p.con.net,cmx),BLUE)+'<small>'+(!L.ready?'불러오는 중':p.con.net>0?h(X.eok(p.con.net))+' · '+p.con.count+'건':'없음')+'</small></span><span>'+p.w+' · '+p.l+'</span><span>'+(p.made==null?'<small class="dv-mut">결과 확정 전</small>':p.made.toFixed(1)+'% <small>('+p.w+' / '+(p.w+p.l)+')</small>')+'</span>').join('')+'</div><span class="dv-mut">수주 = 계약 + 협약 · 기술자문 + 타사 이관(대시보드 기존 산식) · 결과가 확정된 건만 · 비율만으로 평가하지 않음</span></section>';
  /* 활동과 진행 결과(같은 영업건 기록 기준) */
  const pend=X.pendingStats?X.pendingStats():[];
  const act='<section class="dv-card"><span class="dv-l">활동 → 진행 결과</span>'+(pend.length?pend.map(p=>'<div class="dv-kv"><span>'+h(p[0])+'<small>같은 영업건 기록 '+p[1]+'건</small></span><b>'+(p[1]>=MINREC?h(p[2]):'<small class="dv-mut">표본 '+p[1]+'/'+MINREC+' · 판단 보류</small>')+'</b></div>').join(''):'<p class="dv-mut">기록 미확인</p>')+'</section>';
  /* 문의 전환(같은 문의 집단 · 결과 확정과 진행 중 구분) */
  const fitQ=C.q.filter(x=>!B.badfit(x)),dealOf=x=>{try{return R.linkedDeal(x);}catch(e){return null;}},quoted=fitQ.filter(x=>{const d=dealOf(x);if(!d)return false;try{return B.quoteIn(d,'0000-01-01','9999-12-31');}catch(e){return false;}}).length,fate=L.ready?fitQ.map(x=>{try{return X.inquiryFate(C,x);}catch(e){return 'open';}}):null,wonQ=fate?fate.filter(v=>v==='won').length:null,lostQ=fate?fate.filter(v=>v==='lost').length:null,openQ=fate?fate.filter(v=>v==='open').length:null;
  const F=[['문의',C.q.length],['적합',fitQ.length],['견적 발송',quoted],['계약',wonQ]],FC=['#eef0f3',BL3,'#7c9be8',BLUE],fmx=Math.max(1,C.q.length);
  const fun='<section class="dv-card"><span class="dv-l">문의 전환</span><div class="dv-fun">'+F.map((f,i)=>'<div style="width:'+Math.max(34,Math.sqrt((f[1]||0)/fmx)*100).toFixed(1)+'%;background:'+FC[i]+';color:'+(i>=2?'#fff':'#15171c')+'"><span>'+f[0]+'</span><b>'+(i===0?ev('inquiries',String(f[1])):f[1]===null?'—':f[1])+'</b></div>').join('')+'</div><span class="dv-mut">'+h(P.label)+' 접수 문의 집단 · 조회 시점 결과 확정 '+(fate?wonQ+lostQ:'—')+'(계약 '+(wonQ==null?'—':wonQ)+' · 실주 '+(lostQ==null?'—':lostQ)+') · 진행 중 '+(openQ==null?'—':openQ)+' · 배드핏 '+(C.q.length-fitQ.length)+'</span></section>';
  /* 수주 · 실주 원인: 확인된 사유 / 미입력 분리 */
  const LR=B.tally(C.loss,B.lossReason),known=LR.filter(x=>x[0]!=='사유 미기록').slice(0,5),unk=(LR.find(x=>x[0]==='사유 미기록')||[0,0])[1],lmx=Math.max(1,...known.map(x=>x[1]));
  const lost='<section class="dv-card"><span class="dv-l">실주 원인</span>'+(known.length?known.map(x=>'<div class="dv-hb"><span title="'+attr(x[0])+'">'+h(x[0])+'</span>'+bar(pct(x[1],lmx),GRAY)+'<b>'+x[1]+'</b></div>').join(''):'<p class="dv-mut">'+(C.loss.length?'확인된 사유가 없습니다':h(P.label)+' 실주가 없습니다')+'</p>')+(unk?'<span class="dv-mut">사유 미입력 '+unk+'건 — 원인으로 해석하지 않음</span>':'')+'</section>';
  /* 단계 소요: 수주 / 실주 평균 일수(결과 난 건 · 표본 표시) */
  const contacts=d=>{let p={};try{p=R.itemPatch(d,'deal')||{};}catch(e){}return [...(d.activities||[]),...(p.activities||[])].map(x=>({k:K(x.at||x.occurred_at||''),t:String(x.type||''),n:String(x.note||'')})).filter(x=>x.k&&/전화|통화|방문|문자|카카오|메일|미팅/.test(x.t)&&!/전화 시도/.test(x.n)).sort((a,b)=>a.k.localeCompare(b.k));};
  const span=(a,b)=>a&&b?Math.max(0,B.between(a,b)):null,avg=l=>{const v=l.filter(x=>x!=null);return v.length?{v:Math.round(v.reduce((s,x)=>s+x,0)/v.length),n:v.length}:null;};
  const pathOf=(list,closeK)=>{const rows=list.map(d=>{const c0=K(d.created||d.created_at||''),cs=contacts(d),evs2=X.stageEvents(d,K)||[],sent=(evs2.find(e=>e.to==='sent')||{}).k,visit=(cs.find(x=>/방문|미팅|실측/.test(x.t))||{}).k,after=sent?(cs.find(x=>x.k>sent)||{}).k:null;return {visit:span(c0,visit),sent:span(c0,sent),gap:span(sent,after),close:span(c0,closeK(d))};});return {n:list.length,visit:avg(rows.map(r=>r.visit)),sent:avg(rows.map(r=>r.sent)),gap:avg(rows.map(r=>r.gap)),close:avg(rows.map(r=>r.close))};};
  const wonD=C.deals.filter(r=>r.won&&C.inR(K(r.wonAt||''),P.a,P.b)).map(r=>r.item),WP=pathOf(wonD,d=>K(R.wonDate(d)||'')),LP=pathOf(C.loss,d=>B.closedKey(d));
  const steps=(p,lo)=>{const s=['문의'];if(p.visit)s.push(p.visit.v+'일 방문 ('+p.visit.n+')');if(p.sent)s.push(p.sent.v+'일 견적 ('+p.sent.n+')');if(p.gap)s.push('견적 뒤 '+p.gap.v+'일 첫 후속 ('+p.gap.n+')');s.push((p.close?p.close.v+'일 ':'')+(lo?'실주':'수주'));return s;};
  const badGap=LP.gap&&WP.gap&&LP.gap.n>=3&&WP.gap.n>=3&&LP.gap.v>Math.max(FOLLOW,WP.gap.v);
  const path='<section class="dv-card">'+head('단계 소요 · 수주 / 실주 비교','평균 일수 · 괄호 = 그 값을 낸 건수 · '+h(P.label)+' 결과 난 건')+[['수주',WP,false],['실주',LP,true]].map(([l,p,lo])=>'<div class="dv-path"><b class="'+(lo?'':'blue')+'">'+l+' <small>'+p.n+'건</small></b>'+(p.n?steps(p,lo).map((t,i,a)=>'<span class="'+(lo&&badGap&&/첫 후속/.test(t)?'bad':'')+'">'+h(t)+'</span>'+(i<a.length-1?'<i>›</i>':'')).join(''):'<span class="dv-mut">대상 없음</span>')+'</div>').join('')+(badGap?'<span class="dv-mut">실주 쪽 견적 뒤 첫 후속이 '+LP.gap.v+'일로 수주 쪽('+WP.gap.v+'일)보다 깁니다 · 원인으로 단정하지 않음</span>':'<span class="dv-mut">표본이 3건 이상일 때만 차이를 적습니다</span>')+'</section>';
  /* 브랜드 · 유입경로 */
  const BRW=X.brandRows(C),bq=Math.max(1,...BRW.map(b=>b.q));
  const br='<section class="dv-card">'+head('브랜드별 문의 → 수주',h(P.label)+' 접수 · 수주 = 원장 체결')+BRW.map(b=>'<div class="dv-br"><div><span><i style="background:'+b.c+'"></i>'+h(b.name)+'</span><b>'+(b.q?(Math.round(b.w/b.q*1000)/10)+'% <small>('+b.w+' / '+b.q+')</small>':'문의 없음')+'</b></div><span class="dv-bar thick"><i class="q" style="width:'+pct(b.q,bq).toFixed(1)+'%"></i><i style="width:'+pct(Math.min(b.w,b.q),bq).toFixed(1)+'%;background:'+b.c+'"></i></span></div>').join('')+'</section>';
  const CH=new Map();C.q.forEach(x=>{const k=X.channelOf?X.channelOf(x):'유입경로 미기록',v=CH.get(k)||{q:0,w:0};v.q++;try{if(L.ready&&X.inquiryFate(C,x)==='won')v.w++;}catch(e){}CH.set(k,v);});
  const chs=[...CH].sort((a,b)=>b[1].q-a[1].q).slice(0,6),chm=Math.max(1,...chs.map(x=>x[1].q));
  const chn='<section class="dv-card">'+head('유입경로별 문의 → 계약',h(P.label)+' 접수')+(chs.length?chs.map(([k,v])=>'<div class="dv-hb wide"><span title="'+attr(k)+'">'+h(k)+'</span>'+bar(pct(v.q,chm),BL3)+'<b>'+v.q+(L.ready?' · '+v.w:'')+'</b></div>').join('')+'<span class="dv-mut">숫자 = 문의 · 계약</span>':'<p class="dv-mut">'+h(P.label)+' 접수 문의가 없습니다</p>')+'</section>';
  return '<div class="dv-row3">'+hero+fun+lost+'</div>'+trend+cmp+'<div class="dv-row3">'+act+br+chn+'</div>'+path;
 }
 function html(page,C,X){return '<div class="dv" data-page="'+page+'">'+(page==='dash'?dash(C,X):page==='control'?control(C,X):perf(C,X))+'</div>';}
 function onClick(e){
  const b=e.target.closest('[data-dv]');if(!b||b.disabled)return false;const S=st(),a=b.dataset.dv,v=b.dataset.v;
  if(a==='who'){S.who=v||null;}else if(a==='stg'){S.stg=S.stg===v?null:v;}else if(a==='m'){S.m=Number(v)||null;}else if(a==='cell'){S.cell=S.cell===v?null:v;}else if(a==='sum'){S.sum=Number(v)||1;}else if(a==='tg'){S.tg=Number(v)||1;}
  else if(a==='open'){try{R.SalesInsights.openRecord(v);}catch(err){}return true;}else if(a==='send'){sendCell();return true;}else return false;
  try{R.DashB.render();}catch(err){}return true;
 }
 root.DashVisual={on,html,onClick,state:st,_weekRecords:weekRecords,_weekProgress:weekProgress};
})(window);
