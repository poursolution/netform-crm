'use strict';

// Localhost-only interaction regression with synthetic expansion data. No CRM reads or writes.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
function server(){return http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),rel=pathname==='/'?'crm.html':pathname.replace(/^\/+/,''),target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ExpansionPool&&typeof ExpansionPool.open==='function');
  await page.evaluate(()=>{
   const row={id:'exp-test-1',sourceOpportunityId:'won-test-1',site:'[서울 마포] 테스트아파트',owner:'황윤선',sourceWorkSummary:'옥상 방수공사',wonAmount:73000000,completionDate:'2026-04-22',nextContactAt:'2026-09-20',status:'관리대상',candidates:['타공종 확인','유지보수 확인'],needNote:'',version:1};
   expansionRecords=()=>[row];
   expansionSourceDeal=()=>({id:'won-test-1',assignee:'황윤선',contract_date:'2026-02-10'});
   B={deals:[],inquiries:[],expansion_events:[{source_opportunity_id:'won-test-1',occurred_at:'2026-09-08',kind:'접촉',note:'관리소장 통화',actor:'황윤선'}],expansion_quote_dispatches:[]};
   G.page='expansion';G.expansionOwner='전체';G.expansionYear='전체';G.expansionStatusFilter='전체';G.expansionDueFilter='전체';G.expansionQuery='';G.expansionView='board';
   document.getElementById('authGate').classList.remove('on');
   document.querySelectorAll('.apage').forEach(node=>node.classList.remove('on'));
   document.getElementById('pg-expansion').classList.add('on');
   ExpansionPool.render();
  });
  const card=page.locator('.exp-board-launch').first();
  assert.equal(await card.count(),1,await page.locator('#expansion-root').innerHTML());
  const boardHeight=await page.locator('.exp-board-column').first().evaluate(node=>node.getBoundingClientRect().height);
  assert.equal(await page.locator('.exp-board-card details').count(),0);
  await card.click();
  const modal=page.locator('#expansionManager');
  assert.equal(await modal.getAttribute('aria-hidden'),'false');
  assert.equal(await modal.locator('[role="dialog"]').getAttribute('aria-modal'),'true');
  assert.match(await modal.locator('#expansionManagerTitle').textContent(),/테스트아파트/);
  assert.equal(await modal.locator('.exp-manage-history li').count(),1);
  assert.equal(await modal.locator('.exp-manage-actions input[type="date"]').count(),1);
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('exp-manage-close')),true);
  assert.equal(await page.locator('.exp-board-column').first().evaluate(node=>node.getBoundingClientRect().height),boardHeight);
  await modal.locator('.exp-manage-close').click();
  assert.equal(await modal.getAttribute('aria-hidden'),'true');
  await page.waitForFunction(()=>document.activeElement.classList.contains('exp-board-launch'));
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('exp-board-launch')),true);
  console.log(JSON.stringify({status:'PASS',inline_details:0,modal_open:true,actions_in_modal:true,history_in_modal:true,board_height_stable:true,focus_restored:true,network_scope:'localhost-only',business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
