/* Approved Claude A/B/C markup + existing account scope. No retired UI fallback. */
(function(w){
 'use strict';
 const S={q:'',stage:'',page:1,pendingPage:1,scroll:0,returnTab:'mine',area:'now',entryAction:'',scheduleDay:'',schedulePage:1,newQuery:'',selectedSite:'',registrationPage:1,registrationOwner:'',registrationError:'',closePages:{done:1,open:1,tomorrow:1},detailView:'',evidencePage:1,v5more:false,v5page:1};
 /* 2026-10-22 회의록 10/2 '과거 이관 정체 건': PC 와 같은 기준(PipelineScope — 열려 있는데 현재 CRM 단계 값이 아닌 건)으로 과거 이관 · 분류 전 건은
    모바일 목록 · 오늘 · 기록 보완 · 일정에서 뺀다. 재개는 PC 파이프라인 [과거 이관]. 끄기 G.mobileScopeOff(=예전처럼 전부 보임) */
 const legacyM=d=>{const P=w.PipelineScope;if(!P||!P.on()||(w.G&&w.G.mobileScopeOff)||!d||d.outcome)return false;try{return P.isLegacy({code:d.stage_code!=null&&d.stage_code!==''?d.stage_code:d.code,stage_code:d.stage_code,outcome:d.outcome});}catch(e){return false;}};
 const mineAll=()=>w.myDeals?w.myDeals():[];
 const mine=()=>mineAll().filter(d=>!legacyM(d));
 const legacyCount=()=>mineAll().filter(legacyM).length;
 /* 2026-10-22 대표 "실주는 최대한 안 보이게 · 실주 칸을 누르면 내용": '전체'에서는 실주 묶음(실주 · 배드핏 · 미연락 — PipelineStages 'lost')을 빼고
    목록 끝 [실주 n건 ›] 칸 하나만. 누르면 실주 칩(S.stage='lost')으로 바뀌어 사유 · 종료일이 보인다. 검색어가 있으면 실주도 같이 찾는다. 끄기 G.mobileLostHideOff */
 const lostM=d=>!!d.outcome&&w.PipelineStages?.group(d.code,d.outcome)==='lost';
 const lostHide=()=>!(w.G&&w.G.mobileLostHideOff);
 const lostCount=()=>mine().filter(lostM).length;
 /* 끝난 건 오른쪽 글: 실주 = 사유(없으면 '사유 미입력'), 수주 = '수주'(사유를 요구하지 않음 — 2026-10-23 02 '종료 건에 경고를 달지 않는다') */
 const closedTask=d=>{const r=String(d.close_reason||'').replace(/\s+/g,' ').trim();if(!r&&String(d.outcome)==='won')return '수주';return r?(r.length>22?r.slice(0,21)+'…':r):'사유 미입력';};
 const closedDue=d=>{const s=String(d.closed_at||d.won_at||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?'종료 '+s.slice(5).replace('-','.'):'종료';};
 const inquiries=()=>Array.isArray(w.ADMIN?.inquiries)?w.ADMIN.inquiries:[];
 const inquiry=id=>inquiries().find(q=>String(q.key||q.id||q.inquiry_id||'')===String(id));
 const next=d=>d?.nextAction?.status==='open'?d.nextAction:null;
 const label=d=>w.PipelineStages?.definition(w.PipelineStages.group(d.code,d.outcome))?.label||w.stageLabel(d.code);
 const work=d=>w.dealWorkSummaryM?w.dealWorkSummaryM(d):d.work_type||'';
 const brand=d=>d.brand||w.bizOf?.(d)||'';
 const colors={'석민이앤씨':'#e8590c','POUR솔루션':'#1f9d55','POUR공법':'#7048e8','아파트스퀘어':'#3b6ce4'};
 const color=d=>colors[brand(d)]||'#9ca3af';
 const unavailable=()=>w.toast('이 화면은 Claude 원본 연결 작업 중입니다.');
 const due=d=>{const n=w.dueDays?.(d),x=next(d);return !x?'다음 업무 미등록':n==null?'기한 미입력':n<0?Math.abs(n)+'일 지남':n===0?'오늘까지':w.ContactEntry.md(x.due||x.due_at);};
 const dueColor=d=>w.dueDays?.(d)<0?'#b42318':'#15171c';
 const listScroller=()=>w.document.querySelector('.approved-list');
 let requestRead=null,requestReadOwner='',pcRedirected=false,taskClick=0;
 const requestOwner=()=>{const p=w.Phase1?.profile;return p?.auth_uid&&p?.user_id?p.auth_uid+':'+p.user_id+':'+(w.MobileSaveJournal?.session?.()||''):'';};
 function loadRequests(){
  const owner=requestOwner();
  if(!owner||!w.G?.user||w.G.mode!=='rep'||(!w.LIVE&&!w.DEMO)||typeof w.MobileRequests?.load!=='function')return Promise.resolve();
  if(requestRead&&requestReadOwner===owner)return requestRead;
  requestReadOwner=owner;
  const job=Promise.resolve().then(()=>w.MobileRequests.load()).catch(()=>{});
  requestRead=job;job.finally(()=>{if(requestRead===job)requestRead=null;});return job;
 }
 /* labels = 상세 '영업 조건'(J-1)에서 열 때 그 화면의 확인 항목 — 결과 화면 '확인할 것 · 영업 조건에서'로 이어받는다. 그 밖의 진입은 지운다 */
 async function openContact(labels){
  const owner=requestOwner(),id=String(w.G?.deal||'');
  w.MobileV5Result?.setFocus?.(labels&&labels.length?id:'',labels||null);
  await loadRequests();
  if(owner!==requestOwner()||w.G?.mode!=='rep'||String(w.G.deal||'')!==id||!mine().some(d=>String(d.id)===id))return;
  w.MobileEntry.open();
 }
 const conditionLabels=()=>{const d=mine().find(x=>String(x.id)===String(w.G?.deal));try{return d&&w.MobileStageConfirmationModel?.read(d).checks.map(c=>c.label)||[];}catch(e){return [];}};
 async function openRequestedTask(id,requestId,click){
  const owner=requestOwner(),tab=w.G.tab,deal=w.G.deal;
  if(!mine().some(d=>String(d.id)===id)||!w.MobileRequests?.forDeal(id)?.some(r=>r.id===requestId))return w.toast('현재 현장에 연결된 요청을 다시 확인해 주세요.');
  let failure='';
  try{
   if(typeof w.MobileRequests?.acknowledge!=='function')throw Error('요청 확인 연결을 불러오지 못했습니다.');
   const result=await w.MobileRequests.acknowledge(requestId,'deal',id);
   if(result!==true)throw Error('요청 확인 결과를 확인하지 못했습니다.');
  }catch(e){failure=String(e?.message||e);}
  if(click!==taskClick||owner!==requestOwner()||w.G.mode!=='rep'||w.G.tab!==tab||w.G.deal!==deal||!mine().some(d=>String(d.id)===id))return;
  w.G.deal=id;run();if(failure)w.toast('요청 확인 실패 · '+failure);
 }
 function mobileMode(){
  if(!w.G?.user||(!w.LIVE&&!w.DEMO)||w.G.mode==='rep')return true;
  if(w.Phase1?.profile?.allowed_modes?.includes('rep')){w.G.mode='rep';w.G.sub=null;return true;}
  w.MobileApprovedBoot?.hold();
  if(!pcRedirected){pcRedirected=true;w.location.assign('./?view=pc');}
  return false;
 }
 function registrationContext(){
  const api=w.MobileRegistrationContext,owner=w.MobileSaveJournal?.owner()||'';
  if(S.registrationOwner!==owner){
   S.registrationOwner=owner;S.newQuery='';S.selectedSite='';S.registrationError='';S.entryAction='';
   try{const draft=api?.loadDraft();S.newQuery=draft?.query||'';S.selectedSite=draft?.selectedId||'';}catch(e){S.registrationError=String(e.message||e);}
  }
  try{return api?.read(S.newQuery)||{ok:false,rows:[],unlinkedCount:null};}catch(e){S.registrationError=String(e.message||e);return {ok:false,rows:[],unlinkedCount:null};}
 }
 function registrationOwnerMatches(){
  const owner=w.MobileSaveJournal?.owner()||'';
  if(owner&&owner===S.registrationOwner)return true;
  registrationContext();run();w.toast('계정이 변경되어 현재 계정의 입력을 다시 불러왔습니다.');return false;
 }
 function registration(){
  if(typeof w.MobileApprovedEJSource?.E!=='string')return '';
  const m=registrationContext(),count=m.rows?.length||0;
  const similarLabel=S.registrationError?'입력 보관 상태 확인 필요':!m.ok?'비슷한 현장 확인 필요':S.newQuery.trim().length<2?'현장 이름 입력 후 후보 확인':'내 조회 범위의 현장 후보 '+count+'곳'+(m.unlinkedCount?' · 현장 연결 확인 '+m.unlinkedCount+'건':'');
  return w.MobileApprovedEJ?.renderE({query:S.newQuery,similarLabel})||'';
 }
 function registrationMatches(){
  if(typeof w.MobileApprovedEJSource?.['J-4']!=='string')return '';
  const m=registrationContext(),pg=w.ListPager.cut(m.rows||[],S.registrationPage);S.registrationPage=pg.page;
  const note=S.registrationError?'입력 임시 보관 실패 · 화면의 내용은 유지됩니다. 다시 입력하거나 선택해 보관을 재시도해 주세요.':!m.ok?'현장 후보를 확인하지 못했습니다. 입력한 내용은 유지합니다.':
   '내 조회 범위의 이름·주소 후보 · 같은 현장과 같은 공사는 다릅니다. 공사 등록 전 자동 병합·알림 없음.';
  return w.MobileApprovedEJ?.renderJ4({query:S.newQuery,rows:pg.rows,selectedId:S.selectedSite,similarLabel:m.ok?'비슷한 현장 '+(m.rows||[]).length+'곳 · 내 조회 범위':'현장 후보 확인 필요',note,pager:w.ListPager.html(pg,{ns:'registration',unit:'곳'})})||'';
 }
 function schedule(){
  if(typeof w.MobileApprovedFSource!=='string'||typeof w.MobileScheduleModel?.read!=='function')return '';
  const m=w.MobileScheduleModel?.read({selectedDay:S.scheduleDay||undefined,now:w.__approvedScheduleNow});
  return w.MobileApprovedF?.render(m,{page:S.schedulePage})||'';
 }
 const guideOn=(d,x,i)=>x.auto?!!w.stageGuideAutoM(d,x.auto):!!((d.stage_checklist||{})[d.code]||{})[i];
 function dayData(){
  const rows=w.G._today||w.buildToday(),mk=x=>({nm:x.nm,what:x.why||x.sub||''});
  const tom=w.DayZoneRules?w.DayZoneRules.kst(Date.now()+864e5):new Date(Date.now()+864e5).toISOString().slice(0,10);/* 한국 날짜(00~09시에 하루 밀리던 것) */
  return {done:rows.filter(x=>w.isDone(x)).map(x=>({nm:x.nm,what:w.doneLabel(x)||'처리 완료'})),open:rows.filter(x=>!w.isDone(x)).map(mk),tomorrow:mine().filter(d=>String(next(d)?.due||next(d)?.due_at||'').slice(0,10)===tom).map(d=>({nm:d.nm,what:next(d).text||'다음 업무'}))};
 }
 function dayText(){
  const t=dayData(),md=w.ContactEntry.md(w.DayZoneRules?w.DayZoneRules.kst():new Date().toISOString().slice(0,10)),ln=(h,a)=>h+' '+a.length+'건'+a.map(x=>'\n- '+x.nm+' · '+x.what).join('');
  return '['+md+' 오늘 마감] '+w.G.user.nm+'\n'+ln('완료',t.done)+'\n'+ln('미완료',t.open)+'\n'+ln('내일',t.tomorrow);
 }
 async function closeDay(){
  const text=dayText();
  try{if(w.navigator.share){await w.navigator.share({text});S.shareState='shared';w.toast('마감 내용을 공유했습니다');}
   else{await w.navigator.clipboard.writeText(text);S.shareState='copied';w.toast('마감 내용을 복사했습니다. 잔디에 붙여 넣어 공유하세요');}}
  catch(e){if(e&&e.name==='AbortError')return;S.shareState='failed';w.toast('공유하지 못했습니다. 다시 눌러 주세요');}
  run();
 }
 function dayClose(){
  if(typeof w.MobileApprovedHSource!=='string')return '';
  const m=w.__approvedHExample||w.MobileDayCloseModel?.read()||{};
  const t=dayData();
  const model={...m,done:{count:t.done.length,rows:t.done.map(x=>({text:x.nm+' · '+x.what}))},open:{count:t.open.length,rows:t.open.map(x=>({text:x.nm+' · '+x.what}))},tomorrow:{count:t.tomorrow.length,rows:t.tomorrow.map(x=>({text:x.nm+' · '+x.what}))},canClose:true,blockedReason:'',shareState:S.shareState||'idle'};
  ['done','open','tomorrow'].forEach(k=>{model[k]={...m[k],page:S.closePages[k]};});
  return w.MobileApprovedH?.render(model)||'';
 }
 const pendingSnapshot=()=>w.MobilePendingModel?.read()||{ok:false,count:null,groups:[]};
 function pending(){
  const names=g=>g.target_type==='inquiry'?inquiry(g.target_id)?.nm:mine().find(d=>String(d.id)===g.target_id)?.nm;
  const snapshot=pendingSnapshot();
  const groups=(snapshot.groups||[]).map(g=>({...g,resume:{...g.resume,allowed:!!g.resume?.allowed&&(g.kind==='contact'?!!names(g):g.kind==='pc_inquiry'&&w.MobileInquiryEntry?.canOpen(inquiry(g.target_id))?.ok===true)}}));
  return w.MobilePendingView.render({...snapshot,groups},{names,page:S.pendingPage});
 }
 function listing(){
  let rows=mine();const needle=S.q.trim().toLocaleLowerCase();
  if(S.stage)rows=rows.filter(d=>w.PipelineStages.group(d.code,d.outcome)===S.stage);
  else if(S.openOnly)rows=rows.filter(d=>w.isOpen?.(d));/* 오늘 요약 '내 담당 ›'에서 옴 = 그 숫자와 같은 조건(진행 중만) */
  else if(lostHide()&&!needle)rows=rows.filter(d=>!lostM(d));/* 전체 = 실주 숨김(목록 끝 [실주 n건 ›] 칸) */
  if(needle)rows=rows.filter(d=>{const c=w.contactInfoM(d);return [d.nm,d.address,d.addr,c.name,c.mobile,c.officeTel,work(d)].join(' ').toLocaleLowerCase().includes(needle);});
  if(w.G.brandF&&w.G.brandF!=='전체')rows=rows.filter(d=>brand(d)===w.G.brandF);
  const pg=w.ListPager.cut(rows,w.ListPager.page(S));S.page=pg.page;
  /* 2026-10-23 02 내 현장: 같은 단지(site_id)에 내 영업건이 여럿이면 줄마다 '같은 단지 n건' — 합치거나 접지 않고 각각 따로 보이되, 묶여 있다는 사실만 알린다(이름 · 주소로는 묶지 않음) */
  /* 셀 때는 목록에 보이는 영업건(과거 이관 · 실주 · 배드핏 제외)끼리만 — 2026-10-23 운영 실측: 이필선 89줄 중 61줄이 '같은 단지 2건'인데 짝은 대부분 숨긴 과거 이관 · 실주 건이었다 */
  const siteN=new Map();mine().filter(d=>!lostM(d)).forEach(d=>{const s=String(d.site_id||d.cleanup_site_id||'');if(s)siteN.set(s,(siteN.get(s)||0)+1);});
  const same=d=>{const n=siteN.get(String(d.site_id||d.cleanup_site_id||''))||0;return n>1?'같은 단지 '+n+'건':'';};
  /* 빈 목록 이유를 나눈다: 불러오는 중 · 조회 실패 · 검색 결과 없음 · 그 단계 없음 · 진행 중 없음 · 담당 없음 */
  const failed=(w.LAST_OPERATIONAL_READ_ERROR||[]).some?.(f=>f.domain==='deal_core');
  const empty=w.MOBILE_TODAY_FIRST?'전체 목록을 불러오는 중입니다.':failed?'영업건을 불러오지 못했습니다. 새로고침해 주세요.':needle?'\''+S.q.trim()+'\' 검색 결과가 없습니다.':S.stage?(w.PipelineStages.definition(S.stage)?.label||'이 단계')+' 영업건이 없습니다.':S.openOnly?'진행 중인 영업건이 없습니다.':mineAll().length?'해당하는 영업건이 없습니다.':'담당 영업건이 없습니다.';
  /* 종료 건(실주 등)은 '다음 업무'가 없다 — 오른쪽 = 종료 사유 · 종료일 */
  return w.MobileApprovedBC.listing({query:S.q,stage:S.stage,empty,filterLabel:w.__approvedBCExample?.filterLabel||'필터',stages:[{key:'',label:'전체'},...w.PipelineStages.definitions.filter(d=>d.key!=='expansion').map(d=>({key:d.key,label:d.label}))],rows:pg.rows.map(d=>({id:d.id,name:d.nm,subtitle:[d.address_dong,work(d),d.construction_year||d.planned_year,label(d),same(d)].filter(Boolean).join(' · '),color:d.outcome&&lostM(d)?'#9ca3af':color(d),task:d.outcome?closedTask(d):next(d)?.text||'다음 업무 확인',due:d.outcome?closedDue(d):due(d),dueColor:d.outcome?'#6b7280':dueColor(d),...(w.__approvedBCExample?.rows?.[d.id]||{})})),pager:w.ListPager.html(pg,{ns:'gs',unit:'건'})});
 }
 function detail(d){
  const c=w.contactInfoM(d),n=next(d),sid=d.site_id||d.cleanup_site_id;
  const siblings=sid?mine().filter(x=>String(x.site_id||x.cleanup_site_id)===String(sid)&&String(x.id)!==String(d.id)):[];
  const activities=(d.activities||[]).slice().sort((x,y)=>String(y.at||y.occurred_at||'').localeCompare(String(x.at||x.occurred_at||'')));
  const contactTask=!n||/전화|통화|연락|회신/.test(n.type||'');
  return w.MobileApprovedBC.detail({name:d.nm,brand:brand(d),color:color(d),stage:label(d),owner:d.rep||'담당 미지정',siblings:siblings.length?'이 단지 영업 '+(siblings.length+1)+'건 · '+siblings.map(work).filter(Boolean).join(' / '):'',task:n?.text||'기존 기록 확인 후 다음 업무 정하기',context:due(d),action:contactTask?'contact':'pending-task',actionLabel:contactTask?'연락 결과 기록':n?.text||'업무 확인',followup:'',contactName:[c.name,c.role].filter(Boolean).join(' · ')||'연락처 확인 필요',phone:c.mobile||c.officeTel||'',history:activities.slice(0,3).map(x=>({meta:[String(x.at||x.occurred_at||'').slice(0,10),x.type].filter(Boolean).join(' · '),note:x.note||x.result||''})),more:[activities.filter(x=>/발송|송부|제출|전달|보냄/.test((x.type||'')+(x.note||''))).length+'건 ›',(()=>{const A=w.stageGuideItemsM?.(d)||[];return A.filter((x,i)=>guideOn(d,x,i)).length+'/'+A.length+' ›';})(),siblings.length+'건 ›',(d.address||d.addr||'').trim()?'지도 보기 ›':'주소 없음'],...(w.__approvedBCExample?.details?.[d.id]||{})});
 }
 function stageConfirmation(d){
  if(typeof w.MobileApprovedJ1Source!=='string'||typeof w.MobileStageConfirmationModel?.read!=='function'||typeof w.MobileApprovedJ1?.render!=='function')return '';
  const example=w.__approvedStage6Example,owner=w.MobileSaveJournal?.owner();
  const approvedExample=w.DEMO===true&&owner&&example?.owner===owner&&example.dealId===String(d.id)?example.confirmation:null;
  const html=w.MobileApprovedJ1.render(approvedExample||w.MobileStageConfirmationModel.read(d));
  /* 2026-10-23 인계 03: 아직 확인 안 된 항목 줄 = 누르면 연락 결과(같은 항목 이어받음). 승인 J-1 줄 모양은 그대로, 누르는 동작만 붙인다 */
  if(approvedExample)return html;
  const box=w.document.createElement('div');box.innerHTML=html;
  box.querySelectorAll('.approved-j1 [data-confirmed="false"]').forEach(row=>{row.dataset.gs='stage-confirmation-item';row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-label',(row.children[1]?.children[0]?.textContent||'확인 항목')+' · 연락 결과에서 확인');});
  return box.innerHTML;
 }
 function detailScreen(d){
  if(S.detailView==='input')return w.MobileInputFlow?.render(d)||'';
  if(S.detailView==='qlive')return w.MobileQuoteLive?.render(d)||'';
  if(S.detailView==='quote')return w.MobileQuoteFlow?.render(d)||'';
  if(S.detailView==='confirmation')return stageConfirmation(d);
  if(S.detailView==='defect')return w.MobileDefect?.render(d)||'';/* 2026-10-22 하자 사진 간이 접수 */
  if(S.detailView==='evidence'){
   if(typeof w.MobileApprovedGJSource?.G!=='string'||typeof w.MobileStageReview?.readG!=='function'||typeof w.MobileApprovedGJ?.renderG!=='function')return '';
   return w.MobileApprovedGJ.renderG(w.MobileStageReview.readG(d,{page:S.evidencePage}));
  }
  if(S.detailView==='transition'){
   if(typeof w.MobileApprovedGJSource?.['J-2']!=='string'||typeof w.MobileStageReview?.readJ2!=='function'||typeof w.MobileApprovedGJ?.renderJ2!=='function')return '';
   return w.MobileApprovedGJ.renderJ2(w.MobileStageReview.readJ2(d));
  }
  return detail(d);
 }
 function resetDetail(options={}){
  if(w.MobileInputFlow?.reset(options)?.ok===false&&!options.force){run();w.toast('임시 보관을 확인하지 못해 현재 입력 화면을 유지합니다.');return false;}
  if(w.MobileQuoteFlow?.reset(options)?.ok===false&&!options.force){run();w.toast('임시 보관을 확인하지 못해 현재 견적 입력을 유지합니다.');return false;}
  S.detailView='';S.evidencePage=1;S.v6histPage=1;w.MobileStageReview?.reset();return true;
 }
 /* six_fixes ③: 오늘 화면 4구역 = PC 와 같은 판정 함수(DayZoneRules) · 같은 이름(오늘 처리 · 기한 초과 · 고객 회신 대기 · 기록 보완) · 한국 날짜.
    예전에는 12건에서 자르고 정규식으로 '회신 대기 · 약속'을 따로 골라 PC 와 숫자가 달랐다. 구역마다 한 쪽 20건 + 쪽 번호 */
 const ZK=['now','late','wait','fix'],ZOLD={waiting:'wait',info:'fix',promise:'now'};
 function zonePrim(d){const x=next(d);return {type:'deal',due:x?String(x.due||x.due_at||''):'',text:x?String(x.text||''):'',actType:x?String(x.type||''):'',waitReason:String(d.waiting_reason||''),waitUntil:String(d.expected_resume_at||d.wake_up_at||d.relationship_hold_until||'')};}
 function zones(){
  const RU=w.DayZoneRules,day=RU.kst(),Z={now:[],late:[],wait:[],fix:[]},R=w.MobileRequests;
  const reqOf=d=>R?.forDeal?.(d.id)?.[0]||null,reqLate=r=>{const t=Date.parse(r&&r.due_at||'');return Number.isFinite(t)&&t<Date.now();};
  /* 문의 첫 연락: 배정 시각 + 기준 시간(PC 와 같은 계산 DayZoneRules.inqLate) — 넘겼으면 기한 초과 */
  const hrs=Number(w.OPS_RULES&&w.OPS_RULES.responseSlaHours)||2,views=(w.ADMIN&&w.ADMIN.inquiries)||[];
  /* 2026-10-23 '배정일 미확인 ≠ 지연': 배정일시가 없는(담당 미배정 · 배정 기록 없음) 문의는 접수 시각으로 지연을 확정하지 않는다 — 오늘 할 일(첫 연락)로만.
     PC inquiryResponseLate 도 이관 기록 확인 대상 · 담당 없음은 지연에서 뺀다. 끄기 G.mobileInqLateStrictOff(=예전처럼 접수 시각으로 판정) */
  (w.buildToday()||[]).filter(t=>t.kind!=='deal').forEach(t=>{const v=views.find(x=>String(x.key)===String(t.ref)),raw=(v&&v.raw)||{},assignedAt=raw.sales_assigned_at||raw.assigned_at||raw.assignedAt||'',known=!!assignedAt&&!(v&&v.done===false),late=(known||(w.G&&w.G.mobileInqLateStrictOff))&&RU.inqLate({assignedAt,createdAt:raw.at||raw.created_at||'',hours:hrs});(late?Z.late:Z.now).push({inq:t,late});});
  mine().filter(d=>w.isOpen?.(d)).forEach(d=>{const p=zonePrim(d),r=reqOf(d);let z=RU.zone(p,day);if(!z&&r)z=reqLate(r)?'late':'now';if(z)Z[z].push({d,p,r,w:z==='wait'||z==='fix'?RU.waiting(p,day):null});});
  Z.late.sort((a,b)=>(a.inq?1:RU.rank('late',a.p,day))-(b.inq?1:RU.rank('late',b.p,day)));Z.now.sort((a,b)=>(a.inq?-1:RU.rank('now',a.p,day))-(b.inq?-1:RU.rank('now',b.p,day)));
  return Z;
 }
 function zoneRow(z,x){
  const RU=w.DayZoneRules;
  if(x.inq){const t=x.inq;return {id:t.ref,kind:t.kind,name:t.nm,brand:'견적문의',color:'#15171c',stage:'견적문의',due:x.late?'첫 연락 기준 넘김':'첫 연락',dueColor:x.late?'#b42318':'#15171c',task:t.why,why:t.sub||'',button:t.call?'전화':'열기'};}
  const d=x.d,p=x.p,n=RU.diff(RU.dayOf(p.due)),r=x.r;
  const due=z==='late'?(n==null?'기한 지남':(-n)+'일 지남'):z==='now'?(RU.isPromise(p)?'오늘 · 약속':'오늘'):z==='wait'?'확인 '+(x.w&&x.w.until?w.ContactEntry.md(x.w.until):''):'—';
  const task=z==='wait'?(x.w&&x.w.reason)||p.text:z==='fix'?(p.text?(x.w&&x.w.indefinite?'대기 확인일 정하기':'다음 할 일 날짜 정하기'):'다음 할 일 등록'):(p.text||'다음 업무 확인');
  const reqTxt=r?[(r.requested_by||'관리자')+' 요청',w.MobileRequests.labelOf(r),w.MobileRequests.dueTxt(r)].filter(Boolean).join(' · '):'';
  return {id:d.id,kind:'deal',name:d.nm,brand:brand(d),color:color(d),stage:label(d),due,dueColor:z==='late'?'#b42318':'#15171c',task,why:reqTxt||(z==='fix'?'기록만 · 평가 제외':z==='wait'?'지연 아님':''),button:z==='wait'?'확인일 변경':z==='fix'?'입력':'처리',requestId:r?r.id:undefined};
 }
 function today(){
  if(!w.DayZoneRules||w.__approvedAExample)return todayOld();/* 승인 시안 예시 화면(검토용)은 예전 그대로 */
  if(w.MobileV5Today&&w.MobileV5Today.on())return todayV5();
  const rows=w.buildToday();w.G._today=rows;
  const Z=zones(),area=ZOLD[S.area]||(ZK.includes(S.area)?S.area:'now'),list=Z[area],P=w.ListPager,pg=P?P.cut(list,S.areaPage||1):{rows:list.slice(0,20),pages:1},done=rows.filter(t=>w.isDone(t)).length,act=Z.now.length+Z.late.length;
  const model={title:w.G.user.nm+'님, 오늘 먼저 '+act+'건',progress:Z.late.length?'기한 초과 '+Z.late.length+'건':done+' / '+(done+act),progressPercent:done+act?done/(done+act)*100:0,areas:ZK.map(k=>w.DayZoneRules.LABEL[k]+' '+Z[k].length),areaKeys:ZK,area,redArea:'late',rows:pg.rows.map(x=>zoneRow(area,x)),message:list.length?'':({now:'오늘 처리할 건이 없습니다.',late:'기한이 지난 건이 없습니다.',wait:'회신을 기다리는 건이 없습니다.',fix:'보완할 기록이 없습니다.'}[area])};
  let html=w.MobileApprovedA.render(model);
  if(P&&pg.pages>1){const box=w.document.createElement('div');box.innerHTML=html;const body=box.firstElementChild.children[1];if(body)body.insertAdjacentHTML('beforeend',P.html(pg,{ns:'gs',unit:'건',small:true}).replace(/data-gs="page"/g,'data-gs="areapage"'));html=box.innerHTML;}
  const snapshot=pendingSnapshot();
  if(snapshot.ok&&snapshot.count===0&&snapshot.unlinked_operations===0)return html;
  const box=w.document.createElement('div');box.innerHTML=html;
  box.firstElementChild.firstElementChild.insertAdjacentHTML('afterend',w.MobilePendingView.banner(snapshot));
  return box.innerHTML;
 }
 /* 모바일 v5 오늘(mobile-v5-today.js): 같은 4구역 판정(zones) → 한 줄 · 맨 위 카드 한 장 · 끝나는 조건 · 다음 한 건. 회신 대기 · 기록 보완은 숫자만, 누르면 그 목록(한 쪽 20건) */
 function todayV5(){
  const V=w.MobileV5Today,rows=w.buildToday();w.G._today=rows;
  const Z=zones(),M=V.model(Z,{next,label,brand,color,inquiry});
  if(!['now','wait','fix'].includes(S.area))S.area='now';
  let zoneRows='';
  if(S.area!=='now'){const list=Z[S.area],P=w.ListPager,pg=P?P.cut(list,S.areaPage||1):{rows:list.slice(0,20),pages:1};zoneRows=pg.rows.map(x=>V.zoneRow(zoneRow(S.area,x))).join('')||'<p class="mv5-empty">'+(S.area==='wait'?'회신을 기다리는 건이 없습니다.':'보완할 기록이 없습니다.')+'</p>';if(P&&pg.pages>1)zoneRows+=P.html(pg,{ns:'gs',unit:'건',small:true}).replace(/data-gs="page"/g,'data-gs="areapage"');}
  /* 관리자: [내 오늘 | 팀] — 팀 = 기획 B(mobile-v5-team.js) */
  const T=w.MobileV5Team&&w.MobileV5Team.on()?w.MobileV5Team:null;
  if(T&&S.v5team){const tb=w.document.createElement('div');tb.innerHTML=T.render(T.model({prim:zonePrim}),S);return tb.innerHTML;}
  /* 모바일 v6 ①: 맨 위 '오늘의 업무 현황' 숫자 칸(mobile-v6.js) — 지금 화면의 같은 자료(zones · mine · 오늘 동선 · 미배정)에서만 센다 */
  const V6=w.MobileV6&&w.MobileV6.on()&&S.area==='now'?w.MobileV6:null;
  const summary=V6?V6.summaryHtml(V6.summary({late:M.lateItems,mine:mine().filter(d=>w.isOpen?.(d)).length,visit:w.MobileRoute?.stopsToday?.().length||0,unassigned:w.MobileV5Team?.canManage?.()?(w.ADMIN?.assign||[]).length:null})):'';
  const box=w.document.createElement('div');box.innerHTML=V.render(M,S,{zoneRows,summary:!!summary});
  if(T)box.querySelector('.mv5-body')?.insertAdjacentHTML('afterbegin','<div class="mv5-seg" role="tablist"><span data-gs="v5team" data-value="0" role="tab" tabindex="0" aria-selected="true">내 오늘</span><span data-gs="v5team" data-value="1" role="tab" tabindex="0" aria-selected="false">팀</span></div>');
  if(S.area==='now')w.MobileRoute?.decorateApproved(box.firstElementChild);
  /* 요약은 동선 토글 자리(본문 둘째 칸)를 건드리지 않게 꾸민 뒤에 맨 위([내 오늘 | 팀] 아래)에 얹는다 */
  if(summary){const b=box.querySelector('.mv5-body'),seg=b&&b.querySelector(':scope>.mv5-seg');if(seg)seg.insertAdjacentHTML('afterend',summary);else b?.insertAdjacentHTML('afterbegin',summary);}
  const snapshot=pendingSnapshot();
  if(!(snapshot.ok&&snapshot.count===0&&snapshot.unlinked_operations===0))box.firstElementChild.firstElementChild.insertAdjacentHTML('afterend',w.MobilePendingView.banner(snapshot));
  return box.innerHTML;
 }
 /* 전화 앱 열기(예시 화면에서는 열지 않음) */
 function dial(v){const p=String(v||'').replace(/[^\d+]/g,'');if(!p)return false;if(w.DEMO){w.toast('예시 화면에서는 외부 앱을 실행하지 않습니다.');return false;}w.location.href='tel:'+p;return true;}
 /* v5 카드 버튼: 전화하기 = 전화 앱 → 돌아오면 그 현장 결과 화면 · 방문 결과 남기기 = 방문 결과 · 기록하기 = 결과 화면. 요청이 걸린 건은 먼저 '담당 확인'(seen) */
 async function v5task(b,click){
  const id=b.dataset.id,mode=b.dataset.mode,rq=b.dataset.requestId||'';
  if(b.dataset.kind==='inquiry'){const q=inquiry(id);if(mode==='call')dial(q&&q.phone);const r=w.MobileInquiryEntry?.open(q);if(!r?.ok)w.toast(r?.error||'문의 응대 연결을 확인해 주세요.');return;}
  const d=mine().find(x=>String(x.id)===id);if(!d)return w.toast('현재 조회 범위의 영업건을 다시 선택해 주세요.');
  if(mode==='call'){const c=w.contactInfoM?.(d)||{};dial(c.mobile||c.officeTel);}
  if(rq)await openRequestedTask(id,rq,click);else{w.G.deal=id;run();}
  if(click!==taskClick||String(w.G.deal)!==id)return;
  if(mode==='visit'){if(!openVisit(d,b.dataset.taskId))w.toast('방문 일정을 다시 확인해 주세요.');return;}
  openContact();
 }
 function todayOld(){
  const rows=w.buildToday();w.G._today=rows;  const inNow=new Set(rows.filter(t=>t.kind==='deal').map(t=>String(t.ref)));
  const openDeals=mine().filter(d=>w.isOpen?.(d)&&!inNow.has(String(d.id)));
  const row=(d,why,button)=>({id:d.id,kind:'deal',name:d.nm,brand:brand(d),color:color(d),stage:label(d),due:due(d),dueColor:dueColor(d),task:next(d)?.text||'다음 업무 확인',why,button});
  const md=d=>{const x=next(d);return x?w.ContactEntry.md(x.due||x.due_at):'';};
  const byDue=(a,b)=>(w.dueDays(a)??999)-(w.dueDays(b)??999);
  const AR={
   waiting:openDeals.filter(d=>next(d)&&/회신|답변|대기|결과 확인|검토|수신|회의 결과/.test(next(d).text||'')).sort(byDue).slice(0,20).map(d=>({...row(d,'확인일 '+md(d),'확인일 변경'),dueColor:'#6b7280'})),
   info:openDeals.map(d=>{const A=w.stageGuideItemsM?.(d)||[],miss=A.filter((x,i)=>!guideOn(d,x,i)&&x.required!==false).length;return [d,miss];}).filter(p=>p[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,20).map(p=>row(p[0],'확인할 정보 '+p[1]+'개','정보 채우기')),
   promise:openDeals.filter(d=>{const n=next(d),k=w.dueDays(d);return n&&/약속|방문|미팅|회의|제출|견적 발송/.test(n.text||'')&&k!=null&&k<=7;}).sort(byDue).slice(0,20).map(d=>row(d,'약속 '+md(d),'약속 확인'))
  };
  const completed=rows.filter(t=>w.isDone(t)).length;
  const model=w.__approvedAExample||{title:w.G.user.nm+'님, 오늘 할 일 '+rows.length+'개',progress:completed+' / '+rows.length,progressPercent:rows.length?completed/rows.length*100:0,areas:['지금 처리 '+rows.length,'회신 대기 '+AR.waiting.length,'정보 보완 '+AR.info.length,'약속 '+AR.promise.length],rows:rows.map(t=>{const d=t.kind==='deal'?mine().find(x=>String(x.id)===String(t.ref)):null,R=w.MobileRequests,r=d?R?.forDeal(d.id)?.[0]:null;return {id:t.ref,kind:t.kind,name:t.nm,brand:d?brand(d):'견적문의',color:color(d||{}),stage:d?label(d):'견적문의',due:d?due(d):'',dueColor:d?dueColor(d):'#15171c',task:d?next(d)?.text||t.why:t.why,why:r?[(r.requested_by||'관리자')+' 요청',R.labelOf(r),R.dueTxt(r)].filter(Boolean).join(' · '):t.sub||'',button:r?'요청 확인':'업무 확인',requestId:r?.id||''};})};
  const html=w.MobileApprovedA.render(S.area!=='now'&&AR[S.area]?{...model,rows:AR[S.area],message:AR[S.area].length?'':'해당하는 현장이 없습니다.'}:model);
  const snapshot=pendingSnapshot();
  if(snapshot.ok&&snapshot.count===0&&snapshot.unlinked_operations===0)return html;
  const box=w.document.createElement('div');box.innerHTML=html;
  box.firstElementChild.firstElementChild.insertAdjacentHTML('afterend',w.MobilePendingView.banner(snapshot));
  return box.innerHTML;
 }
 function show(){
  if(!w.G?.user||(!w.LIVE&&!w.DEMO)||w.G.mode!=='rep'||w.G.sub)return false;
  const d=w.G.deal!=null?mine().find(x=>String(x.id)===String(w.G.deal)):null;
  if(!d&&w.G.tab==='prospect-form'&&typeof w.rProspect==='function'){
   w.document.body.classList.add('claude-shell');w.document.getElementById('stage').style.display='';
   const sc=w.document.getElementById('scr'),tb=w.document.getElementById('tabbar');sc.classList.add('gs-screen','gs-approved-frame','gs-prospect');sc.classList.remove('gs-approved-a');
   w.rProspect('<div class="gs-reg-head"><span data-gs="back" role="button" tabindex="0" aria-label="뒤로">‹</span><b>새 현장 등록 · 2 / 4</b></div>');
   const wrap=w.document.createElement('div');wrap.className='approved-quote';while(sc.firstChild)wrap.append(sc.firstChild);sc.append(wrap);
   tb.innerHTML='';tb.classList.add('gs-tabhost');w.MobileApprovedBoot?.ready();return true;
  }
  w.document.getElementById('scr')?.classList.remove('gs-prospect');
  if(!d&&!['mine','today','pending','record','registration-match','schedule','day-close'].includes(w.G.tab))return false;
  w.document.body.classList.add('claude-shell');
  w.document.getElementById('stage').style.display='';
  const scr=w.document.getElementById('scr'),tab=w.document.getElementById('tabbar');
  const views={mine:listing,today,pending,record:registration,'registration-match':registrationMatches,schedule,'day-close':dayClose};
  scr.classList.add('gs-screen','gs-approved-frame');scr.classList.toggle('gs-approved-a',!d&&w.G.tab==='today');scr.innerHTML=d?detailScreen(d):views[w.G.tab]();tab.innerHTML='';tab.classList.add('gs-tabhost');
  /* 2026-10-22 하자 사진 간이 접수: 상세 더보기 끝에 [하자 접수] 줄 하나(승인 원본 줄을 복제 · 서버 함수가 있을 때만) */
  if(d&&!S.detailView&&w.MobileDefect&&w.MobileDefect.on()){const more=scr.querySelector('.approved-detail-body')?.lastElementChild,last=more&&more.lastElementChild;if(last&&last.dataset.gs==='more'&&!more.querySelector('[data-value="하자 접수"]')){const n=last.cloneNode(true);n.dataset.value='하자 접수';n.children[0].textContent='하자 접수';n.children[1].textContent='사진 1장 · 본사 알림 ›';n.setAttribute('aria-label','하자 접수');more.append(n);}}
  /* 모바일 v6 ②: 상세 첫 칸(현장 이름 · 진행상태) 바로 아래 진행 바, '응대 이력' 칸 바로 위 단계 이력(mobile-v6.js). 승인 C 원본 칸은 그대로 두고 칸 두 개만 더한다 */
  if(d&&!S.detailView&&w.MobileV6&&w.MobileV6.on()&&!scr.querySelector('.mv6-prog')){
   const body=scr.querySelector('.approved-detail-body'),id=body?.firstElementChild,hist=body?.querySelector('[data-gs="history"]'),hb=hist&&[...body.children].find(n=>n.contains(hist)),m=w.MobileV6.progress(d,{page:S.v6histPage||1});
   if(id)id.insertAdjacentHTML('afterend',w.MobileV6.barHtml(m));
   if(hb)hb.insertAdjacentHTML('beforebegin',w.MobileV6.historyHtml(m));
  }
  /* 2026-10-22 실주 칸(내 현장 '전체' 목록 끝 한 줄): 누르면 실주 칩으로 — 숨긴 건수를 숫자로 알린다 */
  /* 2026-10-23 오늘 요약 '내 담당 ›'으로 들어온 목록: 같은 조건(진행 중)이라는 걸 맨 위 한 줄로 · [전체 보기]로 풀기 */
  if(!d&&w.G.tab==='mine'&&S.openOnly&&!S.stage){const list=scr.querySelector('.approved-list'),n=mine().filter(x=>w.isOpen?.(x)).length;if(list)list.insertAdjacentHTML('afterbegin','<span class="approved-empty gs-open-note"><b>진행 중 '+n+'건</b><span data-gs="open-only-clear" role="button" tabindex="0">전체 보기 ›</span></span>');}
  if(!d&&w.G.tab==='mine'&&!S.stage&&!S.openOnly&&!S.q.trim()&&lostHide()){const n=lostCount();const list=n?scr.querySelector('.approved-list'):null;if(list)list.insertAdjacentHTML('beforeend','<span class="approved-empty gs-lost-note" data-gs="stage" data-value="lost" role="button" tabindex="0" aria-label="실주 '+n+'건 보기"><b>실주 '+n+'건</b><span>누르면 보입니다 ›</span></span>');}
  /* 과거 이관 · 분류 전 건 알림(내 현장 목록 끝 한 줄) — 숫자만, 재개는 PC */
  if(!d&&w.G.tab==='mine'){const n=legacyCount();const list=n?scr.querySelector('.approved-list'):null;if(list)list.insertAdjacentHTML('beforeend','<span class="approved-empty gs-legacy-note">과거 이관 · 분류 전 '+n+'건은 이 목록 · 오늘에 넣지 않습니다 — PC 파이프라인 [과거 이관]에서 영업 재개</span>');}
  if(!d&&w.G.tab==='mine'&&listScroller())listScroller().scrollTop=S.scroll;
  w.MobileApprovedBoot?.ready();loadRequests();w.setTimeout(()=>w.MobileRoute?.drawMap(),0);applyOpenLink();return true;
 }
 function run(){w.render();}
 /* 2026-10-22 잔디 알림 링크 → 앱 실행: mobile.html?open=inq:<문의 id> · deal:<영업건 id>. 로그인 · 자료가 준비된 뒤 그 문의 응대 화면 · 영업건 상세를 한 번 연다. 주소에서는 바로 지운다(새로고침해도 다시 열지 않음). 끄기 G.mobileOpenLinkOff */
 let pendingOpen='';
 function readOpenLink(){
  try{const u=new URL(w.location.href),v=String(u.searchParams.get('open')||'');if(!/^(inq|deal):[\w-]{1,80}$/.test(v))return;pendingOpen=v;u.searchParams.delete('open');w.history.replaceState(null,'',u.pathname+(u.search||'')+(u.hash||''));}catch(e){}
 }
 function applyOpenLink(){
  if(!pendingOpen||(w.G&&w.G.mobileOpenLinkOff)||!w.G?.user||!(w.LIVE||w.DEMO)||w.G.mode!=='rep')return;
  const [kind,id]=pendingOpen.split(':');
  if(kind==='inq'){const q=inquiry(id);if(!q){if(w.LIVE){pendingOpen='';w.toast('알림의 문의를 지금 목록에서 찾지 못했습니다(담당이 바뀌었거나 종결).');}return;}pendingOpen='';w.setTimeout(()=>{const r=w.MobileInquiryEntry?.open(q);if(!r?.ok)w.toast(r?.error||'문의 응대 연결을 확인해 주세요.');},0);return;}
  if(kind==='deal'){if(!mine().some(d=>String(d.id)===id)){if(w.LIVE){pendingOpen='';w.toast('알림의 영업건을 지금 목록에서 찾지 못했습니다.');}return;}pendingOpen='';w.setTimeout(()=>{if(!resetDetail())return;S.returnTab='today';w.G.deal=id;w.G.sub=null;run();},0);}
 }
 /* 2026-10-22 회의록 모바일 1단계: 로그인 뒤 운영 자료가 오기 전 = 오늘 화면과 같은 틀의 뼈대(스켈레톤). 예전 바깥 화면도, 빈 배경도 보이지 않는다. 숫자 · 현장은 만들지 않고 회색 자리만. */
 function showLoading(){
  const scr=w.document.getElementById('scr'),tab=w.document.getElementById('tabbar'),stage=w.document.getElementById('stage');if(!scr||!tab)return false;
  w.document.body.classList.add('claude-shell');if(stage)stage.style.display='';
  scr.classList.add('gs-screen','gs-approved-frame','gs-approved-a');scr.classList.remove('gs-prospect');
  const card='<div class="gs-skel-card" aria-hidden="true"><i style="width:38%"></i><b style="width:86%"></b><b style="width:60%"></b><i style="width:52%"></i><u></u></div>';
  const tabs=[['today','오늘'],['mine','내 현장'],['record','기록 · 등록'],['schedule','일정']].map(([k,l],n)=>'<span'+(n===0?' aria-current="page" class="on"':'')+'>'+l+'</span>').join('');
  scr.innerHTML='<div class="approved-a mv5 gs-skel" role="status" aria-live="polite" aria-label="오늘 업무를 불러오는 중"><div class="mv5-head"><b>오늘</b><div style="flex:1"></div></div><div class="mv5-body"><div class="mv5-top"><span>지금 먼저 할 일</span><b class="gs-skel-line" style="width:42%" aria-hidden="true"></b></div>'+card+card+card+'<p class="gs-skel-note">서버에서 오늘 업무를 불러오는 중입니다</p></div><div class="mv5-nav">'+tabs+'</div></div>';
  tab.innerHTML='';tab.classList.add('gs-tabhost');w.MobileApprovedBoot?.ready();return true;
 }
 function openVisit(d,taskId){
  if(!d)return false;
  const tasks=Array.isArray(d.openNextActions)?d.openNextActions:[d.nextActionObj,d.nextAction].filter(a=>a&&typeof a==='object');
  const n=taskId?tasks.find(a=>String(a.id)===String(taskId)):next(d);
  if(!n||n.status!=='open'||!n.id||!/방문|실측|미팅/.test(n.type||n.action_type||''))return false;
  const due=w.MobileScheduleModel?.day(n.due_on||n.due||n.due_at||n.scheduled_at);
  if(!due)return false;
  w.MobileEntry.open({ch:'방문',existing:{id:String(n.id),text:String(n.text||n.title||''),due,type:String(n.type||n.action_type||''),promise:n.date_basis==='customer_agreed'||n.promise===true}});return true;
 }
 function openContactCard(){
  const d=mine().find(x=>String(x.id)===String(w.G.deal));
  if(w.MobileInputFlow?.open(d,'I-3')){S.detailView='input';run();}else w.toast('연락처 입력을 열지 못했습니다. 계정·영업건 변경 또는 임시 보관 상태를 확인해 주세요.');
 }
 function boot(){
  readOpenLink();
  // Retired contact forms must not reopen or submit stale consent snapshots.
  w.contactEditSheetM=openContactCard;
  w.saveContactM=unavailable;
  w.addEventListener('phase1:identity-cleared',()=>{
   requestRead=null;requestReadOwner='';pcRedirected=false;taskClick++;
   Object.assign(S,{q:'',stage:'',openOnly:false,page:1,pendingPage:1,scroll:0,returnTab:'mine',area:'now',entryAction:'',scheduleDay:'',schedulePage:1,newQuery:'',selectedSite:'',registrationPage:1,registrationOwner:'',registrationError:'',closePages:{done:1,open:1,tomorrow:1}});resetDetail({force:true});
   try{const prefix=w.MobileRegistrationContext?.draftPrefix||'crm:mobile-registration:v1:';Object.keys(w.sessionStorage).filter(k=>k.startsWith(prefix)).forEach(k=>w.sessionStorage.removeItem(k));}catch(e){}
  });
  const previous=w.render;
  w.render=function(){
   if(!mobileMode())return;
   w.MobileInputFlow?.syncContext();
   w.MobileQuoteFlow?.syncContext();
   if(show())return;
   if(w.G?.user&&(w.LIVE||w.DEMO)){
    w.G.sub=null;w.G.deal=null;w.G.tab='mine';
    if(w.G.mode==='rep'){show();unavailable();return;}
    w.MobileApprovedBoot?.hold();unavailable();return;
   }
   // 2026-10-22 회의록(8~10월) 모바일 1단계: 로그인 뒤 자료가 오기 전에는 빈 화면 대신 같은 틀의 뼈대(스켈레톤). 끄기 G.mobileSkelOff
   if(w.G?.user&&w.TOKEN&&!w.LIVE&&!w.DEMO&&!w.LOAD_ERR&&!w.G.mobileSkelOff&&showLoading())return;
   // Only the unauthenticated login can use the former outer renderer.
   w.document.body.classList.remove('claude-shell');w.document.getElementById('scr').classList.remove('gs-screen','gs-approved-frame','gs-approved-a');w.document.getElementById('tabbar').classList.remove('gs-tabhost');
   const result=previous.apply(this,arguments);w.MobileApprovedBoot?.login();return result;
  };
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-gs]');if(!b)return;const k=b.dataset.gs;
   taskClick++;
   if((k==='e-newsite'||k.startsWith('j4-'))&&!registrationOwnerMatches())return;
   if(b.tagName==='A')e.preventDefault();if(b.getAttribute('aria-disabled')==='true'){if(b.title)w.toast(b.title);return;}
   if(k==='deal'){
    if(!mine().some(d=>String(d.id)===b.dataset.id))return w.toast('현재 조회 범위의 영업건을 다시 선택해 주세요.');
    if(!resetDetail())return;S.scroll=listScroller()?.scrollTop||0;S.returnTab=w.G.tab;w.G.deal=b.dataset.id;w.G.sub=null;const entry=S.entryAction;S.entryAction='';run();if(entry==='contact')openContact();else if(entry==='attach')w.MobileQuick?.attach('photo');else if(entry==='sched')w.MobileQuick?.schedule();else if(b.dataset.taskId)openVisit(mine().find(d=>String(d.id)===b.dataset.id),b.dataset.taskId);
   }
   else if(k==='back'||k==='stage-confirmation-back'){if(S.detailView==='input'){const r=w.MobileInputFlow?.back(mine().find(x=>String(x.id)===String(w.G.deal)));if(r?.render)run();if(!r?.ok&&r?.note)w.toast(r.note);return;}if(S.detailView==='quote'&&w.MobileQuoteFlow?.back(mine().find(x=>String(x.id)===String(w.G.deal)))){run();return;}if(S.detailView){if(!resetDetail())return;run();return;}if(!resetDetail())return;const registrationBack=w.G.tab==='registration-match';w.G.deal=null;w.G.tab=registrationBack?'record':S.returnTab;run();}
   else if(k==='tab'){if(!['today','mine','record','schedule'].includes(b.dataset.tab))return unavailable();if(!resetDetail())return;w.G.tab=b.dataset.tab;w.G.deal=null;w.G.sub=null;S.entryAction='';S.page=1;S.scroll=0;S.openOnly=b.dataset.scope==='open';if(S.openOnly)S.stage='';run();}
   else if(k==='open-only-clear'){S.openOnly=false;S.page=1;S.scroll=0;run();}
   else if(k==='more'&&b.dataset.value==='이 단지 다른 영업'){const d0=mine().find(x=>String(x.id)===String(w.G.deal)),sid=d0&&(d0.site_id||d0.cleanup_site_id),sib=sid?mine().filter(x=>String(x.site_id||x.cleanup_site_id)===String(sid)&&String(x.id)!==String(d0.id)):[];if(!sib.length)w.toast('이 단지의 다른 영업이 없습니다');else if(sib.length===1){w.G.deal=sib[0].id;S.detailView='';run();}else w.toast(sib.map(x=>x.nm+' · '+work(x)).join(' / '));}
   else if(k==='more'&&b.dataset.value==='근처 현장'){const d0=mine().find(x=>String(x.id)===String(w.G.deal)),ad=((d0&&(d0.address||d0.addr))||'').trim();if(!ad)w.toast('주소가 없어 지도를 열 수 없습니다');else w.open('https://map.kakao.com/?q='+encodeURIComponent(ad),'_blank','noopener');}
   else if(k==='more'&&(b.dataset.value==='자료 발송 내역'||b.dataset.value==='영업 조건')){S.detailView=b.dataset.value==='자료 발송 내역'?'evidence':'confirmation';S.evidencePage=1;run();}
   else if(k==='more'&&b.dataset.value==='하자 접수'){/* 2026-10-22 하자 사진 간이 접수 */if(!w.MobileDefect||!w.MobileDefect.on())return w.toast('하자 접수는 서버 적용 뒤에 열립니다');w.MobileDefect.reset();S.detailView='defect';run();}
   else if(k==='stage-change'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal));
    if(!d)return;if(d.code!=='consulting')return w.nextSheet?w.nextSheet():w.toast('단계를 바꿀 수 없습니다');
    S.detailView='transition';run();
   }
   else if(k==='g-evidence'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal));
    if(!d||w.MobileStageReview?.select(d,b.dataset.id)?.ok!==true){run();return w.toast('현재 영업건의 발송 근거를 다시 확인해 주세요.');}
    run();
   }
   else if(k==='j2-field')w.toast(b.dataset.state==='missing'?'값을 임의로 채우지 않습니다. 승인된 입력 화면과 저장 연결을 확인 중입니다.':'기존 기록을 확인하는 화면입니다. 값과 단계는 변경하지 않았습니다.');
   else if(k==='stage-confirmation-evidence'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal));
    const a=d?.activities?.find(x=>String(x.id)===b.dataset.evidenceId);
    const recent=(d?.activities||[]).slice().sort((x,y)=>String(y.at||y.occurred_at||'').localeCompare(String(x.at||x.occurred_at||''))).slice(0,3);
    if(!d||String(d.id)!==b.dataset.dealId||!a||(a.opportunity_id&&String(a.opportunity_id)!==String(d.id))||!recent.includes(a))return w.toast('같은 영업건의 근거 기록을 전체 이력에서 확인해야 합니다. 전체 이력 화면은 연결 중입니다.');
    if(!resetDetail())return;run();w.document.querySelector('.approved-detail-body [data-gs="history"]')?.scrollIntoView({block:'center'});
   }
   else if(k==='e-activity'){registrationContext();S.entryAction='contact';S.returnTab='record';S.q='';S.stage='';S.page=1;S.scroll=0;w.G.brandF='전체';w.G.tab='mine';w.G.deal=null;run();w.document.querySelector('[data-gs-query]')?.focus();}
   else if(k==='e-newsite'){
    if(b.dataset.entry==='start'){w.document.querySelector('[data-gs-e-query]')?.focus();return;}
    if(!S.newQuery.trim())return w.toast('현장 이름을 입력해 주세요.');
    S.returnTab='record';S.registrationPage=1;w.G.deal=null;w.G.tab='registration-match';run();
   }
   else if(k==='j4-existing'){
    const m=registrationContext(),site=m.rows?.find(r=>String(r.id)===b.dataset.id);if(!m.ok||!site)return w.toast('현재 조회 범위의 현장 후보를 다시 확인해 주세요.');
    S.selectedSite=site.id;try{w.MobileRegistrationContext.saveDraft(S.newQuery,S.selectedSite);S.registrationError='';}catch(e){S.registrationError=String(e.message||e);run();w.toast('입력 임시 보관에 실패했습니다. 현재 내용을 유지하고 다시 시도해 주세요.');return;}
    if(b.classList.contains('approved-j4-row'))run();else w.toast('선택한 현장을 유지했습니다. 등록 2~4단계와 서버 저장 연결이 아직 준비되지 않았습니다.');
   }
   else if(k==='j4-new'){
    try{w.MobileRegistrationContext.saveDraft(S.newQuery,S.selectedSite);S.registrationError='';}catch(e){S.registrationError=String(e.message||e);run();w.toast('입력 임시 보관에 실패했습니다. 현재 내용을 유지하고 다시 시도해 주세요.');return;}
    w.G.pnm=S.newQuery||'';w.G.deal=null;w.G.sub=null;S.returnTab='record';w.G.tab='prospect-form';run();
   }
   else if(k==='e-card'){if(!w.MobileQuick)return w.toast('이 기능을 불러오지 못했습니다. 새로고침해 주세요.');registrationContext();S.entryAction=b.dataset.entry==='materials'?'attach':'sched';S.returnTab='record';S.q='';S.stage='';S.page=1;S.scroll=0;w.G.brandF='전체';w.G.tab='mine';w.G.deal=null;run();w.toast(b.dataset.entry==='materials'?'사진 · 자료를 올릴 현장을 고르세요':'일정을 더할 현장을 고르세요');w.document.querySelector('[data-gs-query]')?.focus();}
   else if(k==='schedule-day'){if(!w.MobileScheduleModel?.dateOnly(b.dataset.date))return;S.scheduleDay=b.dataset.date;S.schedulePage=1;run();}
   else if(k==='day-close')closeDay();
   else if(k==='day-close-page'){if(!Object.hasOwn(S.closePages,b.dataset.group))return;const n=Number(b.dataset.page);if(Number.isInteger(n)&&n>0){S.closePages[b.dataset.group]=n;run();}}
   else if(k==='stage'||k==='area'){S[k]=b.dataset.value;if(k==='stage')S.openOnly=false;S.page=1;S.areaPage=1;S.scroll=0;run();}
   else if(k==='areapage'){S.areaPage=Number(b.dataset.page)||1;run();}
   else if(k==='page'){w.ListPager.set(S,null,b.dataset.page);S.scroll=0;run();}
   else if(k==='contact')openContact(S.detailView==='confirmation'?conditionLabels():null);/* 영업 조건 화면의 [연락하고 확인] = 그 화면 항목을 이어받음 */
   else if(k==='stage-confirmation-item')openContact(conditionLabels());
   else if(k==='contact-card')openContactCard();
   else if(k==='pending-task'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal)),n=next(d);
    // The existing PC task name identifies this workflow; never infer it from a free-form memo.
    if(openVisit(d,n?.id))return;
    if(n?.text==='견적 요청 등록'&&w.MobileQuoteLive){w.MobileQuoteLive.reset('req');S.detailView='qlive';run();}else if(/발송/.test(n?.text||'')&&w.MobileQuoteLive){w.MobileQuoteLive.reset();w.MobileQuoteLive.toSend();S.detailView='qlive';run();}else if(/견적|제출금액/.test(n?.text||'')&&w.MobileQuoteLive){w.MobileQuoteLive.reset();S.detailView='qlive';run();}else unavailable();
   }
   else if(k.startsWith('input-')){
    const d=mine().find(x=>String(x.id)===String(w.G.deal)),r=S.detailView==='input'?w.MobileInputFlow?.handle(d,k,b.dataset):null;
    if(r?.render)run();if(r?.focusTranscript)w.document.querySelector('.approved-i2 [data-input-transcript]')?.focus();if(!r?.ok&&r?.note)w.toast(r.note);
   }
   else if(k.startsWith('quote-')||k.startsWith('k1-')){
    const d=mine().find(x=>String(x.id)===String(w.G.deal));
    const result=S.detailView==='quote'?w.MobileQuoteFlow?.handle(d,k,b.dataset):null;
    if(result?.render)run();if(!result?.ok)w.toast(result?.note||'현재 영업건의 견적 화면을 다시 확인해 주세요.');
   }
   else if(k==='pending'){if(!resetDetail())return;w.G.deal=null;w.G.sub=null;w.G.tab='pending';S.pendingPage=1;run();}
   else if(k==='recover'){
    const snapshot=pendingSnapshot(),g=snapshot.groups?.find(x=>x.kind===b.dataset.kind&&x.target_id===b.dataset.id);
    const approved=g?.kind==='contact'?mine().some(d=>String(d.id)===g.target_id):g?.kind==='pc_inquiry'&&w.MobileInquiryEntry?.canOpen(inquiry(g.target_id))?.ok===true;
    if(!snapshot.ok||!g?.resume?.allowed||!approved)return w.toast('현재 담당과 저장 상태를 먼저 확인해 주세요.');
    if(!resetDetail())return;S.returnTab='pending';w.G.tab='pending';w.G.sub=null;
    if(g.kind==='pc_inquiry'){w.G.deal=null;run();w.MobileInquiryEntry.restore(g.target_id);}else{w.G.deal=g.target_id;run();w.MobileEntry.open();}
   }
   else if(k==='v5task'){if(!resetDetail())return;S.returnTab='today';v5task(b,taskClick);}
   else if(k==='v5team'){S.v5team=b.dataset.value==='1';S.v5rep='';S.v5teamPage={};run();}
   else if(k==='v5rep'){S.v5rep=b.dataset.value||'';S.v5teamPage=Object.assign({},S.v5teamPage,{rep:1});run();}
   else if(k==='v5teampage'){S.v5teamPage=Object.assign({},S.v5teamPage,{[b.dataset.key]:Number(b.dataset.page)||1});run();}
   else if(k==='v5reask'){const T=w.MobileV5Team,R=w.MobileRequests,r=R?.state?.().list.find(x=>x.id===b.dataset.id);if(!T||!R||!r)return w.toast('요청을 다시 확인해 주세요.');b.setAttribute('aria-disabled','true');R.reask(r.id,T.reaskDue(r)).then(x=>{w.toast((r.to_name||'담당')+'에게 다시 요청했습니다 · 기한 '+(x.due_label||''));run();}).catch(e=>{w.toast('다시 요청하지 못했습니다: '+String(e&&e.message||e));run();});}
   else if(k==='v5more'){S.v5more=b.dataset.value==='1';S.v5page=1;run();}
   else if(k==='v5page'){S.v5page=Number(b.dataset.page)||1;run();}
   else if(k==='v5perf'){/* 성과 = PC 성과 분석과 같은 화면 · 같은 숫자(모바일 전용 집계 없음) */if(w.DEMO)return w.toast('예시 화면에서는 PC 성과 분석으로 이동하지 않습니다.');try{(w.top||w).location.assign('./?view=pc#p=perf');}catch(e){w.location.assign('./?view=pc#p=perf');}}
   else if(k==='task'){if(!resetDetail())return;S.returnTab='today';if(b.dataset.kind==='deal'){if(b.dataset.requestId)openRequestedTask(b.dataset.id,b.dataset.requestId,taskClick);else{w.G.deal=b.dataset.id;run();openVisit(mine().find(d=>String(d.id)===b.dataset.id));}}else if(b.dataset.kind==='inquiry'){const r=w.MobileInquiryEntry?.open(inquiry(b.dataset.id));if(!r?.ok)w.toast(r?.error||'문의 응대 연결을 확인해 주세요.');}else unavailable();}
   else if(k==='phone'||k==='sms'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal)),c=w.contactInfoM(d),phone=w.phoneN(c.mobile||c.officeTel);
    if(w.DEMO)w.toast('예시 화면에서는 외부 앱을 실행하지 않습니다.');
    else if(phone)w.location.href=(k==='phone'?'tel:':'sms:')+phone;
    /* 2026-10-22 회의록 모바일 1단계: 상세 [전화]도 오늘 카드와 같이 전화 앱 → 돌아오면 바로 연락 결과 화면(통화 뒤 10초 입력). 끄기 G.mobileCallSheetOff */
    if(k==='phone'&&phone&&!w.G.mobileCallSheetOff)openContact();
   }else unavailable();
  });
  /* 상세 '단계 이력' 쪽 번호(mobile-v6 · 한 쪽 5건) — 화면 위치는 그대로 두고 그 칸만 다시 그린다 */
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-v6h="page"]');if(!b)return;const n=Number(b.dataset.page);if(!Number.isInteger(n)||n<1)return;const sc=w.document.querySelector('.approved-detail-body'),top=sc?sc.scrollTop:0;S.v6histPage=n;run();const s2=w.document.querySelector('.approved-detail-body');if(s2)s2.scrollTop=top;});
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-pending="page"]');if(!b)return;const n=Number(b.dataset.page);if(Number.isInteger(n)&&n>0){S.pendingPage=n;run();}});
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-schedule="page"],[data-registration="page"]');if(!b)return;const n=Number(b.dataset.page);if(Number.isInteger(n)&&n>0){if(b.hasAttribute('data-schedule'))S.schedulePage=n;else S.registrationPage=n;run();}});
  w.document.addEventListener('input',e=>{const r=e.target.closest('[data-quote-live]');if(!r||S.detailView!=='qlive')return;w.MobileQuoteLive.preview(r,mine().find(x=>String(x.id)===String(w.G.deal)),e.target);});
w.document.addEventListener('click',e=>{const b=e.target.closest('[data-ql-act="todraft"],[data-ql-act="dkind"],[data-ql-act="dadd"],[data-ql-act="drm"],[data-ql-act="dok"],[data-ql-act="dstd"]');if(!b||S.detailView!=='qlive'||!w.MobileQuoteLive.draftAct)return;const d=mine().find(x=>String(x.id)===String(w.G.deal));if(d)w.MobileQuoteLive.draftAct(b.dataset.qlAct,b,d,run);});
w.document.addEventListener('click',e=>{const b=e.target.closest('[data-ql-act="toreq"]');if(!b||S.detailView!=='qlive'||!w.MobileQuoteLive.toReq)return;w.MobileQuoteLive.toReq();run();});
w.document.addEventListener('click',e=>{const b=e.target.closest('[data-ql-act="send"],[data-ql-act="tosend"]');if(!b||S.detailView!=='qlive')return;const d=mine().find(x=>String(x.id)===String(w.G.deal));if(!d)return;if(b.dataset.qlAct==='tosend'){w.MobileQuoteLive.toSend();run();}else w.MobileQuoteLive.submitSend(d,b.closest('[data-quote-live]'),run);});
w.document.addEventListener('click',e=>{const b=e.target.closest('[data-ql-act="req"]');if(!b||S.detailView!=='qlive')return;const d=mine().find(x=>String(x.id)===String(w.G.deal));if(d)w.MobileQuoteLive.submitReq(d,b.closest('[data-quote-live]'),run);});
w.document.addEventListener('click',e=>{const b=e.target.closest('[data-ql-act="confirm"]');if(!b||S.detailView!=='qlive')return;const r=b.closest('[data-quote-live]'),d=mine().find(x=>String(x.id)===String(w.G.deal));if(d)w.MobileQuoteLive.confirm(d,r,run);});
w.document.addEventListener('click',e=>{const b=e.target.closest('[data-stage-evidence="page"]');if(!b)return;const n=Number(b.dataset.page);if(Number.isInteger(n)&&n>0){S.evidencePage=n;run();}});
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-quote-review="page"]');if(!b||S.detailView!=='quote')return;const d=mine().find(x=>String(x.id)===String(w.G.deal));w.MobileQuoteFlow?.page(d,b.dataset.page);run();});
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-input-review="page"]');if(!b||S.detailView!=='input')return;const d=mine().find(x=>String(x.id)===String(w.G.deal));w.MobileInputFlow?.page(d,b.dataset.page);run();});
  w.document.addEventListener('input',e=>{
   const el=e.target.closest('[data-input-transcript],[data-input-field]');if(!el||S.detailView!=='input')return;
   const d=mine().find(x=>String(x.id)===String(w.G.deal)),r=w.MobileInputFlow?.input(d,el.hasAttribute('data-input-transcript')?'transcript':el.dataset.id,el.textContent);
   if(!r?.ok){if(r?.note)w.toast(r.note);return;}
   const m=r.model,footer=w.document.querySelector('.approved-input-footer');
   if(el.hasAttribute('data-input-field')){
    el.setAttribute('aria-invalid',String(m?.fields?.find(f=>f.id===el.dataset.id)?.uncertain!==false));
    if(m){const sample=w.document.createElement('div');sample.innerHTML=w.MobileApprovedInput.renderI3(m);const matched=sample.querySelector('[data-input-field][data-id="'+el.dataset.id+'"]');if(matched)el.setAttribute('style',matched.getAttribute('style'));}
    const note=w.document.querySelector('[data-contact-match-note]');if(note&&m)note.textContent=m.duplicateNote;
    const helper=w.document.querySelector('[data-input-card-helper]');if(helper&&m)helper.textContent=m.helper;
   }
   if(footer&&m?.screen==='I-2'){footer.firstElementChild.textContent=m.preview;footer.lastElementChild.setAttribute('aria-disabled',String(m.canSave!==true));footer.lastElementChild.tabIndex=m.canSave?0:-1;}
  });
  const registrationInputs='[data-gs-e-query],[data-gs-j4-query]',composingInputs=new WeakSet();
  const registrationInput=e=>{
   if(!e.target.matches(registrationInputs)||!registrationOwnerMatches())return;
   const pos=e.target.selectionStart,key=e.target.hasAttribute('data-gs-e-query')?'data-gs-e-query':'data-gs-j4-query';
   S.newQuery=e.target.value;S.selectedSite='';S.registrationPage=1;
   try{w.MobileRegistrationContext.saveDraft(S.newQuery,'');S.registrationError='';}catch(err){S.registrationError=String(err.message||err);}
   if(e.isComposing||composingInputs.has(e.target))return;
   run();const input=w.document.querySelector('['+key+']');input?.focus();input?.setSelectionRange(pos,pos);
  };
  /* 단계 칩 줄 — 마우스(PC 브라우저)에서도 옆으로 넘길 수 있게: 휠 · 끌기. 터치는 기본 스크롤 */
(()=>{let drag=null,moved=false;
 w.document.addEventListener('wheel',e=>{const r=e.target.closest?.('.approved-stages');if(!r||r.scrollWidth<=r.clientWidth)return;const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;r.scrollLeft+=dx;e.preventDefault();},{passive:false});
 w.document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;const r=e.target.closest?.('.approved-stages');if(!r||r.scrollWidth<=r.clientWidth)return;drag={r,x:e.clientX,l:r.scrollLeft};moved=false;});
 w.document.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x;if(Math.abs(dx)>4)moved=true;if(moved)drag.r.scrollLeft=drag.l-dx;});
 const end=()=>{drag=null;};w.document.addEventListener('pointerup',end);w.document.addEventListener('pointercancel',end);
 w.document.addEventListener('click',e=>{if(moved&&e.target.closest?.('.approved-stages')){e.stopPropagation();e.preventDefault();moved=false;}},true);
})();
w.document.addEventListener('compositionstart',e=>{if(e.target.matches(registrationInputs))composingInputs.add(e.target);});
  w.document.addEventListener('compositionend',e=>{if(e.target.matches(registrationInputs)){composingInputs.delete(e.target);registrationInput(e);}});
  w.document.addEventListener('input',registrationInput);
  w.document.addEventListener('input',e=>{if(!e.target.matches('[data-quote-quantity]'))return;const d=mine().find(x=>String(x.id)===String(w.G.deal));
   const r=w.MobileQuoteFlow?.quantity(d,e.target.dataset.id,e.target.value);if(!r?.ok){run();w.toast('계정·영업건이 바뀌어 입력을 반영하지 않았습니다.');}else if(!r.stored)w.toast('입력 임시 보관 실패 · 현재 화면의 입력은 유지됩니다.');});
  w.document.addEventListener('input',e=>{if(!e.target.matches('[data-quote-date]')||S.detailView!=='quote')return;
   const d=mine().find(x=>String(x.id)===String(w.G.deal)),r=w.MobileQuoteFlow?.calendarDate(d,e.target.value);
   if(!r?.ok){run();return;}
   e.target.setAttribute('aria-invalid',String(!r.valid));
  });
  w.document.addEventListener('click',e=>{if(!e.target.matches('[data-quote-date]')||S.detailView!=='quote')return;
   try{e.target.showPicker?.();}catch{/* Native date input remains available on browsers without showPicker. */}
  });
  w.document.addEventListener('change',e=>{if(!e.target.matches('[data-quote-date]')||S.detailView!=='quote')return;
   const d=mine().find(x=>String(x.id)===String(w.G.deal)),r=w.MobileQuoteFlow?.calendarDate(d,e.target.value);if(!r?.ok){run();return;}if(!r.valid)return;
   const result=w.MobileQuoteFlow.handle(d,'k1-calendar-confirm');if(result?.render)run();if(!result?.ok&&result?.note)w.toast(result.note);
  });
  w.document.addEventListener('keydown',e=>{if(e.key!=='Escape'||S.detailView!=='quote'||!w.MobileQuoteFlow?.snapshot()?.datePanel)return;e.preventDefault();
   const d=mine().find(x=>String(x.id)===String(w.G.deal)),r=w.MobileQuoteFlow.handle(d,'k1-calendar-cancel');if(r?.render)run();});
  w.document.addEventListener('input',e=>{if(!e.target.matches('[data-gs-query]'))return;const position=e.target.selectionStart;S.q=e.target.value;S.page=1;S.scroll=0;run();const input=w.document.querySelector('[data-gs-query]');input.focus();input.setSelectionRange(position,position);});
  w.document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-gs][role="button"],[data-gs][role="checkbox"]')){e.preventDefault();e.target.click();}});
  if(w.G?.user)run();else w.MobileApprovedBoot?.login();
 }
 /* v5 '정리됨' 화면의 '다음 할 일' = 오늘 v5 와 같은 순서의 다음 카드 */
 function todayItems(){try{return w.MobileV5Today&&w.DayZoneRules?w.MobileV5Today.model(zones(),{next,label,brand,color,inquiry}).items:[];}catch(e){return [];}}
 w.MobileGuideShell={show,state:S,todayItems};
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
