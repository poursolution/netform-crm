/* Production common transport only. No business bundle, no Legacy fallback. */
(function(root){
 'use strict';
 const REF='ymfbmpnizxvqsamnczow',VERSION=2,c=root.PHASE1_CONFIG;
 if(!c||c.project_ref!==REF||c.url!==`https://${REF}.supabase.co`||!c.publishable_key||!['poursolution.github.io','127.0.0.1','localhost'].includes(location.hostname))throw Error('PHASE1_WRONG_ENVIRONMENT');
 const origin=new URL(c.url).origin,base=`crm:production:${REF}:v${VERSION}:`,nativeLocal=root.localStorage,nativeSession=root.sessionStorage;
 const fetchNative=root.fetch.bind(root),requests=[],blocked=[];let client,profile=null,epoch=0,activeUid=null,controllers=new Set();
 const rpcAllow=new Set(['crm_profile_scoped_v2','crm_read_scoped_v2','crm_contacts_scoped_v2','crm_write_command_v2','crm_operational_source_v1','crm_expansion_note','crm_expansion_context']);
 function allowed(input){const u=new URL(typeof input==='string'?input:input.url||String(input),location.href);
  if(u.origin===location.origin)return u;
  if(u.origin===origin&&(u.pathname.startsWith('/auth/v1/')||u.pathname.startsWith('/storage/v1/object/upload/sign/crm-site-files/deals/')||rpcAllow.has(u.pathname.replace('/rest/v1/rpc/',''))&&u.pathname.startsWith('/rest/v1/rpc/')))return u;
  blocked.push({origin:u.origin,path:u.pathname});throw Error('PHASE1_TRANSPORT_DENIED');}
 root.fetch=async function(input,init){const u=allowed(input);requests.push({origin:u.origin,path:u.pathname,method:init?.method||'GET'});return fetchNative(input,init);};
 const open=root.XMLHttpRequest.prototype.open;
 root.XMLHttpRequest.prototype.open=function(method,url,...args){allowed(url);return open.call(this,method,url,...args);};
 root.WebSocket=function(){blocked.push({path:'websocket'});throw Error('PHASE1_REALTIME_NOT_ENABLED');};
 navigator.sendBeacon=function(){blocked.push({path:'beacon'});return false;};
 function purgeApp(){for(let i=nativeLocal.length-1;i>=0;i--){const k=nativeLocal.key(i);if(k.startsWith(base))nativeLocal.removeItem(k);}}
 function purgeAuth(){for(let i=nativeSession.length-1;i>=0;i--){const k=nativeSession.key(i);if(k.startsWith(base))nativeSession.removeItem(k);}}
 function invalidate(){epoch++;for(const x of controllers)x.abort();controllers.clear();profile=null;activeUid=null;purgeApp();purgeAuth();root.dispatchEvent(new Event('phase1:identity-cleared'));}
 const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(base+'identity'):null;
 if(channel)channel.onmessage=()=>{invalidate();location.reload();};
 const authStorage={getItem(){const uid=nativeSession.getItem(base+'auth-locator');if(!uid)return null;const raw=nativeSession.getItem(base+uid+':auth');try{const s=JSON.parse(raw);if(!s||s.user?.id!==uid||typeof s.access_token!=='string'||typeof s.refresh_token!=='string')throw Error('INVALID_SESSION');return raw;}catch{invalidate();return null;}},
  setItem(key,value){const session=JSON.parse(value),uid=session.user?.id;if(!uid)throw Error('INVALID_AUTH_STORAGE');const old=nativeSession.getItem(base+'auth-locator');if(old&&old!==uid){invalidate();channel?.postMessage('identity-change');}nativeSession.setItem(base+'auth-locator',uid);nativeSession.setItem(base+uid+':auth',value);},
  removeItem(){invalidate();}};
 function storageKey(k){return activeUid?base+activeUid+':app:'+String(k):null;}
 const storage={getItem(k){const key=storageKey(k);if(!key)return null;const raw=nativeLocal.getItem(key);if(raw===null)return null;let record;try{record=JSON.parse(raw);}catch{throw Error('CACHE_INVALID');}if(record?.version!==VERSION||record.auth_uid!==activeUid||typeof record.value!=='string'||!Number.isFinite(record.at))throw Error('CACHE_INVALID');if(Date.now()-record.at>86400000||record.at>Date.now()+60000)throw Error('CACHE_EXPIRED');return record.value;},setItem(k,v){const key=storageKey(k);if(!key)throw Error('AUTH_REQUIRED');nativeLocal.setItem(key,JSON.stringify({version:VERSION,auth_uid:activeUid,at:Date.now(),value:String(v)}));},removeItem(k){const key=storageKey(k);if(key)nativeLocal.removeItem(key);},clear:purgeApp};
 function sessionKey(k){return activeUid?base+activeUid+':view:'+String(k):null;}
 /* 새로고침 체감속도용 탭 한정 snapshot. 탭 종료·로그아웃 시 사라지고 계정이 다르면 읽을 수 없다. */
 const sessionCache={getItem(k){const key=sessionKey(k);if(!key)return null;const raw=nativeSession.getItem(key);if(raw===null)return null;let record;try{record=JSON.parse(raw);}catch{nativeSession.removeItem(key);return null;}if(record?.version!==VERSION||record.auth_uid!==activeUid||typeof record.value!=='string'||!Number.isFinite(record.at)||Date.now()-record.at>900000||record.at>Date.now()+60000){nativeSession.removeItem(key);return null;}return record.value;},setItem(k,v){const key=sessionKey(k);if(!key)throw Error('AUTH_REQUIRED');nativeSession.setItem(key,JSON.stringify({version:VERSION,auth_uid:activeUid,at:Date.now(),value:String(v)}));},removeItem(k){const key=sessionKey(k);if(key)nativeSession.removeItem(key);}};
 function createClient(url,key){if(url!==c.url||key!==c.publishable_key)throw Error('PHASE1_CLIENT_MISMATCH');if(client)return client;
  client=root.supabase.createClient(url,key,{auth:{storage:authStorage,storageKey:base+'sdk',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},global:{fetch:root.fetch}});
  client.from=()=>{throw Error('PHASE1_DIRECT_TABLE_DENIED');};
  const sdkRpc=client.rpc.bind(client);client.rpc=(name,args)=>{if(!rpcAllow.has(name))throw Error('PHASE1_RPC_DENIED');return sdkRpc(name,args);};
  client.channel=()=>{const inert={on(){return inert;},subscribe(){return inert;},unsubscribe(){return Promise.resolve();}};return inert;};
  client.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')invalidate();});
  return client;
 }
 async function rpc(name,args={}){if(!rpcAllow.has(name))throw Error('CONTRACT_UNAVAILABLE');const e=epoch;
  const session=(await client.auth.getSession()).data.session;if(!session)throw Error('AUTH_REQUIRED');
  const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await root.fetch(c.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:c.publishable_key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:controller.signal});
   const result=await response.json();if(e!==epoch)throw Error('IDENTITY_CHANGED');if(!response.ok){const error=Error(result.message||'RPC_FAILED');error.code=result.code;error.status=response.status;throw error;}return result;
  }finally{clearTimeout(timer);controllers.delete(controller);}
 }
 async function admit(session){if(!session?.user?.id)throw Error('AUTH_REQUIRED');const p=await rpc('crm_profile_scoped_v2');
  if(p.contract_version!==2||p.auth_uid!==session.user.id||!p.user_id||!p.source_role||!Array.isArray(p.allowed_modes)||!p.allowed_modes.includes('rep')||p.allowed_modes.some(m=>!['rep','admin'].includes(m)))throw Error('PROFILE_CONTRACT_MISMATCH');
  if(activeUid&&activeUid!==p.auth_uid)invalidate();activeUid=p.auth_uid;try{list();}catch(e){invalidate();throw e;}profile=Object.freeze(p);root.dispatchEvent(new Event('phase1:profile'));return profile;
 }
 function beginLogin(){invalidate();channel?.postMessage('relogin');}
 async function signOut(){try{if(client)await client.auth.signOut({scope:'local'});}finally{invalidate();channel?.postMessage('logout');}}
 function mode(m){if(!profile?.allowed_modes.includes(m))throw Error('MODE_DENIED');storage.setItem('mode',m);return m;}
 async function read(resource,args={}){
  if(!profile)throw Error('AUTH_REQUIRED');
  if(resource==='profile')return {contract_version:1,resource,coverage:'complete',scope:'self',data:profile};
  if(resource==='operational'){
   const limit=args.limit===undefined?100:args.limit;if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('INVALID_LIMIT');
   const firstPageLimit=args.firstPageLimit===undefined?limit:args.firstPageLimit;if(!Number.isInteger(firstPageLimit)||firstPageLimit<1||firstPageLimit>limit)throw Error('INVALID_FIRST_PAGE_LIMIT');
   const onPage=typeof args.onPage==='function'?args.onPage:null;
   const knownDomains=['deal_core','inquiry_core','expansion_pool','customer_support_action','message_log'],domains=args.domains===undefined?knownDomains:args.domains;
   if(!Array.isArray(domains)||!domains.length||domains.some((domain,index)=>!knownDomains.includes(domain)||domains.indexOf(domain)!==index))throw Error('INVALID_READ_DOMAINS');
   async function collect(domain){const items=[],seen=new Set();let after=null;for(let pageNo=0;pageNo<500;pageNo++){const pageLimit=pageNo===0?firstPageLimit:limit,result=await rpc('crm_operational_source_v1',{p_domain:domain,p_after:after,p_limit:pageLimit}),p=result?.pagination;if(result?.contract_version!==1||result.resource!=='operational_source'||result.domain!==domain||result.scope_completeness!=='actor_authorized_rows_only'||!Array.isArray(result.items)||!p||!['complete','partial'].includes(p.completeness)||typeof p.has_more!=='boolean'||p.has_more!==(p.completeness==='partial')||p.has_more!==(typeof p.next_cursor==='string'))throw Error('READ_CONTRACT_MISMATCH');for(const item of result.items){if(!item?.id||seen.has(item.id))throw Error('READ_CONTRACT_MISMATCH');seen.add(item.id);items.push(item);}if(onPage)onPage({domain,items:items.slice(),has_more:p.has_more});if(!p.has_more)return items;if(p.next_cursor===after)throw Error('READ_CURSOR_STALLED');after=p.next_cursor;}throw Error('READ_INCOMPLETE');}
   const rows=Object.fromEntries(await Promise.all(domains.map(async domain=>[domain,await collect(domain)]))),deals=rows.deal_core||[],inquiries=rows.inquiry_core||[],expansion_pool=rows.expansion_pool||[],customer_support_actions=rows.customer_support_action||[],message_logs=rows.message_log||[];
   return {contract_version:1,resource,coverage:domains.length===knownDomains.length?'complete_for_actor_scope':'complete_for_requested_domains',scope:'actor_authorized_rows_only',data:{contract_version:5,loaded_domains:domains.slice(),deals,inquiries,expansion_pool,customer_support_actions,customerSupportActions:customer_support_actions,message_logs,messageLogs:message_logs,expansion_events:expansion_pool.flatMap(x=>Array.isArray(x.events)?x.events:[])}};
  }
  if(resource!=='work_items')return {contract_version:1,resource,coverage:'unavailable',scope:'authorized_only',data:null,reason:'CONTRACT_MISSING'};
  if(!args.opportunity_id)throw Error('TARGET_REQUIRED');
  const result=await rpc('crm_read_scoped_v2',{p_deal_id:args.opportunity_id,p_limit:1});
  if(result.contract_version!==2||!Array.isArray(result.deals)||result.deals.length!==1||result.deals[0].id!==args.opportunity_id)throw Error('READ_CONTRACT_MISMATCH');
  return {contract_version:1,resource,coverage:'complete',scope:'single_authorized_opportunity',data:result.deals[0]};
 }
 function list(){try{return JSON.parse(storage.getItem('command-queue')||'[]');}catch{throw Error('QUEUE_CORRUPT');}}
 function save(rows){storage.setItem('command-queue',JSON.stringify(rows));root.dispatchEvent(new Event('phase1:queue'));}
 function inquiryDirectPayload(payload){const allowed=['inquiry_id','inquiry_row','from','to','status','reason','changed_by','actor_name','at','assignment_group','owner_group','branch_code','reporting_group','consultant_name','response'];
  if(!payload||Object.keys(payload).some(k=>!allowed.includes(k)))throw Error('INVALID_COMMAND');
  if(payload.response!==undefined||payload.to==='경남지사'||payload.branch_code==='gyeongnam'||payload.assignment_group==='gyeongnam'||payload.owner_group==='gyeongnam')throw Error('INQUIRY_INTENT_NOT_CONNECTED');
  if(typeof payload.to!=='string'||!payload.to.trim()||payload.to.length>100)throw Error('INVALID_INQUIRY_TARGET');
  if(payload.reason!==undefined&&(typeof payload.reason!=='string'||!payload.reason.trim()||payload.reason.length>2000))throw Error('INVALID_ASSIGNMENT_REASON');
  return {intent:'direct_assign',to_name:payload.to.trim(),...(payload.reason===undefined?{}:{reason:payload.reason.trim()})};
 }
 function enqueue(operation,objectId,expectedVersion,payload,requestId=crypto.randomUUID()){
  if(!profile)throw Error('AUTH_REQUIRED');
  const normalized=root.OperationalAdapter.normalize(operation,objectId,expectedVersion,payload);
  const rows=list();if(rows.some(r=>r.request_id===requestId))throw Error('LOCAL_REQUEST_ID_REUSE');
  const command={request_id:requestId,operation:normalized.operation,object_id:normalized.object_id,expected_version:normalized.expected_version,payload:JSON.parse(JSON.stringify(normalized.payload)),auth_uid:profile.auth_uid,user_id:profile.user_id,status:'pending',tries:0};rows.push(command);save(rows);return command;
 }
 function validateAck(a,q){root.OperationalAdapter.validateAck(a,q);}
 let flushing=null,flushingEpoch=-1;
 async function flush(){if(flushing&&flushingEpoch===epoch)return flushing;const generation=epoch,uid=activeUid;
  const job=(async()=>{for(const snapshot of list().filter(q=>q.status==='pending'||q.status==='uncertain')){
   if(epoch!==generation||activeUid!==uid)throw Error('IDENTITY_CHANGED');
   let rows=list(),q=rows.find(x=>x.request_id===snapshot.request_id);if(!q||q.auth_uid!==uid)throw Error('QUEUE_IDENTITY_MISMATCH');q.status='sending';q.tries++;save(rows);
   try{const ack=await rpc('crm_write_command_v2',{p_request_id:q.request_id,p_operation:q.operation,p_object_id:q.object_id,p_expected_version:q.expected_version,p_payload:q.payload});validateAck(ack,q);
    if(epoch!==generation)throw Error('IDENTITY_CHANGED');rows=list();q=rows.find(x=>x.request_id===snapshot.request_id);if(!q)throw Error('QUEUE_CHANGED');q.status='done';q.ack=ack;delete q.error;save(rows);
   }catch(error){if(epoch!==generation)throw error;rows=list();q=rows.find(x=>x.request_id===snapshot.request_id);if(q){q.status=error.status===409?'conflict':error.status>=400&&error.status<500?'rejected':'uncertain';q.error=error.code||error.message;save(rows);}throw error;}
  }return list();})();flushing=job;flushingEpoch=generation;try{return await job;}finally{if(flushing===job)flushing=null;}
 }
 async function attachmentCommand(operation,objectId,payload){const q=enqueue(operation,objectId,0,payload,crypto.randomUUID());await flush();const row=list().find(x=>x.request_id===q.request_id);if(!row||row.status!=='done'||!row.ack)throw Error(row&&row.error||'ATTACHMENT_COMMAND_UNCERTAIN');return row.ack;}
 async function uploadAttachment(meta,file){if(!profile||!client)throw Error('AUTH_REQUIRED');if(!meta||!file||meta.size_bytes!==file.size)throw Error('INVALID_ATTACHMENT_FILE');const prep=await attachmentCommand('attachment_prepare',meta.opportunity_id,meta),bucket=client.storage.from(prep.bucket_id),signed=await bucket.createSignedUploadUrl(prep.object_path);if(signed.error||!signed.data?.token)throw Error(signed.error?.message||'ATTACHMENT_SIGN_FAILED');const uploaded=await bucket.uploadToSignedUrl(prep.object_path,signed.data.token,file,{contentType:meta.mime_type,upsert:false});if(uploaded.error)throw Error(uploaded.error.message||'ATTACHMENT_UPLOAD_FAILED');const done=await attachmentCommand('attachment_complete',meta.opportunity_id,{opportunity_id:meta.opportunity_id,attachment_id:prep.attachment_id,object_path:prep.object_path,file_name:meta.file_name,mime_type:meta.mime_type,size_bytes:meta.size_bytes,category:meta.category,tags:meta.tags,memo:meta.memo,uploaded_by:meta.uploaded_by});return Object.assign({},meta,done.attachment||{},{id:done.attachment_id,status:'ready'});}
 function restoreQueue(){if(!activeUid)return;const rows=list();let changed=false;for(const q of rows)if(q.status==='sending'){q.status='uncertain';changed=true;}if(changed)save(rows);}
 root.addEventListener('phase1:profile',restoreQueue);
 root.Phase1=Object.freeze({config:c,createClient,admit,beginLogin,signOut,storage,sessionCache,mode,read,rpc,queue:{enqueue,flush,list,validateAck},uploadAttachment,get profile(){return profile;},requests,blocked,
  loginEmail(name){return c.accounts.find(a=>a.name.replace(/\s/g,'')===String(name).replace(/\s/g,''))?.email||null;}});
})(window);
