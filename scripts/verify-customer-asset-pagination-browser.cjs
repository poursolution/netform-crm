'use strict';

// Localhost-only browser regression with synthetic customers. No CRM reads or writes.
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
  await page.waitForFunction(()=>typeof paintSites==='function'&&typeof setSitePage==='function');
  await page.evaluate(()=>{
   const customers=Array.from({length:45},(_,index)=>({
    key:'customer-'+(index+1),norm:'customer '+(index+1),name:'테스트 고객 '+String(index+1).padStart(2,'0'),names:{},addresses:['테스트 주소'],deals:[],inquiries:[],open:[],won:[],lost:[],brands:['POUR솔루션'],owners:['황윤선'],contacts:[],primary:null,totalAmount:0,wonAmount:0,openAmount:0,lostAmount:0,started:'2026-01-01',firstInquiry:'',firstDeal:'2026-01-01',lastAt:'2026-09-01',lastDays:8,health:'active'
   }));
   siteMasterData=()=>customers;
   G.page='sites';G.q='';G.siteStatus='전체';G.siteBrand='전체';G.siteOwner='전체';G.workFilter='전체';G.siteSort='관계우선';G.sitePage=1;G.sitePageKey=null;
   document.getElementById('authGate').classList.remove('on');
   document.querySelectorAll('.apage').forEach(node=>node.classList.remove('on'));
   document.getElementById('pg-sites').classList.add('on');
   paintSites();
  });
  const rows=page.locator('.site-table-row.data');
  assert.equal(await rows.count(),20);
  assert.match(await page.locator('.site-page-summary').textContent(),/페이지 1 \/ 3/);
  assert.equal(await rows.first().locator('strong').first().textContent(),'테스트 고객 01');
  await page.locator('.site-pages button',{hasText:'2'}).click();
  assert.equal(await rows.count(),20);
  assert.equal(await rows.first().locator('strong').first().textContent(),'테스트 고객 21');
  assert.equal(await page.locator('.site-pages button[aria-current="page"]').textContent(),'2');
  await page.locator('.site-pages button',{hasText:'3'}).click();
  assert.equal(await rows.count(),5);
  assert.equal(await rows.first().locator('strong').first().textContent(),'테스트 고객 41');
  assert.equal(await page.evaluate(()=>SITE_MASTER_CACHE[0].name),'테스트 고객 41');
  console.log(JSON.stringify({status:'PASS',page_size:20,total_rows:45,pages:3,last_page_rows:5,detail_index:'customer-41',network_scope:'localhost-only',business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
