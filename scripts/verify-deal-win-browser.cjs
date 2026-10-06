'use strict';
/* 수주 유형 검사(2026-10-04 핸드오프 rules 2-1 · 수주 처리 · 수주유형 + 대시보드 v2 새 표)
   단계 바꾸기 → [수주] = 수주 처리 창(유형 3가지 먼저) → 협약시공사 수주 · 기술자문: 낙찰 시공사 · 낙찰금액 · 기술자문 계약 · POUR 계약 → 서버 확인 뒤 기술자문 관리 건 안내
   → 상세 머리 4칸(영업 경로 / 영업 담당 / 결과 / 낙찰 시공사 · 낙찰금액) + 연결 계약 → 수주실적 = 낙찰금액만(연결 계약은 더하지 않음) · 메이드율 성공
   → 대시보드 3줄(직접 / 협약 · 기술자문 / 타사 이관) · 성과 분석 '유입 브랜드 → 낙찰 시공사 → 수주실적 · 매출' 표 · 직접 수주 = 계약 창으로 · 타사 이관 = 이관 흐름으로 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealWin&&window.DealTransfer&&window.CRMRules&&window.DealDetailV3&&window.DashB&&window.BriefB&&window.ContractSalesData);
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222',D4='44444444-4444-4444-8444-444444444444';
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'석민이앤씨',created:'2026-02-01',code,stage_code:code,grp:'영업·관리',amt:1e9,nextActionObj:{text:'입찰 준비',due:'2026-11-05',status:'open'},lastMeaningfulContactAt:T('2026-10-20'),activities:[{id:'a-'+id,type:'전화',note:'통화',at:T('2026-10-20')}]},extra||{});
   B={deals:[deal(D1,'[경기 평택] 평택비전지웰푸르지오','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:'2026-11-10',bid_terms:'일반'}}}}),deal(D2,'[수원] 자사 수주 현장','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:5e8,closed_at:T('2026-10-10')}),
     deal('33333333-3333-4333-8333-333333333333','[인천] 실주 현장','이필선','lost',{outcome:'lost',grp:'수주 실패',closed_at:T('2026-10-12'),closed:'2026-10-12',stage_contexts:{lost:{fields:{close_reason:'가격',close_detail:'확인'}}}}),
     deal(D4,'[서울] 직접 수주 예정 현장','이필선','bidding',{brand:'POUR솔루션',stage_contexts:{bidding:{fields:{bid_deadline:'2026-11-10',bid_terms:'일반'}}}})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__contracts=[{deal_id:D2,brand:'석민이앤씨',sales_owner_name:'이필선',balance:5e8,events:[{kind:'signed',effective_date:'2026-10-10',amount_delta:5e8}]}];ContractSalesData.state=()=>({status:'ready',items:__contracts});ContractSalesData.entries=(f={})=>__contracts.filter(r=>(!f.owner||f.owner==='전체'||r.sales_owner_name===f.owner)&&(!f.brand||f.brand==='전체'||r.brand===f.brand));
   /* 서버 흉내: sql/deal-win-type-v1 의 규칙. advisory = 예전부터 확정돼 있던 기술자문 낙찰 1건(기술자문료만 입력됨) */
   window.__wn={};window.__tf={};window.__calls=[];
   const ADV=[{advisory_id:'adv-old',site_name:'옥련현대4차',contractor:'코지건설',decision:'confirmed',origin_business:'석민이앤씨',source_deal_id:'legacy-verified',performance_owner:'이필선',bid_amount:885000000,bid_confirmed_at:'2026-07-31',advisory_fee:300000000,pour_amount:null}];
   SB={rpc:async(name,args)=>{const p=args.p||{};__calls.push([name,JSON.parse(JSON.stringify(p))]);
    if(name==='crm_deal_win_list_v1')return {data:{ok:true,rows:Object.values(__wn),advisory:ADV}};
    if(name==='crm_deal_win_register_v1'){if(p.cancel){delete __wn[p.deal_id];return {data:{ok:true,deal_id:p.deal_id,win:null}};}const had=!!__wn[p.deal_id];
     __wn[p.deal_id]={deal_id:p.deal_id,win_status:'confirmed',won_type:p.type,sales_channel_brand:(B.deals.find(d=>d.id===p.deal_id)||{}).brand,award_company:p.company,award_amount:p.amount,award_date:p.date,tech_advisory:p.tech===true,tech_advisory_company:p.tech?p.tech_company:null,tech_advisory_amount:p.tech?p.tech_amount:null,pour_contract_amount:p.tech&&p.pour_amount?Number(p.pour_amount):null,advisory_id:p.tech?'adv-new':null,performance_owner:'이필선'};
     return {data:{ok:true,deal_id:p.deal_id,win:__wn[p.deal_id],advisory_created:p.tech===true&&!had}};}
    if(name==='crm_deal_transfer_list_v1')return {data:{ok:true,rows:Object.values(__tf)}};
    if(name==='crm_ops_rules_v1')return {data:{ok:true,rules:{},history:[]}};if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.D1=D1;window.D4=D4;window.__opened=[];window.StageTransitionUI&&(StageTransitionUI.open=(d,x,code)=>{__opened.push(code);});
   G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(900);
  const v=page.locator('#detailView.dv3');assert.equal(await v.count(),1);
  /* 0. 확정 전: 머리 4칸 없음. 예전 기술자문 낙찰(확정분)은 이미 협약 · 기술자문 수주로 집계된다 */
  assert.equal(await page.locator('#wn-head').count(),0,'수주 전에는 머리 4칸 없음');
  assert.deepEqual(await page.evaluate(()=>{const C=DashB.core();return [C.pt.count,C.pt.amount,C.perf,C.won,C.made];}),[0,0,500000000,1,50],'낙찰확정만으로 계약실적에 합산하지 않는다');
  /* 1. 단계 바꾸기 → [수주]: 입찰 단계에서도 누를 수 있고, 수주 처리 창이 먼저 뜬다 */
  await v.locator('.dv3-headact .mv').click();await page.waitForTimeout(200);
  const wonBtn=v.locator('.dv3-moves [data-stage="won"]');assert.equal(await wonBtn.getAttribute('aria-disabled'),null,'수주 버튼이 잠겨 있지 않음');
  await wonBtn.click();await page.waitForTimeout(250);
  const dlg=page.locator('#wn-dialog .wn-dlg');assert.equal(await dlg.count(),1);assert.deepEqual(await page.evaluate(()=>__opened),[],'단계 전환 창이 아니라 수주 처리 창');
  assert.match(await dlg.locator('header').innerText(),/^수주 처리\s*단계 바꾸기 → 수주 를 누르면 먼저 유형을 고릅니다/);
  assert.deepEqual(await dlg.locator('.wn-types button b').allInnerTexts(),['직접 수주','협약시공사 수주 · 기술자문','타사 이관 수주']);
  assert.deepEqual(await dlg.locator('.wn-types button small').allInnerTexts(),['자사가 직접 계약 · 시공','우리 영업 → 협약시공사 낙찰 → 기술자문 계약','공식 이관 → 그 업체 낙찰 · 사전 보고 승인']);
  assert.equal(await dlg.locator('.wn-types button[aria-pressed="true"] b').innerText(),'직접 수주');
  assert.deepEqual(await dlg.locator('.wn-form label').allInnerTexts(),['계약 업체 *','낙찰금액 *','낙찰일 *','실적 귀속']);assert.equal(await dlg.locator('[data-wn-f="company"]').inputValue(),'석민이앤씨','직접 수주 = 우리 브랜드가 계약 업체');
  assert.equal(await dlg.locator('[data-wn-f="date"]').inputValue(),'2026-10-21');assert.match(await dlg.locator('.wn-note').innerText(),/^실적 금액 = 낙찰금액\. 계약 · 시공 단계로 이어집니다\.$/);
  /* 2. 협약시공사 수주 · 기술자문 */
  await dlg.locator('.wn-types button').nth(1).click();await page.waitForTimeout(100);
  assert.deepEqual(await page.locator('#wn-dialog .wn-form label').allInnerTexts(),['낙찰 시공사 *','낙찰금액 *','낙찰일 *','실적 귀속','기술자문 발생 *','기술자문 계약','POUR 계약']);
  assert.match(await page.locator('#wn-dialog .wn-form').innerText(),/실적 귀속\s*이필선\s*주담당 자동/);assert.equal(await page.locator('#wn-dialog .wn-yn [aria-pressed="true"]').innerText(),'예');
  await page.locator('#wn-dialog [data-wn="save"]').click();assert.match(await page.locator('#wn-dialog .wn-err').innerText(),/낙찰 시공사를 적어 주세요/);
  await page.locator('#wn-dialog [data-wn-f="company"]').fill('코지건설');assert.equal(await page.locator('#wn-dialog [data-wn-f="tech_company"]').inputValue(),'코지건설','기술자문 계약 상대 = 낙찰 시공사로 먼저 채움');
  await page.locator('#wn-dialog [data-wn="save"]').click();assert.match(await page.locator('#wn-dialog .wn-err').innerText(),/낙찰금액\(VAT 별도\)을 넣어 주세요/);
  await page.locator('#wn-dialog [data-wn-f="amount"]').fill('1043900000');assert.equal(await page.locator('#wn-dialog [data-wn-f="amount"]').inputValue(),'1,043,900,000');
  await page.locator('#wn-dialog [data-wn-f="date"]').fill('2026-10-01');
  await page.locator('#wn-dialog [data-wn="save"]').click();assert.match(await page.locator('#wn-dialog .wn-err').innerText(),/기술자문 계약금액을 넣어 주세요/);
  await page.locator('#wn-dialog [data-wn-f="tech_amount"]').fill('433650000');await page.locator('#wn-dialog [data-wn-f="pour_amount"]').fill('136690000');
  assert.equal(await page.locator('#wn-dialog .wn-note').innerText(),'실적 금액 = 낙찰금액 1,043,900,000원. 기술자문 433,650,000원 · POUR 136,690,000원은 더하지 않고 연결 계약으로 따로 저장합니다. 저장하면 기술자문 관리 건이 자동으로 생깁니다.');
  await page.locator('#wn-dialog .wn-yn button').nth(1).click();assert.deepEqual(await page.locator('#wn-dialog .wn-form label').allInnerTexts(),['낙찰 시공사 *','낙찰금액 *','낙찰일 *','실적 귀속','기술자문 발생 *'],'아니오 = 기술자문 계약 칸이 사라짐');
  await page.locator('#wn-dialog .wn-yn button').nth(0).click();assert.equal(await page.locator('#wn-dialog [data-wn-f="tech_amount"]').inputValue(),'433,650,000','적어 둔 값은 남는다');
  if(shot)await page.screenshot({path:shot+'-form.png'});
  assert.equal(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_win_register_v1').length),0,'누르기 전에는 서버에 안 보냄');
  await page.locator('#wn-dialog [data-wn="save"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_win_register_v1').map(c=>c[1])),[{deal_id:'11111111-1111-4111-8111-111111111111',type:'partner_tech',company:'코지건설',amount:1043900000,date:'2026-10-01',site_name:'평택비전지웰푸르지오',tech:true,tech_company:'코지건설',tech_amount:433650000,pour_amount:'136690000'}]);
  /* 3. 확정 뒤: 기술자문 관리 건 안내 · 상세 머리 4칸 + 연결 계약 · 단계는 그대로 */
  assert.match(await page.locator('#wn-dialog .wn-done').innerText(),/^수주 확정 후 자동 생성\s*기술자문 관리 건 · 평택비전지웰푸르지오\s*계약 상대\s*코지건설\s*기술자문\s*433,650,000원\s*POUR 계약\s*136,690,000원\s*이어서\s*계약 → 현장 → 대금 → 완료 \(기술자문 관리\)\s*영업실적은 공사 계약 체결 확인 후 반영합니다\. 시공 · 대금은 기술자문 관리에서 이어갑니다\.$/);
  assert.match(await page.locator('#wn-dialog .wn-note').innerText(),/낙찰금액 1,043,900,000원\(VAT 별도\)을 저장했습니다\. 공사 계약일·공사금액·당시 실적 귀속자 확인 후 계약 원장에서 실적을 반영합니다\./);
  if(shot)await page.screenshot({path:shot+'-done.png'});
  await page.locator('#wn-dialog footer [data-wn="close"]').click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>dealStage(CUR_DETAIL.item)),'bidding','단계는 건드리지 않음');
  assert.deepEqual(await page.locator('#wn-head .wn-boxes>div').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent.trim()))),[['영업 경로 (브랜드)','석민이앤씨'],['영업 담당','이필선'],['결과','수주 · 기술자문'],['낙찰 시공사 · 낙찰금액','코지건설 · 10.4억']]);
  assert.match(await page.locator('#wn-head .wn-links').innerText(),/^연결 계약\s*기술자문 4\.3억 · 코지건설\s*\|\s*POUR 계약 1\.4억\s*수주 정보 고치기$/);
  if(shot)await page.screenshot({path:shot+'-head.png'});
  assert.equal(await page.evaluate(()=>DashB.core().perf),500000000,'수주 정보 저장만으로 실적 확정 안 함');
  // Simulate separately verified apartment construction contracts. No advisory fee is posted.
  await page.evaluate(()=>{const row=(id,at,amount)=>({deal_id:id,brand:'석민이앤씨',sales_owner_name:'이필선',contract_date:at,balance:amount,events:[{kind:'signed',effective_date:at,amount_delta:amount}]});__contracts.push(row(D1,'2026-10-02',1043900000),row('legacy-verified','2026-07-31',885000000));});
  /* 4. 집계: 실적 = 낙찰금액만(연결 계약은 더하지 않는다) · 메이드율 성공 · 같은 함수 */
  assert.deepEqual(await page.evaluate(()=>{const C=DashB.core();return [CRMRules.dealResult(B.deals[0]),C.pt.count,C.pt.amount,C.pt.revenue,C.perf,C.won,C.made,CRMRules.madeRate(1,0,1,2)];}),['won_partner_tech',2,1928900000,870340000,2428900000,3,75,75]);
  await page.evaluate(()=>{document.getElementById('detailView')&&typeof closeDetail==='function'&&closeDetail();goPage('dash');});await page.waitForTimeout(500);
  const kpi=await page.locator('#si-dash .db-kpi').nth(1).evaluate(n=>[n.querySelector('span').textContent,n.querySelector('b').textContent,n.querySelector('small').textContent]);
  assert.deepEqual(kpi,['올해 수주실적','24.3억','낙찰금액 · VAT 별도 = 계약실적(계약 체결일) 5억(1건) · 협약 · 기술자문 19.3억(2건) · 타사 이관 없음'],'대시보드: 합산하되 3줄로 나눠 적는다');
  /* 영업 Funnel(2026-10-05): 메이드율은 머리 오른쪽, 식은 '영업력' 상자 아래 한 줄 */
  assert.deepEqual([await page.locator('#si-dash .db-f6 .db-ch .mr b').innerText(),await page.locator('#si-dash .db-f6x').innerText()],['75.0%','(직접 1 + 협약 · 기술자문 2 + 타사 이관 0) ÷ (직접 1 + 협약 · 기술자문 2 + 타사 이관 0 + 실주 1) · 배드핏 제외']);
  await page.locator('#si-dash .db-secs [data-v="people"]').click();await page.waitForTimeout(200);
  assert.match(await page.locator('#si-dash .db-prow',{hasText:'이필선'}).innerText(),/24\.3억\s*협약 · 기술자문 19\.3억 포함\s*75\.0%\s*수주 3 · 실주 1/);
  /* 5. 성과 분석: 유입 브랜드 → 낙찰 시공사 → 수주실적 · 매출 */
  await page.evaluate(()=>{G.perfV3Off=true;/* 여기서는 예전 성과 분석의 표(끄기 스위치 뒤 화면)로 같은 계산을 본다 — 새 화면은 verify-perf-v3 */goPage('perf');});await page.waitForTimeout(500);
  const bx=page.locator('#si-perf .db-bxs');assert.equal(await bx.count(),1);
  assert.match(await bx.locator('.db-ch').innerText(),/^유입 브랜드 → 낙찰 시공사 → 수주실적 · 매출\s*2026년 연간 · 수주실적 = 낙찰금액 · 매출 = 회사에 실제 들어오는 금액\(직접 계약 · 기술자문 · POUR 계약\)$/);
  assert.deepEqual(await bx.locator('.db-bxt>div').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent))),[['수주실적 (낙찰금액)','24.3억','3건 · 영업 성과 · 인센티브 기준'],['회사 매출','13.7억','직접 계약 5억 + 기술자문 · POUR 8.7억'],['협약 · 기술자문 비중','79%','수주실적 중 협약시공사 낙찰 19.3억']]);
  const cells=await bx.locator('.db-bx>span').allInnerTexts(),rowAt=i=>cells.slice(i*7,i*7+7).map(s=>s.trim());
  assert.deepEqual(rowAt(0),['유입 브랜드','낙찰 시공사','수주 유형','건수','수주실적','매출','매출 비율']);
  assert.deepEqual(rowAt(1),['석민이앤씨','석민이앤씨','직접 수주','1','5억','5억','100%']);
  assert.deepEqual(rowAt(2),['','코지건설','협약 · 기술자문','2','19.3억','8.7억','45%'],'같은 브랜드는 첫 줄에만 이름 · 매출 = 기술자문 + POUR');
  assert.deepEqual(rowAt(3),['합계','','','3','24.3억','13.7억','56%']);
  assert.equal(await bx.locator('.db-bxn').innerText(),'석민이앤씨로 들어온 수주실적 24.3억 중 19.3억(79%)가 코지건설 낙찰 · 기술자문 구조라 회사 매출은 수주실적보다 작게 잡힙니다. 매출 비율 = 매출 ÷ 수주실적.');
  assert.match(await page.locator('#si-perf .db-c3').first().innerText(),/^기술자문 낙찰실적\s*협약시공사 수주 · 수주실적에 합산\s*19\.3억\s*확정 2건/);
  assert.equal(await page.evaluate(()=>{const a=document.querySelector('#si-perf .db-bxs'),b=document.querySelector('#si-perf .db-pending'),c=document.querySelector('#si-perf .db-row3');return !!(c.compareDocumentPosition(a)&4)&&!!(a.compareDocumentPosition(b)&4);}),true,'카드 3장 아래 · 아직 판단 못 하는 것 위');
  assert.equal(await bx.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,'표가 옆으로 넘치지 않음');
  if(shot)await page.screenshot({path:shot+'-perf.png',fullPage:true});
  /* 6. 주간 브리핑: 수주실적 3줄 */
  await page.clock.setFixedTime(new Date('2026-10-03T10:00:00+09:00'));
  await page.evaluate(()=>{OpsStore.rpc=(o=>async(name,p)=>name==='crm_report_snapshot_get_v1'?{ok:true,snapshots:[]}:o(name,p))(OpsStore.rpc);goPage('brief');});await page.waitForTimeout(600);
  /* 이번 주 성과 v2(2026-10-05): 수주 표 대신 꼬리표 한 줄 — 직접 / 협약 · 기술자문 / 타사 이관을 나눠 적고 낙찰 내역은 올려 두면 보인다 */
  {const one=s=>String(s).replace(/\s+/g,' ').trim(),win=page.locator('#brief-b .bp2-tags .t.win');
   assert.equal(one(await win.innerText()),'수주 1건 · 10.4억 · 계약실적 0 · 협약 · 기술자문 1건 10.4억 · 타사 이관 0','이번 주(9/28~) 낙찰 1건');
   assert.equal(await win.getAttribute('title'),'이필선 · 평택비전지웰푸르지오 · 코지건설 낙찰 10.4억');
   assert.equal(one(await page.locator('#brief-b .bp2-step').nth(3).innerText()).startsWith('신규 계약 1 건 · 10.4억'),true);
   assert.match(one(await page.locator('#brief-b .bp2-rates>div').nth(1).innerText()),/^영업 메이드율 100\.0%/);
   assert.deepEqual((await page.locator('#brief-b .bp2-tags .t').allInnerTexts()).map(one).slice(1),['파이프라인 실주 0건 · 메이드율에 포함','견적문의 종결 0건 · Bad Fit 0 · 메이드율 제외']);}
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
  /* 월간 보고 본문과 직접/협약 분해는 같은 계약 원장을 사용한다. */
  await page.evaluate(()=>{G.reportBMonth='2026-10';goPage('report');});await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const x=ReportB.data();return [x.cur.contracts.net,x.cur.con.net+x.cur.pt.amount,x.cur.contracts.count,x.cur.con.count+x.cur.pt.count];}),[1543900000,1543900000,2,2]);
  assert.match(await page.evaluate(()=>ReportB.headline(ReportB.data()).t),/10월 체결 계약 2건 · 15\.4억/);
  assert.match(await page.evaluate(()=>ReportB.summaryText(ReportB.data())),/→ 계약 2건 · 15\.4억/);
  /* 7. 직접 수주: 유형 · 계약 업체를 남기고 계약 창으로 이어 준다(계약실적 원장은 그 경로 그대로) */
  await page.evaluate(()=>{G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[3]));});await page.waitForTimeout(800);
  await page.locator('#detailView .dv3-headact .mv').click();await page.waitForTimeout(150);await page.locator('#detailView .dv3-moves [data-stage="won"]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#wn-dialog [data-wn-f="company"]').inputValue(),'POUR솔루션');
  await page.locator('#wn-dialog [data-wn-f="amount"]').fill('300000000');await page.locator('#wn-dialog [data-wn="save"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_win_register_v1').map(c=>c[1])[1]),{deal_id:'44444444-4444-4444-8444-444444444444',type:'own',company:'POUR솔루션',amount:300000000,date:'2026-10-21',site_name:'직접 수주 예정 현장'});
  assert.deepEqual(await page.evaluate(()=>__opened),['contract'],'계약 단계 창으로 이어짐');assert.equal(await page.locator('#wn-dialog').count(),0);
  assert.deepEqual(await page.locator('#wn-head .wn-boxes>div').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent.trim()))),[['영업 경로 (브랜드)','POUR솔루션'],['영업 담당','이필선'],['결과','직접 수주'],['계약 업체 · 금액','POUR솔루션 · 3억']]);
  assert.deepEqual(await page.evaluate(()=>{const C=DashB.core();return [CRMRules.dealResult(B.deals[3]),DealWin.amountOf(B.deals[3]),C.perf,C.won];}),['won_own',300000000,2428900000,3],'직접 수주의 실적은 계약실적 원장에서만 — 유형을 남긴 것만으로는 수주실적이 늘지 않는다');
  /* 8. 타사 이관 수주: 이관 흐름(등록 → 낙찰결과 → 관리자 인정)으로 넘긴다 */
  await page.evaluate(()=>{CUR_DETAIL.item.win&&0;DealWin.open();});await page.waitForTimeout(200);
  await page.locator('#wn-dialog .wn-types button').nth(2).click();await page.waitForTimeout(100);
  assert.match(await page.locator('#wn-dialog .wn-form').innerText(),/사전 보고\s*아직 타사 이관 등록이 없습니다 — 등록\(사전 보고 포함\)부터 합니다\s*관리자 승인 후 실적 반영/);
  assert.equal(await page.locator('#wn-dialog .wn-note').innerText(),'실적 금액 = 낙찰금액. 사전 보고된 이관 건만, 관리자 승인 후 실적에 들어갑니다.');
  assert.equal(await page.locator('#wn-dialog [data-wn="save"]').innerText(),'타사 이관 등록부터');
  await page.locator('#wn-dialog [data-wn="save"]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#wn-dialog').count(),0);assert.match(await page.locator('#tf-dialog header').innerText(),/^타사 이관 등록/);
  await page.locator('#tf-dialog [data-tf="close"]').first().click();
  /* 이미 등록된 이관 건이면 낙찰결과 등록 창으로, 적어 둔 업체 · 금액을 가지고 넘어간다 */
  await page.evaluate(()=>{__tf[D4]={deal_id:D4,transfer_status:'transferred',transfer_company:'여름건설',transfer_reason:'영업권 조율',transfer_date:'2026-10-05',transfer_reported:true,transfer_reported_at:'2026-10-04',transfer_memo:'팀장 협의',award_result:'pending',performance_owner:'이필선',incentive_eligible:false};DealTransfer._take(Object.values(__tf));DealWin.open();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#wn-dialog .wn-types button[aria-pressed="true"] b').innerText(),'타사 이관 수주','이관 등록된 건은 그 유형이 먼저 골라져 있다');
  assert.match(await page.locator('#wn-dialog .wn-form').innerText(),/사전 보고\s*보고 완료 \(10\.04\) · 팀장 협의/);assert.equal(await page.locator('#wn-dialog [data-wn-f="company"]').inputValue(),'여름건설');
  await page.locator('#wn-dialog [data-wn-f="amount"]').fill('250000000');await page.locator('#wn-dialog [data-wn="save"]').click();await page.waitForTimeout(250);
  assert.match(await page.locator('#tf-dialog header').innerText(),/^낙찰결과 등록/);assert.equal(await page.locator('#tf-dialog [data-tf-f="company"]').inputValue(),'여름건설');assert.equal(await page.locator('#tf-dialog [data-tf-f="amount"]').inputValue(),'250,000,000');
  assert.equal(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_transfer_award_v1').length),0,'증빙은 그 창에서 — 여기서 바로 저장하지 않는다');
  await page.locator('#tf-dialog [data-tf="close"]').first().click();
  /* 9. 서버 함수가 없으면 예전 그대로(수주 = 준공 뒤) · 끄기 */
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>!/^crm_deal_win_/.test(n)});G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));});await page.waitForTimeout(800);
  assert.equal(await page.locator('#detailView .dv3-moves [data-stage="won"]').getAttribute('aria-disabled'),'true');
  await page.evaluate(()=>document.querySelector('#detailView .dv3-moves [data-stage="won"]').click());await page.waitForTimeout(150);assert.equal(await page.locator('#wn-dialog').count(),0);
  await page.evaluate(()=>{G.dealWinOff=true;DealDetailV3.apply();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#wn-head').count(),0);assert.equal(await page.evaluate(()=>DashB.core().pt.count),0,'끄면 협약 · 기술자문 집계도 예전 방식');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',won_opens_type_chooser:true,partner_tech_required_fields:true,advisory_case_notice:true,head_four_boxes_linked_contracts:true,performance_contract_ledger_only:true,three_way_split_same_function:true,brand_to_contractor_table:true,own_continues_to_contract:true,transfer_routes_to_transfer_flow:true,gate_and_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
