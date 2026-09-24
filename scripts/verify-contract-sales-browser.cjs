'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const srv=http.createServer((req,res)=>{const file=path.resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'crm.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}fs.createReadStream(file).pipe(res)});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+srv.address().port+'/crm.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.ContractSalesUI);
  await page.evaluate(async()=>{
   ME={id:'contract-admin',name:'송보람',role:'admin'};TOKEN='synthetic';LOCAL={deals:{},inquiries:{},expansionPool:[]};
   B={deals:[{id:'33333333-3333-4333-8333-333333333333',site:'계약실적 합성 현장',assignee:'정정훈',brand:'POUR솔루션',code:'construction',grp:'계약·시공',amt:900000000,created:'2024-01-01'}],inquiries:[],inquiryTrash:[]};
   const event=ContractSalesLedger.initial({deal_id:B.deals[0].id,event_id:'event-1',contract_signed:true,contract_date:'2026-09-18',contract_amount:300000000,sales_owner:'owner-hwang',sales_owner_name:'황윤선'});
   window.__contract={deal_id:event.deal_id,sales_owner:event.sales_owner,sales_owner_name:'황윤선',site:B.deals[0].site,brand:'POUR솔루션',version:1,balance:300000000,events:[event]};
   window.__requests=[];SB={rpc:async(name,p)=>{__requests.push(name);if(name==='crm_contract_sales_read_v1')return {data:{ok:true,policy:ContractSalesLedger.POLICY,items:[__contract],has_more:false}};throw new Error('unexpected write '+name)}};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   G.year='2026';G.quarter=0;G.rep='전체';goPage('dash');G.insights.year='2026';G.insights.month=9;await ContractSalesData.refresh();paint();
  });
  const amount=()=>page.locator('.apage.on .contract-sales-totals strong').last().innerText();
  assert.equal(await page.locator('#si-dash [data-value="contract"]').count(),2);assert.match(await page.locator('#si-dash [data-value="contract"]').first().innerText(),/매출[\s\S]*계약금액 기준/);
  assert.equal(await page.locator('#si-dash .contract-sales-totals strong').last().innerText(),'300,000,000원');
  await page.evaluate(()=>{B.deals[0].code='won';B.deals[0].assignee='이필선';paint()});
  assert.equal(await page.locator('#si-dash .contract-sales-totals strong').last().innerText(),'300,000,000원');
  await page.locator('#si-dash [data-sf-type="INTERNAL"]').click();await page.locator('#si-dash [data-sf-owner="황윤선"]').click();
  assert.equal(await page.locator('#si-dash .contract-sales-totals strong').last().innerText(),'300,000,000원');
  await page.evaluate(()=>goPage('perf'));assert.equal(await page.locator('#si-perf > .si-shell > .contract-sales-host .contract-sales-totals strong').last().innerText(),'300,000,000원');
  await page.locator('#si-perf [data-si-action="person"][data-value="황윤선"]').first().click();
  assert.equal(await page.evaluate(()=>G.page),'perf');assert.equal(await page.evaluate(()=>SalesScope.state().owner),'황윤선');
  assert.match(await page.locator('#si-perf .contract-sales-panel').innerText(),/300,000,000원/);
  await page.evaluate(()=>goPage('report'));assert.equal(await page.locator('#report-master > .contract-sales-host .contract-sales-totals strong').last().innerText(),'300,000,000원');
  await page.evaluate(()=>goPage('brief'));assert.match(await page.locator('#b-week > .contract-sales-host').innerText(),/계약 체결일 기준/);
  await page.evaluate(async()=>{__contract.events=ContractSalesLedger.append(__contract.events,{event_id:'event-2',expected_version:1,kind:'cancelled',effective_date:'2026-10-01',reason:'합성 취소'});__contract.version=2;__contract.balance=0;await ContractSalesData.refresh();goPage('dash');G.insights.month=10;paint()});
  assert.equal(await page.locator('#si-dash .contract-sales-totals strong').last().innerText(),'-300,000,000원');
  await page.evaluate(()=>{G.insights.month=9;paint()});assert.equal(await page.locator('#si-dash .contract-sales-totals strong').last().innerText(),'300,000,000원');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll(".contract-sales-panel *")].filter(n=>n.getBoundingClientRect().right>innerWidth).map(n=>n.tagName+"."+n.className).slice(0,10)}))))}
  await page.evaluate(async()=>{SB.rpc=async()=>({error:{message:'offline'}});await ContractSalesData.refresh()});assert.match(await page.locator('#si-dash .contract-sales-host').innerText(),/확인하지 못했습니다/);assert.equal(await page.locator('#si-dash .contract-sales-totals').count(),0);
  await page.evaluate(()=>ContractSalesUI.editor(B.deals[0]));
  await page.waitForFunction(()=>document.querySelector('.contract-sales-shade [role="status"]')?.textContent.includes('확인하지 못했습니다'));
  assert.equal(await page.locator('.contract-sales-shade button[type="submit"]').count(),0);
  await page.evaluate(()=>{SB.rpc=async()=>({data:{ok:true,policy:ContractSalesLedger.POLICY,items:[__contract],has_more:false}})});
  await page.getByRole('button',{name:'다시 조회',exact:true}).click();
  await page.getByRole('heading',{name:'계약실적 기록',exact:true}).waitFor();
  assert.match(await page.locator('.contract-sales-dialog').innerText(),/황윤선/);
  await page.locator('.contract-sales-dialog [data-close]').click();
  assert.equal(await page.evaluate(()=>__requests.every(n=>n==='crm_contract_sales_read_v1')),true);assert.deepEqual(errors,[]);
  console.log('PASS contract sales: signed amount, frozen owner, all reporting surfaces, cancellation periods, unavailable state and responsive layout');
 }finally{await browser.close();await new Promise(r=>srv.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
