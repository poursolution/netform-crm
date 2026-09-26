'use strict';

const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
const launchOptions=()=>({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'mobile.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',target.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch(launchOptions());
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let externalRequests=0;
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1')return route.continue();if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('/pretendard'))return route.abort();/* 글꼴 CDN은 업무 데이터가 아님(2026-09-26 모바일 Pretendard) */externalRequests++;return route.abort()});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof todayCompleteM==='function'&&typeof execNextM==='function'&&window.OperationalUI);
  const proof=await page.evaluate(()=>{
   const id='22222222-2222-4222-8222-222222222222',action={id:'11111111-1111-4111-8111-111111111111',type:'전화',text:'진행 확인',due_at:'2026-09-30',status:'open'},deal={id,nextAction:action,activities:[],tl:[],code:'consulting'};
   DEALS=[deal];G._today=[{kind:'deal',ref:id,why:'오늘 후속 확인'}];G.done={};
   const before=JSON.stringify({action:deal.nextAction,activities:deal.activities,done:G.done});
   window.pushWrite=()=>{throw Error('TEST_QUEUE_REJECTED')};
   const result=todayCompleteM(0);
   return {result,before,after:JSON.stringify({action:deal.nextAction,activities:deal.activities,done:G.done}),toast:document.getElementById('toast').textContent};
  });
  assert.equal(proof.result,false);assert.equal(proof.after,proof.before);assert.match(proof.toast,/기존 일정을 유지합니다/);assert.equal(externalRequests,0);
  console.log(JSON.stringify({status:'PASS',mobile_today_completion_failure_preserved:true,external_requests:externalRequests,business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
