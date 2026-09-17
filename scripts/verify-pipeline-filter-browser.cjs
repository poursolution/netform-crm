'use strict';

// Localhost-only filter regression. Synthetic CRM rows; external traffic and writes are blocked.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');

const root=path.resolve(__dirname,'..');
function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
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
   document.getElementById('ptitle').textContent='파이프라인';
   document.getElementById('psub').textContent='진행 중인 영업기회를 단계별로 관리합니다.';
   window.__originalPaint=window.paint;
   window.paint=()=>paintPipe();
   paint();
  });


  assert.equal(await page.locator('#periodbar').isVisible(),false);
  assert.equal(await page.locator('#reptabs').isVisible(),false);
  const bar=page.locator('.pipe-toolbar-controls');
  assert.equal(await bar.locator('.pipe-period').count(),1);
  assert.equal(await bar.locator('.pipe-owner').count(),1);
  await bar.locator('.pipe-period summary').click();
  await bar.getByRole('combobox',{name:'조회 연도'}).selectOption('전체');
  await bar.getByRole('combobox',{name:'조회 분기'}).selectOption('0');
  await bar.getByRole('button',{name:'적용',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>[G.year,G.quarter]),['전체',0]);
  await bar.locator('.pipe-period summary').click();
  await bar.getByRole('combobox',{name:'조회 연도'}).selectOption(String(new Date().getFullYear()));
  for(const q of [1,2,3,4]){
   await bar.getByRole('combobox',{name:'조회 분기'}).selectOption(String(q));
   await bar.getByRole('button',{name:'적용',exact:true}).click();
   assert.equal(await page.evaluate(()=>G.quarter),q);
   if(q!==4)await bar.locator('.pipe-period summary').click();
  }
  await bar.locator('.pipe-period').evaluate(node=>{node.open=true;});
  await bar.getByRole('combobox',{name:'조회 분기'}).selectOption('3');
  await bar.getByRole('button',{name:'적용',exact:true}).click();
  await bar.locator('.pipe-owner').evaluate(node=>{node.open=true;});
  await bar.locator('.pipe-owner-input').fill('황윤선');
  assert.equal(await bar.locator('[data-owner]:visible').count(),1);
  await bar.locator('[data-owner="황윤선"]').click();
  assert.equal(await page.evaluate(()=>G.rep),'황윤선');
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),['pf-1','pf-3']);
  await page.getByRole('combobox',{name:'사업유형',exact:true}).selectOption('POUR솔루션');
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),['pf-1']);
  await bar.getByRole('combobox',{name:'공종',exact:true}).selectOption('공종 미분류');
  assert.equal(await page.evaluate(()=>G.workFilter),'공종 미분류');
  await page.locator('.pipe-reset').click();
  assert.deepEqual(await page.evaluate(()=>[G.year,G.quarter,G.rep,G.brand,G.workFilter]),[String(new Date().getFullYear()),0,'전체','전체','전체']);
  assert.equal(await page.evaluate(()=>document.querySelector('#periodbar select')===null||!document.querySelector('#periodbar').offsetParent),true);
  for(const width of [1920,1440,1365,1280]){
   await page.setViewportSize({width,height:900});
   const metrics=await bar.evaluate(el=>{const a=el.querySelector('.pipe-period>summary').getBoundingClientRect(),b=el.querySelector('.pipe-owner>summary').getBoundingClientRect();return {sameRow:Math.abs((a.top+a.height/2)-(b.top+b.height/2))<2,overflow:el.scrollWidth>el.clientWidth,height:el.getBoundingClientRect().height}});
   assert.equal(metrics.sameRow,true,'period and owner same row at '+width);
   assert.equal(metrics.overflow,false,'no horizontal overflow at '+width);
   assert.ok(metrics.height<55);
  }
  for(const view of ['split','fc','kb']){
   await page.locator('[data-view="'+view+'"]').click();
   assert.equal(await page.evaluate(()=>G.pipeView),view);
  }
  await page.evaluate(()=>{window.__opened=0;window.openNewDeal=()=>window.__opened++});
  await page.locator('.pipe-add').click();
  assert.equal(await page.evaluate(()=>window.__opened),1);
  const address=page.url();
  await bar.locator('.pipe-period').evaluate(node=>{node.open=true;});
  await bar.getByRole('combobox',{name:'조회 분기'}).selectOption('3');
  await bar.getByRole('button',{name:'적용',exact:true}).click();
  await bar.locator('.pipe-owner').evaluate(node=>{node.open=true;});
  await bar.locator('[data-owner="황윤선"]').click();
  const selection=await page.evaluate(()=>[G.year,G.quarter,G.rep,G.brand,G.workFilter]);
  const selectedIds=await page.evaluate(()=>pipeFiltered().map(d=>d.id));
  await page.evaluate(()=>{window.paint=window.__originalPaint;G.page='inq';paint()});
  assert.equal(await page.locator('#periodbar').evaluate(el=>el.style.display),'','global period remains available on other pages');
  assert.equal(await page.locator('#reptabs').evaluate(el=>el.style.display),'','global owner remains available on other pages');
  await page.evaluate(s=>{[G.year,G.quarter,G.rep,G.brand,G.workFilter]=s;G.page='pipe';paint();paint()},selection);
  assert.deepEqual(await page.evaluate(()=>[G.year,G.quarter,G.rep,G.brand,G.workFilter]),selection);
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),selectedIds);
  assert.equal(await page.locator('#p-brands .pipe-toolbar-controls').count(),1,'reentry never duplicates the filter bar');
  assert.equal(page.url(),address,'layout does not rewrite URL');
  assert.equal(await page.locator('#periodbar').evaluate(el=>el.style.display),'none');
  assert.equal(await page.locator('#reptabs').evaluate(el=>el.style.display),'none');
  assert.equal(await page.locator('#p-brands .pipe-toolbar-controls').count(),1);
  assert.deepEqual(await page.evaluate(()=>[G.year,G.quarter,G.rep,G.brand,G.workFilter]),selection);
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),selectedIds);
  await page.setViewportSize({width:1920,height:1080});
  if(process.env.VERIFY_SCREENSHOT)await page.screenshot({path:process.env.VERIFY_SCREENSHOT,fullPage:false});
  assert.equal(await page.evaluate(()=>window.__businessWrites),0);
  // Exercise real card and split entry points with the full PC renderer loaded.
  await page.evaluate(()=>{G.rep='전체';G.brand='전체';G.workFilter='전체';G.year='전체';G.quarter=0;G.q='';G.pipeView='kb';paint();});
  await page.evaluate(()=>{B.deals[2].quote_versions=[{sent_at:'2026-09-01T10:00:00+09:00'}];paint();});
  assert.equal(await page.locator('.pc-followup-filters [data-value="response"] span').innerText(),'1건');
  await page.locator('.pc-followup-filters [data-value="response"] span').click();
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),['pf-3']);
  assert.equal(await page.locator('.pc-followup-filters [data-value="all"] span').innerText(),'3건');
  await page.evaluate(()=>{G.rep='이필선';paint();});
  assert.equal(await page.locator('.pc-followup-filters [data-value="response"] span').innerText(),'0건');
  assert.equal(await page.locator('.pc-followup-filters [data-value="all"] span').innerText(),'1건');
  await page.locator('.pc-followup-filters [data-value="all"]').click();
  await page.evaluate(()=>{G.rep='전체';paint();});
  const accounting=await page.evaluate(()=>{
   const d=B.deals[0],before=repFlowData(true).find(r=>r.nm===d.assignee),saved=JSON.stringify(d);
   d.code=d.stage_code='waiting';d.stage_contexts={waiting:{memo:'고객의 명시적인 장기 검토 의사에 따라 재접촉 계획 등록',fields:{reason:'공사예정 2030년 · 예산 편성 대기',contact_date:'2026-12-15'}}};
   const after=repFlowData(true).find(r=>r.nm===d.assignee),out={excluded:!dashboardSnapshotDeals().some(x=>x.id===d.id),stillActive:towerActive(d),before:before.pipeline,after:after.pipeline,amount:oppAmt(d),wonUnchanged:before.wonAmount===after.wonAmount,historyPresent:after.deals.some(x=>x.id===d.id)};
   // Simulate the existing server ACK after returning to an active stage; keep historical context.
   d.code=d.stage_code='sent';
   out.returnedToPipeline=dashboardSnapshotDeals().some(x=>x.id===d.id);
   out.returnedAmount=repFlowData(true).find(r=>r.nm===d.assignee).pipeline;
   out.retainedYear=ConstructionYear.yearOf(d);
   out.retainedReason=d.stage_contexts.waiting.fields.reason;
   Object.keys(d).forEach(k=>delete d[k]);Object.assign(d,JSON.parse(saved));return out;
  });
  assert.equal(accounting.excluded,true);assert.equal(accounting.stillActive,true);assert.equal(accounting.before-accounting.after,accounting.amount);assert.equal(accounting.wonUnchanged,true);assert.equal(accounting.historyPresent,true);
  assert.equal(accounting.returnedToPipeline,true);assert.equal(accounting.returnedAmount,accounting.before);assert.equal(accounting.retainedYear,'2030');assert.match(accounting.retainedReason,/예산 편성 대기/);
  assert.equal(await page.locator('#p-main .pv-section').count(),5,'default pipeline is five vertical groups');
  assert.equal(await page.locator('#p-main .pv-section.collapsed').count(),1,'closed group starts collapsed');
  assert.deepEqual(await page.locator('#p-main .pv-row').first().locator('.pv-actions button').allTextContents(),['응대 기록','다음 행동','상세']);
  for(const width of [1920,1440,1280]){
   await page.setViewportSize({width,height:900});
   const overflow=await page.locator('#p-main').evaluate(el=>el.scrollWidth>el.clientWidth);
   assert.equal(overflow,false,'vertical pipeline has no horizontal overflow at '+width);
  }
  await page.evaluate(()=>{openPipeSplit(B.deals[1]);});
  await page.locator('.quickpanel [data-followup-mode="later"],.quick-panel [data-followup-mode="later"],#p-main [data-followup-mode="later"]').first().click();
  await page.locator('.pc-followup-dialog').waitFor({state:'visible'});
  await page.locator('.pc-followup-dialog [data-close]').first().click();
  assert.equal(await page.evaluate(()=>window.__businessWrites),0);
  console.log(JSON.stringify({status:'PASS',pipeline_owned_controls:true,global_controls_untouched:true,one_row_period_owner:true,filters:true,view_switches:true,business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
