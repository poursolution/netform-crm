/* Approved I1-I3 orchestration. Explicit dictation/card recognition and unsent
 * draft recovery. No activity, task, contact-save or stage-completion mutation. */
(function(w){
 'use strict';
 let S=null,voice=null,cache=null,recognition=null,picker=null,contactTimer=null,contactLookup=null;
 const SCREENS=['I-1','I-2','I-3'],clone=x=>JSON.parse(JSON.stringify(x));
 const active=d=>!!S&&String(w.G?.deal)===String(d?.id)&&S.binding.dealId===String(d?.id)&&w.MobileInputReviewModel?.current(d,S.binding)?.ok===true;
 const repaint=()=>{if(w.MobileGuideShell?.state.detailView==='input')w.render();};
 function persist(){
  if(!S)return {ok:false};
  const value={screen:S.screen,draft:S.draft,session:S.session};if(S.originStamp)value.originStamp=S.originStamp;
  const result=cache?.ok?cache.write(value):{ok:false,error:'INPUT_DRAFT_STORAGE_UNAVAILABLE'};
  S.storageError=result.ok?'':result.error;
  return result;
 }
 function reset(options={}){
  // An untouched card has no user input to persist; storage quota must not trap it.
  const emptyCard=S?.screen==='I-3'&&Object.keys(S.draft).length===0;
  const result=S?(options.discard?(cache?.dispose?.()||{ok:true}):emptyCard?{ok:true}:persist()):{ok:true};
  // Navigation must not discard the only current copy after a failed write/delete.
  // Invalidated contexts and an already-applied D memo may force cleanup.
  if(result.ok===false&&!options.force){if(S)S.storageError=result.error;return result;}
  stopResources();cache?.release?.();cache=null;S=null;return result;
 }
 function stopResources(){
  cancelContactMatch();
  voice?.dispose();voice=null;recognition?.abort();recognition=null;picker?.remove();picker=null;
 }
 function pageHidden(){
  if(S){
   if(['starting','listening','stopping'].includes(S.session.state))S.session={...S.session,state:'error',error:'VOICE_DRAFT_INTERRUPTED',needsReview:true,partialSpeech:true};
   if(S.ocrBusy){S.ocrBusy=false;S.ocrError='CARD_RECOGNITION_INTERRUPTED';}
   if(S.contactMatch?.status==='loading')S.contactMatch={status:'failed',phone:S.contactMatch.phone};
  }
  // A page exit cannot be blocked. Stop providers even when storage fails.
  // Keep the scoped state for a page-cache return; a full reload reads the draft.
  stopResources();if(S)persist();
 }
 function open(d,screen='I-1',options={}){
  if(!SCREENS.includes(screen)||!w.MobileApprovedInputSource?.[screen]||!w.MobileApprovedInput?.render||!w.MobileVoiceSession||!w.MobileInputReviewModel)return false;
  const binding=w.MobileInputReviewModel.bind(d);if(!binding.ok)return false;
  if(options.draftHandle&&!w.MobileEntry?.inputDraftCurrent(options.draftHandle))return false;
  if(reset().ok===false)return false;
  cache=w.MobileInputDraft?.create(d,binding,{kind:screen==='I-3'?'card':'speech'})||null;
  // A failed recovery must not open an empty editor over protected input or
  // trap the user with a permanently failed cache. Retry via the same entry.
  if(cache?.ok!==true){cache?.release?.();cache=null;return false;}
  const recovered=cache.read();
  if(recovered?.ok!==true){cache.release?.();cache=null;return false;}
  const previous=recovered.value;
  S={binding,screen,draft:{},session:{state:'idle'},draftHandle:options.draftHandle||null,page:1,originStamp:options.draftHandle?.draftStamp||'',storageError:'',ocrBusy:false,contactMatch:null};
  const sameFamily=previous&&(previous.screen==='I-3')===(screen==='I-3');
  // A new opaque handle may only adopt a review captured from this exact D draft.
  const sameOrigin=!S.draftHandle||previous?.originStamp===S.draftHandle.draftStamp;
  if(previous&&S.draftHandle&&!sameOrigin){cache?.release?.();cache=null;S=null;return false;}
  if(sameFamily&&sameOrigin){Object.assign(S,{screen:previous.screen,draft:previous.draft,session:previous.session,originStamp:previous.originStamp||S.originStamp});if(S.screen==='I-1'&&S.draft.transcript)S.screen='I-2';}
  else if(S.draftHandle)S.draft.transcript=S.draftHandle.memo;
  if(S.draftHandle&&screen==='I-1'&&!w.MobileInputReviewModel.capabilities().speech.supported)S.screen='I-2';
  if(S.draftHandle)w.closeSheet();
  queueContactMatch(d);
  return true;
 }
 function model(d){
  if(!active(d))return null;
  const draft=clone(S.draft),tooLong=typeof draft.transcript==='string'&&draft.transcript.length>300;
  if(tooLong)draft.transcript=draft.transcript.slice(0,300);
  if(draft.fields)for(const key of Object.keys(draft.fields))draft.fields[key]=draft.fields[key].slice(0,key==='phone'?40:160);
  const m=w.MobileInputReviewModel.read(d,S.screen,{binding:S.binding,session:S.session,draft,ocr:S.draft.recognized,page:S.page,contactMatch:S.contactMatch||undefined});
  if(!m.ok)return null;
  if(S.draftHandle)m.title='연락 결과';
  m.suggestionLabel=m.fixture?'예시 후보':'연결 확인 필요';
  if(tooLong){m.transcript=S.draft.transcript;m.canTransfer=false;}
  if(S.screen==='I-3'){
   for(const field of m.fields||[]){const raw=S.draft.fields?.[field.id];if(typeof raw==='string'&&raw.length>(field.id==='phone'?40:160)){field.value=raw;field.uncertain=true;m.validationState='invalid';}}
   m.canCapture=w.DEMO!==true&&!S.ocrBusy&&w.MobileCardRecognition?.capabilities().supported===true;m.busy=S.ocrBusy;
   if(S.ocrBusy)m.photoLabel='명함 읽는 중';else if(S.photoName)m.photoLabel=S.photoName;
   if(S.draft.recognized&&Object.keys(S.draft.fields||{}).length)m.helper='직접 고친 값은 유지됩니다. 새 사진의 후보와 함께 확인해 주세요. 연락처는 아직 저장되지 않았습니다.';
   if(S.ocrError)m.helper='명함을 읽지 못했습니다. 입력은 유지됩니다. 사진 영역을 눌러 다시 시도해 주세요.';
   m.blockedReason='읽은 값은 확인 후보입니다. 기존 사람·현장 연결과 회사 필드 저장 계약은 확인 중입니다.';
  }
  if(S.screen==='I-2'){
   m.canSave=!!S.draftHandle&&m.canTransfer===true&&w.MobileEntry.inputDraftCurrent(S.draftHandle);
   if(S.draftHandle){m.saveMode='text-only';m.saveLabel='입력에 반영';m.preview='상담 내용만 이어받기 · 응대 저장은 다음 화면에서';}
   if(S.session.truncated||tooLong)m.preview='긴 내용입니다. 300자 이내로 직접 고친 뒤 확인해 주세요.';
   else if(S.session.needsReview||S.session.partialSpeech)m.preview='중단된 말하기입니다. 남은 문장을 직접 고친 뒤 확인해 주세요.';
   m.blockedReason=S.draftHandle?'상담 내용만 기존 입력에 반영합니다. 일정·요청은 바꾸지 않습니다.':'화면 동작 확인용 예시입니다. 응대 저장·업무 완료는 실행하지 않습니다.';
  }
  if(S.storageError){const note='기기 임시 보관 실패 · 현재 입력은 유지됩니다.';if(S.screen==='I-1')m.statusText=note;else if(S.screen==='I-2')m.preview=note;else m.helper=note;}
  return m;
 }
 function cancelContactMatch(){
  if(contactTimer!==null)w.clearTimeout(contactTimer);contactTimer=null;
  contactLookup?.abort();contactLookup=null;
 }
 function refreshContactNote(d){
  if(!active(d)||S.screen!=='I-3'||w.MobileGuideShell?.state.detailView!=='input')return;
  // Keep the focused editable node and caret. Update only Claude's existing note.
  const m=model(d),note=w.document?.querySelector('[data-contact-match-note]');
  if(note&&m)note.textContent=m.duplicateNote;
 }
 function queueContactMatch(d){
  if(!active(d)||S.screen!=='I-3')return;
  const field=model(d)?.fields?.find(x=>x.id==='phone'),n=field&&field.value.length<=40?w.MobileInputReviewModel.normalizePhone(field.value):'';
  if(w.DEMO===true){cancelContactMatch();S.contactMatch=null;return;}
  if(n&&S.contactMatch?.phone===n&&['loading','ready'].includes(S.contactMatch.status))return;
  cancelContactMatch();S.contactMatch=null;
  if(!n)return;
  if(typeof w.ContactMatchReader?.read!=='function'){S.contactMatch={status:'failed',phone:n};return;}
  const state=S,controller=new AbortController();contactLookup=controller;S.contactMatch={status:'loading',phone:n};
  const current=()=>S===state&&active(d)&&S.screen==='I-3'&&w.MobileGuideShell?.state.detailView==='input'&&contactLookup===controller&&!controller.signal.aborted&&S.contactMatch?.phone===n;
  contactTimer=w.setTimeout(async()=>{
   contactTimer=null;if(!current())return;
   let result;try{result=await w.ContactMatchReader.read({dealId:d.id,expectedVersion:d.version,phone:n,page:1,signal:controller.signal,isCurrent:current});}catch{result={ok:false,status:'failed'};}
   if(!current())return;
   S.contactMatch=result?.ok===true?result:{status:'failed',phone:n};contactLookup=null;
   refreshContactNote(d);
  },300);
 }
 function render(d){try{const m=model(d);return m?w.MobileApprovedInput.render(S.screen,m):'';}catch{return '';}}
 function clearInputView(){if(w.MobileGuideShell?.state.detailView==='input')w.MobileGuideShell.state.detailView='';}
 function leave(d,options={}){
  if(!active(d)){reset({force:true});clearInputView();return {ok:false,render:true,note:'계정·영업건이 변경되어 입력을 반영하지 않았습니다.'};}
  const restore=!!S.draftHandle,result=reset({discard:options.discard===true});
  if(result.ok===false)return {ok:false,render:true,note:'임시 보관을 확인하지 못해 현재 입력 화면을 유지합니다.'};
  clearInputView();w.render();if(restore)w.MobileEntry.open();return {ok:true,render:false};
 }
 function back(d){
  if(!active(d))return leave(d);
  if(S.screen==='I-2'){voice?.dispose();voice=null;S.screen='I-1';S.session={...S.session,state:'idle'};persist();return {ok:true,render:true};}
  return leave(d);
 }
 function speak(d){
  if(!active(d)||S.screen!=='I-1')return {ok:false};
  const m=model(d);if(!m?.canSpeak)return {ok:false,note:'이 기기에서는 말하기를 사용할 수 없습니다. 기존 상담 입력에서 직접 적어 주세요.'};
  if(['starting','listening','stopping'].includes(S.session.state)){voice?.stop();return {ok:true};}
  const state=S,base=m.transcript||'',remaining=10000-base.length-(base?1:0);
  const baseNeedsReview=!!base&&S.draft.manuallyEdited!==true&&(S.session.needsReview===true||S.session.partialSpeech===true||S.session.truncated===true||!!S.session.interimText);
  const basePartial=S.session.partialSpeech===true||!!S.session.interimText;
  const withBaseReview=s=>baseNeedsReview?{...s,needsReview:true,partialSpeech:basePartial||s.partialSpeech===true}:s;
  voice?.dispose();voice=null;
  // The existing memo and the provider candidate share one recovery budget.
  // Never start another recognition session that cannot be preserved intact.
  if(remaining<=0){S.screen='I-2';S.session={...S.session,state:'error',truncated:true,needsReview:true,error:'VOICE_TEXT_LIMIT'};persist();return {ok:false,render:true,note:'보관할 수 있는 글자 수에 도달했습니다. 현재 내용을 직접 고친 뒤 이어서 말해 주세요.'};}
  voice=w.MobileVoiceSession.create({maxLength:remaining,getScope:()=>JSON.stringify([w.MobileSaveJournal?.owner(),w.MobileSaveJournal?.session(),w.G?.deal]),isCurrent:()=>S===state&&active(d)&&w.MobileGuideShell?.state.detailView==='input'});
  const current=()=>S===state&&active(d);
  const update=s=>{if(!current())return;S.session=withBaseReview(s);const joined=[base,s.text].filter(Boolean).join('\n');S.draft.transcript=joined;S.draft.manuallyEdited=false;if(joined.length>300)S.session={...S.session,truncated:true};persist();};
  voice.start({onState:s=>{if(!current())return;S.session=withBaseReview(s);persist();repaint();},onResult:s=>{update(s);repaint();},onEnd:s=>{if(!current())return;update(s);S.screen='I-2';persist();repaint();},onError:s=>{if(!current())return;update(s);S.session.needsReview=true;S.screen='I-2';persist();repaint();w.toast('말하기를 마치지 못했습니다. 남은 문장을 확인하고 직접 고쳐 주세요.');}});
  return {ok:true};
 }
 async function recognize(d,file){
  if(!active(d)||S.screen!=='I-3'||S.ocrBusy)return {ok:false};
  cancelContactMatch();S.contactMatch=null;
  const state=S,controller=new AbortController();recognition=controller;S.ocrBusy=true;S.ocrError='';repaint();
  let result;
  try{result=await w.MobileCardRecognition.recognize({deal:d,binding:S.binding,file,userInitiated:true,signal:controller.signal,isCurrent:()=>S===state&&active(d)&&w.MobileGuideShell?.state.detailView==='input'});}catch{result={ok:false,error:'CARD_RECOGNITION_FAILED'};}
  if(S!==state||!active(d)||controller.signal.aborted)return {ok:false};
  recognition=null;S.ocrBusy=false;
  if(result.ok){S.draft.recognized=result.suggestion;S.photoName=String(file.name||'명함 사진');persist();}
  else S.ocrError=result.error||'CARD_RECOGNITION_FAILED';
  queueContactMatch(d);repaint();return result;
 }
 function photo(d){
  if(!model(d)?.canCapture)return {ok:false,note:'이 기기 또는 예시 화면에서는 명함 인식을 사용할 수 없습니다.'};
  picker?.remove();const state=S,node=w.document.createElement('input');picker=node;node.type='file';node.accept='image/jpeg,image/png,image/webp';node.setAttribute('capture','environment');node.hidden=true;
  node.addEventListener('change',()=>{const current=S===state&&picker===node&&active(d)&&w.MobileGuideShell?.state.detailView==='input',file=node.files?.[0];node.remove();if(picker===node)picker=null;if(current&&file)void recognize(d,file);},{once:true});
  w.document.body.append(node);node.click();return {ok:true};
 }
 function handle(d,key,data={}){
  if(!active(d))return {ok:false,note:'계정·영업건·입력 상태를 다시 확인해 주세요.',render:true};
  if(key==='input-cancel')return leave(d,{discard:true});
  if(key==='input-mic')return speak(d);
  if(key==='input-manual'){
   if(S.screen!=='I-1')return {ok:false};voice?.dispose();voice=null;
   S.screen='I-2';S.session={...S.session,state:'ended',needsReview:true};persist();return {ok:true,render:true,focusTranscript:true};
  }
  if(key==='input-card-photo')return photo(d);
  if(key==='input-date-candidate')return {ok:false,note:'날짜를 자동으로 확정하지 않습니다. 다음 업무 입력에서 실제 날짜를 확인해 주세요.'};
  if(key==='input-candidate'){
   const m=model(d),candidate=m?.candidates?.find(x=>x.id===data.id);
   if(!candidate||candidate.kind==='stage')return {ok:false,note:'단계를 자동으로 바꾸지 않습니다.'};
   const selected=new Set(S.draft.selectedIds||[]);selected.has(data.id)?selected.delete(data.id):selected.add(data.id);S.draft.selectedIds=[...selected];persist();return {ok:true,render:true};
  }
  if(key==='input-review-save'){
   const m=model(d);if(!m?.canSave)return {ok:false,note:m?.blockedReason||'입력 상태를 다시 확인해 주세요.'};
   const result=w.MobileEntry.applyInputDraft(S.draftHandle,m.transcript);
   if(!result.ok)return {ok:false,note:'기존 입력이 바뀌었거나 임시 보관에 실패했습니다. 기존 입력을 확인해 주세요.'};
   reset({discard:true,force:true});clearInputView();w.render();return {ok:true,render:false};
  }
  return {ok:false,note:'명함 인식·사람 연결·저장 확인 경로는 아직 연결 중입니다.'};
 }
 function input(d,key,value){
  if(!active(d)||typeof value!=='string'||S.ocrBusy)return {ok:false};
  if(key==='transcript'&&S.screen!=='I-3'){
   // Manual editing ends recognition; a late provider result cannot overwrite edits.
   voice?.dispose();voice=null;S.draft.transcript=value;S.draft.manuallyEdited=true;S.session={state:'ended',truncated:value.length>300};
  }else if(S.screen==='I-3'&&['name','role','phone','company'].includes(key)){
   S.draft.fields={...S.draft.fields,[key]:value};
  }else return {ok:false};
  if(S.screen==='I-3'&&key==='phone')queueContactMatch(d);
  const stored=persist();return {ok:true,stored:stored.ok,model:model(d)};
 }
 function page(d,n){if(active(d)&&Number.isInteger(Number(n))&&Number(n)>0)S.page=Number(n);}
 function syncContext(){
  if(!S){clearInputView();return;}
  const d=w.myDeals?.().find(x=>String(x.id)===S.binding.dealId);
  if(!active(d)){reset({force:true});clearInputView();}
  else if(w.MobileGuideShell?.state.detailView!=='input'&&reset().ok===false&&w.MobileGuideShell)w.MobileGuideShell.state.detailView='input';
 }
 w.addEventListener('phase1:identity-cleared',()=>{reset({discard:true,force:true});clearInputView();});w.addEventListener('pagehide',pageHidden);
 w.addEventListener('pageshow',()=>{if(S){syncContext();repaint();}});
 w.MobileInputFlow=Object.freeze({open,render,handle,back,input,page,reset,syncContext,snapshot:()=>S?clone({screen:S.screen,draft:S.draft,session:S.session}):null});
})(window);
