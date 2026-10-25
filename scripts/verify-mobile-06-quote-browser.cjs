'use strict';
/* 모바일 06 견적 진행 표시 (2026-10-25 인계 '파트너스 참고 화면 비교·수정' 06)
   · 요청만 있고 접수 근거 없음 = '견적 요청함 · 견적팀 접수 확인 전'(견적팀 작업 중이라 하지 않음)
   · 고객 약속일(quote_customer_due)과 견적팀 예정일(quote_due)을 따로 적음
   · V1 확정 뒤 V2 도착 = '새 수정본 V2 도착 — 다시 확인할 차례' · V1 제출금액은 이전 수정본 기준이라고 알림
   · 발송 기록 = 확정된 수정본(V1) 금액 · V2 미확정 경고 · '담당자 기록' 표시 · 저장 내용에 V1
   합성 영업건 1건(review=contact) · 저장은 합성 큐(운영 저장 차단). */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions()),checks=[];
 async function run(name,setup,body){
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'}),errors=[],writes=[];
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){writes.push(r.request().method());return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin+'/mobile.html?demo=1&review=contact&reset=1',{waitUntil:'domcontentloaded'});await page.locator('.approved-d').waitFor();
   await page.evaluate(setup);
   await page.locator('[data-quote-live]').waitFor();
   await body(page,page.locator('[data-quote-live]'));
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);checks.push(name);
  }finally{await context.close();}
 }
 const txt=async L=>(await L.innerText()).replace(/\s+/g,' ');
 try{
  await run('요청만 있음 = 접수 확인 전 · 고객 약속 · 견적팀 예정일 따로',()=>{closeSheet();const d=DEALS[0],day=n=>new Date(Date.now()+9*36e5+n*864e5).toISOString().slice(0,10);d.code='consulting';d.quote_versions=[];
   d.stage_contexts={consulting:{fields:{quote_request:'옥상 방수 1,200㎡',quote_due:day(5),quote_customer_due:day(7)}}};G.deal=d.id;G.tab='mine';MobileQuoteLive.reset();MobileGuideShell.state.detailView='qlive';render();},async(page,L)=>{
   const t=await txt(L);
   assert.match(t,/견적 요청함 · 견적팀 접수 확인 전/);assert.doesNotMatch(t,/견적팀 작업 중/,'접수 근거 없이 작업 중이라 하지 않음');
   assert.match(t,/고객 약속 \d{2}\.\d{2} 견적서 전달/);assert.match(t,/견적팀 예정일 \d{2}\.\d{2} · D-5/);
  });
  await run('V1 확정 뒤 V2 도착 = 다시 확인할 차례 · 이전 금액은 이전 수정본 기준',()=>{closeSheet();const d=DEALS[0];d.code='consulting';d.stage_contexts={};
   d.quote_versions=[{version_no:1,amount:300000000,base_amount:250000000,submit_amount:300000000,reason:'제출금액 확정'},{version_no:2,amount:260000000,base_amount:260000000}];
   G.deal=d.id;G.tab='mine';MobileQuoteLive.reset();MobileGuideShell.state.detailView='qlive';render();},async(page,L)=>{
   const t=await txt(L);
   assert.match(t,/새 수정본 V2 도착 — 제출금액을 다시 확인할 차례/);
   assert.match(t,/V1 제출금액 300,000,000원은 이전 수정본 기준입니다/);
   assert.match(t,/V2 적산 기준금액 260,000,000원/);
  });
  await run('발송 기록 = 확정된 V1 금액 · V2 미확정 경고 · 담당자 기록',()=>{closeSheet();const d=DEALS[0];d.code='consulting';d.stage_contexts={};
   d.quote_versions=[{version_no:1,amount:300000000,base_amount:250000000,submit_amount:300000000,reason:'제출금액 확정'},{version_no:2,amount:260000000,base_amount:260000000}];
   G.deal=d.id;G.tab='mine';MobileQuoteLive.reset();MobileQuoteLive.toSend();MobileGuideShell.state.detailView='qlive';render();},async(page,L)=>{
   const t=await txt(L);
   assert.match(t,/V1 제출금액 300,000,000원\(VAT 별도\)/,'확정된 수정본 금액');assert.doesNotMatch(t,/V2 제출금액 260,000,000/,'미확정 V2 금액을 제출금액처럼 적지 않음');
   assert.match(t,/새 수정본 V2은 제출금액이 아직 확정되지 않았습니다/);assert.match(t,/담당자가 남기는 발송 기록입니다/);
   await L.locator('[data-ql="sto"]').fill('관리소장 합성');await L.locator('[data-ql-act="send"]').click();
   await page.waitForFunction(()=>__review.rows.length>0);
   const rows=await page.evaluate(()=>structuredClone(__review.rows.map(r=>({operation:r.operation,payload:r.payload}))));
   assert.match(rows[0].payload.note,/^견적 V1 발송 · .* · 담당자 기록$/,'저장 내용 = V1 · 담당자 기록');
  });
  console.log(JSON.stringify({status:'PASS',checks,writes:0},null,1));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
