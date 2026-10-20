'use strict';
/* 모바일 v5 오늘 · 팀(관리자) — 기획 v4 B (2026-10-20)
   시각 2026-10-20 10:00 KST 고정 · 합성 영업건(내 것 1 · 황윤선 기한 지남 2 · 정정훈 1 · 미배정 1) · 내가 보낸 요청 3(담당 미처리 · 고객 답 대기 · 처리).
   · 관리자만 [내 오늘 | 팀] · 팀 숫자 = DayZoneRules 판정 · 보낸 요청 분류 = 서버 상태 그대로
   · 담당별 이름 → 그 사람 기한 초과 목록 · [다시 요청]은 담당 미처리일 때만(PC 와 같은 crm_work_request_reask_v1)
   합성 자료 · 외부 연결 차단 · 운영 저장 없음. */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const NOW=Date.parse('2026-10-20T10:00:00+09:00');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[];
 try{
  browser=await chromium.launch(launchOptions());
  const c=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin?r.continue():r.abort();});
  const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.clock.setFixedTime(new Date(NOW));
  await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
  const setup=admin=>page.evaluate(admin=>{
   closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;delete window.__approvedHExample;delete window.__approvedScheduleNow;
   const day=n=>DayZoneRules.kst(Date.now()+n*864e5),actor=Phase1.profile.user_id,iso=s=>new Date(s).toISOString();
   Phase1.profile.allowed_modes=admin?['rep','admin']:['rep'];
   G.user={...G.user,id:actor,nm:'송보람'};G.mode='rep';G.tab='today';G.deal=null;G.sub=null;G.done={};G.brandF='전체';G.mobileV5Off=false;
   Object.assign(MobileGuideShell.state,{area:'now',areaPage:1,detailView:'',v5more:false,v5team:false,v5rep:'',v5teamPage:{}});
   const mk=(id,nm,rep,due,text)=>({id,site_id:id+'s',nm,code:'consulting',sub:'방수',rep,owner_id:rep==='송보람'?actor:'',brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 소장',manager_mobile:'',
    created_at:iso(Date.now()-5*864e5),stageAt:iso(Date.now()),lastAt:iso(Date.now()),contactAt:iso(Date.now()),activities:[],tl:[],
    nextAction:{id:id+'n',type:'전화',text,due:day(due),due_at:day(due),status:'open'}});
   DEALS=[mk('t01','합성 내 현장','송보람',0,'자료 확인'),mk('t02','합성 황 3일','황윤선',-3,'견적 검토 확인'),mk('t03','합성 황 1일','황윤선',-1,'회신 확인'),mk('t04','합성 정 2일','정정훈',-2,'방문 일정 확인'),mk('t05','합성 미배정','',-1,'담당 지정')];
   ADMIN.inquiries=[];
   const rq=(id,status,due,extra)=>({id,target_type:'deal',target_id:'t02',site:'합성 황 3일',kind:'first',label:'첫 연락 요청',asks:['고객 첫 연락'],to_name:'황윤선',to_me:false,by_me:true,status,open:['sent','seen','working'].includes(status),due_at:due,round:1,...extra});
   window.__reask=[];const rpc=Phase1.rpc;Phase1.rpc=async(name,args)=>{if(name==='crm_work_request_reask_v1'){__reask.push(structuredClone(args.p));const r=MobileRequests.state().list.find(x=>x.id===args.p.id);return {ok:true,request:{...r,round:2,due_at:args.p.due_at,due_label:args.p.due_label}};}return rpc(name,args);};
   Object.assign(MobileRequests.state(),{list:[rq('aaaaaaaa-0000-4000-8000-0000000000a1','seen','2026-10-19T09:00:00+09:00'),rq('aaaaaaaa-0000-4000-8000-0000000000a2','working','2026-10-19T18:00:00+09:00',{site:'합성 정 2일',to_name:'정정훈',reply_note:'연락 시도 1회 · 미연결 (부재)'}),rq('aaaaaaaa-0000-4000-8000-0000000000a3','done','2026-10-18T18:00:00+09:00')],loaded:true,busy:false,off:false,at:Date.now()});
   render();
  },admin);
  /* 담당자(관리자 아님) = 전환 없음 */
  await setup(false);await page.locator('.approved-a.mv5').waitFor();
  assert.equal(await page.locator('.mv5 [data-gs="v5team"]').count(),0,'담당자에게는 팀 전환 없음');
  /* 관리자 */
  await setup(true);await page.locator('.approved-a.mv5').waitFor();
  assert.equal(await page.locator('.mv5 [data-gs="v5team"]').count(),2,'관리자 = [내 오늘 | 팀]');
  await page.locator('.mv5 [data-gs="v5team"][data-value="1"]').click();await page.locator('.mv5-team').waitFor();
  const top=(await page.locator('.mv5-team .mv5-top').innerText()).replace(/\s+/g,' ').trim();
  assert.equal(top,'팀 기한 초과 3 · 미배정 1 보낸 요청 3 · 처리 1 · 담당 미처리 1 · 고객 답 대기 1',top);
  assert.deepEqual((await page.locator('.mv5-team .mv5-chip').allInnerTexts()).map(s=>s.replace(/\s+/g,' ').trim()),['황윤선 2','정정훈 1'],'담당별 기한 초과(많은 순)');
  await page.locator('.mv5-team .mv5-chip[data-value="황윤선"]').click();
  const rows=await page.locator('.mv5-team .mv5-row').allInnerTexts();assert.equal(rows.length,2);assert.match(rows[0],/3일 지남[\s\S]*합성 황 3일[\s\S]*견적 검토 확인/,'오래 지난 순');
  await page.locator('.mv5-team [data-gs="v5rep"][data-value=""]').click();await page.locator('.mv5-team .mv5-top').waitFor();
  const cards=page.locator('.mv5-team .mv5-req');assert.equal(await cards.count(),2,'기한 지난 보낸 요청 2(처리된 것 제외)');
  assert.match(await cards.nth(0).innerText(),/황윤선 · 확인함 · 담당 미처리[\s\S]*다시 요청/);
  assert.match(await cards.nth(1).innerText(),/정정훈 · 확인함 · 고객 답 대기 · 연락 시도 1회 · 미연결 \(부재\)[\s\S]*고객 답 대기면 다시 요청 없음/);
  assert.equal(await cards.nth(1).locator('[data-gs="v5reask"]').count(),0,'고객 답 대기 = 다시 요청 없음');
  await cards.nth(0).locator('[data-gs="v5reask"]').click();await page.waitForFunction(()=>__reask.length===1);
  const R=await page.evaluate(()=>__reask[0]);assert.equal(R.id,'aaaaaaaa-0000-4000-8000-0000000000a1');assert.equal(R.due_label,'오늘 17:00','PC 와 같은 기한(17시 전 = 오늘 17:00)');
  assert.equal(await page.locator('.mv5-team [data-gs="v5perf"]').count(),2,'성과 › · 성과 보기');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'가로 넘침 없음');
  if(process.env.SHOT_DIR)await page.screenshot({path:require('path').join(process.env.SHOT_DIR,'mobile-v5-team.png')});
  await page.locator('.mv5 [data-gs="v5team"][data-value="0"]').click();await page.locator('.approved-a.mv5:not(.mv5-team)').waitFor();
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',checks:['담당자 = 전환 없음','관리자 팀 숫자 · 담당별 · 목록','보낸 요청 분류 · 다시 요청은 담당 미처리만','내 오늘로 복귀'],writes:0}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
