'use strict';
/* 영업 대시보드 · 성과 분석 v3 검사(2026-10-04 design_handoff_performance_v3 · 성과 분석 v3.dc.html)
   판정 카드(흰 배경 · 팀 메이드율 도넛 · 자동 문장 · 숫자 4개) / 담당자 큰 도넛 카드 3열(수주실적 순 · 막힌 사람만 빨강) / 브랜드별 문의 → 적합 → 수주 /
   탭 4개 중 하나만(브랜드 → 낙찰사 · 매출 / 접수 월별 전환 + 연결 경고 / 유입경로 상위 4 + 기타 / 기술자문: 공종 · 낙찰일 · 계약일 · 상태) / 아직 판단 못 하는 것 한 줄
   숫자 = 영업 대시보드와 같은 계산(수주실적 = 낙찰금액 · 메이드율 = 수주 ÷ (수주 + 실주) · 배드핏 제외) · 브랜드 · 기간 필터 반영 · 끄면 예전 화면. 전체 현황 · 컨트롤타워 · 공통 틀은 그대로 */
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
  /* 오늘 = 2026-10-07(수) 10:00 — 10월 계약 없음 */
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PerfV3&&window.DashB&&window.DashB.lib&&window.SalesInsights&&window.BriefB&&window.ContractSalesData&&window.DealWin&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const U=n=>'0000000'+n+'-0000-4000-8000-00000000000'+n,T=k=>k+'T10:00:00+09:00';
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:'2026-02-01',code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const lost=(id,site,owner,k,reason,brand)=>deal(id,site,owner,'lost',{outcome:'lost',grp:'수주 실패',brand,closed_at:T(k),closed:k,stage_contexts:{lost:{fields:{close_reason:reason,close_detail:'확인'}}}});
   const inq=(n,site,owner,at,extra)=>Object.assign({id:U(n),site,status:owner?'배정완료':'접수',at,created_at:at,received_at:at,brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at:null},extra||{});
   B={deals:[
     deal('w1','[서울 마포] 계약 A','이필선','won',{outcome:'won',grp:'수주 성공',brand:'석민이앤씨',won_amount:5e8,closed_at:T('2026-03-10')}),
     deal('w2','[경기 고양] 계약 B','황윤선','won',{outcome:'won',grp:'수주 성공',won_amount:3e8,closed_at:T('2026-09-20')}),
     deal('p1','[경기 수원] 평동동남','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:8810e4,closed_at:T('2026-06-24')}),
     deal('p2','[경기 평택] 비전지웰푸르지오','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:7e7,closed_at:T('2026-09-15')}),
     lost('l1','[인천] 실주 가격','이필선','2026-08-08','가격 열세','석민이앤씨'),lost('l2','[수원] 실주 소장','황윤선','2026-09-18','담당자 부재·인수인계 누락','POUR솔루션'),lost('l3','[수원] 실주 가격2','황윤선','2026-05-19','가격 열세','POUR솔루션'),
     ...[1,2,3,4,5].map(i=>deal('o'+i,'[경기] 기한 지난 현장 '+i,'황윤선','sent',{nextActionObj:{text:'후속 통화',due:'2026-09-20',status:'open'},lastMeaningfulContactAt:T('2026-09-01'),activities:[{id:'ao'+i,type:'전화',note:'통화',at:T('2026-09-01')}]})),
     deal('n1','[수원] 매탄 임박','이필선','bidding',{amt:4e8,brand:'석민이앤씨',stage_contexts:{bidding:{fields:{bid_deadline:'2026-10-09',bid_terms:'일반'}}},nextActionObj:{text:'입찰 준비',due:'2026-10-09',status:'open'},lastMeaningfulContactAt:T('2026-10-06'),activities:[{id:'an1',type:'전화',note:'관리소장 통화',at:T('2026-10-06')}]})],
    inquiries:[inq(1,'[경기 고양] 계약 B','황윤선','2026-08-02T10:00:00+09:00',{responded_at:'2026-08-02T11:00:00+09:00',raw:{'유입경로':'전화'}}),inq(2,'[서울] 미배정 문의','','2026-10-07T08:00:00+09:00',{raw:{'유입경로':'전화'}}),inq(3,'[부산] 범위 밖','','2026-08-06T10:00:00+09:00',{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 공사 범위 밖 · 이전 상태: 접수',raw:{'유입경로':'홈페이지'}}),inq(4,'[경기] 첫 연락 지연','이필선','2026-10-06T09:00:00+09:00'),
     ...[5,6,7,8].map((n,i)=>inq(n,'[경기] 경로 '+n,'이필선','2026-07-0'+(i+1)+'T09:00:00+09:00',{raw:{'유입경로':['채널톡','네이버 검색','지인 소개','전단'][i]}}))],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   OPS_RULES.dashMinClosed=3;/* 종료 3건부터 메이드율 판단(기본 5건 — 설정값) */
   const ev=(id,k,n,o,b)=>({deal_id:id,brand:b,sales_owner_name:o,site_name:id,events:[{kind:'signed',effective_date:k,amount_delta:n}]});
   const items=[ev('w1','2026-03-10',5e8,'이필선','석민이앤씨'),ev('w2','2026-09-20',3e8,'황윤선','POUR솔루션'),ev('p1','2026-06-24',8810e4,'이필선','POUR솔루션'),ev('p2','2026-09-15',7e7,'이필선','POUR솔루션')];
   ContractSalesData.state=()=>({status:'ready',items});
   ContractSalesData.entries=f=>items.filter(r=>SalesFilterState.matchesBrand(r.brand)&&(!f||!f.brand||f.brand==='전체'||r.brand===f.brand)&&(!f||!f.owner||f.owner==='전체'||r.sales_owner_name===f.owner));
   /* 확정된 기술자문 낙찰실적(서버가 내려주는 모양 — 새 칸 포함) */
   window.__adv=[{advisory_id:'ad1',site_name:'[경기 수원] 평동동남',contractor:'여름건설',decision:'confirmed',origin_business:'POUR솔루션',source_deal_id:'p1',performance_owner:'이필선',bid_amount:8810e4,bid_confirmed_at:'2026-06-10',advisory_fee:5904e4,pour_amount:0,work_name:'외벽 재도장 · 균열 보수',work_type:null,contract_date:'2026-06-24',advisory_status:'진행중',settle_state:'progress'},
    {advisory_id:'ad2',site_name:'[경기 평택] 비전지웰푸르지오',contractor:'코지건설',decision:'confirmed',origin_business:'POUR솔루션',source_deal_id:'p2',performance_owner:'이필선',bid_amount:7e7,bid_confirmed_at:'2026-09-12',advisory_fee:null,pour_amount:null,work_name:null,work_type:null,contract_date:null,advisory_status:'낙찰',settle_state:'before'}];
   DealWin._take({rows:[],advisory:__adv});
   goPage('perf');
  });
  await page.waitForTimeout(600);
  const p=page.locator('#si-perf .db-shell');assert.equal(await p.count(),1);
  const v=p.locator('.pf3');assert.equal(await v.count(),1,'성과 분석 v3');
  assert.equal(await p.locator('.db-verdict,.db-pcs,.db-row3,.db-bxs,.db-cos').count(),0,'예전 판정 카드 · 세로로 펼친 표는 없다');
  assert.equal(await p.locator('.db-tool').count(),1,'연도 · 분기 줄(공통 틀)은 그대로');assert.equal(await page.locator('#pg-perf>.cf-bar').isVisible(),true,'공통 필터줄 그대로');
  /* 계산 기준: 직접 2건 8억 + 협약 · 기술자문 2건 1.581억 = 9.581억 · 수주 4 · 실주 3 → 메이드율 57.1% */
  const core=await page.evaluate(()=>{const C=DashB.core();return {perf:C.perf,won:C.won,loss:C.loss.length,made:C.made,fit:C.fit};});
  assert.deepEqual([core.perf,core.won,core.loss],[958100000,4,3]);assert.equal(core.made.toFixed(1),'57.1');
  /* 1. 판정 카드: 흰 배경 · 팀 도넛 · 자동 문장 · 숫자 4개 */
  const vd=v.locator('.pf3-verdict');
  assert.equal(await vd.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)','흰 배경(남색 금지)');
  assert.deepEqual(await vd.locator('.pf3-ring').evaluate(n=>[n.querySelector('b').textContent,n.querySelector('span').textContent,/#3b6ce4 0 57\.1/.test(n.getAttribute('style').replace(/\s/g,' ')),getComputedStyle(n).width]),['57.1%','메이드율',true,'78px']);
  assert.deepEqual(await vd.locator('.tx').evaluate(n=>[...n.children].map(c=>c.textContent)),['한 줄 판정 · 2026년 연간','2026년 연간 수주실적 9.6억 · 결과 난 영업 7건 중 4건을 이겼습니다.','메이드율 57.1% · 기준 50% 이상 / 황윤선 · 메이드율 33% · 팀 평균(57%) 미만 · 결과 확정 3건(수주 1 · 실주 2)']);
  const ks=()=>page.locator('#si-perf .pf3-verdict .ks>div').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent)));
  assert.deepEqual(await ks(),[['연 수주실적','9.6억','4건 · 월평균 1.1억'],['회사 매출','8.6억','직접 계약 + 기술자문 · POUR'],['메이드율','57.1%','기준 50%'],['10월','아직 없음','7일째 · 9월 3.7억']]);
  assert.equal(await vd.locator('.ks>div').nth(3).locator('b').evaluate(n=>getComputedStyle(n).color),'rgb(156, 163, 175)','아직 없음은 회색');
  assert.ok(!/월평균 대비/.test(await v.innerText()),'"0% 월평균 대비" 게이지는 없다');
  /* 2. 담당자 카드 3열: 수주실적 순 · 큰 도넛 · 막힌 사람만 빨강 한 줄 */
  assert.match(await v.locator('.pf3-people .pf3-sh').innerText(),/^누가 얼마나 · 얼마나 이기나\s*수주실적 순 · 원 = 메이드율\(수주 ÷ \(수주 \+ 실주\), 배드핏 제외\) · 50% 미만 빨강$/);
  assert.equal(await v.locator('.pf3-pcs').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3,'카드 3열');
  const pc=await v.locator('.pf3-pc').evaluateAll(l=>l.map(n=>({tag:n.querySelector('.hd em').textContent,name:n.querySelector('.hd button').textContent,last:n.querySelector('.hd span').textContent,ring:n.querySelector('.pf3-ring b').textContent,ringW:getComputedStyle(n.querySelector('.pf3-ring')).width,ringRed:n.querySelector('.pf3-ring b').classList.contains('red'),kv:[...n.querySelectorAll('.kv>*')].map(c=>c.textContent),issue:n.querySelector('.is').textContent,issueColor:getComputedStyle(n.querySelector('.is')).color})));
  assert.equal(pc.length,2);
  assert.deepEqual(pc[0],{tag:'1위',name:'이필선',last:'최근 10.6',ring:'75.0%',ringW:'84px',ringRed:false,kv:['올해 수주실적','6.6억','수주 · 실주','3 · 1','진행','1건'],issue:pc[0].issue,issueColor:'rgb(107, 114, 128)'});
  assert.deepEqual([pc[1].tag,pc[1].name,pc[1].last,pc[1].ring,pc[1].ringRed,pc[1].kv.join('|'),pc[1].issue,pc[1].issueColor],['주의','황윤선','최근 9.1','33.3%',true,'올해 수주실적|3억|수주 · 실주|1 · 2|진행|5건','기한 지난 건 5건 · 최장 17일','rgb(180, 35, 24)'],'막힌 사람만 빨강 · 긴 문장은 한 줄로');
  assert.ok(!/ — /.test(pc[1].issue),'긴 경고 문장 없음');
  assert.match(await v.locator('.pf3-quiet').innerText(),/^아직 기록 없음: .*조재연\(B2B 협약 전담 · 영업 집계 제외\)/);
  /* 3. 브랜드별 · 문의가 수주까지 */
  const fr=await v.locator('.pf3-fr').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('.rt').textContent,n.querySelector(':scope>span').textContent,n.querySelectorAll('.bar span').length]));
  assert.deepEqual(fr,[['석민이앤씨','50.0%','문의 0 → 적합 0 → 수주 1',3],['POUR솔루션','60.0%','문의 8 → 적합 7 → 수주 3',3],['POUR공법','수주 없음','문의 0 → 적합 0 → 수주 0',3],['아파트스퀘어','수주 없음','문의 0 → 적합 0 → 수주 0',3]]);
  /* 4. 탭 4개 중 하나만 */
  const th=v.locator('.pf3-tabs .th');
  assert.deepEqual(await th.locator('button').evaluateAll(l=>l.map(n=>[n.textContent,n.getAttribute('aria-selected')])),[['유입 브랜드 → 낙찰사 · 매출','true'],['접수 월별 전환','false'],['유입경로','false'],['기술자문','false']]);
  assert.equal(await th.locator(':scope>span').innerText(),'2026년 연간 · 수주실적 = 낙찰금액 · 매출 = 회사에 실제 들어오는 금액(직접 계약 · 기술자문 · POUR 계약)');
  assert.equal(await v.locator('.pf3-cr,.pf3-ch,.pf3-ar').count(),0,'다른 탭 표는 그려지지 않는다');
  /* 위 3칸 = 수주실적 · 회사 매출 · 매출 비율, 칸마다 직접 / 협약 · 기술자문 두 부분(2026-10-05 영업 대시보드 v2 시안) — 전부 자료에서 센 값 */
  assert.deepEqual(await v.locator('.pf3-bxtops>div').evaluateAll(l=>l.map(n=>[n.querySelector('.pf3-bxh span').textContent,n.querySelector('.pf3-bxh b').textContent].concat([...n.querySelectorAll('.pf3-bxp')].map(p=>p.querySelector('span').textContent+' = '+p.querySelector('b').textContent)))),[
   ['수주실적 · 낙찰금액 (4건)','9.6억','직접 수주 = 8억','협약 · 기술자문 (낙찰 여름건설 · 코지건설) = 1.6억'],
   ['회사 매출','8.6억','직접 계약 = 8억','기술자문 · POUR 계약 = 5,904만'],
   ['매출 비율 = 매출 8.6억 ÷ 수주실적 8.9억 · 미입력 1건 제외','97%','직접 수주 = 100%','협약 · 기술자문 = 67% · 미입력 1건 제외']]);
  assert.deepEqual(await v.locator('.pf3-bxtops .pf3-bxp i').evaluateAll(l=>l.slice(0,2).map(n=>getComputedStyle(n).backgroundColor)),['rgb(59, 108, 228)','rgb(224, 164, 58)'],'직접 = 파랑 · 협약 = 주황');
  assert.deepEqual(await v.locator('.pf3-bx.hd span').allInnerTexts(),['유입 브랜드','낙찰 시공사','수주 유형','건수','수주실적 (회색) 중 회사 매출 (파랑)']);
  const mr=await v.locator('.pf3-bx:not(.hd)').evaluateAll(l=>l.map(n=>[...n.children].slice(0,4).map(c=>c.textContent.trim()).concat([n.querySelector('.pf3-bxv').textContent,n.querySelector('small').textContent,n.classList.contains('tot')?'tot':''])));
  assert.deepEqual(mr,[['석민이앤씨','석민이앤씨','직접 수주','1','5억','→ 매출 5억 · 전액',''],['POUR솔루션','POUR솔루션','직접 수주','1','3억','→ 매출 3억 · 전액',''],['','여름건설','협약 · 기술자문','1','8,810만','→ 매출 5,904만 · 67%',''],['','코지건설','협약 · 기술자문','1','7,000만','→ 매출 미입력',''],['합계','','','4','9.6억','→ 매출 8.6억 · 97%','tot']],'줄 = 유입 브랜드(첫 줄만) · 낙찰 시공사 · 유형 · 건수 · 수주실적과 매출');
  /* 줄마다 회색 막대 = 수주실적, 그 안의 파란 부분 = 회사 매출 */
  const bars=await v.locator('.pf3-bx:not(.hd):not(.tot) .pf3-bxbar').evaluateAll(l=>l.map(n=>[n.querySelector('.a').style.width,n.querySelector('.r').style.width,getComputedStyle(n.querySelector('.a')).backgroundColor,getComputedStyle(n.querySelector('.r')).backgroundColor]));
  assert.deepEqual(bars.map(b=>[b[0],b[1]]),[['100%','100%'],['60%','60%'],['18%','12%'],['14%','0%']],'막대 폭 = 가장 큰 수주실적 대비');assert.deepEqual([bars[0][2],bars[0][3]],['rgb(223, 227, 234)','rgb(59, 108, 228)']);
  assert.equal(await v.locator('.pf3-bx',{hasText:'코지건설'}).locator('small').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)','매출 미입력 빨강');
  assert.deepEqual(await v.locator('.pf3-bx:not(.hd)').first().locator('>span').evaluateAll(l=>l.map(n=>getComputedStyle(n).borderRightWidth)),['0px','0px','0px','0px','0px'],'칸 사이 세로선 없음(다른 화면의 짧은 클래스 규칙이 걸리지 않는다)');
  assert.equal(await v.locator('.pf3-tn').innerText(),'POUR솔루션으로 들어온 수주실적 4.6억 중 1.6억(35%)이 여름건설 · 코지건설 낙찰 · 기술자문 구조라 회사 매출은 수주실적보다 작게 잡힙니다. 매출 비율 = 매출 ÷ 수주실적. 코지건설 1건 매출 미입력','해석 문장의 숫자도 자료에서');
  if(shot)await page.screenshot({path:shot+'-perf3.png',fullPage:true});
  /* 접수 월별 전환: 수주가 견적문의와 연결되지 않았으면 빨간 경고 */
  await th.locator('button',{hasText:'접수 월별 전환'}).click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#si-perf .pf3-tabs .th>span').innerText(),'같은 달 들어온 문의가 결국 몇 건 계약됐나');assert.equal(await page.locator('#si-perf .pf3-bx').count(),0);
  assert.match(await page.locator('#si-perf .pf3-alert').innerText(),/^데이터 확인 필요 · 2026년 연간 수주 4건 중 견적문의와 연결된 건이 0건입니다\. 수주 건 대부분이 견적문의와 연결되지 않은 채 등록돼 있어, 이 표는 연결을 고친 뒤에 의미가 생깁니다\.$/);
  assert.deepEqual(await page.locator('#si-perf .pf3-cr.hd span').allInnerTexts(),['접수 월','문의','적합','진행 중','수주 · 실주','확정 전환율']);
  const cr=await page.locator('#si-perf .pf3-cr:not(.hd)').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent)));
  assert.deepEqual(cr.map(r=>r[0]),['5월','6월','7월','8월','9월','10월']);
  assert.deepEqual(cr[2],['7월','4','4','4','0 · 0','0.0% · 3개월 지남 · 연결 확인 필요'],'3개월 지난 달');assert.deepEqual(cr[3],['8월','2','1','0','1 · 0','50.0% · 아직 진행 중이 많음 · 판단은 3개월 뒤']);assert.deepEqual(cr[5],['10월','2','2','2','0 · 0','아직 진행 중이 많음 · 판단은 3개월 뒤']);
  cr.forEach(r=>{const [m,q,fit,open,wl]=r,[w,l]=wl.split(' · ').map(Number);assert.equal(Number(fit),w+l+Number(open),m+': 적합 = 수주 + 실주 + 진행 중');});
  /* 문의를 영업건에 연결하면 경고의 숫자가 따라 바뀐다 */
  await page.evaluate(()=>{B.inquiries[0].deal_id='w2';B.inquiries[0].opportunity_id='w2';paint();});await page.waitForTimeout(300);
  {const t=await page.locator('#si-perf .pf3-alert').count()?await page.locator('#si-perf .pf3-alert').innerText():'';const linked=await page.evaluate(()=>{const d=linkedDeal(B.inquiries[0]);return d?d.id:null;});
   if(linked==='w2')assert.match(t,/수주 4건 중 견적문의와 연결된 건이 1건입니다\. 수주 건 일부가/,'연결된 건수 = 자료 그대로');}
  /* 유입경로: 상위 4개 + 기타 n개 */
  await page.locator('#si-perf .pf3-tabs .th button',{hasText:'유입경로'}).click();await page.waitForTimeout(200);
  const ch=await page.locator('#si-perf .pf3-ch').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent)));
  assert.equal(ch.length,5,'상위 4 + 기타');assert.deepEqual(ch[0],['전화','','문의 2 · 적합 2','수주 1']);assert.match(ch[4][0],/^기타 \d+개$/);
  assert.equal(ch.reduce((s,r)=>s+Number(/문의 (\d+)/.exec(r[2])[1]),0),8,'문의 합 = 기간 문의 수');
  assert.match(await page.locator('#si-perf .pf3-tn').innerText(),/^전화이\(가\) 문의의 25%\(2건\) · 수주 1건\. 기타 경로 \d+개\(\d+건\)는 한 줄로 묶음\. 유입경로 미입력 문의가 많으면 이 표가 틀려집니다 — 견적문의 유입경로 칸 채우기 우선\./);
  /* 기술자문: 현장 · 공종 · 낙찰 시공사 · 낙찰일 · 기술자문 계약일 · 낙찰금액 · 회사 매출 · 상태 · 미입력 빨강 */
  await page.locator('#si-perf .pf3-tabs .th button',{hasText:'기술자문'}).click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#si-perf .pf3-tb.adv .pf3-big').evaluate(n=>[...n.children].map(c=>c.textContent)),['협약시공사 낙찰 · 수주실적에 포함','1.6억','2건 · 귀속 이필선 2']);
  assert.deepEqual(await page.locator('#si-perf .pf3-ar.hd span').allInnerTexts(),['현장','공종','낙찰 시공사','낙찰일','기술자문 계약일','낙찰금액','회사 매출','상태']);
  const ar=await page.locator('#si-perf .pf3-ar:not(.hd)').evaluateAll(l=>l.map(n=>[...n.children].map(c=>[c.textContent,c.classList.contains('red')||!!c.querySelector('em.r')])));
  assert.deepEqual(ar.map(r=>r.map(c=>c[0])),[['[경기 평택] 비전지웰푸르지오','미입력','코지건설','2026.9.12','미입력','7,000만','미입력','계약 전'],['[경기 수원] 평동동남','외벽 재도장 · 균열 보수','여름건설','2026.6.10','2026.6.24','8,810만','5,904만','진행 중']]);
  assert.deepEqual(ar[0].map(c=>c[1]),[false,true,false,false,true,false,true,true],'미입력 · 계약 전은 빨강');
  assert.equal(await page.locator('#si-perf .pf3-tb.adv .pf3-tn').count(),0,'서버가 새 칸을 내려주면 안내가 없다');
  if(shot)await page.screenshot({path:shot+'-perf3-adv.png',fullPage:true});
  /* 서버 함수가 아직 예전 것이면(새 칸 없음) 지어내지 않고 '-' + 안내 */
  await page.evaluate(()=>{DealWin._take({rows:[],advisory:__adv.map(x=>{const y=Object.assign({},x);delete y.contract_date;delete y.settle_state;delete y.work_name;delete y.work_type;delete y.advisory_status;return y;})});paint();});await page.waitForTimeout(300);
  {const a2=await page.locator('#si-perf .pf3-ar:not(.hd)').first().evaluate(n=>[...n.children].map(c=>c.textContent));assert.deepEqual([a2[4],a2[7]],['-','-']);assert.equal(await page.locator('#si-perf .pf3-tb.adv .pf3-tn').innerText(),'기술자문 계약일 · 상태는 서버 읽기 함수를 갱신한 뒤에 표시됩니다.');}
  await page.evaluate(()=>{DealWin._take({rows:[],advisory:__adv});paint();});await page.waitForTimeout(200);
  /* 4-2. 추가 분석(5차 블록 2 · 3 · 4 — 2026-10-05 영업분석블록.dc.html): 영업 성과(기준 전환) · 영업 행동 · 실주 분석을 하나씩. 숫자 · 문장은 전부 자료에서 */
   {const x=page.locator('#si-perf .pf3-x'),one=s=>s.replace(/\s+/g,' ').trim();assert.equal(await x.count(),1);
    assert.equal(await page.locator('#si-perf .pf3').evaluate(n=>[...n.children].map(c=>c.className.split(' ')[0]).join(' ')),'pf3-verdict pf3-mid pf3-tabs pf3-x pf3-lead pf3-pending','기존 구역은 그대로 · 탭 아래에 덧붙임(ops_12 D⑪ 단계별 선행 → 결과는 그 아래)');
    assert.deepEqual(await page.locator('#si-perf .pf3-lead .pf3-lt>b:not(.r)').allInnerTexts(),['견적문의','컨설팅 설계','자료 발송','관계관리','경쟁 · 입찰'],'단계별 선행 → 결과 5줄');
    assert.ok((await page.locator('#si-perf .pf3-lead .pf3-lt>b.r').allInnerTexts()).every(t=>/^(–|\d+%)$/.test(t)),'값은 % 또는 –');
    assert.deepEqual(await x.locator('.pf3-xt button').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-pressed')])),[['영업 성과','true'],['영업 행동','false'],['실주 분석','false']]);assert.equal(one(await x.locator('.pf3-xt').innerText()),'추가 분석 영업 성과 영업 행동 실주 분석 하나씩 보기');
    assert.deepEqual(await x.locator('.pf3-xt button').first().evaluate(b=>{const s=getComputedStyle(b);return [s.backgroundColor,s.color,s.borderRadius];}),['rgb(21, 23, 28)','rgb(255, 255, 255)','999px']);
    /* 영업 성과: 기준 6개 · 수주 = 직접 + 협약 · 기술자문 + 타사 이관, 실주 = 파이프라인 실주, 낙찰금액 = 수주실적 */
    assert.deepEqual(await x.locator('.pf3-xh button').allInnerTexts(),['담당자','브랜드','공종','지역','유입경로','협약업체']);assert.equal(await x.locator('.pf3-xh>span').innerText(),'수주실적 = 낙찰금액 · 2026년 연간');
    const rows=()=>x.locator('.pf3-xp>:not(.hd)').evaluateAll(l=>{const o=[];for(let i=0;i<l.length;i+=5)o.push([l[i].textContent,l[i+1].textContent,l[i+2].textContent,l[i+3].textContent,l[i+4].querySelector('b').textContent,l[i+4].querySelector('b').classList.contains('red'),l[i+4].querySelector('u i').style.width,getComputedStyle(l[i].querySelector('i')).backgroundColor]);return o;});
    const pick=async n=>{await x.locator('.pf3-xh button',{hasText:n}).click();await page.waitForTimeout(150);return rows();};
    assert.deepEqual(await x.locator('.pf3-xp .hd').allInnerTexts(),['담당자','수주','실주','낙찰금액','메이드율']);
    assert.deepEqual((await rows()).map(r=>r.slice(0,7)),[['이필선','3','1','6.6억','75.0%',false,'75%'],['황윤선','1','2','3억','33.3%',true,'33.3%']],'담당자: 수주실적 순 · 낮은 메이드율만 빨강');
    assert.equal(await x.locator('.pf3-xnote').innerText(),'이필선이 수주실적의 69% · 메이드율은 이필선 75.0%가 가장 높고 황윤선 33.3%가 가장 낮음 (결과 3건 이상만 비교)');
    const br=await pick('브랜드');assert.deepEqual(br.map(r=>r.slice(0,5)),[['석민이앤씨','1','1','5억','50.0%'],['POUR솔루션','3','2','4.6억','60.0%']]);assert.notEqual(br[0][7],'rgb(201, 205, 213)','브랜드일 때만 브랜드색 띠');
    assert.equal(await x.locator('.pf3-xnote').innerText(),'석민이앤씨가 수주실적의 52% · 결과가 3건 이상인 항목이 둘 이상 쌓이면 메이드율을 비교합니다');
    assert.deepEqual((await pick('지역')).map(r=>r.slice(0,5).concat([r[7]])),[['서울','1','0','5억','100.0%','rgb(201, 205, 213)'],['경기','3','0','4.6억','100.0%','rgb(201, 205, 213)'],['수원','0','2','수주 없음','0.0%','rgb(201, 205, 213)'],['인천','0','1','수주 없음','0.0%','rgb(201, 205, 213)']],'지역 = 현장명 머리 · 수주 없으면 그렇게 적는다');
    assert.deepEqual((await pick('유입경로')).map(r=>r.slice(0,4)),[['유입경로 미기록','3','3','6.6억'],['전화','1','0','3억']],'유입경로 = 연결된(없으면 같은 현장) 견적문의의 값');
    assert.deepEqual((await pick('협약업체')).map(r=>r.slice(0,5)),[['직접 수주','2','0','8억','100.0%'],['여름건설 (기술자문)','1','0','8,810만','100.0%'],['코지건설 (기술자문)','1','0','7,000만','100.0%']]);
    assert.equal(await x.locator('.pf3-xnote').innerText(),'직접 수주가 수주실적의 83% · 협약 · 기술자문 수주는 실주 없이 결과 확정 (협약 단계 진입 후)');
    assert.deepEqual((await pick('공종')).map(r=>r[0]),['공종 미기록'],'기록이 없으면 지어내지 않는다');
    if(shot){await pick('담당자');await page.screenshot({path:shot+'-perf3-x-perf.png',fullPage:true});}
    /* 실주 분석: 파이프라인 실주만 · 운영 기준 분류(관계 · 공법 · 가격 · 사업 + 분류 밖은 기타) · 놓친 금액 = 예상금액 합 */
    await x.locator('.pf3-xt button',{hasText:'실주 분석'}).click();await page.waitForTimeout(200);assert.equal(await x.locator('.pf3-xp,.pf3-xh').count(),0,'하나씩 보기');
    assert.equal(one(await x.locator('.pf3-xl .hd').innerText()),'실주 3건 · 왜 졌나 파이프라인 실주만 · Bad Fit 제외 · 2026년 연간 놓친 금액(예상금액) 3억');
    assert.deepEqual(await x.locator('.pf3-xl .cs>div').evaluateAll(l=>l.map(n=>[...n.querySelectorAll('.t>*')].map(c=>c.textContent).concat([...n.querySelectorAll('.s')].map(s=>s.children[0].textContent+' '+s.children[1].textContent)))),[['관계','0',''],['공법','0',''],['가격','2','2억','가격 경쟁 2'],['사업','0',''],['기타','1','1억','담당자 부재·인수인계 누락 1']]);
    assert.deepEqual(await x.locator('.pf3-xl .bar i').evaluateAll(l=>l.map(n=>n.style.width)),['0%','0%','66.7%','0%','33.3%']);
    assert.equal(await x.locator('.pf3-xl .les').innerText(),'실주 복기(배운 점)가 아직 기록되지 않았습니다 — 실주 처리 때 한 줄씩 남기면 여기에 모입니다');
    /* 영업 행동: 기록이 없으면 '—' · '기록 부족' */
    await x.locator('.pf3-xt button',{hasText:'영업 행동'}).click();await page.waitForTimeout(200);
    const beh=()=>x.locator('.pf3-xb').first().locator('.g4>*').evaluateAll(l=>{const o=[];for(let i=0;i<l.length;i+=4)o.push([0,1,2,3].map(k=>l[i+k].textContent.replace(/\s+/g,' ').trim()));return o;});
    assert.deepEqual(await beh(),[['행동','수주 4건','실주 3건','차이'],['첫 응대','—','—','기록 부족'],['견적까지','—','—','기록 부족'],['견적 후 재접촉','—','—','기록 부족'],['접촉한 사람 수','—','—','기록 부족'],['견적 수정','—','—','기록 부족']]);
    assert.equal(await x.locator('.pf3-xb .pb').innerText(),'플레이북 후보 · 기록(첫 연락 · 견적 발송일 · 연락처 · 견적 버전)이 쌓이면 수주 현장의 공통점을 여기에 적습니다');
    const plan=()=>x.locator('.pf3-xb').nth(1).locator('.g4>*').evaluateAll(l=>{const o=[];for(let i=0;i<l.length;i+=4)o.push([0,1,2,3].map(k=>l[i+k].textContent+(l[i+k].classList.contains('red')?'!':'')));return o;});
    assert.equal(await x.locator('.pf3-xb').nth(1).locator('.hd').innerText(),'계획 대비 실제 · 담당자별 · 최근 4주');
    assert.deepEqual(await plan(),[['담당','약속 지킴','견적 예정 대비','다음 할 일 이행'],['황윤선','—','—','0%!']],'기한 지난 다음 할 일 5건 · 끝낸 것 0');
    assert.equal(one(await x.locator('.pf3-xb .off').innerText()),'이번 주 어긋난 것 이번 주에 어긋난 약속 · 견적 예정이 없습니다');
    /* 기록이 쌓이면: 수주 현장 · 실주 현장 평균과 차이 · 약속 · 견적 예정 · 복기 */
    await page.evaluate(()=>{const by=id=>B.deals.find(d=>d.id===id),T=s=>s+':00+09:00';
     Object.assign(by('w1'),{created_at:T('2026-02-01T09:00'),activities:[{id:'aw1',type:'전화',note:'첫 통화',at:T('2026-02-01T11:00')},{id:'aw2',type:'방문',note:'현장 확인',at:T('2026-02-08T10:00')}],contacts:[{name:'관리소장'},{name:'회장'}],quote_versions:[{},{},{}],stage_contexts:{sent:{fields:{sent_date:'2026-02-04'}}}});
     Object.assign(by('l1'),{created_at:T('2026-07-01T09:00'),activities:[{id:'al1',type:'전화',note:'첫 통화',at:T('2026-07-01T17:00')},{id:'al2',type:'전화',note:'후속',at:T('2026-07-20T10:00')}],contacts:[{name:'관리소장'}],quote_versions:[{}],stage_contexts:{lost:{fields:{close_reason:'가격 열세',close_detail:'확인',lesson:'소장만 만나고 회장을 못 만남'}},sent:{fields:{sent_date:'2026-07-08'}}}});
     by('l3').stage_contexts.lost.fields.lesson='소장만 만나고 회장을 못 만남';
     by('o1').completed_actions=[{id:'c1',type:'고객 약속',text:'재통화',due_at:'2026-10-02',status:'completed',completed_at:T('2026-10-02T15:00')}];
     by('o2').completed_actions=[{id:'c2',text:'고객 약속 · 견적 설명',due_at:'2026-10-05',status:'completed',completed_at:T('2026-10-07T09:00')}];
     const n1=by('n1');n1.stage_contexts=Object.assign({},n1.stage_contexts,{consulting:{fields:{quote_due:'2026-10-01'}},sent:{fields:{sent_date:'2026-10-06'}}});n1.completed_actions=[{id:'c3',text:'제안서 공유',due_at:'2026-10-03',status:'completed',completed_at:T('2026-10-03T10:00')}];
     paint();});await page.waitForTimeout(300);
    assert.deepEqual((await beh()).slice(1),[['첫 응대','2시간 1건','8시간 1건','4배 빠름'],['견적까지','3일 1건','7일 1건','4일 빠름'],['견적 후 재접촉','4일 1건','12일 1건','8일 빠름'],['접촉한 사람 수','2명 1건','1명 1건','1명 더'],['견적 수정','2회 1건','0회 1건','2회 더']],'평균 = 기록이 있는 현장만(건수 표시)');
    assert.equal(await x.locator('.pf3-xb .pb').innerText(),'플레이북 후보 · 수주한 현장은 첫 응대 · 견적까지 · 견적 후 재접촉 · 접촉한 사람 수 · 견적 수정에서 실주한 현장보다 좋았습니다');
    const pl=(await plan()).slice(1);assert.deepEqual(pl.find(r=>r[0]==='이필선'),['이필선','—','+5일!','100%'],'견적 예정 10/1 → 10/6 발송');assert.deepEqual(pl.find(r=>r[0]==='황윤선'),['황윤선','50%!','—','14%!'],'약속 2건 중 1건 · 다음 할 일 7건 중 1건');
    assert.deepEqual(await x.locator('.pf3-xb .off>div').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent))),[['견적 약속','[수원] 매탄 임박 · 10/1 예정 → 10/6 발송','+5일'],['고객 약속','[경기] 기한 지난 현장 2 · 10/5 고객 약속 · 견적 설명 → 10/7 완료','+2일']],'이번 주(10/5~)에 어긋난 것만');
    if(shot)await page.screenshot({path:shot+'-perf3-x-beh.png',fullPage:true});
    await x.locator('.pf3-xt button',{hasText:'실주 분석'}).click();await page.waitForTimeout(200);
    assert.equal(await x.locator('.pf3-xl .les').innerText(),'실주 복기에서 가장 많이 나온 말 · "소장만 만나고 회장을 못 만남" (2건)');
    if(shot)await page.screenshot({path:shot+'-perf3-x-lost.png',fullPage:true});
    /* 끄기: 추가 분석만 숨김 */
    await page.evaluate(()=>{G.perfExtraOff=true;paint();});await page.waitForTimeout(200);assert.equal(await page.locator('#si-perf .pf3-x').count(),0);assert.equal(await page.locator('#si-perf .pf3-tabs').count(),1);
    await page.evaluate(()=>{G.perfExtraOff=false;G.perfV3.xt=0;G.perfV3.dim=0;paint();});await page.waitForTimeout(200);}
   /* 5. 아직 판단 못 하는 것: 한 줄 */
  assert.match(await page.locator('#si-perf .pf3-pending').innerText(),/^아직 판단 못 하는 것\s*기록이 10건 쌓이면 자동으로 보입니다\s*견적 후 첫 후속 → 수주\s*\d+\/10\s*현장 방문 → 견적\s*\d+\/10\s*경쟁 · PT · 입찰 → 수주\s*\d+\/10$/);
  /* 6. 기간 · 브랜드 필터가 판정 · 숫자 · 퍼널 · 브랜드 표에 반영 */
  await page.locator('#si-perf .db-seg [data-v="3"]').click();await page.waitForTimeout(300);
  assert.match(await page.locator('#si-perf .pf3-verdict .tx>b').innerText(),/^2026년 3분기 수주실적 3\.7억 · 결과 난 영업 4건 중 2건을 이겼습니다\.$/);
  assert.deepEqual((await ks()).map(k=>[k[0],k[1]]).slice(0,3),[['분기 수주실적','3.7억'],['회사 매출','3억'],['메이드율','50.0%']]);
  await page.locator('#si-perf .db-seg [data-v="0"]').click();await page.waitForTimeout(250);
  await page.locator('#pg-perf>.cf-bar [data-sf-brand="석민이앤씨"]').click();await page.waitForTimeout(400);
  assert.match(await page.locator('#si-perf .pf3-verdict .tx>b').innerText(),/^석민이앤씨 2026년 연간 수주실적 5억 · 결과 난 영업 2건 중 1건을 이겼습니다\.$/);
  assert.deepEqual(await page.locator('#si-perf .pf3-fr b:first-of-type').evaluateAll(l=>l.map(n=>n.textContent)),['석민이앤씨'],'퍼널도 그 브랜드만');
  await page.locator('#si-perf .pf3-tabs .th button',{hasText:'유입 브랜드'}).click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#si-perf .pf3-bx:not(.hd)').evaluateAll(l=>l.map(n=>n.children[0].textContent)),['석민이앤씨'],'브랜드 표도 그 브랜드만 · 합계 줄 없음');assert.match(await page.locator('#si-perf .pf3-tn').innerText(),/^직접 수주만 있어 수주실적과 회사 매출이 같습니다\./);
  await page.locator('#pg-perf>.cf-bar [data-sf-brand="전체"]').click();await page.waitForTimeout(400);
  /* 이름을 누르면 그 담당자로(기존 동작) · 전체 현황 · 컨트롤타워는 그대로 */
  await page.evaluate(()=>goPage('dash'));await page.waitForTimeout(300);assert.equal(await page.locator('#si-dash .pf3').count(),0);assert.equal(await page.locator('#si-dash .db-kpis').count(),1,'전체 현황은 그대로');
  await page.evaluate(()=>goPage('control'));await page.waitForTimeout(300);assert.equal(await page.locator('#si-control .pf3').count(),0);assert.equal(await page.locator('#si-control .db-mx').count(),1,'컨트롤타워는 그대로');
  /* 좁은 화면 · 끄기 */
  await page.evaluate(()=>goPage('perf'));await page.waitForTimeout(300);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.perfV3Off=true;paint();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#si-perf .pf3').count(),0);assert.equal(await page.locator('#si-perf .db-verdict').count(),1,'끄면 예전 성과 분석');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',verdict_white_team_donut:true,auto_sentence_from_data:true,kpi4_month_none_label:true,people_big_donut_cards3:true,blocked_only_red_one_line:true,brand_funnel:true,tabs_one_at_a_time:true,brand_company_matrix:true,cohort_link_warning:true,channel_top4_plus_rest:true,advisory_work_dates_state:true,advisory_gate_before_server:true,extra_perf_dims6:true,extra_behavior_from_records:true,extra_lost_rules_categories:true,filters_reflected:true,other_pages_untouched:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
