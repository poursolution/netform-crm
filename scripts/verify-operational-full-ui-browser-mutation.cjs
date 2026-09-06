'use strict';

// Opt-in real-browser Staging mutation rehearsal over disposable fixtures.
// It exercises the assembled UI's adapter, queue, RPC transport and ACK
// validation, including the approved Storage attachment lifecycle.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');
const adapter=require('../sql/operational-full-local-candidate/20260906/operational-adapter.candidate.js');
const casebook=require('../sql/operational-full-local-candidate/20260906/staging-mutation-casebook.cjs');

const REF='rprechiaglyjaydkmxsu';
const PRODUCTION_REF='ymfbmpnizxvqsamnczow';
const origin=`https://${REF}.supabase.co`;
const local='http://127.0.0.1:4181';
const fixture=require('../sql/baseline/20260905/synthetic/fixture.json');
const credentialsFile='C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json';
const planFile=path.resolve(process.env.STAGING_MUTATION_FIXTURE_PLAN||'');
const required=['CRM_RUN_OPERATIONAL_FULL_UI_BROWSER_MUTATION','STAGING_CONFIRM_PROJECT_REF','STAGING_MUTATION_FIXTURE_PLAN'];

function guard(){
 const missing=required.filter(name=>!process.env[name]);
 assert.deepEqual(missing,[],`explicit opt-in missing: ${missing.join(', ')}`);
 assert.equal(process.env.CRM_RUN_OPERATIONAL_FULL_UI_BROWSER_MUTATION,'1');
 assert.equal(process.env.STAGING_CONFIRM_PROJECT_REF,REF);
 for(const [name,value] of Object.entries(process.env)){
  const text=String(value||'');
  assert.ok(!text.includes(PRODUCTION_REF),`${name}: Production ref prohibited`);
  if(/url/i.test(name))assert.ok(!/n8n/i.test(text),`${name}: n8n URL prohibited`);
 }
 for(const name of ['SUPABASE_SERVICE_ROLE_KEY','STAGING_SERVICE_ROLE_KEY','STAGING_SECRET_KEY','STAGING_DATABASE_URL'])assert.equal(process.env[name],undefined,`${name} prohibited`);
 assert.ok(fs.statSync(planFile).isFile(),'fixture plan required');
 const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
 assert.equal(plan.project_ref,REF);
 assert.equal(plan.status,'GENERATED_NOT_APPROVED_NOT_RUN');
 assert.equal(plan.canonical_rows_mutated,false);
 const output=path.join(path.dirname(planFile),'browser-mutation-proof.json');
 assert.equal(fs.existsSync(output),false,'refuse to overwrite browser mutation proof');
 return {plan,output};
}

const {plan,output}=guard();
const credentials=JSON.parse(fs.readFileSync(credentialsFile,'utf8'));
assert.equal(credentials.project_ref,REF);
const book=casebook.build(plan,fixture,{now:new Date().toISOString()});
const identities=Object.fromEntries(fixture.accounts.map(account=>[account.kind,{auth_uid:account.auth_uid,user_id:account.user_id}]));
const accounts=Object.fromEntries(credentials.accounts.map(account=>[account.kind,account]));
const pages=new Map(),contexts=[];
const acks={},results=[],network=[],violations=[],errors=[];
const absorbedAttachmentScenarios=new Set();
let browser;

function surfaceFor(scenario,step){
 return scenario.startsWith('mobile-')||scenario==='frozen-direct-assign-pc-mobile'&&step.id.endsWith(':2')?'mobile.html':'crm.html';
}
function sanitized(error){return {code:error.code||error.name||'ERROR',http_status:error.status||null};}
async function getPage(actor,file){
 const key=`${actor}:${file}`;
 if(pages.has(key))return pages.get(key);
 const account=accounts[actor];assert.ok(account,`missing ${actor} account`);
 const context=await browser.newContext();contexts.push(context);context.setDefaultTimeout(20000);
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),rpc=url.pathname.replace('/rest/v1/rpc/','');
  const allowedRpc=['crm_profile_scoped_v2','crm_operational_source_v1','crm_read_scoped_v2','crm_write_command_v2','crm_expansion_note','crm_expansion_context'];
  const storageUpload=url.pathname.startsWith('/storage/v1/object/upload/sign/crm-site-files/deals/');
  const ok=url.origin===local||url.origin===origin&&(url.pathname.startsWith('/auth/v1/')||storageUpload||allowedRpc.includes(rpc));
  if(!ok){violations.push({origin:url.origin,path:url.pathname,method:request.method()});return route.abort();}
  network.push({origin:url.origin,path:url.pathname,method:request.method()});return route.continue();
 });
 const page=await context.newPage(),pc=file==='crm.html';
 await page.goto(`${local}/${file}`);
 await page.locator(pc?'#au-name':'#lg-nm').fill(account.name);
 await page.locator(pc?'#au-pw':'#lg-pw').fill(account.password);
 await page.getByRole('button',{name:pc?'로그인':'로그인하기',exact:true}).click();
 await page.waitForFunction(()=>!!window.Phase1?.profile&&!!window.OperationalUI);
 await page.waitForResponse(response=>response.url().includes('/rpc/crm_operational_source_v1')&&response.status()===200);
 const profile=await page.evaluate(()=>({auth_uid:Phase1.profile.auth_uid,user_id:Phase1.profile.user_id}));
 assert.deepEqual(profile,identities[actor]);pages.set(key,page);return page;
}

async function browserWrite(page,resolved,command){
 return page.evaluate(async input=>{
  const queued=Phase1.queue.enqueue(input.operation,input.object_id,input.expected_version,input.raw_payload,input.request_id);
  await Phase1.queue.flush();
  const row=Phase1.queue.list().find(item=>item.request_id===input.request_id);
  if(!row||row.status!=='done'||!row.ack){const error=new Error(row?.error||'UI_QUEUE_WRITE_FAILED');error.code=row?.error||'UI_QUEUE_WRITE_FAILED';throw error;}
  OperationalAdapter.validateAck(row.ack,queued);
  const replay=await Phase1.rpc('crm_write_command_v2',{p_request_id:queued.request_id,p_operation:queued.operation,p_object_id:queued.object_id,p_expected_version:queued.expected_version,p_payload:queued.payload});
  OperationalAdapter.validateAck(replay,queued);
  return {queued,ack:row.ack,replay};
 },{operation:command.operation,object_id:command.object_id,expected_version:command.expected_version,raw_payload:resolved.payload,request_id:command.request_id});
}

async function execute(scenario,step){
 const resolved=casebook.resolve(step,acks);
 if(resolved.kind==='policy_assertion'){
  assert.deepEqual(new Set(resolved.operations),new Set([...adapter.operations,casebook.DIRECT_OPERATION]));
  return {kind:resolved.kind,actor:null,surface:'local'};
 }
 const file=surfaceFor(scenario.id,resolved),page=await getPage(resolved.actor,file);
 if(resolved.kind==='read'){
  await page.evaluate(({rpc,args})=>Phase1.rpc(rpc,args),{rpc:resolved.rpc,args:resolved.args});
  return {kind:'read',actor:resolved.actor,rpc:resolved.rpc,surface:file};
 }
 if(resolved.kind==='write'){
  if(scenario.id==='attachment-lifecycle'&&resolved.operation==='attachment_prepare'){
   const attachment=await page.evaluate(async meta=>{
    const body='0123456789abcdef';
    const file=new File([body],meta.file_name,{type:meta.mime_type});
    return Phase1.uploadAttachment(meta,file);
   },resolved.payload);
   assert.equal(attachment.status,'ready');assert.match(attachment.id,/^[0-9a-f-]{36}$/i);
   acks[resolved.id]={attachment_id:attachment.id,object_path:'absorbed-by-ui-upload'};
   absorbedAttachmentScenarios.add(scenario.id);
   return {kind:'ui_attachment_lifecycle',actor:resolved.actor,operation:'attachment_prepare+storage_put+attachment_complete',surface:file,replay:false};
  }
  if(scenario.id==='attachment-lifecycle'&&resolved.operation==='attachment_complete'){
   assert.equal(absorbedAttachmentScenarios.has(scenario.id),true);
   return {kind:'absorbed_by_ui_attachment_lifecycle',actor:resolved.actor,operation:resolved.operation,surface:file};
  }
  const command=casebook.validateResolvedStep(resolved,acks,identities),outcome=await browserWrite(page,resolved,command);
  assert.deepEqual(outcome.queued.payload,command.payload);assert.equal(outcome.ack.replayed,false);assert.equal(outcome.replay.replayed,true);
  assert.deepEqual({...outcome.replay,replayed:false},outcome.ack);adapter.validateAck(outcome.ack,command);adapter.validateAck(outcome.replay,command);
  acks[resolved.id]=outcome.ack;
  return {kind:'write',actor:resolved.actor,operation:command.operation,request_id:command.request_id,surface:file,replay:true};
 }
 if(resolved.kind==='storage_put'&&scenario.id==='attachment-lifecycle'){
  assert.equal(absorbedAttachmentScenarios.has(scenario.id),true);
  return {kind:'absorbed_by_ui_attachment_lifecycle',actor:resolved.actor,bucket:resolved.bucket,surface:file};
 }
 if(resolved.kind==='direct_rpc'){
  const response=await page.evaluate(({rpc,args})=>Phase1.rpc(rpc,{p:args}),{rpc:resolved.rpc,args:resolved.args});
  if(resolved.rpc==='crm_expansion_note'){
   assert.equal(response.ok,true);assert.equal(response.operation,'crm_expansion_note');assert.equal(response.request_id,resolved.request_id);assert.equal(response.replayed,false);acks[resolved.id]=response;
   const replay=await page.evaluate(({rpc,args})=>Phase1.rpc(rpc,{p:args}),{rpc:resolved.rpc,args:resolved.args});assert.equal(replay.replayed,true);
  }
  return {kind:'direct_rpc',actor:resolved.actor,rpc:resolved.rpc,surface:file};
 }
 throw Error(`unsupported browser step ${resolved.kind}`);
}

async function run(){
 const proof={project_ref:REF,project_name:'netform-crm-staging',mode:'REAL_BROWSER_ASSEMBLED_UI_ADAPTER_QUEUE_ACK_STORAGE',run_id:plan.run_id,fixture_plan_sha256:crypto.createHash('sha256').update(fs.readFileSync(planFile)).digest('hex'),started_at:new Date().toISOString(),status:'FAIL',cleanup_required:true,results,blocked:[]};
 let failure=null,point='initialize';
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const scenario of book.scenarios){
   try{
    for(const step of scenario.steps){point=step.id;const outcome=await execute(scenario,step);results.push({scenario:scenario.id,step:step.id,status:'PASS',...outcome});}
    console.log(`PASS ${scenario.id}`);
   }catch(error){failure=error;errors.push({scenario:scenario.id,step:point,...sanitized(error)});results.push({scenario:scenario.id,step:point,status:'FAIL',...sanitized(error)});console.log(`FAIL ${scenario.id} ${error.code||error.name}`);break;}
  }
 }finally{
  for(const context of contexts)try{await context.close();}catch{}
  if(browser)await browser.close();
  Object.assign(proof,{completed_at:new Date().toISOString(),status:failure?'FAIL':'PASS',failure_point:failure?point:null,scenario_pass:new Set(results.filter(item=>item.status==='PASS').map(item=>item.scenario)).size,step_pass:results.filter(item=>item.status==='PASS').length,step_fail:results.filter(item=>item.status==='FAIL').length,blocked_count:0,http_requests:network.length,write_requests:network.filter(item=>item.path.includes('/crm_write_command_v2')).length,production_requests:network.filter(item=>item.origin.includes(PRODUCTION_REF)).length,n8n_requests:network.filter(item=>/n8n/i.test(item.origin)).length,violations,errors});
  fs.writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({status:proof.status,scenario_pass:proof.scenario_pass,step_pass:proof.step_pass,step_fail:proof.step_fail,blocked:proof.blocked_count,production_requests:proof.production_requests,n8n_requests:proof.n8n_requests,violations:violations.length}));
 }
 if(failure)throw failure;
 assert.equal(proof.scenario_pass,35);assert.equal(proof.step_fail,0);assert.equal(proof.production_requests,0);assert.equal(proof.n8n_requests,0);assert.equal(violations.length,0);
}

run().catch(error=>{console.error(`OPERATIONAL_FULL_UI_BROWSER_MUTATION_FAILED ${error.code||error.name||'ERROR'}`);process.exitCode=1;});
