'use strict';
/* 대표 월간 리포트(한 페이지) 검사(2026-10-03 design_handoff_monthly_report):
   기본 = 직전에 끝난 달 · 결론 문장(계약 · 6개월 위치 · 메이드율 · 다음 달 임박 · 실주)의 숫자는 전부 자료에서 계산 · 흐름 5칸 · 비율 4개 ·
   놓친 것 두 종류(배드핏 = 메이드율 제외 / 파이프라인 실주 = 금액 포함) · 6개월 계약실적(원장) · 다음 달 전망(7일 안 기한 빨강) · 담당자별 + 합계 · 결정 요청(선택 저장) · 용어. 이모지 없음. 끄면 이전 리포트 */
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
  const page=await ctx.newPage(),errs=[],jandi=[];page.on('pageerror',e=>errs.push(e.message));
  await ctx.route('**/functions/v1/crm-jandi',async r=>{const b=r.request().postDataJSON();jandi.push(b);const at=new Date().toISOString();return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,skipped:false,jandi:{resent_at:at},snapshot:{kind:b.kind,period_key:b.period_key,payload:Object.assign({},b.payload||{},{jandi:{resent_at:at}}),promises:[]}})});});
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ReportB&&window.BriefB&&window.ReportV2&&window.OpsStore&&window.ContractSalesData&&typeof paintReport==='function');
  const P=await page.evaluate(()=>{
   const P=ReportB.period(),day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=k=>k+'T10:00:00+09:00',inM=d=>P.ym+'-'+String(d).padStart(2,'0'),inP=d=>P.p.slice(0,8)+String(d).padStart(2,'0');
   const BR='POUR솔루션',U=n=>'0000000'+n+'-0000-4000-8000-00000000000'+n;
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:BR,created:day(-200),updated:day(-90),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,k,extra)=>Object.assign({id:U(n),site:'문의 '+n,status:owner?'배정완료':'접수',at:at(k),created_at:at(k),received_at:at(k),brand:BR,assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(k):null},extra||{});
   const lost=(id,site,owner,k,reason,amt)=>deal(id,site,owner,'lost',{outcome:'lost',grp:'수주 실패',amt,closed_at:at(k),closed:k,stage_contexts:{lost:{fields:{close_reason:reason,close_detail:'확인'}}}});
   B={deals:[
     deal('w1','[서울 마포] 계약 A','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:5e8,closed_at:at(inM(10)),created:inM(3)}),
     deal('w2','[경기 고양] 계약 B','황윤선','won',{outcome:'won',grp:'수주 성공',won_amount:3e8,closed_at:at(inM(20))}),
     deal('w0','[서울 노원] 지난달 계약','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:2e8,closed_at:at(inP(12))}),
     lost('l1','[인천] 실주 가격','이필선',inM(8),'가격 열세',2e8),Object.assign(lost('l2','[수원] 실주 소장','황윤선',inM(18),'담당자 부재·인수인계 누락',1e8),{contacts:[{person_key:'mobile:01011112222',name:'박영호',role:'이전 소장',mobile:'01011112222',status:'previous',ended_at:inM(15)}]}),lost('l3','[수원] 실주 소장2','황윤선',inM(19),'가격 열세',3e8),
     deal('q1','[서울 강남] 견적 발송','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:inM(5)}}}}),
     deal('n1','[수원] 매탄 임박','황윤선','bidding',{amt:4e8,brand:'석민이앤씨',stage_contexts:{bidding:{fields:{bid_deadline:day(3),bid_terms:'일반'}}},workItems:['재도장>외부'],primaryWork:'재도장>외부',activities:[{id:'an1',type:'전화',note:'통화 완료',at:new Date(Date.now()-864e5).toISOString()}]}),
     deal('n2','[서울 송파] 계약 검토','이필선','contract',{amt:3e8,stage_contexts:{contract:{fields:{contract_status:'체결 예정',contract_amount:35e7,contract_date:day(20)}}},activities:[{id:'an2',type:'전화',note:'통화 완료',at:new Date(Date.now()-864e5).toISOString()}]})],
    inquiries:[inq(1,'이필선',inM(2)),inq(2,'이필선',inM(4)),inq(3,'',inM(6),{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 공사 범위 밖 · 이전 상태: 접수'}),inq(4,'',inM(7),{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 소규모 (최소 금액 미만) · 이전 상태: 접수'}),inq(5,'황윤선',inP(9))],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   const ev=(id,k,n,o)=>({deal_id:id,brand:BR,sales_owner_name:o,events:[{kind:'signed',effective_date:k,amount_delta:n}]});
   ContractSalesData.state=()=>({status:'ready',items:[ev('w1',inM(10),5e8,'이필선'),ev('w2',inM(20),3e8,'황윤선'),ev('w0',inP(12),2e8,'이필선')]});
   TOKEN='test';OpsStore.flags=()=>({jandi_enabled:true});window.__saves=[];OpsStore.has=()=>true;OpsStore.admin=()=>true;OpsStore.rpc=async(name,p)=>{if(name==='crm_report_snapshot_get_v1')return {ok:true,snapshots:[]};if(name==='crm_report_snapshot_save_v1'){__saves.push(p);return {ok:true};}return {ok:true};};
   goPage('report');return P;
  });
  await page.waitForTimeout(500);
  const v=page.locator('#report-b');assert.equal(await v.count(),1,'한 페이지 리포트');assert.equal(await page.locator('#report-v2:visible').count(),0,'이전 슬라이드는 보이지 않음');assert.equal(await page.locator('#report-master:visible').count(),0);
  /* 0. 머리 · 기본 = 직전에 끝난 달 */
  const now=new Date(),pm=new Date(now.getFullYear(),now.getMonth()-1,1);assert.equal(P.ym,pm.getFullYear()+'-'+String(pm.getMonth()+1).padStart(2,'0'),'직전 달');
  assert.equal(await v.locator('.rb-head h1').innerText(),P.y+'년 '+P.m+'월 영업 보고');assert.match(await v.locator('.rb-head p').innerText(),/자동 취합\s*보고 송보람 · 수신 대표님/);
  assert.deepEqual(await v.locator('.rb-bar0 button').allInnerTexts(),['편집','PDF로 저장','대표님께 보내기']);assert.equal(await v.locator('.rb-seg .on').innerText(),'월간');
  /* 1. 한 줄 결론: 숫자는 계산값 */
  const band=await v.locator('.rb-band').innerText();
  assert.match(band,new RegExp('^'+P.m+'월 체결 계약 2건 · 8억 — 6개월 중 최고, 메이드율은 40\\.0%로 내렸습니다\\s*'+P.nm+'월은 날짜 확인된 계약 예정 2건 · 7\\.5억 중 1건\\(4억\\)이 이번 주에 갈립니다\\. 실주 3건 중 1건이 관리소장 변경과 겹쳐 대응 정책 결정이 필요합니다\\.\\s*결정 요청\\s*3건$'),band);
  assert.equal(await v.locator('.rb-band').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(17, 26, 46)','남색 띠');
  /* 2. 흐름 5칸 + 비율 4개(메이드율은 배드핏 제외) */
  assert.deepEqual(await v.locator('.rb-funnel>div>span').allInnerTexts(),['신규 견적문의','적합 문의','견적 발송','파이프라인 전환','수주실적']);
  assert.deepEqual(await v.locator('.rb-funnel>div>b').allInnerTexts(),['4건','2건','1건','1건','2건 · 8억']);
  assert.match(await v.locator('.rb-funnel>div').nth(0).innerText(),/▲3 \(1\)/);assert.match(await v.locator('.rb-funnel>div').nth(1).innerText(),/종결 2 제외 · Bad Fit 2/);assert.match(await v.locator('.rb-funnel>div.last').innerText(),/▲1건 · \+6억/);
  assert.deepEqual(await v.locator('.rb-rates>div>span').allInnerTexts().then(a=>a.slice(0,3)),['영업 메이드율','문의 적합률','월간 계약 · 문의 비율 (활동량)']);
  assert.deepEqual(await v.locator('.rb-rates p b').allInnerTexts().then(a=>a.slice(0,3)),['40.0%','50.0%','50.0%'],'메이드율 = 수주 2 ÷ (수주 2 + 실주 3) — 배드핏 2건은 분모에 없음');
  assert.match(await v.locator('.rb-rates>div').nth(0).innerText(),/수주 2 ÷ \(수주 2 \+ 실주 3\) · 배드핏 제외/);
  /* 3. 놓친 것 두 종류 */
  assert.match(await v.locator('.rb-box.bad').innerText(),/견적문의 종결 2건 · Bad Fit 2\s*영업건이 되지 않고 닫힌 문의 · 영업 실패 아님 · 메이드율 제외[\s\S]*공사 범위 밖\s*1[\s\S]*소규모 \(최소 금액 미만\)\s*1/);
  assert.match(await v.locator('.rb-box.loss').innerText(),/파이프라인 실주 3건 · 6억\s*영업기회 상실 · 메이드율에 포함\s*가격 열세\s*2\s*담당자 부재·인수인계 누락\s*1/);
  /* 4. 6개월 계약실적 · 5. 다음 달 전망 */
  assert.equal(await v.locator('.rb-trend>div').count(),6);assert.equal(await v.locator('.rb-trend>div').last().locator('span').innerText(),'8억');assert.equal(await v.locator('.rb-tl>div').last().innerText().then(t=>t.replace(/\s+/g,' ')),P.m+'월 40%');
  assert.match(await v.locator('.rb-g3 .rb-sec').nth(2).innerText(),new RegExp('^4\\. '+P.nm+'월 전망\\s*계약 예정\\(날짜 확인\\) 2건 · 7\\.5억\\s*\\[수원\\] 매탄 임박\\s*[\\s\\S]*황윤선\\s*4억\\s*입찰 마감 \\d+\\/\\d+\\s*\\[서울 송파\\] 계약 검토\\s*이필선\\s*3\\.5억\\s*계약 예정 \\d+\\/\\d+\\s*위 2건 7\\.5억 = 7\\.5억 · 이번 주\\(7일 안\\) 기한 1건 4억$'));
  assert.equal(await v.locator('.rb-near').first().locator('.r span').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)','7일 안 기한 = 빨강');assert.equal(await v.locator('.rb-near').first().locator('i').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(232, 89, 12)','브랜드 띠');
  /* 6. 담당자별 + 합계(위 숫자와 일치) */
  const cells=await v.locator('.rb-table>span').allInnerTexts(),row=n=>{const i=cells.indexOf(n);return cells.slice(i,i+9);};
  assert.deepEqual(cells.slice(0,9),['담당','문의','견적','수주','계약실적','협약 · 기술자문','타사 이관','실주','메이드율']);
  assert.deepEqual(row('이필선'),['이필선','2','1','1','5억','-','-','1','50.0%']);assert.deepEqual(row('황윤선'),['황윤선','0','0','1','3억','-','-','2','33.3%']);assert.deepEqual(row('미배정'),['미배정','2','0','-','-','-','-','0','-']);assert.deepEqual(row('합계'),['합계','4','1','2','8억','-','-','3','40.0%'],'합계 = 위 흐름 숫자와 일치');assert.equal(cells.includes('그 외 담당'),false,'담당자 줄 합 = 전체일 때는 그 외 줄 없음');
  assert.equal(await v.locator('.rb-table>span.r').first().innerText(),'33.3%','50% 미만 = 빨강');
  /* 7. 결정 요청: 근거 숫자 + 선택 저장 */
  const asks=await v.locator('.rb-ask').allInnerTexts();assert.equal(asks.length,3);
  assert.match(asks[0],new RegExp('^1\\s*관리소장 변경 현장 — 재견적 정책을 정해 주세요\\s*'+P.m+'월 실주 3건 중 1건\\(1억\\)이 관리소장 변경과 겹칩니다\\.[\\s\\S]*변경 즉시 재방문 · 재견적\\s*기존 조건 유지$'));
  assert.match(asks[1],new RegExp('가격 사유 실주 2건[\\s\\S]*'+P.m+'월 실주 3건 중 2건\\(5억\\)의 사유가 가격입니다'));assert.match(asks[2],/황윤선 메이드율 33\.3% — 견적 지원을 붙일까요\s*문의 0 · 견적 0 · 수주 1 · 실주 2건/);
  await v.locator('.rb-ask').first().locator('button',{hasText:'기존 조건 유지'}).click();await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(()=>__saves.map(s=>[s.kind,s.period_key,s.payload.decisions,s.payload.asks.length])),[['monthly',P.ym,{mgrchg:1},3]],'선택 = 월간 스냅샷 저장');
  assert.equal(await page.locator('#report-b .rb-ask').first().locator('button[aria-pressed="true"]').innerText(),'기존 조건 유지');
  assert.match(await v.locator('.rb-foot').innerText(),/계약실적 = 계약 체결일 기준 계약금액 \(회계 매출 아님\)\s*종결 = 영업건이 되지 않고 닫힌 문의\(그중 우리와 맞지 않는 것 = Bad Fit\) · 파이프라인 실주 = 영업기회 상실\s*확정 전환율 = 해당 월 접수 문의 중 현재까지 계약 비율/);
  assert.equal(/\p{Extended_Pictographic}/u.test((await v.innerText()).replace(/[✓▲▼]/g,'')),false,'이모지 없음');
  if(shot){await page.locator('#report-b .rb-bar0').scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.screenshot({path:shot+'-1.png'});await page.locator('#report-b .rb-foot').scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.screenshot({path:shot+'-2.png'});}
  /* 편집 · 보내기 · 상세 표 */
  await page.locator('#report-b [data-rb="edit"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#report-b .rb-band [contenteditable="true"]').count(),2,'결론 두 문장만 고칠 수 있음');
  await page.locator('#report-b [data-rb="edit"]').click();await page.waitForTimeout(150);
  await page.locator('#report-b [data-rb="send"]').click();await page.waitForTimeout(600);
  assert.equal(jandi.length,1,'대표님께 보내기 = 잔디 발송');assert.equal(jandi[0].kind,'monthly');assert.equal(jandi[0].period_key,P.ym);assert.deepEqual(jandi[0].payload.decisions,{mgrchg:1});
  assert.match(await page.locator('#report-b .rb-head p').innerText(),/\d+\/\d+ \d{2}:\d{2} 잔디 발송/);
  assert.match(jandi[0].text,new RegExp('^\\['+P.y+'년 '+P.m+'월 영업 보고\\][\\s\\S]*영업 메이드율 40\\.0%[\\s\\S]*대표님 결정 요청 3건\\s*1\\. 관리소장 변경 현장 — 재견적 정책을 정해 주세요 → 기존 조건 유지'));
  await page.locator('#report-b [data-rb="detail"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('#report-master:visible').count(),1,'상세 표는 그대로 열 수 있음');
  /* 끄기 */
  await page.evaluate(()=>{G.reportBOff=true;goPage('today');goPage('report');});await page.waitForTimeout(400);
  assert.equal(await page.locator('#report-b:visible').count(),0);assert.equal(await page.locator('#report-v2:visible').count(),1,'끄면 이전 리포트');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',previous_month_default:true,headline_computed:true,made_rate_excludes_badfit:true,missed_two_kinds:true,six_month_ledger:true,next_month_outlook:true,people_total_matches:true,decisions_saved:true,no_emoji:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
