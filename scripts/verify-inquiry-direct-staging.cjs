'use strict';
// Real synthetic Auth/JWT against the named Staging project only.
// Never prints or persists access tokens, passwords, or response bodies.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const bridge=require('../staging-write/compat-adapter.js'),WriteAck=require('../write-ack.js');
const REF='rprechiaglyjaydkmxsu',ORIGIN=`https://${REF}.supabase.co`;
const OUT=path.resolve(__dirname,'../sql/inquiry-direct-assign/20260906/staging-verification.json');
const config=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/v2-client.json','utf8'));
const secrets=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json','utf8'));
const fixture=require('../sql/baseline/20260905/synthetic/fixture.json');
assert.equal(config.project_ref,REF);assert.equal(secrets.project_ref,REF);assert.equal(config.url,ORIGIN);assert.equal(fixture.project_ref,REF);assert.equal(bridge.project_ref,REF);
const inquiry='f6090500-0005-4000-8000-000000000005';
const target={internal:'f6090500-0001-4000-8000-000000000001',other:'f6090500-0001-4000-8000-000000000002'};
const sessions={},profiles={},results=[],requests=[];let step='initialize';
const runId=crypto.randomUUID(),startedAt=new Date().toISOString();
let proof={project_ref:REF,operation:'inquiry_assign',intent:'direct_assign',run_id:runId,started_at:startedAt,status:'FAIL',results};
async function raw(route,body,token){
 const url=new URL(route,ORIGIN);assert.equal(url.origin,ORIGIN);assert.match(url.pathname,/^\/(?:auth|rest)\/v1\//);requests.push(url.pathname);
 const response=await fetch(url,{method:'POST',redirect:'error',headers:{apikey:config.publishable_key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(20000)});
 let data=null;try{data=await response.json();}catch{}return {status:response.status,data};
}
async function login(kind){const a=secrets.accounts.find(x=>x.kind===kind);assert.ok(a&&a.email.endsWith('@example.invalid'));const r=await raw('/auth/v1/token?grant_type=password',{email:a.email,password:a.password});assert.equal(r.status,200);sessions[kind]=r.data;return r.data;}
const rpc=(name,args,kind)=>raw('/rest/v1/rpc/'+name,args,sessions[kind]?.access_token);
async function check(name,fn){await fn();results.push({name,status:'PASS'});}
async function read(kind='ADMIN'){const r=await rpc('crm_read_scoped_v2',{p_inquiry_id:inquiry,p_limit:1},kind);assert.equal(r.status,200);assert.equal(r.data.inquiries.length,1);assert.equal(r.data.inquiries[0].id,inquiry);return r.data.inquiries[0];}
function envelope(channel,writeId,to,reason,extra={}){const payload={inquiry_id:inquiry,inquiry_row:900005,from:extra.from||'미배정',to,status:extra.status||'배정완료',at:new Date().toISOString(),...extra};delete payload.channel;delete payload.write_id;if(reason!==undefined)payload.reason=reason;return {write_id:writeId,op:'inquiry_assign',payload,channel};}
function identity(kind){const s=sessions[kind],p=profiles[kind];return {project_ref:REF,auth_uid:s.user.id,user_id:p.user_id};}
function client(kind){return bridge.create({project_ref:REF,url:ORIGIN,publishable_key:config.publishable_key,auth:{getSession:async()=>({data:{session:sessions[kind]}})},fetch:async(url,init)=>{const u=new URL(url);assert.equal(u.origin,ORIGIN);requests.push(u.pathname);return fetch(url,init);}});}
async function prepared(kind,w){return bridge.prepare(w,identity(kind));}
async function expectHttp(clientValue,q,status){const error=await clientValue.send(q).then(()=>null,e=>e);assert.ok(error);assert.equal(error.status,status);}
async function main(){try{
 step='login';await login('ADMIN');await login('INTERNAL_REP');
 step='profiles';for(const kind of ['ADMIN','INTERNAL_REP']){const r=await rpc('crm_profile_scoped_v2',{},kind);assert.equal(r.status,200);profiles[kind]=r.data;}
 const admin=client('ADMIN'),rep=client('INTERNAL_REP');
 step='fixture_preflight';const initial=await read();assert.equal(initial.assigned_to,null);assert.equal(initial.status,'접수');

 step='mobile_first_assign';const firstEnvelope=envelope('mobile','INQ-DIRECT-MOBILE-FIRST-'+runId,'TEST INTERNAL_REP');const firstQ=await prepared('ADMIN',firstEnvelope);const firstAck=await admin.send(firstQ);
 await check('mobile first assignment allows no reason and preserves legacy ACK',async()=>{const ack=WriteAck.validate(firstAck,firstEnvelope);assert.equal(ack.ok,true);assert.equal(ack.write_id,firstEnvelope.write_id);assert.equal(ack.operation,'inquiry_assign');assert.equal(ack.intent,'direct_assign');assert.equal(ack.assigned_to,target.internal);assert.equal(ack.status,'배정완료');assert.equal(ack.actor_auth_uid,sessions.ADMIN.user.id);assert.equal(ack.actor_user_id,profiles.ADMIN.user_id);});
 let current=await read();await check('initial state alone becomes assigned complete and refresh agrees',async()=>{assert.equal(current.assigned_to,target.internal);assert.equal(current.status,'배정완료');});

 step='idempotent_replay';const replay=await admin.send(firstQ);await check('same request id replays without another change',async()=>{assert.equal(replay.replayed,true);assert.equal(replay.inquiry_audit_event_id,firstAck.inquiry_audit_event_id);assert.equal((await read()).assigned_to,target.internal);});
 step='request_collision';const collision=JSON.parse(JSON.stringify(firstQ));collision.rpc.p_payload={...collision.rpc.p_payload,to_name:'TEST OTHER_REP',reason:'TEST collision '+runId};await check('same request id with another payload returns 409',()=>expectHttp(admin,collision,409));

 step='reasonless_reassign';const noReason=await prepared('ADMIN',envelope('mobile','INQ-DIRECT-NO-REASON-'+runId,'TEST OTHER_REP',undefined,{from:'TEST INTERNAL_REP'}));await check('reassignment without reason is rejected and state is unchanged',async()=>{await expectHttp(admin,noReason,400);const row=await read();assert.equal(row.assigned_to,target.internal);assert.equal(row.status,'배정완료');});

 step='invalid_targets';for(const name of ['TEST CONSULT','TEST GYEONGNAM','TEST INACTIVE REP','TEST UNAPPROVED REP','TEST EXPIRED REP']){const q=await prepared('ADMIN',envelope('pc','INQ-DIRECT-BAD-TARGET-'+name.replaceAll(' ','-')+'-'+runId,name,'TEST invalid target '+runId,{from:'TEST INTERNAL_REP'}));await check('reject target '+name,()=>expectHttp(admin,q,400));}

 step='unauthorized_actor';const unauthorized=await prepared('INTERNAL_REP',envelope('pc','INQ-DIRECT-UNAUTHORIZED-'+runId,'TEST OTHER_REP','TEST unauthorized actor '+runId,{from:'TEST INTERNAL_REP'}));await check('non-admin user cannot assign scoped inquiry',()=>expectHttp(rep,unauthorized,403));

 step='pc_reassign';const pcReason='TEST PC reassign '+runId;const pcEnvelope=envelope('pc','INQ-DIRECT-PC-'+runId,'TEST OTHER_REP',pcReason,{from:'TEST INTERNAL_REP',assignment_group:'head_office',owner_group:'head_office',branch_code:null,reporting_group:'internal',consultant_name:null});const pcQ=await prepared('ADMIN',pcEnvelope),pcAck=await admin.send(pcQ);
 current=await read();await check('PC reasoned reassignment succeeds and preserves status',async()=>{assert.equal(pcAck.assigned_to,target.other);assert.equal(pcAck.status,'배정완료');assert.equal(current.assigned_to,target.other);assert.equal(current.status,'배정완료');});

 step='mobile_reassign';const mobileReason='TEST MOBILE reassign '+runId;const mobileEnvelope=envelope('mobile','INQ-DIRECT-MOBILE-'+runId,'TEST INTERNAL_REP',mobileReason,{from:'TEST OTHER_REP'});const mobileQ=await prepared('ADMIN',mobileEnvelope),mobileAck=await admin.send(mobileQ);
 current=await read();await check('mobile reasoned reassignment matches PC result contract and preserves status',async()=>{assert.equal(mobileAck.intent,pcAck.intent);assert.equal(mobileAck.operation,pcAck.operation);assert.equal(mobileAck.status,pcAck.status);assert.equal(current.assigned_to,target.internal);assert.equal(current.status,'배정완료');});

 step='deferred_intents';const before=requests.length;for(const payload of [{inquiry_id:inquiry,to:'경남지사'},{inquiry_id:inquiry,to:'TEST GYEONGNAM',branch_code:'gyeongnam'},{inquiry_id:inquiry,to:'TEST INTERNAL_REP',owner_group:'gyeongnam'},{inquiry_id:inquiry,to:'TEST INTERNAL_REP',response:'통화 완료'}])await assert.rejects(bridge.prepare({write_id:'INQ-DEFERRED-'+crypto.randomUUID(),op:'inquiry_assign',payload},identity('ADMIN')),/INQUIRY_INTENT_NOT_CONNECTED/);await check('branch handoff, branch owner assignment, and response update remain disconnected',async()=>assert.equal(requests.length,before));

 proof={...proof,status:'JWT_WRITE_PASS',completed_at:new Date().toISOString(),inquiry_id:inquiry,request_ids:{first:firstQ.rpc.p_request_id,pc:pcQ.rpc.p_request_id,mobile:mobileQ.rpc.p_request_id},audit_event_ids:[firstAck.inquiry_audit_event_id,pcAck.inquiry_audit_event_id,mobileAck.inquiry_audit_event_id],reasons:{pc:pcReason,mobile:mobileReason},actor_auth_uid:firstAck.actor_auth_uid,actor_user_id:firstAck.actor_user_id,final_assigned_to:current.assigned_to,final_status:current.status,http_requests:requests.length,n8n_requests:0,production_requests:0};
 }catch(error){proof={...proof,status:'FAIL',completed_at:new Date().toISOString(),failure_point:step,error_type:error.code||error.name,http_requests:requests.length,n8n_requests:0,production_requests:0};throw error;}finally{for(const session of Object.values(sessions))await fetch(ORIGIN+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.publishable_key,Authorization:'Bearer '+session.access_token}}).catch(()=>{});fs.writeFileSync(OUT,JSON.stringify(proof,null,2));console.log(JSON.stringify({status:proof.status,pass:results.length,fail:proof.status==='FAIL'?1:0,skip:0,n8n_requests:0,production_requests:0}));}}
main().catch(error=>{console.error('Direct assignment Staging verification failed: '+(error.code||error.name));process.exitCode=1;});
