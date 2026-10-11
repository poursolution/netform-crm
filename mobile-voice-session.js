/* Native dictation lifecycle only. No recording file, AI inference, contact save, task or request mutation. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobileVoiceSession=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const ACTIVE=new Set(['starting','listening','stopping']),MAX_RAW_LENGTH=10000,MAX_RESULTS=10000;
 function constructor(options){return Object.prototype.hasOwnProperty.call(options||{},'Recognition')?options.Recognition:root.SpeechRecognition||root.webkitSpeechRecognition;}
 function supported(options={}){return root.isSecureContext!==false&&typeof constructor(options)==='function';}
 function defaultScope(){
  const j=root.MobileSaveJournal,p=root.Phase1?.profile,id=String(root.G?.deal||''),owner=j?.owner?.(),session=j?.session?.();
  if(!id||!owner||owner!==p?.auth_uid+':'+p?.user_id||!session?.startsWith(owner+':')||root.G?.mode!=='rep'||!root.myDeals?.().some(d=>String(d.id)===id))return '';
  return owner+'|'+session+'|'+id;
 }
 function create(options={}){
  const Recognition=constructor(options),readScope=typeof options.getScope==='function'?options.getScope:defaultScope;
  const currentView=typeof options.isCurrent==='function'?options.isCurrent:()=>true;
  // Dictation is a review candidate, not the300-character contact memo. Keep the
  // candidate intact up to the local recovery limit; the D bridge validates300.
  const maxLength=Number.isInteger(options.maxLength)&&options.maxLength>0?Math.min(options.maxLength,MAX_RAW_LENGTH):MAX_RAW_LENGTH;
  let state='idle',rec=null,generation=0,scope='',callbacks={},finalText='',interimText='',truncated=false,code='',disposed=false,listening=false;
  function snapshot(){return Object.freeze({state,text:finalText+interimText,finalText,interimText,truncated,error:code,supported:supported({Recognition})});}
  function emit(name){try{if(typeof callbacks[name]==='function')callbacks[name](snapshot());}catch{/* UI callback failures must not interrupt provider cleanup. */}}
  function valid(){try{return !disposed&&scope!==''&&readScope()===scope&&currentView()===true;}catch{return false;}}
  function unlisten(){if(!listening)return;listening=false;root.removeEventListener?.('phase1:identity-cleared',identityCleared);root.removeEventListener?.('phase1:profile',identityChanged);root.removeEventListener?.('pagehide',pageHidden);}
  function detach(){if(rec){rec.onstart=null;rec.onresult=null;rec.onerror=null;rec.onend=null;}unlisten();}
  function endNow(status,error,notify=true){
   const old=rec;generation++;detach();rec=null;state=status;code=error||'';
   try{old?.abort();}catch{}
   if(notify){emit('onState');if(error)emit('onError');}
  }
  function guarded(token){if(token!==generation||!rec||!ACTIVE.has(state))return false;if(!valid()){endNow('invalidated','VOICE_CONTEXT_CHANGED',false);return false;}return true;}
  function identityCleared(){if(ACTIVE.has(state))endNow('invalidated','VOICE_CONTEXT_CHANGED',false);}
  function identityChanged(){if(ACTIVE.has(state)&&!valid())endNow('invalidated','VOICE_CONTEXT_CHANGED',false);}
  function pageHidden(){if(ACTIVE.has(state))endNow('cancelled','',valid());}
  function start(next={}){
   if(disposed)return {ok:false,error:'VOICE_DISPOSED'};
   if(ACTIVE.has(state))return {ok:false,error:'VOICE_BUSY'};
   callbacks=next&&typeof next==='object'?next:{};
   finalText='';interimText='';truncated=false;code='';
   if(!supported({Recognition})){state='unsupported';code='VOICE_UNSUPPORTED';emit('onState');emit('onError');return {ok:false,error:code};}
   try{scope=readScope();if(typeof scope!=='string'||!scope||currentView()!==true)throw Error('VOICE_CONTEXT_CHANGED');}catch{state='invalidated';code='VOICE_CONTEXT_CHANGED';return {ok:false,error:code};}
   const token=++generation;state='starting';
   try{rec=new Recognition();rec.lang='ko-KR';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;}catch{endNow('error','VOICE_START_FAILED');return {ok:false,error:code};}
   rec.onstart=()=>{if(!guarded(token))return;state='listening';emit('onState');};
   rec.onresult=event=>{
    if(!guarded(token))return;
    let final='',interim='',length=0,limit='';
    // Results are cumulative. Rebuild without appending duplicate final events,
    // and bound both retained text and result traversal before concatenating.
    try{
     const results=event.results,count=results?.length||0;
     if(!Number.isSafeInteger(count)||count<0)throw Error();
     for(let i=0;i<Math.min(count,MAX_RESULTS);i++){
      const result=results[i],value=result?.[0]?.transcript??'';
      if(typeof value!=='string')throw Error();
      const remaining=maxLength-length,part=value.slice(0,remaining);
      if(result?.isFinal)final+=part;else interim+=part;length+=part.length;
      if(value.length>remaining){limit='VOICE_TEXT_LIMIT';break;}
     }
     if(!limit&&count>MAX_RESULTS)limit='VOICE_RESULT_LIMIT';
    }catch{endNow('error','VOICE_RESULT_INVALID');return;}
    truncated=!!limit;finalText=final;interimText=interim;emit('onResult');
    if(limit&&guarded(token))endNow('error',limit);
   };
   rec.onerror=event=>{if(!guarded(token))return;endNow('error','VOICE_'+String(event?.error||'RECOGNITION_FAILED').replace(/[^a-z0-9_-]/gi,'').toUpperCase());};
   rec.onend=()=>{if(!guarded(token))return;generation++;detach();rec=null;state='ended';emit('onState');if(state==='ended'&&valid())emit('onEnd');};
   listening=true;root.addEventListener?.('phase1:identity-cleared',identityCleared);root.addEventListener?.('phase1:profile',identityChanged);root.addEventListener?.('pagehide',pageHidden);
   emit('onState');
   if(!guarded(token))return {ok:false,error:'VOICE_CONTEXT_CHANGED'};
   try{rec.start();return {ok:true};}catch{endNow('error','VOICE_START_FAILED');return {ok:false,error:code};}
  }
  function stop(){
   if(!ACTIVE.has(state)||!rec)return {ok:false,error:'VOICE_NOT_ACTIVE'};
   if(!valid()){endNow('invalidated','VOICE_CONTEXT_CHANGED',false);return {ok:false,error:'VOICE_CONTEXT_CHANGED'};}
   if(state==='stopping')return {ok:true};const token=generation;state='stopping';emit('onState');if(!guarded(token))return {ok:false,error:'VOICE_CONTEXT_CHANGED'};
   try{rec.stop();return {ok:true};}catch{endNow('error','VOICE_STOP_FAILED');return {ok:false,error:code};}
  }
  function cancel(){if(disposed)return {ok:false,error:'VOICE_DISPOSED'};const notify=valid();endNow('cancelled','',notify);return {ok:true};}
  function dispose(){if(disposed)return;endNow('disposed','',false);disposed=true;callbacks={};finalText='';interimText='';scope='';}
  return Object.freeze({start,stop,cancel,dispose,snapshot,supported:()=>supported({Recognition})});
 }
 return Object.freeze({create,supported});
});
