'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),server=require('./server.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await context.addInitScript(()=>{window.__voiceLifecycle={instances:[],aborts:0};window.SpeechRecognition=class{constructor(){__voiceLifecycle.instances.push(this);}start(){this.onstart?.();}stop(){}abort(){__voiceLifecycle.aborts++;}};});
  async function ready(screen='I-3'){
   const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});await p.goto(origin+'/mobile.html?demo=1&review=guide&screen='+screen+'&reset=1');await p.locator('.approved-input').waitFor();
   await p.evaluate(screen=>{
    window.__forbidden=[];const deny=name=>()=>{__forbidden.push(name);throw Error('Forbidden '+name);};window.fetch=deny('fetch');Phase1.rpc=deny('rpc');window.pushWrite=deny('write');if(Phase1.queue)Phase1.queue.enqueue=deny('enqueue');
    window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__storageFail&&String(k).startsWith('crm:mobile-input-draft:v1:'))throw Error('synthetic quota');return __storageSet.call(this,k,v);};
    const d=myDeals().find(x=>x.id===G.deal);MobileInputFlow.reset({discard:true});DEMO=false;LIVE=true;
    window.__matches=[];window.__matchResolve=[];window.ContactMatchReader={read(args){const i=__matches.push(args)-1;return new Promise(resolve=>__matchResolve[i]=resolve);}};
    window.__lateMatch=(index,total=9)=>{const call=__matches[index];__matchResolve[index]({ok:true,status:'ready',contract:'contact-match-read-v1',actor_auth_uid:Phase1.profile.auth_uid,actor_user_id:Phase1.profile.user_id,object_id:call.dealId.toLowerCase(),object_version:call.expectedVersion,phone:call.phone,scope:'authorized_deals_only',page:1,page_size:20,total,has_more:false,candidates:[{contactId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'늦은 후보',sites:[],canLink:false}]});};
    MobileInputFlow.open(d,screen);MobileGuideShell.state.detailView='input';render();
   },screen);await p.locator('.approved-input').waitFor();return p;
  }
  const hide=p=>p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  const show=p=>p.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  async function safe(p){assert.deepEqual(await p.evaluate(()=>__forbidden),[]);assert.equal(await p.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel').count(),0);}
  {
   const p=await ready('I-1');await p.locator('[data-gs="input-mic"]').click();
   await p.evaluate(()=>{const rec=__voiceLifecycle.instances.at(-1);window.__lateVoice={result:rec.onresult,end:rec.onend};rec.onresult({results:[Object.assign([{transcript:'페이지 복귀 후에도 보여야 할 원문'}],{isFinal:true})]});__storageFail=true;});
   await hide(p);await show(p);await p.locator('.approved-i1').waitFor();assert.equal(await p.locator('[data-input-transcript]').innerText(),'페이지 복귀 후에도 보여야 할 원문');
   const preserved=await p.evaluate(()=>({snapshot:MobileInputFlow.snapshot(),aborts:__voiceLifecycle.aborts}));assert.equal(preserved.aborts,1);assert.equal(preserved.snapshot.session.state,'error');assert.equal(preserved.snapshot.session.needsReview,true);assert.equal(preserved.snapshot.draft.transcript,'페이지 복귀 후에도 보여야 할 원문');
   await p.evaluate(()=>{__lateVoice.result?.({results:[Object.assign([{transcript:'늦은 음성 덮어쓰기'}],{isFinal:true})]});__lateVoice.end?.();});assert.equal(await p.locator('[data-input-transcript]').innerText(),'페이지 복귀 후에도 보여야 할 원문');
   await p.locator('[data-input-transcript]').click();await p.locator('.approved-i2').waitFor();assert.equal(await p.locator('[data-input-transcript]').innerText(),'페이지 복귀 후에도 보여야 할 원문');assert.equal(await p.locator('[data-gs="input-review-save"]').getAttribute('aria-disabled'),'true');await safe(p);await p.close();
   checks.push('Failed draft storage at pagehide still aborts dictation, keeps its raw text visible on return and rejects late provider callbacks');
  }
  {
   const p=await ready();await p.locator('[data-input-field][data-id="phone"]').fill('01011112222');await p.evaluate(()=>__storageFail=true);await hide(p);await p.waitForTimeout(380);assert.equal(await p.evaluate(()=>__matches.length),0);
   await show(p);assert.equal(await p.locator('[data-input-field][data-id="phone"]').innerText(),'01011112222');assert.equal(await p.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');assert.doesNotMatch(await p.locator('[data-contact-match-note]').innerText(),/확인하는 중|후보 0명/);await safe(p);await p.close();
   checks.push('Pagehide cancels a not-yet-started contact lookup even when storage fails; preserved input returns without a false loading or zero-result claim');
  }
  {
   const p=await ready();await p.locator('[data-input-field][data-id="phone"]').fill('01033334444');await p.waitForFunction(()=>__matches.length===1);await p.evaluate(()=>__storageFail=true);await hide(p);assert.equal(await p.evaluate(()=>__matches[0].signal.aborted),true);
   await p.evaluate(()=>__lateMatch(0));await show(p);assert.equal(await p.locator('[data-input-field][data-id="phone"]').innerText(),'01033334444');assert.doesNotMatch(await p.locator('[data-contact-match-note]').innerText(),/후보 9명/);assert.equal(await p.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');await safe(p);await p.close();
   checks.push('An active duplicate lookup is aborted on pagehide; its late successful response cannot replace the preserved fields or warning');
  }
  {
   const p=await ready();await p.evaluate(()=>{window.__ocr=[];window.MobileCardRecognition={capabilities:()=>({supported:true}),recognize(args){__ocr.push(args);return new Promise(resolve=>window.__ocrResolve=resolve);}};render();});
   await p.locator('[data-input-field][data-id="name"]').fill('직접 확인한 이름');const chooser=p.waitForEvent('filechooser');await p.locator('[data-gs="input-card-photo"]').click();await(await chooser).setFiles({name:'synthetic-card.png',mimeType:'image/png',buffer:Buffer.from('synthetic test only')});await p.waitForFunction(()=>__ocr.length===1);
   await p.evaluate(()=>__storageFail=true);await hide(p);assert.equal(await p.evaluate(()=>__ocr[0].signal.aborted),true);
   await p.evaluate(()=>__ocrResolve({ok:true,suggestion:{name:'늦은 명함 이름',role:'관리소장',mobile:'01099998888',note:''}}));await show(p);const name=p.locator('[data-input-field][data-id="name"]');assert.equal(await name.innerText(),'직접 확인한 이름');assert.equal(await name.getAttribute('contenteditable'),'plaintext-only');assert.equal(await p.evaluate(()=>MobileInputFlow.snapshot().draft.recognized||null),null);assert.equal(await p.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');await safe(p);await p.close();
   checks.push('Pagehide stops OCR despite failed storage, restores editable original fields and rejects the late recognition result');
  }
  {
   const p=await ready();await p.locator('[data-input-field][data-id="name"]').fill('정상 보관된 명함 초안');await hide(p);assert.equal(await p.evaluate(()=>MobileInputFlow.snapshot().draft.fields.name),'정상 보관된 명함 초안');await show(p);
   const state=await p.evaluate(()=>({view:MobileGuideShell.state.detailView,input:!!document.querySelector('.approved-input'),approved:document.documentElement.dataset.mobileApprovedView}));assert.equal(state.view,'input');assert.equal(state.input,true);assert.equal(state.approved,'approved');
   await p.locator('[data-input-field][data-id="role"]').fill('복귀 후 역할 수정');assert.equal(await p.evaluate(()=>MobileInputFlow.snapshot().draft.fields.role),'복귀 후 역할 수정');
   await p.locator('.approved-i3 [data-gs="back"]').click();await p.locator('.approved-c').waitFor();await p.locator('[data-gs="contact-card"]').click();await p.locator('.approved-i3').waitFor();assert.equal(await p.locator('[data-input-field][data-id="name"]').innerText(),'정상 보관된 명함 초안');assert.equal(await p.locator('[data-input-field][data-id="role"]').innerText(),'복귀 후 역할 수정');await safe(p);await p.close();
   checks.push('Successful pagehide preserves an active editable I3 on return, and leaving/reopening recovers the saved draft instead of leaving inert input DOM');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);const report={at:new Date().toISOString(),ok:true,passed:checks.length,checks,boundary:'Synthetic pagehide/pageshow, SpeechRecognition, OCR and contact-reader stubs. No real microphone, image service, database or customer action.'};fs.writeFileSync(path.join(__dirname,'stage8-pagehide-browser-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
