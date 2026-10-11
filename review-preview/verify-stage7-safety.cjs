'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],networkWrites=[];
 const screens=['K-1','K-2','K-3','K-4','K-5','Q-S','Q-N','Q-T','Q-M'];
 const sel=s=>s[0]==='K'?'.approved-'+s.toLowerCase().replace('-',''):'.approved-quote-'+({'Q-S':'simple','Q-N':'standards','Q-T':'method','Q-M':'markup'}[s]);
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  async function create(screen,missing){
   const page=await context.newPage();page.setDefaultTimeout(9000);page.on('pageerror',e=>errors.push({screen,missing:missing||'',message:e.message}));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))networkWrites.push(r.url());});
   if(missing)await page.route(url=>url.pathname.endsWith('/'+missing),r=>r.abort());
   await page.goto(origin+'/mobile.html?demo=1&screen='+screen+'&reset=1');return page;
  }
  async function ready(screen){const page=await create(screen);await page.locator(sel(screen)).waitFor();return page;}
  async function noLegacy(page){assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel,#scr .stage-guide').count(),0);assert.equal(await page.locator('#sheetwrap.open').count(),0);}
  const snapshot=page=>page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,records:__review.rows,replies:__review.replies,requests:MobileRequests.state().list,next:DEALS.map(d=>[d.nextAction,d.nextActionObj,d.openNextActions])}));
  function sameRecords(before,after){const a=JSON.parse(before),b=JSON.parse(after);delete a.requests;delete b.requests;assert.deepEqual(b,a);}
  async function guards(page){await page.evaluate(()=>{window.__quoteSafetyCalls=[];const deny=name=>function(){__quoteSafetyCalls.push(name);throw Error('Stage7 must remain read-only: '+name);};window.fetch=deny('fetch');window.open=deny('open');window.pushWrite=deny('pushWrite');Phase1.rpc=deny('rpc');Phase1.queue.enqueue=deny('enqueue');window.queueMobileContactOperation=deny('contact');});}
  async function failClosed(page,label){
   await page.waitForFunction(()=>document.documentElement.dataset.mobileApprovedView==='pending');
   const state=await page.evaluate(()=>({children:document.querySelector('#scr').children.length,visibility:getComputedStyle(document.querySelector('#stage')).visibility,display:getComputedStyle(document.querySelector('#stage')).display}));
   assert.equal(state.children,0,label+' must clear previous contents');assert(state.visibility==='hidden'||state.display==='none',label+' must keep boot pending');await noLegacy(page);
  }
  for(const screen of screens){
   const deps=screen[0]==='K'?['mobile-approved-quote-source.js','mobile-approved-quote.js']:['mobile-approved-quote-extra-source.js','mobile-approved-quote-extra.js'];
   for(const missing of [...deps,'mobile-quote-review-model.js','mobile-quote-flow.js']){const page=await create(screen,missing);await failClosed(page,screen+'/'+missing);await page.close();}
  }
  checks.push('All nine direct screens fail closed for missing source, renderer, model or flow (36 cases) with no retired UI');
  for(const screen of screens){
   const page=await ready(screen);await guards(page);await noLegacy(page);const before=await snapshot(page);
   await page.evaluate(screen=>{MobileQuoteReviewModel.read(DEALS.find(d=>String(d.id)===String(G.deal)),screen);render();render();},screen);
   const disabled=page.locator(sel(screen)+' [aria-disabled="true"]');for(let i=0;i<await disabled.count();i++)await disabled.nth(i).dispatchEvent('click');
   assert.equal(await snapshot(page),before,screen+' reads/blocked actions must preserve data');assert.deepEqual(await page.evaluate(()=>__quoteSafetyCalls),[]);await noLegacy(page);await page.close();
  }
  checks.push('Read/render/blocked actions on nine screens make no RPC, outbound call, write, next-date change or request completion');
  {
   const page=await ready('K-3');await guards(page);const before=await snapshot(page),button=page.locator('[data-gs="quote-send-prepare"]');
   assert.notEqual(await button.getAttribute('aria-disabled'),'true');await button.click();await page.locator(sel('Q-M')).waitFor();
   assert.equal(await page.locator('[data-action="submit-confirm"]').getAttribute('aria-disabled'),'true');await page.locator('[data-action="submit-confirm"]').dispatchEvent('click');
   assert.equal(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>__quoteSafetyCalls),[]);await page.locator(sel('Q-M')+' [data-gs="back"]').click();await page.locator(sel('K-3')).waitFor();await noLegacy(page);await page.close();
   checks.push('K3 primary action opens only the approved Q-M review; confirm/send remains blocked and Back restores K3');
  }
  {
   const page=await ready('K-1');await guards(page);const before=await snapshot(page),input=page.locator('[data-quote-quantity]').first();assert.equal(await input.count(),1,'Fixture must expose original non-price quantity cell');
   await input.fill('123 ㎡');const item=await input.getAttribute('data-id');await page.evaluate(()=>render());assert.equal(await page.locator('[data-quote-quantity]').first().inputValue(),'123 ㎡');
   await page.locator(sel('K-1')+' [data-gs="back"]').click();await page.locator('.approved-c').waitFor();await page.locator('.approved-c [data-gs="pending-task"]').click();await page.locator(sel('K-1')).waitFor();assert.equal(await page.locator('[data-quote-quantity]').first().inputValue(),'123 ㎡');
   await page.goto(origin+'/mobile.html?demo=1&screen=K-1');await page.locator(sel('K-1')).waitFor();assert.equal(await page.locator('[data-quote-quantity]').first().inputValue(),'123 ㎡','same scope reload must retain local quantity');await guards(page);
   assert.equal(await snapshot(page),before);
   await page.evaluate(()=>{const p='77777777-7777-4777-8777-777777777777';Phase1.profile={...Phase1.profile,auth_uid:p,user_id:p};});
   await page.locator('[data-quote-quantity]').first().fill('999 ㎡');await failClosed(page,'stale quantity after actor change');
   assert.deepEqual(await page.evaluate(()=>__quoteSafetyCalls),[]);sameRecords(before,await snapshot(page)); // Account changes may correctly discard the previous actor's request cache.
   await page.evaluate(()=>dispatchEvent(new Event('phase1:identity-cleared')));
   assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('crm:mobile-quote-review:')).length),0);await page.close();
   checks.push('Quantity draft survives same-account render/back/reopen/reload; stale actor input is rejected and logout removes the scoped draft');
  }
  {
   const page=await ready('K-4');await guards(page);const before=await snapshot(page),option=page.locator('[data-gs="quote-option"]').first();assert.equal(await option.count(),1);
   const key=await option.getAttribute('data-id');await page.evaluate(key=>{__approvedQuoteExample.models['K-4'].options=__approvedQuoteExample.models['K-4'].options.filter(o=>o.id!==key);},key);
   await option.click();assert.equal(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>__quoteSafetyCalls),[]);
   assert.equal(await page.locator('[data-gs="quote-option"][data-id="'+key+'"]').count(),0,'Removed choice must disappear from visible UI after stale click');
   const changed=await page.evaluate(key=>MobileQuoteFlow.handle(DEALS.find(d=>String(d.id)===String(G.deal)),'quote-option',{id:key}),key);assert.equal(changed.ok,false);
   await page.evaluate(()=>{const p='77777777-7777-4777-8777-777777777777';Phase1.profile={...Phase1.profile,auth_uid:p,user_id:p};});
   await page.locator('[data-gs="quote-option"]').first().click();await failClosed(page,'stale option after actor change');
   const stale=await page.evaluate(()=>MobileQuoteFlow.handle(DEALS.find(d=>String(d.id)===String(G.deal)),'quote-option',{id:'option-a'}));assert.equal(stale.ok,false);sameRecords(before,await snapshot(page));await page.close();
   checks.push('Removed choices disappear after stale clicks; actor changes close the stale quote view without altering local/server records');
  }
  {
   const page=await ready('K-5');await guards(page);
   await page.evaluate(()=>{delete window.__approvedQuoteExample;const d=DEALS.find(d=>String(d.id)===String(G.deal));d.quote_versions=Array.from({length:25},(_,i)=>({id:'cccccccc-cccc-4ccc-8ccc-'+String(i+1).padStart(12,'0'),opportunity_id:d.id,version_no:i+1,status:'draft',base_amount:1000000,created_at:'2026-10-10T00:00:00Z'}));MobileQuoteFlow.open(d,'K-5');render();});
   const before=await snapshot(page);assert.equal(await page.locator('[data-gs="quote-version"]').count(),20);const page2=page.locator('[data-quote-review="page"][data-page="2"]').filter({hasText:/^2$/});assert.equal(await page2.count(),1);
   await page2.click();assert.equal(await page.locator('[data-gs="quote-version"]').count(),5);assert.equal(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>__quoteSafetyCalls),[]);await noLegacy(page);await page.close();
   checks.push('25 quote versions use the common pager: 20 on page1 and 5 on page2, with no write or append-list behavior');
  }
  {
   const page=await ready('K-3');await guards(page);
   const values=await page.evaluate(()=>{delete window.__approvedQuoteExample;const d=DEALS.find(d=>String(d.id)===String(G.deal));d.quote_versions=[{id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',opportunity_id:d.id,version_no:1,base_amount:0,submit_amount:null,supply_amount:0,status:'draft'}];return MobileQuoteReviewModel.read(d,'K-3');});
   assert.equal(values.ok,true);assert.equal(values.currentVersion.base_amount,0);assert.match(values.amountRows[0].value,/^0(?:원)?$/);assert.equal(values.currentVersion.submit_amount,null);assert.match(values.amountRows[2].value,/확인/);assert.deepEqual(await page.evaluate(()=>__quoteSafetyCalls),[]);await page.close();
   checks.push('Explicit zero money remains zero; absent submit amount remains unknown, without a client-side calculation');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(networkWrites,[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,boundary:'Synthetic local browser safety verification only. All quote mutations, calculation, dispatch and production storage remain unimplemented/blocked.'};
  fs.writeFileSync(path.join(__dirname,'stage7-safety-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
