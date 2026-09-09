'use strict';

// Localhost-only browser regression: opens Command Center tabs without auth or writes.
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
  await page.waitForFunction(()=>typeof dccGoNext==='function'&&typeof dccGoActivity==='function');
  await page.evaluate(()=>{
   CUR_DETAIL={kind:'deal',item:{id:'deal-next-test'}};
   document.body.innerHTML='<div id="detailView"><button id="brief-next" onclick="briefNextAction()">📅 다음 행동</button><div class="detailtabs"><button data-tab="개요">개요</button><button data-tab="연락·활동">연락·활동</button><button data-tab="일정·Next">일정·Next</button></div><div id="dv-body"><section class="dsec" data-sec="개요">개요</section><section class="dsec" data-sec="연락·활동"><input id="dv-act-note"></section><section class="dsec" data-sec="일정·Next"><input id="dv-na-text"></section></div><button id="open-next" onclick="dccGoNext()">다음 행동 관리</button><button id="open-activity" onclick="dccGoActivity()">활동기록</button></div>';
  });
  await page.locator('#brief-next').click();await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'dv-na-text');
  await page.locator('#open-next').click();await page.waitForTimeout(100);
  const next=await page.evaluate(()=>({tab:G.detailTab,nextDisplay:document.querySelector('[data-sec="일정·Next"]').style.display,overviewDisplay:document.querySelector('[data-sec="개요"]').style.display,active:document.querySelector('[data-tab="일정·Next"]').classList.contains('on'),focused:document.activeElement.id}));
  assert.deepEqual(next,{tab:'일정·Next',nextDisplay:'',overviewDisplay:'none',active:true,focused:'dv-na-text'});
  await page.locator('#open-activity').click();await page.waitForTimeout(100);
  const activity=await page.evaluate(()=>({tab:G.detailTab,display:document.querySelector('[data-sec="연락·활동"]').style.display,focused:document.activeElement.id}));
  assert.deepEqual(activity,{tab:'연락·활동',display:'',focused:'dv-act-note'});
  console.log(JSON.stringify({status:'PASS',brief_next_action:true,next_action_tab:true,next_action_focus:true,activity_tab:true,network_scope:'localhost-only',business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
