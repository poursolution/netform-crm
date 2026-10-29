'use strict';
/* 휴대폰 폭 PC 화면 (2026-10-29 대표 "지금 고쳐") — 휴대폰 '오늘'의 [성과 ›]는 PC 성과 분석(./?view=pc#p=perf)을 연다.
   900px 이하에서 왼쪽 메뉴가 위쪽 한 줄 가로 스크롤이 되고, 하위 메뉴(전체 현황 · 컨트롤타워 · 성과 분석 · 파이프라인 단계)가
   한 글자씩 세로로 꺾이지 않는지, 메뉴 자리 흰 띠 · 가로 넘침이 없는지 본다. PC 폭(941px 이상)은 예전 그대로인지 함께 본다.
   합성 자료 · 외부 연결 차단 · 저장 없음 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
async function open(browser,width,pg){
 const mobile=width<900;
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:mobile,hasTouch:mobile,timezoneId:'Asia/Seoul'});
 await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(String(e.message||e)));
 await page.clock.setFixedTime(new Date('2026-10-20T10:00:00+09:00'));
 await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.goPage&&window.DashB);
 await page.evaluate(pg=>{
  B={deals:[{id:'d1',site:'[합성] 성과 화면 현장',assignee:'이필선',brand:'POUR솔루션',code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,created:'2026-09-10',activities:[]}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
  LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='2026';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
  document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
  SB={rpc:async()=>({data:{ok:true,items:[],requests:[],rows:[]}})};TOKEN='test';try{OpsStore.aiOn=()=>false}catch(e){}window.toast=()=>{};
  goPage(pg);
 },pg);
 await page.waitForTimeout(900);
 const m=await page.evaluate(()=>{
  const vis=e=>e.getClientRects().length&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden';
  const side=document.querySelector('aside.side'),r=side.getBoundingClientRect();
  const leaf=[...side.querySelectorAll('*')].filter(e=>vis(e)&&e.childElementCount===0&&(e.textContent||'').trim().length>=2);
  const sub=[...document.querySelectorAll('#sales-analysis-menu button,#pipeline-stage-menu button')].filter(vis);
  return {sideH:Math.round(r.height),sideW:Math.round(r.width),tallest:Math.max(0,...leaf.map(e=>Math.round(e.getBoundingClientRect().height))),
   tallText:leaf.filter(e=>e.getBoundingClientRect().height>40).map(e=>e.textContent.trim()),
   sub:sub.map(b=>({t:b.textContent.replace(/\s+/g,' ').trim(),h:Math.round(b.getBoundingClientRect().height)})),
   subDisplay:getComputedStyle(document.getElementById('sales-analysis-menu')).display,
   docW:document.documentElement.scrollWidth,iw:innerWidth,dashBg:getComputedStyle(document.querySelector('.dash')).backgroundImage,shell:document.body.classList.contains('shell-v2')};
 });
 await ctx.close();return {m,errs};
}
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  for(const w of [390,320]){
   for(const pg of ['perf','pipe']){
    const {m,errs}=await open(browser,w,pg);
    assert.deepEqual(errs,[],`${w} ${pg} 화면 오류 없음`);
    assert.ok(m.shell,'공통 셸 v2 화면');
    assert.ok(m.sideH<=90,`${w} ${pg}: 메뉴는 위쪽 한 줄(높이 ${m.sideH}px)`);
    assert.deepEqual(m.tallText,[],`${w} ${pg}: 메뉴 글자가 세로로 꺾이지 않음`);
    assert.ok(m.sub.length>=3&&m.sub.every(s=>s.h<=40),`${w} ${pg}: 하위 메뉴 버튼 한 줄 ${JSON.stringify(m.sub)}`);
    assert.ok(m.docW<=m.iw,`${w} ${pg}: 화면 가로 넘침 없음(${m.docW} > ${m.iw})`);
    assert.equal(m.dashBg,'none',`${w} ${pg}: 메뉴 자리 흰 띠 없음`);
   }
  }
  for(const w of [1440,1280]){
   const {m,errs}=await open(browser,w,'perf');
   assert.deepEqual(errs,[],`${w} 화면 오류 없음`);
   assert.equal(m.sideW,200,`${w}: PC 왼쪽 메뉴 폭 그대로(200px)`);
   assert.equal(m.subDisplay,'grid',`${w}: PC 하위 메뉴는 예전처럼 세로 목록`);
   assert.notEqual(m.dashBg,'none',`${w}: PC 메뉴 자리 흰 띠 그대로`);
  }
  console.log('ok — 휴대폰 폭(390 · 320) 성과 분석 · 파이프라인: 메뉴 한 줄 · 세로 꺾임 없음 · 가로 넘침 없음 / PC 폭(1440 · 1280) 그대로');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
