'use strict';
/* 견적문의 상세 · 문자 보내기 검사(2026-10-05 design_handoff_inquiry_sms)
   ✅ 오른쪽 '지금 할 일'의 전화 옆 [문자](1.7 : 1) ✅ [문자] → 가운데 칸(응대 이력 자리)이 문자 보내기로(팝오버 · 오른쪽 패널 아님) · [‹] · [취소]로 응대 이력 복귀
   ✅ 파이프라인 문자 보내기와 같은 틀(.ds2): 머리(수신자 · 번호 · 수신 동의 꼬리표 · 문자 | 카카오) · 추천 3개 · 문구 + 바이트 + 넣기 · 언제 · 보낸 뒤 · 폰 미리보기 · [취소] [문구 복사] [보내기]
   ✅ 문구 복사·앱 이동은 발송 증거가 아님: 문구·이력·일정 보존, CRM 쓰기 없음 ✅ 수신 거부 = 보내기 잠금 · 모름 = 광고성 문구 금지 ✅ 명시적 예약 = 내일 알림(응대 기록 아님) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions());
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryWorkbench&&window.InquiryDetailV2&&window.InquiryFlow&&window.InquiryCommand&&window.InquiryListV3);
  const K=await page.evaluate(()=>{
   const at=h=>new Date(Date.now()-h*36e5).toISOString(),day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const inq=(id,site,phone,extra)=>Object.assign({id,site,site_name:site,brand:'POUR솔루션',status:'전화응대 완료',assignee:'이필선',assigned_at:at(50),contact_name:'윤덕명',phone,work_type:'재도장',first_response_at:at(48),responded_at:at(48),created:at(60),received_at:at(60),raw:{'문의내용':'재도장 문의','공사유형':'재도장','상담채널':'전화','문의자 연락처':phone},activities:[]},extra||{});
   B={deals:[
     {id:'d-no',site:'거부 현장',assignee:'이필선',brand:'POUR솔루션',code:'rapport',stage_code:'rapport',contacts:[{manager_mobile:'01077770000',opt_out_at:at(100),send_blocked:true}]},
     {id:'d-yes',site:'동의 현장',assignee:'이필선',brand:'POUR솔루션',code:'rapport',stage_code:'rapport',contacts:[{manager_mobile:'01088880000',sms_consent:true}]}],
    inquiries:[inq('11111111-1111-4111-8111-111111111111','[경기 시흥] 시흥신천삼환나우빌','010-4200-8204'),inq('22222222-2222-4222-8222-222222222222','[서울] 거부 고객 단지','010-7777-0000'),inq('33333333-3333-4333-8333-333333333333','[서울] 동의 고객 단지','010-8888-0000')],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'u1',name:'이필선',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(...args)=>{__writes.push(JSON.parse(JSON.stringify(args)));return 'req-'+__writes.length;};
   window.__copies=[];window.__copyFail=false;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{if(__copyFail)throw Error('clipboard denied');__copies.push(text);}}});
   window.__rpc=[];window.CRMRelease=Object.assign(window.CRMRelease||{},{has:()=>true,noteMissing(){}});
   window.OpsStore=Object.assign(window.OpsStore||{},{has:()=>true,aiOn:()=>false,rpc:async(name,body)=>{__rpc.push([name,JSON.parse(JSON.stringify(body||{}))]);if(name==='crm_inquiry_flow_list_v1')return {states:[],closed:[]};if(name==='crm_inquiry_command_v1')return {ok:true,state:{inquiry_id:body.inquiry_id,first_attempt_at:body.occurred_at,first_connected_at:null,attempt_count:1,logs:[]}};return {};}});
   goPage('inq');
   return {A:inqKey(B.inquiries[0]),NO:inqKey(B.inquiries[1]),YES:inqKey(B.inquiries[2]),tom:day(1),d3:day(3),d1:day(1)};
  });
  await page.waitForTimeout(400);
  const one=s=>s.replace(/\s+/g,' ').trim(),dd=page.locator('#inq-inbox-dialog.idv3');
  await page.evaluate(k=>InquiryWorkbench.open(k),K.A);await page.waitForTimeout(450);assert.equal(await dd.count(),1,'상세 v3');
  /* 전화 옆 [문자] — 1.7 : 1 */
  const row=dd.locator('.idv3-callrow');assert.deepEqual((await row.locator('button').allInnerTexts()).map(one),['전화 010-4200-8204','문자']);
  const w=await row.locator('button').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().width));assert.ok(Math.abs(w[0]/w[1]-1.7)<0.08,'전화 : 문자 = 1.7 : 1 ('+(w[0]/w[1]).toFixed(2)+')');
  assert.equal(await dd.locator('.idv3-smswrap').count(),0);assert.equal(await dd.locator('.idv3-thread').count(),1,'처음에는 응대 이력');
  /* [문자] → 가운데 칸이 문자 보내기로 */
  await row.locator('[data-idv="sms-open"]').click();await page.waitForTimeout(250);
  assert.equal(await dd.locator('.idv3-c2 .idv3-smswrap .ds2.iq-ds2').count(),1,'가운데 칸 안');assert.equal(await dd.locator('.idv3-thread').count(),0,'응대 이력 자리가 바뀐다');assert.equal(await dd.locator('.idv3-c3 .ds2, .idv3-c1 .ds2').count(),0,'오른쪽 · 왼쪽 칸에는 없다');
  assert.equal(await row.locator('[data-idv="sms-open"]').getAttribute('aria-pressed'),'true');assert.equal(await dd.locator('.idv3-c2').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(245, 246, 248)');
  const P=dd.locator('.iq-sms4');
  assert.equal(one(await P.locator('.ds2-hd').innerText()),'‹ 문자 보내기 윤덕명 · 010-4200-8204 수신 동의 모름 문자 카카오');assert.equal(await P.locator('.ds2-hd em').getAttribute('class'),'bad');
  assert.deepEqual((await P.locator('.ds2-tpls button').allInnerTexts()).map(one),['현장방문 일정 확인 추천 · 지금 상황','부재 · 통화 요청 전화 안 받았을 때','사진 · 자료 요청 견적 준비']);
  assert.match(one(await P.locator('.ds2-lb').innerText()),/^무엇을 보낼까 AI ?견적문의/);
  const body=await P.locator('[data-idv="smstext"]').inputValue();assert.match(body,/^윤덕명님, 넷폼 이필선입니다\.\n재도장 문의 관련해 현장 방문 가능하신 일정을 여쭙니다\./);assert.match(await P.locator('.ds2-bytes').innerText(),/^\d+byte · (SMS|LMS)$/);
  assert.equal(await P.locator('.ds2-bubble').innerText(),body,'폰 미리보기 = 보낼 문구');
  assert.deepEqual((await P.locator('.ds2-vars button').allInnerTexts()).map(one),['+ 현장명','+ 담당자','+ 담당 연락처']);
  const afterText='언제 지금 예약 · 내일 09:00 보낸 뒤 실제 발송 후 결과 확인 · 후속 업무 자동 등록 없음 바꾸기';
  assert.equal(one(await P.locator('.ds2-when').innerText()),afterText);
  assert.deepEqual((await P.locator('.ds2-ft button').allInnerTexts()).map(one),['취소','문구 복사','문자 문구 복사']);assert.equal(await P.locator('.ds2-ft>span').innerText(),'문구 복사·앱 이동은 발송 완료가 아닙니다. 응대 이력과 후속 업무를 자동 등록하지 않습니다');
  if(shot)await page.screenshot({path:shot+'-open.png'});
  /* 추천 문구 고르기 · 보낸 뒤 바꾸기 · 채널 · 언제 */
  await P.locator('.ds2-tpls button').nth(1).click();await page.waitForTimeout(150);assert.match(await P.locator('[data-idv="smstext"]').inputValue(),/통화가 어려우셨던 것 같습니다/);assert.equal(one(await P.locator('.ds2-when').innerText()),afterText);
  await P.locator('[data-idv="sms-days"]').click();await page.waitForTimeout(150);assert.equal(one(await P.locator('.ds2-when').innerText()),afterText,'후속 날짜 후보 변경도 자동 등록으로 표시하지 않는다');
  await P.locator('[data-idv="sms-ch"][data-v="kakao"]').click();await page.waitForTimeout(150);assert.equal(one(await P.locator('.ds2-hd b').innerText()),'카카오 보내기');assert.equal(one(await P.locator('.ds2-ft .go').innerText()),'카카오 문구 복사');
  await P.locator('[data-idv="sms-ch"][data-v="sms"]').click();await page.waitForTimeout(150);
  await P.locator('[data-idv="sms-when"][data-v="later"]').click();await page.waitForTimeout(150);assert.equal(one(await P.locator('.ds2-ft .go').innerText()),'예약하기');assert.match(await P.locator('.ds2-ft>span').innerText(),/자동 발송이 아니라, 정한 시각에 보내기를 알려 주는 알림을 등록합니다/);
  await P.locator('[data-idv="sms-when"][data-v="now"]').click();await page.waitForTimeout(150);
  /* 수신 동의 모름 = 광고성 문구 금지 */
  await P.locator('[data-idv="smstext"]').fill('(광고) 가을 할인 이벤트 안내드립니다');await page.waitForTimeout(150);assert.equal(await P.locator('.ds2-bubble').innerText(),'(광고) 가을 할인 이벤트 안내드립니다','입력 중 미리보기');
  assert.equal(await P.locator('.ds2-ft .go').isDisabled(),true,'광고성 문구는 보낼 수 없다');assert.match(await P.locator('.ds2-ft>span').innerText(),/문의 안내 문구만 보낼 수 있습니다\(광고성 문구 제외\)/);
  /* [‹] = 응대 이력 복귀 */
  await P.locator('.ds2-back').click();await page.waitForTimeout(200);assert.equal(await dd.locator('.idv3-smswrap').count(),0);assert.equal(await dd.locator('.idv3-thread').count(),1,'응대 이력 복귀');
  /* 문구 복사 · 앱 이동은 발송이 아니다. 실제 UI 버튼을 눌러도 이력 · 일정 · 원문은 그대로. */
  await row.locator('[data-idv="sms-open"]').click();await page.waitForTimeout(250);await page.evaluate(()=>{__rpc.length=0;__writes.length=0;});
  await P.locator('.ds2-tpls button').first().click();
  const draft='고객님, 문의하신 현장 방문 일정을 확인 부탁드립니다.\n금요일 오전 회신 부탁드립니다.';
  await P.locator('[data-idv="smstext"]').fill(draft);
  const contactState=()=>page.evaluate(k=>{const q=inqCtlFind(k,false),s=InquiryFlow.state(q);return {q:JSON.stringify(q),patch:JSON.stringify(itemPatch(q,'inq')),attempts:s.attempts,firstAttempt:s.firstAttemptAt,firstConnected:s.firstConnectedAt,logs:JSON.stringify(s.logs),next:JSON.stringify(actionObj(q,itemPatch(q,'inq')))};},K.A);
  const before=await contactState();
  const unchanged=async label=>{assert.deepEqual(await contactState(),before,label+' · 응대 기록/시각/다음 업무 보존');assert.deepEqual(await page.evaluate(()=>__writes),[],label+' · 쓰기 큐 없음');assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1')),[],label+' · 응대 RPC 없음');assert.equal(await P.locator('[data-idv="smstext"]').inputValue(),draft,label+' · 편집 원문 보존');assert.equal(await dd.locator('.idv3-smswrap').count(),1,label+' · 입력 화면 유지');assert.equal(await dd.locator('.idv3-sent').count(),0,label+' · 발송 완료 표시 없음');};
  await P.locator('[data-idv="sms-copy"]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__copies.at(-1)),draft);await unchanged('문구 복사');
  await P.locator('.ds2-ft .go').click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__copies.at(-1)),draft);await unchanged('PC 문자 전달');
  await P.locator('[data-idv="sms-ch"][data-v="kakao"]').click();await P.locator('.ds2-ft .go').click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__copies.at(-1)),draft);await unchanged('카카오 문구 전달');
  await page.evaluate(()=>{__copyFail=true;});const copies=await page.evaluate(()=>__copies.length);
  await P.locator('.ds2-ft .go').click();await page.waitForTimeout(150);assert.match(await dd.locator('#iq-msg').innerText(),/문구를 복사하지 못했습니다.*입력은 그대로 유지했습니다/);assert.equal(await page.evaluate(()=>__copies.length),copies);await unchanged('복사 실패');
  await page.evaluate(()=>{__copyFail=false;});await P.locator('.ds2-ft .go').click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__copies.length),copies+1);await unchanged('복사 재시도');
  if(shot)await page.screenshot({path:shot+'-copied.png'});
  /* 예약 = 내일 알림(응대 기록 아님) */
  await P.locator('[data-idv="sms-ch"][data-v="sms"]').click();await P.locator('.ds2-tpls button').first().click();await page.evaluate(()=>{__rpc.length=0;});
  await P.locator('[data-idv="sms-when"][data-v="later"]').click();await page.waitForTimeout(150);await P.locator('.ds2-ft .go').click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1'&&x[1].type==='contact_log').length),0,'예약은 연락 시도로 남기지 않는다');assert.equal(await dd.locator('.idv3-smswrap').count(),0);
  assert.deepEqual(await page.evaluate(()=>__writes),[['next_action',{inquiry_id:K.A,type:'전화',text:'문자 보내기 · 현장방문 일정 확인 (09:00)',due_at:K.tom}]],'명시적 예약만 다음 업무 1건을 등록한다');
  const reminded=await contactState();assert.equal(reminded.attempts,before.attempts);assert.equal(reminded.firstAttempt,before.firstAttempt);assert.equal(reminded.firstConnected,before.firstConnected);assert.equal(reminded.logs,before.logs,'예약의 내부 일정 기록을 고객 응대에 포함하지 않는다');
  assert.equal(await page.evaluate(k=>{const q=inqCtlFind(k,false),a=actionObj(q,itemPatch(q,'inq'));return a&&a.text+'|'+String(a.due).slice(0,10);},K.A),'문자 보내기 · 현장방문 일정 확인 (09:00)|'+K.tom,'내일 알림 = 다음 할 일');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(200);
  /* 수신 거부 = 보내기 잠금 · 수신 동의 = 초록 꼬리표 */
  await page.evaluate(k=>InquiryWorkbench.open(k),K.NO);await page.waitForTimeout(450);await dd.locator('[data-idv="sms-open"]').click();await page.waitForTimeout(250);
  assert.equal(one(await dd.locator('.iq-sms4 .ds2-hd em').innerText()),'수신 거부');assert.equal(await dd.locator('.iq-sms4 .ds2-ft .go').isDisabled(),true);assert.match(await dd.locator('.iq-sms4 .ds2-ft>span').innerText(),/수신 거부 고객입니다 — 보낼 수 없습니다/);
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(200);
  await page.evaluate(k=>InquiryWorkbench.open(k),K.YES);await page.waitForTimeout(450);await dd.locator('[data-idv="sms-open"]').click();await page.waitForTimeout(250);
  assert.equal(one(await dd.locator('.iq-sms4 .ds2-hd em').innerText()),'문자 수신 동의');assert.equal(await dd.locator('.iq-sms4 .ds2-hd em').getAttribute('class'),'ok');assert.equal(await dd.locator('.iq-sms4 .ds2-ft .go').isDisabled(),false);
  /* 대표 화면 폭 */
  await page.setViewportSize({width:1207,height:914});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'1207 폭 넘침 없음');
  if(shot)await page.screenshot({path:shot+'-1207.png'});
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',sms_button_ratio:true,center_swap:true,same_frame_as_pipeline:true,templates3:true,handoff_no_crm_writes:true,draft_and_contact_state_preserved:true,clipboard_failure_retry:true,explicit_schedule_reminder:true,consent_guard:true,width_1207:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
