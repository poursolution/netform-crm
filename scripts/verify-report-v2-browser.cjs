'use strict';
/* 리포트 v2 검사(2026-10-02 핸드오프 report): 슬라이드 8장(← → 키 · 점 · 진행 막대) + 한 페이지 + 월간/분기/연간 + 편집(저장 안 함) + 상세 표(기존 화면) + PDF 준비.
   집계는 기존 리포트 함수 · 계약 체결일 기준. 응답 · 보내기는 저장소 설치 전이라 잠김. 쓰기 없음. 끄면 예전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ReportV2&&window.ShellV2&&typeof paintReport==='function');
  await page.evaluate(()=>{
   const ymd=d=>d.toLocaleDateString('en-CA'),n=new Date(),today=ymd(n),prevMonth=ymd(new Date(n.getFullYear(),n.getMonth()-1,15)),old=ymd(new Date(n.getFullYear(),n.getMonth()-4,10));
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:old,updated:old,code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const won=(id,site,owner,amt,date)=>deal(id,site,owner,'won',{outcome:'won',lifecycle_status:'closed',grp:'수주',won_amount:amt,amt,closed:date});
   const lost=(id,site,owner,amt,date)=>deal(id,site,owner,'lost',{outcome:'lost',lifecycle_status:'closed',grp:'종료',amt,closed:date,lostReason:'가격 열세'});
   B={deals:[
     deal('o1','[서울 강동] 롯데캐슬퍼스트','이필선','bidding',{amt:9e8}),deal('o2','[경기 평택] 비전지웰푸르지오','이필선','sent',{amt:3e8}),deal('o3','[서울 도봉] 창동동아그린','황윤선','consulting',{amt:5e8,created:today}),
     won('w1','[서울 노원] 상계주공','황윤선',2e8,today),won('w0','[인천] 송도더샵','황윤선',1e8,prevMonth),won('w9','[부산] 해운대','이필선',4e8,prevMonth),
     lost('l1','[대전] 둔산크로바','이필선',3e8,today)],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};window.__printed=0;window.print=()=>{__printed++;};
   goPage('report');
  });
  await page.waitForTimeout(400);
  const v=page.locator('#report-v2');assert.equal(await v.count(),1,'새 화면');
  assert.equal(await page.evaluate(()=>document.getElementById('report-master').hidden),true,'기존 상세 표는 접혀 있음');
  assert.deepEqual(await v.locator('.rp-toolbar .rp-seg').first().locator('button').allInnerTexts(),['월간','분기','연간']);
  assert.match(await v.locator('.rp-toolbar').innerText(),/자동 취합 · \d+월 \d+일[\s\S]*슬라이드[\s\S]*한 페이지[\s\S]*편집[\s\S]*상세 표 보기[\s\S]*PDF로 저장[\s\S]*대표님께 보내기/);
  assert.equal(await v.locator('.rp-toolbar .rp-btn.pri').isDisabled(),true,'보내기는 잔디 연결 전이라 잠김');
  assert.equal(await v.locator('.rp-slide').count(),8,'8장');assert.equal(await v.locator('.rp-dot').count(),8);
  assert.equal(await page.evaluate(()=>{const r=document.querySelector('.rp-deck').getBoundingClientRect();return Math.abs(r.width/r.height-16/9)<0.02;}),true,'16:9');
  const cur=()=>v.locator('.rp-slide.on');
  /* 0 표지: 기회부터 + 위험 한 줄 */
  assert.equal(await cur().evaluate(n=>n.classList.contains('dark')),true,'표지는 남색');
  assert.match(await cur().innerText(),/임박 1건을 잡으면 9억이 들어옵니다[\s\S]*지금 봐야 할 현장/);
  if(shot)await page.screenshot({path:shot+'-0.png'});
  /* → 키로 넘기기 */
  const next=async()=>{await page.keyboard.press('ArrowRight');await page.waitForTimeout(120);};
  await next();assert.match(await cur().innerText(),/지금 상황[\s\S]*이번 달 수주 · 계약 체결일 기준\s*2억[\s\S]*1건을 수주했습니다\. 지난달은 5억이었습니다/);assert.equal(await cur().locator('.rp-months>div').count(),6,'6개월 막대');
  assert.equal(await page.evaluate(()=>document.querySelector('.rp-progress i').style.width),'25%','진행 막대');
  if(shot)await page.screenshot({path:shot+'-1.png'});
  await next();assert.match(await cur().innerText(),/그래도 쌓인 것[\s\S]*계약 임박\s*1건[\s\S]*잘하는 사람\s*황윤선[\s\S]*이번 달 2억 · 1건 수주/);assert.equal(await cur().locator('.rp-goods>div').count(),3);
  if(shot)await page.screenshot({path:shot+'-2.png'});
  await next();
  assert.deepEqual(await cur().locator('.rp-ph span').allInnerTexts(),['담당','한 일','결과','만든 돈','놓친 돈','성공률']);
  assert.match(await cur().locator('.rp-pr').nth(0).innerText(),/황윤선\s*2건[\s\S]*2억\s*0원\s*100%\s*1\/1/);
  assert.match(await cur().locator('.rp-pr').nth(1).innerText(),/이필선\s*3건[\s\S]*0원\s*3억\s*0%\s*0\/1/);
  assert.match(await cur().locator('.rp-note').innerText(),/황윤선 — 2억을 만들었습니다 · 이필선 — 실주 1건\(3억\), 놓친 이유를 확인할 차례입니다/);
  if(shot)await page.screenshot({path:shot+'-3.png'});
  await next();
  assert.match(await cur().innerText(),/지난달과 비교[\s\S]*수주\s*5억 2건 → 2억 1건\s*▼ 3억[\s\S]*신규 영업기회\s*0건 → 1건\s*▲ 1건[\s\S]*단계 진전\s*단계 변경 기록이 없어 비교할 수 없습니다[\s\S]*실주 · 종료\s*0건 → 1건\s*▲ 1건/);
  assert.deepEqual(await cur().locator('.rp-cmp em').evaluateAll(a=>a.map(e=>e.className)),['r','g','m','r'],'좋아진 것은 초록 · 나빠진 것은 빨강(실주는 늘면 빨강)');
  if(shot)await page.screenshot({path:shot+'-4.png'});
  await next();assert.match(await cur().innerText(),/숫자 뒤의 진짜 모습[\s\S]*초기 · 설계[\s\S]*자료 발송[\s\S]*경쟁 · 입찰\s*9억\s*1건[\s\S]*진행 금액\s*17억[\s\S]*실제 기대 \(가중\)/);
  if(shot)await page.screenshot({path:shot+'-5.png'});
  await next();assert.equal(await cur().evaluate(n=>n.classList.contains('dark')),true);
  assert.match(await cur().innerText(),/대표님께 부탁드릴 것[\s\S]*이번에는 한 가지만[\s\S]*좋습니다[\s\S]*1곳만[\s\S]*이번 달은 어려움[\s\S]*아직 부탁드리지 않는 것/);
  assert.equal(await cur().locator('.rp-ask h3').count(),1,'부탁은 한 가지');assert.equal(await cur().locator('.rp-answers button:disabled').count(),3,'응답 저장소 설치 전이라 잠김');
  if(shot)await page.screenshot({path:shot+'-6.png'});
  await next();assert.match(await cur().innerText(),/약속은 작게, 결과는 그대로[\s\S]*지난달 약속 결과[\s\S]*약속 기록이 없습니다[\s\S]*이번 달 행동 약속 · 초안[\s\S]*확인하는 곳:[\s\S]*결과\(금액 · 수주\)는 약속하지 않습니다/);
  assert.ok(await cur().locator('.rp-promise').count()<=2,'약속은 2개 이하');
  if(shot)await page.screenshot({path:shot+'-7.png'});
  await next();assert.equal(await page.evaluate(()=>G.reportV2.i),7,'마지막 장에서 멈춤');
  await page.keyboard.press('ArrowLeft');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>G.reportV2.i),6,'← 키');
  await v.locator('.rp-dot').nth(3).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>G.reportV2.i),3,'점');
  await v.locator('.rp-nav [data-rp="prev"]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>G.reportV2.i),2,'‹ 버튼');
  /* 분기 · 연간 */
  await v.locator('[data-rp="mode"][data-value="year"]').click();await page.waitForTimeout(150);await v.locator('.rp-dot').nth(1).click();await page.waitForTimeout(100);
  assert.match(await cur().innerText(),/올해 수주 · 계약 체결일 기준\s*7억[\s\S]*3건을 수주했습니다\. 작년은 0원이었습니다/);
  await v.locator('[data-rp="mode"][data-value="month"]').click();await page.waitForTimeout(150);
  /* 편집: 문장을 고치면 한 페이지에도 같은 문장 · 저장은 하지 않는다 */
  await v.locator('.rp-dot').nth(0).click();await page.waitForTimeout(100);await v.locator('[data-rp="edit"]').click();await page.waitForTimeout(100);
  assert.match(await v.locator('.rp-editnote').innerText(),/저장되지는 않습니다/);
  await cur().locator('.rp-t[data-key="cover"]').fill('임박 1건, 이번 달 안에 계약합니다');await v.locator('[data-rp="edit"]').click();await page.waitForTimeout(100);
  assert.match(await cur().innerText(),/임박 1건, 이번 달 안에 계약합니다/);
  /* 한 페이지 */
  await v.locator('[data-rp="view"][data-value="page"]').click();await page.waitForTimeout(150);
  const pg=v.locator('.rp-page');assert.equal(await pg.count(),1);assert.equal(await v.locator('.rp-slide').count(),0);
  assert.match(await pg.innerText(),/넷폼 영업 보고 · \d+년 \d+월[\s\S]*보고 송보람[\s\S]*임박 1건, 이번 달 안에 계약합니다[\s\S]*계약 임박[\s\S]*담당자별[\s\S]*황윤선[\s\S]*지난달과 비교[\s\S]*대표님께 부탁드릴 것[\s\S]*이번 달 행동 약속/);
  assert.equal(await pg.locator('.rp-groups').count(),0,'단계별 막대는 슬라이드에만');
  if(shot)await page.screenshot({path:shot+'-page.png',fullPage:true});
  /* → 키는 한 페이지 보기에서 아무 일도 하지 않는다 · PDF */
  await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>G.reportV2.i),0);
  await v.locator('[data-rp="pdf"]').click();assert.equal(await page.evaluate(()=>__printed),1);assert.match(await page.evaluate(()=>document.getElementById('rpPrint').textContent),/A4 portrait/,'한 페이지 = A4 1쪽');
  await v.locator('[data-rp="view"][data-value="slides"]').click();await page.waitForTimeout(150);await v.locator('[data-rp="pdf"]').click();assert.match(await page.evaluate(()=>document.getElementById('rpPrint').textContent),/A4 landscape/,'슬라이드 = 한 장 1쪽(가로)');
  await page.emulateMedia({media:'print'});await page.evaluate(()=>document.body.classList.add('rp-printing'));
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.rp-slide')].filter(n=>getComputedStyle(n).display!=='none').length),8,'PDF에는 8장이 모두');
  assert.equal(await page.evaluate(()=>['.side','.mhead','.rp-toolbar','.rp-nav'].every(s=>getComputedStyle(document.querySelector(s)).display==='none')),true,'PDF에는 틀 · 버튼 없음');
  await page.evaluate(()=>document.body.classList.remove('rp-printing'));await page.emulateMedia({media:'screen'});
  /* 상세 표 = 기존 리포트 그대로 */
  await v.locator('[data-rp="detail"]').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>!document.getElementById('report-master').hidden&&document.querySelector('#report-master .ceo-report')!==null),true,'기존 상세 표');
  await v.locator('[data-rp="detail"]').click();await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(()=>__writes),[],'이 화면은 저장하지 않는다');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.reportV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.getElementById('report-v2').hidden&&!document.getElementById('report-master').hidden),true,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',eight_slides:true,arrow_keys_dots:true,people_made_missed_rate:true,compare_prev_period:true,one_ask_locked:true,action_promises_max2:true,one_page:true,edit_not_saved:true,pdf_one_slide_per_page:true,detail_legacy:true,no_writes:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
