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
 const st=()=>root.G.psb||(root.G.psb={view:'list',bucket:'all',reason:null,limit:30});
 const enabled=key=>!root.G.pipeStageBOff&&KEYS.includes(key||root.G.pipelineStage)&&!!root.PipelineListV2;
 const days=v=>{if(!v)return null;const n=root.daysTo(String(v).slice(0,10));return Number.isFinite(n)?n:null;};
 const since=v=>{const n=days(v);return n===null?null:-n;};
 const ymd=v=>{const s=String(v||'').slice(0,10),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?Number(m[2])+'/'+Number(m[3]):'';};
 const money=v=>{const n=Number(v)||0;if(!n)return '금액 미정';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const VISIT=['현장방문','방문','회의','PT','현장설명'];
 const nextIsVisit=r=>!!(r.next&&VISIT.includes(String(r.next.type||'')));
 const lastDays=r=>{let a=null;try{a=root.activityAge(r.item);}catch(e){}const c=r.contactDays;if(a===null||a===undefined)return c==null?null:c;return c==null?a:Math.min(a,c);};
 /* 재영업 연결 = 확장관리에서 실제로 움직인 기록(연락 · 니즈 메모 · 영업건 전환)이 있는 것만. 준공만으로 자동 생성된 빈 기록은 아직 '연결'이 아니다 */
 const expansionOf=r=>{try{const id=String(r.item.id),raw=(root.expServerRows?.()||[]).concat((root.LOCAL&&root.LOCAL.expansionPool)||[]);if(!raw.some(x=>String(root.expSourceId?root.expSourceId(x):(x.source_opportunity_id||x.sourceOpportunityId))===id))return null;return (root.expansionRecords?.()||[]).find(e=>String(e.sourceOpportunityId)===id)||null;}catch(e){return null;}};
 /* ── 단계별 지침(README 표). S = 막대 3칸 [키, 이름, 색, 기준 한 줄], RS = 사유 [키 → 이름, 색(빨강=기준 넘김), 버튼, 해야 할 일, 상세 열기 액션] ── */
 const CFG={
  consulting:{name:'컨설팅 설계',desc:()=>'1차 현장미팅으로 고객 요구를 확인하고 견적을 준비하는 단계 · 견적 처리 목표 '+rules().quote+'일 / 최대 5일',axis:'1차 현장미팅 진행',
   S:[['none','미팅 전 · 일정 없음','#15171c','첫 통화에서 날짜 잡기'],['plan','미팅 예정','#8a909c','미팅 전날 확인 연락'],['done','미팅 완료 · 견적 준비','#d5d9e0','3일 안 견적 요청(잔디)']],
   RS:{nodate:['미팅 일정 없음',RED,'미팅 잡기','첫 통화에서 1차 미팅 날짜까지 잡기','next'],nodue:['견적 요청 3일 넘김',RED,'견적 요청','미팅 후 3일 안 견적 요청 등록 · 대표회의 임박이면 개략 금액 먼저','stagefields'],req:['필수 확인 미입력',INK,'정보 보완','미팅 때 현재 문제 · 범위 · 시기 · 경쟁사 · 요청 자료 · 대표회의 일정 · 결정권자 채우기','stagefields'],nonext:['다음 행동 · 날짜 없음',INK,'다음 행동','모든 현장에 다음 행동 + 날짜 등록 (완료만 선택 불가)','next'],long:['30일 넘게 머묾',INK,'보류 판단','30일 넘은 현장은 일반관리 전환 · 보류 여부 판단','stage']},
   calc(r,v,q){const f=r.fields||{},fc=(r.item.stage_contexts||{}).first_contact?.fields||{},visit=nextIsVisit(r),nd=r.days,quoteDue=v.quoteDue,past=visit&&nd!==null&&nd<0;
    const bucket=(quoteDue||f.quote_request||past)?'done':(visit&&nd!==null&&nd>=0)?'plan':'none';
    const sub=bucket==='plan'?ymd(r.due)+' 미팅 예정':bucket==='done'?(past?ymd(r.due)+' 미팅':'견적 준비 중')+(quoteDue?' · 견적 '+ymd(quoteDue):''):'일정 없음';
    const rs=[];if(bucket==='none')rs.push('nodate');if(bucket==='done'&&((quoteDue&&days(quoteDue)<0)||(!quoteDue&&(r.stall||0)>q.quote)))rs.push('nodue');if(!v.needs||!fc.work_scope||!fc.expected_timing)rs.push('req');if(!r.next||!r.next.text||!r.due)rs.push('nonext');if((r.stall||0)>q.stay)rs.push('long');
    return {bucket,sub,rs};}},
  sent:{name:'자료 발송완료',desc:()=>'견적 · 자료를 보낸 단계 · 견적 발송은 완료가 아니라 후속관리 시작 — 발송일 기준 D+'+rules().follow+' 후속 연락',axis:'발송 후 후속 연락',
   S:[['wait','D+7 전 · 후속 대기','#d5d9e0','7일 안에 반응 확인'],['late','7일 넘김 · 후속 없음','#15171c','오늘 후속 통화'],['done','후속 완료 · 반응 기록','#8a909c','결과 기록 + 다음 행동일']],
   RS:{nofollow:['발송 후 7일 · 후속 없음',RED,'후속 통화','발송 7일 넘은 건은 오늘 후속 통화 → 결과 기록','activity'],meet:['대표회의 D-3 · 자료 회신',RED,'자료 제출','대표회의 전 비교 자료 · 개략 금액 먼저 발송','activity'],noreact:['반응 미기록',INK,'결과 기록','연락 결과(연결됨 · 검토중 · 자료요청 · 견적요청 · 보류 · 거절)를 기록','activity'],comp:['경쟁사 비교 중',INK,'조건 확인','경쟁사 · 가격 · 조건 변화 확인 → 비교표 · 사례로 설명','activity'],nonext:['다음 행동 · 날짜 없음',INK,'다음 행동','후속 통화 후 다음 행동일 지정','next']},
   calc(r,v,q){const f=r.fields||{},sentAt=f.sent_date||'',sd=since(sentAt),stay=sd!==null?sd:(r.stall||0),ld=lastDays(r),reacted=!!v.reaction||(ld!==null&&sd!==null&&ld<sd),meet=days(r.date);
    const bucket=reacted?'done':stay>q.follow?'late':'wait';
    const sub=(sentAt?ymd(sentAt)+' 발송':'발송일 미기록')+(v.reaction?' · '+v.reaction:'')+(meet!==null&&meet>=0?' · 결정 '+ymd(r.date):'');
    const rs=[];if(bucket==='late')rs.push('nofollow');if(meet!==null&&meet>=0&&meet<=q.d3)rs.push('meet');if(!v.reaction)rs.push('noreact');if(/가격|경쟁/.test(String(v.reaction||''))||v.competitor)rs.push('comp');if(!r.next||!r.next.text||!r.due)rs.push('nonext');
    return {bucket,sub,rs};}},
  relationship:{name:'관계관리',desc:()=>'견적 후 관리 구분 · 집중관리(초기 1개월, '+rules().focus+'일 단위) → 일반관리(월 1회) → 대기('+Math.round(rules().wait/30)+'개월 1회)',axis:'관리 구분',
   S:[['focus','집중관리 · 7일 단위','#15171c','7일 안 연락 · 대표회의 · 경쟁사 확인'],['normal','일반관리 · 월 1회','#8a909c','카드뉴스 · 공법자료 · 사례 전달'],['wait','대기 · 2개월 1회','#d5d9e0','연도 지정 · 2개월마다 관계 연락']],
   RS:{focus7:['집중관리 7일 넘게 연락 없음',RED,'연락','집중관리 고객은 7일 단위 후속 · 대표회의 · 경쟁사 · 가격 변화 확인','activity'],month30:['30일 넘게 접촉 없음',RED,'정기 연락','모든 고객 월 1회 이상 접촉 · 자료(카드뉴스 · 사례) 전달','activity'],long60:['대기 2개월 연락일 도래',INK,'관계 연락','공사 시기 확인 + 다음 2개월 연락일 등록','activity'],shift:['구분 전환 검토',INK,'전환 검토','1개월 경과 → 집중관리 종료 검토 · 3개월 진전 없음 → 대기 전환 검토','stage'],nonext:['다음 행동 · 날짜 없음',INK,'다음 행동','연락 후 다음 행동 + 날짜 등록','next']},
   calc(r,v,q){const code=r.code,bucket=code==='waiting'?'wait':code==='rapport'?'focus':'normal',ld=lastDays(r),f=r.fields||{};
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
   RS:{cinfo:['계약일 · 금액 미입력',RED,'입력','계약일 · 금액 · 계약서 입력 (매출 집계 · 착공 준비)','stagefields'],handoff:['인계서 미완료',RED,'인계','공사범위 · 제외범위 · 공기 · 고객 요구 · 서비스공사 · 특이사항 → 현장소장 확인','stagefields'],site7:['주 1회 현장 방문 안 함',RED,'현장 확인','착공 후 주 1회 · 공정 · 불만 · 소장 요청 · 추가공사 기록','activity'],verbal:['구두 약속 미기록',INK,'특약 기록','고객과 말로 한 약속은 계약서 특약 또는 CRM에 기록','stagefields'],extra:['추가공사 요청 확인',INK,'승인 요청','비용 · 일정 영향 확인 → 승인 → 고객 서면합의 후 진행','support']},
   calc(r,v,q){const code=r.code,cx=r.item.stage_contexts||{},cf=cx.contract?.fields||{},bf=cx.construction?.fields||{},ld=lastDays(r);
    const bucket=code==='contract'?'sign':(code==='construction'&&bf.handover!=='완료')?'hand':'build';
    const sub=code==='contract'?(v.contractDate?'계약 '+ymd(v.contractDate):'계약 서류 진행'):code==='construction'?('인계 '+(bf.handover||'미기록')+(bf.start_date?' · 착공 '+ymd(bf.start_date):'')):('준공 '+(ymd(v.completionDate)||'일자 미기록'));
    const rs=[];if(!v.contractDate||!v.contractAmount)rs.push('cinfo');if(code==='construction'&&bf.handover!=='완료')rs.push('handoff');if(code==='construction'&&ld!==null&&ld>q.site)rs.push('site7');if(code==='contract'&&!cf.special_terms)rs.push('verbal');if(/추가/.test(String(bf.requests||'')))rs.push('extra');
    return {bucket,sub,rs};}},
  won:{name:'수주',desc:()=>'준공 이후 단계 · 준공은 끝이 아니라 사후관리 → 재영업 · D+'+rules().after+' 만족도 · 하자 · 내년 공사 · 추가 공종 · 주변 단지 소개 확인',axis:'사후관리',
   S:[['fresh','준공 직후 · D+30 전','#8a909c','D+30에 사후 연락'],['check','D+30 사후 확인','#15171c','만족도 · 하자 · 차기 공사 확인'],['resale','재영업 연결','#d5d9e0','새 영업건 · 소개 단지 등록']],
   RS:{after30:['준공 D+30 사후 연락 안 함',RED,'사후 연락','만족도 · 하자 · 내년 공사 · 추가 공종 · 주변 단지 소개 확인','activity'],refer:['추가공사 · 소개 미등록',INK,'영업건 등록','기회는 메모가 아니라 새 영업건(확장관리)으로 등록','expansion'],nextyear:['차기 공사 미확인',INK,'연도 확인','장기수선계획 · 내년도 예정 공종 확인 → 대기(2개월) 연결','next'],keyman:['결정권자 관계 유지 안 함',INK,'관계 연락','입대의 · 관리소장 교체 여부 확인 · 2개월 1회 연락','activity']},
   calc(r,v,q){const cd=since(v.completionDate),ld=lastDays(r),exp=expansionOf(r),after=cd!==null&&cd>=q.after,contacted=ld!==null&&cd!==null&&ld<cd;
    const bucket=exp?'resale':(cd!==null&&cd<q.after)?'fresh':'check';
    const sub=(v.completionDate?'준공 '+ymd(v.completionDate)+(cd!==null?' · D+'+cd:''):'준공일 미기록')+(exp?' · 확장관리 연결':'');
    const rs=[];if(after&&!contacted)rs.push('after30');if(after&&!exp)rs.push('refer');if(!(r.next&&r.next.text)&&!exp)rs.push('nextyear');if(ld!==null&&ld>q.wait)rs.push('keyman');
    return {bucket,sub,rs};}},
  lost:{name:'실주',desc:()=>'이번 공사는 끝났지만 영업은 계속 · 실주 사유 · 낙찰사 · 금액 기록 → 차기 공사 연도 지정 → 대기('+Math.round(rules().wait/30)+'개월 1회)로 관계 유지',axis:'실주 기록',
   S:[['nore','사유 미기록','#15171c','사유 · 낙찰사 · 금액 기록'],['rec','기록 완료','#d5d9e0','차기 공사 연도 지정'],['re','재영업 예정','#8a909c','대기 · 2개월 1회 연락']],
   RS:{noreason:['실주 사유 미입력',RED,'사유 기록','가격 · 공법 · 관계 · 일정 중 사유 + 고객 반응 기록','stage'],nobid:['경쟁사 · 금액 미기록',INK,'결과 기록','낙찰사 · 낙찰가 · 당사 제안가 · 가격차 · 결정요인 기록','stagefields'],relist:['차기 공사 연도 없음',INK,'연도 지정','다음 공사 예상 연도 지정 → 대기 2개월 연락 자동 생성','next'],contact:['관계 연락 안 함',INK,'관계 연락','실주 후 2개월 안 관계 연락 · 하자 발생 여부 확인','activity']},
   calc(r,v,q){const reason=v.lossReason&&v.lossReason!=='미기록'?v.lossReason:'',re=!!(v.recontact&&!/없|낮/.test(String(v.recontact)))||!!(r.next&&r.next.text),ld=lastDays(r);
    const bucket=!reason?'nore':re?'re':'rec';
    const sub=(v.lossDate?ymd(v.lossDate)+' 실주':'실주일 미기록')+(reason?' · '+reason:'')+(v.recontact?' · 재접촉 '+v.recontact:'');
    const rs=[];if(!reason)rs.push('noreason');if(!v.competitor)rs.push('nobid');if(!re)rs.push('relist');if(ld!==null&&ld>q.wait)rs.push('contact');
    return {bucket,sub,rs};}}
 };
 function model(key,list){
  const C=CFG[key],q=rules(),built=root.PipelineListV2.build(key,list);
  const isRed=k=>C.RS[k]&&C.RS[k][1]===RED,order=Object.keys(C.RS);
  const items=built.map(x=>{const r=x.row,v=x.values||{};let c;try{c=C.calc(r,v,q);}catch(e){c={bucket:C.S[0][0],sub:'',rs:[]};}const first=c.rs.find(isRed)||c.rs[0]||'';return {row:r,values:v,bucket:c.bucket,sub:c.sub,rs:c.rs,first,red:c.rs.some(isRed),pri:(()=>{const i=order.findIndex(k=>c.rs.includes(k)&&isRed(k));return i<0?99:i;})(),stall:Number(r.stall)||0};});
  items.sort((a,b)=>a.pri-b.pri||b.rs.length-a.rs.length||b.stall-a.stall||String(a.row.key).localeCompare(String(b.row.key)));
  return {C,items,isRed};
 }
 function rowHtml(C,it,reason){
  const r=it.row,k=reason||it.first,rs=k?C.RS[k]:null,bc=BRAND[r.item.brand]||'#9ca3af',S=C.S.find(s=>s[0]===it.bucket)||C.S[0];
  return '<div class="psb-row" role="row" tabindex="0" data-psb="open" data-key="'+attr(r.key)+'" style="border-left-color:'+bc+'"><div class="l"><b title="'+attr(r.site)+'">'+h(r.site)+(root.advisoryBadge?root.advisoryBadge(r.item):'')+'</b><span><em style="color:'+bc+'">'+h(r.item.brand||'브랜드 미지정')+'</em> · '+h(r.owner||'미배정')+' · '+h(money(r.amount))+'</span></div><div class="r"><div class="s"><b style="color:'+(S[2]==='#15171c'?'#15171c':'#6b7280')+'">'+h(S[1].split(' · ')[0])+'</b><span>'+h(it.sub)+'</span></div><span class="i" style="color:'+(rs?rs[1]:'#6b7280')+'">'+h(rs?rs[0]:'정상')+'</span><b class="d'+(it.stall>rules().stay?' r':'')+'">'+it.stall+'일</b><button type="button" data-psb="act" data-key="'+attr(r.key)+'" data-v="'+attr(k||'')+'">'+h(rs?rs[2]:'열기')+'</button></div></div>';
 }
 function cardHtml(C,it,reason){
  const r=it.row,k=reason||it.first,rs=k?C.RS[k]:null,bc=BRAND[r.item.brand]||'#9ca3af';
  return '<div class="psb-card" role="button" tabindex="0" data-psb="open" data-key="'+attr(r.key)+'" style="border-left-color:'+bc+'"><div class="t"><b style="color:'+bc+'">'+h(r.item.brand||'브랜드 미지정')+'</b><i></i><b class="'+(it.stall>rules().stay?'r':'')+'">'+it.stall+'일</b></div><strong>'+h(r.site)+'</strong><span>'+h(it.sub)+' · '+h(money(r.amount))+'</span><div class="b"><em style="color:'+(rs?rs[1]:'#6b7280')+'">'+h(rs?rs[0]:'정상')+'</em><i></i><button type="button" data-psb="act" data-key="'+attr(r.key)+'" data-v="'+attr(k||'')+'">'+h(rs?rs[2]:'열기')+'</button></div></div>';
 }
 function html(key,list){
  const S=st(),{C,items,isRed}=model(key,list),q=rules();
  const inB=items,byS=S.bucket==='all'?inB:inB.filter(i=>i.bucket===S.bucket),listed=S.reason?byS.filter(i=>i.rs.includes(S.reason)):byS;
  const n=inB.length||1,cnt=k=>inB.filter(i=>i.bucket===k).length,W=C.S.map(s=>Math.round(cnt(s[0])/n*100));
  const sumAmt=inB.reduce((s,i)=>s+(Number(i.row.amount)||0),0),avg=Math.round(inB.reduce((s,i)=>s+i.stall,0)/n),redN=inB.filter(i=>i.red).length;
  const reasons=Object.keys(C.RS).map(k=>({k,n:byS.filter(i=>i.rs.includes(k)).length})).filter(x=>x.n>0);
  const acts=(S.reason?[S.reason]:reasons.slice(0,3).map(x=>x.k)).map(k=>({tag:C.RS[k][0]+' '+byS.filter(i=>i.rs.includes(k)).length+'건',t:C.RS[k][3]}));
  const filters=[S.bucket!=='all'?(C.S.find(s=>s[0]===S.bucket)||[])[1]:null,S.reason?C.RS[S.reason][0]:null].filter(Boolean);
  const diag='<section class="psb-diag"><div class="psb-box"><header><b>단계 진단</b><span>'+inB.length+'건 · '+h(money(sumAmt))+'</span><i></i>'+(filters.length?'<button type="button" class="lnk" data-psb="clear">필터 해제</button>':'')+'</header>'
   +'<div class="psb-axis"><span>'+h(C.axis)+'</span><div class="bar">'+C.S.map((s,i)=>'<div style="width:'+W[i]+'%;background:'+s[2]+'"></div>').join('')+'</div><div class="leg">'+C.S.map(s=>'<button type="button" data-psb="bucket" data-v="'+s[0]+'" aria-pressed="'+(S.bucket===s[0])+'"><i style="background:'+s[2]+'"></i>'+h(s[1])+' <b>'+cnt(s[0])+'</b></button>').join('')+'</div></div>'
   +'<div class="psb-kpis"><div><span>기준 넘김 (빨강)</span><b style="color:'+(redN?RED:'#15171c')+'">'+redN+'건</b><small>오늘 처리할 것</small></div><div><span>'+h(C.S[0][1])+'</span><b>'+cnt(C.S[0][0])+'건</b><small>'+h(C.S[0][3])+'</small></div><div><span>평균 체류</span><b>'+avg+'일</b><small>이 단계에 머문 일수</small></div></div></div>'
   +'<div class="psb-two"><div class="psb-box"><header><b>왜 멈춰 있나</b><span>누르면 오른쪽 현장이 걸러짐</span></header>'+(reasons.length?reasons.map(x=>'<button type="button" class="psb-reason" data-psb="reason" data-v="'+x.k+'" aria-pressed="'+(S.reason===x.k)+'"><span>'+h(C.RS[x.k][0])+'</span><b style="color:'+C.RS[x.k][1]+'">'+x.n+'</b><i><u style="width:'+(byS.length?Math.round(x.n/byS.length*100):0)+'%;background:'+(isRed(x.k)?RED:'#9aa0ab')+'"></u></i></button>').join(''):'<p class="psb-none">멈춘 사유가 없습니다</p>')+'</div>'
   +'<div class="psb-box"><header><b>그래서 뭘 해야 하나</b></header>'+(acts.length?acts.map(a=>'<div class="psb-act"><span>'+h(a.tag)+'</span><p>'+h(a.t)+'</p></div>').join(''):'<p class="psb-none">기준을 넘긴 현장이 없습니다</p>')+'</div></div></section>';
  const shown=listed.slice(0,S.limit);
  const head='<div class="psb-lhead"><b>확인할 현장 <span>'+listed.length+'곳</span></b>'+(filters.length?'<em>'+h(filters.join(' · '))+'</em>':'')+'<i></i><div class="psb-views"><button type="button" data-psb="view" data-v="list" aria-pressed="'+(S.view==='list')+'">리스트</button><button type="button" data-psb="view" data-v="board" aria-pressed="'+(S.view==='board')+'">보드</button></div></div>';
  let body;
  if(S.view==='board')body='<div class="psb-board">'+C.S.map(s=>{const cards=listed.filter(i=>i.bucket===s[0]).slice(0,40);return '<div class="psb-col"><div class="ch"><i style="background:'+s[2]+'"></i><b>'+h(s[1])+'</b><span>'+cards.length+'</span><em>'+h(s[3])+'</em></div>'+(cards.length?cards.map(i=>cardHtml(C,i,S.reason)).join(''):'<p class="psb-none">없음</p>')+'</div>';}).join('')+'</div>';
  else body='<div class="psb-list">'+(shown.length?shown.map(i=>rowHtml(C,i,S.reason)).join(''):'<div class="psb-empty">해당하는 현장이 없습니다.</div>')+(listed.length>shown.length?'<button type="button" class="psb-more" data-psb="more">나머지 '+(listed.length-shown.length)+'건 더 보기</button>':'')+'</div>';
  return '<div id="pipeline-stage-b" class="psb" data-stage="'+key+'"><div class="psb-head"><b>'+h(C.name)+'</b><span>'+h(C.desc())+'</span></div><div class="psb-body">'+diag+'<section class="psb-main">'+head+body+'</section></div></div>';
 }
 /* 열기: 기존 상세 + 액션(연락 결과 · 다음 할 일 · 단계 필드 · 단계 전환 · 지원 요청). 확장관리 등록은 확장관리 화면으로 */
 function open(key,act){
  const r=root.PipelineWorkspace.rows().find(x=>x.key===key);if(!r)return;
  if(act==='expansion'&&typeof root.goPage==='function'){root.G.expansionFocus=r.item.id;root.goPage('expansion');return;}
  root.G._detailPopup=true;root.drwDeal(JSON.stringify(r.item));
  if(act&&root.DetailActions&&typeof root.DetailActions.open==='function')setTimeout(()=>{try{root.DetailActions.open(act);}catch(e){}},150);
 }
 function onClick(e){
  const b=e.target.closest('#pipeline-stage-b [data-psb]');if(!b)return;const S=st(),a=b.dataset.psb,v=b.dataset.v,key=root.G.pipelineStage,C=CFG[key];
  if(a==='bucket'){S.bucket=S.bucket===v?'all':v;S.reason=null;return root.paint();}
  if(a==='reason'){S.reason=S.reason===v?null:v;return root.paint();}
  if(a==='clear'){S.bucket='all';S.reason=null;return root.paint();}
  if(a==='view'){S.view=v;return root.paint();}
  if(a==='more'){S.limit+=30;return root.paint();}
  e.stopPropagation();
  if(a==='act')return open(b.dataset.key,C&&C.RS[v]?C.RS[v][4]:'');
  if(a==='open'&&!e.target.closest('button'))return open(b.dataset.key);
 }
 /* PipelineListV2.paint 를 감싼다: B안이 켜져 있으면 B안을 그리고 true */
 const L2=root.PipelineListV2;if(!L2)return;
 const basePaint=L2.paint;
 L2.paint=function(el,key,list){
  if(!enabled(key)||!L2.enabled(key))return basePaint.apply(this,arguments);
  const pg=document.getElementById('pg-pipe');pg?.classList.add('plv-on');pg?.classList.add('psb-on');
  const S=st();if(S.key!==key){S.key=key;S.bucket='all';S.reason=null;S.limit=30;}
  el.classList.remove('pk-mode');el.innerHTML=html(key,list);
  if(!el.__psb){el.__psb=true;el.addEventListener('click',onClick,true);el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#pipeline-stage-b [data-psb="open"]')){e.preventDefault();e.target.click();}});}
  document.getElementById('ptitle').textContent=CFG[key].name;const ps=document.getElementById('psub');if(ps)ps.textContent='왼쪽 단계 진단 → 오른쪽 확인할 현장 · 빨강 사유부터';
  root.CommonFilterBar?.mount('pipe');const bar=pg?.querySelector(':scope>.cf-bar');if(bar)bar.hidden=false;
  return true;
 };
 root.PipelineStageB={enabled,model,html,CFG,rules};
})(window);
