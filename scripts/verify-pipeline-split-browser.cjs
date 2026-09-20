'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');fs.createReadStream(file).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});try{const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/crm.html');await page.waitForFunction(()=>window.SalesFilters);
await page.evaluate(()=>{AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};LOCAL={deals:{},inquiries:{},expansionPool:[]};const d=(id,owner,brand,code)=>({id,site:id,assignee:owner,brand,code,stage_code:code,amt:10000000,created:'2026-09-01'});B={deals:[d('A','황윤선','POUR솔루션','sent'),d('B','이필선','석민이앤씨','sent'),d('C','황윤선','POUR솔루션','rapport'),d('D','조성용','POUR솔루션','sent'),d('excluded','미등록 담당자','POUR솔루션','sent')],inquiries:[],inquiryTrash:[]};G.brand=G.rep=G.workFilter='전체';G.q='';window.__writes=[];pushWrite=(...x)=>__writes.push(x);document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';PipelineWorkspace.open('sent');});
const filter=()=>page.locator('.pg.on .sales-filterbar');
assert.equal(await page.locator('.ps-stage-selector button').count(),8);
await page.locator('.sw-card[data-deal="A"] [data-ps-action="record"]').click();
assert.equal(await page.locator('#ps-split-detail #detailView.ps-embedded').count(),1);
assert.equal(await page.locator('#ps-split-detail details,#ps-split-detail summary').count(),0);
assert.match(await page.locator('#dv-title').innerText(),/A/);
await page.locator('.sw-card[data-deal="A"] [data-ps-action="primary"]').click();
assert.equal(await page.locator('#detailAction').count(),1);
assert.equal(await page.locator('.ps-split-queue').isVisible(),true);
await page.locator('#dv-act-note').fill('저장 전 검증 메모');
await page.evaluate(()=>PipelineWorkspace.refresh());
assert.equal(await page.locator('#dv-act-note').inputValue(),'저장 전 검증 메모');
await page.getByRole('button',{name:'작업창 닫기',exact:true}).click();
await page.locator('.sw-card[data-deal="B"] [data-ps-action="record"]').click();
assert.match(await page.locator('#dv-title').innerText(),/B/);
assert.equal(await page.locator('#detailView').count(),1);
assert.equal(await page.locator('.dw-stage-badge').innerText(),'자료 발송완료');
assert.equal(await page.locator('[data-stage-primary]').innerText(),'후속 연락');
assert.ok(await page.locator('.dw-context-highlights').count());
await page.locator('.sw-card[data-deal="B"] [data-ps-action="next"]').click();
assert.equal(await page.locator('#detailAction #nextActionCard').count(),1);
await page.getByRole('button',{name:'작업창 닫기',exact:true}).click();
await page.locator('.sw-card[data-deal="B"] [data-ps-action="stage-edit"]').click();
assert.equal(await page.locator('#detailAction #dw-stage-editor').count(),1);
await page.getByRole('button',{name:'작업창 닫기',exact:true}).click();

for(const width of [1440,1024,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
await page.setViewportSize({width:1440,height:1000});
await page.screenshot({path:require('os').tmpdir()+'/pipeline-split.png'});


assert.equal(await page.locator('#pipeline-stage-root [data-sf-owner]').count(),0);
await page.locator('#pipeline-stage-root [data-sf-type="all"]').click();assert.match(await page.locator('#pipeline-stage-root [data-sf-owner="전체"]').innerText(),/3/);assert.equal(await page.locator('.sw-card').count(),3);
await page.locator('#pipeline-stage-root [data-sf-brand="POUR솔루션"]').click();
await page.locator('#pipeline-stage-root [data-sf-type="INTERNAL"]').click();
assert.match(await page.locator('#pipeline-stage-root [data-sf-owner="황윤선"]').innerText(),/1/);
await page.locator('#pipeline-stage-root [data-sf-owner="황윤선"]').click();assert.equal(await page.locator('.sw-card').count(),1);
await page.locator('[data-ps-filter="q"]').fill('A');await page.locator('[data-ps-filter="q"]').press('Enter');
await page.locator('#pipeline-stage-menu [data-value="relationship"]').click();assert.equal(await page.locator('[data-ps-filter="q"]').inputValue(),'');assert.equal(await page.locator('.sw-card').count(),1);assert.match(await page.locator('.sw-card').innerText(),/C/);
await page.evaluate(()=>goPage('dash'));assert.equal(await page.locator('#si-dash [data-sf-owner="황윤선"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#si-dash select[aria-label="브랜드"]').count(),0);
await page.locator('#si-dash [data-sf-type="EXTERNAL"]').click();assert.deepEqual(await page.locator('#si-dash [data-sf-owner]').evaluateAll(ns=>ns.map(n=>n.dataset.sfOwner)),['전체','전용성','조성용','고영운']);
await page.evaluate(()=>goPage('inq'));assert.equal(await page.locator('#pg-inq .sales-filterbar').count(),1);assert.equal(await page.locator('#pg-inq select[aria-label="문의 담당자"]').count(),0);
await page.evaluate(()=>PipelineWorkspace.open('expansion'));assert.equal(await page.locator('#expansion-root .sales-filterbar').count(),1);assert.equal(await page.locator('#expansion-root select[title*="선택한 담당자"]').count(),0);
for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
await page.evaluate(()=>{SalesScope.change('type','all');SalesScope.change('owner','전체');SalesFilterState.selectBrand('전체');B.deals=Array.from({length:125},(_,i)=>({id:'batch-'+i,site:'검증 '+i,assignee:'황윤선',brand:'POUR솔루션',code:'consulting',stage_code:'consulting',created:new Date().toLocaleDateString('en-CA')}));PipelineWorkspace.open('consulting');});
// 컨설팅 공통 틀: 탭·체크박스·일괄 도구 없이 «먼저 볼 것 → 정상 진행» 한 표, 상세는 팝업으로 연다.
assert.equal(await page.locator('.sw-triage-tabs').count(),0);
assert.equal(await page.locator('[data-triage-all],[data-batch]').count(),0);
assert.equal(await page.locator('#pipeline-stage-root .ps-stage-selector').count(),0,'consulting page has no split selector');
assert.equal(await page.locator('.sw-work-table tbody tr[data-deal]').count(),30);
assert.ok(await page.locator('.sw-group-row').count()>=1,'priority group separators');
assert.match(await page.locator('.ps-queue-count').innerText(),/30 \/ 125/);
await page.locator('.sw-work-table [data-ps-action="record"]').first().click();
assert.equal(await page.locator('#ps-split-detail #detailView.ps-embedded').count(),0,'consulting record opens the full detail popup');
assert.equal(await page.locator('#detailView').isVisible(),true);
assert.match(await page.locator('#dv-title').innerText(),/검증 /);
await page.locator('#detailView .backbtn').click();
assert.equal(await page.locator('#detailView').isVisible(),false);
await page.locator('.sw-pager [data-ps-action="page"]').last().click();
assert.equal(await page.locator('.sw-work-table tbody tr[data-deal]').count(),30);
for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
await page.setViewportSize({width:1440,height:1000});
assert.deepEqual(await page.evaluate(()=>__writes.filter(x=>x[0]!=='opportunity_touch')),[]);assert.deepEqual(errors,[]);console.log('Split workspace: actual detail and actions, chips, counts, stage navigation, analysis/inquiry/expansion integration and responsive layout passed');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
