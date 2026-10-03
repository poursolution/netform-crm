'use strict';
/* 고객 자산 v2 검사(2026-10-01 디자인 핸드오프 asset): 목록(공통 필터줄·관계 상태 알약·더보기·진단·묶음 표) + 상세 3단 모달.
   기술자문 계약은 더보기, 연결 검토는 데이터 정리 · 검토로. 데이터·관계 상태·타임라인은 기존 계산. 끄면 예전 화면 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.AssetV2&&window.CommonFilterBar&&window.PipelineDiagnosis&&typeof paintSites==='function');
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
     deal('d6','오산 원동 e편한세상',3,'한준엽','lost',{outcome:'lost',amt:14e7,closed_at:day(-412),created:day(-500),updated:day(-412),brand:'석민이앤씨'})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   G.assetBOff=true;/* B안(2026-10-03)은 verify-asset-b 에서 */LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};
   goPage('sites');
  });
  await page.waitForTimeout(300);
  const v=page.locator('#asset-v2');assert.equal(await v.count(),1,'새 목록');
  assert.equal(await page.locator('#site-master .site-hero2,#site-master .site-chips,#site-master .site-table,#site-master .site-pagination').count(),0,'예전 요약 줄·칩·표 없음');
  assert.equal(await page.locator('#pg-sites>.cf-bar:not([hidden])').count(),1,'공통 필터줄');
  assert.equal(await page.evaluate(()=>{const a=document.querySelector('#pg-sites>.advisory-library');return !a||getComputedStyle(a).display==='none'}),true,'기술자문 계약 띠는 목록 위에서 뺌');
  assert.equal(await page.locator('#site-master [data-review-shortcut]').count(),0,'연결 검토 띠 없음');
  /* 관계 상태 알약 · 진단 */
  assert.deepEqual(await v.locator('.plv-pills button').allInnerTexts(),['전체 3','활성 1','기존고객 0','재접촉 필요 0','관계위험 1','휴면 1']);
  assert.deepEqual(await v.locator('.pd-kpi span').allInnerTexts(),['고객 자산','누적 수주','진행 기회','관계위험']);
  assert.match(await v.locator('.pd-kpis').innerText(),/고객 자산\s*3곳[\s\S]*누적 수주\s*400만[\s\S]*진행 기회\s*2건 · 3\.9억[\s\S]*관계위험\s*1곳\s*진행 금액 3\.7억이 걸려 있음/);
  assert.deepEqual(await v.locator('.pd-card header b').allInnerTexts(),['돈이 어디에 쌓였나','어디서 새고 있나','누가 관계를 쥐고 있나']);
  assert.match(await v.locator('.pd-action').innerText(),/관계위험 1곳 · 3\.7억[\s\S]*실주 이력 있는 단지 2곳/);
  /* 묶음 표 */
  assert.deepEqual(await v.locator('.plv-thead span').allInnerTexts(),['현장 · 담당','관계','누적 수주','진행 기회','실주 이력','최근 기록','핵심 인물','']);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['관계위험','재접촉 필요','활성','휴면']);
  assert.deepEqual(await v.locator('.plv-ghead span').allInnerTexts(),['1건','0건','1건','1건']);
  assert.match(await v.locator('.plv-row').first().innerText(),/예현마을현대홈타운아파트[\s\S]*황윤선[\s\S]*관계위험[\s\S]*0원[\s\S]*1건 · 3\.7억[\s\S]*2건 · 7\.5억[\s\S]*열기/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  await v.locator('.plv-pills [data-value="dormant"]').click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),1);
  await v.locator('.plv-pills [data-value="전체"]').click();await page.waitForTimeout(150);
  await page.locator('#pg-sites>.cf-bar [data-sf-brand="석민이앤씨"]').click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),1,'브랜드 공통 필터');
  await page.locator('#pg-sites>.cf-bar [data-sf-brand="전체"]').click();await page.waitForTimeout(150);
  await v.locator('.plv-chip',{hasText:'이필선'}).click();await page.waitForTimeout(150);assert.equal(await v.locator('.plv-row').count(),1,'담당자 공통 필터');
  await v.locator('.plv-chip.on').click();await page.waitForTimeout(150);
  /* 더보기: 기술자문 계약 · 연결 검토 이동 */
  await v.locator('.av-more summary').click();assert.deepEqual(await v.locator('.av-menu button').allInnerTexts(),['기술자문 계약','연결 검토 · 과거자료 연결 → 데이터 정리 · 검토']);
  await v.locator('.av-menu [data-av="advisory"]').click();assert.equal(await page.evaluate(()=>document.getElementById('pg-sites').classList.contains('av-adv-on')),true);
  /* 상세: 3단 모달 */
  await v.locator('.plv-row').first().locator('.plv-site').click();await page.waitForTimeout(250);
  const d=page.locator('#assetV2.on .xdv');assert.equal(await d.count(),1);assert.equal(await page.evaluate(()=>document.getElementById('siteDrawer')?.classList.contains('on')),false,'예전 드로어는 열리지 않음');
  assert.match(await d.locator('.xdv-top').innerText(),/고객 자산 · 관계위험[\s\S]*예현마을현대홈타운아파트[\s\S]*첫 관계[\s\S]*영업기회 3건[\s\S]*실주 2건 · 7\.5억[\s\S]*진행 1건 · 3\.7억[\s\S]*수주 0원/);
  assert.equal(await d.evaluate(n=>getComputedStyle(n.querySelector('.xdv-body')).gridTemplateColumns.split(' ').length),3);
  assert.deepEqual(await d.locator('.xdv-facts dt').allInnerTexts(),['관계 시작','현재 담당','최초 관계','주소','관리사무소','최근 기록']);
  assert.match(await d.locator('.xdv-c2 .idv-chead').innerText(),/관계 타임라인/);assert.ok(await d.locator('.xdv-c2 .idv-msg').count()>=3,'타임라인 기록');
  assert.match(await d.locator('.xdv-c3').innerText(),/누적 거래[\s\S]*전체 영업기회\s*3건[\s\S]*수주\s*0건[\s\S]*실주 · 종료\s*2건[\s\S]*진행 중\s*1건[\s\S]*지금 진행 중인 영업[\s\S]*다음 할 일 없음[\s\S]*파이프라인에서 열기[\s\S]*공종 이력[\s\S]*이 단지에서 배울 것[\s\S]*실주 사유: 가격 열세[\s\S]*다음 제안 전에 실주 사유부터 확인하세요/);
  assert.equal(await d.locator('.av-opp.none').count(),1,'다음 할 일 없으면 빨강');
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  await d.locator('.av-opp').click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__open),'d1','현장 줄 → 파이프라인 상세');
  /* 주소 수정 = 기존 창 */
  await page.evaluate(()=>AssetV2.open(siteMasterData()[0].key));await page.waitForTimeout(150);
  await page.locator('#assetV2 [data-ad="address"]').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.getElementById('siteDrawer').classList.contains('on')),true,'주소 입력·수정은 기존 창');
  await page.evaluate(()=>{document.getElementById('siteDrawer').classList.remove('on');document.body.style.overflow='';});
  /* 연결 검토는 데이터 정리 · 검토 화면으로 */
  await page.evaluate(()=>goPage('dup'));await page.waitForTimeout(300);
  assert.equal(await page.locator('#pg-dup #dup-link-reviews').count(),1);
  /* 좁은 화면 · 끄기 */
  await page.evaluate(()=>goPage('sites'));await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.assetV2Off=true;paint();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#asset-v2').count(),0);assert.equal(await page.locator('#site-master .site-table').count(),1,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',list_frame:true,status_pills:true,diagnosis:true,groups:true,shared_filters:true,more_menu:true,detail_three_columns:true,row_opens_pipeline_detail:true,address_edit_legacy:true,reviews_moved_to_cleanup:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
