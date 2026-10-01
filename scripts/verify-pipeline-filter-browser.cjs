'use strict';

// 단일 칸반 워크스페이스의 필터·범위·회계 회귀. 합성 데이터, 외부 통신·쓰기 차단.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:900}});
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PipelineWorkspace&&typeof repFlowData==='function'&&typeof dashboardSnapshotDeals==='function');
  await page.evaluate(()=>{
   const created=CUR_Y+'-09-01';
   B={deals:[
    {id:'pf-1',site:'황윤선 테스트 현장',assignee:'황윤선',brand:'POUR솔루션',created,code:'rapport',stage_code:'rapport',grp:'영업·관리',stage:'초기 집중관리',amt:12000000},
    {id:'pf-2',site:'이필선 테스트 현장',assignee:'이필선',brand:'기술자문',created,code:'consulting',stage_code:'consulting',grp:'영업·관리',stage:'컨설팅 설계',amt:8000000},
    {id:'pf-3',site:'황윤선 두 번째 현장',assignee:'황윤선',brand:'석민이앤씨',created,code:'sent',stage_code:'sent',grp:'컨설팅·견적',stage:'견적서 발송완료',amt:3000000}
   ],inquiries:[],activities:[],inquiryTrash:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};
   G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.pipeRepYear='전체';
   document.getElementById('authGate').classList.remove('on');
   window.__businessWrites=0;window.pushWrite=()=>{window.__businessWrites++};
   PipelineWorkspace.open('all');
  });

  // 칸반 단일 뷰: 레거시 툴바·뷰 전환이 완전히 사라졌다.
  assert.equal(await page.locator('.pipe-toolbar-controls').count(),0,'legacy pipe toolbar removed');
  assert.equal(await page.locator('#pipeline-stage-root [data-view]').count(),0,'no view switcher');
  assert.equal(await page.locator('.ps-kanban>.ps-kcol').count(),7);
  assert.equal(await page.locator('.ps-kcard').count(),3);

  // 공사예정 연도 필터: 연도 미입력 데이터는 «미입력»에서만 잡힌다.
  assert.equal(await page.locator('[data-ps-filter="pipeRepYear"]').count(),1);
  await page.selectOption('[data-ps-filter="pipeRepYear"]',String(new Date().getFullYear()));
  assert.equal(await page.evaluate(()=>G.pipeRepYear),String(new Date().getFullYear()));
  assert.equal(await page.locator('.ps-kcard').count(),0);
  await page.selectOption('[data-ps-filter="pipeRepYear"]','미입력');
  assert.equal(await page.locator('.ps-kcard').count(),3);
  await page.selectOption('[data-ps-filter="pipeRepYear"]','전체');
  assert.equal(await page.locator('.ps-kcard').count(),3);

  // 검색은 현장·담당자를 함께 찾고, 공종 필터는 상태를 남긴다.
  await page.fill('[data-ps-filter="q"]','황윤선');
  await page.press('[data-ps-filter="q"]','Enter');
  assert.equal(await page.evaluate(()=>G.q),'황윤선');
  assert.equal(await page.locator('.ps-kcard').count(),2);
  await page.fill('[data-ps-filter="q"]','');
  await page.press('[data-ps-filter="q"]','Enter');
  assert.equal(await page.locator('.ps-kcard').count(),3);
  await page.selectOption('[data-ps-filter="workFilter"]','공종 미분류');
  assert.equal(await page.evaluate(()=>G.workFilter),'공종 미분류');
  await page.selectOption('[data-ps-filter="workFilter"]','전체');

  // 사원 계정은 본인 배정 건만 본다.
  await page.evaluate(()=>{ME={id:'rep',name:'황윤선',role:'rep'};PipelineWorkspace.open('all');});
  assert.equal(await page.locator('.ps-kcard').count(),2);
  assert.equal(await page.evaluate(()=>PipelineWorkspace.rows().every(r=>r.owner==='황윤선')),true);
  await page.evaluate(()=>{ME={id:'admin',name:'송보람',role:'admin'};PipelineWorkspace.open('all');});
  assert.equal(await page.locator('.ps-kcard').count(),3);

  // 대기(waiting) 전환 회계 불변식: 스냅샷 제외·금액 이동·이력 보존·복귀.
  const accounting=await page.evaluate(()=>{
   const d=B.deals[0],before=repFlowData(true).find(r=>r.nm===d.assignee),saved=JSON.stringify(d);
   d.code=d.stage_code='waiting';d.stage_contexts={waiting:{memo:'고객의 명시적인 장기 검토 의사에 따라 재접촉 계획 등록',fields:{reason:'공사예정 2030년 · 예산 편성 대기',contact_date:'2026-12-15'}}};
   const after=repFlowData(true).find(r=>r.nm===d.assignee),out={excluded:!dashboardSnapshotDeals().some(x=>x.id===d.id),stillActive:towerActive(d),before:before.pipeline,after:after.pipeline,amount:oppAmt(d),wonUnchanged:before.wonAmount===after.wonAmount,historyPresent:after.deals.some(x=>x.id===d.id)};
   d.code=d.stage_code='sent';
   out.returnedToPipeline=dashboardSnapshotDeals().some(x=>x.id===d.id);
   out.returnedAmount=repFlowData(true).find(r=>r.nm===d.assignee).pipeline;
   out.retainedYear=ConstructionYear.yearOf(d);
   out.retainedReason=d.stage_contexts.waiting.fields.reason;
   Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,JSON.parse(saved));return out;
  });
  assert.equal(accounting.excluded,true);assert.equal(accounting.stillActive,true);assert.equal(accounting.before-accounting.after,accounting.amount);assert.equal(accounting.wonUnchanged,true);assert.equal(accounting.historyPresent,true);
  assert.equal(accounting.returnedToPipeline,true);assert.equal(accounting.returnedAmount,accounting.before);assert.equal(accounting.retainedYear,'2030');assert.match(accounting.retainedReason,/예산 편성 대기/);

  for(const width of [1920,1440,1365,1100,390]){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow at '+width);
  }
  assert.equal(await page.evaluate(()=>window.__businessWrites),0);
  console.log(JSON.stringify({status:'PASS',single_kanban:true,seven_columns:true,year_filter:true,search_scope:true,rep_scope:true,waiting_accounting:true,business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
