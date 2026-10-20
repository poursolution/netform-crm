'use strict';
/* 예전 모바일 결과 버튼 끊기 (2026-10-20 대표 "진행해")
   예전 3가지(진행됨 · 다음주 다시 · 못 받으심)는 연락 기록 없이 최초 응대 시각만 찍었다(운영 10.10 '다음주 다시').
   확인: 승인 화면에서 예전 입구(문의 첫 연락 화면의 칩 recordInquiryResponse · 오늘 통화 결과 callFlow · pickToday)를 눌러도
         예전 값은 서버 대기열에 안 쌓이고(inquiry_assign response 0건) PC 와 같은 결과 화면(문의 = MobileInquiryEntry · 영업건 = MobileEntry)이 열린다.
   합성 자료 · 외부 연결 차단 · 저장 없음. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[];
 try{
  browser=await chromium.launch(launchOptions());
  const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin?r.continue():r.abort();});
  const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
  await page.evaluate(()=>{
   closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;delete window.__approvedHExample;delete window.__approvedScheduleNow;
   const actor=Phase1.profile.user_id,day=n=>DayZoneRules.kst(Date.now()+n*864e5),iso=new Date().toISOString();
   G.user={...G.user,id:actor};G.mode='rep';G.tab='today';G.deal=null;G.sub=null;G.done={};G.brandF='전체';
   DEALS=[{id:'d1',site_id:'s1',nm:'합성 영업건',code:'consulting',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 소장',manager_mobile:'01000000000',created_at:iso,stageAt:iso,lastAt:iso,contactAt:iso,activities:[],tl:[],nextAction:{id:'d1n',type:'전화',text:'견적 확인',due:day(0),due_at:day(0),status:'open'}}];
   const raw={id:'aaaaaaaa-1111-4111-8111-000000000009',site:'합성 문의',status:'배정완료',at:iso,assignee:G.user.nm,assigned_at:iso,phone:'01000000009'};
   ADMIN.inquiries=[Object.assign(inquiryViewM(raw),{raw,done:true,rep:G.user.nm,status:'배정완료'})];
   Object.assign(MobileRequests.state(),{list:[],loaded:true,busy:false,off:false,at:Date.now()});
   window.__legacy=[];const pw=window.pushWrite;window.pushWrite=function(op,p){if(op==='inquiry_assign'&&p&&p.response)__legacy.push(p.response);return pw.apply(this,arguments);};
   render();
  });
  const key=await page.evaluate(()=>ADMIN.inquiries[0].key);
  /* ① 문의 첫 연락 화면의 예전 칩 */
  await page.evaluate(k=>{recordInquiryResponse(k,'다음주 다시');},key);
  await page.waitForFunction(()=>MobileInquiryEntry.state()!==null);
  assert.deepEqual(await page.evaluate(()=>__legacy),[],'예전 칩: 예전 값 안 보냄');
  await page.evaluate(()=>{MobileInquiryEntry.close&&MobileInquiryEntry.close();closeSheet();G.sub=null;G.deal=null;G.tab='today';render();});
  /* ② 오늘 통화 결과(callFlow · pickToday) — 문의 */
  const qi=await page.evaluate(()=>(G._today||[]).findIndex(t=>t.kind!=='deal'));assert.ok(qi>=0,'오늘 목록에 문의');
  await page.evaluate(i=>{pickToday(i,'다음주 다시');},qi);await page.waitForFunction(()=>MobileInquiryEntry.state()!==null);
  assert.deepEqual(await page.evaluate(()=>__legacy),[],'pickToday 문의: 예전 값 안 보냄');
  await page.evaluate(()=>{MobileInquiryEntry.close&&MobileInquiryEntry.close();closeSheet();G.sub=null;G.deal=null;G.tab='today';render();});
  /* ③ 영업건 */
  const di=await page.evaluate(()=>(G._today||[]).findIndex(t=>t.kind==='deal'));assert.ok(di>=0,'오늘 목록에 영업건');
  const before=await page.evaluate(()=>(DEALS[0].activities||[]).length);
  await page.evaluate(i=>{callFlow(i);},di);await page.waitForFunction(()=>String(G.deal)==='d1');
  assert.equal(await page.evaluate(()=>(DEALS[0].activities||[]).length),before,'영업건: 예전 결과로 기록 안 함 · 결과 화면만 열림');
  assert.equal(await page.locator('#sheetcard .cchip.y').count(),0,'예전 칩 시트 안 뜸');
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',legacy_writes:0}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
