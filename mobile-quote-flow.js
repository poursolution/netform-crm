/* Approved quote v3 screens. Read-only navigation and local review choices only.
 * No RPC, price arithmetic, schedule change, quote completion or outbound send. */
(function(w){
 'use strict';
 const kinds={'Q-S':'simple','Q-N':'standards','Q-T':'method','Q-M':'markup'};
 const screens=['K-1','K-2','K-3','K-4','K-5',...Object.keys(kinds)];
 const prefix='crm:mobile-quote-review:v1:',ttl=30*60*1000;
 let state=null;
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x),copy=x=>JSON.parse(JSON.stringify(x));
 const calendarDay=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!v.startsWith('0000-')&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 const fingerprint=d=>JSON.stringify({version:d.version,quotes:d.quote_versions??d.quoteVersions,contexts:d.stage_contexts??d.stageContexts,works:d.work_items??d.workItems});
 function calendarOptions(m){
  const today=new Date(Date.now()+9*36e5).toISOString().slice(0,10),add=w.ContactEntry?.addDays;
  const rows=typeof add==='function'?[['내일',add(today,1)],['3일 후',add(today,3)],['7일 후',add(today,7)]]:[];
  const selected=calendarDay(m.customerDue)?m.customerDue:(m.dates||[]).find(row=>calendarDay(row.date))?.date;
  if(selected&&!rows.some(row=>row[1]===selected)){const x=new Date(selected+'T00:00:00Z');rows.push([selected.slice(0,4)!==today.slice(0,4)?selected.replace(/-/g,'.'):'일월화수목금토'[x.getUTCDay()]+' '+(+selected.slice(5,7))+'.'+(+selected.slice(8,10)),selected]);}
  return rows;
 }
 function validDraft(d){
  if(!object(d)||Object.keys(d).some(k=>!['works','quantities','datePreset','customer_due','options'].includes(k)))throw Error('QUOTE_DRAFT_INVALID');
  for(const k of ['works','options'])if(k in d&&(!Array.isArray(d[k])||d[k].length>100||new Set(d[k]).size!==d[k].length||d[k].some(v=>typeof v!=='string'||!v||v.length>160)))throw Error('QUOTE_DRAFT_INVALID');
  if('quantities'in d&&(!object(d.quantities)||Object.keys(d.quantities).length>100||Object.entries(d.quantities).some(([k,v])=>k.length>160||typeof v!=='string'||v.length>300)))throw Error('QUOTE_DRAFT_INVALID');
  if('datePreset'in d&&d.datePreset!==null&&(typeof d.datePreset!=='string'||d.datePreset.length>160))throw Error('QUOTE_DRAFT_INVALID');
  if('customer_due'in d&&(typeof d.customer_due!=='string'||d.customer_due.length>10))throw Error('QUOTE_DRAFT_INVALID');
  return copy(d);
 }
 function scope(input){
  const j=w.MobileSaveJournal,p=w.Phase1?.profile,owner=j?.owner(),session=j?.session();
  if(!owner||owner!==p?.auth_uid+':'+p?.user_id||!session?.startsWith(owner+':'))throw Error('QUOTE_IDENTITY_CHANGED');
  const d=(w.myDeals?.()||[]).find(x=>String(x.id)===String(input?.id));
  if(!d||String(w.G?.deal)!==String(d.id))throw Error('QUOTE_SCOPE_CHANGED');
  return {owner,session,id:String(d.id),version:d.version,fingerprint:fingerprint(d),d};
 }
 const key=s=>prefix+s.owner+':'+s.id;
 function readDraft(s){
  const raw=w.sessionStorage.getItem(key(s));if(raw===null)return {draft:{},observed:null};
  const x=JSON.parse(raw);
  if(!object(x)||x.owner!==s.owner||x.target!==s.id||!Number.isFinite(x.at)||x.at<0||x.at>Date.now())throw Error('QUOTE_DRAFT_INVALID');
  // Expiry and explicit session changes invalidate recovery, never rebind it.
  if(Date.now()-x.at>=ttl||(typeof x.session==='string'&&x.session!==s.session)){
   w.sessionStorage.removeItem(key(s));if(w.sessionStorage.getItem(key(s))!==null)throw Error('QUOTE_DRAFT_STORAGE_UNAVAILABLE');
   return {draft:{},observed:null};
  }
  // Old drafts without session/provenance remain untouched rather than guessed.
  if(x.session!==s.session||x.version!==s.version||x.fingerprint!==s.fingerprint)throw Error('QUOTE_DRAFT_CONTEXT_CHANGED');
  return {draft:validDraft(x.draft),observed:raw};
 }
 function current(input){
  const s=scope(input);
  if(!state||state.owner!==s.owner||state.session!==s.session||state.id!==s.id||state.version!==s.version||state.fingerprint!==s.fingerprint)throw Error('QUOTE_VIEW_STALE');
  return s;
 }
 function open(input,screen,options={}){
  if(!screens.includes(screen)||typeof w.MobileQuoteReviewModel?.read!=='function')return false;
  if(reset().ok===false)return false;
  try{const s=scope(input),recovery=readDraft(s);state={...s,d:undefined,screen,quoteVersionId:options.quoteVersionId||'',back:[],...recovery,dirty:false,attempted:null,storageError:false};return true;}catch{state=null;return false;}
 }
 function read(input){
  const s=current(input),m=w.MobileQuoteReviewModel.read(s.d,state.screen,{quoteVersionId:state.quoteVersionId,draft:state.draft,page:state.page||1});
  if(!m?.ok)throw Error('QUOTE_READ_UNAVAILABLE');
  // The only enabled mutations here are local choices in explicitly scoped synthetic review.
  // Production saving remains blocked even when a fixture claims it is available.
  m.primaryEnabled=false;m.secondaryEnabled=false;
  m.canEdit=m.fixture===true&&state.screen==='K-1';
  m.optionsEnabled=m.fixture===true&&state.screen==='K-4';
  m.pdf={...m.pdf,enabled:false};
  if(state.screen==='K-1'){
   m.datePanel=state.datePanel===true;m.calendarValue=state.calendarValue||'';m.calendarValid=calendarDay(m.calendarValue);
   // Original picker shortcuts are candidates only; opening never changes the date.
   m.calendarOptions=calendarOptions(m);
   if(m.draftOnly&&m.customerDue)m.preview=(m.fixture?'합성 예시 · ':'')+'선택 날짜 '+m.customerDue+' · 미전송 초안 · 고객 약속·요청 저장 전';
  }
  if(state.screen==='K-5')m.versions=(m.versions||[]).map(row=>({...row,enabled:!!row.id}));
  if(state.screen==='K-3'){
   m.primaryEnabled=!!m.versionId; // Existing button opens the approved markup review; it never sends.
   m.preview=(m.fixture?'합성 예시 · ':'')+'제출금액 확인 화면으로 · 저장·발송 없음';
  }
  if(state.storageError)m.preview='입력 임시 보관 실패 · 현재 화면의 입력은 유지됩니다. 운영 저장 전입니다.';
  return m;
 }
 function render(input){
  try{
   const m=read(input),screen=state.screen;
   if(kinds[screen]){
    if(typeof w.MobileApprovedQuoteExtraSource?.[kinds[screen]]!=='string'||typeof w.MobileApprovedQuoteExtra?.render!=='function')return '';
    return w.MobileApprovedQuoteExtra.render(kinds[screen],m);
   }
   if(typeof w.MobileApprovedQuoteSource?.[screen]!=='string'||typeof w.MobileApprovedQuote?.render!=='function')return '';
   return w.MobileApprovedQuote.render(screen,m);
  }catch{return '';}
 }
 function preserve(input){
  try{
   const s=current(input);if(!state.dirty)return {ok:true};
   const prior=w.sessionStorage.getItem(key(s));
   if(prior!==state.observed&&(state.attempted===null||prior!==state.attempted))throw Error('QUOTE_DRAFT_CONFLICT');
   const raw=JSON.stringify({owner:s.owner,session:s.session,target:s.id,version:s.version,fingerprint:s.fingerprint,at:Date.now(),draft:validDraft(state.draft)});
   state.attempted=raw;w.sessionStorage.setItem(key(s),raw);current(input);
   if(w.sessionStorage.getItem(key(s))!==raw)throw Error('QUOTE_DRAFT_VERIFY_FAILED');
   state.observed=raw;state.attempted=null;state.dirty=false;state.storageError=false;return {ok:true};
  }catch(e){if(state)state.storageError=String(e.message||e);return {ok:false,error:String(e.message||e)};}
 }
 function back(input){
  try{current(input);if(state.datePanel){state.datePanel=false;delete state.calendarValue;return true;}if(state.back.length){Object.assign(state,state.back.pop());return true;}}catch{}
  return false;
 }
 function navigate(input,screen,version){
  current(input);state.back.push({screen:state.screen,quoteVersionId:state.quoteVersionId,page:state.page||1});state.screen=screen;state.page=1;if(version)state.quoteVersionId=version;
 }
 function handle(input,action,data={}){
  try{
   const m=read(input);
   if(action==='quote-send-prepare'&&state.screen==='K-3'){if(!m.versionId)throw Error('QUOTE_VERSION_UNAVAILABLE');navigate(input,'Q-M',m.versionId);return {ok:true,render:true};}
   if(action==='quote-version'&&state.screen==='K-5'){
    if(!(m.versions||[]).some(v=>String(v.id)===String(data.id)))throw Error('QUOTE_VERSION_CHANGED');
    navigate(input,'K-3',String(data.id));return {ok:true,render:true};
   }
   if(m.fixture!==true)throw Error('QUOTE_WRITE_CONTRACT_UNAVAILABLE');
   if(state.datePanel&&!action.startsWith('k1-calendar-'))throw Error('QUOTE_DATE_PANEL_OPEN');
   if(action==='k1-work'&&state.screen==='K-1'){
    if(!(m.works||[]).some(x=>x.id===data.id))throw Error('QUOTE_WORK_CHANGED');
    const items=new Set(state.draft.works||m.selectedWorkIds||[]);items.has(data.id)?items.delete(data.id):items.add(data.id);state.draft.works=[...items];
   }else if(action==='k1-date'&&state.screen==='K-1'){
    const row=(m.dates||[]).find(x=>x.id===data.id);if(!row)throw Error('QUOTE_DATE_CHANGED');
    if(row.action==='pick-date'){state.datePanel=true;state.calendarValue=m.customerDue||'';return {ok:true,render:true};}
    // A relative-date chip is only a local intent, never a confirmed calendar date.
    state.draft.datePreset=data.id;delete state.draft.customer_due;
   }else if(action==='k1-calendar-cancel'&&state.screen==='K-1'&&state.datePanel){
    state.datePanel=false;delete state.calendarValue;return {ok:true,render:true};
   }else if(action==='k1-calendar-option'&&state.screen==='K-1'&&state.datePanel){
    if(!m.calendarOptions.some(row=>row[1]===data.value))throw Error('QUOTE_DATE_CHANGED');
    state.calendarValue=data.value;return handle(input,'k1-calendar-confirm');
   }else if(action==='k1-calendar-confirm'&&state.screen==='K-1'&&state.datePanel){
    const picker=(m.dates||[]).find(row=>row.action==='pick-date');
    if(!picker||!calendarDay(state.calendarValue))return {ok:false,render:true,note:'실제 달력 날짜를 선택해 주세요. 기존 날짜는 유지됩니다.'};
    state.draft.datePreset=picker.id;state.draft.customer_due=state.calendarValue;state.datePanel=false;delete state.calendarValue;
   }else if(action==='quote-option'&&state.screen==='K-4'){
    if(!(m.options||[]).some(x=>x.id===data.id))throw Error('QUOTE_OPTION_CHANGED');
    const items=new Set(state.draft.options||m.selectedOptionIds||[]);items.has(data.id)?items.delete(data.id):items.add(data.id);state.draft.options=[...items];
   }else throw Error('QUOTE_WRITE_CONTRACT_UNAVAILABLE');
   state.dirty=true;const saved=preserve(input);return {ok:true,stored:saved.ok,render:true};
  }catch(e){return {ok:false,render:true,note:'현재 계정과 영업건의 견적 정보를 다시 확인해 주세요. 금액·일정·요청 상태는 변경하지 않았습니다.'};}
 }
 function quantity(input,id,value){
  try{const m=read(input);if(!m.fixture||state.screen!=='K-1'||!m.quantities?.some(q=>q.id===id&&q.editable===true))throw Error('QUOTE_QUANTITY_UNAVAILABLE');
   state.draft.quantities={...state.draft.quantities,[id]:String(value).slice(0,120)};state.dirty=true;const saved=preserve(input);return {ok:true,stored:saved.ok};
  }catch{return {ok:false,stored:false};}
 }
 function calendarDate(input,value){
  try{const m=read(input);if(!m.canEdit||state.screen!=='K-1'||!state.datePanel||typeof value!=='string'||value.length>10)throw Error('QUOTE_DATE_UNAVAILABLE');
   state.calendarValue=value;return {ok:true,valid:calendarDay(value)};
  }catch{return {ok:false,valid:false};}
 }
 function reset(options={}){
  if(!state)return {ok:true};
  const p=w.Phase1?.profile,j=w.MobileSaveJournal;
  if(!options.force&&(state.owner!==p?.auth_uid+':'+p?.user_id||j?.owner()!==state.owner||j?.session()!==state.session))return {ok:false,error:'QUOTE_IDENTITY_CHANGED'};
  if(!options.force&&state.dirty){const d=(w.myDeals?.()||[]).find(x=>String(x.id)===state.id),result=preserve(d);if(!result.ok)return result;}
  state=null;return {ok:true};
 }
 function syncContext(){
  if(!state)return;
  const view=w.MobileGuideShell?.state;
  try{current((w.myDeals?.()||[]).find(x=>String(x.id)===state.id));}
  catch{
   const p=w.Phase1?.profile,j=w.MobileSaveJournal;
   const identityChanged=state.owner!==p?.auth_uid+':'+p?.user_id||j?.owner()!==state.owner||j?.session()!==state.session;
   reset({force:true});
   // Inconsistent identity must stay closed until normal authentication cleanup.
   // A changed deal may return to its current approved detail, never its old quote.
   if(!identityChanged&&view?.detailView==='quote')view.detailView='';return;
  }
  if(view&&view.detailView!=='quote'&&reset().ok===false)view.detailView='quote';
 }
 function page(input,value){try{const m=read(input),n=Number(value);if(!Number.isInteger(n)||n<1||n>(m.pages||1))return false;state.page=n;return true;}catch{return false;}}
 w.addEventListener('phase1:identity-cleared',()=>{reset({force:true});try{Object.keys(w.sessionStorage).filter(k=>k.startsWith(prefix)).forEach(k=>w.sessionStorage.removeItem(k));}catch{}});
 w.addEventListener('pagehide',()=>{if(state?.dirty)preserve((w.myDeals?.()||[]).find(x=>String(x.id)===state.id));});
 w.MobileQuoteFlow=Object.freeze({open,render,handle,quantity,calendarDate,back,page,reset,syncContext,snapshot:()=>state?copy(state):null,screens:Object.freeze(screens),draftPrefix:prefix});
})(window);
