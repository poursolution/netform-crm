'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  async function pageFor(screen,missing){
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push({screen,missing,message:error.message}));page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());});
   if(missing)await page.route('**/'+missing,route=>route.abort());
   await page.goto(origin+'/mobile.html?demo=1&screen='+screen+'&reset=1');return page;
  }
  async function failClosed(page,label){
   await page.waitForFunction(()=>document.documentElement.dataset.mobileApprovedView==='pending');
   const state=await page.evaluate(()=>({children:document.querySelector('#scr').children.length,visibility:getComputedStyle(document.querySelector('#stage')).visibility,display:getComputedStyle(document.querySelector('#stage')).display,old:document.querySelectorAll('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel').length,sheet:document.querySelector('#sheetwrap').classList.contains('open')}));
   assert.equal(state.children,0,label+' must clear the previous approved root');assert(state.visibility==='hidden'||state.display==='none',label+' must remain hidden');assert.equal(state.old,0);assert.equal(state.sheet,false);
  }
  const blocked=[['G','mobile-approved-gj-source.js'],['G','mobile-approved-gj.js'],['G','mobile-stage-review.js'],['J-2','mobile-approved-gj-source.js'],['J-2','mobile-approved-gj.js'],['J-2','mobile-stage-review.js'],['J-1','mobile-approved-j1-source.js'],['J-1','mobile-approved-j1.js'],['J-1','mobile-stage-confirmation-model.js']];
  for(const [screen,missing] of blocked){
   const direct=await pageFor(screen,missing);await failClosed(direct,screen+' direct / '+missing);await direct.close();
   const fromDetail=await pageFor('C',missing);await fromDetail.locator('.approved-c').waitFor();
   if(screen==='J-2')await fromDetail.evaluate(()=>{DEALS.find(d=>String(d.id)===String(G.deal)).code='consulting';});
   const action=screen==='J-2'?'[data-gs="stage-change"]':screen==='G'?'[data-gs="more"][data-value="자료 발송 내역"]':'[data-gs="more"][data-value="영업 조건"]';
   await fromDetail.locator(action).click();await failClosed(fromDetail,screen+' from C / '+missing);await fromDetail.close();
  }
  checks.push('18 direct/from-detail missing-source/renderer/model routes clear stale roots and fail closed without retired UI');
  // Reusing an old visible button cannot approve a changed candidate or another actor's fixture.
  {
   const page=await pageFor('G');await page.locator('.approved-g').waitFor();
   await page.locator('[data-gs="g-evidence"]').first().click();
   await page.evaluate(()=>{__approvedStage6Example.candidates[0].documents=['changed-document-version'];});
   await page.locator('[data-gs="g-evidence"]').first().click();
   const changed=await page.evaluate(()=>({model:MobileStageReview.readG(DEALS[0]),pressed:document.querySelector('[data-gs="g-evidence"]')?.getAttribute('aria-pressed')}));
   assert.equal(changed.model.selectedId,null);assert.equal(changed.pressed,'false');
   await page.evaluate(()=>{const next='77777777-7777-4777-8777-777777777777';Phase1.profile={...Phase1.profile,auth_uid:next,user_id:next};});
   await page.locator('[data-gs="g-evidence"]').first().click();
   assert.equal(await page.locator('[data-gs="g-evidence"]').count(),0);assert.equal(await page.locator('[data-gs="g-next"]').getAttribute('aria-disabled'),'true');
   const after=await page.evaluate(()=>({model:MobileStageReview.readG(DEALS[0]),records:__review.rows.length,replies:__review.replies.length}));
   assert.equal(after.model.selectedId,null);assert.equal(after.records,0);assert.equal(after.replies,0);await page.close();
   checks.push('changed document versions and profile-only actor swaps reject stale G buttons, discard selection and refresh visible candidates');
  }
  // A selected reference cannot mutate PC stage fields or make the J-2 transition available.
  {
   const page=await pageFor('G');await page.locator('.approved-g').waitFor();
   const before=await page.evaluate(()=>JSON.stringify(DEALS));
   await page.locator('[data-gs="g-evidence"]').first().click();
   const current=await page.evaluate(()=>({deal:JSON.stringify(DEALS),model:MobileStageReview.readG(DEALS.find(d=>String(d.id)===String(G.deal)))}));
   assert.equal(current.deal,before);assert(current.model.selectedId);assert.equal(current.model.canContinue,false);
   assert.equal(await page.locator('[data-gs="g-next"]').getAttribute('aria-disabled'),'true');
   await page.locator('[data-gs="g-next"]').dispatchEvent('click');await page.locator('[data-gs="g-reference"]').dispatchEvent('click');
   await page.locator('[data-gs="back"]').click();await page.locator('.approved-c').waitFor();await page.locator('[data-gs="stage-change"]').click();await page.locator('.approved-j2').waitFor();
   assert.equal(await page.locator('[data-gs="j2-transition"]').getAttribute('aria-disabled'),'true');
   await page.locator('[data-gs="j2-transition"]').dispatchEvent('click');
   const after=await page.evaluate(()=>({deal:JSON.stringify(DEALS),records:__review.rows.length,replies:__review.replies.length}));assert.deepEqual(after,{deal:before,records:0,replies:0});
   await page.close();checks.push('G selection is local review only: no stage-field mutation, inferred sent date, follow-up creation or enabled J-2 transition');
  }
  // A stale J-1 link must not navigate to an unrelated or no-longer-visible activity.
  {
   const page=await pageFor('J-1');await page.locator('.approved-j1').waitFor();
   const link=page.locator('[data-gs="stage-confirmation-evidence"]');assert.equal(await link.count(),1);
   await page.evaluate(()=>{window.__stage6Toasts=[];const original=toast;window.toast=function(message){__stage6Toasts.push(String(message));return original.apply(this,arguments);};DEALS[0].activities[0].opportunity_id='88888888-8888-4888-8888-888888888888';});
   await link.click();assert.equal(await page.locator('.approved-j1').count(),1);assert.equal(await page.locator('.approved-c').count(),0);assert.match(await page.evaluate(()=>__stage6Toasts.join(' ')),/같은 영업건|전체 이력/);
   const noWrite=await page.evaluate(()=>({records:__review.rows.length,replies:__review.replies.length}));assert.deepEqual(noWrite,{records:0,replies:0});await page.close();checks.push('J-1 stale cross-deal evidence links are rejected without navigating or writing');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const result={at:new Date().toISOString(),passed:checks.length,checks,boundary:'synthetic local stage6 navigation and failure tests; no production writes or implemented transition'};
  fs.writeFileSync(path.join(__dirname,'stage6-safety-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
