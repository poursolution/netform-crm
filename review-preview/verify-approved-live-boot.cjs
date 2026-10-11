'use strict';
// Real approved render/load lifecycle with synthetic RPCs. No production reads or writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('./server.cjs'),{launchOptions}=require('./review-environment.cjs');
const checks=[];
async function authChecks(){
 const html=fs.readFileSync(path.join(__dirname,'../mobile.html'),'utf8');
 const start=html.indexOf('async function authAdmit(session)'),end=html.indexOf('async function doSignIn()',start);
 assert.ok(start>0&&end>start);
 const src=html.slice(start,end),profile={user_id:'a',auth_uid:'b',name:'합성 관리자',source_role:'admin',permission_role:'admin',allowed_modes:['rep','admin']};
 const c={G:{},TOKEN:null,Phase1:{admit:async()=>profile,signOut:async()=>{c.signedOut=true;}},savedMode:()=>{throw Error('Retired mobile mode must not choose the current route');}};
 vm.createContext(c);vm.runInContext(src,c);
 assert.equal(await c.authAdmit({access_token:'synthetic-session',user:{email:'test@example.invalid'}}),true);
 assert.equal(c.G.mode,'rep');assert.equal(c.G.user.role,'admin');assert.equal(c.G.user.permission_role,'admin');
 checks.push('Actual authAdmit ignores saved admin view, retains server role and enters authorized rep only');
 profile.allowed_modes=['admin'];assert.equal(await c.authAdmit({access_token:'synthetic-session',user:{email:'test@example.invalid'}}),false);
 assert.equal(c.signedOut,true);assert.equal(c.G.user,null);assert.equal(c.TOKEN,null);assert.equal(c.G.loginErr,'MODE_DENIED');
 checks.push('Missing rep authorization fails closed without assigning rep privileges');
}
(async()=>{
 await authChecks();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions());
 const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'}),networkWrites=[],errors=[];
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());if(!['GET','HEAD'].includes(r.method())){networkWrites.push(r.method()+' '+u.pathname);return route.abort();}
  if(u.origin!==origin)return route.abort();
  if(u.pathname==='/'&&u.search==='?view=pc')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Existing PC route</title>'});
  return route.continue();
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(origin+'/mobile.html?demo=1&screen=B&review=live-boot',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
  await page.evaluate(async()=>{
   closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;
   await Promise.resolve();await Promise.resolve();
   const id=DEALS[0].id;DEALS=[DEALS[0]];DEALS[0].code='consulting';DEALS[0].nextAction.type='전화';DEALS[0].nextAction.text='고객 회신 확인';
   G.user.id=Phase1.profile.user_id;G.mode='admin';G.tab='today';G.deal=null;G.sub=null;LIVE=true;DEMO=false;
   Phase1.profile.allowed_modes=['rep','admin'];window.__boot={reads:[],writes:[],pending:[],oldRenderer:0};
   // Calling retired rendering/decorating instead of loading shared data is a regression.
   window.MobileHub={apply:()=>{__boot.oldRenderer++;throw Error('retired renderer');}};
   window.MobileRequests=Object.freeze({...MobileRequests,decorate:()=>{__boot.oldRenderer++;throw Error('retired decorator');}});
   Phase1.rpc=(name,args)=>{
    if(name!=='crm_work_request_list_v1'){__boot.writes.push({name,args});return Promise.reject(Error('No writes in boot test'));}
    __boot.reads.push({name,args});return new Promise((resolve,reject)=>__boot.pending.push({resolve,reject}));
   };
   window.__bootReply=()=>({ok:true,requests:[{id:'22222222-2222-4222-8222-222222222222',target_type:'deal',target_id:id,kind:'first',label:'첫 연락 요청',asks:['고객 첫 연락'],to_me:true,status:'sent',requested_by:'합성 관리자',due_at:'2026-10-20T09:00:00+09:00'}]});
   Object.assign(MobileRequests.state(),{list:[],at:0,loaded:false,busy:false,off:false});render();
  });
  await page.locator('.approved-a').waitFor();await page.waitForFunction(()=>__boot.reads.length===1);
  assert.equal(await page.evaluate(()=>G.mode),'rep');assert.equal(await page.evaluate(()=>MobileRequests.state().loaded),false);
  await page.evaluate(()=>{render();render();render();});assert.equal(await page.evaluate(()=>__boot.reads.length),1);
  assert.equal(await page.locator('#scr .mh-hub,#scr .mq,#scr .mv-now,#scr .lrow').count(),0);
  checks.push('Saved admin mode with explicit rep permission renders approved A and one shared request-list read, no legacy renderer');

  await page.evaluate(()=>{G.deal=DEALS[0].id;render();});await page.locator('.approved-c').waitFor();
  await page.locator('.approved-c [data-gs="contact"]').click();
  assert.equal(await page.locator('.approved-d').count(),0,'D waits for the already-running request read');
  await page.evaluate(()=>__boot.pending.shift().resolve(__bootReply()));await page.locator('.approved-d').waitFor();
  assert.equal(await page.locator('.approved-d [data-ce-in="req"]').count(),1);assert.equal(await page.locator('.approved-d [data-ce-in="req"]').isChecked(),false);
  assert.equal(await page.evaluate(()=>__boot.reads.length),1);assert.deepEqual(await page.evaluate(()=>__boot.writes),[]);
  assert.equal(await page.evaluate(()=>__boot.oldRenderer),0);
  checks.push('C → D joins the pending read and renders its actual request as unselected, with no seen/reply or save write');
  await page.locator('.approved-d [data-ce="close"]').click();await page.locator('.approved-c').waitFor();
  await page.evaluate(()=>{render();render();});assert.equal(await page.evaluate(()=>__boot.reads.length),1,'Existing 60-second cache prevents repeat reads');
  checks.push('Read completion and rerenders do not poll repeatedly or mark requests seen');

  await page.evaluate(()=>{Object.assign(MobileRequests.state(),{at:0,loaded:false});render();});await page.waitForFunction(()=>__boot.reads.length===2);
  await page.locator('.approved-c [data-gs="contact"]').click();
  await page.evaluate(()=>{G.deal=null;G.tab='mine';render();__boot.pending.shift().resolve(__bootReply());});
  await page.locator('.approved-b').waitFor();await page.waitForFunction(()=>!MobileRequests.state().busy);
  assert.equal(await page.locator('.approved-d').isVisible(),false);assert.equal(await page.evaluate(()=>document.getElementById('sheetwrap').classList.contains('open')),false);
  checks.push('Navigating away while request data loads cannot reopen stale contact input');

  await page.evaluate(()=>{G.deal=DEALS[0].id;G.tab='mine';Object.assign(MobileRequests.state(),{at:0,loaded:false});render();});
  await page.waitForFunction(()=>__boot.reads.length===3);await page.locator('.approved-c [data-gs="contact"]').click();
  await page.evaluate(()=>{
   Phase1.profile={...Phase1.profile,auth_uid:'33333333-3333-4333-8333-333333333333',user_id:'33333333-3333-4333-8333-333333333333'};
   __boot.pending.shift().resolve(__bootReply());
  });
  await page.waitForFunction(()=>MobileRequests.state().loaded===false);
  assert.equal(await page.locator('.approved-d').isVisible(),false);assert.equal(await page.evaluate(()=>document.getElementById('sheetwrap').classList.contains('open')),false);assert.equal(await page.evaluate(()=>MobileRequests.incoming().length),0);
  assert.deepEqual(await page.evaluate(()=>__boot.writes),[]);assert.equal(await page.evaluate(()=>__review.rows.length),0);
  checks.push('An account change rejects the late response and cannot open old-account D or retain its request rows');

  await page.evaluate(()=>{Phase1.profile.allowed_modes=['admin'];G.mode='admin';render();});
  await page.waitForURL(origin+'/?view=pc');assert.equal(await page.title(),'Existing PC route');
  checks.push('A non-rep profile is routed to the existing explicit PC URL without showing retired mobile content');
  assert.deepEqual(networkWrites,[]);assert.deepEqual(errors,[]);
  const report={ok:true,checks:checks.length,results:checks,productionCalls:0,networkWrites:0,designChanged:false};
  fs.writeFileSync(path.join(__dirname,'approved-live-boot-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;if(server.listening)server.close();});
