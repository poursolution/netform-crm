'use strict';
/* 고객 자산 B안 검사(2026-10-03 "파이프라인 기준으로"): 왼쪽 관계 진단(막대 3칸 · 숫자 3 · 사유 · 할 일) / 오른쪽 확인할 단지 · 정렬은 빨강 사유 순 · 열기는 기존 3단 모달 · 끄면 v2 묶음 표 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.AssetB&&window.StageBoard&&window.AssetV2&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S=(n)=>'aaaaaaaa-0000-4000-8000-00000000000'+n;
   const deal=(id,site,sid,owner,code,extra)=>Object.assign({id,site,site_id:S(sid),assignee:owner,brand:'POUR솔루션',created:day(-200),updated:day(-200),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   B={deals:[
     deal('d1','예현마을현대홈타운아파트',1,'황윤선','consulting',{amt:37e7,created:day(-150),updated:day(-120)}),
     deal('d2','예현마을현대홈타운아파트',1,'황윤선','lost',{outcome:'lost',amt:4e8,closed_at:day(-300),lost_reason:'가격 열세',created:day(-400),updated:day(-300)}),
     deal('d3','예현마을현대홈타운아파트',1,'황윤선','lost',{outcome:'lost',amt:35e7,closed_at:day(-250),created:day(-350),updated:day(-250)}),
     deal('d4','시범현대아파트',2,'이필선','consulting',{amt:2e7,created:day(-20),updated:day(-9),next_action:{id:'n1',text:'견적 확인 전화',due:day(3),status:'open'},activities:[{id:'a1',type:'전화',note:'소장 통화 — 견적 검토 중',at:at(-9)}]}),
     deal('d5','시범현대아파트',2,'이필선','won',{outcome:'won',won_amount:4e6,closed_at:day(-100),completion_date:day(-100),created:day(-160),updated:day(-100)}),
     deal('d6','오산 원동 e편한세상',3,'한준엽','lost',{outcome:'lost',amt:14e7,closed_at:day(-412),created:day(-500),updated:day(-412),brand:'석민이앤씨'}),
     deal('d7','수주 뒤 조용한 단지',4,'김성민','won',{outcome:'won',won_amount:3e7,closed_at:day(-80),completion_date:day(-80),created:day(-200),updated:day(-80),manager_name:'박소장',manager_mobile:'01011112222'})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.siteStatus='전체';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   G.assetCOff=true;/* 고객 자산 v2 목록(2026-10-04)은 따로 검사 — 여기는 이전 목록 */goPage('sites');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#asset-b');assert.equal(await v.count(),1,'B안 보드');assert.equal(await page.locator('#asset-v2').count(),0,'v2 묶음 표 없음');
  assert.equal(await page.locator('#pg-sites>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'고객 자산');
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 4','활성 1','기존고객 1','재접촉 필요 0','관계위험 1','휴면 1']);
  assert.deepEqual(await v.locator('.ps3-tabs .ps3-tab').evaluateAll(l=>l.map(b=>b.querySelector('.l').textContent+' '+b.querySelector('.n').textContent)),['전체 4','활성 · 진행 중 1','기존고객 · 재접촉 1','관계위험 · 휴면 2'],'공용 틀: 상태 탭 4칸([전체] + 3칸)');
  assert.match(await v.locator('.ps3-kpis').innerText(),/기준 넘김\s*1곳[\s\S]*누적 수주\s*3,400만\s*2곳 · 평균 1,700만[\s\S]*평균 최근 기록\s*\d+일/);
  const reasons=await v.locator('.ps3-reason>span>b:first-child').allInnerTexts();
  assert.deepEqual(reasons,['관계위험 · 진행 금액 걸림','실주 2회 · 수주 없음','수주 고객 2개월 넘게 연락 없음','핵심 인물 미확인','1년 이상 움직임 없음','주소 미입력'],JSON.stringify(reasons));
  assert.match(await v.locator('.ps3-diag>.ps3-box').nth(2).innerText(),/그래서 뭘 해야 하나[\s\S]*관계위험 · 진행 금액 걸림 1곳[\s\S]*실주 2회 · 수주 없음 1곳/);
  /* 정렬: 관계위험(빨강 2개) → 나머지는 사유 수 → 일수 */
  const order=await v.locator('.psb-row').evaluateAll(a=>a.map(n=>n.querySelector('.prv-a>b').textContent));
  assert.equal(order[0],'예현마을현대홈타운아파트',JSON.stringify(order));
  assert.match(await v.locator('.psb-row').first().innerText(),/예현마을현대홈타운아파트[\s\S]*POUR솔루션 · 황윤선 · 누적 0원[\s\S]*관계위험[\s\S]*관계위험 · 진행 1건 3\.7억 · 실주 2건[\s\S]*관계위험 · 진행 금액 걸림[\s\S]*(119|120)일[\s\S]*연락/);
  assert.match(await v.locator('.psb-row',{hasText:'수주 뒤 조용한 단지'}).innerText(),/기존고객[\s\S]*박소장 관리소장[\s\S]*수주 고객 2개월 넘게 연락 없음[\s\S]*(79|80)일[\s\S]*관계 연락/);
  assert.match(await v.locator('.psb-row',{hasText:'시범현대아파트'}).innerText(),/활성[\s\S]*진행 1건 2,000만[\s\S]*핵심 인물 미확인[\s\S]*(8|9)일[\s\S]*연락처/);
  assert.match(await v.locator('.psb-row',{hasText:'오산 원동'}).innerText(),/석민이앤씨[\s\S]*휴면[\s\S]*1년 이상 움직임 없음[\s\S]*(411|412)일[\s\S]*캠페인/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 알약 · 공통 필터 · 막대 칸 · 보드 · 더보기 */
  await v.locator('.plv-pills [data-value="dormant"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#asset-b .psb-row').count(),1);
  await page.locator('#asset-b .plv-pills [data-value="전체"]').click();await page.waitForTimeout(150);
  await page.locator('#pg-sites>.cf-bar [data-sf-brand="석민이앤씨"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#asset-b .psb-row').count(),1,'브랜드 공통 필터');
  await page.locator('#pg-sites>.cf-bar [data-sf-brand="전체"]').click();await page.waitForTimeout(150);
  await page.locator('#asset-b .plv-chip',{hasText:'이필선'}).click();await page.waitForTimeout(150);assert.equal(await page.locator('#asset-b .psb-row').count(),1,'담당자 공통 필터');
  await page.locator('#asset-b .plv-chip.on').click();await page.waitForTimeout(150);
  await page.locator('#asset-b .ps3-tabs .ps3-tab').nth(3).click();await page.waitForTimeout(150);assert.equal(await page.locator('#asset-b .psb-row').count(),2);
  await page.locator('#asset-b [data-sb="clear"]').click();await page.waitForTimeout(150);
  await page.locator('#asset-b [data-sb="view"][data-v="board"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#asset-b .ps3-col').count(),3);assert.equal(await page.locator('#asset-b .ps3-card').count(),4);
  await page.locator('#asset-b [data-sb="view"][data-v="list"]').click();await page.waitForTimeout(150);
  await page.locator('#asset-b .av-more summary').click();assert.deepEqual(await page.locator('#asset-b .av-menu button').allInnerTexts(),['기술자문 원본 자료','연결 검토 · 과거자료 연결 → 데이터 정리 · 검토']);
  await page.locator('#asset-b .av-menu [data-ab="advisory"]').click();assert.equal(await page.evaluate(()=>document.getElementById('pg-sites').classList.contains('av-adv-on')),true);
  /* 열기 = 기존 3단 모달 */
  await page.locator('#asset-b .psb-row').first().locator('.prv-a').click();await page.waitForTimeout(300);
  const d=page.locator('#assetV2.on .xdv');assert.equal(await d.count(),1,'v2 상세 모달');assert.match(await d.innerText(),/예현마을현대홈타운아파트/);
  await page.keyboard.press('Escape');await page.waitForTimeout(150);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.assetBOff=true;paintSites();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#asset-b').count(),0);assert.equal(await page.locator('#asset-v2').count(),1,'끄면 v2 묶음 표');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',board_frame:true,diagnosis_3bars:true,reasons_order:true,sort_red_first:true,filters:true,more_menu:true,open_existing_modal:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
