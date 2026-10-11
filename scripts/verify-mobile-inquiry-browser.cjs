'use strict';
/* Approved A → inquiry D. Actual ContactEntry + PCInquirySave + schedule/response
 * contracts run against the same synthetic RPC fixture as the PC save tests.
 * No retired inquiry sheet, production I/O, implicit request completion or UI edits.
 */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const install=require('../tests/pc-inquiry-fixture.cjs');
const QID='aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',TASK='bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch(launchOptions());
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  const errors=[],networkWrites=[],checks=[];
  await context.route('**/*',route=>{const r=route.request();if(!['GET','HEAD'].includes(r.method())){networkWrites.push(r.url());return route.abort();}return new URL(r.url()).origin===origin?route.continue():route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  async function setup(options={}){
   await page.goto(origin+'/mobile.html?demo=1&review=inquiry&screen=B',{waitUntil:'domcontentloaded'});
   await page.locator('.approved-b').waitFor();
   await page.waitForFunction(()=>window.MobileInquiryEntry&&window.PCInquirySave&&window.InquiryFlow&&window.InquiryScheduleFlow);
   await page.addScriptTag({content:'window.__installInquiryMock=('+install.toString()+');'});
   return page.evaluate(({options,QID,TASK})=>{
    closeSheet();sessionStorage.clear();delete window.__approvedAExample;delete window.__approvedBCExample;
    const f=window.__f=__installInquiryMock(window,QID),originalRpc=Phase1.rpc;
    window.__legacyWrites=[];window.__toasts=[];window.toast=text=>__toasts.push(String(text));
    window.pushWrite=(...args)=>{__legacyWrites.push(args);throw Error('Legacy mobile write must not run');};
    Phase1.queue={list:()=>[],flush:async()=>{},enqueue:()=>{throw Error('Legacy queue must not run');}};
    Phase1.profile.name='합성 문의 담당자';Phase1.profile.allowed_modes=['rep'];
    G.user={...G.user,id:f.uid,nm:'합성 문의 담당자'};REPS=[G.user];G.mode='rep';G.tab='today';G.deal=null;G.sub=null;G.done={};DEALS=[];
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
    const due=ContactEntry.addDays(today,5),raw={id:QID,status:'배정완료',site_name:'[합성] 문의 응대 검증',site:'[합성] 문의 응대 검증',assignee:G.user.nm,assigned_to:f.uid,assigned_at:new Date().toISOString(),phone:'01000000000',contact_name:'합성 고객',work_type:'옥상 방수',created_at:new Date().toISOString(),activities:[]};
    if(options.existing){const task={id:TASK,inquiry_id:QID,title:'기존 방문 약속',action_type:'방문',status:'open',due_on:due,due_at:due+'T14:00:00+09:00',date_basis:'customer_agreed',completed_at:null};f.rows.push(task);raw.nextActionObj={...task,text:task.title,type:task.action_type,due};}
    const q=inquiryViewM(raw);/* Use the actual loaded-inquiry view shape, including assigned/done. */
    if(raw.nextActionObj)q.nextActionObj=structuredClone(raw.nextActionObj);
    ADMIN.inquiries=[q];window.__raw=raw;window.__view=q;window.__day={today,tomorrow:ContactEntry.addDays(today,1),due};
    Object.assign(MobileRequests.state(),{list:[],loaded:true,busy:false,off:false,at:Date.now()});
    const request={id:'cccccccc-3333-4333-8333-cccccccccccc',target_type:'inquiry',target_id:QID,status:'sent',open:true,asks:['첫 연락','견적 필요 확인'],to_me:true};
    MobileRequests.state().list=[request];window.__requestBefore=JSON.stringify(request);
    Phase1.rpc=async(name,args)=>{
     const result=await originalRpc(name,args);
     if(name==='crm_inquiry_command_v1'&&result.state){
      result.state.logs.forEach(log=>{log.kind=InquiryFlow.kindOf(log.result);});
      if(options.ackMode==='inquiry')result.state.inquiry_id=crypto.randomUUID();
      if(options.ackMode==='request')result.state.logs[0].request_id=crypto.randomUUID();
      if(options.ackMode==='content')result.state.logs[0].content='다른 응대 기록';
     }
     return result;
    };
    f.badAck=options.ackMode==='bare';f.loss=options.loss||'';f.hold=options.hold||'';
    if(options.gateOff)CRM_SCHEDULE_V1=false;
    window.__business=()=>({logs:[...f.logs.values()].map(l=>({type:l.type,channel:l.channel,result:l.result,contact_result:l.contact_result,content:l.content,next_action:l.next_action,next_check_date:l.next_check_date})),status:raw.status,firstResponse:!!raw.first_response_at,rows:f.rows.map(r=>({title:r.title,action_type:r.action_type,due_on:r.due_on,date_basis:r.date_basis,status:r.status,completed_at:r.completed_at})),responseCount:f.responses.size,scheduleCount:f.schedules.size});
    render();return {...__day};
   },{options,QID,TASK});
  }
  const D=page.locator('.approved-d');
  async function safe(){
   assert.equal(await page.locator('#tabbar button').count(),0);
   assert.equal(await page.locator('#scr .mi-open,#scr button[onclick*="recordInquiryResponse"],#sheetcard .mi-done,#sheetcard .ce-done,#scr .mh-hub,#scr .flow-strip').count(),0,'No retired inquiry or mobile content');
   assert.deepEqual(await page.evaluate(()=>__legacyWrites),[],'No legacy writes');
   assert.deepEqual(await page.evaluate(()=>G.done),{},'No automatic today-task completion');
   assert.equal(await page.evaluate(()=>JSON.stringify(MobileRequests.state().list[0])),await page.evaluate(()=>__requestBefore),'Compound administrator request remains open');
  }
  async function open(){await page.locator('.approved-a [data-gs="task"][data-id="'+QID+'"]').click();await D.waitFor();await safe();}
  async function pick(result,memo){await D.locator('[data-ce="res"][data-v="'+result+'"]').click();if(memo!==undefined)await D.locator('[data-ce-in="memo"]').fill(memo);}
  const save=()=>D.locator('[data-ce="save"]').click();
  const saved=async(returnSelector='.approved-a')=>{await page.waitForFunction(()=>MobileInquiryEntry.state()===null&&__toasts.includes('응대 기록을 저장했습니다.'));await page.locator(returnSelector).waitFor();assert.equal(await D.isVisible(),false,'Confirmed save returns to its approved source screen');};
  const business=()=>page.evaluate(()=>__business());

  // Normal save includes an actual in-flight server boundary and existing customer promise.
  await setup({existing:true,hold:'crm_inquiry_command_v1'});await open();
  assert.deepEqual(await D.locator('[data-ce="res"]').allTextContents(),['연결됨','회신 받음','부재','번호 오류','배드핏']);
  assert.equal(await D.locator('.cd-results,.cd-note,.cd-next-section').count(),3,'Original D has the three approved sections');
  assert.match(await D.locator('.cd-context').innerText(),/문의 응대 검증/);
  await pick('연결됨','방문 약속은 유지하고 견적 준비 자료를 확인했습니다.');
  assert.equal(await D.locator('[data-ce="mode"][data-v="keep"]').getAttribute('aria-pressed'),'true');
  await D.locator('[data-ce="close"]').click();await page.locator('.approved-a').waitFor();assert.equal(await page.evaluate(()=>__f.calls.length),0,'Leaving an unsaved draft never writes to CRM');await open();
  assert.equal(await D.locator('[data-ce-in="memo"]').inputValue(),'방문 약속은 유지하고 견적 준비 자료를 확인했습니다.','Unsaved text survives approved back/reentry');
  assert.equal(await D.locator('[data-ce="mode"][data-v="keep"]').getAttribute('aria-pressed'),'true');
  const originalTask=await page.evaluate(()=>structuredClone(__f.rows[0]));
  await save();await page.waitForFunction(()=>typeof __f.release==='function');
  assert.equal(await D.locator('[data-ce="save"]').isDisabled(),true);
  assert.equal(await page.evaluate(()=>__raw.status),'배정완료');assert.equal(await page.evaluate(()=>__f.responses.size+__f.schedules.size),0);
  await D.locator('[data-ce="save"]').dispatchEvent('click');assert.equal(await page.evaluate(()=>__f.calls.filter(c=>c.name==='crm_inquiry_command_v1').length),1,'Busy click cannot send a second contact');
  await page.evaluate(()=>{__f.hold='';__f.release();});await saved();
  const mobileBusiness=await business();assert.equal(mobileBusiness.status,'전화응대 완료');assert.equal(mobileBusiness.responseCount,1);assert.equal(mobileBusiness.scheduleCount,0);
  assert.deepEqual(await page.evaluate(()=>__f.rows[0]),originalTask,'Customer promise ID, time and completion state are preserved');
  assert.equal(await page.evaluate(()=>__raw.nextActionObj.id),TASK);await safe();
  await page.locator('.approved-a').waitFor();
  assert.equal(await page.locator('.approved-a [data-gs="task"][data-id="'+QID+'"]').count(),0,'Confirmed first response leaves first-contact tasks without a fake local done flag');
  const opened=await page.evaluate(()=>MobileInquiryEntry.restore(__view.key));assert.equal(opened.ok,true);await D.waitFor();assert.equal(await page.evaluate(()=>__f.logs.size),1);await safe();
  checks.push('A → original D; busy/ACK protection; one confirmed contact; existing customer appointment and request stay open; safe reentry');

  // The same plan executed by the PC save engine must produce the same business outcome.
  await setup({existing:true});
  await page.evaluate(async()=>{
   const ex=PCInquirySave.existing(__raw),form={ch:'전화',res:'연결됨',memo:'방문 약속은 유지하고 견적 준비 자료를 확인했습니다.',mode:'keep',purpose:'',date:'',reason:'',plan:'internal'};
   const plan=ContactEntry.plan(form,{today:__day.today,existing:ex,scheduleV1:true}),values=InquiryFlow.TWO.of(form.res,'관심 있음');
   await PCInquirySave.save(__raw,{ch:form.ch,result:values.res,contact_result:values.contact_result,customer_reaction:values.customer_reaction,text:plan.note,next:ex.text,due:ex.due,plan,existing:ex},form,'detail');
  });
  assert.deepEqual(await business(),mobileBusiness,'Actual shared PC engine: same record, stage, date basis, task count and completion');
  checks.push('PC/mobile parity through the real shared PCInquirySave engine and identical server-contract fixture');

  // Absence needs no invented consultation and cannot complete first response or a request.
  const dates=await setup();await open();await pick('부재');
  assert.equal(await D.locator('.cd-note').isVisible(),false);assert.equal(await D.locator('[data-ce-in="memo"]:visible').count(),0);
  await save();await saved();let state=await business();
  assert.equal(state.logs[0].result,'부재');assert.equal(state.logs[0].contact_result,'부재');assert.equal(state.status,'배정완료');assert.equal(state.firstResponse,false);assert.equal(state.responseCount,0);
  assert.equal(state.scheduleCount,0);assert.equal(state.rows.length,0,'Absence alone does not invent a retry appointment');await safe();
  await setup();await open();await pick('부재');await D.locator('[data-ce="mode"][data-v="new"]').click();await D.locator('[data-ce-in="purpose"]').fill('다시 전화');
  await D.locator('[data-ce="date-open"]').click();await D.locator('[data-ce="date"][data-v="'+dates.tomorrow+'"]').filter({hasText:/^내일 /}).click();await save();await saved();state=await business();
  assert.equal(state.scheduleCount,1);assert.equal(state.rows[0].due_on,dates.tomorrow);assert.equal(state.rows[0].status,'open');assert.equal(state.rows[0].completed_at,null);assert.equal(state.responseCount,0);await safe();
  checks.push('Absence needs only the result and creates no task implicitly; an explicitly selected retry stays open without connection/stage/request completion');

  // Explicit no-next-task is distinct from absence's default retry plan.
  await setup();await open();await pick('번호 오류');await D.locator('[data-ce="mode"][data-v="none"]').click();
  assert.equal(await D.locator('[data-ce="save"]').isDisabled(),false,'Number-error attempt also needs no invented consultation or mandatory follow-up');await D.locator('[data-ce-in="reason"]').fill('관리팀에서 올바른 번호 확인 중');await save();await saved();state=await business();
  assert.equal(state.logs[0].result,'번호오류');assert.equal(state.status,'배정완료');assert.equal(state.rows.length,0);assert.equal(state.responseCount,0);await safe();
  checks.push('Number error maps to PC value; explicit no-next reason records the attempt without inventing or completing a task');

  // Contact committed but response was lost: close/reenter/retry the same immutable input.
  await setup({existing:true,loss:'crm_inquiry_command_v1'});await open();await pick('회신 받음','고객이 기존 방문 약속을 유지한다고 회신했습니다.');await save();await D.locator('.ce-err').waitFor();
  assert.match(await D.locator('.ce-err').innerText(),/response lost/);const requestId=await page.evaluate(()=>[...__f.logs.keys()][0]);
  assert.equal(await page.evaluate(()=>__raw.status),'배정완료');assert.equal(await page.evaluate(()=>__f.responses.size),0);
  const draft=await D.locator('[data-ce-in="memo"]').inputValue();await D.locator('[data-ce="close"]').click();await page.locator('.approved-a').waitFor();
  await page.locator('.approved-a [data-gs="pending"]').click();await page.locator('.approved-i4').waitFor();
  const recover=page.locator('.approved-i4 [data-gs="recover"][data-kind="pc_inquiry"][data-id="'+QID+'"]');assert.equal(await recover.count(),1,'One grouped pending inquiry links back to the original input');await recover.click();await D.waitFor();
  assert.equal(await D.locator('[data-ce-in="memo"]').inputValue(),draft);await save();await saved('.approved-i4');
  assert.deepEqual(await page.evaluate(()=>[...__f.logs.keys()]),[requestId]);assert.equal(await page.evaluate(()=>__f.responses.size),1);assert.equal(await page.evaluate(()=>__f.rows.length),1);
  assert.equal((await business()).logs[0].result,'고객 회신');await safe();
  assert.equal(await page.locator('.approved-i4 [data-gs="recover"][data-id="'+QID+'"]').count(),0,'Confirmed pending group clears without creating a second contact');
  checks.push('Committed contact response loss: A pending → original I-4 → original D restores draft; retry keeps UUID, contact count and appointment');

  // Unverified acknowledgements must not advance the workflow or clear the input.
  for(const ackMode of ['bare','inquiry','request','content']){
   await setup({ackMode});await open();await pick('연결됨','검증할 상담 원문');await save();await D.locator('.ce-err').waitFor();
   assert.match(await D.locator('.ce-err').innerText(),/저장 근거/);assert.equal(await D.locator('[data-ce-in="memo"]').inputValue(),'검증할 상담 원문');
   assert.equal(await page.evaluate(()=>__f.responses.size+__f.schedules.size),0);assert.equal(await page.evaluate(()=>__raw.status),'배정완료');assert.notEqual(await D.locator('[data-ce="save"]').innerText(),'저장됨');await safe();
  }
  checks.push('Missing/wrong-target/wrong-request/wrong-content ACK preserves input and blocks every subsequent write');

  // Schedule committed but response was lost: recovery must use its receipt.
  await setup({loss:'crm_schedule_write_v1'});await open();await pick('연결됨','자료 준비 후 연락하기로 했습니다.');await save();await D.locator('.ce-err').waitFor();
  assert.match(await D.locator('.ce-err').innerText(),/응대 기록은 저장됐습니다/);
  const ids=await page.evaluate(()=>({logs:[...__f.logs.keys()],responses:[...__f.responses.keys()],schedules:[...__f.schedules.keys()]}));
  await save();await saved();assert.deepEqual(await page.evaluate(()=>({logs:[...__f.logs.keys()],responses:[...__f.responses.keys()],schedules:[...__f.schedules.keys()]})),ids);assert.equal(await page.evaluate(()=>__f.rows.length),1);await safe();
  checks.push('Partial schedule response failure retries receipt only: one contact, one response, one open task');

  // Missing release is a real blocked save, never an alternate legacy success path.
  await setup({gateOff:true});await open();await pick('연결됨','연결 확인 전 보관할 상담 내용');
  assert.equal(await D.locator('[data-ce="save"]').isDisabled(),true);await D.locator('[data-ce="save"]').dispatchEvent('click');
  assert.equal(await D.locator('[data-ce-in="memo"]').inputValue(),'연결 확인 전 보관할 상담 내용');assert.equal(await page.evaluate(()=>__f.calls.length),0);await safe();
  await setup();await open();await pick('배드핏');assert.equal(await D.locator('[data-ce="save"]').isDisabled(),true);await D.locator('[data-ce="save"]').dispatchEvent('click');assert.equal(await page.evaluate(()=>__f.calls.length),0);await safe();
  checks.push('Release-off and unsupported close stay blocked in original D; no retired UI or legacy write fallback');

  // The user's actual review link must work without this test's setup/injected ADMIN fixture.
  await page.goto(origin+'/mobile.html?demo=1&review=guide&screen=A&reset=1',{waitUntil:'domcontentloaded'});await page.locator('.approved-a').waitFor();
  const first=page.locator('.approved-a [data-gs="task"]').first();assert.equal(await first.getAttribute('data-kind'),'inquiry');
  const previewId=await first.getAttribute('data-id');assert.equal(previewId,await page.evaluate(()=>__review.inquiry.id));
  const previewBefore=await page.evaluate(()=>({logs:__review.inquiry.fixture.logs.size,rows:__review.inquiry.fixture.rows.length,responses:__review.inquiry.fixture.responses.size}));
  assert.deepEqual(previewBefore,{logs:0,rows:0,responses:0});await first.click();await D.waitFor();
  assert.match(await D.locator('.cd-context').innerText(),/수원장안힐스테이트/);assert.equal(await page.locator('#scr .mi-open,#scr .mh-hub,#scr .flow-strip,#sheetcard .ce-done').count(),0);
  await pick('부재');assert.equal(await D.locator('.cd-note').isVisible(),false);assert.equal(await D.locator('[data-ce="save"]').isDisabled(),false);
  if(process.argv[2])await page.screenshot({path:process.argv[2]});
  await save();await page.waitForFunction(()=>MobileInquiryEntry.state()===null&&__review.inquiry.fixture.logs.size===1);await page.locator('.approved-a').waitFor();
  assert.equal(await D.isVisible(),false);
  const previewAfter=await page.evaluate(()=>({results:[...__review.inquiry.fixture.logs.values()].map(l=>l.result),rows:__review.inquiry.fixture.rows.length,responses:__review.inquiry.fixture.responses.size,status:__review.inquiry.raw.status,example:typeof __approvedAExample,done:G.done,calls:__review.inquiry.fixture.calls.filter(c=>c.name==='crm_inquiry_command_v1').length}));
  assert.deepEqual(previewAfter,{results:['부재'],rows:0,responses:0,status:'배정완료',example:'undefined',done:{},calls:1});
  assert.equal(await page.locator('.approved-a [data-gs="task"][data-kind="inquiry"][data-id="'+previewId+'"]').count(),1,'An absent customer remains an unresolved first-contact task in the actual review link');
  assert.equal(await page.locator('#tabbar button,#scr .mi-open,#scr .mh-hub,#scr .flow-strip').count(),0);
  checks.push('Unmodified user preview ?screen=A: real inquiry card → original D → result-only absence save → actual A counts, no false completion');
  assert.deepEqual(errors,[],'No browser errors');assert.deepEqual(networkWrites,[],'No external or production writes');
  console.log(JSON.stringify({test:'verify-mobile-inquiry',passed:checks.length,checks,boundary:'Synthetic server RPCs; real approved routes and shared PC save contracts; no production verification claim'},null,2));
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
