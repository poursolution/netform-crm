'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],measurements=[],errors=[],writes=[];
 const selector=s=>'.approved-'+s.toLowerCase().replace('-','');
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await context.addInitScript(()=>{
   window.__speechTest={starts:0,stops:0,aborts:0,instances:[]};
   class FakeRecognition{constructor(){__speechTest.instances.push(this);}start(){__speechTest.starts++;this.onstart?.();}stop(){__speechTest.stops++;}abort(){__speechTest.aborts++;}}
   window.SpeechRecognition=FakeRecognition;window.webkitSpeechRecognition=FakeRecognition;
  });
  async function create(screen,missing){
   const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({screen,missing:missing||'',message:e.message}));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
   if(missing)await page.route('**/'+missing+'*',r=>r.abort());
   await page.goto(origin+'/mobile.html?demo=1&review=guide&screen='+screen+'&reset=1');return page;
  }
  async function ready(screen){const page=await create(screen);await page.locator(selector(screen)).waitFor();await page.evaluate(()=>document.fonts.ready);return page;}
  async function noLegacy(page){assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel,#scr .stage-guide').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');}
  async function failClosed(page){await page.waitForFunction(()=>document.documentElement.dataset.mobileApprovedView==='pending');const state=await page.evaluate(()=>({count:document.querySelector('#scr').children.length,visible:getComputedStyle(document.querySelector('#stage')).visibility,display:getComputedStyle(document.querySelector('#stage')).display,legacy:document.querySelectorAll('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel').length}));assert.equal(state.count,0);assert.equal(state.legacy,0);assert(state.visible==='hidden'||state.display==='none');}
  const snapshot=p=>p.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies,next:DEALS.map(d=>[d.nextAction,d.nextActionObj,d.openNextActions])}));
  async function guards(page){await page.evaluate(()=>{window.__inputSafetyCalls=[];const deny=name=>function(){__inputSafetyCalls.push(name);throw Error('Input review must not call '+name);};window.fetch=deny('fetch');window.open=deny('open');Phase1.rpc=deny('rpc');Phase1.queue.enqueue=deny('enqueue');window.pushWrite=deny('pushWrite');window.queueMobileContactOperation=deny('contact');});}
  for(const width of [375,320,480])for(const screen of ['I-1','I-2','I-3']){
   const page=await ready(screen);await page.setViewportSize({width,height:812});await noLegacy(page);
   const m=await page.locator(selector(screen)).evaluate(el=>({pageOverflow:document.documentElement.scrollWidth>innerWidth+1,frameOverflow:el.scrollWidth>el.clientWidth+1,width:el.getBoundingClientRect().width,font:getComputedStyle(el).fontFamily,wrongFontSizes:[...el.querySelectorAll('[style]')].filter(n=>n.style.fontSize&&Math.abs(parseFloat(n.style.fontSize)-parseFloat(getComputedStyle(n).fontSize))>.1).length}));
   measurements.push({screen,viewport:width,...m});assert.equal(m.pageOverflow,false,screen+'/'+width);assert.equal(m.frameOverflow,false,screen+'/'+width);assert(m.width<=width+1);assert.match(m.font,/ClaudeMobilePretendard/);assert.equal(m.wrongFontSizes,0);assert.equal(await page.evaluate(()=>__speechTest.starts),0);
   if(width===375)await page.locator(selector(screen)).screenshot({path:path.join(__dirname,'approved-'+screen.toLowerCase().replace('-','')+'-implemented.png')});await page.close();
  }
  checks.push('I1/I2/I3 retain approved font and sizing without horizontal overflow at320/375/480; merely opening any screen never starts recognition');
  for(const screen of ['I-1','I-2','I-3'])for(const missing of ['mobile-approved-input-source.js','mobile-approved-input.js','mobile-input-review-model.js','mobile-input-flow.js']){const page=await create(screen,missing);await failClosed(page);assert.equal(await page.evaluate(()=>__speechTest.starts),0);await page.close();}
  checks.push('Missing source, renderer, read-model or input-flow fails closed on all three routes without the retired UI');
  {
   const page=await ready('I-1');await guards(page);const before=await snapshot(page);await page.locator('[data-gs="input-mic"]').click();assert.equal(await page.evaluate(()=>__speechTest.starts),1);
   await page.evaluate(()=>{const r=__speechTest.instances.at(-1);window.__lateInput={result:r.onresult,end:r.onend,error:r.onerror};});
   await page.locator('[data-gs="input-cancel"]').click();assert.equal(await page.locator('.approved-i1').count(),0);assert.equal(await page.evaluate(()=>__speechTest.aborts),1);
   await page.evaluate(()=>{const result=Object.assign([{transcript:'늦은 결과는 반영하지 않음'}],{isFinal:true});__lateInput.result?.({results:[result]});__lateInput.end?.();__lateInput.error?.({error:'network'});});
   assert.equal(await snapshot(page),before);assert.equal(await page.locator('body').filter({hasText:'늦은 결과는 반영하지 않음'}).count(),0);assert.deepEqual(await page.evaluate(()=>__inputSafetyCalls),[]);await noLegacy(page);await page.close();
   checks.push('I1 microphone begins only after explicit click; cancel aborts it and rejects late transcript/end/error callbacks without saving');
  }
  {
   const page=await ready('I-2');await guards(page);const before=await snapshot(page),editor=page.locator('[data-input-transcript]');await editor.fill('다음 주 금요일 견적을 검토하고 연락하기');
   assert.equal(await snapshot(page),before);await page.locator('[data-gs="input-review-save"]').dispatchEvent('click');assert.equal(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>__inputSafetyCalls),[]);
   assert.equal(await page.evaluate(()=>__speechTest.starts),0);await noLegacy(page);await page.close();
   checks.push('I2 editing and direct-route save attempt cannot auto-create a date/task, complete a request or save contact activity');
  }
  {
   const page=await ready('I-2');await guards(page);const before=await snapshot(page),longText='직접 쓴 상담 내용을 잘라 버리면 안 됩니다. '.repeat(20);
   assert(longText.length>300);await page.locator('[data-input-transcript]').fill(longText);await page.locator('[data-gs="input-candidate"][data-id="candidate-0"]').click();
   assert.equal(await page.locator('[data-input-transcript]').textContent(),longText);assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');
   assert.equal(await page.evaluate(()=>MobileInputFlow.snapshot().draft.transcript),longText);await page.locator('.approved-i2 [data-gs="back"]').click();await page.locator('.approved-i1').waitFor();
   assert.equal(await page.locator('[data-input-transcript]').textContent(),longText);await page.evaluate(()=>render());assert.equal(await page.locator('[data-input-transcript]').textContent(),longText);assert.equal(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>__inputSafetyCalls),[]);await noLegacy(page);await page.close();
   checks.push('A transcript longer than300 characters remains editable and intact through candidate selection, I2→I1 back and rerender; apply stays blocked');
  }
  {
   const page=await ready('I-3');await guards(page);const before=await snapshot(page),phone=page.locator('[data-input-field][data-id="phone"]');assert.equal(await phone.getAttribute('aria-invalid'),'true');
   const normalStyle=await page.locator('[data-input-field][data-id="name"]').getAttribute('style');
   assert.equal(await page.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');await page.locator('[data-gs="input-card-save"]').dispatchEvent('click');await phone.fill('01012345678');
   assert.equal(await phone.getAttribute('aria-invalid'),'false');assert.equal(await phone.getAttribute('style'),normalStyle);
   const longName='긴 명함 이름은 자동 삭제하지 않기 '.repeat(20);await page.locator('[data-input-field][data-id="name"]').fill(longName);assert.equal(await page.locator('[data-input-field][data-id="name"]').getAttribute('aria-invalid'),'true');await page.evaluate(()=>render());
   assert.equal(await page.locator('[data-input-field][data-id="name"]').textContent(),longName);assert.equal(await page.locator('[data-input-field][data-id="name"]').getAttribute('aria-invalid'),'true');
   const legacyName=await page.evaluate(()=>{G.pnm='원래 현장명 보존';scanCard();return G.pnm;});assert.equal(legacyName,'원래 현장명 보존');
   assert.equal(await page.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');await page.locator('[data-gs="input-card-save"]').dispatchEvent('click');assert.equal(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>__inputSafetyCalls),[]);await noLegacy(page);await page.close();
   checks.push('I3 corrected phone restores original normal style; oversized fields remain intact but invalid after rerender; save remains blocked, and retired scanCard cannot fabricate a site name');
  }
  {
   const page=await ready('D');const card=page.locator('#sheetcard');await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill('이어받을 기존 상담');await card.locator('[data-ce-in="req"]').check();
   await card.locator('[data-ce="mode"][data-v="new"]').click();await card.locator('[data-ce-in="purpose"]').fill('고객 요청 자료 확인');await card.locator('[data-ce-in="plan"]').check();await guards(page);
   const records=await snapshot(page),draft=await page.evaluate(()=>structuredClone(MobileEntry.state()));
   const opened=await page.evaluate(()=>{window.__inputDraftHandle=MobileEntry.captureInputDraft();const ok=MobileInputFlow.open(DEALS[0],'I-2',{draftHandle:__inputDraftHandle});MobileGuideShell.state.detailView='input';render();return {captured:__inputDraftHandle.ok,opened:ok};});assert.deepEqual(opened,{captured:true,opened:true});await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-input-transcript]').innerText(),draft.memo);
   const tooLong='기존 응대 초안에 붙이면 안 되는 긴 후보 '.repeat(20);await page.locator('[data-input-transcript]').fill(tooLong);assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');await page.locator('[data-gs="input-review-save"]').dispatchEvent('click');await page.evaluate(()=>render());assert.equal(await page.locator('[data-input-transcript]').textContent(),tooLong);assert.deepEqual(await page.evaluate(()=>structuredClone(MobileEntry.state())),draft);
   await page.locator('[data-input-transcript]').fill('금요일 일정은 별도로 확인하고 상담 내용만 수정');assert.notEqual(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');await page.locator('[data-gs="input-review-save"]').click();await page.locator('.approved-d').waitFor();
   const result=await page.evaluate(()=>({state:structuredClone(MobileEntry.state()),saved:MobileSaveJournal.read('contact',DEALS[0].id).input,replay:MobileEntry.applyInputDraft(__inputDraftHandle,'다시 적용')}));
   const expected={...draft,memo:'금요일 일정은 별도로 확인하고 상담 내용만 수정'};assert.deepEqual(result.state,expected);assert.deepEqual(result.saved,expected);assert.equal(result.replay.ok,false);assert.equal(await snapshot(page),records);assert.deepEqual(await page.evaluate(()=>__inputSafetyCalls),[]);
   const cancelDraft=await page.evaluate(()=>{window.__inputDraftHandle=MobileEntry.captureInputDraft();MobileInputFlow.open(DEALS[0],'I-1',{draftHandle:__inputDraftHandle});MobileGuideShell.state.detailView='input';render();return structuredClone(MobileEntry.state());});await page.locator('[data-input-transcript]').fill('취소해서 버릴 후보');await page.locator('[data-gs="input-cancel"]').click();await page.locator('.approved-d').waitFor();assert.deepEqual(await page.evaluate(()=>structuredClone(MobileEntry.state())),cancelDraft);assert.equal(await snapshot(page),records);await page.close();
   checks.push('D→I2 explicit apply changes only memo in the same local journal, restores D and consumes the handle; result/task/date/request selections survive, and I1 cancel preserves the original draft');
  }
  {
   for(const changed of ['memo','target','owner','session']){
    const page=await ready('D');const card=page.locator('#sheetcard');await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill('변경 전 초안');await guards(page);
    await page.evaluate(()=>{window.__inputDraftHandle=MobileEntry.captureInputDraft();});
    if(changed==='memo')await card.locator('[data-ce-in="memo"]').fill('다른 곳에서 이미 수정한 메모');
    else await page.evaluate(changed=>{if(changed==='target')DEALS[0].version++;else{const prior=Phase1.profile,p='77777777-7777-4777-8777-777777777777';Phase1.profile={...prior,auth_uid:p,user_id:p};MobileSaveJournal.session();if(changed==='session'){Phase1.profile=prior;MobileSaveJournal.session();}}},changed);
    const before=await snapshot(page),draft=await page.evaluate(()=>JSON.stringify(MobileEntry.state()));const result=await page.evaluate(()=>MobileEntry.applyInputDraft(__inputDraftHandle,'늦게 도착한 결과'));assert.equal(result.ok,false,changed+' changed handle must reject');assert.equal(await page.evaluate(()=>JSON.stringify(MobileEntry.state())),draft);assert.equal(await snapshot(page),before);assert.deepEqual(await page.evaluate(()=>__inputSafetyCalls),[]);await page.close();
   }
   checks.push('A changed memo, deal version, account or same-account session rejects the stale input handle without overwriting the current draft');
  }
  {
   const page=await ready('D');const card=page.locator('#sheetcard');await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill('저장 중 수정 금지');
   await page.evaluate(()=>{window.__inputDraftHandle=MobileEntry.captureInputDraft();Phase1.queue.flush=()=>new Promise(()=>{});});await card.locator('[data-ce="save"]').click();await page.waitForFunction(()=>__review.rows.length===1);
   const protectedDraft=await page.evaluate(()=>({capture:MobileEntry.captureInputDraft(),apply:MobileEntry.applyInputDraft(__inputDraftHandle,'진행 중 바꾸면 안 됨'),state:structuredClone(MobileEntry.state()),rows:__review.rows.length}));assert.equal(protectedDraft.capture.ok,false);assert.equal(protectedDraft.apply.ok,false);assert.equal(protectedDraft.state.memo,'저장 중 수정 금지');assert.equal(protectedDraft.rows,1);await page.close();
   checks.push('A pending synthetic contact save blocks both draft capture and transcript apply; it does not enqueue a duplicate activity');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,measurements,boundary:'Synthetic local preview with a fake SpeechRecognition constructor. No real microphone, OCR, AI, customer send, database write or deployment was exercised.'};
  fs.writeFileSync(path.join(__dirname,'stage8-input-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
