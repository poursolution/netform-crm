'use strict';
/* 모바일 문의 응대 결과 — PC 와 같은 값 · 같은 저장 (2026-10-10 대표 승인 · mobile_all) — 합성 자료. 서버 함수(crm_inquiry_command_v1)는 가짜 응답.
   확인: 연락 결과 PC 값 5가지 / 부재 · 번호 오류 = 연락 시도(상담 내용 없음 · 단계 그대로) / 연결됨 · 회신 받음 = 실제 연결(첫 접촉이면 단계 진행)
         / 저장 순서 = 서버 응대 기록 확인 → 단계 진행 → 다음 행동일(inquiry_next_set) / 서버가 거절하면 아무것도 안 보냄 / 배드핏 = 종결 + 사유 필수 / 끄기 스위치 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'')||'mobile.html',t=path.resolve(root,rel);if(!t.startsWith(root+path.sep)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',t.endsWith('.html')?'text/html; charset=utf-8':t.endsWith('.css')?'text/css':'application/javascript; charset=utf-8');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
const QID='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ContactEntry&&window.MobileInquiry&&typeof render==='function'&&window.OperationalUI&&typeof queueInquiryNextSet==='function');
  const setup=(o)=>page.evaluate(o=>{
   const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.__kst=kst;
   G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;window.toast=()=>{};
   ADMIN.inquiries=[{key:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',id:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',nm:'[테스트] 문의 현장',rep:G.user.nm,status:o.status||'배정완료',phone:'01011112222',gj:'옥상방수',body:'옥상 누수',at:new Date().toISOString(),raw:{status:o.status||'배정완료'}}];
   DEALS=[];G._today=[{kind:'inquiry',ref:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',nm:'[테스트] 문의 현장'}];G.done={};G.deal=null;G.tab='today';G.sub={t:'inqAssigned',key:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'};
   window.__rpc=[];window.__w=[];window.__fail=!!o.fail;
   window.pushWrite=(op,p)=>{__w.push([op,p]);return 'req-'+__w.length;};
   const real=window.__realPhase1||(window.__realPhase1=window.Phase1);
   window.Phase1=Object.assign({},real,{profile:Object.assign({},real.profile||{},{name:'테스트',allowed_modes:['rep']}),rpc:async(name,args)=>{__rpc.push([name,args.p]);if(__fail)throw Error('서버가 거절했습니다');return {ok:true,status:args.p.type==='close'?'배드핏':undefined};}});
   render();},o);
  await setup({});await page.waitForTimeout(300);
  const S=page.locator('#scr'),C=page.locator('#sheetcard'),txt=async s=>one(await C.locator(s).first().innerText());
  /* ① 문의 상세: 예전 결과 3칩 대신 [연락 결과 남기기] */
  assert.equal(await S.locator('.mi-open').count(),1);assert.equal(await S.locator('button[onclick*="recordInquiryResponse"]').count(),0,'예전 결과 3가지는 가린다');
  await S.locator('.mi-open').click();await page.waitForTimeout(300);
  assert.deepEqual(await C.locator('.ce-chips').first().locator('.ce-chip').allInnerTexts(),['연결됨','회신 받음','부재','번호 오류','배드핏'],'PC 연락 결과 값');
  /* ② 연결됨(첫 접촉): 상담 내용 필수 · 서버 기록 → 단계 진행 → 다음 행동일 */
  await C.locator('.ce-chip',{hasText:/^연결됨$/}).click();await page.waitForTimeout(100);
  assert.match(await txt('.ce-prev'),/상담 내용을 한 줄 적어 주세요/);
  await C.locator('textarea[data-ce-in="memo"],textarea[data-mi-in="memo"]').fill('금요일까지 견적서 보내 달라고 함');await C.locator('input[data-mi-in="purpose"]').fill('견적 준비');await C.locator('.ce-date',{hasText:'3일 후'}).click();await page.waitForTimeout(100);
  assert.match(await txt('.ce-prev'),/ · 서버 확인 · 견적 준비 일정 1건 등록 · \d+\.\d+ \(.\) · 첫 통화 완료로 단계 진행$/);
  await C.locator('.ce-save').click();await page.waitForTimeout(600);
  const d3=await page.evaluate(()=>__kst(3));
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>[r[0],r[1].type,r[1].inquiry_id,r[1].channel,r[1].result,r[1].contact_result,r[1].content,r[1].next_action,r[1].next_check_date])),[['crm_inquiry_command_v1','contact_log',QID,'전화','연결됨','연결됨','금요일까지 견적서 보내 달라고 함','견적 준비',d3]],'서버 응대 기록(PC 와 같은 명령)');
  assert.deepEqual(await page.evaluate(()=>__w.map(w=>[w[0],w[1].response||w[1].intent,w[1].status||w[1].text,w[1].due_at||''])),[['inquiry_assign','진행됨 — 다음 잡음','전화응대 완료',''],['next_action','inquiry_next_set','견적 준비',d3]],'단계 진행 → 다음 행동일');
  assert.deepEqual(await C.locator('.ce-done li em').allInnerTexts(),['저장','신규']);
  /* ③ 부재: 연락 시도 · 단계 그대로 */
  await setup({});await page.waitForTimeout(250);await page.evaluate(()=>MobileInquiry.open(ADMIN.inquiries[0],null));await page.waitForTimeout(250);
  await C.locator('.ce-chip',{hasText:/^부재$/}).click();await page.waitForTimeout(100);
  assert.equal(await C.locator('textarea').count(),0,'부재 = 상담 내용 칸 없음');
  await C.locator('.ce-save').click();await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>[r[1].result,r[1].content,r[1].next_action])),[['부재','','다시 전화']]);
  assert.deepEqual(await page.evaluate(()=>__w.map(w=>w[0])),['next_action'],'시도는 단계를 올리지 않는다(다음 행동일만)');
  /* ④ 번호 오류 → 서버 값 '번호오류' */
  await setup({});await page.waitForTimeout(250);await page.evaluate(()=>MobileInquiry.open(ADMIN.inquiries[0],null));await page.waitForTimeout(250);
  await C.locator('.ce-chip',{hasText:/^번호 오류$/}).click();await C.locator('.ce-save').click();await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>[r[1].result,r[1].next_action])),[['번호오류','연락처 확인']]);
  /* ⑤ 서버가 거절하면 아무것도 안 보낸다 */
  await setup({fail:true});await page.waitForTimeout(250);await page.evaluate(()=>MobileInquiry.open(ADMIN.inquiries[0],null));await page.waitForTimeout(250);
  await C.locator('.ce-chip',{hasText:/^부재$/}).click();await C.locator('.ce-save').click();await page.waitForTimeout(600);
  assert.match(await txt('.ce-err'),/서버가 거절했습니다/);assert.equal(await page.evaluate(()=>__w.length),0,'서버 확인 전에는 단계 · 다음 행동을 보내지 않는다');
  assert.equal(await page.evaluate(()=>ADMIN.inquiries[0].status),'배정완료');
  /* ⑥ 배드핏: 사유 필수 · 종결 · 다음 할 일 없음 */
  await setup({});await page.waitForTimeout(250);await page.evaluate(()=>MobileInquiry.open(ADMIN.inquiries[0],null));await page.waitForTimeout(250);
  await C.locator('.ce-chip',{hasText:/^배드핏$/}).click();await page.waitForTimeout(100);
  assert.match(await txt('.ce-prev'),/종결 사유를 골라 주세요/);assert.deepEqual(await C.locator('[data-mi="reason"]').allInnerTexts(),['수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타']);
  await C.locator('[data-mi="reason"]',{hasText:'기타'}).click();assert.match(await txt('.ce-prev'),/기타 사유는 상담 내용에 적어 주세요/);
  await C.locator('textarea[data-mi-in="memo"]').fill('자체 보수 완료');await C.locator('[data-mi="reason"]',{hasText:'규모 부적합'}).click();await C.locator('.ce-save').click();await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>[r[1].type,r[1].kind,r[1].reason,r[1].detail])),[['close','bad_fit','규모 부적합','자체 보수 완료']]);
  assert.equal(await page.evaluate(()=>__w.length),0,'종결은 다음 할 일을 만들지 않는다');assert.equal(await page.evaluate(()=>ADMIN.inquiries[0].status),'배드핏');
  /* ⑦ 오늘 업무의 문의 통화 결과도 같은 창 */
  await setup({});await page.waitForTimeout(250);await page.evaluate(()=>{G.sub=null;render();G._today=[{kind:'inquiry',ref:'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',nm:'[테스트] 문의 현장'}];callFlow(0);});await page.waitForTimeout(300);
  assert.deepEqual(await C.locator('.ce-chips').first().locator('.ce-chip').allInnerTexts(),['연결됨','회신 받음','부재','번호 오류','배드핏']);
  /* ⑧ 끄기 */
  await setup({});await page.evaluate(()=>{G.mobileInqOff=true;render();});await page.waitForTimeout(250);
  assert.equal(await S.locator('.mi-open').count(),0);assert.ok(await S.locator('button[onclick*="recordInquiryResponse"]').count()>=3,'끄면 예전 결과 3가지');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('verify-mobile-inquiry: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
