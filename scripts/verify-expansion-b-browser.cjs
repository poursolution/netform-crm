'use strict';
/* 확장관리 B안 검사(2026-10-03 "파이프라인 기준으로"): 왼쪽 사후관리 진단(막대 3칸 · 숫자 3 · 사유 · 할 일) / 오른쪽 확인할 현장(리스트 · 보드) · 정렬은 빨강 사유 순 · 열기는 기존 v2 상세창 · 끄면 v2 묶음 표 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ExpansionB&&window.StageBoard&&window.ExpansionV2&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),Y=new Date().getFullYear();
   const won=(id,site,owner,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-200),code:'won',stage_code:'won',outcome:'won',won_amount:5e6,closed_at:day(-60),completion_date:day(-60)},extra||{});
   B={deals:[won('w1','이천신둔코아루','한준엽'),won('w2','[서울 강서] 마곡청구아파트','황윤선',{won_amount:82e6}),won('w3','시범현대아파트','이필선',{brand:'석민이앤씨'}),won('w4','니즈 확인된 현장','황윤선'),won('w5','보류 현장','이필선'),won('w6','작년 준공 현장','이필선',{completion_date:(Y-1)+'-05-10',closed_at:(Y-1)+'-05-10'}),won('w7','오래된 접촉 현장','김성민',{completion_date:day(-120),closed_at:day(-120)})],
    inquiries:[],activities:[],inquiryTrash:[],
    expansion_pool:[
     {id:'e1',source_opportunity_id:'w1',site_name:'이천신둔코아루',owner_name:'한준엽',completion_date:day(-60),next_contact_at:day(-2),expansion_status:'신규 대상',candidate_work_items:['타공종 확인','유지보수 확인'],version:1},
     {id:'e2',source_opportunity_id:'w2',site_name:'[서울 강서] 마곡청구아파트',owner_name:'황윤선',source_work_summary:'옥상 방수',source_won_amount:82e6,completion_date:day(-60),next_contact_at:day(5),last_contact_at:day(-7),expansion_status:'접촉 예정',candidate_work_items:['지하주차장','재도장'],version:1},
     {id:'e3',source_opportunity_id:'w3',site_name:'시범현대아파트',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:4e6,completion_date:day(-60),next_contact_at:day(40),last_contact_at:day(-10),expansion_status:'관계 관리중',candidate_work_items:['재도장'],version:1},
     {id:'e4',source_opportunity_id:'w4',site_name:'니즈 확인된 현장',owner_name:'황윤선',source_work_summary:'재도장',source_won_amount:3e7,completion_date:day(-60),next_contact_at:day(20),last_contact_at:day(-3),expansion_status:'추가 니즈 확인',need_note:'지하주차장 에폭시 견적 요청',version:1},
     {id:'e5',source_opportunity_id:'w5',site_name:'보류 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:day(-60),next_contact_at:day(90),expansion_status:'보류/휴면',version:1},
     {id:'e6',source_opportunity_id:'w6',site_name:'작년 준공 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:(Y-1)+'-05-10',next_contact_at:day(3),expansion_status:'신규 대상',version:1},
     {id:'e7',source_opportunity_id:'w7',site_name:'오래된 접촉 현장',owner_name:'김성민',source_work_summary:'옥상 방수',source_won_amount:2e7,completion_date:day(-120),next_contact_at:day(10),last_contact_at:day(-75),expansion_status:'관계 관리중',version:1}],
    expansion_events:[{source_opportunity_id:'w2',occurred_at:day(-7),kind:'접촉',note:'관리소장 통화 — 하자 없음',actor:'황윤선'}],expansion_quote_dispatches:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.expansionYear=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p.expansion_status,p.next_contact_at]);return 'req';};
   window.__info=[];SB={rpc:async(name,args)=>{if(name==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};if(name==='crm_expansion_info_update_v1'){__info.push(args.p);return {data:{ok:true,source_opportunity_id:args.p.source_opportunity_id,expansion_record_id:'x1',field:args.p.field,value:args.p.value}};}return {data:{ok:true,event:{source_opportunity_id:args.p.source_opportunity_id,occurred_at:new Date().toISOString(),kind:'접촉·니즈',note:args.p.note,actor:'송보람'}}};}};TOKEN='test';
   window.__new=null;expansionOpenNew=id=>{window.__new=id;};
   goPage('expansion');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#expansion-b');assert.equal(await v.count(),1,'B안 보드');assert.equal(await page.locator('#expansion-v2').count(),0,'v2 묶음 표는 없음');
  assert.equal(await page.locator('#pg-expansion>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'확장관리');
  const Y=new Date().getFullYear();
  /* 준공연도(2026-10-05 design_handoff_expansion_year): '● 준공연도' 바로 옆 같은 줄 둥근 알약 → 구분선 → 사후 연락 기준 · 관계 연락 주기. 선택 = 검정 · 0건 = 흐리게 */
  const one=s=>String(s).replace(/\s+/g,' ').trim(),pills=()=>page.locator('#expansion-b .xb-ypills button').evaluateAll(l=>l.map(b=>b.innerText.replace(/\s+/g,' ').trim()));
  assert.deepEqual(await pills(),['전체 7',Y+' 6',(Y-1)+' 1',(Y-2)+' 0','이전 0']);
  assert.deepEqual(await v.locator('.xb-yrow').evaluate(n=>[...n.children].map(c=>c.className.split(' ')[0])),['xb-yl','xb-ypills','xb-ydiv','xb-rule','xb-rule'],'한 줄: 준공연도 · 알약 · 구분선 · 기준 2개');
  assert.equal(one(await v.locator('.xb-yrow').innerText()).startsWith('준공연도 전체 7'),true);assert.equal(await v.locator('.plv-pills,.xb-years').count(),0,'오른쪽 끝에 붙던 예전 버튼 줄은 없다');
  assert.deepEqual(await v.locator('.xb-ypills button').evaluateAll(l=>l.map(b=>{const s=getComputedStyle(b);return [b.getAttribute('aria-pressed'),s.borderRadius,s.backgroundColor,s.opacity];})),[['false','999px','rgb(255, 255, 255)','1'],['true','999px','rgb(21, 23, 28)','1'],['false','999px','rgb(255, 255, 255)','1'],['false','999px','rgb(255, 255, 255)','0.45'],['false','999px','rgb(255, 255, 255)','0.45']],'둥근 알약 · 선택만 검정 · 0건은 흐리게');
  assert.deepEqual(await v.locator('.xb-yrow').evaluate(n=>{const a=n.querySelector('.xb-yl').getBoundingClientRect(),b=n.querySelector('.xb-ypills').getBoundingClientRect(),c=n.querySelector('.xb-rule').getBoundingClientRect();return [Math.abs((a.top+a.height/2)-(b.top+b.height/2))<6,b.left-a.right<20,c.left>b.right,Math.abs((c.top+c.height/2)-(b.top+b.height/2))<8];}),[true,true,true,true],"'● 준공연도' 바로 옆 같은 줄 · 기준은 같은 줄 오른쪽");
  /* '전체' = 위 브랜드 칩 건수(브랜드 칩은 연도와 무관하게 센다) · 건수는 지금 브랜드 · 담당 필터 기준 */
  assert.match(one(await page.locator('#pg-expansion>.cf-bar .cf-pill').first().innerText()),/^전체 7$/,'브랜드 칩 전체 = 준공연도 전체');
  await page.locator('#pg-expansion>.cf-bar [data-sf-brand="석민이앤씨"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await pills(),['전체 1',Y+' 1',(Y-1)+' 0',(Y-2)+' 0','이전 0'],'브랜드를 고르면 그 브랜드 기준으로 다시 센다');assert.match(one(await page.locator('#pg-expansion>.cf-bar [data-sf-brand="석민이앤씨"]').innerText()),/석민이앤씨 1$/);
  await page.locator('#pg-expansion>.cf-bar [data-sf-brand="전체"]').click();await page.waitForTimeout(300);
  await page.evaluate(()=>{SalesScope.change('owner','이필선');SalesFilterState.sync();paint();});await page.waitForTimeout(300);
  assert.deepEqual(await pills(),['전체 3',Y+' 2',(Y-1)+' 1',(Y-2)+' 0','이전 0'],'담당을 고르면 그 담당 기준');assert.match(one(await page.locator('#pg-expansion>.cf-bar .cf-pill').first().innerText()),/^전체 3$/);
  await page.evaluate(()=>{SalesScope.change('owner','전체');SalesFilterState.sync();paint();});await page.waitForTimeout(300);assert.deepEqual(await pills(),['전체 7',Y+' 6',(Y-1)+' 1',(Y-2)+' 0','이전 0']);
  /* [리스트 | 보드] = '확인할 현장 n곳' 제목 줄 오른쪽 끝 · 준공연도와 겹치지 않는다 · 연도를 고르면 제목 옆에 "○○년 준공만" */
  assert.deepEqual(await v.evaluate(n=>{const y=n.querySelector('.xb-yrow').getBoundingClientRect(),w=n.querySelector('.psb-views').getBoundingClientRect(),h=n.querySelector('.psb-lhead').getBoundingClientRect();return [w.top>=y.bottom,Math.abs(w.right-h.right)<2,n.querySelector('.psb-views').parentElement.classList.contains('psb-lhead')];}),[true,true,true]);
  assert.equal(one(await v.locator('.psb-lhead').innerText()),'확인할 현장 6곳 '+Y+'년 준공만 리스트 보드');
  /* 진단: 막대 3칸(사후 연락 · 니즈 확인 · 전환 · 보류) · 숫자 3개 · 사유 · 할 일 */
  assert.deepEqual((await v.locator('.psb-axis .leg button').allInnerTexts()).map(t=>t.replace(/\s+/g,' ')),['사후 연락 · 관계 유지 4','니즈 확인 1','보류 · 전환 완료 1']);
  assert.match(await v.locator('.psb-kpis').innerText(),/기준 넘김 \(빨강\)\s*2곳[\s\S]*니즈 확인\s*1곳[\s\S]*평균 준공 후\s*\d+일/);
  const reasons=await v.locator('.psb-reason span').allInnerTexts();
  assert.deepEqual(reasons,['다음 접촉일 지남','준공 후 사후 연락 안 함','관계 연락 주기 넘김','니즈 확인 → 전환 대기','공종 미분류'],'사유 순서 = 표 순서 '+JSON.stringify(reasons));
  assert.match(await v.locator('.psb-two .psb-box').nth(1).innerText(),/그래서 뭘 해야 하나[\s\S]*다음 접촉일 지남 1곳[\s\S]*준공 후 사후 연락 안 함 1곳[\s\S]*관계 연락 주기 넘김 1곳/);
  /* 현장: 빨강 사유 순(접촉일 지남 e1 → 2개월 연락 없음 e7) → 사유 수 */
  const order=await v.locator('.psb-row').evaluateAll(a=>a.map(n=>n.dataset.key));
  assert.deepEqual(order.slice(0,2),['e1','e7'],'빨강 먼저 '+JSON.stringify(order));
  assert.match(await v.locator('.psb-row[data-key="e1"]').innerText(),/이천신둔코아루[\s\S]*POUR솔루션 · 한준엽 · 500만[\s\S]*사후 연락[\s\S]*접촉 기록 없음[\s\S]*다음 접촉일 2일 지남[\s\S]*D\+60일[\s\S]*연락/);
  assert.match(await v.locator('.psb-row[data-key="e7"]').innerText(),/연락 없음 75일 · 기준 60일[\s\S]*D\+120일[\s\S]*관계 연락/);
  assert.match(await v.locator('.psb-row[data-key="e4"]').innerText(),/니즈 확인[\s\S]*니즈 지하주차장 에폭시 견적 요청[\s\S]*니즈 확인 → 전환 대기[\s\S]*전환/);
  assert.match(await v.locator('.psb-row[data-key="e5"]').innerText(),/보류 현장[\s\S]*보류[\s\S]*정상/);
  /* 줄 = 두 덩어리: 왼쪽(현장 · 브랜드 · 담당 · 금액 / 사후 연락) · 오른쪽(사유 150px · D+ 64px · 버튼 86px · 오른쪽 끝). 글자는 한 줄 */
  const geo=()=>page.locator('#expansion-b .psb-row[data-key="e1"]').evaluate(n=>{const L=n.querySelector('.xb-l').getBoundingClientRect(),R=n.querySelector('.xb-r'),r=R.getBoundingClientRect(),row=n.getBoundingClientRect(),w=k=>Math.round(R.querySelector(k).getBoundingClientRect().width),tops=[...R.children].map(c=>Math.round(c.getBoundingClientRect().top+c.getBoundingClientRect().height/2));
   return {disp:getComputedStyle(n).display,widths:[w('.xb-why'),w('.xb-d'),w('button')],right:Math.round(row.right-r.right),wrapped:r.top>=L.bottom-1,oneLine:Math.max(...tops)-Math.min(...tops)<=3,h:[...n.querySelectorAll('.xb-a b,.xb-a span,.xb-b span,.xb-why,.xb-d')].every(e=>e.getBoundingClientRect().height<22),leftColor:getComputedStyle(n).borderLeftWidth};});
  {const g=await geo();assert.equal(g.disp,'flex');assert.deepEqual(g.widths,[150,64,86]);assert.equal(g.right,16,'오른쪽 덩어리는 줄 오른쪽 끝');assert.equal(g.wrapped,false,'넓으면 한 줄');assert.equal(g.oneLine,true);assert.equal(g.h,true,'글자가 쪼개지지 않는다');assert.equal(g.leftColor,'3px');}
  assert.equal(await v.locator('.psb-row[data-key="e1"] .xb-why').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)','기준을 넘긴 사유는 빨강');
  /* 좁으면 오른쪽 덩어리가 통째로 다음 줄(사유 · D+ · 버튼은 한 줄 그대로) · 본문은 진단이 위로 */
  await page.setViewportSize({width:900,height:900});await page.waitForTimeout(250);
  {await page.evaluate(()=>{document.querySelector('#expansion-b .psb-list').style.width='520px';});await page.waitForTimeout(100);const g=await geo();await page.evaluate(()=>{document.querySelector('#expansion-b .psb-list').style.width='';});assert.equal(g.wrapped,true,'목록 폭이 좁으면(520px) 오른쪽 덩어리가 다음 줄');assert.equal(g.oneLine,true,'통째로');assert.deepEqual(g.widths,[150,64,86]);assert.equal(g.h,true);
   assert.deepEqual(await page.locator('#expansion-b').evaluate(n=>{const d=n.querySelector('.psb-diag').getBoundingClientRect(),m=n.querySelector('.psb-main').getBoundingClientRect();return [d.bottom<=m.top+1,Math.round(d.width)<=380];}),[true,true],'진단이 위로 · 최대 380px');}
  await page.setViewportSize({width:1600,height:1000});await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#expansion-b').evaluate(n=>{const d=n.querySelector('.psb-diag').getBoundingClientRect(),m=n.querySelector('.psb-main').getBoundingClientRect();return [Math.abs(d.top-m.top)<4,Math.round(d.width)<=380,m.width>d.width*2];}),[true,true,true],'넓으면 2단(진단 최대 380px · 목록이 나머지)');
  /* 사후 연락 기준을 화면에서 바꾼다(이 PC 저장) — 90일로 올리면 D+60 은 빨강에서 빠진다 */
  assert.equal(await v.locator('[data-xb-rule="afterCompletionDays"]').inputValue(),'30');
  await v.locator('[data-xb-rule="afterCompletionDays"]').selectOption('90');await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>OPS_RULES.afterCompletionDays),90);assert.doesNotMatch(await page.locator('#expansion-b .psb-row[data-key="e1"]').innerText(),/사후 연락 없음 · 기준/);
  await page.locator('#expansion-b [data-xb-rule="afterCompletionDays"]').selectOption('30');await page.waitForTimeout(200);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 필터: 막대 칸 · 사유 · 해제 · 보드 */
  await v.locator('.psb-axis .leg button').nth(1).click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),1);
  await page.locator('#expansion-b [data-sb="clear"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),6);
  await page.locator('#expansion-b .psb-reason[data-v="after30"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),1);
  await page.locator('#expansion-b [data-sb="clear"]').click();await page.waitForTimeout(150);
  await page.locator('#expansion-b [data-sb="view"][data-v="board"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-col').count(),3);assert.equal(await page.locator('#expansion-b .psb-card').count(),6);
  await page.locator('#expansion-b [data-sb="view"][data-v="list"]').click();await page.waitForTimeout(150);
  /* 준공연도 알약 */
  await page.locator('#expansion-b .xb-ypills [data-value="'+(Y-1)+'"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#expansion-b .psb-row').count(),1);
  assert.equal(one(await page.locator('#expansion-b .psb-lhead').innerText()),'확인할 현장 1곳 '+(Y-1)+'년 준공만 리스트 보드');assert.match(one(await page.locator('#pg-expansion>.cf-bar .cf-pill').first().innerText()),/^전체 7$/,'연도를 골라도 브랜드 칩은 그대로');
  await page.locator('#expansion-b .xb-ypills [data-value="이전"]').click();await page.waitForTimeout(150);assert.equal(one(await page.locator('#expansion-b .psb-lhead').innerText()),'확인할 현장 0곳 '+(Y-3)+'년 이전 준공만 리스트 보드');assert.equal(await page.locator('#expansion-b .xb-ypills [data-value="이전"]').evaluate(b=>getComputedStyle(b).opacity),'1','고른 알약은 0건이어도 또렷하게');
  await page.locator('#expansion-b .xb-ypills [data-value="전체"]').click();await page.waitForTimeout(150);assert.equal(one(await page.locator('#expansion-b .psb-lhead').innerText()),'확인할 현장 7곳 리스트 보드','전체면 안내 없음');
  await page.locator('#expansion-b .xb-ypills [data-value="'+Y+'"]').click();await page.waitForTimeout(150);
  if(shot)await page.screenshot({path:shot+'-year.png',fullPage:true});
  /* 열기 = 기존 v2 상세창 · 사유 버튼은 그 액션으로(연락 → 입력칸 포커스, 전환 → 기존 전환창) */
  await page.locator('#expansion-b .psb-row[data-key="e2"] .xb-a').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#expansionV2.on .xdv').count(),1,'v2 상세창');assert.match(await page.locator('#expansionV2 .xdv-top').innerText(),/마곡청구아파트/);
  /* 관리 정보 빈 칸 입력(2026-10-03): 현재 담당(관리자) · 준공일 = 서버 함수, 공종 = 기존 편집기 버튼, 계약일 · 수주 금액 = 계약실적 안내 */
  const facts=page.locator('#expansionV2 .xdv-facts');
  assert.match(await facts.innerText(),/현재 담당\s*황윤선\s*수정[\s\S]*당시 영업\s*황윤선[\s\S]*계약일\s*미입력 · 계약실적\(성과 분석\)에서 기록[\s\S]*준공일\s*\d{4}-\d{2}-\d{2}\s*수정[\s\S]*공종\s*옥상 방수 수정[\s\S]*수주 금액\s*8,200만/);
  await facts.locator('[data-xd="edit"][data-value="owner_name"]').click();await page.waitForTimeout(150);
  await page.locator('#expansionV2 [data-xd="editsel"]').selectOption('이필선');await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__info),[{source_opportunity_id:'w2',field:'owner_name',value:'이필선'}],'현재 담당 저장 = 서버 함수');
  assert.match(await page.locator('#expansionV2 .xdv-top').innerText(),/담당 이필선/,'저장 뒤 머리줄 갱신');
  /* 공종 입력 = 새 공종 창이 상세 위에(예전 창 아님) */
  await page.evaluate(()=>{window.Phase11={current:null,openWork:async(id,item)=>{Phase11.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async()=>{}};});
  await page.locator('#expansionV2 .xdv-facts [data-xd="editwork"]').click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#workDialog.on .wd-box').count(),1,'새 공종 창');assert.equal(await page.evaluate(()=>document.getElementById('newDealModal').classList.contains('on')),false,'예전 창은 뜨지 않음');
  assert.ok(await page.evaluate(()=>Number(getComputedStyle(document.getElementById('workDialog')).zIndex)>Number(getComputedStyle(document.getElementById('expansionV2')).zIndex)),'상세 위에 뜸');
  assert.match(await page.locator('#workDialog .wd-head').innerText(),/공종 수정[\s\S]*마곡청구아파트/);
  await page.locator('#workDialog [data-wd="close"]').first().click();await page.waitForTimeout(200);assert.equal(await page.locator('#expansionV2.on').count(),1,'닫으면 상세로');
  await page.locator('#expansionV2 .xdv-facts [data-xd="edit"][data-value="completion_date"]').click();await page.waitForTimeout(150);
  await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(await page.locator('#expansionV2 [data-xd="editinput"]').count(),0,'Esc = 취소');assert.equal(await page.locator('#expansionV2.on').count(),1,'창은 그대로');
  await page.locator('#expansionV2 .xdv-close').click();await page.waitForTimeout(150);
  await page.locator('#expansion-b .psb-row[data-key="e1"] [data-sb="act"]').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.matches('#expansionV2 .idv-input textarea')),true,'연락 → 기록 입력칸');
  await page.locator('#expansionV2 .xdv-close').click();await page.waitForTimeout(150);
  await page.locator('#expansion-b .psb-row[data-key="e4"] [data-sb="act"]').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>expansionRecords().find(r=>r.id===window.__new).sourceOpportunityId),'w4','전환 = 기존 전환창');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  /* 끄기: 준공연도 줄 · 목록 줄만 예전으로 */
  await page.evaluate(()=>{G.expansionYearRowOff=true;paint();});await page.waitForTimeout(250);
  assert.equal(await page.locator('#expansion-b .xb-yrow,#expansion-b .xb-row').count(),0);assert.equal(await page.locator('#expansion-b .plv-pills button').count(),5);assert.equal(await page.locator('#expansion-b .psb-row .l').count(),6);
  await page.evaluate(()=>{G.expansionYearRowOff=false;paint();});await page.waitForTimeout(250);
  await page.evaluate(()=>{G.expansionBOff=true;paintExpansion();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#expansion-b').count(),0);assert.equal(await page.locator('#expansion-v2').count(),1,'끄면 v2 묶음 표');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',board_frame:true,diagnosis_3bars:true,reasons_order:true,sort_red_first:true,filters:true,year_pills:true,year_row_inline_pills:true,counts_follow_brand_owner:true,list_note:true,row_two_chunks:true,open_existing_detail:true,act_routes:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
