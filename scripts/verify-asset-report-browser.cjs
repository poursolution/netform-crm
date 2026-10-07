'use strict';
/* 고객 자산 · 월간 리포트 새 기준 연결 검사(2026-10-07 design_handoff_asset_report · 시안 '고객 자산 · 리포트 기준 연결 시안.dc.html')
   고객 자산: 관계 기준 = 관계관리 상태별 주기('진행 중 단지 30일' 삭제 · 미확인 = 재접촉 대상 제외) · 관계위험 → 반복 실주(원인 확인 필요) · 현재 영업기회 / 과거 검토 금액 · 현재 위험 ≤ 현재 영업기회
   월간 리포트: 60일 무접촉 안내 · 공식 7단계 이름 · '월간 계약 · 문의 비율(활동량)' + 같은 문의 집단 전환율 · 표본 적음(결과 확정 5건 미만) · 월 문의 수 일치 · 내보내기 전 보고서 검증 5가지 · 문장 보기 · 주의 표시 붙여 보내기 */
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
  const jandi=[];await ctx.route('**/functions/v1/crm-jandi',async r=>{const b=r.request().postDataJSON();jandi.push(b);const at=new Date().toISOString();return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,skipped:false,jandi:{resent_at:at},snapshot:{kind:b.kind,period_key:b.period_key,payload:Object.assign({},b.payload||{},{jandi:{resent_at:at}}),promises:[]}})});});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.AssetC&&window.AssetReport&&window.ReportCheck&&window.ReportB&&window.BriefB&&window.RelV12&&window.DashB&&window.OpsStore&&window.ContractSalesData&&typeof paintReport==='function');
  /* ───────── 고객 자산 ───────── */
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S=n=>'aaaaaaaa-0000-4000-8000-0000000000'+String(n).padStart(2,'0');
   const deal=(id,site,sid,owner,code,extra)=>Object.assign({id,site,site_id:S(sid),assignee:owner,brand:'POUR솔루션',created:day(-200),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const sent=n=>({stage_contexts:{sent:{fields:{sent_date:day(-n)},edited_at:at(-n)}}});
   const talk=(id,n)=>({activities:[{id,type:'전화',note:'통화',result:'연결됨',meaningful:true,at:at(-n)}]});
   const mark=(s,n)=>({id:'mk'+s,type:'메모',note:'[관계 상태] '+s+' | 사유 | | |',at:at(-n)});
   B={deals:[
    /* D: 대기로 분류 · 마지막 연락 40일 전 — 옛 30일 규칙이면 재접촉, 새 기준(대기 2개월 1회)이면 아직 기한 안 */
    deal('rd','대기 단지',1,'이필선','waiting',{amt:2e8,activities:[mark('대기',50),{id:'t1',type:'전화',note:'통화',result:'연결됨',meaningful:true,at:at(-40)}]}),
    /* E: 분류 안 된 관계관리(발송일 없음) · 연락 40일 전 — 재접촉 대상에서 빼고 분류 보완 */
    deal('re','미확인 단지',2,'황윤선','rapport',Object.assign({amt:3e8},talk('t2',40))),
    /* F: 집중관리(발송 10일 전) · 연락 9일 전 — 옛 규칙은 활성, 집중 7일 후속이면 기한 지남 */
    deal('rf','집중 지난 단지',3,'한준엽','rapport',Object.assign({amt:4e8},sent(10),talk('t3',9))),
    /* G · H: 반복 실주(실주 2회 · 수주 없음) — H 는 원인이 관계 · 소장 변경 */
    deal('g1','반복 실주 단지',4,'김성민','lost',{outcome:'lost',amt:1e8,closed_at:day(-300),closed:day(-300)}),
    deal('g2','반복 실주 단지',4,'김성민','lost',{outcome:'lost',amt:1e8,closed_at:day(-200),closed:day(-200)}),
    deal('h1','소장 변경 실주 단지',5,'정정훈','lost',{outcome:'lost',amt:1e8,closed_at:day(-300),closed:day(-300)}),
    deal('h2','소장 변경 실주 단지',5,'정정훈','lost',{outcome:'lost',amt:1e8,closed_at:day(-100),closed:day(-100),stage_contexts:{lost:{fields:{close_reason:'관계 · 소장 변경'}}}})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.siteStatus='전체';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   goPage('sites');
  });
  await page.waitForTimeout(900);
  const v=page.locator('#site-master .ac');assert.equal(await v.count(),1);
  const H=await page.evaluate(()=>Object.fromEntries(siteMasterData().map(s=>[s.name,[s.health,s.relFix||0,!!s.repeatLoss]])));
  assert.deepEqual(H['대기 단지'],['active',0,false],'대기 단지: 마지막 연락 40일 전이어도 대기 주기(2개월) 안 — 30일 규칙으로 재접촉이 아니다');
  assert.deepEqual(H['미확인 단지'],['active',1,false],'미확인은 재접촉 대상에서 빠지고 분류 보완 1');
  assert.deepEqual(H['집중 지난 단지'],['recontact',0,false],'집중 7일 후속을 넘기면 30일 안이어도 재접촉 필요');
  assert.deepEqual(H['반복 실주 단지'],['risk',0,true]);assert.deepEqual(H['소장 변경 실주 단지'],['risk',0,true]);
  /* 관계 기준 · 이름 · 숫자 */
  await v.locator('[data-ac="rule"]').click();await page.waitForTimeout(100);
  assert.deepEqual(await v.locator('.ac-rules>div').allInnerTexts(),['집중 견적 후 7일 후속','일반 월 1회','대기 2개월 1회','보류 재검토일','미확인 분류 보완 · 재접촉 대상에서 제외','수주 고객 2개월에 한 번 관계 연락','실주 단지 사유 확인 후 재제안 시기 등록','고객과 약속한 날짜가 있으면 그 날짜 우선 · 관계관리 단계와 같은 기준']);
  assert.doesNotMatch(await v.locator('.ac-top').innerText(),/진행 중 단지\s*30일 안에 한 번 연락/,"'진행 중 단지 30일 안에 한 번 연락' 삭제");
  const tabs=await v.locator('.ac-tabs [role=tab]').evaluateAll(l=>l.map(n=>n.querySelector('span').textContent+' '+n.querySelector('b').textContent));
  assert.ok(tabs.includes('반복 실주 2')&&!tabs.some(t=>/^관계위험/.test(t)),'탭 이름 = 반복 실주 · '+tabs.join('|'));
  assert.match(await v.locator('.ac-people').innerText(),/담당자별 반복 실주/);
  const nums=await v.locator('.ac-num').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent)));
  assert.deepEqual(nums.map(n=>n[0]),['누적 수주 (전 단지)','현재 영업기회','과거 검토 금액','현재 위험 금액']);
  const eok=s=>{const m=/([\d.]+)억/.exec(s);return m?Number(m[1]):/만/.test(s)?0.01:0;};
  assert.match(nums[1][2],/^\d+건 · 파이프라인과 같은 숫자$/);assert.match(nums[2][2],/^\d+건 · 이관 · 미정리 · 위험 판정은 정리 후$/);assert.equal(nums[3][2],'현재 영업기회 중 기한 초과 · 원인 확인 필요 단지');
  assert.ok(eok(nums[3][1])<=eok(nums[1][1]),'현재 위험 금액 ≤ 현재 영업기회 · '+nums[3][1]+' / '+nums[1][1]);
  const sp=await v.locator('.ac-split>div').first().innerText();
  assert.match(sp.replace(/\s+/g,' '),/^반복 실주 2곳 · 원인 확인 필요 1 관계위험 · 원인 = 관계 · 소장 변경으로 입력된 곳만 1 /,'반복 실주 2곳 · 원인 미입력 1 · 관계 · 소장 변경 1: '+sp);
  const wy=await v.locator('.ac-why button>b:first-child').allInnerTexts();assert.ok(wy.includes('반복 실주 · 진행 금액 걸림')||!wy.some(x=>/관계위험/.test(x)),'왜 멈춰 있나에 관계위험 이름 없음 · '+wy.join('|'));
  if(shot)await page.screenshot({path:shot+'-asset.png',fullPage:true});
  /* ───────── 월간 리포트 ───────── */
  const P=await page.evaluate(()=>{
   const P=ReportB.period(),day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),at=k=>k+'T10:00:00+09:00',inM=d=>P.ym+'-'+String(d).padStart(2,'0');
   const BR='POUR솔루션',U=n=>'0000000'+n+'-0000-4000-8000-0000000000'+String(n).padStart(2,'0');
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:BR,created:day(-200),updated:day(-90),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,k,extra)=>Object.assign({id:U(n),site:'문의 '+n,status:owner?'배정완료':'접수',at:at(k),created_at:at(k),received_at:at(k),brand:BR,assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(k):null},extra||{});
   const lost=(id,site,owner,k,reason,amt)=>deal(id,site,owner,'lost',{outcome:'lost',grp:'수주 실패',amt,closed_at:at(k),closed:k,stage_contexts:{lost:{fields:{close_reason:reason,close_detail:'확인'}}}});
   B={deals:[
     deal('w1','[서울 마포] 계약 A','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:5e8,closed_at:at(inM(10)),created:inM(3)}),
     lost('l1','[인천] 실주 가격','이필선',inM(8),'가격 열세',2e8),
     deal('n1','[수원] 매탄 임박','황윤선','bidding',{amt:4e8,brand:'석민이앤씨',activities:[{id:'an1',type:'전화',note:'통화 완료',at:new Date(Date.now()-864e5).toISOString()}]}),
     deal('s1','[경기] 오래 조용한 현장','황윤선','sent',{amt:2e8,stage_contexts:{sent:{fields:{sent_date:day(-120)}}},activities:[{id:'as1',type:'전화',note:'통화',at:new Date(Date.now()-100*864e5).toISOString()}]})],
    inquiries:[inq(1,'이필선',inM(2)),inq(2,'이필선',inM(4)),inq(3,'황윤선',inM(6)),inq(4,'',inM(7),{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 공사 범위 밖 · 이전 상태: 접수'})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};
   const ev=(id,k,n,o)=>({deal_id:id,brand:BR,sales_owner_name:o,events:[{kind:'signed',effective_date:k,amount_delta:n}]});
   ContractSalesData.state=()=>({status:'ready',items:[ev('w1',inM(10),5e8,'이필선')]});
   TOKEN='test';OpsStore.flags=()=>({jandi_enabled:true});window.__saves=[];OpsStore.has=()=>true;OpsStore.admin=()=>true;OpsStore.rpc=async(name,p)=>{if(name==='crm_report_snapshot_get_v1')return {ok:true,snapshots:[]};if(name==='crm_report_snapshot_save_v1'){__saves.push(p);return {ok:true};}return {ok:true};};
   window.__printed=null;window.print=()=>{const c=document.querySelector('#report-b .rb-caution');window.__printed=c?c.textContent:'';};
   goPage('report');return P;
  });
  await page.waitForTimeout(500);
  const r=page.locator('#report-b');assert.equal(await r.count(),1);
  /* 문구 · 숫자 */
  const rates=await r.locator('.rb-rates>div>span').allInnerTexts();
  assert.deepEqual(rates.slice(0,4),['영업 메이드율','문의 적합률','월간 계약 · 문의 비율 (활동량)','같은 문의 집단 전환율 ('+P.m+'월 접수)'],'비율 칸 이름');assert.match(rates[4],/^확정 전환율 \(\d+월 문의\)$/);
  assert.doesNotMatch(await r.innerText(),/문의 → 계약 전환율/);
  const made=r.locator('.rb-rates>div').nth(0);assert.match(await made.innerText(),/결과 확정 2건 · 표본 적음 · 추세 판단 제한 · /,'메이드율 옆 결과 확정 n건 · 5건 미만 = 표본 적음');assert.doesNotMatch(await made.locator('p').innerText(),/[▲▼]/,'표본이 적으면 전월 대비 화살표 숨김');
  assert.match(await r.locator('.rb-band').innerText(),/메이드율 50% · 이번 달 결과 확정 2건\(실주 1\) — 표본 적음 · 추세 판단 제한/);
  assert.match(await r.locator('.rb-rates>div').nth(3).innerText(),new RegExp(P.m+'월 접수 문의 4건 중 지금까지 계약 \\d건 · 해당 월 접수 문의 기준'));
  assert.equal(await r.locator('[data-rbs="inq"]').innerText(),P.m+'월 접수 문의 4건 · 대시보드 월별 견적문의와 같은 조건','월 문의 수 = 대시보드와 같은 조건 · 제외 이유');
  const asks=await page.evaluate(()=>ReportB.data().asks.map(a=>[a.k,a.t,a.opts[0]]));
  const stale=asks.find(a=>a[0]==='stale');assert.ok(stale,'오래 조용한 현장 결정 요청 · '+JSON.stringify(asks));assert.match(stale[1],/^\d+일 넘게 접촉 없는 진행 1건 — 기록 확인 → 추진 상태 확인 → 분류 검토$/);assert.equal(stale[2],'기록 확인 → 추진 상태 확인 → 분류 검토');
  assert.doesNotMatch(JSON.stringify(asks),/대기 전환 · 정리/,"'대기 전환 · 정리' 삭제");
  assert.match(await r.locator('[data-rbs="near"]').innerText(),/수원\] 매탄 임박[\s\S]*경쟁 · 입찰 \(입찰단계\) · 기한 미등록/,'공식 7단계 이름 + 세부 상태는 괄호');
  /* 보고서 검증: 눌러서 먼저 뜬다 */
  await r.locator('[data-rb="pdf"]').click();await page.waitForTimeout(100);
  const ck=r.locator('.rb-check');assert.equal(await ck.count(),1,'내보내기 전 보고서 검증');
  assert.deepEqual(await ck.locator('.rb-cr b').allInnerTexts(),['집계 기준 일치','미확인 데이터 포함','표본 부족','공식 단계명','판단 문구 근거']);
  const st=await ck.locator('.rb-cr').evaluateAll(l=>l.map(n=>[n.querySelector('.mk').textContent,n.querySelector('b').textContent,n.querySelector(':scope>div>span').textContent,!!n.querySelector('[data-rb="flag"]')]));
  assert.deepEqual(st.map(x=>x[0]),['✓','!','!','✓','✓'],JSON.stringify(st));
  assert.match(st[0][2],new RegExp('^'+P.m+'월 문의 대시보드 4 · 리포트 4 · 같은 조건$'));assert.equal(st[1][2],'기한 미등록 후반 단계 1건(4억)은 날짜 확인 전 · 전망 합계에서 제외');assert.equal(st[2][2],'메이드율 · 결과 확정 2건 · 5건 미만 — 추세 판단 제한');
  assert.deepEqual(st.map(x=>x[3]),[false,true,true,false,false],'걸린 항목만 [문장 보기]');
  await ck.locator('[data-rb="flag"][data-i="2"]').click();assert.equal(await r.locator('.rb-flag').count(),1,'문장에 노란 밑줄');assert.match(await r.locator('.rb-flag').innerText(),/영업 메이드율/);assert.equal(await r.locator('.rb-flag').evaluate(n=>getComputedStyle(n).textDecorationLine),'underline');
  /* 고친 뒤 다시 확인: 입찰 마감일을 입력하면 한 항목이 사라진다 */
  await page.evaluate(()=>{const d=B.deals.find(x=>x.id==='n1');d.stage_contexts={bidding:{fields:{bid_deadline:new Date(Date.now()+3*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'})}}};});await ck.locator('[data-rb="recheck"]').click();await page.waitForTimeout(100);
  assert.deepEqual(await r.locator('.rb-check .rb-cr .mk').allInnerTexts(),['✓','✓','!','✓','✓'],'고치면 통과로 바뀐다');
  /* 주의 표시 붙여 저장(PDF) */
  assert.match(await r.locator('.rb-check .rb-cb button.pri').innerText(),/주의 표시 붙여 저장/);await r.locator('.rb-check [data-rb="caution"]').click();await page.waitForTimeout(100);
  assert.match(await page.evaluate(()=>window.__printed),/^\[주의\] 표본 부족 — 메이드율 · 결과 확정 2건 · 5건 미만 — 추세 판단 제한$/,'PDF 하단에 주의 문구');await page.waitForTimeout(1700);assert.equal(await r.locator('.rb-caution').count(),0,'저장 뒤 주의 문구 정리');
  /* 주의 표시 붙여 보내기(잔디) */
  await r.locator('[data-rb="send"]').click();await page.waitForTimeout(100);assert.equal(await r.locator('.rb-check').count(),1);assert.match(await r.locator('.rb-check .rb-cb button.pri').innerText(),/주의 표시 붙여 보내기/);
  await r.locator('.rb-check [data-rb="caution"]').click();await page.waitForTimeout(700);
  assert.equal(jandi.length,1,'잔디 발송 1회');assert.match(String(jandi[0].payload&&jandi[0].payload.summary||jandi[0].text||JSON.stringify(jandi[0])),/\[주의\] 표본 부족/,'보내는 글 끝에 주의 문구');
  /* 문제 문장 찾기: 옛 단계 이름이 리포트 글에 있으면 걸린다 */
  await page.evaluate(()=>{const p=document.querySelector('#report-b .rb-note')||document.querySelector('#report-b .rb-page');const s=document.createElement('span');s.id='oldstage';s.textContent='경쟁(PT) · 입찰단계 · 공사 임박 2건';p.appendChild(s);});
  const items=await page.evaluate(()=>ReportCheck.run(ReportB.data(),document.querySelector('#report-b .rb-page')).map(i=>[i.k,i.ok,i.d]));
  assert.equal(items.find(i=>i[0]==='stage')[1],false,'공식 단계명 위반을 찾는다');assert.match(items.find(i=>i[0]==='stage')[2],/공식 7단계 이름이 아닌 단계 이름 1곳 · 입찰단계/);
  assert.deepEqual(errs,[],'페이지 오류 없음 '+errs.join(' | '));
  /* 끄기 */
  await page.evaluate(()=>{G.assetReportOff=true;ReportB.data;});
  if(shot){await page.evaluate(()=>{G.assetReportOff=false;document.getElementById('oldstage')?.remove();});await page.locator('[data-rb="pdf"]').click();await page.waitForTimeout(150);await page.screenshot({path:shot+'-report.png',fullPage:true});}
  console.log('verify-asset-report-browser ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
