'use strict';
// Creates Auth users ONLY in a confirmed disposable staging project.
// Does NOT create CRM memberships, grant admin via user_metadata, seed customer
// tables, enroll MFA, or deploy SQL. Run once; partial creation is not auto-deleted.
const assert=require('node:assert/strict');
const {validateTarget,transport}=require('../tests/staging-guard.cjs');
async function main(){
 const e=process.env,origin=validateTarget(e);
 assert.equal(e.CRM_PROVISION_STAGING,'1','Auth provisioning needs explicit opt-in');
 assert.ok(e.STAGING_SERVICE_ROLE_KEY,'Staging service credential required');
 const roles=['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN','ADMIN_MFA'];
 const accounts=roles.map(role=>{
  const email=e['STAGING_'+role+'_EMAIL'],password=e['STAGING_'+role+'_PASSWORD'];
  assert.match(email||'',/^[^@]+@example\.invalid$/,'Use synthetic @example.invalid accounts only');
  assert.ok(password&&password.length>=20&&!/^\d+$/.test(password),'Use a unique randomly generated 20+ character password');
  return {role,email,password};
 });
 assert.equal(new Set(accounts.map(x=>x.email)).size,accounts.length,'Distinct accounts required');
 assert.equal(new Set(accounts.map(x=>x.password)).size,accounts.length,'Unique passwords required');
 const request=transport(origin,e.STAGING_SERVICE_ROLE_KEY);
 for(const account of accounts){
  const r=await request('/auth/v1/admin/users',e.STAGING_SERVICE_ROLE_KEY,{
   email:account.email,password:account.password,email_confirm:true
  });
  if(r.status!==200&&r.status!==201)throw Error('Provisioning stopped at '+account.role+' (HTTP '+r.status+'); inspect staging before retry');
  const u=await r.json();assert.ok(u.id);
  console.log(JSON.stringify({role:account.role,id:u.id})); // No credentials/tokens.
 }
 console.log('Auth only. Review CRM UUID membership mapping and enroll admin MFA manually before testing.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
