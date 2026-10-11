/* Explicit image recognition only. Reuses the PC crm-ai/contact_card contract.
 * No contact save, Storage upload, memo suggestion, permissions or automatic retry. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.MobileCardRecognition=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const URL_BASE='https://ymfbmpnizxvqsamnczow.supabase.co',REF='ymfbmpnizxvqsamnczow',MAX_FILE=15*1024*1024,MAX_BASE64=2800000,MAX_RESPONSE=16384;
 const roles=new Set(['','관리소장','입주자대표회장','관리과장','시설과장','담당자','기타']);
 let active=null;
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),problem=code=>{throw Error(code);};
 function capabilities(){
  try{const supported=typeof root.fetch==='function'&&typeof root.Image==='function'&&typeof root.URL?.createObjectURL==='function'&&typeof root.URL?.revokeObjectURL==='function'&&typeof root.document?.createElement==='function'&&typeof root.AbortController==='function';
   return {supported,permission:'not-requested',server:'unverified',contactSave:false};
  }catch{return {supported:false,permission:'not-requested',server:'unverified',contactSave:false};}
 }
 function config(){const c=root.Phase1?.config;if(!c||c.project_ref!==REF||c.url!==URL_BASE||typeof c.publishable_key!=='string'||!c.publishable_key||root.SUPABASE_URL&&root.SUPABASE_URL!==URL_BASE)problem('CARD_ENVIRONMENT_INVALID');return c;}
 function check(op){
  if(op.reason)problem(op.reason);
  if(op.controller.signal.aborted)problem('CARD_CANCELLED');
  if(root.LIVE!==true||root.DEMO===true||root.TOKEN!==op.token)problem('CARD_CONTEXT_CHANGED');
  if(typeof op.options.isCurrent!=='function'||op.options.isCurrent()!==true||root.MobileInputReviewModel?.current(op.options.deal,op.options.binding)?.ok!==true)problem('CARD_CONTEXT_CHANGED');
  const c=config();if(c.url!==op.url||c.publishable_key!==op.key)problem('CARD_CONTEXT_CHANGED');
 }
 function cancel(reason='CARD_CANCELLED'){if(!active)return false;active.reason=reason;active.controller.abort();return true;}
 function awaited(promise,op){return new Promise((resolve,reject)=>{const aborted=()=>{op.controller.signal.removeEventListener('abort',aborted);reject(Error(op.reason||'CARD_CANCELLED'));};op.controller.signal.addEventListener('abort',aborted,{once:true});Promise.resolve(promise).then(value=>{op.controller.signal.removeEventListener('abort',aborted);resolve(value);},error=>{op.controller.signal.removeEventListener('abort',aborted);reject(error);});if(op.controller.signal.aborted)aborted();});}
 async function prepare(file,op){
  if(!object(file)||!['image/jpeg','image/png','image/webp'].includes(file.type)||!Number.isSafeInteger(file.size)||file.size<=0||file.size>MAX_FILE)problem('CARD_IMAGE_INVALID');
  let image,objectUrl,canvas;
  try{
   image=new root.Image();objectUrl=root.URL.createObjectURL(file);
   await new Promise((resolve,reject)=>{const finish=fn=>{image.onload=null;image.onerror=null;op.controller.signal.removeEventListener('abort',aborted);fn();},aborted=()=>finish(()=>reject(Error(op.reason||'CARD_CANCELLED')));image.onload=()=>finish(resolve);image.onerror=()=>finish(()=>reject(Error('CARD_IMAGE_DECODE_FAILED')));op.controller.signal.addEventListener('abort',aborted,{once:true});image.src=objectUrl;if(op.controller.signal.aborted)aborted();});
   check(op);
   const w=image.naturalWidth,h=image.naturalHeight;if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||w*h>100000000)problem('CARD_IMAGE_DIMENSIONS_INVALID');
   const scale=Math.min(1,1568/Math.max(w,h));canvas=root.document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));const ctx=canvas.getContext('2d');if(!ctx)problem('CARD_IMAGE_UNSUPPORTED');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const raw=canvas.toDataURL('image/jpeg',0.88);if(typeof raw!=='string'||!raw.startsWith('data:image/jpeg;base64,'))problem('CARD_IMAGE_ENCODING_INVALID');const data=raw.slice(23);
   if(data.length<8||data.length>MAX_BASE64||data.length%4!==0||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data))problem('CARD_IMAGE_ENCODING_INVALID');
   return {media_type:'image/jpeg',data};
  }finally{if(image){image.onload=null;image.onerror=null;image.src='';}if(objectUrl)root.URL.revokeObjectURL(objectUrl);if(canvas){canvas.width=1;canvas.height=1;}}
 }
 function candidate(body){
  if(!object(body)||body.ok!==true||!object(body.suggestion)||body.suggestion.status!=='proposed'||!object(body.suggestion.suggestion))problem('CARD_RESPONSE_INVALID');
  const raw=body.suggestion.suggestion,out={},limits={name:60,role:30,mobile:20,office:30,email:160,note:200};
  for(const [key,max] of Object.entries(limits)){if(typeof raw[key]!=='string'||raw[key].length>max)problem('CARD_RESPONSE_INVALID');out[key]=raw[key];}
  if(!roles.has(out.role)||out.mobile&&!/^010\d{8}$/.test(out.mobile)||out.office&&(!/^0\d{8,10}$/.test(out.office)||/^01/.test(out.office))||out.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))problem('CARD_RESPONSE_INVALID');
  return out;
 }
 function failure(code){const state=code==='CARD_CANCELLED'?'cancelled':code==='CARD_CONTEXT_CHANGED'?'stale':code==='CARD_BUSY'?'busy':'failed';return {ok:false,status:state,error:code,message:state==='stale'?'계정·현장이 변경되어 명함 인식 결과를 반영하지 않았습니다.':state==='cancelled'?'명함 읽기를 취소했습니다.':state==='busy'?'명함을 읽는 중입니다.':code==='CARD_TIMEOUT'?'명함 읽기 시간이 초과되었습니다. 입력은 유지됩니다.':'명함을 읽지 못했습니다. 입력을 유지한 채 다시 시도할 수 있습니다.',retainedInput:true,canSave:false};}
 async function recognize(options){
  if(active)return failure('CARD_BUSY');let op,timer,aborted,events=[];
  try{
   if(!object(options)||options.userInitiated!==true)problem('CARD_EXPLICIT_ACTION_REQUIRED');
   if(root.LIVE!==true||root.DEMO===true)problem('CARD_LIVE_REQUIRED');
   if(!capabilities().supported)problem('CARD_UNSUPPORTED');
   const c=config(),token=root.TOKEN;if(typeof token!=='string'||!token)problem('CARD_LOGIN_REQUIRED');
   options={...options,binding:object(options.binding)?Object.freeze({...options.binding}):options.binding};
   op={options,token,url:c.url,key:c.publishable_key,controller:new root.AbortController(),reason:''};check(op);active=op;
   const abort=code=>{if(active===op){op.reason=code;op.controller.abort();}};
   aborted=()=>abort('CARD_CANCELLED');if(options.signal){if(typeof options.signal.addEventListener!=='function')problem('CARD_SIGNAL_INVALID');options.signal.addEventListener('abort',aborted,{once:true});if(options.signal.aborted)aborted();}
   if(typeof root.addEventListener==='function'){for(const name of ['phase1:identity-cleared','phase1:profile','pagehide']){const fn=()=>abort('CARD_CONTEXT_CHANGED');root.addEventListener(name,fn);events.push([name,fn]);}}
   timer=(root.setTimeout||setTimeout)(()=>abort('CARD_TIMEOUT'),45000);
   const image=await prepare(options.file,op);check(op);
   const response=await awaited(root.fetch(op.url+'/functions/v1/crm-ai',{method:'POST',headers:{apikey:op.key,Authorization:'Bearer '+op.token,'Content-Type':'application/json'},body:JSON.stringify({kind:'contact_card',subject_type:'deal',subject_id:options.deal.id,input:{image}}),signal:op.controller.signal}),op);
   check(op);if(!response||typeof response.text!=='function')problem('CARD_RESPONSE_INVALID');if(response.ok!==true)problem(response.status===401||response.status===403?'CARD_NOT_AUTHORIZED':'CARD_SERVER_REJECTED');
   const length=Number(response.headers?.get?.('content-length'));if(Number.isFinite(length)&&length>MAX_RESPONSE)problem('CARD_RESPONSE_TOO_LARGE');const raw=await awaited(response.text(),op);check(op);if(typeof raw!=='string'||raw.length>MAX_RESPONSE)problem('CARD_RESPONSE_TOO_LARGE');
   let body;try{body=JSON.parse(raw);}catch{problem('CARD_RESPONSE_INVALID');}const suggestion=candidate(body);check(op);
   return {ok:true,status:'proposed',source:'crm-ai/contact_card',suggestion,binding:{...options.binding},canSave:false,verified:false,imageRetained:false};
  }catch(error){const code=op?.reason||(/^CARD_[A-Z_]+$/.test(error?.message)?error.message:'CARD_REQUEST_FAILED');return failure(code);}
  finally{if(timer!==undefined)(root.clearTimeout||clearTimeout)(timer);if(options?.signal&&aborted)options.signal.removeEventListener?.('abort',aborted);for(const [name,fn] of events)root.removeEventListener?.(name,fn);if(active===op)active=null;}
 }
 return Object.freeze({capabilities,recognize,cancel:()=>cancel()});
});
