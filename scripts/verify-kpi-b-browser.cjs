'use strict';
/* 관리팀 KPI(2026-10-03 핸드오프 design_handoff_kpi) 검사: 제목 한 줄 · KPI 표 8줄(이번 주 · 지난주 ▲▼ · 4주 추이 · 목표 · 내 조치) · 오른쪽 선택 지표 패널(장기 추이 · 단계 링크 · 내가 할 일 = 파이프라인 B안 사유와 같은 건)
   · 요청 = kpi_actions 기록 + 담당자 관리자 한마디 · 주간 저장 · 담당별(선택 지표 정렬 · 측정 불가 묶음) · 끄기 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.KpiB&&window.KpiV2&&window.PipelineStageB&&window.OpsStore&&typeof paintMgmt==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,days)=>({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site:'신규 문의 '+n,status:owner?'배정완료':'접수',at:at(-days),created_at:at(-days),brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(-days+0.0007)/* 접수 1분 뒤 배정 — 시각과 상관없이 같은 날 */:null});
   B={deals:[
     deal('d1','할 일 없는 큰 현장','이필선','consulting',{amt:9e8}),
     deal('d2','기한 지난 현장','이필선','sent',{amt:3e8,next_action:{id:'n1',text:'견적 확인',due:day(-12),status:'open'}}),
     deal('d3','정상 현장','황윤선','compete',{amt:5e8,created:day(-10),updated:day(-1),next_action:{id:'n3',text:'PT 준비',due:day(3),status:'open'},activities:[{id:'a3',type:'전화',note:'통화',at:at(-1)}]}),
     deal('d4','사유 없는 실주','이필선','lost',{outcome:'lost',closed_at:day(-3)}),
     deal('d5','미팅 후 견적 없는 현장','황윤선','consulting',{amt:2e8,created:day(-20),updated:day(-10),next_action:{id:'n5',text:'현장방문',type:'현장방문',due:day(-8),status:'open'},activities:[{id:'a5',type:'방문',note:'1차 미팅',at:at(-8)}]})],
    inquiries:[inq(1,'',2),inq(2,'이필선',3),inq(3,'이필선',4),inq(4,'이필선',5)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.kb=null;G.kbDone=null;G.kbNmSent=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req';};
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};
   /* 운영 저장소 흉내: 지난주 · 3주 전 저장값, 조치 기록 1건(지난주) */
   const mon=OpsStore.monday,wk=[];window.__rpc=[];window.__weekly=[{week_start:mon(-1),promise_key:'kpi:1',numerator:1,denominator:4},{week_start:mon(-1),promise_key:'kpi:3',numerator:1,denominator:4},{week_start:mon(-3),promise_key:'kpi:3',numerator:3,denominator:4},{week_start:mon(-2),promise_key:'kpi:3',numerator:2,denominator:4}];
   window.__acts=[{promise_key:'kpi:1',action:'담당 정하기',target_type:'inquiry',target_id:'00000001-0000-4000-8000-000000000001',target_name:'신규 문의 1',created_at:new Date(Date.now()-10*864e5).toISOString(),actor_name:'송보람'},{promise_key:'kpi:3',action:'등록 요청',target_type:'person',target_id:'정정훈',target_name:'정정훈',created_at:new Date(Date.now()-5*864e5).toISOString(),actor_name:'송보람'}];
   SB={rpc:async(name,args)=>{__rpc.push([name,args&&args.p]);if(name==='crm_kpi_weekly_list_v1')return {data:{ok:true,rows:__weekly}};if(name==='crm_kpi_action_list_v1')return {data:{ok:true,actions:__acts}};if(name==='crm_kpi_action_log_v1'){const a=Object.assign({created_at:new Date().toISOString(),actor_name:'송보람'},args.p);__acts.unshift(a);return {data:{ok:true,action:a}};}if(name==='crm_kpi_weekly_save_v1'){return {data:{ok:true,saved:args.p.rows.length}};}if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};return {data:{ok:true,tasks:[],rows:[],actions:[]}};}};TOKEN='test';
   goPage('mgmt');
  });
  await page.waitForTimeout(500);
  const v=page.locator('#kpi-b');assert.equal(await v.count(),1,'새 KPI 화면');assert.equal(await page.locator('#kpi-v2').count(),0,'v2 없음');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'관리팀 KPI');
  assert.equal(await page.locator('#mgmt-root .rk-panel:visible').count(),0,'기록률 패널 숨김');
  /* 제목 한 줄 */
  assert.match(await v.locator('.kb-title h1').innerText(),/^지표 8개 중 목표 달성 \d개 · 이번 주 내 조치 \d+ \/ \d+$/);
  /* KPI 표 8줄 */
  const rows=v.locator('.kb-row');assert.equal(await rows.count(),8);
  assert.deepEqual(await rows.locator('.l b').allInnerTexts(),['1. 당일 배정률','2. 2시간 첫 연락','3. 다음 할 일 등록률','4. 활동 기록률','5. 장기정체 비율','6. 방문 후 3일 견적','7. 실주 사유 입력','8. 관리팀 조치 → 처리율']);
  assert.deepEqual(await v.locator('.kb-thead .r span').allInnerTexts(),['이번 주','지난주','4주 추이','목표','내 조치']);
  const r1=rows.nth(0);assert.match(await r1.innerText(),/견적문의 · 접수 당일 담당 지정 ÷ 접수[\s\S]*75%[\s\S]*25% ▲[\s\S]*개선[\s\S]*95%[\s\S]*1건 남음/,'이번 주 75% · 지난주 저장값 25% ▲ · 미배정 1건');
  assert.equal(await r1.locator('.v').evaluate(n=>n.style.color),'rgb(217, 58, 58)','미달 = 빨강');
  const r3=rows.nth(2);assert.match(await r3.innerText(),/다음 할 일 등록률[\s\S]*▲|▼/);assert.match(await r3.locator('.tr small').innerText(),/주째 악화|악화|개선|변화 없음/);
  assert.match(await rows.nth(6).innerText(),/실주 사유 입력[\s\S]*실주[\s\S]*0%[\s\S]*100%[\s\S]*1건 남음/);
  assert.match(await rows.nth(7).innerText(),/관리팀 조치 → 처리율[\s\S]*50%/,'요청 2건 중 정정훈 등록 요청은 목록에 없어 처리됨 · 신규 문의 1은 남음');
  /* 오른쪽 패널(1번 선택) */
  const p=v.locator('.kb-panel');assert.match(await p.locator('.kb-sel').innerText(),/1번 지표를 올리려면\s*당일 배정률 75% → 목표 95%\s*미배정 견적문의를 오늘 담당 지정/);
  assert.deepEqual(await p.locator('.kb-chhead button').allInnerTexts(),['12주','6개월','1년']);assert.equal(await p.locator('.kb-plot>i').count(),12);
  assert.match(await p.locator('.kb-legend').innerText(),/관리팀 조치한 주[\s\S]*(12주 전|저장된 주)/);
  assert.match(await p.locator('.kb-link').innerText(),/파이프라인 · 견적문의 의 '관리자 할 일'과 같은 목록\s*견적문의로 이동 →/);
  assert.match(await p.locator('.kb-todohead').innerText(),/내가 할 일\s*1건 남음 · 0건 조치함/);
  assert.match(await p.locator('.kb-todo').first().innerText(),/신규 문의 1[\s\S]*미배정 · 2일째 미배정[\s\S]*담당 정하기/);
  /* 5번(장기정체) · 6번 · 7번 = 파이프라인 B안 사유와 같은 건 */
  await rows.nth(4).click();await page.waitForTimeout(200);
  assert.match(await page.locator('#kpi-b .kb-link').innerText(),/컨설팅 설계 · 관계관리[\s\S]*단계로 이동 →/);
  const same=await page.evaluate(()=>{const rows=PipelineWorkspace.rows().filter(r=>r.group==='consulting');const it=PipelineStageB.model('consulting',rows).items;return it.filter(i=>i.rs.includes('long')||(i.stall||0)>=30).map(i=>i.row.site).sort();});
  const listed=await page.locator('#kpi-b .kb-todo .t b').allInnerTexts();assert.deepEqual(listed.slice().sort(),same,'장기정체 할 일 = B안 사유 건 '+JSON.stringify([listed,same]));
  await rows.nth(5).click();await page.waitForTimeout(200);assert.match(await page.locator('#kpi-b .kb-todo').first().innerText(),/미팅 후 견적 없는 현장[\s\S]*황윤선 · 미팅[\s\S]*견적 요청 없음[\s\S]*견적 요청 확인/);
  await rows.nth(6).click();await page.waitForTimeout(200);assert.match(await page.locator('#kpi-b .kb-todo').first().innerText(),/사유 없는 실주[\s\S]*이필선 · 실주 사유 없음[\s\S]*사유 요청/);
  if(shot)await page.screenshot({path:shot+'-kpi.png',fullPage:true});
  /* 요청 = kpi_actions 기록 + 담당자 관리자 한마디(rep_manager_comment) → '요청함' · 자동 저장 없음(목록 열기만) */
  await page.locator('#kpi-b .kb-todo button').first().click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(r=>r[0]==='crm_kpi_action_log_v1').map(r=>[r[1].promise_key,r[1].action,r[1].target_type,r[1].target_name])),[['kpi:7','사유 요청','deal','사유 없는 실주']]);
  assert.deepEqual(await page.evaluate(()=>__writes.filter(w=>w[0]==='rep_manager_comment').map(w=>[w[1].rep_name,/\[KPI 요청\] 실주 사유 입력 — 사유 없는 실주/.test(w[1].comment)])),[['이필선',true]],'담당자 이번 주 관리자 한마디에 한 줄');
  assert.match(await page.locator('#kpi-b .kb-todo').first().innerText(),/요청함/);assert.match(await page.locator('#kpi-b .kb-todohead').innerText(),/0건 남음 · 1건 조치함/);
  assert.match(await page.locator('#kpi-b .kb-row').nth(6).innerText(),/완료/);
  /* 할 일 글자 클릭 = 기존 상세 */
  await page.locator('#kpi-b .kb-todo .t').first().click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__open),'d4');
  /* 주간 저장 = 기존 함수(kpi:n 키) */
  await page.locator('#kpi-b [data-kb="save"]').click();await page.waitForTimeout(300);
  const saved=await page.evaluate(()=>__rpc.filter(r=>r[0]==='crm_kpi_weekly_save_v1').map(r=>r[1].rows.map(x=>x.promise_key)));assert.ok(saved.length>=1&&saved.at(-1).includes('kpi:1')&&saved.at(-1).includes('kpi:7'),JSON.stringify(saved));/* 금·토·일에는 자동 저장이 한 번 더 있을 수 있다 */
  /* 담당별: 선택 지표(7번 → 실주 사유) 기준 정렬 · 미달 칩 2개 · 측정 불가 묶음 */
  const pp=page.locator('#kpi-b .kb-people');assert.match(await pp.locator('header').innerText(),/담당별 · 실주 사유 기준[\s\S]*미달 \d+명 · 전체 \d+명/);
  assert.equal(await pp.locator('.kb-person').first().locator('.who b').innerText(),'이필선','가장 미달인 사람 위');
  assert.ok((await pp.locator('.kb-person').first().locator('.bad em').count())<=2,'미달 칩 2개까지');
  const nmTxt=await pp.locator('.kb-nm').innerText();assert.match(nmTxt,/측정 불가 \d+명[\s\S]*기록이 없어 지표가 안 나옴[\s\S]*한 번에 기록 시작 요청/);
  assert.doesNotMatch(await pp.innerText(),/정정훈[\s\S]*0%/,'기록 없는 사람은 0%로 안 보임');
  await pp.locator('[data-kb="nm"]').click();await page.waitForTimeout(200);assert.match(await page.locator('#kpi-b .kb-nm button').innerText(),/요청함/);
  assert.ok((await page.evaluate(()=>__writes.filter(w=>w[0]==='rep_manager_comment'&&/기록 시작/.test(w[1].comment)).length))>=1,'측정 불가 담당에게 기록 시작 요청');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.kpiBOff=true;paintMgmt();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#kpi-b').count(),0);assert.equal(await page.locator('#kpi-v2').count(),1,'끄면 v2');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',title_line:true,table8:true,last_week_arrow_trend:true,panel_chart_ranges:true,todos_same_as_stage_b:true,request_logs_and_comment:true,open_existing_detail:true,weekly_save:true,people_sorted_unmeasured:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
