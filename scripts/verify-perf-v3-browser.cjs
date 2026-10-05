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
  assert.deepEqual(await vd.locator('.tx').evaluate(n=>[...n.children].map(c=>c.textContent)),['한 줄 판정 · 2026년 연간','2026년 연간 수주실적 9.6억 · 결과 난 영업 7건 중 4건을 이겼습니다.','메이드율 57.1% · 기준 50% 이상 · 황윤선이(가) 팀 평균을 끌어내림']);
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
   ['매출 비율 (매출 ÷ 수주실적) · 미입력 1건 제외','97%','직접 수주 = 100%','협약 · 기술자문 = 67% · 미입력 1건 제외']]);
  assert.deepEqual(await v.locator('.pf3-bxtops .pf3-bxp i').evaluateAll(l=>l.slice(0,2).map(n=>getComputedStyle(n).backgroundColor)),['rgb(59, 108, 228)','rgb(224, 164, 58)'],'직접 = 파랑 · 협약 = 주황');
  assert.deepEqual(await v.locator('.pf3-bx.hd span').allInnerTexts(),['유입 브랜드','낙찰 시공사','수주 유형','건수','수주실적 (회색) 중 회사 매출 (파랑)']);
  const mr=await v.locator('.pf3-bx:not(.hd)').evaluateAll(l=>l.map(n=>[...n.children].slice(0,4).map(c=>c.textContent.trim()).concat([n.querySelector('.pf3-bxv').textContent,n.querySelector('small').textContent,n.classList.contains('tot')?'tot':''])));
  assert.deepEqual(mr,[['석민이앤씨','석민이앤씨','직접 수주','1','5억','= 매출 전액',''],['POUR솔루션','POUR솔루션','직접 수주','1','3억','= 매출 전액',''],['','여름건설','협약 · 기술자문','1','8,810만','→ 매출 5,904만 · 67%',''],['','코지건설','협약 · 기술자문','1','7,000만','→ 매출 미입력',''],['합계','','','4','9.6억','→ 매출 8.6억 · 97%','tot']],'줄 = 유입 브랜드(첫 줄만) · 낙찰 시공사 · 유형 · 건수 · 수주실적과 매출');
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
  console.log(JSON.stringify({status:'PASS',verdict_white_team_donut:true,auto_sentence_from_data:true,kpi4_month_none_label:true,people_big_donut_cards3:true,blocked_only_red_one_line:true,brand_funnel:true,tabs_one_at_a_time:true,brand_company_matrix:true,cohort_link_warning:true,channel_top4_plus_rest:true,advisory_work_dates_state:true,advisory_gate_before_server:true,filters_reflected:true,other_pages_untouched:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
