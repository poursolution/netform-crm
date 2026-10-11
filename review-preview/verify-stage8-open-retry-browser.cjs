'use strict';
// Failed draft recovery must leave the existing approved editor/navigation intact.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],writes=[],external=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
  await context.addInitScript(()=>{
   window.__retrySpeech={instances:[],starts:0,aborts:0};class FakeRecognition{constructor(){__retrySpeech.instances.push(this);}start(){__retrySpeech.starts++;this.onstart?.();}stop(){}abort(){__retrySpeech.aborts++;}}
   window.SpeechRecognition=window.webkitSpeechRecognition=FakeRecognition;
  });
  async function ready(screen){
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());});
   await page.goto(origin+'/mobile.html?demo=1&review=guide&screen='+screen);await page.locator('.approved-'+screen.toLowerCase()).waitFor();
   await page.evaluate(()=>{window.__retryCalls=[];const deny=name=>()=>{__retryCalls.push(name);throw Error('Unexpected '+name);};window.fetch=deny('fetch');window.open=deny('open');Phase1.rpc=deny('rpc');Phase1.queue.enqueue=deny('queue');window.pushWrite=deny('pushWrite');window.queueMobileContactOperation=deny('activity');window.MobileCardRecognition={...MobileCardRecognition,recognize:deny('ocr')};});
   return page;
  }
  const records=page=>page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies}));
  const stored=page=>page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(key=>key.startsWith('crm:mobile-input-draft:v1:')).map(key=>[key,sessionStorage.getItem(key)])));
  async function failRead(page,at){await page.evaluate(at=>{window.__retryOriginalGet=Storage.prototype.getItem;window.__retryDraftReads=0;Storage.prototype.getItem=function(key){if(String(key).startsWith('crm:mobile-input-draft:v1:')&&++__retryDraftReads===at)throw Error('Synthetic one-shot draft read failure');return __retryOriginalGet.call(this,key);};},at);}
  async function restoreRead(page){await page.evaluate(()=>{Storage.prototype.getItem=__retryOriginalGet;});}
  async function noProviders(page){assert.deepEqual(await page.evaluate(()=>__retryCalls),[]);assert.equal(await page.evaluate(()=>__retrySpeech.starts),0);assert.equal(await page.evaluate(()=>__retrySpeech.instances.length),0);}
  async function safe(page,before){assert.equal(await records(page),before);await noProviders(page);assert.equal(await page.locator('#scr .mv-now,#scr .flow-strip,#scr .mh-filter,#scr .mystat').count(),0);assert.equal(await page.evaluate(()=>MobileApprovedBoot.state()),'approved');}
  async function remains(page,screen){assert.equal(await page.locator('.approved-'+screen.toLowerCase()).count(),1);assert.equal(await page.locator('.approved-i1,.approved-i2,.approved-i3').count(),0);assert.equal(await page.evaluate(()=>MobileInputFlow.snapshot()),null);assert.notEqual(await page.evaluate(()=>MobileGuideShell.state.detailView),'input');}
  {
   const page=await ready('C'),before=await records(page);await failRead(page,1);
   await page.locator('[data-gs="contact-card"]').click();await remains(page,'C');await noProviders(page);
   assert.equal(await page.evaluate(()=>__retryDraftReads),1);await restoreRead(page);
   await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
   await remains(page,'C');await noProviders(page);assert.deepEqual(await stored(page),{});
   await page.locator('[data-gs="contact-card"]').click();await page.locator('.approved-i3').waitFor();assert.deepEqual((await page.evaluate(()=>MobileInputFlow.snapshot())).draft,{});
   await page.locator('.approved-i3').screenshot({path:path.join(__dirname,'approved-i3-open-retry.png')});
   await page.locator('.approved-i3 [data-gs="back"]').click();await page.locator('.approved-c').waitFor();await safe(page,before);await page.close();
   checks.push('A one-shot cache.create read failure leaves C visible with no provider start; after storage/page-cache recovery the same card entry opens normally and back returns to C');
  }
  {
   const page=await ready('C'),before=await records(page);await failRead(page,2);
   await page.locator('[data-gs="contact-card"]').click();await remains(page,'C');assert.equal(await page.evaluate(()=>__retryDraftReads),2);
   await restoreRead(page);await noProviders(page);await page.locator('[data-gs="contact-card"]').click();await page.locator('.approved-i3').waitFor();
   await safe(page,before);await page.close();
   checks.push('A cache.read failure after successful handle creation also releases the failed attempt, keeps C and permits a fresh successful attempt without microphone/OCR work');
  }
  {
   const page=await ready('C'),before=await records(page);await page.locator('[data-gs="contact-card"]').click();await page.locator('.approved-i3').waitFor();
   await page.locator('[data-input-field][data-id="name"]').fill('손상 검사 전 보관 원문');await page.locator('.approved-i3 [data-gs="back"]').click();await page.locator('.approved-c').waitFor();
   const corrupt=await page.evaluate(()=>{const key=Object.keys(sessionStorage).find(key=>key.startsWith('crm:mobile-input-draft:v1:')),raw=sessionStorage.getItem(key);sessionStorage.setItem(key,raw.slice(0,-1));return {[key]:sessionStorage.getItem(key)};});
   await page.locator('[data-gs="contact-card"]').click();await remains(page,'C');assert.deepEqual(await stored(page),corrupt,'Malformed recovery text is not deleted or overwritten by an empty editor');
   await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
   await page.locator('[data-gs="contact-card"]').click();await remains(page,'C');assert.deepEqual(await stored(page),corrupt);await safe(page,before);await page.close();
   checks.push('A corrupt saved I3 record keeps its exact raw bytes; repeated entry and page-cache return stay on C instead of trapping the user in an empty editor');
  }
  {
   for(const failureAt of [1,2]){
    const page=await ready('D'),before=await records(page),card=page.locator('#sheetcard');
    await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill('초안 복구 실패에도 유지할 원래 상담');await card.locator('[data-ce-in="req"]').check();
    await card.locator('[data-ce="mode"][data-v="new"]').click();await card.locator('[data-ce-in="purpose"]').fill('기존 고객 회신 확인');await card.locator('[data-ce-in="plan"]').check();
    const original=await page.evaluate(()=>structuredClone(MobileEntry.state()));await failRead(page,failureAt);
    await page.locator('[data-ce="input-mic"]').click();await remains(page,'D');assert.deepEqual(await page.evaluate(()=>MobileEntry.state()),original);await noProviders(page);
    await restoreRead(page);assert.deepEqual(await stored(page),{});await page.locator('[data-ce="input-mic"]').click();await page.locator('.approved-i1').waitFor();
    assert.equal((await page.evaluate(()=>MobileInputFlow.snapshot())).draft.transcript,original.memo);await noProviders(page);
    await page.locator('.approved-i1 [data-gs="input-cancel"]').click();await page.locator('.approved-d').waitFor();assert.deepEqual(await page.evaluate(()=>MobileEntry.state()),original);await safe(page,before);await page.close();
   }
   checks.push('D microphone entry keeps every existing response/memo/task/request value when create or read fails; the recovered retry adopts the same memo and explicit cancellation restores D unchanged');
  }
  {
   const page=await ready('C'),before=await records(page);
   await page.evaluate(()=>{window.__retrySetAttempts=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(key).startsWith('crm:mobile-input-draft:v1:')){__retrySetAttempts++;throw new DOMException('Synthetic quota-only failure','QuotaExceededError');}return original.call(this,key,value);};});
   await page.locator('[data-gs="contact-card"]').click();await page.locator('.approved-i3').waitFor();assert.deepEqual((await page.evaluate(()=>MobileInputFlow.snapshot())).draft,{});
   await page.locator('.approved-i3 [data-gs="back"]').click();await page.locator('.approved-c').waitFor();assert.equal(await page.evaluate(()=>MobileInputFlow.snapshot()),null);
   assert.equal(await page.evaluate(()=>__retrySetAttempts),0,'Untouched I3 has no new input to preserve and must not attempt a blocking storage write');
   assert.deepEqual(await stored(page),{});await safe(page,before);await page.close();
   checks.push('An untouched I3 can return to C even when sessionStorage writes are unavailable: no empty draft is created and no unnecessary write traps the user');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const font='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';assert.deepEqual(external.filter(url=>url!==font),[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,blockedReadonlyAssets:[...new Set(external)],boundary:'Actual local approved C/D/I1/I3 entry clicks, synthetic one-shot reads/corrupt draft and page-cache events. No real microphone, OCR, external service, CRM write, UI design change or deployment.'};
  fs.writeFileSync(path.join(__dirname,'stage8-open-retry-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
