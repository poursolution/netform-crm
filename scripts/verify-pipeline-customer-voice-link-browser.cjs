'use strict';

// Localhost-only browser regression: no auth and no business write.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};

function server(){
 return http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),rel=(pathname==='/'?'crm.html':pathname.replace(/^\/+/,'')),target=path.resolve(root,rel);
  if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res)
 })
}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof briefLink==='function'&&typeof inqLink==='function');
  await page.evaluate(()=>{
   const target={id:'deal-target',site:'대상아파트',site_id:'site-1',created:'2026-09-02',work:'옥상방수',assignee:'황윤선',amt:120000000,code:'sent'};
   const other={id:'deal-other',site:'같은 현장 다른 공사',site_id:'site-1',created:'2026-09-03',work:'재도장',assignee:'이필선',amt:80000000,code:'rapport'};
   const q={id:'inq-target',site:'대상아파트',site_id:'site-1',at:'2026-09-01',status:'접수',work:'옥상방수',assignee:'황윤선'};
   B={deals:[target,other],inquiries:[q]};CUR_DETAIL={kind:'deal',item:target};
   document.body.innerHTML='<button id="voice-link" onclick="briefLink()">고객이 한 말 연결하기</button><div id="sg-panel"></div>';
   goPage=p=>{G.page=p;inqLink()};
  });
  await page.locator('#voice-link').click();
  const state=await page.evaluate(()=>({page:G.page,view:G.inqView,target:G.linkTargetDealKey,rows:LINK_CACHE.map(r=>({q:r.q.id,deals:r.cand.map(c=>c.d.id)})),text:document.querySelector('#sg-panel').innerText}));
  assert.equal(state.page,'inq');assert.equal(state.view,'link');assert.equal(state.target,'deal-target');
  assert.deepEqual(state.rows,[{q:'inq-target',deals:['deal-target']}]);
  assert.match(state.text,/현재 연결 대상 파이프라인/);assert.match(state.text,/대상아파트/);assert.doesNotMatch(state.text,/같은 현장 다른 공사/);
  console.log(JSON.stringify({status:'PASS',target:state.target,candidate_rows:state.rows.length,candidate_deals:state.rows[0].deals.length,unrelated_visible:false,network_scope:'localhost-only',business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
