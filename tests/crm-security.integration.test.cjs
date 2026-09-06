const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {validateTarget,denied,transport}=require('./staging-guard.cjs');
const E=process.env,live=E.CRM_RUN_STAGING==='1',strict=live||E.CRM_REQUIRE_STAGING==='1';
const options={skip:strict?false:'NOT VERIFIED: isolated staging/JWT fixture not configured'};
const roles=['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN'];
let fixture,request,tokens={},users={};
const rpc=(name,token,body={})=>{
 assert.match(name,/^crm_[a-z_]+$/);
 return request('/rest/v1/rpc/'+name,token,body);
};
async function ok(r){assert.equal(r.status,200,'Expected successful existing endpoint');return r.json();}
async function bundle(token){const b=await ok(await rpc('crm_read_bundle',token));assert.ok(Array.isArray(b.deals));return b;}
const has=(b,id)=>b.deals.some(x=>String(x.id)===id);
const assign=()=>({p_inquiry_id:fixture.otherInquiryId,p_to:fixture.repName,p_changed_by:'forged-admin',p_reason:'synthetic security test'});
const exportParams=()=>({p:fixture.export});
async function verifyUser(token,id){
 const user=await ok(await request('/auth/v1/user',token));
 assert.equal(user.id,id,'Actual Auth identity must match independently seeded fixture');
 return user;
}

before(async()=>{
 if(!strict)return;
 // This validation precedes EVERY possible network request.
 const origin=validateTarget(E);
 for(const key of ['STAGING_PUBLISHABLE_KEY','STAGING_SERVICE_ROLE_KEY','STAGING_ADMIN_AAL2_TOKEN','STAGING_FIXTURE_FILE'])assert.ok(E[key],'Missing '+key);
 for(const role of roles)for(const suffix of ['EMAIL','PASSWORD'])assert.ok(E['STAGING_'+role+'_'+suffix],'Missing '+role+' '+suffix);
 fixture=JSON.parse(fs.readFileSync(E.STAGING_FIXTURE_FILE,'utf8'));
 assert.equal(fixture.projectRef,E.STAGING_PROJECT_REF);
 assert.equal(fixture.reviewedSyntheticOnly,true,'Disposable synthetic fixture must be reviewed');
 assert.equal(fixture.contractsReviewed,true,'Own-write, audit and Storage adapters must be implemented and reviewed first');
 assert.ok(fixture.ownWrite&&fixture.readWriteAudit&&fixture.signedUrl,'Missing real application endpoint contracts');
 assert.ok(Object.keys(fixture.ownWrite.expectedReadFields||{}).length,'Write must verify a persisted change, not an empty assertion');
 for(const id of ['ownOpportunityId','otherOpportunityId','consultInquiryId','gyeongnamOpportunityId','otherInquiryId','otherUserKey'])assert.ok(fixture[id]);
 assert.equal(new Set([fixture.ownOpportunityId,fixture.otherOpportunityId,fixture.gyeongnamOpportunityId]).size,3);
 request=transport(origin,E.STAGING_PUBLISHABLE_KEY);
 for(const role of roles){
  const login=await ok(await request('/auth/v1/token?grant_type=password',null,{email:E['STAGING_'+role+'_EMAIL'],password:E['STAGING_'+role+'_PASSWORD']}));
  tokens[role]=login.access_token;users[role]=await verifyUser(tokens[role],fixture.users[role]);
 }
 assert.notEqual(fixture.users.ADMIN_MFA,fixture.users.ADMIN,'Use a distinct MFA-admin fixture');
 users.AAL2=await verifyUser(E.STAGING_ADMIN_AAL2_TOKEN,fixture.users.ADMIN_MFA);
 // Positive fixture control: "other data absent" must not pass because it never existed.
 const server=await ok(await rpc('crm_bundle',E.STAGING_SERVICE_ROLE_KEY));
 for(const id of [fixture.ownOpportunityId,fixture.otherOpportunityId,fixture.gyeongnamOpportunityId])assert.ok(has(server,id),'Missing synthetic opportunity');
 assert.ok(server.inquiries.some(x=>String(x.id)===fixture.consultInquiryId),'Missing consultation inquiry');
});

test('anon cannot read either CRM bundle',options,async()=>{
 for(const fn of ['crm_bundle','crm_read_bundle'])await denied(await rpc(fn,null));
});
test('anon cannot invoke the reviewed CRM write inventory',options,async()=>{
 assert.ok(fixture.anonWrites.length>=7,'List every reviewed write signature/body, not just one sample');
 for(const c of fixture.anonWrites)await denied(await rpc(c.name,null,c.body));
});
test('rep cannot read another rep restricted opportunity',options,async()=>{
 const b=await bundle(tokens.INTERNAL_REP);assert.ok(has(b,fixture.ownOpportunityId));
 for(const id of [fixture.otherOpportunityId,fixture.gyeongnamOpportunityId])assert.equal(has(b,id),false);
});
test('rep cannot reassign another rep inquiry',options,async()=>{await denied(await rpc('crm_inquiry_assign',tokens.INTERNAL_REP,assign()));});
test('rep cannot trash or purge inquiries',options,async()=>{
 await denied(await rpc('crm_inquiry_purge',tokens.INTERNAL_REP,{p_inquiry_id:fixture.otherInquiryId}));
 await denied(await rpc('crm_inquiry_trash',tokens.INTERNAL_REP,{p_inquiry_id:fixture.otherInquiryId,p_deleted_by:'forged-admin',p_delete_reason:'synthetic test',p_delete_note:null}));
});
test('rep permitted opportunity supports an actual authorized write and read-back',options,async()=>{
 assert.ok(has(await bundle(tokens.INTERNAL_REP),fixture.ownOpportunityId));
 const c=fixture.ownWrite;
 const result=await ok(await rpc(c.name,tokens.INTERNAL_REP,c.body));
 assert.equal(result.actor_id,users.INTERNAL_REP.id);assert.ok(result.audit_id);
 // Service-controlled audit reader contract must read the persisted audit, not echo input.
 const audit=await ok(await rpc(fixture.readWriteAudit.name,E.STAGING_SERVICE_ROLE_KEY,{p_audit_id:result.audit_id}));
 assert.equal(audit.actor_id,users.INTERNAL_REP.id);assert.equal(audit.opportunity_id,fixture.ownOpportunityId);
 for(const [k,v] of Object.entries(c.expectedReadFields)){
  assert.equal((await bundle(tokens.INTERNAL_REP)).deals.find(x=>String(x.id)===fixture.ownOpportunityId)[k],v);
 }
});
test('consultation and gyeongnam read scopes and writes stay isolated',options,async()=>{
 const consult=await bundle(tokens.CONSULT);assert.equal(consult.deals.length,0);
 assert.ok(consult.inquiries.some(x=>String(x.id)===fixture.consultInquiryId));
 for(const row of consult.inquiries)assert.deepEqual(Object.keys(row).sort(),['created','id','site','status']);
 await denied(await rpc('crm_inquiry_assign',tokens.CONSULT,assign()));
 for(const [role,own] of [['GYEONGNAM',fixture.gyeongnamOpportunityId]]){
  const b=await bundle(tokens[role]);assert.ok(has(b,own));
  for(const id of [fixture.ownOpportunityId,fixture.otherOpportunityId])assert.equal(has(b,id),false);
  await denied(await rpc('crm_inquiry_assign',tokens[role],assign()));
 }
});
test('admin scoped export requires real aal2 and returns bounded audited data',options,async()=>{
 assert.ok(has(await bundle(tokens.ADMIN),fixture.otherOpportunityId));
 for(const token of [tokens.INTERNAL_REP,tokens.ADMIN])await denied(await rpc('crm_export_create',token,exportParams()));
 const r=await ok(await rpc('crm_export_create',E.STAGING_ADMIN_AAL2_TOKEN,exportParams()));
 assert.equal(r.actor_id,users.AAL2.id);assert.ok(r.audit_id);
 assert.ok(r.rows.length>0&&r.rows.length<=fixture.export.limit);assert.deepEqual(r.columns,fixture.export.columns);
 for(const row of r.rows)assert.deepEqual(Object.keys(row).sort(),[...fixture.export.columns].sort());
 const repeated=await rpc('crm_export_create',E.STAGING_ADMIN_AAL2_TOKEN,exportParams());
 assert.equal(repeated.status,400);assert.equal((await repeated.json()).code,'P0001');
});
test('forged actor is ignored or rejected and other user history stays private',options,async()=>{
 await denied(await rpc('crm_user_opportunity_states',tokens.INTERNAL_REP,{p_user_key:fixture.otherUserKey}));
 const c=fixture.ownWrite,body=structuredClone(c.body);
 assert.ok(body.p&&typeof body.p==='object','Reviewed auth-aware JSON write required');
 Object.assign(body.p,{changed_by:'forged-admin',actor_name:'forged-admin',user_key:fixture.otherUserKey});
 const r=await rpc(c.name,tokens.INTERNAL_REP,body);
 if([401,403].includes(r.status)){await denied(r);return;}
 const data=await ok(r);assert.equal(data.actor_id,users.INTERNAL_REP.id);assert.ok(data.audit_id);
 const audit=await ok(await rpc(fixture.readWriteAudit.name,E.STAGING_SERVICE_ROLE_KEY,{p_audit_id:data.audit_id}));
 assert.equal(audit.actor_id,users.INTERNAL_REP.id);
});
test('contacts, attachments and real signed URL issuance enforce opportunity ownership',options,async()=>{
 for(const fn of ['crm_site_contacts','crm_deal_attachments'])await denied(await rpc(fn,tokens.INTERNAL_REP,{p_opportunity_id:fixture.otherOpportunityId}));
 const c=fixture.signedUrl;
 assert.ok(c.otherObjectPath,'Known other object_path fixture required');
 for(const body of [
  {opportunity_id:fixture.otherOpportunityId,attachment_id:c.otherAttachmentId},
  {opportunity_id:fixture.ownOpportunityId,attachment_id:c.otherAttachmentId},
  {opportunity_id:fixture.otherOpportunityId,attachment_id:c.ownAttachmentId},
  {opportunity_id:fixture.ownOpportunityId,attachment_id:c.ownAttachmentId,object_path:c.otherObjectPath}
 ]){
  const blocked=await request(c.path,tokens.INTERNAL_REP,body);
  assert.equal(blocked.status,403);assert.equal((await blocked.json()).code,'42501');
 }
 const allowed=await ok(await request(c.path,tokens.INTERNAL_REP,{opportunity_id:fixture.ownOpportunityId,attachment_id:c.ownAttachmentId}));
 const url=new URL(allowed.signed_url,E.STAGING_SUPABASE_URL);
 assert.equal(url.origin,new URL(E.STAGING_SUPABASE_URL).origin);
 assert.ok(url.pathname.startsWith('/storage/v1/object/sign/crm-site-files/'));
 // Fetch actual synthetic bytes; a string resembling a URL is not proof.
 const file=await request(url.pathname+url.search);
 assert.equal(file.status,200);assert.equal(await file.text(),c.expectedSyntheticText);
});
test('service role uses the existing server bundle, browser roles cannot',options,async()=>{
 assert.ok(has(await ok(await rpc('crm_bundle',E.STAGING_SERVICE_ROLE_KEY)),fixture.otherOpportunityId));
 for(const token of [tokens.INTERNAL_REP,tokens.ADMIN])await denied(await rpc('crm_bundle',token));
});
