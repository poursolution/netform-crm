'use strict';
/* 오늘 업무 v2 검사(2026-10-01 디자인 핸드오프 ④): 미배정 알림 → 담당자별 현황(한 표) → 업무 목록(전환·묶음) → 과거 영업 정리.
   담당자 선택은 공통 필터줄과 같은 상태, 문의 행은 새 견적문의 상세를 연다 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayWorkQueue&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>at(-d).slice(0,10);
   const inq=(i,site,days,owner,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:owner?'배정완료':'접수',at:at(days),created_at:at(days),brand:['POUR솔루션','석민이앤씨'][i%2],phone:'010-1234-56'+(10+i),contact_name:'고객'+i,assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(days-0.1):null,raw:{'문의내용':'견적 문의'}},extra||{});
   const deal=(id,site,owner,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:at(40).slice(0,10),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8},extra||{});
   B={deals:[deal('late','기한 지난 현장','이필선',{next_action:{id:'n1',text:'견적 확인 전화',due:day(-5),status:'open'}}),deal('none','할 일 없는 현장','황윤선',{created:at(0).slice(0,10)})/* Live 이후 생성 — 이전 건은 '과거 영업 정리'로 간다 */,deal('ok','예정 현장','이필선',{next_action:{id:'n2',text:'방문',due:day(4),status:'open'}})],
    inquiries:[inq(1,'미배정 오래된 현장',9,''),inq(2,'미배정 새 현장',1,''),inq(3,'첫 연락 늦은 현장',3,'이필선'),inq(4,'황윤선 문의',2,'황윤선')],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};G.todayV3Off=true;G.todayTowerOff=true;/* 관제탑(2026-10-03) 뒤에 남는 예전 화면 검사 */AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';goPage('today');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#today-v2');assert.equal(await v.count(),1,'새 화면');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('today-home-root')).display),'none','예전 화면 숨김');
  assert.match(await page.evaluate(()=>document.getElementById('psub').textContent),/^\d+월 \d+일 \(.\) · 사원별 현황/);
  assert.equal(await v.locator('h2').count(),0,'본문 큰 제목 없음');
  assert.equal(await page.evaluate(()=>{const u=document.getElementById('unibar');return !u||getComputedStyle(u).display==='none'}),true,'예전 상단 필터 숨김');
  /* ① 미배정 알림 */
  assert.match(await v.locator('.tv-alert').innerText(),/미배정 문의 2건 · 가장 오래된 건 9일 지남 \(미배정 오래된 현장\)/);
  /* ② 담당자별 현황: 한 표, 늦은 건 많은 순, 0은 – */
  assert.equal(await v.locator('.tv-board').count(),1);
  assert.deepEqual(await v.locator('.tv-bhead span').allInnerTexts(),['담당자','담당','첫 연락 늦음','후속 늦음','최장 경과','진행','금액','기한 초과','장기 정체','최장 정체','']);
  const first=await v.locator('.tv-brow').first().innerText();assert.match(first,/^이필선/,'늦은 건 많은 순 '+first);
  assert.equal(await v.locator('.tv-brow .z').count()>0,true,'0은 흐린 –');
  /* ③ 업무 목록: 전환 + 묶음 */
  assert.match(await v.locator('.tv-seg').innerText(),/견적문의 관리\s*\d+[\s\S]*파이프라인 관리\s*\d+/);
  assert.deepEqual(await v.locator('.tv-ghead b').allInnerTexts().then(a=>a.slice(0,3)),['미배정','첫 연락 늦음','후속 늦음']);
  assert.equal(await v.locator('.tv-row').first().locator('.tv-c b').first().innerText(),'미배정 오래된 현장','묶음 안은 경과 큰 순');
  assert.equal(await v.locator('.tv-row').first().locator('.tv-cta').innerText(),'배정');
  if(shot)await page.screenshot({path:shot+'-today.png'});
  await v.locator('.tv-seg [data-v="pipeline"]').click();
  assert.deepEqual(await v.locator('.tv-ghead b').allInnerTexts().then(a=>a.slice(0,3)),['기한 초과','다음 할 일 없음','장기 정체']);
  assert.match(await v.locator('.tv-row').first().innerText(),/기한 지난 현장[\s\S]*처리/);
  await v.locator('.tv-pills [data-v="missing"]').click();
  assert.equal(await v.locator('.tv-row').count(),1);assert.match(await v.locator('.tv-row').innerText(),/할 일 없는 현장/);
  await v.locator('.tv-pills [data-v="all"]').click();
  /* 담당자 선택: 표 행 클릭 = 공통 필터줄과 같은 상태 */
  await v.locator('.tv-brow[data-v="황윤선"]').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.querySelector('#pg-today>.cf-bar [data-cf="owner"]').value+'|'+G.todayQueueOwner+'|'+SalesScope.state().owner),'황윤선|황윤선|황윤선');
  assert.equal(await v.locator('.tv-row').count(),1,'황윤선 파이프라인 1건');assert.match(await v.locator('.tv-clear').innerText(),/황윤선 선택 해제/);
  await v.locator('.tv-clear').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>G.todayQueueOwner),'전체');
  /* 미배정만 보기 */
  await v.locator('.tv-red').click();await page.waitForTimeout(200);
  assert.equal(await v.locator('.tv-seg [data-v="inquiry"]').getAttribute('aria-pressed'),'true');assert.equal(await v.locator('.tv-row').count(),2);
  /* 문의 행 → 새 견적문의 상세, 파이프라인 행 → 기존 상세 */
  await v.locator('.tv-row').first().locator('.tv-c').first().click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#inq-inbox-dialog.idv').count(),1,'문의 행 → 새 상세 모달');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(200);
  await page.evaluate(()=>{goPage('today')});await page.waitForTimeout(200);
  await v.locator('.tv-pills [data-v="all"]').click();await v.locator('.tv-seg [data-v="pipeline"]').click();
  await v.locator('.tv-row').first().locator('.tv-cta').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.getElementById('detailView').classList.contains('on')),true,'파이프라인 행 → 기존 상세');
  await page.evaluate(()=>closeDetail());
  /* 끄면 예전 화면 */
  await page.evaluate(()=>{G.todayV2Off=true;paint()});
  assert.equal(await page.evaluate(()=>!document.getElementById('today-v2')&&getComputedStyle(document.getElementById('today-home-root')).display!=='none'),true);
  await page.evaluate(()=>{G.todayV2Off=false;paint()});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',alert:true,board_merged:true,list_groups:true,owner_shared:true,inquiry_opens_v2_modal:true,pipeline_opens_detail:true,legacy_switch:true,narrow:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
