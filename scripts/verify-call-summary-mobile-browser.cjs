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
  await box.locator('[data-cs="text"]').fill('고객: 개략 금액이랑 공법 비교 한 장 주세요.\n담당: 금요일까지 견적 보내드리겠습니다.');
  await box.locator('[data-cs="sum"]').click();await page.waitForTimeout(150);
  await box.locator('[data-cs="apply"]').click();await page.waitForTimeout(400);
  const memo=await page.locator('textarea[data-ce-in="memo"]').inputValue();
  assert.match(memo,/^고객 요청: 개략 금액이랑 공법 비교/,'상담 내용 칸에 요약: '+memo);assert.ok(memo.length<=300,'모바일 칸 300자 안');
  const ops=await page.evaluate(()=>__ops);
  assert.equal(ops.length,1,'전사 원문 내부 메모 1건만(연락 결과 · 업무는 안 만듦)');assert.equal(ops[0][0],'activity');assert.equal(ops[0][1].intent,'standalone');assert.equal(ops[0][1].type,'메모');assert.match(ops[0][1].note,/^\[통화 전사\] 고객: 개략 금액/);
  assert.equal(await page.evaluate(()=>DEALS[0].nextAction.status),'open','기존 업무 그대로');
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',mobile_button:true,memo_filled:true,transcript_memo_only:true}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
