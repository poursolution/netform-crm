'use strict';
// Actual approved local screens with synthetic fixtures only. No production I/O.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 const checks=[],errors=[],requests=[],external=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
  await context.addInitScript(()=>{
   window.__backSpeech={starts:0,aborts:0,instances:[]};
   class FakeRecognition{constructor(){__backSpeech.instances.push(this);}start(){__backSpeech.starts++;this.onstart?.();}stop(){}abort(){__backSpeech.aborts++;}}
   window.SpeechRecognition=window.webkitSpeechRecognition=FakeRecognition;
  });
  async function ready(screen){
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))requests.push(request.url());});
   await page.goto(origin+'/mobile.html?demo=1&review=guide&screen='+screen);await page.locator('.approved-'+screen.toLowerCase()).waitFor();
   await page.evaluate(()=>{window.__backCalls=[];const deny=name=>()=>{__backCalls.push(name);throw Error('Unexpected '+name);};window.fetch=deny('fetch');window.open=deny('open');Phase1.rpc=deny('rpc');Phase1.queue.enqueue=deny('enqueue');window.queueMobileContactOperation=deny('activity');window.pushWrite=deny('pushWrite');});
   return page;
  }
  const records=page=>page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies}));
  const stored=page=>page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(key=>key.startsWith('crm:mobile-input-draft:v1:')).map(key=>[key,sessionStorage.getItem(key)])));
  const fields=page=>page.locator('[data-input-field]').evaluateAll(nodes=>Object.fromEntries(nodes.map(node=>[node.dataset.id,node.textContent])));
  const values={name:'명함 초안 보존 검사',role:'관리과장',phone:'010-1234-5678',company:'이 현장 관리사무소'};
  async function enterCard(page){await page.locator('[data-gs="contact-card"]').click();await page.locator('.approved-i3').waitFor();}
  async function fillCard(page){for(const [id,value]of Object.entries(values))await page.locator('[data-input-field][data-id="'+id+'"]').fill(value);}
  async function safe(page,before){
   assert.equal(await records(page),before,'No CRM record/request mutation');assert.deepEqual(await page.evaluate(()=>__backCalls),[]);
   assert.equal(await page.locator('#scr .mv-now,#scr .flow-strip,#scr .mh-filter,#scr .mystat').count(),0,'No legacy mobile UI');
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');
  }
  {
   const page=await ready('C'),before=await records(page);await enterCard(page);await fillCard(page);
   assert.deepEqual(await fields(page),values);assert.equal(Object.keys(await stored(page)).length,1);
   await page.locator('.approved-i3 [data-gs="back"]').click();await page.locator('.approved-c').waitFor();
   assert.equal(await page.evaluate(()=>MobileInputFlow.snapshot()),null);assert.equal(Object.keys(await stored(page)).length,1,'Ordinary back retains the unsent card draft');
   await enterCard(page);assert.deepEqual(await fields(page),values);assert.equal(await page.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');
   await page.locator('.approved-i3').screenshot({path:path.join(__dirname,'approved-i3-draft-recovery.png')});
   await safe(page,before);await page.close();
   checks.push('C → I3: all four manually edited fields survive ordinary back → C → I3, with an unsent draft retained and contact saving still blocked');
  }
  {
   const page=await ready('C'),before=await records(page);await enterCard(page);await fillCard(page);const oldRecord=await stored(page);
   await page.evaluate(()=>{window.__backStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(key).startsWith('crm:mobile-input-draft:v1:'))throw new DOMException('Synthetic quota','QuotaExceededError');return __backStorageSet.call(this,key,value);};});
   const editor=page.locator('[data-input-field][data-id="name"]'),handle=await editor.elementHandle(),latest={...values,name:'보관 실패 뒤 최신 이름'};
   await editor.fill(latest.name);assert.deepEqual(await fields(page),latest);
   assert.match(await page.locator('[data-input-card-helper]').innerText(),/임시 보관 실패/,'I3 existing helper reports a write failure immediately');
   assert.equal(await handle.evaluate(node=>node===document.activeElement&&node.isConnected),true,'Updating existing helper preserves the editable node and focus');
   assert.deepEqual(await stored(page),oldRecord,'Failed write leaves last valid storage untouched');
   await page.locator('.approved-i3 [data-gs="back"]').click();assert.equal(await page.locator('.approved-i3').count(),1,'Navigation is blocked while latest input cannot be retained');
   assert.deepEqual(await fields(page),latest);assert.deepEqual(await stored(page),oldRecord);
   assert.match(await page.locator('[data-input-card-helper]').innerText(),/임시 보관 실패/);
   await page.evaluate(()=>{Storage.prototype.setItem=__backStorageSet;});
   await page.locator('.approved-i3 [data-gs="back"]').click();await page.locator('.approved-c').waitFor();await enterCard(page);
   assert.deepEqual(await fields(page),latest);assert.doesNotMatch(await page.locator('[data-input-card-helper]').innerText(),/임시 보관 실패/);
   await safe(page,before);await page.close();
   checks.push('sessionStorage failure is reported in the existing helper without replacing the focused input; back stays on I3 until persistence succeeds, then latest input survives re-entry');
  }
  {
   const page=await ready('C'),before=await records(page);await enterCard(page);await fillCard(page);
   const otherStored=await page.evaluate(()=>{const key=Object.keys(sessionStorage).find(key=>key.startsWith('crm:mobile-input-draft:v1:')),row=JSON.parse(sessionStorage.getItem(key));row.value.draft.fields.name='다른 핸들이 보관한 이름';sessionStorage.setItem(key,JSON.stringify(row));return {[key]:sessionStorage.getItem(key)};});
   const latest={...values,name:'현재 화면에서 수정한 이름'},editor=page.locator('[data-input-field][data-id="name"]'),handle=await editor.elementHandle();
   await editor.fill(latest.name);assert.equal(await handle.evaluate(node=>node===document.activeElement&&node.isConnected),true);
   assert.match(await page.locator('[data-input-card-helper]').innerText(),/임시 보관 실패/);assert.deepEqual(await fields(page),latest);assert.deepEqual(await stored(page),otherStored);
   await page.locator('.approved-i3 [data-gs="back"]').click();assert.equal(await page.locator('.approved-i3').count(),1);
   assert.deepEqual(await fields(page),latest,'Current unsent text is not discarded on a conflicting writer');assert.deepEqual(await stored(page),otherStored,'A newer stored draft is not overwritten or removed');
   assert.equal((await page.evaluate(()=>MobileInputFlow.snapshot())).draft.fields.name,latest.name);
   await safe(page,before);await page.close();
   checks.push('A concurrent draft writer causes back to stay on I3; current edited text and the other handle’s stored draft both remain intact');
  }
  {
   const page=await ready('D'),before=await records(page),card=page.locator('#sheetcard');
   await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill('명시적 취소 뒤에도 유지할 기존 상담');
   await card.locator('[data-ce-in="req"]').check();await card.locator('[data-ce="mode"][data-v="new"]').click();await card.locator('[data-ce-in="purpose"]').fill('기존 고객 회신 확인');await card.locator('[data-ce-in="plan"]').check();
   const original=await page.evaluate(()=>structuredClone(MobileEntry.state()));await page.locator('[data-ce="input-mic"]').click();await page.locator('.approved-i1').waitFor();
   assert.equal(await page.evaluate(()=>__backSpeech.starts),0);await page.locator('[data-gs="input-mic"]').click();
   await page.evaluate(()=>{const recognition=__backSpeech.instances.at(-1);window.__lateBackSpeechResult=recognition.onresult;recognition.onresult?.({results:[Object.assign([{transcript:'아직 반영하지 않을 말하기 후보'}],{isFinal:false})]});});
   assert.equal(Object.keys(await stored(page)).length,1);await page.locator('.approved-i1 [data-gs="input-cancel"]').click();await page.locator('.approved-d').waitFor();
   assert.deepEqual(await page.evaluate(()=>MobileEntry.state()),original);assert.deepEqual(await stored(page),{});assert.equal(await page.evaluate(()=>MobileInputFlow.snapshot()),null);
   await page.evaluate(()=>__lateBackSpeechResult?.({results:[Object.assign([{transcript:'취소 후 늦게 도착한 후보'}],{isFinal:true})]}));
   assert.deepEqual(await page.evaluate(()=>MobileEntry.state()),original);assert.deepEqual(await stored(page),{});assert.equal(await page.locator('.approved-i1,.approved-i2,.approved-i3').count(),0);
   await safe(page,before);await page.close();
   checks.push('Explicit I1 cancellation discards only the review draft, aborts dictation and restores the unchanged D result/memo/task/request; late provider results cannot revive it');
  }
  {
   for(const change of ['account','version','deal']){
    const page=await ready('D'),card=page.locator('#sheetcard');
    await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill('현재 입력을 다른 맥락에 반영하지 않음');
    await page.locator('[data-ce="input-mic"]').click();await page.locator('.approved-i1').waitFor();
    await page.evaluate(change=>{
     if(change==='account')Phase1.profile={...Phase1.profile,auth_uid:'22222222-2222-4222-8222-222222222222',user_id:'22222222-2222-4222-8222-222222222222'};
     else if(change==='version')myDeals().find(d=>String(d.id)===String(G.deal)).version++;
     else G.deal='22222222-2222-4222-8222-222222222222';
    },change);
    const afterContextChange=await records(page);await page.locator('.approved-i1 [data-gs="input-cancel"]').click();
    assert.equal(await page.locator('.approved-i1,.approved-i2,.approved-i3').count(),0,change);
    assert.equal(await page.evaluate(()=>MobileGuideShell.state.detailView),'',change+' input view cleared');
    assert.equal(await page.evaluate(()=>MobileInputFlow.snapshot()),null,change+' input flow released');
    assert((await page.locator('#scr').innerHTML()).length>0,change+' must not leave a blank mobile screen');
    assert.equal(await page.evaluate(()=>MobileApprovedBoot.state()),'approved',change+' boot should not remain pending');
    await safe(page,afterContextChange);await page.close();
   }
   checks.push('Account, deal-version and target changes while I1 is open cannot restore a stale D editor or leave an empty pending screen; the approved view recovers without writes');
  }
  {
   const page=await ready('C'),before=await records(page);
   await page.evaluate(()=>{
    const sample=structuredClone(myDeals()[0]);window.__backListRows=Array.from({length:45},(_,i)=>({...structuredClone(sample),id:'77777777-7777-4777-8777-'+String(i+1).padStart(12,'0'),nm:'조회 현장 '+String(i+1).padStart(2,'0'),code:'consulting'}));
    window.myDeals=()=>__backListRows;G.tab='mine';G.deal=null;G.sub=null;G.brandF='전체';
    Object.assign(MobileGuideShell.state,{q:'조회 현장',stage:'consulting',page:2,scroll:0,detailView:''});render();
    document.querySelector('.approved-list').scrollTop=350;
   });
   await page.locator('.approved-b').waitFor();
   const original=await page.evaluate(()=>({q:MobileGuideShell.state.q,stage:MobileGuideShell.state.stage,page:MobileGuideShell.state.page,scroll:document.querySelector('.approved-list').scrollTop,ids:[...document.querySelectorAll('.approved-b [data-gs="deal"]')].map(node=>node.dataset.id)}));
   assert.equal(original.ids.length,20);assert.equal(original.scroll,350);
   await page.locator('.approved-b [data-gs="deal"]').nth(5).dispatchEvent('click');await page.locator('.approved-c').waitFor();await enterCard(page);await fillCard(page);
   await page.locator('.approved-i3 [data-gs="back"]').click();await page.locator('.approved-c').waitFor();await page.locator('.approved-c [data-gs="back"]').click();await page.locator('.approved-b').waitFor();
   const returned=await page.evaluate(()=>({q:MobileGuideShell.state.q,stage:MobileGuideShell.state.stage,page:MobileGuideShell.state.page,scroll:document.querySelector('.approved-list').scrollTop,ids:[...document.querySelectorAll('.approved-b [data-gs="deal"]')].map(node=>node.dataset.id)}));
   assert.deepEqual(returned,original);await safe(page,before);await page.close();
   checks.push('B list search, stage filter, page 2, its 20 rows and scroll position survive B → C → I3 → C → B');
  }
  {
   const page=await ready('C');await enterCard(page);await fillCard(page);
   await page.locator('.approved-i3 [data-gs="back"]').click();await page.locator('.approved-c').waitFor();
   const original=await stored(page);assert.equal(Object.keys(original).length,1);
   await page.evaluate(()=>{myDeals().find(d=>String(d.id)===String(G.deal)).version++;});
   const afterVersionChange=await records(page);await page.locator('[data-gs="contact-card"]').click();
   assert.equal(await page.locator('.approved-c').count(),1,'A stale retained draft must not open an empty I3 editor');
   assert.equal(await page.locator('.approved-i1,.approved-i2,.approved-i3').count(),0);
   assert.equal(await page.evaluate(()=>MobileInputFlow.snapshot()),null);assert.equal(await page.evaluate(()=>MobileGuideShell.state.detailView),'');
   assert.deepEqual(await stored(page),original,'The original draft remains byte-for-byte intact after a changed deal version');
   await safe(page,afterVersionChange);await page.close();
   checks.push('A retained I3 draft bound to an older deal version cannot reopen as an empty editor: C stays visible and the original stored text is preserved unchanged');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  const font='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';assert.deepEqual(external.filter(url=>url!==font),[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,blockedReadonlyAssets:[...new Set(external)],boundary:'Actual local approved C/I3/D/I1 clicks; fake SpeechRecognition, synthetic storage failures and competing draft. All external requests blocked. No production server, real microphone, OCR, contact write, CRM operation or deployment.'};
  fs.writeFileSync(path.join(__dirname,'stage8-back-browser-verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
