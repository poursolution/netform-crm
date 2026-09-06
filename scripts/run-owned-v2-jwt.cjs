'use strict';
// Staging-only real Auth login. Never logs or persists access/refresh tokens or passwords.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const REF='rprechiaglyjaydkmxsu',URL=`https://${REF}.supabase.co`;
const root=path.resolve(__dirname,'../sql/v2-owned/20260905');
const map=require('../sql/baseline/20260905/synthetic/auth-mapping.json').accounts;
const uid=(g,n)=>`f6090500-${String(g).padStart(4,'0')}-4000-8000-${String(n).padStart(12,'0')}`;
const mode=process.argv[2];assert.ok(['unregistered','approved'].includes(mode));
const client=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/v2-client.json','utf8'));
const credentials=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json','utf8'));
assert.equal(client.project_ref,REF);assert.equal(client.url,URL);assert.equal(credentials.project_ref,REF);
assert.ok(client.publishable_key.startsWith('sb_publishable_'));assert.equal(credentials.accounts.length,6);
const sessions=[],results=[],writes=[];let claims=[];
async function api(route,body,token){
 assert.ok(route.startsWith('/auth/v1/')||route.startsWith('/rest/v1/rpc/'));
 const r=await fetch(URL+route,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{apikey:client.publishable_key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={code:'NON_JSON'};}return {status:r.status,ok:r.ok,data};
}
const rpc=(i,name,body={})=>api('/rest/v1/rpc/'+name,body,i===null?null:sessions[i]);
function ok(r){assert.equal(r.ok,true,`HTTP ${r.status} / ${r.data?.code||'unexpected'}`);return r.data;}
function denied(r,code='42501'){assert.equal(r.ok,false);assert.equal(r.data.code,code,`HTTP ${r.status} / ${r.data?.code||'unexpected'}`);}
async function check(id,name,fn){await fn();results.push({id,name,status:'PASS'});console.log(`PASS ${id}: ${name}`);}
function work(id,version=1,actor='FORGED ADMIN'){return {p_opportunity_id:id,p_primary_work:'TEST JWT WORK',p_work_items:['TEST JWT WORK'],p_reason:'TEST synthetic real JWT verification',p_expected_version:version,p_actor_name:actor};}
async function main(){try{
 for(let i=0;i<credentials.accounts.length;i++){
  const a=credentials.accounts[i];assert.ok(a.email.endsWith('@example.invalid'));const expected=map.find(x=>x.kind===a.kind);assert.ok(expected);
  const r=await api('/auth/v1/token?grant_type=password',{email:a.email,password:a.password});
  if(!r.ok)throw new Error(`Auth login ${a.kind}: HTTP ${r.status} / ${r.data.error_code||r.data.code||'unknown'}`);
  assert.equal(r.data.user.id,expected.auth_uid);const token=r.data.access_token;
  const c=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());assert.equal(c.iss,URL+'/auth/v1');assert.equal(c.sub,expected.auth_uid);assert.equal(c.role,'authenticated');assert.equal(c.aal,'aal1');
  sessions.push(token);claims.push({kind:a.kind,auth_uid:c.sub,role:c.role,aal:c.aal,issued_at:c.iat,expires_at:c.exp});
 }
 if(mode==='unregistered'){
  await check(2,'real authenticated identities without access_review fail closed',async()=>{for(let i=0;i<6;i++)denied(await rpc(i,'crm_profile_scoped_v2'));});
 }else{
  await check(1,'anon denied all four v2 entrypoints',async()=>{
   for(const [name,body] of [['crm_profile_scoped_v2',{}],['crm_read_scoped_v2',{}],['crm_contacts_scoped_v2',{p_opportunity_id:uid(6,1)}],['crm_work_set_scoped_v2',work(uid(6,1))]])denied(await rpc(null,name,body));
  });
  await check(3,'Rep A own Deal and Inquiry succeed',async()=>{const r=ok(await rpc(0,'crm_read_scoped_v2'));assert.deepEqual(r.deals.map(x=>x.id),[uid(6,1)]);assert.deepEqual(r.inquiries.map(x=>x.id),[uid(5,1)]);const p=ok(await rpc(0,'crm_profile_scoped_v2'));assert.equal(p.auth_uid,claims[0].auth_uid);assert.equal(p.user_id,uid(1,1));});
  await check(4,'Rep A denied Rep B including shared-site Opportunity',async()=>{for(const n of [2,3])denied(await rpc(0,'crm_read_scoped_v2',{p_deal_id:uid(6,n)}));denied(await rpc(0,'crm_read_scoped_v2',{p_inquiry_id:uid(5,2)}));});
  await check(5,'Rep B denied Rep A',async()=>{denied(await rpc(1,'crm_read_scoped_v2',{p_deal_id:uid(6,1)}));denied(await rpc(1,'crm_read_scoped_v2',{p_inquiry_id:uid(5,1)}));});
  await check(6,'consultation own Inquiry only; Deal/work denied',async()=>{const r=ok(await rpc(2,'crm_read_scoped_v2'));assert.deepEqual(r.deals,[]);assert.deepEqual(r.inquiries.map(x=>x.id),[uid(5,3)]);denied(await rpc(2,'crm_work_set_scoped_v2',work(uid(6,1))));denied(await rpc(2,'crm_read_scoped_v2',{p_deal_id:uid(6,1)}));});
  await check(7,'branch explicit scopes only',async()=>{const r=ok(await rpc(3,'crm_read_scoped_v2'));assert.deepEqual(r.deals.map(x=>x.id),[uid(6,4)]);assert.deepEqual(r.inquiries.map(x=>x.id),[uid(5,4)]);denied(await rpc(3,'crm_read_scoped_v2',{p_deal_id:uid(6,1)}));});
  await check(8,'both admins explicit scopes only; MFA remains AAL1',async()=>{for(const i of [4,5]){const r=ok(await rpc(i,'crm_read_scoped_v2'));assert.deepEqual(r.deals.map(x=>x.id),[uid(6,5)]);assert.deepEqual(r.inquiries.map(x=>x.id),[uid(5,5)]);denied(await rpc(i,'crm_read_scoped_v2',{p_deal_id:uid(6,1)}));}});
  await check(9,'own contact allowed; foreign and shared-site ID denied',async()=>{const r=ok(await rpc(0,'crm_contacts_scoped_v2',{p_opportunity_id:uid(6,1)}));assert.deepEqual(r.map(x=>x.id),[uid(4,1)]);for(const n of [2,3])denied(await rpc(0,'crm_contacts_scoped_v2',{p_opportunity_id:uid(6,n)}));});
  await check(10,'own work persists; foreign work/version conflict denied',async()=>{
   denied(await rpc(0,'crm_work_set_scoped_v2',work(uid(6,2))));
   const initial=ok(await rpc(0,'crm_read_scoped_v2',{p_deal_id:uid(6,1)})).deals[0].version;
   assert.ok([1,2].includes(initial),'Unexpected starting fixture version; do not rerun blindly');
   const r=ok(await rpc(0,'crm_work_set_scoped_v2',work(uid(6,1),initial,'FORGED ADMIN A')));assert.equal(r.version,initial+1);writes.push(r);
   const conflict=await rpc(0,'crm_work_set_scoped_v2',work(uid(6,1),initial));denied(conflict,'PT409');assert.equal(conflict.status,409);
   const r2=ok(await rpc(0,'crm_work_set_scoped_v2',work(uid(6,1),initial+1,'FORGED DIFFERENT NAME')));assert.equal(r2.version,initial+2);writes.push(r2);
   const observed=ok(await rpc(0,'crm_read_scoped_v2',{p_deal_id:uid(6,1)}));assert.equal(observed.deals[0].version,initial+2);assert.deepEqual(observed.deals[0].work_items,['TEST JWT WORK']);
  });
  results.push({id:11,name:'server audit actor Auth UUID + CRM UUID',status:'PENDING_SQL_AUDIT_VERIFICATION',expected_auth_uid:claims[0].auth_uid,expected_user_id:uid(1,1),event_ids:writes.map(x=>x.audit_event_id)});
 }
}finally{
 for(const token of sessions){try{await api('/auth/v1/logout?scope=local',{},token);}catch{/* No token is written; logout status is reported below. */}}
 const report={project_ref:REF,mode,executed_at:new Date().toISOString(),claims,results,writes,mfa:'MFA_NOT_ENROLLED / AAL1',legacy:'UNCHANGED / EXPECTED_OUTSTANDING_RISK',production_connections:0};
 fs.writeFileSync(path.join(root,`jwt-${mode}.json`),JSON.stringify(report,null,2));sessions.fill(null);
}}
main().catch(e=>{console.error('STOP: '+e.message);process.exitCode=1;});
