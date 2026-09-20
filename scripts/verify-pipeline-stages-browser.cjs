'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const srv=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);});await new Promise(r=>srv.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});try{const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+srv.address().port+'/crm.html');await page.waitForFunction(()=>window.PipelineWorkspace);
await page.evaluate(()=>{AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};LOCAL={deals:{},inquiries:{},expansionPool:[]};B={deals:[{id:'sent-1',site:'발송 후속 현장',brand:'POUR솔루션',assignee:'이필선',code:'sent',stage_code:'sent',grp:'컨설팅·견적',amt:10000000,created:'2024-01-01',stageHistory:[{from:'consulting',to:'sent',at:'2026-09-01'}]},{id:'rel-1',site:'관계 유지 현장',brand:'POUR솔루션',assignee:'김성민',code:'silent',grp:'영업·관리',amt:20000000,created:'2026-09-01'},{id:'won-1',site:'기존 수주 현장',brand:'POUR솔루션',assignee:'이필선',code:'won',outcome:'won',grp:'수주 성공',won_amount:8000000,completion_date:'2026-09-01',closed_at:'2026-09-01',created:'2024-01-01'}],inquiries:[],inquiryTrash:[]};G.brand=G.rep=G.workFilter='전체';G.q='';G.year='2026';window.__writes=[];pushWrite=(...x)=>__writes.push(x);window.__open=drwDeal;drwDeal=s=>window.__selected=JSON.parse(s).id;window.__renderDetail=renderDetail;renderDetail=()=>{window.__selected=CUR_DETAIL.item.id;};document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';PipelineWorkspace.open('all');});
// 칸반 단일 뷰: 7열(수주·실주 포함, 확장 제외)이 가로 스크롤 없이 들어오고 금액·KPI가 항상 보인다.
assert.equal(await page.locator('#pipeline-stage-menu button').count(),7);
assert.equal(await page.locator('.ps-kanban>.ps-kcol').count(),7);
assert.deepEqual(await page.locator('.ps-kanban .ps-ktitle').allTextContents(),['01 컨설팅 설계단계','02 자료 발송완료','03 관계관리','04 경쟁·임박·입찰','05 계약·시공','06 수주','07 실주']);
assert.equal(await page.locator('.ps-kpis .ps-kpi').count(),5);
assert.match(await page.locator('.ps-kpis').innerText(),/진행 금액/);
assert.equal(await page.locator('.ps-kcard').count(),3);
assert.match(await page.locator('.ps-kanban').innerText(),/2,000만/);
assert.equal(await page.locator('.ps-view').count(),0);
assert.equal(await page.locator('.ps-board').count(),0);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'kanban fits viewport width');
// 확장관리는 파이프라인 하위가 아니라 사이드바 단독 메뉴(파이프라인 아래, 경남지사 위)다.
assert.equal(await page.locator('.menu>.mi[data-p="expansion"]:not([hidden])').count(),1);
assert.equal(await page.evaluate(()=>{const m=[...document.querySelectorAll('.menu .mi')].map(n=>n.dataset.p);return m.indexOf('expansion')>m.indexOf('pipe')&&m.indexOf('expansion')<m.indexOf('gyeongnam');}),true);
// 카드 전체가 클릭 대상 — 누르면 해당 영업 상세가 열린다.
await page.locator('.ps-kcard').first().click();
assert.equal(await page.evaluate(()=>window.__selected),'sent-1');
await page.evaluate(()=>{window.__selected=null;});
await page.locator('#pipeline-stage-menu [data-value="sent"]').click();await page.locator('.menu [data-p="pipe"]').click();assert.equal(await page.evaluate(()=>G.pipelineStage),'all');assert.equal(await page.locator('#pipeline-stage-menu [data-value="all"]').count(),0);await page.locator('#pipeline-stage-menu [data-value="sent"]').click();assert.equal(await page.locator('.sw-work-table tbody tr[data-deal]').count(),1);assert.match(await page.locator('.sw-workspace').innerText(),/발송 후속 현장/);assert.equal(await page.locator('#pipeline-stage-menu .selected').getAttribute('aria-current'),'page');await page.locator('.sw-work-table [data-ps-action="record"]').first().click();assert.equal(await page.evaluate(()=>window.__selected),'sent-1');
await page.evaluate(()=>{const d=B.deals[0];d.code=d.stage_code='rapport';d.stageHistory.push({from:'sent',to:'rapport',at:'2026-09-20'});PipelineWorkspace.refresh();});assert.equal(await page.locator('.sw-work-table tbody tr[data-deal]').count(),0);assert.match(await page.locator('#pipeline-stage-menu [data-value="relationship"]').innerText(),/2$/);await page.locator('#pipeline-stage-menu [data-value="relationship"]').click();assert.equal(await page.locator('.sw-work-table tbody tr[data-deal]').count(),2);assert.equal(await page.evaluate(()=>B.deals[0].stageHistory.length),2);
await page.evaluate(()=>goPage('dash'));assert.equal(await page.locator('#si-dash [data-si-action="stage"]').count(),8);await page.locator('#si-dash [data-sf-type="INTERNAL"]').click();await page.locator('#si-dash [data-sf-owner="이필선"]').click();await page.locator('#si-dash [data-si-action="stage"][data-value="relationship"]').click();assert.equal(await page.evaluate(()=>SalesScope.state().owner),'이필선');assert.equal(await page.locator('.sw-work-table tbody tr[data-deal]').count(),1);
// Pending transitions remain in the confirmed source group; a later ACK supersedes old failures.
assert.deepEqual(await page.evaluate(()=>{const old=Phase1.queue.list;Phase1.queue.list=()=>[{object_id:'sent-1',operation:'transition',status:'uncertain',payload:{from:'sent'}}];const pending=PipelineWorkspace.rows()[0].group;Phase1.queue.list=()=>[{object_id:'sent-1',operation:'transition',status:'rejected',payload:{from:'sent'}},{object_id:'sent-1',operation:'transition',status:'done'}];const done=PipelineWorkspace.rows()[0].group;Phase1.queue.list=old;return {pending,done};}),{pending:'sent',done:'relationship'});

await page.evaluate(()=>{window.__oldQueueList=Phase1.queue.list;const d=B.deals[0];d.code=d.stage_code='bidding';d.stageHistory.push({from:'rapport',to:'bidding',at:'2026-09-20'});CUR_DETAIL={kind:'deal',key:dealKey(d),item:d};Phase1.queue.list=()=>[{request_id:'stage-confirmed',object_id:d.id,operation:'transition',payload:{from:'rapport',to:'bidding'},status:'done',ack:{ok:true,to_stage:'bidding',from_stage:'rapport',stage_contexts:{},stage_history_id:'test-transition',stage_entered_at:'2026-09-20'}}];window.dispatchEvent(new Event('phase1:queue'));});await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>G.pipelineStage),'competition');assert.match(await page.locator('.sw-workspace').innerText(),/발송 후속 현장/);await page.evaluate(()=>{Phase1.queue.list=window.__oldQueueList;});
for(const width of [1920,1440,1024,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
await page.setViewportSize({width:1440,height:1000});if(process.env.PIPELINE_SCREENSHOT)await page.screenshot({path:process.env.PIPELINE_SCREENSHOT});
await page.evaluate(()=>{ME={id:'rep',name:'김성민',role:'rep'};window.__selected=null;});await page.locator('.sw-agenda [data-ps-action="record"]').first().click();assert.equal(await page.evaluate(()=>window.__selected),null);await page.evaluate(()=>PipelineWorkspace.open('all'));assert.equal(await page.evaluate(()=>PipelineWorkspace.rows().every(x=>x.owner==='김성민')),true);assert.deepEqual(await page.evaluate(()=>__writes),[]);assert.deepEqual(errors,[]);
// Each stage has its own work surface; expansion reuses the existing pool and manager.
await page.evaluate(()=>{ME={id:'admin',name:'송보람',role:'admin'};SalesScope.change('owner','전체');G.q='';G.workFilter='전체';});
await page.evaluate(()=>{
 const today=new Date().toLocaleDateString('en-CA'),month=today.slice(0,7);G.lossResultMonth=month;G.contractResultMonth=month;
 for(const code of ['consulting','sent','rapport','contract','lost'])B.deals.push({id:'workspace-'+code,site:'검증 '+code,brand:'POUR솔루션',assignee:'이필선',code,stage_code:code,amt:10000000,created:today,closed_at:code==='lost'?today:null,lost_reason:code==='lost'?'가격 열세':null,stage_contexts:{[code]:{fields:{quote_request:'옥상 진단 검토',quote_due:today,sent_date:today,followup_date:today,reaction:'검토중',materials:['견적서'],contract_status:'체결 완료',contract_date:today,contract_amount:300000000}}}});
});
for(const key of ['consulting','sent','relationship','competition','construction','won','lost']){
 await page.evaluate(k=>PipelineWorkspace.open(k),key);
 assert.equal(await page.locator('[data-workspace="'+key+'"]').count(),1);
 assert.equal(await page.locator('#pipeline-stage-root .ps-status').count(),0);
 assert.equal(await page.locator('#pipeline-stage-root .ps-metrics').count(),0);
 assert.ok(await page.locator('[data-workspace="'+key+'"] [data-deal]').count()>0);
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.setViewportSize({width:1440,height:1000});
 if(key==='sent'){assert.match(await page.locator('.sw-workspace').innerText(),/검토중/);assert.match(await page.locator('.sw-workspace').innerText(),/오늘 확인/);if(process.env.STAGE_SCREENSHOT)await page.screenshot({path:process.env.STAGE_SCREENSHOT});}
 if(key==='lost')assert.match(await page.locator('.sw-loss-reasons').innerText(),/가격 열세/);
 if(key==='construction')assert.doesNotMatch(await page.locator('.sw-contract-state').innerText(),/영업실적 확정/);
 if(key==='won')assert.match(await page.locator('.sw-result').innerText(),/원장을 확인하지 못했습니다/);
}
await page.evaluate(()=>PipelineWorkspace.open('expansion'));
assert.equal(await page.evaluate(()=>G.page),'expansion');
assert.equal(await page.locator('#expansion-root .exp-year-tabs').count(),1);
assert.equal(await page.locator('#expansion-root .exp-view-switch').count(),1);
await page.getByRole('button',{name:'☷ 전체목록',exact:true}).click();
assert.equal(await page.locator('#expansion-root .exp-compact-list').count(),1);
await page.locator('.menu [data-p="pipe"]').click();
assert.equal(await page.evaluate(()=>G.pipelineStage),'all');
assert.deepEqual(errors,[]);
console.log('PASS pipeline stages: seven-column kanban with amounts/KPIs, standalone expansion menu, dedicated queues, shared updates, history, dashboard filters, pending ACK, role boundary and responsive layout');
}finally{await browser.close();await new Promise(r=>srv.close(r));}})().catch(e=>{console.error(e);process.exitCode=1});
