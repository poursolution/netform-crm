'use strict';

// Localhost-only filter regression. Synthetic CRM rows; external traffic and writes are blocked.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const {chromium}=createRequire(path.resolve(__dirname,'../../crm-security-lab/package.json'))('playwright');

const root=path.resolve(__dirname,'..');
function server(){return http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/, '')||'crm.html',target=path.resolve(root,rel);if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return}res.setHeader('Cache-Control','no-store');fs.createReadStream(target).pipe(res)})}

async function run(){
 const srv=server();await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
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
   window.paint=()=>{paintPeriod();paintRepTabs();paintPipe()};
   paint();
  });


  assert.equal(await page.locator('#periodbar').isVisible(),false);
  assert.equal(await page.locator('#reptabs').isVisible(),false);
  const bar=page.locator('.pipe-inline-filters');
  assert.equal(await bar.locator('.period-segment button').count(),6);
  assert.equal(await bar.locator('.pipe-inline-owner summary b').innerText(),await page.locator('#reptabs summary b').innerText());
  await bar.getByRole('button',{name:'전체',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>[G.year,G.quarter]),['전체',0]);
  await bar.getByRole('button',{name:'연간',exact:true}).click();
  for(const q of [1,2,3,4]){
   await bar.getByRole('button',{name:q+'분기',exact:true}).click();
   assert.equal(await page.evaluate(()=>G.quarter),q);
  }
  await bar.getByRole('button',{name:'3분기',exact:true}).click();
  await bar.locator('summary').click();
  await bar.getByRole('textbox',{name:'영업담당자 이름 검색'}).fill('황윤선');
  assert.equal(await bar.locator('.rep-filter-option:visible').count(),1);
  await bar.locator('[data-rep="황윤선"]').click();
  assert.equal(await page.evaluate(()=>G.rep),'황윤선');
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),['pf-1','pf-3']);
  await page.getByRole('combobox',{name:'사업유형',exact:true}).selectOption('POUR솔루션');
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),['pf-1']);
  await bar.getByRole('combobox',{name:'공종',exact:true}).selectOption('공종 미분류');
  assert.equal(await page.evaluate(()=>G.workFilter),'공종 미분류');
  await page.locator('.pipe-reset').click();
  assert.deepEqual(await page.evaluate(()=>[G.year,G.quarter,G.rep,G.brand,G.workFilter]),[String(new Date().getFullYear()),0,'전체','전체','전체']);
  await page.evaluate(()=>{B.inquiries=[{id:'year-current',at:CUR_Y+'-09-01'}];paint()});
  const canonical=await page.locator('#periodbar .yoybadge').allTextContents();
  assert.deepEqual(await bar.locator('.yoybadge').allTextContents(),canonical);
  for(const width of [1920,1440,1365,1280]){
   await page.setViewportSize({width,height:900});
   const metrics=await bar.evaluate(el=>{const a=el.querySelector('.period-year-select').getBoundingClientRect(),b=el.querySelector('summary').getBoundingClientRect();return {sameRow:Math.abs((a.top+a.height/2)-(b.top+b.height/2))<2,overflow:el.scrollWidth>el.clientWidth,height:el.getBoundingClientRect().height}});
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
  await bar.getByRole('button',{name:'3분기',exact:true}).click();
  await bar.locator('summary').click();
  await bar.locator('[data-rep="황윤선"]').click();
  const selection=await page.evaluate(()=>[G.year,G.quarter,G.rep,G.brand,G.workFilter]);
  const selectedIds=await page.evaluate(()=>pipeFiltered().map(d=>d.id));
  await page.evaluate(()=>{G.page='inq';document.getElementById('pg-pipe').classList.remove('on');paintPeriod();paintRepTabs()});
  assert.equal(await page.locator('#periodbar').isVisible(),true,'global period remains available on other pages');
  assert.equal(await page.locator('#reptabs').isVisible(),true,'global owner remains available on other pages');
  // Other pages can apply their own existing owner validation. Restore the tested selection,
  // then verify repeated pipeline rendering itself never changes it.
  await page.evaluate(s=>{[G.year,G.quarter,G.rep,G.brand,G.workFilter]=s;G.page='pipe';document.getElementById('pg-pipe').classList.add('on');paint();paint()},selection);
  assert.deepEqual(await page.evaluate(()=>[G.year,G.quarter,G.rep,G.brand,G.workFilter]),selection);
  assert.deepEqual(await page.evaluate(()=>pipeFiltered().map(d=>d.id)),selectedIds);
  assert.equal(await page.locator('.pipe-inline-filters').count(),1,'reentry never duplicates the filter bar');
  assert.equal(page.url(),address,'layout does not rewrite URL');
  // Exercise the actual application router, not just the isolated render fixture.
  await page.evaluate(()=>{window.paint=window.__originalPaint;paint();paint()});
  assert.equal(await page.locator('#periodbar').evaluate(el=>el.style.display),'none');
  assert.equal(await page.locator('#reptabs').evaluate(el=>el.style.display),'none');
  assert.equal(await page.locator('.pipe-inline-filters').count(),1);
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
  const later=page.locator('#p-main [data-followup-mode="later"]').first();
  await later.click();
  await page.locator('.pc-followup-dialog [name=due]').fill('2030-12-15');
  assert.match(await page.locator('.pc-followup-preview').innerText(),/Pipeline/);
  await page.locator('.pc-followup-dialog [data-close]').first().click();
  await page.locator('#p-main [data-followup-mode="end"]').first().click();
  await page.locator('#stage-transition-form').waitFor({state:'visible'});
  assert.equal(await page.locator('#sf-target').inputValue(),'lost');
  await page.locator('#sf-cancel').click();
  await page.evaluate(()=>{openPipeSplit(B.deals[1]);});
  await page.locator('.quickpanel [data-followup-mode="later"],.quick-panel [data-followup-mode="later"],#p-main [data-followup-mode="later"]').first().click();
  await page.locator('.pc-followup-dialog').waitFor({state:'visible'});
  await page.locator('.pc-followup-dialog [data-close]').first().click();
  assert.equal(await page.evaluate(()=>window.__businessWrites),0);
  console.log(JSON.stringify({status:'PASS',one_row_period_owner:true,original_counts:true,period_buttons:6,filters:true,view_switches:true,business_writes:0}));
 }finally{await browser.close();await new Promise(resolve=>srv.close(resolve))}
}

run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
