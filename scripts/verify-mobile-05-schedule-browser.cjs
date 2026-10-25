'use strict';
/* 모바일 05 일정 (2026-10-23 인계 '파트너스 참고 화면 비교·수정' 05)
   · 일정 화면 맨 아래 4탭(다른 화면으로 돌아가는 길) · 머리는 버튼 아님
   · [다음 주 ›] = 고른 날짜 +7일 → 다음 주 같은 요일 일정이 보임 · [이번 주] = 오늘 · [‹] = -7일
   · 일정 줄 → 원래 영업건 상세 → 뒤로 = 일정(고른 날짜 그대로)
   · 시각 없는 날짜 기한은 시각을 만들지 않음('미확인')
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
  const days=await page.evaluate(()=>{
   closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;delete window.__approvedHExample;delete window.__approvedScheduleNow;
   const day=n=>DayZoneRules.kst(Date.now()+n*864e5),actor=Phase1.profile.user_id;
   G.user={...G.user,id:actor};G.mode='rep';G.tab='schedule';G.deal=null;G.sub=null;G.done={};G.brandF='전체';
   Object.assign(MobileGuideShell.state,{q:'',stage:'',openOnly:false,page:1,scroll:0,scheduleDay:'',schedulePage:1,detailView:''});
   const mk=(id,nm,due,text,type,at)=>({id,site_id:id+'s',nm,code:'consulting',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 소장',manager_role:'관리소장',manager_mobile:'01000000000',created_at:new Date().toISOString(),activities:[],tl:[],
    nextAction:{id:'aaaaaaaa-0000-4000-8000-'+id.padStart(12,'0'),type,text,due:day(due),due_at:at||day(due),scheduled_at:at,status:'open'}});
   DEALS=[mk('1','합성 오늘 통화',0,'통화','전화'),mk('2','합성 다음 주 방문',7,'현장 방문','방문',new Date(Date.parse(day(7)+'T10:30:00+09:00')).toISOString())];
   render();return {today:day(0),next:day(7)};
  });
  await page.locator('.approved-f').waitFor();
  const tabs=await page.locator('.approved-f .gs-tabnav [data-gs="tab"]').allInnerTexts();
  assert.deepEqual(tabs,['오늘','내 현장','기록 · 등록','일정'],'일정 화면 맨 아래 4탭');
  assert.equal(await page.locator('.approved-f .gs-tabnav .on').innerText(),'일정');
  assert.equal(await page.locator('.approved-f > div').first().getAttribute('role'),null,'머리는 버튼 아님');
  assert.match(await page.locator('.approved-f').innerText(),/합성 오늘 통화/);
  assert.doesNotMatch(await page.locator('.approved-f').innerText(),/합성 다음 주 방문/,'이번 주 오늘에는 다음 주 일정 없음');
  assert.match((await page.locator('.approved-f [data-task-id]').first().innerText()).replace(/\s+/g,' '),/^미확인/,'날짜만 있는 기한 = 시각 만들지 않음');
  /* 다음 주 → +7일(같은 요일) · 그날 방문 10:30 */
  await page.locator('[data-gs="schedule-week"][data-step="1"]').click();await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>MobileGuideShell.state.scheduleDay),days.next);
  const row=page.locator('.approved-f [data-task-id]').first();
  assert.match((await row.innerText()).replace(/\s+/g,' '),/^10:30 합성 다음 주 방문/);
  assert.equal(await page.locator('[data-gs="schedule-week"][data-step="0"]').getAttribute('aria-current'),null,'다음 주에서는 [이번 주]가 눌러짐');
  /* 2026-10-25 운영 확인: 다른 주로 넘기면 이름도 그 주(숫자는 고른 주 기준) · 가운데 = [이번 주로] */
  {const t=await page.locator('.approved-f').innerText();assert.match(t,/내 다음 주 · /);assert.match(t,/다음 주 연락/);assert.doesNotMatch(t,/내 이번 주|이번 주 연락/);
   assert.equal((await page.locator('[data-gs="schedule-week"][data-step="0"]').innerText()).trim(),'이번 주로');}
  /* 일정 줄 → 원래 영업건 상세 → 뒤로 = 같은 날짜 일정 */
  await row.click();await page.locator('.approved-c').waitFor();
  assert.equal(await page.evaluate(()=>String(G.deal)),'2');
  await page.evaluate(()=>{closeSheet&&closeSheet();});
  await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-f').waitFor();
  assert.equal(await page.evaluate(()=>MobileGuideShell.state.scheduleDay),days.next,'돌아와도 고른 날짜 그대로');
  /* 지난주 · 이번 주 */
  await page.locator('[data-gs="schedule-week"][data-step="-1"]').click();await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>MobileGuideShell.state.scheduleDay),days.today);
  await page.locator('[data-gs="schedule-week"][data-step="1"]').click();await page.locator('[data-gs="schedule-week"][data-step="0"]').click();await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>MobileGuideShell.state.scheduleDay),'','[이번 주] = 오늘로');
  {const t=await page.locator('.approved-f').innerText();assert.match(t,/내 이번 주 · /);assert.match(t,/이번 주 연락/);}
  /* 탭 바로 다른 화면 */
  await page.locator('.approved-f .gs-tabnav [data-tab="mine"]').click();await page.locator('.approved-b').waitFor();
  assert.equal(await page.evaluate(()=>G.tab),'mine');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'가로 넘침 없음');
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',tabbar:true,weekNav:true,returnDay:true,noFakeTime:true,writes:0}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
