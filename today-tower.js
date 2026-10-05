/* 오늘 업무 · 관제탑 (2026-10-03 디자인 핸드오프 'design_handoff_today_tower')
   로그인 역할에 따라 같은 틀(제목 → 파이프라인 7칸 → 칩 · 브랜드 → 급한 카드 3장 → 단계별 목록 → 오른쪽 일정 · 마감 · 기준)에서 카드 · 목록 내용만 바뀐다.
   · 영업사원: 내 담당만.  · 영업관리: 팀 전체 — 진행이 멈춘 건을 담당자에게 요청(입찰 마감 · 사고 · 승인은 팀장 영역이라 뺀다).
   · 팀장: 팀 전체 + 팀장 판단(마감 · 재배정 · 지원 요청) + 내 담당.  · 상무 · 대표: 결정 요청(지원 요청) + 내 담당, 7칸 숫자는 '팀 놓침'.
   근거 데이터는 전부 기존 것: TodayWorkQueue.data()의 행(기한 · 첫 연락 · 후속 · 미배정), 영업단계 · 단계 필드(발송일 · 후속 확인일 · 결정 일정 · 입찰 마감 · 계약일 · 금액 · 착공일), 마지막 활동일, 준공 후 확장관리 행, [지원 요청] 메모.
   ※ 사고 · 누수 · 민원, 할인 승인 · 입찰가 결정은 CRM에 기록 항목이 없어 만들지 않는다(설정값 · 필드가 생기면 추가). 숫자 · 날짜는 계산값만, 문장 틀은 규칙이다.
   열기 · 저장은 기존 경로(TodayWorkQueue.open → 상세). 끄기: G.todayTowerOff=true → 이전 오늘 업무 화면. */
(function(root){
 'use strict';
 const h=v=>root.esc(String(v==null?'':v)),attr=v=>root.escAttr(String(v==null?'':v));
 const T=()=>root.TodayWorkQueue;
 const enabled=()=>!root.G.todayTowerOff&&!!T();
 const st=()=>root.G.tower||(root.G.tower={stage:null,urg:null,reason:'all',brand:null,open:{},ex:{}});
 const RULES=()=>root.OPS_RULES||{};
 /* 설정값(하드 규칙 아님): 고액 기준 · 주간 연락 목표 · 첫 응답 기준 시간 · 역할 지정 */
 const BIG=()=>Number(RULES().towerBigAmount)||3e8,WEEK_GOAL=()=>Number(RULES().towerWeeklyContactGoal)||40,FIRST_HOURS=()=>Number(RULES().towerFirstResponseHours)||2;
 /* 역할은 로그인 계정으로 자동(2026-10-03 대표 확정): 송보람 = 영업관리 · 이승우 = 대표 · 황윤선 = 상무 · 한준엽 = 팀장 · 영업사원 = 정정훈 · 김성민 · 이필선. OPS_RULES.towerRoles 로 바꿀 수 있다 */
 const ROLE_BY_NAME=()=>Object.assign({'이승우':'ceo','황윤선':'vp','한준엽':'lead','송보람':'mgr'},RULES().towerRoles||{});
 const ROLE_LABEL={rep:'영업사원',mgr:'영업관리',lead:'팀장',vp:'상무',ceo:'대표'};
  const COLS=[['inq','견적문의',FIRST_HOURS()+'시간 안 첫 연락'],['cons','컨설팅 설계','방문 후 3일 안 견적'],['sent','자료 발송완료','견적 발송 후 7일 안 후속 연락'],['rel','관계관리','월 1회 이상 · 장기 2개월 1회'],['bid','경쟁·입찰','마감 D-7부터 준비'],['con','계약·시공','계약일 · 금액 입력 · 착공 후 주 1회 현장 확인'],['won','수주·확장','준공 D+30 사후 연락']];
 const COL_OF={first_contact:'cons',consulting:'cons',sent:'sent',rapport:'rel',silent:'rel',waiting:'rel',compete:'bid',imminent:'bid',bidding:'bid',contract:'con',construction:'con',completion:'won',won:'won'};
 /* 이유(칩 드롭다운) · 색: 빨강 = 기준 초과 · 손실 위험만 */
 const R={transfer:['타사 이관 결과 확인','#d97706'],tfapprove:['실적 인정 대기','#d93a3a'],decide:['결정 · 지원 요청','#d93a3a'],assign:['배정 필요','#d93a3a'],deadline:['마감 임박','#c2410c'],contract:['계약정보 누락','#d93a3a'],stallbig:['고액 정체','#d93a3a'],silent:['발송 후 무응답','#d97706'],first:['첫 연락 늦음','#d93a3a'],promise:['약속일 지남','#d93a3a'],quote:['견적 지연','#d97706'],site:['현장 방문 미실시','#a16207'],month:['30일 미접촉','#a16207'],long:['장기관리 도래','#6b7280'],data:['필수정보 미입력','#6b7280'],stall:['다음 할 일 없음','#a16207'],after:['사후 연락 없음','#a16207']};
 const MISS={transfer:'타사 이관 뒤 낙찰결과 확인 안 함',tfapprove:'타사 이관 수주 · 관리자 실적 인정 대기',decide:'결정 대기 · 담당 통보 필요',assign:'담당 배정 안 됨',deadline:'마감 전 준비 안 됨',contract:'계약정보 입력 안 함',stallbig:'고액 견적 후속 없음',silent:'견적 발송 후 7일 · 후속 연락 없음',first:'첫 연락 안 함',promise:'다음 연락일 지남',quote:'견적 처리기한(3일) 넘김',site:'착공 현장 주 1회 방문 안 함',month:'30일 넘게 접촉 없음',long:'장기관리 2개월 연락일 도래',data:'CRM 필수정보 미입력',stall:'다음 행동 · 날짜 없음',after:'준공 D+30 사후 연락 안 함'};
 const LOSS={transfer:'낙찰결과를 놓쳐 실적 인정이 늦어집니다',tfapprove:'담당자 수주실적 반영이 늦어집니다',decide:'담당이 움직이지 못합니다',assign:'고객이 다른 업체로 갑니다',deadline:'제안 없이 마감을 맞습니다',contract:'착공 준비와 집계가 멈춥니다',stallbig:'큰 건이 검토 단계에서 빠집니다',silent:'검토 단계에서 빠집니다',first:'다른 업체가 먼저 현장을 봅니다',promise:'약속을 안 지킨 업체로 기억됩니다',quote:'고객이 다른 견적부터 받습니다',site:'현장 불만을 늦게 알게 됩니다',month:'관계가 식어 재문의가 줄어듭니다',long:'공사 시기를 놓칩니다',data:'대표회의 · 경쟁 대응을 준비할 수 없습니다',stall:'다음 움직임이 정해지지 않습니다',after:'추가 공사 기회를 놓칩니다'};
 const ACT_REP={transfer:'결과 등록',tfapprove:'인정 대기',first:'전화',promise:'전화',month:'전화',silent:'전화',after:'전화',stallbig:'전화',deadline:'제안 준비',quote:'견적 요청',stall:'다음 할 일',site:'현장 확인',long:'관계 연락',data:'정보 보완',contract:'정보 입력'};
 const ACT_TEAM={transfer:'독촉',tfapprove:'실적 인정',assign:'배정',decide:'결정 기록',contract:'입력 요청',first:'독촉',silent:'독촉',quote:'독촉',after:'독촉',deadline:'독촉',stallbig:'독촉',promise:'코멘트',stall:'코멘트',month:'코멘트',site:'코멘트',long:'코멘트',data:'정보 요청'};
 const DONE={'결과 등록':'낙찰결과(수주 · 실주 · 취소) 등록','실적 인정':'사전 보고 · 낙찰결과 · 낙찰금액 확인 후 인정','인정 대기':'관리자 인정 뒤 실적 반영','재배정':'결정 기록 + 담당 통보 · 인수 확인','배정':'담당자 지정 + 인계 확인','결정 기록':'결정 내용 기록 + 담당 통보','자료 제출':'자료 · 개략 금액 발송 + 회의 결과 확인일 등록','현장 확인':'공정 · 불만 · 소장 요청 · 추가공사 기록','정보 보완':'결정 일정 · 경쟁사 · 결정권자 입력','정보 요청':'담당자 확인 + 입력 약속 시간 받기','정기 연락':'연락 결과 + 다음 행동 · 날짜','관계 연락':'공사 시기 확인 + 다음 2개월 연락일','전화':'결과 + 다음 행동 · 날짜 함께 기록 (완료만 선택 불가)','제안 준비':'제안서 업로드 + 제출일 확정','견적 요청':'견적 요청 등록 + 견적 예정일 입력','다음 할 일':'다음 할 일 · 날짜 등록','독촉':'담당자 확인 + 처리 약속 시간 받기','코멘트':'담당자 확인 + 통화 결과 기록 확인','입력 요청':'계약일 · 금액 입력 확인','정보 입력':'계약일 · 금액 입력'};
 const BRAND={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const dayN=hours=>Number.isFinite(hours)&&hours>0?Math.max(1,Math.floor(hours/24)):0;
 const money=n=>{n=Number(n)||0;if(!n)return '';if(n>=1e8)return (Math.round(n/1e7)/10)+'억';if(n>=1e4)return Math.round(n/1e4).toLocaleString('ko-KR')+'만';return n.toLocaleString('ko-KR');};
 const cut=(v,n)=>{v=String(v||'').replace(/\s+/g,' ').trim();return v.length>n?v.slice(0,n-1)+'…':v;};
 const given=nm=>String(nm||'');/* 이름은 줄이지 않고 성까지 그대로(2026-10-05 대표 "이름 왜 간결하게 된 거야 제대로 해" — 팀 일정 '윤선 · 통화 약속' → '황윤선 · 통화 약속') */
 const md=v=>{const s=String(v||'').slice(0,10),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s);return m?Number(m[2])+'/'+Number(m[3]):'';};
 const daysTo=v=>{try{const s=String(v||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const n=root.daysTo(s);return Number.isFinite(n)?n:null;}catch(e){return null;}};
 const since=v=>{const n=daysTo(v);return n===null?null:-n;};
 /* ── 역할 ── */
 function roleOf(X){
  const G=root.G,me=root.repN(root.ME&&root.ME.name),byName=ROLE_BY_NAME()[me]||'';
  let r=byName||'rep';if(!byName&&X.admin&&!(root.repProfile&&root.repProfile(me).salesRep))r='mgr';/* 이름 매핑이 없는 관리자(영업담당이 아닌 운영 계정)는 영업관리 */
  if(G.towerRole&&ROLE_LABEL[G.towerRole]&&X.admin&&root.G.towerRoleTest)r=G.towerRole;/* 검사 전용 — 화면에는 역할 전환 버튼 없음(2026-10-03 대표: 로그인한 사람으로 정해지니 불필요) */
  if(!X.admin&&r!=='rep')r='rep';/* 팀 자료가 안 오는 계정은 내 담당 화면만 */
  return r;
 }
 const TEAM=r=>r!=='rep';
 /* ── 행 하나 → 관제탑 항목 ── */
 function fieldsOf(d){const c=d&&d.stage_contexts||{};const out={};Object.keys(c).forEach(k=>{const f=c[k]&&c[k].fields;if(f)Object.keys(f).forEach(fk=>{if(f[fk]!=null&&f[fk]!=='')out[k+'.'+fk]=f[fk];});});return out;}
 function deadlineOf(d){const f=fieldsOf(d);let best=null;Object.keys(f).forEach(k=>{if(/\.(bid_deadline|decision_date|meeting_date|submit_due|submission_due|deadline)$/.test(k)){const n=daysTo(f[k]);if(n!==null&&(best===null||n<best.n))best={n,what:/bid/.test(k)?'입찰 마감':/decision/.test(k)?'결정 일정':/meeting/.test(k)?'대표회의':'제출기한',date:String(f[k]).slice(0,10)};}});return best;}
 function openSupport(d){try{const p=root.itemPatch?root.itemPatch(d,'deal'):{};const rows=[...(d.activities||[]),...((p&&p.activities)||[])].map(x=>({note:String(x.note||''),at:String(x.at||x.occurred_at||'')})).filter(x=>x.at).sort((a,b)=>a.at.localeCompare(b.at));let open=null;rows.forEach(x=>{if(/^\[지원 요청\]/.test(x.note))open=x;else if(/^\[지원 처리\]/.test(x.note))open=null;});if(!open)return null;const t=new Date(open.at),n=since(isNaN(t)?open.at.slice(0,10):t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'));return n!==null&&n<=14?{note:open.note.replace(/^\[지원 요청\]\s*/,''),days:n}:null;}catch(e){return null;}}
 function classify(x,role){
  const d=x.item,deal=x.type==='deal',inq=x.type==='inq',exp=x.type==='expansion',team=TEAM(role);
  let code='';try{code=deal?root.dealStage(d):'';}catch(e){}
  const col=inq||x.kind==='manager'?'inq':exp?'won':COL_OF[code]||'cons';
  const amt=deal?Number(root.oppAmt(d))||0:0;
  const f=deal?fieldsOf(d):{};
  const dl=deal?deadlineOf(d):null;
  let lastDays=null,relDays=null,stAge=null;if(deal){try{lastDays=root.activityAge(d);}catch(e){}if(lastDays===null||lastDays===0){const s=since(d.last_activity_at||d.lastActivity||d.last_worked_at||'');if(s!==null&&s>(lastDays||0))lastDays=s;}try{relDays=root.relationshipMeta(d).days;}catch(e){}try{stAge=root.stageAge(d);}catch(e){}}
  const sentDays=code==='sent'?(since(f['sent.sent_date'])??stAge):null;
  const support=deal&&team?openSupport(d):null;
  const contractMissing=['contract','construction'].includes(code)&&!((f['contract.contract_date']||d.contract_date)&&(f['contract.contract_amount']||d.contract_amount||d.won_amount));
  let rk='',urg='';
  if(support&&role!=='mgr'){rk='decide';urg='now';}
  else if(x.unassigned){if(!team)return null;rk='assign';urg='now';}
  else if(dl&&dl.n!==null&&dl.n>=0&&dl.n<=7&&role!=='mgr'){rk='deadline';urg=dl.n<=3?'now':'week';}
  else if(deal&&team&&root.DealTransfer&&root.DealTransfer.enabled()&&root.DealTransfer.awaiting(d)){rk='tfapprove';urg='today';}
  else if(deal&&root.DealTransfer&&root.DealTransfer.enabled()&&root.DealTransfer.checkDue(d)){rk='transfer';urg='today';}
  else if(contractMissing&&team){rk='contract';urg='now';}
  else if(sentDays!==null&&sentDays>=7&&(x.overdue||x.missingNext||(lastDays!==null&&lastDays>=7))){rk=amt>=BIG()?'stallbig':'silent';urg='now';}
  else if(x.responseLate){rk='first';urg='today';}
  else if(x.overdue){rk='promise';urg='today';}
  else if(code==='consulting'&&((f['consulting.quote_due']&&daysTo(f['consulting.quote_due'])<0)||(stAge!==null&&stAge>3&&!f['consulting.quote_due']))){rk='quote';urg='today';}
  else if(code==='construction'&&lastDays!==null&&lastDays>=7){rk='site';urg='today';}
  else if(deal&&col!=='won'&&relDays!==null&&relDays>=30&&code!=='waiting'){rk='month';urg='today';}
  else if(code==='waiting'&&relDays!==null&&relDays>=60){rk='long';urg='week';}
  else if(col==='bid'&&!(f['compete.decision_date']||f['imminent.decision_date']||f['bidding.decision_date']||f['bidding.bid_deadline'])){rk='data';urg='week';}
  else if(exp){rk=x.missingNext?'stall':'after';urg='week';}/* 확장관리: 연락일이 지났거나 준공 후 계산된 건만 '사후 연락', 날짜 자체가 없으면 '다음 행동 · 날짜 없음' */
  else if(code==='completion'){const cd=since(d.completion_date)??stAge;if(!(cd!==null&&cd>=30&&(lastDays===null||lastDays>=30)))return null;rk='after';urg='week';}
  else if(x.missingNext){rk='stall';urg='week';}
  else if(x.dueDays===0){rk='promise';urg='today';}
  else return null;
  if(role==='mgr'&&(rk==='deadline'||rk==='decide'))return null;
  /* 경과일: 견적문의 · 첫 연락 전 = 접수부터, 그 뒤와 모든 단계 = 마지막 응대부터 */
  let days=0,dLabel='경과';
  if(inq){let fr=null;try{fr=root.inqCtlFirstResponseAt(d);}catch(e){}if(fr){days=dayN(root.todayHoursFrom(fr));dLabel='응대 후';}else{days=dayN(x.lag);dLabel='접수 후';}}
  else if(exp){days=x.dueDays!==null&&x.dueDays<0?-x.dueDays:0;dLabel='연락일 후';}
  else{days=relDays!=null?relDays:lastDays!=null?lastDays:(stAge||0);dLabel='응대 후';}
  const short=rk==='deadline'&&dl?'D-'+dl.n:x.dueDays===0?'오늘':days+'일';if(x.dueDays===0&&rk==='promise')dLabel='약속';
  const missTxt=rk==='decide'&&support?'지원 요청 '+support.days+'일째':rk==='promise'&&x.dueDays===0?'다음 연락일 도래(오늘)':MISS[rk];
  return {x,key:x.key,st:col,rk,urg,days,dLabel,short,amt,deadline:dl,support,missTxt,code};
 }
 function info(x){
  const inq=x.type==='inq',it=x.item;let name='',role='',phone='';
  if(inq){name=it.contact_name||it.customer_name||it.contact||'';phone=it.phone||it.contact_phone||it.mobile||'';}
  else{try{const c=root.contactInfo(it,root.itemPatch(it,'deal'))||{};name=c.name||c.managerName||'';role=c.role||'';phone=c.mobile||c.officeTel||it.office_phone||'';}catch(e){}}
  let want='';try{want=inq?(it.memo||it.content||it.request||it.message||root.inqCtlWorkLabel?.(it)||''):(root.dealWorkSummary(it)||'');}catch(e){}
  if(/미분류|미기록|미입력/.test(want))want='';
  const digits=String(phone||'').replace(/\D/g,'');
  let brand='';try{brand=String(it.brand||root.inquiryBrandOf?.(it)||'').trim();}catch(e){}
  return {site:it.site||it.site_name||'현장명 미입력',name,role,phone:digits?root.phoneFmt(digits):'',digits,want:cut(want,60),recent:cut(x.recent||'',70),goal:cut(x.next||'',50),brand};
 }
 /* ── 묶음 · 정렬 ── */
 const tier=i=>i.rk==='decide'?0:i.rk==='assign'?0.5:(i.rk==='deadline'||i.rk==='contract')?1:i.rk==='stallbig'?2:3;
 /* 오늘 업무 대기열에는 기한 · 약속 · 미배정 건만 들어온다 — 견적 처리기한 · 현장 방문 · 30일 미접촉 · 마감 · 계약정보 · 지원 요청은 열려 있는 모든 영업건을 봐야 하므로, 대기열에 없는 열린 건을 같은 모양의 행으로 보탠다 */
 function extraRows(X,rows){
  const have=new Set(rows.map(x=>x.key)),out=[];
  (X.D||[]).forEach(d=>{let key;try{if(!root.isOpen(d))return;key='deal:'+root.dealKey(d);if(have.has(key))return;const a=root.actionObj(d,root.itemPatch(d,'deal')),due=a&&a.due?daysTo(String(a.due).slice(0,10)):null;
   out.push({key,type:'deal',kind:'pipeline',panel:'pipeline',item:d,owner:root.repN(d.assignee)||'미배정',stage:root.stageLabel(root.dealStage(d)),next:a&&a.text||'',recent:(()=>{try{return root.todayRecent(d,'deal');}catch(e){return '';}})(),due:a&&a.due||'',dueDays:due,missingNext:!a||!a.text||due===null,overdue:due!==null&&due<0,lag:0,extra:true});}catch(e){}});
  return out;
 }
 function model(X,rows,role){
  rows=rows.concat(extraRows(X,rows));
  const team=TEAM(role),me=root.repN(root.ME&&root.ME.name);
  /* 팀 기준 분류(팀장 규칙) — 7칸 '팀 놓침' · 담당자 줄에 쓴다 */
  const teamItems=team?rows.map(x=>classify(x,'lead')).filter(Boolean):[];
  let mine;
  if(role==='rep')mine=rows.filter(x=>!x.unassigned).map(x=>classify(x,'rep')).filter(Boolean);
  else if(role==='mgr'||role==='lead')mine=rows.map(x=>classify(x,role)).filter(Boolean);
  else mine=rows.map(x=>classify(x,role)).filter(i=>i&&(i.rk==='decide'||i.x.owner===me));/* 상무 · 대표: 결정 요청 + 내 담당 */
  mine.forEach(i=>{i.i=info(i.x);i.brand=i.i.brand;i.bc=BRAND[i.brand]||'#6b7280';i.act=team?(ACT_TEAM[i.rk]||'코멘트'):(ACT_REP[i.rk]||'전화');if(role!=='rep'&&role!=='mgr'&&role!=='lead'&&i.x.owner===me)i.act=ACT_REP[i.rk]||'전화';i.done=DONE[i.act]||DONE['전화'];i.loss=LOSS[i.rk];i.sName=(COLS.find(c=>c[0]===i.st)||[])[1]||'';});
  return {teamItems,mine};
 }
 /* AI 첫마디(기존 call_opener · 제안만): 영업사원 카드에서 누를 때만 부른다 */
 const AIO=new Map(),AIB=new Set();
 function line(i,role,me){
  const team=TEAM(role)&&i.x.owner!==me;
  const ai=AIO.get(i.key);if(!team&&ai&&ai.opener)return ai.opener;
  if(team){const who=given(i.x.owner);return (who?who+'님, ':'')+i.i.site.replace(/^\[[^\]]+\]\s*/,'')+' 건 — '+i.missTxt+'. 오늘 중 처리하고 결과 남겨 주세요.';}
  const topic=cut(i.x.type==='inq'?(i.i.want||'견적'):(i.i.goal||i.i.want||''),26);
  return '안녕하세요, 넷폼 '+(root.ME&&root.ME.name||'')+'입니다. '+(i.x.type==='inq'?'문의 주신 '+topic+' 건으로 연락드렸습니다.':(topic?topic+' 건으로 ':'')+'연락드렸습니다.')+' 지금 통화 괜찮으실까요?';
 }
 /* ── 오른쪽: 일정 · 마감 · 기준 ── */
 function timeOf(x){try{const act=x.type==='deal'?root.actionObj(x.item,root.itemPatch(x.item,'deal')):null,v=String(act&&(act.scheduled_at||act.scheduledAt||act.due_at||act.due)||''),m=/T(\d{2}):(\d{2})/.exec(v);if(!m||(m[1]==='00'&&m[2]==='00'))return '';return m[1]+':'+m[2];}catch(e){return '';}}
 function sched(rows,mine,team){
  const byKey=new Map(mine.map(i=>[i.key,i]));
  return rows.filter(x=>x.dueDays===0&&!x.unassigned).map(x=>{const i=byKey.get(x.key),t=timeOf(x),kind=(()=>{let ty='';try{const a=x.type==='deal'?root.actionObj(x.item,root.itemPatch(x.item,'deal')):null;ty=String(a&&a.type||'');}catch(e){}return /방문|실사|실측|미팅|현장/.test(ty+' '+String(x.next||''))?'현장 방문':'통화 약속';})();return {t:t||'오늘',kind:(team?given(x.owner)+' · ':'')+kind,site:x.item.site||x.item.site_name||'',note:cut(x.next||'',40),risk:i?i.missTxt+(i.short&&!/^0일$/.test(i.short)?' · '+i.short:''):'',visit:kind==='현장 방문',key:x.key};}).sort((a,b)=>(a.t==='오늘'?'99':a.t).localeCompare(b.t==='오늘'?'99':b.t)).slice(0,8);
 }
 function dues(mine){return mine.filter(i=>i.deadline&&i.deadline.n>=0&&i.deadline.n<=7).sort((a,b)=>a.deadline.n-b.deadline.n).slice(0,6).map(i=>({dd:'D-'+i.deadline.n,site:i.i.site,what:i.deadline.what+' '+md(i.deadline.date)+(TEAM(root.G._towerRole)&&i.x.owner?' · '+i.x.owner:''),hot:i.deadline.n<=3}));}
 function weekMetrics(X,role){
  const me=root.repN(root.ME&&root.ME.name),team=TEAM(role),now=new Date(),mon=new Date(now);mon.setDate(mon.getDate()-((mon.getDay()+6)%7));mon.setHours(0,0,0,0);
  const inWeek=v=>{const t=Date.parse(v||'');return Number.isFinite(t)&&t>=mon.getTime();};
  const own=d=>team||root.repN(d.assignee)===me;
  const Q=(X.Q||[]).filter(q=>{try{return team||root.repN(root.inquiryRoutedOwner(q))===me;}catch(e){return team;}});
  const wq=Q.filter(q=>{try{return inWeek(root.inquiryCreatedAt(q));}catch(e){return false;}});
  const fast=wq.filter(q=>{try{const c=Date.parse(root.inquiryCreatedAt(q)),f=Date.parse(root.inqCtlFirstResponseAt(q)||'');return Number.isFinite(f)&&f-c<=FIRST_HOURS()*3600e3;}catch(e){return false;}}).length;
  const D=(X.D||[]).filter(d=>{try{return root.isOpen(d)&&own(d);}catch(e){return false;}});
  const withNext=D.filter(d=>{try{const a=root.actionObj(d,root.itemPatch(d,'deal'));return !!(a&&a.text&&a.due);}catch(e){return false;}}).length;
  const contacted=D.filter(d=>{try{return inWeek(root.salesActivityAt(d));}catch(e){return false;}}).length;
  const reps=team?Math.max(1,new Set(D.map(d=>root.repN(d.assignee)).values()).size):1,goal=WEEK_GOAL()*reps;
  const pct=(a,b)=>b?Math.round(a*100/b):null;
  const r1=pct(fast,wq.length),r2=pct(withNext,D.length);
  return [
   {label:'첫 응답 완료율 ('+FIRST_HOURS()+'시간 안)',v:r1===null?'이번 주 문의 없음':r1+'%',pct:r1||0,bad:r1!==null&&r1<90,goal:'기준 90% · 이번 주 '+wq.length+'건 중 '+fast+'건'},
   {label:'다음 행동 등록률',v:r2===null?'진행 건 없음':r2+'%',pct:r2||0,bad:r2!==null&&r2<95,goal:'기준 95% 이상 · 진행 '+D.length+'건 중 '+withNext+'건'},
   {label:(team?'팀 ':'')+'이번 주 연락',v:contacted+' / '+goal+'곳',pct:Math.min(100,goal?contacted*100/goal:0),bad:contacted<goal*0.3,goal:'목표 '+goal+'곳(설정값) · 월요일부터 활동이 기록된 현장 수'}];
 }
 /* ── 그리기 ── */
 function html(X,rows){
  const S=st(),role=roleOf(X),team=TEAM(role),me=root.repN(root.ME&&root.ME.name);root.G._towerRole=role;
  const M=model(X,rows,role),all=M.mine;
  /* 7칸: 전체 건수(열려 있는 것) · 놓침 */
  const openD=(X.D||[]).filter(d=>{try{return root.isOpen(d)&&(team||root.repN(d.assignee)===me);}catch(e){return false;}});
  const colTotal=c=>c==='inq'?(X.Q||[]).filter(q=>{try{return team||root.repN(root.inquiryRoutedOwner(q))===me;}catch(e){return team;}}).length:openD.filter(d=>{try{return (COL_OF[root.dealStage(d)]||'cons')===c;}catch(e){return false;}}).length;
  const missSrc=(role==='vp'||role==='ceo'||role==='mgr'||role==='lead')?M.teamItems:all;
  const missLabel=(role==='vp'||role==='ceo')?'팀 놓침 ':'지금 확인 ';
  const inStage=all.filter(i=>!S.stage||i.st===S.stage);
  const list=inStage.filter(i=>(S.reason==='all'||i.rk===S.reason)&&(!S.urg||i.urg===S.urg)&&(!S.brand||i.brand===S.brand));
  const eok=i=>i.amt||0;
  const cards=list.filter(i=>i.urg==='now').sort((a,b)=>tier(a)-tier(b)||(a.deadline&&b.deadline?a.deadline.n-b.deadline.n:0)||eok(b)-eok(a)||b.days-a.days).slice(0,3);
  const onCard=new Set(cards.map(i=>i.key)),rest=list.filter(i=>!onCard.has(i.key));
  const nowN=all.filter(i=>i.urg==='now').length;
  const title=role==='rep'?'오늘 <span class="tt-b">일정 '+sched(rows,all,false).length+'건</span> · <span class="tt-r">긴급 '+nowN+'건</span>':h(({mgr:'매출이 막힌 곳',lead:'팀장 판단 + 팀 전체',vp:'결정 + 내 영업',ceo:'최고 결정'})[role])+' · <span class="tt-r">긴급 '+nowN+'건</span>';
  const subTail={rep:'. 그다음 중요 → 관리 순 · 12시까지 결과와 다음 행동을 업데이트하세요.',mgr:'. 진행이 멈춘 곳을 담당자에게 요청해 움직입니다. 입찰 마감 · 사고 · 승인은 팀장 영역이라 여기서 다루지 않습니다.',lead:'. 팀 전체 놓침 + 팀장 판단(마감 · 재배정 · 지원 요청) + 내 담당 영업입니다.',vp:'. 지원 · 결정 요청과 내 담당 영업입니다. 팀 진행은 위 칸에서 봅니다.',ceo:'. 결정 요청만 올립니다. 팀 진행은 위 칸 · 담당자 줄에서 봅니다.'}[role];
  const sub='긴급 '+nowN+'건 = 위 카드 '+cards.length+' + 아래 「긴급 · 나머지」 '+Math.max(0,list.filter(i=>i.urg==='now').length-cards.length)+subTail;
  const roles='';
  const stages='<section class="tt-stages"><header><b>'+(role==='mgr'?'매출 흐름 · 막힌 구간':team?'팀 파이프라인 상태':'내 파이프라인 상태')+'</b><span>'+(team?'팀 전체 · 놓침이 몰린 단계가 매출이 멈춘 곳 · 누르면 그 단계만 봅니다':'내 담당 건만 집계 · 누르면 그 단계에서 확인할 것만 봅니다')+'</span><i></i><button type="button" data-tt="stage" data-v="" aria-pressed="'+(!S.stage)+'">전체 단계</button></header><div class="tt-cells">'
   +COLS.map(c=>{const total=colTotal(c[0]),miss=missSrc.filter(i=>i.st===c[0]).length;return '<button type="button" class="tt-cell'+(miss?' miss':'')+'" data-tt="stage" data-v="'+c[0]+'" aria-pressed="'+(S.stage===c[0])+'"><span class="n">'+h(c[1])+'</span><span class="t"><b>'+total+'</b><small>'+(team?'건':'건 담당')+'</small></span><span class="m">'+(miss?missLabel+miss:'정상')+'</span><span class="r">'+h(c[2])+'</span></button>';}).join('')+'</div></section>';
  let strip='';
  if(team){const by={};M.teamItems.forEach(i=>{if(S.stage&&i.st!==S.stage)return;const o=i.x.owner||'미배정';(by[o]=by[o]||[]).push(i);});
   const reps=Object.keys(by).filter(o=>o!=='미배정').map(o=>{const arr=by[o],cnt={};arr.forEach(i=>{cnt[i.rk]=(cnt[i.rk]||0)+1;});const neck=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0];return {n:o,miss:arr.length,neck:neck?R[neck][0]+' '+cnt[neck]:''};}).sort((a,b)=>b.miss-a.miss).slice(0,8);
   strip=reps.length?'<section class="tt-reps">'+reps.map(p=>'<button type="button" class="tt-rep" data-tt="owner" data-v="'+attr(p.n)+'"><span><b>'+h(p.n)+'</b><small>병목 · '+h(p.neck)+'</small></span><i></i><b class="'+(p.miss>=30?'r':'')+'">'+p.miss+'</b><small>놓침</small></button>').join('')+'</section>':'';}
  const urgN=k=>inStage.filter(i=>i.urg===k&&(!S.brand||i.brand===S.brand)).length;
  const chips='<div class="tt-filter"><b>'+(S.stage?h((COLS.find(c=>c[0]===S.stage)||[])[1])+'에서 놓친 것':'지금 처리할 것')+'</b>'
   +[['now','긴급','#d93a3a'],['today','중요','#e8590c'],['week','관리','#d4a017']].map(u=>'<button type="button" class="tt-chip" data-tt="urg" data-v="'+u[0]+'" aria-pressed="'+(S.urg===u[0])+'"><i style="background:'+u[2]+'"></i>'+u[1]+' <span>'+urgN(u[0])+'</span></button>').join('')
   +'<span class="tt-sep"></span><select class="tt-reason" data-tt="reason" aria-label="이유"><option value="all">전체 '+inStage.length+'</option>'+Object.keys(R).filter(k=>inStage.some(i=>i.rk===k)).map(k=>'<option value="'+k+'"'+(S.reason===k?' selected':'')+'>'+h(R[k][0])+' '+inStage.filter(i=>i.rk===k).length+'</option>').join('')+'</select><i class="tt-sp"></i>'
   +'<div class="tt-brands">'+[null,...Object.keys(BRAND)].map(b=>{const n=b?inStage.filter(i=>i.brand===b).length:inStage.length;if(b&&!n)return '';return '<button type="button" class="tt-chip" data-tt="brand" data-v="'+attr(b||'')+'" aria-pressed="'+(S.brand===b)+'"><i style="background:'+(b?BRAND[b]:'#15171c')+'"></i>'+h(b||'전체 브랜드')+' <span>'+n+'</span></button>';}).join('')+'</div></div>';
  const fold=team?'담당에게 보낼 말 · 놓치면':'첫마디 · 놓치면';
  const b2=team?'재배정':'문자',b3=team?'담당 화면':'결과 기록';
  const cardHtml=(i,n)=>{const open=!!S.open[i.key],k=attr(i.key),c=R[i.rk][1],own=i.x.owner===me;return '<article class="tt-card" data-key="'+k+'" style="--c:'+c+';--bc:'+i.bc+'"><header><i class="no">'+(n+1)+'</i><b>'+h(i.missTxt+(i.rk!=='decide'&&(i.rk==='deadline'||/^\d+일$/.test(i.short))?' · '+i.short:''))+'</b><span class="src'+(i.st==='inq'?' inq':'')+'">'+(i.st==='inq'?'견적문의':'파이프라인 · '+h(i.sName))+'</span></header>'
   +'<div class="who"><b class="brand">'+h(i.brand||'브랜드 미입력')+'</b><strong>'+h(i.i.site)+'</strong><span>'+h([(team&&!own?'담당 '+i.x.owner:''),[i.i.name,i.i.role].filter(Boolean).join(' '),i.i.phone].filter(Boolean).join(' · ')||'연락처 미입력')+'</span></div>'
   +'<dl><dt>원한 것</dt><dd>'+h(i.i.want||'기록 없음')+'</dd><dt>지난 기록</dt><dd>'+h(i.support?'[지원 요청] '+cut(i.support.note,60):i.i.recent||'기록 없음')+'</dd><dt>금액</dt><dd>'+h(i.amt?money(i.amt):'-')+'</dd></dl>'
   +'<button type="button" class="fold" data-tt="fold" data-key="'+k+'">'+fold+'<i></i><span>'+(open?'접기 ▴':'펼치기 ▾')+'</span></button>'
   +(open?'<div class="open"><p>“'+h(line(i,role,me))+'”'+(!(team&&!own)&&root.OpsStore&&root.OpsStore.aiOn()?(AIO.has(i.key)?' <em class="ai">AI</em>':' <button type="button" class="ai" data-tt="ai" data-key="'+k+'"'+(AIB.has(i.key)?' disabled':'')+'>'+(AIB.has(i.key)?'AI…':'✦ AI 첫마디')+'</button>'):'')+'</p><span><b>놓치면</b> '+h(i.loss)+'</span></div>':'')
   +'<span class="done"><b>완료 기준</b> '+h(i.done)+'</span>'
   +'<div class="btns"><button type="button" class="main" data-tt="act" data-key="'+k+'" data-act="'+attr(i.act)+'"'+(i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>'+h(i.act)+'</button><button type="button" data-tt="'+(team&&!own?'reassign':'sms')+'" data-key="'+k+'">'+(team&&!own?b2:'문자')+'</button><button type="button" data-tt="'+(team&&!own?'owner':'result')+'" data-key="'+k+'" data-v="'+attr(i.x.owner||'')+'">'+(team&&!own?b3:'결과 기록')+'</button></div></article>';};
  const cardsHtml=cards.length?'<div class="tt-cards">'+cards.map(cardHtml).join('')+'</div>':(list.length?'':'<div class="tt-empty">이 조건에 놓친 건이 없습니다.</div>');
  const rowHtml=i=>{const k=attr(i.key),own=i.x.owner===me,red=R[i.rk][1]==='#d93a3a';const tail=[(team&&!own?i.x.owner:''),i.i.want,i.amt?money(i.amt):''].filter(Boolean).join(' · ');
   const anchor=i.x.type==='inq'&&i.dLabel==='접수 후'?(i.x.recent||'첫 연락 없음'):(i.support?'[지원 요청] '+cut(i.support.note,40):i.i.recent||'기록 없음');
   return '<div class="tt-row" role="button" tabindex="0" data-tt="open" data-key="'+k+'"><span class="bd" style="background:'+i.bc+'">'+h(i.brand||'미입력')+'</span><span class="c site"><b>'+h(i.i.site)+'</b><small>'+h(tail)+'</small></span><span class="c"><b'+(red?' class="r"':'')+'>'+h(i.missTxt)+'</b><small>'+h(anchor)+'</small></span><span class="d"><b'+(red?' class="r"':'')+'>'+h(i.short)+'</b><small>'+h(i.rk==='deadline'?'마감':i.dLabel)+'</small></span><button type="button" data-tt="act" data-key="'+k+'" data-act="'+attr(i.act)+'"'+(i.i.digits?' data-tel="'+attr(i.i.digits)+'"':'')+'>'+h(i.act)+'</button></div>';};
  const sIdx=k=>COLS.findIndex(c=>c[0]===k);
  const nowRows=rest.filter(i=>i.urg==='now').sort((a,b)=>sIdx(a.st)-sIdx(b.st)||b.days-a.days),weekRest=rest.filter(i=>i.urg!=='now');
  let groups='';
  if(nowRows.length)groups+='<div class="tt-ghead red"><i>긴급</i><b>긴급 · 나머지</b><span>'+nowRows.length+'건</span><em>기준 · 카드 다음 순서 · 단계 순</em></div>'+nowRows.map(rowHtml).join('');
  if(weekRest.length){groups+='<div class="tt-ghead grey"><i>↓</i><b>중요 · 관리</b><span>'+weekRest.length+'건</span><em>단계 순서 · 각 단계 안에서 중요 먼저</em></div>';
   COLS.forEach((c,ci)=>{const arr=weekRest.filter(i=>i.st===c[0]).sort((a,b)=>(a.urg==='today'?0:1)-(b.urg==='today'?0:1)||b.days-a.days);if(!arr.length)return;const open=!!S.ex[c[0]],shown=open?arr:arr.slice(0,5);
    groups+='<div class="tt-ghead"><i>'+(ci+1)+'</i><b>'+h(c[1])+'</b><span>'+arr.length+'건</span><em>기준 · '+h(c[2])+'</em></div>'+shown.map(rowHtml).join('')+(arr.length>5?'<button type="button" class="tt-more" data-tt="more" data-v="'+c[0]+'">'+(open?'접기 ▴':'나머지 '+(arr.length-5)+'건 더 보기 ▾')+'</button>':'');});}
  const listHtml=rest.length?'<div class="tt-list">'+groups+'<footer><span>놓친 '+list.length+'건 · 카드 '+cards.length+'건 + 목록 '+rest.length+'건</span></footer></div>':'';
  /* 오른쪽 */
  const sc=sched(rows,all,team),du=dues(all),wk=weekMetrics(X,role);
  const right='<aside class="tt-side"><section><header><b>'+(team?'오늘 팀 일정':'오늘 일정')+'</b><span>지금 '+new Date().toTimeString().slice(0,5)+'</span></header>'+(sc.length?sc.map(e=>'<div class="tt-ev'+(e.visit?' visit':'')+'" role="button" tabindex="0" data-tt="open" data-key="'+attr(e.key)+'"><b class="t">'+h(e.t)+'</b><i></i><div><small>'+h(e.kind)+'</small><b>'+h(e.site)+'</b><span>'+h(e.note)+'</span>'+(e.risk?'<em>'+h(e.risk)+'</em>':'')+'</div></div>').join(''):'<p class="tt-none">오늘 날짜로 잡힌 일정이 없습니다</p>')+'</section>'
   +'<section><header><b>'+(team?'이번 주 팀 마감':'이번 주 다가오는 마감')+'</b></header>'+(du.length?du.map(d=>'<div class="tt-due"><span class="'+(d.hot?'hot':'')+'">'+h(d.dd)+'</span><div><b>'+h(d.site)+'</b><small>'+h(d.what)+'</small></div></div>').join(''):'<p class="tt-none">7일 안 마감(입찰 · 결정 일정)이 없습니다</p>')+'</section>'
   +'<section><header><b>'+(team?'팀 이번 주 기준':'내 이번 주 기준')+'</b></header>'+wk.map(w=>'<div class="tt-wk"><div><span>'+h(w.label)+'</span><b class="'+(w.bad?'r':'')+'">'+h(w.v)+'</b></div><div class="bar"><i style="width:'+Math.round(w.pct)+'%;background:'+(w.bad?'#d93a3a':'#9aa0ab')+'"></i></div><small>'+h(w.goal)+'</small></div>').join('')+'</section></aside>';
  const who=role==='rep'?given(me)+'님':{mgr:'영업관리 · 팀 전체',lead:'팀장 · 팀 전체 + 내 영업',vp:'상무 · 결정 + 내 영업',ceo:'대표 · 최고 결정'}[role];
  const d=new Date(),dateTxt=(d.getMonth()+1)+'월 '+d.getDate()+'일 '+'일월화수목금토'[d.getDay()]+'요일';
  return '<div class="tt" data-role="'+role+'" data-urgent="'+nowN+'"><div class="tt-head"><h1>'+title+'</h1><span class="tt-sub">'+h(sub)+'</span><span class="tt-who">'+h(who+' · '+dateTxt)+'</span>'+roles+'</div>'+stages+strip+'<div class="tt-body"><div class="tt-main">'+chips+cardsHtml+listHtml+'</div>'+right+'</div></div>';
 }
 /* ── 동작: 열기 · 전화 · 문자 · 담당 화면 — 전부 기존 경로 ── */
 function dial(digits){if(!digits){if(typeof root.toast==='function')root.toast('전화번호가 없습니다 — 상세에서 연락처를 등록해 주세요','warn');return;}const a=document.createElement('a');a.href='tel:'+digits;a.style.display='none';document.body.append(a);a.click();a.remove();}
 function openKey(key,action){return T().open(key,action);}
 function onClick(e){
  const b=e.target.closest('#today-v2 .tt [data-tt]');if(!b)return;e.stopPropagation();const S=st(),a=b.dataset.tt,v=b.dataset.v,key=b.dataset.key,rerender=()=>root.TodayV2.render();
  if(a==='stage'){S.stage=v&&S.stage!==v?v:null;S.reason='all';return rerender();}
  if(a==='urg'){S.urg=S.urg===v?null:v;return rerender();}
  if(a==='brand'){S.brand=v&&S.brand!==v?v:null;return rerender();}
  if(a==='more'){S.ex[v]=!S.ex[v];return rerender();}
  if(a==='fold'){S.open[key]=!S.open[key];return rerender();}
  if(a==='owner'){if(root.CommonFilterBar)root.CommonFilterBar.setOwner(v);else root.G.todayQueueOwner=v;return root.paint();}
  if(a==='ai'){if(AIB.has(key))return;const X=T().data(),M=model(X,X.rows,root.G._towerRole||'rep'),i=M.mine.find(m=>m.key===key);if(!i)return;AIB.add(key);rerender();
   root.OpsStore.ai('call_opener',i.x.type==='inq'?'inquiry':'deal',i.x.item.id||key,{caller:root.ME&&root.ME.name||'',company:'넷폼',site:i.i.site,contact:[i.i.name,i.i.role].filter(Boolean).join(' '),stage:i.sName,want:i.i.want,recent:i.x.recent||'',goal:i.x.next||''}).then(s=>{AIO.set(key,s.suggestion||{});}).catch(err=>{if(typeof root.toast==='function')root.toast(String(err.message||err),'warn');}).finally(()=>{AIB.delete(key);rerender();});return;}
  if(a==='reassign')return openKey(key);
  if(a==='result')return openKey(key,'contact');
  if(a==='sms'){openKey(key);setTimeout(()=>{const tab=document.querySelector('dialog[open] [data-idv="tab"][data-v="sms"], .inq-dialog [data-idv="tab"][data-v="sms"]');if(tab)tab.click();else if(root.InquiryDetailV2&&root.InquiryDetailV2.openSms&&root.InquiryDetailV2.openSms()){/* 문의 = 상세의 문자 작은 창 */}else if(root.CUR_DETAIL&&root.CUR_DETAIL.kind==='deal'&&typeof root.contactSms==='function')root.contactSms();},400);return;}
  if(a==='act'){const act=b.dataset.act;if(act==='전화'){dial(b.dataset.tel);return openKey(key,'contact');}if(act==='다음 할 일')return openKey(key,'next');if(['독촉','코멘트','결과 기록','정기 연락','관계 연락','현장 확인'].includes(act))return openKey(key,'contact');return openKey(key);}
  if(a==='open'&&!e.target.closest('button'))return openKey(key);
 }
 function onChange(e){const s=e.target.closest('#today-v2 .tt select[data-tt="reason"]');if(!s)return;st().reason=s.value;root.TodayV2.render();}
 document.addEventListener('click',onClick,true);
 document.addEventListener('change',onChange,true);
 document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('#today-v2 .tt [data-tt="open"]')){e.preventDefault();openKey(e.target.dataset.key);}});
 root.TodayTower={enabled,html,classify,roleOf,model,COLS,R,_sched:sched,_dues:dues,_week:weekMetrics,_line:line,_acts:{rep:ACT_REP,team:ACT_TEAM,done:DONE},_big:BIG};/* 밑줄 항목은 오늘 업무 v3(today-v3.js)가 쓴다 */
})(window);
