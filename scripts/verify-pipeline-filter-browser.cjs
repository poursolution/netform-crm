'use strict';

// Localhost-only filter regression. Synthetic CRM rows; external traffic and writes are blocked.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof paintPipe==='function'&&typeof paintRepTabs==='function');
  await page.evaluate(()=>{
   const created=CUR_Y+'-09-01';
   B={deals:[
    {id:'pf-1',site:'황윤선 테스트 현장',assignee:'황윤선',brand:'POUR솔루션',created,code:'rapport',grp:'영업·관리',stage:'초기 집중관리',amt:12000000},
    {id:'pf-2',site:'이필선 테스트 현장',assignee:'이필선',brand:'기술자문',created,code:'consulting',grp:'영업·관리',stage:'컨설팅 설계',amt:8000000},
    {id:'pf-3',site:'황윤선 두 번째 현장',assignee:'황윤선',brand:'석민이앤씨',created,code:'sent',grp:'컨설팅·견적',stage:'견적서 발송완료',amt:3000000}
   ],inquiries:[],activities:[],inquiryTrash:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=false;G.page='pipe';G.year=CUR_Y;G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.pipeView='kb';G.stageCol=null;
   document.getElementById('authGate').classList.remove('on');
   document.querySelectorAll('.apage').forEach(node=>node.classList.remove('on'));
   document.getElementById('pg-pipe').classList.add('on');
   window.__businessWrites=0;window.pushWrite=()=>{window.__businessWrites++};
   window.paintKanban=()=>{};window.paint=()=>{paintPeriod();paintRepTabs();paintPipe()};
   paint();
  });

  assert.equal(await page.locator('#periodbar .period-year-select').count(),1);
  assert.equal(await page.locator('#periodbar .period-segment button').count(),6);
  assert.equal(await page.locator('#reptabs .rep-filter-picker').count(),1);
  assert.equal(await page.locator('#p-brands .filter-business-options .bt').count(),6);
  assert.match(await page.locator('#p-brands .filter-current b').innerText(),/전체 담당자 · 전체 사업/);

  await page.locator('#reptabs summary').click();
  await page.locator('#reptabs .rep-filter-search input').fill('황윤');
  assert.equal(await page.locator('#reptabs .rep-filter-option:visible').count(),1);
  await page.locator('#reptabs .rep-filter-option:visible').click();
  assert.equal(await page.evaluate(()=>G.rep),'황윤선');
  assert.match(await page.locator('#p-brands .filter-current b').innerText(),/황윤선/);

  await page.locator('#p-brands .bt[data-brand="POUR솔루션"]').click();
  assert.equal(await page.evaluate(()=>G.brand),'POUR솔루션');
  assert.match(await page.locator('#p-brands .filter-current b').innerText(),/POUR솔루션/);

  await page.locator('#periodbar .period-segment button').filter({hasText:'3분기'}).click();
  assert.equal(await page.evaluate(()=>G.quarter),3);
  assert.match(await page.locator('#p-brands .filter-current b').innerText(),/3분기/);

  const pcNoOverflow=await page.evaluate(()=>['periodbar','reptabs','p-brands'].every(id=>{const el=document.getElementById(id);return el.scrollWidth<=el.clientWidth}));
  assert.equal(pcNoOverflow,true);

  await page.locator('#p-brands .filter-current button').click();
  assert.deepEqual(await page.evaluate(()=>({year:G.year,quarter:G.quarter,rep:G.rep,brand:G.brand})),{year:String(new Date().getFullYear()),quarter:0,rep:'전체',brand:'전체'});
  if(process.env.VERIFY_SCREENSHOT)await page.screenshot({path:process.env.VERIFY_SCREENSHOT,fullPage:false});

  await page.setViewportSize({width:700,height:900});
  await page.evaluate(()=>paint());
  const mobileNoOverflow=await page.evaluate(()=>['periodbar','reptabs','p-brands'].every(id=>{const el=document.getElementById(id);return el.scrollWidth<=el.clientWidth}));
  assert.equal(mobileNoOverflow,true);
  assert.equal(await page.evaluate(()=>window.__businessWrites),0);
  console.log(JSON.stringify({status:'PASS',period_controls:6,rep_search:'PASS',brand_filter:'PASS',summary_sync:'PASS',reset:'PASS',pc_horizontal_scroll:false,mobile_horizontal_scroll:false,network_scope:'localhost-only',business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
