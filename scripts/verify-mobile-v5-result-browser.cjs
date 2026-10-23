'use strict';
/* 모바일 v5 전화 후 결과 화면 (2026-10-20 design_handoff_mobile_all '모바일 v5 · 세 작업 바로 하기' 작업 1 · 2 + v5 보완)
   합성 영업건 1건 + 첫 연락 요청 1건(review=contact) · 서버 응답은 합성 ACK · 운영 저장 차단.
   · 연결됨: '확인할 것' 체크 0/2 → 1/2(요청 일부 확인 · 진행 중) → 2/2(요청 완료) · 체크한 것은 상담 내용 한 줄로 저장
   · 일부만 확인하고 저장 = 연락 기록만 · 요청은 그대로(자동 완료 없음)
   · 부재: 상담 칸 · 다음 업무 대신 '다시 연락' 칩 · 요청은 열린 채 그대로(연결 필요) · 기록에 '다시 연락 내일 오전'
   · 새 업무: '가능한 시간 · 확정 전' / '확정 · 고객 약속'
   · 끄기(G.mobileV5Off) = 예전 D(요청 체크 상자) · 320 · 375 폭 가로 넘침 없음 */
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const path=require('node:path');
const SHOT=process.env.SHOT_DIR||'';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(launchOptions()),checks=[];
 async function run(name,body,width=375){
  const context=await browser.newContext({viewport:{width,height:812},timezoneId:'Asia/Seoul'}),errors=[],writes=[];
  await context.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){writes.push(r.request().method());return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const view=page.locator('.approved-d');
  const read=()=>page.evaluate(()=>structuredClone({rows:__review.rows,replies:__review.replies,request:__review.request,deal:DEALS[0],state:MobileEntry.state()}));
  const prev=()=>view.locator('.ce-prev').innerText();
  const save=()=>view.locator('[data-ce="save"]').click(),success=async()=>{try{await page.waitForFunction(()=>MobileEntry.state()===null&&!!document.querySelector('#sheetcard .approved-v5a'));}catch(e){throw Error('저장이 끝나지 않음: '+await page.evaluate(()=>MobileEntry.state()?.err||'(오류 없음)'));}};
  const after=()=>page.locator('#sheetcard .approved-v5a');
  try{
   await page.goto(origin+'/mobile.html?demo=1&review=contact&reset=1',{waitUntil:'domcontentloaded'});await view.waitFor();
   await body({page,view,read,prev,save,success,after});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+'px 가로 넘침 없음');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);checks.push(name);
  }finally{await context.close();}
 }
 try{
  await run('연결됨 · 요청 확인 항목 전부 체크 = 요청 완료(서버 항목별 처리) · 체크한 것은 상담 내용에',async({page,view,read,prev,save,success})=>{
   await page.evaluate(()=>{closeSheet();Object.assign(__review.request,{asks:['고객 첫 연락','연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인']});MobileRequests._put(structuredClone(__review.request));MobileEntry.open();});await view.waitFor();
   assert.equal(await view.locator('.cd-request').isHidden(),true,'예전 요청 체크 상자는 숨김');
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();
   assert.deepEqual(await view.locator('.v5r-ck span').allInnerTexts(),['연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인'],'확인할 것 = 요청에 적힌 항목');
   assert.match(await view.locator('.v5r-ck-h').innerText(),/확인할 것 · 요청에서\s*0 \/ 2 확인/);
   await view.locator('.v5r-ck').nth(0).click();
   assert.match(await prev(),/^저장하면: 응대 기록 1 · 첫 연락 요청 일부 처리 1\/2/,'일부 확인 미리보기');
   assert.match(await view.locator('.v5r-ck-sub').innerText(),/요청은 일부 처리로 저장/);
   await view.locator('.v5r-ck').nth(1).click();
   const p=await prev();assert.match(p,/^저장하면: 응대 기록 1 · 첫 연락 요청 완료 · 남는 일 · 회의 결과 확인/,'전부 확인 = 요청 완료: '+p);
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-result-connected.png')});
   await save();await success();const a=await read(),items=await page.evaluate(()=>structuredClone(__review.items));
   assert.equal(items.length,1,'요청 처리 1번');assert.deepEqual(items[0].confirmed,['연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인']);assert.equal(items[0].result,'연결됨');assert.equal(items[0].activity_id,a.rows[0].ack.activity_id,'근거 = 방금 저장한 응대 기록');assert.equal(items[0].next_text,'회의 결과 확인');
   assert.equal(a.request.status,'done','요청 완료(서버 판정)');assert.deepEqual(a.replies,[],'예전 완료 경로는 안 씀');
   assert.match(a.rows[0].payload.note,/\[확인\] 연락 후 견적 필요 여부 확인 · 현장방문 필요 여부 확인/,'체크한 것 = 기록 글');
   const done=await page.locator('#sheetcard .approved-v5a').innerText();
   assert.match(done,/정리됨/);assert.match(done,/끝난 일[\s\S]*첫 연락 요청 완료 · 요청자에게 알림/);assert.match(done,/남은 일[\s\S]*회의 결과 확인/);assert.match(done,/다음 할 일/);
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-result-done.png')});
   await page.locator('#sheetcard [data-v5a="next"]').click();await page.waitForFunction(()=>G.tab==='today'&&!G.deal&&!document.querySelector('#sheetcard .approved-v5a'));
  });
  await run('일부만 확인 = 연락 완료 · 요청 일부 처리(요청자 화면에 확인 · 남음)',async({page,view,read,save,success})=>{
   await page.evaluate(()=>{closeSheet();Object.assign(__review.request,{asks:['고객 첫 연락','연락 후 견적 필요 여부 확인','현장방문 필요 여부 확인']});MobileRequests._put(structuredClone(__review.request));MobileEntry.open();});await view.waitFor();
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();await view.locator('.v5r-ck').nth(0).click();
   await save();await success();const a=await read();
   assert.equal(a.request.status,'working');assert.equal(a.request.reply_note,'일부 처리 1/2 · 확인: 연락 후 견적 필요 여부 확인 · 남음: 현장방문 필요 여부 확인');
   assert.match(a.rows[0].payload.note,/\[확인\] 연락 후 견적 필요 여부 확인 \/ \[아직\] 현장방문 필요 여부 확인/);
   assert.match(await page.locator('#sheetcard .approved-v5a').innerText(),/남은 일[\s\S]*첫 연락 요청 · 일부 처리 1\/2/);
  });
  await run('첫 연락만 걸린 요청 = 연결 + 다음 행동이면 완료(기준 항목은 안내 · 체크 안 해도 됨)',async({view,read,prev,save,success})=>{
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();
   assert.deepEqual(await view.locator('.v5r-ck span').allInnerTexts(),['견적 요청 범위','방문이 필요한지'],'첫 연락 요청 = 견적문의 기준 항목');
   await view.locator('[data-ce-in="memo"]').fill('합성 상담: 견적 범위 확인');
   assert.match(await prev(),/첫 연락 요청 완료/);
   await save();await success();assert.equal((await read()).request.status,'done');
  });
  await run('부재 · 다시 연락 칩 · 요청 진행 중(시도 1 · 미연결)',async({page,view,read,prev,save,success})=>{
   await view.locator('[data-ce="res"][data-v="부재"]').click();
   assert.equal(await view.locator('.cd-note').isHidden(),true,'상담 칸 없음');assert.equal(await view.locator('.cd-next-section').isHidden(),true,'다음 업무 대신 다시 연락');
   assert.equal(await view.locator('.v5r-ck').count(),0);
   assert.deepEqual(await view.locator('.v5r-retry .v5r-chip').allInnerTexts(),['2시간 후','내일 오전','날짜 고르기']);
   await view.locator('.v5r-chip[data-v="am"]').click();
   const p=await prev();assert.match(p,/^저장하면: 연락 시도 1 · 첫 연락 요청 진행 중 \(시도 · 미연결\)/,p);assert.match(p,/다시 연락 내일 오전/);
   assert.match(await view.locator('.v5r-retry small').innerText(),/기존 업무 "회의 결과 확인" .+ 그대로 · 새 업무 아님/,'서버가 앞당기기를 받지 않으면 기존 업무 그대로 · 시각은 기록 글에');
   await page.waitForTimeout(100);assert.equal(await view.locator('.cs-open.cs-m').count(),0,'부재면 녹음 요약 버튼 없음');
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-result-absent.png')});
   await save();await success();const a=await read();
   assert.equal(a.request.status,'working');assert.equal(a.request.reply_note,'연락 시도 1회 · 미연결 (부재)','요청자 화면 = 시도 1 · 미연결');
   assert.match(a.rows[0].payload.note,/다시 연락 내일 오전/);assert.deepEqual(a.rows.map(r=>r.operation),['activity'],'새 업무 안 만듦');
   const done=await page.locator('#sheetcard .approved-v5a').innerText();assert.match(done,/남긴 것[\s\S]*연락 시도 1회/);assert.match(done,/아직 남은 일[\s\S]*첫 연락 요청 · 연락 시도 1회 · 미연결/);assert.match(done,/다시 연락 내일 오전/);
  });
  await run('새 업무 · 가능한 시간(확정 전) / 확정(고객 약속)',async({page,view,prev})=>{
   await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());DEALS[0].nextAction=null;DEALS[0].nextActionObj=null;MobileEntry.open();});await view.waitFor();
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();await view.locator('.v5r-ck').nth(0).click();
   await view.locator('[data-ce="mode"][data-v="new"]').click();await view.locator('[data-ce-in="purpose"]').fill('현장 방문');
   assert.deepEqual(await view.locator('.v5r-plan .v5r-chip').allInnerTexts(),['가능한 시간 · 확정 전','확정 · 고객 약속']);
   assert.equal(await view.locator('.ce-agree').count(),0);
   assert.match(await prev(),/현장 방문 .* · 확정 전/);
   await view.locator('.v5r-chip[data-v="customer"]').click();
   assert.match(await prev(),/현장 방문 .* · 고객 약속/);
  },320);
  await run('방문 · 만남 · 확인한 것 · 견적 지금 요청 → 견적 요청(방문 이어받음 · 고객 약속) → 정리됨',async({page,view,read,prev,save,success,after})=>{
   await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());Object.assign(DEALS[0].nextAction,{type:'방문',text:'현장 실측'});DEALS[0].nextActionObj=DEALS[0].nextAction;MobileRequests.state().list=[];
    window.__fields=[];let fail=1;const rpc=Phase1.rpc;Phase1.rpc=async(name,args)=>{if(name==='crm_deal_stage_fields_update_v1'){__fields.push(structuredClone(args.p));if(fail){fail=0;throw Error('합성 저장 실패');}return {ok:true,version:2,stage_context:{to:'consulting',fields:args.p.fields}};}return rpc(name,args);};
    const a=DEALS[0].nextAction;MobileEntry.open({ch:'방문',existing:{id:a.id,text:a.text,due:a.due,type:'방문',promise:false}});});await view.waitFor();
   const vis=await view.locator('.cd-results [data-ce="res"]:visible, .cd-results [data-ce="v5cancel"]').allInnerTexts();assert.deepEqual(vis,['만남','담당 부재','취소 · 연기'],'만났나요? 칩 3개');
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();
   assert.deepEqual(await view.locator('.v5r-ck span').allInnerTexts(),['공사 범위','실측','사진'],'확인한 것 = 컨설팅 기준');assert.match(await view.locator('.v5r-ck-h').innerText(),/^확인한 것/);
   for(let i=0;i<3;i++)await view.locator('.v5r-ck').nth(i).click();
   assert.deepEqual(await view.locator('.v5r-quote .v5r-chip').allInnerTexts(),['필요 · 지금 요청','나중에','필요 없음']);
   await view.locator('.v5r-chip[data-ce="v5quote"][data-v="now"]').click();assert.match(await prev(),/이어서 견적 요청/);
   await save();await success();
   let a=await read();assert.deepEqual(a.rows.map(r=>r.operation),['activity','next_action_complete'],'방문 기록 1건 + 그 방문 업무 완료');assert.match(a.rows[0].payload.note,/방문 완료[\s\S]*\[확인\] 공사 범위 · 실측 · 사진[\s\S]*\[견적\] 필요 · 지금 요청/);
   const q=after();assert.match(await q.innerText(),/견적 요청[\s\S]*방문에서 가져옴[\s\S]*공사 범위 · 실측 · 사진/);assert.match(await q.innerText(),/견적팀 예정일\s*미정/);
   assert.equal(await q.locator('[data-v5a-in="req"]').inputValue(),'공사 범위 · 실측 · 사진','빠진 것만 묻기 = 방문 내용으로 채움');
   const wish=await page.evaluate(()=>DayZoneRules.kst(Date.now()+7*864e5));await q.locator('[data-v5a-in="wish"]').fill(wish);await q.locator('[data-v5a="accept"][data-v="1"]').click();
   assert.match(await q.locator('.ce-prev').innerText(),/방문 기록 ✓ 이미 저장됨 · 이 방문에 견적 요청 1 연결 · 고객 약속/);
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-visit-quote.png')});
   await q.locator('[data-v5a="qsend"]').click();await page.locator('#sheetcard .approved-v5a .ce-err').waitFor();
   a=await read();assert.equal(a.rows.length,2,'요청 실패해도 방문 기록 그대로 · 중복 없음');
   await q.locator('[data-v5a="qsend"]').click();await page.waitForFunction(()=>/정리됨/.test(document.querySelector('#sheetcard .approved-v5a')?.innerText||''));
   a=await read();const F=await page.evaluate(()=>__fields);
   assert.equal(F.length,2,'재시도 = 같은 요청 한 번 더');assert.equal(F[1].fields.quote_visit_activity,a.rows[0].ack.activity_id,'이 방문 기록에 연결');assert.equal(F[1].fields.quote_customer_due,wish);assert.equal('quote_due' in F[1].fields,false,'견적팀 예정일은 건드리지 않음');
   assert.deepEqual(a.rows.map(r=>r.operation),['activity','next_action_complete','next_action'],'방문 기록 1 + 방문 업무 완료 + 고객 약속 일정 1');assert.match(a.rows[2].payload.text,/^고객 약속: 견적서 전달/);assert.equal(a.rows[1].object_id||a.rows[1].payload?.opportunity_id,a.deal.id);
   const done=await after().innerText();assert.match(done,/끝난 일[\s\S]*방문[\s\S]*견적 요청 1 · 이 방문에 연결[\s\S]*방문 업무 완료/);assert.doesNotMatch(done,/기존 일정 "현장 실측"/,'끝난 방문은 남은 일에 없음');assert.match(done,/견적 도착 확인 · 견적팀 예정일 미정 · 고객 약속/);
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-visit-done.png')});
  });
  /* 2026-10-23 인계 04: 견적 요청을 '나중에'로 미뤄도 이미 저장된 방문 기록은 그대로 · 견적 요청 · 고객 약속 일정은 만들지 않는다 */
  await run('방문 · 만남 · 견적 지금 요청 → [나중에 · 방문 기록만] = 방문 기록만 남고 견적 요청 · 일정 없음',async({page,view,read,save,success,after})=>{
   await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());Object.assign(DEALS[0].nextAction,{type:'방문',text:'현장 실측'});DEALS[0].nextActionObj=DEALS[0].nextAction;MobileRequests.state().list=[];
    window.__fields=[];const rpc=Phase1.rpc;Phase1.rpc=async(name,args)=>{if(name==='crm_deal_stage_fields_update_v1'){__fields.push(structuredClone(args.p));return {ok:true,version:2,stage_context:{to:'consulting',fields:args.p.fields}};}return rpc(name,args);};
    const a=DEALS[0].nextAction;MobileEntry.open({ch:'방문',existing:{id:a.id,text:a.text,due:a.due,type:'방문',promise:false}});});await view.waitFor();
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();await view.locator('.v5r-ck').first().click();
   await view.locator('.v5r-chip[data-ce="v5quote"][data-v="now"]').click();
   await save();await success();
   const q=after();await q.locator('[data-v5a="qlater"]').click();await page.waitForFunction(()=>/정리됨/.test(document.querySelector('#sheetcard .approved-v5a')?.innerText||''));
   const a=await read(),F=await page.evaluate(()=>__fields);
   assert.deepEqual(a.rows.map(r=>r.operation),['activity','next_action_complete'],'방문 기록 1 + 방문 업무 완료만 — 견적 요청 · 고객 약속 일정 없음');
   assert.equal(F.length,0,'견적 요청(단계 정보) 저장 호출 없음');
   assert.doesNotMatch(await after().innerText(),/견적 요청 1/,'정리됨에 견적 요청 없음');
  });
  /* 2026-10-23 인계 03: 상세 '영업 조건'(J-1) 항목 줄을 누르면 연락 결과가 같은 항목을 '영업 조건에서'로 이어받는다(다시 입력 없음) · 일반 진입은 단계 기준 그대로 */
  await run('영업 조건 항목 → 연락 결과 · 확인할 것 = 영업 조건 항목 그대로',async({page,view})=>{
   const labels=await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());MobileRequests.state().list=[];Object.assign(DEALS[0].nextAction,{type:'전화',text:'연락'});
    G.tab='mine';G.deal=DEALS[0].id;MobileGuideShell.state.detailView='confirmation';render();return [...document.querySelectorAll('.approved-j1 [data-gs="stage-confirmation-item"]')].map(r=>r.children[1].children[0].textContent);});
   assert.ok(labels.length>0,'아직 확인 안 된 항목 줄 = 누를 수 있음');
   await page.locator('.approved-j1 [data-gs="stage-confirmation-item"]').first().click();await view.waitFor();
   await view.locator('[data-ce="res"][data-v="연결됨"]').click();
   assert.match(await view.locator('.v5r-ck-h').innerText(),/확인할 것 · 영업 조건에서/);
   assert.deepEqual(await view.locator('.v5r-ck span').allInnerTexts(),labels,'영업 조건 화면의 같은 항목');
   await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());MobileGuideShell.state.detailView='';render();});
   await page.locator('.approved-c [data-gs="contact"]').first().click();await view.waitFor();await view.locator('[data-ce="res"][data-v="연결됨"]').click();
   assert.doesNotMatch(await view.locator('.v5r-ck-h').innerText(),/영업 조건에서/,'상세 [연락 결과 기록]으로 열면 이어받지 않음');
   await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());});
  });
  await run('방문 취소 · 연기 = 고른 방문 업무의 날짜만 변경(응대 결과 만들지 않음)',async({page,view,read})=>{
   await page.evaluate(()=>{closeSheet();MobileSaveJournal.drop('contact',DEALS[0].id,MobileSaveJournal.owner());Object.assign(DEALS[0].nextAction,{type:'방문',text:'현장 실측'});DEALS[0].nextActionObj=DEALS[0].nextAction;const a=DEALS[0].nextAction;MobileEntry.open({ch:'방문',existing:{id:a.id,text:a.text,due:a.due,type:'방문',promise:false}});});await view.waitFor();
   await view.locator('[data-ce="v5cancel"]').click();
   const rs=page.locator('#sheetcard');await rs.locator('[data-ce="rs-save"]').waitFor();assert.match(await rs.innerText(),/일정 바꾸기/);
   await rs.locator('[data-ce-in="rs-date"]').fill('2099-01-05');await rs.locator('[data-ce-in="rs-reason"]').fill('관리소 사정으로 방문 연기');
   await rs.locator('[data-ce="rs-save"]').click();await page.waitForFunction(()=>/일정을 바꿨습니다/.test(document.getElementById('sheetcard')?.innerText||''));
   const a=await read();assert.deepEqual(a.rows.map(r=>r.operation),['activity','next_action'],'[기한 변경] 기록 + 날짜 변경');assert.match(a.rows[0].payload.note,/^\[기한 변경 요청\] 원래 .+ \| 새 2099-01-05 \| 사유 관리소 사정으로 방문 연기/);
   assert.equal(a.rows[1].payload.intent,'postpone','같은 업무 날짜만(새 업무 아님)');assert.deepEqual(a.replies,[]);assert.equal(a.request.status,'sent','연락이 아니므로 요청은 그대로');
  });
  await run('끄기 = 예전 D',async({page,view})=>{
   await page.evaluate(()=>{G.mobileV5Off=true;closeSheet();MobileEntry.open();});await view.waitFor();
   assert.equal(await view.locator('.v5r-ck,.v5r-retry').count(),0);assert.equal(await view.locator('[data-ce-in="req"]').count(),1);
  });
  console.log(JSON.stringify({status:'PASS',passed:checks.length,checks},null,1));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
