'use strict';
/* 확장관리 v2 검사(2026-10-01 디자인 핸드오프 expansion): 목록(공통 필터줄·준공연도 알약·담당자별 칩·진단·묶음 표) + 상세창(3단 틀).
   상태·다음 접촉·기록·전환은 기존 경로만 쓴다 — 쓰기는 가로채 실제 저장 없이 확인한다. 끄면 예전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ExpansionV2&&window.ExpansionPool&&window.CommonFilterBar&&window.PipelineDiagnosis);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),Y=new Date().getFullYear();
   const won=(id,site,owner,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-200),code:'won',stage_code:'won',outcome:'won',won_amount:5e6,closed_at:day(-60),completion_date:day(-60)},extra||{});
   B={deals:[won('w1','이천신둔코아루','한준엽'),won('w2','[서울 강서] 마곡청구아파트','황윤선',{won_amount:82e6}),won('w3','시범현대아파트','이필선',{brand:'석민이앤씨'}),won('w4','니즈 확인된 현장','황윤선'),won('w5','보류 현장','이필선'),won('w6','작년 준공 현장','이필선',{completion_date:(Y-1)+'-05-10',closed_at:(Y-1)+'-05-10'})],
    inquiries:[],activities:[],inquiryTrash:[],
    expansion_pool:[
     {id:'e1',source_opportunity_id:'w1',site_name:'이천신둔코아루',owner_name:'한준엽',completion_date:day(-60),next_contact_at:day(-2),expansion_status:'신규 대상',candidate_work_items:['타공종 확인','유지보수 확인'],version:1},
     {id:'e2',source_opportunity_id:'w2',site_name:'[서울 강서] 마곡청구아파트',owner_name:'황윤선',source_work_summary:'옥상 방수',source_won_amount:82e6,completion_date:day(-60),next_contact_at:day(5),expansion_status:'접촉 예정',candidate_work_items:['지하주차장','재도장'],version:1},
     {id:'e3',source_opportunity_id:'w3',site_name:'시범현대아파트',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:4e6,completion_date:day(-60),next_contact_at:day(40),last_contact_at:day(-10),expansion_status:'관계 관리중',candidate_work_items:['재도장'],version:1},
     {id:'e4',source_opportunity_id:'w4',site_name:'니즈 확인된 현장',owner_name:'황윤선',source_work_summary:'재도장',source_won_amount:3e7,completion_date:day(-60),next_contact_at:day(20),expansion_status:'추가 니즈 확인',need_note:'지하주차장 에폭시 견적 요청',version:1},
     {id:'e5',source_opportunity_id:'w5',site_name:'보류 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:day(-60),next_contact_at:day(90),expansion_status:'보류/휴면',version:1},
     {id:'e6',source_opportunity_id:'w6',site_name:'작년 준공 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:(Y-1)+'-05-10',next_contact_at:day(3),expansion_status:'신규 대상',version:1}],
    expansion_events:[{source_opportunity_id:'w2',occurred_at:day(-7),kind:'접촉',note:'관리소장 통화 — 하자 없음',actor:'황윤선'}],expansion_quote_dispatches:[]};
   G.expansionBOff=true;/* B안(2026-10-03)은 verify-expansion-b 에서 */LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p.expansion_status,p.next_contact_at]);return 'req';};
   window.__rpc=[];SB={rpc:async(name,args)=>{if(name==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};__rpc.push([name,args.p.source_opportunity_id,args.p.note]);if(name==='crm_expansion_contact_context_v1')return {data:{ok:true,events:B.expansion_events.filter(x=>x.source_opportunity_id===args.p.source_opportunity_id),dispatches:[]}};return {data:{ok:true,operation:name,request_id:args.p.request_id,source_opportunity_id:args.p.source_opportunity_id,target_ids:args.p.target_ids,linked_count:(args.p.target_ids||[]).length,event:{source_opportunity_id:args.p.source_opportunity_id,occurred_at:new Date().toISOString(),kind:'접촉·니즈',note:args.p.note,actor:'송보람'}}};}};TOKEN='test';
   window.__new=null;expansionOpenNew=id=>{window.__new=id;};
   goPage('expansion');
  });
  await page.waitForTimeout(250);
  const v=page.locator('#expansion-v2');assert.equal(await v.count(),1,'새 목록');
  /* 틀: 예전 필터 박스·요약 줄·담당자 카드·칸반 없음 */
  assert.equal(await page.locator('#expansion-root .exp-hero,#expansion-root .exp-owners,#expansion-root .exp-board4,#expansion-root .sales-filterbar').count(),0);
  assert.equal(await page.locator('#pg-expansion>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'확장관리');
  assert.equal(await v.locator('.plv-view').count(),0,'보드/리스트 전환 없음');
  const Y=new Date().getFullYear();
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 6',Y+' 5',(Y-1)+' 1',(Y-2)+' 0','이전 0']);
  assert.equal(await v.locator('.plv-pills [aria-pressed="true"]').innerText(),Y+' 5','기본 = 올해 준공');
  /* 진단: 숫자 4개(0이면 주황) · 카드 3개 · 과제 */
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['관리 고객','이번 주 연락','니즈 확인','파이프라인 전환']);
  assert.match(await v.locator('.pd-kpis').innerText(),/관리 고객\s*5곳[\s\S]*이번 주 연락\s*2곳[\s\S]*니즈 확인\s*1곳[\s\S]*파이프라인 전환\s*0건/);
  assert.equal(await v.locator('.pd-kpi').nth(3).locator('b.warn').count(),1,'전환 0 = 주황');
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['어디서 다음 매출이 나오나','언제 연락하나','누가 챙기나']);
  assert.match(await v.locator('.pd-card').nth(1).innerText(),/6개월 이내\s*4/);
  assert.match(await v.locator('.pd-action').innerText(),/그래서 뭘 해야 하나[\s\S]*공종 미분류 1곳/);
  /* 묶음 표 */
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['현장 · 담당','준공','공종 · 금액','다음 매출 추천','마지막 접촉','다음 접촉','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['이번 주 연락','유지접촉','니즈 확인','보류 · 전환']);
  assert.deepEqual(await v.locator('.plv-ghead span').allInnerTexts(),['2건','1건','1건','1건']);
  assert.equal(await v.locator('.plv-row').first().getAttribute('data-exp'),'e1','다음 접촉일 가까운 순');
  assert.match(await v.locator('.plv-row[data-exp="e1"]').innerText(),/이천신둔코아루[\s\S]*한준엽[\s\S]*공종 미분류[\s\S]*타공종 확인 · 유지보수 확인[\s\S]*기록 없음[\s\S]*2일 지남[\s\S]*처리/);
  assert.match(await v.locator('.plv-row[data-exp="e2"]').innerText(),/옥상 방수[\s\S]*8,200만[\s\S]*5일 뒤/);
  assert.match(await v.locator('.plv-row[data-exp="e4"]').innerText(),/니즈 · 지하주차장 에폭시 견적 요청/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 준공연도 알약 · 담당자별 칩(공통 담당자 필터) · 브랜드(공통) */
  await v.locator('.plv-pills [data-value="'+(Y-1)+'"]').click();await page.waitForTimeout(120);assert.equal(await v.locator('.plv-row').count(),1);
  await v.locator('.plv-pills [data-value="'+Y+'"]').click();await page.waitForTimeout(120);
  await v.locator('.plv-chip',{hasText:'황윤선'}).click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>SalesScope.state().owner+'|'+document.querySelector('#pg-expansion>.cf-bar [data-cf="owner"]').value),'황윤선|황윤선');assert.equal(await v.locator('.plv-row').count(),2);
  await v.locator('.plv-chip.on').click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),5);
  await page.locator('#pg-expansion>.cf-bar [data-sf-brand="석민이앤씨"]').click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),1);
  await page.locator('#pg-expansion>.cf-bar [data-sf-brand="전체"]').click();await page.waitForTimeout(150);
  /* 상세창 */
  await v.locator('.plv-row[data-exp="e2"] .plv-site').click();await page.waitForTimeout(250);
  const d=page.locator('#expansionV2.on .xdv');assert.equal(await d.count(),1,'새 상세');assert.equal(await page.locator('#expansionManager.on').count(),0,'예전 상세창은 열리지 않음');
  assert.match(await d.locator('.xdv-top').innerText(),/POUR솔루션[\s\S]*확장관리 · 접촉예정[\s\S]*마곡청구아파트[\s\S]*담당 황윤선 · 수주 8,200만 · 확장관리 60일째/);
  assert.deepEqual(await d.locator('.xdv-steps span').allInnerTexts(),['지금 · 이번 주 연락','유지접촉','니즈 확인','견적문의 전환']);
  assert.deepEqual(await d.locator('.xdv-facts dt').allInnerTexts(),['현재 담당','당시 영업','계약일','준공일','공종','수주 금액']);
  assert.equal(await d.locator('.xdv-facts dd.xdv-warn').count(),1,'빈 값(계약일)은 주황');
  assert.deepEqual(await d.locator('.xdv-c2 .idv-bubble').allInnerTexts(),['준공 완료 → 확장관리 대상으로 등록 / 추천: 지하주차장 · 재도장','관리소장 통화 — 하자 없음']);
  assert.match(await d.locator('.xdv-now').innerText(),/지금 할 일[\s\S]*하자 점검 · 타공종 확인 통화[\s\S]*5일 뒤[\s\S]*전화[\s\S]*문자[\s\S]*카카오[\s\S]*접촉 · 니즈 기록/);
  assert.match(await d.locator('.xdv-signal').innerText(),/다음 영업 신호[\s\S]*지하주차장 · 재도장[\s\S]*준공 후 60일/);
  assert.deepEqual(await d.locator('.ddv-stages button').allInnerTexts(),['관리대상','유지접촉','니즈 확인','보류']);
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  /* 기록 = 기존 서버 함수, 서버 확인 뒤 대화에 쌓임 */
  await d.locator('.idv-input textarea').fill('지하주차장 누수 문의 — 11월 견적 요청');await d.locator('.idv-save').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(r=>r[0]!=='crm_ops_settings_v1'&&r[0]!=='crm_ops_rules_v1'&&r[0]!=='crm_deal_transfer_list_v1'&&r[0]!=='crm_deal_win_list_v1'&&r[0]!=='crm_approval_list_v1'/* 로그인 뒤 설정 · 운영 기준 · 타사 이관 · 수주 유형 · 승인 요청 읽기 */)),[['crm_expansion_contact_context_v1','w2',undefined],['crm_expansion_contact_write_v1','w2','지하주차장 누수 문의 — 11월 견적 요청']]);
  assert.equal(await page.locator('#expansionV2 .xdv-c2 .idv-bubble').last().innerText(),'지하주차장 누수 문의 — 11월 견적 요청');
  /* 관리 상태 · 다음 접촉일 = 기존 저장 함수 */
  await page.locator('#expansionV2 .ddv-stages [data-value="니즈확인"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>__writes.at(-1).slice(0,2)),['expansion_pool_update','추가 니즈 확인']);
  assert.equal(await page.locator('#expansionV2 .ddv-stages .cur').innerText(),'니즈 확인');
  assert.equal(await page.locator('#expansionV2 .xdv-steps .cur span').innerText(),'지금 · 니즈 확인');
  assert.equal(await page.locator('#expansion-v2 .plv-ghead[data-plv-group="need"] span').innerText(),'2건','목록도 함께 갱신');
  /* 전환 = 기존 견적 확인 · 전환창 */
  await page.locator('#expansionV2 .xdv-convert').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>expansionRecords().find(r=>r.id===window.__new).sourceOpportunityId),'w2','기존 전환창이 이 고객으로 열림');assert.equal(await page.locator('#expansionV2.on').count(),0);
  /* 서버 이력 도착이 작성 중인 입력을 지우지 않고, 단지 연락은 한 요청으로 저장한다. */
  await page.evaluate(()=>{
   const prior=OpsStore.rpc;window.__groupWrites=[];window.__resolveExpansion=null;
   OpsStore.rpc=async(name,p)=>{if(name==='crm_expansion_contact_context_v1')return new Promise(resolve=>{window.__resolveExpansion=resolve;});if(name==='crm_expansion_contact_write_v1'){__groupWrites.push(p);return {ok:true,operation:name,request_id:p.request_id,source_opportunity_id:p.source_opportunity_id,target_ids:p.target_ids,linked_count:p.target_ids.length,event:{id:'group-event',source_opportunity_id:p.source_opportunity_id,note:p.note,actor:'송보람',kind:'접촉·니즈 기록',occurred_at:new Date().toISOString()}};}return prior(name,p);};
   const records=expansionRecords(),r=records.find(x=>x.sourceOpportunityId==='w1'),s=records.find(x=>x.sourceOpportunityId==='w2');G.xbSiteNote={ids:[r.id,s.id]};ExpansionPool.open(r.id);
  });
  await page.waitForFunction(()=>window.__resolveExpansion);
  await page.locator('#expansionV2 .idv-input textarea').fill('단지 연락 작성 중');
  await page.evaluate(()=>__resolveExpansion({ok:true,events:[{id:'linked-read',source_opportunity_id:'w1',note:'기존 연결 기록',kind:'접촉·니즈 기록',occurred_at:new Date().toISOString()}],dispatches:[]}));
  await page.waitForFunction(()=>document.querySelector('#expansionV2 .idv-thread').textContent.includes('기존 연결 기록'));
  assert.equal(await page.locator('#expansionV2 .idv-input textarea').inputValue(),'단지 연락 작성 중');
  await page.locator('#expansionV2 .idv-save').click();await page.waitForFunction(()=>__groupWrites.length===1);
  assert.deepEqual(await page.evaluate(()=>__groupWrites.map(x=>[x.source_opportunity_id,x.target_ids,x.note])),[['w1',['w2'],'단지 연락 작성 중']]);
  await page.evaluate(()=>ExpansionV2.close());
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.expansionV2Off=true;paintExpansion();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#expansion-v2').count(),0);assert.equal(await page.locator('#expansion-root .exp-hero').count(),1,'끄면 예전 화면');
  await page.evaluate(()=>ExpansionPool.open('e1'));await page.waitForTimeout(200);assert.equal(await page.locator('#expansionManager.on').count(),1,'끄면 예전 상세창');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',list_frame:true,year_pills:true,diagnosis:true,groups:true,owner_brand_shared:true,detail_three_columns:true,note_rpc:true,status_save:true,convert_existing_flow:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
