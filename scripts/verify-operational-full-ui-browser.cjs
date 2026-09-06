'use strict';

// Real browser + real Staging Auth/read only. No business write is sent.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const REF='rprechiaglyjaydkmxsu',origin='https://'+REF+'.supabase.co',local='http://127.0.0.1:4181';
const credentials=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json','utf8'));
const expectedOperations=require('../sql/operational-full-local-candidate/20260906/operational-adapter.candidate.js').operations;
if(credentials.project_ref!==REF)throw Error('WRONG_PROJECT');
const results=[],network=[],violations=[],errors=[];let browser;

async function check(name,fn){
 try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}
 catch(error){results.push({name,status:'FAIL',reason:error.name||'ERROR'});errors.push({name,code:error.name||'ERROR'});console.log('FAIL '+name+' '+(error.name||'ERROR'));}
}

async function context(){
 const ctx=await browser.newContext();ctx.setDefaultTimeout(15000);
 await ctx.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url()),rpc=url.pathname.replace('/rest/v1/rpc/','');
  const ok=url.origin===local||url.origin===origin&&(url.pathname.startsWith('/auth/v1/')||['crm_profile_scoped_v2','crm_operational_source_v1'].includes(rpc));
  if(!ok){violations.push({origin:url.origin,path:url.pathname,method:request.method()});return route.abort();}
  network.push({origin:url.origin,path:url.pathname,method:request.method()});return route.continue();
 });
 return ctx;
}

async function login(page,file,account){
 const pc=file==='crm.html';
 await page.goto(local+'/'+file);
 await page.locator(pc?'#au-name':'#lg-nm').fill(account.name);
 await page.locator(pc?'#au-pw':'#lg-pw').fill(account.password);
 await page.getByRole('button',{name:pc?'로그인':'로그인하기',exact:true}).click();
 await page.waitForFunction(()=>!!window.Phase1?.profile&&!!window.OperationalUI);
 await page.waitForResponse(response=>response.url().includes('/rpc/crm_operational_source_v1')&&response.status()===200);
}

async function run(){
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const file of ['crm.html','mobile.html'])for(const account of credentials.accounts)await check(file+' '+account.kind+' full operational auth/read/fail-closed',async()=>{
   const ctx=await context(),page=await ctx.newPage();
   try{
    await login(page,file,account);
    const proof=await page.evaluate(async()=>{
     const read=await Phase1.read('operational',{limit:100}),before=Phase1.requests.length;let code='';
     try{pushWrite('not_a_real_operation',{object_id:'00000000-0000-4000-8000-000000000001'});}catch(error){code=error.code||error.message;}
     return {profile:{user_id:Phase1.profile.user_id,auth_uid:Phase1.profile.auth_uid},ops:[...OperationalAdapter.operations],coverage:read.coverage,contract:read.data.contract_version,arrays:['deals','inquiries','expansion_pool','customer_support_actions','message_logs'].every(key=>Array.isArray(read.data[key])),unsupported:code,request_delta:Phase1.requests.length-before,blocked:Phase1.blocked.length};
    });
    assert.equal(proof.profile.user_id,account.user_id);
    assert.deepEqual(proof.ops,[...expectedOperations]);
    assert.equal(proof.coverage,'complete_for_actor_scope');
    assert.equal(proof.contract,5);
    assert.equal(proof.arrays,true);
    assert.match(proof.unsupported,/OP_NOT_CONNECTED|INVALID_OPERATION/);
    assert.equal(proof.request_delta,0);
    assert.equal(proof.blocked,0);
   }finally{await ctx.close();}
  });
 }finally{
  await browser.close();
  const ui=path.resolve(__dirname,'../staging-operational-full'),hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ui,file))).digest('hex');
  const report={project_ref:REF,at:new Date().toISOString(),scope:'real browser + real Staging Auth/scoped complete actor read; no business DML',ui_manifest_sha256:hash('operational-full-ui-manifest.json'),transport_sha256:hash('transport.js'),adapter_sha256:hash('operational-adapter.js'),overlay_sha256:hash('operational-overlay.js'),results,network,violations,errors,production_requests:network.filter(item=>item.origin.includes('ymfbmpnizxvqsamnczow')).length,n8n_requests:network.filter(item=>/n8n/i.test(item.origin)).length,business_write_requests:network.filter(item=>item.path.includes('/crm_write_command_v2')).length};
  fs.writeFileSync(path.resolve(__dirname,'../docs/operational-cutover-20260906/operational-full-ui-browser-read.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({pass:results.filter(item=>item.status==='PASS').length,fail:results.filter(item=>item.status==='FAIL').length,violations:violations.length,production_requests:report.production_requests,n8n_requests:report.n8n_requests,business_write_requests:report.business_write_requests}));
  if(results.some(item=>item.status==='FAIL')||violations.length||report.production_requests||report.n8n_requests||report.business_write_requests)process.exitCode=1;
 }
}

run().catch(error=>{console.error('OPERATIONAL_FULL_BROWSER_READ_FAILED '+(error.name||'ERROR'));process.exitCode=1;});
