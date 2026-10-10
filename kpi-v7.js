/* 관리팀 KPI v7 (2026-10-05 design_handoff_kpi_v7 · 시안 '관리팀 KPI v7.dc.html')
   관리팀 KPI 메뉴만 — 문자 · 캠페인 / 파이프라인 단계 화면과 같은 틀(왼쪽 진단 · 오른쪽 목록).
   위: 담당자 알약(각 '미달 n' = 그 사람이 미달인 지표 수) + 기간 · 제목 한 줄 · [지난주 보기] [기준 설정] [이번 주 결과 저장]
   왼쪽: KPI 진단(미달 · 달성 · 아직 못 잼 막대 + 작은 칸 3개 + 단계별 기준 넘긴 건) · 왜 멈춰 있나(누르면 오른쪽이 걸러짐) · 그래서 뭘 해야 하나
   오른쪽 탭 2개: 핵심 지표 8(리스트 / 보드 · 나쁜 순) · 단계별 기준(파이프라인 각 단계 화면의 '그래서 뭘 해야 하나' 기준 — 같은 계산 함수 PipelineStageB.model · InquiryListV3.model 을 그대로 불러 숫자가 같다)
   숫자 · 할 일은 전부 기존 계산(KpiB.compute — 지표 키 kpi:1~8 유지 · 주간 저장 · 조치 기록)에서 온다. 여기서는 그리기와 묶어 보내기만 한다.
   요청 버튼 = 그 건 담당자의 이번 주 '관리자 한마디'에 한 줄(기존 저장 경로 KpiB.requestLine) + 조치 기록(crm_kpi_action_log_v1) → 처리되면 '조치 → 처리율'에 반영. 보낸 뒤 '보냄 ✓'.
   B2B 협약 전담(조재연)은 담당자 알약 · '누가'에서 뺀다. 끄기: G.kpiV7Off=true → 예전 KPI 화면 */
(function(root){
 'use strict';
 const R=root,h=v=>R.esc(String(v==null?'':v)),attr=v=>R.escAttr(String(v==null?'':v));
 const K=()=>R.KpiB,O=()=>R.OpsStore;
 const enabled=()=>!R.G.kpiV7Off&&!!K()&&K().enabled()&&typeof K().personVals==='function';
 const ST=()=>R.G.k7||(R.G.k7={tab:'core',view:'list',cause:'',last:false});
 const fmt=v=>v==null?'–':(Math.round(v*10)/10)+'%';
 const pct=(a,b)=>b?Math.round(a*1000/b)/10:null;
 const toast=(m,k)=>{if(typeof R.toast==='function')R.toast(m,k);};
 const repaint=()=>{if(R.G.page==='mgmt')try{R.paintMgmt();}catch(e){}};
 /* 지표(예전 화면과 같은 순번 = kpi:1~8)마다: 묶음 · 지표명 · 질문형 이름 · 원인 */
 const QN=[['견적문의','당일 배정률','들어온 날 담당을 정했나','contact'],['견적문의','2시간 첫 연락','배정 2시간 안에 실제 통화했나','contact'],['파이프라인','다음 할 일 등록률','진행 건마다 다음 할 일 · 날짜가 있나','rec'],['파이프라인','활동 기록률','최근 7일 안에 기록이 있나','rec'],
  ['파이프라인','장기정체 비율','30일 넘게 멈춘 건 (낮을수록 좋음)','judge'],['파이프라인','방문 후 3일 견적','미팅 후 3일 안에 견적 요청했나','rec'],['실주','실주 정보 완성률','사유 · 재영업 여부 · 필요한 낙찰 정보를 남겼나','rec'],['관리팀','조치 → 처리율','관리팀 요청이 기한 안에 처리됐나','judge']];
 const CAUSES=['contact','rec','judge','none'],CL={contact:'고객 연락이 늦음',rec:'기록 · 입력을 안 남김',judge:'판단을 미룸',none:'아직 못 잼'};
 const b2b=()=>{try{return (R.InquiryB2BTab&&R.InquiryB2BTab.OWNER)||'조재연';}catch(e){return '조재연';}};
 const people=()=>K().names().filter(n=>n!==b2b());
 const owner=()=>{try{const o=R.SalesScope.state().owner;return o&&o!=='전체'?o:'';}catch(e){return '';}};
 /* 주간 기준 = 월~금(2026-10-06 집계 ⑤ · 주간 브리핑과 같음) */
 const period=()=>{const o=O();if(!o)return '';const mon=o.monday(0),md=s=>Number(s.slice(5,7))+'/'+Number(s.slice(8,10)),end=new Date(Date.parse(mon+'T00:00:00')+4*864e5).toLocaleDateString('en-CA');return md(mon)+'(월) – '+md(end)+'(금)';};
 /* 이번 주 / 누적 분리(2026-10-06 집계 ⑤): 견적문의 지표 둘은 이번 주(월~금) 접수 · 배정 건만 세고, 누적 미처리는 따로 적는다. 지표마다 '대상: …' 한 줄(⑥ 같은 이름 = 같은 분모) */
 const J=()=>R.PipelineJudge&&R.PipelineJudge.on()?R.PipelineJudge:null;
 const TARGET=i=>{const T=(J()||{}).TARGET||{};return [T.sameDay||'이번 주 접수 견적문의',T.firstContact||'이번 주 배정된 견적문의',T.nextRate||'진행 중 영업건(과거 이관 제외)',T.activity||'진행 중 영업건',T.stale||'컨설팅 설계 · 관계관리 진행 건(과거 이관 제외)',T.quote3||'1차 미팅을 마친 컨설팅 설계 건',T.lostReason||'실주 처리된 영업건',T.action||'최근 28일 관리팀 요청'][i]||'';};
 /* 담당자별 값은 지금 걸린 담당 필터와 상관없이(전원) 잰다 — 알약의 '미달 n' 이 고른 사람에 따라 바뀌지 않게 */
 function allItems(){
  const P=R.PipelineStageB,out=[];if(!P||!R.PipelineWorkspace)return out;let rows=[];try{rows=R.PipelineWorkspace.rows({unscoped:true});}catch(e){rows=[];}
  Object.keys(P.CFG).forEach(key=>{const list=rows.filter(r=>r.group===key);if(!list.length)return;try{P.model(key,list).items.forEach(it=>out.push(Object.assign({stage:key},it)));}catch(e){}});
  return out;
 }
 /* 시범 측정(미확정 기준)은 미달 · 달성 · 담당자 알약에 넣지 않는다(design_handoff_kpi_measure) — 번호는 KpiMeasure.PILOT_CORE */
 const PILOT=new Set((R.KpiMeasure&&R.KpiMeasure.PILOT_CORE)||[5]);
 const failOf=(v,i)=>{if(PILOT.has(i))return false;const d=K().DEF[i];return v!=null&&(d[5]?v>d[4]:v<d[4]);};
 function personVals(){const C={items:allItems()};return people().map(n=>{let p=null;try{p=K().personVals(n,C);}catch(e){}return p||{n,measured:false};});}
 function whoOf(i,m,PV){
  if(m.ready===false)return m.pendingReason||'계산 중';
  if(m.v==null)return i===5?'미팅 완료 건 없음':i===7?'요청 기록 없음':'대상 없음';
  if(i===0)return '미배정 '+m.todos.length+'건';
  if(i===7)return '요청 '+m.den+'건 중 '+m.num+'건 처리';
  const lb=!!m.def[5],vs=PV.filter(p=>p.measured&&p.vals&&p.vals[i]!=null).map(p=>[p.n,p.vals[i]]).sort((a,b)=>lb?b[1]-a[1]:a[1]-b[1]);
  if(!vs.length)return '담당별 값 없음';
  const bad=vs.filter(x=>failOf(x[1],i));if(!bad.length)return '전원 달성';
  if(bad.length===vs.length&&vs.length>1&&vs.every(x=>x[1]===vs[0][1]))return '전원 '+fmt(vs[0][1]);
  return bad.slice(0,2).map(x=>x[0]+' '+fmt(x[1])).join(' · ')+(bad.length>2?' 외 '+(bad.length-2)+'명':'');
 }
 /* 요청 버튼 숫자 설명(design_handoff_kpi_measure §4): '미등록 n건 중 요청 가능 n건 · 이미 요청 중 · 담당 없음' — 담당이 없는 건은 요청을 보낼 수 없어 따로 센다 */
 const reqSplit=list=>{const open=(list||[]).filter(t=>!t.done),none=open.filter(t=>!t.owner||t.owner==='미배정').length;return {total:(list||[]).length,done:(list||[]).length-open.length,none,can:open.length-none};};
 /* after_deploy ③: 숫자마다 단위(건 / 명) — 요청 가능 건수와 그 담당 수를 함께 */
 const reqSplit2=list=>{const x=reqSplit(list),owners=new Set((list||[]).filter(t=>!t.done&&t.owner&&t.owner!=='미배정').map(t=>t.owner));return Object.assign(x,{people:owners.size});};
 const reqSum=(x,noun)=>noun+' '+x.total+'건 중 요청 가능 '+x.can+'건'+(x.people?' (담당 '+x.people+'명)':'')+(x.done?' · 이미 요청 중 '+x.done+'건':'')+(x.none?' · 담당 없음 '+x.none+'건':'');
 const reqBtnTxt=x=>x.people?'담당 '+x.people+'명에게 요청 ('+x.can+'건)':'요청 가능 '+x.can+'건';
 /* 핵심 지표 8줄 */
 function coreRows(C,PV,last){

  return C.M.map((m,i)=>{
   const q=QN[i],g=m.def[4],lb=!!m.def[5];let v=m.v,num=m.num,den=m.den,cum='';
   if(last){const w=K().weekRowOf(i,-1);v=w?pct(w.numerator,w.denominator):null;num=w?w.numerator:0;den=w?w.denominator:0;}
   else if(i<2&&C.S){cum=(i===0?'누적 미배정 ':'누적 첫 연락 전 ')+((i===0?C.S.unassigned:C.S.noResponse)||[]).length+'건(이번 주 지표와 별도)';}
   const pilot=PILOT.has(i),nd=v==null,bad=!pilot&&!nd&&(lb?v>g:v<g),gap=nd?0:Math.round(Math.abs(g-v)*10)/10,d=last||v==null||m.last==null?null:Math.round((v-m.last)*10)/10;
   const left=last?0:m.left,total=last?0:m.todos.length,RQ=last?null:reqSplit2(m.todos);
   return {i,key:m.key,grp:q[0],l:q[1],q:q[2],cause:nd&&!pilot?'none':q[3],nd,bad,lb,v,g,gap,left,total,d,num,den,pilot,ok:!nd&&!bad&&!pilot,
    frac:!last&&m.ready===false?'아직 못 잼':den?num+' / '+den+'건':'아직 못 잼',goal:(lb?'≤ ':'')+g+'%',
    meta:last?'지난주 금요일 저장본':(m.last==null?'지난주 –':'지난주 '+fmt(m.last)+' '+(d==null?'비교 보류':d===0?'→ 그대로':(d>0?'▲':'▼')+Math.abs(d)+'%p'))+' · 누가 '+whoOf(i,m,PV)+(cum?' · '+cum:''),target:'대상: '+TARGET(i)+(m.unknown?' · 기록·시각 미확인 '+m.unknown+'건(측정 불가·분모 제외)':''),
    reason:!last&&m.ready===false?m.pendingReason:pilot?'시범 측정 · 평가 제외':nd?'아직 못 잼':bad?'미달 · '+gap+'%p '+(lb?'초과':'부족'):'달성',
    btn:last||!total?'':/* 이번 주 값이 '아직 못 잼'이어도 누적 미처리가 있으면 요청 버튼은 둔다(2026-10-06 집계 ⑤) */!left?'보냄 ✓':i===0?left+'건 배정':i===4?left+'건 판단 요청':i===3?'담당별 요청':i===7?left+'건 다시 확인':reqBtnTxt(RQ),dis:!last&&!!K().requestStatus&&!K().requestStatus().ready||!!RQ&&!RQ.can&&left>0&&![0,3,4,7].includes(i),reqSum:!last&&K().requestStatus&&!K().requestStatus().ready?K().requestStatus().message:RQ&&total?reqSum(RQ,q[3]==='rec'?'기록 없음':'대상'):''};
  }).sort((a,b)=>(a.nd?2:a.bad?0:1)-(b.nd?2:b.bad?0:1)||b.gap-a.gap||a.i-b.i);
 }
 /* 단계별 기준: 파이프라인 각 단계 화면의 '그래서 뭘 해야 하나' 기준(빨강 사유)을 같은 함수로 — 기준 넘긴 건 = 그 사유가 붙은 건.
    지킨 비율 = 1 − 넘김 ÷ 대상. 대상 = 그 단계의 건(견적 요청 3일은 미팅을 마친 건, 견적문의는 배정된 건 · 후속 단계 건) */
 const BASE={consulting:{nodue:it=>it.bucket==='done'}};
 function ruleBase(stage,key,items){
  const bucket={focus7:'focus',month30:'normal',long60:'wait'}[key];
  if(stage!=='relationship'||!bucket){const f=BASE[stage]&&BASE[stage][key];return {base:f?items.filter(f).length:items.length,unknown:0};}
  const unclassified=items.filter(it=>it.bucket==='nodata').length,relevant=items.filter(it=>it.bucket===bucket);
  const known=relevant.filter(it=>it.rs.includes(key)||Number.isFinite(it.seg?it.seg.contact:it.row.contactDays));
  return {base:known.length,unknown:unclassified+relevant.length-known.length};
 }
 function stageGroups(done){
  const P=R.PipelineStageB,out=[],isDone=(pk,kind,id)=>done.has(pk+'|'+kind+':'+id);
  const rule=(stage,k,t,how,targets,base)=>{const pk='stage:'+stage+':'+k,n=targets.length,b=Math.max(base,n),left=targets.filter(x=>!isDone(pk,x.kind,x.id)).length,rq=reqSplit2(targets.map(x=>({owner:x.owner,done:isDone(pk,x.kind,x.id)})));return {stage,k,pk,t,how,targets,n,base:b,left,rq,p:b?Math.round((1-n/b)*1000)/10:null};};
  try{const IL=R.InquiryListV3,IV=R.InquiryListV2;if(IL&&IV&&typeof IL.model==='function'&&typeof IV.rows==='function'){
   const ms=IV.rows().map(x=>IL.model(x)).filter(m=>m.step<4),RU=R.OPS_RULES||{},H=Number(RU.towerFirstResponseHours)||2,D=Number(RU.inquiryFollowDays)||7;
   const T=m=>({kind:'inq',id:String(m.key),name:m.site,owner:String(m.owner||''),why:m.elapsed||''});
   const known=ms.filter(m=>!m.review?.required),unknown=ms.length-known.length,extra=unknown?' · 이관 기록 확인 '+unknown+'건(측정 불가·분모 제외)':'';
   const r1=known.filter(m=>m.step===1),r2=known.filter(m=>m.follow&&m.late);
   if(ms.length)out.push({key:'inquiry',label:'견적문의',total:ms.length,over:new Set(r1.concat(r2).map(m=>m.key)).size,rules:[
    rule('inquiry','nofirst','첫 연락 전','배정 후 '+H+'시간 안 첫 연락'+extra,r1.map(m=>Object.assign(T(m),{label:'첫 연락 요청'})),known.filter(m=>m.step>=1).length),
    rule('inquiry','stale','후속 연락 필요','첫 연락 후 '+D+'일 넘게 연락 없음'+extra,r2.map(m=>Object.assign(T(m),{label:'후속 연락 요청'})),known.filter(m=>m.follow).length)]});
  }}catch(e){}
  if(P&&R.PipelineWorkspace){let rows=[];try{rows=R.PipelineWorkspace.rows();}catch(e){rows=[];}
   Object.keys(P.CFG).forEach(key=>{const list=rows.filter(r=>r.group===key);if(!list.length)return;let md=null;try{md=P.model(key,list);}catch(e){}if(!md)return;
    /* 실주 = 핵심 지표 7 · 측정 기준 a3 · 실주 화면과 같은 완료 판정(사유 + 재영업 여부, 경쟁사 낙찰이면 경쟁사 · 낙찰가) — 빨강이 아닌 두 사유도 같이 센다 */
    const LF=key==='lost'?['noreason','relist','nobid']:[],red=Object.keys(md.C.RS).filter(k=>md.isRed(k)||LF.includes(k));if(!red.length)return;
    out.push({key,label:md.C.name,total:list.length,over:key==='lost'?md.items.filter(it=>it.bucket==='nore').length:md.items.filter(it=>it.red).length,rules:red.map(k=>{const hit=md.items.filter(it=>it.rs.includes(k)),b=ruleBase(key,k,md.items);
     const how=md.C.RS[k][3]+(key==='lost'?' · 해당 항목만 판단(전체 완성률과 별도)':key==='relationship'?' · 접촉 주기 기준(단계 진척과 별도)':'')+(b.unknown?' · 분류·접촉 확인 필요 '+b.unknown+'건(분모 제외)':'');
     return Object.assign(rule(key,k,md.C.RS[k][0],how,hit.map(it=>({kind:'deal',id:String(it.row.key),name:it.row.site,owner:String(it.row.owner||''),why:md.C.RS[k][0],label:md.C.RS[k][2]})),b.base),{unknown:b.unknown});})});});}
  return out;
 }
 /* '조치 → 처리율'이 단계별 기준 요청도 세도록: 지금 기준을 넘긴 건의 열쇠(견적문의 몫) */
 function inquiryLive(){const out=[];try{stageGroups(new Set()).filter(g=>g.key==='inquiry').forEach(g=>g.rules.forEach(r=>r.targets.forEach(t=>out.push(r.pk+'|'+t.kind+':'+t.id))));}catch(e){}return out;}
 const reqBtn=(label,act,v,dis)=>!label?'<span class="k7-auto">자동 측정</span>':'<button type="button" class="k7-req'+(label==='보냄 ✓'?' sent':'')+'" data-k7="'+act+'" data-v="'+attr(v)+'"'+(label==='보냄 ✓'||dis||(K().requestStatus&&!K().requestStatus().ready)?' disabled':'')+'>'+h(label)+'</button>';
 /* ops_12 D⑩ 관리팀 지표 — 요청 수보다 해결: 요청(이번 주 등록 · 문구 복사 제외) · 기한 내 해결률 · 재요청률 · 평균 처리 시간. 요청 엔진 기록(WorkRequest · 최근 30일)에서만 센다 */
 function mgmtMetrics(KMD){
  const W=R.WorkRequest;if(!W||!W.enabled||!W.enabled())return null;const L=W.state().list||[],j=J(),wk=j?j.week(0):null;
  const week=L.filter(r=>wk&&j.inWeek(r.created_at,wk)&&r.status!=='cancelled'),now=Date.now();
  const all=L.filter(r=>r.status!=='cancelled'),re=all.filter(r=>Number(r.round)>=2).length;
  const isClosed=r=>!!r.closed_at&&(r.status==='done'||r.status==='replied'),closed=all.filter(isClosed);
  /* after_deploy ②: 분모 = 기한이 지난 요청(완료 · 미완료 모두) · 기한 전 진행 중은 제외 · 분모 0 = 측정 대상 없음 */
  const dueOver=all.filter(r=>{const d=Date.parse(r.due_at||'');return Number.isFinite(d)&&(d<now||isClosed(r));}),onTime=dueOver.filter(r=>isClosed(r)&&Date.parse(r.closed_at)<=Date.parse(r.due_at)).length,beforeDue=all.filter(r=>!isClosed(r)&&Date.parse(r.due_at||'')>=now),beforeDone=0;
  const avg=closed.length?closed.reduce((s,r)=>s+(Date.parse(r.closed_at)-Date.parse(r.created_at))/864e5,0)/closed.length:null;
  /* after_deploy ④: 요청 집계 = 기간 × 개별 / 묶음(같은 사람이 같은 이름으로 같은 분에 여러 건 = 묶음 1 · 대상 n건) */
  const split=list=>{const g=new Map();list.forEach(r=>{const k=String(r.requested_by||'')+'|'+String(r.label||'')+'|'+String(r.created_at||'').slice(0,16);(g.get(k)||g.set(k,[]).get(k)).push(r);});let single=0,bundles=0,targets=0;g.forEach(v=>{if(v.length>=2){bundles++;targets+=v.length;}else single++;});return {single,bundles,targets,txt:'개별 '+single+'건'+(bundles?' · 묶음 '+bundles+' (대상 '+targets+'건)':'')};};
  const d28=all.filter(r=>Date.parse(r.created_at||'')>=now-28*864e5),sw=split(week),s28=split(d28);
  return [['요청',sw.txt,'이번 주(월~금) · 최근 28일 '+s28.txt+' · 문구 복사 제외'],['기한 내 해결률',dueOver.length?Math.round(onTime*100/dueOver.length)+'%':'측정 대상 없음',dueOver.length?onTime+' / '+dueOver.length+'건 · 기한 지남 '+dueOver.length+'건 · 기한 전 진행 중 '+beforeDue.length+'건':'기한 지남 0건 · 기한 전 진행 중 '+beforeDue.length+'건 · 기한 안 완료 ÷ 기한이 지난 요청'],['재요청률',all.length?Math.round(re*100/all.length)+'%':'–',all.length?re+' / '+all.length+' · 같은 건 2번 이상 요청':'요청 없음'],['평균 처리 시간',avg==null?'–':(Math.round(avg*10)/10)+'일','요청 → 완료 · 최근 30일']].map(m=>{const d=KMD&&KMD.byId(m[0]==='기한 내 해결률'?'d1':m[0]==='평균 처리 시간'?'d2':'');return d?[m[0],d.vText,d.sub+' · 이번 주']:m;}).concat(R.ExecWording&&R.ExecWording.on()?[['기한 변경',R.ExecWording.postponeCount().n+'회','이번 주(월~금) · 원래 기한 · 사유와 함께 기록 · 지연 기록은 그대로']]:[]);/* 기한 내 해결률 · 평균 처리 시간 = 측정 기준 탭 d1 · d2 와 같은 값(이번 주 등록 요청) */
 }
 /* design_handoff_units ④: 오늘 업무 · KPI · 성과 분석 · 고객 자산이 같은 영업건 단위로 세는지 — DealUnits.audit 한 함수 */
 function unitLine(){try{const U=R.DealUnits;if(!U||!U.on())return '';const a=U.audit((R.B&&R.B.deals)||[],(R.B&&R.B.inquiries)||[]);return '<p class="k7-unit">'+h(a.line)+'</p>';}catch(e){return '';}}
 function html(){
  const s=ST(),C=K().compute(),PV=personVals(),rows=coreRows(C,PV,s.last),SG=stageGroups(C.done||new Set()),o=O(),w=K().weekly();
  const KM=R.KpiMeasure&&R.KpiMeasure.enabled()?R.KpiMeasure:null,KMD=KM?KM.compute():null;/* 측정 기준 탭 · 왼쪽 관리팀 지표가 같은 계산(한 번만) */
  const MG=mgmtMetrics(KMD);
  const miss=rows.filter(r=>r.bad).length,pilotN=rows.filter(r=>r.pilot).length,nd=rows.filter(r=>r.nd&&!r.pilot).length,hit=rows.length-miss-nd-pilotN,N=rows.length||1;
  const requestsReady=!K().requestStatus||K().requestStatus().ready;
  const leftN=requestsReady?C.M.reduce((a,m)=>a+m.left,0):'–',sentN=requestsReady?C.M.reduce((a,m)=>a+(m.todos.length-m.left),0):'–';
  const cmp=rows.filter(r=>!r.pilot&&r.d!=null).map(r=>r.lb?-r.d:r.d),up=cmp.filter(d=>d>0).length,dn=cmp.filter(d=>d<0).length;
  const stageOver=SG.reduce((a,g)=>a+g.over,0),ruleN=SG.reduce((a,g)=>a+g.rules.length,0);
  if(s.cause&&!CAUSES.includes(s.cause))s.cause='';
  const list=rows.filter(r=>!s.cause||r.cause===s.cause);
  /* 위: 담당자 알약 + 기간 */
  const cur=owner(),pill=(l,n,on)=>'<button type="button" class="cf-pill k7-who'+(on?' on':'')+'" data-k7="who" data-v="'+attr(l)+'" aria-pressed="'+on+'">'+h(l)+(n?' <em>'+h(n)+'</em>':'')+'</button>';
  const filter='<div class="k7-filter">'+pill('전체','',!cur)+PV.map(p=>{const n=p.measured&&p.vals?p.vals.filter((v,i)=>failOf(v,i)).length:0;return pill(p.n,p.measured?'미달 '+n:'기록 없음',cur===p.n);}).join('')+'<i></i><span class="k7-period">기간 <b>이번 주 '+h(period())+'</b></span></div>';
  const mon=o?o.monday(0):'',savedThis=w.rows.some(x=>String(x.week_start||'').slice(0,10)===mon),canSave=!!(requestsReady&&o&&o.admin()&&o.has('crm_kpi_weekly_save_v1')),hasLast=C.M.some((m,i)=>!!K().weekRowOf(i,-1));
  const bar='<div class="k7-bar"><i class="dot"></i><b>관리팀 KPI</b><span>'+(s.last?'지난주 저장본 · 한 줄 = 지표 하나':'한 줄 = 지표 하나')+'</span><i class="sp"></i>'
   +'<button type="button" data-k7="last" aria-pressed="'+!!s.last+'">'+(s.last?'이번 주 보기':'지난주 보기')+'</button><button type="button" data-k7="rules">기준 설정</button>'
   +'<button type="button" class="pri" data-k7="save"'+(canSave&&!w.saving?'':' disabled')+(canSave?'':' title="'+attr(!requestsReady?K().requestStatus().message:'관리자만 저장할 수 있습니다')+'"')+'>'+(w.saving?'저장 중…':savedThis?'이번 주 결과 다시 저장':'이번 주 결과 저장')+'</button></div>';
  /* 왼쪽 진단 */
  const causeN=k=>k==='none'?nd:rows.filter(r=>r.bad&&r.cause===k).length;
  const causes=CAUSES.map(k=>{const n=causeN(k);return '<button type="button" class="k7-cause'+(k==='none'?' none':'')+'" data-k7="cause" data-v="'+k+'" aria-pressed="'+(s.cause===k)+'"><span><span>'+CL[k]+'</span><b>'+n+'</b></span><i><u style="width:'+Math.round(n/N*100)+'%"></u></i></button>';}).join('');
  const M=i=>C.M[i],L=i=>M(i)?M(i).left:0,bads=k=>rows.filter(r=>r.bad&&r.cause===k);
  const ACT={contact:()=>[L(0)?'미배정 '+L(0)+'건은 오늘 담당 정하고':'',L(1)?'연결 기록 없는 '+L(1)+'건은 담당에게 첫 연락 요청':''].filter(Boolean).join(', ')||'남은 요청이 없습니다 — 수치만 지켜보면 됩니다',
   rec:()=>{const b=bads('rec').filter(r=>r.left).sort((x,y)=>y.left-x.left);return b.length?b[0].l+' '+b[0].left+'건부터 — 한 번 요청으로 가장 크게 움직임.'+(b[1]?' 그다음 '+b[1].l+' '+b[1].left+'건':''):'남은 요청이 없습니다 — 수치만 지켜보면 됩니다';},
   judge:()=>L(4)?'30일 넘은 '+L(4)+'건은 ① 고객 반응 확인 → ② 추진 상태 확인 → ③ 근거 남기고 계속 · 대기 · 보류 · 실주 순서로 담당에게 요청':(L(7)?'답이 없는 요청 '+L(7)+'건을 다시 확인':'남은 요청이 없습니다 — 수치만 지켜보면 됩니다'),
   none:()=>'미팅 완료 · 요청 기록이 쌓이면 자동으로 잽니다. 할 일 없음'};
  const acts=(s.cause?[s.cause]:['rec','contact','judge'].filter(k=>causeN(k)>0)).map(k=>'<div class="k7-act"><span>'+CL[k]+' · '+causeN(k)+'지표</span><span>'+h(ACT[k]())+'</span></div>').join('')||'<div class="k7-act"><span>목표 미달 없음</span><span>이번 주는 지표를 모두 지켰습니다.</span></div>';
  const left='<div class="k7-left">'
   +'<section class="k7-card"><header><b>KPI 진단</b><span>'+rows.length+'지표</span></header><b class="k7-sub">목표 달성</b>'
   +'<div class="k7-track"><span style="width:'+(miss/N*100)+'%"></span><span style="width:'+(hit/N*100)+'%"></span><span style="width:'+(nd/N*100)+'%"></span>'+(pilotN?'<span style="width:'+(pilotN/N*100)+'%"></span>':'')+'</div>'
   +'<div class="k7-leg"><span><i class="a">■</i> 미달 <b>'+miss+'</b></span><span><i class="b">■</i> 달성 <b>'+hit+'</b></span><span><i class="c">■</i> 아직 못 잼 <b>'+nd+'</b></span>'+(pilotN?'<span><i class="d">■</i> 시범 · 평가 제외 <b>'+pilotN+'</b></span>':'')+'</div>'
   +'<div class="k7-tiles"><div><span>목표 미달</span><b class="r">'+miss+'지표</b><small>오늘 처리</small></div><div><span>남은 요청</span><b>'+leftN+'건</b><small>보냄 '+sentN+'건</small></div><div><span>지난주보다</span><b>'+(cmp.length?'<span class="up">▲'+up+'</span> · <span class="dn">▼'+dn+'</span>':'–')+'</b><small>'+(cmp.length?'나아짐 · 나빠짐':'지난주 저장본 없음')+'</small></div></div>'
   +'<span class="k7-over">단계별 기준 넘긴 건 <b>'+stageOver+'건</b> · 오른쪽 \'단계별 기준\' 탭</span></section>'
   +'<section class="k7-card k7-mg"><header><b>관리팀 지표</b><span>요청 수보다 해결</span></header>'+(MG?'<div class="k7-tiles">'+MG.map(m=>'<div><span>'+h(m[0])+'</span><b>'+h(m[1])+'</b><small>'+h(m[2])+'</small></div>').join('')+'</div>':'<p class="k7-none">요청 저장소가 아직 서버에 없어 잴 수 없습니다</p>')+unitLine()+'</section>'/* ops_12 D⑩ · design_handoff_units ④ 집계 단위 한 줄 */
   +'<section class="k7-card"><header><b>왜 멈춰 있나</b><span>누르면 오른쪽이 걸러짐</span></header>'+causes+'</section>'
   +'<section class="k7-card"><header><b>그래서 뭘 해야 하나</b></header>'+acts+'</section></div>';
  /* 오른쪽 */
  if(s.tab==='measure'&&!KM)s.tab='core';
  const tabs='<div class="k7-tabs" role="tablist">'+[['core','핵심 지표',rows.length],['stage','단계별 기준',ruleN]].concat(KM?[['measure','측정 기준',KMD.list.length]]:[]).map(t=>'<button type="button" role="tab" data-k7="tab" data-v="'+t[0]+'" aria-selected="'+(s.tab===t[0])+'">'+t[1]+' <span>'+t[2]+'</span></button>').join('')+'</div>';
  let body='';
  if(s.tab==='measure'&&KM){body=KM.html(s,KMD);}
  else if(s.tab==='stage'){
   body='<span class="k7-note">파이프라인 각 단계의 \'그래서 뭘 해야 하나\' 기준을 그대로 가져왔습니다. 기준을 넘긴 건이 곧 관리 대상입니다.</span>'
    +(SG.length?'<div class="k7-list">'+SG.map(g=>'<div class="k7-stage"><em>'+h(g.label)+'</em><span>'+g.total+'건 · 기준 넘김 <b class="'+(g.over?'r':'')+'">'+g.over+'건</b></span><i></i><button type="button" data-k7="go" data-v="'+attr(g.key)+'">단계로 이동 →</button></div>'
     +g.rules.map(r=>{const bad=r.p!=null&&r.p<80;return '<div class="k7-row '+(bad?'bad':'ok')+'" data-rule="'+attr(r.pk)+'"><div class="q"><b>'+h(r.t)+'</b><span>'+h(r.how+' · 기준 대상 '+r.base+'건')+'</span>'+(r.n?'<span class="k7-reqn">'+h(reqSum(r.rq,'기준 넘김'))+'</span>':'')+'</div>'
      +'<div class="p"><span><span>지킨 비율</span><b>'+(r.p==null?'–':r.p+'%')+'</b></span><i><u style="width:'+(r.p==null?0:Math.max(0,Math.min(100,r.p)))+'%"></u></i></div><b class="n'+(r.n?' r':'')+'">'+r.n+'건</b>'
      +(r.n?reqBtn(r.left?reqBtnTxt(r.rq):'보냄 ✓','sreq',r.pk,r.left&&!r.rq.can):'<span class="k7-auto">넘긴 건 없음</span>')+'</div>';}).join('')).join('')+'</div>':'<p class="k7-empty">이 조건에 해당하는 단계 건이 없습니다.</p>');
  }else{
   const head='<div class="k7-head"><b>확인할 지표 <span>'+list.length+'지표</span></b>'+(s.cause?'<button type="button" class="k7-clear" data-k7="clear">'+CL[s.cause]+' · 해제 ×</button>':'')+'<i></i><div class="k7-view">'+[['list','리스트'],['board','보드']].map(v=>'<button type="button" data-k7="view" data-v="'+v[0]+'" aria-pressed="'+(s.view===v[0])+'">'+v[1]+'</button>').join('')+'</div></div>';
   const cls=r=>r.pilot||r.nd?'':r.bad?' bad':' ok';
   if(s.last&&!hasLast)body=head+'<p class="k7-empty">지난주 저장본이 없습니다 — [이번 주 결과 저장]을 누르면 다음 주부터 비교할 수 있습니다.</p>';
   else if(s.view==='board')body=head+'<div class="k7-board">'+[['미달','#d14a3f',r=>r.bad],['달성','#3fb37f',r=>!r.bad&&!r.nd&&!r.pilot],['아직 못 잼','#c9cdd5',r=>r.nd&&!r.pilot]].concat(pilotN?[['시범 · 평가 제외','#b8c0e0',r=>r.pilot]]:[]).map(c=>{const cards=list.filter(c[2]);return '<div class="k7-col"><header><i style="background:'+c[1]+'"></i><b>'+c[0]+'</b><span>'+cards.length+'</span></header>'
     +cards.map(r=>'<div class="k7-kcard'+cls(r)+'" data-kpi="'+r.key+'"><small>'+h(r.grp+' · '+r.l)+'</small><b>'+h(r.q)+'</b><div><b>'+fmt(r.v)+'</b><span>'+h(r.frac)+'</span></div><em>'+h(r.reason)+'</em></div>').join('')+'</div>';}).join('')+'</div>';
   else body=head+(list.length?'<div class="k7-list">'+list.map(r=>'<div class="k7-row'+cls(r)+'" data-kpi="'+r.key+'"><div class="q"><b>'+h(r.q)+'</b><span>'+h(r.grp+' · '+r.l)+'</span><span class="k7-target">'+h(r.target)+'</span></div><div class="m"><b>'+h(r.frac+' · 목표 '+r.goal)+'</b><span>'+h(r.meta)+'</span>'+(r.reqSum?'<span class="k7-reqn">'+h(r.reqSum)+'</span>':'')+'</div><span class="why">'+h(r.reason)+'</span><b class="v">'+fmt(r.v)+'</b>'+(r.pilot?'<span class="k7-auto">시범 측정</span>':reqBtn(r.btn,'req',r.i,r.dis))+'</div>').join('')+'</div>':'<p class="k7-empty">이 원인에 해당하는 지표가 없습니다.</p>');
  }
  return '<div id="kpi-v7" data-workspace="kpi" data-tab="'+s.tab+'">'+filter
   +'<div class="k7-intro"><b>관리팀 KPI</b><span>관리팀이 할 일을 지표 '+rows.length+'개로 잽니다 — 빨강 = 이번 주 목표 미달 · 줄마다 버튼 하나로 담당에게 요청 · 금요일 18시 결과 자동 저장</span></div>'
   +bar+'<div class="k7-body">'+left+'<section class="k7-right">'+tabs+body+'</section></div></div>';
 }
 /* 묶어 보내기: 담당자별로 '관리자 한마디'에 한 줄 + 건마다 조치 기록(처리율 계산용) */
 function send(pkey,title,list,all){
  if(K().canRequest&&!K().canRequest())return;
  /* after_deploy 16: 두 건 이상 = 묶음 — 보내기 전에 담당별 대상 · 진행 · 미리보기 · 제외를 보여 준다(한 건은 바로). 끄기 G.kpiBulkPreviewOff */
   const ok=list.filter(t=>t.owner&&t.owner!=='미배정');
   if(R.G.kpiBulkPreviewOff||ok.length<2||!K().lineOf)return K().requestMany(pkey,title,list);
   ST().bulk={pkey,title,list:ok,all:(all||list).filter(t=>t.owner&&t.owner!=='미배정'),skip:list.length-ok.length,off:new Set(),open:'',pg:{}};bulkDraw();
 }
 /* ── 묶음 보완 요청 미리보기 ── */
  const keyOf=t=>t.kind+':'+t.id;
  function bulkModel(){const b=ST().bulk;if(!b)return null;const by=new Map(),get=o=>by.get(o)||by.set(o,{owner:o,items:[],all:0,done:0}).get(o);
   b.list.forEach(t=>get(t.owner).items.push(t));b.all.forEach(t=>{const g=by.get(t.owner);if(g){g.all++;if(t.done)g.done++;}});
   const groups=[...by.values()].map(g=>{g.all=Math.max(g.all,g.items.length+g.done);g.on=g.items.filter(t=>!b.off.has(keyOf(t)));g.line=g.on.length?K().lineOf(b.title,g.on):'';return g;});
   return {b,groups,people:groups.filter(g=>g.on.length).length,n:groups.reduce((s,g)=>s+g.on.length,0)};}
  function bulkHtml(){const M=bulkModel();if(!M)return '';const b=M.b,PER=20;
   const rows=M.groups.map(g=>{const off=!g.on.length,open=b.open===g.owner,pages=Math.max(1,Math.ceil(g.items.length/PER)),pg=Math.min(pages,Math.max(1,b.pg[g.owner]||1)),cut=g.items.slice((pg-1)*PER,pg*PER);
    return '<div class="k7b-row'+(off?' off':'')+'" data-owner="'+attr(g.owner)+'"><b>'+h(g.owner)+'</b><span title="'+attr(g.items[0].label||b.title)+'">'+h(g.items[0].label||b.title)+'</span><span class="n">'+g.on.length+(g.on.length!==g.items.length?' / '+g.items.length:'')+'건</span><span class="n" title="이미 요청 · 조치한 건 / 이 담당의 전체 대상">'+g.done+' / '+g.all+'</span>'
     +'<div class="k7b-act"><button type="button" data-kb="open" data-v="'+attr(g.owner)+'" aria-expanded="'+open+'">대상 '+(open?'접기':'보기')+'</button><button type="button" data-kb="owner" data-v="'+attr(g.owner)+'" aria-pressed="'+off+'">'+(off?'다시 포함':'제외')+'</button></div>'
     +'<small class="k7b-line" title="'+attr(g.line)+'">'+(off?'이 담당은 보내지 않음':'<i>미리보기</i> '+h(g.line))+'</small>'
     +(open?'<div class="k7b-items">'+cut.map(t=>'<label><input type="checkbox" data-kb="item" data-v="'+attr(keyOf(t))+'"'+(b.off.has(keyOf(t))?'':' checked')+'><span title="'+attr(t.name||t.what||t.id)+'">'+h(t.name||t.what||t.id)+'</span><em title="'+attr(t.why||'')+'">'+h(t.why||'')+'</em></label>').join('')
      +(pages>1?'<div class="k7b-pg" role="group" aria-label="쪽">'+Array.from({length:pages},(_,i)=>'<button type="button" data-kb="pg" data-v="'+attr(g.owner)+'" data-page="'+(i+1)+'" aria-current="'+(pg===i+1?'page':'false')+'">'+(i+1)+'</button>').join('')+'</div>':'')+'</div>':'')+'</div>';}).join('');
   return '<div class="k7b-card"><header><b>묶음 보완 요청</b><span title="'+attr(b.title)+'">'+h(b.title)+'</span></header>'
    +'<p class="k7b-rule">묶음으로 되는 것 = <b>보완 요청</b>만 · 고객 연결 완료 · 대기 · 실주 같은 <b>판단</b>은 한 건씩</p>'
    +'<div class="k7b-head"><span>담당</span><span>대상</span><span>건수</span><span>진행</span><span></span></div>'+rows
    +'<footer><span>담당 '+M.people+'명 · '+M.n+'건'+(b.skip?' · 미배정 '+b.skip+'건은 배정 뒤 요청':'')+'</span><i></i><button type="button" data-kb="cancel">취소</button><button type="button" class="pri" data-kb="send"'+(M.n?'':' disabled')+'>'+h(M.n?reqBtnTxt({people:M.people,can:M.n}):'보낼 대상 없음')+'</button></footer></div>';}
  function bulkDraw(){let el=document.getElementById('k7-bulk');if(!ST().bulk){if(el)el.remove();return;}if(!el){el=document.createElement('div');el.id='k7-bulk';el.className='k7-bulk';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','묶음 보완 요청');document.body.append(el);}el.innerHTML=bulkHtml();}
  function bulkClick(e){const el=document.getElementById('k7-bulk');if(!el||!el.contains(e.target))return;const b=ST().bulk;if(!b)return;if(e.target===el){ST().bulk=null;return bulkDraw();}
   const t=e.target.closest('[data-kb]');if(!t||t.disabled)return;const a=t.dataset.kb,v=t.dataset.v;
   if(a==='cancel'){ST().bulk=null;return bulkDraw();}
   if(a==='open'){b.open=b.open===v?'':v;return bulkDraw();}
   if(a==='pg'){b.pg[v]=Number(t.dataset.page)||1;return bulkDraw();}
   if(a==='owner'){const its=b.list.filter(x=>x.owner===v),allOff=its.every(x=>b.off.has(keyOf(x)));its.forEach(x=>{if(allOff)b.off.delete(keyOf(x));else b.off.add(keyOf(x));});return bulkDraw();}
   if(a==='item'){if(t.checked)b.off.delete(v);else b.off.add(v);return bulkDraw();}
   if(a==='send'){const M=bulkModel(),sel=M.groups.reduce((L,g)=>L.concat(g.on),[]);ST().bulk=null;bulkDraw();if(sel.length)return K().requestMany(b.pkey,b.title,sel);}}
  document.addEventListener('click',bulkClick);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ST().bulk){ST().bulk=null;bulkDraw();}});
 function onClick(e){
  const b=e.target.closest('#kpi-v7 [data-k7]');if(!b||b.disabled)return;const a=b.dataset.k7,v=b.dataset.v,s=ST();
  if(a==='tab'){s.tab=v==='stage'?'stage':v==='measure'?'measure':'core';return repaint();}
  if(a==='mk'||a==='page'||a==='mopen'){const KM=R.KpiMeasure;if(!KM)return;const done=KM.onClick(a,v,b,s);if(done)repaint();return;}
  if(a==='view'){s.view=v==='board'?'board':'list';return repaint();}
  if(a==='cause'){s.cause=s.cause===v?'':v;s.tab='core';return repaint();}
  if(a==='clear'){s.cause='';return repaint();}
  if(a==='last'){s.last=!s.last;s.tab='core';return repaint();}
  if(a==='rules'){try{R.goPage('rules');}catch(x){}return;}
  if(a==='save'){try{K().saveWeek(b);}catch(x){toast(String(x&&x.message||x),'warn');}return;}
  if(a==='who'){try{const n=v==='전체'?'전체':v;if(R.SalesScope){R.SalesScope.change('type','all');R.SalesScope.change('owner',n);}if(R.SalesFilterState&&R.SalesFilterState.sync)R.SalesFilterState.sync();}catch(x){}try{R.paint();}catch(x){repaint();}return;}
  if(a==='go'){e.preventDefault();try{if(v==='inquiry')R.goPage('inq');else R.PipelineWorkspace.open(v);}catch(x){}return;}
  if(a==='req'){const i=Number(v),m=K().compute().M[i];if(!m)return;const todos=m.todos.filter(t=>!t.done);if(!todos.length)return;
   if(i===0){try{R.goPage('today');}catch(x){}toast('오늘 업무의 \'담당 배정 안 된 견적문의\' 표에서 '+todos.length+'건을 배정할 수 있습니다');return;}
   const shape=t=>({kind:t.kind,id:t.id,name:t.what,owner:t.kind==='rep'?t.id:t.owner,why:t.why,label:t.label,done:!!t.done});
    return send(m.key,K().DEF[i][0],todos.map(shape),m.todos.map(shape));}
  if(a==='sreq'){const C=K().compute(),done=C.done||new Set();let r=null;stageGroups(done).forEach(g=>g.rules.forEach(x=>{if(x.pk===v)r=Object.assign({label:g.label},x);}));if(!r)return;
   const todo=r.targets.filter(t=>!done.has(r.pk+'|'+t.kind+':'+t.id));if(!todo.length)return;return send(r.pk,r.label+' · '+r.t,todo,r.targets.map(t=>Object.assign({},t,{done:done.has(r.pk+'|'+t.kind+':'+t.id)})));}
 }
 function boot(){
  const base=R.paintMgmt;if(typeof base!=='function'||base.__k7)return;
  const wrapped=function(){
   const host=document.getElementById('mgmt-root'),pg=document.getElementById('pg-mgmt');
   if(!enabled()||!host){if(pg)pg.classList.remove('k7-on');return base.apply(this,arguments);}
   try{K().load();try{R.TodayV3&&R.TodayV3.loadWord&&R.TodayV3.loadWord();}catch(e){}/* 다른 PC 에서 보낸 관리자 한마디 뒤에 이어 붙이도록 먼저 읽는다 */host.innerHTML=html();if(!host.__k7){host.__k7=true;host.addEventListener('click',onClick);}
    if(R.G.page==='mgmt'){const t=document.getElementById('ptitle'),p=document.getElementById('psub');if(t)t.textContent='관리팀 KPI';if(p)p.textContent='왼쪽 진단 → 오른쪽 확인할 지표 · 빨강 지표부터';}
    if(pg){pg.classList.remove('kb-on');pg.classList.add('k7-on');}try{K().autoSave&&K().autoSave();}catch(e){}
   }catch(e){console.warn('[관리팀 KPI v7]',e);if(pg)pg.classList.remove('k7-on');return base.apply(this,arguments);}
  };
  wrapped.__k7=true;wrapped.__kb=true;R.paintMgmt=wrapped;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
 root.KpiV7={enabled,html,coreRows,stageGroups,inquiryLive,people,allItems,PILOT:PILOT,bulkSend:send};
})(window);
