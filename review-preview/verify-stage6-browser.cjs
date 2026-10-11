'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 const checks=[],measurements=[],errors=[],networkWrites=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))networkWrites.push(r.url());});
  const selectors={G:'.approved-g','J-1':'.approved-j1','J-2':'.approved-j2'};
  async function open(screen){await page.goto(origin+'/mobile.html?demo=1&screen='+screen+'&reset=1');await page.locator(selectors[screen]).waitFor();await page.evaluate(()=>document.fonts.ready);}
  async function noLegacy(){assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel,#scr .stage-guide').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');}
  const snapshot=()=>page.evaluate(()=>({deal:G.deal,data:JSON.stringify(DEALS),rows:__review.rows.length,replies:__review.replies.length}));
  for(const width of [375,320,480]){
   await page.setViewportSize({width,height:812});
   for(const screen of ['G','J-1','J-2']){
    await open(screen);await noLegacy();
    const m=await page.locator(selectors[screen]).evaluate(el=>({frame:el.getBoundingClientRect().width,viewport:innerWidth,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,frameOverflow:el.scrollWidth>el.clientWidth+1,font:getComputedStyle(el).fontFamily}));
    measurements.push({screen,width,...m});assert.equal(m.pageOverflow,false,screen+' page overflow at '+width);assert.equal(m.frameOverflow,false,screen+' frame overflow at '+width);assert.match(m.font,/ClaudeMobilePretendard/);assert(m.frame<=width+1);
    const fonts=await page.locator(selectors[screen]).evaluate(el=>[...el.querySelectorAll('[style]')].filter(n=>n.style.fontSize&&Math.abs(parseFloat(n.style.fontSize)-parseFloat(getComputedStyle(n).fontSize))>.1).map(n=>({tag:n.tagName,inline:n.style.fontSize,computed:getComputedStyle(n).fontSize})));assert.deepEqual(fonts,[],screen+' original font size must win');
    if(width===375)await page.locator(selectors[screen]).screenshot({path:path.join(__dirname,'approved-'+screen.toLowerCase().replace('-','')+'-implemented.png')});
   }
  }
  checks.push('G/J-1/J-2 retain local font and supplied sizing without horizontal overflow at320/375/480');
  await page.setViewportSize({width:375,height:812});await open('G');
  const beforeG=await snapshot(),reference=page.locator('[data-gs="g-reference"]').first(),complete=page.locator('[data-gs="g-evidence"]').first();
  assert(await reference.count()>0,'G synthetic fixture must include incomplete evidence');assert(await complete.count()>0,'G synthetic fixture must include complete evidence');
  assert.equal(await reference.getAttribute('aria-disabled'),'true');assert.equal(await page.locator('[data-gs="g-evidence"][aria-pressed="true"]').count(),0);
  await reference.dispatchEvent('click');assert.equal(await page.locator('[data-gs="g-evidence"][aria-pressed="true"]').count(),0);
  await complete.click();const selected=await page.locator('[data-gs="g-evidence"][aria-pressed="true"]').getAttribute('data-id');assert(selected);
  const next=page.locator('[data-gs="g-next"]');assert.equal(await next.getAttribute('aria-disabled'),'true');await next.dispatchEvent('click');assert.deepEqual(await snapshot(),beforeG);await noLegacy();
  checks.push('G incomplete evidence cannot be selected; complete evidence requires an explicit choice, and missing steps2–4 keep Next blocked without writes');
  await page.locator('.approved-g [data-gs="back"]').click();await page.locator('.approved-c').waitFor();assert.equal((await snapshot()).deal,beforeG.deal);
  await page.locator('.approved-c [data-gs="more"]').filter({hasText:'자료 발송 내역'}).click();await page.locator('.approved-g').waitFor();assert.equal(await page.locator('[data-gs="g-evidence"][aria-pressed="true"]').getAttribute('data-id'),selected);
  await page.locator('.approved-g [data-gs="back"]').click();await page.locator('.approved-c').waitFor();await page.locator('.approved-c [data-gs="more"]').filter({hasText:'영업 조건'}).click();await page.locator('.approved-j1').waitFor();await noLegacy();await page.locator('[data-gs="stage-confirmation-back"]').click();await page.locator('.approved-c').waitFor();assert.equal((await snapshot()).deal,beforeG.deal);
  checks.push('C existing material/sales-condition links open approved G/J-1; back preserves the same deal and G selection');
  await open('J-1');const beforeJ1=await snapshot();assert.equal(await page.locator('.approved-j1 input[type="checkbox"]').count(),0);
  const proof=page.locator('[data-gs="stage-confirmation-evidence"]').first();if(await proof.count()){assert(await proof.getAttribute('data-evidence-id'));assert(await proof.getAttribute('data-confirmed-at'));await proof.click();await noLegacy();}
  assert.deepEqual(await snapshot(),beforeJ1);checks.push('J-1 has no read-checkbox or automatic completion; proof navigation carries an evidence id/date without writes');
  await open('J-2');const beforeJ2=await snapshot(),transition=page.locator('[data-gs="j2-transition"]');assert.equal(await transition.getAttribute('aria-disabled'),'true');await transition.dispatchEvent('click');assert.deepEqual(await snapshot(),beforeJ2);assert.equal(await page.locator('.approved-j2 input[type="date"]').count(),0);
  await page.locator('.approved-j2 [data-gs="back"]').click({position:{x:12,y:12}});await page.locator('.approved-c').waitFor();await page.locator('.approved-c [data-gs="stage-change"]').click();await page.locator('.approved-j2').waitFor();await noLegacy();assert.deepEqual(await snapshot(),beforeJ2);
  checks.push('C consulting stage-change opens J-2; transition remains blocked and no default follow-up date or new task is written');
  await open('G');await page.locator('[data-gs="g-evidence"]').first().click();assert.equal(await page.locator('[data-gs="g-evidence"][aria-pressed="true"]').count(),1);
  await page.evaluate(()=>{const p=Phase1.profile;Phase1.profile={...p,auth_uid:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};dispatchEvent(new Event('phase1:profile'));render();});
  assert.equal(await page.locator('[data-gs="g-evidence"][aria-pressed="true"]').count(),0);await noLegacy();assert.equal(await page.evaluate(()=>__review.rows.length),0);assert.equal(await page.evaluate(()=>__review.replies.length),0);
  checks.push('Account change clears the selected evidence before rendering another actor and performs no save');
  assert.deepEqual(networkWrites,[]);assert.deepEqual(errors,[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,measurements,boundary:'Synthetic local stage6 preview only; no production writes, send, stage change, schedule change, or deployment. Missing approved G steps2–4/shared confirmation contract stay blocked.'};
  fs.writeFileSync(path.join(__dirname,'stage6-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
