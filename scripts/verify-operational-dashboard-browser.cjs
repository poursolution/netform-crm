'use strict';

// Real browser + real Staging Auth/read-only dashboard rendering and drilldown.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const REF='rprechiaglyjaydkmxsu',origin=`https://${REF}.supabase.co`,local='http://127.0.0.1:4181';
const credentials=JSON.parse(fs.readFileSync('C:/Users/Administrator/crm-staging-private/auth-synthetic-20260905.json','utf8'));
const results=[],network=[],violations=[],errors=[];
if(credentials.project_ref!==REF)throw Error('WRONG_PROJECT');

async function run(){
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const account of credentials.accounts.filter(x=>!process.env.CRM_DASHBOARD_ROLE||x.kind===process.env.CRM_DASHBOARD_ROLE)){
   const ctx=await browser.newContext();ctx.setDefaultTimeout(15000);
   await ctx.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url()),rpc=url.pathname.replace('/rest/v1/rpc/','');
    const allowed=url.origin===local||url.origin===origin&&(url.pathname.startsWith('/auth/v1/')||['crm_profile_scoped_v2','crm_operational_source_v1'].includes(rpc));
    if(!allowed){violations.push({kind:account.kind,origin:url.origin,path:url.pathname,method:request.method()});return route.abort();}
    network.push({kind:account.kind,origin:url.origin,path:url.pathname,method:request.method()});return route.continue();
   });
   const page=await ctx.newPage();
   let point='goto';
   try{
    await page.goto(`${local}/crm.html`);
    point='login';
    await page.locator('#au-name').fill(account.name);
    await page.locator('#au-pw').fill(account.password);
    await page.getByRole('button',{name:'로그인',exact:true}).click();
    point='operational-read';
    await page.waitForFunction(()=>!!window.Phase1?.profile&&!!window.OperationalUI&&Array.isArray(window.B?.deals)&&Array.isArray(window.B?.inquiries));
    point='dashboard-navigation';
    await page.locator('.mi[data-p="dash"]').click();
    point='dashboard-render';
    await page.waitForFunction(()=>window.G?.page==='dash'&&document.querySelectorAll('#d-money .mcard2').length===6&&(document.querySelector('#d-money')?.offsetParent||document.querySelector('#d-mine')?.offsetParent));
    const rendered=await page.evaluate(()=>({
     profile:Phase1.profile.user_id,
     deals:B.deals.length,
     inquiries:B.inquiries.length,
     cards:Array.from(document.querySelectorAll('#d-money .mcard2')).map(x=>x.textContent.replace(/\s+/g,' ').trim()),
     headline:(document.querySelector('#d-headline')?.textContent||'').replace(/\s+/g,' ').trim(),
     body:(document.querySelector('#pg-dash')?.textContent||'').replace(/\s+/g,' ').trim(),
     home_role:G.homeRole,
     management_visible:!!document.querySelector('#d-money')?.offsetParent,
     personal_visible:!!document.querySelector('#d-mine')?.offsetParent,
     personal_body:(document.querySelector('#d-mine')?.textContent||'').replace(/\s+/g,' ').trim()
    }));
    assert.equal(rendered.profile,account.user_id);
    assert.equal(rendered.cards.length,6);
    assert.ok(rendered.cards.every(Boolean));
    assert.doesNotMatch(rendered.body,/\b(?:undefined|NaN)\b/);
    if(rendered.management_visible){
     assert.ok(rendered.headline);
     point='pipeline-drilldown';
     await page.locator('#d-money .mcard2[data-k="pipe"]').click();
     await page.waitForFunction(()=>window.G?.page==='pipe'&&document.querySelector('#pg-pipe')?.classList.contains('on'));
     results.push({role:account.kind,status:'PASS',dashboard:rendered.home_role,deal_rows:rendered.deals,inquiry_rows:rendered.inquiries,cards:rendered.cards.length,drilldown:'PIPELINE_PASS'});
    }else{
     assert.equal(rendered.personal_visible,true);
     assert.ok(rendered.personal_body);
     results.push({role:account.kind,status:'PASS',dashboard:rendered.home_role,deal_rows:rendered.deals,inquiry_rows:rendered.inquiries,cards:0,drilldown:'PERSONAL_ACTION_DASHBOARD_PASS'});
    }
   }catch(error){let state={};try{state=await page.evaluate(()=>({profile:!!window.Phase1?.profile,operational:!!window.OperationalUI,deals:Array.isArray(window.B?.deals)?window.B.deals.length:null,inquiries:Array.isArray(window.B?.inquiries)?window.B.inquiries.length:null,page:window.G?.page||null,auth_gate:document.querySelector('#authGate')?.classList.contains('on'),dashboard_cards:document.querySelectorAll('#d-money .mcard2').length}));}catch{}errors.push({role:account.kind,point,error_type:error.name||'ERROR',state});results.push({role:account.kind,status:'FAIL',point,error_type:error.name||'ERROR'});}
   finally{await ctx.close();}
  }
 }finally{
  await browser.close();
  const artifact=path.resolve(__dirname,'../staging-operational-full/operational-full-ui-manifest.json');
  const report={project_ref:REF,at:new Date().toISOString(),scope:'real Staging Auth + actor-scoped Supabase read; PC dashboard render and KPI drilldown; no business DML',ui_manifest_sha256:crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'),results,network,violations,errors,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length,interactive_n8n_requests:network.filter(x=>/n8n/i.test(x.origin)).length,production_requests:network.filter(x=>x.origin.includes('ymfbmpnizxvqsamnczow')).length,business_write_requests:network.filter(x=>x.path.includes('/crm_write_command_v2')).length};
  fs.writeFileSync(path.resolve(__dirname,'../docs/operational-cutover-20260906/operational-dashboard-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({pass:report.pass,fail:report.fail,violations:violations.length,interactive_n8n_requests:report.interactive_n8n_requests,production_requests:report.production_requests,business_write_requests:report.business_write_requests}));
  if(report.fail||violations.length||report.interactive_n8n_requests||report.production_requests||report.business_write_requests)process.exitCode=1;
 }
}

run().catch(error=>{console.error(`OPERATIONAL_DASHBOARD_BROWSER_FAILED ${error.name||'ERROR'}`);process.exitCode=1;});
