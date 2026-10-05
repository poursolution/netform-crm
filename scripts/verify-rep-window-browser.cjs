'use strict';
/* 영업사원 관리 · 사람 창 v2 검사(2026-10-04 design_handoff_rep_window · 영업사원 관리 창 v2.dc.html)
   머리(이름 · 소속 · 상태 꼬리표 + 숫자 4개) / 왼쪽(가장 큰 병목 한 문장 → 흐름 + 가장 많이 빠지는 구간 → 이번 주 코칭 · 한 가지 → 지난 코칭 · 이번 주 결과) / 오른쪽(손볼 건: 사유별 묶음 · 금액 큰 순 5건 + 전체 보기 · 일괄 요청 1개)
   숫자는 전부 자료에서 계산. 코칭 저장 · 일괄 요청은 기존 '주간 관리자 한마디'(rep_manager_comment) 한 길 — 새 저장소 없음. 끄면 예전 사람별 창. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.RepWindow&&window.RepsB&&window.StageBoard&&window.RepsV2&&window.BriefB&&window.CRMRules&&typeof paintRepManagement==='function');
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00';
   const deal=(id,site,amt,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:'2026-07-01',updated:'2026-08-01',code:'sent',stage_code:'sent',grp:'영업·관리',amt},extra||{});
   const lost=n=>deal('l'+n,'실주 현장 '+n,1e8,{code:'lost',stage_code:'lost',outcome:'lost',grp:'수주 실패',closed_at:T('2026-09-12'),closed:'2026-09-12',stage_contexts:{lost:{fields:{close_reason:'가격 · 가격 경쟁',close_detail:'확인'}}}});
   const inq=(n,at,extra)=>Object.assign({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site:'신규 문의 '+n,status:'배정완료',at,created_at:at,brand:'POUR솔루션',assignee:'이필선',assigned_to:'이필선',assigned_at:at},extra||{});
   const live={created:'2026-10-15',updated:'2026-10-20',code:'compete',stage_code:'compete',activities:[{id:'a1',type:'전화',note:'통화',at:T('2026-10-20')}]};
   B={deals:[deal('n1','강동 롯데캐슬퍼스트',23e8),deal('n2','아시아선수촌아파트',6.8e8),deal('n3','[경기 양주] 양주자이1단지',5.5e8),deal('n4','대한제분(공장)',4.9e8),deal('n5','[경기 의정부] 산들마을2단지',4.3e8),deal('n6','작은 현장',2e8),deal('n7','금액 없는 현장',0),
     deal('o1','[경기 용인] 자봉마을써니밸리',7e8,{next_action:{id:'x1',text:'견적 확인',due:'2026-09-21',status:'open'}}),
     deal('o2','[전북 군산] 미룡주공2단지',3.4e8,{next_action:{id:'x2',text:'재통화',due:'2026-10-09',status:'open'}}),
     deal('s1','오래 머문 현장',2e8,{next_action:{id:'x3',text:'안부 연락',due:'2026-10-28',status:'open'}}),
     deal('k1','정상 현장',5e8,Object.assign({},live,{next_action:{id:'x4',text:'PT 준비',due:'2026-10-24',status:'open'}})),
     Object.assign(deal('h1','황윤선 현장',5e8,Object.assign({},live,{next_action:{id:'x5',text:'PT 준비',due:'2026-10-24',status:'open'}})),{assignee:'황윤선'})].concat([1,2,3,4,5,6,7,8,9].map(lost)),
    inquiries:[inq(1,T('2026-10-18')),inq(2,T('2026-10-19')),inq(3,T('2026-10-20')),inq(4,'2026-10-13T09:00:00+09:00',{status:'상담중',responded_at:'2026-10-13T15:48:00+09:00'})],activities:[],inquiryTrash:[],expansion_pool:[],
    rep_manager_comments:[{rep_name:'이필선',week_start:'2026-10-12',comment:'[코칭 · 다음 행동] 이번 주 금액 큰 10건부터 다음 할 일 · 날짜 등록 (다음 할 일 등록률 20% → 60%)\n· [요청] 날짜 다시 잡기 요청 — 다음 할 일 날짜 지남 2건',status:'open',created_by:'송보람',updated_at:'2026-10-14T09:00:00+09:00'}]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,JSON.parse(JSON.stringify(p))]);return 'req';};
   const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};
   window.__open=null;window.__openInq=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};drwInq=s=>{window.__openInq=JSON.parse(s).site;};
   window.__toasts=[];window.toast=m=>{__toasts.push(String(m));};
   /* 계약실적 원장(직접 수주 11건)만 흉내 — 메이드율 식은 화면 것 그대로: 11 ÷ (11 + 실주 9) */
   BriefB.lib.ledger=()=>({ready:true});BriefB.lib.contractsIn=(L,a,b,n)=>({count:n==='이필선'?11:0,net:0});
   goPage('repmanage');
  });
  await page.waitForTimeout(400);
  /* 1. 목록에서 사람을 누르면 새 창(예전 창은 뜨지 않음) */
  await page.locator('#reps-b .psb-row[data-key="이필선"] .l').click();await page.waitForTimeout(250);
  const w=page.locator('#repWindow.on .rw-box');assert.equal(await w.count(),1,'새 사람 창');assert.equal(await page.locator('#repsDialog.on').count(),0,'예전 창은 열리지 않음');
  assert.deepEqual(await w.evaluate(n=>{const s=getComputedStyle(n),b=getComputedStyle(n.querySelector('.rw-body'));return [s.maxWidth,s.borderTopLeftRadius,b.gridTemplateColumns.split(' ')[0]];}),['1640px','16px','320px']);
  /* 창 크기 = 상세 창과 같은 기준(가로 1640 한도 · 세로 화면 − 32) · 머리 고정 · 좌우 칸 각자 스크롤 */
  assert.deepEqual(await w.evaluate(n=>{const r=n.getBoundingClientRect(),l=n.querySelector('.rw-left'),g=n.querySelector('.rw-right');return [Math.round(r.width),Math.round(r.height),Math.round(r.top),getComputedStyle(l).overflowY,getComputedStyle(g).overflowY,n.querySelector('.rw-body').getBoundingClientRect().bottom<=r.bottom+1];}),[1568,968,16,'auto','auto',true],'창 크기');
  /* 2. 머리: 이름 · 소속 · 상태 꼬리표 + 숫자 4개 */
  assert.equal(await w.locator('.rw-who').innerText().then(s=>s.replace(/\s+/g,' ')),'이필선 본사 영업 관리자 확인 필요');
  assert.deepEqual(await w.locator('.rw-who em').evaluate(n=>[getComputedStyle(n).color,getComputedStyle(n).backgroundColor]),['rgb(180, 35, 24)','rgb(253, 236, 236)']);
  assert.deepEqual(await w.locator('.rw-kpi').evaluateAll(l=>l.map(n=>[n.children[0].textContent,n.children[1].textContent,getComputedStyle(n.children[1]).color])),[['진행 금액','63.9억','rgb(21, 23, 28)'],['손볼 건','13건','rgb(180, 35, 24)'],['메이드율','55.0%','rgb(21, 23, 28)'],['업무량','관리 부하','rgb(180, 83, 9)']]);
  /* 3. 왼쪽: 병목 한 문장 + 보조 한 줄 → 흐름 + 가장 많이 빠지는 구간 */
  assert.deepEqual(await w.locator('.rw-neck').evaluate(n=>[[...n.children].map(c=>c.textContent),getComputedStyle(n).backgroundColor]),[['가장 큰 병목','진행 11건 중 7건이 다음 할 일 없음','신규 배정 3건도 아직 첫 연락 전'],'rgb(253, 236, 236)']);
  assert.deepEqual(await w.locator('.rw-fl').evaluateAll(l=>l.map(n=>[n.children[0].textContent,n.children[2].textContent,n.querySelector('u').style.width,getComputedStyle(n.querySelector('u')).backgroundColor])),[['배정','4','20%','rgb(59, 108, 228)'],['응대','1','5%','rgb(59, 108, 228)'],['기회','20','100%','rgb(59, 108, 228)'],['경쟁','1','5%','rgb(59, 108, 228)'],['수주','0','0%','rgb(63, 179, 127)']]);
  assert.equal(await w.locator('.rw-drop').innerText(),'기회 → 경쟁에서 가장 많이 빠짐 (20 → 1)');
  /* 4. 이번 주 코칭 · 한 가지: 병목에 맞는 주제가 먼저 골라져 있고, 근거 숫자 + 약속 문장이 채워져 있다 */
  const co=w.locator('.rw-co');
  assert.equal(await co.locator(':scope>b').innerText(),'이번 주 코칭 · 한 가지');
  assert.deepEqual(await co.locator('.rw-chips button').evaluateAll(l=>l.map(n=>[n.textContent,n.getAttribute('aria-pressed'),getComputedStyle(n).backgroundColor])),[['첫 응대','false','rgb(255, 255, 255)'],['다음 행동','true','rgb(21, 23, 28)'],['견적 지연','false','rgb(255, 255, 255)'],['약속 미이행','false','rgb(255, 255, 255)']]);
  const ai=()=>co.locator('.rw-ai').innerText().then(s=>s.replace(/\s+/g,' ')),txt=()=>co.locator('[data-rw-f="promise"]').inputValue();
  assert.equal(await ai(),'AI진행 11건 중 7건 다음 할 일 없음 (등록률 36%)');assert.equal(await co.locator('.rw-ai b').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(59, 108, 228)');
  assert.equal(await txt(),'이번 주 금액 큰 7건부터 다음 할 일 · 날짜 등록');
  assert.equal(await co.locator('.rw-cof').innerText().then(s=>s.replace(/\s+/g,' ')),'다음 주 월요일 결과 자동 확인 코칭 저장');
  await co.locator('.rw-chips button',{hasText:'첫 응대'}).click();assert.equal(await ai(),'AI신규 배정 3건 · 평균 첫 연결 6.8시간');assert.equal(await txt(),'금요일까지 신규 배정 3건 첫 연락 완료');
  await co.locator('.rw-chips button',{hasText:'견적 지연'}).click();assert.equal(await ai(),'AI미팅 완료 건이 없어 아직 잴 수 없음','없는 숫자는 만들지 않는다');assert.equal(await txt(),'방문 후 3일 안에 견적 요청 등록');
  await page.evaluate(()=>{KpiB.stageItems=()=>[{stage:'consulting',bucket:'done',rs:['nodue'],stall:4,row:{item:{assignee:'이필선'}}},{stage:'consulting',bucket:'done',rs:[],stall:1,row:{item:{assignee:'이필선'}}},{stage:'consulting',bucket:'done',rs:['nodue'],stall:9,row:{item:{assignee:'황윤선'}}}];});
  await co.locator('.rw-chips button',{hasText:'약속 미이행'}).click();assert.equal(await ai(),'AI약속 4건 중 2건 기한 내 (50%)');assert.equal(await txt(),'기한 지난 약속 2건 이번 주 안에 완료 · 날짜 다시 잡기');
  await co.locator('.rw-chips button',{hasText:'견적 지연'}).click();assert.equal(await ai(),'AI방문 후 견적 요청 없이 평균 4일 · 미팅 완료 2건 중 1건','관리팀 KPI와 같은 건');
  /* 5. 지난 코칭 · 이번 주 결과(전 → 후): 지난주에 남긴 지표를 지금 값으로 다시 잰다 */
  assert.deepEqual(await w.locator('.rw-past').evaluate(n=>[[...n.children].map(c=>c.textContent.replace(/\s+/g,' ')),getComputedStyle(n.querySelector('.rw-res b')).color]),[['지난 코칭','"다음 할 일 등록률 20% → 60%" · 10.14','이번 주 결과20% → 36%'],'rgb(180, 83, 9)'],'나아졌지만 목표 전 = 주황');
  /* 6. 오른쪽: 사유별 묶음 — 제목에 사유 · 건수 · 걸린 금액 · 일괄 요청 1개 · 첫 묶음만 펼침 · 금액 큰 순 5건 */
  assert.equal(await w.locator('.rw-rh').innerText().then(s=>s.replace(/\s+/g,' ')),'지금 처리할 현장 13건 사유별로 묶음 · 금액 큰 순');
  const heads=()=>w.locator('.rw-gh').evaluateAll(l=>l.map(n=>[...n.children].filter(c=>!c.classList.contains('rw-sp')).map(c=>c.textContent)));
  assert.deepEqual(await heads(),[['다음 할 일 없음','7건','진행 46.5억','다음 할 일 등록 요청','접기 ▴'],['다음 할 일 날짜 지남','2건','진행 10.4억 · 최장 30일','날짜 다시 잡기 요청','보기 ▾'],['신규 배정 · 첫 연락 전','3건','금액 미정','첫 연락 요청','보기 ▾'],['30일 넘게 같은 단계','1건','진행 2억','진행 · 보류 정리 요청','보기 ▾']]);
  assert.deepEqual(await w.locator('.rw-gh').evaluateAll(l=>l.map(n=>getComputedStyle(n.children[1]).color)),['rgb(180, 35, 24)','rgb(180, 83, 9)','rgb(180, 35, 24)','rgb(180, 83, 9)']);
  assert.equal(await w.locator('.rw-gh').first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(250, 251, 252)');
  const rows=k=>w.locator('.rw-g[data-g="'+k+'"] .rw-row').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent)));
  assert.deepEqual(await rows('nonext'),[['강동 롯데캐슬퍼스트','날짜 없음','23억','열기'],['아시아선수촌아파트','날짜 없음','6.8억','열기'],['[경기 양주] 양주자이1단지','날짜 없음','5.5억','열기'],['대한제분(공장)','날짜 없음','4.9억','열기'],['[경기 의정부] 산들마을2단지','날짜 없음','4.3억','열기']]);
  assert.equal(await w.locator('.rw-row').first().evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').slice(1).join(' ')),'90px 60px 52px');
  if(shot)await page.screenshot({path:shot+'-window.png'});
  await w.locator('.rw-g[data-g="nonext"] [data-rw="all"]').click();assert.equal(await w.locator('.rw-g[data-g="nonext"] .rw-row').count(),7,'나머지 전체 보기');assert.deepEqual((await rows('nonext'))[6],['금액 없는 현장','날짜 없음','-','열기']);
  await w.locator('.rw-g[data-g="overdue"] [data-rw="toggle"]').click();assert.deepEqual(await rows('overdue'),[['[경기 용인] 자봉마을써니밸리','30일 지남','7억','열기'],['[전북 군산] 미룡주공2단지','12일 지남','3.4억','열기']]);
  await w.locator('.rw-g[data-g="first"] [data-rw="toggle"]').click();assert.deepEqual((await rows('first')).map(r=>r.slice(1)),[['배정 후 미연락','-','열기'],['배정 후 미연락','-','열기'],['배정 후 미연락','-','열기']]);
  await w.locator('.rw-g[data-g="nonext"] [data-rw="toggle"]').click();assert.equal(await w.locator('.rw-g[data-g="nonext"] .rw-row').count(),0);assert.equal((await heads())[0][4],'보기 ▾');
  /* 7. 코칭 저장 = 기존 주간 관리자 한마디 한 줄(주제 · 약속 · 지표 전 → 목표) */
  await co.locator('.rw-chips button',{hasText:'다음 행동'}).click();
  await co.locator('[data-rw="save"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>__writes.map(x=>[x[0],x[1].rep_name,x[1].week_start,x[1].comment,x[1].status,x[1].created_by])),[['rep_manager_comment','이필선','2026-10-19','[코칭 · 다음 행동] 이번 주 금액 큰 7건부터 다음 할 일 · 날짜 등록 (다음 할 일 등록률 36% → 100%)','open','송보람']]);
  assert.deepEqual(await page.evaluate(()=>__toasts.slice(-1)),['이필선 · 이번 주 코칭을 저장했습니다 · 다음 주 월요일에 결과가 보입니다']);
  assert.equal(await page.locator('#repWindow.on .rw-cof>span').innerText(),'저장됨 10.21 · 월요일 자동 확인');assert.equal(await page.locator('#repWindow.on .rw-cof>span').evaluate(n=>n.getClientRects().length),1,'한 줄');
  assert.doesNotMatch(await page.locator('#reps-b .psb-row[data-key="이필선"]').innerText(),/이번 주 코칭 약속 없음/,'목록의 사유도 같이 사라진다');
  /* 주제를 바꿔 다시 저장하면 한 사람에 한 가지 — 앞의 코칭 줄을 바꾼다. 약속 문장은 고쳐 쓸 수 있다 */
  await co.locator('.rw-chips button',{hasText:'첫 응대'}).click();await co.locator('[data-rw-f="promise"]').fill('목요일까지 신규 배정 3건 첫 연락 완료');await co.locator('[data-rw="save"]').click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>__writes.slice(-1)[0][1].comment),'[코칭 · 첫 응대] 목요일까지 신규 배정 3건 첫 연락 완료 (첫 연락 전 3건 → 0건)');
  assert.deepEqual(await co.locator('.rw-chips button[aria-pressed="true"]').allInnerTexts(),['첫 응대']);assert.equal(await txt(),'목요일까지 신규 배정 3건 첫 연락 완료');
  /* 8. 일괄 요청 = 같은 한마디에 한 줄 추가 → 담당자 오늘 업무에 뜬다 · 묶음마다 한 번 */
  await page.evaluate(()=>{window.__kpi=[];const o=OpsStore,has=o.has.bind(o),rpc=o.rpc.bind(o);o.has=n=>n==='crm_kpi_action_log_v1'||has(n);o.rpc=(n,p)=>n==='crm_kpi_action_log_v1'?(__kpi.push(p),Promise.resolve({ok:true})):rpc(n,p);});
  await w.locator('.rw-g[data-g="nonext"] [data-rw="bulk"]').click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>__writes.slice(-1)[0][1].comment),'[코칭 · 첫 응대] 목요일까지 신규 배정 3건 첫 연락 완료 (첫 연락 전 3건 → 0건)\n· [요청] 다음 할 일 등록 요청 — 다음 할 일 없음 7건 · 진행 46.5억');
  assert.deepEqual(await page.evaluate(()=>__kpi),[{promise_key:'kpi:3',action:'등록 요청',target_type:'person',target_id:'이필선',target_name:'이필선',note:'다음 할 일 없음 7건'}],'관리팀 KPI 3번의 같은 요청으로도 남는다');
  assert.deepEqual(await w.locator('.rw-g[data-g="nonext"] .rw-bulk').evaluate(n=>[n.textContent,n.disabled]),['요청함',true]);
  assert.deepEqual(await page.evaluate(()=>__toasts.slice(-1)),['이필선 오늘 업무에 요청을 남겼습니다 · 다음 할 일 등록 요청']);
  await w.locator('.rw-g[data-g="first"] [data-rw="bulk"]').click();await page.waitForTimeout(250);
  assert.match(await page.evaluate(()=>__writes.slice(-1)[0][1].comment),/\n· \[요청\] 다음 할 일 등록 요청 — [^\n]+\n· \[요청\] 첫 연락 요청 — 신규 배정 · 첫 연락 전 3건$/);assert.equal(await page.evaluate(()=>__kpi.length),1);
  /* 코칭을 다시 저장해도 요청 줄은 남는다 */
  await co.locator('[data-rw="save"]').click();await page.waitForTimeout(250);
  assert.match(await page.evaluate(()=>__writes.slice(-1)[0][1].comment),/^\[코칭 · 첫 응대\] [^\n]+\n· \[요청\] 다음 할 일 등록 요청 — [^\n]+\n· \[요청\] 첫 연락 요청 — [^\n]+$/);
  if(shot)await page.screenshot({path:shot+'-saved.png'});
  /* 9. 줄의 [열기] = 그 현장 상세(창은 닫힘) · 문의는 문의 상세 */
  await w.locator('.rw-g[data-g="overdue"] .rw-row a').first().click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__open),'o1');assert.equal(await page.locator('#repWindow.on').count(),0);
  await page.evaluate(()=>RepsV2.open('이필선'));await page.waitForTimeout(200);
  await page.locator('#repWindow .rw-g[data-g="first"] [data-rw="toggle"]').click();await page.locator('#repWindow .rw-g[data-g="first"] .rw-row a').first().click();await page.waitForTimeout(200);
  assert.match(await page.evaluate(()=>window.__openInq),/^신규 문의 \d$/);assert.equal(await page.locator('#repWindow.on').count(),0);
  /* 10. 목록의 [코칭 약속] = 창 + 약속 칸 포커스 · Esc 닫기 · 손볼 건이 없는 사람 */
  await page.locator('#reps-b .psb-row[data-key="황윤선"] .l').click();await page.waitForTimeout(250);
  assert.match(await page.locator('#repWindow.on .rw-who').innerText().then(s=>s.replace(/\s+/g,' ')),/^황윤선 본사 영업 · 상무 /,'소속 · 직함(대표 지정)');
  assert.deepEqual(await page.evaluate(()=>['이필선','김성민','정정훈','한준엽','조재연','조현식','황윤선','이승우','송보람','전용성'].map(n=>repProfile(n).title||'')),['본사영업','본사영업','본사영업','팀장','팀장','이사','상무','대표','영업관리','']);
  await page.evaluate(()=>RepsV2.open('한준엽'));await page.waitForTimeout(150);assert.match(await page.locator('#repWindow.on .rw-who').innerText().then(s=>s.replace(/\s+/g,' ')),/^한준엽 본사 영업 · 팀장 /);
  await page.evaluate(()=>RepsV2.open('황윤선'));await page.waitForTimeout(150);
  assert.deepEqual(await page.locator('#repWindow.on .rw-neck').evaluate(n=>[[...n.children].map(c=>c.textContent)[1],n.classList.contains('ok'),getComputedStyle(n).backgroundColor]),['지금 막힌 곳이 없습니다',true,'rgb(232, 246, 238)']);
  assert.equal(await page.locator('#repWindow.on .rw-none').innerText(),'지금 손볼 건이 없습니다.');assert.equal(await page.locator('#repWindow.on .rw-rh b').innerText(),'지금 처리할 현장 0건');
  assert.equal(await page.locator('#repWindow.on .rw-past .none').innerText(),'아직 없습니다 · 저장하면 다음 주 월요일부터 결과가 보입니다');
  assert.equal(await page.locator('#repWindow.on .rw-kpi').nth(2).locator('b').innerText(),'–','마감한 건이 없으면 메이드율은 비운다');
  await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(await page.locator('#repWindow.on').count(),0);
  await page.evaluate(()=>{RepsV2.open('이필선');});await page.waitForTimeout(150);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#repWindow .rw-box').scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  if(shot)await page.screenshot({path:shot+'-narrow.png'});
  await page.setViewportSize({width:1600,height:1000});await page.keyboard.press('Escape');await page.waitForTimeout(150);
  await page.locator('#reps-b .psb-row[data-key="이필선"] [data-sb="act"]').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>!!document.activeElement&&document.activeElement.matches('#repWindow.on [data-rw-f="promise"]')),true,'목록의 [코칭 약속] → 새 창의 약속 칸에 포커스');
  await page.keyboard.press('Escape');await page.waitForTimeout(150);
  /* 순수 함수: 코칭 줄 쓰고 읽기 */
  assert.deepEqual(await page.evaluate(()=>[RepWindow.parse('[코칭 · 약속 미이행] 현재 양호 · 유지 (약속 기한 내 85% 유지)'),RepWindow.parse('금요일까지 첫 연락 완료\n· [KPI 요청] 다음 할 일 등록률 — 이필선'),RepWindow.parse('· [요청] 첫 연락 요청 — 3건'),RepWindow.coachLine({l:'견적 지연',m:{l:'방문 후 3일 견적',u:'%',v:null,to:null}},'방문 후 3일 안에 견적 요청 등록')]),
   [{topic:'약속 미이행',txt:'현재 양호 · 유지',m:{l:'약속 기한 내',from:85,u:'%',to:85}},{free:'금요일까지 첫 연락 완료'},null,'[코칭 · 견적 지연] 방문 후 3일 안에 견적 요청 등록']);
  /* 11. 끄기 → 예전 사람별 창 */
  await page.evaluate(()=>{G.repWindowOff=true;RepsV2.open('이필선');});await page.waitForTimeout(200);
  assert.equal(await page.locator('#repsDialog.on .rd-box').count(),1);assert.equal(await page.locator('#repWindow.on').count(),0);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',opens_new_window:true,head_four_numbers:true,bottleneck_sentence:true,flow_and_drop:true,coaching_one_topic_prefilled:true,no_invented_numbers:true,past_coaching_result:true,groups_by_reason_top5:true,coaching_saved_existing_path:true,bulk_request_once:true,row_opens_detail:true,empty_person:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
