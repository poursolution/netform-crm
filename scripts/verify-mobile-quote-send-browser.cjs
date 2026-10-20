'use strict';
/* 모바일 견적 발송 기록 — 후속 = 실제 발송일 + 7일 · 이미 열린 견적 후속이 있으면 새로 만들지 않음(재발송 포함)
   (2026-10-20 design_handoff_mobile_all v4 보완 'I 견적: 1 견적 확인 / 2 실제 발송 따로, 후속 = 실제 발송일 + 7일, 기존 후속이 있으면 새로 만들지 않음')
   합성 영업건 1건(review=contact) · 저장은 합성 큐(운영 저장 차단). */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions()),checks=[];
 async function run(name,follow,body){
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'}),errors=[],writes=[];
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){writes.push(r.request().method());return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/mobile.html?demo=1&review=contact&reset=1',{waitUntil:'domcontentloaded'});await page.locator('.approved-d').waitFor();
   await page.evaluate(follow=>{closeSheet();const d=DEALS[0];d.quote_versions=[{version_no:1,amount:12000000,base_amount:10000000,submit_amount:12000000,reason:'제출금액 확정'}];
    if(follow){const t={id:'aaaaaaaa-0000-4000-8000-000000000001',opportunity_id:d.id,type:'전화',text:'견적 발송 후 확인 연락',due:'2099-01-03',due_at:'2099-01-03',status:'open'};d.openNextActions=[t];d.nextAction=d.nextActionObj=t;}
    G.deal=d.id;G.tab='mine';MobileQuoteLive.reset();MobileQuoteLive.toSend();MobileGuideShell.state.detailView='qlive';render();},follow);
   await page.locator('[data-quote-live] [data-ql="sto"]').waitFor();
   await body(page);
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);checks.push(name);
  }finally{await context.close();}
 }
 const day=(page,n)=>page.evaluate(n=>new Date(Date.now()+9*36e5+n*864e5).toISOString().slice(0,10),n);
 const rows=page=>page.evaluate(()=>structuredClone(__review.rows.map(r=>({operation:r.operation,payload:r.payload}))));
 try{
  await run('후속 없음 = 실제 발송일 + 7일 후속 1건 · 발송일을 바꾸면 따라감',false,async page=>{
   const L=page.locator('[data-quote-live]');
   assert.equal(await L.locator('[data-ql="snext"]').inputValue(),await day(page,7),'기본 = 오늘 + 7일');
   assert.match(await L.innerText(),/다음 확인일 \(실제 발송일 \+ 7일\)/);
   const yday=await day(page,-1);await L.locator('[data-ql="sdate"]').fill(yday);
   assert.equal(await L.locator('[data-ql="snext"]').inputValue(),await day(page,6),'발송일을 바꾸면 + 7일 따라감');
   await L.locator('[data-ql="sto"]').fill('관리소장 합성');await L.locator('[data-ql-act="send"]').click();
   await page.waitForFunction(()=>__review.rows.length>=2);
   const R=await rows(page);assert.deepEqual(R.map(r=>r.operation),['activity','next_action']);assert.match(R[0].payload.note,/발송 · 이메일 · 받는 사람 관리소장 합성 · 발송일 /);
   assert.equal(R[1].payload.due_at,await day(page,6));assert.equal(R[1].payload.text,'견적 발송 후 확인 연락');
  });
  await run('이미 열린 견적 후속 = 새로 만들지 않음(재발송 포함)',true,async page=>{
   const L=page.locator('[data-quote-live]');
   assert.equal(await L.locator('[data-ql="snext"]').count(),0,'다음 확인일 칸 대신 기존 후속 표시');
   assert.match(await L.locator('[data-ql="sfu"]').innerText(),/견적 발송 후 확인 연락 · 2099-01-03[\s\S]*새로 만들지 않습니다/);
   await L.locator('[data-ql="sto"]').fill('관리소장 합성');await L.locator('[data-ql-act="send"]').click();
   await page.waitForFunction(()=>__review.rows.length>=1);await page.waitForTimeout(200);
   const R=await rows(page);assert.deepEqual(R.map(r=>r.operation),['activity'],'발송 기록만 · 후속 중복 없음');
   assert.match(await page.locator('[data-quote-live]').innerText(),/후속은 기존 업무 그대로/);
  });
  await run('일정 화면: 고객 약속(빨강) / 내부 계획 구분 표시',false,async page=>{
   const today=await day(page,0);
   await page.evaluate(today=>{const d=DEALS[0];const mk=(id,text,basis)=>({id,opportunity_id:d.id,type:'방문',text,due:today,due_at:today,scheduled_at:today+'T02:00:00Z',status:'open',date_basis:basis});
    d.openNextActions=[mk('bbbbbbbb-0000-4000-8000-000000000001','고객 약속: 현장 실측','customer_agreed'),mk('bbbbbbbb-0000-4000-8000-000000000002','자료 정리','internal_plan')];d.nextAction=d.nextActionObj=d.openNextActions[0];
    MobileRequests.state().list=[];MobileGuideShell.state.detailView='';MobileGuideShell.state.scheduleDay=today;G.deal=null;G.tab='schedule';render();},today);
   await page.locator('.approved-f').waitFor();
   const rows=await page.evaluate(()=>[...document.querySelectorAll('.approved-f [data-basis]')].map(r=>({basis:r.dataset.basis,text:r.innerText.replace(/\s+/g,' ').trim(),color:getComputedStyle(r.firstElementChild).color})));
   const c=rows.find(r=>r.basis==='customer'),i=rows.find(r=>r.basis==='internal');
   assert.ok(c&&/고객 약속 · 방문 · 현장 실측/.test(c.text),'고객 약속 표시 · 이름 앞 "고객 약속:" 반복 없음: '+JSON.stringify(rows));assert.equal(c.color,'rgb(180, 35, 24)','고객 약속 = 빨강');
   assert.ok(i&&/내부 계획 · 방문 · 자료 정리/.test(i.text),'내부 계획 표시');assert.notEqual(i.color,'rgb(180, 35, 24)');
  });
  console.log(JSON.stringify({status:'PASS',passed:checks.length,checks},null,1));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
