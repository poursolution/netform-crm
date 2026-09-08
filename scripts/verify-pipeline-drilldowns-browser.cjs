'use strict';

// Browser-level regression for every cross-screen Pipeline filter entry.
// It clicks real inline controls against the current crm.html but never authenticates or writes data.
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
 const port=srv.address().port,browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 let scenarios=0;
 try{
  const context=await browser.newContext();
  await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'?route.continue():route.abort()});
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof dashboardGoRepStages==='function'&&typeof matrixFilter==='function'&&typeof briefGoIssue==='function'&&typeof openPipeSplit==='function');
  await page.evaluate(()=>{
   window.__nav=[];window.goPage=p=>{window.__nav.push(p);G.page=p};window.paint=()=>{window.__nav.push('paint')};
   window.briefWeekWindow=()=>({startKey:'2026-09-07',endKey:'2026-09-13'});window.targetNameFilter=()=>null;
   document.body.innerHTML='<main id="sim"></main>';
  });

  const columns=[['lead|first_contact|design','초기·설계'],['sent','자료발송'],['rapport|silent|waiting','관계관리'],['compete|imminent|bidding','경쟁·입찰'],['contract|construction','계약·시공']];
  for(const rep of ['황윤선','이필선','한준엽'])for(const [codes,label] of columns){
   await page.locator('#sim').evaluate((el,x)=>{el.innerHTML=`<button id="run" data-rep="${x.rep}" data-codes="${x.codes}" data-label="${x.label}" onclick="dashboardGoRepStages(this.dataset.rep,this.dataset.codes,this.dataset.label)">run</button>`},{rep,codes,label});
   await page.locator('#run').click();scenarios++;
   const state=await page.evaluate(()=>({page:G.page,rep:G.rep,codes:G.reportStageCodes,label:G.reportStageLabel,view:G.pipeView}));
   assert.deepEqual(state,{page:'pipe',rep,codes:codes.split('|'),label,view:'split'});
  }

  for(let col=0;col<5;col++){
   await page.evaluate(()=>setPipelineStageDrill(['won'],'stale'));
   await page.locator('#sim').evaluate((el,col)=>{el.innerHTML=`<button id="run" data-col="${col}" onclick="matrixFilter('이필선',Number(this.dataset.col))">run</button>`},col);
   await page.locator('#run').click();scenarios++;
   const state=await page.evaluate(()=>({rep:G.rep,col:G.splitCol,codes:pipelineStageDrillCodes(),label:G.reportStageLabel}));
   assert.deepEqual(state,{rep:'이필선',col,codes:[],label:''});
  }

  for(const kind of ['nextMissing','overdue','stale','briefNoAmount','briefSilentHot']){
   await page.evaluate(()=>{setPipelineStageDrill(['sent'],'stale');G.pipeOrigin='wonPeriod'});
   await page.locator('#sim').evaluate((el,kind)=>{el.innerHTML=`<button id="run" data-kind="${kind}" onclick="briefGoIssue(this.dataset.kind,'황윤선')">run</button>`},kind);
   await page.locator('#run').click();scenarios++;
   const state=await page.evaluate(()=>({page:G.page,rep:G.rep,codes:pipelineStageDrillCodes(),origin:G.pipeOrigin,period:G.pipePeriodMode}));
   assert.deepEqual(state,{page:'pipe',rep:'황윤선',codes:[],origin:null,period:'snapshot'});
  }

  for(const source of ['today','sites','dup','inq']){
   await page.evaluate(source=>{Object.assign(G,{page:source,rep:'다른 담당자',brand:'다른 브랜드',workFilter:'다른 공종',q:'남은 검색',pipeOrigin:'risk',pipePeriodMode:null});setPipelineStageDrill(['won'],'stale')},source);
   await page.locator('#sim').evaluate(el=>{el.innerHTML='<button id="run" onclick="openPipeSplit({id:\'deal-42\'})">run</button>'});
   await page.locator('#run').click();scenarios++;
   const state=await page.evaluate(()=>({page:G.page,key:G.splitKey,rep:G.rep,brand:G.brand,work:G.workFilter,q:G.q,codes:pipelineStageDrillCodes(),origin:G.pipeOrigin,period:G.pipePeriodMode}));
   assert.deepEqual(state,{page:'pipe',key:'deal-42',rep:'전체',brand:'전체',work:'전체',q:'',codes:[],origin:null,period:'snapshot'});
  }
  console.log(JSON.stringify({status:'PASS',scenarios,network_scope:'localhost-only',business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});

