'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],writes=[],external=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}return route.continue();});
  await context.addInitScript(()=>{
   window.__speechTest={starts:0,aborts:0,instances:[]};
   class FakeRecognition{constructor(){__speechTest.instances.push(this);}start(){__speechTest.starts++;this.onstart?.();}stop(){}abort(){__speechTest.aborts++;}}
   window.SpeechRecognition=window.webkitSpeechRecognition=FakeRecognition;
  });
  async function guards(page){await page.evaluate(()=>{window.__recoveryCalls=[];const deny=name=>()=>{__recoveryCalls.push(name);throw Error('Unexpected '+name);};window.fetch=deny('fetch');window.open=deny('open');Phase1.rpc=deny('rpc');Phase1.queue.enqueue=deny('enqueue');window.queueMobileContactOperation=deny('activity');window.pushWrite=deny('pushWrite');});}
  async function ready(screen){const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});await page.goto(origin+'/mobile.html?demo=1&review=guide&screen='+screen);await page.locator('.approved-'+screen.toLowerCase()).waitFor();await guards(page);return page;}
  async function reload(page,screen){await page.reload();await page.locator('.approved-'+screen.toLowerCase()).waitFor();await guards(page);}
  const records=page=>page.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies}));
  const draft=page=>page.evaluate(()=>structuredClone(MobileEntry.state()));
  const stored=page=>page.evaluate(()=>Object.fromEntries(Object.keys(sessionStorage).filter(key=>key.startsWith('crm:mobile-input-draft:v1:')).map(key=>[key,sessionStorage.getItem(key)])));
  async function setupD(page,memo='원래 상담 초안'){
   const card=page.locator('#sheetcard');await card.locator('[data-ce="res"][data-v="연결됨"]').click();await card.locator('[data-ce-in="memo"]').fill(memo);await card.locator('[data-ce-in="req"]').check();await card.locator('[data-ce="mode"][data-v="new"]').click();await card.locator('[data-ce-in="purpose"]').fill('고객 약속 결과 확인');await card.locator('[data-ce-in="plan"]').check();return draft(page);
  }
  async function enterSpeech(page){await page.locator('[data-ce="input-mic"]').click();await page.locator('.approved-i1,.approved-i2').waitFor();}
  async function speech(page,text,final=true,end=true){
   const starts=await page.evaluate(()=>__speechTest.starts);await page.locator('[data-gs="input-mic"]').click();assert.equal(await page.evaluate(()=>__speechTest.starts),starts+1);
   await page.evaluate(({text,final,end})=>{const recognition=__speechTest.instances.at(-1),item=Object.assign([{transcript:text}],{isFinal:final});recognition.onresult?.({results:[item]});if(end)recognition.onend?.();},{text,final,end});
  }
  async function safe(page){assert.deepEqual(await page.evaluate(()=>__recoveryCalls),[]);assert.equal(await page.locator('#scr .mv-now,#scr .flow-strip,#scr .mh-filter,#scr .mystat').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.dataset.mobileApprovedView),'approved');}
  {
   const page=await ready('D'),original=await setupD(page),before=await records(page);await enterSpeech(page);await speech(page,'음성 인식으로 추가된 문장');await page.locator('.approved-i2').waitFor();
   const edited='대표회의 후 회신 예정이며 견적 검토 결과만 확인합니다.';await page.locator('[data-input-transcript]').fill(edited);const saved=await stored(page);assert.equal(Object.keys(saved).length,1);assert.equal(await records(page),before);await safe(page);
   await reload(page,'D');assert.deepEqual(await draft(page),original);assert.equal(await page.evaluate(()=>__speechTest.starts),0);await enterSpeech(page);await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-input-transcript]').textContent(),edited);assert.notEqual(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');
   await page.locator('[data-gs="input-review-save"]').click();await page.locator('.approved-d').waitFor();assert.deepEqual(await draft(page),{...original,memo:edited});assert.equal(await records(page),before);assert.deepEqual(await stored(page),{});await safe(page);await page.close();
   checks.push('Actual D microphone entry → fake speech → I2 edit → real reload → same D re-entry restores reviewed text; explicit apply changes only the memo and removes the unsent review draft');
  }
  {
   const page=await ready('D'),original=await setupD(page,'부분 음성 전 상담'),before=await records(page);await enterSpeech(page);await speech(page,'아직 말하는 중인 부분',false,false);const partialText=await page.locator('[data-input-transcript]').textContent();
   await reload(page,'D');assert.deepEqual(await draft(page),original);await enterSpeech(page);await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-input-transcript]').textContent(),partialText);assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');
   const state=await page.evaluate(()=>MobileInputFlow.snapshot());assert.equal(state.session.partialSpeech,true);assert.equal(state.session.needsReview,true);assert.equal(state.draft.manuallyEdited,false);assert.equal(await page.evaluate(()=>__speechTest.starts),0);
   await page.locator('[data-gs="input-review-save"]').dispatchEvent('click');assert.deepEqual(await draft(page),original);await page.locator('[data-input-transcript]').fill('중단된 내용을 직접 확인하여 수정했습니다.');assert.notEqual(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');assert.equal(await records(page),before);await safe(page);await page.close();
   checks.push('Reload during partial speech restores the exact text as interrupted and blocks apply until manual review; it does not reopen the microphone or touch D/current work');
  }
  {
   const page=await ready('D');await setupD(page,'원본 A');await enterSpeech(page);await speech(page,'검토 중이던 내용');await page.locator('[data-input-transcript]').fill('예전 원본 A에서 작성한 검토 B');
   await reload(page,'D');const cached=await stored(page);await page.locator('[data-ce-in="memo"]').fill('새로 바뀐 원본 C');const current=await draft(page),before=await records(page);await page.locator('[data-ce="input-mic"]').click();
   assert.equal(await page.locator('.approved-d').count(),1);assert.equal(await page.locator('.approved-i1,.approved-i2').count(),0);assert.deepEqual(await draft(page),current);assert.deepEqual(await stored(page),cached);assert.equal(await records(page),before);await safe(page);await page.close();
   checks.push('A changed D origin stamp rejects re-entry rather than applying an old reviewed memo; both the new D input and old review remain intact');
  }
  {
   const page=await ready('D'),original=await setupD(page),before=await records(page);await enterSpeech(page);await speech(page,'임시 보관 전 문장');
   await page.evaluate(()=>{window.__originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(key).startsWith('crm:mobile-input-draft:v1:'))throw new DOMException('Synthetic quota','QuotaExceededError');return __originalStorageSet.call(this,key,value);};});
   const text='저장소 실패 중에도 현재 입력은 남아 있어야 합니다.';await page.locator('[data-input-transcript]').fill(text);assert.equal(await page.locator('[data-input-transcript]').textContent(),text);assert.match(await page.locator('.approved-input-footer').innerText(),/임시 보관 실패/);assert.deepEqual(await draft(page),original);
   await page.evaluate(()=>render());assert.equal(await page.locator('[data-input-transcript]').textContent(),text);await page.evaluate(()=>{Storage.prototype.setItem=__originalStorageSet;});await page.locator('[data-input-transcript]').fill(text+' 다시 시도');await reload(page,'D');await enterSpeech(page);assert.equal(await page.locator('[data-input-transcript]').textContent(),text+' 다시 시도');assert.equal(await records(page),before);await safe(page);await page.close();
   checks.push('A real sessionStorage write exception preserves editable text and reports failure; retrying after recovery stores it for the next reload without creating an operation');
  }
  {
   const page=await ready('D'),original=await setupD(page,'기존 방문 내용'),before=await records(page);await enterSpeech(page);
   const spoken='고객이 확인한 공사 범위와 다음 회신 조건을 함께 기록합니다. '.repeat(20),expected=original.memo+'\n'+spoken;
   assert(expected.length>300);await speech(page,spoken);await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-input-transcript]').textContent(),expected);assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');
   assert.equal((await page.evaluate(()=>MobileInputFlow.snapshot())).draft.transcript,expected);await reload(page,'D');assert.deepEqual(await draft(page),original);await enterSpeech(page);await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-input-transcript]').textContent(),expected);assert.equal(await page.evaluate(()=>__speechTest.starts),0);
   await page.locator('[data-gs="input-review-save"]').dispatchEvent('click');assert.deepEqual(await draft(page),original);const reviewed='기존 방문 기록 확인. 고객이 확인한 공사 범위와 다음 회신 조건을 상담 내용에 반영합니다.';await page.locator('[data-input-transcript]').fill(reviewed);await page.locator('[data-gs="input-review-save"]').click();await page.locator('.approved-d').waitFor();assert.deepEqual(await draft(page),{...original,memo:reviewed});assert.equal(await records(page),before);await safe(page);await page.close();
   checks.push('Speech longer than 300 characters is fully preserved with the existing memo across reload; D apply remains blocked until the user reduces it to the PC memo limit');
  }
  {
   const page=await ready('D'),original=await setupD(page,'이미 작성한 내용'),before=await records(page);await enterSpeech(page);const spoken='가'.repeat(10020),expected=original.memo+'\n'+spoken.slice(0,10000-original.memo.length-1);
   await speech(page,spoken);await page.locator('.approved-i2').waitFor();let snapshot=await page.evaluate(()=>MobileInputFlow.snapshot());assert.equal(snapshot.draft.transcript,expected);assert.equal(snapshot.draft.transcript.length,10000);assert.equal(snapshot.session.error,'VOICE_TEXT_LIMIT');assert.equal(snapshot.session.truncated,true);assert.equal(snapshot.session.needsReview,true);assert.equal(await page.evaluate(()=>__speechTest.aborts),1);assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');
   const persisted=await stored(page);assert.equal(Object.keys(persisted).length,1);await reload(page,'D');await enterSpeech(page);await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-input-transcript]').textContent(),expected);assert.equal(await page.evaluate(()=>__speechTest.starts),0);
   await page.evaluate(()=>{const result=MobileInputFlow.back(myDeals().find(d=>d.id===G.deal));if(result.render)render();});await page.locator('.approved-i1').waitFor();await page.locator('[data-gs="input-mic"]').click();await page.locator('.approved-i2').waitFor();snapshot=await page.evaluate(()=>MobileInputFlow.snapshot());assert.equal(snapshot.draft.transcript,expected);assert.equal(await page.evaluate(()=>__speechTest.starts),0);assert.deepEqual(await draft(page),original);assert.equal(await records(page),before);assert.equal(await page.locator('.approved-input-footer').innerText().then(s=>s.includes('임시 보관 실패')),false);await safe(page);await page.close();
   checks.push('Combined memo and speech respect the 10,000-character recovery cap: overflow stops recognition with an explicit error, preserves the prefix after reload and refuses another microphone session until edited');
  }
  {
   const page=await ready('D'),original=await setupD(page,'기존 상담 내용'),before=await records(page);await enterSpeech(page);await speech(page,'아직 확인하지 않은 부분 음성',false,false);await reload(page,'D');await enterSpeech(page);await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');
   await page.evaluate(()=>{const result=MobileInputFlow.back(myDeals().find(d=>d.id===G.deal));if(result.render)render();});await page.locator('.approved-i1').waitFor();await speech(page,'두 번째로 끝까지 말한 문장');await page.locator('.approved-i2').waitFor();
   const combined=original.memo+'\n아직 확인하지 않은 부분 음성\n두 번째로 끝까지 말한 문장',snapshot=await page.evaluate(()=>MobileInputFlow.snapshot());assert.equal(snapshot.draft.transcript,combined);assert.equal(snapshot.draft.manuallyEdited,false);assert.equal(snapshot.session.needsReview,true);assert.equal(snapshot.session.partialSpeech,true);assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');await page.locator('[data-gs="input-review-save"]').dispatchEvent('click');assert.deepEqual(await draft(page),original);
   await reload(page,'D');await enterSpeech(page);await page.locator('.approved-i2').waitFor();assert.equal(await page.locator('[data-input-transcript]').textContent(),combined);assert.equal(await page.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');const corrected='두 차례 말한 내용을 직접 확인해 공사 범위와 회신 조건을 수정했습니다.';await page.locator('[data-input-transcript]').fill(corrected);await page.locator('[data-gs="input-review-save"]').click();await page.locator('.approved-d').waitFor();assert.deepEqual(await draft(page),{...original,memo:corrected});assert.equal(await records(page),before);await safe(page);await page.close();
   checks.push('Completing a second dictation does not confirm an older interrupted fragment: manual-review flags survive restart and reload until the combined text is explicitly edited');
  }
  {
   const page=await ready('C'),before=await records(page);await page.locator('[data-gs="contact-card"]').click();await page.locator('.approved-i3').waitFor();
   const values={name:'명함 확인 후보',role:'관리과장',phone:'010-12O4-5678',company:'이 현장 관리사무소'};for(const [id,value]of Object.entries(values))await page.locator('[data-input-field][data-id="'+id+'"]').fill(value);
   assert.equal(await page.locator('[data-gs="input-card-photo"]').getAttribute('aria-disabled'),'true');assert.equal(await page.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');assert.equal(Object.keys(await stored(page)).length,1);await reload(page,'C');await page.locator('[data-gs="contact-card"]').click();await page.locator('.approved-i3').waitFor();
   for(const [id,value]of Object.entries(values))assert.equal(await page.locator('[data-input-field][data-id="'+id+'"]').textContent(),value);assert.equal(await page.locator('[data-input-field][data-id="phone"]').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');assert.equal(await records(page),before);await safe(page);await page.close();
   checks.push('Approved C contact-card entry recovers manually corrected I3 fields after reload, keeps the uncertain phone invalid and blocks real photo transmission/contact saving in demo');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const font='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';assert.deepEqual(external.filter(url=>url!==font),[]);
  const report={at:new Date().toISOString(),passed:checks.length,checks,blockedReadonlyAssets:[...new Set(external)],boundary:'Actual local candidate/fixture reload and UI clicks with a fake SpeechRecognition provider. All external requests, including the pre-existing font CSS, were blocked. No fixture response rewrite, production server, real microphone, OCR/photo transmission, customer action, queue write or deployment.'};fs.writeFileSync(path.join(__dirname,'stage8-recovery-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
