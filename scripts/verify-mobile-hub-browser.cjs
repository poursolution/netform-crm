'use strict';
/* Approved mobile hub smoke: real scoped projections and real A/B/C/D/E/F routes.
 * Synthetic fixture transport only; no production data, login, microphone or writes.
 * The retired #tabbar/.mh-* UI is deliberately not an alternate test route.
 */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const one=value=>String(value||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch(launchOptions());
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  const errors=[],writes=[],external=[],checks=[];
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD'].includes(request.method())){writes.push(request.url());return route.abort();}
   if(url.origin!==origin){external.push(request.url());return route.abort();}
   return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});
  await page.locator('.approved-b').waitFor();
  const data=await page.evaluate(()=>{
   closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;
   delete window.__approvedHExample;delete window.__approvedScheduleNow;
   const id=n=>'77777777-7777-4777-8777-'+String(n).padStart(12,'0');
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
   const day=n=>new Date(Date.parse(today+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
   const actor=Phase1.profile.user_id,other='88888888-8888-4888-8888-888888888888';
   G.user={...G.user,id:actor};G.mode='rep';G.tab='today';G.mobileV5Off=true;/* 예전 4구역 오늘(끄기 경로) — v5 오늘은 verify-mobile-v5-today */G.deal=null;G.sub=null;G.done={};G.brandF='전체';
   Object.assign(MobileGuideShell.state,{q:'',stage:'',page:1,scroll:0,area:'now',detailView:'',scheduleDay:'',schedulePage:1});
   window.__hubToasts=[];window.toast=text=>__hubToasts.push(String(text));
   const make=(n,extra={})=>({id:id(n),site_id:id(n+1000),nm:'합성 현장 '+String(n).padStart(2,'0'),code:'consulting',sub:'방수',work_type:'옥상 방수',rep:G.user.nm,owner_id:actor,
    brand:n%2?'석민이앤씨':'POUR솔루션',version:0,amt:100000000,manager_name:'합성 관리소장',manager_mobile:'',address:'합성시 검증로 '+n,
    created_at:new Date().toISOString(),stageAt:new Date().toISOString(),lastAt:new Date().toISOString(),contactAt:new Date().toISOString(),activities:[],tl:[],
    nextAction:{id:id(n+100),type:'전화',text:'합성 후속 연락 '+n,due:day(14),due_at:day(14),status:'open'},...extra});
   DEALS=Array.from({length:45},(_,i)=>make(i+1));
   for(const [n,offset]of [[1,-3],[2,0],[3,0],[4,1]])Object.assign(DEALS[n-1].nextAction,{due:day(offset),due_at:day(offset)});
   Object.assign(DEALS[1].nextAction,{type:'방문',text:'현장 방문 · 옥상 실측',scheduled_at:day(0)+'T14:00:00+09:00'});
   DEALS[4].nextAction=null;DEALS[5].code='sent';
   // The same displayed representative name cannot override a different server owner ID.
   DEALS.push(make(90,{nm:'제외 · 다른 계정',owner_id:other}));
   // Legacy rows without owner_id retain the existing shared name-scoped fallback.
   DEALS.push(make(46,{nm:'합성 현장 46',owner_id:undefined}));
   DEALS.push(make(91,{nm:'제외 · 다른 담당',owner_id:undefined,rep:'다른 합성 담당자'}));
   ADMIN.inquiries=[];Object.assign(MobileRequests.state(),{list:[],loaded:true,busy:false,off:false,at:Date.now()});
   window.__hubIds={all:Array.from({length:46},(_,i)=>id(i+1)),today:[2,3].map(id),late:[1].map(id),fix:id(5),visit:id(2),call:id(3),tomorrow:id(4),foreign:[id(90),id(91)]};
   render();return {...__hubIds,todayDate:day(0),tomorrowDate:day(1),yesterdayDate:day(-1)};
  });
  const ids=selector=>page.locator(selector).evaluateAll(nodes=>nodes.map(node=>node.dataset.id));
  async function safe(){
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');
   assert.equal(await page.locator('#tabbar button').count(),0,'Retired tab host remains empty');
   assert.equal(await page.locator('#scr .mh-hub,#scr .mh-filter,#scr .mh-sched,#scr .mv-now,#scr .flow-strip,#scr .today-task,#scr .lrow').count(),0,'No retired mobile content');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr [data-id]')].some(node=>__hubIds.foreign.includes(node.dataset.id))),false,'No other assignee appears');
  }
  const tab=async(name,selector)=>{await page.locator('[data-gs="tab"][data-tab="'+name+'"]').last().click();await page.locator(selector).waitFor();await safe();};
  const snapshot=()=>page.evaluate(()=>JSON.stringify({deals:DEALS,done:G.done,replies:__review.replies,rows:__review.rows}));
  const initial=await snapshot();

  // 1. The actual shared today projection supplies counts and IDs, not approved-example totals.
  await page.locator('.approved-a').waitFor();
  assert.deepEqual(await ids('.approved-a [data-gs="task"]'),data.today);
  /* six_fixes ③: PC 와 같은 4구역 · 같은 판정(DayZoneRules) — 오늘 기한 2(현장 02 · 03) · 기한 초과 1(현장 01) · 다음 할 일 없음 = 기록 보완(현장 05) · 내일(현장 04)은 오늘 화면에 없음 */
  assert.match(one(await page.locator('.approved-a').innerText()),/오늘 먼저 3건.*기한 초과 1건/);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.approved-a [data-gs="area"]')].map(n=>n.textContent.replace(/\s+/g,' ').trim())),['오늘 처리 2','기한 초과 1','고객 회신 대기 0','기록 보완 1']);
  await page.locator('.approved-a [data-gs="area"][data-value="late"]').click();await page.locator('.approved-a').waitFor();assert.deepEqual(await ids('.approved-a [data-gs="task"]'),data.late,'기한 초과 = 현장 01');
  await page.locator('.approved-a [data-gs="area"][data-value="fix"]').click();await page.locator('.approved-a').waitFor();assert.ok((await ids('.approved-a [data-gs="task"]')).includes(data.fix),'다음 할 일 없음 = 기록 보완');
  await page.locator('.approved-a [data-gs="area"][data-value="now"]').click();await page.locator('.approved-a').waitFor();
  assert.deepEqual(await page.locator('.approved-a [data-gs="tab"]').allTextContents().then(rows=>rows.map(one)),['오늘','내 현장','기록 · 등록','일정']);
  assert.deepEqual(await page.evaluate(()=>myDeals().map(d=>d.id)),data.all);
  await page.locator('.approved-a [data-gs="task"][data-id="'+data.call+'"]').click();await page.locator('.approved-c').waitFor();
  assert.equal(await page.evaluate(()=>G.deal),data.call);
  assert.match(one(await page.locator('.approved-c').innerText()),/합성 현장 03.*합성 담당자.*합성 후속 연락 3/);
  await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-a').waitFor();
  await safe();checks.push('A: real 4-task count, shared assignee scope, exact approved tabs, task → C → today');

  // 2. B's page numbers, search and PC stage labels replace the retired expanding rows/filter layout.
  await tab('mine','.approved-b');
  assert.deepEqual(await ids('.approved-b [data-gs="deal"]'),data.all.slice(0,20));
  assert.equal(one(await page.locator('.approved-b .lpg-info').innerText()),'1–20 / 46건');
  const stageLabels=await page.locator('.approved-stages [data-gs="stage"]').allTextContents();
  const canonical=await page.evaluate(()=>['전체',...PipelineStages.definitions.filter(row=>row.key!=='expansion').map(row=>row.label)]);
  assert.deepEqual(stageLabels,canonical,'Stage labels use the common PC definitions');
  await page.locator('[data-gs="page"][aria-label="2쪽"]').click();
  assert.deepEqual(await ids('.approved-b [data-gs="deal"]'),data.all.slice(20,40));
  await page.locator('[data-gs="stage"][data-value="sent"]').click();
  assert.equal(await page.evaluate(()=>MobileGuideShell.state.page),1);assert.deepEqual(await ids('.approved-b [data-gs="deal"]'),[data.all[5]]);
  await page.locator('[data-gs="stage"][data-value=""]').click();
  await page.locator('[data-gs="page"][aria-label="2쪽"]').click();
  await page.locator('[data-gs-query]').fill('검증로 46');
  assert.equal(await page.evaluate(()=>MobileGuideShell.state.page),1);assert.deepEqual(await ids('.approved-b [data-gs="deal"]'),[data.all[45]]);
  await page.locator('[data-gs-query]').fill('없는 검색어');
  assert.equal(await page.locator('.approved-b [data-gs="deal"]').count(),0);assert.match(await page.locator('.approved-empty').innerText(),/해당하는 영업건이 없습니다/);
  await page.locator('[data-gs-query]').fill('합성 현장');await page.locator('[data-gs="page"][aria-label="2쪽"]').click();
  await page.locator('.approved-list').evaluate(node=>{node.scrollTop=300;});
  const position=await page.evaluate(()=>({q:MobileGuideShell.state.q,page:MobileGuideShell.state.page,scroll:document.querySelector('.approved-list').scrollTop}));
  assert.equal(position.scroll,300);
  await page.locator('.approved-b [data-gs="deal"]').nth(4).dispatchEvent('click');await page.locator('.approved-c').waitFor();
  await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-b').waitFor();
  assert.deepEqual(await page.evaluate(()=>({q:MobileGuideShell.state.q,page:MobileGuideShell.state.page,scroll:document.querySelector('.approved-list').scrollTop})),position);
  assert.deepEqual(await ids('.approved-b [data-gs="deal"]'),data.all.slice(20,40));await safe();
  checks.push('B: 20-row pages, canonical stage filter, scoped address search, empty result and page/scroll restoration');

  // 3. Registration keeps an explicit existing-deal choice; it must not expose scanCard/legacy forms.
  await tab('record','.approved-e');await page.locator('[data-gs="e-activity"]').click();await page.locator('.approved-b').waitFor();
  assert.equal(await page.locator('[data-gs-query]').inputValue(),'');
  await page.locator('.approved-b [data-gs="deal"][data-id="'+data.call+'"]').click();await page.locator('.approved-d').waitFor();
  assert.equal(await page.evaluate(()=>G.deal),data.call);assert.match(await page.locator('.cd-context').innerText(),/합성 현장 03/);
  assert.deepEqual(await page.locator('.approved-d [data-ce="res"]').allTextContents(),['연결됨','회신 받음','부재','번호 오류','배드핏']);
  await page.locator('.approved-d [data-ce="close"]').click();await page.locator('.approved-c').waitFor();
  await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-b').waitFor();
  await tab('record','.approved-e');await page.locator('[data-gs-e-query]').fill('합성 현장 03');
  await page.locator('[data-gs="e-newsite"][data-entry="next"]').click();await page.locator('.approved-j-4').waitFor();
  assert.equal(await page.locator('.approved-j4-row').count(),1);
  assert.equal(await page.locator('[data-gs="j4-existing"]').last().getAttribute('aria-disabled'),'true','A candidate is not an automatic selection');
  await page.locator('.approved-j4-row').click();await page.locator('[data-gs="j4-existing"]').last().click();
  assert.match(await page.evaluate(()=>__hubToasts.at(-1)),/서버 저장 연결.*준비되지 않았습니다/);
  await page.locator('.approved-j-4 [data-gs="back"]').click();await page.locator('.approved-e').waitFor();
  assert.equal(await snapshot(),initial,'Read/navigation/selection never saves a CRM record');await safe();
  checks.push('E → B → C/D inherits the chosen deal; J-4 requires explicit candidate selection and cannot fake a completed creation');

  // 4. F uses registered task dates and explicit completion evidence, not old relative-date groups.
  await tab('schedule','.approved-f');
  assert.deepEqual(await ids('.approved-f [data-task-id]'),[data.visit,data.call]);
  assert.match(one(await page.locator('.approved-f').innerText()),/처리 확인 필요.*합성 현장 01/);
  const visit=page.locator('.approved-f [data-task-id][data-id="'+data.visit+'"]');
  assert.match(one(await visit.innerText()),/14:00.*현장 방문 · 옥상 실측/);
  assert.match(one(await page.locator('.approved-f [data-task-id][data-id="'+data.call+'"]').innerText()),/^미확인/,'Day-only deadline is not a fabricated appointment time');
  const week=await page.evaluate(()=>MobileScheduleModel.read().days);
  assert.deepEqual(await page.locator('[data-gs="schedule-day"]').evaluateAll(nodes=>nodes.map(node=>node.dataset.date)),week.map(day=>day.date));
  const originalVisit=await page.evaluate(id=>structuredClone(DEALS.find(d=>d.id===id).nextAction),data.visit);
  const visitDraft=()=>page.evaluate(()=>({deal:G.deal,ch:MobileEntry.state()?.ch,existing:MobileEntry.state()?.existing,mode:MobileEntry.state()?.mode,rows:__review.rows.length,replies:__review.replies.length}));
  await visit.click();await page.locator('.approved-d').waitFor();assert.equal(await page.evaluate(()=>G.deal),data.visit);
  assert.match(await page.locator('.approved-d .cd-head').innerText(),/방문 결과/);
  assert.deepEqual(await visitDraft(),{deal:data.visit,ch:'방문',existing:{id:originalVisit.id,text:originalVisit.text,due:originalVisit.due,type:'방문',promise:false},mode:'keep',rows:0,replies:0});
  assert.equal(await page.evaluate(()=>document.getElementById('scr').inert),true,'Visit D protects its underlying detail while open');
  assert.equal(await page.locator('#sheetcard .sheet-grip,#sheetcard .intro,#sheetcard .ce-infobody,#sheetcard [data-mf]').count(),0,'Visit uses approved D, never the retired visit form');
  await page.locator('.approved-d [data-ce="close"]').click();await page.locator('.approved-c').waitFor();
  assert.equal(await page.evaluate(()=>document.getElementById('scr').inert),false);
  await page.locator('.approved-c [data-gs="pending-task"]').click();await page.locator('.approved-d').waitFor();
  assert.deepEqual(await visitDraft(),{deal:data.visit,ch:'방문',existing:{id:originalVisit.id,text:originalVisit.text,due:originalVisit.due,type:'방문',promise:false},mode:'keep',rows:0,replies:0},'C re-entry retains the exact visit and creates no operation');
  assert.deepEqual(await page.evaluate(id=>DEALS.find(d=>d.id===id).nextAction,data.visit),originalVisit,'Opening or leaving a visit result cannot complete or replace its task');
  await page.locator('.approved-d [data-ce="close"]').click();await page.locator('.approved-c').waitFor();
  await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-f').waitFor();
  // Choose a visible non-today calendar day even when tomorrow belongs to next week.
  const otherDay=week.find(day=>day.date!==data.todayDate).date;
  await page.locator('[data-gs="schedule-day"][data-date="'+otherDay+'"]').click();
  assert.equal(await page.locator('[aria-current="date"]').getAttribute('data-date'),otherDay);
  const expected=await page.evaluate(date=>myDeals().filter(d=>d.nextAction?.status==='open'&&d.nextAction.due===date).map(d=>d.id),otherDay);
  assert.deepEqual(await ids('.approved-f [data-task-id]'),expected);
  if(!expected.length)assert.match(await page.locator('.approved-f').innerText(),/선택한 날짜의 등록 일정 없음/);
  await page.locator('.approved-f [data-gs="tab"]').click();await page.locator('.approved-a').waitFor();
  await safe();assert.equal(await snapshot(),initial);checks.push('F: scoped dated tasks, unknown time retained, visit → approved D with exact task → C re-entry → schedule; original task preserved without writes or legacy forms');

  // 5. Contact save is a real approved D interaction, with ACK withheld and a retryable failure.
  await page.locator('.approved-a [data-gs="task"][data-id="'+data.call+'"]').click();await page.locator('.approved-c').waitFor();
  await page.locator('[data-gs="contact"]').click();await page.locator('.approved-d').waitFor();
  await page.locator('[data-ce="res"][data-v="연결됨"]').click();await page.locator('[data-ce-in="memo"]').fill('합성 확인: 기존 고객 약속은 그대로 유지');
  assert.equal(await page.locator('[data-ce="mode"][data-v="keep"]').getAttribute('aria-pressed'),'true');
  const beforeSave=await page.evaluate(()=>({task:structuredClone(DEALS.find(d=>d.id===G.deal).nextAction),activityCount:DEALS.find(d=>d.id===G.deal).activities.length}));
  await page.evaluate(()=>{window.__hubFlush=Phase1.queue.flush;Phase1.queue.flush=()=>new Promise((resolve,reject)=>{window.__hubReject=reject;});});
  await page.locator('[data-ce="save"]').click();await page.waitForFunction(()=>typeof __hubReject==='function');
  assert.equal(await page.locator('[data-ce="save"]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>DEALS.find(d=>d.id===G.deal).activities.length),beforeSave.activityCount,'No local activity before server ACK');
  assert.equal(await page.evaluate(()=>__review.rows.length),1);
  await page.locator('[data-ce="save"]').dispatchEvent('click');assert.equal(await page.evaluate(()=>__review.rows.length),1,'Busy clicks cannot enqueue duplicates');
  await page.evaluate(()=>__hubReject(Error('합성 저장 실패')));await page.locator('.ce-err').waitFor();
  assert.match(await page.locator('.ce-err').innerText(),/서버 확인 대기 중.*같은 요청을 확인/);
  assert.equal(await page.locator('[data-ce-in="memo"]').inputValue(),'합성 확인: 기존 고객 약속은 그대로 유지');
  assert.equal(await page.evaluate(()=>DEALS.find(d=>d.id===G.deal).activities.length),beforeSave.activityCount);
  assert.deepEqual(await page.evaluate(()=>DEALS.find(d=>d.id===G.deal).nextAction),beforeSave.task);
  await page.evaluate(()=>{Phase1.queue.flush=__hubFlush;});await page.locator('[data-ce="save"]').click();
  await page.waitForFunction(()=>(document.querySelector('.approved-d [data-ce="save"]')?.textContent==='저장됨'||!!document.querySelector('#sheetcard .approved-v5a')));
  assert.equal(await page.evaluate(()=>__review.rows.length),1,'Retry reuses the queued request ID');
  assert.equal(await page.evaluate(()=>DEALS.find(d=>d.id===G.deal).activities.length),beforeSave.activityCount+1);
  assert.deepEqual(await page.evaluate(()=>DEALS.find(d=>d.id===G.deal).nextAction),beforeSave.task,'Keeping an existing task neither duplicates nor completes it');
  assert.deepEqual(await page.evaluate(()=>({operations:__review.rows.map(row=>row.operation),replies:__review.replies,done:G.done})),{operations:['activity'],replies:[],done:{}});
  await page.locator('[data-ce="close"]').click();await page.locator('.approved-c').waitFor();
  assert.match(await page.locator('.approved-c').innerText(),/합성 확인: 기존 고객 약속은 그대로 유지/);
  await safe();checks.push('D: server ACK gates completion; failure preserves text/task; retry reuses one operation; C shows one confirmed activity without completing the existing task');

  // 6. Former feature-off and old subroute values cannot resurrect the retired hub/detail.
  await page.evaluate(()=>{G.mobileHubOff=true;G.deal=null;G.tab='find';G.sub={t:'inqAssigned',key:'unavailable'};render();});
  await page.locator('.approved-b').waitFor();assert.equal(await page.evaluate(()=>G.sub),null);await safe();
  assert.equal(await page.locator('#scr button[onclick="scanCard()"],#stage-transition-form').count(),0);
  checks.push('Retired hub-off/registration/inquiry subroutes resolve to the approved shell without displaying old forms');
  assert.deepEqual(errors,[],'No page errors');assert.deepEqual(writes,[],'No network writes');
  const font='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
  assert.deepEqual(external.filter(url=>url!==font),[],'Only the optional external font may be attempted, and it is blocked');
  console.log(JSON.stringify({test:'verify-mobile-hub',passed:checks.length,checks,boundary:'Synthetic data and in-memory ACKs only; external network blocked; approved source routes, no runtime/design edits'},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
