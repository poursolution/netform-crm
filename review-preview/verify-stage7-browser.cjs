'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],measurements=[],errors=[],writes=[];
 const selectors={'K-1':'.approved-k1','K-2':'.approved-k2','K-3':'.approved-k3','K-4':'.approved-k4','K-5':'.approved-k5','Q-S':'.approved-quote-simple','Q-N':'.approved-quote-standards','Q-T':'.approved-quote-method','Q-M':'.approved-quote-markup'};
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());});
  async function open(screen){await page.goto(origin+'/mobile.html?demo=1&screen='+screen+'&reset=1');await page.locator(selectors[screen]).waitFor();await page.evaluate(()=>document.fonts.ready);}
  async function noLegacy(){assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel,#scr .stage-guide').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');}
  const snapshot=()=>page.evaluate(()=>({deal:G.deal,data:JSON.stringify(DEALS),rows:__review.rows.length,replies:__review.replies.length}));
  for(const width of [375,320,480]){
   await page.setViewportSize({width,height:812});
   for(const screen of Object.keys(selectors)){
    await open(screen);await noLegacy();
    const m=await page.locator(selectors[screen]).evaluate(el=>({frame:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,viewport:innerWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,frameOverflow:el.scrollWidth>el.clientWidth+1,font:getComputedStyle(el).fontFamily}));
    measurements.push({screen,width,...m});assert.equal(m.pageOverflow,false,screen+' page overflow at '+width);assert.equal(m.frameOverflow,false,screen+' frame overflow at '+width);assert.match(m.font,/ClaudeMobilePretendard/);assert(m.frame<=width+1);assert.equal(m.frame,Math.min(375,width));
    const fonts=await page.locator(selectors[screen]).evaluate(el=>[...el.querySelectorAll('[style]')].filter(n=>n.style.fontSize&&Math.abs(parseFloat(n.style.fontSize)-parseFloat(getComputedStyle(n).fontSize))>.1).map(n=>({tag:n.tagName,inline:n.style.fontSize,computed:getComputedStyle(n).fontSize})));assert.deepEqual(fonts,[],screen+' original inline font sizes must win');
    await page.locator(selectors[screen]).screenshot({path:path.join(__dirname,'approved-'+screen.toLowerCase().replace('-','')+'-implemented-'+width+'.png')});
    if(width===375)await page.locator(selectors[screen]).screenshot({path:path.join(__dirname,'approved-'+screen.toLowerCase().replace('-','')+'-implemented.png')});
   }
  }
  checks.push('All nine source44 quote routes use the approved frames/local font at320/375/480 without horizontal overflow or inherited legacy font sizes');
  await page.setViewportSize({width:375,height:812});await open('K-1');const beforeRequest=await snapshot();
  await page.locator('[data-gs="back"]').click();await page.locator('.approved-c').waitFor();assert.equal(await page.locator('[data-gs="pending-task"]').textContent(),'견적 요청 등록');
  await page.locator('[data-gs="pending-task"]').click();await page.locator('.approved-k1').waitFor();await noLegacy();assert.deepEqual(await snapshot(),beforeRequest);
  await page.locator('[data-gs="back"]').click();await page.locator('.approved-c').waitFor();assert.deepEqual(await snapshot(),beforeRequest);
  checks.push('C existing 견적 요청 등록 task opens original K1 and returns to the same deal without creating or replacing a task');
  await open('K-3');const beforeMarkup=await snapshot(),initialVersion=await page.locator('.approved-k3').getAttribute('data-version-id');
  assert.equal(initialVersion,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');assert.match(await page.locator('.approved-k3').innerText(),/적산 기준금액/);
  await page.locator('[data-gs="quote-send-prepare"]').click();await page.locator('.approved-quote-markup').waitFor();await noLegacy();
  const markupText=await page.locator('.approved-quote-markup').innerText();assert.match(markupText,/290,000,000원/);assert.doesNotMatch(markupText,/170,000,000|187,000,000|동탄푸른마을/);assert.match(markupText,/확인 필요/);
  assert.equal(await page.locator('[data-action="submit-confirm"]').getAttribute('aria-disabled'),'true');await page.locator('[data-action="submit-confirm"]').dispatchEvent('click');assert.deepEqual(await snapshot(),beforeMarkup);
  await page.locator('[data-gs="back"]').click();await page.locator('.approved-k3').waitFor();assert.equal(await page.locator('.approved-k3').getAttribute('data-version-id'),initialVersion);assert.deepEqual(await snapshot(),beforeMarkup);
  checks.push('K3 opens approved markup for its own V2/base290m; no other-site170m fixture leaks, no local submission calculation or send occurs, and back retains V2');
  await open('K-5');const beforeHistory=await snapshot();await page.locator('[data-gs="quote-version"][data-id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"]').click();await page.locator('.approved-k3').waitFor();await noLegacy();
  assert.equal(await page.locator('.approved-k3').getAttribute('data-version-id'),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');const historyText=await page.locator('.approved-k3').innerText();assert.match(historyText,/V1/);assert.match(historyText,/380,000,000원/);assert.doesNotMatch(historyText,/견적 V2|2억 9,000만/);
  await page.locator('[data-gs="back"]').click();await page.locator('.approved-k5').waitFor();assert.deepEqual(await snapshot(),beforeHistory);
  checks.push('K5 V1 history opens the selected replaced version380m rather than reusing V2 example data, and returns without modifying version or dispatch history');
  // User-facing save/send controls remain blocked even if a synthetic click bypasses native disabled semantics.
  for(const screen of ['K-1','K-2','K-4','K-5','Q-S','Q-N','Q-T','Q-M']){
   await open(screen);const before=await snapshot();const disabled=page.locator(selectors[screen]+' [aria-disabled="true"]');for(let i=0;i<await disabled.count();i++)await disabled.nth(i).dispatchEvent('click');assert.deepEqual(await snapshot(),before,screen+' blocked actions changed data');await noLegacy();
  }
  checks.push('Every blocked quote request/adjustment/option-send/history-response/draft/finalization control leaves records, schedules, requests and notifications unchanged');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,measurements,source:'Approved source44 original K1-K5 plus quote v3 four phone frames',boundary:'Synthetic local preview only. No production query/write, price calculation, quote finalization, customer send, notification or deployment.'};
  fs.writeFileSync(path.join(__dirname,'stage7-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
