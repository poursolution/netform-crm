'use strict';

// Local harness for a future, explicitly approved Staging rehearsal. Importing or
// running this file without the complete opt-in environment performs no network I/O.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const bridge=require('../staging-write/compat-adapter-operational-candidate.js');

const STAGING_REF='rprechiaglyjaydkmxsu';
const PRODUCTION_REF='ymfbmpnizxvqsamnczow';
const STAGING_ORIGIN=`https://${STAGING_REF}.supabase.co`;
const RESULT_FILE=path.resolve(__dirname,'../docs/operational-cutover-20260906/operational-bundle-jwt-results.json');
const FIXTURE_FILE=path.resolve(__dirname,'../sql/baseline/20260905/synthetic/fixture.json');
const REQUIRED=[
 'CRM_RUN_OPERATIONAL_BUNDLE_STAGING','STAGING_PROJECT_REF','STAGING_CONFIRM_PROJECT_REF',
 'STAGING_SUPABASE_URL','STAGING_PUBLISHABLE_KEY','STAGING_SYNTHETIC_AUTH_FILE'
];

function forbiddenEnvironment(env){
 const findings=[];
 for(const [name,raw] of Object.entries(env)){
  const value=String(raw||'');
  if(value.includes(PRODUCTION_REF))findings.push(`${name}: production ref`);
  if(value&&/n8n.*url|url.*n8n/i.test(name))findings.push(`${name}: n8n URL setting`);
  for(const token of value.match(/https?:\/\/[^\s"'<>]+/gi)||[]){
   try{if(new URL(token).hostname.toLowerCase().includes('n8n'))findings.push(`${name}: n8n URL`);}catch{}
  }
 }
 for(const name of ['SUPABASE_SERVICE_ROLE_KEY','STAGING_SERVICE_ROLE_KEY','STAGING_SECRET_KEY','STAGING_DATABASE_URL']){
  if(env[name])findings.push(`${name}: privileged credential is prohibited in JWT harness`);
 }
 return [...new Set(findings)];
}

function validateOptIn(env){
 assert.equal(env.CRM_RUN_OPERATIONAL_BUNDLE_STAGING,'1','explicit Staging rehearsal opt-in required');
 assert.equal(env.STAGING_PROJECT_REF,STAGING_REF,'only the approved Staging ref is allowed');
 assert.equal(env.STAGING_CONFIRM_PROJECT_REF,STAGING_REF,'Staging ref confirmation mismatch');
 const url=new URL(env.STAGING_SUPABASE_URL);
 assert.equal(url.origin,STAGING_ORIGIN,'only the exact Staging origin is allowed');
 assert.equal(url.pathname,'/');assert.equal(url.search,'');assert.equal(url.hash,'');
 assert.equal(url.username,'');assert.equal(url.password,'');
 assert.match(env.STAGING_PUBLISHABLE_KEY||'',/^sb_publishable_/,'publishable key required; secret/legacy key prohibited');
 return url.origin;
}

const forbidden=forbiddenEnvironment(process.env);
const missing=REQUIRED.filter(name=>!process.env[name]);

test('operational bundle JWT environment is free of Production, n8n, and privileged DB credentials',()=>{
 assert.deepEqual(forbidden,[],`unsafe environment: ${forbidden.join(', ')}`);
});

if(missing.length||forbidden.length){
 test('operational bundle real Staging JWT rehearsal',{
  skip:`SKIP (not PASS): ${missing.length?'missing '+missing.join(', '):'unsafe environment failed the guard'}`
 },()=>{});
}else test('operational bundle real Staging JWT rehearsal',{timeout:180000},async t=>{
 const origin=validateOptIn(process.env);
 assert.equal(bridge.project_ref,STAGING_REF,'frozen compatibility adapter points elsewhere');
 const fixture=JSON.parse(fs.readFileSync(FIXTURE_FILE,'utf8'));
 const secretPath=path.resolve(process.env.STAGING_SYNTHETIC_AUTH_FILE);
 const secrets=JSON.parse(fs.readFileSync(secretPath,'utf8'));
 assert.equal(fixture.project_ref,STAGING_REF);assert.equal(secrets.project_ref,STAGING_REF);

 const account=kind=>{
  const expected=fixture.accounts.find(item=>item.kind===kind);
  const secret=secrets.accounts.find(item=>item.kind===kind);
  assert.ok(expected&&secret,`missing synthetic ${kind}`);
  assert.equal(secret.email,expected.email);assert.ok(secret.email.endsWith('@example.invalid'));
  assert.ok(secret.password,`missing synthetic ${kind} password`);
  return {expected,secret};
 };
 const rows=fixture.rows;
 const dealId=process.env.STAGING_SYNTHETIC_DEAL_ID||rows.deals.find(row=>row.owner_id===account('INTERNAL_REP').expected.user_id)?.id;
 const inquiryId=process.env.STAGING_SYNTHETIC_INQUIRY_ID||rows.inquiries.find(row=>row.site_name==='TEST 아파트 ADMIN')?.id;
 assert.equal(dealId,'f6090500-0006-4000-8000-000000000001','unexpected synthetic Deal target');
 assert.equal(inquiryId,'f6090500-0005-4000-8000-000000000005','unexpected synthetic Inquiry target');

 const sessions={},profiles={},requests=[],results=[],requestIds=[],dealAuditIds=[],inquiryAuditIds=[];
 const publicTokens={assignment:[],business:[]};
 const runId=crypto.randomUUID();
 const startedAt=new Date().toISOString();
 let step='initialize',before=null,workChanged=false,serviceChanged=false,inquiryChanged=false;
 let primaryFailure=null,primaryFailurePoint=null,restoreFailure=null,proof={
  project_ref:STAGING_REF,run_id:runId,started_at:startedAt,status:'FAIL',failure_point:step,
  operations:['opportunity_work_set','inquiry_assign','inquiry_unassign','service_change'],results
 };

 function recordRequest(url){
  const parsed=new URL(url,origin);
  assert.equal(parsed.origin,origin,'cross-origin request prohibited');
  assert.match(parsed.pathname,/^\/(?:auth|rest)\/v1\//,'only Supabase Auth and REST paths are allowed');
  requests.push(parsed.pathname);
  return parsed;
 }
 async function api(route,{method='POST',body,token}={}){
  const url=recordRequest(new URL(route,origin));
  const response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{apikey:process.env.STAGING_PUBLISHABLE_KEY,'Content-Type':'application/json',
    ...(token?{Authorization:`Bearer ${token}`}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data=null;try{data=await response.json();}catch{}
  return {status:response.status,data,headers:response.headers};
 }
 const rpc=(kind,name,args={})=>api(`/rest/v1/rpc/${name}`,{body:args,token:sessions[kind]?.access_token});
 async function login(kind){
  const {expected,secret}=account(kind);
  const response=await api('/auth/v1/token?grant_type=password',{body:{email:secret.email,password:secret.password}});
  assert.equal(response.status,200,`${kind} login failed`);assert.equal(response.data.user.id,expected.auth_uid);
  const claims=JSON.parse(Buffer.from(response.data.access_token.split('.')[1],'base64url').toString());
  assert.equal(claims.iss,origin+'/auth/v1');assert.equal(claims.sub,expected.auth_uid);assert.equal(claims.role,'authenticated');
  sessions[kind]=response.data;
 }
 async function ok(kind,name,args={}){
  const response=await rpc(kind,name,args);assert.equal(response.status,200,`${name} failed for ${kind}`);return response.data;
 }
 async function rejected(kind,name,args,status){
  const response=await rpc(kind,name,args);assert.equal(response.status,status,`${name} expected HTTP ${status}`);return response.data;
 }
 async function check(name,fn){
  step=name;let failure=null;
  await t.test(name,async()=>{try{await fn();results.push({name,status:'PASS'});}catch(error){failure=error;throw error;}});
  if(failure)throw failure;
 }
 async function read(kind,{deal=false,inquiry=false}={}){
  return ok(kind,'crm_read_scoped_v2',{p_limit:1,...(deal?{p_deal_id:dealId}:{}),...(inquiry?{p_inquiry_id:inquiryId}:{})});
 }
 function guardedClient(kind){
  return bridge.create({project_ref:STAGING_REF,url:origin,publishable_key:process.env.STAGING_PUBLISHABLE_KEY,
   auth:{getSession:async()=>({data:{session:sessions[kind]}})},fetch:async(url,options)=>{
    recordRequest(url);return fetch(url,{...options,redirect:'error'});
   }});
 }
 async function prepared(kind,envelope,expectedVersion=0){
  return bridge.prepare(envelope,{project_ref:STAGING_REF,auth_uid:sessions[kind].user.id,
   user_id:profiles[kind].user_id,expected_version:expectedVersion});
 }
 function captureRequest(ack){
  requestIds.push(ack.request_id);
  if(ack.audit_event_id)dealAuditIds.push(ack.audit_event_id);
  if(ack.inquiry_audit_event_id)inquiryAuditIds.push(ack.inquiry_audit_event_id);
  return ack;
 }
 function uuid(value,label){assert.match(value||'',/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,label);}
 function workEnvelope(writeId,row,reason){return {write_id:writeId,op:'opportunity_work_set',payload:{
  opportunity_id:dealId,primary_work:row.primary_work,work_items:row.work_items,
  work_summary:row.work_summary,reason
 }};}
 function assignEnvelope(writeId,to,reason){const payload={inquiry_id:inquiryId,from:'UNTRUSTED',to,status:'UNTRUSTED',at:'2000-01-01T00:00:00Z'};
  if(reason!==undefined)payload.reason=reason;return {write_id:writeId,op:'inquiry_assign',payload};}
 function serviceEnvelope(writeId,payload){return {write_id:writeId,op:'service_change',payload:{opportunity_id:dealId,...payload}};}
 async function unassign(kind,reason,writeId=`OP-BUNDLE-UNASSIGN-${crypto.randomUUID()}`){
  const envelope={write_id:writeId,op:'inquiry_unassign',payload:{inquiry_id:inquiryId,
   from:'UNTRUSTED',status:'UNTRUSTED',actor_name:'UNTRUSTED',at:'2000-01-01T00:00:00Z',reason}};
  const command=await prepared(kind,envelope);
  return {envelope,command,ack:captureRequest(await guardedClient(kind).send(command))};
 }
 async function verifyPublicCount(table,column,value,token){
  const filter=encodeURIComponent(`eq.${value}`),select=encodeURIComponent('id');
  const response=await api(`/rest/v1/${table}?select=${select}&${column}=${filter}`,{method:'GET',token});
  assert.equal(response.status,200,`${table} verification read failed`);return Array.isArray(response.data)?response.data.length:NaN;
 }
 async function restore(){
  if(!before)return;
  const admin=guardedClient('ADMIN'),rep=guardedClient('INTERNAL_REP');
  const inquiryNow=(await read('ADMIN',{inquiry:true})).inquiries[0];
  if(inquiryNow.assigned_to!==before.inquiry.assigned_to){
   if(before.inquiry.assigned_to===null){
    if(inquiryNow.assigned_to!==null)await unassign('ADMIN',`TEST RESTORE ${runId}`,`OP-BUNDLE-RESTORE-UNASSIGN-${runId}`);
   }else{
    const target=fixture.accounts.find(item=>item.user_id===before.inquiry.assigned_to);
    assert.ok(target&&['INTERNAL_REP','OTHER_REP'].includes(target.kind),'initial Inquiry owner is not restorable by direct_assign');
    const env=assignEnvelope(`OP-BUNDLE-RESTORE-INQUIRY-${runId}`,target.name,`TEST RESTORE ${runId}`);
    const q=await prepared('ADMIN',env);captureRequest(await admin.send(q));
   }
  }
  inquiryChanged=false;

  let dealNow=(await read('INTERNAL_REP',{deal:true})).deals[0];
  if(serviceChanged&&dealNow.brand!==before.deal.brand){
   assert.ok(before.deal.brand,'initial visible business is required for semantic restore');
   const env=serviceEnvelope(`OP-BUNDLE-RESTORE-SERVICE-${runId}`,{to_service:before.deal.brand,
    reason:`TEST RESTORE ${runId}`,reason_source:'jwt_rehearsal'});
   const q=await prepared('INTERNAL_REP',env,dealNow.version);captureRequest(await rep.send(q));
  }
  serviceChanged=false;
  dealNow=(await read('INTERNAL_REP',{deal:true})).deals[0];
  if(workChanged&&(dealNow.primary_work!==before.deal.primary_work||dealNow.work_summary!==before.deal.work_summary||
    JSON.stringify(dealNow.work_items)!==JSON.stringify(before.deal.work_items))){
   assert.ok(before.deal.primary_work&&before.deal.work_summary&&Array.isArray(before.deal.work_items)&&before.deal.work_items.length,
    'initial work state is not restorable through the compatibility contract');
   const env=workEnvelope(`OP-BUNDLE-RESTORE-WORK-${runId}`,before.deal,`TEST RESTORE ${runId}`);
   const q=await prepared('INTERNAL_REP',env,dealNow.version);captureRequest(await rep.send(q));
  }
  workChanged=false;
  const finalInquiry=(await read('ADMIN',{inquiry:true})).inquiries[0];
  const finalDeal=(await read('INTERNAL_REP',{deal:true})).deals[0];
  assert.equal(finalInquiry.assigned_to,before.inquiry.assigned_to,'Inquiry owner restore mismatch');
  assert.equal(finalInquiry.status,before.inquiry.status,'Inquiry status restore mismatch');
  assert.equal(finalDeal.brand,before.deal.brand,'Deal business display restore mismatch');
  assert.equal(finalDeal.primary_work,before.deal.primary_work,'Deal primary work restore mismatch');
  assert.deepEqual(finalDeal.work_items,before.deal.work_items,'Deal work items restore mismatch');
  assert.equal(finalDeal.work_summary,before.deal.work_summary,'Deal work summary restore mismatch');
 }
 try{
  step='login';for(const kind of ['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN'])await login(kind);
  step='profile';for(const kind of Object.keys(sessions))profiles[kind]=await ok(kind,'crm_profile_scoped_v2');
  await check('roles map real JWT Auth UUID to reviewed CRM UUID',async()=>{
   for(const kind of Object.keys(sessions)){const expected=account(kind).expected;
    assert.equal(profiles[kind].auth_uid,expected.auth_uid);assert.equal(profiles[kind].user_id,expected.user_id);}
  });
  await check('scoped read candidate exposes Deal work and Inquiry compatibility fields',async()=>{
   const deal=(await read('INTERNAL_REP',{deal:true})).deals[0];
   const inquiry=(await read('ADMIN',{inquiry:true})).inquiries[0];
   for(const key of ['id','primary_work','work_items','work_scope_type','work_summary','version'])assert.ok(Object.hasOwn(deal,key),key);
   for(const key of ['id','row','site','contact','phone','assignee','assigned_to','status','at','work','detail','assignment_history'])assert.ok(Object.hasOwn(inquiry,key),key);
   assert.ok(Array.isArray(inquiry.assignment_history));assert.match(inquiry.site_name||'',/^TEST /);
   before={deal:structuredClone(deal),inquiry:structuredClone(inquiry)};
   assert.ok(deal.primary_work&&deal.work_summary&&Array.isArray(deal.work_items)&&deal.work_items.length,
    'synthetic Deal must have a restorable work baseline');
   assert.equal(inquiry.first_response_at,null,'use the no-response synthetic Inquiry');assert.equal(inquiry.responded_at,null);
   assert.ok(fixture.accounts.some(a=>['INTERNAL_REP','OTHER_REP'].includes(a.kind)&&a.user_id===inquiry.assigned_to),
    'synthetic Inquiry must be owned by an approved synthetic rep so restoration is exact');
   assert.equal(inquiry.status,'배정완료','synthetic Inquiry must start in the restorable assigned state');
  });
  await check('role scopes expose only the selected owner Inquiry and Deal',async()=>{
   await rejected('OTHER_REP','crm_read_scoped_v2',{p_deal_id:dealId,p_limit:1},403);
   assert.equal((await read('INTERNAL_REP',{inquiry:true})).inquiries[0].id,inquiryId);
   for(const kind of ['OTHER_REP','CONSULT','GYEONGNAM'])await rejected(kind,'crm_read_scoped_v2',{p_inquiry_id:inquiryId,p_limit:1},403);
  });

  const repClient=guardedClient('INTERNAL_REP'),adminClient=guardedClient('ADMIN'),otherClient=guardedClient('OTHER_REP');
  let deal=(await read('INTERNAL_REP',{deal:true})).deals[0];
  const work={primary_work:`TEST>JWT-${runId.slice(0,8)}`,work_items:[`TEST>JWT-${runId.slice(0,8)}`],work_summary:`TEST JWT ${runId.slice(0,8)}`};
  const workEnv=workEnvelope(`OP-BUNDLE-WORK-${runId}`,work,`TEST operational bundle work ${runId}`);
  const workQ=await prepared('INTERNAL_REP',workEnv,deal.version);let workAck;
  await check('opportunity_work_set writes, refreshes, and keeps server actor UUIDs',async()=>{
   workAck=captureRequest(await repClient.send(workQ));workChanged=true;uuid(workAck.audit_event_id,'work audit id');
   assert.equal(workAck.actor_auth_uid,sessions.INTERNAL_REP.user.id);assert.equal(workAck.actor_user_id,profiles.INTERNAL_REP.user_id);
   const refreshed=(await read('INTERNAL_REP',{deal:true})).deals[0];assert.equal(refreshed.primary_work,work.primary_work);
   assert.deepEqual(refreshed.work_items,work.work_items);assert.equal(refreshed.work_summary,work.work_summary);
  });
  await check('opportunity_work_set replay is stable, reuse and stale version are 409, other owner is denied',async()=>{
   const replay=await repClient.send(workQ);assert.equal(replay.replayed,true);assert.equal(replay.audit_event_id,workAck.audit_event_id);
   const reuse=structuredClone(workQ);reuse.rpc.p_payload.reason='TEST CHANGED PAYLOAD';await assert.rejects(repClient.send(reuse),e=>e.status===409);
   const refreshed=(await read('INTERNAL_REP',{deal:true})).deals[0];
   const stale=await prepared('INTERNAL_REP',workEnvelope(`OP-BUNDLE-WORK-STALE-${runId}`,work,'TEST stale version'),deal.version);
   await assert.rejects(repClient.send(stale),e=>e.status===409);
   const deniedQ=await prepared('OTHER_REP',workEnvelope(`OP-BUNDLE-WORK-DENIED-${runId}`,work,'TEST denied owner'),refreshed.version);
   await assert.rejects(otherClient.send(deniedQ),e=>e.status===403);
  });

  deal=(await read('INTERNAL_REP',{deal:true})).deals[0];
  const serviceToken=`TEST SERVICE ${runId}`;
  const servicePayload={from_service:'UNTRUSTED',to_service:`TEST-JWT-${runId.slice(0,8)}`,origin_channel:'UNTRUSTED',
   reason:serviceToken,reason_source:'jwt_rehearsal',at:'2000-01-01T00:00:00Z'};
  const serviceEnv=serviceEnvelope(`OP-BUNDLE-SERVICE-${runId}`,servicePayload);
  const serviceQ=await prepared('INTERNAL_REP',serviceEnv,deal.version);let serviceAck;
  await check('service_change writes one atomic result, refreshes, and keeps server actor UUIDs',async()=>{
   serviceAck=captureRequest(await repClient.send(serviceQ));serviceChanged=true;
   publicTokens.business.push(serviceToken);uuid(serviceAck.audit_event_id,'service audit id');
   assert.equal(serviceAck.actor_auth_uid,sessions.INTERNAL_REP.user.id);assert.equal(serviceAck.actor_user_id,profiles.INTERNAL_REP.user_id);
   assert.equal((await read('INTERNAL_REP',{deal:true})).deals[0].brand,servicePayload.to_service);
   assert.equal(await verifyPublicCount('business_history','reason',serviceToken,sessions.INTERNAL_REP.access_token),1);
  });
  await check('service_change replay is stable, reuse and stale version are 409, other owner is denied',async()=>{
   const replay=await repClient.send(serviceQ);
   assert.equal(replay.replayed,true);assert.equal(replay.audit_event_id,serviceAck.audit_event_id);
   const reuse=structuredClone(serviceQ);reuse.rpc.p_payload.reason='TEST CHANGED PAYLOAD';await assert.rejects(repClient.send(reuse),e=>e.status===409);
   const current=(await read('INTERNAL_REP',{deal:true})).deals[0];
   const stale=await prepared('INTERNAL_REP',serviceEnvelope(`OP-BUNDLE-SERVICE-STALE-${runId}`,servicePayload),deal.version);
   await assert.rejects(repClient.send(stale),e=>e.status===409);
   const deniedQ=await prepared('OTHER_REP',serviceEnvelope(`OP-BUNDLE-SERVICE-DENIED-${runId}`,servicePayload),current.version);
   await assert.rejects(otherClient.send(deniedQ),e=>e.status===403);
  });

  let inquiry=(await read('ADMIN',{inquiry:true})).inquiries[0];
  const initialOwner=fixture.accounts.find(a=>a.user_id===inquiry.assigned_to);
  const target=initialOwner?.kind==='INTERNAL_REP'?account('OTHER_REP').expected:account('INTERNAL_REP').expected;
  const assignToken=`TEST ASSIGN ${runId}`,assignEnv=assignEnvelope(`OP-BUNDLE-ASSIGN-${runId}`,target.name,
   inquiry.assigned_to===null?undefined:assignToken);
  const assignQ=await prepared('ADMIN',assignEnv);let assignAck;
  await check('direct_assign writes exactly one visible assignment history and server audit identity',async()=>{
   const countBefore=inquiry.assignment_history.filter(h=>h.reason===assignToken).length;
   assignAck=captureRequest(await adminClient.send(assignQ));inquiryChanged=true;publicTokens.assignment.push(assignToken);
   uuid(assignAck.inquiry_audit_event_id,'direct assignment audit id');
   assert.equal(assignAck.actor_auth_uid,sessions.ADMIN.user.id);assert.equal(assignAck.actor_user_id,profiles.ADMIN.user_id);
   inquiry=(await read('ADMIN',{inquiry:true})).inquiries[0];assert.equal(inquiry.assigned_to,target.user_id);
   assert.equal(inquiry.assignment_history.filter(h=>h.reason===assignToken).length,countBefore+(assignToken?1:0));
  });
  await check('direct_assign replay/reuse and non-admin role denial remain enforced',async()=>{
   const replay=await adminClient.send(assignQ);assert.equal(replay.replayed,true);assert.equal(replay.inquiry_audit_event_id,assignAck.inquiry_audit_event_id);
   const reuse=structuredClone(assignQ);reuse.rpc.p_payload.to_name=
    account(target.kind==='OTHER_REP'?'INTERNAL_REP':'OTHER_REP').expected.name;
   await assert.rejects(adminClient.send(reuse),e=>e.status===409);
   const deniedQ=await prepared('INTERNAL_REP',assignEnvelope(`OP-BUNDLE-ASSIGN-DENIED-${runId}`,target.name,'TEST denied'));
   await assert.rejects(repClient.send(deniedQ),e=>e.status===403);
  });

  const unassignToken=`TEST UNASSIGN ${runId}`;
  const unassignEnv={write_id:`OP-BUNDLE-UNASSIGN-${runId}`,op:'inquiry_unassign',payload:{
   inquiry_id:inquiryId,from:'UNTRUSTED',status:'UNTRUSTED',changed_by:'UNTRUSTED',at:'2000-01-01T00:00:00Z',reason:unassignToken}};
  const unassignQ=await prepared('ADMIN',unassignEnv);let unassignAck;
  await check('inquiry_unassign resets only an unanswered Inquiry and writes one visible history row',async()=>{
   const countBefore=inquiry.assignment_history.filter(h=>h.reason===unassignToken).length;
   unassignAck=captureRequest(await adminClient.send(unassignQ));publicTokens.assignment.push(unassignToken);
   uuid(unassignAck.inquiry_audit_event_id,'unassign audit id');assert.equal(unassignAck.actor_auth_uid,sessions.ADMIN.user.id);
   inquiry=(await read('ADMIN',{inquiry:true})).inquiries[0];assert.equal(inquiry.assigned_to,null);assert.equal(inquiry.status,'접수');
   assert.equal(inquiry.assignment_history.filter(h=>h.reason===unassignToken).length,countBefore+1);
  });
  await check('inquiry_unassign replay/reuse and non-admin role denial remain enforced',async()=>{
   const replay=await adminClient.send(unassignQ);
   assert.equal(replay.replayed,true);assert.equal(replay.inquiry_audit_event_id,unassignAck.inquiry_audit_event_id);
   const reuse=structuredClone(unassignQ);reuse.rpc.p_payload.reason='TEST CHANGED PAYLOAD';await assert.rejects(adminClient.send(reuse),e=>e.status===409);
   const deniedQ=await prepared('INTERNAL_REP',{write_id:`OP-BUNDLE-UNASSIGN-DENIED-${runId}`,op:'inquiry_unassign',payload:{
    inquiry_id:inquiryId,from:'UNTRUSTED',status:'UNTRUSTED',reason:'TEST denied'}});
   await assert.rejects(repClient.send(deniedQ),e=>e.status===403);
  });
 }catch(error){primaryFailure=error;primaryFailurePoint=step;}finally{
  step='restore';try{await restore();}catch(error){restoreFailure=error;}
  for(const [kind,session] of Object.entries(sessions)){
   try{await api('/auth/v1/logout?scope=local',{body:{},token:session.access_token});}catch{results.push({name:`logout_${kind}`,status:'WARN'});}
  }
  proof={...proof,completed_at:new Date().toISOString(),failure_point:restoreFailure?'restore':primaryFailure?primaryFailurePoint:null,
   status:restoreFailure?'RESTORE_FAILED':primaryFailure?'FAIL':'JWT_PASS_PRIVATE_EVIDENCE_PENDING',pass:results.filter(r=>r.status==='PASS').length,
   fail:restoreFailure||primaryFailure?1:0,skip:0,request_ids:[...new Set(requestIds)],
   deal_audit_event_ids:[...new Set(dealAuditIds)],inquiry_audit_event_ids:[...new Set(inquiryAuditIds)],
   public_history_tokens:publicTokens,
   http_requests:requests.length,n8n_requests:0,production_requests:0,
   restore:{attempted:Boolean(before),status:restoreFailure?'FAIL':before?'PASS':'NOT_NEEDED'},
   error_type:(restoreFailure||primaryFailure)?.code||(restoreFailure||primaryFailure)?.name||null};
  fs.writeFileSync(RESULT_FILE,JSON.stringify(proof,null,2));
 }
 if(restoreFailure)throw new AggregateError([...(primaryFailure?[primaryFailure]:[]),restoreFailure],
  `RESTORE_FAILED at ${step}; result retained at ${RESULT_FILE}`);
 if(primaryFailure)throw primaryFailure;
 assert.equal(proof.status,'JWT_PASS_PRIVATE_EVIDENCE_PENDING');
});
