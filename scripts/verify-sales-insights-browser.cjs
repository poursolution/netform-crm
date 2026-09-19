'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const srv=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'crm.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}fs.createReadStream(file).pipe(res)});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+srv.address().port+'/crm.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.SalesInsights);
  await page.evaluate(()=>{
   AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};LOCAL={deals:{},inquiries:{},expansionPool:[]};
   const yesterday=new Date(Date.now()-864e5).toISOString().slice(0,10),recent=new Date(Date.now()-864e5).toISOString();
   B={deals:[{id:'old',site:'오래된 진행 현장',assignee:'김성민',brand:'POUR솔루션',code:'consulting',grp:'컨설팅·견적',amt:120000000,created:'2024-01-01',lastMeaningfulContactAt:recent,nextActionObj:{text:'후속 통화',due:yesterday,status:'open'}},{id:'other',site:'다른 담당 현장',assignee:'이필선',brand:'POUR솔루션',code:'sent',grp:'컨설팅·견적',amt:30000000,created:'2026-09-01'},{id:'won',site:'기간 수주 현장',assignee:'김성민',brand:'POUR솔루션',code:'won',grp:'수주 성공',amt:900000000,won_amount:40000000,closed_at:'2026-09-05',created:'2024-02-01'}],inquiries:[{id:'inq',site:'<img src=x onerror=alert(1)> 문의',assignee:'김성민',brand:'POUR솔루션',created_at:'2026-09-03',status:'배정완료'}],inquiryTrash:[]};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   window.__writes=[];pushWrite=(...x)=>window.__writes.push(x);drwDeal=s=>window.__opened=JSON.parse(s).id;drwInq=s=>window.__opened=JSON.parse(s).id;
   goPage('dash');G.insights.year='2026';G.insights.month=9;SalesInsights.render();
  });
  assert.equal(await page.locator('#si-dash .si-kpis>button').count(),5);assert.equal(await page.locator('#d-money').isVisible(),false);
  let values=await page.evaluate(()=>{const s=SalesInsights.data();return {active:s.active.length,won:s.won.length,amount:s.wonAmount}});assert.deepEqual(values,{active:2,won:1,amount:40000000});
  await page.locator('#si-dash [data-si-filter="owner"]').selectOption('김성민');
  await page.locator('#si-dash [data-si-action="drill"][data-value="overdue"]').click();
  assert.equal(await page.locator('#si-control [data-si-filter="owner"]').inputValue(),'김성민');assert.equal(await page.locator('#si-control tbody tr').count(),1);
  await page.locator('#si-control [data-si-action="record"]').click();assert.equal(await page.evaluate(()=>window.__opened),'old');
  await page.locator('#si-control [data-si-action="navigate"][data-value="perf"]').click();
  await page.locator('#si-perf [data-si-action="view"][data-value="rep"]').click();assert.equal(await page.locator('#si-perf .si-kpis>button').count(),5);assert.equal(await page.locator('#si-perf [data-si-filter="month"]').inputValue(),'9');
  await page.locator('#si-perf [data-si-action="view"][data-value="lead"]').click();await page.locator('#si-perf [data-si-action="person"]').first().click();
  assert.equal(await page.getByRole('dialog',{name:'김성민 영업 현황'}).count(),1);
  const width=await page.locator('.si-person-box').evaluate(n=>n.getBoundingClientRect().width/innerWidth);assert.ok(width>=.90&&width<=.94);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement===Array.from(document.querySelectorAll('#si-person button')).at(-1)),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#si-person').count(),0);assert.equal(await page.evaluate(()=>document.activeElement.dataset.siAction),'person');
  for(const width of [1920,1440,1024,390]){await page.setViewportSize({width,height:1000});for(const route of ['dash','control','perf']){await page.evaluate(p=>goPage(p),route);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,route+' overflow '+width)}}
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>goPage('dash'));if(process.env.INSIGHTS_SCREENSHOT)await page.screenshot({path:process.env.INSIGHTS_SCREENSHOT,fullPage:true});
  await page.locator('#si-dash [data-si-action="drill"][data-value="inquiries"]').click();assert.equal(await page.locator('#si-control tbody img').count(),0);assert.match(await page.locator('#si-control tbody').innerText(),/<img/);
  // Current role is rechecked even if a stale admin row's button is still in the DOM.
  await page.evaluate(()=>{ME={id:'rep',name:'이필선',role:'rep'};window.__opened=null});await page.locator('#si-control [data-si-action="record"]').click();assert.equal(await page.evaluate(()=>window.__opened),null);
  await page.evaluate(()=>goPage('dash'));assert.equal(await page.evaluate(()=>SalesInsights.data().deals.every(d=>d.owner==='이필선')),true);
  await page.evaluate(()=>window.dispatchEvent(new Event('phase1:identity-cleared')));assert.equal(await page.locator('#si-dash button').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__writes),[]);assert.deepEqual(errors,[]);console.log('PASS sales insights: real router, period/amount scope, filters, drilldowns, modal focus, responsive layouts, escaping and current-role checks');
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
