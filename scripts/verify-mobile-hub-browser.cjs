'use strict';
/* 모바일 탭 정리 — 오늘 / 내 현장 / 기록 · 등록 / 일정 (2026-10-10 mobile_all 4 · 5번) — 합성 자료(이름 · 날짜는 지어낸 것)
   확인: 하단 탭 이름 / 기록 · 등록 = 방금 열었던 현장 먼저 + 내 현장 최근 순 + 새 현장 등록 / 일정 = 기한 지남 · 오늘 · 내일 · 이번 주 · 다음 주 이후
         / 방문 일정 줄 = 방문 결과 입력 · [일정 변경] = 날짜만 바꾸기 / 상세에서 돌아오면 목록 위치 복원 / 끄기 스위치 */
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
  await page.waitForFunction(()=>window.MobileHub&&window.MobileEntry&&window.MobileV2&&typeof render==='function'&&window.OperationalUI);
  await page.evaluate(()=>{
   const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.__kst=kst;
   G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;window.toast=()=>{};
   const me=G.user.nm,mk=(id,nm,due,text,type,extra)=>Object.assign({id,nm,code:'consulting',sub:'방수',rep:me,amt:1e8,activities:[],tl:[],manager_name:'김소장',manager_mobile:'01011112222',nextAction:due==null?null:{id:'a-'+id,type:type||'전화',text:text||'다시 연락',due:kst(due),due_at:kst(due),status:'open'}},extra||{});
   const sunGap=(7-new Date(kst(0)+'T00:00:00Z').getUTCDay())%7;
   DEALS=[mk('late1','[지남] 늦은 현장',-3,'견적 후속 통화'),mk('today1','[오늘] 방문 현장',0,'현장 방문 · 옥상 실측','방문'),mk('tom1','[내일] 내일 현장',1,'자료 보내기'),
          mk('week1','[주중] 이번 주 현장',Math.min(sunGap,3)>1?Math.min(sunGap,3):2,'결과 확인'),mk('next1','[다음주] 다음 주 현장',sunGap+3,'고객 약속: 입대의 결과 확인','고객 약속'),mk('none1','[없음] 일정 없는 현장',null),
          mk('rec1','[최근] 어제 통화한 현장',5,'다시 연락',null,{activities:[{id:'x1',type:'전화',note:'통화 완료',at:kst(-1)+'T10:00:00+09:00'}]})];
   for(let i=0;i<40;i++)DEALS.push(mk('m'+i,'[목록] 스크롤 현장 '+i,9+i,'다시 연락'));
   G._today=[];G.done={};G.tab='today';G.deal=null;G.sub=null;render();
   window.__ops=[];window.queueMobileContactOperation=(op,payload,actionId)=>{const id='op'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,status:'done',ack:{ok:true,operation:o.op,activity_id:'act-'+o.id,next_action_id:'nx-'+o.id}}));
  });
  const S=page.locator('#scr'),txt=async s=>one(await S.locator(s).first().innerText());
  const tab=l=>page.locator('#tabbar button',{hasText:l}).first().click().then(()=>page.waitForTimeout(300));
  /* ① 하단 탭 */
  assert.deepEqual(await page.locator('#tabbar button .tl2').allInnerTexts(),['오늘','내 현장','기록 · 등록','일정']);
  /* ② 기록 · 등록: 현장 유지(방금 연 현장 먼저) → 최근 기록 순 → 새 현장 등록 */
  await page.evaluate(()=>{G.deal='tom1';render();G.deal=null;G.tab='today';render();});
  await tab('기록 · 등록');
  assert.equal(await txt('.mh-hub .mv-title h1'),'어느 현장에 기록하나요?');
  assert.match(await txt('.mh-card.now'),/^방금 열었던 현장 · 이어서 기록 컨설팅 설계 \[내일\] 내일 현장/,'방금 열었던 현장이 맨 위');
  assert.match(await S.locator('.mh-list .mh-card').first().innerText().then(one),/^컨설팅 설계 \[최근\] 어제 통화한 현장 김소장 관리소장 · 최근 \d+\.\d+ \(.\) 전화$/,'최근 기록한 현장 순');
  assert.equal(await txt('.mh-sub'),'새 현장 등록');assert.equal(await S.locator('button[onclick="scanCard()"]').count(),1,'새 현장 등록(기존 화면)은 그 아래 그대로');
  assert.equal(await S.locator('.mh-card').evaluateAll(l=>l.every(b=>b.getBoundingClientRect().height>=48)),true,'터치 영역 48 이상');
  await S.locator('.mh-card.now').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>G.deal),'tom1','카드 = 그 현장 상세');
  /* ③ 일정: 날짜순 묶음 */
  await page.evaluate(()=>{G.deal=null;G.tab='today';render();});await tab('일정');
  /* 기대 묶음은 날짜 계산으로 따로 구한다(요일에 따라 '이번 주' 건수가 달라진다) */
  const exp=await page.evaluate(()=>{const sunGap=(7-new Date(__kst(0)+'T00:00:00Z').getUTCDay())%7,n=[];DEALS.forEach(d=>{const a=d.nextAction;if(a&&a.status==='open')n.push(Math.round((Date.parse(a.due_at+'T00:00:00Z')-Date.parse(__kst(0)+'T00:00:00Z'))/864e5));});const c=f=>n.filter(f).length;return [['기한 지남',c(x=>x<0)],['오늘',c(x=>x===0)],['내일',c(x=>x===1)],['이번 주',c(x=>x>1&&x<=sunGap)],['다음 주 이후',c(x=>x>sunGap)]].filter(x=>x[1]).map(x=>x[0]+' '+x[1]);});
  assert.deepEqual(await S.locator('.mh-grp h3').allInnerTexts().then(l=>l.map(one)),exp,'기한 지남 · 오늘 · 내일 · 이번 주 · 다음 주 이후');
  assert.match(await txt('.mh-sched .sec-h h2'),/^일정 \d+건$/);
  assert.match(await S.locator('.mh-row.late .mh-main').first().innerText().then(one),/^\d+\.\d+ \(.\) \[지남\] 늦은 현장 전화 · 견적 후속 통화$/);
  assert.match(await S.locator('.mh-row',{hasText:'다음 주 현장'}).innerText().then(one),/고객 합의/,'고객 합의 일정 표시');assert.equal(await S.locator('.mh-row',{hasText:'일정 없는 현장'}).count(),0,'다음 업무가 없는 현장은 일정에 없다');
  assert.equal(await S.locator('.mh-main,.mh-move').evaluateAll(l=>l.every(b=>b.getBoundingClientRect().height>=44)),true,'터치 영역 44 이상');
  /* ④ 오늘 방문 일정 줄 → 상세 + 방문 결과 입력 */
  await S.locator('.mh-row',{hasText:'방문 현장'}).locator('.mh-main').click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>G.deal),'today1');assert.match(await page.locator('#sheetcard .intro').innerText().then(one),/^방문 어떻게 됐나요\?/,'방문 일정 = 방문 결과 입력');
  await page.evaluate(()=>closeSheet());
  /* ⑤ [일정 변경] → 일정 바꾸기(날짜만) */
  await page.evaluate(()=>{G.deal=null;G.tab='today';render();});await tab('일정');
  await S.locator('.mh-row',{hasText:'내일 현장'}).locator('.mh-move').click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>G.deal),'tom1');assert.match(await page.locator('#sheetcard .intro').innerText().then(one),/^일정 바꾸기/);assert.match(await page.locator('#sheetcard .ce-ex').innerText().then(one),/^기존 일정 자료 보내기 · /);
  await page.evaluate(()=>closeSheet());
  /* ⑥ 상세에서 돌아오면 목록 위치 복원 */
  await page.evaluate(()=>{G.deal=null;G.sub=null;G.tab='mine';G._og={};render();});await page.waitForTimeout(250);
  const info=await page.evaluate(()=>{const el=document.querySelector('.phone-body');return {max:el.scrollHeight-el.clientHeight};});
  assert.ok(info.max>300,'스크롤이 필요한 긴 목록 '+info.max);
  const target=Math.min(info.max-20,420);
  await page.evaluate(t=>{const el=document.querySelector('.phone-body');el.style.scrollBehavior='auto';el.scrollTop=t;},target);await page.waitForTimeout(100);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('#scr .lrow[data-id]')].find(x=>x.getBoundingClientRect().top>150&&x.getBoundingClientRect().bottom<700);window.__pick=b&&b.dataset.id;G.deal=window.__pick;render();});await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>!!G.deal),'상세로 들어감');
  await page.evaluate(()=>{G.deal=null;render();});await page.waitForTimeout(250);
  const back=await page.evaluate(()=>document.querySelector('.phone-body').scrollTop);
  assert.ok(Math.abs(back-target)<=4,'목록 위치 복원 '+back+' ≈ '+target);
  /* ⑥b 내 현장 필터: PC 와 같은 조건(브랜드 · 공종) + 적용 조건 · 결과 수 */
  await page.evaluate(()=>{G.deal=null;G.sub=null;G.tab='mine';G._og={};G.brandF='';G.workF='';G.filt='all';G.bizF='전체';DEALS.forEach((d,i)=>{d.brand=i%2?'POUR솔루션':'석민이앤씨';if(i<3)d.gj=['재도장','재도장(외부)'];else delete d.gj;});render();});await page.waitForTimeout(250);
  assert.ok(await page.locator('#scr .mh-filter').count()===1,'필터 줄');
  assert.deepEqual(await S.locator('.mh-frow').first().locator('button').allInnerTexts(),['전체','석민이앤씨','POUR솔루션']);assert.deepEqual(await S.locator('.mh-frow').nth(1).locator('button').allInnerTexts(),['전체','재도장']);
  const total=await page.evaluate(()=>myDeals().filter(isOpen).length);assert.match(await txt('.mh-fres'),new RegExp('^'+total+'곳 \\(내 진행 '+total+'곳 중\\)$'),'조건 없을 때 결과 수');
  await S.locator('.mh-frow').nth(1).locator('button',{hasText:'재도장'}).click();await page.waitForTimeout(250);
  assert.match(await txt('.mh-fres'),new RegExp('^적용 조건 · 공종 재도장 → 3곳 \\(내 진행 '+total+'곳 중\\) 조건 지우기$'),'적용 조건 · 결과 수');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .lrow[data-id]')].length),3,'목록도 같은 3곳');
  await S.locator('.mh-fres button').click();await page.waitForTimeout(250);assert.match(await txt('.mh-fres'),new RegExp('^'+total+'곳'));
  /* ⑥c 문의 정보 조회: PC 와 같은 칸 · 빈 칸은 '미입력' */
  await page.evaluate(()=>{ADMIN.inquiries=[{key:'q1',nm:'[테스트] 문의 현장',rep:G.user.nm,status:'배정완료',phone:'01011112222',gj:'옥상방수',body:'옥상 누수',at:new Date().toISOString(),raw:{'공사 시기':'내년 봄','경쟁사':'없음','결정권자':'입대의 회장','대표회의':'2026-10-20'}}];G.deal=null;G.tab='today';G.sub={t:'inqAssigned',key:'q1'};render();});await page.waitForTimeout(250);
  assert.match(await txt('.mh-inq .sec-h'),/^필수 확인 4 \/ 6 빈 칸 2개$/);
  assert.deepEqual(await S.locator('.mh-inq .kv').allInnerTexts().then(l=>l.map(one)),['공사 시기 내년 봄','경쟁사 없음','요청 자료 미입력','결정권자 입대의 회장','대표회의 2026-10-20','자료 회신 기한 미입력']);
  /* ⑥d 단계 바꾸기 = PC 와 같은 전환창(필수 정보 · 전환일) */
  await page.evaluate(()=>{G.sub=null;G.deal='today1';G.tab='mine';render();nextSheet();});await page.waitForTimeout(250);
  await page.evaluate(()=>{const b=document.querySelector('#sheetcard .cchip');if(b)b.click();});await page.waitForTimeout(250);
  assert.match(await page.locator('#stage-transition-form').innerText().then(one),/전환일[\s\S]*확인할 정보/,'PC 와 같은 단계 전환 필수 정보 창');
  await page.evaluate(()=>{closeSheet();});
  /* ⑦ 끄기 */
  await page.evaluate(()=>{G.mobileHubOff=true;G.deal=null;G.tab='find';render();});await page.waitForTimeout(200);
  assert.equal(await S.locator('.mh-hub').count(),0);assert.equal(await txt('.mv-title h1'),'새 현장을 등록합니다');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('verify-mobile-hub: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
