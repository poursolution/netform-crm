'use strict';
/* 진입 페이지 화면 해시 (2026-10-25 인계 08 성과 연결)
   index.html?view=pc#p=perf → 안쪽 PC 앱(iframe)에 #p=perf 가 넘어가고 주소창에도 남는다(예전: replaceState 가 먼저 지워 PC 오늘로).
   모바일로 바꿀 때는 #p= 를 넘기지 않는다. 형식이 아닌 해시는 버린다. 안쪽 앱은 열지 않고(iframe src 만 확인) 외부 연결은 막는다. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const u=new URL(req.url,'http://x');const p=u.pathname==='/'?'/index.html':u.pathname;
 if(p==='/index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(fs.readFileSync(path.join(root,'index.html')));}
 if(p==='/production-ui-manifest.json'){res.setHeader('Content-Type','application/json');return res.end('{}');}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><title>stub</title>');});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+srv.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext();await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await ctx.newPage();
  const read=()=>page.evaluate(()=>({src:document.getElementById('app')?.getAttribute('src')||'',href:location.search+location.hash}));
  await page.goto(origin+'/?view=pc#p=perf');await page.waitForFunction(()=>document.getElementById('app'));
  let r=await read();
  assert.match(r.src,/#p=perf$/,'안쪽 PC 앱에 #p=perf: '+r.src);assert.equal(r.href,'?view=pc#p=perf','주소창에도 남음');
  await page.evaluate(()=>mount('mobile'));r=await read();
  assert.doesNotMatch(r.src,/#p=/,'모바일로 바꾸면 #p= 안 넘김');assert.equal(r.href,'?view=mobile');
  await page.goto(origin+'/?view=pc#<script>');await page.waitForFunction(()=>document.getElementById('app'));r=await read();
  assert.doesNotMatch(r.src,/#/,'형식 아닌 해시는 버림');
  await page.goto(origin+'/?view=pc&demo=1#p=today');await page.waitForFunction(()=>document.getElementById('app'));r=await read();
  assert.match(r.src,/&demo=1#p=today$/,'진단 파라미터 + 해시 둘 다');
  console.log(JSON.stringify({status:'PASS',hash_to_pc:true,mobile_no_hash:true,invalid_dropped:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
