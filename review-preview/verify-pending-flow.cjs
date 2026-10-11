'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 const checks=[],errors=[],writeAttempts=[];
 try{
  const context=await browser.newContext({viewport:{width:600,height:850},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writeAttempts.push({url:r.url(),method:r.method()});});
  const card=page.locator('#sheetcard');
  async function open(){await page.goto(origin+'/mobile.html?demo=1&review=retry&reset=1');await card.locator('[data-ce="res"]').first().waitFor();await page.evaluate(()=>{__review.flushCalls=0;const f=Phase1.queue.flush;Phase1.queue.flush=async(...a)=>{__review.flushCalls++;return f(...a);};});}
  async function noLegacy(){assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .quick-sites,#scr .mh-hero').count(),0);}
  await open();await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill('합성 상담: 고객 회의 후 답변 예정입니다.');await card.locator('[data-ce-in="req"]').check();await card.locator('[data-ce="save"]').click();
  await page.waitForFunction(()=>MobileEntry.state()?.err);
  const initial=await page.evaluate(()=>({rows:__review.rows.map(q=>({id:q.request_id,status:q.status,operation:q.operation})),replies:__review.replies.length,flush:__review.flushCalls,snapshot:MobilePendingModel.read()}));
  assert.equal(initial.rows.length,1);assert.equal(initial.rows[0].status,'done');assert.equal(initial.replies,0);assert.equal(initial.snapshot.count,1);assert.equal(initial.snapshot.groups[0].state,'partial');checks.push('failed request reply preserves one confirmed activity and one partial record');
  await card.locator('.cd-back').click();await page.locator('[data-gs="back"]').click();await page.locator('[data-gs="tab"][data-tab="today"]').click();
  await page.locator('.approved-a [data-gs="pending"]').waitFor();await noLegacy();
  assert.match(await page.locator('.approved-a').innerText(),/기록 1건 보관 중/);checks.push('return through approved C/B/A shows the original I-4 banner');
  await page.locator('.approved-a [data-gs="pending"]').click();await page.locator('.approved-i4').waitFor();await noLegacy();
  assert.equal(await page.locator('.approved-i4 [data-gs="recover"]').count(),1);assert.match(await page.locator('.approved-i4').innerText(),/일부 저장됨/);assert.match(await page.locator('.approved-i4').innerText(),/응대 기록 저장됨.*관리자 요청 확인 대기/);
  await page.evaluate(()=>document.fonts.ready);await page.locator('.approved-i4').screenshot({path:path.join(__dirname,'approved-i4-implemented.png')});
  const viewed=await page.evaluate(()=>({replies:__review.replies.length,flush:__review.flushCalls,rows:__review.rows.length}));assert.equal(viewed.replies,0);assert.equal(viewed.flush,initial.flush);assert.equal(viewed.rows,1);checks.push('opening the pending list never retries or sends a request');
  await page.locator('.approved-i4 [data-gs="recover"]').click();await card.locator('.ce').waitFor();assert.equal(await card.locator('[data-ce-in="memo"]').inputValue(),'합성 상담: 고객 회의 후 답변 예정입니다.');assert.equal(await card.locator('[data-ce-in="memo"]').isDisabled(),true);assert.equal(await card.locator('[data-ce-in="req"]').isChecked(),true);assert.equal(await card.locator('[data-ce-in="req"]').isDisabled(),true);assert.equal(await page.evaluate(()=>__review.replies.length),0);checks.push('reopening the record restores and locks submitted inputs without resending');
  await card.locator('[data-ce="save"]').click();await card.locator('.ce-done').waitFor();
  const saved=await page.evaluate(()=>({ids:__review.rows.map(q=>q.request_id),replies:__review.replies,status:__review.request.status,snapshot:MobilePendingModel.read()}));
  assert.deepEqual(saved.ids,initial.rows.map(r=>r.id));assert.equal(saved.status,'done');assert.equal(saved.replies.filter(r=>r.action==='done').length,1);assert.equal(saved.snapshot.count,0);checks.push('explicit retry reuses the activity ID and confirms only the remaining request');
  await card.locator('.cd-back').click();await page.locator('[data-gs="back"]').click();await page.locator('.approved-i4 [data-gs="tab"][data-tab="today"]').click();await noLegacy();assert.equal(await page.locator('.approved-a [data-gs="pending"]').count(),0);checks.push('confirmed save clears the banner when returning to today');
  await page.evaluate(()=>{Phase1.queue.list=()=>{throw Error('QUEUE_CORRUPT');};render();});
  assert.match(await page.locator('.approved-a').innerText(),/저장 상태 확인 필요/);assert.doesNotMatch(await page.locator('.approved-a').innerText(),/기록 0건 보관/);await page.locator('.approved-a [data-gs="pending"]').click();assert.match(await page.locator('.approved-i4').innerText(),/읽지 못했습니다/);assert.doesNotMatch(await page.locator('.approved-i4').innerText(),/전송 대기 중인 기록이 없습니다/);checks.push('read failure remains unknown, never zero records');
  await open();await card.locator('.cd-back').click();
  await page.evaluate(()=>{
   const owner=MobileSaveJournal.owner();for(let i=0;i<21;i++){const id='eeeeeeee-eeee-4eee-8eee-'+String(i).padStart(12,'0');MobileSaveJournal.write('contact',id,{input:{res:'부재'},progress:{signature:'synthetic-only',input:{res:'부재'}}},owner);}G.deal=null;G.sub=null;G.tab='pending';render();
  });
  assert.equal(await page.locator('.approved-i4 [data-gs="recover"]').count(),0);assert.equal(await page.locator('.approved-i4 > div:nth-child(3) > div:has(> div > b)').count(),20);await page.locator('[data-pending="page"][data-page="2"]').first().click();assert.equal(await page.locator('.approved-i4 > div:nth-child(3) > div:has(> div > b)').count(),1);assert.equal(await page.evaluate(()=>MobilePendingModel.read().count),21);checks.push('21 records use the common 20-row page navigation; unknown targets cannot resume');
  assert.deepEqual(errors,[]);assert.deepEqual(writeAttempts,[]);assert.equal((await fetch(origin+'/mobile.html',{method:'POST'})).status,405);checks.push('no page errors, network mutations or production writes');
  const out={at:new Date().toISOString(),passed:checks.length,checks,source:'guide42 I-4 exact source nodes with real journal/queue projection',boundary:'synthetic memory-only fixture; local candidate, not deployed',screenshot:'approved-i4-implemented.png'};fs.writeFileSync(path.join(__dirname,'pending-flow-verification.json'),JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
