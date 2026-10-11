/* Tab-local, unsent I1-I3 input recovery only. Never a pending operation.
 * Browser: MobileInputDraft.create(deal, MobileInputReviewModel.bind(deal)).
 * Node: require('./mobile-input-draft.js')(root, {now?}).
 * Handles expose read/write/drop/dispose/release; all return {ok,...}, never send data.
 * pagehide deliberately keeps text. Explicit cancel/success calls drop/dispose.
 * Auth tokens, opaque D handles, raw audio and images are not accepted or stored.
 */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory;
 else root.MobileInputDraft=factory(root);
})(typeof window==='object'?window:globalThis,function(root,options){
 'use strict';
 options=options||{};
 const PREFIX='crm:mobile-input-draft:v1:',TTL=30*60*1000,KIND='unsent-input-draft';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const SCREENS=['I-1','I-2','I-3'],STATES=['idle','starting','listening','stopping','ended','error','cancelled','invalidated','disposed','unsupported'];
 const now=typeof options.now==='function'?options.now:Date.now,handles=new Set();
 let disposed=false,seenOwner='',seenSession='';
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),copy=v=>JSON.parse(JSON.stringify(v));
 function fail(code){const e=Error(code);e.code=code;throw e;}
 function resultError(e){return {ok:false,error:String(e?.code||e?.message||'INPUT_DRAFT_ERROR')};}
 function only(value,keys){if(!object(value)||Object.keys(value).some(key=>!keys.includes(key)))fail('INPUT_DRAFT_VALUE_INVALID');}
 function text(value,max){if(typeof value!=='string'||value.length>max)fail('INPUT_DRAFT_VALUE_INVALID');return value;}
 function boolean(value){if(value!==undefined&&typeof value!=='boolean')fail('INPUT_DRAFT_VALUE_INVALID');return value===true;}
 function clock(){const value=now();if(!Number.isFinite(value)||value<0)fail('INPUT_DRAFT_CLOCK_INVALID');return value;}
 function storage(){try{const s=root.sessionStorage;if(!s||typeof s.getItem!=='function'||typeof s.setItem!=='function'||typeof s.removeItem!=='function'||typeof s.key!=='function')throw Error();return s;}catch{fail('INPUT_DRAFT_STORAGE_UNAVAILABLE');}}
 function get(s,key){try{return s.getItem(key);}catch{fail('INPUT_DRAFT_STORAGE_UNAVAILABLE');}}
 function remove(s,key){try{s.removeItem(key);if(s.getItem(key)!==null)throw Error();}catch{fail('INPUT_DRAFT_STORAGE_UNAVAILABLE');}}
 function purge(){const s=storage();for(let i=s.length-1;i>=0;i--){const key=s.key(i);if(key?.startsWith(PREFIX))remove(s,key);}}
 function invalidate(){for(const handle of handles)handle.invalid=true;}
 function identity(){
  const p=root.Phase1?.profile,j=root.MobileSaveJournal;
  if(!UUID.test(String(p?.auth_uid||''))||!UUID.test(String(p?.user_id||''))||typeof j?.owner!=='function'||typeof j?.session!=='function')fail('INPUT_DRAFT_LOGIN_REQUIRED');
  const owner=p.auth_uid+':'+p.user_id,sessionToken=j.session();
  if(j.owner()!==owner||typeof sessionToken!=='string'||!sessionToken.startsWith(owner+':')||sessionToken.length>300)fail('INPUT_DRAFT_IDENTITY_INVALID');
  return {owner,sessionToken};
 }
 function syncIdentity(){
  if(disposed)fail('INPUT_DRAFT_DISPOSED');
  const actor=identity();
  if(seenOwner&&(seenOwner!==actor.owner||seenSession!==actor.sessionToken)){invalidate();purge();}
  seenOwner=actor.owner;seenSession=actor.sessionToken;return actor;
 }
 function profileChanged(){
  try{syncIdentity();}catch{invalidate();try{purge();}catch{}seenOwner='';seenSession='';}
 }
 function identityCleared(){invalidate();try{purge();}catch{}seenOwner='';seenSession='';}
 root.addEventListener?.('phase1:profile',profileChanged);
 root.addEventListener?.('phase1:identity-cleared',identityCleared);
 // Initialisation does not require login or touch storage.
 try{const actor=identity();seenOwner=actor.owner;seenSession=actor.sessionToken;}catch{}
 function normalize(value,recover=false){
  only(value,['screen','draft','session','originStamp']);if(!SCREENS.includes(value.screen))fail('INPUT_DRAFT_VALUE_INVALID');
  const input=value.draft||{},source=value.session||{};
  only(input,['transcript','fields','selectedIds','manuallyEdited','recognized']);
  only(source,['state','text','finalText','interimText','truncated','error','supported','partialSpeech','needsReview']);
  const draft={},session={state:source.state===undefined?'idle':source.state};
  if(!STATES.includes(session.state))fail('INPUT_DRAFT_VALUE_INVALID');
  if(Object.hasOwn(input,'transcript'))draft.transcript=text(input.transcript,10000);
  if(Object.hasOwn(input,'fields')){only(input.fields,['name','role','phone','company']);draft.fields={};for(const key of Object.keys(input.fields))draft.fields[key]=text(input.fields[key],2000);}
  if(Object.hasOwn(input,'recognized')){only(input.recognized,['name','role','mobile','office','email','note']);draft.recognized={};for(const key of Object.keys(input.recognized))draft.recognized[key]=text(input.recognized[key],key==='note'?2000:500);}
  if(Object.hasOwn(input,'selectedIds')){
   const ids=input.selectedIds;
   if(!Array.isArray(ids)||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!id||id.length>128))fail('INPUT_DRAFT_VALUE_INVALID');
   draft.selectedIds=ids.slice();
  }
  if(Object.hasOwn(input,'manuallyEdited'))draft.manuallyEdited=boolean(input.manuallyEdited);
  for(const key of ['text','finalText','interimText'])if(Object.hasOwn(source,key))session[key]=text(source[key],10000);
  if(Object.hasOwn(source,'error'))session.error=text(source.error,160);
  for(const key of ['truncated','supported'])if(Object.hasOwn(source,key))session[key]=boolean(source[key]);
  const active=['starting','listening','stopping'].includes(session.state);
  session.partialSpeech=boolean(source.partialSpeech)||active||!!session.interimText;
  session.needsReview=boolean(source.needsReview)||session.partialSpeech;
  if(recover&&session.needsReview){session.state='error';session.error='VOICE_DRAFT_INTERRUPTED';draft.manuallyEdited=false;}
  const out={screen:value.screen,draft,session};
  if(Object.hasOwn(value,'originStamp'))out.originStamp=text(value.originStamp,20000);
  return out;
 }
 function create(deal,binding,settings={}){
  try{
   only(settings,['kind']);const family=settings.kind||'speech';if(!['speech','card'].includes(family))fail('INPUT_DRAFT_VALUE_INVALID');
   const actor=syncIdentity();if(!object(binding))fail('INPUT_DRAFT_BINDING_STALE');const b=copy(binding);
   if(!object(b)||b.ok!==true||b.owner!==actor.owner||b.sessionToken!==actor.sessionToken||!UUID.test(String(b.dealId||''))||typeof b.fingerprint!=='string'||b.fingerprint.length>100000||String(deal?.id)!==b.dealId||root.MobileInputReviewModel?.current(deal,b)?.ok!==true)fail('INPUT_DRAFT_BINDING_STALE');
   const key=PREFIX+encodeURIComponent(b.owner)+':'+b.dealId+':'+family,life={invalid:false,closed:false};
   let observed=get(storage(),key);handles.add(life);
   function familyValue(value,recover=false){const result=normalize(value,recover);if((family==='card')!==(result.screen==='I-3')||family==='speech'&&Object.hasOwn(result.draft,'recognized'))fail('INPUT_DRAFT_VALUE_INVALID');return result;}
   function current(){
    if(life.closed||disposed)fail('INPUT_DRAFT_DISPOSED');
    const a=syncIdentity();
    if(life.invalid||a.owner!==b.owner||a.sessionToken!==b.sessionToken)fail('INPUT_DRAFT_CONTEXT_CHANGED');
    if(root.MobileInputReviewModel?.current(deal,b)?.ok!==true)fail('INPUT_DRAFT_BINDING_STALE');
   }
   function parse(raw){
    let row;try{row=JSON.parse(raw);}catch{fail('INPUT_DRAFT_CORRUPT');}
    if(!object(row)||row.v!==1||row.kind!==KIND||row.family!==family||row.status!=='unsent'||row.pendingOperation!==false||row.owner!==b.owner||row.dealId!==b.dealId||typeof row.sessionToken!=='string'||typeof row.fingerprint!=='string'||!Number.isFinite(row.at)||row.at<0||!Number.isFinite(row.expiresAt)||row.expiresAt!==row.at+TTL||row.at>clock()+60000)fail('INPUT_DRAFT_CORRUPT');
    let value;try{value=familyValue(row.value);}catch{fail('INPUT_DRAFT_CORRUPT');}
    return {...row,value};
   }
   function matches(row){return row.owner===b.owner&&row.sessionToken===b.sessionToken&&row.dealId===b.dealId&&row.fingerprint===b.fingerprint;}
   function read(){
    try{
     current();const s=storage(),raw=get(s,key);current();
     if(raw===null){observed=null;return {ok:true,value:null,kind:KIND};}
     const row=parse(raw);
     // A different authentication session is still cleared. A changed deal
     // fingerprint only blocks adoption: keep the unsent text for recovery.
     if(row.sessionToken!==b.sessionToken){remove(s,key);observed=null;fail('INPUT_DRAFT_CONTEXT_CHANGED');}
     if(clock()>=row.expiresAt){remove(s,key);observed=null;return {ok:true,value:null,kind:KIND,expired:true};}
     if(!matches(row))fail('INPUT_DRAFT_CONTEXT_CHANGED');
     current();observed=raw;return {ok:true,value:familyValue(row.value,true),kind:KIND,status:'unsent',pendingOperation:false,at:row.at,expiresAt:row.expiresAt};
    }catch(e){return resultError(e);}
   }
   function write(value){
    try{
     current();const input=familyValue(value),at=clock(),s=storage(),prior=get(s,key);
     if(prior!==observed)fail('INPUT_DRAFT_CONFLICT');
     if(prior!==null){const row=parse(prior);if(!matches(row))fail('INPUT_DRAFT_CONTEXT_CHANGED');}
     const row={v:1,kind:KIND,family,status:'unsent',pendingOperation:false,owner:b.owner,sessionToken:b.sessionToken,dealId:b.dealId,fingerprint:b.fingerprint,at,expiresAt:at+TTL,value:input},raw=JSON.stringify(row);
     if(raw.length>200000)fail('INPUT_DRAFT_VALUE_INVALID');current();
     try{s.setItem(key,raw);}catch{fail('INPUT_DRAFT_STORAGE_UNAVAILABLE');}
     current();if(get(s,key)!==raw)fail('INPUT_DRAFT_VERIFY_FAILED');current();observed=raw;
     return {ok:true,kind:KIND,status:'unsent',pendingOperation:false,at,expiresAt:row.expiresAt};
    }catch(e){return resultError(e);}
   }
   function drop(){
    try{
     current();
     const s=storage(),raw=get(s,key);
     if(raw!==null){const row=parse(raw);if(!matches(row)||raw!==observed)fail('INPUT_DRAFT_CONFLICT');remove(s,key);}
     observed=null;return {ok:true,kind:KIND};
    }catch(e){return resultError(e);}
   }
   function dispose(){const result=drop();if(result.ok){life.closed=true;handles.delete(life);}return result;}
   function release(){life.closed=true;handles.delete(life);return {ok:true,kind:KIND};}
   return Object.freeze({ok:true,read,write,drop,dispose,release});
  }catch(e){return resultError(e);}
 }
 function dispose(){
  if(disposed)return {ok:true};invalidate();disposed=true;
  root.removeEventListener?.('phase1:profile',profileChanged);root.removeEventListener?.('phase1:identity-cleared',identityCleared);
  try{purge();return {ok:true};}catch(e){return resultError(e);}
 }
 return Object.freeze({create,dispose,prefix:PREFIX,ttlMs:TTL});
});
