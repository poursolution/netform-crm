'use strict';
/* 모바일 관리자 요청 (2026-10-10 대표 승인 · mobile_all) — 합성 자료. 요청 목록 · 회신 서버 함수는 가짜 응답.
   확인: 오늘 위 '관리자 요청' 줄(내게 온 열린 요청만) · 누르면 담당 확인(seen) + 상세 / 결과 남기기에서 직접 고른 요청만 닫음(자동 완료 없음)
         / 연락 시도(부재)는 진행 중으로 남음 / 다음 업무가 없으면 완료 조건 미충족 / 연락 요청이 아닌 요청은 PC 에서 / 실패하면 남음 표시 */
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
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.ContactEntry&&window.MobileEntry&&window.MobileRequests&&typeof render==='function'&&window.OperationalUI);
  const setup=(failReply)=>page.evaluate(failReply=>{
   const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.__kst=kst;
   try{sessionStorage.removeItem('crm:call-entry:v1');}catch(e){}
   G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;window.toast=()=>{};
   DEALS=[{id:'d1',nm:'[수원] 첫 연락 요청 현장',code:'consulting',sub:'방수',rep:G.user.nm,amt:1e8,activities:[],tl:[],manager_name:'박정호',manager_mobile:'01056464400',nextAction:{id:'11111111-1111-4111-8111-111111111111',type:'전화',text:'첫 연락',due:kst(0),due_at:kst(0),status:'open'}},
          {id:'d2',nm:'[서울] 견적 확인 현장',code:'consulting',sub:'재도장',rep:G.user.nm,amt:5e7,activities:[],tl:[],manager_name:'김정훈',manager_mobile:'01091622210',nextAction:null}];
   G._today=[];G.done={};G.deal=null;G.sub=null;G.tab='today';
   window.__ops=[];window.__rpc=[];window.__reqs=[
    {id:'r1',status:'sent',target_type:'deal',target_id:'d1',kind:'first',label:'첫 연락 요청',to_me:true,requested_by:'송보람',site:'[수원] 첫 연락 요청 현장',due_at:new Date(Date.now()+5*36e5).toISOString(),round:1,memo:'오늘 고객 연락 후 결과와 다음 일정을 남겨 주세요.'},
    {id:'r2',status:'seen',target_type:'deal',target_id:'d2',kind:'quote',label:'견적 진행 확인',to_me:true,requested_by:'송보람',site:'[서울] 견적 확인 현장',due_at:new Date(Date.now()-3*36e5).toISOString(),round:1},
    {id:'r3',status:'sent',target_type:'deal',target_id:'d1',kind:'follow',label:'후속 연락 요청',to_me:false,requested_by:'송보람',site:'남에게 온 요청',due_at:new Date(Date.now()+5*36e5).toISOString(),round:1},
    {id:'r4',status:'done',target_type:'deal',target_id:'d1',kind:'first',label:'끝난 요청',to_me:true,requested_by:'송보람',site:'끝난 요청',due_at:new Date(Date.now()-5*36e5).toISOString(),round:1}];
   window.queueMobileContactOperation=(op,payload,actionId)=>{const id='op'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,status:'done',ack:{ok:true,operation:o.op,activity_id:'act-'+o.id,next_action_id:'nx-'+o.id}}));
   const real=window.__realPhase1||(window.__realPhase1=window.Phase1);
   window.Phase1=Object.assign({},real,{profile:Object.assign({},real.profile||{},{name:'테스트',allowed_modes:['rep']}),rpc:async(name,args)=>{__rpc.push([name,args.p]);
    if(name==='crm_work_request_list_v1')return {ok:true,requests:JSON.parse(JSON.stringify(__reqs))};
    if(name==='crm_work_request_reply_v1'){if(failReply&&args.p.action==='done')throw Error('서버가 거절했습니다');const r=__reqs.find(x=>x.id===args.p.id);if(args.p.action==='seen')r.status='seen';else r.status=args.p.absent?'working':'done';return {ok:true,request:JSON.parse(JSON.stringify(r))};}
    throw Error('unexpected rpc '+name);}});
   MobileRequests.state().list=[];MobileRequests.state().at=0;MobileRequests.state().off=false;
   render();},failReply);
  await setup(false);await page.waitForTimeout(500);
  const S=page.locator('#scr');
  /* ① 오늘 위 관리자 요청: 내게 온 열린 요청만 */
  assert.match(one(await S.locator('.mq .sec-h').innerText()),/^관리자 요청 2건/);
  assert.deepEqual(await S.locator('.mq-row b').allInnerTexts(),['[서울] 견적 확인 현장','[수원] 첫 연락 요청 현장'],'기한 순 · 남에게 온 것 · 끝난 것 제외');
  assert.equal(await S.locator('.mq-row.late').count(),1,'기한 지난 요청은 빨강');
  /* ② 누르면 담당 확인(seen) + 현장 상세 */
  await S.locator('.mq-row',{hasText:'첫 연락 요청 현장'}).click();await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>G.deal),'d1');assert.deepEqual(await page.evaluate(()=>__rpc.filter(r=>r[1]&&r[1].action).map(r=>[r[1].id,r[1].action])),[['r1','seen']],'누르면 그때 담당 확인');
  /* ③ 결과 남기기: 이 현장 요청이 보이고 자동으로 닫히지 않는다 */
  await page.evaluate(()=>dealCallSheetM());await page.waitForTimeout(300);
  const C=page.locator('#sheetcard');
  assert.equal(await C.locator('.ce-req').count(),1,'이 현장의 내게 온 열린 요청(첫 연락 요청)');
  await C.locator('.ce-chip',{hasText:/^연결됨$/}).click();await C.locator('textarea[data-ce-in="memo"]').fill('옥상 상태 확인 · 견적서 먼저 받고 싶다고 함');await page.waitForTimeout(100);
  await C.locator('.ce-chip[data-ce="mode"]',{hasText:'새 업무'}).click();await C.locator('input[data-ce-in="purpose"]').fill('견적서 발송');await page.waitForTimeout(100);
  await page.evaluate(()=>{__rpc.length=0;});
  await C.locator('.ce-save').click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>__rpc.filter(r=>r[1]&&r[1].action==='done').length),0,'고르지 않으면 요청을 닫지 않는다(자동 완료 없음)');
  assert.deepEqual(await C.locator('.ce-done li em').allInnerTexts(),['저장','완료','신규'],'요청 줄 없음');
  /* ④ 직접 고르면 닫는다 — 실제 연결 + 다음 업무 */
  await setup(false);await page.waitForTimeout(400);await page.evaluate(()=>{G.deal='d1';render();dealCallSheetM();});await page.waitForTimeout(300);
  await C.locator('.ce-chip',{hasText:/^연결됨$/}).click();await C.locator('textarea[data-ce-in="memo"]').fill('옥상 상태 확인');await C.locator('.ce-chip[data-ce="mode"]',{hasText:'새 업무'}).click();await C.locator('input[data-ce-in="purpose"]').fill('견적서 발송');
  await C.locator('.ce-req input').check();await page.waitForTimeout(150);
  assert.match(one(await C.locator('.ce-req').innerText()),/첫 연락 요청 송보람 · 기한 .* ✓ 완료 조건 충족 — 저장하면 요청이 완료로 닫힙니다 완료 조건 · 고객 연락 시도 · 통화 결과 기록 · 다음 행동 \+ 날짜 등록/);
  assert.match(one(await C.locator('.ce-prev').innerText()),/ · 관리자 요청 "첫 연락 요청" 완료$/);
  await page.evaluate(()=>{__rpc.length=0;});await C.locator('.ce-save').click();await page.waitForTimeout(700);
  const due=await page.evaluate(()=>__kst(3));
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>[r[0],r[1]])),[['crm_work_request_reply_v1',{id:'r1',action:'done',result:'연결됨',next_text:'견적서 발송',next_due:due,absent:false}]],'기록 저장 뒤 지정한 요청만 · 같은 회신 함수');
  assert.deepEqual(await C.locator('.ce-done li').allInnerTexts().then(l=>l.map(one)),['저장 응대 기록 1건 (실제 연결)','완료 기존 일정 "첫 연락"','신규 견적서 발송 · '+await page.evaluate(()=>ContactEntry.md(__kst(3))),'완료 관리자 요청 "첫 연락 요청"']);
  /* ⑤ 부재 = 연락 시도 → 요청은 진행 중으로 남음 */
  await setup(false);await page.waitForTimeout(400);await page.evaluate(()=>{G.deal='d1';render();dealCallSheetM();});await page.waitForTimeout(300);
  await C.locator('.ce-chip',{hasText:/^부재$/}).click();await C.locator('.ce-req input').check();await page.waitForTimeout(150);
  assert.match(one(await C.locator('.ce-req em').innerText()),/^연락 시도로 기록 — 요청은 진행 중으로 남습니다$/);
  await page.evaluate(()=>{__rpc.length=0;});await C.locator('.ce-save').click();await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>__rpc.map(r=>[r[1].action,r[1].result,r[1].absent])),[['done','부재',true]]);
  assert.ok((await C.locator('.ce-done li').allInnerTexts().then(l=>l.map(one))).includes('남음 관리자 요청 "첫 연락 요청" — 진행 중 · 연락 시도로 기록'));
  /* ⑥ 다음 업무가 없으면 완료 조건 미충족 */
  await setup(false);await page.waitForTimeout(400);await page.evaluate(()=>{G.deal='d1';render();dealCallSheetM();});await page.waitForTimeout(300);
  await C.locator('.ce-chip',{hasText:/^연결됨$/}).click();await C.locator('textarea[data-ce-in="memo"]').fill('올해는 어렵다고 함');await C.locator('.ce-chip[data-ce="mode"]',{hasText:'다음 일정 없음'}).click();await C.locator('input[data-ce-in="reason"]').fill('내년 예산');await C.locator('.ce-req input').check();await page.waitForTimeout(150);
  assert.match(one(await C.locator('.ce-req em').innerText()),/^완료 조건 미충족 — 다음 업무가 있어야 합니다 · 요청은 남음$/);
  await page.evaluate(()=>{__rpc.length=0;});await C.locator('.ce-save').click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>__rpc.filter(r=>r[1]&&r[1].action==='done').length),0,'조건이 안 채워지면 닫지 않는다');
  /* ⑦ 회신이 실패하면 기록은 남고 요청은 남음으로 안내 */
  await setup(true);await page.waitForTimeout(400);await page.evaluate(()=>{G.deal='d1';render();dealCallSheetM();});await page.waitForTimeout(300);
  await C.locator('.ce-chip',{hasText:/^연결됨$/}).click();await C.locator('textarea[data-ce-in="memo"]').fill('옥상 상태 확인');await C.locator('.ce-chip[data-ce="mode"]',{hasText:'새 업무'}).click();await C.locator('input[data-ce-in="purpose"]').fill('견적서 발송');await C.locator('.ce-req input').check();
  await C.locator('.ce-save').click();await page.waitForTimeout(700);
  assert.ok((await C.locator('.ce-done li').allInnerTexts().then(l=>l.map(one))).includes('남음 관리자 요청 "첫 연락 요청" — 처리하지 못했습니다: 서버가 거절했습니다'));
  assert.equal(await page.evaluate(()=>__ops.filter(o=>o.op==='activity').length),1,'연락 기록은 저장됨');
  /* ⑧ 연락 요청이 아닌 요청(견적)은 PC 에서 */
  await setup(false);await page.waitForTimeout(400);await page.evaluate(()=>{G.deal='d2';render();dealCallSheetM();});await page.waitForTimeout(300);
  assert.match(one(await C.locator('.ce-req').innerText()),/견적 진행 확인[\s\S]*이 요청은 PC 에서 처리합니다/);assert.equal(await C.locator('.ce-req input').isDisabled(),true);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('verify-mobile-requests: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
