'use strict';
/* 영업사원 관리 v2 검사(2026-10-01 디자인 핸드오프 reps): 목록(상태 알약·더보기·진단·묶음 표) + 사람별 창(가운데 모달, 탭 없음).
   창의 현장 줄 = 그 현장의 파이프라인 상세. 약속 저장은 기존 관리자 약속 저장(가로챔). 팀 비교·계정 관리는 더보기. 끄면 예전 화면 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.RepsV2&&window.PipelineDiagnosis&&typeof paintRepManagement==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,days)=>({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site:'신규 문의 '+n,status:'배정완료',at:at(-days),created_at:at(-days),brand:'POUR솔루션',assignee:owner,assigned_to:owner,assigned_at:at(-days)});
   B={deals:[
     deal('d1','기한 지난 큰 현장','이필선','consulting',{amt:9e8,next_action:{id:'n1',text:'견적 확인',due:day(-12),status:'open'}}),
     deal('d2','할 일 없는 현장','이필선','sent',{amt:3e8}),
     deal('d3','정상 현장','황윤선','compete',{amt:5e8,created:day(-10),updated:day(-1),next_action:{id:'n3',text:'PT 준비',due:day(3),status:'open'},activities:[{id:'a3',type:'전화',note:'통화',at:at(-1)}]})],
    inquiries:[inq(1,'이필선',2),inq(2,'이필선',3),inq(3,'이필선',4)],activities:[],inquiryTrash:[],expansion_pool:[]};
   G.repsBOff=true;/* B안(2026-10-03)은 verify-reps-b 에서 */LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;G.repWindowOff=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p.rep_name,p.comment]);return 'req';};
   /* 시험 환경엔 로그인 저장소가 없다 — 메모리로 대신한다 */const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};window.__account=0;window.AccountAdmin={open:()=>{window.__account++;}};
   goPage('repmanage');
  });
  await page.evaluate(require('./coaching-ack-browser-fixture.cjs'));
  await page.waitForTimeout(300);
  const v=page.locator('#reps-v2');assert.equal(await v.count(),1,'새 목록');
  assert.equal(await page.locator('#rep-management-root .rm-control-board,#rep-management-root .rm-person-card,#rep-management-root .rm-intervention-strip').count(),0,'예전 카드 없음');
  assert.equal(await v.locator('.plv-owners').count(),0,'담당자별 칩 줄 없음');
  const n=await page.evaluate(()=>REP_MANAGER_ROWS.length);assert.ok(n>=3,'본사 영업사원 '+n+'명');
  assert.match((await v.locator('.plv-pills button').allInnerTexts()).join('|'),new RegExp('^전체 '+n+'\\|관리자 확인 필요 \\d+\\|확인 필요 \\d+\\|여유 \\d+$'));
  /* 기준 한 가지: 공통 기준 띠·접기 글자 없음, 기준 문구 한 번, 0건 알약은 회색 */
  assert.equal(await page.locator('#pg-repmanage .pm-strip').count(),0,'파이프라인 공통 기준 띠 없음');
  assert.equal(await v.locator('.pd-toggle').count(),0,'단계 진단 접기 글자 없음');
  assert.match(await v.locator('.rv-basis').innerText(),new RegExp('^영업사원 '+n+'명 · .+ 기준'));assert.equal(await v.locator('.rv-basis').count(),1);
  assert.equal(await v.locator('.plv-pills button').evaluateAll(a=>a.every(b=>(/ 0$/.test(b.innerText.trim()))===b.classList.contains('zero'))),true,'0건 알약만 회색');
  /* 진단 */
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['전체 진행','가중 예상','확정 임박','조치 필요']);
  assert.match(await v.locator('.pd-kpis').innerText(),/전체 진행\s*17억\s*3건/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['어디서 막혔나','누가 일이 몰렸나','이번 주 진전']);
  assert.match(await v.locator('.pd-card').nth(0).innerText(),/첫 연락 전\s*3/);
  assert.match(await v.locator('.pd-card').nth(1).innerText(),/이필선\s*12[\s\S]*황윤선\s*5/);
  assert.match(await v.locator('.pd-action').innerText(),/관리자가 할 일[\s\S]*이필선 첫 연락 전 3건[\s\S]*약속 등록/);
  /* 묶음 표: 한 줄 = 한 사람 */
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['이름 · 소속','상태','Pipeline','계약완료','첫 연락 전','막힌 곳','업무량','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['관리자 확인 필요','확인 필요','여유']);
  assert.equal(await v.locator('.plv-row').count(),n);
  const first=v.locator('.plv-row').first();assert.equal(await first.getAttribute('data-rep'),'이필선','문제 많은 사람부터');
  assert.match(await first.innerText(),/이필선[\s\S]*본사 영업[\s\S]*관리자 확인 필요[\s\S]*12억[\s\S]*3건[\s\S]*업무 보기/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 사람별 창 */
  await first.locator('.plv-site').click();await page.waitForTimeout(200);
  const d=page.locator('#repsDialog.on .rd-box');assert.equal(await d.count(),1);assert.equal(await page.evaluate(()=>document.getElementById('perfDrawer')?.classList.contains('on')||false),false,'예전 드로어는 열리지 않음');
  assert.match(await d.locator('.rd-head').innerText(),/이필선[\s\S]*관리자 확인 필요/);
  assert.equal(await d.evaluate(x=>getComputedStyle(x.querySelector('.rd-body')).gridTemplateColumns.split(' ').length),2);
  assert.equal(await d.locator('[role=tab],.rm-drawer-tabs').count(),0,'탭 없음');
  assert.match(await d.locator('.rd-diag').innerText(),/신규 배정 중 3건이 아직 첫 연락 전/);
  assert.deepEqual(await d.locator('.rd-flow span').allInnerTexts(),['배정','응대','기회','경쟁','수주']);
  assert.match(await d.locator('.rd-three').innerText(),/Pipeline\s*12억[\s\S]*조치 필요\s*\d+건[\s\S]*업무량/);
  assert.match(await d.locator('.rd-right').innerText(),/지금 처리할 현장[\s\S]*금액 큰 순[\s\S]*기한 지난 큰 현장[\s\S]*12일 지남[\s\S]*9억[\s\S]*처리[\s\S]*이필선 현장 전체보기/);
  assert.equal(await d.locator('.rd-row').first().locator('b').innerText(),'기한 지난 큰 현장','금액 큰 순');
  if(shot)await page.screenshot({path:shot+'-dialog.png'});
  /* 이번 주 약속 = 기존 관리자 약속 저장 */
  await d.locator('.rd-promise textarea').fill('금요일까지 신규 배정 첫 연락 완료');await d.locator('[data-rd="save"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>__commentCalls.map(x=>[x[0],x[1].rep_name,x[1].comment])),[['crm_rep_manager_comment_save_v1','이필선','금요일까지 신규 배정 첫 연락 완료']]);assert.equal(await page.evaluate(()=>__writes.length),0);
  assert.equal(await page.locator('#repsDialog.on .rd-promise textarea').inputValue(),'금요일까지 신규 배정 첫 연락 완료');assert.match(await page.locator('#repsDialog .rd-promise small').innerText(),/저장됨/);
  assert.match(await page.locator('#reps-v2 .pd-action').innerText(),/약속 수정[\s\S]*이번 주 약속 · 금요일까지/);
  /* 현장 줄 → 창을 닫고 그 현장의 파이프라인 상세 */
  await page.locator('#repsDialog .rd-row').first().click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__open),'d1');assert.equal(await page.locator('#repsDialog.on').count(),0);
  /* 현장 전체보기 → 오늘 업무 + 이 담당자 필터 */
  await page.locator('#reps-v2 .plv-row').first().locator('.plv-cta').click();await page.waitForTimeout(200);
  await page.locator('#repsDialog [data-rd="all"]').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>G.page+'|'+SalesScope.state().owner),'today|이필선');
  /* 더보기: 팀 비교(기존 화면) · 계정 관리 */
  await page.evaluate(()=>{CommonFilterBar.setOwner('전체');goPage('repmanage');});await page.waitForTimeout(250);
  await page.locator('#reps-v2 .av-more summary').click();await page.locator('#reps-v2 [data-rv="account"]').click();assert.equal(await page.evaluate(()=>window.__account),1);
  await page.locator('#reps-v2 .av-more summary').click();await page.locator('#reps-v2 [data-rv="team"]').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#rep-management-root .rm-team-board').count(),1,'팀 비교는 기존 화면 그대로');
  await page.evaluate(()=>repManagerView('people'));await page.waitForTimeout(200);assert.equal(await page.locator('#reps-v2').count(),1);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.repsV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#reps-v2').count(),0);assert.equal(await page.locator('#rep-management-root .rm-control-board').count(),1,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',list_frame:true,diagnosis:true,one_row_per_person:true,dialog_no_tabs:true,promise_saved_existing_path:true,row_opens_pipeline_detail:true,view_all_filters_today:true,more_menu_team_account:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
