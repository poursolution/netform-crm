'use strict';
// Approved D visit entry + shared field contract. All ACKs are synthetic; no CRM writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions()),checks=[];
 async function run(name,body){
  const context=await browser.newContext({viewport:{width:375,height:812},timezoneId:'Asia/Seoul'}),errors=[],networkWrites=[];
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))networkWrites.push(r.method());});
  try{
   await page.goto(origin+'/mobile.html?demo=1&review=contact&reset=1',{waitUntil:'domcontentloaded'});
   await page.locator('.approved-d').waitFor();
   await page.evaluate(()=>{
    closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());window.CRM_SCHEDULE_V1=true;
    const d=DEALS[0],task={id:'77777777-7777-4777-8777-777777777777',opportunity_id:d.id,type:'방문',text:'옥상 현장 방문',due:d.nextAction.due,due_at:d.nextAction.due,status:'open',date_basis:'customer_agreed'};
    d.openNextActions=[structuredClone(d.nextAction),task];d.nextActionObj=d.nextAction;
    window.__visit={id:task.id,text:task.text,due:task.due,type:task.type,promise:true};window.__toasts=[];window.toast=s=>__toasts.push(String(s));window.__rpc=[];
    if(!MobileEntry.open({ch:'방문',existing:__visit}))throw Error('visit entry unavailable');
   });
   const view=page.locator('.approved-d'),read=()=>page.evaluate(()=>({rows:structuredClone(__review.rows),deal:structuredClone(DEALS[0]),request:structuredClone(__review.request),replies:structuredClone(__review.replies),state:MobileEntry.state(),journal:MobileSaveJournal.read('contact',DEALS[0].id),rpc:__rpc,toasts:__toasts}));
   const choose=async(result='연결됨',memo='옥상 실측 결과를 확인했습니다.')=>{await view.locator('[data-ce="res"][data-v="'+result+'"]').click();if(!['부재','번호 오류'].includes(result))await view.locator('[data-ce-in="memo"]').fill(memo);};
   const save=()=>view.locator('[data-ce="save"]').click();
   const saved=()=>page.waitForFunction(()=>MobileEntry.state()===null&&document.querySelector('.approved-d [data-ce="save"]')?.textContent==='저장됨');
   const failed=()=>page.waitForFunction(()=>!!MobileEntry.state()?.err);
   await body({page,view,read,choose,save,saved,failed});
   assert.equal(await page.locator('#sheetcard .ce-infobody,#sheetcard [data-mf],#scr .mv-now,#scr .mh-hub,#scr .flow-strip').count(),0,'retired UI is never restored');
   assert.deepEqual(errors,[]);assert.deepEqual(networkWrites,[]);checks.push(name);
  }finally{await context.close();}
 }
 try{
  const src=fs.readFileSync(path.join(__dirname,'../transport.js'),'utf8');
  for(const rpc of ['crm_deal_stage_fields_update_v1','crm_work_request_list_v1','crm_work_request_reply_v1','crm_inquiry_command_v1','crm_inquiry_flow_list_v1'])assert(src.includes("'"+rpc+"'"));
  await run('approved D keeps PC result values and the exact selected non-primary visit',async({view,read})=>{
   assert.match(await view.locator('.cd-head').innerText(),/방문 결과/);
   assert.deepEqual(await view.locator('[data-ce="res"]').allTextContents(),['연결됨','회신 받음','부재','번호 오류','배드핏']);
   assert.match(await view.locator('.cd-existing').innerText(),/옥상 현장 방문/);assert.equal(await view.locator('[data-ce="save"]').isDisabled(),true);
   const x=await read();assert.equal(x.state.existing.id,x.deal.openNextActions[1].id);assert.notEqual(x.state.existing.id,x.deal.nextAction.id);assert.equal(x.state.mode,'keep');assert.equal(x.state.existing.promise,true);assert.equal(x.rows.length,0);
  });
  await run('approved F row opens the clicked visit ID with KST date and customer promise context',async({page,view,read})=>{
   await view.locator('[data-ce="close"]').click();await page.evaluate(()=>{MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());const task=DEALS[0].openNextActions[1];task.text='고객 약속: 옥상 현장 방문';task.due_on=task.due;task.due_at=task.due+'T00:00:00+09:00';G.deal=null;G.tab='schedule';MobileGuideShell.state.scheduleDay=task.due;render();});
   await page.locator('.approved-f [data-gs="deal"][data-task-id="77777777-7777-4777-8777-777777777777"]').click();await view.waitFor();const x=await read();assert.equal(x.state.ch,'방문');assert.equal(x.state.existing.id,x.deal.openNextActions[1].id);assert.equal(x.state.existing.text,'옥상 현장 방문');assert.equal(x.state.existing.due,x.deal.openNextActions[1].due);assert.equal(x.state.existing.promise,true);assert.equal(x.rows.length,0);
  });
  await run('confirmed visit records visit activity only; all original tasks and requests stay open',async({read,choose,save,saved})=>{
   const before=await read();await choose();await save();await saved();const x=await read();assert.deepEqual(x.rows.map(r=>r.operation),['activity']);assert.equal(x.rows[0].payload.type,'방문');assert.match(x.rows[0].payload.note,/방문/);assert.equal(x.deal.activities[0].type,'방문');assert.equal(x.rows[0].ack.meaningful_contact,true);assert.deepEqual(x.deal.openNextActions,before.deal.openNextActions);assert.deepEqual(x.deal.nextAction,before.deal.nextAction);assert.equal(x.request.status,'sent');assert.deepEqual(x.replies,[]);assert.equal(x.journal,null);
  });
  await run('absent visit needs only result and never claims connection or task completion',async({view,read,choose,save,saved})=>{
   const before=await read();await choose('부재');assert.equal(await view.locator('[data-ce-in="memo"]').isVisible(),false);await save();await saved();const x=await read();assert.equal(x.rows.length,1);assert.equal(x.rows[0].payload.type,'방문');assert.equal(x.rows[0].ack.meaningful_contact,false);assert.equal(x.deal.contactAt||'','');assert.deepEqual(x.deal.openNextActions,before.deal.openNextActions);assert.equal(x.request.status,'sent');
  });
  await run('bad ACK preserves frozen visit input and retries the same operation UUID',async({page,view,read,choose,save,saved,failed})=>{
   await choose();const before=await read();await page.evaluate(()=>{const flush=Phase1.queue.flush;Phase1.queue.flush=async()=>{await flush();window.__ack=structuredClone(__review.rows[0].ack);__review.rows[0].ack={...__ack,actor_user_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'};};});
   await save();await failed();const f=await read();assert.equal(f.deal.activities.length,0);assert.equal(f.state.ch,'방문');assert.equal(f.state.memo,'옥상 실측 결과를 확인했습니다.');assert.equal(await view.locator('[data-ce-in="memo"]').isDisabled(),true);assert.deepEqual(f.deal.openNextActions,before.deal.openNextActions);
   await view.locator('[data-ce="close"]').click();await page.evaluate(()=>MobileEntry.open({ch:'방문',existing:__visit}));assert.match(await view.locator('.cd-existing').innerText(),/옥상 현장 방문/);
   await page.evaluate(()=>{__review.rows[0].ack=__ack;Phase1.queue.flush=async()=>{};});await save();await saved();const x=await read();assert.equal(x.rows.length,1);assert.equal(x.rows[0].request_id,f.rows[0].request_id);assert.equal(x.deal.activities.length,1);assert.deepEqual(x.deal.openNextActions,before.deal.openNextActions);
  });
  await run('selected task survives back and voice-reviewed memo; no activity is saved by review',async({page,view,read,choose})=>{
   await choose();const before=await read();await view.locator('[data-ce="close"]').click();await page.evaluate(()=>MobileEntry.open({ch:'방문',existing:__visit}));assert.equal(await view.locator('[data-ce-in="memo"]').inputValue(),before.state.memo);
   const result=await page.evaluate(()=>MobileEntry.applyInputDraft(MobileEntry.captureInputDraft(),'방문에서 검토한 원문을 수정했습니다.'));assert.equal(result.ok,true);assert.equal(await view.locator('[data-ce-in="memo"]').inputValue(),'방문에서 검토한 원문을 수정했습니다.');const x=await read();assert.equal(x.state.ch,'방문');assert.deepEqual(x.state.existing,before.state.existing);assert.equal(x.rows.length,0);
  });
  await run('forged task and stale task date are rejected before any write',async({page,read,choose,save,failed})=>{
   const rejected=await page.evaluate(()=>MobileEntry.open({ch:'방문',existing:{...__visit,id:DEALS[0].nextAction.id}}));assert.equal(rejected,false);await choose();const before=await read();await page.evaluate(()=>DEALS[0].openNextActions[1].due=ContactEntry.addDays(__visit.due,1));await save();await failed();const x=await read();assert.match(x.state.err,/업무가 바뀌었습니다/);assert.equal(x.rows.length,0);assert.equal(x.state.memo,before.state.memo);assert.deepEqual(x.state.existing,before.state.existing);
  });
  await run('late activity ACK after account change cannot project or clear the saved draft',async({page,read,choose,save,failed})=>{
   await choose();const before=await read();await page.evaluate(()=>{const flush=Phase1.queue.flush;Phase1.queue.flush=()=>new Promise(resolve=>{window.__release=async()=>{await flush();resolve();};});});await save();await page.waitForFunction(()=>typeof __release==='function');await page.evaluate(()=>{Phase1.profile={...Phase1.profile,auth_uid:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'};return __release();});await failed();const x=await read();assert.equal(x.deal.activities.length,0);assert.deepEqual(x.deal.openNextActions,before.deal.openNextActions);assert.equal(x.state.memo,before.state.memo);
  });
  await run('unsupported customer-info UI and quote schedule replacement stay explicitly blocked',async({page,view,read})=>{
   const before=await read();await view.locator('[data-ce="info"]').click();assert.match((await read()).toasts.at(-1),/고객 정보 변경 화면/);
   const error=await page.evaluate(async()=>{Phase1.rpc=async()=>{__rpc.push('unexpected');throw Error('unexpected');};try{await MobileFields.save(DEALS[0],{quote_request:'옥상 공사',quote_due:__visit.due,construction_plan:'내년'},'합성');return '';}catch(e){return e.message;}});assert.match(error,/기존 일정을 보존/);const x=await read();assert.deepEqual(x.rpc,[]);assert.deepEqual(x.rows,[]);assert.deepEqual(x.deal.openNextActions,before.deal.openNextActions);
  });
  await run('shared field RPC applies only a canonical ACK and preserves unrelated fields',async({page,read})=>{
   await page.evaluate(()=>{const d=DEALS[0];d.stage_contexts={consulting:{to:'consulting',fields:{preserved:'원문'}}};window.__fieldPromise=null;Phase1.rpc=(name,args)=>new Promise(resolve=>{__rpc.push([name,args]);window.__fieldAck=()=>resolve({ok:true,deal_id:d.id,stage_code:d.code,version:7,stage_context:{to:d.code,fields:{...d.stage_contexts[d.code].fields,...args.p.fields}}});});window.__fieldPromise=MobileFields.save(d,{construction_plan:'내년'},'합성 검증');});
   assert.equal(await page.evaluate(()=>MobileFields.planOf(DEALS[0])), '');await page.evaluate(async()=>{__fieldAck();await __fieldPromise;});const x=await read();assert.equal(x.deal.stage_contexts.consulting.fields.construction_plan,'내년');assert.equal(x.deal.stage_contexts.consulting.fields.preserved,'원문');assert.equal(x.deal.version,7);assert.equal(x.rpc[0][0],'crm_deal_stage_fields_update_v1');assert.equal(x.rows.length,0);
  });
  for(const mode of ['reject','bad-ack','account','stage'])await run('shared field '+mode+' retains local source without false success',async({page})=>{
   const result=await page.evaluate(async mode=>{const d=DEALS[0];d.stage_contexts={consulting:{to:'consulting',fields:{construction_plan:'올해',preserved:'원문'}}};const before=structuredClone(d.stage_contexts);Phase1.rpc=async(name,args)=>{__rpc.push([name,args]);if(mode==='reject')throw Error('서버 권한 거절');if(mode==='account')Phase1.profile={...Phase1.profile,user_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'};if(mode==='stage')d.code='sent';return {ok:true,deal_id:mode==='bad-ack'?'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee':d.id,stage_code:'consulting',version:7,stage_context:{to:'consulting',fields:{construction_plan:'내년'}}};};let error='';try{await MobileFields.save(d,{construction_plan:'내년'},'합성');}catch(e){error=e.message;}return {before,after:d.stage_contexts,error,version:d.version,rows:__review.rows.length};},mode);assert(result.error);assert.deepEqual(result.after,result.before);assert.equal(result.version,0);assert.equal(result.rows,0);
  });
  console.log(JSON.stringify({test:'approved mobile visit and shared fields',passed:checks.length,checks,boundary:'Synthetic only. No customer data, messages, or network writes. Construction-info and quote entry remain blocked.'},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
