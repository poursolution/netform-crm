'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),server=require('./server.cjs');
const CONTACT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch(require('./review-environment.cjs').launchOptions()),checks=[],errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  async function ready(){const p=await context.newPage();p.setDefaultTimeout(10000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});await p.goto(origin+'/mobile.html?demo=1&review=guide&screen=I-3&reset=1');await p.locator('.approved-i3').waitFor();return p;}
  async function guard(p){await p.evaluate(()=>{window.__matchForbidden=[];const deny=name=>()=>{__matchForbidden.push(name);throw Error('Forbidden contact match side effect: '+name);};window.fetch=deny('fetch');Phase1.rpc=deny('rpc');window.pushWrite=deny('pushWrite');window.queueMobileContactOperation=deny('contact-save');if(Phase1.queue)Phase1.queue.enqueue=deny('enqueue');});}
  const snapshot=p=>p.evaluate(()=>JSON.stringify({deals:DEALS,request:__review.request,rows:__review.rows,replies:__review.replies}));
  async function unchangedLayout(p){assert.equal(await p.locator('[data-contact-match-note]').count(),1);assert.equal(await p.locator('[data-input-field]').count(),4);assert.equal(await p.locator('#scr .mv-now,#scr .mh-filter,#scr .flow-strip,#scr .mystat,#scr .m-relintel').count(),0);assert.equal(await p.locator('[data-gs="input-card-save"]').getAttribute('aria-disabled'),'true');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
  {
   const p=await ready();await guard(p);
   await p.evaluate(id=>{const d=myDeals().find(x=>x.id===G.deal);MobileInputFlow.reset({discard:true});d.contacts=[{id,mobile:'01011112222',name:'합성 후보'},{id:id.toUpperCase(),mobile:'01011112222',name:'대문자 동일 후보'},{person_key:'mobile:01011112222',mobile:'01011112222',name:'ID 없는 투영'}];window.__readerCalls=0;window.ContactMatchReader={read(){__readerCalls++;throw Error('DEMO must not query');}};MobileInputFlow.open(d,'I-3');render();},CONTACT);
   const before=await snapshot(p),phone=p.locator('[data-input-field][data-id="phone"]'),note=p.locator('[data-contact-match-note]');
   await phone.fill('01011112222');assert.match(await note.innerText(),/예시.*후보 1명/);assert.equal(await p.evaluate(()=>__readerCalls),0);
   await phone.fill('010-11O1-2222');assert.match(await note.innerText(),/번호를 확인/);assert.equal(await phone.getAttribute('aria-invalid'),'true');assert.equal(await p.evaluate(()=>__readerCalls),0);
   await p.locator('[data-gs="input-card-save"]').dispatchEvent('click');assert.equal(await snapshot(p),before);assert.deepEqual(await p.evaluate(()=>__matchForbidden),[]);await unchangedLayout(p);await p.close();
   checks.push('DEMO phone edits update the original warning immediately, count a case-insensitive UUID once, ignore identifier-free projections and never call the reader or save');
  }
  {
   const p=await ready();await guard(p);
   await p.evaluate(()=>{
    const d=myDeals().find(x=>x.id===G.deal);MobileInputFlow.reset({discard:true});DEMO=false;LIVE=true;
    window.__matchCalls=[];window.__resolvers=[];
    window.ContactMatchReader={read(args){const index=__matchCalls.length;__matchCalls.push({dealId:args.dealId,expectedVersion:args.expectedVersion,phone:args.phone,page:args.page,signal:args.signal,isCurrent:args.isCurrent});return new Promise(resolve=>__resolvers[index]=resolve);}};
    window.__resolveMatch=(index,total=1,failed=false)=>{const call=__matchCalls[index];__resolvers[index](failed?{ok:false,status:'failed',error:'OFFLINE'}:{ok:true,status:'ready',contract:'contact-match-read-v1',actor_auth_uid:Phase1.profile.auth_uid,actor_user_id:Phase1.profile.user_id,object_id:call.dealId.toLowerCase(),object_version:call.expectedVersion,phone:call.phone,scope:'authorized_deals_only',page:1,page_size:20,total,has_more:false,candidates:total?[{contactId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'합성 응답 후보',sites:[],canLink:false}]:[]});};
    MobileInputFlow.open(d,'I-3');render();window.__originalPhone=document.querySelector('[data-input-field][data-id="phone"]');window.__originalFrame=document.querySelector('.approved-i3');window.__originalNote=document.querySelector('[data-contact-match-note]');window.__originalNodeCount=__originalFrame.querySelectorAll('*').length;
   });
   const before=await snapshot(p),phone=p.locator('[data-input-field][data-id="phone"]'),note=p.locator('[data-contact-match-note]');
   await phone.fill('01011112222');assert.match(await note.innerText(),/확인하는 중/);await p.waitForFunction(()=>__matchCalls.length===1);
   await p.evaluate(()=>{const n=__originalPhone.firstChild,r=document.createRange();r.setStart(n,5);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);__originalPhone.focus();});
   await p.evaluate(()=>__resolveMatch(0,1));await p.waitForFunction(()=>document.querySelector('[data-contact-match-note]').textContent.includes('후보 1명'));
   const retained=await p.evaluate(()=>({field:__originalPhone===document.querySelector('[data-input-field][data-id="phone"]'),frame:__originalFrame===document.querySelector('.approved-i3'),note:__originalNote===document.querySelector('[data-contact-match-note]'),focused:document.activeElement===__originalPhone,offset:getSelection().anchorOffset,count:__originalFrame.querySelectorAll('*').length===__originalNodeCount}));
   assert.deepEqual(retained,{field:true,frame:true,note:true,focused:true,offset:5,count:true});assert.equal(await phone.textContent(),'01011112222');
   await phone.fill('+82 10-1111-2222');await p.waitForTimeout(360);assert.equal(await p.evaluate(()=>__matchCalls.length),1);assert.match(await note.innerText(),/후보 1명/);
   await phone.fill('01033334444');assert.match(await note.innerText(),/확인하는 중/);assert.doesNotMatch(await note.innerText(),/후보 1명/);await p.waitForFunction(()=>__matchCalls.length===2);
   await phone.fill('01055556666');await p.waitForFunction(()=>__matchCalls.length===3);assert.equal(await p.evaluate(()=>__matchCalls[1].signal.aborted),true);
   await p.evaluate(()=>__resolveMatch(2,0));await p.waitForFunction(()=>document.querySelector('[data-contact-match-note]').textContent.includes('후보 0명'));assert.match(await note.innerText(),/전체 연락처가 없다는 뜻은 아닙니다/);
   const currentNote=await note.innerText();await p.evaluate(()=>__resolveMatch(1,9));await p.waitForTimeout(25);assert.equal(await note.innerText(),currentNote);
   await phone.fill('01077778888');await p.waitForFunction(()=>__matchCalls.length===4);await p.evaluate(()=>__resolveMatch(3,0,true));await p.waitForFunction(()=>document.querySelector('[data-contact-match-note]').textContent.includes('확인하지 못했습니다'));assert.doesNotMatch(await note.innerText(),/후보 0명/);
   await p.locator('[data-gs="input-card-save"]').dispatchEvent('click');assert.equal(await snapshot(p),before);assert.deepEqual(await p.evaluate(()=>__matchForbidden),[]);await unchangedLayout(p);await p.close();
   checks.push('Stubbed scoped reader updates only the existing note while preserving the original frame, input node, focus, caret and node count');
   checks.push('Equivalent phone formatting causes no extra read; changed numbers clear old results immediately and out-of-order or failed replies cannot restore them');
   checks.push('Zero is labelled as authorized-deal scope only; failure remains unknown, with I3 save disabled and business records unchanged');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log(JSON.stringify({ok:true,passed:checks.length,checks,boundary:'Local synthetic data and a stubbed ContactMatchReader only. No production query, OCR, customer contact, database write or deployment.'},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
