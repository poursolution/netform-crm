'use strict';
/* 통화 녹음 → 응대 기록 · 모바일 (2026-10-20 design_handoff_six_fixes ⑥) — PC 와 같은 창(CallSummary) · 넣는 곳만 모바일 상담 내용 칸(300자)
   확인: 연락 결과 입력(D) 상담 내용 칸 아래 [통화 녹음 요약] · 요약 → [응대 기록 입력칸에 넣기] = 상담 내용 칸에 글만(저장 · 업무 완료 없음) · 전사 원문 = 내부 메모 1건(standalone)
   합성 자료 · 외부 연결 차단 */
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
  await page.waitForFunction(()=>window.CallSummary&&window.MobileEntry);
  await page.evaluate(()=>{
   closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;delete window.__approvedHExample;delete window.__approvedScheduleNow;
   const actor=Phase1.profile.user_id,id='77777777-7777-4777-8777-000000000001';G.user={...G.user,id:actor};G.mode='rep';G.tab='mine';G.sub=null;
   DEALS=[{id,site_id:id+'s',nm:'합성 녹음 현장',code:'consulting',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 관리소장',manager_mobile:'',created_at:new Date().toISOString(),stageAt:new Date().toISOString(),lastAt:new Date().toISOString(),contactAt:new Date().toISOString(),activities:[],tl:[],nextAction:{id:id+'n',type:'전화',text:'견적 범위 확인',due:'2099-01-01',due_at:'2099-01-01',status:'open'}}];
   ADMIN.inquiries=[];Object.assign(MobileRequests.state(),{list:[],loaded:true,busy:false,off:false,at:Date.now()});
   window.__ops=[];window.queueMobileContactOperation=(op,p)=>{__ops.push([op,p]);return 'req'+__ops.length;};
   G.deal=id;render();MobileEntry.open();
  });
  const b=page.locator('.cs-open.cs-m');await b.waitFor();assert.equal((await b.innerText()).trim(),'통화 녹음 요약','상담 내용 칸 아래 단추');
  await b.click();const box=page.locator('#cs-root .cs-box');await box.waitFor();
  const TEXT='고객: 개략 금액이랑 공법 비교 한 장 주세요.\n담당: 금요일까지 견적 보내드리겠습니다.';
  /* 2026-10-25 인계 07: 파일을 고르면(자동 변환 연결 전) '연결 전 · 파일은 올리지 않음' — 글이 저절로 생긴 것처럼 보이지 않게 */
  await box.locator('[data-cs="file"]').setInputFiles({name:'통화_합성.m4a',mimeType:'audio/mp4',buffer:Buffer.from('x')});await page.waitForTimeout(100);
  assert.match(await box.locator('.cs-file small').innerText(),/통화_합성\.m4a · 자동 변환 연결 전 — 파일은 올리지 않습니다/);
  assert.equal(await box.locator('[data-cs="text"]').inputValue(),'','자동 변환 연결 전 = 글 없음');
  await box.locator('[data-cs="text"]').fill(TEXT);await page.waitForTimeout(50);
  assert.match(await box.locator('.cs-tr span').innerText(),/붙여 넣은 글/,'글 출처 = 붙여 넣은 글');
  /* 닫았다 다시 열면 쓰던 글이 남아 있음(저장 아님) */
  await box.locator('.cs-x').click();await page.waitForTimeout(50);assert.equal(await page.locator('#cs-root .cs-box').count(),0);
  await b.click();await box.waitFor();assert.equal(await box.locator('[data-cs="text"]').inputValue(),TEXT,'닫아도 쓰던 글 보존');assert.match(await box.innerText(),/닫기 전에 쓰던 글을 다시 불러왔습니다/);
  await box.locator('[data-cs="sum"]').click();await page.waitForTimeout(150);
  assert.match(await box.locator('.cs-note').innerText(),/날짜는 고객 약속으로 저장되지 않습니다/);
  await box.locator('[data-cs="apply"]').click();await page.waitForTimeout(400);
  const memo=await page.locator('textarea[data-ce-in="memo"]').inputValue();
  assert.match(memo,/^\[통화 녹음 요약 · 붙여 넣은 글\]\n고객 요청: 개략 금액이랑 공법 비교/,'상담 내용 칸에 요약 · 출처: '+memo);assert.ok(memo.length<=300,'모바일 칸 300자 안');
  const ops=await page.evaluate(()=>__ops);
  assert.equal(ops.length,1,'원문 내부 메모 1건만(연락 결과 · 업무는 안 만듦)');assert.equal(ops[0][0],'activity');assert.equal(ops[0][1].intent,'standalone');assert.equal(ops[0][1].type,'메모');assert.match(ops[0][1].note,/^\[통화 글 · 붙여 넣음 · 통화_합성\.m4a\] 고객: 개략 금액/,'붙여 넣은 글을 자동 전사라고 쓰지 않음');
  /* 넣은 뒤에는 보관하던 글을 지움 */
  await b.click();await box.waitFor();assert.equal(await box.locator('[data-cs="text"]').inputValue(),'','넣은 뒤 다시 열면 빈 칸');await box.locator('.cs-x').click();
  /* 자동 변환이 연결되면(합성 transcribe) 글 출처 = 자동 변환 · 원문 메모 = [통화 전사 · 파일] */
  await page.evaluate(()=>{__ops.length=0;CallSummary.transcribe=async()=>'고객: 도면 보내 주세요.\n담당: 내일 보내드리겠습니다.';document.querySelector('textarea[data-ce-in="memo"]').value='';});
  await b.click();await box.waitFor();
  await box.locator('[data-cs="file"]').setInputFiles({name:'통화_자동.m4a',mimeType:'audio/mp4',buffer:Buffer.from('x')});await page.waitForFunction(()=>/자동 변환된 글/.test(document.querySelector('#cs-root .cs-tr span')?.innerText||''));
  await box.locator('[data-cs="apply"]').click();await page.waitForTimeout(400);
  assert.match(await page.locator('textarea[data-ce-in="memo"]').inputValue(),/^\[통화 녹음 요약 · 자동 변환\]/);
  assert.match((await page.evaluate(()=>__ops))[0][1].note,/^\[통화 전사 · 통화_자동\.m4a\] 고객: 도면/);
  await page.evaluate(()=>{CallSummary.transcribe=null;});
  assert.equal(await page.evaluate(()=>DEALS[0].nextAction.status),'open','기존 업무 그대로');
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',mobile_button:true,memo_filled:true,transcript_memo_only:true}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
