'use strict';

// Opt-in executable Staging mutation harness. Without every explicit guard it
// performs zero network I/O and reports SKIP (never PASS). Fixture setup and
// cleanup remain separately reviewed DBA artifacts.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const adapter=require('../sql/operational-full-local-candidate/20260906/operational-adapter.candidate.js');
const casebook=require('../sql/operational-full-local-candidate/20260906/staging-mutation-casebook.cjs');

const REF='rprechiaglyjaydkmxsu',PRODUCTION_REF='ymfbmpnizxvqsamnczow',ORIGIN=`https://${REF}.supabase.co`;
const MANIFEST=path.resolve(__dirname,'../sql/operational-full-local-candidate/20260906/manifest.json');
const FIXTURE=path.resolve(__dirname,'../sql/baseline/20260905/synthetic/fixture.json');
const REQUIRED=['CRM_RUN_OPERATIONAL_FULL_STAGING_MUTATION','STAGING_PROJECT_REF','STAGING_CONFIRM_PROJECT_REF','STAGING_SUPABASE_URL','STAGING_PUBLISHABLE_KEY','STAGING_SYNTHETIC_AUTH_FILE','STAGING_MUTATION_FIXTURE_PLAN','STAGING_MUTATION_PROOF_FILE'];
const ACCOUNT_KINDS=['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN','ADMIN_MFA'];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');

function forbiddenEnvironment(env){
 const findings=[];
 for(const [name,raw] of Object.entries(env)){const value=String(raw||'');if(value.includes(PRODUCTION_REF))findings.push(`${name}: production ref`);if(value&&/n8n.*url|url.*n8n/i.test(name))findings.push(`${name}: n8n URL setting`);for(const token of value.match(/https?:\/\/[^\s"'<>]+/gi)||[])try{if(new URL(token).hostname.toLowerCase().includes('n8n'))findings.push(`${name}: n8n URL`);}catch{}}
 for(const name of ['SUPABASE_SERVICE_ROLE_KEY','STAGING_SERVICE_ROLE_KEY','STAGING_SECRET_KEY','STAGING_DATABASE_URL'])if(env[name])findings.push(`${name}: privileged credential prohibited`);
 return [...new Set(findings)];
}
function validateOptIn(env){
 assert.equal(env.CRM_RUN_OPERATIONAL_FULL_STAGING_MUTATION,'1','explicit mutation opt-in required');assert.equal(env.STAGING_PROJECT_REF,REF);assert.equal(env.STAGING_CONFIRM_PROJECT_REF,REF);
 const url=new URL(env.STAGING_SUPABASE_URL);assert.equal(url.origin,ORIGIN);assert.equal(url.pathname,'/');assert.equal(url.search,'');assert.equal(url.hash,'');assert.equal(url.username,'');assert.equal(url.password,'');assert.match(env.STAGING_PUBLISHABLE_KEY||'',/^sb_publishable_/,'publishable key required');
 for(const file of [env.STAGING_SYNTHETIC_AUTH_FILE,env.STAGING_MUTATION_FIXTURE_PLAN])assert.ok(fs.statSync(path.resolve(file)).isFile());
 const proof=path.resolve(env.STAGING_MUTATION_PROOF_FILE),root=path.resolve(__dirname,'../docs/operational-cutover-20260906');assert.ok(proof.startsWith(root+path.sep),'proof file must stay in cutover docs');assert.equal(fs.existsSync(proof),false,'refuse to overwrite an existing proof');return {origin:url.origin,proof};
}
function noSecrets(value){const walk=node=>{if(!node||typeof node!=='object')return;for(const [key,child] of Object.entries(node)){assert.doesNotMatch(key,/password|access[_-]?token|refresh[_-]?token|service[_-]?role|secret[_-]?key|database[_-]?url/i,`proof contains secret field ${key}`);walk(child);}};walk(value);}

const forbidden=forbiddenEnvironment(process.env),missing=REQUIRED.filter(name=>!process.env[name]);
test('full mutation environment excludes Production, n8n and privileged credentials',()=>assert.deepEqual(forbidden,[]));

if(missing.length||forbidden.length)test('cumulative 31-operation Staging JWT mutation gate',{skip:`SKIP (not PASS): ${missing.length?'missing '+missing.join(', '):'unsafe environment'}`},()=>{});
else test('cumulative 31-operation Staging JWT mutation gate',{timeout:900000},async t=>{
 const guard=validateOptIn(process.env),manifestRaw=fs.readFileSync(MANIFEST,'utf8'),manifest=JSON.parse(manifestRaw),fixture=JSON.parse(fs.readFileSync(FIXTURE,'utf8')),fixturePlan=JSON.parse(fs.readFileSync(path.resolve(process.env.STAGING_MUTATION_FIXTURE_PLAN),'utf8')),secrets=JSON.parse(fs.readFileSync(path.resolve(process.env.STAGING_SYNTHETIC_AUTH_FILE),'utf8'));
 assert.equal(manifest.project_ref,REF);assert.equal(manifest.status,'LOCAL_CUMULATIVE_31_OP_M02_M05_NOT_APPLIED');assert.equal(manifest.operations.length,31);assert.equal(fixturePlan.project_ref,REF);assert.equal(fixturePlan.status,'GENERATED_NOT_APPROVED_NOT_RUN');assert.equal(fixturePlan.candidate_manifest_sha256,sha(manifestRaw));assert.equal(fixturePlan.candidate_apply_sha256,manifest.files_sha256['staging-apply.sql']);assert.equal(fixturePlan.canonical_rows_mutated,false);
 const book=casebook.build(fixturePlan,fixture,{now:new Date().toISOString()}),sessions={},identities={},acks={},requests=[],results=[],scenarioFailures=[];let failure=null,point='initialize',writes=0,storageWrites=0;
 const proof={project_ref:REF,project_name:'netform-crm-staging',mode:'JWT_DISPOSABLE_MUTATION_HAPPY_REPLAY',run_id:book.run_id,catalog_sha256:book.catalog_sha256,candidate_apply_sha256:book.candidate_apply_sha256,scenario_count:book.scenario_count,operation_count:book.operation_count,started_at:new Date().toISOString(),status:'FAIL',cleanup_required:true,results};
 const account=kind=>{const expected=fixture.accounts.find(x=>x.kind===kind),secret=secrets.accounts.find(x=>x.kind===kind);assert.ok(expected&&secret,`missing ${kind}`);assert.equal(secret.email,expected.email);assert.ok(secret.email.endsWith('@example.invalid'));assert.ok(secret.password);return {expected,secret};};
 function route(raw){const url=new URL(raw,guard.origin);assert.equal(url.origin,guard.origin);assert.match(url.pathname,/^\/(?:auth|rest|storage)\/v1\//);requests.push(url.pathname);return url;}
 async function api(raw,{method='POST',body,token,contentType='application/json'}={}){const url=route(raw),response=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{apikey:process.env.STAGING_PUBLISHABLE_KEY,'Content-Type':contentType,...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:contentType==='application/json'?JSON.stringify(body):body})});let data=null;try{data=await response.json();}catch{}return {status:response.status,data,headers:response.headers};}
 const rpc=(kind,name,args)=>api(`/rest/v1/rpc/${name}`,{body:args,token:sessions[kind].access_token});
 async function login(kind){const {expected,secret}=account(kind),response=await api('/auth/v1/token?grant_type=password',{body:{email:secret.email,password:secret.password}});assert.equal(response.status,200,`${kind} login failed`);assert.equal(response.data.user.id,expected.auth_uid);const claims=JSON.parse(Buffer.from(response.data.access_token.split('.')[1],'base64url').toString());assert.equal(claims.iss,guard.origin+'/auth/v1');assert.equal(claims.sub,expected.auth_uid);assert.equal(claims.role,'authenticated');sessions[kind]=response.data;identities[kind]={auth_uid:expected.auth_uid,user_id:expected.user_id};}
 async function execute(step){
  const resolved=casebook.resolve(step,acks);point=resolved.id;
  if(resolved.kind==='policy_assertion'){assert.deepEqual(new Set(resolved.operations),new Set([...adapter.operations,casebook.DIRECT_OPERATION]));return {kind:resolved.kind,actor:null};}
  if(resolved.kind==='read'){const response=await rpc(resolved.actor,resolved.rpc,resolved.args);assert.equal(response.status,200);return {kind:resolved.kind,actor:resolved.actor,rpc:resolved.rpc};}
  if(resolved.kind==='write'){
   const command=casebook.validateResolvedStep(resolved,acks,identities),args={p_request_id:command.request_id,p_operation:command.operation,p_object_id:command.object_id,p_expected_version:command.expected_version,p_payload:command.payload};
   const first=await rpc(resolved.actor,'crm_write_command_v2',args);if(first.status!==200){const error=Error(`${resolved.id}: write HTTP ${first.status} code=${first.data?.code||'UNKNOWN'}`);error.http_status=first.status;error.api_code=first.data?.code||null;throw error;}adapter.validateAck(first.data,command);assert.equal(first.data.replayed,false);acks[resolved.id]=first.data;writes++;
   const replay=await rpc(resolved.actor,'crm_write_command_v2',args);assert.equal(replay.status,200,`${resolved.id}: replay HTTP ${replay.status}`);adapter.validateAck(replay.data,command);assert.equal(replay.data.replayed,true);assert.deepEqual({...replay.data,replayed:false},first.data);return {kind:resolved.kind,actor:resolved.actor,operation:command.operation,request_id:command.request_id,replay:true};
  }
  if(resolved.kind==='direct_rpc'&&resolved.rpc==='crm_expansion_note'){
   const response=await rpc(resolved.actor,resolved.rpc,{p:resolved.args});assert.equal(response.status,200);assert.equal(response.data.ok,true);assert.equal(response.data.operation,'crm_expansion_note');assert.equal(response.data.request_id,resolved.request_id);assert.equal(response.data.replayed,false);acks[resolved.id]=response.data;writes++;
   const replay=await rpc(resolved.actor,resolved.rpc,{p:resolved.args});assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);return {kind:resolved.kind,actor:resolved.actor,rpc:resolved.rpc,request_id:resolved.request_id,replay:true};
  }
  if(resolved.kind==='direct_rpc'){const response=await rpc(resolved.actor,resolved.rpc,{p:resolved.args});assert.equal(response.status,200);return {kind:resolved.kind,actor:resolved.actor,rpc:resolved.rpc};}
  if(resolved.kind==='storage_put'){
   const token=sessions[resolved.actor].access_token,encoded=resolved.object_path.split('/').map(encodeURIComponent).join('/'),signed=await api(`/storage/v1/object/upload/sign/${encodeURIComponent(resolved.bucket)}/${encoded}`,{body:{},token});assert.equal(signed.status,200,`${resolved.id}: create signed upload failed`);assert.ok(signed.data?.token,`${resolved.id}: signed upload token missing`);
   const uploaded=await api(`/storage/v1/object/upload/sign/${encodeURIComponent(resolved.bucket)}/${encoded}?token=${encodeURIComponent(signed.data.token)}`,{method:'PUT',body:resolved.body,token,contentType:resolved.content_type});assert.ok([200,201].includes(uploaded.status),`${resolved.id}: signed upload failed`);storageWrites++;return {kind:resolved.kind,actor:resolved.actor,bucket:resolved.bucket,object_path:resolved.object_path};
  }
  throw Error(`unsupported casebook step ${resolved.kind}`);
 }
 try{
  for(const kind of ACCOUNT_KINDS)await login(kind);
  for(const scenario of book.scenarios)await t.test(scenario.id,async()=>{try{for(const step of scenario.steps){const outcome=await execute(step);results.push({scenario:scenario.id,step:step.id,status:'PASS',...outcome});}}catch(error){scenarioFailures.push(error);results.push({scenario:scenario.id,step:point,status:'FAIL',http_status:error.http_status||null,api_code:error.api_code||null,error_type:error.code||error.name});throw error;}});
  if(scenarioFailures.length)failure=scenarioFailures[0];
 }catch(error){failure=error;results.push({scenario:'harness',step:point,status:'FAIL',error_type:error.code||error.name});}
 finally{
  for(const session of Object.values(sessions))try{await api('/auth/v1/logout?scope=local',{body:{},token:session.access_token});}catch{}
  Object.assign(proof,{completed_at:new Date().toISOString(),status:failure?'FAIL':'PASS',failure_point:failure?point:null,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,skip:0,http_requests:requests.length,crm_writes:writes,storage_writes:storageWrites,staging_ddl_dml_performed:false,n8n_requests:0,production_requests:0,error_type:failure?.code||failure?.name||null});noSecrets(proof);fs.writeFileSync(guard.proof,JSON.stringify(proof,null,2)+'\n');
 }
 if(failure)throw failure;assert.equal(proof.status,'PASS');assert.equal(proof.skip,0);
});

module.exports={REF,ORIGIN,REQUIRED,ACCOUNT_KINDS,forbiddenEnvironment,validateOptIn,noSecrets};
