'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="periodbar"><div class="period-controls"><select><option>2026</option></select><div class="period-segment"><button>전체</button></div><span class="yoybadge">2026년 10건</span></div></div><div id="reptabs"><details class="rep-filter-picker"><summary>전체 담당자 10건</summary><input><button class="rep-filter-option" data-search="김성민">김성민</button></details></div><div id="p-brands"></div>');
  await page.evaluate(()=>{
   window.CUR_Y='2026';window.G={year:'2026',quarter:0,rep:'전체',brand:'전체',workFilter:'전체',pipeView:'kb'};
   window.BRANDS=[];window.esc=window.escAttr=String;window.repDisplay=String;window.assignableReps=()=>['김성민'];window.workFilterOptions=()=>'<option>전체</option>';
   window.paint=()=>{};window.setPipeView=()=>{};window.openNewDeal=()=>{};
   window.originalYear=document.querySelector('.period-controls select');window.originalOwner=document.querySelector('.rep-filter-picker');
   originalYear.addEventListener('change',()=>window.changeCount=(window.changeCount||0)+1);
  });
  await page.addScriptTag({path:path.join(__dirname,'../pipeline-toolbar.js')});
  for(let i=0;i<3;i++){
   await page.evaluate(()=>PipelineToolbar.render());
   assert.equal(await page.locator('.pipe-inline-filters .rep-filter-picker').count(),1);
   assert.equal(await page.evaluate(()=>document.querySelector('.pipe-inline-filters select')===originalYear),true);
   await page.evaluate(()=>originalYear.dispatchEvent(new Event('change')));
   await page.evaluate(()=>PipelineToolbar.restoreControls());
   assert.equal(await page.evaluate(()=>document.querySelector('#reptabs .rep-filter-picker')===originalOwner),true);
   assert.equal(await page.locator('#periodbar select').count(),1);
  }
  assert.equal(await page.evaluate(()=>changeCount),3);
  console.log('PASS: 3 render/restore cycles preserve node identity, event handlers and single controls');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
