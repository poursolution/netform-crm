/* Approved I1-I3 data projection only. No microphone permission, OCR request,
 * server/local storage write, inferred completion, date arithmetic or identity merge. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobileInputReviewModel=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,SCREENS=['I-1','I-2','I-3'];
 const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),str=v=>typeof v==='string'?v:'',valid=v=>typeof v==='string'&&UUID.test(v),fail=c=>{throw Error(c);},copy=v=>JSON.parse(JSON.stringify(v));
 const BLOCK='입력 확인만 진행합니다. 응대·일정·요청·연락처 저장은 실행하지 않습니다.';
 function day(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';const n=Date.parse(v+'T00:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v?v:'';}
 function text(v,n=300){if(v===undefined||v===null)return '';if(typeof v!=='string'||v.length>n)fail('INPUT_TEXT_INVALID');return v;}
 function identity(){const p=root.Phase1?.profile,j=root.MobileSaveJournal;if(!valid(p?.auth_uid)||!valid(p?.user_id)||typeof j?.owner!=='function'||typeof j?.session!=='function')fail('INPUT_LOGIN_REQUIRED');const owner=p.auth_uid+':'+p.user_id,sessionToken=j.session();if(j.owner()!==owner||typeof sessionToken!=='string'||!sessionToken.startsWith(owner+':'))fail('INPUT_IDENTITY_INVALID');return {owner,sessionToken};}
 function fingerprint(d){return JSON.stringify({id:d.id,version:d.version,code:d.code,site_id:d.site_id,contact_id:d.contact_id,person_key:d.person_key,contacts:d.contacts,contact:d.contact,nextAction:d.nextAction,openNextActions:d.openNextActions});}
 function scope(input){const a=identity();if(!root.G?.user||root.G.mode!=='rep'||!(root.LIVE===true||root.DEMO===true))fail('INPUT_REP_SCOPE_REQUIRED');if(!valid(input?.id)||typeof root.myDeals!=='function')fail('INPUT_TARGET_INVALID');const list=root.myDeals();if(!Array.isArray(list))fail('INPUT_SCOPE_INVALID');const matches=list.filter(d=>d?.id===input.id);if(matches.length!==1)fail('INPUT_TARGET_NOT_SCOPED');const d=matches[0],fp=fingerprint(d);if(fingerprint(input)!==fp)fail('INPUT_STALE_TARGET');return {...a,d,list,fingerprint:fp};}
 function check(s){const list=root.myDeals(),a=identity();if(a.owner!==s.owner||a.sessionToken!==s.sessionToken||root.G?.mode!=='rep'||!root.G?.user||!Array.isArray(list)||list.filter(d=>d?.id===s.d.id).length!==1||fingerprint(list.find(d=>d?.id===s.d.id))!==s.fingerprint)fail('INPUT_CONTEXT_CHANGED');}
 function bindingMatches(s,b){return obj(b)&&b.ok===true&&b.owner===s.owner&&b.sessionToken===s.sessionToken&&b.dealId===s.d.id&&b.fingerprint===s.fingerprint;}
 function bind(d){try{const s=scope(d);check(s);return Object.freeze({ok:true,owner:s.owner,sessionToken:s.sessionToken,dealId:s.d.id,fingerprint:s.fingerprint});}catch(e){return {ok:false,error:String(e.message||e)};}}
 function current(d,binding){try{const s=scope(d);if(!bindingMatches(s,binding))fail('INPUT_BINDING_STALE');check(s);return {ok:true};}catch(e){return {ok:false,error:String(e.message||e)};}}
 function capabilities(){
  // Feature presence only. Never instantiate recognition or query/request permissions here.
  try{const secure=root.isSecureContext===true,speech=secure&&typeof (root.SpeechRecognition||root.webkitSpeechRecognition)==='function',imageFile=typeof root.FileReader==='function'&&typeof root.Image==='function';
   return {ok:true,speech:{supported:speech,permission:'not-requested'},image:{supported:imageFile,permission:'not-requested'},ocr:{supported:false,status:'contract-unverified'},autoCompletion:false};
  }catch{return {ok:false,speech:{supported:false,permission:'unknown'},image:{supported:false,permission:'unknown'},ocr:{supported:false,status:'unknown'},autoCompletion:false};}
 }
 function phone(v){if(typeof v!=='string'||!/^\s*(?:\+82|0)[0-9\s()-]+\s*$/.test(v))return '';let n=v.replace(/[\s()-]/g,'');if(n.startsWith('+82'))n='0'+n.slice(3);return /^010\d{8}$/.test(n)?n:'';}
 function dates(value){const re=/\d{4}-\d{2}-\d{2}|(?:이번\s*주|다음\s*주|다다음\s*주|내일|모레|오늘|[월화수목금토일]요일|\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*\/\s*\d{1,2})/g;return [...value.matchAll(re)].map(m=>({id:'date-'+m.index+'-'+m[0],text:m[0],offset:m.index,confirmed:false,date:null}));}
 function page(model,rows,p){if(rows.length<=20)return {...model,candidates:rows};if(typeof root.ListPager?.cut!=='function'||typeof root.ListPager?.html!=='function')fail('INPUT_PAGER_UNAVAILABLE');const pg=root.ListPager.cut(rows,p||1);return {...model,candidates:pg.rows,pager:root.ListPager.html(pg,{ns:'input-review',unit:'개'}),page:pg.page,pages:pg.pages,total:pg.total};}
 // Demo-only loaded examples. Live identity candidates come from the shared scoped RPC.
 function duplicates(s,value){
  const n=phone(value);if(!n)return [];const hits=new Map();
  for(const d of s.list){
   if(!valid(d?.id))continue;if(d.contacts!==undefined&&!Array.isArray(d.contacts))fail('INPUT_CONTACT_ROWS_INVALID');
   for(const c of d.contacts||[]){
    if(!obj(c)||c.opportunity_id&&c.opportunity_id!==d.id||c.deal_id&&c.deal_id!==d.id)continue;
    if(phone(c.mobile)!==n&&phone(c.phone)!==n&&phone(c.manager_mobile)!==n)continue;
    // A key without a verified contact UUID is not a person count.
    const id=valid(c.contact_id)?c.contact_id.toLowerCase():valid(c.id)?c.id.toLowerCase():'';if(!id)continue;
    const h=hits.get(id)||{contactId:id,personKey:str(c.person_key)||null,name:str(c.name||c.manager_name),sites:[],canLink:false};
    if(!h.sites.some(x=>x.dealId===d.id.toLowerCase()))h.sites.push({dealId:d.id.toLowerCase(),siteId:valid(d.site_id)?d.site_id.toLowerCase():null,label:str(d.nm||d.name||d.site)});
    hits.set(id,h);
   }
  }
  return [...hits.values()];
 }
 function contactMatch(s,value,match){
  const n=phone(value),empty={duplicates:[],coverage:'unknown'};
  if(!n)return {...empty,duplicateNote:'휴대폰 번호를 확인하면 기존 연락처 후보를 조회합니다.'};
  if(root.DEMO===true){const found=duplicates(s,value);return {duplicates:found,coverage:'synthetic-loaded-records',duplicateNote:found.length?'예시에서 같은 번호의 연락처 후보 '+found.length+'명 · 자동으로 합치거나 새로 만들지 않습니다.':'합성 예시의 연락처만 확인합니다. 운영 연락처 조회는 실행하지 않습니다.'};}
  if(!obj(match)||match.phone!==n)return {...empty,duplicateNote:'기존 연락처 후보 조회가 필요합니다. 미조회 상태는 중복 없음이 아닙니다.'};
  if(match.status==='loading')return {...empty,duplicateNote:'조회 가능한 영업건의 기존 연락처 후보를 확인하는 중입니다.'};
  if(match.status!=='ready'||match.ok!==true||match.contract!=='contact-match-read-v1'||match.scope!=='authorized_deals_only'||match.object_id!==s.d.id.toLowerCase()||match.object_version!==s.d.version||match.actor_auth_uid+':'+match.actor_user_id!==s.owner.toLowerCase()||!Number.isSafeInteger(match.total)||match.total<0||!Array.isArray(match.candidates))return {...empty,duplicateNote:'기존 연락처 후보를 확인하지 못했습니다. 번호와 연결 상태를 다시 확인해 주세요.'};
  return {duplicates:copy(match.candidates),coverage:'authorized-deals-server',duplicateNote:match.total?'조회 가능한 영업건에서 같은 번호의 연락처 후보 '+match.total+'명 · 동일인 여부는 확인이 필요합니다.':'조회 가능한 영업건에서 같은 번호의 연락처 후보 0명 · 전체 연락처가 없다는 뜻은 아닙니다.'};
 }
 function read(d,screen,options={}){
  try{
   if(!SCREENS.includes(screen)||!obj(options))fail('INPUT_SCREEN_INVALID');const s=scope(d),caps=capabilities(),o=options;
   if(o.binding!==undefined&&!bindingMatches(s,o.binding))fail('INPUT_BINDING_STALE');
   if([o.session,o.draft,o.ocr,o.suggestion,o.contactMatch].some(v=>v!==undefined)&&!bindingMatches(s,o.binding))fail('INPUT_BINDING_REQUIRED');
   const session=o.session||{},draft=o.draft||{};if(!obj(session)||!obj(draft))fail('INPUT_DRAFT_INVALID');
   const ex=root.__approvedInputExample,fixture=root.DEMO===true&&obj(ex)&&ex.owner===s.owner&&ex.dealId===s.d.id&&obj(ex.models?.[screen])?copy(ex.models[screen]):null;
   const context=[str(s.d.work_type||s.d.work),str(s.d.nm||s.d.name||s.d.site)].filter(Boolean).join(' · ');
   let model={ok:true,status:'ready',screen,targetId:s.d.id,context,fixture:!!fixture,capabilities:caps,blockedReason:BLOCK,canSave:false,canTransfer:false,canCapture:false,canSpeak:false,recording:false,preview:fixture?'합성 입력 예시 · 운영 저장 없음':'입력 확인 · 운영 저장 없음',pager:'',coverage:'current-rep-loaded-records'};
   if(fixture)model={...model,...fixture,targetId:s.d.id,fixture:true,canSave:false,canTransfer:false,canCapture:false,canSpeak:false,blockedReason:BLOCK};
   const supplied=Object.hasOwn(draft,'transcript')?text(draft.transcript):Object.hasOwn(session,'text')?text(session.text):text(model.transcript);
   if(screen==='I-1'||screen==='I-2'){
    const state=str(session.state)||'idle',active=['starting','listening','stopping'].includes(state),invalid=['invalidated','disposed','cancelled'].includes(state);
    model.transcript=invalid?'':supplied;model.recording=active;model.canSpeak=caps.speech.supported&&!invalid;
    model.micLabel=active?'그만':'누르고 말하기';model.statusText=active?'담당자의 메모를 듣고 있습니다.':state==='error'?'음성 인식이 중단됐습니다. 직접 고쳐 주세요.':invalid?'말하기를 취소했습니다.':model.transcript?'글자로 바꾼 내용을 확인하고 고쳐 주세요.':caps.speech.supported?'누른 뒤 방문·통화 결과를 말해 주세요.':'이 기기는 말하기를 지원하지 않습니다. 직접 적어 주세요.';
    if(screen==='I-2'){
     let candidates=fixture&&Array.isArray(fixture.candidates)?fixture.candidates:[];
     // Only an already-returned PC memo_tidy suggestion is projected; no keyword-to-task inference.
     const suggestion=o.suggestion?.suggestion?.suggestion||o.suggestion?.suggestion||o.suggestion;
     model.suggestionBasis=suggestion!==undefined?'received-pc-ai-suggestion':fixture?'approved-synthetic-example':'unavailable';
     model.suggestionLabel=suggestion!==undefined?'AI 확인 후보':fixture?'예시 후보':'연결 확인 필요';
     if(suggestion!==undefined){if(!obj(suggestion))fail('INPUT_SUGGESTION_INVALID');const nx=suggestion.next;if(obj(nx)&&str(nx.text).trim())candidates=[{id:'suggested-followup',kind:'followup',title:text(nx.text,60),detail:day(nx.date)?'AI 후보 · '+nx.date+' · 날짜 확인 필요':'AI 후보 · 날짜 확인 필요',proposedDate:day(nx.date)||null}];else candidates=[];}
     const ids=new Set();candidates=candidates.map(c=>{if(!obj(c)||!str(c.id)||ids.has(c.id)||!['visit','quote_request','followup','stage'].includes(c.kind))fail('INPUT_CANDIDATE_INVALID');ids.add(c.id);return {...c,title:text(c.title,160),detail:text(c.detail,300),canSelect:c.kind!=='stage',confirmed:false};});
     const selected=Object.hasOwn(draft,'selectedIds')?draft.selectedIds:[];if(!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.some(id=>!candidates.some(c=>c.id===id&&c.canSelect)))fail('INPUT_SELECTION_INVALID');
     const dc=dates(model.transcript);model.dateCandidates=dc;model.dateCandidate=dc[0]||null;model.dateConfirmed=false;model.confirmedDate=null;
     if(draft.dateConfirmed===true){if(!day(draft.confirmedDate)||!dc.some(x=>x.id===draft.dateCandidateId))fail('INPUT_DATE_CONFIRMATION_INVALID');model.dateConfirmed=true;model.confirmedDate=draft.confirmedDate;}
     const manuallyEdited=draft.manuallyEdited===true;
     model.selectedIds=selected.slice();model.canTransfer=!!model.transcript.trim()&&!active&&!invalid&&(session.truncated!==true||manuallyEdited)&&(!str(session.interimText)||manuallyEdited)&&(!(session.partialSpeech===true||session.needsReview===true)||manuallyEdited);
     model.selectionReady=candidates.every(c=>!selected.includes(c.id)||c.kind!=='followup'||model.dateConfirmed);
     model.preview=selected.length?'후보 '+selected.length+'개 선택 · 응대·일정·요청은 아직 저장되지 않았습니다.':'상담 내용 확인 · 단계·일정·요청을 자동 완료하지 않습니다.';
     model=page(model,candidates,o.page);
    }
   }else{
    const raw=o.ocr?.suggestion?.suggestion||o.ocr?.suggestion||o.ocr;if(raw!==undefined&&!obj(raw))fail('INPUT_OCR_INVALID');
    const source=fixture&&Array.isArray(fixture.fields)?fixture.fields:[],labels={name:'이름',role:'역할',phone:'휴대폰',company:'회사'};
    const values=raw?{name:text(raw.name,60),role:text(raw.role,60),phone:text(raw.mobile,40),company:''}:Object.fromEntries(source.map(x=>[x.id,text(x.value,160)]));
    const changes=draft.fields||{};if(!obj(changes)||Object.keys(changes).some(k=>!Object.hasOwn(labels,k)))fail('INPUT_OCR_FIELD_INVALID');
    model.fields=Object.keys(labels).map(id=>{const original=source.find(x=>x.id===id),changed=Object.hasOwn(changes,id),value=changed?text(changes[id],id==='phone'?40:160):values[id]||'',format=id==='phone'?!!phone(value):!!value.trim();return {id,label:labels[id],value,uncertain:!format||!changed&&original?.uncertain===true,provenance:changed?'manual':raw?'ocr-candidate':fixture?'synthetic-example':'unavailable'};});
    model.siteId=valid(s.d.site_id)?s.d.site_id:'';model.siteLabel=str(s.d.nm||s.d.name||s.d.site)||'현장 연결 확인 필요';
    Object.assign(model,contactMatch(s,model.fields.find(f=>f.id==='phone').value,o.contactMatch));
    model.photoLabel=str(model.photoLabel)||'명함 읽기 연결 확인 필요';model.helper='읽은 값은 후보입니다. 불명확한 항목을 고쳐도 연락처 저장은 별도 확인이 필요합니다.';
    model.validationState=model.siteId&&model.fields.every(f=>f.uncertain===false)?'valid':'invalid';model.canSave=false;model.canCapture=false;
   }
   check(s);return model;
  }catch(e){return {ok:false,status:'read-error',screen,error:String(e.message||e),targetId:'',context:'현재 입력 정보를 확인하지 못했습니다.',transcript:'',candidates:[],selectedIds:[],fields:[],canSave:false,canTransfer:false,canSpeak:false,canCapture:false,validationState:'invalid',blockedReason:'계정·영업건·입력 상태를 다시 확인해 주세요.',coverage:'unknown',pager:''};}
 }
 return Object.freeze({bind,current,read,capabilities,normalizePhone:phone});
});
