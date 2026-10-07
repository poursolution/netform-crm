/* KPI 측정 기준 (2026-10-07 design_handoff_kpi_measure · 시안 'KPI 측정 기준 시안.dc.html')
   관리팀 KPI 메뉴의 세 번째 탭 '측정 기준'. 기존 핵심 지표 · 단계별 기준 탭과 배치는 그대로 두고, 지표를 4묶음으로 다시 보여 준다.
     기록 완성도 — 자료 발송일 입력률 · 관계관리 분류 완료율 · 실주 결과 기록 완성
     행동 준수   — 발송 후 7일 후속 · 집중관리 7일 후속 · 일반관리 월 1회 · 대기 2개월 1회 · 미팅 후 3일 견적 요청(시범) · 착공 후 주 1회 방문
     영업 결과   — 메이드율 · 낙찰 실적
     관리팀 처리 — 기한 내 해결률 · 평균 처리 시간
   규칙
     · 행동 준수는 '기한이 도래한 측정 가능 건'만 분모. 분모 0이면 100%가 아니라 '측정 불가'(회색) + 사유 · 보완 건수.
     · 미확정 기준(미팅 후 3일 견적 요청)은 '시범 측정 · 평가 제외' — 미달 · 달성 · 담당자 알약에 넣지 않는다. 물량 산출 3/5일과 별개.
     · 모든 칸을 누르면 아래 '지표 근거': 숫자 3칸 · 계산식 · 포함 · 제외 · 적용 기준 · 해당 현장 목록(판정 · 근거일 · 보완할 것, 20건 쪽 번호).
   판정은 새로 만들지 않는다: 단계 판정 PipelineJudge(발송일 · 미팅일) · 관계관리 RelV12.state · 단계 화면 PipelineStageB.model(bucket · rs) · 요청 WorkRequest 를 그대로 쓴다.
   끄기: G.kpiMeasureOff=true → 세 번째 탭 없음 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const J=()=>R.PipelineJudge&&R.PipelineJudge.on()?R.PipelineJudge:null;
 const enabled=()=>!R.G.kpiMeasureOff&&!!J();
 const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
 const today=()=>KST.format(new Date());
 const dk=v=>{const j=J();return j?j.dayKey(v):String(v||'').slice(0,10);};
 const addDays=(k,n)=>{const d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return KST.format(d);};
 const md=k=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(k||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const pct=(a,b)=>b?Math.round(a*1000/b)/10:null;
 const fmt=v=>v==null?'–':(Math.round(v*10)/10)+'%';
 const eok=n=>(Math.round((Number(n)||0)/1e7)/10)+'억';
 const VER=()=>{let v='';try{v=R.CRMRules&&R.CRMRules.VERSION||'';}catch(e){}return '운영 기준 v'+(v||'2026-10');};
 const PILOT_TAG='시범 측정 · 평가 제외',NA_TAG='측정 불가';
 const days=()=>{const o=R.OPS_RULES||{},N=(k,d)=>Number(o[k])||d;return {follow:N('sentFollowDays',7),quote:N('quoteDays',3),site:N('siteVisitDays',7),focus:N('focusContactDays',7),month:N('monthContactDays',30),wait:N('waitContactDays',60)};};
 const items=()=>{try{return R.KpiV7&&R.KpiV7.allItems?R.KpiV7.allItems():[];}catch(e){return [];}};
 const patchOf=d=>{try{return (R.itemPatch&&R.itemPatch(d,'deal'))||{};}catch(e){return {};}};
 const ctxMeta=(d,stage)=>{const c=(d.stage_contexts||patchOf(d).stage_contexts||{})[stage];return c&&typeof c==='object'?c:{};};
 /* 영업건의 연락 날짜(시도 · 연결) — 후속 연락이 기한 안에 있었는지 보는 근거. 기록된 것만 센다 */
 function contactDays(d){
  const seen=new Set(),out=[],F=R.InquiryFlow;
  [].concat(d.activities||[],patchOf(d).activities||[]).forEach(a=>{if(!a)return;const k=a.id||[a.at,a.type,a.note,a.result].join('|');if(seen.has(k))return;seen.add(k);let l=null;try{l=F&&F.logOf?F.logOf(a):null;}catch(e){}if(!l)return;const day=dk(l.at);if(day)out.push(day);});
  try{const c=R.ContactState.of(d,'deal');[c.lastAttemptAt,c.lastConnectedAt].forEach(v=>{const k=dk(v);if(k)out.push(k);});}catch(e){}
  return out.sort();
 }
 const row=(x,j,cls,e)=>({k:String(x.row.key),s:x.row.site||'현장명 미입력',w:x.row.owner||'미배정',j,cls,e});
 const ORDER={bad:0,na:1,ok:2};
 const sortRows=rows=>rows.map((r,i)=>[r,i]).sort((a,b)=>(ORDER[a[0].cls]-ORDER[b[0].cls])||a[1]-b[1]).map(x=>x[0]);
 /* 지표 하나 만들기: ok = 준수(또는 입력됨) 목록 · bad = 미준수 · na = 측정 불가. 분모 = ok + bad */
 function make(o){
  const den=o.ok.length+o.bad.length,rows=sortRows([].concat(o.bad,o.na,o.ok,o.wait||[]));
  const v=den?pct(o.ok.length,den):null,na=!den;
  return {id:o.id,g:o.g,label:o.label,pilot:!!o.pilot,state:o.pilot?'pilot':na?'na':'ok',v,vText:na?NA_TAG:fmt(v),num:o.ok.length,den,sub:o.sub(o.ok.length,den,o),
   n:o.n,f:o.f,inc:o.inc,exc:o.exc,ver:o.ver||VER(),rows,goal:o.goal||null};
 }
 /* ── 기록 완성도 ── */
 function recordGroup(I){
  const out=[];
  /* a1 자료 발송일 입력률 */
  const S=I.filter(x=>x.stage==='sent'),has=S.filter(x=>J().sentOfDeal(x.row.item)),no=S.filter(x=>!J().sentOfDeal(x.row.item));
  out.push(make({id:'a1',g:'record',label:'자료 발송일 입력률',
   ok:has.map(x=>row(x,'입력됨','ok','발송 '+md(J().sentOfDeal(x.row.item)))),bad:no.map(x=>row(x,'미입력','bad','발송일 · 자료 · 수신자 입력')),na:[],
   n:[['입력됨',has.length,''],['미입력',no.length,'bad'],['해당 없음',0,'na']],
   sub:(a,d)=>d?a+' / '+d+' · 발송일 보완 '+no.length+'건':'자료 발송완료 단계 건 없음',
   f:'발송일 입력 건 ÷ 자료 발송완료 단계 건 × 100',inc:'자료 발송완료 단계 · 진행 중',exc:'종결 · 휴지통 · 과거 이관(진행 범위 밖)'}));
  /* a2 관계관리 분류 완료율 */
  const Rl=I.filter(x=>x.stage==='relationship').map(x=>({x,s:R.RelV12?R.RelV12.state(x.row):null})).filter(o=>o.s),cl=Rl.filter(o=>o.s.classified),un=Rl.filter(o=>!o.s.classified);
  out.push(make({id:'a2',g:'record',label:'관계관리 분류 완료율',
   ok:cl.map(o=>row(o.x,'분류됨','ok',o.s.tag)),bad:un.map(o=>row(o.x,'미확인','bad',(o.s.promised?'약속 연락 먼저 · ':'')+'견적 발송일 확인 → 재분류')),na:[],
   n:[['분류됨',cl.length,''],['미확인',un.length,'bad'],['해당 없음',0,'na']],
   sub:(a,d)=>d?a+' / '+d+' · 분류 보완 '+un.length+'건':'관계관리 단계 건 없음',
   f:'집중 · 일반 · 대기 · 보류로 분류된 건 ÷ 관계관리 건',inc:'관계관리 단계 · 진행 중',exc:'종결',ver:'관계관리 v12 기준 · '+VER()}));
  /* a3 실주 결과 기록 완성 — 사유 + 재영업 여부(경쟁사 낙찰일 때만 경쟁사 · 낙찰가 추가). 실주 화면 · 핵심 지표 7과 같은 완료 판정(bucket) */
  const L=I.filter(x=>x.stage==='lost'),fin=L.filter(x=>x.bucket!=='nore'),mis=L.filter(x=>x.bucket==='nore'),na3=L.filter(x=>/경쟁사 해당 없음/.test(String(x.sub||''))).length;
  const need=x=>[x.rs.includes('noreason')?'실주 사유':'',x.rs.includes('relist')?'재영업 가능 여부':'',x.rs.includes('nobid')?'경쟁사 · 낙찰가':''].filter(Boolean).join(' · ')||'기록 보완';
  out.push(make({id:'a3',g:'record',label:'실주 결과 기록 완성',
   ok:fin.map(x=>row(x,'완성','ok','사유 · 재영업 여부 있음')),bad:mis.map(x=>row(x,'보완 필요','bad',need(x)+' 입력')),na:[],
   n:[['완성',fin.length,''],['보완 필요',mis.length,'bad'],['경쟁사 해당 없음',na3,'na']],
   sub:(a,d)=>d?a+' / '+d+' · 사유 + 재영업 여부 기준':'실주 건 없음',
   f:'사유 + 재영업 가능 여부 둘 다 있는 실주 ÷ 실주',inc:'실주 단계 전체',exc:'없음 · 경쟁사 · 낙찰가는 경쟁사 낙찰일 때만 추가 필수(사업 취소 · 중단 · 연기는 해당 없음)',ver:'7단계 2차 보완 기준 · '+VER()}));
  return out;
 }
 /* ── 행동 준수 ── */
 function actionGroup(I){
  const T=today(),q=days(),out=[],J1=J();
  /* b1 발송 후 7일 후속 — 발송일 있는 건만 · 7일이 지난 건만 분모. 후속 = 발송일부터 7일 안에 기록된 연락(시도 · 연결) */
  const o1={ok:[],bad:[],na:[],wait:[]};
  I.filter(x=>x.stage==='sent').forEach(x=>{const d=x.row.item,sd=J1.sentOfDeal(d);
   if(!sd){o1.na.push(row(x,NA_TAG,'na','발송일 없음 · 발송일 입력'));return;}
   const due=addDays(sd,q.follow);
   if(T<=due){o1.wait.push(row(x,'기한 전','na','발송 '+md(sd)+' · 후속 기한 '+md(due)));return;}
   const c=contactDays(d).find(k=>k>=sd&&k<=due);
   if(c)o1.ok.push(row(x,'준수','ok','발송 '+md(sd)+' · 후속 '+md(c)));else o1.bad.push(row(x,'미준수','bad','발송 '+md(sd)+' · 후속 기록 없음 · 후속 연락'));});
  out.push(make(Object.assign(o1,{id:'b1',g:'action',label:'발송 후 '+q.follow+'일 후속 준수',
   n:[['준수',o1.ok.length,''],['미준수',o1.bad.length,'bad'],[NA_TAG,o1.na.length,'na']],
   sub:(a,d)=>'측정 가능 '+d+' · 발송일 보완 '+o1.na.length+(o1.wait.length?' · 기한 전 '+o1.wait.length:''),
   f:'기한 내 후속 완료 ÷ 기한이 도래한 측정 가능 건 × 100 · 분모 0 → 측정 불가',inc:'자료 발송완료 단계 · 발송일 있음 · 발송 후 '+q.follow+'일 지남(후속 = 발송일부터 '+q.follow+'일 안 기록된 연락)',exc:'발송일 없음 '+o1.na.length+' · 기한 전 '+o1.wait.length+' · 과거 이관 · 종결',ver:VER()+' · '+q.follow+'일 = 회의 결정',goal:null})));
  /* b2~b4' 관계관리: 그 상태로 분류된 고객만 · 미확인은 제외(분류 보완 대상) */
  const Rl=I.filter(x=>x.stage==='relationship').map(x=>({x,s:R.RelV12?R.RelV12.state(x.row):null})).filter(o=>o.s),unk=Rl.filter(o=>o.s.key==='unk').length;
  const rel=(id,label,key,cyc,basis)=>{const o={ok:[],bad:[],na:[]};
   Rl.filter(c=>c.s.key===key).forEach(c=>{const s=c.s;
    if(!s.due){o.na.push(row(c.x,NA_TAG,'na','기준일 없음 · 견적 발송일 · 연락 기록 입력'));return;}
    if(s.od)o.bad.push(row(c.x,'미준수','bad',s.dueWhy+' '+md(s.due)+' 지남 · '+(s.last==null?'연락 기록 없음':'마지막 연락 '+s.last+'일 전')));
    else o.ok.push(row(c.x,'준수','ok',s.dueWhy+' '+md(s.due)+'까지'));});
   out.push(make(Object.assign(o,{id,g:'action',label,
    n:[['준수',o.ok.length,''],['미준수',o.bad.length,'bad'],['미확인 제외',unk,'na']],
    sub:(a,d)=>d?a+' / '+d+' · 미확인 '+unk+' 제외':(key==='focus'?'집중관리':key==='normal'?'일반관리':'대기')+'로 분류된 고객 0 · 미확인 '+unk+' 제외',
    f:basis,inc:'관계관리 · 상태 = '+({focus:'집중관리',normal:'일반관리',wait:'대기'})[key]+' · 고객과 약속한 연락일이 있으면 그 날짜 우선',exc:'미확인 '+unk+' (분류 보완 대상) · 보류',ver:VER()+' · '+cyc})));};
  rel('b2','집중관리 '+q.focus+'일 후속','focus','7일 = 회의 결정 · 1개월 = 잠정(설정)','집중관리 고객 중 '+q.focus+'일 안 후속 ÷ 집중관리 고객');
  rel('b2n','일반관리 월 1회 접촉','normal','월 1회 = 회의 결정 · 기간 = 해석 미확정(설정)','일반관리 고객 중 한 달 안 접촉 ÷ 일반관리 고객');
  rel('b2w','대기 '+Math.round(q.wait/30)+'개월 1회 접촉','wait',Math.round(q.wait/30)+'개월 = 회의 결정','대기 고객 중 '+Math.round(q.wait/30)+'개월 안 연락 ÷ 대기 고객');
  /* b3 미팅 후 3일 견적 요청 — 미확정 기준: 시범 측정 · 평가 제외. 물량 산출 기한(견적 요청 등록일부터 3/5일 · 견적팀)과 별개 */
  const o3={ok:[],bad:[],na:[],wait:[]};
  I.filter(x=>x.stage==='consulting').forEach(x=>{const d=x.row.item,mt=J1.meetingOf(d);
   if(!mt||mt>T){if(x.bucket==='done')o3.na.push(row(x,NA_TAG,'na','미팅일 없음 · 미팅 완료일 입력'));return;}
   const f=(ctxMeta(d,'consulting').fields)||{},has=!!(String(f.quote_request||'').trim()||dk(f.quote_due)),at=dk(ctxMeta(d,'consulting').edited_at||ctxMeta(d,'consulting').recorded_at||''),due=addDays(mt,q.quote);
   if(has){if(!at){o3.na.push(row(x,NA_TAG,'na','견적 요청 등록일 없음 · 미팅 '+md(mt)));return;}
    if(at<=due)o3.ok.push(row(x,'준수','ok','미팅 '+md(mt)+' · 요청 '+md(at)));else o3.bad.push(row(x,'미준수','bad','미팅 '+md(mt)+' · 요청 '+md(at)+' (기한 '+md(due)+')'));return;}
   if(T>due)o3.bad.push(row(x,'미준수','bad','미팅 '+md(mt)+' · 요청 없음 · 견적 요청 등록'));else o3.wait.push(row(x,'기한 전','na','미팅 '+md(mt)+' · 기한 '+md(due)));});
  out.push(make(Object.assign(o3,{id:'b3',g:'action',pilot:true,label:'미팅 후 '+q.quote+'일 견적 요청',goal:80,
   n:[['준수',o3.ok.length,''],['미준수',o3.bad.length,'bad'],[NA_TAG,o3.na.length,'na']],
   sub:(a,d)=>'목표 80% · 미확정 기준'+(d?'':' · 측정 대상 없음'),
   f:'미팅 후 '+q.quote+'일 안 견적 요청 등록 ÷ 기한이 도래한 미팅 완료 건',inc:'컨설팅 설계 · 미팅 완료일 있음(미팅일 칸 → 방문 · 미팅 기록) · 요청 등록일 = 견적 요청 칸을 저장한 날',exc:'미팅일 없음 '+o3.na.length+' · 기한 전 '+o3.wait.length,ver:'미확정 기준 · 시범 측정 · 물량 산출 '+q.quote+'/5일과 별개'})));
  /* b4 착공 후 주 1회 방문 — 착공일 입력된 현장만(계약 · 시공 화면의 '주 1회 현장 방문 안 함'과 같은 조건) */
  const o4={ok:[],bad:[],na:[]};
  const lastDays=r=>{let a=null;try{a=R.activityAge(r.item);}catch(e){}const c=r.contactDays;if(a==null)return c==null?null:c;return c==null?a:Math.min(a,c);};
  o4.wait=[];
  I.filter(x=>x.stage==='construction'&&x.row.code==='construction').forEach(x=>{const d=x.row.item,sd=dk(J1.field(d,'construction','start_date')||''),cd=lastDays(x.row);
   if(!sd){o4.na.push(row(x,NA_TAG,'na','착공일 없음 · 착공일 입력'));return;}
   if(sd>T){o4.na.push(row(x,NA_TAG,'na','착공 예정 '+md(sd)+' · 아직 착공 전'));return;}
   if(x.rs.includes('site7'))o4.bad.push(row(x,'미준수','bad','착공 '+md(sd)+' · '+(cd==null?'접촉 기록 없음':'마지막 접촉 '+cd+'일 전')+' · 현장 확인'));
   else if(cd==null)o4.wait.push(row(x,'기한 전','na','착공 '+md(sd)+' · 착공 후 '+q.site+'일 전'));
   else o4.ok.push(row(x,'준수','ok','착공 '+md(sd)+' · 마지막 접촉 '+cd+'일 전'));});
  out.push(make(Object.assign(o4,{id:'b4',g:'action',label:'착공 후 주 1회 방문',
   n:[['준수',o4.ok.length,''],['미준수',o4.bad.length,'bad'],[NA_TAG,o4.na.length,'na']],
   sub:(a,d)=>d?a+' / '+d+' · 착공일 보완 '+o4.na.length+'건':'착공일 입력된 현장 0 · 계약 · 시공 화면과 같은 조건',
   f:'마지막 방문 · 접촉이 '+q.site+'일 안인 현장 ÷ 착공일이 입력된 시공 현장',inc:'계약 · 시공 · 시공 중 · 착공일 입력 현장',exc:'착공일 없음 '+o4.na.length+' (계약 · 시공 화면과 같은 조건) · 계약 진행 · 인계 중',ver:VER()+' · 주 1회 = 회의 결정'})));
  return out;
 }
 /* ── 영업 결과 ── 계약실적 원장 정책은 그대로 읽기만 한다(brief-b / dash-b 와 같은 함수) */
 function resultGroup(){
  const out=[],B=R.BriefB&&R.BriefB.lib,T=today(),y0=T.slice(0,4)+'-01-01';
  const pend=(id,label)=>make({id,g:'result',label,ok:[],bad:[],na:[],n:[['–','–',''],['–','–',''],['–','–','']],sub:()=>'계약 원장을 불러오는 중',f:'',inc:'',exc:'',ver:VER()});
  if(!B||typeof R.briefScopeDeals!=='function'){return [pend('c1','메이드율'),pend('c2','낙찰 실적 · 올해')];}
  let target='',L=null,AD=[],AQ=[];
  try{target=R.targetNameFilter();L=B.ledger(target);AD=R.briefScopeDeals(target,false);AQ=R.briefScopeInquiries(target,false);}catch(e){return [pend('c1','메이드율'),pend('c2','낙찰 실적 · 올해')];}
  if(!L||!L.ready)return [pend('c1','메이드율'),pend('c2','낙찰 실적 · 올해')];
  const b=B.addDays(T,1),inR=k=>!!k&&k>=y0&&k<b;
  const loss=AD.filter(d=>B.isLoss(d)&&inR(B.closedKey(d))),con=B.contractsIn(L,y0,b,null,'direct');
  let tf={count:0,amount:0,list:[]},tfLost=0,pt={count:0,amount:0,unknown:0,list:[]};
  try{const DT=R.DealTransfer&&R.DealTransfer.enabled()?R.DealTransfer:null;if(DT){tf=DT.wonIn(y0,b,target);tfLost=DT.lostIn(y0,b,target);}}catch(e){}
  try{const DW=R.DealWin&&R.DealWin.enabled()?R.DealWin:null;if(DW)pt=DW.partnerIn(y0,b,target);}catch(e){}
  const bad=AQ.filter(x=>{try{return inR(B.K(R.inquiryCreatedAt(x)))&&B.badfit(x);}catch(e){return false;}}).length;
  const site=new Map();try{R.PipelineWorkspace.rows({unscoped:true}).forEach(r=>site.set(String(r.key),r));}catch(e){}
  const nameOf=id=>{const r=site.get(String(id));return {s:r?r.site:'현장명 미상',w:r?r.owner:'',k:r?String(r.key):''};};
  const won=con.count+pt.count+tf.count,lost=loss.length+tfLost,made=B.made(con.count,lost,tf.count,pt.count);
  const wins=con.list.map(x=>{const n=nameOf(x.r.deal_id);return {k:n.k,s:n.s,w:R.repN?R.repN(x.r.sales_owner_name):x.r.sales_owner_name,j:'수주',cls:'ok',e:'직접 · 계약 '+md(x.e.effective_date)+' · '+eok(x.e.amount_delta)};})
   .concat(pt.list.map(x=>({k:'',s:String(x.company||x.brand||'협약 · 기술자문'),w:String(x.owner||''),j:'수주',cls:'ok',e:'협약 · 기술자문 · '+eok(x.amount)})),tf.list.map(x=>({k:String(x.t&&x.t.deal_id||''),s:nameOf(x.t&&x.t.deal_id).s,w:nameOf(x.t&&x.t.deal_id).w,j:'수주',cls:'ok',e:'타사 이관 · 승인 · '+eok(x.amount)})));
  const losses=loss.map(d=>{const id=String(d.id||(R.dealKey&&R.dealKey(d))||''),n=nameOf(id);return {k:n.k,s:n.s,w:n.w,j:'실주',cls:'bad',e:(B.lossReason?B.lossReason(d):'사유 미기록')+' · '+md(B.closedKey(d))};});
  const m1={id:'c1',g:'result',label:'메이드율',pilot:false,state:made==null?'na':'ok',v:made,vText:made==null?'아직 없음':fmt(made),num:won,den:won+lost,sub:made==null?'올해 결과가 난 영업 없음':'수주 ÷ (수주 + 파이프라인 실주) · 배드핏 제외',
   n:[['수주',won,''],['파이프라인 실주',lost,'bad'],['계산 제외 · Bad Fit',bad,'na']],
   f:'(직접 + 협약 + 승인 타사 이관 수주) ÷ (수주 + 파이프라인 실주)',inc:'결과 확정 건 · 올해('+md(y0)+' ~ 오늘)',exc:'배드핏 · 진행 중 · 미승인 타사 이관',ver:'rules 메이드율 정의 · '+VER(),rows:sortRows(losses.concat(wins)),goal:null};
  const total=con.net+pt.amount+tf.amount;
  const m2={id:'c2',g:'result',label:'낙찰 실적 · 올해',pilot:false,state:total>0?'ok':'na',v:total,vText:total>0?eok(total):'아직 없음',num:won,den:won,sub:'낙찰일 기준 · '+won+'건',
   n:[['직접',eok(con.net),''],['협약 · 기술자문',eok(pt.amount),''],['타사 이관',eok(tf.amount),'na']],
   f:'낙찰금액(VAT 별도) 합 · 낙찰일 기준',inc:'수주 · 올해 낙찰일',exc:(pt.unknown?'낙찰금액 미입력 '+pt.unknown+'건(실적 정보 보완) · ':'')+'미승인 타사 이관',ver:'rules 금액 5개 기준 · '+VER(),rows:sortRows(wins),goal:null};
  return [m1,m2];
 }
 /* ── 관리팀 처리 ── 요청 엔진 기록(WorkRequest)에서만, 이번 주(월~금) 등록 요청 · 취소 · 문구 복사 제외. 관리팀 KPI 왼쪽 '관리팀 지표'도 이 값 */
 function mgmtGroup(){
  const W=R.WorkRequest,j=J(),pend=(id,label)=>make({id,g:'mgmt',label,ok:[],bad:[],na:[],n:[['–','–',''],['–','–',''],['–','–','']],sub:()=>'요청 저장소가 아직 서버에 없어 잴 수 없습니다',f:'',inc:'',exc:'',ver:VER()});
  if(!W||!W.enabled||!W.enabled()||!j)return [pend('d1','기한 내 해결률'),pend('d2','평균 처리 시간')];
  const L=(W.state().list||[]),wk=j.week(0),now=Date.now();
  const week=L.filter(r=>r.status!=='cancelled'&&j.inWeek(r.created_at,wk));
  const closed=r=>(r.status==='done'||r.status==='replied')&&!!r.closed_at;
  const mk=(r,jd,cls,e)=>({k:'',s:String(r.site||'현장명 미입력'),w:String(r.to_name||''),j:jd,cls,e});
  const okR=[],lateR=[],openR=[];
  week.forEach(r=>{const due=Date.parse(r.due_at||'');
   if(closed(r)){if(!Number.isFinite(due)||Date.parse(r.closed_at)<=due)okR.push(mk(r,'기한 내 해결','ok',(r.label||'요청')+' · 완료 '+md(dk(r.closed_at))));else lateR.push(mk(r,'기한 넘김','bad',(r.label||'요청')+' · 완료 '+md(dk(r.closed_at))+' (기한 '+md(dk(r.due_at))+')'));}
   else if(Number.isFinite(due)&&now>due)lateR.push(mk(r,'기한 넘김','bad',(r.label||'요청')+' · 기한 '+md(dk(r.due_at))+' 지남 · 아직 처리 중'));
   else openR.push(mk(r,'처리 중','na',(r.label||'요청')+' · 기한 '+(r.due_at?md(dk(r.due_at)):'없음')));});
  const d1=make({id:'d1',g:'mgmt',label:'기한 내 해결률',ok:okR,bad:lateR,na:[],wait:openR,
   n:[['기한 내 해결',okR.length,''],['기한 넘김',lateR.length,'bad'],['처리 중',openR.length,'na']],
   sub:(a,d)=>d?a+' / '+d+' · 요청 등록 기준':'이번 주 기한이 도래한 요청 없음',
   f:'기한 안 완료된 요청 ÷ 이번 주 등록된 요청(처리 중이면서 기한 전인 것 제외)',inc:'요청 보내기로 등록된 건 · 이번 주(월~금)',exc:'문구 복사 · 취소된 요청 · 기한 전 처리 중',ver:'요청 5단계 기준 · '+VER()});
  const cl=week.filter(closed),mins=cl.map(r=>(Date.parse(r.closed_at)-Date.parse(r.created_at))/864e5).filter(Number.isFinite),avg=mins.length?mins.reduce((a,b)=>a+b,0)/mins.length:null,mx=mins.length?Math.max.apply(null,mins):null;
  const dayTxt=n=>n==null?'–':(Math.round(n*10)/10)+'일';
  const d2={id:'d2',g:'mgmt',label:'평균 처리 시간',state:avg==null?'na':'ok',v:avg,vText:avg==null?NA_TAG:dayTxt(avg),num:cl.length,den:cl.length,sub:avg==null?'이번 주 완료된 요청 없음':'요청 → 완료 · 이번 주 완료 '+cl.length+'건',
   n:[['평균',dayTxt(avg),''],['가장 김',dayTxt(mx),'bad'],['처리 중',week.length-cl.length,'na']],
   f:'요청 등록 → 완료 판정까지 시간 평균',inc:'이번 주 등록 · 완료된 요청',exc:'처리 중 · 취소 · 문구 복사',ver:'요청 5단계 기준 · '+VER(),
   rows:sortRows(cl.map(r=>{const t=(Date.parse(r.closed_at)-Date.parse(r.created_at))/864e5;return mk(r,dayTxt(t),t>(mx||0)-1e-9&&cl.length>1?'bad':'ok',(r.label||'요청')+' · '+md(dk(r.created_at))+' → '+md(dk(r.closed_at)));}).concat(week.filter(r=>!closed(r)).map(r=>mk(r,'처리 중','na',(r.label||'요청')+' · '+md(dk(r.created_at))+' 등록')))),goal:null};
  return [d1,d2];
 }
 const GROUPS=[['record','기록 완성도','판단에 필요한 자료가 있는가'],['action','행동 준수','정해진 기한에 실제로 했는가 · 분모 0이면 측정 불가'],['result','영업 결과','실제 성과가 났는가'],['mgmt','관리팀 처리','요청한 문제가 해결됐는가']];
 function compute(){
  const I=items(),all=[].concat(recordGroup(I),actionGroup(I),resultGroup(),mgmtGroup());
  return {list:all,byId:id=>all.find(m=>m.id===id)||null,groups:GROUPS.map(([k,t,q])=>({k,t,q,items:all.filter(m=>m.g===k)}))};
 }
 /* 시범 측정 · 평가 제외 지표의 번호(관리팀 KPI 핵심 지표 6 '방문 후 3일 견적') */
 const PILOT_CORE=[5];
 /* ── 그리기 ── */
 const st=S=>{S.mk=S.mk||'a1';return S;};
 function card(m,on){
  const tagTxt=m.state==='pilot'?PILOT_TAG:m.state==='na'&&m.g==='action'?NA_TAG:'';
  const val=m.state==='pilot'&&!m.den?NA_TAG:m.vText;
  return '<button type="button" class="km-card '+m.state+(on?' on':'')+'" data-k7="mk" data-v="'+attr(m.id)+'" aria-pressed="'+on+'"><span class="km-l">'+h(m.label)+'</span><span class="km-vr"><b class="km-v'+(m.state==='na'?' na':'')+'">'+h(val)+'</b>'+(tagTxt&&val!==tagTxt?'<em class="km-tag '+m.state+'">'+h(tagTxt)+'</em>':'')+'</span><span class="km-s">'+h(m.sub)+'</span></button>';
 }
 function panel(m,S){
  const pg=R.ListPager.cut(m.rows,R.ListPager.page(S,'mk'));
  const tiles=m.n.map(n=>'<div><span>'+h(n[0])+'</span><b class="'+h(n[2])+'">'+h(n[1])+'</b></div>').join('');
  return '<section class="km-panel" aria-label="지표 근거"><header><b>지표 근거 · '+h(m.label)+(m.state==='pilot'?' <em class="km-tag pilot">'+PILOT_TAG+'</em>':'')+'</b><span>위 칸을 누르면 바뀜</span></header>'
   +'<div class="km-pb"><div class="km-pl"><div class="km-tiles">'+tiles+'</div><dl><dt>계산식</dt><dd>'+h(m.f)+'</dd><dt>포함</dt><dd>'+h(m.inc)+'</dd><dt>제외</dt><dd>'+h(m.exc)+'</dd><dt>기준</dt><dd>'+h(m.ver)+'</dd></dl></div>'
   +'<div class="km-pr"><div class="km-rh"><span>현장 · 담당</span><span>판정</span><span>근거일 · 보완할 것</span></div>'
   +(pg.rows.length?pg.rows.map(r=>'<div class="km-row"'+(r.k?' role="button" tabindex="0" data-k7="mopen" data-v="'+attr(r.k)+'"':'')+'><span class="km-s1" title="'+attr(r.s+' · '+r.w)+'"><b>'+h(r.s)+'</b>'+(r.w?' · '+h(r.w):'')+'</span><span class="km-j '+r.cls+'">'+h(r.j)+'</span><span class="km-e" title="'+attr(r.e)+'">'+h(r.e)+'</span></div>').join(''):'<p class="km-none">해당하는 현장이 없습니다</p>')
   +R.ListPager.html(pg,{ns:'k7',small:true})+'</div></div></section>';
 }
 function html(S,D0){
  st(S);const D=D0||compute();let sel=D.byId(S.mk);if(!sel){S.mk='a1';sel=D.byId('a1');}
  const sec=D.groups.map(g=>'<section class="km-g"><header><b>'+h(g.t)+'</b><span>'+h(g.q)+'</span></header><div class="km-gr">'+g.items.map(m=>card(m,m.id===S.mk)).join('')+'</div></section>').join('');
  return '<div class="km"><span class="k7-note">기록이 없으면 \'준수\'가 아니라 \'측정 불가\' · 관리팀 KPI · 단계별 KPI · 오늘 업무가 같은 판정 함수를 씁니다 · 시범 측정 지표는 미달 · 달성에 넣지 않습니다</span>'+sec+panel(sel,S)+'</div>';
 }
 function onClick(a,v,b,S){
  if(a==='mk'){S.mk=v;R.ListPager.set(S,'mk',1);return true;}
  if(a==='page'){R.ListPager.set(S,'mk',Number(b.dataset.page)||1);return true;}
  if(a==='mopen'){try{R.KpiB.openTarget('deal',v);}catch(e){}return false;}
  return null;
 }
 root.KpiMeasure={enabled,compute,html,onClick,PILOT_CORE,contactDays,GROUPS,PILOT_TAG,NA_TAG};
})(window);
