'use strict';
/* 주간 브리핑 v2 검사(2026-10-01 디자인 핸드오프 brief): 숫자 4 · 카드 3 · 지난주 판정(누르면 이동) + 잔디 카드 · 회의 안건 · 담당자 주간 현황(→ 영업사원 창) · 회의 모드.
   집계는 기존 주간 브리핑과 같은 함수. 스냅샷·AI·잔디 발송은 구조 확인 뒤(다시 보내기 잠김). 월간 일정 탭은 기존 그대로. 끄면 예전 화면 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.BriefV2&&window.RepsV2&&window.PipelineDiagnosis&&typeof paintBrief==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,days)=>({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site:'신규 문의 '+n,status:owner?'배정완료':'접수',at:at(-days),created_at:at(-days),brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(-days+0.2):null});
   B={deals:[
     deal('d1','기한 지난 큰 현장','이필선','consulting',{amt:9e8,next_action:{id:'n1',text:'견적 확인',due:day(-12),status:'open'}}),
     deal('d2','할 일 없는 현장','이필선','sent',{amt:3e8}),
     deal('d3','정상 현장','황윤선','compete',{amt:5e8,created:day(-10),updated:day(-1),next_action:{id:'n3',text:'PT 준비',due:day(1),status:'open'},activities:[{id:'a3',type:'전화',note:'통화',at:at(-1)}]})],
    inquiries:[inq(1,'',1),inq(2,'이필선',9),inq(3,'이필선',10)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.briefView='week';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   goPage('brief');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#brief-v2');assert.equal(await v.count(),1,'새 화면');
  assert.equal(await page.locator('#b-week .brief-command,#b-week .brief-frame').count(),0,'예전 01~05 섹션 없음');
  assert.match(await v.locator('.plv-intro').innerText(),/주간 브리핑[\s\S]*\d+월 \d+일[\s\S]*매주 월요일 08:30 자동 생성 → 잔디 발송/);
  assert.equal(await v.locator('.bv-week select').isDisabled(),true,'지난 주차 보기는 스냅샷 저장 뒤');
  /* 숫자 4 · 카드 3 */
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['지난주 수주','신규 유입','진행 Pipeline','위험 현장']);
  assert.match(await v.locator('.pd-kpis').innerText(),/지난주 수주\s*0건[\s\S]*진행 Pipeline\s*3건 · 17억[\s\S]*가중 예상[\s\S]*위험 현장\s*2건/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['지난주 무엇이 움직였나','이번 주 꼭 할 일','어디가 위험한가']);
  assert.match(await v.locator('.pd-card').nth(2).innerText(),/미배정[\s\S]*1[\s\S]*최초 미응대[\s\S]*2[\s\S]*다음 할 일 없음[\s\S]*1[\s\S]*기한초과[\s\S]*1/);
  assert.equal(await v.locator('.bv-list').count(),3,'이번 주 꼭 할 일 — 펼쳐 보는 목록 3개');
  /* 판정 + 잔디 카드 */
  const lines=await v.locator('.bv-line').allInnerTexts();
  assert.match(lines[0],/지난주 수주 0건 · 단계 진전 0건 — 판단할 근거가 없음[\s\S]*→ 관리팀 KPI/);
  assert.ok(lines.some(t=>/위험 현장 2건[\s\S]*→ 위험 현장/.test(t)),lines.join(' | '));
  assert.equal(await v.locator('.bv-line.r').count()>=1,true,'위험 = 빨강 띠');
  assert.match(await v.locator('.bv-jandi').innerText(),/잔디 발송[\s\S]*\[주간 영업 브리핑\][\s\S]*CRM에서 열기[\s\S]*매주 월요일 08:30[\s\S]*다음 발송[\s\S]*\(월\) 08:30[\s\S]*자동화 연결 전/);
  assert.equal(await v.locator('.bv-jandi button',{hasText:'지금 다시 보내기'}).isDisabled(),true,'발송은 구조 확인 뒤');
  /* 회의 안건 = 과제 카드 */
  assert.match(await v.locator('.pd-action').innerText(),/이번 주 회의 안건[\s\S]*지난주 수주 0 · 진전 0[\s\S]*신규 미응대 2건[\s\S]*이필선 2[\s\S]*미배정 1건/);
  /* 담당자 주간 현황 */
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['담당','지난주 수주','진행 Pipeline','가중 예상','이번 주 일정','진전','위험','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['이번 주 챙길 사람','이상 없음']);
  assert.equal(await v.locator('.plv-row').first().getAttribute('data-rep'),'이필선','위험 많은 순');
  assert.match(await v.locator('.plv-row').first().innerText(),/이필선[\s\S]*2건 · 12억[\s\S]*2[\s\S]*이 사람 보기/);
  if(shot)await page.screenshot({path:shot+'-brief.png',fullPage:true});
  await v.locator('.plv-row').first().locator('.plv-cta').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#repsDialog.on').count(),1,'이 사람 보기 → 영업사원 창');await page.locator('#repsDialog [data-rd="close"]').click();
  /* 회의 모드 */
  await v.locator('[data-bv="meeting"]').click();await page.waitForTimeout(150);
  assert.match(await page.locator('#bvMeeting').innerText(),/주간 영업회의[\s\S]*지난주 판정[\s\S]*판단할 근거가 없음[\s\S]*이번 주 안건[\s\S]*신규 미응대 2건/);
  if(shot)await page.screenshot({path:shot+'-meeting.png'});
  await page.keyboard.press('Escape');assert.equal(await page.locator('#bvMeeting').count(),0);
  /* 판정 문장 → 해당 화면 */
  await v.locator('.bv-line').first().click();await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>G.page),'mgmt','근거 없음 → 관리팀 KPI');
  /* 월간 일정 탭은 기존 그대로 */
  await page.evaluate(()=>{goPage('brief');setBriefView('month');});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('b-week')).display+'|'+getComputedStyle(document.getElementById('b-month')).display),'none|block');
  await page.evaluate(()=>setBriefView('week'));await page.waitForTimeout(250);assert.equal(await page.locator('#brief-v2').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>__writes),[],'이 화면은 저장하지 않는다');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.briefV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#brief-v2').count(),0);assert.equal(await page.locator('#b-week .brief-frame').count()>0,true,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',kpis_cards:true,verdict_links:true,jandi_card_locked:true,agenda:true,rep_table_opens_dialog:true,meeting_mode:true,month_tab_legacy:true,no_writes:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
