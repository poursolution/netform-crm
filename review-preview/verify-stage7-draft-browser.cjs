'use strict';
// Actual approved K1 DOM with local synthetic fixtures. No operational writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 const checks=[],errors=[],writes=[],external=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
  async function ready(){
   const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
   await page.goto(origin+'/mobile.html?demo=1&screen=K-1&reset=1');await page.locator('.approved-k1').waitFor();
   await page.evaluate(()=>{window.__draftCalls=[];const deny=name=>()=>{__draftCalls.push(name);throw Error('Unexpected '+name);};window.fetch=deny('fetch');window.open=deny('open');Phase1.rpc=deny('rpc');Phase1.queue.enqueue=deny('enqueue');window.pushWrite=deny('pushWrite');window.queueMobileContactOperation=deny('activity');});
   return page;
  }
  const records=page=>page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies}));
  const stored=page=>page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(k=>k.startsWith('crm:mobile-quote-review:v1:')).map(k=>[k,sessionStorage.getItem(k)])));
  const input=page=>page.locator('.approved-k1 [data-quote-quantity]').first();
  const back=page=>page.locator('.approved-k1 [data-gs="back"]').click();
  async function reenter(page){await page.locator('.approved-c [data-gs="pending-task"]').click();await page.locator('.approved-k1').waitFor();}
  async function safe(page,before){
   assert.equal(await records(page),before,'CRM records and requests stay unchanged');assert.deepEqual(await page.evaluate(()=>__draftCalls),[]);
   assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel,#scr .stage-guide').count(),0,'No retired mobile UI');
   assert.equal(await page.locator('#sheetwrap.open').count(),0,'No retired detail sheet');
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');
   assert((await page.locator('#scr').innerHTML()).length>0,'Approved screen is not blank');
  }
  {
   const page=await ready(),before=await records(page);await input(page).fill('처음 실측 1200 ㎡');const original=await stored(page);assert.equal(Object.keys(original).length,1);
   await page.evaluate(()=>{window.__draftSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(key).startsWith('crm:mobile-quote-review:v1:'))throw new DOMException('Synthetic quota','QuotaExceededError');return __draftSet.call(this,key,value);};});
   const field=await input(page).elementHandle(),latest='보관 실패 뒤 최신 실측 1387 ㎡';await input(page).fill(latest);
   assert.equal(await field.evaluate(node=>node.isConnected&&node===document.activeElement),true,'Failure must not replace the typing node or lose focus');
   assert.equal(await input(page).inputValue(),latest);assert.deepEqual(await stored(page),original,'Failed write retains original stored bytes');
   assert.equal((await page.evaluate(()=>MobileQuoteFlow.snapshot())).dirty,true);
   await back(page);assert.equal(await page.locator('.approved-k1').count(),1,'Failed draft persistence blocks back');assert.equal(await input(page).inputValue(),latest);assert.deepEqual(await stored(page),original);
   assert.match(await page.locator('.approved-k1').innerText(),/입력 임시 보관 실패/);
   await page.evaluate(()=>{Storage.prototype.setItem=__draftSet;});await back(page);await page.locator('.approved-c').waitFor();assert.equal(await page.evaluate(()=>MobileQuoteFlow.snapshot()),null);
   await reenter(page);assert.equal(await input(page).inputValue(),latest);assert.doesNotMatch(await page.locator('.approved-k1').innerText(),/입력 임시 보관 실패/);
   assert.equal((await page.evaluate(()=>MobileQuoteFlow.snapshot())).dirty,false);
   await page.locator('#toast.show').waitFor({state:'hidden'});await page.locator('.approved-k1').screenshot({path:path.join(__dirname,'approved-k1-draft-recovery.png')});await safe(page,before);await page.close();
   checks.push('K1 quantity keeps its focused DOM node after storage failure; back retains latest text and old stored bytes until retry succeeds, then C → K1 restores the latest quantity');
  }
  {
   const page=await ready(),before=await records(page);await input(page).fill('첫 화면 실측 1000 ㎡');
   const concurrent=await page.evaluate(()=>{const key=Object.keys(sessionStorage).find(k=>k.startsWith('crm:mobile-quote-review:v1:')),raw=JSON.parse(sessionStorage.getItem(key)),id=Object.keys(raw.draft.quantities)[0];raw.draft.quantities[id]='다른 핸들이 보관한 2020 ㎡';sessionStorage.setItem(key,JSON.stringify(raw));return {[key]:sessionStorage.getItem(key)};});
   const field=await input(page).elementHandle(),latest='현재 화면 최신 실측 3030 ㎡';await input(page).fill(latest);
   assert.equal(await field.evaluate(node=>node.isConnected&&node===document.activeElement),true);assert.equal(await input(page).inputValue(),latest);assert.deepEqual(await stored(page),concurrent);
   await back(page);assert.equal(await page.locator('.approved-k1').count(),1);assert.equal(await input(page).inputValue(),latest);assert.deepEqual(await stored(page),concurrent,'A competing draft is neither overwritten nor removed');
   const state=await page.evaluate(()=>MobileQuoteFlow.snapshot());assert.equal(state.storageError,'QUOTE_DRAFT_CONFLICT');assert(Object.values(state.draft.quantities).includes(latest));await safe(page,before);await page.close();
   checks.push('A competing handle’s stored draft is not overwritten; current K1 text remains visible and back is blocked with the existing failure wording');
  }
  {
   for(const change of ['account','version','quote','context','work']){
    const page=await ready();await input(page).fill('다른 맥락에 옮기지 않을 4242 ㎡');const original=await stored(page);
    await page.evaluate(change=>{const d=myDeals().find(d=>String(d.id)===String(G.deal));if(change==='account'){const id='77777777-7777-4777-8777-777777777777';Phase1.profile={...Phase1.profile,auth_uid:id,user_id:id};}else if(change==='version')d.version++;else if(change==='quote')d.quote_versions[0].base_amount++;else if(change==='context')d.stage_contexts={...(d.stage_contexts||{}),consulting:{fields:{quote_request:'다른 요청 조건'}}};else d.work_items=[...(d.work_items||[]),'추가 공종'];},change);
    const afterChange=await records(page);await back(page);
    assert.equal(await page.locator('.approved-k1').count(),0,change+' stale view closes');assert.equal(await page.evaluate(()=>MobileQuoteFlow.snapshot()),null,change+' context is released');
    assert.deepEqual(await stored(page),original,change+' existing draft not rebound or rewritten');
    if(change==='account'){
     assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'pending','Partial authentication change must not reveal the previous account’s C detail');
     assert.equal(await page.locator('#scr').evaluate(n=>n.children.length),0);assert.equal(await page.locator('#scr .approved-c,#scr .mv-now,#scr .flow-strip').count(),0);
     assert.equal(await records(page),afterChange);assert.deepEqual(await page.evaluate(()=>__draftCalls),[]);
     await page.evaluate(()=>dispatchEvent(new Event('phase1:identity-cleared')));assert.deepEqual(await stored(page),{},'Normal identity cleanup removes the previous owner draft');
    }else{assert.equal(await page.evaluate(()=>MobileGuideShell.state.detailView),'');await safe(page,afterChange);}
    await page.close();
   }
   checks.push('Actual Back after partial actor change hides prior-account content until authentication cleanup; deal/version/quote/context/work changes return to the approved current detail without a blank screen or rebinding saved text');
  }
  {
   const page=await ready();await input(page).fill('이전 버전 실측 5151 ㎡');await back(page);await page.locator('.approved-c').waitFor();const original=await stored(page);
   await page.evaluate(()=>{myDeals().find(d=>String(d.id)===String(G.deal)).version++;});const afterChange=await records(page);
   await page.locator('.approved-c [data-gs="pending-task"]').click();assert.equal(await page.locator('.approved-c').count(),1,'Changed-version retained draft must not reopen into a blank K1');
   assert.equal(await page.locator('.approved-k1').count(),0);assert.equal(await page.evaluate(()=>MobileQuoteFlow.snapshot()),null);assert.deepEqual(await stored(page),original);await safe(page,afterChange);await page.close();
   checks.push('A retained draft from an older deal version cannot reopen as an empty K1: the approved C screen and original stored draft remain intact');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const allowedFont='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';assert.deepEqual(external.filter(url=>url!==allowedFont),[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,blockedReadonlyAssets:[...new Set(external)],boundary:'Synthetic local K1/C browser clicks, storage quota and concurrent-writer failures. Every external request and operational RPC/write path blocked. No production calculation, save, request, send, source-design change or deployment.'};
  fs.writeFileSync(path.join(__dirname,'stage7-draft-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
