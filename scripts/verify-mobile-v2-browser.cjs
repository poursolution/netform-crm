'use strict';
/* 모바일 v2 ① 디자인 규칙 검사(2026-10-02 핸드오프 mobile 1): 배경 · 흰 카드(선으로만 구분, 색띠 · 이모지 없음) · 문장 제목 · 글자 탭바(선택 = 검정 + 파란 점) · 헤더 연결 상태 알약.
   화면을 그리는 기존 함수와 저장은 그대로(쓰기 없음). 끄면 예전 모양 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html; charset=utf-8');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MobileV2&&typeof render==='function'&&typeof nav==='function'&&window.OperationalUI);
  await page.evaluate(()=>{window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;nav('today');});await page.waitForTimeout(400);
  const css=(sel,prop)=>page.evaluate(([s,p])=>{const n=document.querySelector(s);return n?getComputedStyle(n)[p]:null;},[sel,prop]);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('mv2')),true);
  /* 배경 · 카드 · 목록 */
  assert.equal(await css('.phone-body','backgroundColor'),'rgb(245, 246, 248)','배경 #f5f6f8');
  assert.equal(await css('.mt-list','borderRadius'),'20px','흰 카드 둥근 20');assert.equal(await css('.mt-list','backgroundColor'),'rgb(255, 255, 255)');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .mt-list>.mt-item')].filter(n=>getComputedStyle(n).display!=='none').every((n,i)=>{const s=getComputedStyle(n);return s.borderLeftWidth==='0px'&&s.borderRadius==='0px'&&(i===0?s.borderTopWidth==='0px':s.borderTopWidth==='1px');})),true,'줄 사이 얇은 선만 — 왼쪽 색띠 · 테두리 없음');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .ml-kind,#scr .mt-rank')].every(n=>getComputedStyle(n).display==='none')),true,'이모지 · 순번 없음');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .body>*')].every(n=>getComputedStyle(n).flexShrink==='0')),true,'카드 잘림 방지(flex:none)');
  /* 제목: 맥락 한 줄 + 숫자가 든 문장 */
  const remain=await page.evaluate(()=>Number(document.querySelector('#scr .mt-remain b').textContent));
  assert.match(await page.locator('#scr .mt-head h1').innerText(),new RegExp('님, 오늘 '+remain+'곳에 연락하면 됩니다$'));assert.match(await page.locator('#scr .mt-head p').innerText(),/^\d+월 \d+일 .요일/);
  assert.equal(await css('#scr .mt-head h1','fontSize'),'25px');assert.equal(await css('#scr .mt-head h1','fontWeight'),'700');
  assert.equal(await page.evaluate(()=>{const h=document.querySelector('#scr .mt-head h1').getBoundingClientRect(),p=document.querySelector('#scr .mt-head p').getBoundingClientRect();return p.bottom<=h.top+1;}),true,'맥락 줄이 제목 위');
  /* 탭바: 글자만 · 4칸 · 선택 = 검정 굵게 + 파란 점 */
  assert.deepEqual(await page.locator('#tabbar button .tl2').allInnerTexts(),['오늘','내 현장','등록','이번 주']);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#tabbar svg')].every(n=>getComputedStyle(n).display==='none')),true,'아이콘 없음');
  assert.equal(await css('#tabbar button.on .tl2','fontSize'),'14px');assert.equal(await css('#tabbar button.on .tl2','fontWeight'),'700');assert.equal(await css('#tabbar button.on','color'),'rgb(21, 23, 28)');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#tabbar button.on'),'::after').backgroundColor),'rgb(59, 108, 228)','파란 점');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#tabbar button')].every(b=>b.getBoundingClientRect().height>=44)),true,'누르는 영역 44 이상');
  /* ② 오늘: '지금 할 일' 남색 카드 + 시간 칸 */
  const now=page.locator('#scr .mv-now');assert.equal(await now.count(),1);assert.equal(await css('#scr .mv-now','backgroundColor'),'rgb(27, 35, 64)','남색 카드');
  const firstSite=await page.evaluate(()=>document.querySelector('#scr .mt-item.mv-first strong').textContent);
  assert.match(await now.innerText(),new RegExp('지금 할 일[\\s\\S]*'+firstSite.replace(/[[\]()]/g,'\\$&')+'[\\s\\S]*전화[\\s\\S]*자세히'));
  assert.equal(await css('#scr .mt-item.mv-first','display'),'none','카드로 올라간 곳은 목록에서 뺀다');assert.equal(await css('#scr .ml-hero','display'),'none');
  assert.match(await page.locator('#scr .mt-item:not(.mv-first) .ml-dpill').first().innerText(),/^늦음\s*\d+일$/,'왼쪽 시간 칸');
  assert.match(await page.locator('#scr .mt-head p').innerText(),/요일 · 기한 지남 \d+/);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .mv-now button')].every(b=>b.getBoundingClientRect().height>=48)),true,'버튼 높이 48 이상');
  /* [전화] → 기존 결과 시트(아래에서 올라옴) → 고르면 기존 저장 경로 */
  await now.locator('[data-mv="call"]').click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#sheetwrap.on, #sheetwrap.open, .sheet.on, .sheet.open').count()>0||await page.evaluate(()=>document.getElementById('sheetcard').innerHTML.length>50),true,'결과 시트');
  assert.equal(await page.locator('#sheetcard .cchip').count(),3,'결과는 기존 3가지');assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#sheetcard .cchip')].every(b=>getComputedStyle(b).backgroundColor==='rgb(255, 255, 255)'&&b.getBoundingClientRect().height>=48)),true,'흰 줄 · 높이 48 이상');
  if(shot)await page.screenshot({path:shot+'-sheet.png'});
  await page.evaluate(()=>closeSheet());await page.waitForTimeout(200);
  /* [자세히] → 상세: 아래 고정 [전화] [결과 남기기] · 이모지 없음 */
  await now.locator('[data-mv="open"]').click();await page.waitForTimeout(400);
  assert.ok(await page.evaluate(()=>!!G.deal),'상세로 이동');
  const dock=page.locator('#scr .mv-dock');assert.deepEqual(await dock.locator('button').allInnerTexts(),['전화','결과 남기기']);assert.equal(await css('#scr .mv-dock','position'),'sticky');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr button,#scr .ml-support-link')].some(b=>/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test([...b.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue).join('')))),false,'버튼에 이모지 없음');
  /* 캘린더: 다음 할 일을 .ics 로 */
  assert.equal(await page.locator('#scr .mv-ics').innerText(),'휴대폰 캘린더에 넣기');
  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){window.__dl=(window.__dl||[]).concat([this.download]);};});await page.locator('#scr .mv-ics').click();
  const ics=await page.evaluate(()=>window.__mvIcs);assert.match(ics,/^BEGIN:VCALENDAR\r\nVERSION:2\.0[\s\S]*BEGIN:VEVENT[\s\S]*DTSTART;VALUE=DATE:\d{8}\r\nDTEND;VALUE=DATE:\d{8}\r\nSUMMARY:[\s\S]*END:VEVENT\r\nEND:VCALENDAR$/);
  assert.match((await page.evaluate(()=>window.__dl))[0],/^netform-\d{4}-\d{2}-\d{2}\.ics$/);
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  await page.evaluate(()=>{window.__dc=0;const o=dealCallSheetM;dealCallSheetM=function(){__dc++;return o.apply(this,arguments)};});await dock.locator('[data-mv="result"]').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__dc),1,'결과 남기기 = 기존 함수');
  /* 남길 말: 말하면 글자로, 통화 기록 뒤에 붙어 저장 요청에 실린다(실제 전송 없음 — 대기열을 가짜로) */
  await page.evaluate(()=>{window.SpeechRecognition=class{start(){setTimeout(()=>{this.onresult({resultIndex:0,results:[Object.assign([{transcript:'소장님 다음 주 화요일 방문 확정'}],{isFinal:true})]});this.onend();},50);}stop(){this.onend();}};});
  await page.evaluate(()=>{closeSheet();dealCallSheetM();});await page.waitForTimeout(250);
  await page.locator('#sheetcard .ml-chip[data-chip="ongoing"]').click();assert.equal(await page.locator('#sheetcard .ml-mic').innerText(),'말하기');assert.equal(await page.locator('#sheetcard .ml-note').isVisible(),false,'약속 칸은 약속을 골랐을 때만');
  await page.locator('#sheetcard .ml-mic').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#sheetcard .ml-say textarea').inputValue(),'소장님 다음 주 화요일 방문 확정');
  if(shot)await page.screenshot({path:shot+'-say.png'});
  const sent=await page.evaluate(async()=>{const ops=[],ids=[];const oq=window.queueMobileContactOperation,P=window.Phase1,of=P.queue.flush,ol=P.queue.list;let ok=true;
   try{window.queueMobileContactOperation=(op,p)=>{const id='t'+ids.length;ids.push(id);ops.push([op,p]);return id;};P.queue.flush=async()=>{};P.queue.list=()=>ids.map(id=>({request_id:id,status:'done',ack:{ok:true,activity_id:'act-'+id,next_action_id:'na-'+id}}));}catch(e){ok=false;}
   if(P.queue.flush===of)ok=false;
   if(ok){document.querySelector('#sheetcard .ml-date[data-date]').click();await new Promise(r=>setTimeout(r,400));}
   try{window.queueMobileContactOperation=oq;P.queue.flush=of;P.queue.list=ol;}catch(e){}
   return {ok,ops};});
  assert.equal(sent.ok,true);{const act=sent.ops.find(x=>x[0]==='activity');assert.match(act[1].note,/^통화 완료 · 진행 중 \(\d+\/\d+ 다시 확인\) — 소장님 다음 주 화요일 방문 확정$/);}
  await page.waitForTimeout(800);
  await page.evaluate(()=>{closeSheet();nav('today');});await page.waitForTimeout(300);
  /* 헤더: 로고 · 연결 상태 알약 · 알림 */
  assert.equal(await page.locator('#scr .home-bar .mv-status').innerText(),'예시 데이터');
  await page.evaluate(()=>{LIVE=true;render();});assert.equal(await page.locator('#scr .home-bar .mv-status.ok').innerText(),'연결됨');
  await ctx.setOffline(true);await page.evaluate(()=>MobileV2.apply());assert.match(await page.locator('#scr .home-bar .mv-status.bad').innerText(),/^오프라인/);await ctx.setOffline(false);await page.evaluate(()=>MobileV2.apply());
  await page.evaluate(()=>{LOAD_ERR='x';MobileV2.apply();});assert.equal(await page.locator('#scr .home-bar .mv-status.bad').innerText(),'연결 안 됨');await page.evaluate(()=>{LOAD_ERR=null;LIVE=false;render();});
  assert.equal(await css('#scr .home-bar .hb-status','display'),'none');assert.equal(await page.locator('#scr .home-bar [aria-label="알림함"]').count(),1);
  if(shot)await page.screenshot({path:shot+'-today.png'});
  /* 다른 탭도 같은 규칙 · 탭 이동은 기존 그대로 */
  await page.locator('#tabbar button',{hasText:'내 현장'}).click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>G.tab),'mine');assert.match(await page.locator('#scr .sec-h h2').first().innerText(),/^내 현장 \d+곳$/);assert.equal(await css('#scr .sec-h h2','fontSize'),'25px');assert.equal(await css('#scr .card','borderTopWidth'),'0px');assert.equal(await css('#scr .card','borderRadius'),'20px');
  if(shot)await page.screenshot({path:shot+'-mine.png'});
  await page.locator('#tabbar button',{hasText:'이번 주'}).click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>G.tab),'my');assert.match(await page.locator('#scr .mv-title h1').innerText(),/님, 오늘 \d+곳 중 \d+곳을 처리했습니다$/);assert.match(await page.locator('#scr .mv-title p').innerText(),/^이번 주/);if(shot)await page.screenshot({path:shot+'-week.png'});
  await page.locator('#tabbar button',{hasText:'등록'}).click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>G.tab),'find');assert.equal(await page.locator('#scr .mv-title h1').innerText(),'새 현장을 등록합니다');assert.match(await page.locator('#scr button[onclick="scanCard()"]').innerText(),/명함 · 현수막 찍기/);if(shot)await page.screenshot({path:shot+'-new.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'가로 넘침 없음');
  assert.deepEqual(await page.evaluate(()=>__writes.filter(x=>x!=='opportunity_touch')),[],'틀만 바꾼다 — 쓰기 없음');
  /* 관리자 한마디: PC에서 남긴 코멘트가 그 영업사원의 오늘에만(완료 · 7일 지난 것 · 남의 것은 안 보임) */
  const word=async rows=>{await page.evaluate(r=>{G.mode='rep';G.tab='today';G.deal=null;G.sub=null;BUNDLE=Object.assign({},BUNDLE||{},{rep_manager_comments:r.map(x=>Object.assign({rep_name:x.other?'다른사람':G.user.nm,created_by:'송보람',updated_at:new Date(Date.now()-(x.days||0)*864e5).toISOString()},x))});render();},rows);await page.waitForTimeout(250);return page.locator('#scr .mv-word').count();};
  assert.equal(await word([{comment:'이번 주 조원주공 견적 먼저 챙겨 주세요',status:'open'}]),1);
  assert.match(await page.locator('#scr .mv-word').innerText(),/관리자 한마디 · 송보람 · \d+\/\d+\s+이번 주 조원주공 견적 먼저 챙겨 주세요/);
  if(shot)await page.screenshot({path:shot+'-word.png'});
  assert.equal(await word([{comment:'끝난 것',status:'done'}]),0);assert.equal(await word([{comment:'오래된 것',status:'open',days:9}]),0);assert.equal(await word([{comment:'남의 것',status:'open',other:true}]),0);
  /* ④ 관리: 탭 4칸(오늘 / 파이프라인 / 사람 / 보고) · 문의 관리는 오늘 안에서 */
  await page.evaluate(()=>{G.mode='admin';G.tab='today';G.deal=null;G.sub=null;render();});await page.waitForTimeout(300);
  assert.deepEqual(await page.locator('#tabbar button:not([hidden]) .tl2').allInnerTexts(),['오늘','파이프라인','사람','보고']);
  assert.match(await page.locator('#scr .mt-head h1').first().innerText(),/님, 지금 챙길 곳이 (\d+건입니다|없습니다)$/);
  /* 팀 연락 기록: 오늘 저장된 결과 수(0건은 빨강) */
  assert.match(await page.locator('#scr .mv-team').innerText(),/오늘 팀 연락 기록[\s\S]*오늘 기록이 저장된 현장 수/);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#scr .mv-tr')].every(r=>(/0곳/.test(r.textContent))===!!r.querySelector('span.r'))),true);
  await page.evaluate(()=>{DEALS.filter(x=>x.rep==='이필선').forEach(x=>{x.activities=[];x.last_activity_at=x.lastActivity=x.last_customer_contact_at=x.last_meaningful_contact_at=x.lastMeaningfulContactAt=x.last_worked_at=null;});const d=DEALS.find(x=>x.rep==='이필선');d.activities=(d.activities||[]).concat([{type:'전화',note:'통화',at:new Date().toISOString()}]);render();});await page.waitForTimeout(200);
  assert.match(await page.locator('#scr .mv-tr',{hasText:'이필선'}).innerText(),/오늘 1곳/);
  assert.match(await page.locator('#scr .mv-ctrl').innerText(),/문의 관리[\s\S]*열기/);await page.locator('#scr .mv-ctrl').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>G.tab),'ctrl');assert.equal(await page.locator('#tabbar button.on:not([hidden]) .tl2').innerText(),'오늘','문의 관리에서도 오늘 탭이 선택된 것으로');
  if(shot)await page.screenshot({path:shot+'-admin.png'});
  await page.evaluate(()=>{const n=new Date(),today=n.toLocaleDateString('en-CA');DEALS.push({id:901,nm:'시험 수주',rep:'이필선',code:'won',outcome:'won',won_amount:3e8,amt:3e8,won_at:today},{id:902,nm:'시험 실주',rep:'이필선',code:'lost',outcome:'lost',amt:1e8,closed_at:today},{id:903,nm:'날짜 없는 실주',rep:'이필선',code:'lost',outcome:'lost',amt:9e8});});
  await page.locator('#tabbar button',{hasText:'사람'}).click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>G.tab),'perf');
  assert.deepEqual(await page.locator('#scr .mv-ph span').allInnerTexts(),['담당','만든 돈','놓친 돈','성공률']);
  assert.match(await page.locator('#scr .mv-pr',{hasText:'이필선'}).innerText(),/이필선[\s\S]*3억\s*1억\s*50%\s*1\/2/,'만든 돈 · 놓친 돈 · 성공률(날짜 없는 건은 세지 않는다)');
  assert.match(await page.locator('#scr .mv-people h1').innerText(),/이번 달 1명이 돈을 만들었습니다/);
  if(shot)await page.screenshot({path:shot+'-people.png'});
  await page.locator('#tabbar button',{hasText:'보고'}).click();await page.waitForTimeout(250);assert.match(await page.locator('#scr .mv-pcnote').innerText(),/대표님 보고 · 주간 브리핑[\s\S]*PC 화면/);
  await page.evaluate(()=>{G.mode='rep';});
  /* 끄기 */
  await page.evaluate(()=>{G.mobileV2Off=true;nav('today');});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('mv2')),false);assert.deepEqual(await page.locator('#tabbar button .tl2').allInnerTexts(),['오늘','내 영업','영업 등록','내 실적'],'끄면 예전 탭 이름');
  assert.equal(await page.locator('#scr .mt-head h1').innerText(),'오늘 우선순위');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',background_cards:true,list_lines_only:true,sentence_title:true,text_tabbar_dot:true,header_status_pill:true,no_writes:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
