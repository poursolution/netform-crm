'use strict';
/* 첫 진입 '연결 중' 멈춤(2026-10-08 inquiry_memo ⑦): Phase1 은 phase1-config.js → pc-manager-transport.js 가 모두 실행돼야 생긴다.
   둘 중 하나가 못 불러와지면 'Phase1 is not defined' → 'OPERATIONAL_LOAD_ORDER' 로 뒤 스크립트가 줄줄이 멈춘다(불러오는 순서는 맞다).
   확인: ① 정상 진입 = 안내 한 줄 없음 ② 전송 모듈 못 불러옴 = 원인 + [다시 시도] 한 줄 · 돌기만 하던 불러오는 중 표시는 숨김 · [다시 시도] = 주소에 _r 만 덧붙임
         ③ 설정 못 불러옴 ④ 연결된 뒤에는 한 줄이 걷힌다 ⑤ 10초 넘게 연결 중 = 실패 한 줄(로그인 화면에서는 안 뜸) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const open=async(block)=>{
   const ctx=await browser.newContext({viewport:{width:1400,height:900},timezoneId:'Asia/Seoul'});
   await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='127.0.0.1')return r.abort();if(block&&u.pathname.endsWith(block))return r.abort();return r.continue();});
   const page=await ctx.newPage(),errs=[];await page.addInitScript(()=>{window.__bootGuardTimer=true;});page.on('pageerror',e=>errs.push(e.message));
   await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html?view=pc`);await page.waitForFunction(()=>window.BootGuard);await page.waitForTimeout(500);
   return {ctx,page,errs};
  };
  /* ① 정상 */
  {const {ctx,page,errs}=await open('');
   assert.equal(await page.locator('#boot-fail').count(),0,'정상 진입에는 안내가 없다');assert.equal(await page.evaluate(()=>!!window.Phase1),true);assert.deepEqual(errs,[]);await ctx.close();}
  /* ② 전송 모듈 */
  {const {ctx,page,errs}=await open('pc-manager-transport.js');
   assert.ok(errs.some(e=>/Phase1 is not defined/.test(e))&&errs.some(e=>/OPERATIONAL_LOAD_ORDER/.test(e)),'원인 재현: '+errs.join('|'));
   const bar=page.locator('#boot-fail');assert.equal(await bar.count(),1);
   assert.equal(one(await bar.innerText()),'불러오기 실패 · pc-manager-transport.js 를 불러오지 못했습니다 다시 시도');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('load')).display),'none','도는 표시는 숨긴다');
   assert.equal(await bar.evaluate(e=>e.scrollWidth<=e.clientWidth+1&&getComputedStyle(e).position==='fixed'),true,'한 줄 · 글 잘림 없음');
   await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),bar.locator('[data-bf="retry"]').click()]);
   const u=new URL(page.url());assert.equal(u.searchParams.get('view'),'pc','기존 주소 값은 그대로');assert.match(u.searchParams.get('_r')||'',/^\d{13}$/,'시각만 덧붙여 새로 받는다');
   await ctx.close();}
  /* ③ 설정 */
  {const {ctx,page}=await open('phase1-config.js');
   assert.equal(one(await page.locator('#boot-fail').innerText()),'불러오기 실패 · phase1-config.js 를 불러오지 못했습니다 다시 시도');await ctx.close();}
  /* ④ ⑤ 10초 넘게 연결 중 · 연결되면 걷힘 · 로그인 화면에서는 안 뜸 */
  {const {ctx,page}=await open('');
   await page.evaluate(()=>{const g=document.getElementById('authGate');g.classList.remove('on');const l=document.getElementById('live');l.classList.remove('on');l.textContent='연결 중…';});
   await page.waitForTimeout(10200);
   assert.equal(one(await page.locator('#boot-fail').innerText()),'불러오기 실패 · 운영 데이터 연결이 10초 넘게 끝나지 않았습니다 다시 시도');
   await page.evaluate(()=>{document.getElementById('live').classList.add('on');});await page.waitForTimeout(1300);
   assert.equal(await page.locator('#boot-fail').count(),0,'연결되면 한 줄이 걷힌다');await ctx.close();}
  /* 읽기 신호가 오는 동안(느린 정상 로딩)은 10초가 지나도 실패로 보지 않고, 신호가 끊긴 뒤 일정 시간 조용하면 알린다 */
  {const {ctx,page}=await open('');await page.addInitScript(()=>{window.__bootGuardBeatWait=4000;});
   await page.evaluate(()=>{window.__bootGuardBeatWait=4000;const g=document.getElementById('authGate');g.classList.remove('on');document.getElementById('live').classList.remove('on');});
   for(let i=0;i<6;i++){await page.evaluate(()=>window.dispatchEvent(new CustomEvent('crm:read-state',{detail:{label:'핵심 데이터 연결 중',ready:false}})));await page.waitForTimeout(2000);}
   assert.equal(await page.locator('#boot-fail').count(),0,'신호가 오는 동안은 안내가 없다(12초 지남)');await ctx.close();}
  {const {ctx,page}=await open('');
   await page.waitForTimeout(10300);
   assert.equal(await page.evaluate(()=>document.getElementById('authGate').classList.contains('on')),true);assert.equal(await page.locator('#boot-fail').count(),0,'로그인 화면에서는 연결 대기가 아니다');await ctx.close();}
  console.log('boot guard ok');
 }finally{await browser.close();srv.close();}
 function one(s){return String(s||'').replace(/\s+/g,' ').trim();}
})().catch(e=>{console.error(e);process.exit(1)});
