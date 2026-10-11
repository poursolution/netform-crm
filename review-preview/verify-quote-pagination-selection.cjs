'use strict';
// Synthetic approved K1/K4 frames: pagination must never change hidden selections.
// No server call, operational write, calculation, or source-design modification.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 const checks=[],errors=[],writes=[],external=[];let failure;
 const reportPath=path.join(__dirname,'quote-pagination-selection-verification.json');
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin!==origin){external.push(url);return route.abort();}return route.continue();});
  async function install(page,screen){
   await page.evaluate(screen=>{
    const d=myDeals().find(x=>String(x.id)===String(G.deal));
    const field=screen==='K-1'?'works':'options';
    __approvedQuoteExample.models[screen][field]=Array.from({length:25},(_,i)=>({id:'selection-'+i,label:(screen==='K-1'?'공종 ':'안 ')+(i+1),value:'합성 표시 값',selected:true}));
    if(!MobileQuoteFlow.open(d,screen))throw Error('Synthetic quote fixture could not open');
    MobileGuideShell.state.detailView='quote';render();
    window.__quotePaginationCalls=[];
    const deny=name=>()=>{__quotePaginationCalls.push(name);throw Error('Unexpected '+name);};
    window.fetch=deny('fetch');window.open=deny('open');Phase1.rpc=deny('rpc');Phase1.queue.enqueue=deny('enqueue');window.pushWrite=deny('pushWrite');window.queueMobileContactOperation=deny('activity');
   },screen);
  }
  const selector=screen=>'.approved-'+screen.toLowerCase().replace('-','');
  const action=screen=>screen==='K-1'?'k1-work':'quote-option';
  const visible=async(page,screen)=>page.locator(selector(screen)+' [data-gs="'+action(screen)+'"]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.id,selected:n.getAttribute('aria-pressed')==='true'})));
  const records=page=>page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies}));
  async function goPage(page,number){await page.locator('[data-quote-review="page"][data-page="'+number+'"]').filter({hasText:new RegExp('^'+number+'$')}).click();}
  async function clickChoice(page,screen,id){await page.locator(selector(screen)+' [data-gs="'+action(screen)+'"][data-id="'+id+'"]').click();}
  async function safe(page,screen,before){
   assert.equal(await records(page),before,screen+' must preserve operational records');
   assert.deepEqual(await page.evaluate(()=>__quotePaginationCalls),[],screen+' must not call RPC/write/outbound handlers');
   assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel,#scr .stage-guide').count(),0);
   assert.equal(await page.locator('#sheetwrap.open').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');
   assert.equal(await page.locator(selector(screen)).count(),1);
  }
  for(const screen of ['K-1','K-4']){
   const page=await context.newPage();page.setDefaultTimeout(8000);
   page.on('pageerror',e=>errors.push({screen,message:e.message}));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
   await page.goto(origin+'/mobile.html?demo=1&screen='+screen+'&reset=1');await page.locator(selector(screen)).waitFor();
   await install(page,screen);const before=await records(page);
   let rows=await visible(page,screen);assert.equal(rows.length,20);assert(rows.every(x=>x.selected));
   await clickChoice(page,screen,'selection-0');
   rows=await visible(page,screen);assert.equal(rows.filter(x=>x.selected).length,19);
   await goPage(page,2);rows=await visible(page,screen);assert.equal(rows.length,5);
   assert(rows.every(x=>x.selected),screen+' first-page edit must keep all five unseen selections');
   const firstDraft=await page.evaluate(()=>MobileQuoteFlow.snapshot().draft);
   const key=screen==='K-1'?'works':'options';assert.equal(firstDraft[key].length,24);assert(!firstDraft[key].includes('selection-0'));
   checks.push(screen+': changing one of 25 initially selected items keeps the five hidden selections and stores 24 selected IDs');

   await clickChoice(page,screen,'selection-20');rows=await visible(page,screen);assert.equal(rows.filter(x=>x.selected).length,4);
   await goPage(page,1);rows=await visible(page,screen);assert.equal(rows.length,20);assert.equal(rows[0].selected,false);assert(rows.slice(1).every(x=>x.selected));
   const secondDraft=await page.evaluate(()=>MobileQuoteFlow.snapshot().draft);assert.equal(secondDraft[key].length,23);
   await page.locator(selector(screen)+' [data-gs="back"]').click();await page.locator('.approved-c').waitFor();
   if(screen==='K-1')await page.locator('.approved-c [data-gs="pending-task"]').click();
   else await page.evaluate(screen=>{const d=myDeals().find(x=>String(x.id)===String(G.deal));if(!MobileQuoteFlow.open(d,screen))throw Error('K4 read-only reentry failed');MobileGuideShell.state.detailView='quote';render();},screen);
   await page.locator(selector(screen)).waitFor();rows=await visible(page,screen);assert.equal(rows[0].selected,false);assert(rows.slice(1).every(x=>x.selected));
   await goPage(page,2);rows=await visible(page,screen);assert.equal(rows[0].selected,false);assert(rows.slice(1).every(x=>x.selected));await safe(page,screen,before);
   checks.push(screen+': editing page2 and reentering retains both intentional deselections plus all 23 remaining selections');

   // Deliberately clear every remaining selection across both pages, then recover it.
   for(const row of await visible(page,screen))if(row.selected)await clickChoice(page,screen,row.id);
   await goPage(page,1);
   for(const row of await visible(page,screen))if(row.selected)await clickChoice(page,screen,row.id);
   const empty=await page.evaluate(()=>MobileQuoteFlow.snapshot().draft);assert.deepEqual(empty[key],[],'Explicit none must not revert to original defaults');
   await safe(page,screen,before);
   // Retain the same browser/session, drop reset=1, and reapply only the synthetic 25-row catalog.
   await page.goto(origin+'/mobile.html?demo=1&screen='+screen);await page.locator(selector(screen)).waitFor();await install(page,screen);
   rows=await visible(page,screen);assert.equal(rows.length,20);assert(rows.every(x=>!x.selected));
   await goPage(page,2);rows=await visible(page,screen);assert.equal(rows.length,5);assert(rows.every(x=>!x.selected));
   assert.deepEqual((await page.evaluate(()=>MobileQuoteFlow.snapshot().draft))[key],[]);
   await safe(page,screen,before);await page.close();
   checks.push(screen+': explicit empty selection survives reload and both pages without resurrecting initially selected defaults');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const font='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';assert.deepEqual(external.filter(url=>url!==font),[]);
 }catch(error){failure=error;}
 finally{
  const report={at:new Date().toISOString(),passed:checks.length,checks,ok:!failure,errors,writes,blockedReadonlyAssets:[...new Set(external)],boundary:'Local synthetic K1/K4 approved-frame browser verification. Only local review choices are enabled; no production query/save, quote calculation, request, send, or design change.',...(failure?{failure:String(failure.stack||failure)}:{})};
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  await browser.close();await new Promise(resolve=>server.close(resolve));
 }
 if(failure)process.exitCode=1;
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
