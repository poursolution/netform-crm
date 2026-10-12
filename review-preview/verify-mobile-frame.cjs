'use strict';
// 모바일 승인 화면의 바깥 틀 — 승인 화면이 떠 있는 동안 예전 폰 목업 틀(.phone)이 어떤 경우에도 겹치지 않는다. 합성 예시 · 외부 연결 차단.
// 확인: 넓은 화면(744×953)과 폰 크기(390×844) 모두 .phone 이 화면 전체 · 테두리 · 둥근 모서리 · 그림자 없음 · 가짜 상태바 없음 /
//       본문 클래스(svc · claude-shell)나 승인 화면 스타일 파일이 빠져도(오래된 캐시 · 로딩 실패) 같은 결과 / 승인 화면 안쪽 틀(375×740)은 가운데 한 겹.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('./server.cjs');
const {launchOptions}=require('./review-environment.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch(launchOptions());
  for(const [w,h] of [[744,953],[390,844]]){
   const ctx=await browser.newContext({viewport:{width:w,height:h},timezoneId:'Asia/Seoul'}),errors=[];
   await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/mobile.html?demo=1&screen=A',{waitUntil:'domcontentloaded'});await page.locator('.approved-a').waitFor();
   const frame=()=>page.evaluate(()=>{const p=document.querySelector('.phone'),r=p.getBoundingClientRect(),cs=getComputedStyle(p),a=document.querySelector('.approved-a').getBoundingClientRect(),sb=document.querySelector('.statusbar');
    return {view:document.documentElement.getAttribute('data-mobile-approved-view'),x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),border:cs.borderTopWidth,radius:cs.borderTopLeftRadius,shadow:cs.boxShadow,sb:sb?sb.getBoundingClientRect().height:0,aw:Math.round(a.width),ax:Math.round(a.x),ab:getComputedStyle(document.querySelector('.approved-a')).borderTopWidth,ar:getComputedStyle(document.querySelector('.approved-a')).borderTopLeftRadius,ah:Math.round(a.height),vw:innerWidth,vh:innerHeight};});
   const ok=f=>{assert.equal(f.view,'approved');assert.deepEqual([f.x,f.y,f.w,f.h],[0,0,f.vw,f.vh],'폰 목업 틀이 화면 전체(틀 없음)');assert.equal(f.border,'0px');assert.equal(f.radius,'0px');assert.equal(f.shadow,'none');assert.equal(f.sb,0,'가짜 상태바 없음');};
   const a=await frame();ok(a);
   assert.deepEqual([a.aw,a.ax,a.ab,a.ar],[Math.min(w,480),Math.round((w-Math.min(w,480))/2),'0px','0px'],'승인 화면 틀 없음 — 폭 = 화면(최대 480px 가운데) · 테두리 · 둥근 모서리 없음(그림의 375×740 폰 목업 틀을 앱에 넣지 않는다)');
   /* 오래된 캐시 · 로딩 실패를 흉내: 승인 화면 스타일 파일과 본문 클래스가 빠져도 바깥 틀이 생기지 않는다 */
   await page.evaluate(()=>{document.querySelectorAll('link[href*="mobile-guide-shell.css"]').forEach(n=>n.remove());document.body.classList.remove('svc');});
   await page.waitForTimeout(100);const b=await frame();ok(b);
   assert.deepEqual(errors,[],'화면 오류 없음');await ctx.close();
  }
  /* 모든 화면(시트로 뜨는 연락 결과 포함)에 폰 목업 틀(테두리 4px 이상 · 둥근 모서리 16px 이상인 큰 상자)이 남지 않는다 */
  const scan=()=>[...document.querySelectorAll('body *')].filter(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>200&&r.height>300&&parseFloat(c.borderTopWidth)>=4&&parseFloat(c.borderTopLeftRadius)>=16;}).map(e=>String(e.className||e.tagName));
  for(const w of [780,390]){
   const ctx=await browser.newContext({viewport:{width:w,height:900},timezoneId:'Asia/Seoul'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   for(const scr of ['A','B','C','D','E','F','G','H','I-1','I-2','I-3','J-1','J-2','J-3','J-4','K-1','K-2','K-3','K-4','K-5','Q-S','Q-N','Q-T','Q-M','E-1','E-2','E-3']){
    const page=await ctx.newPage();await page.goto(origin+'/mobile.html?demo=1&screen='+scr,{waitUntil:'domcontentloaded'});await page.waitForTimeout(450);
    assert.deepEqual(await page.evaluate(scan),[],w+'px 화면 '+scr+' — 폰 목업 틀이 남아 있음');await page.close();
   }
   const page=await ctx.newPage();await page.goto(origin+'/mobile.html?demo=1&screen=A',{waitUntil:'domcontentloaded'});await page.locator('.approved-a').waitFor();
   await page.evaluate(()=>{const d=DEALS[0],e=document.createElement('span');e.dataset.gs='deal';e.dataset.id=d.id;document.body.append(e);e.click();});await page.waitForTimeout(350);
   await page.locator('[data-gs=contact]').first().click();await page.waitForTimeout(450);
   assert.deepEqual(await page.evaluate(scan),[],w+'px 연락 결과 시트 — 폰 목업 틀이 남아 있음');await ctx.close();
  }
  console.log('mobile frame ok');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
