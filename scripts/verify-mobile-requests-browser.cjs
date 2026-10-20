'use strict';
// Approved D request handling; synthetic ACKs only. The retired request-list UI is not opened.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions()),checks=[];
 async function run(name,body,scenario='contact'){
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'}),errors=[],writes=[];
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){writes.push(r.request().method());return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const view=page.locator('.approved-d'),read=()=>page.evaluate(()=>structuredClone({rows:__review.rows,replies:__review.replies,request:__review.request,deal:DEALS[0],state:MobileEntry.state(),journal:MobileSaveJournal.read('contact',DEALS[0].id)}));
  async function fill(result='연결됨',selected=true){await view.locator('[data-ce="res"][data-v="'+result+'"]').click();if(['연결됨','회신 받음'].includes(result))await view.locator('[data-ce-in="memo"]').fill('합성 상담: 고객 회의 후 회신 예정');if(selected)await view.locator('[data-ce-in="req"]').check();}
  const save=()=>view.locator('[data-ce="save"]').click(),success=()=>page.waitForFunction(()=>MobileEntry.state()===null&&document.querySelector('.approved-d [data-ce="save"]')?.textContent==='저장됨'),failure=()=>page.waitForFunction(()=>!!MobileEntry.state()?.err);
  try{
   await page.goto(origin+'/mobile.html?demo=1&review='+scenario+'&reset=1',{waitUntil:'domcontentloaded'});await view.waitFor();
   await body({page,view,fill,save,success,failure,read});
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.equal(await page.locator('#scr .mq,#scr .mh-hub,#scr .mv-now').count(),0);checks.push(name);
  }finally{await context.close();}
 }
 try{
  await run('request data filters recipients, closed rows and target before rendering D',async({page,view})=>{
   const got=await page.evaluate(()=>{const r=__review.request,id=n=>'99999999-9999-4999-8999-'+String(n).padStart(12,'0');Object.assign(r,{due_at:'2026-10-15T00:00:00Z'});Object.assign(MobileRequests.state(),{list:[structuredClone(r),{...r,id:id(1),status:'seen',kind:'quote',label:'견적 진행 확인',due_at:'2026-10-12T00:00:00Z'},{...r,id:id(2),to_me:false},{...r,id:id(3),status:'done'},{...r,id:id(4),target_id:id(5),due_at:'2026-10-20T00:00:00Z'}]});closeSheet();MobileEntry.open();return {incoming:MobileRequests.incoming().map(x=>x.id),deal:MobileRequests.forDeal(DEALS[0].id).map(x=>x.id),id:r.id,other:id(1),foreign:id(4)};});
   assert.deepEqual(got.incoming,[got.other,got.id,got.foreign]);assert.deepEqual(got.deal,[got.other,got.id]);assert.equal(await view.locator('[data-ce-in="req"]').count(),2);assert.equal(await view.locator('[data-ce-in="req"]:disabled').count(),1);assert.equal(await page.evaluate(()=>__review.replies.length),0,'Viewing is not acknowledgement');
  });
  await run('request acknowledgement rejects foreign, closed and mismatched targets',async({page,read})=>{
   const outcomes=await page.evaluate(async()=>{
    const r=__review.request,other='99999999-9999-4999-8999-999999999999',out=[];
    out.push(await MobileRequests.acknowledge(other,'deal',r.target_id));
    out.push(await MobileRequests.acknowledge(r.id,'inquiry',r.target_id));
    out.push(await MobileRequests.acknowledge(r.id,'deal',other));
    MobileRequests._put({...r,to_me:false});out.push(await MobileRequests.acknowledge(r.id,'deal',r.target_id));
    MobileRequests._put({...r,status:'done'});out.push(await MobileRequests.acknowledge(r.id,'deal',r.target_id));
    return out;
   });assert.deepEqual(outcomes,[false,false,false,false,false]);assert.deepEqual((await read()).replies,[]);
  });
  await run('unselected request is never automatically completed',async({fill,save,success,read})=>{await fill('연결됨',false);await save();await success();const a=await read();assert.equal(a.request.status,'sent');assert.deepEqual(a.replies,[]);assert.deepEqual(a.rows.map(r=>r.operation),['activity']);assert.equal(a.deal.nextAction.status,'open');});
  await run('selected first-contact request completes only after matching activity ACK',async({fill,save,success,read})=>{const before=(await read()).deal.nextAction;await fill();await save();await success();const a=await read();assert.deepEqual(a.replies,[{id:a.request.id,action:'done',result:'연결됨',next_text:before.text,next_due:before.due}]);assert.equal(a.request.status,'done');assert.equal(a.request.open,false);assert(a.request.closed_at);assert.equal(a.rows[0].ack.meaningful_contact,true);assert.deepEqual(a.deal.nextAction,before);});
  for(const result of ['부재','번호 오류'])await run(result+' stays working and does not prove actual connection',async({fill,save,success,read})=>{await fill(result);await save();await success();const a=await read();assert.deepEqual(a.replies,[{id:a.request.id,action:'working'}]);assert.equal(a.request.status,'working');assert.equal(a.request.open,true);assert.equal(a.request.closed_at,null);assert.equal(a.rows[0].ack.meaningful_contact,false);assert.equal(a.deal.contactAt||'','');});
  await run('no next schedule leaves request unresolved without inventing a task',async({page,view,fill,save,success,read})=>{await view.locator('[data-ce="close"]').click();await page.evaluate(()=>{MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());DEALS[0].nextAction=null;DEALS[0].nextActionObj=null;MobileEntry.open();});await fill();await view.locator('[data-ce="mode"][data-v="none"]').click();await view.locator('[data-ce-in="reason"]').fill('고객의 다음 검토 시점 확인 필요');await save();await success();const a=await read();assert.deepEqual(a.replies,[]);assert.equal(a.request.status,'sent');assert.equal(a.deal.nextAction,null);assert.deepEqual(a.rows.map(r=>r.operation),['activity']);});
  await run('compound and non-contact requests are disabled rather than wholly completed',async({page,view,fill,save,success,read})=>{assert.equal(await view.locator('[data-ce-in="req"]').isDisabled(),true);await page.evaluate(()=>{Object.assign(__review.request,{kind:'quote',label:'견적 진행 확인'});MobileRequests._put(structuredClone(__review.request));closeSheet();MobileEntry.open();});assert.equal(await view.locator('[data-ce-in="req"]').isDisabled(),true);await fill('연결됨',false);await save();await success();assert.deepEqual((await read()).replies,[]);},'compound');
  await run('failed reply preserves one activity and retries only the original request',async({page,view,fill,save,success,failure,read})=>{await fill();await save();await failure();const before=await read();assert.equal(before.rows.length,1);assert.equal(before.rows[0].status,'done');assert.equal(before.request.status,'sent');assert(before.journal);await view.locator('[data-ce="close"]').click();await page.evaluate(()=>MobileEntry.open());assert.deepEqual((await read()).replies,[]);assert.equal(await view.locator('[data-ce-in="memo"]').isDisabled(),true);await save();await success();const a=await read();assert.deepEqual(a.rows.map(r=>r.request_id),before.rows.map(r=>r.request_id));assert.equal(a.deal.activities.length,1);assert.equal(a.replies.length,1);assert.equal(a.request.status,'done');assert.equal(a.journal,null);},'retry');
  await run('changed request deadline rejects completion without discarding confirmed activity',async({page,fill,save,failure,read})=>{await fill();await page.evaluate(()=>{const rpc=Phase1.rpc;Phase1.rpc=async(name,args)=>{if(name==='crm_work_request_list_v1')return {ok:true,requests:[{...__review.request,due_at:'2099-01-01T00:00:00Z'}]};return rpc(name,args);};});await save();await failure();const a=await read();assert.match(a.state.err,/기한이 바뀌었습니다/);assert.equal(a.deal.activities.length,1);assert.deepEqual(a.replies,[]);assert.equal(a.request.status,'sent');});
  await run('missing or wrong actor/contact evidence cannot issue a reply',async({page,read})=>{const out=await page.evaluate(async()=>{const r=__review.request,p=Phase1.profile,proof={ok:true,operation:'activity',object_id:r.target_id,activity_id:crypto.randomUUID(),actor_auth_uid:p.auth_uid,actor_user_id:p.user_id,meaningful_contact:true},opts={result:'연결됨',absent:false,next_text:'회신 확인',next_due:'2099-01-02'},errors=[];for(const value of [null,{...proof,actor_user_id:'99999999-9999-4999-8999-999999999999'},{...proof,object_id:'99999999-9999-4999-8999-999999999999'},{...proof,meaningful_contact:false}]){try{await MobileRequests.complete(r,{...opts,activity:value});errors.push('UNEXPECTED_SUCCESS');}catch(e){errors.push(e.message);}}return errors;});assert.equal(out.length,4);assert(out.every(x=>/서버 응대 기록|실제 연결 판정/.test(x)));assert.deepEqual((await read()).replies,[]);assert.deepEqual((await read()).rows,[]);});
  console.log(JSON.stringify({test:'approved mobile D request handling',passed:checks.length,checks,boundary:'Synthetic in-memory RPC/ACK only; network writes blocked. The following list-entry requirement must also pass.'},null,2));
  await run('approved A request entry acknowledges seen without completing it',async({page,view,read})=>{
   await view.locator('[data-ce="close"]').click();await page.evaluate(()=>{G.deal=null;G.sub=null;G.tab='today';G.mobileV5Off=true;/* 예전 4구역 오늘(끄기 경로) — v5 오늘은 verify-mobile-v5-today */DEALS[0].nextAction.due=DEALS[0].nextAction.due_at=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());Object.assign(__review.request,{due_at:'2026-10-11T00:00:00Z'});MobileRequests._put({...__review.request});MobileRequests._put({...__review.request,id:'99999999-9999-4999-8999-999999999999',due_at:'2099-01-01T00:00:00Z'});render();});
   await page.locator('.approved-a [data-gs="task"]').first().click();await page.locator('.approved-c').waitFor();
   const a=await read();assert.equal(a.request.status,'seen');assert.deepEqual(a.replies,[{id:a.request.id,action:'seen'}]);assert.equal(a.request.open,true);assert.deepEqual(a.rows,[]);
   assert.equal(await page.evaluate(()=>MobileRequests.state().list.find(r=>r.id==='99999999-9999-4999-8999-999999999999').status),'sent','Another request for the same deal is not acknowledged');
  });
  console.log('verify-mobile-requests: all required flows passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
