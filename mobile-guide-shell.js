/* Approved Claude A/B/C markup + existing account scope. No retired UI fallback. */
(function(w){
 'use strict';
 const S={q:'',stage:'',page:1,pendingPage:1,scroll:0,returnTab:'mine',area:'now',entryAction:'',scheduleDay:'',schedulePage:1,newQuery:'',selectedSite:'',registrationPage:1,registrationOwner:'',registrationError:'',closePages:{done:1,open:1,tomorrow:1},detailView:'',evidencePage:1};
 const mine=()=>w.myDeals?w.myDeals():[];
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
 async function openContact(){
  const owner=requestOwner(),id=String(w.G?.deal||'');
  await loadRequests();
  if(owner!==requestOwner()||w.G?.mode!=='rep'||String(w.G.deal||'')!==id||!mine().some(d=>String(d.id)===id))return;
  w.MobileEntry.open();
 }
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
 function dayClose(){
  if(typeof w.MobileApprovedHSource!=='string')return '';
  const m=w.__approvedHExample||w.MobileDayCloseModel?.read()||{};
  const model={...m,canClose:false,blockedReason:m.blockedReason||'마감 저장·공유 확인 경로가 아직 연결되지 않았습니다.'};
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
  let rows=mine();if(S.stage)rows=rows.filter(d=>w.PipelineStages.group(d.code,d.outcome)===S.stage);
  const needle=S.q.trim().toLocaleLowerCase();if(needle)rows=rows.filter(d=>{const c=w.contactInfoM(d);return [d.nm,d.address,d.addr,c.name,c.mobile,c.officeTel,work(d)].join(' ').toLocaleLowerCase().includes(needle);});
  if(w.G.brandF&&w.G.brandF!=='전체')rows=rows.filter(d=>brand(d)===w.G.brandF);
  const pg=w.ListPager.cut(rows,w.ListPager.page(S));S.page=pg.page;
  return w.MobileApprovedBC.listing({query:S.q,stage:S.stage,filterLabel:w.__approvedBCExample?.filterLabel||'필터',stages:[{key:'',label:'전체'},...w.PipelineStages.definitions.filter(d=>d.key!=='expansion').map(d=>({key:d.key,label:d.label}))],rows:pg.rows.map(d=>({id:d.id,name:d.nm,subtitle:[d.address_dong,work(d),d.construction_year||d.planned_year,label(d)].filter(Boolean).join(' · '),color:color(d),task:next(d)?.text||'다음 업무 확인',due:due(d),dueColor:dueColor(d),...(w.__approvedBCExample?.rows?.[d.id]||{})})),pager:w.ListPager.html(pg,{ns:'gs',unit:'건'})});
 }
 function detail(d){
  const c=w.contactInfoM(d),n=next(d),sid=d.site_id||d.cleanup_site_id;
  const siblings=sid?mine().filter(x=>String(x.site_id||x.cleanup_site_id)===String(sid)&&String(x.id)!==String(d.id)):[];
  const activities=(d.activities||[]).slice().sort((x,y)=>String(y.at||y.occurred_at||'').localeCompare(String(x.at||x.occurred_at||'')));
  const contactTask=!n||/전화|통화|연락|회신/.test(n.type||'');
  return w.MobileApprovedBC.detail({name:d.nm,brand:brand(d),color:color(d),stage:label(d),owner:d.rep||'담당 미지정',siblings:siblings.length?'이 단지 영업 '+(siblings.length+1)+'건 · '+siblings.map(work).filter(Boolean).join(' / '):'',task:n?.text||'기존 기록 확인 후 다음 업무 정하기',context:due(d),action:contactTask?'contact':'pending-task',actionLabel:contactTask?'연락 결과 기록':n?.text||'업무 확인',followup:'',contactName:[c.name,c.role].filter(Boolean).join(' · ')||'연락처 확인 필요',phone:c.mobile||c.officeTel||'',history:activities.slice(0,3).map(x=>({meta:[String(x.at||x.occurred_at||'').slice(0,10),x.type].filter(Boolean).join(' · '),note:x.note||x.result||''})),more:['확인 필요 ›','확인 필요 ›',siblings.length+'건 ›','확인 필요 ›'],...(w.__approvedBCExample?.details?.[d.id]||{})});
 }
 function stageConfirmation(d){
  if(typeof w.MobileApprovedJ1Source!=='string'||typeof w.MobileStageConfirmationModel?.read!=='function'||typeof w.MobileApprovedJ1?.render!=='function')return '';
  const example=w.__approvedStage6Example,owner=w.MobileSaveJournal?.owner();
  const approvedExample=w.DEMO===true&&owner&&example?.owner===owner&&example.dealId===String(d.id)?example.confirmation:null;
  return w.MobileApprovedJ1.render(approvedExample||w.MobileStageConfirmationModel.read(d));
 }
 function detailScreen(d){
  if(S.detailView==='input')return w.MobileInputFlow?.render(d)||'';
  if(S.detailView==='quote')return w.MobileQuoteFlow?.render(d)||'';
  if(S.detailView==='confirmation')return stageConfirmation(d);
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
  S.detailView='';S.evidencePage=1;w.MobileStageReview?.reset();return true;
 }
 function today(){
  const rows=w.buildToday();w.G._today=rows;const completed=rows.filter(t=>w.isDone(t)).length;
  const model=w.__approvedAExample||{title:w.G.user.nm+'님, 오늘 할 일 '+rows.length+'개',progress:completed+' / '+rows.length,progressPercent:rows.length?completed/rows.length*100:0,areas:['지금 처리 '+rows.length,'회신 대기 · 확인 필요','정보 보완 · 확인 필요','약속 · 확인 필요'],rows:rows.map(t=>{const d=t.kind==='deal'?mine().find(x=>String(x.id)===String(t.ref)):null,R=w.MobileRequests,r=d?R?.forDeal(d.id)?.[0]:null;return {id:t.ref,kind:t.kind,name:t.nm,brand:d?brand(d):'견적문의',color:color(d||{}),stage:d?label(d):'견적문의',due:d?due(d):'',dueColor:d?dueColor(d):'#15171c',task:d?next(d)?.text||t.why:t.why,why:r?[(r.requested_by||'관리자')+' 요청',R.labelOf(r),R.dueTxt(r)].filter(Boolean).join(' · '):t.sub||'',button:r?'요청 확인':'업무 확인',requestId:r?.id||''};})};
  const html=w.MobileApprovedA.render(S.area!=='now'?{...model,rows:[],message:'이 구역은 공통 집계 연결 작업 중입니다.'}:model);
  const snapshot=pendingSnapshot();
  if(snapshot.ok&&snapshot.count===0&&snapshot.unlinked_operations===0)return html;
  const box=w.document.createElement('div');box.innerHTML=html;
  box.firstElementChild.firstElementChild.insertAdjacentHTML('afterend',w.MobilePendingView.banner(snapshot));
  return box.innerHTML;
 }
 function show(){
  if(!w.G?.user||(!w.LIVE&&!w.DEMO)||w.G.mode!=='rep'||w.G.sub)return false;
  const d=w.G.deal!=null?mine().find(x=>String(x.id)===String(w.G.deal)):null;
  if(!d&&!['mine','today','pending','record','registration-match','schedule','day-close'].includes(w.G.tab))return false;
  w.document.body.classList.add('claude-shell');
  w.document.getElementById('stage').style.display='';
  const scr=w.document.getElementById('scr'),tab=w.document.getElementById('tabbar');
  const views={mine:listing,today,pending,record:registration,'registration-match':registrationMatches,schedule,'day-close':dayClose};
  scr.classList.add('gs-screen','gs-approved-frame');scr.classList.toggle('gs-approved-a',!d&&w.G.tab==='today');scr.innerHTML=d?detailScreen(d):views[w.G.tab]();tab.innerHTML='';tab.classList.add('gs-tabhost');
  if(!d&&w.G.tab==='mine'&&listScroller())listScroller().scrollTop=S.scroll;
  w.MobileApprovedBoot?.ready();loadRequests();return true;
 }
 function run(){w.render();}
 function openContactCard(){
  const d=mine().find(x=>String(x.id)===String(w.G.deal));
  if(w.MobileInputFlow?.open(d,'I-3')){S.detailView='input';run();}else w.toast('연락처 입력을 열지 못했습니다. 계정·영업건 변경 또는 임시 보관 상태를 확인해 주세요.');
 }
 function boot(){
  // Retired contact forms must not reopen or submit stale consent snapshots.
  w.contactEditSheetM=openContactCard;
  w.saveContactM=unavailable;
  w.addEventListener('phase1:identity-cleared',()=>{
   requestRead=null;requestReadOwner='';pcRedirected=false;taskClick++;
   Object.assign(S,{q:'',stage:'',page:1,pendingPage:1,scroll:0,returnTab:'mine',area:'now',entryAction:'',scheduleDay:'',schedulePage:1,newQuery:'',selectedSite:'',registrationPage:1,registrationOwner:'',registrationError:'',closePages:{done:1,open:1,tomorrow:1}});resetDetail({force:true});
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
    if(!resetDetail())return;S.scroll=listScroller()?.scrollTop||0;S.returnTab=w.G.tab;w.G.deal=b.dataset.id;w.G.sub=null;const entry=S.entryAction;S.entryAction='';run();if(entry==='contact')openContact();
   }
   else if(k==='back'||k==='stage-confirmation-back'){if(S.detailView==='input'){const r=w.MobileInputFlow?.back(mine().find(x=>String(x.id)===String(w.G.deal)));if(r?.render)run();if(!r?.ok&&r?.note)w.toast(r.note);return;}if(S.detailView==='quote'&&w.MobileQuoteFlow?.back(mine().find(x=>String(x.id)===String(w.G.deal)))){run();return;}if(S.detailView){if(!resetDetail())return;run();return;}if(!resetDetail())return;const registrationBack=w.G.tab==='registration-match';w.G.deal=null;w.G.tab=registrationBack?'record':S.returnTab;run();}
   else if(k==='tab'){if(!['today','mine','record','schedule'].includes(b.dataset.tab))return unavailable();if(!resetDetail())return;w.G.tab=b.dataset.tab;w.G.deal=null;w.G.sub=null;S.entryAction='';S.page=1;S.scroll=0;run();}
   else if(k==='more'&&(b.dataset.value==='자료 발송 내역'||b.dataset.value==='영업 조건')){S.detailView=b.dataset.value==='자료 발송 내역'?'evidence':'confirmation';S.evidencePage=1;run();}
   else if(k==='stage-change'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal));
    if(d?.code!=='consulting')return w.toast('이 단계의 전환 화면은 승인된 원본과 공통 저장 조건을 확인 중입니다.');
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
    w.toast('등록 2~4단계와 서버 저장 연결이 아직 준비되지 않았습니다.');
   }
   else if(k==='e-card')w.toast(b.dataset.entry==='materials'?'사진·자료 입력 원본 화면과 업로드 연결을 확인 중입니다.':'일정 등록 원본 화면과 저장 연결을 확인 중입니다.');
   else if(k==='schedule-day'){if(!w.MobileScheduleModel?.dateOnly(b.dataset.date))return;S.scheduleDay=b.dataset.date;S.schedulePage=1;run();}
   else if(k==='day-close')w.toast('마감 저장·공유 확인 경로가 아직 연결되지 않았습니다.');
   else if(k==='day-close-page'){if(!Object.hasOwn(S.closePages,b.dataset.group))return;const n=Number(b.dataset.page);if(Number.isInteger(n)&&n>0){S.closePages[b.dataset.group]=n;run();}}
   else if(k==='stage'||k==='area'){S[k]=b.dataset.value;S.page=1;S.scroll=0;run();}
   else if(k==='page'){w.ListPager.set(S,null,b.dataset.page);S.scroll=0;run();}
   else if(k==='contact')openContact();
   else if(k==='contact-card')openContactCard();
   else if(k==='pending-task'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal)),n=next(d);
    // The existing PC task name identifies this workflow; never infer it from a free-form memo.
    if(n?.text==='견적 요청 등록'&&w.MobileQuoteFlow?.open(d,'K-1')){S.detailView='quote';run();}else unavailable();
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
   else if(k==='task'){if(!resetDetail())return;S.returnTab='today';if(b.dataset.kind==='deal'){if(b.dataset.requestId)openRequestedTask(b.dataset.id,b.dataset.requestId,taskClick);else{w.G.deal=b.dataset.id;run();}}else if(b.dataset.kind==='inquiry'){const r=w.MobileInquiryEntry?.open(inquiry(b.dataset.id));if(!r?.ok)w.toast(r?.error||'문의 응대 연결을 확인해 주세요.');}else unavailable();}
   else if(k==='phone'||k==='sms'){
    const d=mine().find(x=>String(x.id)===String(w.G.deal)),c=w.contactInfoM(d),phone=w.phoneN(c.mobile||c.officeTel);
    if(w.DEMO)return w.toast('예시 화면에서는 외부 앱을 실행하지 않습니다.');
    if(phone)w.location.href=(k==='phone'?'tel:':'sms:')+phone;
   }else unavailable();
  });
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-pending="page"]');if(!b)return;const n=Number(b.dataset.page);if(Number.isInteger(n)&&n>0){S.pendingPage=n;run();}});
  w.document.addEventListener('click',e=>{const b=e.target.closest('[data-schedule="page"],[data-registration="page"]');if(!b)return;const n=Number(b.dataset.page);if(Number.isInteger(n)&&n>0){if(b.hasAttribute('data-schedule'))S.schedulePage=n;else S.registrationPage=n;run();}});
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
 w.MobileGuideShell={show,state:S};
 if(w.document.readyState==='loading')w.document.addEventListener('DOMContentLoaded',boot);else boot();
})(window);
