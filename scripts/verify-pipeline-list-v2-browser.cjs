'use strict';
/* 파이프라인 단계별 목록 v2 검사(2026-10-01 디자인 핸드오프 pipeline ①):
   공통 필터줄 → 단계 안내 줄(하위 필터·보드/리스트) → 담당자별 칩 → 묶음 표. 행=기존 상세, 끄면 예전 화면 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineListV2&&window.PipelineWorkspace&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-40),code,stage_code:code,grp:'영업·관리',amt:2e8},extra||{});
   B={deals:[
    deal('c-over','기한 지난 컨설팅','이필선','consulting',{next_action:{id:'n1',text:'통화 후속 확인',due:day(-9),status:'open'}}),
    deal('c-over2','더 오래 지난 컨설팅','이필선','consulting',{next_action:{id:'n1b',text:'재연락',due:day(-20),status:'open'}}),
    deal('c-none','할 일 없는 컨설팅','','consulting',{brand:'석민이앤씨'}),
    deal('c-ok','진행 중 컨설팅','황윤선','consulting',{next_action:{id:'n2',text:'현장 실사',due:day(5),status:'open'},stage_contexts:{consulting:{fields:{quote_request:'옥상 방수 + 균열 보수',quote_due:day(6)}}}}),
    deal('s-over','후속 지난 발송','황윤선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-30),materials:['견적서'],followup_date:day(-12)}}}}),
    deal('s-none','후속일 없는 발송','이필선','sent'),
    deal('r-sil','침묵 현장','황윤선','silent',{next_action:{id:'n3',text:'재통화 시도',due:day(-29),status:'open'}}),
    deal('r-rap','유대 현장','이필선','rapport',{next_action:{id:'n4',text:'안부 전화',due:day(10),status:'open'}}),
    deal('k-bid','입찰 현장','황윤선','bidding'),
    deal('k-pt','경쟁 현장','이필선','compete',{stage_contexts:{compete:{fields:{competition_type:'PT',competitor:'타사 A',meeting_date:day(3)}}}}),
    deal('t-con','계약 대기 현장','이필선','contract'),
    deal('t-build','시공 현장','황윤선','construction',{stage_contexts:{contract:{fields:{contract_status:'체결 완료',contract_date:day(-20),contract_amount:3e8}},construction:{fields:{start_date:day(7)}}}}),
    deal('w-1','수주 현장','이필선','won',{outcome:'won',won_amount:8e6,closed_at:day(-10),completion_date:day(-10)}),
    deal('l-none','사유 없는 실주','이필선','lost',{outcome:'lost',closed_at:day(-3),stageHistory:[{from:'compete',to:'lost',at:day(-3)}]}),
    deal('l-done','사유 있는 실주','황윤선','lost',{outcome:'lost',closed_at:day(-5),lost_reason:'가격 열세',stageHistory:[{from:'sent',to:'lost',at:day(-5)}]})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};
   PipelineWorkspace.open('consulting');
  });
  await page.waitForTimeout(200);
  const v=page.locator('#pipeline-list-v2');
  /* 틀: 공통 필터줄 + 안내 줄 + 담당자별 칩 + 묶음 표. 예전 필터 박스·현황판·분홍 띠 없음 */
  assert.equal(await v.count(),1);assert.equal(await v.getAttribute('data-workspace'),'consulting');
  assert.equal(await page.locator('#pg-pipe>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.locator('#pipeline-stage-root .ps-heading, #pipeline-stage-root .ps-filters, #pipeline-stage-root .sw-work-table, #pipeline-stage-root .sales-filterbar').count(),0,'예전 머리·필터·표 없음');
  assert.equal(await v.locator('h2').count(),0,'본문 큰 제목 없음');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'컨설팅 설계');
  assert.match(await v.locator('.plv-intro').innerText(),/컨설팅 설계\s*4건[\s\S]*보드\s*리스트/);
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['현장 · 담당','고객 요구','견적 예정','예상 금액','다음 업무','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['다음 업무 기한 초과','다음 할 일 없음','진행 중']);
  assert.deepEqual(await v.locator('.plv-ghead span').allInnerTexts(),['2건','1건','1건']);
  /* 묶음 안은 기한이 많이 지난 순, 미배정은 빨강, 빈 값은 주황 안내 */
  assert.equal(await v.locator('.plv-row').first().locator('.plv-site b').innerText(),'더 오래 지난 컨설팅');
  assert.match(await v.locator('.plv-row').first().innerText(),/재연락[\s\S]*20일 지남[\s\S]*처리/);
  assert.equal(await v.locator('.plv-row[data-deal="c-none"] .plv-site small.none').innerText(),'미배정');
  assert.match(await v.locator('.plv-row[data-deal="c-none"]').innerText(),/고객 요구 미확인[\s\S]*다음 할 일 등록/);
  assert.match(await v.locator('.plv-row[data-deal="c-ok"]').innerText(),/옥상 방수 \+ 균열 보수[\s\S]*현장 실사/);
  /* 담당자별 칩: 늦음 많은 순, 0이면 늦음 숨김, 누르면 공통 필터줄과 같은 상태, 다시 누르면 해제 */
  const chips=await v.locator('.plv-chip').allInnerTexts();
  assert.match(chips[0],/^이필선 2 · 늦음 2$/);assert.equal(chips.some(c=>/황윤선 1$/.test(c)),true,'늦음 0은 숨김 '+chips.join('|'));
  await v.locator('.plv-chip',{hasText:'황윤선'}).click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>SalesScope.state().owner+'|'+document.querySelector('#pg-pipe>.cf-bar [data-cf="owner"]').value),'황윤선|황윤선');
  assert.equal(await v.locator('.plv-row').count(),1);assert.equal(await v.locator('.plv-chip.on').count(),1);
  assert.equal(await v.locator('.plv-empty').count(),2,'빈 묶음 안내');
  await v.locator('.plv-chip.on').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>SalesScope.state().owner+'|'+SalesScope.state().assignment),'전체|all');assert.equal(await v.locator('.plv-row').count(),4,'해제하면 미배정도 다시 보임');
  /* 브랜드 알약(공통) */
  await page.locator('#pg-pipe>.cf-bar [data-sf-brand="석민이앤씨"]').click();await page.waitForTimeout(150);
  assert.equal(await v.locator('.plv-row').count(),1);
  await page.locator('#pg-pipe>.cf-bar [data-sf-brand="전체"]').click();await page.waitForTimeout(150);
  if(shot)await page.screenshot({path:shot+'-consulting.png'});
  /* 행 = 기존 상세, [처리] = 기존 상세 + 작업창 */
  await v.locator('.plv-row[data-deal="c-ok"] .plv-site').click();assert.equal(await page.evaluate(()=>window.__open),'c-ok');
  /* 단계별 열·묶음 */
  const expect={
   sent:[['현장 · 담당','발송일 · 자료','고객 반응','후속 확인','예상 금액','다음 업무',''],['후속 기한 초과','후속일 미지정','후속 예정']],
   relationship:[['현장 · 담당','구분','마지막 접촉','다음 연락','예상 금액','다음 할 일',''],['연락 초과','다음 연락 미지정','진행 중']],
   competition:[['현장 · 담당','구분','결정 예정','경쟁사','예상 금액','준비 현황 · 다음',''],['결정일 미등록','결정일 등록']],
   construction:[['현장 · 담당','진행','계약 상태','계약일','계약 금액','착공',''],['계약 체결 대기','계약 확정 · 시공 진행']],
   won:[['현장 · 담당','계약일','계약 금액','이긴 이유','다음 기회','준공일',''],['계약 정보 미기록','확장 기회','완료']],
   lost:[['현장 · 담당','실주일','어디서','사유 · 경쟁사','배운 점','재접촉',''],['사유 미기록','재접촉 가능','종결']]
  };
  for(const [key,[cols,groups]] of Object.entries(expect)){
   await page.evaluate(k=>PipelineWorkspace.open(k),key);await page.waitForTimeout(120);
   assert.equal(await v.getAttribute('data-workspace'),key);
   assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),cols,key);
   assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),groups,key);
   assert.equal(await v.locator('.plv-row').count(),key==='won'?1:2,key+' 건수');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,key+' 넘침 없음');
   if(shot)await page.screenshot({path:shot+'-'+key+'.png'});
  }
  /* ② 단계 진단: 숫자 4개 · 분석 카드 3개 · 행동 카드 — 지금 목록에서 계산, 기록 없는 항목은 그대로 '미기록' */
  assert.equal(await v.locator('.pd.pd-red .pd-kpi').count(),4);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['왜 졌나','어디서 졌나','누구에게 졌나']);
  assert.match(await v.locator('.pd-kpis').innerText(),/사유 미기록\s*50%\s*1건/);
  assert.match(await v.locator('.pd-card').nth(0).innerText(),/가격 열세\s*1/);
  assert.match(await v.locator('.pd-card').nth(1).innerText(),/경쟁·입찰\s*1[\s\S]*자료 발송완료\s*1/);
  assert.match(await v.locator('.pd-card').nth(2).innerText(),/경쟁사가 기록된 실주 건이 없습니다/);
  assert.match(await v.locator('.pd-action').innerText(),/그래서 뭘 해야 하나[\s\S]*가격 열세 1건[\s\S]*사유 미기록 1건/);
  await v.locator('.pd-toggle').click();await page.waitForTimeout(120);
  assert.equal(await v.locator('.pd-card').count(),0,'접으면 숫자만');assert.equal(await v.locator('.pd-kpi').count(),4);
  await v.locator('.pd-toggle').click();await page.waitForTimeout(120);
  for(const [k,titles,accent] of [['consulting',['왜 멈춰 있나','어디서 들어왔나','누구에게 쌓였나'],'blue'],['competition',['무엇이 준비 안 됐나','어떤 방식인가','누구와 붙었나'],'blue'],['won',['왜 이겼나','어디서 왔나','누구를 이겼나'],'green']]){
   await page.evaluate(x=>PipelineWorkspace.open(x),k);await page.waitForTimeout(120);
   assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),titles,k);assert.equal(await v.locator('.pd.pd-'+accent).count(),1,k);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,k+' 진단 넘침 없음');
   if(shot)await page.screenshot({path:shot+'-diag-'+k+'.png',fullPage:true});
  }
  assert.match(await page.evaluate(()=>{PipelineWorkspace.open('consulting');return document.querySelector('#pipeline-list-v2 .pd').innerText;}),/이 단계\s*4건[\s\S]*다음 할 일 없음\s*1건[\s\S]*고객 요구 미확인\s*3[\s\S]*경로 미기록\s*4[\s\S]*이필선[\s\S]*2/);
  assert.match(await page.evaluate(()=>{PipelineWorkspace.open('competition');return document.querySelector('#pipeline-list-v2 .pd').innerText;}),/타사 A[\s\S]*1[\s\S]*미기록[\s\S]*모름/);
  await page.evaluate(()=>PipelineWorkspace.open('lost'));await page.waitForTimeout(120);
  /* 과제 등록: 저장소가 있으면 버튼 → 등록 창 → 서버 저장 → [수정] + 등록됨 표시 (쓰기는 가로챈다) */
  assert.equal(await v.locator('.pd-task .it-btn').count(),0,'로그인·저장소 없으면 버튼 없음');
  await page.evaluate(()=>{window.__tasks=[];SB={rpc:async(name,args)=>{if(name==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:__tasks}};if(name==='crm_improvement_task_save_v1'){const t=Object.assign({id:'t-'+(__tasks.length+1),status:'open'},args.p);__tasks.push(t);return {data:{ok:true,task:t}};}return {error:{code:'PGRST202'}};}};PipelineWorkspace.open('lost');return ImprovementTasks.load(true);});await page.waitForTimeout(400);
  assert.equal(await v.locator('.pd-task .it-btn[data-it="new"]').count(),2);
  assert.match(await v.locator('.pd-action .it-count').innerText(),/등록된 과제\s*0/);
  await v.locator('.pd-task .it-btn[data-it="new"]').first().click();
  const dlg=page.locator('#itDialog .it-box');assert.equal(await dlg.count(),1);
  assert.match(await dlg.locator('header').innerText(),/개선 과제 등록 · 실주/);assert.match(await dlg.locator('.it-basis').innerText(),/(가격 열세|사유 미기록) 1건/);
  assert.equal((await dlg.locator('#it-title').inputValue()).length>5,true,'과제 미리 채움');assert.match(await dlg.locator('#it-due').inputValue(),/^\d{4}-\d{2}-\d{2}$/);
  await dlg.locator('#it-owner').fill('영업팀');await dlg.locator('[data-itd="save"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#itDialog').count(),0);
  assert.deepEqual(await page.evaluate(()=>__tasks.map(t=>[t.scope,t.owner,t.status,Array.isArray(t.notify)])),[['pipeline:lost','영업팀','open',true]]);
  assert.equal(await v.locator('.pd-task .it-btn[data-it="edit"]').count(),1);assert.match(await v.locator('.pd-task .it-done').innerText(),/등록됨 · 영업팀 · \d{2}\/\d{2}까지/);
  assert.match(await v.locator('.pd-action .it-count').innerText(),/등록된 과제\s*1/);
  await v.locator('.pd-action .it-count').click();assert.match(await page.locator('#itDialog').innerText(),/1건 진행 중[\s\S]*영업팀/);await page.locator('#itDialog [data-itd]').click();
  await page.evaluate(()=>{SB=null;PipelineWorkspace.open('lost');});await page.waitForTimeout(150);
  /* 실주: 직전 단계 배지·사유, 사유 없는 건은 '사유 미기록' 묶음 */
  assert.match(await v.locator('.plv-row[data-deal="l-none"]').innerText(),/경쟁·입찰[\s\S]*미기록/);
  assert.match(await v.locator('.plv-row[data-deal="l-done"]').innerText(),/자료 발송완료[\s\S]*가격 열세/);
  /* 하위 필터(관계관리): 알약으로 좁힌다 */
  await page.evaluate(()=>PipelineWorkspace.open('relationship'));await page.waitForTimeout(120);
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 2','유대강화 1','침묵관리 1','대기고객 0']);
  assert.match(await v.locator('.plv-row[data-deal="r-sil"]').innerText(),/침묵관리[\s\S]*29일 지남/);
  await v.locator('.plv-pills [data-value="rapport"]').click();await page.waitForTimeout(120);
  assert.equal(await v.locator('.plv-row').count(),1);assert.equal(await v.locator('.plv-row').getAttribute('data-deal'),'r-rap');
  await v.locator('.plv-pills [data-value="all"]').click();
  /* 사이드바: 색 점 + 이름 + 건수, 선택 표시 */
  assert.equal(await page.locator('#pipeline-stage-menu .plv-mi').count(),7);
  assert.match(await page.locator('#pipeline-stage-menu .plv-mi.selected').innerText(),/관계관리\s*2/);
  /* 보드 → 전체 칸반(필터줄 숨김), 다시 단계 → 목록 */
  await v.locator('.plv-view [data-value="all"]').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('.ps-kanban.pk').count(),1);assert.equal(await page.locator('#pg-pipe>.cf-bar:not([hidden])').count(),0,'칸반에서는 공통 필터줄 숨김');
  /* 끄면 예전 단계 화면 */
  await page.evaluate(()=>{G.pipeListV2Off=true;PipelineWorkspace.open('sent');});await page.waitForTimeout(150);
  assert.equal(await page.locator('#pipeline-list-v2').count(),0);assert.equal(await page.locator('.sw-workspace[data-workspace="sent"]').count(),1);
  await page.evaluate(()=>{G.pipeListV2Off=false;PipelineWorkspace.open('sent');});await page.waitForTimeout(150);
  assert.equal(await page.locator('#pipeline-list-v2').count(),1);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',frame:true,groups:true,owner_chips_shared:true,brand_shared:true,row_opens_detail:true,seven_stages:true,sub_filter:true,sidebar:true,board_switch:true,diagnosis:true,task_register:true,legacy_switch:true,narrow:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
