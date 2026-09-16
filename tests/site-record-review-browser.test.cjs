const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const source=fs.readFileSync('pc-site-record-review.js','utf8');
test('Site record review renders counts, filters and 20-row pagination',async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();
 const items=Array.from({length:45},(_,i)=>({source_type:i<25?'deal':'inquiry',source_id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`현장 ${i+1}`,address:`주소 ${i+1}`,occurred_at:'2026-09-16T00:00:00Z',site_candidates:i%3===0?[{site_id:'11111111-1111-4111-8111-111111111111',name:`현장 ${i+1}`,address:`주소 ${i+1}`,exact_address:true}]:[]}));
 await page.setContent('<main id="root"></main>');
 await page.evaluate(rows=>{window.confirm=()=>true;window.toast=()=>{};window.G={page:'sites'};window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async name=>name==='crm_site_record_link_review_list_v1'?{contract_version:1,items:rows}:{ok:true,site_id:'11111111-1111-4111-8111-111111111111'}};},items);
 await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));await page.waitForSelector('.site-link-review-row');
 assert.equal(await page.locator('.site-link-review-row').count(),20);
 const buttons=await page.locator('.site-link-review-toolbar button').allTextContents();assert.deepEqual(buttons,['전체 45','영업 25','문의 20','기존 Site 후보 15','별도 현장 후보 30']);
 assert.equal(await page.locator('.site-link-review-pager span').textContent(),'1 / 3 · 45건');
 await page.getByRole('button',{name:'다음 →'}).click();assert.equal(await page.locator('.site-link-review-pager span').textContent(),'2 / 3 · 45건');
 await page.getByRole('button',{name:'문의 20'}).click();assert.equal(await page.locator('.site-link-review-row').count(),20);assert.equal(await page.locator('.site-link-review-pager span').textContent(),'1 / 1 · 20건');
 await browser.close();
});

test('successful resolution refreshes the changed operational domain',async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage();
  await page.setContent('<main id="root"></main>');
  await page.evaluate(()=>{window.domainCalls=[];window.confirm=()=>true;window.toast=()=>{};window.invalidateSiteMasterData=()=>{};window.refreshOperationalDomains=async(d,r)=>domainCalls.push({d,r});window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async(name)=>name==='crm_site_record_link_review_list_v1'?{contract_version:1,items:[{source_type:'inquiry',source_id:'00000000-0000-4000-8000-000000000001',name:'검증 현장',address:'검증 주소',occurred_at:'2026-09-16',site_candidates:[]}]}:{ok:true,site_id:'11111111-1111-4111-8111-111111111111'}};});
  await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));await page.getByRole('button',{name:'별도 현장',exact:true}).click();await page.waitForFunction(()=>domainCalls.length===1,{timeout:3000});
  assert.deepEqual(await page.evaluate(()=>domainCalls[0]),{d:['inquiry_core'],r:'site-link-review'});
 }finally{await browser.close();}
});
