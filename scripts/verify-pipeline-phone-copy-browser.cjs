'use strict';

// Localhost-only browser regression. It uses a synthetic contact and performs no CRM writes.
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
  const context=await browser.newContext();let external=0;
  await context.route('**/*',route=>{if(new URL(route.request().url()).hostname==='127.0.0.1')return route.continue();external++;return route.abort()});
  const page=await context.newPage();await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof briefCopy==='function'&&typeof copyTextReliable==='function');

  async function setup(mode,fallback){
   await page.evaluate(({mode,fallback})=>{
    document.body.innerHTML='<div class="bact"><button id="copy" data-copy-phone="1" aria-live="polite" onclick="briefCopy(this)">📋 번호 복사</button></div><div id="copy-result"></div>';
    CUR_DETAIL={kind:'deal',item:{phone:'010-5049-1418'}};
    briefPhone=function(){return {tel:'01050491418',raw:'010-5049-1418'}};
    showDetailErr=function(message,ok){const e=document.getElementById('copy-result');e.textContent=message;e.dataset.ok=String(!!ok)};
    window.__copied='';window.__copyMode=mode;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copied=text;if(window.__copyMode==='reject')throw new Error('denied')}}});
    document.execCommand=function(command){window.__fallbackCommand=command;return fallback};
   },{mode,fallback});
  }

  await setup('ok',true);await page.locator('#copy').click();await page.waitForFunction(()=>document.querySelector('#copy').textContent.includes('복사됨'));
  assert.equal(await page.evaluate(()=>window.__copied),'010-5049-1418');
  assert.equal(await page.locator('#copy').getAttribute('aria-label'),'전화번호 복사 완료');
  assert.match(await page.locator('#copy-result').textContent(),/복사 완료/);

  await setup('reject',true);await page.locator('#copy').click();await page.waitForFunction(()=>document.querySelector('#copy').textContent.includes('복사됨'));
  assert.equal(await page.evaluate(()=>window.__fallbackCommand),'copy');

  await setup('reject',false);await page.locator('#copy').click();await page.waitForFunction(()=>document.querySelector('#copy').textContent.includes('복사 실패'));
  assert.match(await page.locator('#copy-result').textContent(),/직접 선택.*010-5049-1418/);

  console.log(JSON.stringify({status:'PASS',clipboard_success:true,permission_fallback:true,failure_feedback:true,external_requests:external,business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
