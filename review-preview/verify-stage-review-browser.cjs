'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
  await page.goto(origin+'/mobile.html?demo=1&screen=G&reset=1');await page.locator('.approved-g').waitFor();
  const initial=await page.evaluate(()=>JSON.stringify(DEALS));
  await page.locator('[data-gs="g-evidence"]').click();
  assert.equal(await page.locator('[data-gs="g-evidence"]').getAttribute('aria-pressed'),'true');
  let m=await page.evaluate(()=>MobileStageReview.readG(myDeals()[0]));assert.equal(m.selectedId,'email-example');assert.equal(m.canContinue,false);checks.push('actual approved G click selects the scoped complete candidate without enabling persistence');
  const stale=await page.evaluate(()=>{__approvedStage6Example.candidates[0].recipient='합성 다른 수신자';return MobileStageReview.select(myDeals()[0],'email-example');});assert.equal(stale.ok,false);assert.equal(stale.error,'STAGE_SELECTION_STALE');checks.push('browser rejects changed evidence between read and click');
  const scoped=await page.evaluate(()=>{MobileStageReview.readG(myDeals()[0]);MobileStageReview.select(myDeals()[0],'email-example');Phase1.profile={...Phase1.profile,auth_uid:'22222222-2222-4222-8222-222222222222',user_id:'22222222-2222-4222-8222-222222222222'};dispatchEvent(new Event('phase1:profile'));return MobileStageReview.readG(myDeals()[0]);});assert.equal(scoped.selectedId,null);assert.equal(scoped.fixture,false);assert.equal(scoped.candidates.length,0);checks.push('browser account change clears selection and prior-owner fixtures');
  await page.goto(origin+'/mobile.html?demo=1&screen=J-2&reset=1');await page.locator('.approved-j2').waitFor();
  m=await page.evaluate(()=>{const d=myDeals()[0];d.quote_versions[0].id='44444444-4444-4444-8444-444444444444';return MobileStageReview.readJ2(d);});assert.equal(m.fields[0].value,'견적 V2');assert.equal(m.fields[2].state,'missing');assert.equal(m.fields[3].state,'missing');assert.equal(m.input.fields.sent_date,'');assert.equal(m.input.fields.followup_date,'');assert.equal(m.existingNext[0].preserved,true);assert.equal(m.canSave,false);checks.push('browser J2 shares numeric registered quote version and leaves missing send/followup dates blank');
  const missing=await page.evaluate(()=>{const saved=myDeals;window.myDeals=()=>{throw Error('MODEL_TEST_READ_FAILURE');};const model=MobileStageReview.readG(DEALS[0]);window.myDeals=saved;return model;});assert.equal(missing.status,'read-error');assert.equal(missing.total,null);checks.push('browser data read failure is unknown rather than a zero count');
  const result=await page.evaluate(()=>({rows:__review.rows.length,replies:__review.replies.length,productionWrites:__review.productionWrites,next:DEALS[0].nextAction,legacy:!!document.querySelector('#scr .mv-now,#scr .flow-strip')}));assert.equal(result.rows,0);assert.equal(result.replies,0);assert.equal(result.productionWrites,0);assert.equal(result.next.text,'회의 결과 확인');assert.equal(result.legacy,false);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);checks.push('read and selection methods perform no queue/RPC/production writes and leave the existing task intact');
  const report={ok:true,checks:checks.length,passed:checks,errors,writes,scope:'synthetic read-only model and approved browser path; no production validation'};fs.writeFileSync(path.join(__dirname,'stage-review-browser-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
