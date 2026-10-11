'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[];
 try{
  const page=await browser.newPage({viewport:{width:600,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  await page.goto(origin+'/mobile.html?demo=1&screen=B');await page.locator('.approved-b').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('.approved-row').count(),6);
  const styles=await page.evaluate(()=>{
   const box=document.createElement('div');box.innerHTML=MobileApprovedBCSource.B;const original=box.firstElementChild,actual=document.querySelector('.approved-b');
   const pair=(a,b)=>[...new Set([...a.style,...b.style])].filter(k=>a.style.getPropertyValue(k)!==b.style.getPropertyValue(k));
   return {frame:pair(actual,original),regions:[...actual.children].map((n,i)=>pair(n,original.children[i])),rows:[...actual.children[3].children].map((n,i)=>[n,...n.querySelectorAll('*')].flatMap((item,j)=>pair(item,[original.children[3].children[i],...original.children[3].children[i].querySelectorAll('*')][j])))};
  });
  assert.deepEqual(styles,{frame:[],regions:[[],[],[],[],[]],rows:[[],[],[],[],[],[]]});
  await page.locator('.approved-b').screenshot({path:path.join(__dirname,'approved-b-implemented.png')});checks.push('B uses original frame, regions and all six row style declarations without layout changes');
  await page.locator('.approved-row').first().click();await page.locator('.approved-c').waitFor();
  const detailDiff=await page.evaluate(()=>{
   const box=document.createElement('div');box.innerHTML=MobileApprovedBCSource.C;const original=box.firstElementChild,actual=document.querySelector('.approved-c');
   const aa=[actual,...actual.querySelectorAll('*')],bb=[original,...original.querySelectorAll('*')];
   if(aa.length!==bb.length)return ['node count changed'];
   return aa.flatMap((n,i)=>{const o=bb[i],keys=[...new Set([...n.style,...o.style])];return keys.filter(k=>n.style.getPropertyValue(k)!==o.style.getPropertyValue(k)).map(k=>i+':'+k);});
  });
  assert.deepEqual(detailDiff,[]);
  await page.locator('.approved-c').screenshot({path:path.join(__dirname,'approved-c-implemented.png')});checks.push('C uses original header, identity, work, contact, history and related information layout');
  await page.locator('[data-gs="pending-task"]').click();assert.equal(await page.locator('#sheetwrap.on').count(),0);assert(await page.locator('.approved-c').isVisible());checks.push('send action does not silently open a call-result form or mark completion');
  await page.locator('[data-gs="back"]').click();await page.getByLabel('현장 검색').fill('매탄');assert.equal(await page.locator('.approved-row').count(),1);await page.locator('.approved-row').click();await page.locator('[data-gs="back"]').click();assert.equal(await page.getByLabel('현장 검색').inputValue(),'매탄');checks.push('search and selection/back preserve the query and scope');
  await page.getByLabel('현장 검색').fill('');
  await page.evaluate(()=>{delete window.__approvedBCExample;const original=DEALS[0];DEALS=Array.from({length:45},(_,i)=>({...structuredClone(original),id:'page-'+i,nm:'현장 '+String(i).padStart(2,'0')}));render();});
  assert.equal(await page.locator('.approved-row').count(),20);await page.getByRole('button',{name:'2쪽',exact:true}).click();assert.match(await page.locator('.approved-row').first().textContent(),/현장 20/);
  await page.getByLabel('현장 검색').fill('현장 4');assert.equal(await page.locator('.approved-row').count(),5);assert.match(await page.locator('.approved-row').first().textContent(),/현장 40/);assert.equal(await page.evaluate(()=>MobileGuideShell.state.page),1);checks.push('shared ListPager limits pages to 20 rows and search resets to page 1');
  await page.evaluate(()=>{G.deal=DEALS[0].id;render();MobileEntry.open({ch:'방문'});MobileEntry.reschedule();G.contactEntryOff=true;dealCallSheetM();});
  assert.equal(await page.locator('#sheetwrap.on').count(),0);assert(await page.locator('.approved-c').isVisible());checks.push('unconnected visit, legacy reschedule and disabled contact entry do not open retired sheets');
  await page.evaluate(()=>{G.sub='retired';render();});assert(await page.locator('.approved-b').isVisible());
  assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .home-bar').count(),0);checks.push('unsupported sub-route returns to approved B without retired list/detail');
  for(const width of [320,375,480]){await page.setViewportSize({width,height:850});const sizing=await page.locator('.approved-b').evaluate(el=>({width:el.getBoundingClientRect().width,viewport:innerWidth,doc:document.documentElement.scrollWidth}));assert(sizing.width<=width);assert(sizing.doc<=width);}
  checks.push('320 / 375 / 480px preview has no page-level horizontal overflow');assert.deepEqual(errors,[]);
  const result={at:new Date().toISOString(),passed:checks.length,checks,boundary:'local synthetic preview; stage filter names use PC canonical names; unsupported approved flows remain unconnected'};
  fs.writeFileSync(path.join(__dirname,'approved-bc-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
