'use strict';
/* 상세 새 창(2026-09-26 대표 "상세보기 그냥 새창으로") — localhost 합성 데이터, 외부 요청·업무 쓰기 없음 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const FIXTURE=()=>{
 B={deals:[{id:'win-1',site:'새 창 검증 현장',site_id:'site-1',assignee:'이필선',brand:'석민이앤씨',created:CUR_Y+'-09-01',code:'consulting',stage_code:'consulting',stage:'컨설팅 설계',grp:'영업·관리',amt:8000000,address:'서울시 검증로 10',contact:{managerName:'검증 담당자',managerMobile:'01000000000'},activities:[]}],inquiries:[],activities:[]};
 LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
 document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};
};
async function run(){
 const server=http.createServer((req,res)=>{const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404);return res.end()}res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');fs.createReadStream(target).pipe(res)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const base=`http://127.0.0.1:${server.address().port}/crm.html`;
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.waitForFunction(()=>window.DetailWindow&&window.PipelineWorkspace);
  await page.evaluate(FIXTURE);
  /* 자동 검사 브라우저에서는 예전처럼 지금 창에서 연다 */
  assert.equal(await page.evaluate(()=>DetailWindow.allowed()),false,'webdriver keeps in-place detail');
  await page.evaluate(()=>{window.__CRM_FORCE_DETAIL_WINDOW=true;window.__opens=[];window.__fake={location:{href:'about:blank'},focus(){}};window.open=(url,name)=>{__opens.push(name);__fake.location.href='about:blank';return __fake;};PipelineWorkspace.open('all');});
  await page.locator('.ps-kcard').first().click();
  await page.waitForTimeout(50);
  const first=await page.evaluate(()=>({opens:__opens.slice(),href:__fake.location.href,detail:document.getElementById('detailView').classList.contains('on')}));
  assert.deepEqual(first.opens,['crm-deal-'+await page.evaluate(()=>dealKey(B.deals[0]))]);
  assert.match(first.href,/crm\.html\?solo=1&detail=/);assert.doesNotMatch(first.href,/act=/);
  assert.equal(first.detail,false,'list window stays on the list');
  /* 상세를 연 직후의 작업(연락 결과)은 새 창으로 넘어간다 */
  await page.evaluate(()=>{__opens.length=0;drwDeal(JSON.stringify(B.deals[0]));DetailActions.open('activity');});
  await page.waitForTimeout(50);
  assert.match(await page.evaluate(()=>__fake.location.href),/act=da%3Aactivity/);
  assert.equal(await page.locator('#detailAction').count(),0,'no action layer in the list window');
  /* 팝업이 막히면 지금 창에서 — 작업까지 */
  await page.evaluate(()=>{window.open=()=>null;drwDeal(JSON.stringify(B.deals[0]));DetailActions.open('activity');});
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#detailView.detailmodal').isVisible(),true,'blocked popup falls back to the in-page detail window');
  assert.equal(await page.locator('#detailAction').count(),1,'queued action still opens in place');
  await page.evaluate(()=>{DetailActions.close();closeDetail();});
  /* 견적문의 화면에서 문의를 열어도 새 창 — 처리 작업(연락 결과)까지 넘긴다 */
  const inq=await page.evaluate(()=>{
   const q={id:'11111111-2222-4333-8444-555555555555',brand:'POUR솔루션',created_at:'2026-09-10T00:00:00+09:00',valid_inquiry:true,site:'새 창 문의 현장',assignee:'황윤선',status:'배정완료',assigned_at:'2026-09-10T00:30:00+09:00'};
   B.inquiries=[q];G.page='inq';G.inqView='console';delete G._inqRoleApplied;paintInq();
   __opens.length=0;window.open=(url,name)=>{__opens.push(name);__fake.location.href='about:blank';return __fake;};
   InquiryWorkbench.open(inqKey(q),'process');
   return {opens:__opens.slice(),href:__fake.location.href,overlay:!!document.getElementById('inq-inbox-dialog')};
  });
  assert.deepEqual(inq.opens,['crm-inq-11111111-2222-4333-8444-555555555555']);
  assert.match(inq.href,/crm\.html\?solo=1&inquiry=11111111-2222-4333-8444-555555555555&act=inq%3Aprocess/);
  assert.equal(inq.overlay,false,'the inquiry list window keeps the list');

  /* 새 창 쪽: 주소로 요청된 상세가 열리고, 닫기 = 창 닫기(닫히지 않으면 상세만 닫힘) */
  const key=await page.evaluate(()=>dealKey(B.deals[0]));
  const solo=await context.newPage();solo.on('pageerror',e=>errors.push(e.message));
  await solo.goto(base+'?solo=1&detail='+encodeURIComponent(key)+'&act=da:activity');await solo.waitForFunction(()=>window.DetailWindow&&window.DetailWindow.solo);
  await solo.evaluate(FIXTURE);
  await solo.waitForFunction(()=>window.CUR_DETAIL&&document.getElementById('detailView').classList.contains('on'),null,{timeout:5000});
  assert.equal(await solo.locator('#detailView .backbtn').innerText(),'✕ 창 닫기');
  assert.equal(await solo.evaluate(()=>document.documentElement.classList.contains('crm-solo')),true);
  const box=await solo.locator('#detailView').boundingBox();assert.ok(box.x<2&&box.width>=1438,'detail window uses the whole window');
  await solo.waitForFunction(()=>!!document.getElementById('detailAction'),null,{timeout:3000});
  assert.match(await solo.title(),/새 창 검증 현장/);
  await solo.evaluate(()=>DetailActions.close());
  await solo.locator('#detailView .backbtn').click();await solo.waitForTimeout(300);
  assert.equal(await solo.locator('#detailView').isVisible(),false,'close falls back to closing the detail when the window cannot close');
  assert.deepEqual(errors,[]);
  console.log('PASS detail window: list click opens a per-record window, follow-up action carried, popup-blocked fallback in place, solo window full width with close-window button and requested action');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
