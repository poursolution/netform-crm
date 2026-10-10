'use strict';
/* 모바일 결과 창 — 상담 결과 · 한 번만 쓰기 (2026-10-10 mobile_all 2번) — 합성 자료(이름 · 날짜는 지어낸 것)
   확인: 연락 결과 5가지(PC 값) / 부재 · 번호 오류 = 상담 내용 칸 없음 / 연결됨 · 회신 받음 = 상담 내용 필수 / 다음 업무 = 기존 일정 유지 · 변경 · 새 업무 · 없음(+사유)
         / 저장 전 미리보기 / 저장 = 완료 → 기록 → 다음 업무(기존 큐) / 유지 · 변경은 일정을 완료로 세지 않음 / 저장 뒤 완료 · 신규 · 남은 업무 구분
         / 작성 중 내용 복원 / 끄기 스위치 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'')||'mobile.html',t=path.resolve(root,rel);if(!t.startsWith(root+path.sep)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',t.endsWith('.html')?'text/html; charset=utf-8':t.endsWith('.css')?'text/css':'application/javascript; charset=utf-8');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ContactEntry&&window.MobileEntry&&window.MobileV2&&typeof render==='function'&&window.OperationalUI);
  const reset=()=>page.evaluate(()=>{
   const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.__kst=kst;
   try{sessionStorage.removeItem('crm:call-entry:v1');}catch(e){}
   G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;
   const a1='11111111-1111-4111-8111-111111111111',a2='22222222-2222-4222-8222-222222222222';
   DEALS=[{id:'d1',nm:'[수원] 매탄임광아파트',code:'consulting',sub:'외벽 재도장',rep:G.user.nm,amt:260000000,activities:[],tl:[],manager_name:'박정호',manager_mobile:'01056464400',nextAction:{id:a1,type:'전화',text:'대표회의 결과 확인',due:kst(3),due_at:kst(3),status:'open'}},
          {id:'d2',nm:'[서울] 햇빛마을23단지',code:'consulting',sub:'재도장',rep:G.user.nm,amt:100000000,activities:[],tl:[],manager_name:'김정훈',manager_mobile:'01091622210',nextAction:{id:a2,type:'전화',text:'첫 연락',due:kst(0),due_at:kst(0),status:'open'}},
          {id:'d3',nm:'[대구] 일정 없는 현장',code:'consulting',sub:'방수',rep:G.user.nm,amt:0,activities:[],tl:[],manager_name:'최민우',manager_mobile:'01080153320',nextAction:null}];
   G._today=[];G.done={};window.__ops=[];window.toast=()=>{};
   window.queueMobileContactOperation=(op,payload,actionId)=>{const id='op'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,status:'done',ack:{ok:true,operation:o.op,activity_id:'act-'+o.id,next_action_id:'nx-'+o.id}}));
   window.__open=id=>{G.deal=id;G.sub=null;G.tab='today';render();dealCallSheetM();};
  });
  await reset();
  const C=page.locator('#sheetcard'),txt=async s=>one(await C.locator(s).innerText());
  const chip=l=>C.locator('.ce-chip',{hasText:l}).first();
  const prev=()=>txt('.ce-prev');
  const kst=n=>page.evaluate(n=>__kst(n),n);
  const md=async n=>{const k=await kst(n);return page.evaluate(k=>ContactEntry.md(k),k);};
  const ops=()=>page.evaluate(()=>__ops.map(o=>[o.op,o.payload.type||'',o.payload.text||'',o.payload.due_at||'',o.actionId||'']));
  const memoNotes=()=>page.evaluate(()=>__ops.filter(o=>o.op==='activity').map(o=>o.payload.note));
  const open=id=>page.evaluate(id=>__open(id),id).then(()=>page.waitForTimeout(350));
  /* ① 열면: 연락 결과 5가지 · 기존 일정 먼저 · 결과 전에는 안내만 */
  await open('d1');
  assert.deepEqual(await C.locator('.ce-chips').first().locator('.ce-chip').allInnerTexts(),['연결됨','회신 받음','부재','번호 오류','배드핏'],'PC 연락 결과 값');
  assert.match(await txt('.ce-ex'),/^기존 일정 대표회의 결과 확인 · /,'기존 일정을 먼저 보여 준다');
  assert.equal(await C.locator('.ce-q').count(),2,'결과를 고르기 전에는 연락 결과 · 다음 업무 두 칸만');
  assert.equal(await prev(),'연락 결과를 골라 주세요');
  assert.deepEqual(await C.locator('.ce-chip[data-ce="mode"]').allInnerTexts(),['기존 일정 유지','일정 변경','새 업무','다음 일정 없음']);
  assert.equal(await C.locator('.ce-chip').evaluateAll(l=>l.every(b=>b.getBoundingClientRect().height>=40)),true,'터치 영역 40 이상');
  /* ② 연결됨: 상담 내용 필수 · 멀리 잡힌 일정은 기본 '유지' */
  await chip('연결됨').click();await page.waitForTimeout(150);
  assert.equal(await C.locator('textarea[data-ce-in="memo"]').count(),1,'상담 내용 칸');
  assert.equal(await C.locator('.ce-chip[data-ce="mode"][aria-pressed="true"]').innerText(),'기존 일정 유지','앞으로 잡힌 일정이 있으면 기본은 그대로');
  assert.equal(await prev(),'상담 내용을 한 줄 적어 주세요 (이번에 새로 확인한 것)');
  await C.locator('.ce-save').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>__ops.length),0,'상담 내용 없이는 저장하지 않는다');assert.match(await txt('.ce-err'),/상담 내용을 한 줄/);
  await C.locator('textarea[data-ce-in="memo"]').fill('다음 주 대표회의에서 검토 · 금요일까지 견적서 보내 달라고 함');await page.waitForTimeout(100);
  assert.equal(await prev(),'저장하면 응대 기록 1건 저장 (실제 연결) · 기존 일정 유지 · 새 일정 없음');
  /* ③ 작성 중 내용 복원: 창을 닫았다가 다시 열어도 이어서 */
  await page.evaluate(()=>{closeSheet();});await page.waitForTimeout(150);await page.evaluate(()=>dealCallSheetM());await page.waitForTimeout(250);
  assert.equal(await C.locator('textarea[data-ce-in="memo"]').inputValue(),'다음 주 대표회의에서 검토 · 금요일까지 견적서 보내 달라고 함','작성 중 내용 복원');
  assert.equal(await C.locator('.ce-chip[aria-pressed="true"]').first().innerText(),'연결됨');
  /* ④ 유지로 저장: 기록 1건만 — 일정은 완료로 세지 않고 새로 만들지 않는다 */
  await C.locator('.ce-save').click();await page.waitForTimeout(500);
  assert.deepEqual(await ops(),[['activity','전화','','','']],'기록 1건만 저장');
  assert.deepEqual(await memoNotes(),['통화 완료 · 연결됨 — 다음 주 대표회의에서 검토 · 금요일까지 견적서 보내 달라고 함']);
  assert.deepEqual(await page.evaluate(()=>[DEALS[0].nextAction.text,DEALS[0].nextAction.status]),['대표회의 결과 확인','open'],'기존 일정은 그대로 열려 있음');
  assert.deepEqual(await C.locator('.ce-done li').evaluateAll(l=>l.map(n=>[n.querySelector('em').textContent,n.querySelector('span').textContent.replace(/\s+/g,' ')])),
   [['저장','응대 기록 1건 (실제 연결)'],['남음','기존 일정 "대표회의 결과 확인" · '+await md(3)]],'저장 뒤: 저장된 기록 · 남은 업무 구분');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('crm:call-entry:v1')),null,'저장하면 임시 내용을 지운다');
  /* ⑤ 새 업무: 오늘 일정을 처리한 것 → 완료 + 기록 + 후속 업무(서로 따로 확인) */
  await reset();await open('d2');await chip('연결됨').click();await page.waitForTimeout(120);
  assert.equal(await C.locator('.ce-chip[data-ce="mode"][aria-pressed="true"]').innerText(),'새 업무','오늘 일정을 처리한 것 → 새 업무가 기본');
  assert.equal(await C.locator('input[data-ce-in="purpose"]').inputValue(),'다시 연락');
  await C.locator('textarea[data-ce-in="memo"]').fill('올해 가을 시공 희망 · 견적서 먼저 받고 싶다고 함');
  await C.locator('input[data-ce-in="purpose"]').fill('견적서 발송');
  await C.locator('.ce-date',{hasText:'3일 후'}).click();await page.waitForTimeout(120);
  assert.equal(await prev(),'저장하면 응대 기록 1건 저장 (실제 연결) · 기존 일정 "첫 연락" 완료 · 견적서 발송 일정 1건 등록 · '+await md(3));
  await C.locator('.ce-save').click();await page.waitForTimeout(600);
  assert.deepEqual(await ops(),[['next_action_complete','','','','22222222-2222-4222-8222-222222222222'],['activity','전화','','',''],['next_action','후속접촉','견적서 발송',await kst(3),'']],'완료 → 기록 → 다음 업무 순서(기존 큐)');
  assert.deepEqual(await page.evaluate(()=>[DEALS[1].nextAction.text,DEALS[1].nextAction.status,DEALS[1].nextAction.due_at]),['견적서 발송','open',await kst(3)]);
  assert.deepEqual(await C.locator('.ce-done li em').allInnerTexts(),['저장','완료','신규'],'저장 뒤: 저장 · 완료 · 신규 구분');
  /* ⑥ 부재: 상담 내용 칸 없음 · 연락 시도로만 · 연결로 세지 않는다 */
  await reset();await open('d3');
  assert.deepEqual(await C.locator('.ce-chip[data-ce="mode"]').allInnerTexts(),['새 업무','다음 일정 없음'],'기존 일정이 없으면 유지 · 변경은 없다');
  assert.match(await txt('.ce-ex'),/^지금 잡힌 다음 업무가 없습니다$/);
  await chip('부재').click();await page.waitForTimeout(150);
  assert.equal(await C.locator('textarea[data-ce-in="memo"]').count(),0,'부재 = 상담 내용 칸 없음');
  assert.match(await txt('.ce-miss'),/^부재 · 번호 오류는 상담 내용 칸 없음 · 연락 시도로만 기록$/);
  assert.equal(await prev(),'저장하면 연락 시도 1건 기록 · 다시 전화 일정 1건 등록 · '+await md(1));
  await C.locator('.ce-save').click();await page.waitForTimeout(600);
  assert.deepEqual(await ops(),[['activity','전화','','',''],['next_action','전화','다시 전화',await kst(1),'']]);
  assert.deepEqual(await memoNotes(),['부재중 (전화 안 받음)']);
  assert.equal(await page.evaluate(()=>DEALS[2].contactAt||''),'','부재는 실제 연결로 세지 않는다(연락 시도)');
  /* ⑦ 번호 오류 · 배드핏 */
  await reset();await open('d3');await chip('번호 오류').click();await page.waitForTimeout(120);
  assert.equal(await C.locator('input[data-ce-in="purpose"]').inputValue(),'연락처 확인');
  assert.equal(await prev(),'저장하면 연락 시도 1건 기록 · 연락처 확인 일정 1건 등록 · '+await md(1));
  await chip('배드핏').click();await page.waitForTimeout(120);
  assert.deepEqual(await C.locator('.ce-chip[data-ce="mode"]').allInnerTexts(),['다음 일정 없음'],'배드핏 = 다음 일정 없음만');
  await C.locator('textarea[data-ce-in="memo"]').fill('공사 계획 없다고 함');
  assert.match(await prev(),/^배드핏은 사유가 있어야 합니다$/);
  await C.locator('input[data-ce-in="reason"]').fill('자체 보수 완료');await page.waitForTimeout(100);
  assert.match(await prev(),/응대 기록 1건 저장 \(실제 연결\) · 다음 일정 없음 · 사유 기록 · 배드핏 종결 검토 \(사유 필수\) — 종결은 \[단계 바꾸기\]에서 따로$/);
  await C.locator('.ce-save').click();await page.waitForTimeout(500);
  assert.deepEqual(await ops(),[['activity','전화','','','']],'배드핏은 기록만 — 종결은 단계 바꾸기에서 따로');
  assert.equal((await memoNotes())[0],'통화 완료 · 배드핏 종결 검토 · 이유: 자체 보수 완료 — 공사 계획 없다고 함');
  /* ⑧ 일정 변경: 날짜만 바꾼다(완료로 세지 않음) */
  await reset();await open('d1');await chip('회신 받음').click();await page.waitForTimeout(120);
  await C.locator('textarea[data-ce-in="memo"]').fill('사진 보내 줬다고 함');
  await C.locator('.ce-chip[data-ce="mode"]',{hasText:'일정 변경'}).click();await page.waitForTimeout(120);
  await C.locator('.ce-date',{hasText:'다음 주 월요일'}).click();await page.waitForTimeout(120);
  assert.match(await prev(),/^저장하면 응대 기록 1건 저장 \(실제 연결\) · 기존 일정 "대표회의 결과 확인" 날짜만 변경 · /);
  await C.locator('.ce-save').click();await page.waitForTimeout(600);
  assert.deepEqual((await ops()).map(o=>[o[0],o[2]]),[['activity',''],['next_action','대표회의 결과 확인']],'날짜만 변경 = 완료 없이 같은 업무를 새 날짜로');
  /* ⑨ 고객 정보 변경 ▾ + 다음 일정 없음은 사유 필수 */
  await reset();await open('d2');await chip('연결됨').click();await page.waitForTimeout(100);
  await C.locator('.ce-infobtn').click();await page.waitForTimeout(100);
  assert.deepEqual(await C.locator('.ce-infobody > div > span').allInnerTexts(),['공종','결정권자 · 담당자','공사 시기 · 대표회의']);
  await C.locator('textarea[data-ce-in="memo"]').fill('올해는 어렵다고 함');await C.locator('.ce-chip[data-ce="mode"]',{hasText:'다음 일정 없음'}).click();await page.waitForTimeout(100);
  assert.equal(await prev(),'다음 일정이 없는 이유를 넣어 주세요');
  /* ⑨b 말하기(휴대폰 음성 인식) · AI로 정리(로그인 상태에서만 · 추천 표시만) */
  await reset();await page.evaluate(()=>{window.SpeechRecognition=class{start(){setTimeout(()=>{this.onresult({resultIndex:0,results:[Object.assign([{transcript:'소장님 다음 주 화요일 방문 확정'}],{isFinal:true})]});this.onend();},50);}stop(){this.onend();}};});
  await open('d2');await chip('연결됨').click();await page.waitForTimeout(100);
  assert.equal(await C.locator('.ce-tidy').count(),0,'로그인 토큰이 없으면 AI 정리 버튼 없음');
  await C.locator('.ce-mic').click();await page.waitForTimeout(300);
  assert.equal(await C.locator('textarea[data-ce-in="memo"]').inputValue(),'소장님 다음 주 화요일 방문 확정','말하면 글자로');
  await page.route('**/functions/v1/crm-ai',async r=>{const b=r.request().postDataJSON();await page.evaluate(x=>{window.__tidyIn=x;},b);const d1=await page.evaluate(()=>__kst(1));return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,suggestion:{id:'s1',status:'proposed',suggestion:{memo:'소장님 다음 주 화요일 방문 확정',result:'promise',what:'다음 주 화요일 방문',next:{date:d1,text:'방문'}}}})});});
  await page.evaluate(()=>{window.TOKEN='t';window.SUPABASE_URL=window.SUPABASE_URL||'https://ymfbmpnizxvqsamnczow.supabase.co';window.SUPABASE_ANON=window.SUPABASE_ANON||'anon';closeSheet();dealCallSheetM();});await page.waitForTimeout(250);
  await C.locator('textarea[data-ce-in="memo"]').count().then(async n=>{if(!n){await chip('연결됨').click();await page.waitForTimeout(100);}});
  await C.locator('textarea[data-ce-in="memo"]').fill('어 소장님이 다음주 화요일에 오라고 하셨고 견적 수정본 가져오라고');await C.locator('.ce-tidy').click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>__tidyIn.kind),'memo_tidy');assert.match(await page.evaluate(()=>__tidyIn.input.raw),/^어 소장님이/);
  assert.equal(await C.locator('textarea[data-ce-in="memo"]').inputValue(),'소장님 다음 주 화요일 방문 확정');
  assert.match(await txt('.ce-hint'),/^AI 정리\(제안\) — 결과는 「연결됨」 · 다음 확인 \d+\/\d+ · 방문 로 추천합니다\. 상담 내용은 고칠 수 있고, 고르는 것은 직접 합니다\./);
  assert.equal(await C.locator('.ce-chip.ai').count()>=1,true,'연결됨 칩에 AI 추천');
  await C.locator('.ce-undo').click();await page.waitForTimeout(120);assert.match(await C.locator('textarea[data-ce-in="memo"]').inputValue(),/^어 소장님이/,'원문으로 되돌리기');
  await page.evaluate(()=>{window.TOKEN=null;});await page.unroute('**/functions/v1/crm-ai');
  /* ⑩ 끄기 → 예전 결과 창 */
  await page.evaluate(()=>{closeSheet();G.contactEntryOff=true;dealCallSheetM();});await page.waitForTimeout(250);
  assert.equal(await page.locator('#sheetcard .ml-chip').count(),5,'끄면 예전 결과 창');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('verify-mobile-entry: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
