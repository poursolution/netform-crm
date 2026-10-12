'use strict';
/* 모바일 단계 변경 — 입력창이 PC와 같은 전환 입력(StageTransitionUI)으로 열리고, 필수 값 검증을 통과해 저장 단계까지 간다.
 * 합성 검토 화면은 서버 쓰기를 막으므로 저장 호출이 '합성 검토 화면에서 지원하지 않는 작업'으로 멈추는 것까지만 확인(서버 수락 · 반영 대기 건수는 운영에서 확인). */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch(launchOptions());
  const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'}),errors=[];
  await ctx.route('**/*',r=>{const q=r.request();return new URL(q.url()).origin===origin&&['GET','HEAD'].includes(q.method())?r.continue():r.abort();});
  const page=await ctx.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
  const info=await page.evaluate(()=>{
   closeSheet();const id='77777777-7777-4777-8777-000000000001',today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
   const actor=Phase1.profile.user_id;G.user={...G.user,id:actor};G.mode='rep';G.deal=id;
   DEALS=[{id,site_id:'77777777-7777-4777-8777-000000001001',nm:'합성 현장 01',code:'bidding',sub:'방수',work_type:'옥상 방수',rep:G.user.nm,owner_id:actor,brand:'석민이앤씨',version:0,amt:100000000,manager_name:'합성 관리소장',manager_mobile:'',address:'합성시 검증로 1',created_at:new Date().toISOString(),stageAt:new Date().toISOString(),lastAt:new Date().toISOString(),contactAt:new Date().toISOString(),activities:[],tl:[],nextAction:{id:'77777777-7777-4777-8777-000000000101',type:'전화',text:'제안서 공유',due:today,due_at:today,status:'open'}}];
   window.toast=()=>{};moveTo(0);return {fields:[...document.querySelectorAll('#sheetcard input,#sheetcard select,#sheetcard textarea')].map(e=>e.id),target:document.getElementById('sf-target')?.value};
  });
  assert(info.fields.includes('sf-contract_amount')&&info.fields.includes('sf-bid_result'),'PC와 같은 계약 전환 입력(낙찰결과 · 계약금액)이 열려야 함: '+info.fields);
  await page.selectOption('#sf-bid_result','낙찰');await page.fill('#sf-contract_amount','100000000');await page.selectOption('#sf-contract_status','체결 예정');
  const day=n=>new Date(Date.now()+9*36e5+n*864e5).toISOString().slice(0,10);
  await page.fill('#sf-contract_date',day(5));await page.selectOption('#sf-contract_document','수령');await page.fill('#sf-memo','낙찰 확인');await page.fill('#sf-next',day(3));
  await page.locator('#sheetcard button',{hasText:'저장'}).first().click();await page.waitForTimeout(800);
  const after=await page.evaluate(()=>({code:DEALS[0].code,q:Phase1.queue.list().map(x=>x.operation),err:document.getElementById('sf-error')?.innerText||''}));
  assert.equal(after.err,'','입력 검증 오류 없음');assert.equal(after.code,'contract','화면 단계가 계약으로 바뀜');
  assert.deepEqual(errors,['합성 검토 화면에서 지원하지 않는 작업입니다. 운영 저장은 차단되어 있습니다.'],'저장 호출까지 갔고, 막힌 이유는 합성 검토 화면의 쓰기 차단뿐이어야 함: '+errors);
  console.log('mobile stage change ok');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});