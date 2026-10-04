'use strict';
/* 변화 이벤트 · 단계 이동 필수조건 검사(2026-10-04 운영 기준 2차 기능 1 · 2 · 3의 제안)
   상세 응대 기록 옆 [변화 기록] → 종류 8개 · 이전 → 이후 · 날짜 → [다음 행동 등록] = 응대 이력 1줄(노란 변화 이벤트) + 확인할 일(기한 3일, 상세와 같은 저장 함수)
   단계 바꾸기: 필수값이 비면 [옮기기] 잠금 + 빠진 항목 안내, 채우면 열림. 실주: 변화 이벤트가 있으면 원인 후보를 미리 고르고 한 줄로 알림. 설정 · 스위치로 끌 수 있음 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ChangeEvent&&window.StageGate&&window.LostReasonPick&&window.CRMRules&&window.DealDetailV3&&window.StageTransitionUI);
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',D1='11111111-1111-4111-8111-111111111111';
   B={deals:[{id:D1,site:'[경기 수원] 평동동남아파트',assignee:'이필선',brand:'석민이앤씨',created:'2026-02-01',code:'sent',stage_code:'sent',grp:'영업·관리',amt:3.8e8,nextActionObj:{text:'견적 검토 확인',due:'2026-11-05',status:'open'},lastMeaningfulContactAt:T('2026-10-20'),stage_contexts:{sent:{fields:{sent_date:'2026-09-23',recipient:'박영호 소장',followup_date:'2026-10-25',materials:['견적서']}}},activities:[{id:'a1',type:'전화',note:'견적 3.8억 · 공법 설명 긍정적',at:T('2026-09-28'),actor:'이필선'}]}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__memo=[];window.__next=[];
   DealDetailV3.memo=async(d,note)=>{__memo.push([d.id,note]);d.activities=Array.isArray(d.activities)?d.activities:[];d.activities.unshift({id:'m'+__memo.length,type:'메모',note,at:new Date().toISOString(),occurred_at:new Date().toISOString(),actor:'이필선'});};
   DealDetailV3.next=async(d,o)=>{__next.push([d.id,o.text,o.due]);};
   G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(900);
  const v=page.locator('#detailView.dv3');assert.equal(await v.count(),1);
  /* 1. 응대 기록 옆 [변화 기록] → 창: 종류 8개 · 이전 · 이후 · 날짜 · 자동으로 생기는 할 일 */
  assert.equal(await v.locator('#ddvComposer .ce-open').innerText(),'변화 기록');
  await v.locator('#ddvComposer .ce-open').click();await page.waitForTimeout(200);
  const dlg=page.locator('#ce-dialog .ce-dlg');assert.match(await dlg.locator('header').innerText(),/^변화 이벤트 등록\s*상세 → 응대 기록 옆 \[변화 기록\]/);
  assert.deepEqual(await dlg.locator('.ce-types button').allInnerTexts(),['관리소장 변경','입대의 회장 변경','예산 변경','공사시기 변경','공법 변경','경쟁업체 등장','입찰방식 변경','재견적 요청']);
  assert.deepEqual(await dlg.locator('.ce-form label').allInnerTexts(),['이전','이후','날짜']);assert.equal(await dlg.locator('[data-ce-f="date"]').inputValue(),'2026-10-21');
  assert.match(await dlg.locator('.ce-auto').innerText(),/^저장하면 자동으로 생기는 할 일\s*기존 견적 · 공법 조건 재확인 \(새 소장 첫 미팅\)\s*기한 3일 · 오늘 업무 ① 묶음에 올라감 · 실주 시 원인 후보로 자동 제안\s*다음 행동 등록$/);
  await page.locator('#ce-dialog .ce-types button',{hasText:'예산 변경'}).click();assert.match(await page.locator('#ce-dialog .ce-auto b').innerText(),/^범위 축소안 · 단계 시공안 다시 제안$/);
  await page.locator('#ce-dialog .ce-types button',{hasText:'관리소장 변경'}).click();
  await page.locator('#ce-dialog [data-ce="save"]').click();assert.match(await page.locator('#ce-dialog .ce-err').innerText(),/이후\(바뀐 뒤\) 내용을 적어 주세요/);assert.deepEqual(await page.evaluate(()=>__memo),[],'빈 값으로는 저장하지 않음');
  await page.locator('#ce-dialog [data-ce-f="from"]').fill('박영호 소장');await page.locator('#ce-dialog [data-ce-f="to"]').fill('김영수 소장');
  if(shot)await page.screenshot({path:shot+'-event.png'});
  await page.locator('#ce-dialog [data-ce="save"]').click();await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>[__memo,__next]),[[['11111111-1111-4111-8111-111111111111','[변화 · 관리소장 변경] 이전: 박영호 소장 | 이후: 김영수 소장 | 날짜: 2026-10-21 | 확인: 기존 견적 · 공법 조건 재확인 (새 소장 첫 미팅)']],[['11111111-1111-4111-8111-111111111111','기존 견적 · 공법 조건 재확인 (새 소장 첫 미팅)','2026-10-24']]],'응대 이력 1줄 + 확인할 일(기한 3일)');
  assert.equal(await page.locator('#ce-dialog').count(),0);
  /* 2. 응대 이력: 노란 변화 이벤트 */
  const ev=v.locator('.idv-thread .idv-msg.ce-ev');assert.equal(await ev.count(),1);
  assert.match(await ev.locator('.idv-meta').innerText(),/변화 · 관리소장 변경/);assert.match(await ev.locator('.idv-bubble').innerText(),/^박영호 소장 → 김영수 소장 · 2026\.10\.21\s*→ 기존 견적 · 공법 조건 재확인 \(새 소장 첫 미팅\)$/);
  assert.equal(await ev.locator('.idv-bubble').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 244, 214)');
  if(shot)await page.screenshot({path:shot+'-timeline.png'});
  /* 3. 단계 바꾸기 → 관계관리: 필수조건 줄 · 비면 [옮기기] 잠금 · 채우면 열림 */
  await v.locator('.dv3-headact .mv').click();await page.waitForTimeout(200);await v.locator('.dv3-moves [data-stage="relationship"]').first().click();await page.waitForTimeout(600);
  const f=page.locator('#stage-transition-form');assert.equal(await f.count(),1);
  const rows=()=>f.locator('.sg-row').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('span').textContent,n.classList.contains('ok')]));
  assert.deepEqual(await rows(),[['자료 발송일','2026-09-23',true],['고객 반응','필수 · 비어 있음',false],['다음 행동','필수 · 비어 있음',false],['다음 확인일','필수 · 비어 있음',false]].map(r=>r[0]==='다음 행동'?[r[0],'견적 검토 확인 · 2026-11-05',true]:r),'자료 발송일 = 기록에서 · 다음 행동 = 지금 잡혀 있는 것');
  assert.match(await f.locator('.sg-msg').innerText(),/^빠진 항목: 고객 반응 · 다음 확인일 — 채우면 옮길 수 있습니다$/);
  const sub=f.locator('button[type="submit"]');assert.equal(await sub.getAttribute('aria-disabled'),'true');assert.equal(await sub.evaluate(n=>n.classList.contains('sg-locked')),true,'[옮기기] 잠금');
  await f.locator('.sg-row',{hasText:'고객 반응'}).click();assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.id),'sf-reaction','줄을 누르면 그 칸으로');
  await f.locator('#sf-reaction').fill('대표회의 후 연락');await f.locator('#sf-contact_date').fill('2026-10-28');await page.waitForTimeout(200);
  assert.deepEqual((await rows()).map(r=>r[2]),[true,true,true,true]);assert.match(await f.locator('.sg-msg').innerText(),/^필수조건을 모두 채웠습니다 — 남은 필수 입력을 채우면 옮길 수 있습니다$/,'창의 다른 필수 입력(관계관리 사유)이 남아 있으면 그렇게 말한다');
  await f.locator('button',{hasText:'공사 일정 미정'}).click();await page.waitForTimeout(200);assert.match(await f.locator('.sg-msg').innerText(),/^필수조건을 모두 채웠습니다 — 옮길 수 있습니다$/);assert.equal(await f.locator('button[type="submit"]').evaluate(n=>n.classList.contains('off')),false);
  assert.equal(await sub.getAttribute('aria-disabled'),null);assert.equal(await sub.evaluate(n=>n.classList.contains('sg-locked')),false,'채우면 열림');
  if(shot)await page.screenshot({path:shot+'-gate.png'});
  /* 4. 실주: 변화 이벤트가 있으면 원인 후보를 미리 고르고 한 줄로 알림 · 실주 원인 필수 */
  await page.evaluate(()=>{StageTransitionUI.close();StageTransitionUI.open(CUR_DETAIL.item,false,'lost');});await page.waitForTimeout(700);
  assert.equal(await page.locator('#sf-close_reason').inputValue(),'관계 · 관리소장 변경');
  assert.equal(await page.locator('#stage-transition-form .lr-ai').innerText(),"AI 제안: 10.21 '관리소장 변경' 이벤트가 있습니다 → 관계 · 관리소장 변경");
  assert.equal(await page.locator('#stage-transition-form .lr-cats button[aria-pressed="true"]').innerText(),'관계');
  assert.deepEqual(await page.locator('#stage-transition-form .sg-row').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.classList.contains('ok')])),[['실주 원인',true]]);
  await page.locator('#stage-transition-form .lr-cats button',{hasText:'가격'}).click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#stage-transition-form .sg-row').evaluateAll(l=>l.map(n=>n.classList.contains('ok'))),[false],'분류만 고르면 아직 비어 있음');assert.equal(await page.locator('#stage-transition-form button[type="submit"]').getAttribute('aria-disabled'),'true');
  /* 5. 기록에서만 확인하는 조건(1차 현장미팅): 비어 있으면 저장을 막고, 건너뛰기 사유로 대신할 수 있다 */
  const gate=await page.evaluate(()=>{StageTransitionUI.close();const d=CUR_DETAIL.item;d.code=d.stage_code='first_contact';StageTransitionUI.open(d,false,'consulting');return new Promise(r=>setTimeout(()=>r(StageGate.model()),500));});
  assert.deepEqual([gate.to,gate.list.map(x=>[x.l,x.ok]),gate.ok],['consulting',[['1차 현장미팅 일정 또는 완료',false]],false]);
  await page.evaluate(()=>document.querySelector('#stage-transition-form button[type="submit"]').click());await page.waitForTimeout(150);assert.match(await page.locator('#sf-error').innerText(),/필수조건이 비어 있습니다: 1차 현장미팅 일정 또는 완료/);
  /* 6. 설정 · 스위치로 끄기 */
  assert.equal(await page.evaluate(()=>{CRMRules.apply({stage_gates:false});StageGate.decorate();return [StageGate.enabled(),!!document.querySelector('#stage-transition-form .sg-box')];}).then(r=>r.join('|')),'false|false','운영 기준 설정에서 끄면 잠금 없음');
  await page.evaluate(()=>{CRMRules.apply({});StageTransitionUI.close();G.changeEventOff=true;DealDetailV3.apply();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#detailView .ce-open').count(),0);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',change_event_dialog:true,memo_and_next_same_paths:true,timeline_yellow_event:true,stage_gate_lock_unlock:true,lost_reason_suggested:true,record_only_gate_blocks:true,settings_and_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
