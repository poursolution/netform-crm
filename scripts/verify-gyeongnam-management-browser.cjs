'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=()=>http.createServer((req,res)=>{
  const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html';
  const target=path.resolve(root,rel);
  if(!target.startsWith(root+path.sep)||!fs.existsSync(target)){res.writeHead(404);res.end();return;}
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type',types[path.extname(target)]||'application/octet-stream');
  fs.createReadStream(target).pipe(res);
});

(async()=>{
  const srv=server();
  await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof paintGyeongnam==='function');
    await page.evaluate(()=>{
      AUTH_ON=false;ME={name:'송보람',role:'admin'};B={deals:[],inquiries:[]};
      gnData=()=>({
        Q:[],unnamed:[],unresp:[],D:[],comp:[],won:[],open:[],riskDeals:[],noNext:[],stale:[],hot:[],
        rows:[{name:'조민준',label:'조민준',pool:false,assigned:0,responded:0,opps:0,compete:0,won:0,pipeline:0,tracked:false,advanced:0,risk:0}]
      });
      document.getElementById('authGate').classList.remove('on');
      document.querySelectorAll('.apage').forEach(node=>node.classList.remove('on'));
      document.getElementById('pg-gyeongnam').classList.add('on');
      paintGyeongnam();
    });
    const titles=await page.locator('#gyeongnam-root > .gn-frame .gn-frame-head h3').allTextContents();
    assert.deepEqual(titles,['본사 인계 원장','경남지사 담당자별 흐름']);
    assert.equal(await page.locator('#gyeongnam-root details').count(),0);
    // A+B: 퍼널 5칸(클릭 드릴)이 머리, 미처리 듀오, 그 아래 인계 원장 + 우측 요약 레일.
    assert.equal(await page.locator('#gyeongnam-root .gn2-funnel').count(),1);
    assert.equal(await page.locator('#gyeongnam-root .gn2-step').count(),5);
    assert.equal(await page.locator('#gyeongnam-root .gn2-qcard').count(),2);
    assert.equal(await page.locator('#gyeongnam-root .gn2-split .gn2-rail .gn2-card').count(),2);
    assert.equal(await page.locator('#gyeongnam-root .ps-kpi,#gyeongnam-root .gn-command,#gyeongnam-root .gn-risk-grid').count(),0);
    for(const frame of await page.locator('#gyeongnam-root > .gn-frame').all())assert.equal(await frame.isVisible(),true);
    for(const width of [1440,1024,390]){
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,`overflow at ${width}`);
    }
    console.log(JSON.stringify({status:'PASS',frames:titles,collapsed_sections:0,viewports:[1440,1024,390],external_writes:0}));
  }finally{
    await browser.close();
    await new Promise(resolve=>srv.close(resolve));
  }
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
