'use strict';
/* 모바일 v5 전화 후 결과 화면 (2026-10-20 design_handoff_mobile_all '모바일 v5 · 세 작업 바로 하기' 작업 1 · 2 + v5 보완)
   합성 영업건 1건 + 첫 연락 요청 1건(review=contact) · 서버 응답은 합성 ACK · 운영 저장 차단.
   · 연결됨: '확인할 것' 체크 0/2 → 1/2(요청 일부 확인 · 진행 중) → 2/2(요청 완료) · 체크한 것은 상담 내용 한 줄로 저장
   · 일부만 확인하고 저장 = 연락 기록만 · 요청은 그대로(자동 완료 없음)
   · 부재: 상담 칸 · 다음 업무 대신 '다시 연락' 칩 · 요청은 열린 채 그대로(연결 필요) · 기록에 '다시 연락 내일 오전'
   · 새 업무: '가능한 시간 · 확정 전' / '확정 · 고객 약속'
   · 끄기(G.mobileV5Off) = 예전 D(요청 체크 상자) · 320 · 375 폭 가로 넘침 없음 */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const path=require('node:path');
const SHOT=process.env.SHOT_DIR||'';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions()),checks=[];
 async function run(name,body,width=375){
  const context=await browser.newContext({viewport:{width,height:812},timezoneId:'Asia/Seoul'}),errors=[],writes=[];
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){writes.push(r.request().method());return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const view=page.locator('.approved-d');
  const read=()=>page.evaluate(()=>structuredClone({rows:__review.rows,replies:__review.replies,request:__review.request,deal:DEALS[0],state:MobileEntry.state()}));
  const prev=()=>view.locator('.ce-prev').innerText();
  const save=()=>view.locator('[data-ce="save"]').click(),success=()=>page.waitForFunction(()=>MobileEntry.state()===null&&document.querySelector('.approved-d [data-ce="save"]')?.textContent==='저장됨');
  try{
   await page.goto(origin+'/mobile.html?demo=1&review=contact&reset=1',{waitUntil:'domcontentloaded'});await view.waitFor();
   await body({page,view,read,prev,save,success});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+'px 가로 넘침 없음');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);checks.push(name);
  }finally{await context.close();}
 }
 try{
  await run('연결됨 · 확인할 것 전부 체크 = 첫 연락 요청 완료 · 체크한 것은 상담 내용에',async({page,view,read,prev,save,success})=>{
   assert.equal(await view.locator('.cd-request').isHidden(),true,'예전 요청 체크 상자는 숨김');
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();
   assert.equal(await view.locator('.v5r-ck').count(),2);
   assert.deepEqual(await view.locator('.v5r-ck span').allInnerTexts(),['견적 요청 범위','방문이 필요한지'],'첫 연락 요청 = 견적문의 기준 항목');
   assert.match(await view.locator('.v5r-ck-h').innerText(),/확인할 것 · 이 단계 기준\s*0 \/ 2 확인/);
   await view.locator('.v5r-ck').nth(0).click();
   assert.match(await view.locator('.v5r-ck-h').innerText(),/1 \/ 2 확인/);
   assert.match(await prev(),/^저장하면: 응대 기록 1 · 첫 연락 요청 일부 확인 1 \/ 2 · 요청은 진행 중/,'일부 확인 미리보기');
   await view.locator('.v5r-ck').nth(1).click();
   const p=await prev();assert.match(p,/^저장하면: 응대 기록 1 · 첫 연락 요청 완료 · 남는 일 · 회의 결과 확인/,'전부 확인 = 요청 완료: '+p);
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-result-connected.png')});
   await save();await success();const a=await read();
   assert.equal(a.request.status,'done','요청 완료(서버 확인)');assert.equal(a.replies.length,1);assert.equal(a.replies[0].action,'done');
   assert.match(a.rows[0].payload.note,/\[확인\] 견적 요청 범위 · 방문이 필요한지/,'체크한 것 = 기록 글');
  });
  await run('일부만 확인하고 저장 = 연락 기록 · 요청은 그대로',async({view,read,save,success})=>{
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();await view.locator('.v5r-ck').nth(0).click();
   await save();await success();const a=await read();
   assert.deepEqual(a.replies,[],'요청 자동 완료 없음');assert.equal(a.request.status,'sent');
   assert.match(a.rows[0].payload.note,/\[확인\] 견적 요청 범위 \/ \[아직\] 방문이 필요한지/);
  });
  await run('부재 · 다시 연락 칩 · 요청 그대로',async({page,view,read,prev,save,success})=>{
   await view.locator('[data-ce="res"][data-v="부재"]').click();
   assert.equal(await view.locator('.cd-note').isHidden(),true,'상담 칸 없음');assert.equal(await view.locator('.cd-next-section').isHidden(),true,'다음 업무 대신 다시 연락');
   assert.equal(await view.locator('.v5r-ck').count(),0);
   assert.deepEqual(await view.locator('.v5r-retry .v5r-chip').allInnerTexts(),['2시간 후','내일 오전','날짜 고르기']);
   await view.locator('.v5r-chip[data-v="am"]').click();
   const p=await prev();assert.match(p,/^저장하면: 연락 시도 1 · 첫 연락 요청 그대로 \(연결 필요\)/,p);assert.match(p,/다시 연락 내일 오전/);
   assert.match(await view.locator('.v5r-retry small').innerText(),/기존 업무 "회의 결과 확인" .+ 그대로 · 새 업무 아님/,'서버가 앞당기기를 받지 않으면 기존 업무 그대로 · 시각은 기록 글에');
   await page.waitForTimeout(100);assert.equal(await view.locator('.cs-open.cs-m').count(),0,'부재면 녹음 요약 버튼 없음');
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-result-absent.png')});
   await save();await success();const a=await read();
   assert.deepEqual(a.replies,[],'연락 시도는 요청 상태를 바꾸지 않음');assert.equal(a.request.status,'sent');assert.match(a.rows[0].payload.note,/다시 연락 내일 오전/);
   assert.deepEqual(a.rows.map(r=>r.operation),['activity'],'새 업무 안 만듦');
  });
  await run('새 업무 · 가능한 시간(확정 전) / 확정(고객 약속)',async({page,view,prev})=>{
   await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());DEALS[0].nextAction=null;DEALS[0].nextActionObj=null;MobileEntry.open();});await view.waitFor();
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();await view.locator('.v5r-ck').nth(0).click();
   await view.locator('[data-ce="mode"][data-v="new"]').click();await view.locator('[data-ce-in="purpose"]').fill('현장 방문');
   assert.deepEqual(await view.locator('.v5r-plan .v5r-chip').allInnerTexts(),['가능한 시간 · 확정 전','확정 · 고객 약속']);
   assert.equal(await view.locator('.ce-agree').count(),0);
   assert.match(await prev(),/현장 방문 .* · 확정 전/);
   await view.locator('.v5r-chip[data-v="customer"]').click();
   assert.match(await prev(),/현장 방문 .* · 고객 약속/);
  },320);
  await run('끄기 = 예전 D',async({page,view})=>{
   await page.evaluate(()=>{G.mobileV5Off=true;closeSheet();MobileEntry.open();});await view.waitFor();
   assert.equal(await view.locator('.v5r-ck,.v5r-retry').count(),0);assert.equal(await view.locator('[data-ce-in="req"]').count(),1);
  });
  console.log(JSON.stringify({status:'PASS',passed:checks.length,checks},null,1));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
