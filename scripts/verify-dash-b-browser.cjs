'use strict';
/* 영업 대시보드 v2 검사(2026-10-04 핸드오프 dashboard): 전체 현황 · 컨트롤타워 · 성과 분석
   지표 = 주간 브리핑 · 월간 리포트와 같은 정의(계약실적 = 원장, 메이드율 = 수주 ÷ (수주 + 실주) · 배드핏 제외, 적합률, 문의 → 계약, 현재 전환율)
   실적이 없는 기간 = '아직 없음' · 문장 속 숫자는 자료에서 · 컨트롤타워 표는 안쪽 스크롤 없이 · 할 일 지정 · 알림은 관리자 · 팀장만 · 끄면(G.dashBOff) 예전 화면 */
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
  /* 오늘 = 2026-10-07(수) 10:00 — 10월 계약 없음 · 이번 주 = 10/5(월) ~ 10/11(일) */
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DashB&&window.SalesInsights&&window.BriefB&&window.ContractSalesData&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const U=n=>'0000000'+n+'-0000-4000-8000-00000000000'+n,T=k=>k+'T10:00:00+09:00';
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:'2026-02-01',code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const lost=(id,site,owner,k,reason,brand)=>deal(id,site,owner,'lost',{outcome:'lost',grp:'수주 실패',brand,closed_at:T(k),closed:k,stage_contexts:{lost:{fields:{close_reason:reason,close_detail:'확인'}}}});
   const inq=(n,site,owner,at,extra)=>Object.assign({id:U(n),site,status:owner?'배정완료':'접수',at,created_at:at,received_at:at,brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at:null},extra||{});
   B={deals:[
     deal('w1','[서울 마포] 계약 A','이필선','won',{outcome:'won',grp:'수주 성공',brand:'석민이앤씨',won_amount:5e8,closed_at:T('2026-03-10')}),
     deal('w2','[경기 고양] 계약 B','황윤선','won',{outcome:'won',grp:'수주 성공',won_amount:3e8,closed_at:T('2026-09-20')}),
     lost('l1','[인천] 실주 가격','이필선','2026-08-08','가격 열세','석민이앤씨'),lost('l2','[수원] 실주 소장','황윤선','2026-09-18','담당자 부재·인수인계 누락','POUR솔루션'),lost('l3','[수원] 실주 가격2','황윤선','2026-05-19','가격 열세','POUR솔루션'),
     ...[1,2,3,4,5].map(i=>deal('o'+i,'[경기] 기한 지난 현장 '+i,'황윤선','sent',{nextActionObj:{text:'후속 통화',due:'2026-09-20',status:'open'},lastMeaningfulContactAt:T('2026-09-01'),activities:[{id:'ao'+i,type:'전화',note:'통화',at:T('2026-09-01')}]})),
     deal('n1','[수원] 매탄 임박','이필선','bidding',{amt:4e8,brand:'석민이앤씨',stage_contexts:{bidding:{fields:{bid_deadline:'2026-10-09',bid_terms:'일반'}}},nextActionObj:{text:'입찰 준비',due:'2026-10-09',status:'open'},lastMeaningfulContactAt:T('2026-10-06'),activities:[{id:'an1',type:'전화',note:'관리소장 통화',at:T('2026-10-06')}]}),
     deal('n2','[서울 송파] 계약 검토','이필선','contract',{amt:3e8,stage_contexts:{contract:{fields:{contract_status:'체결 예정',contract_amount:35e7,contract_date:'2026-10-27'}}},nextActionObj:{text:'계약서 검토',due:'2026-10-20',status:'open'},lastMeaningfulContactAt:T('2026-10-05'),activities:[{id:'an2',type:'방문',note:'현장 방문',at:T('2026-10-05')}]})],
    inquiries:[inq(1,'[경기 고양] 계약 B','황윤선','2026-08-02T10:00:00+09:00',{responded_at:'2026-08-02T11:00:00+09:00'}),inq(2,'[서울] 미배정 문의','','2026-10-07T08:00:00+09:00'),inq(3,'[부산] 범위 밖','','2026-08-06T10:00:00+09:00',{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 공사 범위 밖 · 이전 상태: 접수'}),inq(4,'[경기] 첫 연락 지연','이필선','2026-10-06T09:00:00+09:00')],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   const ev=(id,k,n,o,b)=>({deal_id:id,brand:b,sales_owner_name:o,events:[{kind:'signed',effective_date:k,amount_delta:n}]});
   ContractSalesData.state=()=>({status:'ready',items:[ev('w1','2026-03-10',5e8,'이필선','석민이앤씨'),ev('w2','2026-09-20',3e8,'황윤선','POUR솔루션')]});
   window.__opened=[];drwDeal=s=>__opened.push(JSON.parse(s).id);drwInq=s=>__opened.push(JSON.parse(s).id);
   window.__batch=null;if(window.PipelineBatch)PipelineBatch.openRows=(rows,mode)=>{window.__batch=[rows.map(r=>r.item.id).sort(),mode];};
   goPage('dash');
  });
  await page.waitForTimeout(500);
  /* ── 1. 전체 현황 ── */
  const d=page.locator('#si-dash .db-shell');assert.equal(await d.count(),1,'새 대시보드');assert.equal(await page.locator('#si-dash .si-shell').count(),0,'예전 화면 대신');
  assert.equal(await page.locator('#ptitle').innerText(),'영업 대시보드');assert.match(await page.locator('#psub').innerText(),/전 직원 공개$/);
  assert.equal(await page.locator('#pg-dash>.cf-bar .cf-pill').count()>=5,true,'공통 필터줄(전체 + 브랜드 4)');assert.equal(await page.locator('#pg-dash>.cf-bar').isVisible(),true);assert.equal(await page.locator('#pg-dash>.cf-bar').evaluate(n=>getComputedStyle(n).position),'sticky');
  assert.equal(await d.locator('.db-month').evaluate(n=>n.getBoundingClientRect().height<420),true,'월별 카드 높이');
  assert.match(await d.locator('.db-tool').innerText(),/컨트롤타워 ↗\s*성과 분석 ↗\s*2026년 연간 접수 · 계약실적 \/ 파이프라인 · 조치 필요는 현재 기준[\s\S]*연간\s*1분기\s*2분기\s*3분기\s*4분기\s*LIVE 10\.07 10:00/);
  const kpi=await d.locator('.db-kpi').evaluateAll(a=>a.map(n=>[n.querySelector('span').textContent,n.querySelector('b').textContent,n.querySelector('small').textContent]));
  assert.deepEqual(kpi.map(k=>k[0]),['이번 달 계약 (10월)','올해 수주실적','진행 중 파이프라인','견적문의','조치 필요','주간 활동']);
  assert.deepEqual(kpi[0].slice(1),['아직 없음','10월 7일째 · 9월 3억'],'실적 없는 달 = 아직 없음 + 직전 달');assert.equal(await d.locator('.db-kpi').first().locator('b').evaluate(n=>getComputedStyle(n).color),'rgb(156, 163, 175)','아직 없음은 회색');
  assert.deepEqual(kpi[1].slice(1),['8억','낙찰금액 · VAT 별도 = 계약실적(계약 체결일) 8억(2건) · 협약 · 기술자문 없음 · 타사 이관 없음'],'수주실적(낙찰금액 · VAT 별도) = 계약실적(계약 체결일) + 협약 · 기술자문 + 타사 이관, 화면에서는 이름 붙여 나눠 적는다');assert.match(kpi[2][2],/^진행 7건 · 수주 · 실주 제외$/,'진행 건수 옆에 기준 한 줄(진행 범위는 PipelineScope 하나)');assert.deepEqual(kpi[3].slice(1),['4건','적합 3 · 종결 1 · Bad Fit 1']);
  const core=await page.evaluate(()=>{const C=DashB.core();return {risk:C.risk.length,od:C.cnt('overdue'),miss:C.cnt('missing'),made:C.made,active:C.active.length};});
  assert.equal(core.od,5);assert.equal(core.made,40,'메이드율 = 수주 2 ÷ (수주 2 + 실주 3) · 배드핏 제외');
  assert.equal(kpi[4][1],core.risk+'건');{const mm=/^기한 지남 5 \+ 다음 할 일 없음 (\d+) \+ 담당 미배정 (\d+)(?: \+ 그 밖 · 연락 · 정체 · 정보 부족 (\d+))? = (\d+)$/.exec(kpi[4][2]);assert.ok(mm,kpi[4][2]);assert.equal(5+Number(mm[1])+Number(mm[2])+Number(mm[3]||0),Number(mm[4]),'설명 합계 = 제목');assert.equal(Number(mm[4]),core.risk);assert.equal(Number(mm[1])+Number(mm[3]||0)>=core.miss-0,true);}/* exec_wording: 한 건은 한 사유 · 합계 = 제목 */
  assert.match(kpi[5][1],/^2건$/);assert.match(kpi[5][2],/^이번 주 · \d+명 중 \d+명 0건$/,'주간 활동 = 이번 주(월–일) — 사람 탭 · 활동 탭과 같은 기간');
  assert.equal(await d.locator('.db-band').count(),0,'오늘 먼저 볼 것 검은 띠는 없다(2026-10-04 대표)');assert.ok(!/오늘 먼저 볼 것/.test(await d.innerText()));
  assert.deepEqual(await d.locator('.db-secs button').evaluateAll(a=>a.map(n=>n.childNodes[0].textContent)),['성과','사람','파이프라인','활동']);
  /* 성과(5차 블록 1 · 2026-10-05): 영업 Funnel 6칸 + 단계별 전주 대비 표 — 숫자 · 문장은 전부 자료에서 */
  const one0=s=>s.replace(/\s+/g,' ').trim();
  assert.equal(await d.locator('.db-fun, .db-rates, .db-two').count(),0,'예전 흐름 5칸 대신');
  assert.equal(one0(await d.locator('.db-f6 .db-ch').innerText()),'2026년 연간 영업 Funnel 2026년 연간 접수 문의 집단만 따라감 · 칸 사이 = 빠진 건과 이유 영업 메이드율(기간 전체) 40.0% · Bad Fit 제외');
  if(process.env.DUMP)require('fs').writeFileSync(process.env.DUMP,JSON.stringify([await d.locator('.db-f6c').evaluateAll(l=>l.map(n=>[n.querySelector(':scope>span').textContent,n.querySelector(':scope>b').textContent,n.querySelector(':scope>em').textContent,n.querySelector('.dr')?n.querySelector('.dr b').textContent+' | '+n.querySelector('.dr span').textContent:''])),await d.locator('.db-f6c .bar i').evaluateAll(l=>l.map(n=>[n.style.height,getComputedStyle(n).backgroundColor])),await d.locator('.db-f6n>div').allInnerTexts()],null,1));
  assert.deepEqual(await d.locator('.db-f6c').evaluateAll(l=>l.map(n=>[n.querySelector(':scope>span').textContent,n.querySelector(':scope>b').textContent,n.querySelector(':scope>em').textContent,n.querySelector('.dr')?n.querySelector('.dr b').textContent+' | '+n.querySelector('.dr span').textContent:''])),[
   ['견적문의','4건','',''],['적합 문의','3건','적합률 75.0%','종결 1건 | 종결 1 · Bad Fit 1'],['영업건 전환','1건','전환 33.3%','전환 대기 2건 | 첫 연락 전 2 · 응대 중 0'],['결과 확정','1건','진행 중 0',''],['수주','1건','이 문의 집단 메이드율 100.0% (실주 0)','']],'같은 문의 집단만: 문의 → 적합 → 전환 → 결과 → 수주(2026-10-07 점검)');
  const fbar=await d.locator('.db-f6c .bar i').evaluateAll(l=>l.map(n=>[n.style.height,getComputedStyle(n).backgroundColor]));
  assert.deepEqual(fbar.map(x=>x[1]),['rgb(154, 160, 171)','rgb(59, 108, 228)','rgb(59, 108, 228)','rgb(59, 108, 228)','rgb(31, 157, 85)'],'진행 중 전환 대기는 이탈이 아니라 빨강으로 칠하지 않는다 · 수주 초록(exec_wording)');assert.equal(fbar[0][0],'118px','막대 높이 = 가장 큰 칸 대비');
  assert.deepEqual((await d.locator('.db-f6n>div').allInnerTexts()).map(one0),['문의 품질 · 종결 1건 · 사유별 분류 후 품질 판단','영업건 전환 · 영업건 전환 대기 2건 · 지연 여부 확인 필요','영업력 · 이 문의 집단에서 결과 확정 1건 중 1건 수주 (100.0%) 수주 2 ÷ (수주 2 + 실주 3) · 배드핏 제외','기간 안 활동량 (대상이 다름 · 전체 영업건) · 견적 발송 5 · 경쟁 · 입찰 진입 1 · 결과 확정 5 · 수주 2 · 실주 3 (가격 2 · 기타 1)']);
  assert.equal(await d.locator('.db-f6n>div').nth(1).evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(253, 236, 236)');
  assert.deepEqual((await d.locator('.db-wk .wh').allInnerTexts()).map(one0),['단계','새로 들어옴','다음 단계로','정체 (14일+)','수주','실주']);
  const wk=await d.locator('.db-wk').evaluate(n=>{const c=[...n.children].slice(6).map(x=>x.textContent.replace(/\s+/g,' ').trim()),rows=[];for(let i=0;i<c.length;i+=6)rows.push(c.slice(i,i+6));return rows;});
  assert.deepEqual(wk.map(r=>r[0]),['견적문의','컨설팅 설계','자료 발송완료','관계관리','경쟁 · 입찰','계약 · 시공','합계']);assert.deepEqual(wk[0].slice(1,3),['2 ▲2','0'],'최근 7일 새 문의 2건 · 그 전 7일 0건');assert.deepEqual(wk[2],['자료 발송완료','0','0','5','0','0'],'14일 넘게 멈춘 자료 발송 5건 · 그 전과 같음');
  assert.match(one0(await d.locator('.db-wks .db-ch').innerText()),/^단계별 전주 대비 최근 7일\(10\/1 – 10\/7\) · 숫자 옆 = 그 전 7일과 차이 · 단계 이동 기록에서 계산$/);assert.equal(await d.locator('.db-wks .db-whonote').innerText(),'새 견적문의 2건');
  /* 단계 이동 기록이 있으면: 다음 단계로 · 새로 들어옴 · 수주가 그 줄에 잡힌다 */
  await page.evaluate(()=>{const o=B.deals.find(x=>x.id==='o1');o.stageHistory=[{from:'sent',to:'compete',at:'2026-10-06T09:00:00+09:00'}];paint();});await page.waitForTimeout(250);
  const wk2=await d.locator('.db-wk').evaluate(n=>{const c=[...n.children].slice(6).map(x=>x.textContent.replace(/\s+/g,' ').trim()),rows=[];for(let i=0;i<c.length;i+=6)rows.push(c.slice(i,i+6));return rows;});
  assert.equal(wk2[2][2],'1 ▲1','자료 발송완료 → 다음 단계로 1');assert.equal(wk2[4][1],'1 ▲1','경쟁 · 입찰에 새로 들어옴 1');
  await page.evaluate(()=>{delete B.deals.find(x=>x.id==='o1').stageHistory;paint();});await page.waitForTimeout(250);
  if(shot)await page.screenshot({path:shot+'-dash-funnel.png',fullPage:true});
  /* 예전 흐름(스위치를 켜면): 흐름 5칸 · 비율 4개 · 배드핏/실주 두 상자 */
  await page.evaluate(()=>{G.dashFunnelOff=true;paint();});await page.waitForTimeout(250);
  assert.deepEqual(await d.locator('.db-fun>div').evaluateAll(a=>a.map(n=>[...n.children].map(c=>c.textContent))),[['견적문의','4건','전체 접수'],['적합 문의','3건','종결 1 제외 · Bad Fit 1'],['견적 발송','5건','기간 안 견적 발송'],['영업건 전환','12건','파이프라인 진입'],['수주','2건 · 8억','실주 3건']]);
  assert.deepEqual(await d.locator('.db-rates>div').evaluateAll(a=>a.map(n=>[...n.children].map(c=>c.textContent))),[['영업 메이드율','40.0%','수주 2 ÷ (수주 2 + 실주 3) · 배드핏 제외'],['문의 적합률','75.0%','적합 3 ÷ 문의 4'],['문의 → 계약 전환율','50.0%','수주 2 ÷ 문의 4'],['현재 전환율 (8월 문의)','50.0%','8월 문의 2건 중 지금까지 1건 계약']]);
  assert.match(await d.locator('.db-two .g').innerText(),/견적문의 종결 1건 · Bad Fit 1 · 영업 실패 아님 · 메이드율 제외\s*공사 범위 밖 1/);assert.match(await d.locator('.db-two .r').innerText(),/파이프라인 실주 3건 · 영업기회 상실 · 메이드율 포함\s*가격 열세 2 · 담당자 부재·인수인계 누락 1/);
  await page.evaluate(()=>{G.dashFunnelOff=false;paint();});await page.waitForTimeout(250);
  /* 월별: 3월 5억 · 9월 3억 · 10월 진행 중(점선) · 11~12월 빈칸 · 월평균 = 8억 ÷ 9 */
  const cols=await d.locator('.db-col').evaluateAll(a=>a.map(n=>[n.querySelector('span').textContent,n.className.replace('db-col','').trim(),n.disabled]));
  assert.equal(cols.length,12);assert.deepEqual(cols[2],['5억','',false]);assert.deepEqual(cols[8],['3억','',false]);assert.deepEqual(cols[9],['진행 중','cur',false]);assert.deepEqual(cols[10],['','fut',true]);assert.deepEqual(cols[0],['없음','zero',false]);
  assert.match(await d.locator('.db-month').innerText(),/월평균 8,889만[\s\S]*최고 3월 5억 · 최저 \d+월 없음 · 10월은 7일째라 진행 중 \(점선 막대\)/);
  assert.deepEqual(await d.locator('.db-qcol span').evaluateAll(a=>a.map(n=>n.textContent).slice(7,10)),['2건','0건','2건'],'견적문의 월별');
  await d.locator('.db-col').nth(2).click();await page.waitForTimeout(200);assert.match(await page.locator('#si-person h2').innerText(),/^2026년 3월 계약 근거$/);assert.equal(await page.locator('#si-person tbody tr').count(),1);await page.keyboard.press('Escape');
  /* 브랜드별: 석민 5억(63%) 메이드율 50% · POUR솔루션 3억 33.3%(빨강) · 0이면 수주 없음 */
  const br=await d.locator('.db-brow').evaluateAll(a=>a.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
  assert.match(br[0],/^석민이앤씨 5억 63% 문의 0 · 수주 1 · 메이드율 50\.0%$/);assert.match(br[1],/^POUR솔루션 3억 38% 문의 4 · 수주 1 · 메이드율 33\.3%$/);assert.match(br[2],/^POUR공법 수주 없음 문의 0 · 수주 0 · 메이드율 —$/);
  if(shot)await page.screenshot({path:shot+'-dash-perf.png',fullPage:true});
  /* 사람: 막힌 사람이 위 · 왜 막혔나 · 이번 주 영업 기록 */
  await d.locator('.db-secs [data-v="people"]').click();await page.waitForTimeout(200);
  const pr=page.locator('#si-dash .db-prow');assert.equal(await pr.count(),2);
  assert.match(await pr.nth(0).innerText(),/^황윤선\s*막힘\s*3억\s*33\.3%\s*수주 1 · 실주 2\s*5건\s*예상 5억\s*36일 전\s*기한 지난 현장 \d · 이번 주 0건\s*왜 막혔나\s*기한 지난 건 5건 · 최장 17일 — .+ 단계에 5건 몰림\s*손볼 건 5$/);
  assert.match(await pr.nth(1).innerText(),/^이필선\s*정상\s*5억\s*50\.0%\s*수주 1 · 실주 1\s*2건\s*예상 7억\s*어제\s*매탄 임박 · 이번 주 2건$/);
  assert.match(await page.locator('#si-dash .db-heats').locator('xpath=..').innerText(),/이번 주 영업 기록\s*10\/5\(월\) – 10\/11\(일\)\s*팀 전체 2건 · \d+명 중 \d+명이 이번 주 기록 0건/);
  assert.deepEqual(await page.locator('#si-dash .db-heat',{hasText:'이필선'}).locator('.cells span').allInnerTexts(),['1','1','','','','',''],'요일 7칸(월 방문 · 화 전화)');
  assert.match(await page.locator('#si-dash .db-heat',{hasText:'황윤선'}).innerText(),/이번 주 0건[\s\S]*마지막 기록\s*36일 전 \(9\/1\)/);
  if(shot)await page.screenshot({path:shot+'-dash-people.png',fullPage:true});
  /* 파이프라인: 단계 01~05 · 끝난 영업 · 계약 임박(D-day, 7일 이내 빨강) */
  await page.locator('#si-dash .db-secs [data-v="pipe"]').click();await page.waitForTimeout(200);
  const stg=await page.locator('#si-dash .db-stage').evaluateAll(a=>a.map(n=>[n.querySelector(':scope>span').textContent,n.querySelector(':scope>div b').textContent,n.querySelector(':scope>em').textContent]));
  assert.equal(stg.length,5);assert.deepEqual(stg.map(s=>s[0].slice(0,2)),['01','02','03','04','05']);assert.deepEqual(stg[1].slice(1),['5건','조치 필요 5']);assert.equal(stg[3][1],'1건');assert.equal(stg[4][1],'1건');
  assert.match(await page.locator('#si-dash .db-ended').innerText(),/끝난 영업 · 전체 기간 누적\s*수주 2\s*실주 3[\s\S]*조치 필요 합계 \d+/);
  const near=await page.locator('#si-dash .db-near').evaluateAll(a=>a.map(n=>[n.querySelector('em').textContent,n.querySelector('em').className,n.querySelector(':scope>div span').textContent,n.querySelector(':scope>div b').textContent]));
  assert.deepEqual(near,[['D-2','hot','입찰 마감 10/9','4억'],['D-20','','계약 예정 10/27','3.5억']],'기한 가까운 순 · 7일 이내 빨강');
  assert.match(await page.locator('#si-dash .db-note').innerText(),/^위 2건 7\.5억 · 이번 주 기한 1건 4억$/);
  /* 보강(2026-10-05 시안): 누가 어느 단계를 쥐고 있나 · 단계에 평균 며칠 머무나 */
  const one=s=>s.replace(/\s+/g,' ').trim();
  assert.deepEqual((await page.locator('#si-dash .db-who .wh').allInnerTexts()).map(one),['담당','컨설팅','자료 발송','관계관리','경쟁·입찰','계약·시공','합계']);
  const who=await page.locator('#si-dash .db-who').evaluate(n=>{const c=[...n.children].slice(7).map(x=>x.textContent.trim()),rows=[];for(let i=0;i<c.length;i+=7)rows.push(c.slice(i,i+7));return rows;});
  assert.deepEqual(who,[['황윤선','0','5 (5)','0','0','0','5'],['이필선','0','0','0','1','1','2']],'담당 × 5단계 진행 건수 · 괄호 = 조치 필요 · 합계 많은 순');
  const shades=await page.locator('#si-dash .db-who .wc').evaluateAll(l=>l.slice(0,2).map(n=>n.style.background));assert.notEqual(shades[0],shades[1],'진할수록 많음');
  assert.equal(await page.locator('#si-dash .db-whonote').innerText(),'황윤선 자료 발송 5건 중 5건이 조치 필요');
  const dw=await page.locator('#si-dash .db-dwell').evaluateAll(l=>l.map(n=>[n.children[0].textContent,n.children[2].textContent,n.children[2].className,!!n.querySelector('u'),n.querySelector('s').style.left]));
  assert.deepEqual(dw.map(x=>x[0]),['견적문의','컨설팅 설계','자료 발송','관계관리','경쟁·입찰','계약·시공']);assert.deepEqual(dw[1].slice(1,4),['건 없음','mut',false]);assert.deepEqual(dw[2].slice(1,4),['248일','red',true],'기준 넘으면 빨강');assert.match(dw[0][1],/^\d+일$/);
  assert.ok(dw.every(x=>/%$/.test(x[4])),'세로선 = 기준');assert.equal(await page.locator('#si-dash .db-dwnote').first().innerText(),'자료 발송 단계가 기준(14일)보다 234일 길게 머묾 · 견적 후 후속이 늦는 구간');
  if(shot)await page.screenshot({path:shot+'-dash-pipe.png',fullPage:true});
  /* 활동: 날짜별 묶음 · 종류 꼬리표 */
  await page.locator('#si-dash .db-secs [data-v="act"]').click();await page.waitForTimeout(200);
  /* 보강: 빨간 띠 → 숫자 5칸 → 담당자별 → 활동이 결과로 이어졌나 → 최근 활동 */
  assert.equal(one(await page.locator('#si-dash .db-actband').innerText()),'이번 주 영업 기록 2건 — 7명 중 6명이 0건 활동이 없었던 게 아니라 CRM에 안 남았을 가능성이 큽니다. 기록이 없으면 아래 전환율도 잴 수 없습니다. 6명에게 기록 요청');
  assert.equal(await page.locator('#si-dash .db-actband').evaluate(n=>getComputedStyle(n).borderLeftColor),'rgb(209, 74, 63)');
  assert.deepEqual(await page.locator('#si-dash .db-ak').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent))),[['통화','1','전화 시도 1 · 실제 연결 1'],['문자 · 카카오','0','응대 기록 기준'],['현장 방문','1','1차 미팅 · 재방문'],['견적 · 자료 발송','0','견적 · 제안서'],['기록 없는 날','19일','7명 × 3영업일 = 21일 중']],'숫자 5칸 — 주간 활동 카드와 같은 기록');
  const ap=await page.locator('#si-dash .db-ap').evaluateAll(l=>l.map(n=>[n.children[0].textContent,n.children[2].textContent,n.children[3].textContent,n.querySelectorAll('i u').length]));
  assert.deepEqual(ap[0],['황윤선','0','마지막 기록 36일 전 (9/1)',0],'기록 없는 사람 먼저 · 마지막 기록 오래된 순');assert.deepEqual(ap[ap.length-1],['이필선','2','마지막 기록 어제 (10/6)',2]);assert.equal(ap.length,7);assert.ok(ap.slice(1,6).every(x=>x[1]==='0'&&x[2]==='마지막 기록 없음'));
  assert.deepEqual((await page.locator('#si-dash .db-apleg span').allInnerTexts()).map(one),['통화','문자 · 카카오','방문','견적 · 자료']);
  assert.deepEqual(await page.locator('#si-dash .db-conv').evaluateAll(l=>l.map(n=>[n.querySelector('div span').textContent,n.querySelector('div b').textContent,n.querySelector('small').textContent])),[['전화 시도 → 실제 연결','100%','1건 중 1건'],['연결 → 다음 할 일 등록','100%','연결된 현장 2곳 중 2곳'],['방문 → 3일 안 견적 요청','—','견적 전 단계 방문 0건 · 측정 대상 없음'],['견적 발송 → 7일 안 후속','—','이번 주 발송 0건 · 측정 대상 없음']]);
  await page.evaluate(()=>{__writes.length=0;const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};});await page.locator('#si-dash .db-actband button').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#si-dash .db-actband button').innerText(),'요청 보냄 ✓');assert.equal(await page.locator('#si-dash .db-actband button').isDisabled(),true);assert.equal(await page.evaluate(()=>__writes.filter(x=>x==='rep_manager_comment').length),6,'0건인 6명의 오늘 업무에 한 줄씩(관리팀 KPI 요청과 같은 길)');
  if(shot)await page.screenshot({path:shot+'-dash-act.png',fullPage:true});
  assert.deepEqual(await page.locator('#si-dash .db-fg>span').allInnerTexts(),['2026.10.6 (화)','2026.10.5 (월)','2026.9.1 (화)']);
  assert.match(await page.locator('#si-dash .db-fg').first().innerText(),/전화\s*이필선\s*매탄 임박 · 관리소장 통화\s*4억/);
  await page.locator('#si-dash .db-fg button').first().click();assert.deepEqual(await page.evaluate(()=>__opened),['n1'],'행 클릭 = 현장 상세');
  /* ── 2. 컨트롤타워 ── */
  await page.locator('#si-dash [data-db="go"][data-v="control"]').first().click();await page.waitForTimeout(400);
  const c=page.locator('#si-control .db-shell');assert.equal(await c.count(),1);assert.equal(await page.locator('#ptitle').innerText(),'컨트롤타워');
  const hero=await c.locator('.db-hk').evaluateAll(a=>a.map(n=>[...n.children].map(x=>x.textContent)));
  assert.deepEqual(hero,[['오늘 새로 끊긴 건','1','10/1 이후 · 첫 연락 지연'],['기한 지남','5','최장 17일 · 황윤선 5'],['미배정 문의','1','최장 0일 대기']]);
  assert.match(await c.locator('.db-first').innerText(),/가장 먼저\s*황윤선 기한 지남 5건 — .+ 단계에 몰려 있습니다 \(최장 17일\)/);
  assert.deepEqual(await c.locator('.db-mx .hc span').allInnerTexts(),['미배정','첫 연락 지연','기한 지남','마지막 연락 7일+','다음 할 일 없음','장기 정체']);
  assert.deepEqual(await c.locator('.db-mx .hc small').evaluateAll(a=>a.map(n=>n.textContent).slice(0,4)),['1건','1건','5건','5건']);
  assert.deepEqual(await c.locator('.db-mx .rn b').allInnerTexts(),['황윤선','이필선','미배정'],'문제 많은 순 · 미배정은 맨 아래');
  assert.equal(await c.locator('.db-mx').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),8,'이름 + 6열 + 지시');
  assert.equal(await c.locator('.db-table').evaluate(n=>n.scrollWidth<=n.clientWidth&&getComputedStyle(n.querySelector('.db-mx')).overflowX==='visible'),true,'표는 안쪽 스크롤 없이');
  assert.equal(await c.locator('.db-mx .cl[data-v="황윤선|due"] span').evaluate(n=>getComputedStyle(n).backgroundColor.startsWith('rgba(209, 74, 63')),true,'오늘 손댈 열 = 빨강 농도');
  assert.equal(await c.locator('.db-mx .cl[data-v="황윤선|seven"] span').evaluate(n=>getComputedStyle(n).backgroundColor.startsWith('rgba(224, 164, 58')),true,'7일+ = 주황');
  /* 기본 선택 = 기한 지남 열 → 오른쪽 목록(오래된 순) */
  assert.match(await c.locator('.db-sel .hd').innerText(),/^전체 · 기한 지남\s*5건\s*선택 해제\s*다음 할 일 날짜가 지났는데 기록이 없습니다\.\s*이 5건 할 일 지정\s*담당자에게 알림$/);
  assert.equal(await c.locator('.db-sel .it').count(),5);assert.match(await c.locator('.db-sel .it').first().innerText(),/기한 지난 현장 \d\s*황윤선 · .+ · 기한 지남\s*17일\s*열기/);
  await c.locator('.db-mx .cl[data-v="이필선|first"]').click();await page.waitForTimeout(200);
  assert.match(await page.locator('#si-control .db-sel .hd').innerText(),/^이필선 · 첫 연락 지연\s*1건[\s\S]*배정 후 2시간 안에 첫 연락을 못 했습니다\./);assert.match(await page.locator('#si-control .db-sel .it').innerText(),/첫 연락 지연\s*이필선 · 견적문의 · 배정 후 CRM 연락 기록 없음\s*1일/);
  await page.locator('#si-control .db-sel .it button').click();assert.equal(await page.evaluate(()=>__opened.at(-1)),'00000004-0000-4000-8000-000000000004','[열기] = 기존 상세');
  await page.locator('#si-control .db-mx .rn',{hasText:'황윤선'}).click();await page.waitForTimeout(200);
  assert.match(await page.locator('#si-control .db-sel .hd').innerText(),/^황윤선 · 모든 문제\s*5건[\s\S]*황윤선님 담당 건 중 문제가 있는 전체입니다\./,'이름 클릭 = 그 사람의 모든 문제(같은 건은 한 번)');
  await page.locator('#si-control .db-sel [data-db="assign"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>__batch),[['o1','o2','o3','o4','o5'],'next'],'할 일 지정 = 기존 일괄 등록 창');
  await page.locator('#si-control .db-sel [data-db="clear"]').click();await page.waitForTimeout(200);assert.match(await page.locator('#si-control .db-sel .mr').innerText(),/표에서 칸 · 이름 · 열을 누르세요/);
  assert.match(await page.locator('#si-control .db-risk').innerText(),/^데이터 위험/);
  const hl=await page.locator('#si-control .db-health span').evaluateAll(a=>a.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
  assert.equal(hl.length,6);assert.match(hl[0],/^다음 할 일 등록률 \d+\.\d%$/);assert.equal(hl[1],'기록 당일 입력 아직 없음');assert.equal(hl[2],'종결 사유 입력률 100.0%');assert.equal(hl[3],'실주 사유 입력률 100.0%');assert.equal(hl[4],'첫 연락 2시간 안 0.0%');assert.equal(hl[5],'견적 3일 안 발송 아직 없음');
  /* '가장 먼저' 띠 = 흰 바탕 + 왼쪽 빨간 선(5차) */
  assert.deepEqual(await c.locator('.db-first').evaluate(n=>{const s=getComputedStyle(n);return [s.backgroundColor,s.borderLeftColor,s.borderLeftWidth,getComputedStyle(n.querySelector('span')).color];}),['rgb(255, 255, 255)','rgb(209, 74, 63)','4px','rgb(180, 35, 24)']);
  /* 추가 분석(5차 블록 6 · 7 · 5): 점검 지표 아래 · 하나씩 보기 — 진단 → 인사이트 → 액션 / 지금 잡아야 할 현장 / 관계 변화 */
  {const x=page.locator('#si-control .db-cx'),one1=s=>s.replace(/\s+/g,' ').trim();assert.equal(await x.count(),1);
   assert.equal(await page.locator('#si-control .db-shell').evaluate(n=>[...n.children].map(e=>e.className.split(' ').pop()).join(' ')),'db-tool db-hero db-ctl db-health db-cx','기존 구역은 그대로 · 맨 아래에 덧붙임');
   assert.equal(one1(await x.locator('.db-cxt').innerText()),'추가 분석 진단 → 인사이트 → 액션 지금 잡아야 할 현장 관계 변화 하나씩 보기');assert.deepEqual(await x.locator('.db-cxt button').evaluateAll(l=>l.map(b=>b.getAttribute('aria-pressed'))),['true','false','false']);
   assert.deepEqual(await x.locator('.db-dxh>div').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent))),[['1','진단','데이터'],['2','인사이트','왜 그런지'],['3','액션','오늘 누구에게 무엇을']]);
   const dx=()=>x.locator('.db-dxr').evaluateAll(l=>l.map(n=>[n.querySelector('.db-dx1 b').textContent,n.querySelector('.db-dx1 span').textContent,n.querySelector('.db-dx2 em').textContent,n.querySelector('.db-dx2 span').textContent,n.querySelector('.db-dx3 b').textContent,n.querySelector('.db-dx3 button')?n.querySelector('.db-dx3 button').textContent:'']));
   assert.deepEqual(await dx(),[['견적 → 입찰 이탈 4건','견적 후 7일 후속 없던 건 0','AI','후속 여부를 비교할 기록(견적 발송일 · 연락 기록)이 아직 부족합니다','이번 주 견적 발송 건 후속 일정 확인','']],'자료에서 보이는 문제만 · 영업 Funnel 과 같은 숫자');
   /* 기록이 쌓이면 줄이 생긴다: 견적 지연 · 소장 변경 후 미접촉 · 견적 후 후속 없음 */
   await page.evaluate(()=>{window.__keepDeals=JSON.stringify(B.deals);const by=id=>B.deals.find(d=>d.id===id),T=k=>k+'T10:00:00+09:00',ce=(id,t,from,to,k,act)=>({id,type:'메모',note:'[변화 · '+t+'] 이전: '+from+' | 이후: '+to+' | 날짜: '+k+' | 확인: '+act,at:T(k)});
    by('o1').stage_contexts={sent:{fields:{sent_date:'2026-09-01'}}};by('o1').quote_versions=[{version_no:1,amount:1e8,created_at:T('2026-09-01')},{version_no:2,amount:9e7,created_at:T('2026-10-05')}];
    by('o2').stage_contexts={consulting:{fields:{quote_due:'2026-10-01'}}};
    by('o3').activities.push(ce('ce1','관리소장 변경','김소장','박소장','2026-10-05','기존 견적 · 공법 조건 재확인 (새 소장 첫 미팅)'));
    by('o4').activities.push(ce('ce2','경쟁업체 등장','미기록','시트 방수 업체','2026-10-06','경쟁사 견적 · 조건 파악'),{id:'s1',type:'문자',note:'안내 문자',at:T('2026-09-28')});
    by('o5').activities.push({id:'f1',type:'전화',note:'후속 통화',at:T('2026-10-06')});
    by('l2').activities=[ce('ce3','관리소장 변경','이소장','최소장','2026-09-10','기존 견적 · 공법 조건 재확인 (새 소장 첫 미팅)')];
    const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};window.__mem=mem;paint();});await page.waitForTimeout(350);
   assert.deepEqual(await dx(),[
    ['황윤선 · 견적 지연 1건','견적 예정일 대비 평균 +6일','AI','1건 중 1건은 예정일 뒤 연락 기록도 없음 — 견적과 고객 연락이 같이 멈춤','견적 지연 1건 발송일 다시 잡기','황윤선에게 요청'],
    ['관리소장 변경 후 미접촉 1건','변경 이벤트 후 평균 2일 연락 없음','AI','소장 변경 현장 실주율 100% — 변화 없는 현장 50%','1건 기존 견적 · 공법 재확인 통화','황윤선에게 요청'],
    ['견적 → 입찰 이탈 4건','견적 후 7일 후속 없던 건 1','AI','후속 여부를 비교할 기록(견적 발송일 · 연락 기록)이 아직 부족합니다','견적 후 후속 없는 1건 후속 통화','황윤선에게 요청']]);
   /* [요청] = 그 담당자 오늘 업무 '관리자 한마디'에 한 줄 — 남긴 뒤에만 '보냄 ✓' */
   await x.locator('.db-dxr').first().locator('.db-dx3 button').click();await page.waitForTimeout(250);
   assert.deepEqual(await x.locator('.db-dxr').first().locator('.db-dx3 button').evaluate(b=>[b.textContent,b.disabled,getComputedStyle(b).backgroundColor,getComputedStyle(b).color]),['보냄 ✓',true,'rgb(232, 246, 238)','rgb(31, 122, 77)']);
   assert.match(await page.evaluate(()=>Object.values(__mem).join(' | ')),/컨트롤타워 — 황윤선 · 견적 지연 1건 · 견적 지연 1건 발송일 다시 잡기/,'담당자 오늘 업무에 남는 한 줄');
   await x.locator('.db-dxr').nth(1).locator('.db-dx1').click();await page.waitForTimeout(250);assert.match(await page.locator('.si-evidence, #si-evidence, .hl-ev, [class*="evidence"]').first().innerText(),/관리소장 변경 후 미접촉 1건[\s\S]*기한 지난 현장 3/,'진단 칸을 누르면 해당 건 목록(기존 근거 창)');
   await page.keyboard.press('Escape');await page.evaluate(()=>{document.querySelectorAll('.si-evidence, #si-evidence, .hl-ev').forEach(n=>n.remove&&n.classList.contains('on')&&n.classList.remove('on'));});
   if(shot)await page.screenshot({path:shot+'-control-diag.png',fullPage:true});
   /* 지금 잡아야 할 현장: 우선도 70점 이상만 · 점수는 숨김 · [근거]를 누르면 가감점 */
   await x.locator('.db-cxt button',{hasText:'지금 잡아야 할 현장'}).click();await page.waitForTimeout(250);assert.equal(await x.locator('.db-dx').count(),0,'하나씩 보기');
   assert.equal(one1(await x.locator('.db-prh').innerText()),'지금 잡아야 할 현장 2곳 점수는 숨기고 결론만 · 근거는 눌러서');
   assert.deepEqual(await x.locator('.db-prl').evaluateAll(l=>l.map(n=>[n.querySelector('.db-prn b').textContent,n.querySelector('.db-prn span').textContent,n.querySelector('.db-pro').textContent,n.querySelector('.db-prw').textContent,n.querySelector('.db-prg').textContent,getComputedStyle(n.querySelector(':scope>i')).backgroundColor])),[['[수원] 매탄 임박','이필선 · 4억','4억 이상 · 입찰 마감 D-2','근거','회장 접촉','rgb(232, 89, 12)'],['[서울 송파] 계약 검토','이필선 · 3억','3억 이상','근거','회장 접촉','rgb(31, 157, 85)']],'금액 큰 순이 아니라 우선도 순 · 띠 = 브랜드색');
   assert.equal(/\d+점(?! 이상)/.test(await x.locator('.db-pr').innerText()),false,'화면에 점수 없음');assert.equal(await x.locator('.db-prf').count(),0);
   await x.locator('.db-prw').first().click();await page.waitForTimeout(200);
   assert.deepEqual(await x.locator('.db-prf span').evaluateAll(l=>l.map(n=>[n.textContent,n.className])),[['+25 4억 이상','db-pru'],['+20 입찰 마감 D-2','db-pru']]);assert.equal(await x.locator('.db-prw').first().innerText(),'근거 접기');
   assert.deepEqual(await x.locator('.db-prb').first().evaluate(n=>{const s=getComputedStyle(n);return [s.borderTopWidth,s.backgroundColor];}),['0px','rgba(0, 0, 0, 0)'],'버튼 묶음에 전역 테두리가 붙지 않는다');
   assert.equal(await x.locator('.db-prt').innerText(),'우선도 = 금액 · 공사시기 확정 · 회의 임박 · 견적 발송 · 결정권자 접촉(+) − 무응답 · 경쟁 공법(−) · 70점 이상만 이 묶음 · 화면엔 점수 없음');
   await x.locator('.db-prg').first().click();assert.equal(await page.evaluate(()=>__opened.at(-1)),'n1','버튼 = 기존 상세 열기');
   if(shot)await page.screenshot({path:shot+'-control-pri.png',fullPage:true});
   /* 관계 변화: 이번 주(최근 7일) 달라진 것 8칸 + 변화가 결과에 준 영향 */
   await x.locator('.db-cxt button',{hasText:'관계 변화'}).click();await page.waitForTimeout(250);
   assert.equal(one1(await x.locator('.db-cwt').first().innerText()),'이번 주 달라진 것 상태가 아니라 변화만 · 누르면 해당 현장');
   assert.deepEqual(await x.locator('.db-cwg button').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent).concat([n.querySelector('b').className]))),[['신규 문의','2','▲2','cw-ink'],['수주 전환','0','','mut'],['실주','0','','mut'],['관리소장 변경','1','재확인 필요 1','cw-bad'],['견적금액 변경','1','평균 −10%','cw-ink'],['새 경쟁사 등장','1','시트 방수 업체 1','cw-bad'],['7일+ 정체 신규','1','자료 발송완료 1','cw-bad'],['정체 해소','1','전화 1','cw-ok']]);
   assert.deepEqual(await x.locator('.db-cwi').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('.db-cwp').textContent,n.querySelector('i.cw-a').style.width,n.querySelector('i.cw-b').style.width])),[['관리소장 변경 후','100% / 50%','100%','50%'],['견적 2회 이상 수정','기록 없음','0%','60%'],['새 경쟁사 등장','기록 없음','0%','60%'],['결정권자 변경','기록 없음','0%','60%']],'올해 결과가 난 현장 5건 · 변화가 있던 현장 / 없던 현장 실주율');
   assert.equal(await x.locator('.db-cwl').innerText(),'빨강 = 변화가 있던 현장 실주율 · 회색 = 변화 없던 현장 실주율');
   assert.deepEqual(await x.locator('.db-cwi').first().evaluate(n=>[n.getBoundingClientRect().height<40,getComputedStyle(n.querySelector('.db-cwb u')).height,getComputedStyle(n.querySelector('i.cw-a')).backgroundColor]),[true,'8px','rgb(209, 74, 63)'],'막대 줄 높이 · 색(전역 규칙과 겹치지 않음)');
   if(shot)await page.screenshot({path:shot+'-control-chg.png',fullPage:true});
   /* 영업사원: 보기만 — [요청]은 눌리지 않는다 · 끄기 */
   await page.evaluate(()=>{G.dashB.cx=0;window.__me2=ME;ME={id:'rep1',name:'이필선',role:'rep'};paint();});await page.waitForTimeout(300);
   assert.deepEqual(await page.locator('#si-control .db-dxr').nth(1).locator('.db-dx3 button').evaluate(b=>[b.textContent,b.disabled]),['황윤선에게 요청',true]);
   await page.evaluate(()=>{ME=window.__me2;G.ctlExtraOff=true;paint();});await page.waitForTimeout(250);assert.equal(await page.locator('#si-control .db-cx').count(),0,'끄면 추가 분석만 숨김');assert.equal(await page.locator('#si-control .db-health').count(),1);
   await page.evaluate(()=>{G.ctlExtraOff=false;B.deals=JSON.parse(__keepDeals);paint();});await page.waitForTimeout(300);}
  if(shot)await page.screenshot({path:shot+'-control.png',fullPage:true});
  /* 권한: 영업사원은 보기만 — 할 일 지정 · 알림 · 줄 끝 [지정] 없음 */
  await page.evaluate(()=>{window.__me=ME;ME={id:'rep1',name:'이필선',role:'rep'};paint();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#si-control .db-shell').count(),1,'전 직원이 본다');assert.equal(await page.locator('#si-control .db-mx .rn b').count(),3,'화면 쪽에서 담당자로 가리지 않음');
  assert.equal(await page.locator('#si-control .db-sel .db-btns').count(),0);assert.equal(await page.locator('#si-control .db-mx .as button').count(),0);assert.match(await page.locator('#si-control .db-perm').innerText(),/관리자 · 팀장만/);
  await page.evaluate(()=>{ME=window.__me;paint();});await page.waitForTimeout(300);
  /* ── 3. 성과 분석 ── */
  await page.evaluate(()=>{OPS_RULES.dashMinClosed=3;G.perfV3Off=true;/* 여기서는 예전 성과 분석(끄기 스위치 뒤 화면)을 본다 — 새 화면은 verify-perf-v3 */});/* 종료 3건부터 메이드율 판단(기본 5건 — 설정값) */
  await page.locator('#si-control [data-db="go"][data-v="perf"]').click();await page.waitForTimeout(400);
  const p=page.locator('#si-perf .db-shell');assert.equal(await p.count(),1);
  assert.match(await p.locator('.db-verdict').innerText(),/^0%\s*월평균 대비\s*2026년 연간 수주실적 8억 · 월평균 8,889만\. 10월은 7일째 · 아직 없음\. 파이프라인 .+은 월평균의 [\d.]+개월치입니다\.\s*영업 메이드율 40\.0% · 황윤선 33\.3% — 기준 50% 아래입니다\.\s*8억\s*연 누적 · 수주 2건\s*메이드율 40\.0% · 문의→계약 50\.0%$/);
  assert.equal(await p.locator('.db-pcs').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3,'담당자 카드 3열 고정');
  const pc=await p.locator('.db-pc').evaluateAll(a=>a.map(n=>n.innerText.replace(/\s+/g,' ').trim()));
  assert.equal(pc.length,2);assert.match(pc[0],/^1위 이필선 2026-10-06 50\.0% 메이드율 올해 수주실적 5억 10월 아직 없음 수주 · 실주 1 · 1 진행 2건 주간 활동 2건 손볼 건 \d+건/);
  assert.match(pc[1],/^주의 황윤선 2026-09-01 33\.3% 메이드율 올해 수주실적 3억 10월 아직 없음 수주 · 실주 1 · 2 진행 5건 주간 활동 0건 손볼 건 5건 기한 지난 건 5건 · 최장 17일/);
  assert.match(await p.locator('.db-quiet').innerText(),/^진행 · 수주 기록 없음: /,'기록 없는 사람은 이름 한 줄');
  const c3=p.locator('.db-c3');assert.equal(await c3.count(),3);
  assert.match(await c3.nth(0).innerText(),/^기술자문 낙찰실적\s*협약시공사 수주 · 수주실적에 합산\s*아직 없음/);
  /* 2차 기능 6 · 7: 문의 코호트 전환율(접수 월 기준 최근 6개월) · 유입경로 → 계약 — 같은 문의 목록 · 같은 수주 판정 */
  {const co=(await page.locator('#si-perf .db-co>span').allInnerTexts()).map(s=>s.trim());assert.equal(co.length,49,'머리 7칸 + 6개월 × 7칸');assert.deepEqual(co.slice(0,7),['접수 월','문의','적합','수주','진행 중','실주','현재 전환율']);
   const rows=[];for(let i=7;i<co.length;i+=7)rows.push(co.slice(i,i+7));assert.equal(rows[5][0],(await page.evaluate(()=>DashB.core().P.tm))+'월','마지막 줄 = 이번 달');
   rows.forEach(r=>{const [m,q,fit,won,open,lost]=r;assert.equal(Number(fit),Number(won)+Number(open)+Number(lost),m+': 적합 = 수주 + 진행 중 + 실주');assert.ok(Number(q)>=Number(fit));});
   assert.match(await page.locator('#si-perf .db-cos').first().locator('.db-con').innerText(),/^최근 달은 아직 진행 중이 많아 전환율이 낮게 보입니다\. 3개월 지난 달끼리 비교하세요\.$/);
   const ch=(await page.locator('#si-perf .db-chn>span').allInnerTexts()).map(s=>s.trim());assert.deepEqual(ch.slice(0,5),['유입경로','문의','적합','수주','문의 → 수주']);assert.equal((ch.length-5)%5,0);
   let sumQ=0,sumW=0;for(let i=5;i<ch.length;i+=5){sumQ+=Number(ch[i+1]);sumW+=Number(ch[i+3]);}
   const core=await page.evaluate(()=>{const C=DashB.core();return [C.q.length,C.q.filter(x=>C.L.ready&&C.B.inquiryContract(x,C.L,C.AD)&&!C.B.badfit(x)).length];});assert.deepEqual([sumQ,sumW],core,'유입경로 표의 문의 · 수주 합 = 위 흐름의 문의 · 문의에서 온 수주');
   assert.ok((await page.locator('#si-perf .db-cos').nth(1).locator('.db-con').innerText()).length>10,'해석 한 줄은 자료에서');}
  assert.match(await c3.nth(1).innerText(),/누가 따낸 영업을 계약으로 잘 마무리하나\?\s*담당자별 메이드율\s*배드핏 제외 · 점선 = 팀 평균 40\.0%\s*이필선\s*50\.0%\s*황윤선\s*33\.3%/);
  assert.match(await c3.nth(2).innerText(),/브랜드별 문의 → 수주[\s\S]*POUR솔루션\s*문의 4 → 적합 3 → 수주 1\s*33\.3%[\s\S]*POUR공법\s*문의 0 → 적합 0 → 수주 0\s*수주 없음[\s\S]*적합 문의가 있는 브랜드는 모두 수주가 나왔습니다\./);
  assert.match(await p.locator('.db-pending').innerText(),/^아직 판단 못 하는 것\s*기록이 10건 쌓이면 자동으로 보입니다\s*견적 후 첫 후속 → 수주\s*\d+\/10\s*현장 방문 → 견적\s*1\/10\s*경쟁 · PT · 입찰 → 수주\s*0\/10$/);
  const h3=await c3.evaluateAll(a=>a.map(n=>Math.round(n.getBoundingClientRect().height)));assert.equal(new Set(h3).size,1,'카드 3장 높이 맞춤 '+h3.join(','));
  if(shot)await page.screenshot({path:shot+'-perf.png',fullPage:true});
  /* 분기 전환: 3분기 = 9월 계약 3억 · 실주 2 · 문의 2 */
  await p.locator('.db-seg [data-v="3"]').click();await page.waitForTimeout(300);
  assert.match(await page.locator('#si-perf .db-verdict .rt').innerText(),/^3억\s*2026년 3분기 · 수주 1건\s*메이드율 33\.3% · 문의→계약 50\.0%$/);
  await page.locator('#si-perf .db-seg [data-v="0"]').click();await page.waitForTimeout(200);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:1180,height:900});await page.evaluate(()=>goPage('control'));await page.waitForTimeout(300);
  assert.equal(await page.locator('#si-control .db-mx').evaluate(n=>n.scrollWidth<=n.clientWidth+1),true,'좁아져도 표 안쪽 스크롤 없음');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.dashBOff=true;goPage('dash');});await page.waitForTimeout(400);
  assert.equal(await page.locator('#si-dash .db-shell').count(),0);assert.equal(await page.locator('#si-dash .si-shell').count(),1,'끄면 예전 화면');assert.equal(await page.locator('#pg-dash>.cf-bar').count(),0);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',overview_kpi_none_label:true,funnel_rates_same_definition:true,monthly_chart:true,brand_rows:true,people_blocked_why:true,week_heat:true,pipeline_near:true,activity_feed:true,control_matrix_no_inner_scroll:true,control_select_assign_open:true,control_permission:true,control_extra_diag_request:true,control_extra_priority_hidden_score:true,control_extra_change_week:true,perf_verdict_cards3:true,quarter_switch:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
