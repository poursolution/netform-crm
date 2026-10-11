/* Shared PC/mobile contact match read contract. No write queue, cache or retry. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.ContactMatchReader=factory(root);})(typeof window==='object'?window:globalThis,function(root){
 'use strict';
 const REF='ymfbmpnizxvqsamnczow',BASE='https://'+REF+'.supabase.co',RPC='crm_contact_match_read_v1',CONTRACT='contact-match-read-v1';
 const PAGE_SIZE=20,MAX_RESPONSE=524288,TIMEOUT=15000,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 const candidateKeys=['contact_id','person_key','name','role','matched_phone','linked_to_target','links','link_total','links_truncated','can_link'],linkKeys=['opportunity_id','site_id','site_name'];
 const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v),owns=(v,k)=>Object.prototype.hasOwnProperty.call(v,k),fail=code=>{throw Error(code);};
 function normalizePhone(value){if(typeof value!=='string'||!/^\s*(?:\+82|0)[0-9\s()-]+\s*$/.test(value))return '';let phone=value.replace(/[\s()-]/g,'');if(phone.startsWith('+82'))phone='0'+phone.slice(3);return /^010\d{8}$/.test(phone)?phone:'';}
 function uuid(value){if(typeof value!=='string'||!UUID.test(value))fail('CONTACT_MATCH_RESPONSE_INVALID');return value.toLowerCase();}
 function nullableText(value,max){if(value===null)return null;if(typeof value!=='string'||value.length>max)fail('CONTACT_MATCH_RESPONSE_INVALID');return value;}
 function fields(value,keys){if(!object(value)||Object.keys(value).some(key=>!keys.includes(key))||keys.some(key=>!owns(value,key)))fail('CONTACT_MATCH_RESPONSE_INVALID');}
 function configuration(){const c=root.Phase1?.config;if(!c||c.project_ref!==REF||c.url!==BASE||typeof c.publishable_key!=='string'||!c.publishable_key.trim()||root.SUPABASE_URL&&root.SUPABASE_URL!==BASE)fail('CONTACT_MATCH_ENVIRONMENT_INVALID');return c;}
 function profile(){const p=root.Phase1?.profile;if(!p||typeof p.auth_uid!=='string'||!UUID.test(p.auth_uid)||typeof p.user_id!=='string'||!UUID.test(p.user_id))fail('CONTACT_MATCH_LOGIN_REQUIRED');return {auth:p.auth_uid.toLowerCase(),user:p.user_id.toLowerCase()};}
 function current(op){
  if(op.reason)fail(op.reason);if(op.controller.signal.aborted)fail('CONTACT_MATCH_CANCELLED');
  let valid=false;try{valid=op.isCurrent()===true;}catch{}if(!valid)fail('CONTACT_MATCH_CONTEXT_CHANGED');
  if(root.LIVE!==true||root.DEMO!==false||root.TOKEN!==op.token)fail('CONTACT_MATCH_CONTEXT_CHANGED');
  let c,p;try{c=configuration();p=profile();}catch{fail('CONTACT_MATCH_CONTEXT_CHANGED');}
  if(c.url!==op.url||c.publishable_key!==op.key||p.auth!==op.auth||p.user!==op.user)fail('CONTACT_MATCH_CONTEXT_CHANGED');
 }
 function awaited(promise,op){return new Promise((resolve,reject)=>{
  const aborted=()=>{op.controller.signal.removeEventListener('abort',aborted);reject(Error(op.reason||'CONTACT_MATCH_CANCELLED'));};
  op.controller.signal.addEventListener('abort',aborted,{once:true});
  Promise.resolve(promise).then(value=>{op.controller.signal.removeEventListener('abort',aborted);resolve(value);},error=>{op.controller.signal.removeEventListener('abort',aborted);reject(error);});
  if(op.controller.signal.aborted)aborted();
 });}
 function validate(body,op){
  if(!object(body)||body.contract!==CONTRACT||uuid(body.actor_auth_uid)!==op.auth||uuid(body.actor_user_id)!==op.user||uuid(body.object_id)!==op.dealId||body.object_version!==op.version||body.phone!==op.phone||body.scope!=='authorized_deals_only'||body.page!==op.page||body.page_size!==PAGE_SIZE||!Number.isSafeInteger(body.total)||body.total<0||typeof body.has_more!=='boolean'||!Array.isArray(body.candidates)||body.candidates.length>PAGE_SIZE)fail('CONTACT_MATCH_RESPONSE_INVALID');
  const count=Math.min(PAGE_SIZE,Math.max(0,body.total-(op.page-1)*PAGE_SIZE));
  if(body.candidates.length!==count||body.has_more!==(op.page*PAGE_SIZE<body.total))fail('CONTACT_MATCH_RESPONSE_INVALID');
  const contactIds=new Set();
  const candidates=body.candidates.map(item=>{
   fields(item,candidateKeys);const id=uuid(item.contact_id);if(contactIds.has(id)||item.matched_phone!==op.phone||typeof item.linked_to_target!=='boolean'||item.can_link!==false||!Number.isSafeInteger(item.link_total)||item.link_total<1||typeof item.links_truncated!=='boolean'||!Array.isArray(item.links)||item.links.length!==Math.min(PAGE_SIZE,item.link_total)||item.links_truncated!==(item.link_total>PAGE_SIZE))fail('CONTACT_MATCH_RESPONSE_INVALID');contactIds.add(id);
   const dealIds=new Set();let targetVisible=false;
   const links=item.links.map(link=>{fields(link,linkKeys);const deal=uuid(link.opportunity_id);if(dealIds.has(deal))fail('CONTACT_MATCH_RESPONSE_INVALID');dealIds.add(deal);if(deal===op.dealId)targetVisible=true;return {opportunity_id:deal,site_id:link.site_id===null?null:uuid(link.site_id),site_name:nullableText(link.site_name,4096)};});
   if(targetVisible&&!item.linked_to_target||item.linked_to_target&&!targetVisible&&!item.links_truncated)fail('CONTACT_MATCH_RESPONSE_INVALID');
   return {contact_id:id,person_key:nullableText(item.person_key,4096),name:nullableText(item.name,4096),role:nullableText(item.role,4096),matched_phone:item.matched_phone,linked_to_target:item.linked_to_target,links,link_total:item.link_total,links_truncated:item.links_truncated,can_link:false};
  });
  return {contract:CONTRACT,actor_auth_uid:op.auth,actor_user_id:op.user,object_id:op.dealId,object_version:op.version,phone:op.phone,scope:'authorized_deals_only',page:op.page,page_size:PAGE_SIZE,total:body.total,has_more:body.has_more,candidates};
 }
 function failure(code){return {ok:false,status:code==='CONTACT_MATCH_CANCELLED'?'cancelled':code==='CONTACT_MATCH_CONTEXT_CHANGED'?'stale':'failed',error:code};}
 function utf8Size(text){let size=0;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c<128)size++;else if(c<2048)size+=2;else if(c>=55296&&c<=56319&&i+1<text.length&&text.charCodeAt(i+1)>=56320&&text.charCodeAt(i+1)<=57343){size+=4;i++;}else size+=3;}return size;}
 async function read(options){let op,timer,externalAbort,externalSignal,events=[];
  try{
   if(!object(options)||typeof options.dealId!=='string'||!UUID.test(options.dealId)||!Number.isSafeInteger(options.expectedVersion)||options.expectedVersion<0||typeof options.isCurrent!=='function')fail('CONTACT_MATCH_INPUT_INVALID');
   const phone=normalizePhone(options.phone),page=options.page===undefined?1:options.page;if(!phone||!Number.isSafeInteger(page)||page<1||page>2147483647)fail('CONTACT_MATCH_INPUT_INVALID');
   if(root.LIVE!==true||root.DEMO!==false)fail('CONTACT_MATCH_LIVE_REQUIRED');
   if(typeof root.fetch!=='function'||typeof root.AbortController!=='function')fail('CONTACT_MATCH_UNSUPPORTED');
   const c=configuration(),p=profile(),token=root.TOKEN;if(typeof token!=='string'||!token.trim())fail('CONTACT_MATCH_LOGIN_REQUIRED');
   op={dealId:options.dealId.toLowerCase(),version:options.expectedVersion,phone,page,isCurrent:options.isCurrent,url:c.url,key:c.publishable_key,token,auth:p.auth,user:p.user,controller:new root.AbortController(),reason:''};current(op);
   const abort=code=>{if(!op.reason){op.reason=code;op.controller.abort();}};
   if(options.signal!==undefined){const signal=options.signal;if(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function')fail('CONTACT_MATCH_SIGNAL_INVALID');externalSignal=signal;externalAbort=()=>abort('CONTACT_MATCH_CANCELLED');signal.addEventListener('abort',externalAbort,{once:true});if(signal.aborted)externalAbort();}
   if(typeof root.addEventListener==='function')for(const name of ['phase1:identity-cleared','phase1:profile','pagehide']){const listener=()=>abort('CONTACT_MATCH_CONTEXT_CHANGED');root.addEventListener(name,listener);events.push([name,listener]);}
   timer=(root.setTimeout||setTimeout)(()=>abort('CONTACT_MATCH_TIMEOUT'),TIMEOUT);current(op);
   const response=await awaited(root.fetch(op.url+'/rest/v1/rpc/'+RPC,{method:'POST',headers:{apikey:op.key,Authorization:'Bearer '+op.token,'Content-Type':'application/json'},body:JSON.stringify({p_opportunity_id:op.dealId,p_phone:op.phone,p_page:op.page}),signal:op.controller.signal}),op);current(op);
   if(!response||typeof response.text!=='function')fail('CONTACT_MATCH_RESPONSE_INVALID');
   const length=Number(response.headers?.get?.('content-length'));if(Number.isFinite(length)&&length>MAX_RESPONSE)fail('CONTACT_MATCH_RESPONSE_TOO_LARGE');
   const raw=await awaited(response.text(),op);current(op);if(typeof raw!=='string'||raw.length>MAX_RESPONSE||utf8Size(raw)>MAX_RESPONSE)fail('CONTACT_MATCH_RESPONSE_TOO_LARGE');
   let body;try{body=JSON.parse(raw);}catch{fail('CONTACT_MATCH_RESPONSE_INVALID');}
   if(response.ok!==true)fail(body?.code==='PGRST202'?'CONTACT_MATCH_UNAVAILABLE':response.status===401||response.status===403?'CONTACT_MATCH_NOT_AUTHORIZED':'CONTACT_MATCH_SERVER_REJECTED');
   const result=validate(body,op);current(op);return {ok:true,status:'ready',...result};
  }catch(error){return failure(op?.reason||(/^CONTACT_MATCH_[A-Z_]+$/.test(error?.message)?error.message:'CONTACT_MATCH_REQUEST_FAILED'));}
  finally{if(timer!==undefined)(root.clearTimeout||clearTimeout)(timer);if(externalSignal&&externalAbort)externalSignal.removeEventListener('abort',externalAbort);for(const [name,listener] of events)root.removeEventListener?.(name,listener);}
 }
 return Object.freeze({normalizePhone,read});
});
