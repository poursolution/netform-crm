'use strict';

// Localhost-only browser regression. It uses a synthetic deal and performs no CRM writes.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
function server(){return http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),rel=(pathname==='/'?'crm.html':pathname.replace(/^\/+/,'')),target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const context=await browser.newContext();await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof syncExecFavoriteButton==='function'&&typeof toggleExecFavorite==='function');
  await page.evaluate(()=>{
   document.body.innerHTML='<div id="detailView"><div class="detailtopin"></div><div id="favorite-result"></div></div>';
   CUR_DETAIL={kind:'deal',item:{id:'2f98178e-a70e-4c21-8304-2a6ad7b627e8',favorite:false}};
   FIELD_DEMO=true;
   showDetailErr=function(message){document.getElementById('favorite-result').textContent=message};
   syncExecFavoriteButton(document.querySelector('.detailtopin'),CUR_DETAIL.item);
  });
  const favorite=page.locator('.exec-favorite');
  assert.equal(await favorite.textContent(),'☆ 즐겨찾기');
  assert.equal(await favorite.getAttribute('aria-pressed'),'false');
  await favorite.click();
  assert.equal(await favorite.textContent(),'★ 즐겨찾기');
  assert.equal(await favorite.getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#favorite-result').textContent(),/추가했습니다/);
  await favorite.click();
  assert.equal(await favorite.textContent(),'☆ 즐겨찾기');
  assert.equal(await favorite.getAttribute('aria-pressed'),'false');
  console.log(JSON.stringify({status:'PASS',favorite_on:true,favorite_off:true,aria_state:true,network_scope:'localhost-only',business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
