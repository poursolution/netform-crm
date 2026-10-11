'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function open(scenario){await page.goto(origin+'/mobile.html?demo=1&review='+scenario);await page.waitForFunction(()=>window.__review);await page.locator('#sheetcard [data-ce="res"]').first().waitFor();}
  const card=page.locator('#sheetcard');
  async function fill(result){await card.locator(`[data-ce="res"][data-v="${result}"]`).click();if(result==='연결됨')await card.locator('[data-ce-in="memo"]').fill('합성 상담: 회의 결과를 확인했습니다.');await card.locator('[data-ce-in="req"]').check();}
  async function save(){await card.locator('[data-ce="save"]').click();}
  await open('contact');await page.screenshot({path:path.join(__dirname,'contact-preview.png'),fullPage:true});
  assert.match(await page.title(),/운영 아님/);checks.push('synthetic identity and existing contact form visible');
  await fill('연결됨');await save();await card.locator('.ce-done').waitFor();
  assert.equal(await page.evaluate(()=>__review.request.status),'done');assert.equal(await page.evaluate(()=>__review.rows.length),1);checks.push('connected record and selected request complete once');
  await open('contact');await fill('부재');await save();await card.locator('.ce-done').waitFor();assert.equal(await page.evaluate(()=>__review.request.status),'working');checks.push('absence keeps request open');
  await open('retry');await fill('연결됨');await save();await page.waitForFunction(()=>MobileEntry.state()?.err);assert.equal(await page.evaluate(()=>__review.rows.length),1);await save();await card.locator('.ce-done').waitFor();assert.equal(await page.evaluate(()=>__review.rows.length),1);checks.push('retry preserves input without duplicated contact');
  await open('compound');assert.equal(await card.locator('[data-ce-in="req"]').isDisabled(),true);checks.push('compound request cannot complete from contact alone');
  const blocked=await page.evaluate(async()=>{try{await fetch('/blocked',{method:'POST',body:'synthetic'});return false;}catch{return true;}});assert.equal(blocked,true);checks.push('browser connect-src blocks fetch writes');
  assert.equal((await fetch(origin+'/mobile.html',{method:'POST'})).status,405);assert.equal((await fetch(origin+'/../verification-manifest.json')).status,404);checks.push('server rejects writes and non-preview data files');
  assert.deepEqual(errors,[]);
  const result={at:new Date().toISOString(),checks,passed:checks.length,boundary:'synthetic, memory-only, no real-account verification; candidate D presentation updated, not deployed'};
  fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
