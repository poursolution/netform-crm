'use strict';
/* 관리팀 KPI v2 검사(2026-10-01 디자인 핸드오프 kpi): 위쪽 틀(숫자 4·카드 3) + 약속 카드 12개(지금 기록으로 측정·지금 내가 할 것) + 담당별 묶음 표.
   할 일 버튼은 기존 창으로 연결. 저장하지 않는다(저장소가 필요한 부분은 스키마 확인 뒤). 강제 적용 없음. 끄면 예전 화면 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.KpiV2&&window.RepsV2&&window.PipelineDiagnosis&&typeof paintMgmt==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,days)=>({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site:'신규 문의 '+n,status:owner?'배정완료':'접수',at:at(-days),created_at:at(-days),brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(-days+0.5):null});
   B={deals:[
     deal('d1','할 일 없는 큰 현장','이필선','consulting',{amt:9e8}),
     deal('d2','기한 지난 현장','이필선','sent',{amt:3e8,next_action:{id:'n1',text:'견적 확인',due:day(-12),status:'open'}}),
     deal('d3','정상 현장','황윤선','compete',{amt:5e8,created:day(-10),updated:day(-1),next_action:{id:'n3',text:'PT 준비',due:day(3),status:'open'},activities:[{id:'a3',type:'전화',note:'통화',at:at(-1)}]}),
     deal('d4','사유 없는 실주','이필선','lost',{outcome:'lost',closed_at:day(-3)})],
    inquiries:[inq(1,'',2),inq(2,'이필선',3),inq(3,'이필선',4),inq(4,'이필선',5)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};
   goPage('mgmt');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#kpi-v2');assert.equal(await v.count(),1,'새 화면');
  assert.equal(await page.locator('#mgmt-root .mgmt-head,#mgmt-root .ops-kpis,#mgmt-root .opstable,#mgmt-root .rk-panel').count(),0,'예전 패널 없음');
  /* 위쪽 틀 */
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['당일 배정률','첫 연락 2시간 내','다음 할 일 지정률','장기정체 비율']);
  assert.match(await v.locator('.pd-kpis').innerText(),/목표 95% · 문제 \d+건[\s\S]*목표 90% · 문제 3건[\s\S]*목표 95% · 문제 \d+건[\s\S]*목표 10% 이하 · 문제 \d+건/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['어디서 멈췄나','병목 구간','기록이 되고 있나']);
  assert.match(await v.locator('.pd-card').nth(0).innerText(),/미응대\s*3/);
  assert.match(await v.locator('.pd-card').nth(2).innerText(),/첫 연락 기록률[\s\S]*활동 기록률[\s\S]*다음 할 일 등록률/);
  assert.equal(await v.locator('.pd-action').count(),0,'관리팀이 할 일 자리 = 약속 카드');
  /* 약속 카드 */
  const P=v.locator('#kv-promises');
  assert.match(await P.locator(':scope>header').innerText(),/이번 주 관리팀 약속 12가지[\s\S]*오늘 내가 할 것 \d+개 남음[\s\S]*지킨 약속 \d+ \/ 12[\s\S]*KPI 설정/);
  assert.deepEqual(await P.locator('.plv-pills button').allInnerTexts(),['전체','배정 · 응대','진행 관리','기록 · 데이터','코칭','고객 관리']);
  assert.equal(await P.locator('.kv-card').count(),12);
  const c1=P.locator('.kv-card').first();
  assert.match(await c1.innerText(),/배정 · 응대[\s\S]*“견적문의는 그날 담당을 정한다”[\s\S]*\d+ \/ 4[\s\S]*목표 95%[\s\S]*지금 내가 할 것\s*1[\s\S]*신규 문의 1[\s\S]*미배정 \d+일[\s\S]*담당 정하기[\s\S]*안 하면 → 1주 팀장 알림 · 2주 팀장 회의 안건 · 3주 오후 5시 자동 배정[\s\S]*강제 적용은 꺼져 있습니다/);
  assert.equal(await c1.locator('.kv-weeks i').count(),4,'최근 4주 칸');
  assert.match(await P.locator('.kv-card',{hasText:'실주하면 사유를 남긴다'}).innerText(),/0 \/ 1[\s\S]*사유 없는 실주[\s\S]*사유 요청/);
  assert.match(await P.locator('.kv-card',{hasText:'막힌 담당과 매주 1:1'}).innerText(),/0 \/ \d+[\s\S]*이필선[\s\S]*1:1 약속 쓰기/);
  assert.match(await P.locator('.kv-card',{hasText:'견적은 방문 후 3일 안 발송'}).innerText(),/측정 준비 중/);
  if(shot)await page.screenshot({path:shot+'-kpi.png',fullPage:true});
  /* 묶음 알약 */
  await P.locator('.plv-pills [data-value="코칭"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#kv-promises .kv-card').count(),1);
  await page.locator('#kv-promises .plv-pills [data-value="all"]').click();await page.waitForTimeout(150);
  /* 할 일 버튼 = 기존 기능으로 */
  await page.locator('#kv-promises .kv-card',{hasText:'실주하면 사유를 남긴다'}).locator('li button').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.__open),'d4','사유 요청 → 그 영업건 상세');
  await page.locator('#kv-promises .kv-card',{hasText:'막힌 담당과 매주 1:1'}).locator('li button').first().click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#repsDialog.on').count(),1,'1:1 약속 쓰기 → 영업사원 창');assert.match(await page.locator('#repsDialog .rd-head').innerText(),/이필선/);
  await page.locator('#repsDialog [data-rd="close"]').click();
  await page.locator('#kv-promises .kv-card').first().locator('li button').click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#inq-inbox-dialog').count(),1,'담당 정하기 → 견적문의 배정 창');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>G.page),'mgmt');
  /* KPI 설정: 저장소 확인 전 안내만 */
  await page.locator('#kv-promises [data-kv="settings"]').click();assert.match(await page.locator('#kvSettings').innerText(),/저장소 확인 뒤에 열립니다[\s\S]*AI 추천 KPI[\s\S]*강제 적용[\s\S]*기본은 꺼 둡니다/);await page.locator('#kvSettings [data-close]').click();
  /* 담당별 묶음 표 → 영업사원 창 */
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['담당','진행','미응대','할 일 없음','기한초과','정체','미입력','기록률','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['조치 필요','기록 부족 · 지표 참고용','정상']);
  assert.equal(await v.locator('.plv-row').first().getAttribute('data-rep'),'이필선');
  await v.locator('.plv-row').first().locator('.plv-cta').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#repsDialog.on').count(),1,'문제 현장 → 영업사원 창');await page.locator('#repsDialog [data-rd="close"]').click();
  assert.deepEqual(await page.evaluate(()=>__writes),[],'이 화면은 아무것도 저장하지 않는다');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.kpiV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#kpi-v2').count(),0);assert.equal(await page.locator('#mgmt-root .ops-kpis').count(),1,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',top_frame:true,promises:12,todo_buttons_linked:true,settings_gated:true,rep_table_opens_dialog:true,no_writes:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
