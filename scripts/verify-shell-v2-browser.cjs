'use strict';
/* 공통 셸 v2 + CRM에게 묻기 v2 검사(2026-10-02 핸드오프 shell):
   ① 사이드바(로고 · 아이콘 없음 · 숫자 글자 · 선택 연파랑) ② 툴바(묻기 · 새 영업 · 상태 알약 하나 · 사용자 메뉴) ③ 한 줄 필터(연도·분기는 기간이 필요한 화면 안)
   ④ 공통 기준 띠 · 파란 안내 띠 없음(대시보드 묶음은 유지) ⑤ 묻기: 자주 묻는 것 5 · 조건 칩(✕ = 다시 찾기) · 결과 → 상세 · 읽기 전용. 끄면 예전 틀 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ShellV2&&window.AskV2&&window.BriefV2&&window.CommonFilterBar&&typeof paint==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   B={deals:[
     deal('d1','[서울 강동] 롯데캐슬퍼스트 옥상 방수','이필선','consulting',{amt:9e8,last_meaningful_contact_at:at(-45),activities:[{id:'a1',type:'전화',note:'통화',at:at(-45)}]}),
     deal('d2','[경기 평택] 비전지웰푸르지오','이필선','sent',{amt:3e8,manager_name:'김소장',manager_mobile:'01012345678',last_meaningful_contact_at:at(-20),activities:[{id:'a2',type:'전화',note:'통화',at:at(-20)}],next_action:{id:'n2',type:'전화',text:'견적 검토 확인',due:day(0),status:'open'}}),
     deal('d3','[서울 도봉] 창동동아그린','황윤선','compete',{amt:5e8,created:day(-10),updated:day(-1),manager_name:'박소장',manager_mobile:'01099998888',last_meaningful_contact_at:at(-1),next_action:{id:'n3',type:'방문',text:'PT 준비',due:day(1),status:'open'},activities:[{id:'a3',type:'전화',note:'통화',at:at(-1)}]})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req';};
   window.__calls=[];CRMPassword={open:()=>__calls.push('password')};exportFullDataJSON=()=>__calls.push('export');runDiag=()=>__calls.push('diag');authSignOut=()=>__calls.push('logout');loadData=async()=>{__calls.push('reload');};
   authBadge();goPage('today');
  });
  await page.waitForTimeout(400);
  const vis=sel=>page.evaluate(s=>{const n=document.querySelector(s);return !!n&&getComputedStyle(n).display!=='none';},sel);
  /* ① 사이드바 */
  assert.equal(await page.evaluate(()=>document.body.classList.contains('shell-v2')),true);
  assert.equal(await page.locator('aside.side .sh-logo img').count(),1,'넷폼 로고');assert.equal(await page.evaluate(()=>{const i=document.querySelector('.sh-logo img');return i.complete&&i.naturalWidth>0;}),true,'로고 파일이 실제로 뜬다');
  assert.equal(await vis('aside.side .brandlogo .bx'),false,'파란 N 없음');assert.equal(await vis('aside.side .mi .ic'),false,'아이콘 없음');assert.equal(await vis('#sideFoot'),false,'아래 조치 필요 카드 없음');
  assert.equal(await page.evaluate(()=>{const b=getComputedStyle(document.getElementById('todayBadge'));return b.backgroundColor+'|'+b.color;}),'rgba(0, 0, 0, 0)|rgb(229, 72, 77)','처리할 수 = 빨간 글자(둥근 배지 아님)');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.mi[data-p="pipe"] .badge')).color),'rgb(156, 163, 175)','그 밖의 숫자는 회색');
  assert.equal(await page.evaluate(()=>{const s=getComputedStyle(document.querySelector('.mi.on'));return s.backgroundColor+'|'+s.color;}),'rgb(238, 243, 254)|rgb(42, 82, 184)','선택 = 연파랑 + 파랑 글자');
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.menu .sec[data-sh]')].map(s=>s.dataset.sh)),['고객','조직','데이터']);
  assert.equal(await page.locator('#pipeline-stage-menu .plv-mi').count(),7,'단계 7개');
  if(shot)await page.screenshot({path:shot+'-1-sidebar.png'});
  /* ② 툴바 */
  assert.equal(await page.evaluate(()=>{const h=document.querySelector('.mhead').getBoundingClientRect(),a=document.getElementById('ptitle').getBoundingClientRect(),b=document.getElementById('psub').getBoundingClientRect();return Math.round(h.height)===60&&b.left>a.right&&Math.abs(a.bottom-b.bottom)<8;}),true,'60px · 제목과 설명이 같은 줄');
  assert.deepEqual(await page.evaluate(()=>['#live','#syncBadge','.mhead>.rf','#meChip'].map(s=>{const n=document.querySelector(s);return !n||getComputedStyle(n).display==='none';})),[true,true,true,true],'예전 상태·새로고침·JSON·사용자 줄은 감춤');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#shTools>*')].map(n=>n.id||n.className.split(' ')[0]).join(',')),'execAskBtn,shNew,sh-div,shStatus,ib,sh-userwrap','오른쪽 순서');
  await page.evaluate(()=>{const l=document.getElementById('live');l.textContent='데이터 최신';l.classList.add('on');});await page.waitForTimeout(100);
  assert.match(await page.locator('#shStatus.ok').innerText(),/^최신 · 방금$/);await page.locator('#shStatus').click();assert.deepEqual(await page.evaluate(()=>__calls),['reload'],'정상 = 누르면 새로고침');
  await page.evaluate(()=>{const b=document.getElementById('syncBadge');b.textContent='🔴 저장 실패 2건 · 내역 확인';b.className='syncbadge bad';b.onclick=()=>__calls.push('review');});await page.waitForTimeout(100);
  assert.equal(await page.locator('#shStatus.bad').innerText(),'저장 실패 2건');await page.locator('#shStatus').click();assert.equal(await page.evaluate(()=>__calls.at(-1)),'review','실패 = 누르면 기존 내역 · 다시 저장');
  await page.evaluate(()=>{const b=document.getElementById('syncBadge');b.textContent='🟢 서버 동기화 완료';b.className='syncbadge ok';b.onclick=null;});
  assert.match(await page.locator('#shUser').innerText(),/송보람\s*관리자/);await page.locator('#shUser').click();
  assert.deepEqual(await page.locator('#shMenu button').allInnerTexts(),['비밀번호 변경','데이터 내보내기 (JSON)','연결 점검','로그아웃']);
  if(shot)await page.screenshot({path:shot+'-2-toolbar.png'});
  for(const [t,k] of [['비밀번호 변경','password'],['데이터 내보내기 (JSON)','export'],['로그아웃','logout']]){if(await page.locator('#shMenu').isHidden())await page.locator('#shUser').click();await page.locator('#shMenu button',{hasText:t}).click();assert.equal(await page.evaluate(()=>__calls.at(-1)),k,t+' = 기존 함수');assert.equal(await page.locator('#shMenu').isHidden(),true);}
  /* ③ 한 줄 필터: 예전 두 줄(#unibar)은 감추고, 기간은 필요한 화면에만 */
  for(const [p,period,owner] of [['brief',true,true],['mgmt',true,true],['work',true,true],['report',false,true],['repmanage',false,false]]){
   await page.evaluate(p=>goPage(p),p);await page.waitForTimeout(350);
   assert.equal(await page.locator('#pg-'+p+'>.cf-bar:not([hidden])').count(),1,p+' 한 줄 필터');assert.equal(await vis('#unibar'),false,p+' 예전 두 줄 필터 감춤');
   assert.equal(await page.locator('#pg-'+p+'>.cf-bar [data-cf="period"]').count(),period?1:0,p+' 기간 선택');assert.equal(await page.locator('#pg-'+p+'>.cf-bar [data-cf="owner"]').count(),owner?1:0,p+' 담당자 선택');
   assert.equal(await vis('.mhead>.search'),false,p+' 상단 검색칸 없음');
  }
  await page.evaluate(()=>(G.briefBOff=true,goPage('brief')));await page.waitForTimeout(300);
  const bar=page.locator('#pg-brief>.cf-bar');
  assert.deepEqual(await bar.locator('[data-cf="owner"] optgroup').evaluateAll(a=>a.map(o=>o.label)).then(a=>a.filter(x=>x==='내부직원').length),1,'담당자 구분은 선택 안의 묶음 머리');
  await bar.locator('[data-cf="owner"]').selectOption('이필선');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>G.rep),'이필선','담당자 = 기존 공통 상태');
  await bar.locator('[data-cf="clear"]').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>G.rep),'전체');
  const y=String(new Date().getFullYear());await bar.locator('[data-cf="period"]').selectOption(y+'|3');await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>[String(G.year),G.quarter]),[y,3],'기간 = 기존 연도 · 분기 상태');
  await bar.locator('[data-cf="period"]').selectOption('전체|0');await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>[String(G.year),G.quarter]),['전체',0]);
  await bar.locator('[data-sf-brand="POUR솔루션"]').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>G.brand),'POUR솔루션','브랜드 = 기존 공통 상태');await page.locator('#pg-brief>.cf-bar [data-sf-brand="전체"]').click();await page.waitForTimeout(200);
  if(shot)await page.screenshot({path:shot+'-3-filter.png'});
  /* ④ 지울 것: 공통 기준 띠 · 파란 안내 띠 (대시보드 묶음은 유지) */
  assert.equal(await page.locator('#pg-brief .pm-strip').count(),0);assert.equal(await vis('#pg-brief>.mgmtbar.blue'),false);
  await page.evaluate(()=>goPage('mgmt'));await page.waitForTimeout(300);assert.equal(await vis('#pg-mgmt>.mgmtbar.blue'),false,'관리팀 KPI 파란 안내 띠 없음');
  await page.evaluate(()=>goPage('dash'));await page.waitForTimeout(400);assert.equal(await page.locator('#pg-dash>.cf-bar:not([hidden])').count(),0,'영업 대시보드는 그대로');
  if(shot)await page.screenshot({path:shot+'-4-dash.png'});
  /* ⑤ CRM에게 묻기 */
  await page.evaluate(()=>goPage('today'));await page.waitForTimeout(300);
  await page.keyboard.press('Control+k');await page.waitForTimeout(200);
  const ask=page.locator('#askDialog.on .ak-box');assert.equal(await ask.count(),1,'Ctrl K = 묻기');assert.equal(await page.evaluate(()=>document.activeElement.id),'akInput','입력에 바로 포커스');
  assert.equal(await page.evaluate(()=>Math.round(document.querySelector('.ak-box').getBoundingClientRect().width)),640);assert.equal(await page.locator('#execAskModal.on').count(),0,'예전 창은 뜨지 않음');
  assert.deepEqual(await ask.locator('.ak-faq button span').allInnerTexts(),['이필선 담당 중 30일 넘게 연락 안 한 곳','오늘 전화해야 하는 곳','1억 넘는데 다음 할 일 없는 곳','견적 보내고 2주 넘게 멈춘 곳','소장 번호 없는 아파트']);
  assert.deepEqual(await ask.locator('.ak-faq button em').allInnerTexts(),['1곳','1곳','1곳','1곳','1곳'],'건수는 실제 자료로 센다');
  assert.match(await ask.locator('.ak-note').innerText(),/읽기 전용 · 질문을 검색 조건으로 바꿔 실제 데이터만 보여줘요/);
  if(shot)await page.screenshot({path:shot+'-5-ask-faq.png'});
  await ask.locator('.ak-faq button').first().click();await page.waitForTimeout(150);
  assert.deepEqual(await ask.locator('.ak-chip').evaluateAll(a=>a.map(c=>c.firstChild.textContent)),['담당 이필선','마지막 연락 30일 이상','진행 중'],'이렇게 찾았어요 = 조건 칩');
  assert.match(await ask.locator('.ak-sum').innerText(),/^1곳 · 진행 금액 9억이 멈춰 있어요$/);
  assert.match(await ask.locator('.ak-row').first().innerText(),/롯데캐슬퍼스트[\s\S]*컨설팅[\s\S]*마지막 연락 45일 전[\s\S]*45일/);
  if(shot)await page.screenshot({path:shot+'-5-ask-result.png'});
  await ask.locator('.ak-chip button').nth(1).click();await page.waitForTimeout(150);
  assert.deepEqual(await ask.locator('.ak-chip').evaluateAll(a=>a.map(c=>c.firstChild.textContent)),['담당 이필선','진행 중']);assert.match(await ask.locator('.ak-sum').innerText(),/^2곳/,'✕ = 그 조건을 빼고 바로 다시 찾기');
  /* 직접 묻기(Enter) · 조건으로 못 바꾸는 질문 */
  await page.locator('#akInput').fill('오늘 전화해야 하는 곳');await page.keyboard.press('Enter');await page.waitForTimeout(150);
  assert.match(await ask.locator('.ak-row').first().innerText(),/비전지웰푸르지오[\s\S]*견적 검토 확인/);assert.equal(await ask.locator('.ak-row').count(),1);
  await page.locator('#akInput').fill('우주에서 제일 좋은 현장');await ask.locator('[data-ak="go"]').click();await page.waitForTimeout(150);
  assert.match(await ask.locator('.ak-miss').innerText(),/이 질문은 아직 조건으로 못 바꿨어요 · 이렇게 물어보세요/);assert.equal(await ask.locator('.ak-faq button').count(),5);
  /* 결과 행 → 그 건 상세 · 쓰기 없음 */
  await ask.locator('.ak-faq button').nth(3).click();await page.waitForTimeout(150);assert.deepEqual(await ask.locator('.ak-chip').evaluateAll(a=>a.map(c=>c.firstChild.textContent)),['단계 자료 발송완료','마지막 연락 14일 이상','진행 중']);
  await ask.locator('.ak-row').first().click();await page.waitForTimeout(500);
  assert.equal(await page.locator('#askDialog.on').count(),0);assert.equal(await page.evaluate(()=>!!CUR_DETAIL&&CUR_DETAIL.item.id),'d2','행 = 그 건 상세');
  assert.deepEqual(await page.evaluate(()=>__writes.map(w=>w[0]).filter(x=>x!=='opportunity_touch')),[],'묻기는 읽기 전용(상세를 연 열람 기록만 기존대로)');
  await page.evaluate(()=>closeDetail&&closeDetail());
  /* Esc 로 닫기 */
  await page.keyboard.press('Control+k');await page.waitForTimeout(150);await page.keyboard.press('Escape');assert.equal(await page.locator('#askDialog.on').count(),0);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.shellV2Off=true;G.askV2Off=true;(G.briefBOff=true,goPage('brief'));});await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('shell-v2')),false);assert.equal(await vis('#syncBadge'),true);assert.equal(await vis('#unibar'),true,'끄면 예전 두 줄 필터');assert.equal(await page.locator('#pg-brief>.cf-bar:not([hidden])').count(),0);
  await page.evaluate(()=>openExecAsk());await page.waitForTimeout(150);assert.equal(await page.locator('#execAskModal.on').count(),1,'끄면 예전 묻기 창');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',sidebar:true,toolbar_status_pill:true,user_menu_existing_actions:true,one_line_filter_period_in_page:true,strips_removed_dashboard_kept:true,ask_faq_chips_readonly:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
