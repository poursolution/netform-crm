/* 파이프라인 단계별 화면 B안 (2026-10-03 디자인 핸드오프 'design_handoff_pipeline_b')
   왼쪽 = 단계 진단(고정) / 오른쪽 = 확인할 현장. 단계 7개(컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공 · 수주 · 실주)만. 전체 칸반 · 확장관리 · 대시보드는 그대로.
   · 진단: 진행 막대 3칸(단계마다 다름, 클릭 = 필터) · 숫자 3개(기준 넘김 빨강 · 첫 칸 건수 · 평균 체류) · 왜 멈춰 있나(클릭 = 필터) · 그래서 뭘 해야 하나
   · 현장: 리스트 / 보드(막대 3칸 = 보드 3열). 한 줄 = 브랜드 띠 · 현장 · 브랜드 · 담당 · 금액 | 상태 · 근거 | 걸린 사유 | 체류일 | 버튼 1
   · 정렬: 단계별 빨강 사유 순서(표의 첫 빨강이 최상단) → 사유 개수 → 체류일
   근거 데이터는 기존 행(PipelineWorkspace.rows → StageSpecs.values): 단계 필드 · 다음 할 일 · 마지막 접촉 · 체류일 · 계약 원장. 사고 · 누수 · 민원, 인계서 확인, 하자 연결, 공고조건 변경, 낙찰사는 기록 항목이 없어 사유로 만들지 않는다(필드가 생기면 추가).
   기간 기준(견적 3일 · 후속 7일 · 집중 7일 · 월 1회 30일 · 대기 60일 · 현장 방문 7일 · 준공 D+30 · 장기 체류 30일)은 2026-10-02 회의 지침 — 10/16 확정 전까지 OPS_RULES 설정값.
   열기 · 저장은 기존 경로(drwDeal + DetailActions). 끄기: G.pipeStageBOff=true → 단계 목록 v2. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const RED='#d93a3a',INK='#374151',KEYS=['consulting','sent','relationship','competition','construction','won','lost'];
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const R=()=>root.OPS_RULES||{};const N=(k,d)=>Number(R()[k])||d;
 const rules=()=>({quote:N('quoteDays',3),follow:N('sentFollowDays',7),focus:N('focusContactDays',7),month:N('monthContactDays',30),wait:N('waitContactDays',60),site:N('siteVisitDays',7),after:N('afterCompletionDays',30),stay:N('longStayDays',30),focusEnd:N('focusEndDays',30),normalEnd:N('normalEndDays',90),d3:N('deadlineUrgentDays',3)});
 /* 관계관리 관리 구분(2026-10-05 design_handoff_relationship): 견적 발송일 · 공사 예정 시기로 자동 분류(relationship-segment.js). 기간은 운영 기준(집중 care_focus_months · 일반 care_general_months).
    끄기 G.relSegOff=true → 예전처럼 단계 이름(유대 · 침묵 · 대기)으로 */
 const SEG=()=>(!root.G.relSegOff&&root.RelationshipSegment)||null;
 const segRules=()=>{const q=rules();let f=1,g=3;try{f=Number(root.CRMRules.get('care_focus_months'))||1;g=Number(root.CRMRules.get('care_general_months'))||3;}catch(e){}return Object.assign(q,{focusEnd:f*30,normalEnd:Math.max(g,f+1)*30});/* 일반관리 = 견적 발송일부터 총 g개월(stage7_2 ③) */};
 const ctxOf=d=>{let p={};try{p=root.itemPatch(d,'deal')||{};}catch(e){}return d.stage_contexts||p.stage_contexts||{};};
 const ctxVals=(cx,k)=>Object.keys(cx).map(c=>cx[c]&&cx[c].fields&&cx[c].fields[k]).filter(v=>v!=null&&v!=='');
 function segInput(r){
  const G=SEG(),d=r.item,cx=ctxOf(d),today=G.todayKey();let p={};try{p=root.itemPatch(d,'deal')||{};}catch(e){}
  /* 견적 발송일 = 기록된 날짜만: 단계 정보의 발송일 · 견적 버전 · 자료 발송완료 단계로 옮긴 날 가운데 가장 최근. 등록일 · 지금 단계 진입일은 쓰지 않는다 */
  const sentC=ctxVals(cx,'sent_date').map(G.dateKey);
  (d.quote_versions||d.quoteVersions||p.quoteVersions||[]).forEach(v=>{if(v)sentC.push(G.dateKey(v.sent_at||v.created_at));});
  try{(root.briefAllStageEvents(d)||[]).forEach(x=>{const to=String(x.to||x.after||x.new_stage||'');let g='';try{g=root.PipelineStages.group(to)||'';}catch(e){}if(g==='sent'||to==='자료 발송완료')sentC.push(G.dateKey(x.at||x.changed_at||x.created_at));});}catch(e){}
  const sent=sentC.filter(k=>k&&k<=today).sort().pop()||'',focusFrom=ctxVals(cx,'focus_from').map(G.dateKey).filter(k=>k&&k<=today).sort().pop()||'';
  /* 공사 예정 시기: 상세의 '공사 예정' 칸 → 옮겨 온 예정공사일정 → 첫 상담의 공사 예상시기 → 공사 연도 */
  const lf=d.list_fields&&typeof d.list_fields==='object'?d.list_fields:{},lfv=name=>Object.values(lf).filter(f=>f&&f.name===name).map(f=>Array.isArray(f.value)?f.value[0]:f.value).filter(Boolean);
  let year='';try{year=root.ConstructionYear.valueOf(d).year||'';}catch(e){}
  const cur=(cx[r.code]&&cx[r.code].fields)||{};
  const timing=G.pickTiming([cur.construction_plan].concat(ctxVals(cx,'construction_plan'),[d.planned_construction_date,d.construction_planned_at],lfv('예정공사일정'),ctxVals(cx,'expected_timing'),[d.construction_year,d.constructionYear,year]),today);
  /* 다가오는 대표회의 · 입찰 일정(잡히면 경쟁 · 입찰로) */
  let meet=null;const up=(v,kind)=>{const k=G.dateKey(v);if(k&&k>=today&&(!meet||k<meet.date))meet={date:k,kind};};
  ctxVals(cx,'meeting_date').forEach(v=>up(v,'PT · 협의'));ctxVals(cx,'bid_deadline').forEach(v=>up(v,'입찰 마감'));ctxVals(cx,'briefing_date').forEach(v=>up(v,'현설'));
  const nx=r.next||{},mm=/대표회의|입대의|입주자대표|입찰|현장설명|현설|PT/.exec(String(nx.text||'')+' '+String(nx.type||''));if(mm&&r.due)up(r.due,/입대의|입주자대표/.test(mm[0])?'대표회의':mm[0]);
  let mgr=null;try{const c=root.DealKeyman&&root.DealKeyman.enabled()?root.DealKeyman.changeOf(d):null;if(c&&c.date&&!c.after)mgr={date:c.date};}catch(e){}
  /* 마지막 접촉 = 실제 접촉 기록만(등록일로 대신하지 않는다) */
  const ago=v=>{const k=G.dateKey(v);return k?Math.max(0,G.diff(k,today)):null;},lastAgo=ago(r.last);
  const contact=lastAgo!==null?lastAgo:(r.contactDays==null?null:r.contactDays);
  return {sent,focusFrom,timing,contactDays:contact,ageDays:ago(d.created||d.created_at),due:r.due,hasNext:!!(r.next&&r.next.text),meet,mgr};
 }
 /* 발송 근거: 유효한 과거/오늘 발송일만 판정. 내부 메모·다음 업무는 후속 연락 근거가 아니다. */
 function sentEvidence(r,v){
  const at=(r.fields||{}).sent_date||'',age=since(at),eligible=age!==null&&age>=0;
  let connectedAge=null;try{connectedAge=since(root.ContactState.of(r.item,'deal').lastConnectedAt);}catch(e){}
  const reaction=!!String((v||{}).reaction||'').trim();
  const followed=eligible&&(reaction||(connectedAge!==null&&connectedAge>=0&&connectedAge<age));
  return {at,age,eligible,reaction,followed};
 }
 /* 미팅 여부와 일정은 분리한다. 지난 일정은 완료가 아닌 결과 확인 대상이다. */
 function consultingEvidence(r){
  const d=r.item,cx=ctxOf(d),f=(cx.consulting||{}).fields||{},fc=(cx.first_contact||{}).fields||{};
  let met='',connected='';try{met=root.PipelineJudge.meetingOf(d);}catch(e){}try{connected=root.ContactState.of(d,'deal').lastConnectedAt||'';}catch(e){}
  const scheduled=nextIsVisit(r)?r.due:(f.meeting_date||fc.meeting_date||''),nd=days(scheduled),quote=!!String(f.quote_request||'').trim();
  const bucket=met||quote?'done':nd!==null&&nd>=0?'plan':'none';
  const task=bucket==='done'?(quote?'물량 산출 기한 확인 (견적팀)':'견적 요청 등록'):bucket==='plan'?'미팅 전날 확인 연락':nd!==null&&nd<0?'지난 미팅 일정의 실행 여부·결과 확인':connected?'기존 통화 내용·미팅 진행 여부 확인 → 미팅이 없었다면 일정 협의':'기존 연락·미팅 기록 확인 → 첫 연락 전이면 연락 후 일정 협의';
  const sub=bucket==='done'?(met?'미팅 완료 기록 있음':'견적 요청 · 미팅 미확인'):bucket==='plan'?ymd(scheduled)+' 미팅 예정':nd!==null&&nd<0?ymd(scheduled)+' 예정 · 실행 여부 확인':'미팅 여부 확인 필요';
  return {bucket,met,quote,scheduled,task,sub};
 }
 const st=()=>root.G.psb||(root.G.psb={view:'list',bucket:'all',reason:null,page:1});
 const enabled=key=>!root.G.pipeStageBOff&&KEYS.includes(key||root.G.pipelineStage)&&!!root.PipelineListV2;
 const days=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?n:null;};
 const since=v=>{const n=days(v);return n===null?null:-n;};
 /* 날짜는 한국 시간 기준(2026-10-07 stage7 공통 · 실주일 하루 차이 원인 = 시각 붙은 값을 UTC 로 자르던 것) */
 const ymd=v=>{const J=root.PipelineJudge,s=J&&J.dayKey?(J.dayKey(v)||String(v||'').slice(0,10)):String(v||'').slice(0,10),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?Number(m[2])+'/'+Number(m[3]):'';};
 const money=v=>{const n=Number(v)||0;if(!n)return '금액 미정';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const VISIT=['현장방문','방문','회의','PT','현장설명'];
 const nextIsVisit=r=>!!(r.next&&VISIT.includes(String(r.next.type||'')));
 const lastDays=r=>{let a=null;try{a=root.activityAge(r.item);}catch(e){}const c=r.contactDays;if(a===null||a===undefined)return c==null?null:c;return c==null?a:Math.min(a,c);};
 /* 재영업 연결 = 확장관리에서 실제로 움직인 기록(연락 · 니즈 메모 · 영업건 전환)이 있는 것만. 준공만으로 자동 생성된 빈 기록은 아직 '연결'이 아니다 */
 const expansionOf=r=>{try{const id=String(r.item.id),raw=(root.expServerRows?.()||[]).concat((root.LOCAL&&root.LOCAL.expansionPool)||[]);if(!raw.some(x=>String(root.expSourceId?root.expSourceId(x):(x.source_opportunity_id||x.sourceOpportunityId))===id))return null;return (root.expansionRecords?.()||[]).find(e=>String(e.sourceOpportunityId)===id)||null;}catch(e){return null;}};
 /* ── 단계별 지침(README 표). S = 막대 3칸 [키, 이름, 색, 기준 한 줄], RS = 사유 [키 → 이름, 색(빨강=기준 넘김), 버튼, 해야 할 일, 상세 열기 액션] ── */
 const CFG={
  /* stage7 ①(2026-10-07): '견적 처리 3일 · 5일' = 물량 산출 기한(견적 요청 등록일부터 · 견적팀). '미팅 후 견적 요청 등록'은 따로 둔 업무 · 기한은 설정값(운영 제안) */
  consulting:{name:'컨설팅 설계',desc:()=>'1차 현장미팅으로 고객 요구를 확인하고 견적을 준비하는 단계 · 물량 산출 목표 '+rules().quote+'일 · 최대 5일 (견적 요청 등록일부터 · 견적팀)',axis:'1차 현장미팅 진행',
   S:[['none','미팅 여부 확인 필요','#15171c','기존 기록 확인 후 일정 협의'],['plan','미팅 예정','#8a909c','미팅 전날 확인 연락'],['done','미팅 기록 · 견적 준비','#d5d9e0','미팅 기록 · 견적 요청 확인']],
   RS:{nodate:['미팅 여부 확인 필요',RED,'미팅 확인','기존 연락·미팅 기록 확인 → 미팅이 없었다면 일정 협의','next'],nodue:['물량 산출 기한 넘김',RED,'견적 요청','견적 요청 등록일부터 목표 3일 · 최대 5일(견적팀) · 대표회의 임박이면 개략 금액 먼저','stagefields'],req:['필수 확인 미입력',INK,'정보 보완','미팅 때 현재 문제 · 범위 · 시기 · 경쟁사 · 요청 자료 · 대표회의 일정 · 결정권자 채우기','stagefields'],nonext:['다음 행동 · 날짜 없음',INK,'다음 행동','모든 현장에 다음 행동 + 날짜 등록 (완료만 선택 불가)','next'],long:['30일 넘게 머묾',INK,'상태 확인','① 고객 반응 확인 → ② 추진 상태 확인 → ③ 근거 남기고 계속 · 대기 · 보류 · 실주 (30일 경과만으로 실주 처리하지 않음)','stage']},
   calc(r,v,q){const e=consultingEvidence(r),fc=(ctxOf(r.item).first_contact||{}).fields||{},quoteDue=v.quoteDue;
    const rs=[];if(e.bucket==='none')rs.push('nodate');if(e.quote&&quoteDue&&days(quoteDue)<0)rs.push('nodue');if(!v.needs||!fc.work_scope||!fc.expected_timing)rs.push('req');if(!r.next||!r.next.text||!r.due)rs.push('nonext');if((r.stall||0)>q.stay)rs.push('long');
    return {bucket:e.bucket,sub:e.sub+(quoteDue?' · 견적 '+ymd(quoteDue):''),rs};}},
  sent:{name:'자료 발송완료',desc:()=>'견적 · 자료를 보낸 단계 · 견적 발송은 완료가 아니라 후속관리 시작 — 발송일 기준 D+'+rules().follow+' 후속 연락',axis:'발송 후 후속 연락',
   S:[['wait','발송 근거 · 후속 확인','#d5d9e0','발송 여부 확인 후 7일 안 연락'],['late','7일 넘김 · 후속 없음','#15171c','오늘 후속 통화'],['done','후속 완료 · 반응 기록','#8a909c','결과 기록 + 다음 행동일']],
   RS:{nosent:['발송일 확인 필요',INK,'증빙 확인','담당 지정 → 기존 발송 증빙 확인 → 확인된 발송 정보 보완 → 후속 연락 설정','stagefields'],nofollow:['발송 후 7일 · 후속 없음',RED,'후속 통화','발송 7일 넘은 건은 오늘 후속 통화 → 결과 기록','activity'],meet:['대표회의 D-3 · 자료 회신',RED,'자료 제출','대표회의 전 비교 자료 · 개략 금액 먼저 발송','activity'],noreact:['반응 미기록',INK,'결과 기록','연락 결과(연결됨 · 검토중 · 자료요청 · 견적요청 · 보류 · 거절)를 기록','activity'],comp:['경쟁사 비교 중',INK,'조건 확인','경쟁사 · 가격 · 조건 변화 확인 → 비교표 · 사례로 설명','activity'],nonext:['다음 행동 · 날짜 없음',INK,'다음 행동','후속 통화 후 다음 행동일 지정','next']},
   calc(r,v,q){const e=sentEvidence(r,v),sentAt=e.at,meet=days(r.date);
    /* stage7 ②: 발송일 있는 건만 7일 판정 — 없으면 'nodate'(발송일 확인 필요 · 7일 계산 안 함) */
    const bucket=!e.eligible?'nodate':e.followed?'done':e.age>q.follow?'late':'wait';
    const sub=(e.eligible?ymd(sentAt)+' 발송':'발송 여부 · 기존 증빙 확인')+(v.reaction?' · '+v.reaction:'')+(meet!==null&&meet>=0?' · 결정 '+ymd(r.date):'');
    const rs=[];if(bucket==='nodate')rs.push('nosent');if(bucket==='late')rs.push('nofollow');if(meet!==null&&meet>=0&&meet<=q.d3)rs.push('meet');if(!v.reaction)rs.push('noreact');if(/가격|경쟁/.test(String(v.reaction||''))||v.competitor)rs.push('comp');if(!r.next||!r.next.text||!r.due)rs.push('nonext');
    return {bucket,sub,rs};}},
  relationship:{name:'관계관리',desc:()=>'견적 후 관리 구분 · 집중관리(초기 1개월, '+rules().focus+'일 단위) → 일반관리(월 1회) → '+(SEG()?'대기관리('+Math.round(rules().wait/30)+'개월 1회) · 견적 발송일 · 공사 예정 시기로 매일 자동 분류':'대기('+Math.round(rules().wait/30)+'개월 1회)'),axis:'관리 구분',
   /* 기준 넘김 = 집중 7일+ · 일반 30일+ · 대기 연락일 지남(색과 따로 정한다 — 대기 줄은 회색 막대지만 기준 넘김에 든다) */
   OVER:['focus7','month30','long60'],
   S:[['focus','집중관리 · 7일 단위','#15171c','7일 안 연락 · 대표회의 · 경쟁사 확인'],['normal','일반관리 · 월 1회','#8a909c','카드뉴스 · 공법자료 · 사례 전달'],['wait','대기 · 2개월 1회','#d5d9e0','연도 지정 · 2개월마다 관계 연락']],
   RS:{focus7:['집중관리 7일 넘게 연락 없음',RED,'후속 연락','집중관리 고객은 7일 단위 후속 · 대표회의 · 경쟁사 · 가격 변화 확인','activity'],month30:['30일 넘게 접촉 없음',RED,'자료 보내기','모든 고객 월 1회 이상 접촉 · 자료(카드뉴스 · 사례) 전달','activity'],long60:['대기 2개월 연락일 지남',INK,'안부 연락','공사 시기 확인 + 다음 2개월 연락일 등록','activity'],shift:['구분 전환 검토',INK,'전환 검토','자동 이동 대상 — 30일 판단 · 4개월 도달 · 공사 시기 3개월 안','stage'],nonext:['다음 행동 · 날짜 없음',INK,'다음 행동','연락 후 다음 행동 + 날짜 등록','next'],nosent:['견적 발송일 없음',INK,'발송일 입력','견적 발송일을 넣으면 자동으로 분류됩니다','']},
   calc(r,v,q){
    if(SEG()){const sq=segRules(),c=SEG().classify(segInput(r),{today:SEG().todayKey(),focusEnd:sq.focusEnd,normalEnd:sq.normalEnd,focus:sq.focus,month:sq.month,wait:sq.wait});return {bucket:c.bucket,sub:c.d+' · '+c.ds,rs:c.rs,seg:c};}
    const code=r.code,bucket=code==='waiting'?'wait':code==='rapport'?'focus':'normal',ld=lastDays(r),f=r.fields||{};
    const sub=(ld!==null?'마지막 접촉 '+ld+'일 전':'접촉 기록 없음')+(f.resume_date?' · 재개 '+ymd(f.resume_date):'')+(r.next&&r.next.text?' · '+r.next.text:'');
    const rs=[];if(bucket==='focus'&&ld!==null&&ld>q.focus)rs.push('focus7');if(bucket!=='wait'&&ld!==null&&ld>q.month)rs.push('month30');if(bucket==='wait'&&((ld!==null&&ld>=q.wait)||(f.resume_date&&days(f.resume_date)<=0)))rs.push('long60');if((bucket==='focus'&&(r.stall||0)>q.focusEnd)||(bucket==='normal'&&(r.stall||0)>q.normalEnd))rs.push('shift');if(!r.next||!r.next.text||!r.due)rs.push('nonext');
    return {bucket,sub,rs};}},
  competition:{name:'경쟁·입찰',desc:()=>'PT · 입찰 단계 · 참여 여부 · 제안가는 담당 혼자 정하지 않음(팀장 → 상무 → 대표) · 마감 D-7부터 준비 · D-'+rules().d3+' 긴급 · 결과는 이유까지 기록',axis:'입찰 준비',
   S:[['decide','참여 · 가격 결정 대기','#15171c','결정권자 승인 받기'],['prep','서류 · 제안서 준비','#8a909c','D-7부터 체크리스트'],['submit','제출 완료 · 결과 대기','#d5d9e0','결과 · 이유 기록']],
   RS:{d3:['마감 D-3 · 준비 안 됨',RED,'제안 준비','D-3 이내 미완료 서류 · 제안서는 오늘 팀장 확인','stagefields'],nodec:['참여 · 가격 결정 안 됨',RED,'결정 요청','참여 여부 · 제안가 · 제출 자료를 결정권자에게 요청 (담당 단독 결정 X)','support'],nores:['결과 · 이유 미기록',INK,'결과 기록','낙찰사 · 금액 · 당사 제안가 · 가격차 · 결정요인 · 고객 반응 기록','stage'],nodate:['결정 일정 미등록',INK,'일정 등록','현설 · PT · 제출일 · 마감일을 등록','stagefields'],nonext:['다음 행동 · 날짜 없음',INK,'다음 행동','현설 · PT · 제출일을 다음 행동으로 등록','next']},
   calc(r,v,q){const f=r.fields||{},dd=days(r.date),submitted=/제출|완료/.test(String(f.bid_plan||f.position||'')),decided=!!(f.position||f.bid_plan||f.final_terms||f.customer_intent);
    const bucket=submitted?'submit':decided?'prep':'decide';
    const sub=(r.date?(dd!==null&&dd<0?ymd(r.date)+' 지남':dd===0?'오늘 마감':'D-'+dd+' · '+ymd(r.date)):'결정 일정 없음')+(v.competitor?' · 경쟁 '+v.competitor:'');
    const rs=[];if(bucket!=='submit'&&dd!==null&&dd>=0&&dd<=q.d3)rs.push('d3');if(bucket==='decide')rs.push('nodec');if(dd!==null&&dd<0&&!(r.item.stage_contexts||{}).contract?.fields?.bid_result)rs.push('nores');if(!r.date)rs.push('nodate');if(!r.next||!r.next.text||!r.due)rs.push('nonext');
    return {bucket,sub,rs};}},
  construction:{name:'계약·시공',desc:()=>'영업 약속을 공식 문서로 확정 · 구두 약속은 특약 · CRM 기록 · 시공팀 인계서는 현장소장 확인까지 · 추가공사는 승인 + 서면합의 · 사고는 즉시 보고',axis:'계약 · 인계',
   S:[['sign','계약 진행','#15171c','서류 · 조건 확인 · 승인'],['hand','시공팀 인계','#8a909c','인계서 · 현장소장 확인'],['build','착공 · 시공 중','#d5d9e0','주 1회 현장 확인']],
   RS:{cinfo:['계약일 · 금액 미입력',RED,'입력','계약일 · 금액 · 계약서 입력 (매출 집계 · 착공 준비)','stagefields'],cproof:['계약 정보 입력됨 · 증빙 확인 필요',RED,'계약서 확인','계약서 첨부 · 실제 체결 · 자료 확인 (입력된 계약 정보는 그대로 · 증빙만 확인)','stagefields'],handoff:['인계서 미완료',RED,'인계','공사범위 · 제외범위 · 공기 · 고객 요구 · 서비스공사 · 특이사항 → 현장소장 확인','stagefields'],site7:['주 1회 현장 방문 안 함',RED,'현장 확인','착공 후 주 1회 · 공정 · 불만 · 소장 요청 · 추가공사 기록','activity'],verbal:['특이조건 확인 필요',INK,'특이조건','계약 때 말로 약속한 조건이 있으면 특이조건 \'있음\'으로 기록 — 없으면 \'없음\'을 골라 주세요','stagefields'],extra:['추가공사 요청 확인',INK,'승인 요청','비용 · 일정 영향 확인 → 승인 → 고객 서면합의 후 진행','support']},
   calc(r,v,q){const code=r.code,cx=r.item.stage_contexts||{},cf=cx.contract?.fields||{},bf=cx.construction?.fields||{},ld=lastDays(r);
    const bucket=code==='contract'?'sign':(code==='construction'&&bf.handover!=='완료')?'hand':'build';
    const DSX=root.DealSame&&root.DealSame.on()?root.DealSame:null,cs=DSX&&code!=='completion'?DSX.contract(r.item,undefined):null;
     const sub=code==='contract'?(cs&&cs.text?cs.text:v.contractDate?'계약 '+ymd(v.contractDate):'계약 서류 진행'):code==='construction'?('인계 '+(bf.handover||'미기록')+(bf.start_date?' · 착공 '+ymd(bf.start_date):'')):('준공 '+(ymd(v.completionDate)||'일자 미기록'));
    const rs=[];if(!v.contractDate||!v.contractAmount)rs.push('cinfo');else if(v.contractProof==='check')rs.push('cproof');if(code==='construction'&&bf.handover!=='완료')rs.push('handoff');if(code==='construction'&&bf.start_date&&days(bf.start_date)!==null&&days(bf.start_date)<=0&&(ld===null?-days(bf.start_date)>q.site:ld>q.site))rs.push('site7');/* kpi_measure: 착공 후 7일이 지났는데 접촉 기록이 아예 없는 현장도 '방문 안 함' — 기록이 없다고 준수가 아니다 *//* stage7_2 ⑤: 착공일이 입력된 건만 '시공 중' */if(code==='contract'&&!(DSX?DSX.special(r.item).set:!!cf.special_terms))rs.push('verbal');if(/추가/.test(String(bf.requests||'')))rs.push('extra');
    return {bucket,sub,rs};}},
  /* 수주 = 실적 · 완료 정보(2026-10-06 design_handoff_followup4 ②): 수주 유형 · 낙찰금액 · 낙찰사 / 계약일 · 착공 · 준공 확인 / 빠진 계약 정보. 준공 후 연락 · 추가 공사 업무는 여기서 만들지 않는다 → 확장관리 */
  won:{name:'수주',desc:()=>'끝 상태 · 계약이 끝난 건의 결과를 정확히 남기는 곳 · 수주 유형 · 낙찰금액(VAT 별도) · 낙찰사 → 계약일 · 착공 · 준공 확인 → 빠진 계약 정보 입력. 준공 후 연락 · 추가 공사는 확장관리에서',axis:'실적 · 완료 정보',
   S:[['result','수주 정보 미기록','#15171c','수주 유형 · 낙찰금액 · 낙찰사 기록'],['dates','계약일 · 착공 · 준공 확인','#8a909c','세 날짜 확인 · 기록'],['done','실적 · 완료 정보 완료','#d5d9e0','사후 연락은 확장관리에서']],
   RS:{wtype:['수주 유형 · 낙찰금액 · 낙찰사 미기록',RED,'수주 정보','수주 유형 · 낙찰금액 · 낙찰사 기록','win'],cdate:['계약일 · 착공 · 준공 확인 안 됨',INK,'일정 확인','계약일 · 착공일 · 준공일 확인','stagefields'],cinfo:['빠진 계약 정보 입력',INK,'정보 입력','빠진 계약 정보 입력','stagefields']},
   calc(r,v,q){let w=null;try{w=root.DealWin&&root.DealWin.resultOf?root.DealWin.resultOf(r.item):null;}catch(e){}const typed=!!(w&&w.type&&w.type!=='none'&&(w.amount||w.company)),dOk=!!(v.contractDate&&v.startDate&&v.completionDate),info=!!v.contractAmount;
    const bucket=!typed?'result':!dOk?'dates':'done';
    const sub=(typed?String(w.text||'수주 기록')+(w.amount?' · '+money(w.amount):''):'수주 유형 미기록')+' · '+(v.completionDate?'준공 '+ymd(v.completionDate):v.contractDate?'계약 '+ymd(v.contractDate):'계약일 미기록');
    const rs=[];if(!typed)rs.push('wtype');if(!dOk)rs.push('cdate');if(!info)rs.push('cinfo');
    return {bucket,sub,rs};}},
  /* stage7 ⑦(2026-10-07) + stage7_2 ⑥⑦: 끝 상태. '차기 연도 → 대기 2개월 연락(전체)' 안내 삭제 · 재영업 가능 '예'인 건만 재접촉 할 일 · 실주 처리하면 기존 영업 업무는 서버가 닫는다 · 다시 열어도 실주 기록은 보존.
     '기록 완료' = 실주 사유 + 재영업 가능 여부(예 · 아니오) 둘 다. 경쟁사 · 낙찰가는 '경쟁사 낙찰'일 때만 필수 — 사업 취소 · 중단 · 연기 · 예산 같은 사유는 '해당 없음'(미기록으로 세지 않음) */
  lost:{name:'실주',desc:()=>'끝 상태 · 실주일 · 원인 · 고객 반응 · 재영업 가능 여부를 남기는 곳 · 재영업 가능 "예"인 건만 재접촉 할 일(이전 실주 결과는 그대로 보존)',axis:'실주 기록',
   S:[['nore','기록 보완 필요','#15171c','사유 · 재영업 여부 기록'],['rec','기록 완료','#d5d9e0','사유 + 재영업 여부 입력됨'],['re','재영업 가능 · 예','#8a909c','재접촉 할 일 하나']],
   RS:{noreason:['실주 사유 미입력',RED,'사유 기록','원인 · 고객 반응 기록','stage'],nobid:['경쟁사 낙찰 · 경쟁사 · 낙찰가 미입력',INK,'결과 기록','경쟁사 · 낙찰가 기록(경쟁사 낙찰일 때만)','stagefields'],relist:['재영업 가능 여부 미입력',INK,'여부 입력','재영업 가능 여부 입력','stagefields'],contact:['재접촉 할 일 없음',INK,'재접촉 등록','재접촉 할 일 하나 등록','next']},
   calc(r,v,q){const reason=v.lossReason&&v.lossReason!=='미기록'?v.lossReason:'',lf=((r.item.stage_contexts||{}).lost||{}).fields||{},eng=String(lf.reengage||(r.fields||{}).reengage||'').trim(),legacy=!eng&&!!v.recontact,
    recorded=eng==='예'||eng==='아니오'||legacy,re=eng?eng==='예':legacy&&!/불가|없|낮/.test(String(v.recontact)),
    compWin=/타사 선정|경쟁 패배|경쟁사 낙찰|타사 낙찰|경쟁업체/.test(reason),na=!!reason&&!compWin&&/취소|중단|연기|예산|사업/.test(reason),done=!!reason&&recorded;
    const bucket=!done?'nore':re?'re':'rec';
    const sub=(v.lossDate?ymd(v.lossDate)+' 실주':'실주일 미기록')+(reason?' · '+reason:'')+(eng?' · 재영업 '+eng:legacy?' · 재접촉 '+v.recontact:' · 재영업 가능 미정')+(na?' · 경쟁사 해당 없음':'');
    const rs=[];if(!reason)rs.push('noreason');if(compWin&&!v.competitor)rs.push('nobid');if(!recorded)rs.push('relist');if(re&&!(r.next&&r.next.text))rs.push('contact');
    return {bucket,sub,rs,na};}} };
 function model(key,list){
  const C=CFG[key],q=rules(),built=root.PipelineListV2.build(key,list);
  const segOn=key==='relationship'&&!!SEG(),isRed=k=>segOn&&C.OVER?C.OVER.includes(k):!!(C.RS[k]&&C.RS[k][1]===RED),order=Object.keys(C.RS);
  const items=built.map(x=>{const r=x.row,v=x.values||{};let c;try{c=C.calc(r,v,q);}catch(e){c={bucket:C.S[0][0],sub:'',rs:[]};}const first=c.rs.find(isRed)||c.rs[0]||'';return {row:r,values:v,bucket:c.bucket,sub:c.sub,rs:c.rs,seg:c.seg||null,first,red:c.rs.some(isRed),pri:(()=>{const i=order.findIndex(k=>c.rs.includes(k)&&isRed(k));return i<0?99:i;})(),stall:Number(r.stall)||0};});
  items.sort((a,b)=>a.pri-b.pri||b.rs.length-a.rs.length||b.stall-a.stall||String(a.row.key).localeCompare(String(b.row.key)));
  return {C,items,isRed,seg:segOn,q:segOn?segRules():q};
 }
 function rowHtml(C,it,reason){
  const r=it.row,k=reason||it.first,rs=k?C.RS[k]:null,bc=BRAND[r.item.brand]||'#9ca3af',S=C.S.find(s=>s[0]===it.bucket)||C.S[0],a=root.PipelineRowV11.primaryAction(r,rs?[rs[2],rs[4]]:['열기',''],['won','lost'].includes(r.group));
  return '<div class="psb-row" role="row" tabindex="0" data-psb="open" data-key="'+attr(r.key)+'" style="border-left-color:'+bc+'"><div class="l"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(r.item):'')+'</b><span><em style="color:'+bc+'">'+h(r.item.brand||'브랜드 미지정')+'</em> · '+h(r.owner||'미배정')+' · '+h(money(r.amount))+'</span></div><div class="r"><div class="s"><b style="color:'+(S[2]==='#15171c'?'#15171c':'#6b7280')+'">'+h(S[1].split(' · ')[0])+'</b><span>'+h(it.sub)+'</span></div><span class="i" style="color:'+(rs?rs[1]:'#6b7280')+'">'+h(rs?rs[0]:'정상')+'</span><b class="d'+(it.stall>rules().stay?' r':'')+'">'+it.stall+'일</b><button type="button" data-psb="act" data-key="'+attr(r.key)+'" data-v="'+attr(a[1])+'">'+h(a[0])+'</button></div></div>';
 }
 /* 목록 줄 v11(2026-10-06 design_handoff_pipeline_v11): 수주 · 실주(와 v3 를 끈 단계)도 같은 4칸 줄 + 펼침 — 그리기는 pipeline-row-v11.js */
 const V11=()=>root.PipelineRowV11&&root.PipelineRowV11.on()?root.PipelineRowV11:null;
 function v11(key,C,it,reason){
  const r=it.row,k=reason||it.first,rs=k?C.RS[k]:null,S0=C.S.find(s=>s[0]===it.bucket)||C.S[0],closed=key==='won'||key==='lost';
  return {r,now:[rs?rs[0]:S0[1].split(' · ')[0],it.sub].filter(Boolean).join(' · '),task:key==='consulting'?consultingEvidence(r).task:rs?rs[3]:'',btn:rs?[rs[2],rs[4]]:['열기',''],stall:it.stall,goal:rules().stay,reasons:it.rs.map(q=>C.RS[q]&&C.RS[q][0]).filter(Boolean),closed,amountLabel:key==='won'?'수주 금액':'예상 금액',...(key==='competition'&&root.PipelineRowV11?.competitionEvidence?.(r)?.review?{forceTask:true,task:'기존 업무 처리 확인 → 다음 행동 갱신',staleNext:'기존 업무: '+(r.next?.text||'')+' · 입찰 일정도 확인',btn:['업무 확인','next']}:{})};
 }
 function cardHtml(C,it,reason){
  const r=it.row,k=reason||it.first,rs=k?C.RS[k]:null,bc=BRAND[r.item.brand]||'#9ca3af',e=r.group==='competition'&&root.PipelineRowV11?.competitionEvidence?root.PipelineRowV11.competitionEvidence(r):null,a=root.PipelineRowV11.primaryAction(r,e&&e.review?['업무 확인','next']:rs?[rs[2],rs[4]]:['열기',''],['won','lost'].includes(r.group));
  return '<div class="psb-card" role="button" tabindex="0" data-psb="open" data-key="'+attr(r.key)+'" style="border-left-color:'+bc+'"><div class="t"><b style="color:'+bc+'">'+h(r.item.brand||'브랜드 미지정')+'</b><i></i><b class="'+((e?e.age!==null&&e.age>rules().stay:it.stall>rules().stay)?'r':'')+'">'+h(e?e.ageText:it.stall+'일')+'</b></div><strong>'+h(r.site)+'</strong><span>'+h(it.sub)+' · '+h((e?'예상 ':'')+money(r.amount))+'</span><div class="b"><em style="color:'+(rs?rs[1]:'#6b7280')+'">'+h(a[1]==='owner'?'담당자 미지정':e&&e.warning?e.warning:rs?rs[0]:'정상')+'</em><i></i><button type="button" data-psb="act" data-key="'+attr(r.key)+'" data-v="'+attr(a[1])+'">'+h(a[0])+'</button></div></div>';
 }
 function html(key,list){
  /* 관계관리 = 시안 '관계관리 세분화'의 확정 배치(pipeline-rel-b.js) */
  if(key==='relationship'&&SEG()&&root.PipelineRelB&&root.PipelineRelB.enabled())return root.PipelineRelB.html(list,model(key,list));
  const S=st(),{C,items,isRed}=model(key,list),q=rules();
  const inB=items,byS=S.bucket==='all'?inB:inB.filter(i=>i.bucket===S.bucket||(key==='sent'&&S.bucket==='wait'&&i.bucket==='nodate')),listed=S.reason?byS.filter(i=>i.rs.includes(S.reason)):byS;
  const n=inB.length||1,cnt=k=>inB.filter(i=>i.bucket===k||(key==='sent'&&k==='wait'&&i.bucket==='nodate')).length,W=C.S.map(s=>Math.round(cnt(s[0])/n*100));
  const sumAmt=inB.reduce((s,i)=>s+(Number(i.row.amount)||0),0),avg=Math.round(inB.reduce((s,i)=>s+i.stall,0)/n),redN=inB.filter(i=>i.red).length;
  const CE=key==='competition'&&root.PipelineRowV11?.competitionEvidence?inB.map(i=>root.PipelineRowV11.competitionEvidence(i.row)):null,ages=CE?CE.filter(e=>e.age!==null).map(e=>e.age):null;
  const reasons=Object.keys(C.RS).map(k=>({k,n:byS.filter(i=>i.rs.includes(k)).length})).filter(x=>x.n>0);
  const acts=(S.reason?[S.reason]:reasons.slice(0,3).map(x=>x.k)).map(k=>({tag:C.RS[k][0]+' '+byS.filter(i=>i.rs.includes(k)).length+'건',t:C.RS[k][3]}));
  const SE=key==='sent'?inB.map(i=>sentEvidence(i.row,i.values)):null;
  const filters=[S.bucket!=='all'?(C.S.find(s=>s[0]===S.bucket)||[])[1]:null,S.reason?C.RS[S.reason][0]:null].filter(Boolean);
  const diag='<section class="psb-diag"><div class="psb-box"><header><b>단계 진단</b><span>'+inB.length+'건 · '+h((CE?'예상 ':'')+money(sumAmt))+'</span><i></i>'+(filters.length?'<button type="button" class="lnk" data-psb="clear">필터 해제</button>':'')+'</header>'
   +'<div class="psb-axis"><span>'+h(C.axis)+'</span><div class="bar">'+C.S.map((s,i)=>'<div style="width:'+W[i]+'%;background:'+s[2]+'"></div>').join('')+'</div><div class="leg">'+C.S.map(s=>'<button type="button" data-psb="bucket" data-v="'+s[0]+'" aria-pressed="'+(S.bucket===s[0])+'"><i style="background:'+s[2]+'"></i>'+h(s[1])+' <b>'+cnt(s[0])+'</b></button>').join('')+'</div></div>'
   +'<div class="psb-kpis"><div><span>'+h(CE?'후속 업무 지연':SE?'발송 후 후속 지연':'기준 넘김 (빨강)')+'</span><b style="color:'+(redN?RED:'#15171c')+'">'+(CE?CE.filter(e=>e.late).length:SE?cnt('late'):redN)+'건</b><small>'+h(CE?'다음 행동일 없음 '+CE.filter(e=>e.nextMissing).length:SE?'판정 가능 '+SE.filter(e=>e.eligible).length+' / '+inB.length+'건':'오늘 처리할 것')+'</small></div><div><span>'+h(CE?'입찰 일정 미등록':C.S[0][1])+'</span><b>'+(CE?CE.filter(e=>e.scheduleMissing).length:cnt(C.S[0][0]))+'건</b><small>'+h(CE?'일정 없으면 D-7 판정 불가':C.S[0][3])+'</small></div><div><span>평균 체류</span><b>'+h(CE?(ages.length?Math.round(ages.reduce((a,b)=>a+b,0)/ages.length)+'일':'미확인'):avg+'일')+'</b><small>'+h(CE?'진입일 입력 '+ages.length+' / '+inB.length+'건':'이 단계에 머문 일수')+'</small></div></div></div>'
   +'<div class="psb-two"><div class="psb-box"><header><b>왜 멈춰 있나</b><span>누르면 오른쪽 현장이 걸러짐</span></header>'+(reasons.length?reasons.map(x=>'<button type="button" class="psb-reason" data-psb="reason" data-v="'+x.k+'" aria-pressed="'+(S.reason===x.k)+'"><span>'+h(C.RS[x.k][0])+'</span><b style="color:'+C.RS[x.k][1]+'">'+x.n+'</b><i><u style="width:'+(byS.length?Math.round(x.n/byS.length*100):0)+'%;background:'+(isRed(x.k)?RED:'#9aa0ab')+'"></u></i></button>').join(''):'<p class="psb-none">멈춘 사유가 없습니다</p>')+'</div>'
   +'<div class="psb-box"><header><b>그래서 뭘 해야 하나</b></header>'+(acts.length?acts.map(a=>'<div class="psb-act"><span>'+h(a.tag)+'</span><p>'+h(a.t)+'</p></div>').join(''):'<p class="psb-none">기준을 넘긴 현장이 없습니다</p>')+'</div></div></section>';
  const LP=root.ListPager,pg=LP.cut(listed,LP.page(S)),shown=pg.rows;
  const head='<div class="psb-lhead"><b>확인할 현장 <span>'+listed.length+'곳</span></b>'+(filters.length?'<em>'+h(filters.join(' · '))+'</em>':'')+'<i></i><div class="psb-views"><button type="button" data-psb="view" data-v="list" aria-pressed="'+(S.view==='list')+'">리스트</button><button type="button" data-psb="view" data-v="board" aria-pressed="'+(S.view==='board')+'">보드</button></div></div>';
  let body;
  if(S.view==='board')body='<div class="psb-board">'+C.S.map(s=>{const selected=listed.filter(i=>i.bucket===s[0]||(key==='sent'&&s[0]==='wait'&&i.bucket==='nodate')),all=V11()?V11().sort(selected,i=>i.row):selected,cp=LP.cut(all,LP.page(S,'col:'+s[0])),cards=cp.rows;return '<div class="psb-col"><div class="ch"><i style="background:'+s[2]+'"></i><b>'+h(s[1])+'</b><span>'+all.length+'</span><em>'+h(s[3])+'</em></div>'+(cards.length?cards.map(i=>cardHtml(C,i,S.reason)).join(''):'<p class="psb-none">없음</p>')+LP.html(cp,{ns:'psb',v:'col:'+s[0],small:true,info:false})+'</div>';}).join('')+'</div>';
  else{const V=V11(),pv=V?LP.cut(V.sort(listed,i=>i.row),LP.page(S)):pg,rowsV=pv.rows;
   body='<div class="psb-list'+(V?' prv-list':'')+'">'+(V?V.head():'')+(rowsV.length?rowsV.map(i=>V?V.row(v11(key,C,i,S.reason),'psb','psb-row'):rowHtml(C,i,S.reason)).join(''):'<div class="psb-empty">해당하는 현장이 없습니다.</div>')+LP.html(pv,{ns:'psb',unit:'곳'})+'</div>';}
  return '<div id="pipeline-stage-b" class="psb" data-stage="'+key+'"><div class="psb-head"><b>'+h(C.name)+'</b><span>'+h(C.desc())+'</span></div><div class="psb-body">'+diag+'<section class="psb-main">'+head+body+'</section></div></div>';
 }
 /* 열기: 기존 상세 + 액션(연락 결과 · 다음 할 일 · 단계 필드 · 단계 전환 · 지원 요청). 확장관리 등록은 확장관리 화면으로 */
 function open(key,act){
  const r=root.PipelineWorkspace.rows().find(x=>x.key===key);if(!r)return;
  if(act==='expansion'&&typeof root.goPage==='function'){root.G.expansionFocus=r.item.id;root.goPage('expansion');return;}
  root.G._detailPopup=true;root.drwDeal(JSON.stringify(r.item));
  /* 수주 정보(수주 유형 · 낙찰금액 · 낙찰사) = 상세 위의 수주 유형 창(deal-win.js) */
  if(act==='win'){setTimeout(()=>{try{if(root.DealWin&&typeof root.DealWin.open==='function')root.DealWin.open(r.item);}catch(e){}},200);return;}
  /* 연락처 찾기: 상세를 열고 연락처 등록 칸을 바로 연다 */
  if(act==='contact'){setTimeout(()=>{try{const b=document.querySelector('#detailView [data-dv3="addc"]');if(b&&!b.disabled)b.click();}catch(e){}},250);return;}
  /* 새 상세(v3)가 켜져 있으면 그 창의 자리로 — 예전 입력 창(다음 할 일 설정 등)을 띄우지 않는다. 새 창에 자리가 없는 것(지원 요청)과 예전 틀만 기존 경로 */
  if(act)setTimeout(()=>{try{if(root.DealDetailV3&&typeof root.DealDetailV3.openFrom==='function'&&root.DealDetailV3.openFrom(act))return;if(root.DetailActions&&typeof root.DetailActions.open==='function')root.DetailActions.open(act);}catch(e){}},150);
 }
 function onClick(e){
  const b=e.target.closest('#pipeline-stage-b [data-psb]');if(!b)return;const S=st(),a=b.dataset.psb,v=b.dataset.v,key=root.G.pipelineStage,C=CFG[key];
  if(a==='bucket'){S.bucket=S.bucket===v?'all':v;S.reason=null;root.ListPager.reset(S);return root.paint();}
  if(a==='reason'){S.reason=S.reason===v?null:v;root.ListPager.reset(S);return root.paint();}
  if(a==='clear'){S.bucket='all';S.reason=null;root.ListPager.reset(S);return root.paint();}
  if(a==='view'){S.view=v;return root.paint();}
  if(a==='page'){root.ListPager.set(S,v,b.dataset.page);return root.paint();}
  e.stopPropagation();
  if(a==='act')return open(b.dataset.key,b.closest('.prv-row')||['owner','contact','next','activity','stage','stagefields','win','support','expansion'].includes(v)?(v||''):(C&&C.RS[v]?C.RS[v][4]:''));/* v11 줄의 버튼은 동작 이름을 그대로 넘긴다(보드 카드는 사유 키) */
  if(a==='fix'){e.stopPropagation();return open(b.dataset.key,'stagefields');}/* 날짜 미입력 보완 단추(ops_12 A②) */
  if(a==='open'&&!e.target.closest('button'))return open(b.dataset.key);
 }
 /* PipelineListV2.paint 를 감싼다: B안이 켜져 있으면 B안을 그리고 true */
 const L2=root.PipelineListV2;if(!L2)return;
 const basePaint=L2.paint;
 L2.paint=function(el,key,list){
  if(!enabled(key)||!L2.enabled(key))return basePaint.apply(this,arguments);
  const pg=document.getElementById('pg-pipe');pg?.classList.add('plv-on');pg?.classList.add('psb-on');
  const S=st();if(S.key!==key){S.key=key;S.bucket='all';S.reason=null;root.ListPager.reset(S);}
  el.classList.remove('pk-mode');el.innerHTML=html(key,list);
  if(!el.__psb){el.__psb=true;el.addEventListener('click',onClick,true);el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#pipeline-stage-b [data-psb="open"]')){e.preventDefault();e.target.click();}});}
  document.getElementById('ptitle').textContent=CFG[key].name;const ps=document.getElementById('psub');if(ps)ps.textContent='왼쪽 단계 진단 → 오른쪽 확인할 현장 · 빨강 사유부터';
  root.CommonFilterBar?.mount('pipe');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
  return true;
 };
 root.PipelineStageB={enabled,model,html,CFG,rules,open,segRules,sentEvidence,consultingEvidence};
})(window);
