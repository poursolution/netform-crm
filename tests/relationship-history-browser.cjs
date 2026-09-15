'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.EDGE_PATH});
 try{
  const page=await browser.newPage();
  await page.setContent('<div id="panel"><header><h2>테스트 현장</h2></header><section><button id="relpc-full">영업 상세</button></section></div>');
  await page.evaluate(()=>{
   window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window.itemPatch=()=>({});window.relationshipMeta=()=>({due:'2026-10-01'});window.actionObj=()=>({text:'예산 확인'});
   window.inboxRecent=()=>({at:'2026-09-01',text:'최근 대화'});window.contactInfo=()=>({name:'테스트 소장',mobile:'번호 미등록'});
   window.repN=String;window.statusLabel=()=> '유대고객';window.yearOf=()=> '2028';window.yearLabel=()=> '2028';window.fmtAmt=String;
   window.reasonOf=()=> '관계 유지';window.inboxWork=()=> '재도장';window.fmtD=String;window.inboxExecute=()=> '<div class="relpc-actions"></div>';
   window.relActivityAt=x=>x.at;
   window.activitiesOf=()=>Array.from({length:8},(_,i)=>({at:(2019+i)+'-09-01',type:i===7?'custom_event':i===6?'owner_changed':'contact',note:i===7?'<script>bad()</script>':'기록 '+i}));
  });
  const source=fs.readFileSync(path.join(__dirname,'../relationship-management.js'),'utf8');
  const start=source.indexOf('function longTermPanel('),end=source.indexOf('var inboxFocus=',start);
  assert.ok(start>=0&&end>start);
  await page.addScriptTag({content:source.slice(start,end)});
  await page.evaluate(()=>longTermPanel(document.querySelector('#panel'),{assignee:'테스트 담당',amt:100,site:'테스트 현장'},0));
  assert.equal(await page.locator('#relpc-history article').count(),5);
  assert.match(await page.locator('#relpc-history article').first().innerText(),/2026-09-01/);
  assert.match(await page.locator('#relpc-history').innerText(),/기타 활동 · custom_event/);
  assert.match(await page.locator('#relpc-history').innerText(),/담당자 변경/);
  assert.equal(await page.locator('#relpc-history script').count(),0);
  await page.locator('#relpc-history-toggle').click();
  assert.equal(await page.locator('#relpc-history article').count(),8);
  assert.match(await page.locator('#relpc-history').innerText(),/2019-09-01/);
  await page.locator('#relpc-history-toggle').click();
  assert.equal(await page.locator('#relpc-history article').count(),5);
  assert.equal(await page.locator('#relpc-full').count(),1);
  console.log('PASS: recent 5 / all 8 / collapse, chronological order, unknown event labels, escaped notes, detail route retained');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
