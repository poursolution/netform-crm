'use strict';

// One-shot recovery for the guarded synthetic run cfe9a391. It restores only
// UI-visible values through the same public Dispatcher and refuses any other state.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const bridge=require('../staging-write/compat-adapter-operational-candidate.js');

const REF='rprechiaglyjaydkmxsu';
const ORIGIN=`https://${REF}.supabase.co`;
const RUN='cfe9a391-666e-4601-8fd1-5efea1b82aaf';
const DEAL='f6090500-0006-4000-8000-000000000001';
const config=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/v2-client.json','utf8'));
const secrets=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json','utf8'));
assert.equal(config.project_ref,REF);assert.equal(config.url,ORIGIN);assert.equal(secrets.project_ref,REF);
const account=secrets.accounts.find(x=>x.kind==='INTERNAL_REP');assert.ok(account?.email.endsWith('@example.invalid'));

async function api(route,body,token){
 const url=new URL(route,ORIGIN);assert.equal(url.origin,ORIGIN);assert.match(url.pathname,/^\/(?:auth|rest)\/v1\//);
 const response=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{apikey:config.publishable_key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body||{})});
 let data=null;try{data=await response.json();}catch{}return {status:response.status,data};
}

(async()=>{
 const login=await api('/auth/v1/token?grant_type=password',{email:account.email,password:account.password});assert.equal(login.status,200);
 const session=login.data;
 try{
  const profile=await api('/rest/v1/rpc/crm_profile_scoped_v2',{},session.access_token);assert.equal(profile.status,200);
  const read=async()=>{const r=await api('/rest/v1/rpc/crm_read_scoped_v2',{p_deal_id:DEAL,p_limit:1},session.access_token);assert.equal(r.status,200);return r.data.deals[0];};
  const client=bridge.create({project_ref:REF,url:ORIGIN,publishable_key:config.publishable_key,
   auth:{getSession:async()=>({data:{session}})},fetch:async(url,init)=>{assert.equal(new URL(url).origin,ORIGIN);return fetch(url,init);}});
  let row=await read();assert.equal(row.version,21);assert.equal(row.brand,'TEST-JWT-cfe9a391');assert.equal(row.primary_work,'TEST>JWT-cfe9a391');
  let envelope={write_id:`OP-BUNDLE-RECOVER-SERVICE-${RUN}`,op:'service_change',payload:{opportunity_id:DEAL,to_service:'TEST',reason:`TEST RESTORE failed run ${RUN}`,reason_source:'jwt_recovery'}};
  let command=await bridge.prepare(envelope,{project_ref:REF,auth_uid:session.user.id,user_id:profile.data.user_id,expected_version:row.version});
  await client.send(command);
  row=await read();
  envelope={write_id:`OP-BUNDLE-RECOVER-WORK-${RUN}`,op:'opportunity_work_set',payload:{opportunity_id:DEAL,primary_work:'TEST JWT WORK',work_items:['TEST JWT WORK'],work_summary:'TEST JWT WORK',reason:`TEST RESTORE failed run ${RUN}`}};
  command=await bridge.prepare(envelope,{project_ref:REF,auth_uid:session.user.id,user_id:profile.data.user_id,expected_version:row.version});
  await client.send(command);
  row=await read();assert.equal(row.brand,'TEST');assert.equal(row.primary_work,'TEST JWT WORK');assert.deepEqual(row.work_items,['TEST JWT WORK']);assert.equal(row.work_summary,'TEST JWT WORK');
  console.log(JSON.stringify({status:'SYNTHETIC_VISIBLE_STATE_RESTORED',project_ref:REF,deal_id:DEAL,version:row.version,n8n_requests:0,production_requests:0}));
 }finally{await fetch(ORIGIN+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:config.publishable_key,Authorization:`Bearer ${session.access_token}`}}).catch(()=>{});}
})().catch(error=>{console.error('Synthetic recovery failed: '+(error.code||error.name));process.exitCode=1;});
