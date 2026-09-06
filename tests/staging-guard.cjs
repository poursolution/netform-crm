'use strict';
const assert=require('node:assert/strict');
// Known production project from the checked-in browser configuration.
const PRODUCTION_REF='ymfbmpnizxvqsamnczow';
function validateTarget(e){
 const ref=e.STAGING_PROJECT_REF;
 assert.match(ref||'',/^[a-z]{20}$/,'Explicit staging project ref required');
 assert.notEqual(ref,PRODUCTION_REF,'Production target prohibited');
 assert.equal(e.STAGING_CONFIRM_PROJECT_REF,ref,'Confirm the isolated disposable project ref');
 const url=new URL(e.STAGING_SUPABASE_URL);
 assert.equal(url.origin,'https://'+ref+'.supabase.co','Only the exact staging origin is allowed');
 assert.equal(url.pathname,'/');assert.equal(url.search,'');assert.equal(url.hash,'');
 assert.equal(url.username,'');assert.equal(url.password,'');
 assert.equal(e.CRM_RUN_STAGING,'1','Live requests require explicit opt-in');
 return url.origin;
}
async function denied(response){
 const body=await response.json();
 // Missing RPC (404), bad parameters, invalid/expired JWT, and network failures
 // are not authorization proof. A real DB permission error is required.
 assert.ok([401,403].includes(response.status),'Expected SQL authorization denial; HTTP '+response.status);
 assert.equal(body.code,'42501','Expected insufficient_privilege, not missing API or invalid JWT');
}
function transport(origin,key){
 return async(path,token,body)=>{
  assert.match(path,/^\/(?:auth\/v1\/|rest\/v1\/|functions\/v1\/|storage\/v1\/)/);
  const url=new URL(path,origin);assert.equal(url.origin,origin,'Cross-origin request prohibited');
  // New opaque secret keys authenticate via apikey; they are NOT signed JWTs.
  // Legacy service_role JWT and real user JWT still use Authorization: Bearer.
  const secret=typeof token==='string'&&token.startsWith('sb_secret_');
  return fetch(url,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(15000),
   headers:{apikey:secret?token:key,'Content-Type':'application/json',...(token&&!secret?{Authorization:'Bearer '+token}:{})},
   ...(body===undefined?{}:{body:JSON.stringify(body)})});
 };
}
module.exports={validateTarget,denied,transport};
