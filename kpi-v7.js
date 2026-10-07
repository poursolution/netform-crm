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
  ['파이프라인','장기정체 비율','30일 넘게 멈춘 건 (낮을수록 좋음)','judge'],['파이프라인','방문 후 3일 견적','미팅 후 3일 안에 견적 요청했나','rec'],['실주','실주 사유 입력','실주 처리할 때 왜 졌는지 남겼나','rec'],['관리팀','조치 → 처리율','관리팀 요청이 기한 안에 처리됐나','judge']];
 const CAUSES=['contact','rec','judge','none'],CL={contact:'고객 연락이 늦음',rec:'기록 · 입력을 안 남김',judge:'판단을 미룸',none:'아직 못 잼'};
 const b2b=()=>{try{return (R.InquiryB2BTab&&R.InquiryB2BTab.OWNER)||'조재연';}catch(e){return '조재연';}};
 const people=()=>K().names().filter(n=>n!==b2b());
 const owner=()=>{try{const o=R.SalesScope.state().owner;return o&&o!=='전체'?o:'';}catch(e){return '';}};
 /* 주간 기준 = 월~금(2026-10-06 집계 ⑤ · 주간 브리핑과 같음) */
 const period=()=>{const o=O();if(!o)return '';const mon=o.monday(0),md=s=>Number(s.slice(5,7))+'/'+Number(s.slice(8,10)),end=new Date(Date.parse(mon+'T00:00:00')+4*864e5).toLocaleDateString('en-CA');return md(mon)+'(월) – '+md(end)+'(금)';};
 /* 이번 주 / 누적 분리(2026-10-06 집계 ⑤): 견적문의 지표 둘은 이번 주(월~금) 접수 · 배정 건만 세고, 누적 미처리는 따로 적는다. 지표마다 '대상: …' 한 줄(⑥ 같은 이름 = 같은 분모) */
 const J=()=>R.PipelineJudge&&R.PipelineJudge.on()?R.PipelineJudge:null;
 const TARGET=i=>{const T=(J()||{}).TARGET||{};return [T.sameDay||'이번 주 접수 견적문의',T.firstContact||'이번 주 배정된 견적문의',T.nextRate||'진행 중 영업건(과거 이관 제외)',T.activity||'진행 중 영업건',T.stale||'컨설팅 설계 · 관계관리 진행 건(과거 이관 제외)',T.quote3||'1차 미팅을 마친 컨설팅 설계 건',T.lostReason||'실주 처리된 영업건',T.action||'최근 28일 관리팀 요청'][i]||'';};
 function weekly(S){
  const j=J();if(!j||!S)return null;const w=j.week(0),H=Number((R.OPS_RULES||{}).towerFirstResponseHours)||2;
  const Q=(S.Q||[]).filter(q=>{try{return j.inWeek(R.inquiryCreatedAt(q),w);}catch(e){return false;}});
  const same=Q.filter(q=>{try{const a=R.inquiryAssignedAt(q);return !!a&&j.dayKey(a)===j.dayKey(R.inquiryCreatedAt(q));}catch(e){return false;}});
  const asg=Q.filter(q=>{try{return !!R.inquiryAssigned(q);}catch(e){return false;}}),fast=asg.filter(q=>{try{const a=Date.parse(R.inquiryAssignedAt(q)||''),f=Date.parse(R.inqCtlFirstResponseAt(q)||'');return Number.isFinite(a)&&Number.isFinite(f)&&f-a<=H*3600e3;}catch(e){return false;}});
  return [{num:same.length,den:Q.length,cum:(S.unassigned||[]).length,cumL:'누적 미배정'},{num:fast.length,den:asg.length,cum:(S.noResponse||[]).length,cumL:'누적 첫 연락 전'}];
 }
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
 const reqSum=(x,noun)=>noun+' '+x.total+'건 중 요청 가능 '+x.can+'건'+(x.done?' · 이미 요청 중 '+x.done:'')+(x.none?' · 담당 없음 '+x.none:'');
 /* 핵심 지표 8줄 */
 function coreRows(C,PV,last){
  const WK=last?null:weekly(C.S);
  return C.M.map((m,i)=>{
   const q=QN[i],g=m.def[4],lb=!!m.def[5];let v=m.v,num=m.num,den=m.den,cum='';
   if(last){const w=K().weekRowOf(i,-1);v=w?pct(w.numerator,w.denominator):null;num=w?w.numerator:0;den=w?w.denominator:0;}
   else if(WK&&WK[i]){num=WK[i].num;den=WK[i].den;v=pct(num,den);cum=WK[i].cumL+' '+WK[i].cum+'건(이번 주 지표에는 안 들어감)';}
   const pilot=PILOT.has(i),nd=v==null,bad=!pilot&&!nd&&(lb?v>g:v<g),gap=nd?0:Math.round(Math.abs(g-v)*10)/10,d=last||m.v==null||m.last==null?null:Math.round((m.v-m.last)*10)/10;
   const left=last?0:m.left,total=last?0:m.todos.length,RQ=last?null:reqSplit(m.todos);
   return {i,key:m.key,grp:q[0],l:q[1],q:q[2],cause:nd&&!pilot?'none':q[3],nd,bad,lb,v,g,gap,left,total,d,num,den,pilot,ok:!nd&&!bad&&!pilot,
    frac:den?num+' / '+den+'건':'아직 못 잼',goal:(lb?'≤ ':'')+g+'%',
    meta:last?'지난주 금요일 저장본':(m.last==null?'지난주 –':'지난주 '+fmt(m.last)+' '+(d===0?'→ 그대로':(d>0?'▲':'▼')+Math.abs(d)+'%p'))+' · 누가 '+whoOf(i,m,PV)+(cum?' · '+cum:''),target:'대상: '+TARGET(i),
    reason:pilot?'시범 측정 · 평가 제외':nd?'아직 못 잼':bad?'미달 · '+gap+'%p '+(lb?'초과':'부족'):'달성',
    btn:last||!total?'':/* 이번 주 값이 '아직 못 잼'이어도 누적 미처리가 있으면 요청 버튼은 둔다(2026-10-06 집계 ⑤) */!left?'보냄 ✓':i===0?left+'건 배정':i===4?left+'건 판단 요청':i===3?'담당별 요청':i===7?left+'건 다시 확인':'요청 가능 '+RQ.can+'건',dis:!!RQ&&!RQ.can&&left>0&&![0,3,4,7].includes(i),reqSum:RQ&&total?reqSum(RQ,q[3]==='rec'?'미등록':'대상'):''};
  }).sort((a,b)=>(a.nd?2:a.bad?0:1)-(b.nd?2:b.bad?0:1)||b.gap-a.gap||a.i-b.i);
 }
 /* 단계별 기준: 파이프라인 각 단계 화면의 '그래서 뭘 해야 하나' 기준(빨강 사유)을 같은 함수로 — 기준 넘긴 건 = 그 사유가 붙은 건.
    지킨 비율 = 1 − 넘김 ÷ 대상. 대상 = 그 단계의 건(견적 요청 3일은 미팅을 마친 건, 견적문의는 배정된 건 · 후속 단계 건) */
 const BASE={consulting:{nodue:it=>it.bucket==='done'}};
 function stageGroups(done){
  const P=R.PipelineStageB,out=[],isDone=(pk,kind,id)=>done.has(pk+'|'+kind+':'+id);
  const rule=(stage,k,t,how,targets,base)=>{const pk='stage:'+stage+':'+k,n=targets.length,b=Math.max(base,n),left=targets.filter(x=>!isDone(pk,x.kind,x.id)).length,rq=reqSplit(targets.map(x=>({owner:x.owner,done:isDone(pk,x.kind,x.id)})));return {stage,k,pk,t,how,targets,n,base:b,left,rq,p:b?Math.round((1-n/b)*1000)/10:null};};
  try{const IL=R.InquiryListV3,IV=R.InquiryListV2;if(IL&&IV&&typeof IL.model==='function'&&typeof IV.rows==='function'){
   const ms=IV.rows().map(x=>IL.model(x)).filter(m=>m.step<4),RU=R.OPS_RULES||{},H=Number(RU.towerFirstResponseHours)||2,D=Number(RU.inquiryFollowDays)||7;
   const T=m=>({kind:'inq',id:String(m.key),name:m.site,owner:String(m.owner||''),why:m.elapsed||''});
   const r1=ms.filter(m=>m.step===1),r2=ms.filter(m=>m.follow&&m.late);
   if(ms.length)out.push({key:'inquiry',label:'견적문의',total:ms.length,over:new Set(r1.concat(r2).map(m=>m.key)).size,rules:[
    rule('inquiry','nofirst','첫 연락 전','배정 후 '+H+'시간 안 첫 연락',r1.map(m=>Object.assign(T(m),{label:'첫 연락 요청'})),ms.filter(m=>m.step>=1).length),
    rule('inquiry','stale','후속 연락 필요','첫 연락 후 '+D+'일 넘게 연락 없음',r2.map(m=>Object.assign(T(m),{label:'후속 연락 요청'})),ms.filter(m=>m.follow).length)]});
  }}catch(e){}
  if(P&&R.PipelineWorkspace){let rows=[];try{rows=R.PipelineWorkspace.rows();}catch(e){rows=[];}
   Object.keys(P.CFG).forEach(key=>{const list=rows.filter(r=>r.group===key);if(!list.length)return;let md=null;try{md=P.model(key,list);}catch(e){}if(!md)return;
    /* 실주 = 핵심 지표 7 · 측정 기준 a3 · 실주 화면과 같은 완료 판정(사유 + 재영업 여부, 경쟁사 낙찰이면 경쟁사 · 낙찰가) — 빨강이 아닌 두 사유도 같이 센다 */
    const LF=key==='lost'?['noreason','relist','nobid']:[],red=Object.keys(md.C.RS).filter(k=>md.isRed(k)||LF.includes(k));if(!red.length)return;
    out.push({key,label:md.C.name,total:list.length,over:key==='lost'?md.items.filter(it=>it.bucket==='nore').length:md.items.filter(it=>it.red).length,rules:red.map(k=>{const hit=md.items.filter(it=>it.rs.includes(k)),bf=BASE[key]&&BASE[key][k];
     return rule(key,k,md.C.RS[k][0],md.C.RS[k][3],hit.map(it=>({kind:'deal',id:String(it.row.key),name:it.row.site,owner:String(it.row.owner||''),why:md.C.RS[k][0],label:md.C.RS[k][2]})),bf?md.items.filter(bf).length:md.items.length);})});});}
  return out;
 }
 /* '조치 → 처리율'이 단계별 기준 요청도 세도록: 지금 기준을 넘긴 건의 열쇠(견적문의 몫) */
 function inquiryLive(){const out=[];try{stageGroups(new Set()).filter(g=>g.key==='inquiry').forEach(g=>g.rules.forEach(r=>r.targets.forEach(t=>out.push(r.pk+'|'+t.kind+':'+t.id))));}catch(e){}return out;}
 const reqBtn=(label,act,v,dis)=>!label?'<span class="k7-auto">자동 측정</span>':'<button type="button" class="k7-req'+(label==='보냄 ✓'?' sent':'')+'" data-k7="'+act+'" data-v="'+attr(v)+'"'+(label==='보냄 ✓'||dis?' disabled':'')+'>'+h(label)+'</button>';
 /* ops_12 D⑩ 관리팀 지표 — 요청 수보다 해결: 요청(이번 주 등록 · 문구 복사 제외) · 기한 내 해결률 · 재요청률 · 평균 처리 시간. 요청 엔진 기록(WorkRequest · 최근 30일)에서만 센다 */
 function mgmtMetrics(KMD){
  const W=R.WorkRequest;if(!W||!W.enabled||!W.enabled())return null;const L=W.state().list||[],j=J(),wk=j?j.week(0):null;
  const week=L.filter(r=>wk&&j.inWeek(r.created_at,wk)&&r.status!=='cancelled');
  const closed=L.filter(r=>r.closed_at&&(r.status==='done'||r.status==='replied')),onTime=closed.filter(r=>Date.parse(r.closed_at)<=Date.parse(r.due_at)).length;
  const all=L.filter(r=>r.status!=='cancelled'),re=all.filter(r=>Number(r.round)>=2).length;
  const avg=closed.length?closed.reduce((s,r)=>s+(Date.parse(r.closed_at)-Date.parse(r.created_at))/864e5,0)/closed.length:null;
  return [['요청',week.length+'건','이번 주 등록 기준 · 문구 복사 제외'],['기한 내 해결률',closed.length?Math.round(onTime*100/closed.length)+'%':'–',closed.length?onTime+' / '+closed.length+' · 기한 안 처리':'완료된 요청 없음'],['재요청률',all.length?Math.round(re*100/all.length)+'%':'–',all.length?re+' / '+all.length+' · 같은 건 2번 이상 요청':'요청 없음'],['평균 처리 시간',avg==null?'–':(Math.round(avg*10)/10)+'일','요청 → 완료 · 최근 30일']].map(m=>{const d=KMD&&KMD.byId(m[0]==='기한 내 해결률'?'d1':m[0]==='평균 처리 시간'?'d2':'');return d?[m[0],d.vText,d.sub+' · 이번 주']:m;}).concat(R.ExecWording&&R.ExecWording.on()?[['기한 변경',R.ExecWording.postponeCount().n+'회','이번 주(월~금) · 원래 기한 · 사유와 함께 기록 · 지연 기록은 그대로']]:[]);/* 기한 내 해결률 · 평균 처리 시간 = 측정 기준 탭 d1 · d2 와 같은 값(이번 주 등록 요청) */
 }
 function html(){
  const s=ST(),C=K().compute(),PV=personVals(),rows=coreRows(C,PV,s.last),SG=stageGroups(C.done||new Set()),o=O(),w=K().weekly();
  const KM=R.KpiMeasure&&R.KpiMeasure.enabled()?R.KpiMeasure:null,KMD=KM?KM.compute():null;/* 측정 기준 탭 · 왼쪽 관리팀 지표가 같은 계산(한 번만) */
  const MG=mgmtMetrics(KMD);
  const miss=rows.filter(r=>r.bad).length,pilotN=rows.filter(r=>r.pilot).length,nd=rows.filter(r=>r.nd&&!r.pilot).length,hit=rows.length-miss-nd-pilotN,N=rows.length||1;
  const leftN=C.M.reduce((a,m)=>a+m.left,0),sentN=C.M.reduce((a,m)=>a+(m.todos.length-m.left),0);
  const cmp=C.M.filter(m=>m.v!=null&&m.last!=null).map(m=>{const d=m.v-m.last;return m.def[5]?-d:d;}),up=cmp.filter(d=>d>0).length,dn=cmp.filter(d=>d<0).length;
  const stageOver=SG.reduce((a,g)=>a+g.over,0),ruleN=SG.reduce((a,g)=>a+g.rules.length,0);
  if(s.cause&&!CAUSES.includes(s.cause))s.cause='';
  const list=rows.filter(r=>!s.cause||r.cause===s.cause);
  /* 위: 담당자 알약 + 기간 */
  const cur=owner(),pill=(l,n,on)=>'<button type="button" class="cf-pill k7-who'+(on?' on':'')+'" data-k7="who" data-v="'+attr(l)+'" aria-pressed="'+on+'">'+h(l)+(n?' <em>'+h(n)+'</em>':'')+'</button>';
  const filter='<div class="k7-filter">'+pill('전체','',!cur)+PV.map(p=>{const n=p.measured&&p.vals?p.vals.filter((v,i)=>failOf(v,i)).length:0;return pill(p.n,p.measured?'미달 '+n:'기록 없음',cur===p.n);}).join('')+'<i></i><span class="k7-period">기간 <b>이번 주 '+h(period())+'</b></span></div>';
  const mon=o?o.monday(0):'',savedThis=w.rows.some(x=>String(x.week_start||'').slice(0,10)===mon),canSave=!!(o&&o.admin()&&o.has('crm_kpi_weekly_save_v1')),hasLast=C.M.some((m,i)=>!!K().weekRowOf(i,-1));
  const bar='<div class="k7-bar"><i class="dot"></i><b>관리팀 KPI</b><span>'+(s.last?'지난주 저장본 · 한 줄 = 지표 하나':'한 줄 = 지표 하나')+'</span><i class="sp"></i>'
   +'<button type="button" data-k7="last" aria-pressed="'+!!s.last+'">'+(s.last?'이번 주 보기':'지난주 보기')+'</button><button type="button" data-k7="rules">기준 설정</button>'
   +'<button type="button" class="pri" data-k7="save"'+(canSave&&!w.saving?'':' disabled')+(canSave?'':' title="관리자만 저장할 수 있습니다"')+'>'+(w.saving?'저장 중…':savedThis?'이번 주 결과 다시 저장':'이번 주 결과 저장')+'</button></div>';
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
   +'<section class="k7-card k7-mg"><header><b>관리팀 지표</b><span>요청 수보다 해결</span></header>'+(MG?'<div class="k7-tiles">'+MG.map(m=>'<div><span>'+h(m[0])+'</span><b>'+h(m[1])+'</b><small>'+h(m[2])+'</small></div>').join('')+'</div>':'<p class="k7-none">요청 저장소가 아직 서버에 없어 잴 수 없습니다</p>')+'</section>'/* ops_12 D⑩ */
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
      +(r.n?reqBtn(r.left?'요청 가능 '+r.rq.can+'건':'보냄 ✓','sreq',r.pk,r.left&&!r.rq.can):'<span class="k7-auto">넘긴 건 없음</span>')+'</div>';}).join('')).join('')+'</div>':'<p class="k7-empty">이 조건에 해당하는 단계 건이 없습니다.</p>');
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
 function send(pkey,title,list){
  const by=new Map();list.forEach(t=>{const o=t.owner&&t.owner!=='미배정'?t.owner:'';(by.get(o)||by.set(o,[]).get(o)).push(t);});
  let told=0;by.forEach((ts,o)=>{if(!o)return;const line=title+' — '+(ts[0].kind==='rep'?(ts[0].why||'확인 부탁드립니다'):ts.length+'건: '+ts.slice(0,3).map(t=>t.name).join(', ')+(ts.length>3?' 외 '+(ts.length-3)+'건':''));try{if(K().requestLine(o,line))told++;}catch(e){}});
  R.G.kbDone=(R.G.kbDone||[]).concat(list.map(t=>pkey+'|'+t.kind+':'+t.id));
  const o=O();if(o&&o.has('crm_kpi_action_log_v1')){const q=list.slice(),run=()=>{const t=q.shift();if(!t)return;return o.rpc('crm_kpi_action_log_v1',{promise_key:pkey,action:String(t.label||'요청').slice(0,80),target_type:t.kind==='deal'?'deal':t.kind==='rep'?'person':'inquiry',target_id:String(t.id).slice(0,80),target_name:String(t.name||'').slice(0,200),note:String(t.why||'').slice(0,500)}).catch(()=>{}).then(run);};
   Promise.all([run(),run(),run(),run()]).then(()=>{try{K().load(true);}catch(e){}});}
  const owners=[...by.keys()].filter(Boolean).length,none=(by.get('')||[]).length;
  toast(list.length+'건 요청을 남겼습니다 · 담당 '+owners+'명'+(told?' 오늘 업무 관리자 한마디':'')+(none?' · 담당 없는 '+none+'건은 배정 뒤 전달':''));
  repaint();
 }
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
   return send(m.key,K().DEF[i][0],todos.map(t=>({kind:t.kind,id:t.id,name:t.what,owner:t.kind==='rep'?t.id:t.owner,why:t.why,label:t.label})));}
  if(a==='sreq'){const C=K().compute(),done=C.done||new Set();let r=null;stageGroups(done).forEach(g=>g.rules.forEach(x=>{if(x.pk===v)r=Object.assign({label:g.label},x);}));if(!r)return;
   const todo=r.targets.filter(t=>!done.has(r.pk+'|'+t.kind+':'+t.id));if(!todo.length)return;return send(r.pk,r.label+' · '+r.t,todo);}
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
 root.KpiV7={enabled,html,coreRows,stageGroups,inquiryLive,people,allItems,PILOT:PILOT};
})(window);
