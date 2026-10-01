'use strict';
/* 모바일 v2 ① 디자인 규칙 검사(2026-10-02 핸드오프 mobile 1): 배경 · 흰 카드(선으로만 구분, 색띠 · 이모지 없음) · 문장 제목 · 글자 탭바(선택 = 검정 + 파란 점) · 헤더 연결 상태 알약.
   화면을 그리는 기존 함수와 저장은 그대로(쓰기 없음). 끄면 예전 모양 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html; charset=utf-8');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MobileV2&&typeof render==='function'&&typeof nav==='function'&&window.OperationalUI);
  await page.evaluate(()=>{window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;nav('today');});await page.waitForTimeout(400);
  const css=(sel,prop)=>page.evaluate(([s,p])=>{const n=document.querySelector(s);return n?getComputedStyle(n)[p]:null;},[sel,prop]);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('mv2')),true);
  /* 배경 · 카드 · 목록 */
  assert.equal(await css('.phone-body','backgroundColor'),'rgb(245, 246, 248)','배경 #f5f6f8');
  assert.equal(await css('.mt-list','borderRadius'),'20px','흰 카드 둥근 20');assert.equal(await css('.mt-list','backgroundColor'),'rgb(255, 255, 255)');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .mt-list>.mt-item')].every((n,i)=>{const s=getComputedStyle(n);return s.borderLeftWidth==='0px'&&s.borderRadius==='0px'&&(i===0?s.borderTopWidth==='0px':s.borderTopWidth==='1px');})),true,'줄 사이 얇은 선만 — 왼쪽 색띠 · 테두리 없음');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .ml-kind,#scr .mt-rank')].every(n=>getComputedStyle(n).display==='none')),true,'이모지 · 순번 없음');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .body>*')].every(n=>getComputedStyle(n).flexShrink==='0')),true,'카드 잘림 방지(flex:none)');
  /* 제목: 맥락 한 줄 + 숫자가 든 문장 */
  const remain=await page.evaluate(()=>Number(document.querySelector('#scr .mt-remain b').textContent));
  assert.match(await page.locator('#scr .mt-head h1').innerText(),new RegExp('님, 오늘 '+remain+'곳에 연락하면 됩니다$'));assert.match(await page.locator('#scr .mt-head p').innerText(),/^\d+월 \d+일 .요일$/);
  assert.equal(await css('#scr .mt-head h1','fontSize'),'25px');assert.equal(await css('#scr .mt-head h1','fontWeight'),'700');
  assert.equal(await page.evaluate(()=>{const h=document.querySelector('#scr .mt-head h1').getBoundingClientRect(),p=document.querySelector('#scr .mt-head p').getBoundingClientRect();return p.bottom<=h.top+1;}),true,'맥락 줄이 제목 위');
  /* 탭바: 글자만 · 4칸 · 선택 = 검정 굵게 + 파란 점 */
  assert.deepEqual(await page.locator('#tabbar button .tl2').allInnerTexts(),['오늘','내 현장','등록','이번 주']);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#tabbar svg')].every(n=>getComputedStyle(n).display==='none')),true,'아이콘 없음');
  assert.equal(await css('#tabbar button.on .tl2','fontSize'),'14px');assert.equal(await css('#tabbar button.on .tl2','fontWeight'),'700');assert.equal(await css('#tabbar button.on','color'),'rgb(21, 23, 28)');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#tabbar button.on'),'::after').backgroundColor),'rgb(59, 108, 228)','파란 점');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#tabbar button')].every(b=>b.getBoundingClientRect().height>=44)),true,'누르는 영역 44 이상');
  /* 헤더: 로고 · 연결 상태 알약 · 알림 */
  assert.equal(await page.locator('#scr .home-bar .mv-status').innerText(),'예시 데이터');
  await page.evaluate(()=>{LIVE=true;render();});assert.equal(await page.locator('#scr .home-bar .mv-status.ok').innerText(),'연결됨');
  await page.evaluate(()=>{LOAD_ERR='x';MobileV2.apply();});assert.equal(await page.locator('#scr .home-bar .mv-status.bad').innerText(),'연결 안 됨');await page.evaluate(()=>{LOAD_ERR=null;LIVE=false;render();});
  assert.equal(await css('#scr .home-bar .hb-status','display'),'none');assert.equal(await page.locator('#scr .home-bar [aria-label="알림함"]').count(),1);
  if(shot)await page.screenshot({path:shot+'-today.png'});
  /* 다른 탭도 같은 규칙 · 탭 이동은 기존 그대로 */
  await page.locator('#tabbar button',{hasText:'내 현장'}).click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>G.tab),'mine');assert.equal(await css('#scr .sec-h h2','fontSize'),'25px');assert.equal(await css('#scr .card','borderTopWidth'),'0px');assert.equal(await css('#scr .card','borderRadius'),'20px');
  if(shot)await page.screenshot({path:shot+'-mine.png'});
  await page.locator('#tabbar button',{hasText:'이번 주'}).click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>G.tab),'my');if(shot)await page.screenshot({path:shot+'-week.png'});
  await page.locator('#tabbar button',{hasText:'등록'}).click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>G.tab),'find');if(shot)await page.screenshot({path:shot+'-new.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'가로 넘침 없음');
  assert.deepEqual(await page.evaluate(()=>__writes),[],'틀만 바꾼다 — 쓰기 없음');
  /* 끄기 */
  await page.evaluate(()=>{G.mobileV2Off=true;nav('today');});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('mv2')),false);assert.deepEqual(await page.locator('#tabbar button .tl2').allInnerTexts(),['오늘','내 영업','영업 등록','내 실적'],'끄면 예전 탭 이름');
  assert.equal(await page.locator('#scr .mt-head h1').innerText(),'오늘 우선순위');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',background_cards:true,list_lines_only:true,sentence_title:true,text_tabbar_dot:true,header_status_pill:true,no_writes:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
