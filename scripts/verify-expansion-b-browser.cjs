'use strict';
/* 확장관리 B안 검사(2026-10-03 "파이프라인 기준으로"): 왼쪽 사후관리 진단(막대 3칸 · 숫자 3 · 사유 · 할 일) / 오른쪽 확인할 현장(리스트 · 보드) · 정렬은 빨강 사유 순 · 열기는 기존 v2 상세창 · 끄면 v2 묶음 표 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ExpansionB&&window.StageBoard&&window.ExpansionV2&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),Y=new Date().getFullYear();
   const won=(id,site,owner,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-200),code:'won',stage_code:'won',outcome:'won',won_amount:5e6,closed_at:day(-60),completion_date:day(-60)},extra||{});
   B={deals:[won('w1','이천신둔코아루','한준엽'),won('w2','[서울 강서] 마곡청구아파트','황윤선',{won_amount:82e6}),won('w3','시범현대아파트','이필선',{brand:'석민이앤씨'}),won('w4','니즈 확인된 현장','황윤선'),won('w5','보류 현장','이필선'),won('w6','작년 준공 현장','이필선',{completion_date:(Y-1)+'-05-10',closed_at:(Y-1)+'-05-10'}),won('w7','오래된 접촉 현장','김성민',{completion_date:day(-120),closed_at:day(-120)})],
    inquiries:[],activities:[],inquiryTrash:[],
    expansion_pool:[
     {id:'e1',source_opportunity_id:'w1',site_name:'이천신둔코아루',owner_name:'한준엽',completion_date:day(-60),next_contact_at:day(-2),expansion_status:'신규 대상',candidate_work_items:['타공종 확인','유지보수 확인'],version:1},
     {id:'e2',source_opportunity_id:'w2',site_name:'[서울 강서] 마곡청구아파트',owner_name:'황윤선',source_work_summary:'옥상 방수',source_won_amount:82e6,completion_date:day(-60),next_contact_at:day(5),last_contact_at:day(-7),expansion_status:'접촉 예정',candidate_work_items:['지하주차장','재도장'],version:1},
     {id:'e3',source_opportunity_id:'w3',site_name:'시범현대아파트',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:4e6,completion_date:day(-60),next_contact_at:day(40),last_contact_at:day(-10),expansion_status:'관계 관리중',candidate_work_items:['재도장'],version:1},
     {id:'e4',source_opportunity_id:'w4',site_name:'니즈 확인된 현장',owner_name:'황윤선',source_work_summary:'재도장',source_won_amount:3e7,completion_date:day(-60),next_contact_at:day(20),last_contact_at:day(-3),expansion_status:'추가 니즈 확인',need_note:'지하주차장 에폭시 견적 요청',version:1},
     {id:'e5',source_opportunity_id:'w5',site_name:'보류 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:day(-60),next_contact_at:day(90),expansion_status:'보류/휴면',version:1},
     {id:'e6',source_opportunity_id:'w6',site_name:'작년 준공 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:(Y-1)+'-05-10',next_contact_at:day(3),expansion_status:'신규 대상',version:1},
     {id:'e7',source_opportunity_id:'w7',site_name:'오래된 접촉 현장',owner_name:'김성민',source_work_summary:'옥상 방수',source_won_amount:2e7,completion_date:day(-120),next_contact_at:day(10),last_contact_at:day(-75),expansion_status:'관계 관리중',version:1}],
    expansion_events:[{source_opportunity_id:'w2',occurred_at:day(-7),kind:'접촉',note:'관리소장 통화 — 하자 없음',actor:'황윤선'}],expansion_quote_dispatches:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.expansionYear=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p.expansion_status,p.next_contact_at]);return 'req';};
   SB={rpc:async(name,args)=>{if(name==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};return {data:{ok:true,event:{source_opportunity_id:args.p.source_opportunity_id,occurred_at:new Date().toISOString(),kind:'접촉·니즈',note:args.p.note,actor:'송보람'}}};}};TOKEN='test';
   window.__new=null;expansionOpenNew=id=>{window.__new=id;};
   goPage('expansion');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#expansion-b');assert.equal(await v.count(),1,'B안 보드');assert.equal(await page.locator('#expansion-v2').count(),0,'v2 묶음 표는 없음');
  assert.equal(await page.locator('#pg-expansion>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'확장관리');
  const Y=new Date().getFullYear();
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 7',Y+' 6',(Y-1)+' 1',(Y-2)+' 0','이전 0']);
  /* 진단: 막대 3칸(사후 연락 · 니즈 확인 · 전환 · 보류) · 숫자 3개 · 사유 · 할 일 */
  assert.deepEqual((await v.locator('.psb-axis .leg button').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')),['사후 연락 · 관계 유지 4','니즈 확인 1','보류 · 전환 완료 1']);
  assert.match(await v.locator('.psb-kpis').innerText(),/기준 넘김 \(빨강\)\s*2곳[\s\S]*니즈 확인\s*1곳[\s\S]*평균 준공 후\s*\d+일/);
  const reasons=await v.locator('.psb-reason span').allInnerTexts();
  assert.deepEqual(reasons,['다음 접촉일 지남','준공 D+30 사후 연락 안 함','2개월 넘게 연락 없음','니즈 확인 → 전환 대기','공종 미분류'],'사유 순서 = 표 순서 '+JSON.stringify(reasons));
  assert.match(await v.locator('.psb-two .psb-box').nth(1).innerText(),/그래서 뭘 해야 하나[\s\S]*다음 접촉일 지남 1곳[\s\S]*준공 D\+30 사후 연락 안 함 1곳[\s\S]*2개월 넘게 연락 없음 1곳/);
  /* 현장: 빨강 사유 순(접촉일 지남 e1 → 2개월 연락 없음 e7) → 사유 수 */
  const order=await v.locator('.psb-row').evaluateAll(a=>a.map(n=>n.dataset.key));
  assert.deepEqual(order.slice(0,2),['e1','e7'],'빨강 먼저 '+JSON.stringify(order));
  assert.match(await v.locator('.psb-row[data-key="e1"]').innerText(),/이천신둔코아루[\s\S]*POUR솔루션 · 한준엽 · 500만[\s\S]*사후 연락[\s\S]*접촉 기록 없음[\s\S]*다음 접촉일 지남[\s\S]*D\+60일[\s\S]*연락/);
  assert.match(await v.locator('.psb-row[data-key="e7"]').innerText(),/2개월 넘게 연락 없음[\s\S]*D\+120일[\s\S]*관계 연락/);
  assert.match(await v.locator('.psb-row[data-key="e4"]').innerText(),/니즈 확인[\s\S]*니즈 지하주차장 에폭시 견적 요청[\s\S]*니즈 확인 → 전환 대기[\s\S]*전환/);
  assert.match(await v.locator('.psb-row[data-key="e5"]').innerText(),/보류 현장[\s\S]*보류[\s\S]*정상/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 필터: 막대 칸 · 사유 · 해제 · 보드 */
  await v.locator('.psb-axis .leg button').nth(1).click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),1);
  await page.locator('#expansion-b [data-sb="clear"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),6);
  await page.locator('#expansion-b .psb-reason[data-v="after30"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),1);
  await page.locator('#expansion-b [data-sb="clear"]').click();await page.waitForTimeout(150);
  await page.locator('#expansion-b [data-sb="view"][data-v="board"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-col').count(),3);assert.equal(await page.locator('#expansion-b .psb-card').count(),6);
  await page.locator('#expansion-b [data-sb="view"][data-v="list"]').click();await page.waitForTimeout(150);
  /* 준공연도 알약 */
  await page.locator('#expansion-b .plv-pills [data-value="'+(Y-1)+'"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),1);
  await page.locator('#expansion-b .plv-pills [data-value="'+Y+'"]').click();await page.waitForTimeout(150);
  /* 열기 = 기존 v2 상세창 · 사유 버튼은 그 액션으로(연락 → 입력칸 포커스, 전환 → 기존 전환창) */
  await page.locator('#expansion-b .psb-row[data-key="e2"] .l').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#expansionV2.on .xdv').count(),1,'v2 상세창');assert.match(await page.locator('#expansionV2 .xdv-top').innerText(),/마곡청구아파트/);
  await page.locator('#expansionV2 .xdv-close').click();await page.waitForTimeout(150);
  await page.locator('#expansion-b .psb-row[data-key="e1"] [data-sb="act"]').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.matches('#expansionV2 .idv-input textarea')),true,'연락 → 기록 입력칸');
  await page.locator('#expansionV2 .xdv-close').click();await page.waitForTimeout(150);
  await page.locator('#expansion-b .psb-row[data-key="e4"] [data-sb="act"]').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>expansionRecords().find(r=>r.id===window.__new).sourceOpportunityId),'w4','전환 = 기존 전환창');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.expansionBOff=true;paintExpansion();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#expansion-b').count(),0);assert.equal(await page.locator('#expansion-v2').count(),1,'끄면 v2 묶음 표');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',board_frame:true,diagnosis_3bars:true,reasons_order:true,sort_red_first:true,filters:true,year_pills:true,open_existing_detail:true,act_routes:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
