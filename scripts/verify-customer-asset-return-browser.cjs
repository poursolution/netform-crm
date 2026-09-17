'use strict';

// Localhost-only regression for canonical Site return navigation. No CRM reads or writes.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const launchOptions=()=>({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
function server(){return http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),rel=pathname==='/'?'crm.html':pathname.replace(/^\/+/,''),target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch(launchOptions());
 try{
  const context=await browser.newContext();
  let externalRequests=0,businessWrites=0;
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();externalRequests++;if(/crm_write_command|n8n/i.test(url.href))businessWrites++;return route.abort()});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof paintSites==='function'&&typeof openSiteMaster==='function'&&window.DetailWorkspace);
  await page.evaluate(()=>{
   const deal=(id,address)=>({id,site_id:id.replace('deal','site'),site:'한빛아파트',address,brand:'POUR솔루션',work:'옥상 방수',work_name:'옥상 방수',assignee:'황윤선',code:'review',stage:'검토',grp:'Pipeline',amt:100000000,created:'2026-08-01',activities:[],nextActionObj:{text:'현장 확인',due:'2026-09-30',status:'open'}});
   const make=(key,address,dealId)=>{const d=deal(dealId,address);return {key,norm:'한빛아파트',name:'한빛아파트',names:{한빛아파트:1},canonicalAddress:address,addresses:[address],deals:[d],inquiries:[],open:[d],won:[],lost:[],brands:['POUR솔루션'],owners:['황윤선'],contacts:[],primary:null,totalAmount:100000000,wonAmount:0,openAmount:100000000,lostAmount:0,started:'2026-08-01',firstInquiry:'',firstDeal:'2026-08-01',lastAt:'2026-09-01',lastDays:16,health:'active'};};
   const customers=[make('id:site-suwon','경기 수원시 팔달구 1','deal-suwon'),make('id:site-yongin','경기 용인시 기흥구 2','deal-yongin')];
   B={deals:customers.flatMap(s=>s.deals),inquiries:[],activities:[],contacts:[],sites:[],dups:[],cleanup_events:[],cleanup_moves:[],expansion_pool:[],expansionPool:[],expansion_events:[],asq_projects:[]};
   siteMasterData=()=>customers;
   G.page='sites';G.q='';G.siteStatus='전체';G.siteBrand='전체';G.siteOwner='전체';G.siteAddress='전체';G.workFilter='전체';G.siteSort='관계우선';G.sitePage=1;G.sitePageKey=null;
   document.getElementById('authGate').classList.remove('on');
   document.querySelectorAll('.apage').forEach(node=>node.classList.remove('on'));
   document.getElementById('pg-sites').classList.add('on');
   paintSites();
  });
  const rows=page.locator('.site-table-row.data');
  assert.equal(await rows.count(),2);
  assert.deepEqual(await rows.evaluateAll(nodes=>nodes.map(n=>n.querySelector(':scope > span:first-child strong').textContent)),['한빛아파트','한빛아파트']);
  await page.evaluate(()=>openSiteMaster(SITE_MASTER_CACHE.findIndex(s=>s.key==='id:site-yongin')));
  await page.waitForSelector('#siteDrawer.on',{state:'attached'});
  await page.locator('#siteDrawerBody .dw-tabs [data-key="deals"]').click();
  assert.match(await page.locator('#siteDrawerBody .site-hero p').textContent(),/용인시/);
  await page.evaluate(()=>openSiteDeal(0));
  await page.waitForSelector('#detailView.on .dw-asset-back');
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),'deal-yongin');
  assert.equal(await page.evaluate(()=>Object.prototype.hasOwnProperty.call(CUR_DETAIL.item,'last_viewed_at')),false);
  await page.locator('#detailView .dw-asset-back').click();
  await page.waitForSelector('#siteDrawer.on');
  assert.match(await page.locator('#siteDrawerBody .site-hero p').textContent(),/용인시/);
  assert.equal(await page.locator('#siteDrawerBody .dw-tabs [data-key="deals"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>SITE_MASTER_CACHE.findIndex(s=>s.key==='id:site-yongin')),1);
  assert.equal(businessWrites,0);
  console.log(JSON.stringify({status:'PASS',duplicate_name_sites:2,restored_site_key:'id:site-yongin',restored_tab:'deals',blocked_external_reads:externalRequests,business_writes:businessWrites}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
