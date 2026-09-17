const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch=()=>chromium.launch({headless:true,...(process.env.EDGE_PATH?{executablePath:process.env.EDGE_PATH}:{})});
const source=fs.readFileSync('pc-site-record-review.js','utf8');
test('Site record review renders counts, filters and 20-row pagination',async()=>{
 const browser=await launch();const page=await browser.newPage();
 const items=Array.from({length:45},(_,i)=>({source_type:i<25?'deal':'inquiry',source_id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,name:`현장 ${i+1}`,address:`주소 ${i+1}`,occurred_at:'2026-09-16T00:00:00Z',site_candidates:i%3===0?[{site_id:'11111111-1111-4111-8111-111111111111',name:`현장 ${i+1}`,address:`주소 ${i+1}`,exact_address:true,match_reason:'이름·주소 일치',match_score:150}]:[]}));
 await page.setContent('<main id="root"><section class="site-command"></section></main>');
 await page.evaluate(rows=>{window.confirm=()=>true;window.toast=()=>{};window.G={page:'sites'};window.SiteReviewShortcut=(root,kind,label,count,target)=>{let nav=root.querySelector('.site-review-shortcuts');if(!nav){nav=document.createElement('nav');nav.className='site-review-shortcuts';root.append(nav);}const button=document.createElement('button');button.dataset.reviewShortcut=kind;button.textContent=label+' '+count+'건';button.onclick=()=>{target.hidden=false;};nav.append(button);};window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async name=>name==='crm_site_record_link_review_list_v1'?{contract_version:1,items:rows}:{ok:true,site_id:'11111111-1111-4111-8111-111111111111'}};},items);
 await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));await page.getByRole('button',{name:'영업·문의 미연결 45건'}).click();await page.waitForSelector('.site-link-review-row');
 assert.equal(await page.locator('.site-link-review-row').count(),20);
 assert.match(await page.locator('.site-link-review-row').first().innerText(),/영업 · #00000000 · 주소 1/);
 assert.match(await page.locator('select option').nth(1).textContent(),/이름·주소 일치 · 근거 150/);
 assert.equal(await page.getByRole('button',{name:'선택 현장에 연결'}).first().isDisabled(),true);await page.locator('select').first().selectOption('11111111-1111-4111-8111-111111111111');assert.equal(await page.getByRole('button',{name:'선택 현장에 연결'}).first().isEnabled(),true);
 assert.match(await page.locator('main').innerText(),/미연결 45건 · 중복 단서 0건 · 주소 일치 15건 · 이름 후보 0건 · 별도 현장 후보 30건 · 현장명 정리 0건/);const buttons=await page.locator('.site-link-review-toolbar button').allTextContents();assert.deepEqual(buttons,['전체 45','중복 단서 0','영업 25','문의 20','주소 일치 후보 15','이름 후보 0','별도 현장 후보 30','현장명 정리 0']);
 assert.equal(await page.locator('.site-link-review-pager span').textContent(),'1 / 3 · 45건');
 await page.getByRole('button',{name:'다음 →'}).click();assert.equal(await page.locator('.site-link-review-pager span').textContent(),'2 / 3 · 45건');
 await page.getByRole('button',{name:'문의 20'}).click();assert.equal(await page.locator('.site-link-review-row').count(),20);assert.equal(await page.locator('.site-link-review-pager span').textContent(),'1 / 1 · 20건');
 assert.equal(await page.locator('[data-review-shortcut="records"]').count(),1);await page.evaluate(()=>{Phase1.profile={auth_uid:'rep',permission_role:'rep'};dispatchEvent(new Event('phase1:profile'));});assert.equal(await page.locator('[data-site-record-review]').count(),0);assert.equal(await page.locator('[data-review-shortcut="records"]').count(),0);
 await browser.close();
});

test('lookalike Site review rows expose their distinct source IDs',async()=>{
 const browser=await launch();try{const page=await browser.newPage(),items=['00000001','00000002'].map(suffix=>({source_type:'inquiry',source_id:`00000000-0000-4000-8000-${suffix.padStart(12,'0')}`,name:'같은 현장',address:'같은 주소',occurred_at:'2026-09-16',site_candidates:[]}));
  await page.setContent('<main id="root"></main>');await page.evaluate(rows=>{window.toast=()=>{};window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async()=>({contract_version:3,items:rows})};},items);
  await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));await page.waitForSelector('.site-link-review-row');
  const text=await page.locator('.site-link-review-row').allTextContents();assert.match(text[0],/문의 · #00000001/);assert.match(text[1],/문의 · #00000002/);
 }finally{await browser.close();}
});

test('same-day rows with identical evidence are exposed as duplicate clues',async()=>{
 const browser=await launch();try{const page=await browser.newPage(),items=['00000001','00000002'].map(suffix=>({source_type:'inquiry',source_id:`00000000-0000-4000-8000-${suffix.padStart(12,'0')}`,name:'같은 현장',address:'같은 주소',occurred_at:'2026-09-16',evidence:{phone:'010-0000-0000',work:'옥상방수',inquiry:'같은 문의'},site_candidates:[]}));
  await page.setContent('<main id="root"></main>');await page.evaluate(rows=>{window.toast=()=>{};window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async()=>({contract_version:3,items:rows})};},items);
  await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));await page.waitForSelector('.site-link-review-row');
  assert.match(await page.locator('main').innerText(),/중복 단서 2건/);await page.getByRole('button',{name:'중복 단서 2'}).click();assert.equal(await page.locator('.site-link-review-row.duplicate-clue').count(),2);assert.match(await page.locator('.site-link-duplicate').first().textContent(),/동일 단서 2건/);
 }finally{await browser.close();}
});

test('successful resolution refreshes the changed operational domain',async()=>{
 const browser=await launch();try{const page=await browser.newPage();
  await page.setContent('<main id="root"></main>');
  await page.evaluate(()=>{window.domainCalls=[];window.confirm=()=>true;window.toast=()=>{};window.invalidateSiteMasterData=()=>{};window.refreshOperationalDomains=async(d,r)=>domainCalls.push({d,r});window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async(name)=>name==='crm_site_record_link_review_list_v1'?{contract_version:1,items:[{source_type:'inquiry',source_id:'00000000-0000-4000-8000-000000000001',name:'검증 현장',address:'검증 주소',occurred_at:'2026-09-16',site_candidates:[]}]}:{ok:true,source_type:'inquiry',source_id:'00000000-0000-4000-8000-000000000001',resolution:'separate',site_id:'11111111-1111-4111-8111-111111111111'}};});
  await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));await page.getByRole('button',{name:'별도 현장',exact:true}).click();await page.waitForFunction(()=>domainCalls.length===1,{timeout:3000});
  assert.deepEqual(await page.evaluate(()=>domainCalls[0]),{d:['inquiry_core'],r:'site-link-review'});
 }finally{await browser.close();}
});

test('placeholder name requires corrected canonical Site details',async()=>{
 const browser=await launch();try{const page=await browser.newPage();
  await page.setContent('<main id="root"></main>');
  await page.evaluate(()=>{window.calls=[];window.answers=['광교 새빛아파트','경기 수원시 테스트로 1'];window.prompt=()=>answers.shift();window.confirm=()=>true;window.toast=()=>{};window.invalidateSiteMasterData=()=>{};window.refreshOperationalDomains=async()=>{};window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async(name,args)=>{calls.push({name,args});if(name==='crm_site_record_link_review_list_v1')return {contract_version:3,items:[{source_type:'deal',source_id:'00000000-0000-4000-8000-000000000009',name:'황윤선 전체고객',address:null,occurred_at:'2026-09-16',evidence:{customer_name:'테스트 고객',work:'옥상 방수'},site_candidates:[]}]};return {ok:true,source_type:'deal',source_id:'00000000-0000-4000-8000-000000000009',resolution:'separate',site_id:'44444444-4444-4444-8444-444444444444'};}};});
  await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));assert.match(await page.locator('main').innerText(),/원본 단서 · 고객 테스트 고객 · 공사 옥상 방수/);await page.getByRole('button',{name:'현장명 정리 1'}).click();await page.getByRole('button',{name:'올바른 현장명 입력'}).click();await page.waitForFunction(()=>calls.some(x=>x.name==='crm_site_record_corrected_separate_v1'));
  assert.deepEqual(await page.evaluate(()=>calls.find(x=>x.name==='crm_site_record_corrected_separate_v1').args),{p_source_type:'deal',p_source_id:'00000000-0000-4000-8000-000000000009',p_site_name:'광교 새빛아파트',p_address:'경기 수원시 테스트로 1'});
 }finally{await browser.close();}
});

test('mismatched resolution acknowledgement never refreshes or claims success',async()=>{
 const browser=await launch();try{const page=await browser.newPage();
  await page.setContent('<main id="root"></main>');
  await page.evaluate(()=>{window.domainCalls=[];window.messages=[];window.confirm=()=>true;window.toast=m=>messages.push(m);window.invalidateSiteMasterData=()=>{};window.refreshOperationalDomains=async(d,r)=>domainCalls.push({d,r});window.Phase1={profile:{auth_uid:'admin',permission_role:'admin'},rpc:async(name)=>name==='crm_site_record_link_review_list_v1'?{contract_version:3,items:[{source_type:'inquiry',source_id:'00000000-0000-4000-8000-000000000001',name:'검증 현장',address:'검증 주소',occurred_at:'2026-09-16',site_candidates:[]}]}:{ok:true,source_type:'deal',source_id:'00000000-0000-4000-8000-000000000099',resolution:'linked',site_id:'11111111-1111-4111-8111-111111111111'}};});
  await page.addScriptTag({content:source});await page.evaluate(()=>PCSiteRecordReview.mount(document.getElementById('root')));await page.getByRole('button',{name:'별도 현장',exact:true}).click();await page.waitForFunction(()=>messages.some(x=>x.includes('확인하지 못했습니다.')));
  assert.equal(await page.evaluate(()=>domainCalls.length),0);assert.equal(await page.getByRole('button',{name:'별도 현장',exact:true}).isEnabled(),true);
 }finally{await browser.close();}
});
