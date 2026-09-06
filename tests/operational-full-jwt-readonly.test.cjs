'use strict';

// Opt-in, CRM-read-only Staging JWT harness for the cumulative 31-operation
// candidate. With no complete opt-in environment it performs zero network I/O
// and reports an explicit SKIP (never PASS).
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const REF='rprechiaglyjaydkmxsu';
const PRODUCTION_REF='ymfbmpnizxvqsamnczow';
const ORIGIN=`https://${REF}.supabase.co`;
const RESULT_FILE=path.resolve(__dirname,'../docs/operational-cutover-20260906/operational-full-jwt-readonly-results.json');
const FIXTURE_FILE=path.resolve(__dirname,'../sql/baseline/20260905/synthetic/fixture.json');
const MANIFEST_FILE=path.resolve(__dirname,'../sql/operational-full-local-candidate/20260906/manifest.json');
const REQUIRED=['CRM_RUN_OPERATIONAL_FULL_STAGING_READONLY','STAGING_PROJECT_REF','STAGING_CONFIRM_PROJECT_REF','STAGING_SUPABASE_URL','STAGING_PUBLISHABLE_KEY','STAGING_SYNTHETIC_AUTH_FILE'];
const ACCOUNT_KINDS=['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN'];
const DOMAINS=['deal_core','inquiry_core','expansion_pool','customer_support_action','message_log'];

function forbiddenEnvironment(env){
 const findings=[];
 for(const [name,raw] of Object.entries(env)){
  const value=String(raw||'');
  if(value.includes(PRODUCTION_REF))findings.push(`${name}: production ref`);
  if(value&&/n8n.*url|url.*n8n/i.test(name))findings.push(`${name}: n8n URL setting`);
  for(const token of value.match(/https?:\/\/[^\s"'<>]+/gi)||[])try{if(new URL(token).hostname.toLowerCase().includes('n8n'))findings.push(`${name}: n8n URL`);}catch{}
 }
 for(const name of ['SUPABASE_SERVICE_ROLE_KEY','STAGING_SERVICE_ROLE_KEY','STAGING_SECRET_KEY','STAGING_DATABASE_URL'])if(env[name])findings.push(`${name}: privileged credential prohibited`);
 return [...new Set(findings)];
}

function validateOptIn(env){
 assert.equal(env.CRM_RUN_OPERATIONAL_FULL_STAGING_READONLY,'1','explicit read-only JWT opt-in required');
 assert.equal(env.STAGING_PROJECT_REF,REF);assert.equal(env.STAGING_CONFIRM_PROJECT_REF,REF);
 const url=new URL(env.STAGING_SUPABASE_URL);assert.equal(url.origin,ORIGIN);assert.equal(url.pathname,'/');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');
 assert.match(env.STAGING_PUBLISHABLE_KEY||'',/^sb_publishable_/,'publishable key required');
 return url.origin;
}

function noSecrets(value){
 const walk=node=>{if(!node||typeof node!=='object')return;for(const [key,child] of Object.entries(node)){assert.doesNotMatch(key,/password|access[_-]?token|refresh[_-]?token|service[_-]?role|secret[_-]?key|database[_-]?url/i,`result contains secret field ${key}`);walk(child);}};
 walk(value);
}

const forbidden=forbiddenEnvironment(process.env),missing=REQUIRED.filter(name=>!process.env[name]);

test('full read-only JWT environment excludes Production, n8n and privileged credentials',()=>assert.deepEqual(forbidden,[]));

if(missing.length||forbidden.length)test('cumulative 31-operation Staging JWT read-only gate',{skip:`SKIP (not PASS): ${missing.length?'missing '+missing.join(', '):'unsafe environment'}`},()=>{});
else test('cumulative 31-operation Staging JWT read-only gate',{timeout:180000},async t=>{
 const origin=validateOptIn(process.env),fixture=JSON.parse(fs.readFileSync(FIXTURE_FILE,'utf8')),manifest=JSON.parse(fs.readFileSync(MANIFEST_FILE,'utf8')),secrets=JSON.parse(fs.readFileSync(path.resolve(process.env.STAGING_SYNTHETIC_AUTH_FILE),'utf8'));
 assert.equal(fixture.project_ref,REF);assert.equal(secrets.project_ref,REF);assert.equal(manifest.project_ref,REF);assert.equal(manifest.status,'LOCAL_CUMULATIVE_31_OP_M02_M05_NOT_APPLIED');assert.equal(manifest.operations.length,31);
 const sessions={},profiles={},requests=[],results=[];let failure=null,step='initialize';
 const proof={project_ref:REF,project_name:'netform-crm-staging',mode:'JWT_CRM_READ_ONLY',candidate_status:manifest.status,operations:manifest.operations,started_at:new Date().toISOString(),status:'FAIL',results};
 const account=kind=>{const expected=fixture.accounts.find(item=>item.kind===kind),secret=secrets.accounts.find(item=>item.kind===kind);assert.ok(expected&&secret,`missing synthetic ${kind}`);assert.equal(secret.email,expected.email);assert.ok(secret.email.endsWith('@example.invalid'));assert.ok(secret.password);return {expected,secret};};
 function record(url){const parsed=new URL(url,origin);assert.equal(parsed.origin,origin);assert.match(parsed.pathname,/^\/(?:auth|rest)\/v1\//);requests.push(parsed.pathname);return parsed;}
 async function api(route,{method='POST',body,token}={}){const url=record(new URL(route,origin));const response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{apikey:process.env.STAGING_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});let data=null;try{data=await response.json();}catch{}return {status:response.status,data};}
 const rpc=(kind,name,args={})=>api(`/rest/v1/rpc/${name}`,{body:args,token:sessions[kind]?.access_token});
 async function check(name,fn){step=name;let error=null;await t.test(name,async()=>{try{await fn();results.push({name,status:'PASS'});}catch(caught){error=caught;results.push({name,status:'FAIL',error_type:caught.code||caught.name});throw caught;}});if(error)throw error;}
 async function login(kind){const {expected,secret}=account(kind),response=await api('/auth/v1/token?grant_type=password',{body:{email:secret.email,password:secret.password}});assert.equal(response.status,200,`${kind} login failed`);assert.equal(response.data.user.id,expected.auth_uid);const claims=JSON.parse(Buffer.from(response.data.access_token.split('.')[1],'base64url').toString());assert.equal(claims.iss,origin+'/auth/v1');assert.equal(claims.sub,expected.auth_uid);assert.equal(claims.role,'authenticated');sessions[kind]=response.data;}
 async function expectSqlDenied(response,label){assert.ok([401,403].includes(response.status),`${label}: expected 401/403, got ${response.status}`);assert.equal(response.data?.code,'42501',`${label}: missing-RPC or invalid JWT is not authorization proof`);}
 async function expectHidden(response,label){assert.equal(response.status,404,`${label}: private object unexpectedly resolved`);assert.match(response.data?.code||'',/^PGRST/,`${label}: expected PostgREST not-found code`);}
 async function collect(kind,domain){let after=null,pages=0;const ids=new Set(),items=[];while(pages++<100){const label=`${kind}/${domain}`;const response=await rpc(kind,'crm_operational_source_v1',{p_domain:domain,p_after:after,p_limit:100});assert.equal(response.status,200,`${label} read failed`);const value=response.data,p=value?.pagination;assert.equal(value?.contract_version,1,`${label} contract version`);assert.equal(value?.resource,'operational_source',`${label} resource`);assert.equal(value?.domain,domain,`${label} domain`);assert.equal(value?.scope_completeness,'actor_authorized_rows_only',`${label} scope`);assert.ok(Array.isArray(value.items),`${label} items`);assert.ok(p&&['complete','partial'].includes(p.completeness),`${label} pagination completeness`);assert.equal(p.has_more,p.completeness==='partial',`${label} has_more`);for(const item of value.items){assert.match(item?.id||'',/^[0-9a-f-]{36}$/i);assert.equal(ids.has(item.id),false,`${label} duplicate ${item.id}`);ids.add(item.id);items.push(item);}if(!p.has_more){assert.equal(p.next_cursor,null,`${label} final cursor`);return {pages,rows:items.length};}assert.match(p.next_cursor||'',/^[0-9a-f-]{36}$/i);assert.notEqual(p.next_cursor,after);after=p.next_cursor;}throw Error(`${kind}/${domain} pagination did not terminate`);}
 try{
  for(const kind of ACCOUNT_KINDS)await login(kind);
  await check('five JWT identities map to reviewed Auth and CRM UUIDs',async()=>{for(const kind of ACCOUNT_KINDS){const response=await rpc(kind,'crm_profile_scoped_v2');assert.equal(response.status,200);profiles[kind]=response.data;const expected=account(kind).expected;assert.equal(response.data.auth_uid,expected.auth_uid);assert.equal(response.data.user_id,expected.user_id);}});
  await check('anonymous callers receive real SQL authorization denial',async()=>{await expectSqlDenied(await api('/rest/v1/rpc/crm_profile_scoped_v2',{body:{}}),'profile');await expectSqlDenied(await api('/rest/v1/rpc/crm_operational_source_v1',{body:{p_domain:'deal_core',p_after:null,p_limit:1}}),'operational source');await expectSqlDenied(await api('/rest/v1/rpc/crm_read_scoped_v2',{body:{p_limit:1}}),'scoped read');});
  const pageSummary={};
  await check('all five roles exhaust every actor-scoped operational domain without duplicates',async()=>{for(const kind of ACCOUNT_KINDS){pageSummary[kind]={};for(const domain of DOMAINS)pageSummary[kind][domain]=await collect(kind,domain);}});
  await check('legacy scoped read remains JWT-bound for every reviewed role',async()=>{for(const kind of ACCOUNT_KINDS){const response=await rpc(kind,'crm_read_scoped_v2',{p_limit:100});assert.equal(response.status,200,`${kind} scoped read failed`);assert.equal(response.data?.contract_version,2);assert.ok(Array.isArray(response.data.deals));assert.ok(Array.isArray(response.data.inquiries));}});
  await check('all generated private helpers remain absent from the public RPC schema cache',async()=>{for(const qualified of manifest.candidate_inventory.function_names.filter(name=>name.startsWith('crm_security.'))){const name=qualified.slice('crm_security.'.length);await expectHidden(await rpc('ADMIN',name,{}),qualified);}});
  await check('all generated private relations remain absent from the public REST surface',async()=>{for(const qualified of manifest.candidate_inventory.relation_names){const name=qualified.slice('crm_security.'.length),response=await api(`/rest/v1/${name}?select=*`,{method:'GET',token:sessions.ADMIN.access_token});await expectHidden(response,qualified);}});
  proof.page_summary=pageSummary;
 }catch(error){failure=error;}finally{
  for(const session of Object.values(sessions))try{await api('/auth/v1/logout?scope=local',{body:{},token:session.access_token});}catch{}
  Object.assign(proof,{completed_at:new Date().toISOString(),status:failure?'FAIL':'PASS',failure_point:failure?step:null,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,skip:0,http_requests:requests.length,crm_writes:0,staging_ddl_dml_performed:false,n8n_requests:0,production_requests:0,error_type:failure?.code||failure?.name||null});
  noSecrets(proof);fs.writeFileSync(RESULT_FILE,JSON.stringify(proof,null,2)+'\n');
 }
 if(failure)throw failure;assert.equal(proof.status,'PASS');assert.equal(proof.crm_writes,0);
});

module.exports={REF,ORIGIN,REQUIRED,ACCOUNT_KINDS,DOMAINS,forbiddenEnvironment,validateOptIn,noSecrets};
