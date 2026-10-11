'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],geometries=[];
 try{
  const ctx=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul',reducedMotion:'reduce'});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/mobile.html?demo=1&review=contact');
  await page.locator('.approved-d .ce-save').waitFor();await page.evaluate(()=>document.fonts.ready);
  const card=page.locator('#sheetcard'),frame=card.locator('.approved-d');
  assert.equal(await frame.locator('.cd-body>.cd-results,.cd-body>.cd-note,.cd-body>.cd-next-section').count(),3);
  assert.deepEqual(await frame.locator('[data-ce="res"]').allTextContents(),['연결됨','회신 받음','부재','번호 오류','배드핏']);
  assert.equal(await card.locator('.intro,.sheet-grip,.ce-reqs').count(),0);
  assert(await card.locator('[data-ce="save"]').isDisabled());
  await card.locator('[data-ce="res"][data-v="연결됨"]').click();
  await card.locator('[data-ce-in="memo"]').fill('다음 주 대표회의에서 검토 · 금요일까지 견적서 보내 달라고 함');
  await card.locator('[data-ce-in="memo"]').evaluate(el=>el.blur());
  assert(await card.locator('[data-ce="save"]').isEnabled());
  checks.push('five PC contact values and three original sections; no former sheet intro; valid input enables save');
  const sourceComparison=await frame.evaluate(actual=>{
   const box=document.createElement('div');box.innerHTML=window.MobileApprovedDSource;
   const source=box.firstElementChild,[sh,sc,sr,sb,sf]=source.children;
   const pairs=[['frame',actual,source],['header',actual.querySelector('.cd-head'),sh],['back',actual.querySelector('.cd-back'),sh.firstElementChild],['context',actual.querySelector('.cd-context'),sc],['request',actual.querySelector('.cd-request'),sr],['body',actual.querySelector('.cd-body'),sb],['footer',actual.querySelector('.ce-foot'),sf],['results section',actual.querySelector('.cd-results'),sb.children[0]],['results title',actual.querySelector('.cd-results>b'),sb.children[0].children[0]],['results container',actual.querySelector('.cd-results>.ce-chips'),sb.children[0].children[1]],['note section',actual.querySelector('.cd-note'),sb.children[1]],['note title',actual.querySelector('.cd-note>b'),sb.children[1].children[0]],['textarea',actual.querySelector('textarea'),sb.children[1].children[1]],['next section',actual.querySelector('.cd-next-section'),sb.children[2]],['next box',actual.querySelector('.cd-next'),sb.children[2].children[1]],['existing task',actual.querySelector('.cd-existing'),sb.children[2].children[1].children[0]],['mode container',actual.querySelector('.ce-modes'),sb.children[2].children[1].children[1]],['info link',actual.querySelector('.ce-infobtn'),sb.children[3]],['preview',actual.querySelector('.ce-prev'),sf.firstElementChild],['save',actual.querySelector('.ce-save'),sf.lastElementChild]];
   const sourceResult=sb.children[0].children[1].children,sourceMode=sb.children[2].children[1].children[1].children;
   actual.querySelectorAll('[data-ce="res"]').forEach(n=>pairs.push(['result '+n.textContent,n,sourceResult[n.getAttribute('aria-pressed')==='true'?0:1]]));
   actual.querySelectorAll('[data-ce="mode"]').forEach(n=>pairs.push(['mode '+n.textContent,n,sourceMode[n.getAttribute('aria-pressed')==='true'?0:1]]));
   const differences=[];
   for(const [name,n,ref] of pairs){const keys=[...new Set([...n.style,...ref.style])];for(const key of keys)if(n.style.getPropertyValue(key)!==ref.style.getPropertyValue(key))differences.push({name,key,actual:n.style.getPropertyValue(key),source:ref.style.getPropertyValue(key)});}
   return {compared:pairs.length,differences};
  });
  assert.deepEqual(sourceComparison.differences,[],'bound nodes must preserve every original inline style');
  checks.push(`${sourceComparison.compared} mapped original nodes preserve all inline layout/style declarations`);
  for(const width of [320,375,480]){
   await page.setViewportSize({width,height:812});
   const geom=await frame.evaluate(el=>{
    const r=el.getBoundingClientRect(),h=el.querySelector('.cd-head'),body=el.querySelector('.cd-body'),footer=el.querySelector('.ce-foot'),memo=el.querySelector('textarea');
    const style=n=>{const c=getComputedStyle(n);return {padding:c.padding,gap:c.gap,display:c.display,fontSize:c.fontSize,fontWeight:c.fontWeight,border:c.borderTopWidth,borderColor:c.borderTopColor,radius:c.borderRadius};};
    const chips=selector=>[...el.querySelectorAll(selector)].map(n=>({height:n.getBoundingClientRect().height,hitHeight:parseFloat(getComputedStyle(n,'::after').height),hitWidth:parseFloat(getComputedStyle(n,'::after').minWidth)}));
    return {width:r.width,height:r.height,x:r.x,top:r.top,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,radius:getComputedStyle(el).borderRadius,border:getComputedStyle(el).borderWidth,headerHeight:h.getBoundingClientRect().height,header:style(h),body:style(body),footer:style(footer),info:style(el.querySelector('.ce-infobtn')),footerBottom:footer.getBoundingClientRect().bottom,frameBottom:r.bottom,memoHeight:memo.getBoundingClientRect().height,memo:style(memo),results:chips('[data-ce="res"]'),modes:chips('[data-ce="mode"]'),saveHeight:el.querySelector('.ce-save').getBoundingClientRect().height};
   });
   geometries.push({viewport:width,...geom});
   assert.equal(geom.width,Math.min(width,375));assert.equal(geom.height,740);assert.equal(geom.x,(width-Math.min(width,375))/2);
   assert.equal(geom.radius,'28px');assert.equal(geom.border,'8px');assert(geom.scrollWidth<=geom.clientWidth);
   assert.equal(geom.headerHeight,56);assert.equal(geom.header.padding,'0px 16px');assert.equal(geom.header.gap,'10px');
   assert.equal(geom.body.padding,'14px 16px');assert.equal(geom.body.gap,'14px');assert.equal(geom.body.display,'flex');
   assert.equal(geom.footer.padding,'12px 16px 16px');assert.equal(geom.footer.gap,'8px');assert.equal(geom.footer.display,'flex');assert.equal(geom.footerBottom,geom.frameBottom-8);
   assert.equal(geom.memoHeight,96);assert.equal(geom.memo.radius,'10px');assert.equal(geom.memo.padding,'10px 12px');assert.equal(geom.memo.fontSize,'14.5px');assert.equal(geom.memo.border,'2px');assert.equal(geom.memo.borderColor,'rgb(59, 108, 228)');
   assert.equal(geom.info.fontWeight,'400','original information link must not inherit former bold button weight');assert.equal(geom.info.padding,'0px');
   assert(geom.results.every(x=>x.height===40),`source result chips must visually remain 40px: ${JSON.stringify(geom.results)}`);
   assert(geom.modes.every(x=>x.height===38),`source mode chips must visually remain 38px: ${JSON.stringify(geom.modes)}`);
   assert([...geom.results,...geom.modes].every(x=>x.hitHeight>=44&&x.hitWidth>=44),'invisible hit areas must reach 44px independently of visual sizes');assert.equal(geom.saveHeight,48);
   await frame.screenshot({path:path.join(__dirname,`approved-d-${width}.png`)});
   if(width===375)await frame.screenshot({path:path.join(__dirname,'approved-d-implemented.png')});
   checks.push(`${width}px viewport: original 375x740 frame capped to width, original typography/spacing, 40/38px chips with invisible 44px hit areas`);
  }
  await page.setViewportSize({width:375,height:812});
  await card.locator('[data-ce="mode"][data-v="change"]').click();await card.locator('[data-ce="date-open"]').click();
  assert(await card.locator('[role="dialog"]').isVisible());await card.locator('[data-ce="date"]').first().click();
  assert.equal(await card.locator('[role="dialog"]').count(),0);assert.match(await card.locator('[data-ce-in="memo"]').inputValue(),/대표회의/);
  checks.push('date selection retains consultation input');
  await card.locator('[data-ce="mode"][data-v="keep"]').click();
  const before=await page.evaluate(()=>structuredClone(DEALS[0].nextAction));
  await card.locator('[data-ce="save"]').click();await page.waitForFunction(()=>document.querySelector('.ce-save')?.textContent==='저장됨');
  assert.deepEqual(await page.evaluate(()=>DEALS[0].nextAction),before);assert.equal(await page.evaluate(()=>__review.rows.length),1);assert.equal(await page.evaluate(()=>__review.replies.length),0);
  checks.push('one activity saved; keep does not change existing task or complete unselected request');
  await card.locator('.cd-back').click();assert.equal(await page.evaluate(()=>document.querySelector('#sheetwrap').classList.contains('ce-page-wrap')),false);assert.equal(await page.evaluate(()=>document.querySelector('#scr').inert),false);
  checks.push('back restores approved detail interaction');
  assert.deepEqual(errors,[]);
  const result={at:new Date().toISOString(),passed:checks.length,checks,sourceComparison,geometries,scope:'original Claude guide42 D; synthetic local preview; no deployment or real-account validation'};
  fs.writeFileSync(path.join(__dirname,'design-d-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
