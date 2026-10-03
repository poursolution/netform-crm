/* 주간 영업 브리핑 v2 (2026-10-03 디자인 핸드오프 'design_handoff_weekly') — 주간 브리핑 메뉴(#p=brief)의 주간 화면만. 월간 일정은 기존 그대로.
   주인공은 누적 숫자가 아니라 '지난주 대비 이번 주 변화'.
   흐름: 이번 주 성과 → 전주 문제 · 조치 · 결과 → 영업 이동 → 계약실적 → 담당자별 움직임 → 다음 주 반드시 끝낼 것 → (참고) 전체 현황 / 오른쪽 잔디 미리보기. 이모지 없음.
   보고 주: 월요일에는 막 끝난 지난주, 그 밖의 요일에는 이번 주(월~오늘). 전주 = 그 앞 주.
   숫자 출처(지어내지 않는다):
    · 견적문의 = 접수일 기준 · 배드핏 = 견적문의 단계에서 영업건이 되지 않고 종결된 문의(영업 실패 아님 · 메이드율 제외)
    · 견적 발송 = 발송일 · 견적 버전 등록일 · 자료 발송완료 단계 진입(단계 변경 이력)
    · 계약실적 = 계약실적 원장(계약 체결일 기준 · 변경 · 취소는 발생일 반영) — 원장을 못 읽으면 숫자를 내지 않는다
    · 영업 메이드율 = 수주 ÷ (수주 + 파이프라인 실주) — 배드핏 · 진행 중 제외
    · 영업 이동 = 단계 변경 이력 기준 그 주에 그 단계로 들어온 건
    · 담당자별 진행 · 장기정체의 '전주 값'은 생성일 · 종료일 · 연락 기록으로 그 시점을 다시 계산한 것
   다음 주 반드시 끝낼 것: 규칙으로 뽑은 후보에 담당 · 기한을 정해 [등록] → 주간 스냅샷(report_snapshots.promises · 열쇠 = 보고 주 월요일)에 저장 → 다음 주 '전주 문제 → 결과' 표의 행이 되고, 결과는 그때 자료로 다시 센다.
   잔디 자동 발송은 아직 연결 전(jandi_enabled) — [다시 보내기]는 정한 내용을 저장하고 글을 복사한다.
   끄기: G.briefBOff=true → 이전 주간 브리핑(brief-v2). */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const enabled=()=>!root.G.briefBOff;
 const K=v=>root.briefDateKey(v);
 const pad=n=>String(n).padStart(2,'0'),key=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
 const addDays=(k,n)=>{const d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return key(d);};
 const between=(a,b)=>Math.round((Date.parse(b+'T00:00:00')-Date.parse(a+'T00:00:00'))/864e5);
 const amt=n=>Number(n)>0?root.fmtAmt(Number(n)):'0원';
 const md=k=>Number(k.slice(5,7))+'/'+Number(k.slice(8,10));
 const pct=(a,b)=>b>0?Math.round(a/b*1000)/10:null,pctText=v=>v==null?'—':v.toFixed(1)+'%';
 const toast=(m,k)=>{if(typeof root.toast==='function')root.toast(m,k);};
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const GROUPS=[['consulting','견적 준비'],['sent','자료 발송'],['relationship','관계관리'],['competition','경쟁 · 입찰']];
 const DUES=['월요일','수요일','금요일'];
 /* 장기정체 = 이 날수 넘게 접촉 없음(회의 지침: 대기 고객도 2개월에 1회) — 10/16 확정 전 설정값 */
 const STALE=()=>Number((root.OPS_RULES&&root.OPS_RULES.briefStallDays)||60);
 function win(){
  const n=root.G.briefBNow?new Date(root.G.briefBNow):new Date(),d=new Date(n.getFullYear(),n.getMonth(),n.getDate()),dow=(d.getDay()+6)%7;
  const today=key(d);d.setDate(d.getDate()-dow-(dow===0?7:0));const a=key(d),b=addDays(a,7);
  return {a,b,p:addDays(a,-7),fri:addDays(a,4),today,now:today<b?addDays(today,1):b};
 }
 const rangeText=w=>w.a.replace(/-/g,'.')+' – '+w.fri.slice(5).replace('-','.');
 /* ── 단계 이동 ── */
 let SM=null;
 const stageCode=v=>{v=String(v||'').trim();if(!v)return '';if(!SM){SM={};const S=root.STAGE_MASTER||{};Object.keys(S).forEach(k=>{SM[k]=k;[S[k].name,S[k].was].forEach(n=>{if(n&&!SM[n])SM[n]=k;});});}return SM[v]||'';};
 const groupOf=c=>{try{return root.PipelineStages.group(c)||'';}catch(e){return '';}};
 const evAt=x=>K(x.at||x.changed_at||x.created_at),evTo=x=>stageCode(x.to||x.after||x.new_stage),evFrom=x=>stageCode(x.from||x.before||x.old_stage);
 function entered(d,g,a,b){
  let ev=[];try{ev=root.briefAllStageEvents(d);}catch(e){}
  if(ev.some(x=>{const k=evAt(x);return k>=a&&k<b&&groupOf(evTo(x))===g&&groupOf(evFrom(x))!==g;}))return true;
  const ck=K(d.created);if(ck&&ck>=a&&ck<b){const first=ev.slice().sort((x,y)=>String(evAt(x)).localeCompare(String(evAt(y))))[0];return groupOf(first?evFrom(first):root.dealStage(d))===g;}
  return false;
 }
 const movedIn=(d,a,b)=>{let ev=[];try{ev=root.briefAllStageEvents(d);}catch(e){}return ev.some(x=>{const k=evAt(x);return k>=a&&k<b;});};
 function quoteIn(d,a,b){
  const p=root.itemPatch(d,'deal')||{},c=(d.stage_contexts||p.stage_contexts||{}).sent,sd=c&&c.fields&&K(c.fields.sent_date);if(sd&&sd>=a&&sd<b)return true;
  const qv=d.quote_versions||d.quoteVersions||p.quoteVersions||[];if(Array.isArray(qv)&&qv.some(q=>{const k=K(q.created_at);return k&&k>=a&&k<b;}))return true;
  return entered(d,'sent',a,b);
 }
 /* ── 견적문의: 배드핏(부적합 종결) ── */
 const BADFIT_ST=['실주','배드핏','종결','종료','연락두절','미구매 종료'];
 function badfit(q){try{if(root.inqCtlConverted(q))return false;}catch(e){}const s=String(q.status||'');return BADFIT_ST.includes(s)||/스토어|자재/.test(s)||!!(root.inqNoTrack&&root.inqNoTrack(q));}
 function badfitReason(q){
  const r=String(q.close_reason||''),s=String(q.status||'');let m=/배드핏[^·]*·\s*([^—·]+)/.exec(r);if(m)return m[1].trim();
  if(/스토어|자재/.test(s))return '스토어 · 자재 문의';if(root.inqNoTrack&&root.inqNoTrack(q))return '협약 문의';
  m=/^(상담만|협약|기타) 종결/.exec(r);if(m)return m[1]==='상담만'?'상담만 하고 끝남':m[1]==='협약'?'협약 문의':'기타';
  return s==='연락두절'?'연락두절':'사유 미기록';
 }
 /* ── 파이프라인 실주(영업기회 상실 · 메이드율 포함): 배드핏 종결은 뺀다 ── */
 const closedKey=d=>K(d.closed_at||d.closed||'');
 const isLoss=d=>{const o=root.outcomeOf(d);return o==='lost'||o==='nocontact';};
 function lossReason(d){const p=root.itemPatch(d,'deal')||{},c=d.stage_contexts||p.stage_contexts||{},f=(c.lost&&c.lost.fields)||(c.nocontact&&c.nocontact.fields)||{};return String(f.close_reason||d.close_reason||d.lost_reason||(root.outcomeOf(d)==='nocontact'?'연락두절':'')||'사유 미기록').trim();}
 const tally=(list,fn)=>{const m=new Map();list.forEach(x=>{const k=fn(x);m.set(k,(m.get(k)||0)+1);});return [...m].sort((a,b)=>b[1]-a[1]);};
 const tallyText=t=>t.map(([k,n])=>k+' '+n).join(' · ');
 /* ── 계약실적 원장 ── */
 function ledger(target){
  const C=root.ContractSalesData;let s={status:'unavailable',items:[]};try{if(C)s=C.state();}catch(e){}
  if(s.status!=='ready'){if(C&&s.status==='idle'&&root.TOKEN)try{C.refresh();}catch(e){}return {ready:false,status:s.status,rows:[]};}
  const names=root.PERFORMANCE_TARGET_NAMES||[];
  return {ready:true,status:'ready',rows:s.items.filter(r=>{const n=root.repN(r.sales_owner_name);return (target?n===target:names.includes(n))&&(root.G.brand==='전체'||!root.G.brand||r.brand===root.G.brand);})};
 }
 function contractsIn(L,a,b,owner){
  let count=0,net=0;const list=[];
  L.rows.forEach(r=>{if(owner&&root.repN(r.sales_owner_name)!==owner)return;(r.events||[]).forEach(e=>{const k=e.effective_date;if(!(k>=a&&k<b))return;net+=e.amount_delta;if(e.kind==='signed'){count++;list.push({r,e});}});});
  return {count,net,list};
 }
 /* ── 그 시점의 진행 · 장기정체(생성일 · 종료일 · 연락 기록으로 다시 계산) ── */
 const openAt=(d,T)=>{const c=K(d.created);if(!c||c>=T)return false;if(root.isOpen(d))return true;let z=closedKey(d);if(!z)try{z=K(root.wonDate(d));}catch(e){}return !!z&&z>=T;};
 function lastActKey(d,T){const p=root.itemPatch(d,'deal')||{},A=p.activities||d.activities||[];let m='';(Array.isArray(A)?A:[]).forEach(x=>{if(/단계전환|상태변경|배정|예약/.test(String(x.type||'')))return;const k=K(x.at||x.occurred_at);if(k&&k<T&&k>m)m=k;});return m||K(d.created)||'';}
 const staleAt=(d,T)=>{if(!openAt(d,T))return false;const l=lastActKey(d,T);return !!l&&between(l,T)>STALE();};
 const actedIn=(d,a,b)=>{const l=lastActKey(d,b);return !!l&&l>=a&&l!==K(d.created);};
 /* ── 주간 스냅샷(약속 저장) ── */
 const SN={state:'idle',map:{}},MEM={},SEL={own:{},due:{}};let SENT='';
 const canStore=()=>{const O=root.OpsStore;return !!(O&&O.has('crm_report_snapshot_get_v1')&&O.has('crm_report_snapshot_save_v1'));};
 function loadSnaps(force){
  const O=root.OpsStore;if(!canStore()){SN.state='off';return;}
  /* 한 번 읽고(성공이든 실패든) 다시 그릴 때마다 되풀이하지 않는다 — 실패한 채로 다시 그리면 끝없이 다시 읽게 된다 */
  if(SN.state==='loading'||(!force&&(SN.state==='ready'||SN.state==='failed')))return;SN.state='loading';
  O.rpc('crm_report_snapshot_get_v1',{kind:'weekly',limit:6}).then(r=>{SN.map={};(r.snapshots||[]).forEach(s=>{SN.map[s.period_key]=s;});SN.state='ready';if(root.G.page==='brief')root.paintBrief();}).catch(()=>{SN.state='failed';});
 }
 const promisesOf=k=>{const s=SN.map[k];if(s&&Array.isArray(s.promises))return s.promises;return MEM[k]||[];};
 /* ── 자료 모으기 ── */
 function data(){
  const R=root,target=R.targetNameFilter(),w=win(),AD=R.briefScopeDeals(target,false),AQ=R.briefScopeInquiries(target,false),OPEN=AD.filter(R.isOpen);
  const names=target?[target]:(R.PERFORMANCE_TARGET_NAMES||[]),L=ledger(target),byId=new Map(AD.map(d=>[String(d.id),d])),qById=new Map(AQ.map(q=>[String(q.id||R.inqKey(q)),q]));
  const inW=k=>!!k&&k>=w.a&&k<w.b,inP=k=>!!k&&k>=w.p&&k<w.a;
  const newQ=AQ.filter(q=>inW(K(R.inquiryCreatedAt(q)))),newQp=AQ.filter(q=>inP(K(R.inquiryCreatedAt(q))));
  const bad=newQ.filter(badfit),badP=newQp.filter(badfit),fit=newQ.length-bad.length,fitP=newQp.length-badP.length;
  const quotes=AD.filter(d=>quoteIn(d,w.a,w.b)),quotesP=AD.filter(d=>quoteIn(d,w.p,w.a));
  const con=contractsIn(L,w.a,w.b),conP=contractsIn(L,w.p,w.a);
  const loss=AD.filter(d=>isLoss(d)&&inW(closedKey(d))),lossP=AD.filter(d=>isLoss(d)&&inP(closedKey(d)));
  /* 확정 전환율(코호트): 보고 주가 속한 달의 2달 전 달에 접수된 문의 중 지금까지 계약(수주)된 비율 */
  const cm=new Date(w.a+'T00:00:00');cm.setDate(1);cm.setMonth(cm.getMonth()-2);const ym=cm.getFullYear()+'-'+pad(cm.getMonth()+1);
  const cohort=AQ.filter(q=>K(R.inquiryCreatedAt(q)).slice(0,7)===ym);let linked=0,cwon=0;
  cohort.forEach(q=>{let d=null;try{d=R.linkedDeal(q);}catch(e){}if(d){linked++;if(R.isWon(d))cwon++;}});
  /* 영업 이동 */
  const assignedIn=(a,b)=>AQ.filter(q=>{const k=K(R.inquiryAssignedAt(q));return !!k&&k>=a&&k<b;}).length;
  const flow=[['신규 문의',newQ.length,newQp.length],['담당 배정',assignedIn(w.a,w.b),assignedIn(w.p,w.a)]]
   .concat(GROUPS.map(([g,l])=>[l,AD.filter(d=>entered(d,g,w.a,w.b)).length,AD.filter(d=>entered(d,g,w.p,w.a)).length]))
   .concat([['계약',L.ready?con.count:null,L.ready?conP.count:null]]);
  /* 담당자별 */
  const people=names.map(n=>{
   const mine=AD.filter(d=>R.repN(d.assignee)===n),o0=mine.filter(d=>openAt(d,w.a)).length,o1=mine.filter(d=>openAt(d,w.now)).length,s0=mine.filter(d=>staleAt(d,w.a)).length,s1=mine.filter(d=>staleAt(d,w.now)).length;
   const q=newQ.filter(x=>R.inquirySalesOwner(x)===n).length,qt=quotes.filter(d=>R.repN(d.assignee)===n).length,c=contractsIn(L,w.a,w.b,n);
   const moves=mine.filter(d=>movedIn(d,w.a,w.b)||actedIn(d,w.a,w.b)).length+q+qt+c.count;
   let note,red=false;
   if(!o1&&!c.count){note='진행 0건 — 배정 검토';red=true;}
   else if(!moves){note='이번 주 이동 0 — 기록 확인 필요';red=true;}
   else if(s1<s0)note='정체 '+(s0-s1)+'건 해소'+(c.count?' → 계약 '+c.count+'건':'');
   else if(s1>s0){note='정체 '+(s1-s0)+'건 늘어남';red=true;}
   else if(s1>0){note='정체 그대로';red=true;}
   else note=c.count?'계약 '+c.count+'건':'움직인 건 '+moves+'건';
   return {n,o0,o1,s0,s1,q,qt,c,note,red,stale180:mine.filter(d=>R.isOpen(d)&&(R.activityAge(d)||0)>180).length};
  });
  /* 다음 주 반드시 끝낼 것(규칙 후보) */
  const ctx=d=>{const p=R.itemPatch(d,'deal')||{};return d.stage_contexts||p.stage_contexts||{};},fld=(d,c,k)=>{const x=ctx(d)[c];return x&&x.fields?x.fields[k]:'';};
  const soon=k=>!!k&&k>=w.today&&k<addDays(w.today,8);
  const owners=list=>tally(list,x=>R.repN(x.assignee)||'미배정').filter(o=>o[0]!=='미배정').slice(0,2).map(o=>o[0]);
  const cands=[];
  const add=(kind,list,t,why,act,due,ownersOf)=>{if(!list.length)return;cands.push({kind,t,why,act,n:list.length,ids:list.map(x=>String(x.id||R.inqKey(x))),owners:(ownersOf||owners)(list),due});};
  const bid=OPEN.filter(d=>{const c=R.dealStage(d);return ['bidding','compete','imminent'].includes(c)&&soon(K(c==='bidding'?fld(d,'bidding','bid_deadline'):c==='compete'?fld(d,'compete','meeting_date'):fld(d,'imminent','expected_contract')));});
  add('bid_soon',bid,'입찰 · PT 임박 '+bid.length+'건 준비 확인',bid.slice(0,2).map(d=>d.site||'현장').join(' · ')+(bid.length>2?' 외 '+(bid.length-2):''),'제안서 · PT · 현설 준비 상태 확인','월요일');
  const qd=OPEN.filter(d=>{if(groupOf(R.dealStage(d))!=='consulting')return false;const due=K(fld(d,'consulting','quote_due'));return due?due<w.today:(R.stageAge(d)||0)>5;});
  add('quote_delay',qd,'견적 지연 '+qd.length+'건 발송','견적 예정일이 지났거나 5일 넘게 견적 준비 중','담당자별 원인 확인 · 견적 요청 재정리','월요일');
  const nr=AQ.filter(q=>!R.isClosedInq(q)&&R.inquiryAssigned(q)&&!R.inquiryResponded(q));
  add('no_response',nr,'신규 문의 미응대 '+nr.length+'건 첫 연락','배정됐지만 첫 연락 기록이 없는 문의','담당자 첫 연락 · 결과 기록','월요일',list=>tally(list,q=>R.inquirySalesOwner(q)||'미배정').filter(o=>o[0]!=='미배정').slice(0,2).map(o=>o[0]));
  const st=OPEN.filter(d=>(R.activityAge(d)||0)>STALE());
  add('stale60',st,STALE()+'일 이상 미접촉 '+st.length+'건 재접촉','마지막 연락이 '+STALE()+'일을 넘은 진행 건','재접촉 · 담당 재배정','수요일');
  let nm=[];try{nm=R.managementStats(target).nextMissing||[];}catch(e){}
  add('no_next',nm,'다음 행동 미등록 '+nm.length+'건 등록','진행 건인데 다음 할 일 · 날짜가 없음','담당자별 코칭 · 다음 행동 등록 요청','수요일');
  const ce=OPEN.filter(d=>{const c=R.dealStage(d);return c==='contract'?fld(d,'contract','contract_status')!=='체결 완료'&&soon(K(fld(d,'contract','contract_date'))):c==='imminent'&&soon(K(fld(d,'imminent','expected_contract')));});
  const ceAmt=ce.reduce((a,d)=>a+Number(fld(d,'contract','contract_amount')||d.amount||d.amt||0),0);
  add('contract_expected',ce,'계약 예상 '+ce.length+'건 진행 확인 · '+amt(ceAmt),'대표회의 · 계약서 일정 확정','계약 일정 · 조건 확인','금요일');
  /* 전체 현황(참고): 올해 기준 */
  const y0=w.a.slice(0,4)+'-01-01',yCon=contractsIn(L,y0,w.b),yLoss=AD.filter(d=>isLoss(d)&&closedKey(d)>=y0&&closedKey(d)<w.b).length;
  const m0=addDays(w.b,-1).slice(0,8)+'01',mCon=contractsIn(L,m0,w.b);
  return {w,target,L,AD,OPEN,byId,qById,newQ,newQp,bad,badP,fit,fitP,quotes,quotesP,con,conP,loss,lossP,ym,cohort,linked,cwon,flow,people,cands:cands.slice(0,6),ce,ceAmt,yCon,yLoss,mCon,stale180:OPEN.filter(d=>(R.activityAge(d)||0)>180).length};
 }
 /* 지난주에 등록한 약속을 지금 자료로 다시 센다 */
 function evalPromise(x,pr){
  const R=root,ids=Array.isArray(pr.ids)?pr.ids:[],since=K(pr.at)||x.w.a,far='9999-12-31';let r1=0,r2=0,left=0,L=['처리','종료 · 다른 처리','미완료'];
  const each=(get,ok,gone)=>ids.forEach(id=>{const o=get(String(id));if(!o){r2++;return;}if(ok(o))r1++;else if(gone(o))r2++;else left++;});
  const deal=id=>x.byId.get(id),closed=d=>!R.isOpen(d);
  if(pr.kind==='quote_delay'){L=['발송 완료','종료 · 다른 처리','자료 대기'];each(deal,d=>quoteIn(d,since,far)||['sent','relationship','competition','construction'].includes(groupOf(R.dealStage(d))),closed);}
  else if(pr.kind==='no_next'){L=['등록','종료','미완료'];each(deal,d=>R.isOpen(d)&&!!R.actionObj(d,R.itemPatch(d,'deal')||{}),closed);}
  else if(pr.kind==='stale60'){L=['재접촉','관계관리 · 종료','미접촉'];each(deal,d=>R.isOpen(d)&&lastActKey(d,far)>=since&&groupOf(R.dealStage(d))!=='relationship',d=>closed(d)||(groupOf(R.dealStage(d))==='relationship'&&entered(d,'relationship',since,far)));}
  else if(pr.kind==='bid_soon'){L=['정상 진행','종료','보완 필요'];each(deal,d=>R.isOpen(d)&&lastActKey(d,far)>=since,closed);}
  else if(pr.kind==='contract_expected'){L=['계약','종료','진행 중'];const signed=new Set();x.L.rows.forEach(r=>(r.events||[]).forEach(e=>{if(e.kind==='signed'&&e.effective_date>=since)signed.add(String(r.deal_id));}));each(deal,d=>signed.has(String(d.id))||R.isWon(d),d=>closed(d)&&!R.isWon(d));}
  else if(pr.kind==='no_response'){L=['첫 연락','종결','미응대'];each(id=>x.qById.get(id),q=>R.inquiryResponded(q)&&!badfit(q),q=>R.isClosedInq(q));}
  else left=ids.length;
  const n=ids.length||Number(pr.n)||0;
  return {issue:String(pr.t||'').replace(/\s*\d+건.*$/,'')||pr.t,n,act:(pr.act||pr.why||'')+(pr.owner?' — '+pr.owner+(pr.due?' · '+pr.due:''):''),r1,r2,left,L};
 }
 /* ── 잔디 글 ── */
 function jandi(x,fixes,regd){
  const line='━━━━━━━━━━━━━━',w=x.w,up=(a,b)=>a===b?'':(a>b?' ▲'+(a-b):' ▼'+(b-a)),con=x.L.ready;
  const fitR=pct(x.fit,x.newQ.length),made=con?pct(x.con.count,x.con.count+x.loss.length):null,conv=con?pct(x.con.count,x.newQ.length):null;
  const out=['[주간 영업 브리핑]',w.a.replace(/-/g,'.')+' ~ '+w.fri.slice(5).replace('-','.'),line,'1. 이번 주 성과',
   '견적문의 '+x.newQ.length+'건 → 적합 '+x.fit+' → 견적 발송 '+x.quotes.length+(con?' → 계약 '+x.con.count+'건 · '+amt(x.con.net):''),
   '· 견적문의 '+x.newQ.length+'건'+up(x.newQ.length,x.newQp.length),'· 견적 발송 '+x.quotes.length+'건'+up(x.quotes.length,x.quotesP.length)];
  if(con)out.push('· 신규 계약 '+x.con.count+'건'+up(x.con.count,x.conP.count)+' · '+amt(x.con.net));
  out.push('· 문의 적합률 '+pctText(fitR)+' · 영업 메이드율 '+pctText(made)+' · 문의→계약 '+pctText(conv),
   '· 배드핏 '+x.bad.length+'건 (메이드율 제외) · 파이프라인 실주 '+x.loss.length+'건'+(x.loss.length?' ('+tallyText(tally(x.loss,lossReason))+')':''),line,
   '[전주 문제 → 결과]');
  if(fixes.length)fixes.forEach(f=>out.push('· '+f.issue+' '+f.n+'건 → '+[[f.r1,f.L[0]],[f.r2,f.L[1]],[f.left,f.L[2]]].filter(v=>v[0]).map(v=>v[0]+'건 '+v[1]).join(' / ')));else out.push('· (지난주에 등록한 항목 없음)');
  out.push(line,'파이프라인 이동',x.flow.slice(2).filter(f=>f[1]!=null).map(f=>f[0].replace(' · ','·')+' +'+f[1]).join(' · '),line);
  if(con){const m=Number(addDays(w.b,-1).slice(5,7));out.push('계약실적 '+x.con.count+'건 · '+amt(x.con.net),m+'월 누적 '+x.mCon.count+'건 · '+amt(x.mCon.net));x.con.list.forEach(k=>{const d=x.byId.get(String(k.r.deal_id));out.push('· '+String((d&&d.site)||k.r.site_name||'현장').replace(/^\[[^\]]+\]\s*/,'')+' '+amt(k.e.amount_delta));});}
  else out.push('계약실적: 원장을 읽지 못해 표시하지 않음');
  out.push(line,'담당자별');
  const act=x.people.filter(p=>p.c.count||p.s0!==p.s1);if(act.length)act.forEach(p=>out.push('· '+p.n+' 정체 '+p.s0+'→'+p.s1+' / 계약 '+(p.c.count?p.c.count+'건 · '+amt(p.c.net):'0건')));else out.push('· (정체 · 계약 변화 없음)');
  out.push(line,'다음 주 반드시 끝낼 것');
  if(regd.length)regd.forEach(p=>out.push('· '+p.t+' — '+(p.owner||'담당 미정')+' · '+(p.due||'기한 미정')));else out.push('· (회의에서 등록하면 담당 · 기한과 함께 들어갑니다)');
  if(x.ce.length)out.push('계약 예상 '+x.ce.length+'건 · '+amt(x.ceAmt));
  out.push(line,'전체: 진행 '+x.OPEN.length+(con?' · 수주 '+x.yCon.count+' · 승률 '+pctText(pct(x.yCon.count,x.yCon.count+x.yLoss)):'')+' · 180일+ 방치 '+x.stale180);
  return out.join('\n');
 }
 /* ── 그리기 ── */
 let CUR=null;
 function html(x){
  const R=root,w=x.w,con=x.L.ready,none='<b class="bb-na">—</b>';
  const dl=(a,b,unit)=>a===b?'전주와 같음 ('+b+(unit||'')+')':(a>b?'▲'+(a-b):'▼'+(b-a))+' (전주 '+b+(unit||'')+')',dc=(a,b)=>a>b?'up':a<b?'down':'';
  const fixes=promisesOf(w.p).map(p=>evalPromise(x,p)),regd=promisesOf(w.a),isReg=k=>regd.find(p=>p.kind===k),admin=!!(R.OpsStore&&R.OpsStore.admin());
  /* 1. 이번 주 성과 */
  const fn=[['신규 견적문의',x.newQ.length+'건',dl(x.newQ.length,x.newQp.length),dc(x.newQ.length,x.newQp.length),''],['적합 문의',x.fit+'건','배드핏 '+x.bad.length+' 제외','',''],['견적 발송',x.quotes.length+'건',dl(x.quotes.length,x.quotesP.length),dc(x.quotes.length,x.quotesP.length),''],
   ['신규 계약',con?x.con.count+'건 · '+amt(x.con.net):'원장 확인 중',con?(x.con.count>=x.conP.count?'▲':'▼')+Math.abs(x.con.count-x.conP.count)+'건 · '+(x.con.net>=x.conP.net?'+':'-')+amt(Math.abs(x.con.net-x.conP.net)):'계약실적 원장을 읽는 중입니다','up',' last']];
  const fitR=pct(x.fit,x.newQ.length),fitRp=pct(x.fitP,x.newQp.length),made=con?pct(x.con.count,x.con.count+x.loss.length):null,madeP=con?pct(x.conP.count,x.conP.count+x.lossP.length):null,conv=con?pct(x.con.count,x.newQ.length):null,convP=con?pct(x.conP.count,x.newQp.length):null,coh=x.linked?pct(x.cwon,x.cohort.length):null;
  const pp=(a,b)=>a==null||b==null?'':(a>=b?'▲':'▼')+Math.abs(Math.round((a-b)*10)/10).toFixed(1)+'%p';
  const rates=[['문의 적합률',pctText(fitR),pp(fitR,fitRp),'적합 '+x.fit+' ÷ 문의 '+x.newQ.length+' · 문의 품질'],
   ['영업 메이드율',pctText(made),pp(made,madeP),con?'수주 '+x.con.count+' ÷ (수주 '+x.con.count+' + 파이프라인 실주 '+x.loss.length+') · 배드핏 제외':'계약실적 원장을 읽은 뒤 계산합니다'],
   ['문의 → 계약 전환율',pctText(conv),pp(conv,convP),con?'계약 '+x.con.count+' ÷ 문의 '+x.newQ.length+' · 이번 주 활동 비율':'계약실적 원장을 읽은 뒤 계산합니다'],
   ['확정 전환율 ('+Number(x.ym.slice(5))+'월 문의)',pctText(coh),'',x.cohort.length?(x.linked?Number(x.ym.slice(5))+'월 문의 '+x.cohort.length+'건 중 지금까지 계약 '+x.cwon+'건 · 진짜 전환 성과':Number(x.ym.slice(5))+'월 문의 '+x.cohort.length+'건 — 문의와 영업건의 연결 기록이 없어 계산할 수 없습니다'):Number(x.ym.slice(5))+'월에 접수된 문의가 없습니다']];
  const lossT=tally(x.loss,lossReason),chg=x.loss.filter(d=>{try{return !!(R.DealKeyman&&R.DealKeyman.changeOf(d));}catch(e){return false;}}).length;
  const s1='<section class="bb-card bb-main"><div class="bb-cap"><span>이번 주 성과</span><small>견적문의가 계약까지 얼마나 이어졌나</small></div>'
   +'<div class="bb-funnel">'+fn.map(u=>'<div class="bb-fn'+u[4]+'"><span>'+h(u[0])+'</span><b>'+h(u[1])+'</b><em class="'+u[3]+'">'+h(u[2])+'</em></div>').join('')+'</div>'
   +'<div class="bb-rates">'+rates.map(t=>'<div><span>'+h(t[0])+'</span><p><b>'+h(t[1])+'</b><em class="'+(/^▼/.test(t[2])?'down':'up')+'">'+h(t[2])+'</em></p><small>'+h(t[3])+'</small></div>').join('')+'</div>'
   +'<div class="bb-two"><div class="bb-bad"><p><b>견적문의 배드핏 '+x.bad.length+'건</b><span>영업 실패 아님 · 메이드율에서 제외</span></p><span>'+h(x.bad.length?tallyText(tally(x.bad,badfitReason)):'이번 주 배드핏 종결 없음')+'</span></div>'
   +'<div class="bb-loss"><p><b>파이프라인 실주 '+x.loss.length+'건</b><span>영업기회 상실 · 메이드율에 포함</span></p><span>'+h(x.loss.length?tallyText(lossT):'이번 주 실주 없음')+(chg?' · <b>관리소장 변경 이력 '+chg+'건</b>':'')+'</span></div></div></section>';
  /* 2. 전주 문제 → 조치 → 결과 */
  const fixed=fixes.reduce((a,f)=>a+f.r1+f.r2,0),total=fixes.reduce((a,f)=>a+f.n,0);
  const s2='<section class="bb-card bb-flat"><div class="bb-h"><b>전주 문제 → 이번 주 조치 → 결과</b><span>지난주 회의에서 정한 것'+(fixes.length?' · 해결 '+fixed+' / '+total+'건':'')+'</span></div><div class="bb-thead bb-fixcols"><span>전주 이슈</span><span>이번 주 조치</span><span>결과</span></div>'
   +(fixes.length?fixes.map(f=>{const n=f.n||1;return '<div class="bb-fix bb-fixcols"><div><b>'+h(f.issue)+'</b><span>'+f.n+'건</span></div><span class="act">'+h(f.act)+'</span><div class="res"><div class="bar"><i style="width:'+(f.r1/n*100)+'%;background:#15171c"></i><i style="width:'+(f.r2/n*100)+'%;background:#9aa0ab"></i><i style="width:'+(f.left/n*100)+'%;background:#f0b4b4"></i></div><span><b>'+f.r1+'건 '+h(f.L[0])+'</b>'+(f.r2?' <span class="g">· '+f.r2+'건 '+h(f.L[1])+'</span>':'')+(f.left?' <b class="r">· '+f.left+'건 '+h(f.L[2])+'</b>':'')+'</span></div></div>';}).join('')
    :'<p class="bb-empty">지난주에 등록한 항목이 없습니다 — 아래 ‘다음 주 반드시 끝낼 것’에서 [등록]하면 다음 주 이 표에서 결과를 확인합니다.</p>')+'</section>';
  /* 3. 영업 이동 · 4. 계약실적 */
  const fmx=Math.max(1,...x.flow.map(f=>f[1]||0));
  const top2=x.flow.slice(2,6).map(f=>[f[0],f[1]-f[2]]).filter(f=>f[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,2),tot=x.flow.slice(2).reduce((a,f)=>a+(f[1]||0),0),totP=x.flow.slice(2).reduce((a,f)=>a+(f[2]||0),0);
  const note=!tot?'이번 주에 단계가 바뀐 기록이 없습니다 — 단계 변경이 기록돼야 이동이 보입니다.':(top2.length?top2.map(f=>f[0]+' +'+f[1]).join(' · ')+' — ':'')+(tot>totP?'지난주보다 '+(tot-totP)+'건 더 움직였습니다':tot<totP?'지난주보다 '+(totP-tot)+'건 덜 움직였습니다':'지난주와 같은 수준입니다')+(con&&x.con.count?', 계약까지 '+x.con.count+'건이 넘어갔습니다.':'.');
  const s3='<section class="bb-card"><div class="bb-h in"><b>이번 주 영업 이동</b><span>이번 주에 그 단계로 들어온 건 · 괄호 = 전주 대비</span></div>'
   +x.flow.map((f,i)=>f[1]==null?'<div class="bb-move"><span>'+h(f[0])+'</span><span class="bar"></span><b>—</b><em></em></div>':'<div class="bb-move"><span>'+h(f[0])+'</span><span class="bar"><i style="width:'+(f[1]/fmx*100)+'%;background:'+(i===x.flow.length-1?'#1f7a4d':'#15171c')+'"></i></span><b>+'+f[1]+'</b><em class="'+(f[1]-f[2]>=0?'up':'down')+'">('+(f[1]-f[2]>=0?'+':'')+(f[1]-f[2])+')</em></div>').join('')
   +'<span class="bb-note">'+h(note)+'</span></section>';
  const mLabel=Number(addDays(w.b,-1).slice(5,7))+'월';
  const s4='<section class="bb-card"><div class="bb-h in"><b>이번 주 계약실적</b><span>계약 체결일 기준 · 계약금액</span></div>'
   +(con?'<div class="bb-big"><b>'+x.con.count+'건 · '+amt(x.con.net)+'</b><span class="'+(x.con.net>=x.conP.net?'up':'down')+'">전주 '+x.conP.count+'건 · '+amt(x.conP.net)+' → '+(x.con.net>=x.conP.net?'+':'-')+amt(Math.abs(x.con.net-x.conP.net))+'</span></div><span class="bb-cum">'+mLabel+' 누적 <b>'+x.mCon.count+'건 · '+amt(x.mCon.net)+'</b> · 연 누적 '+x.yCon.count+'건 · '+amt(x.yCon.net)+'</span>'
    +'<div class="bb-cons">'+(x.con.list.length?x.con.list.map(k=>{const d=x.byId.get(String(k.r.deal_id))||(R.B.deals||[]).find(z=>String(z.id)===String(k.r.deal_id)),work=d?R.dealWorkSummary(d):'';return '<div style="border-left-color:'+(BRAND[k.r.brand]||'#9aa0ab')+'"><div><b>'+h((d&&d.site)||k.r.site_name||'현장명 미확인')+'</b><span>'+h([k.r.brand,work&&!/미분류|미기록/.test(work)?work:'',R.repN(k.r.sales_owner_name),md(k.e.effective_date)].filter(Boolean).join(' · '))+'</span></div><b>'+amt(k.e.amount_delta)+'</b></div>';}).join(''):'<p class="bb-empty">이번 주에 체결된 계약이 없습니다.</p>')+'</div>'
    :'<p class="bb-empty">'+(x.L.status==='loading'||x.L.status==='idle'?'계약실적 원장을 읽는 중입니다…':'계약실적 원장을 읽지 못했습니다 — 숫자를 지어내지 않고 비워 둡니다.')+'</p>')+'</section>';
  /* 5. 담당자별 움직임 */
  const s5='<section class="bb-card bb-flat"><div class="bb-h"><b>담당자별 움직임</b><span>보유량 → 해결한 문제 → 앞으로 보낸 건 → 계약</span></div><div class="bb-thead bb-pcols"><span>담당</span><span>진행</span><span title="'+STALE()+'일 넘게 접촉 없음">장기정체</span><span>문의 · 견적</span><span>계약</span><span>한 줄</span></div>'
   +x.people.map(p=>'<div class="bb-prow bb-pcols"><b>'+h(p.n)+'</b><span>'+p.o0+' → '+p.o1+(p.o1!==p.o0?' <small>('+(p.o1>p.o0?'+':'')+(p.o1-p.o0)+')</small>':'')+'</span><span>'+p.s0+' → '+p.s1+(p.s1<p.s0?' <em class="up">▼'+(p.s0-p.s1)+'</em>':p.s1>p.s0?' <em class="down">▲'+(p.s1-p.s0)+'</em>':'')+'</span><span>문의 '+p.q+' · 견적 '+p.qt+'</span><b class="'+(p.c.count?'up':'mut')+'">'+(con?(p.c.count?p.c.count+'건 · '+amt(p.c.net):'0건'):'—')+'</b><span class="note'+(p.red?' r':'')+'">'+h(p.note)+'</span></div>').join('')+'</section>';
  /* 6. 다음 주 반드시 끝낼 것 */
  const s6='<section class="bb-card bb-main bb-flat"><div class="bb-h"><b>다음 주 반드시 끝낼 것</b><span>회의에서 담당 · 기한 정하고 [등록] → 다음 주 ‘전주 문제 → 결과’로 그대로 확인</span><i></i>'+(x.ce.length?'<strong>계약 예상 '+x.ce.length+'건 · '+amt(x.ceAmt)+'</strong>':'')+'</div>'
   +(x.cands.length?x.cands.map((c,i)=>{const r=isReg(c.kind),own=r?r.owner:(SEL.own[c.kind]||c.owners[0]||''),due=r?r.due:(SEL.due[c.kind]||c.due);
     return '<div class="bb-next'+(r?' done':'')+'"><span class="no">'+(i+1)+'</span><div class="tx"><b>'+h(c.t)+'</b><span>'+h(c.why)+'</span></div><div class="ctl"><div class="own">'+(c.owners.length?c.owners.map(o=>'<button type="button" data-bb="own" data-k="'+c.kind+'" data-v="'+attr(o)+'" aria-pressed="'+(own===o)+'"'+(r?' disabled':'')+'>'+h(o)+'</button>').join(''):'<small>담당 미정</small>')+'</div><div class="due">'+DUES.map(o=>'<button type="button" data-bb="due" data-k="'+c.kind+'" data-v="'+o+'" aria-pressed="'+(due===o)+'"'+(r?' disabled':'')+'>'+o+'</button>').join('')+'</div><button type="button" class="reg" data-bb="reg" data-k="'+c.kind+'"'+(admin?'':' disabled title="관리자만 등록할 수 있습니다"')+'>'+(r?'등록됨 ✓':'등록')+'</button></div></div>';}).join('')
    :'<p class="bb-empty">규칙에 걸린 항목이 없습니다 — 입찰 임박 · 견적 지연 · 미응대 · 장기 미접촉 · 다음 행동 미등록 · 계약 예상이 생기면 여기에 뜹니다.</p>')+'</section>';
  /* 7. 전체 현황(참고) */
  const s7='<section class="bb-ref"><div><b>전체 현황 (참고)</b><span>진행 '+x.OPEN.length+'건'+(con?' · 올해 수주 '+x.yCon.count+'건 · 승률 '+pctText(pct(x.yCon.count,x.yCon.count+x.yLoss)):'')+' · 180일+ 방치 '+x.stale180+'건</span></div><div class="row">'+x.people.map(p=>'<span><b>'+h(p.n)+'</b> 진행 '+p.o1+' · 방치 '+p.stale180+(con?' · 수주 '+contractsIn(x.L,w.a.slice(0,4)+'-01-01',w.b,p.n).count:'')+'</span>').join('')+'</div></section>';
  /* 오른쪽: 잔디 미리보기 */
  const J=jandi(x,fixes,regd),store=canStore();
  const aside='<aside class="bb-side"><section class="bb-card"><div class="bb-h in"><b>잔디 미리보기</b><span>관리자 · 팀장 · 대표</span></div><div class="bb-jandi" id="bbJandi">'+h(J)+'</div><dl><dt>자동 발송</dt><dd>매주 월요일 08:30</dd><dt>상태</dt><dd class="'+(SENT===w.a?'ok':'')+'">'+(SENT===w.a?'정한 내용 저장 · 글 복사됨 ✓':'자동 발송 연결 전 — 지금은 글을 복사해 잔디에 붙여 넣습니다')+'</dd></dl><button type="button" class="send" data-bb="send"'+(admin?'':' disabled title="관리자만 보낼 수 있습니다"')+'>회의 끝 · 정한 내용 넣어 다시 보내기</button>'+(store?'':'<small class="bb-off">저장소 연결 전 — 등록한 항목은 이 화면에서만 유지됩니다</small>')+'</section></aside>';
  return '<div id="brief-b" class="bb" data-workspace="brief"><div class="bb-head"><b>'+h(rangeText(w))+'</b><span>지난주 대비 무엇이 움직였나</span><i></i><button type="button" class="bb-lnk" onclick="setBriefView(\'month\')">월간 일정 보기</button></div>'
   +'<div class="bb-body"><div class="bb-col">'+s1+s2+'<div class="bb-grid2">'+s3+s4+'</div>'+s5+s6+s7+'</div>'+aside+'</div></div>';
 }
 /* ── 등록 · 다시 보내기 ── */
 function payloadOf(x){return {range:rangeText(x.w),basis:'weekly-b',kpis:[['신규 견적문의',x.newQ.length+'건'],['적합 문의',x.fit+'건'],['견적 발송',x.quotes.length+'건'],['신규 계약',x.L.ready?x.con.count+'건 · '+amt(x.con.net):'원장 미확인']],jandi:jandi(x,promisesOf(x.w.p).map(p=>evalPromise(x,p)),promisesOf(x.w.a))};}
 function savePromises(x,list,done){
  const O=root.OpsStore,k=x.w.a;
  if(!canStore()){MEM[k]=list;toast('저장소 연결 전 — 이 화면에서만 유지됩니다','warn');done&&done(true);root.paintBrief();return;}
  const prev=SN.map[k];SN.map[k]=Object.assign({},prev||{kind:'weekly',period_key:k},{promises:list});root.paintBrief();
  O.rpc('crm_report_snapshot_save_v1',{kind:'weekly',period_key:k,payload:payloadOf(CUR||x),promises:list}).then(()=>{done&&done(true);}).catch(e=>{if(prev)SN.map[k]=prev;else delete SN.map[k];toast(String(e.message||e),'warn');done&&done(false);root.paintBrief();});
 }
 function onClick(e){
  const b=e.target.closest('#brief-b [data-bb]');if(!b||b.disabled||!CUR)return;const a=b.dataset.bb,k=b.dataset.k,x=CUR;
  if(a==='own'){SEL.own[k]=b.dataset.v;root.paintBrief();return;}
  if(a==='due'){SEL.due[k]=b.dataset.v;root.paintBrief();return;}
  if(a==='reg'){
   const c=x.cands.find(z=>z.kind===k);if(!c)return;const list=promisesOf(x.w.a).slice(),i=list.findIndex(p=>p.kind===k);
   if(i>=0)list.splice(i,1);else list.push({kind:k,t:c.t,why:c.why,act:c.act,n:c.n,ids:c.ids.slice(0,300),owner:SEL.own[k]||c.owners[0]||'',due:SEL.due[k]||c.due,at:new Date().toISOString(),by:(root.ME&&root.ME.name)||''});
   SENT='';savePromises(x,list,ok=>{if(ok&&canStore())toast(i>=0?'등록을 취소했습니다':'등록했습니다 — 다음 주 ‘전주 문제 → 결과’에서 확인합니다');});return;
  }
  if(a==='send'){
   const text=document.getElementById('bbJandi')?.textContent||'';
   const copy=()=>{const fin=()=>{SENT=x.w.a;toast('정한 내용을 저장하고 글을 복사했습니다 — 잔디에 붙여 넣어 주세요');root.paintBrief();};try{const p=navigator.clipboard&&navigator.clipboard.writeText(text);if(p&&p.then)p.then(fin).catch(fin);else fin();}catch(err){fin();}};
   savePromises(x,promisesOf(x.w.a).slice(),ok=>{if(ok)copy();});return;
  }
 }
 function boot(){
  const base=root.paintBrief;if(typeof base!=='function')return;
  root.paintBrief=function(){
   const week=document.getElementById('b-week'),month=document.getElementById('b-month'),pg=document.getElementById('pg-brief');
   if(pg)pg.classList.toggle('bb-on',enabled()&&root.G.briefView!=='month');
   if(!enabled()||!week||root.G.briefView==='month')return base.apply(this,arguments);
   try{
    if(pg){pg.classList.add('bv-on','bv-weekview');}
    loadSnaps();root.briefViewButtons?.();if(month)month.style.display='none';week.style.display='block';CUR=data();week.innerHTML=html(CUR);
    if(!week.__bb){week.__bb=true;week.addEventListener('click',onClick);}
   }catch(e){console.warn('[주간 브리핑 B]',e);return base.apply(this,arguments);}
  };
  root.addEventListener('contract-sales:changed',()=>{try{if(root.G.page==='brief'&&enabled())root.paintBrief();}catch(e){}});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.BriefB={enabled,win,data,badfit,badfitReason,evalPromise,jandi:x=>jandi(x,promisesOf(x.w.p).map(p=>evalPromise(x,p)),promisesOf(x.w.a))};
})(window);
