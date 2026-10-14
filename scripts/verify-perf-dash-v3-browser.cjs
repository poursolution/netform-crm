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
   /* ── 영업 대시보드 v3 · 성과 분석(README 'v3 정리'): 대표 한 줄 → 판단 카드 3장 → 아직 판단 못 하는 것 → 사람(기준 + 담당자별 표) → 돈 → 더 보기 ── */
   const p=page.locator('#si-perf .db-shell'),v=p.locator('.pf3.v3'),o=s=>s.replace(/\s+/g,' ').trim();
   assert.equal(await v.count(),1);
   assert.equal(await v.evaluate(n=>[...n.children].map(e=>e.className.split(' ').pop()).join(' ')),'pf3-ceo db-judges pf3-pending pf3-crit pf3-h2 pf3-pt pf3-h2 pf3-money pf3-h2 pf3-more','순서 · 예전 브랜드 × 낙찰사 표 · 기술자문 탭은 돈 3칸으로 대체');
   assert.equal(await v.locator('.pf3-tabs, .pf3-verdict, .pf3-pcs').count(),0);
   assert.deepEqual((await v.locator('.pf3-ceo>div').allInnerTexts()).map(o),['올해 실적 수주 9.6억 · 매출 8.6억 목표 대비는 목표값 입력 후 표시 · 월평균 1.1억','잘 안 되는 곳 황윤선 메이드율 33% 팀 57%보다 24%p 낮음 · 결과 확정 3건(실주 2)','아직 모르는 것 없음 실주 3건 사유 모두 기록됨','결정해 주실 것 없음 지금 자료로는 결정이 필요한 항목이 없습니다']);
   assert.deepEqual((await v.locator('.db-judge').allInnerTexts()).map(o),['① 올해 얼마 벌었나 9.6억 수주실적 · 회사 매출 8.6억 (90%) 직접 수주 2건 8억 협약 · 기술자문 2건 1.6억 월평균 (1~9월) 1.1억 판단 근거 펼치기 ▾ 수주 4건 →','② 담당별 차이 42%p 최고 75% · 최저 33% · 팀 57% 이필선 · 결과 확정 4건 75% 황윤선 · 결과 확정 3건 33% 판단 근거 펼치기 ▾ 담당자별 표 →','③ 왜 졌나 3 / 3 실주 사유가 기록된 건 가격 2건 기타 1건 사유 미기록 0건 판단 근거 펼치기 ▾ 실주 3건 · 실주 분석 →']);
   assert.equal(await v.locator('.db-judge .jbasis').count(),0,'판단 근거 기본 접힘');await v.locator('.db-judge .jb').first().click();await page.waitForTimeout(200);
   assert.equal(await page.locator('#si-perf .db-judge .jbasis').count(),3,'3장 함께');assert.match(o(await page.locator('#si-perf .db-judge .jbasis').nth(1).innerText()),/^대상 2026년 연간 결과 확정 3건 이상 담당 2명 계산 담당별 메이드율 · 최고 − 최저 · 팀 = 수주 4 ÷ 결과 확정 7/);
   await page.locator('#si-perf .db-judge .jb').first().click();await page.waitForTimeout(200);
   assert.equal(o(await page.locator('#si-perf .pf3-crit').innerText()),"사람 · 평가는 아래 표 '평가' 4칸(수주실적 · 메이드율 · 약속 이행 · 2시간 첫 연락)만으로 대표님 판단 기준 '참고' 칸 진행 건수 · 손볼 건 — 일이 많은지 · 막혔는지 보는 용도, 잘하고 못하고가 아님 평가에서 빼는 것 기록 없음을 '안 했다'로 보기 · 결과 확정 3건 미만 메이드율 · 담당 바뀌기 전 데이터 · 사유 없는 실주(3건 중 0건)");
   const T=page.locator('#si-perf .pf3-pt');
   assert.deepEqual((await T.locator('.pf3-pr').allInnerTexts()).map(o),['평가 · 이 4칸으로 판단 참고','담당 수주실적 메이드율 (수주 · 실주) 약속 이행 2시간 첫 연락 진행 손볼 건 왜','이필선 6.6억 75% 수주 3 · 실주 1 — 0% 1 0 막힌 곳 없음','황윤선 3억 33% 수주 1 · 실주 2 — — 5 5 기한 지난 건 5건 · 최장 17일 — 자료 발송완료 단계에 5건 몰림'],'평가 4칸 + 참고 2칸 + 왜');
   assert.deepEqual(await T.locator('.pf3-pr.grp>span').evaluateAll(l=>l.slice(1,3).map(n=>getComputedStyle(n).borderBottomColor)),['rgb(21, 23, 28)','rgb(201, 205, 213)'],'평가 = 검은 줄 · 참고 = 회색 줄');
   assert.equal(await T.locator('.pf3-pr:not(.hd):not(.grp)').first().locator('.mb s').evaluate(n=>n.style.left),'57%','점선 = 팀 메이드율');
   assert.equal(o(await T.locator('.pf3-pn').innerText()),'황윤선 33%는 팀 57%보다 24%p 이상 낮습니다. 진행 · 수주 기록 없음: 한준엽 · 정정훈 · 김성민 · 조현식 · 조재연(B2B 협약 전담)');
   const M=page.locator('#si-perf .pf3-money');
   assert.match(o(await M.locator('.top').innerText()),/^올해 수주실적 · 낙찰금액 4건 9\.6억 → 그중 회사에 들어오는 돈 8\.6억 90% 빠지는 9,906만은 협약 · 기술자문 건 — 시공사\(여름건설 · 코지건설\)가 낙찰받고 우리는 기술자문료만 받는 구조 · 매출 미입력 1건은 0으로 셈$/);
   assert.deepEqual((await M.locator('.pf3-mc').allInnerTexts()).map(o),['석민이앤씨로 들어온 것 1건 5억 → 매출 5억 · 100% 직접 수주 1건 5억 · 전액 매출 건별 보기 →','POUR솔루션으로 들어온 것 3건 4.6억 → 매출 3.6억 · 78% 직접 수주 1건 3억 · 전액 매출 여름건설 낙찰 1건 8,810만 → 매출 5,904만 코지건설 낙찰 1건 7,000만 → 매출 미입력 건별 보기 →','기술자문 낙찰실적 2건 · 수주실적에 포함 1.6억 귀속 상위 · 이필선 2건 1.6억 건별 보기 →'],'돈 3칸');
   const MB=page.locator('#si-perf .pf3-more');
   assert.deepEqual(await MB.locator(':scope>.hd button').evaluateAll(l=>l.map(b=>b.textContent+'|'+b.getAttribute('aria-pressed'))),['영업 행동|true','실주 분석|false','브랜드별 문의 → 수주|false','단계별 선행 → 결과|false','접수 월별 전환|false','유입경로|false'],'더 보기 = 하나씩');
   await page.locator('#si-perf .db-judge .jl',{hasText:'실주 분석'}).click();await page.waitForTimeout(300);
   assert.equal(await page.locator('#si-perf .pf3-more>.hd button[aria-pressed="true"]').innerText(),'실주 분석','판단 카드 링크 = 더 보기의 실주 분석');assert.equal(await page.locator('#si-perf .pf3-more .pf3-xl').count(),1);
   await page.locator('#si-perf .pf3-more>.hd button',{hasText:'유입경로'}).click();await page.waitForTimeout(250);assert.ok((await page.locator('#si-perf .pf3-more .pf3-ch').count())>0,'유입경로 표');
   await page.locator('#si-perf .pf3-more>.hd button',{hasText:'접수 월별 전환'}).click();await page.waitForTimeout(250);assert.ok((await page.locator('#si-perf .pf3-more .pf3-cr').count())>0,'접수 월별 전환 표');
   assert.deepEqual(await page.locator('#si-perf .pf3-pr:not(.hd):not(.grp)').evaluateAll(l=>l.filter(r=>[...r.children].some(c=>!c.classList.contains('why')&&c.scrollWidth>c.clientWidth+1)).length),0,'담당자별 표 글 넘침 없음');
   if(shot)await page.screenshot({path:shot,fullPage:true});
   /* 끄면 v2 성과 분석(PerfV3 예전 배치) */
   await page.evaluate(()=>{G.dashV3Off=true;paint();});await page.waitForTimeout(300);assert.equal(await page.locator('#si-perf .pf3.v3').count(),0);assert.equal(await page.locator('#si-perf .pf3-verdict').count(),1);
   assert.deepEqual(errs,[]);
   console.log(JSON.stringify({status:'PASS',order:true,ceo4:true,judge3_basis_folded:true,people_eval4_ref2:true,money_bar_3cards:true,more_one_at_a_time:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
