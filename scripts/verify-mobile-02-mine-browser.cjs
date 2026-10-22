'use strict';
/* 모바일 02 내 현장 (2026-10-23 인계 '파트너스 참고 화면 비교·수정' 02)
   합성 영업건 25건(같은 단지 2건 · 수주 1 · 실주 1)으로:
   · 같은 단지 영업건은 합치지 않고 각 줄에 '같은 단지 n건'
   · 한 쪽 20건 → 2쪽 · 2쪽에서 상세 열고 뒤로 = 같은 쪽 · 같은 조건 · 검색하면 1쪽
   · 빈 목록 이유 구분(검색 결과 없음 · 그 단계 없음 · 조회 실패 · 불러오는 중)
   · 수주 건 오른쪽 = '수주'(사유 미입력 경고 없음)
   합성 자료(현장 · 이름은 지어낸 것) · 외부 연결 차단 · 저장 없음. */
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
   const day=n=>DayZoneRules.kst(Date.now()+n*864e5),actor=Phase1.profile.user_id;
   G.user={...G.user,id:actor};G.mode='rep';G.tab='mine';G.deal=null;G.sub=null;G.done={};G.brandF='전체';
   Object.assign(MobileGuideShell.state,{q:'',stage:'',openOnly:false,page:1,scroll:0,area:'now',detailView:''});
   const mk=(i,extra)=>Object.assign({id:'m'+String(i).padStart(2,'0'),site_id:'s'+i,nm:'합성 현장 '+String(i).padStart(2,'0'),code:'consulting',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,
    manager_name:'합성 소장',manager_role:'관리소장',manager_mobile:'01000000000',created_at:new Date().toISOString(),activities:[],tl:[],
    nextAction:{id:'n'+i,type:'전화',text:'연락',due:day(i%5),due_at:day(i%5),status:'open'}},extra||{});
   DEALS=[];for(let i=1;i<=23;i++)DEALS.push(mk(i));
   DEALS[1].site_id='s1';DEALS[1].nm='합성 현장 01';DEALS[1].sub='도장';DEALS[1].construction_year='2027';/* 같은 단지 · 같은 이름 · 다른 공사 */
   DEALS.push(mk(24,{code:'won',outcome:'won',nextAction:null,won_at:'2026-10-10'}));
   DEALS.push(mk(25,{code:'lost',outcome:'lost',nextAction:null,close_reason:'예산 미확보',closed_at:'2026-10-11'}));
   render();
  });
  await page.locator('.approved-b .approved-row').first().waitFor();
  const rows=()=>page.evaluate(()=>[...document.querySelectorAll('.approved-row')].map(r=>({id:r.dataset.id,t:r.innerText.replace(/\s+/g,' ').trim()})));
  /* 같은 단지 2건 = 각각 따로 · '같은 단지 2건' */
  let R=await rows();
  const s1=R.filter(r=>/합성 현장 01/.test(r.t));
  assert.equal(s1.length,2,'같은 이름 · 같은 단지라도 영업건 2건 각각: '+JSON.stringify(s1));
  assert.ok(s1.every(r=>/같은 단지 2건/.test(r.t)),'두 줄 모두 같은 단지 표시');
  assert.ok(!R.some(r=>/합성 현장 03/.test(r.t)&&/같은 단지/.test(r.t)),'혼자인 단지에는 표시 없음');
  /* 한 쪽 20건 · 2쪽 → 상세 → 뒤로 = 2쪽 그대로 */
  assert.equal(R.length,20,'한 쪽 20건');
  await page.locator('nav.lpg .lpg-b[data-page="2"]:not(.lpg-arrow)').click();await page.waitForTimeout(100);
  R=await rows();assert.ok(R.length>0&&R.length<=20);const target=R[0].id;
  await page.locator('.approved-row[data-id="'+target+'"]').click();await page.locator('.approved-c').waitFor();
  await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-b').waitFor();
  assert.equal(await page.locator('nav.lpg .lpg-b.on').innerText(),'2','상세 다녀와도 2쪽');
  assert.equal((await rows())[0].id,target,'같은 줄이 보임');
  /* 검색 = 1쪽 · 결과 없음 문구 */
  await page.locator('[data-gs-query]').fill('없는현장');await page.waitForTimeout(100);
  assert.equal(await page.locator('.approved-row').count(),0);
  assert.equal(await page.locator('.approved-list .approved-empty').first().innerText(),'\'없는현장\' 검색 결과가 없습니다.');
  await page.locator('[data-gs-query]').fill('');await page.waitForTimeout(100);
  assert.equal(await page.locator('nav.lpg .lpg-b.on').innerText(),'1','검색을 바꾸면 1쪽');
  /* 단계 0건 · 수주 칸 */
  await page.locator('[data-gs="stage"][data-value="construction"]').click();await page.waitForTimeout(100);
  assert.equal(await page.locator('.approved-list .approved-empty').first().innerText(),'계약·시공 영업건이 없습니다.');
  await page.locator('[data-gs="stage"][data-value="won"]').click();await page.waitForTimeout(100);
  const won=await rows();assert.equal(won.length,1);assert.match(won[0].t,/수주/);assert.doesNotMatch(won[0].t,/사유 미입력/,'수주 건에 사유 미입력 경고 없음');
  await page.locator('[data-gs="stage"][data-value="lost"]').click();await page.waitForTimeout(100);
  assert.match((await rows())[0].t,/예산 미확보/,'실주는 사유 그대로');
  /* 조회 실패 · 불러오는 중 */
  const empties=await page.evaluate(()=>{const out={};const S=MobileGuideShell.state;S.stage='construction';
   window.LAST_OPERATIONAL_READ_ERROR=[{domain:'deal_core',message:'x'}];render();out.fail=document.querySelector('.approved-list .approved-empty')?.innerText;
   window.LAST_OPERATIONAL_READ_ERROR=null;window.MOBILE_TODAY_FIRST=true;render();out.loading=document.querySelector('.approved-list .approved-empty')?.innerText;
   window.MOBILE_TODAY_FIRST=false;S.stage='';render();return out;});
  assert.equal(empties.fail,'영업건을 불러오지 못했습니다. 새로고침해 주세요.');
  assert.equal(empties.loading,'전체 목록을 불러오는 중입니다.');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'가로 넘침 없음');
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',sameSite:true,pager:true,returnPage:true,empties:true,won:true,writes:0}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
