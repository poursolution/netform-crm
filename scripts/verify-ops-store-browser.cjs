'use strict';
/* 운영 저장소 연결 검사(2026-10-02 · sql/ops-store-v1-20261002.sql): 저장소가 설치돼 있을 때
   관리팀 KPI = [이번 주 결과 저장] · 최근 4주 점 · 연속 미달 · 처리 기록 · 설정 플래그(AI만 바꿀 수 있음),
   리포트 = [이 보고 저장] · 대표 응답 · 지난달 약속. 서버는 흉내(같은 약속) — 실제 SQL은 tests/ops-store-postgres.test.mjs 가 검사한다 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.OpsStore&&window.KpiV2&&window.ReportV2&&typeof paint==='function');
  await page.evaluate(()=>{
   const ymd=d=>d.toLocaleDateString('en-CA'),n=new Date(),today=ymd(n),at=d=>new Date(Date.now()-d*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:ymd(new Date(n.getFullYear(),n.getMonth()-3,5)),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(i,owner,days)=>({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site:'신규 문의 '+i,status:owner?'배정완료':'접수',at:at(days),created_at:at(days),brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(days-0.2):null});
   B={deals:[deal('o1','[서울 강동] 롯데캐슬퍼스트','이필선','bidding',{amt:9e8}),deal('o2','[경기 평택] 비전지웰푸르지오','이필선','sent',{amt:3e8}),deal('w1','[서울 노원] 상계주공','황윤선','won',{outcome:'won',lifecycle_status:'closed',grp:'수주',won_amount:2e8,amt:2e8,closed:today})],
    inquiries:[inq(1,'',1),inq(2,'이필선',9)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   /* 서버 흉내: 설치된 저장소 */
   const mon=o=>OpsStore.monday(o),DB={settings:{enforce_auto_assign:false,enforce_stage_block:false,ai_enabled:false,merge_enabled:false,jandi_enabled:false},weekly:[],actions:[],snaps:[]};window.__db=DB;window.__rpc=[];
   const pm=new Date(n.getFullYear(),n.getMonth()-1,1),prevKey=pm.getFullYear()+'-'+String(pm.getMonth()+1).padStart(2,'0');
   DB.snaps.push({kind:'monthly',period_key:prevKey,payload:{ask:{title:'지난달 부탁한 현장 — 계약조건 승인'}},promises:[{what:'배정된 문의는 그날 첫 연락을 한다',who:'영업팀 · 매일',where:'관리팀 KPI · 첫 연락',basis:'지금 첫 연락 전 4건'}],boss_response:'partial',boss_response_at:at(20)});
   DB.snaps.push({kind:'weekly',period_key:mon(-1),payload:{range:'지난주',kpis:[['지난주 수주','1건 · 2억'],['위험 현장','3건']],verdicts:[{tone:'r',text:'위험 현장 3건 — TOP 3부터 조치',go:'위험 현장'}],agenda:[{basis:'미배정 2건',todo:'오늘 안에 담당 정하기',who:'관리팀 · 오늘'}],reps:[{n:'이필선',won:1,open:2,weighted:1,sched:1,adv:0,risk:3}]},promises:[]});
   SB={rpc:async(name,args)=>{const p=(args&&args.p)||{};__rpc.push(name);
    if(name==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};
    if(name==='crm_ops_settings_v1'){if(p.set)Object.assign(DB.settings,p.set);return {data:{ok:true,settings:Object.assign({},DB.settings)}};}
    if(name==='crm_kpi_weekly_list_v1')return {data:{ok:true,rows:DB.weekly.slice()}};
    if(name==='crm_kpi_weekly_save_v1'){p.rows.forEach(r=>{DB.weekly=DB.weekly.filter(x=>!(x.week_start===p.week_start&&x.promise_key===r.promise_key));DB.weekly.push(Object.assign({week_start:p.week_start},r));});return {data:{ok:true,week_start:p.week_start,saved:p.rows.length}};}
    if(name==='crm_kpi_action_log_v1'){const a=Object.assign({actor_name:'송보람',created_at:new Date().toISOString()},p);DB.actions.unshift(a);return {data:{ok:true,action:a}};}
    if(name==='crm_kpi_action_list_v1')return {data:{ok:true,actions:DB.actions.slice(0,p.limit||50)}};
    if(name==='crm_report_snapshot_get_v1')return {data:{ok:true,snapshots:DB.snaps.filter(s=>s.kind===p.kind).sort((a,b)=>b.period_key.localeCompare(a.period_key))}};
    if(name==='crm_report_snapshot_save_v1'){DB.snaps=DB.snaps.filter(s=>!(s.kind===p.kind&&s.period_key===p.period_key));DB.snaps.push({kind:p.kind,period_key:p.period_key,payload:p.payload,promises:p.promises||[],boss_response:null});return {data:{ok:true,kind:p.kind,period_key:p.period_key}};}
    if(name==='crm_report_response_save_v1'){const s2=DB.snaps.find(s=>s.kind===p.kind&&s.period_key===p.period_key);if(!s2)return {error:{message:'먼저 그 기간의 보고를 저장해 주세요'}};s2.boss_response=p.response;s2.boss_response_at=new Date().toISOString();return {data:{ok:true,response:p.response}};}
    return {error:{message:'not in test: '+name}};}};
   /* 지난주 · 2주 전에 저장된 결과(첫 약속: 2주 연속 미달) */
   const key='배정 · 응대 · 견적문의는 그날 담당을 정한다';DB.weekly.push({week_start:mon(-1),promise_key:key,numerator:1,denominator:4},{week_start:mon(-2),promise_key:key,numerator:2,denominator:4},{week_start:mon(-3),promise_key:key,numerator:4,denominator:4});
   G.kpiBOff=true;/* 운영 저장소 흐름은 v2 KPI 화면 기준 — 새 KPI 화면(2026-10-03)은 verify-kpi-b 에서 */goPage('mgmt');
  });
  await page.waitForTimeout(600);
  /* ── 관리팀 KPI ── */
  const k=page.locator('#kpi-v2');assert.equal(await k.count(),1);
  const card=k.locator('.kv-card').first();
  assert.deepEqual(await card.locator('.kv-weeks i').evaluateAll(a=>a.map(i=>i.className)),['ok','no','no','no'],'지난 3주는 저장된 값 · 이번 주는 지금 값');
  assert.match(await card.locator('.kv-weeks').innerText(),/최근 4주 · 저장된 주 3 · 연속 미달 2주/);
  assert.match(await card.locator('.kv-weeks i').nth(1).getAttribute('title'),/2 \/ 4 · 50%/);
  assert.equal(await k.locator('[data-kv="saveweek"]').count(),1,'관리자에게 [이번 주 결과 저장]');
  await k.locator('[data-kv="saveweek"]').click();await page.waitForTimeout(500);
  const saved=await page.evaluate(()=>__db.weekly.filter(r=>r.week_start===OpsStore.monday(0)));
  assert.ok(saved.length>=5,'측정되는 약속만 저장 '+saved.length);assert.equal(saved.every(r=>r.numerator>=0&&r.numerator<=r.denominator&&r.denominator>0),true);
  assert.match(await page.locator('#kpi-v2 .kv-card').first().locator('.kv-weeks').innerText(),/이번 주 저장됨/);
  /* 처리 기록: 할 일 버튼을 누르면 남는다 */
  await page.locator('#kpi-v2 .kv-card').first().locator('.kv-todo button').first().click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__db.actions.map(a=>[a.promise_key,a.action,a.target_type,a.target_name])),[['배정 · 응대 · 견적문의는 그날 담당을 정한다','담당 정하기','inquiry','신규 문의 1']]);
  await page.evaluate(()=>{try{InquiryWorkbench.close();}catch(e){}document.querySelectorAll('dialog[open]').forEach(d=>d.close());});await page.waitForTimeout(200);
  /* 설정: 플래그 기본 꺼짐 · AI만 바꿀 수 있다 · 최근 처리 기록 */
  await page.locator('#kpi-v2 [data-kv="settings"]').click();await page.waitForTimeout(500);
  const set=page.locator('#kvSettings');assert.equal(await set.locator('#kvSetTitle').innerText(),'KPI 설정');
  assert.deepEqual(await set.locator('[data-flag]').evaluateAll(a=>a.map(c=>[c.dataset.flag,c.checked,c.disabled])),[['ai_enabled',false,false],['enforce_auto_assign',false,true],['enforce_stage_block',false,true],['merge_enabled',false,true],['jandi_enabled',false,true]]);
  assert.match(await set.locator('.kv-acts').innerText(),/송보람\s*담당 정하기 · 신규 문의 1/);
  if(shot)await page.screenshot({path:shot+'-kpi-settings.png'});
  await set.locator('[data-flag="ai_enabled"]').check();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__db.settings.ai_enabled),true);assert.equal(await page.evaluate(()=>__db.settings.enforce_stage_block),false,'강제 적용은 꺼진 채');
  await page.locator('#kvSettings [data-close]').click();
  if(shot)await page.screenshot({path:shot+'-kpi.png'});
  /* ── 주간 브리핑: 이번 주 저장 · 지난 저장본 보기 ── */
  await page.evaluate(()=>(G.briefBOff=true,goPage('brief')));await page.waitForTimeout(600);
  const bw=page.locator('#brief-v2');assert.equal(await bw.locator('.bv-week select').isDisabled(),false,'저장소가 있으면 주차 선택이 열린다');
  assert.match((await bw.locator('.bv-week option').allInnerTexts()).join('|'),/^이번 주 · .+\|\d+월 \d+일 주 · 저장본$/);
  await bw.locator('[data-bv="saveweek"]').click();await page.waitForTimeout(500);
  const wk=await page.evaluate(()=>__db.snaps.find(s=>s.kind==='weekly'&&s.period_key===OpsStore.monday(0)));
  assert.ok(wk&&wk.payload.kpis.length===4&&Array.isArray(wk.payload.verdicts)&&Array.isArray(wk.payload.reps),'이번 주 숫자 · 판정 · 담당 현황 저장');
  assert.equal(await page.locator('#brief-v2 [data-bv="saveweek"]').innerText(),'이번 주 다시 저장');
  await page.locator('#brief-v2 .bv-week select').selectOption({index:1});await page.waitForTimeout(400);
  assert.match(await page.locator('#brief-v2 .bv-stored').innerText(),/주에 저장한 브리핑입니다 — 그때 숫자 그대로[\s\S]*지난주 수주\s*1건 · 2억[\s\S]*위험 현장 3건 — TOP 3부터 조치[\s\S]*오늘 안에 담당 정하기[\s\S]*이필선/);
  assert.equal(await page.locator('#brief-v2 [data-bv="saveweek"]').count(),0,'지난 저장본은 읽기 전용');
  if(shot)await page.screenshot({path:shot+'-brief-stored.png'});
  await page.locator('#brief-v2 .bv-week select').selectOption({index:0});await page.waitForTimeout(300);assert.equal(await page.locator('#brief-v2 .bv-stored').count(),0);
  /* ── 리포트 ── */
  await page.evaluate(()=>(G.reportBOff=true,goPage('report')));await page.waitForTimeout(600);
  const v=page.locator('#report-v2');assert.equal(await v.locator('[data-rp="snapshot"]').innerText(),'이 보고 저장');
  await v.locator('.rp-dot').nth(6).click();await page.waitForTimeout(150);
  assert.equal(await v.locator('.rp-slide.on .rp-answers button:disabled').count(),3,'보고를 저장하기 전에는 답을 남길 수 없다');assert.match(await v.locator('.rp-slide.on .rp-lock').innerText(),/먼저 위의 \[이 보고 저장\]/);
  await v.locator('[data-rp="snapshot"]').click();await page.waitForTimeout(600);
  const snap=await page.evaluate(()=>__db.snaps.find(s=>s.kind==='monthly'&&s.boss_response===null));
  assert.equal(snap.kind,'monthly');assert.match(snap.period_key,/^\d{4}-\d{2}$/);assert.equal(snap.payload.won_amount,2e8);assert.equal(snap.payload.won_count,1);assert.ok(snap.payload.ask&&snap.payload.ask.title.length>0);assert.ok(snap.promises.length>=1&&snap.promises.length<=2);
  assert.equal(await v.locator('[data-rp="snapshot"]').innerText(),'이 보고 다시 저장');
  assert.equal(await v.locator('.rp-slide.on .rp-answers button:disabled').count(),0);
  await v.locator('.rp-slide.on .rp-answers button',{hasText:'좋습니다'}).click();await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>__db.snaps.find(s=>s.period_key!==__db.snaps[0].period_key||true)&&__db.snaps.filter(s=>s.boss_response==='yes').length),1,'대표 응답 저장');
  assert.equal(await v.locator('.rp-slide.on .rp-answers [aria-pressed="true"]').innerText(),'좋습니다');assert.match(await v.locator('.rp-slide.on .rp-lock').innerText(),/답을 저장했습니다 · 좋습니다/);
  if(shot)await page.screenshot({path:shot+'-report-ask.png'});
  await v.locator('.rp-dot').nth(7).click();await page.waitForTimeout(150);
  assert.match(await v.locator('.rp-slide.on').innerText(),/지난달 약속 결과[\s\S]*배정된 문의는 그날 첫 연락을 한다[\s\S]*확인하는 곳: 관리팀 KPI · 첫 연락[\s\S]*부탁: 지난달 부탁한 현장 — 계약조건 승인[\s\S]*대표님 답 — 1곳만/,'지난달 저장분의 약속과 대표 답');
  if(shot)await page.screenshot({path:shot+'-report-promise.png'});
  /* 영업사원에게는 저장 버튼이 없다 */
  await page.evaluate(()=>{ME={id:'rep1',name:'이필선',role:'rep'};paint();});await page.waitForTimeout(400);
  assert.equal(await page.locator('#report-v2 [data-rp="snapshot"]').count(),0);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',kpi_weekly_history:true,kpi_save_week:true,kpi_action_log:true,flags_default_off_only_ai_editable:true,report_snapshot_save:true,boss_response:true,previous_promises_shown:true,admin_only_writes:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
