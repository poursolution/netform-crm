/* 파이프라인 단계 화면 v3 — 전 단계 공통 틀 (2026-10-05 디자인 핸드오프 'design_handoff_pipeline_v3' · 파이프라인 단계 v3.dc.html)
   컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공 5개 단계를 화면 하나로 그린다 — 단계마다 다른 것은 아래 설정값(cfg)뿐.
   위 → 아래: (공통 필터줄 = 기존 그대로) → 단계 제목 + 설명 → 상태 탭 4칸([전체] + 상태 3개 · 첫 상태 = 빨강) →
              왼쪽 단계 진단(기준 넘김 · 평균 체류 / 왜 멈춰 있나 4개 / 그래서 뭘 해야 하나) · 오른쪽 확인할 현장(리스트 | 보드).
   숫자는 전부 자료에서: 줄 = 기존 행(PipelineStageB.model → PipelineListV2.build), 상태 = 단계 필드 · 다음 할 일 · 발송일 · 입찰 일정 · 계약 원장.
     · 탭 3개는 서로 겹치지 않고 빠지는 줄이 없다 → 탭 합 = 전체 = 이 단계 건수(사이드바 · 브랜드 칩 '전체').
     · '왜 멈춰 있나' 첫 사유 = 빨강 상태 탭과 같은 건수. 기준 넘김 = 빨강 상태 건수.
   목록은 한 쪽 20건 + 쪽 번호(ListPager · 전체 지침). 열기 · 버튼은 기존 경로(PipelineStageB.open → 상세 + 액션).
   수주 · 실주 · 상세 창 · 공통 틀은 그대로. 끄기: G.pipeStageV3Off=true → 이전 단계 화면(B안 · 관계관리 세분화). */
(function(root){
 'use strict';
 const B=root.PipelineStageB,L2=root.PipelineListV2;if(!B||!L2)return;
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 /* 수주 · 실주도 같은 틀(2026-10-06 대표 "이 기준으로 수주 · 실주 크기 및 배치 동일하게") — 상태 · 사유 · 버튼 · 할 일은 B안 표(PipelineStageB.CFG) 그대로, 틀만 v3 */
 const KEYS=['consulting','sent','relationship','competition','construction','won','lost'];
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const RED='#b42318';
 const enabled=key=>!root.G.pipeStageV3Off&&KEYS.includes(key||root.G.pipelineStage)&&B.enabled(key||root.G.pipelineStage);
 const st=()=>root.G.ps3||(root.G.ps3={key:'',tab:-1,reason:null,view:'list'});
 const days=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?n:null;};
 /* 날짜는 한국 시간 기준(2026-10-07 stage7 공통 · 실주일 하루 차이 원인 = 시각 붙은 값을 UTC 로 자르던 것) */
 const KD=v=>{const J=root.PipelineJudge;return J&&J.dayKey?(J.dayKey(v)||String(v||'').slice(0,10)):String(v||'').slice(0,10);};
 const ymd=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(KD(v));return m?Number(m[2])+'/'+Number(m[3]):'';};
 const ymdDot=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(KD(v));return m?m[1]+'.'+Number(m[2])+'.'+Number(m[3]):'';};
 const money=v=>{const n=Number(v)||0;if(!n)return '금액 미정';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const ctxOf=d=>{let p={};try{p=root.itemPatch(d,'deal')||{};}catch(e){}return d.stage_contexts||p.stage_contexts||{};};
 const ctxVals=(cx,k)=>Object.keys(cx).map(c=>cx[c]&&cx[c].fields&&cx[c].fields[k]).filter(v=>v!=null&&v!=='');
 const lastDays=r=>{let a=null;try{a=root.activityAge(r.item);}catch(e){}const c=r.contactDays;if(a===null||a===undefined)return c==null?null:c;return c==null?a:Math.min(a,c);};
 /* 결정권자를 아는가: 상세의 '누가 결정하나'(decision_maker) — '모름'은 모르는 것 */
 const deciderKnown=it=>{const d=it.row.item;return ctxVals(ctxOf(d),'decision_maker').concat([d.decision_maker]).map(x=>String(x||'').trim()).some(x=>x&&x!=='모름');};
 /* 공사 예정 연도: 공사 연도 칸 → 상세의 공사 예정 → 옮겨 온 값 */
 const yearOf=it=>{const d=it.row.item;let y='';try{y=root.ConstructionYear.valueOf(d).year||'';}catch(e){}if(y)return String(y);const m=/(20\d{2})/.exec(ctxVals(ctxOf(d),'construction_plan').concat([d.planned_construction_date,d.construction_planned_at,d.construction_year,d.constructionYear]).map(x=>String(x||'')).join(' '));return m?m[1]:'';};
 const finOk=it=>{const c=(ctxOf(it.row.item).completion||{}).fields||{},k=Array.isArray(c.completion_checks)?c.completion_checks:[];return ['공사 완료','준공검사 완료'].every(x=>k.includes(x));};
 const goalOf=(key,d)=>{const g=(root.OPS_RULES||{}).pipeStageGoalDays;return Number(g&&g[key])||d;};
 /* ── 단계 설정값(README 표 + 시안의 ST): tabs [이름, 기준 한 줄] 첫 칸 = 빨강 · reasons [키, 이름] 첫 사유 = 빨강 상태 · act [버튼, 상세 액션] · tab(it) = 0 · 1 · 2 ── */
 const REDB=()=>(root.StageBoard&&root.StageBoard.RED)||'#d93a3a';
 /* 수주 · 실주: 탭 = B안 막대 3칸, 사유 · 버튼 · 할 일 = B안 RS 표. 줄 글은 첫 빨강 사유(없으면 상태 이름) + 근거, 기준 넘김 = 빨강 사유가 있는 건 */
 function closedCfg(key){
  const K=B.CFG[key],Q=B.rules(),RS=K.RS,red=k=>!!(RS[k]&&RS[k][1]===REDB()),rsOf=x=>{const k=x.it.first||x.rs[0];return k&&RS[k]||null;};
  /* stage7 ⑥⑦(2026-10-07): 수주 · 실주는 끝 상태 — 제목 숫자 = '실적(결과) 정보 보완 n · 기한 초과 0'(지연 아님), 수주 금액 옆 '낙찰금액 입력 n건 기준', 줄 = '수주 · 날짜 · 금액' / 기준일 = 빠진 정보 / 기한 = '확인 필요 · 기한 아님' */
  const lostCat=d=>{try{const r=d.lost_reason||(((d.stage_contexts||{}).lost||{}).fields||{}).close_reason||'';return r?(root.CRMRules.lostCategory(r)||''):'';}catch(e){return '';}};
  return {name:K.name,goal:Q.stay,desc:K.desc(),closed:true,amountLabel:key==='won'?'수주 금액':'예상 금액',
   kpiLabel:key==='won'?'실적 정보 보완':'결과 정보 보완',
   /* stage7_2 ⑧: 왼쪽 칸은 체류 · 기준 · '왜 멈춰 있나' 대신 결과 기록 완성률 + 보완할 것(항목별 건수) */
   doneOf:it=>key==='won'?it.bucket==='done':it.bucket!=='nore',
   fixLabel:{wtype:'수주 유형 · 낙찰금액 · 낙찰사',cdate:'계약일 · 착공 · 준공',cinfo:'계약 정보',noreason:'사유',nobid:'경쟁사 · 낙찰가',relist:'재영업 가능 여부',contact:'재접촉 할 일'},
   headNote:key==='won'?items=>'낙찰금액 입력 '+items.filter(x=>x.row.amount!=null&&Number(x.row.amount)>0).length+'건 기준':null,
   tabs:K.S.map(s=>[s[1],s[3]]),reasons:Object.keys(RS).map(k=>[k,RS[k][0]]),act:K.S.map(()=>['열기','']),todo:'',
   tab:it=>{const i=K.S.findIndex(s=>s[0]===it.bucket);return i<0?0:i;},
   has:Object.fromEntries(Object.keys(RS).map(k=>[k,it=>it.rs.includes(k)])),sub:it=>it.sub,
   redOf:it=>!!it.red,redReason:red,
   btnOf:x=>{const rs=rsOf(x);return rs?[rs[2],rs[4]]:['열기',''];},
   nowOf:x=>{const d=x.row.item,v=x.it.values||{};return key==='won'?['수주',ymdDot(v.completionDate||v.contractDate||d.closed_at)||'날짜 미기록',x.row.amount!=null&&Number(x.row.amount)>0?money(x.row.amount):''].filter(Boolean).join(' · '):['실주',ymdDot(v.lossDate)||'실주일 미기록',lostCat(d)].filter(Boolean).join(' · ');},
   rowOpts:x=>{const rs=rsOf(x);return {base:rs?rs[0]:'기록 완료'+(/경쟁사 해당 없음/.test(x.sub||'')?' · 경쟁사 해당 없음':''),/* stage7_2 ⑥⑦ 사업 취소 · 중단 · 연기 · 예산 = 경쟁사 · 낙찰가 해당 없음(미기록으로 세지 않음) */dueText:x.red?'확인 필요 · 기한 아님':'기한 없음 · 끝 상태',dueClass:x.red?'amb':'g'};},
   taskOf:x=>{const rs=rsOf(x);return rs?rs[3]:K.S[x.tab][3];},
   issueOf:x=>{const rs=rsOf(x);return rs?rs[0]:K.S[x.tab][1];},
   todoHtml:(items,S)=>{const byS=S.tab===-1?items:items.filter(x=>x.tab===S.tab),rs=Object.keys(RS).map(k=>({k,n:byS.filter(x=>x.rs.includes(k)).length})).filter(x=>x.n>0),acts=(S.reason?[S.reason]:rs.slice(0,3).map(x=>x.k)).map(k=>({tag:RS[k][0]+' '+byS.filter(x=>x.rs.includes(k)).length+'건',t:RS[k][3]}));
    return acts.length?acts.map(a=>'<div class="psb-act"><span>'+h(a.tag)+'</span><p>'+h(a.t)+'</p></div>').join(''):'<p class="ps3-none">기준을 넘긴 현장이 없습니다</p>';}};
 }
 function cfg(key){
  if(key==='won'||key==='lost')return closedCfg(key);
  const Q=B.rules(),mo=Math.max(1,Math.round(Q.wait/30)),D7=Number((root.OPS_RULES||{}).bidPrepDays)||7;
  const nonext=it=>!(it.row.next&&it.row.next.text&&it.row.due),long=it=>it.stall>Q.stay;
  /* stage7 ①(2026-10-07 design_handoff_stage7): '견적 처리 3일 · 5일' = 물량 산출 기한(견적 요청 등록일부터 · 견적팀). '미팅 후 견적 요청 등록'은 따로 둔 업무 · 기한은 설정값(운영 제안) */
  const qrOf=d=>String((((ctxOf(d).consulting||{}).fields||{}).quote_request)||'').trim();
  if(key==='consulting')return {name:'컨설팅 설계',goal:goalOf(key,14),desc:'1차 현장미팅으로 고객 요구를 확인하고 견적을 준비하는 단계 · 물량 산출 목표 '+Q.quote+'일 · 최대 5일 (견적 요청 등록일부터 · 견적팀)',
   tabs:[['미팅 전 · 일정 없음','첫 통화에서 미팅 날짜 잡기'],['미팅 예정','미팅 전날 확인 연락'],['미팅 완료 · 견적 준비','미팅 후 견적 요청 등록']],
   reasons:[['nodate','미팅 일정 없음'],['nodue','물량 산출 기한 넘김'],['req','필수 확인 미입력'],['nonext','다음 행동 · 날짜 없음'],['long',Q.stay+'일 넘게 머묾']],
   act:[['미팅 잡기','next'],['확인 연락','activity'],['견적 요청','stagefields']],
   todo:'미팅 전 현장은 첫 통화에서 1차 미팅 날짜까지 잡고, 미팅 후 견적 요청을 등록하세요(등록 기한은 운영 제안 · 설정값). 물량 산출은 견적 요청 등록일부터 목표 '+Q.quote+'일 · 최대 5일(견적팀).',
   tab:it=>it.bucket==='plan'?1:it.bucket==='done'?2:0,
   taskOf:x=>x.tab===2?(qrOf(x.row.item)?'물량 산출 기한 확인 (견적팀)':'견적 요청 등록'):x.tab===1?'미팅 전날 확인 연락':'첫 통화에서 미팅 날짜 잡기',
   nowOf:x=>x.tab===0?'미팅 일정 없음':x.sub,/* 상태 이름 + 같은 말 반복으로 줄이 길어지지 않게 */
   has:{nodate:(it,t)=>t===0,nodue:it=>it.rs.includes('nodue'),req:it=>it.rs.includes('req'),nonext,long},sub:it=>it.sub};
  /* stage7 ②: 발송일 있는 건만 7일 판정 · 없으면 넷째 칸 '발송일 확인 필요'(판정 불가 · 7일 계산 안 함) → 발송일 · 자료 · 수신자 입력 */
  if(key==='sent')return {name:'자료 발송완료',goal:goalOf(key,14),desc:'견적 · 제안 자료를 보낸 뒤 고객 반응을 확인하는 단계 · 발송 후 '+Q.follow+'일 안 후속 · 발송일 있는 건만 '+Q.follow+'일 판정',
   tabs:[[Q.follow+'일 넘음 · 후속 없음','오늘 후속 연락'],['발송 후 '+Q.follow+'일 안','D+3 수신 확인'],['고객 반응 있음','다음 단계 판단'],['발송일 확인 필요','발송일 · 자료 · 수신자 입력']],ambTab:3,
   reasons:[['nofollow','발송 후 '+Q.follow+'일 · 후속 없음'],['nosent','발송일 미기록 · 판정 불가'],['nodecider','결정권자 미확인'],['nonext','다음 행동 · 날짜 없음'],['long',Q.stay+'일 넘게 머묾']],
   act:[['후속 연락','activity'],['수신 확인','activity'],['단계 판단','stage'],['정보 입력','stagefields']],
   todo:'보낸 지 '+Q.follow+'일 넘은 건은 오늘 반응을 확인하고, 결정권자 일정을 함께 물어보세요. 발송일이 없는 건은 발송일 · 자료 · 수신자를 먼저 입력하세요('+Q.follow+'일 계산 안 함).',
   tab:it=>it.bucket==='late'?0:it.bucket==='done'?2:it.bucket==='nodate'?3:1,
   has:{nofollow:(it,t)=>t===0,nosent:(it,t)=>t===3,nodecider:it=>!deciderKnown(it),nonext,long},sub:it=>it.sub};
  /* 관계관리 v12(2026-10-07 design_handoff_relationship_v12): 상태 5칸(집중 · 일반 · 대기 · 보류 · 미확인) + 업무 필터(상태와 별개) + 왼쪽 전환 검토 요청 · 재분류 진행률. 끄기 G.relV12Off */
  if(key==='relationship'&&root.RelV12&&root.RelV12.on()){const RV=root.RelV12,TB=RV.tabs();
   return {name:'관계관리',goal:goalOf(key,60),desc:'견적 후 고객 상태에 따라 연락 주기를 다르게 · 고객과 약속한 날짜가 있으면 그 날짜 우선',
    tabs:TB.map(t=>[t[0],t[1]]),tabSrc:TB.map(t=>t[2]),ambTab:4,
    reasons:RV.REVIEW.map(r=>[r[0],RV.reviewLabel(r[0])]),act:[['연락 기록','activity'],['연락 기록','activity'],['연락 기록','activity'],['연락 기록','activity'],['분류하기','classify']],
    todo:'',workFilters:RV.WORKS,workNote:'다음 행동 미등록 · 연락 기록 없음만으로 대기 · 보류로 판정하지 않음',
    prep:it=>{it.rv=RV.state(it.row);},tab:it=>RV.tabIndex(it.rv||(it.rv=RV.state(it.row))),
    has:{toNormal:it=>it.rv.review==='toNormal',toWait:it=>it.rv.review==='toWait',holdDue:it=>it.rv.review==='holdDue'},
    work:(x,k)=>{const s=x.it.rv||RV.state(x.row);return k==='od'?s.od:k==='wk'?s.wk:k==='nx'?s.nx:true;},
    redOf:it=>!!it.rv.od,sub:it=>it.rv.now,
    nowOf:x=>x.it.rv.now,taskOf:x=>x.it.rv.task,btnOf:x=>x.it.rv.btn,
    /* stage7_2 ①: 상태 분류 ≠ 업무 기한 — 미확인이어도 이미 잡힌 연락 약속은 그대로 계산 · 표시('35일 지남 · 9/2 약속'), '기한 없음'은 다음 행동일이 정말 없을 때만 */
    rowOpts:x=>{const s=x.it.rv,rel=(n)=>n<0?(-n)+'일 지남':n===0?'오늘까지':n+'일 남음';return {tag:s.tag,tagClass:s.key,tagAct:s.key==='unk'?'classify':'',base:s.base,dueText:s.key==='unk'?(x.row.due?rel(s.n)+' · '+ymd(x.row.due)+' 약속':'기한 없음 · 분류 후 정해짐'):(s.due&&!x.row.due?rel(s.n)+' · '+s.dueWhy:''),dueClass:s.key==='unk'?(x.row.due?(s.od?'r':''):'g'):(s.od?'r':'')};},
    leftHtml:(items,S)=>RV.leftHtml(items,S)};}
  if(key==='relationship')return {name:'관계관리',goal:goalOf(key,60),desc:'공사 시기가 남은 고객과 관계를 이어가는 단계 · '+mo+'개월 1회 연락',
   tabs:[['다음 연락일 지남','오늘 연락'],['이번 주 연락','약속일 지키기'],['장기 대기',mo+'개월마다 안부']],
   reasons:[['over','다음 연락일 지남'],['nonext','다음 행동 없음'],['noyear','공사 예정 연도 없음'],['quiet',Q.wait+'일 무접촉']],
   act:[['연락','activity'],['연락','activity'],['안부 연락','activity']],
   todo:'다음 연락일이 지난 고객부터 오늘 연락하고, 공사 예정 연도를 꼭 받아 두세요.',
   /* 다음 연락일 = 다음 할 일 날짜: 지났으면 빨강 · 오늘부터 7일 안이면 이번 주 · 그 뒤거나 없으면 장기 대기 */
   tab:it=>{const d=it.row.due?days(it.row.due):null;return d!==null&&d<0?0:d!==null&&d<=6?1:2;},
   has:{over:(it,t)=>t===0,nonext,noyear:it=>!yearOf(it),quiet:it=>{const ld=lastDays(it.row);return ld===null?it.stall>Q.wait:ld>Q.wait;}},
   sub:(it,t)=>{const r=it.row,d=r.due?days(r.due):null,y=yearOf(it);
    if(t===0)return '다음 연락 '+ymd(r.due)+' → '+(-d)+'일 지남';
    if(t===1)return '약속 '+ymd(r.due)+(r.next&&r.next.text?' · '+r.next.text:'');
    return (y?y+' 공사 예정':'공사 예정 연도 없음')+(r.due?' · 다음 연락 '+ymd(r.due):' · 다음 연락일 없음');}};
  /* stage7 ④: D-7 준비 · 개찰 다음날 등록은 '운영 제안'(회의 확정 아님) 표시 · 결정 · 입찰 일정 없으면 넷째 칸 '일정 미등록' → 입찰 · PT 일정 확인(D-7 계산 안 함) */
  if(key==='competition')return {name:'경쟁 · 입찰',goal:goalOf(key,30),desc:'현설 · PT · 입찰을 준비하는 단계 · 마감 D-'+D7+' 준비 · 개찰 다음날 결과 등록(운영 제안 · 회의 확정 아님)',
   tabs:[['마감 D-'+D7+' 이내','제안서 · 가격 확정 · 운영 제안'],['진행 중','일정 확인'],['결과 대기','개찰 다음날 결과 등록 · 운영 제안'],['일정 미등록','입찰 · PT 일정 확인']],ambTab:3,
   reasons:[['noprop','제안서 미공유'],['nodate','결정 · 입찰 일정 미등록'],['nocomp','경쟁 공법 미확인'],['nodecider','결정권자 미확인'],['nores','결과 미등록']],
   act:[['제안 준비','stagefields'],['일정 확인','stagefields'],['결과 등록','stage'],['일정 입력','stagefields']],
   todo:'마감 D-'+D7+' 이내 건은 제안서를 팀장과 공유하고, 개찰 다음날 결과를 등록하세요(둘 다 운영 제안). 결정 · 입찰 일정이 없는 건은 입찰 · PT 일정부터 확인하세요(일정 없으면 D-'+D7+' 계산 안 함).',
   /* 결과 대기 = 제출했거나 마감 · 결정 일정이 지난 건 / 마감 D-7 이내 = 아직 내지 않았고 일정이 7일 안 / 일정 미등록 = 날짜 없음(제출 전) / 나머지 = 진행 중 */
   tab:it=>{const f=it.row.fields||{},dd=days(it.row.date),sub=/제출|완료/.test(String(f.bid_plan||f.position||''));if(!it.row.date&&!sub)return 3;return (sub||(dd!==null&&dd<0))?2:(dd!==null&&dd<=D7)?0:1;},
   has:{noprop:(it,t)=>t===0,nodate:(it,t)=>t===3,nocomp:it=>!it.values.competitor,nodecider:it=>!deciderKnown(it),nores:it=>it.rs.includes('nores')},sub:it=>it.sub};
  /* stage7_2 ⑤: 계약 · 시공 4상태 — 계약 체결 → 착공 준비(착공일 미입력 · 아직 안 온 착공일) → 시공 중(착공일이 입력되고 오늘 이전) → 준공 확인. 계약일만으로 '시공 중' 판정 금지.
     끝난 상태의 업무(계약 체결 확인)는 종료 대상으로 표시(실제로는 단계가 바뀔 때 서버가 열린 업무를 닫는다) · 진단 '시공 중 방문 없음'은 시공 중 칸과 같은 조건 */
  const startOf=it=>String(it.values.startDate||'').slice(0,10);
  const started=it=>{const s=startOf(it),n=s?days(s):null;return n!==null&&n<=0;};
  const infoMiss=it=>!it.values.contractDate||!it.values.contractAmount,proofMiss=it=>!infoMiss(it)&&it.values.contractProof==='check';
  const STALE=/계약\s*체결\s*확인|계약\s*확인/;
  return {name:'계약 · 시공',goal:goalOf(key,14),desc:'계약 체결 → 착공 준비 → 시공 중(착공일 입력 후 주 1회 현장 방문) → 준공 확인 · 계약일만으로 시공 중으로 보지 않음',
   tabs:[['계약 체결','계약일 · 금액 · 계약서'],['착공 준비','착공일 미입력 · 착공일 확인'],['시공 중','착공일 입력 후 · 주 1회 방문'],['준공 확인','준공검사 · 고객 확인']],
   reasons:[['cinfo','계약일 · 금액 없음'],['nostart','착공일 미입력'],['handoff','인계서 미확인'],['site7','시공 중 주 1회 방문 없음'],['nofin','준공 확인 없음']],
   act:[['정보 입력','stagefields'],['착공일 입력','stagefields'],['현장 확인','activity'],['준공 확인','stage']],
   todo:'계약정보가 빠진 건은 오늘 입력하세요. 실적 · 인센티브 계산에 바로 쓰입니다. 착공일이 입력돼야 시공 중이 되며, 착공한 현장은 주 1회 현장 방문을 기록하세요.',
   tab:it=>(it.row.code==='completion'||it.values.completionDate)?3:(it.row.code==='construction'&&!infoMiss(it))?(started(it)?2:1):0,
   redOf:(it,t)=>t===0&&infoMiss(it),/* 빨강 = 계약 정보가 빠진 건만(계약 체결 중인 정상 건은 빨강 아님) */
   nowOf:x=>{const names=['계약 체결','착공 준비','시공 중','준공 확인'];if(x.tab>0)return [names[x.tab],x.sub].filter(Boolean).join(' · ');const head=infoMiss(x.it)?'계약일 · 금액 없음':((root.DealSame&&root.DealSame.on()?root.DealSame.contract(x.row.item).text:'')||'계약 체결 확인 중');return [head,x.sub&&x.sub!==head?x.sub:''].filter(Boolean).join(' · ');},
    issueOf:x=>x.tab===0?(infoMiss(x.it)?'계약일 · 금액 없음':(root.DealSame&&root.DealSame.on()?root.DealSame.contract(x.row.item).text:'')||'계약 체결 확인 중'):[['계약 체결','계약일 · 금액 · 계약서'],['착공 준비','착공일 미입력 · 착공일 확인'],['시공 중','착공일 입력 후 · 주 1회 방문'],['준공 확인','준공검사 · 고객 확인']][x.tab][1],/* 같은 정보 같은 판단: 입력된 계약 정보는 그대로 보이고 증빙만 '확인 필요'(2026-10-08) */
    taskOf:x=>x.tab===0?(infoMiss(x.it)?'계약 정보 입력':proofMiss(x.it)?'계약서 확인':'계약 체결 확인'):x.tab===1?(startOf(x.it)?'착공 준비':'착공일 확인'):x.tab===2?'주간 현장 방문':'준공 확인',
   btnOf:x=>x.tab===0?(infoMiss(x.it)?['정보 입력','stagefields']:proofMiss(x.it)?['계약서 확인','stagefields']:['계약 확인','stagefields']):x.tab===1?(startOf(x.it)?['착공 준비','stagefields']:['착공일 입력','stagefields']):x.tab===2?['현장 확인','activity']:['준공 확인','stage'],
   rowOpts:x=>{const nx=x.row.next&&x.row.next.text?String(x.row.next.text):'';return x.tab>0&&STALE.test(nx)?{forceTask:true,staleNext:'"'+nx.trim()+'" 종료 대상'}:{};},
   has:{cinfo:(it,t)=>t===0&&infoMiss(it),nostart:(it,t)=>t===1&&!startOf(it),handoff:(it,t)=>(t===1||t===2)&&it.rs.includes('handoff'),site7:(it,t)=>t===2&&it.rs.includes('site7'),nofin:(it,t)=>t===3&&!finOk(it)},
   sub:(it,t)=>t===0?(!it.values.contractDate&&!it.values.contractAmount?'계약일 · 금액 미입력':!it.values.contractDate?'계약일 미입력':!it.values.contractAmount?'계약금액 미입력':proofMiss(it)?'계약 정보 입력됨 · 증빙 확인 필요':'계약 체결 확인 중'):t===1?(startOf(it)?'착공 '+ymd(startOf(it))+' 예정':'착공일 미입력'):it.sub};
 }
 /* 줄마다 상태(탭) · 걸린 사유를 붙인다. 정렬: 빨강 상태 → 다음 상태 → 체류 긴 순 */
 function model(key,list){
  const C=cfg(key),M=B.model(key,list);
  const nT=C.tabs.length;
  const items=M.items.map(it=>{if(C.prep){try{C.prep(it);}catch(e){}}let t=0;try{t=C.tab(it);}catch(e){t=nT-1;}t=Number.isInteger(t)&&t>=0&&t<nT?t:nT-1;const rs=C.reasons.map(r=>r[0]).filter(k=>{try{return !!C.has[k](it,t);}catch(e){return false;}});let sub='';try{sub=C.sub(it,t)||'';}catch(e){}let red=t===0;if(C.redOf){try{red=!!C.redOf(it,t);}catch(e){}}return {it,row:it.row,tab:t,rs,sub,stall:it.stall,red};});
  items.sort((a,b)=>a.tab-b.tab||b.stall-a.stall||String(a.row.key).localeCompare(String(b.row.key)));
  return {C,items};
 }
 const issueOf=(C,x)=>C.issueOf?C.issueOf(x):(x.tab===0?C.reasons[0][1]:C.tabs[x.tab][1]);
 const actOf=(C,x)=>C.btnOf?C.btnOf(x):C.act[x.tab];
 const bcOf=r=>BRAND[r.item.brand]||'';
 /* 줄 · 카드에 항상 보이는 것(2026-10-05 정합성 ③ ④ — 마우스를 올려야 보이는 정보를 두지 않는다):
    다음 행동 · 기한 / 공종 · 사업연도 · 영업건 번호(같은 단지의 여러 건을 구분) / 같은 단지에 진행 건이 여럿이면 '같은 공사인지 확인' */
 const noOf=r=>'#'+String(r.item.id||r.key||'').replace(/[^0-9a-z]/gi,'').slice(-6);
 const workOf=r=>{let w='';try{w=root.dealWorkSummary(r.item)||'';}catch(e){}return !w||/미분류|미기록|미입력/.test(w)?'공종 미분류':w;};
 const bizYearOf=r=>{try{const y=String(root.constructionYearOf?root.constructionYearOf(r.item):'');return /^\d{4}$/.test(y)?y:'';}catch(e){return '';}};
 const mdOf=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?(+m[2])+'.'+(+m[3]):'';};
 const nextOf=r=>{const t=r.next&&r.next.text?String(r.next.text).trim():'',due=mdOf(r.due);return t?t+' · '+(due||'날짜 없음'):'없음';};
 const metaOf=r=>[workOf(r),bizYearOf(r),noOf(r)].filter(Boolean).join(' · ');
 /* 같은 단지의 진행 건 수(모든 단계 · 진행 범위 안에서) */
 let DUP=new Map();
 const siteKeyOf=r=>{const d=r.item,id=d.cleanup_site_id||d.site_id||d.siteId;if(id)return 'id:'+id;let k='';try{k=root.normSite?root.normSite(r.site):String(r.site||'');}catch(e){}return k&&k.length>=2?'n:'+k:'';};
 function dupMap(){const m=new Map();try{root.PipelineWorkspace.rows({unscoped:true}).forEach(r=>{if(['won','lost','expansion','legacy'].includes(r.group))return;const k=siteKeyOf(r);if(k)m.set(k,(m.get(k)||0)+1);});}catch(e){}return m;}
 const dupOf=r=>{const k=siteKeyOf(r),n=k?DUP.get(k)||0:0;return n>1?'같은 단지 진행 '+n+'건 · 같은 공사인지 확인':'';};
 function rowHtml(C,x){
  const r=x.row,bc=bcOf(r),a=actOf(C,x);
  return '<div class="ps3-row" role="row" tabindex="0" data-ps3="open" data-key="'+attr(r.key)+'" data-tab="'+x.tab+'" style="border-left-color:'+(bc||'#e3e6ec')+'"><div class="ps3-l"><div class="ps3-a"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(r.item):'')+'</b><span><em style="color:'+(bc||'#9ca3af')+'">'+h(r.item.brand||'브랜드 미지정')+'</em> · '+h(r.owner||'미배정')+' · '+h(money(r.amount))+'</span><small class="ps3-meta">'+h(metaOf(r))+'</small>'+(dupOf(r)?'<small class="ps3-dup">'+h(dupOf(r))+'</small>':'')+'</div>'
   +'<div class="ps3-b"><b'+(x.red?' class="r"':'')+'>'+h(issueOf(C,x))+'</b><span>'+h(x.sub)+'</span><small class="ps3-nx'+(r.next&&r.next.text?'':' none')+'"><i>다음 행동</i> '+h(nextOf(r))+'</small></div></div>'
   +'<div class="ps3-r"><div class="ps3-d"><b'+(x.stall>C.goal?' class="r"':'')+'>'+x.stall+'일</b><span>체류</span></div><button type="button" data-ps3="act" data-key="'+attr(r.key)+'" data-v="'+attr(a[1])+'">'+h(a[0])+'</button></div></div>';
 }
 /* 목록 줄 v11(2026-10-06 design_handoff_pipeline_v11): 4칸 줄 + 펼침 — 그리기는 pipeline-row-v11.js 한곳, 여기서는 그 단계의 상태 · 업무 · 버튼만 정한다 */
 const V11=()=>root.PipelineRowV11&&root.PipelineRowV11.on()?root.PipelineRowV11:null;
 function v11(key,C,x){
  const r=x.row,a=actOf(C,x),st0=x.tab===0?C.reasons[0][1]:C.tabs[x.tab][0],sub=x.sub&&!String(st0).includes(x.sub)&&!String(x.sub).includes(st0)?x.sub:'';
  /* 버튼 = 업무 동사: 연락할 일이면 '연락 기록'(미팅 날짜만 남은 컨설팅 건은 '일정 등록'), 나머지는 그 단계의 일(견적 요청 · 정보 입력 · 단계 판단 …). 수주 · 실주는 B안 표의 버튼 이름 그대로 */
  const contact=a[1]==='next'||a[1]==='activity',btn=C.btnOf?[a[0],a[1]]:contact?[key==='consulting'&&x.tab===0&&r.last?'일정 등록':'연락 기록',a[1]]:[a[0],a[1]];
  const o={r,now:C.nowOf?C.nowOf(x):[st0,sub].filter(Boolean).join(' · '),task:C.taskOf?C.taskOf(x):C.tabs[x.tab][1],btn,stall:x.stall,goal:C.goal,reasons:x.rs.map(k=>(C.reasons.find(q=>q[0]===k)||[])[1]).filter(Boolean),dup:dupOf(r),tab:x.tab,closed:!!C.closed,amountLabel:C.amountLabel,stage:key};
  if(C.rowOpts){try{Object.assign(o,C.rowOpts(x)||{});}catch(e){}}/* 관계관리 v12: 상태 · 주기 꼬리표 · 기준일 · 기한 글 */
  return o;
 }
 function cardHtml(C,x){
  const r=x.row,bc=bcOf(r),a=actOf(C,x);
  return '<div class="ps3-card" role="button" tabindex="0" data-ps3="open" data-key="'+attr(r.key)+'" style="border-left-color:'+(bc||'#e3e6ec')+'"><div class="t"><b style="color:'+(bc||'#9ca3af')+'">'+h(r.item.brand||'브랜드 미지정')+'</b><i></i><span class="no">'+h(noOf(r))+'</span><b class="d'+(x.stall>C.goal?' r':'')+'">'+x.stall+'일</b></div><strong>'+h(r.site)+'</strong><span>'+h([workOf(r)+(bizYearOf(r)?' · '+bizYearOf(r):''),r.owner||'미배정',money(r.amount)].filter(Boolean).join(' · '))+'</span><span class="iss'+(x.red?' r':'')+'">'+h((x.red?'확인 필요 · ':'')+[issueOf(C,x),x.sub&&!String(issueOf(C,x)).includes(x.sub)?x.sub:''].filter(Boolean).join(' · '))+'</span><span class="nx'+(r.next&&r.next.text?'':' none')+'"><i>다음 행동</i> '+h(nextOf(r))+'</span>'+(dupOf(r)?'<span class="dup">'+h(dupOf(r))+'</span>':'')+'<button type="button" data-ps3="act" data-key="'+attr(r.key)+'" data-v="'+attr(a[1])+'">'+h(a[0])+'</button></div>';
 }
 function html(key,list){
  DUP=dupMap();
  const S=st(),{C,items}=model(key,list),LP=root.ListPager,total=items.length;
  const cnt=t=>items.filter(x=>x.tab===t).length,n=C.tabs.map((_,i)=>cnt(i)),over=items.filter(x=>x.red).length,hot=t=>items.some(x=>x.tab===t&&x.red);
  const rsN=k=>items.filter(x=>x.rs.includes(k)).length;
  if(S.reason&&!C.reasons.some(r=>r[0]===S.reason))S.reason=null;
  if(S.work&&!(C.workFilters||[]).some(w=>w[0]===S.work))S.work=null;const listed=items.filter(x=>(S.tab===-1||x.tab===S.tab)&&(!S.reason||x.rs.includes(S.reason))&&(!S.work||!C.work||C.work(x,S.work)));/* 업무 필터는 상태와 함께 걸림(관계관리 v12) */
  const sumAmt=items.reduce((s,x)=>s+(Number(x.row.amount)||0),0),avg=total?Math.round(items.reduce((s,x)=>s+x.stall,0)/total):0;
  /* 상태 탭 4칸: [전체] + 상태 3개 */
  const tab=(t,l,rule,num,hot,src,amb)=>'<button type="button" class="ps3-tab'+(S.tab===t?' on':'')+'" data-ps3="tab" data-v="'+t+'" aria-pressed="'+(S.tab===t)+'"><b class="n'+(hot&&num?' r':amb&&num?' amb':'')+'">'+num.toLocaleString('ko-KR')+'</b><b class="l">'+h(l)+'</b><span>'+h(rule)+'</span>'+(src?'<small class="src">'+h(src)+'</small>':'')+'</button>';
  const tabs='<div class="ps3-tabs" role="group" aria-label="상태" data-n="'+(C.tabs.length+1)+'">'+tab(-1,'전체','이 단계 모든 현장',total,false)+C.tabs.map((t,i)=>tab(i,t[0],t[1],n[i],hot(i),C.tabSrc?C.tabSrc[i]:'',C.ambTab===i)).join('')+'</div>'+(C.workFilters?'<div class="ps3-works" role="group" aria-label="업무 필터"><span>업무 필터 · 상태와 함께 걸림</span>'+C.workFilters.map(w=>{const m=items.filter(x=>(S.tab===-1||x.tab===S.tab)&&C.work(x,w[0])).length;return '<button type="button" data-ps3="work" data-v="'+w[0]+'" aria-pressed="'+(S.work===w[0])+'">'+h(w[1])+' <span>'+m+'</span></button>';}).join('')+'<i></i>'+(C.workNote?'<small>'+h(C.workNote)+'</small>':'')+'</div>':'');
  /* stage7 공통(2026-10-07): 제목 숫자 = '기한 초과 n'(날짜 있고 넘김 · 판정 함수와 같은 수) + '확인 필요 n'(날짜 미입력 · 판정 불가 · 정보 보완). '기준 넘김' 단어 없음. 수주 · 실주는 끝 상태라 기한 초과 0 · 지연 아님 */
  const TL=(()=>{try{const J=root.PipelineJudge;return J&&J.on()?J.tally(items.map(x=>x.row&&x.row.item).filter(Boolean)):null;}catch(e){return null;}})();
  const kpi1=C.closed?'<div class="over amb"><span>'+h(C.kpiLabel||'정보 보완')+'</span><b>'+over.toLocaleString('ko-KR')+'건</b><small>기한 초과 0 · 지연 아님 · 끝 상태</small></div>'
   :'<div class="over"><span>기한 초과</span><b>'+(TL?TL.late:over).toLocaleString('ko-KR')+'건</b><small>확인 필요 '+(TL?TL.nodate+TL.norecord:0)+' · 날짜 미입력 '+(TL?TL.nodate:0)+' · 판정 불가 '+(TL?TL.norecord:0)+'</small></div>';
  /* stage7_2 ⑤: 자료 없음 3가지(자료발송 · 입찰 · 계약 단계) — 현재 업무 미수행만 평가 · 지연 통계에 들어간다 */
  const MS=(!C.closed&&!C.leftHtml&&['consulting','sent','competition','construction'].includes(key)&&TL&&root.PipelineJudge&&root.PipelineJudge.missCounts)?root.PipelineJudge.missCounts(TL):null;
  const missHtml=MS?'<section class="ps3-box ps3-miss"><header><b>자료 없음 3가지</b></header>'+[['현재 업무 미수행',MS.cur,'기준일 있고 기한 넘김 · 담당 평가 · 지연 통계 포함'],['과거 자료 미확인',MS.past,'이관 전 기록 · 보완 대상 · 평가 제외'],['해당 없음',MS.na,'그 단계에 필요 없는 정보 · 집계 제외']].map(x=>'<div class="ps3-ms"><span><b>'+h(x[0])+'</b> '+x[1]+'</span><small>'+h(x[2])+'</small></div>').join('')+'</section>':'';
  const doneN=C.closed&&C.doneOf?items.filter(x=>C.doneOf(x.it)).length:0,donePct=total?Math.round(doneN*1000/total)/10:0,fixN=total-doneN;
  const headNote=C.headNote?' · '+h(C.headNote(items)):'';
  /* 왼쪽: 단계 진단 */
  const diag=C.leftHtml?'<aside class="ps3-diag"><section class="ps3-box"><header><b>단계 진단</b><span>'+total.toLocaleString('ko-KR')+'건 · '+h(money(sumAmt))+'</span></header><div class="ps3-kpis"><div class="over"><span>다음 연락일 지남</span><b>'+over.toLocaleString('ko-KR')+'건</b><small>오늘 연락</small></div><div><span>평균 체류</span><b>'+avg+'일</b><small>기준 '+C.goal+'일</small></div></div></section>'+C.leftHtml(items,S)+'</aside>':'<aside class="ps3-diag"><section class="ps3-box"><header><b>단계 진단</b><span>'+total.toLocaleString('ko-KR')+'건 · '+h(money(sumAmt))+headNote+'</span></header>'
   +'<div class="ps3-kpis">'+kpi1+(C.closed?'<div><span>결과 기록 완성률</span><b>'+donePct+'%</b><small>'+doneN+' / '+total+'</small></div>':'<div><span>평균 체류</span><b>'+avg+'일</b><small>기준 '+C.goal+'일</small></div>')+'</div>'+(C.closed?'<span class="rv-bar" aria-label="결과 기록 완성률"><i style="width:'+Math.max(donePct>0?2:0,donePct)+'%"></i></span>':'')+'</section>'
   +missHtml+'<section class="ps3-box ps3-why"><header><b>'+(C.closed?'보완할 것 '+fixN+'건':'왜 멈춰 있나')+'</b><span>누르면 목록이 걸러짐</span></header>'
   +C.reasons.map((r,i)=>{const c=rsN(r[0]),on=S.reason===r[0];return '<button type="button" class="ps3-reason'+(on?' on':'')+((C.redReason?C.redReason(r[0]):i===0)?' first':'')+'" data-ps3="reason" data-v="'+r[0]+'" aria-pressed="'+on+'"><span><b>'+h(r[1])+'</b><b class="c">'+c.toLocaleString('ko-KR')+'</b></span><i><u style="width:'+(total?Math.min(100,Math.round(c/total*100)):0)+'%"></u></i></button>';}).join('')+'</section>'
   +'<section class="ps3-box"><header><b>그래서 뭘 해야 하나</b></header>'+(C.todoHtml?C.todoHtml(items,S):'<p class="ps3-todo">'+h(C.todo)+'</p>')+'</section></aside>';
  /* 오른쪽: 확인할 현장 */
  const fl=S.reason?(C.reasons.find(r=>r[0]===S.reason)||[])[1]:'';
  const head='<div class="ps3-lhead"><b>확인할 현장 <span>'+listed.length.toLocaleString('ko-KR')+'곳</span></b>'+(fl?'<button type="button" class="ps3-chip" data-ps3="clear" aria-label="'+attr(fl)+' 필터 해제">'+h(fl)+' ×</button>':'')+'<i></i><div class="ps3-views" role="group" aria-label="보기"><button type="button" data-ps3="view" data-v="list" aria-pressed="'+(S.view!=='board')+'">리스트</button><button type="button" data-ps3="view" data-v="board" aria-pressed="'+(S.view==='board')+'">보드</button></div></div>';
  let body;
  if(S.view==='board')body='<div class="ps3-board">'+C.tabs.map((t,i)=>{const all=items.filter(x=>x.tab===i&&(!S.reason||x.rs.includes(S.reason))),cp=LP.cut(all,LP.page(S,'col:'+i)),cards=cp.rows;
    return '<div class="ps3-col"><div class="ch"><b title="'+attr(t[0])+'">'+h(t[0])+'</b><b class="c'+(i===0?' r':'')+'">'+n[i].toLocaleString('ko-KR')+'</b></div>'+(cards.length?cards.map(x=>cardHtml(C,x)).join(''):'<p class="ps3-none">없음</p>')+LP.html(cp,{ns:'ps3',v:'col:'+i,small:true,info:false})+'</div>';}).join('')+'</div>';
  else{const V=V11(),pg=LP.cut(V?V.sort(listed,x=>x.row):listed,LP.page(S));
   body='<div class="ps3-list'+(V?' prv-list':'')+'" role="table" aria-label="확인할 현장">'+(V?V.head():'')+(pg.rows.length?pg.rows.map(x=>V?V.row(v11(key,C,x),'ps3','ps3-row'):rowHtml(C,x)).join(''):'<div class="ps3-empty">해당하는 현장이 없습니다</div>')+LP.html(pg,{ns:'ps3',unit:'곳'})+'</div>';}
  return '<div id="pipeline-stage-v3" class="ps3" data-stage="'+key+'"><div class="ps3-top"><div class="ps3-head"><b>'+h(C.name)+'</b><span>'+h(C.desc)+'</span></div>'+tabs+'</div><div class="ps3-body">'+diag+'<section class="ps3-main">'+head+body+'</section></div></div>';
 }
 function onClick(e){
  const b=e.target.closest('#pipeline-stage-v3 [data-ps3]');if(!b||b.disabled)return;const S=st(),a=b.dataset.ps3,v=b.dataset.v,LP=root.ListPager;
  if(a==='tab'){S.tab=Number(v);S.reason=null;LP.reset(S);return root.paint();}if(a==='work'){S.work=S.work===v?null:v;LP.reset(S);return root.paint();}
  if(a==='reason'){S.reason=S.reason===v?null:v;LP.reset(S);return root.paint();}
  if(a==='clear'){S.reason=null;LP.reset(S);return root.paint();}
  if(a==='view'){S.view=v;return root.paint();}
  if(a==='page'){LP.set(S,v,b.dataset.page);return root.paint();}
  e.stopPropagation();
  if(a==='act'&&v==='classify'&&root.RelV12)return root.RelV12.openClassify(b.dataset.key);/* 관계관리 v12 분류 · 전환 창 */
  if(a==='act')return B.open(b.dataset.key,v);
  if(a==='fix'){e.stopPropagation();return B.open(b.dataset.key,'stagefields');}/* 날짜 미입력 보완 단추 → 상세의 이 단계 필수 정보(ops_12 A②) */
  if(a==='open'&&!e.target.closest('button'))return B.open(b.dataset.key);
 }
 /* 단계 목록 그리기를 감싼다(B안 · 관계관리 세분화보다 뒤): v3 가 켜진 단계면 v3 를 그리고 true */
 const prevPaint=L2.paint;
 L2.paint=function(el,key,list){
  if(!enabled(key)||!L2.enabled(key))return prevPaint.apply(this,arguments);
  const pg=document.getElementById('pg-pipe');pg?.classList.add('plv-on');pg?.classList.add('psb-on');
  const S=st();if(S.key!==key){S.key=key;S.tab=-1;S.reason=null;S.work=null;root.ListPager.reset(S);}
  el.classList.remove('pk-mode');el.innerHTML=html(key,list);
  if(!el.__ps3){el.__ps3=true;el.addEventListener('click',onClick,true);el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#pipeline-stage-v3 [data-ps3="open"]')){e.preventDefault();e.target.click();}});}
  const C=cfg(key);document.getElementById('ptitle').textContent=C.name.replace(' · ','·');const ps=document.getElementById('psub');if(ps)ps.textContent='위 상태 탭 → 왼쪽 단계 진단 · 오른쪽 확인할 현장';
  root.CommonFilterBar?.mount('pipe');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
  return true;
 };
 root.PipelineStageV3={enabled,cfg,model,html,KEYS};
})(window);
