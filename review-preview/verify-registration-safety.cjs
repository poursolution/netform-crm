'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),server=require('./server.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions());
 const checks=[],errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  async function open(){
   const page=await context.newPage();page.setDefaultTimeout(10000);
   page.on('pageerror',error=>errors.push(error.message));
   page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))writes.push(request.url());});
   await page.goto(origin+'/mobile.html?demo=1&screen=E&reset=1');await page.locator('.approved-e').waitFor();
   await page.evaluate(()=>{window.__registrationToasts=[];const original=window.toast;window.toast=function(message){__registrationToasts.push(String(message));return original.apply(this,arguments);};});
   return page;
  }
  async function assertReadOnly(page){
   assert.deepEqual(await page.evaluate(()=>({records:__review.rows.length,replies:__review.replies.length})),{records:0,replies:0});
   assert.equal(await page.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel').count(),0);
  }
  // Failed tab storage must not be disguised as successfully retained registration input.
  {
   const page=await open();
   await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(key).startsWith(MobileRegistrationContext.draftPrefix))throw new DOMException('Synthetic quota failure','QuotaExceededError');return original.call(this,key,value);};});
   await page.locator('[data-gs-e-query]').fill('매탄임광');
   assert.match(await page.locator('.approved-e').innerText(),/보관|저장/);
   await page.locator('[data-gs="e-newsite"][data-entry="next"]').click();await page.locator('.approved-j-4').waitFor();
   assert.equal(await page.locator('[data-gs-j4-query]').inputValue(),'매탄임광');
   const before=await page.locator('.approved-j-4').innerText();assert.match(before,/보관|저장/);assert.match(before,/실패|못|확인|문제/);
   await page.locator('.approved-j4-row').first().click();
   const primary=page.locator('.approved-j-4 [data-gs="j4-existing"]:not(.approved-j4-row)');
   if(await primary.getAttribute('aria-disabled')!=='true')await primary.click();else await primary.dispatchEvent('click');
   await page.locator('[data-gs="j4-new"]').click();
   const after=await page.evaluate(()=>({query:MobileGuideShell.state.newQuery,error:MobileGuideShell.state.registrationError,toasts:__registrationToasts,draft:MobileRegistrationContext.loadDraft()}));
   assert.equal(after.query,'매탄임광');assert(after.error);assert.notEqual(after.draft?.query,'매탄임광');
   assert(!after.toasts.some(message=>/유지했습니다|저장했습니다|저장됐|저장됨/.test(message)),JSON.stringify(after.toasts));
   assert.match(await page.locator('.approved-j-4').innerText(),/보관|저장/);
   await assertReadOnly(page);await page.close();checks.push('sessionStorage failure preserves current text, is visible in E/J-4, and never claims successful retention or creation');
  }
  // The old DOM must not become a draft under a newly loaded profile before its next render.
  {
   const page=await open();await page.locator('[data-gs-e-query]').fill('이전 담당자만 작성한 내용');
   const result=await page.evaluate(()=>{
    const oldOwner=MobileSaveJournal.owner(),input=document.querySelector('[data-gs-e-query]');
    const newId='77777777-7777-4777-8777-777777777777';
    Phase1.profile={...Phase1.profile,auth_uid:newId,user_id:newId};
    input.value='이전 담당자의 늦게 도착한 입력';input.dispatchEvent(new InputEvent('input',{bubbles:true,data:'입력',inputType:'insertText'}));
    return {oldOwner,newOwner:MobileSaveJournal.owner(),draft:MobileRegistrationContext.loadDraft(),query:MobileGuideShell.state.newQuery,selected:MobileGuideShell.state.selectedSite,visible:document.querySelector('[data-gs-e-query]')?.value};
   });
   assert.notEqual(result.oldOwner,result.newOwner);assert.equal(result.draft,null);assert.equal(result.query,'');assert.equal(result.selected,'');assert.equal(result.visible,'');
   await page.locator('[data-gs-e-query]').fill('새 담당자의 입력');assert.equal(await page.evaluate(()=>MobileRegistrationContext.loadDraft()?.query),'새 담당자의 입력');
   await assertReadOnly(page);await page.close();checks.push('profile swap without identity-cleared rejects the stale input event before writing to the new actor draft');
  }
  // Synthetic composition is deterministic; real mobile keyboard behavior still needs device QA.
  {
   const page=await open();
   for(const value of ['매','매탄']){
    const result=await page.evaluate(value=>{
     const input=window.__registrationImeInput||(window.__registrationImeInput=document.querySelector('[data-gs-e-query]'));
     if(value==='매')input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));
     input.value=value;input.dispatchEvent(new InputEvent('input',{bubbles:true,data:value,inputType:'insertCompositionText',isComposing:true}));
     return {same:input===document.querySelector('[data-gs-e-query]'),connected:input.isConnected,value:input.value};
    },value);
    assert.deepEqual(result,{same:true,connected:true,value});
   }
   const final=await page.evaluate(()=>{
    const input=window.__registrationImeInput;input.value='매탄임광';input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'매탄임광'}));
    return {visible:document.querySelector('[data-gs-e-query]')?.value,query:MobileGuideShell.state.newQuery,draft:MobileRegistrationContext.loadDraft()?.query};
   });
   assert.deepEqual(final,{visible:'매탄임광',query:'매탄임광',draft:'매탄임광'});
   await assertReadOnly(page);await page.close();checks.push('synthetic Korean IME retains the same native input during composition and renders/restores the finalized text afterward');
  }
  // One row on the final page is not evidence of one candidate in the whole result set.
  {
   const page=await open();
   await page.evaluate(()=>{const source=DEALS[0];DEALS=Array.from({length:21},(_,index)=>({...structuredClone(source),id:'dddddddd-dddd-4ddd-8ddd-'+String(index+1).padStart(12,'0'),site_id:'aaaaaaaa-aaaa-4aaa-8aaa-'+String(index+1).padStart(12,'0'),nm:'같은 이름 현장',address:'수원 영통구 '+(index+1)+'번지'}));});
   await page.locator('[data-gs-e-query]').fill('같은 이름');await page.locator('[data-gs="e-newsite"][data-entry="next"]').click();
   assert.equal(await page.locator('.approved-j4-row').count(),20);
   await page.locator('[data-registration="page"][data-page="2"]').first().click();assert.equal(await page.locator('.approved-j4-row').count(),1);
   const primary=page.locator('.approved-j-4 [data-gs="j4-existing"]:not(.approved-j4-row)');
   assert.equal(await primary.getAttribute('aria-disabled'),'true');assert.equal(await primary.getAttribute('data-id'),'');
   await primary.dispatchEvent('click');assert.equal(await page.evaluate(()=>MobileGuideShell.state.selectedSite),'');
   const rowId=await page.locator('.approved-j4-row').getAttribute('data-id');await page.locator('.approved-j4-row').click();
   assert.equal(await primary.getAttribute('data-id'),rowId);assert.notEqual(await primary.getAttribute('aria-disabled'),'true');
   assert.equal(await page.evaluate(()=>MobileRegistrationContext.loadDraft()?.selectedId),rowId);
   assert.match(await page.locator('.approved-j4-row').innerText(),/21번지/);
   await assertReadOnly(page);await page.close();checks.push('page 2 of 21 same-name candidates does not auto-select its single row; explicit selection and original address distinguish the site');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  const result={at:new Date().toISOString(),passed:checks.length,checks,scope:'synthetic local preview only; no production writes or creation; IME real-device validation remains separate'};
  fs.writeFileSync(path.join(__dirname,'registration-safety-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
