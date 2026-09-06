const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateTarget,denied}=require('./staging-guard.cjs');
const good={STAGING_PROJECT_REF:'abcdefghijklmnopqrst',STAGING_CONFIRM_PROJECT_REF:'abcdefghijklmnopqrst',STAGING_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',CRM_RUN_STAGING:'1'};
test('staging transport uses opaque server keys only as apikey, and never follows redirects',async()=>{
 const {transport}=require('./staging-guard.cjs');const original=global.fetch;const calls=[];
 global.fetch=async(u,o)=>{calls.push({u,o});return {status:200};};
 try{
  const send=transport(good.STAGING_SUPABASE_URL,'public-fixture');
  await send('/rest/v1/rpc/crm_bundle','sb_secret_fixture',{});
  assert.equal(calls[0].o.headers.apikey,'sb_secret_fixture');assert.equal(calls[0].o.headers.Authorization,undefined);
  await send('/rest/v1/rpc/crm_read_bundle','signed-fixture-token',{});
  assert.equal(calls[1].o.headers.apikey,'public-fixture');assert.equal(calls[1].o.headers.Authorization,'Bearer signed-fixture-token');
  assert.ok(calls.every(c=>c.o.redirect==='error'&&c.o.signal));
  await assert.rejects(send('//evil.invalid/rest/v1/rpc/crm_bundle','fixture',{}));
  assert.equal(calls.length,2);
 }finally{global.fetch=original;}
});
test('staging guard refuses production, redirect origins, credentials, and absent opt-in',()=>{
 assert.equal(validateTarget(good),good.STAGING_SUPABASE_URL);
 for(const change of [
 {STAGING_PROJECT_REF:'ymfbmpnizxvqsamnczow'},
 {STAGING_SUPABASE_URL:'https://ymfbmpnizxvqsamnczow.supabase.co'},
 {STAGING_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co.evil.invalid'},
 {STAGING_SUPABASE_URL:'https://x:y@abcdefghijklmnopqrst.supabase.co'},
 {STAGING_SUPABASE_URL:good.STAGING_SUPABASE_URL+'/?redirect=evil'},
 {CRM_RUN_STAGING:'0'},{STAGING_CONFIRM_PROJECT_REF:'different'}
 ])assert.throws(()=>validateTarget({...good,...change}));
});
test('authorization test rejects missing RPCs, fake 200 denials and invalid JWT errors',async()=>{
 const r=(status,code)=>({status,json:async()=>({code})});
 await denied(r(403,'42501'));await denied(r(401,'42501'));
 for(const [status,code] of [[404,'PGRST202'],[400,'22023'],[200,'42501'],[401,'PGRST301'],[403,'invalid_jwt']])await assert.rejects(denied(r(status,code)));
});
