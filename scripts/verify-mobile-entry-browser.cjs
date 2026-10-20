'use strict';
// Approved Claude D; actual shared modules with synthetic, memory-only ACKs.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions()),checks=[];
 async function run(name,body,scenario='contact'){
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'}),errors=[],networkWrites=[];
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))networkWrites.push(r.method());});
  const view=page.locator('.approved-d');
  async function connected(memo='합성 상담: 고객 회의 후 확인합니다.',request=false){await view.locator('[data-ce="res"][data-v="연결됨"]').click();await view.locator('[data-ce-in="memo"]').fill(memo);if(request)await view.locator('[data-ce-in="req"]').check();}
  const save=()=>view.locator('[data-ce="save"]').click();
  const saved=()=>page.waitForFunction(()=>MobileEntry.state()===null&&(document.querySelector('.approved-d [data-ce="save"]')?.textContent==='저장됨'||!!document.querySelector('#sheetcard .approved-v5a')));
  const failed=()=>page.waitForFunction(()=>!!MobileEntry.state()?.err);
  const read=()=>page.evaluate(()=>({rows:structuredClone(__review.rows),replies:structuredClone(__review.replies),request:structuredClone(__review.request),deal:structuredClone(DEALS[0]),journal:MobileSaveJournal.read('contact',DEALS[0].id),state:MobileEntry.state()}));
  try{
   await page.goto(origin+'/mobile.html?demo=1&review='+scenario+'&reset=1',{waitUntil:'domcontentloaded'});await view.locator('[data-ce="res"]').first().waitFor();
   /* 예전 D(요청 체크 상자) = 끄기 경로. v5 결과 화면은 verify-mobile-v5-result */
   await page.evaluate(()=>{G.mobileV5Off=true;closeSheet();MobileEntry.open();});await view.locator('[data-ce="res"]').first().waitFor();
   await body({page,view,connected,save,saved,failed,read});
   assert.equal(await page.locator('#scr .mv-now,#scr .mh-hub,#scr .mh-filter,#scr .flow-strip').count(),0,'retired surfaces stay absent');assert.deepEqual(errors,[]);assert.deepEqual(networkWrites,[]);checks.push(name);
  }finally{await context.close();}
 }
 try{
  await run('approved D uses the PC five results and blocks connected save without consultation content',async({page,view,connected,read})=>{
   const values=await view.locator('[data-ce="res"]').allTextContents();assert.deepEqual(values,['연결됨','회신 받음','부재','번호 오류','배드핏']);assert.deepEqual(values,await page.evaluate(()=>[...ContactEntry.VALUES]));
   assert.equal(await view.locator('[data-ce="save"]').isDisabled(),true);await view.locator('[data-ce="res"][data-v="연결됨"]').click();assert.equal(await view.locator('[data-ce="save"]').isDisabled(),true);
   assert.equal(await view.locator('[data-ce="mode"][aria-pressed="true"]').getAttribute('data-v'),'keep');await connected();assert.equal(await view.locator('[data-ce="save"]').isEnabled(),true);assert.equal((await read()).rows.length,0);
  });
  await run('contact alone preserves an overdue task and an unselected request',async({page,connected,save,saved,read})=>{
   await page.evaluate(()=>{DEALS[0].nextAction.due=DEALS[0].nextAction.due_at=ContactEntry.addDays(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),-2);});
   const before=(await read()).deal.nextAction;await connected();await save();await saved();const a=await read();assert.deepEqual(a.rows.map(r=>r.operation),['activity']);assert.deepEqual(a.deal.nextAction,before);assert.equal(a.deal.nextAction.status,'open');assert.equal(a.request.status,'sent');assert.deepEqual(a.replies,[]);assert.equal(a.deal.activities.length,1);assert.equal(a.journal,null);
  });
  await run('only a selected simple request completes after activity confirmation and a future follow-up',async({connected,save,saved,read})=>{
   const before=(await read()).deal.nextAction;await connected('합성 상담: 기존 약속 유지',true);await save();await saved();const a=await read();assert.deepEqual(a.rows.map(r=>r.operation),['activity']);assert.deepEqual(a.deal.nextAction,before);assert.equal(a.request.status,'done');assert.deepEqual(a.replies.map(r=>r.action),['done']);assert.equal(a.request.next_text,before.text);assert.equal(a.request.next_due,before.due);
  });
  for(const result of ['부재','번호 오류'])await run(result+' keeps actual connection and request completion unresolved',async({view,save,saved,read})=>{
   const before=(await read()).deal.nextAction;await view.locator('[data-ce="res"][data-v="'+result+'"]').click();assert.equal(await view.locator('[data-ce-in="memo"]').isVisible(),false);await view.locator('[data-ce-in="req"]').check();await save();await saved();const a=await read();assert.deepEqual(a.rows.map(r=>r.operation),['activity']);assert.equal(a.rows[0].ack.meaningful_contact,false);assert.equal(a.deal.contactAt||'','');assert.deepEqual(a.deal.nextAction,before);assert.equal(a.request.status,'working');assert.deepEqual(a.replies.map(r=>r.action),['working']);
  });
  await run('wrong ACK preserves input and blocks projection; retry reuses its queued activity',async({page,view,connected,save,saved,failed,read})=>{
   await connected('합성 상담: ACK 전 보존할 원문',true);await page.evaluate(()=>{const flush=Phase1.queue.flush;Phase1.queue.flush=async()=>{await flush();window.__goodAck=structuredClone(__review.rows[0].ack);__review.rows[0].ack={...__goodAck,actor_auth_uid:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'};};});
   const before=(await read()).deal.nextAction;await save();await failed();const f=await read(),id=f.rows[0].request_id;assert.equal(f.deal.activities.length,0);assert.deepEqual(f.deal.nextAction,before);assert.equal(f.request.status,'sent');assert.deepEqual(f.replies,[]);assert.equal(f.state.memo,'합성 상담: ACK 전 보존할 원문');assert.equal(await view.locator('[data-ce-in="memo"]').isDisabled(),true);
   await page.evaluate(()=>{__review.rows[0].ack=__goodAck;Phase1.queue.flush=async()=>{};});await save();await saved();const a=await read();assert.equal(a.rows.length,1);assert.equal(a.rows[0].request_id,id);assert.equal(a.deal.activities.length,1);assert.deepEqual(a.replies.map(r=>r.action),['done']);
  });
  await run('in-flight save freezes input and rejects duplicate clicks until ACK',async({page,view,connected,save,saved,read})=>{
   await connected();const before=(await read()).deal.nextAction;await page.evaluate(()=>{const flush=Phase1.queue.flush;Phase1.queue.flush=()=>new Promise(resolve=>{window.__finishSave=async()=>{await flush();resolve();};});});await save();await page.waitForFunction(()=>typeof __finishSave==='function');
   assert.equal(await view.locator('[data-ce="save"]').isDisabled(),true);assert.equal(await view.locator('[data-ce-in="memo"]').isDisabled(),true);await view.locator('[data-ce="save"]').dispatchEvent('click');const pending=await read();assert.equal(pending.rows.length,1);assert.equal(pending.deal.activities.length,0);assert.deepEqual(pending.deal.nextAction,before);await page.evaluate(()=>__finishSave());await saved();assert.equal((await read()).rows.length,1);
  });
  await run('partial request failure restores frozen input and retries only the remaining request',async({page,view,connected,save,saved,failed,read})=>{
   await connected('합성 상담: 재입력하지 않을 원문',true);await save();await failed();const before=await read();assert.equal(before.rows.length,1);assert.equal(before.rows[0].status,'done');assert.deepEqual(before.replies,[]);assert(before.journal);
   await view.locator('[data-ce="close"]').click();await page.evaluate(()=>MobileEntry.open());await view.waitFor();assert.equal(await view.locator('[data-ce-in="memo"]').inputValue(),'합성 상담: 재입력하지 않을 원문');assert.equal(await view.locator('[data-ce-in="memo"]').isDisabled(),true);assert.equal((await read()).rows.length,1);assert.deepEqual((await read()).replies,[]);
   await save();await saved();const a=await read();assert.deepEqual(a.rows.map(r=>r.request_id),before.rows.map(r=>r.request_id));assert.deepEqual(a.replies.map(r=>r.action),['done']);assert.equal(a.deal.activities.length,1);assert.equal(a.journal,null);
  },'retry');
  await run('compound request cannot be selected or wholly completed by contact',async({view,connected,save,saved,read})=>{
   assert.equal(await view.locator('[data-ce-in="req"]').isDisabled(),true);await connected();await save();await saved();const a=await read();assert.equal(a.request.status,'sent');assert.deepEqual(a.replies,[]);assert.equal(a.rows.length,1);
  },'compound');
  await run('new work cannot overwrite an existing task without the preserving server contract',async({view,connected,read})=>{
   const before=(await read()).deal.nextAction;await connected();await view.locator('[data-ce="mode"][data-v="new"]').click();await view.locator('[data-ce-in="purpose"]').fill('추가 견적 발송');assert.equal(await view.locator('[data-ce="save"]').isDisabled(),true);assert.match(await view.locator('[aria-live="polite"]').textContent(),/기존 업무를 보존/);const a=await read();assert.deepEqual(a.deal.nextAction,before);assert.deepEqual(a.rows,[]);assert.deepEqual(a.replies,[]);
  });
  await run('retry does not duplicate a confirmed new follow-up, activity or request',async({page,view,connected,save,saved,failed,read})=>{
   await view.locator('[data-ce="close"]').click();await page.evaluate(()=>{MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());DEALS[0].nextAction=null;DEALS[0].nextActionObj=null;MobileEntry.open();});await view.waitFor();await connected('합성 상담: 회신 확인 후속 업무',true);await view.locator('[data-ce-in="purpose"]').fill('고객 회신 확인');await save();await failed();const before=await read();assert.deepEqual(before.rows.map(r=>r.operation),['activity','next_action']);assert(before.rows.every(r=>r.status==='done'));assert.deepEqual(before.replies,[]);const schedule=before.deal.nextAction;assert.equal(schedule.status,'open');assert.equal(schedule.text,'고객 회신 확인');
   assert.equal(await view.locator('[data-ce="save"]').isEnabled(),true,'The committed plan remains retryable after its own next-action projection');
   await view.locator('[data-ce-in="memo"]').evaluate(node=>{node.value='변경된 원문은 이미 확정한 계획에 섞이면 안 됩니다';});await save();await failed();const changed=await read();assert.match(changed.state.err,/입력값이 바뀌었습니다/);assert.deepEqual(changed.rows.map(r=>r.request_id),before.rows.map(r=>r.request_id));assert.deepEqual(changed.replies,[]);assert.equal(changed.journal.progress.input.memo,'합성 상담: 회신 확인 후속 업무');
   await view.locator('[data-ce="close"]').click();await page.evaluate(()=>MobileEntry.open());await view.waitFor();assert.equal(await view.locator('[data-ce-in="memo"]').inputValue(),'합성 상담: 회신 확인 후속 업무');await save();await saved();const a=await read();assert.deepEqual(a.rows.map(r=>r.request_id),before.rows.map(r=>r.request_id));assert.deepEqual(a.deal.nextAction,schedule);assert.equal(a.deal.activities.length,1);assert.deepEqual(a.replies.map(r=>r.action),['done']);
  },'retry');
  console.log(JSON.stringify({test:'approved mobile entry',passed:checks.length,checks,boundary:'Local synthetic fixture only; no production or network writes.'},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
