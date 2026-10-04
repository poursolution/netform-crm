'use strict';
/* 파이프라인 상세 · 문자 보내기 v2 검사(2026-10-04 design_handoff_pipeline_sms · 파이프라인 문자 보내기 v2.dc.html)
   [문자] → 가운데 패널에 한 화면(스크롤 없음): 머리(받는 사람 · 번호 · 수신 동의 꼬리표 · [문자 | 카카오]) → AI 추천 3개 → 보낼 문구(바이트 · 넣기 칩) → 언제 · 보낸 뒤 → 폰 미리보기 → [취소] [문구 복사] [보내기]
   목적 선택 · 채널 중복 · 점수 · 안내 상자는 없다. 추천 · 발송 제한 · 기록은 기존 엔진 그대로 — 보내면 발송 기록 + 응대 이력 + 다음 확인 할 일이 한 번에 생긴다. 끄면 예전 본문. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1700,height:940},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-06T10:24:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealSmsV2&&window.DealDetailV3&&window.DealPanelsV2&&typeof openRelationshipMessage==='function');
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00';
   B={deals:[{id:'55555555-5555-4555-8555-555555555555',site:'오뚜기 포승공장',assignee:'이필선',brand:'POUR솔루션',created:'2026-06-22',code:'sent',stage_code:'sent',grp:'영업·관리',amt:5.74e7,manager_name:'임석재',manager_mobile:'01052493880',manager_role:'관리소장',stage_contexts:{sent:{fields:{sent_date:'2026-09-02'}}},lastMeaningfulContactAt:T('2026-09-02'),activities:[{id:'b1',type:'이메일',note:'견적서 · 시방서 이메일 발송',at:T('2026-09-02'),actor:'이필선'}]}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,JSON.parse(JSON.stringify(p))]);return 'req';};
   G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(900);
  /* 1. [문자] → 가운데 패널 · v2 화면 · 스크롤 없음 */
  await page.locator('#detailView .dv3-acts button',{hasText:'문자'}).first().click();await page.waitForTimeout(700);
  const p=page.locator('#detailView .dw-center>.dv3-cpanel:not([hidden]) #ddvPanel.dp-sms.ds2-on');assert.equal(await p.count(),1,'가운데 패널의 문자 보내기 v2');
  const box=p.locator('.ds2');
  assert.deepEqual(await page.evaluate(()=>{const c=document.querySelector('#detailView .dv3-cpanel'),o=document.querySelector('#ddvPanel>.ddv-side-body');return [c.scrollHeight<=c.clientHeight,getComputedStyle(o).display,!!document.querySelector('#ddvPanel #rm-body')];}),[true,'none',true],'한 화면(스크롤 없음) · 예전 본문은 숨겨 둠(엔진이 읽는 칸은 유지)');
  /* 2. 머리 · AI 추천 3개 · 문구 · 언제 · 보낸 뒤 · 아래 버튼 */
  assert.equal(await box.locator('.ds2-hd').innerText().then(s=>s.replace(/\s+/g,' ')),'‹ 문자 보내기 임석재 소장 · 010-5249-3880 문자 미동의 문자 카카오');
  assert.deepEqual(await box.locator('.ds2-hd em').evaluate(n=>[getComputedStyle(n).color,getComputedStyle(n).backgroundColor]),['rgb(180, 35, 24)','rgb(253, 236, 236)'],'미동의 = 빨간 꼬리표');
  assert.deepEqual(await box.locator('.ds2-hd .ds2-seg button').evaluateAll(l=>l.map(n=>[n.textContent,n.getAttribute('aria-pressed'),getComputedStyle(n).backgroundColor])),[['문자','true','rgb(21, 23, 28)'],['카카오','false','rgb(255, 255, 255)']]);
  assert.match(await box.locator('.ds2-lb').innerText().then(s=>s.replace(/\s+/g,' ')),/^무엇을 보낼까 AI ?자료 발송완료 · .+ 기준$/);
  const tp=await box.locator('.ds2-tpls button').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('span').textContent,n.getAttribute('aria-pressed')]));
  assert.equal(tp.length,3,'추천은 3개만');assert.deepEqual([tp[0][1],tp[0][2],tp[1][2]],['추천 · 지금 단계','true','false']);
  const body0=await box.locator('.ds2-text').inputValue();assert.ok(body0.length>20,'추천 문구가 채워져 있다');
  assert.equal(await box.locator('.ds2-bubble').innerText(),body0,'폰 미리보기 = 보낼 문구');
  assert.match(await box.locator('.ds2-bytes').innerText(),/^\d+byte · (SMS|LMS)$/);
  assert.deepEqual(await box.locator('.ds2-vars button').allInnerTexts(),['+ 현장명','+ 담당자','+ 담당 연락처']);
  assert.equal(await box.locator('.ds2-when').innerText().then(s=>s.replace(/\s+/g,' ')),'언제 지금 예약 · 내일 09:00 보낸 뒤 '+tp[0][0]+' 확인 전화 · '+(await page.evaluate(()=>Number(REL_MSG.templates[0].nextDays)||3))+'일 후 (자동 등록) 바꾸기');
  assert.deepEqual(await box.locator('.ds2-ft button').evaluateAll(l=>l.map(n=>[n.textContent,n.disabled])),[['취소',false],['문구 복사',false],['휴대폰 문자앱으로 보내기',false]]);
  assert.equal(await box.locator('.ds2-ft>span').innerText(),'보내면 응대 이력에 "문자 · 회신대기"로 남고, 다음 확인이 오늘 업무에 잡힙니다');
  assert.equal(await p.locator('select:visible, .rm-shell:visible, .rm-guard:visible').count(),0,'목적 선택 · 예전 안내 상자 없음');
  if(shot)await page.screenshot({path:shot+'-sms.png'});
  /* 3. 추천을 바꾸면 문구가 바뀌고, 고치면 미리보기 · 바이트가 따라온다 · 넣기 칩 */
  await box.locator('.ds2-tpls button').nth(1).click();await page.waitForTimeout(150);
  const body1=await box.locator('.ds2-text').inputValue();assert.notEqual(body1,body0);assert.equal(await box.locator('.ds2-tpls button').nth(1).getAttribute('aria-pressed'),'true');
  await box.locator('.ds2-text').fill('소장님, 견적 잘 받아보셨는지요?');
  assert.equal(await box.locator('.ds2-bubble').innerText(),'소장님, 견적 잘 받아보셨는지요?');assert.equal(await box.locator('.ds2-bytes').innerText(),'31byte · SMS');
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.classList.contains('ds2-text')),true,'입력 중 포커스 유지');
  await box.locator('.ds2-vars button',{hasText:'현장명'}).click();await page.waitForTimeout(120);
  assert.equal(await box.locator('.ds2-text').inputValue(),'소장님, 견적 잘 받아보셨는지요?{현장명}');assert.equal(await box.locator('.ds2-bubble').innerText(),'소장님, 견적 잘 받아보셨는지요?오뚜기 포승공장','미리보기에는 실제 값');
  /* 4. 보낸 뒤 [바꾸기] · 예약 · 카카오(노란 말풍선) */
  const d0=await page.evaluate(()=>Number(REL_MSG.templates[REL_MSG.ds2.t].nextDays)||3);
  await box.locator('[data-ds="days"]').click();await page.waitForTimeout(100);
  const d1=await page.evaluate(()=>REL_MSG.ds2.days);assert.notEqual(d1,d0);assert.match(await box.locator('.ds2-when').innerText(),new RegExp(d1+'일 후 \\(자동 등록\\)'));
  await box.locator('[data-ds="when"][data-v="schedule"]').click();await page.waitForTimeout(100);assert.equal(await box.locator('.ds2-ft .go').innerText(),'예약 알림 등록');
  await box.locator('[data-ds="when"][data-v="now"]').click();await page.waitForTimeout(100);
  await box.locator('[data-ds="ch"][data-v="kakao"]').click();await page.waitForTimeout(120);
  assert.equal(await box.locator('.ds2-hd>b').innerText(),'카카오 보내기');assert.equal(await box.locator('.ds2-hd em').innerText(),'카카오 미동의');
  assert.equal(await box.locator('.ds2-bubble').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(254, 229, 0)','카카오 = 노란 말풍선');
  await box.locator('[data-ds="ch"][data-v="sms"]').click();await page.waitForTimeout(120);
  /* 5. 보내기 = 발송 기록 + 응대 이력 + 다음 확인 할 일 → 창이 닫힌다 */
  await page.evaluate(()=>{__writes.length=0;});
  await box.locator('.ds2-ft .go').click();await page.waitForTimeout(500);
  const W=await page.evaluate(()=>__writes.map(w=>[w[0],w[1]]));
  assert.deepEqual(W.map(w=>w[0]),['message_log','activity','next_action'],JSON.stringify(W.map(w=>w[0])));
  assert.deepEqual([W[0][1].channel,W[0][1].status,W[0][1].recipient_phone,W[0][1].body],['sms','sent','01052493880','소장님, 견적 잘 받아보셨는지요?오뚜기 포승공장']);
  assert.deepEqual([W[1][1].type,W[1][1].result],['문자','소장님, 견적 잘 받아보셨는지요?오뚜기 포승공장']);
  const due=await page.evaluate(d=>new Date(Date.now()+d*864e5).toISOString().slice(0,10),d1);
  assert.deepEqual([W[2][1].type,String(W[2][1].due_at).slice(0,10)],['전화',due],'다음 확인 전화 = 고른 날짜');
  assert.equal(await page.locator('#ddvPanel').count(),0,'보낸 뒤 창이 닫힌다');assert.equal(await page.locator('#detailView .dv3-cpanel:not([hidden])').count(),0);
  /* 6. 수신 거부 연락처: 보낼 수 없음 + 이유 */
  await page.evaluate(()=>{const d=CUR_DETAIL.item,p=itemPatch(d,'deal');p.contactInfo=Object.assign({},contactInfo(d,p),{sendBlocked:true,sendBlockedReason:'고객 요청'});});
  await page.locator('#detailView .dv3-acts button',{hasText:'문자'}).first().click();await page.waitForTimeout(600);
  const blocked=await page.evaluate(()=>!!(REL_MSG&&(REL_MSG.contact.sendBlocked||REL_MSG.contact.optOutAt)));
  if(blocked){assert.deepEqual(await page.locator('#ddvPanel .ds2-ft .go').evaluate(n=>[n.textContent,n.disabled]),['보낼 수 없음',true]);assert.match(await page.locator('#ddvPanel .ds2-ft>span').innerText(),/수신거부 · 발송차단|수신거부·발송차단/);assert.equal(await page.locator('#ddvPanel .ds2-hd em').innerText(),'수신 거부');}
  await page.locator('#ddvPanel [data-ds="cancel"]').first().click();await page.waitForTimeout(200);assert.equal(await page.locator('#ddvPanel').count(),0,'취소 = 닫기');
  /* 7. 끄기 → 예전 본문 */
  await page.evaluate(()=>{G.dealSmsV2Off=true;});
  await page.locator('#detailView .dv3-acts button',{hasText:'문자'}).first().click();await page.waitForTimeout(600);
  assert.equal(await page.locator('#ddvPanel.dp-sms.ds2-on').count(),0);assert.equal(await page.locator('#ddvPanel.dp-sms .rm-shell').count(),1);
  /* 8. 상세 밖에서 연 문자(확장관리 · 고객 자산)도 같은 화면(2026-10-04 대표 "확장관리 문자 누르면 옛날 거 뜬다 · 통일화"): 예전 '메시지 보내기' 창 내용 대신 같은 .ds2 */
  await page.evaluate(()=>{G.dealSmsV2Off=false;try{closeKakaoModal();}catch(e){}try{closeDetail();}catch(e){}});await page.waitForTimeout(300);
  await page.evaluate(()=>{const d=B.deals.find(x=>x.manager_mobile||((x.contacts||[]).some(c=>c.mobile)));CUR_DETAIL={kind:'deal',key:dealKey(d),item:d};openRelationshipMessage('sms');});await page.waitForTimeout(500);
  {const box=page.locator('#kakaoModal.on>.modalbox.ds2-on');assert.equal(await box.count(),1,'상세 밖에서도 새 문자 창');assert.equal(await page.locator('#ddvPanel').count(),0);
   assert.equal(await box.locator(':scope>.ds2 .ds2-hd>b').innerText(),'문자 보내기');assert.equal(await box.locator('.ds2-tpls button').count()>=1,true);assert.equal(await box.locator('.ds2-phone .ds2-bubble').count(),1);
   assert.equal(await page.locator('#kakaoModal .rm-shell').evaluate(n=>!!n.offsetParent),false,'예전 메시지 보내기 내용(CONTEXTUAL MESSAGE · 발송 목적 · 관계 점수)은 보이지 않는다');assert.equal(await page.locator('#kakaoModal .modalhead').evaluate(n=>getComputedStyle(n).display),'none');
   const r=await box.evaluate(n=>{const b=n.getBoundingClientRect();return [Math.round(b.width),Math.abs((b.left+b.right)/2-innerWidth/2)<3];});assert.deepEqual(r,[900,true],'가운데 900px(오른쪽 서랍 아님)');
   if(shot)await page.screenshot({path:shot+'-sms-modal.png'});
   await box.locator('[data-ds="cancel"]').first().click();await page.waitForTimeout(250);assert.equal(await page.locator('#kakaoModal.on').count(),0,'취소 = 닫기');assert.equal(await page.locator('#kakaoModal .modalbox.ds2-on, #kakaoModal .modalbox>.ds2').count(),0,'닫으면 상자를 원래대로');}
  /* 이 검사는 저장 통로(pushWrite)를 가짜로 바꿔 요청만 본다 — 운영 통로의 발송 기록 묶음 확인(operational-overlay)은 가짜 통로에서는 '부모 기록 없음'으로 끝나므로 그 한 가지만 뺀다 */
  assert.deepEqual(errs.filter(e=>!/MESSAGE_LOG_PARENT_REQUIRED/.test(e)),[]);
  console.log(JSON.stringify({status:'PASS',center_one_screen:true,head_consent_channel:true,ai_three:true,edit_live_preview:true,after_send_change_days:true,kakao_yellow:true,send_logs_activity_next:true,blocked_contact:blocked,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
