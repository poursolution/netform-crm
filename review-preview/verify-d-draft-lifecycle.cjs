'use strict';
// D lifecycle regressions. Synthetic local fixture only: no real account or network writes.
// Reload cases use the served fixture without interception or storage substitution.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 const results=[];
 async function run(name,fn){
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'}),errors=[];
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const card=page.locator('#sheetcard');
  async function open(scenario='contact'){await page.goto(origin+'/mobile.html?demo=1&review='+scenario);await page.waitForFunction(()=>window.__review);await card.locator('[data-ce="res"]').first().waitFor();}
  async function connected(memo='같은 내용 재입력 없이 복원'){await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill(memo);await card.locator('[data-ce-in="req"]').check();}
  async function reopen(){await card.locator('[data-ce="close"]').click();await page.evaluate(()=>MobileEntry.open());await card.locator('[data-ce="res"]').first().waitFor();}
  try{await fn({page,context,card,open,connected,reopen});assert.deepEqual(errors,[]);results.push({name,passed:true});}
  catch(e){results.push({name,passed:false,error:String(e.message||e)});}
  finally{await context.close();}
 }
 try{
  await run('back and reopen preserve result, memo, task date, reason and selected request',async({page,card,open,connected,reopen})=>{
   await open();await connected();await card.locator('[data-ce="mode"][data-v="change"]').click();
   await card.locator('[data-ce="date-open"]').click();const due=await page.evaluate(()=>ContactEntry.addDays(DEALS[0].nextAction.due,3));
   await card.locator('[data-ce-in="date"]').fill(due);await card.locator('[data-ce="date-close"]').last().click();
   await card.locator('[data-ce-in="reason"]').fill('고객 일정에 맞춰 변경');
   const before=await page.evaluate(()=>structuredClone(MobileEntry.state()));await reopen();
   const after=await page.evaluate(()=>structuredClone(MobileEntry.state()));
   for(const key of ['res','memo','mode','date','reason','reqOn'])assert.deepEqual(after[key],before[key],key);
   assert.equal(await page.evaluate(()=>__review.rows.length),0);
  });
  await run('drafts stay isolated by deal',async({page,card,open,connected,reopen})=>{
   await open();await connected('첫 번째 영업건 내용');await card.locator('[data-ce="close"]').click();
   await page.evaluate(()=>{DEALS.push({...structuredClone(DEALS[0]),id:'33333333-3333-4333-8333-333333333333',nm:'[테스트] 두 번째 영업건'});G.deal=DEALS[1].id;MobileEntry.open();});
   assert.equal(await card.locator('[data-ce-in="memo"]').inputValue(),'');
   await card.locator('[data-ce-in="memo"]').fill('두 번째 영업건 내용');await card.locator('[data-ce="close"]').click();
   await page.evaluate(()=>{G.deal=DEALS[0].id;MobileEntry.open();});
   assert.equal(await card.locator('[data-ce-in="memo"]').inputValue(),'첫 번째 영업건 내용');
   assert.equal(await page.evaluate(()=>__review.rows.length),0);
  });
  await run('actual preview reload restores unsaved input in the same review scope',async({page,card,open,connected})=>{
   await open();await connected('새로고침 뒤 유지할 내용');await page.reload();await page.waitForFunction(()=>window.__review);await card.locator('[data-ce-in="memo"]').waitFor();
   assert.equal(await card.locator('[data-ce-in="memo"]').inputValue(),'새로고침 뒤 유지할 내용');
   assert.equal(await card.locator('[data-ce-in="req"]').isChecked(),true);
   assert.equal(await page.evaluate(()=>__review.rows.length),0);
  });
  await run('after a confirmed activity and failed request reply, submitted controls are locked while retry remains usable',async({page,card,open,connected})=>{
   await open('retry');await connected();await card.locator('[data-ce="save"]').click();await page.waitForFunction(()=>MobileEntry.state()?.err);
   assert.equal(await page.evaluate(()=>__review.rows.length),1);assert.equal(await page.evaluate(()=>__review.rows[0].status),'done');
   const unlocked=await card.locator('[data-ce-in], [data-ce="res"], [data-ce="mode"], [data-ce="date-open"], [data-ce="iplan"]').evaluateAll(els=>els.filter(el=>!el.disabled&&!el.readOnly).map(el=>el.getAttribute('data-ce-in')||el.getAttribute('data-ce')));
   assert.deepEqual(unlocked,[],'These submitted controls can still mutate a frozen save signature: '+unlocked.join(', '));
   assert.equal(await card.locator('[data-ce="save"]').isEnabled(),true);
  });
  await run('close and reopen a partial save retries the same activity once',async({page,card,open,connected,reopen})=>{
   await open('retry');await connected();await card.locator('[data-ce="save"]').click();await page.waitForFunction(()=>MobileEntry.state()?.err);
   const activityId=await page.evaluate(()=>__review.rows[0].request_id);await reopen();
   assert.equal(await card.locator('[data-ce-in="memo"]').inputValue(),'같은 내용 재입력 없이 복원');
   await card.locator('[data-ce="save"]').click();await card.locator('.ce-done').waitFor();
   assert.equal(await page.evaluate(()=>__review.rows.length),1);assert.equal(await page.evaluate(()=>__review.rows[0].request_id),activityId);
   assert.equal(await page.evaluate(()=>__review.request.status),'done');assert.equal(await page.evaluate(()=>MobileSaveJournal.read('contact',DEALS[0].id)),null);
  });
  await run('an in-flight save cannot be changed while the server confirmation is pending',async({page,card,open,connected})=>{
   await open();await connected('전송 중 바뀌면 안 되는 내용');
   await page.evaluate(()=>{const original=Phase1.queue.flush;Phase1.queue.flush=()=>new Promise(resolve=>{window.__finishPendingSave=()=>original().then(resolve);});});
   await card.locator('[data-ce="save"]').click();await page.waitForFunction(()=>!!window.__finishPendingSave);
   const unlocked=await card.locator('[data-ce-in], [data-ce="res"], [data-ce="mode"], [data-ce="date-open"], [data-ce="iplan"]').evaluateAll(els=>els.filter(el=>!el.disabled&&!el.readOnly).map(el=>el.getAttribute('data-ce-in')||el.getAttribute('data-ce')));
   assert.deepEqual(unlocked,[],'In-flight submitted controls are still mutable: '+unlocked.join(', '));
   await page.evaluate(()=>__finishPendingSave());await card.locator('.ce-done').waitFor();
   assert.equal(await page.evaluate(()=>__review.rows.length),1);
  });
  await run('an unconfirmed queued activity is retried with its original request id',async({page,card,open,connected})=>{
   await open();await connected();await page.evaluate(()=>{window.__flushOriginal=Phase1.queue.flush;Phase1.queue.flush=async()=>{throw Error('합성 연결 끊김');};});
   await card.locator('[data-ce="save"]').click();await page.waitForFunction(()=>MobileEntry.state()?.err);
   const id=await page.evaluate(()=>__review.rows[0].request_id);assert.equal(await page.evaluate(()=>__review.rows[0].status),'pending');
   await page.evaluate(()=>{Phase1.queue.flush=__flushOriginal;});await card.locator('[data-ce="save"]').click();await card.locator('.ce-done').waitFor();
   assert.equal(await page.evaluate(()=>__review.rows.length),1);assert.equal(await page.evaluate(()=>__review.rows[0].request_id),id);
  });
  const report={at:new Date().toISOString(),results,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed).length,boundary:'Memory-only fixture; actual served preview reload tested without response modification. No production RPC or saved customer data. Persisted queue recovery after reload, app termination and real-account writes are not verified.'};
  fs.writeFileSync(path.join(__dirname,'d-draft-lifecycle-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(results.some(x=>!x.passed))process.exitCode=1;
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
