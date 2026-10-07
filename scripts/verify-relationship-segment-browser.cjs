'use strict';
/* 파이프라인 · 관계관리 단계 화면 검사(2026-10-05 design_handoff_relationship — README '분류 규칙' · '확정 배치')
   ✅ 분류는 단계 이름이 아니라 견적 발송일 · 공사 예정 시기로(마지막 접촉 369일 전인 건이 집중관리로 잡히지 않는다) ✅ 줄마다 그 건의 경과일(평균 체류가 줄에 찍히지 않는다)
   ✅ 3칸 카드 → 아래 2단(왼쪽 340px · 오른쪽 나머지) ✅ 왜 멈춰 있나 5줄 · 그래서 뭘 해야 하나 3상자 · 자동 이동 규칙 ✅ 칸별 칩 · 둘째 열 · 버튼 1개
   ✅ 견적 발송일 없는 건은 '데이터 확인 필요'로 따로 · [발송일 입력] = 서버 확인 뒤 자동 분류 ✅ 기준 넘김 = 관리팀 KPI 와 같은 함수 ✅ 대표 화면 폭(1207) · 좁은 화면 ✅ 끄면 예전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineStageB&&window.PipelineRelB&&window.RelationshipSegment&&window.PipelineWorkspace&&window.CommonFilterBar);
  const D=await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()-n*864e5).toISOString(),md=n=>{const d=new Date(Date.now()+n*864e5);return (d.getMonth()+1)+'/'+d.getDate();};
   const Y=new Date().getFullYear(),near=new Date();near.setDate(1);near.setMonth(near.getMonth()+2);const nearLabel=near.getFullYear()+'.'+(near.getMonth()+1);
   /* 단계 이름(유대 · 침묵 · 대기)은 일부러 엇갈리게 — 분류에 쓰이지 않는다. 단계 진입일은 전부 같은 날(옮겨 온 자료처럼) */
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'석민이앤씨',created:day(-400),stage_entered_at:at(34),code,stage_code:code,grp:'영업·관리',amt:2e8},extra||{});
   const sent=n=>({sent:{fields:{sent_date:day(-n)}}}),next=(id,text,n,type)=>({id,type:type||'전화',text,due:day(n),status:'open'});
   B={deals:[
    deal('f-stale','집중 12일 무연락','김성민','waiting',{amt:3.8e8,stage_contexts:sent(12),next_action:next('n1','대표회의 자료 확인',13,'회의')}),
    deal('f-ok','집중 정상','정정훈','rapport',{brand:'아파트스퀘어',amt:5.4e8,stage_contexts:sent(6),last_meaningful_contact_at:at(3),next_action:next('n2','반응 확인',3)}),
    deal('f-judge','집중 판단 임박','이필선','silent',{amt:2.8e8,stage_contexts:sent(28),last_meaningful_contact_at:at(1),next_action:next('n3','수주 가능성 판단',2)}),
    deal('n-stale','일반 40일 무접촉','황윤선','rapport',{brand:'POUR솔루션',amt:3e8,stage_contexts:sent(47),last_meaningful_contact_at:at(40),list_fields:{a:{name:'공사계획년도',value:String(Y)}}}),
    deal('n-m4','일반 4개월 도달','황윤선','rapport',{amt:5.5e8,stage_contexts:sent(110),last_meaningful_contact_at:at(5)}),
    deal('w-year','대기 내년 공사','한준엽','rapport',{amt:2.2e8,list_fields:{a:{name:'공사계획년도',value:String(Y+2)}}}),
    deal('w-late','대기 연락일 지남','이필선','silent',{brand:'POUR솔루션',amt:0.9e8,stage_contexts:sent(200),last_meaningful_contact_at:at(90),next_action:next('n4','안부 전화',-29)}),
    deal('w-near','대기 공사 임박','정정훈','rapport',{brand:'POUR솔루션',amt:1.4e8,stage_contexts:Object.assign(sent(200),{rapport:{fields:{construction_plan:nearLabel}}}),last_meaningful_contact_at:at(10)}),
    /* 견적 발송일 없음: 마지막 접촉 369일 전 · 단계 이름은 유대강화(예전에는 집중관리로 잡히던 건) */
    deal('x-369','발송일 없는 369일','김성민','rapport',{amt:1.1e8,last_meaningful_contact_at:at(369)}),
    deal('x-none','발송일도 접촉도 없음','한준엽','waiting',{amt:0.26e8})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.psb=null;G.prb=null;G.pipeStageV3Off=true;/* 공통 틀 v3 는 verify-pipeline-stage-v3-browser.cjs — 이 검사는 끄기 스위치 뒤의 관계관리 세분화 */
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=null;window.__act=null;window.__rpc=[];drwDeal=s=>{window.__open=JSON.parse(s).id;};window.DetailActions=Object.assign(window.DetailActions||{},{open:k=>{window.__act=k;}});
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:()=>true,noteMissing(){}});
   window.SB={rpc:async(name,args)=>{if(name!=='crm_deal_stage_fields_update_v1')return {data:null,error:{message:'검사에 없는 서버 함수',code:'PGRST202'}};__rpc.push([name,JSON.parse(JSON.stringify(args))]);const p=args.p,d=B.deals.find(x=>String(x.id)===p.deal_id);if(!d||d.stage_code!==p.stage_code)return {data:null,error:{message:'단계가 바뀌었습니다'}};const prev=(d.stage_contexts||{})[p.stage_code]||{};return {data:{ok:true,stage_context:Object.assign({},prev,{to:p.stage_code,fields:Object.assign({},prev.fields||{},p.fields)}),version:2},error:null};}};
   PipelineWorkspace.open('relationship');
   return {today:day(0),md13:md(13),md3:md(3),md2:md(2),nearLabel,Y,d3:day(-3)};
  });
  await page.waitForTimeout(350);
  const b=page.locator('#pipeline-stage-b');assert.equal(await b.getAttribute('data-stage'),'relationship');assert.equal(await page.locator('#pipeline-stage-b.prb').count(),1,'관계관리 전용 배치');assert.equal(await b.locator('.psb-axis').count(),0,'예전 막대 · 범례 없음');
  const one=s=>s.replace(/\s+/g,' ').trim();
  assert.equal(one(await b.locator('.prb-head').innerText()),'관계관리 견적 후 관리 구분 · 집중관리(초기 1개월, 7일 단위) → 일반관리(월 1회) → 대기관리(2개월 1회) · 견적 발송일 · 공사 예정 시기로 매일 자동 분류');
  /* ① 3칸 카드: 건수 · 기준 · 기준 지킴 · 기준 넘긴 건 */
  assert.deepEqual((await b.locator('.prb-sub').allInnerTexts()).map(one),[
   '집중관리 견적 후 0–30일 3건 7일 단위 후속 · 대표회의 · 경쟁사 · 가격 확인 기준 지킴 67% 7일 넘게 연락 없음 1건',
   '일반관리 견적 후 1–4개월 2건 월 1회 이상 접촉 · 카드뉴스 · 시공 사례 전달 기준 지킴 50% 30일 넘게 접촉 없음 1건',
   '대기관리 공사 시기 내년 이후 3건 2개월마다 안부 · 공사 시기 확인 + 다음 연락일 등록 기준 지킴 33% 2개월 연락일 지남 2건']);
  assert.deepEqual(await b.locator('.prb-sub').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-pressed'))),['true','false','false']);
  assert.deepEqual(await b.locator('.prb-sub').evaluateAll(ns=>ns.map(n=>getComputedStyle(n).borderTopColor)),['rgb(21, 23, 28)','rgb(138, 144, 156)','rgb(213, 217, 224)']);
  assert.equal(await b.locator('.prb-sub').nth(2).locator('.bar b').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)','기준 지킴 50% 아래는 빨강');
  assert.match(one(await b.locator('.prb-nodata').innerText()),/^데이터 확인 필요 2건 견적 발송일이 없어 분류하지 못했습니다 · 발송일을 넣으면 자동으로 분류됩니다 보기$/);
  /* ② 아래 2단: 왼쪽 340px · 오른쪽 나머지 */
  const cols=await b.locator('.prb-body').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' '));assert.equal(cols.length,2);assert.equal(cols[0],'340px');
  assert.match(one(await b.locator('.prb-left .prb-box').first().innerText()),/^단계 진단 10건 · 26\.4억 기준 넘김 \(빨강\) 4건 세 칸 합 · 오늘 처리할 것 평균 체류 34일 이 단계에 머문 일수$/);
  assert.deepEqual((await b.locator('.prb-reason').allInnerTexts()).map(one),['집중관리 7일 넘게 연락 없음 1','30일 넘게 접촉 없음 1','대기 2개월 연락일 지남 2','구분 전환 검토 4','다음 행동 · 날짜 없음 4'],'왜 멈춰 있나 5줄 — 세 칸의 건만 센다');
  assert.equal(await page.evaluate(()=>{const m=PipelineStageB.model('relationship',PipelineWorkspace.rows().filter(r=>r.group==='relationship'));return m.items.filter(i=>i.red).length;}),4,'기준 넘김 = 관리팀 KPI 단계별 기준과 같은 함수');
  assert.deepEqual((await b.locator('.prb-act').allInnerTexts()).map(one),['집중관리 7일 넘게 연락 없음 1건 집중관리 고객은 7일 단위 후속 · 대표회의 · 경쟁사 · 가격 변화 확인 D+3 수신 → D+7 반응 → D+14 진행 → D+30 판단 순서','30일 판단 임박 2건 견적 후 30일째 수주 가능성 판단 경쟁 · 입찰로 넘기거나 일반관리로','다음 행동 · 날짜 없음 0건 통화 후 다음 행동과 날짜를 꼭 남기기 결과를 고르면 다음 날짜가 자동 제안']);
  assert.equal(await b.locator('.prb-moves').count(),0);await b.locator('[data-prb="rule"]').click();await page.waitForTimeout(150);
  assert.deepEqual((await b.locator('.prb-moves>div').allInnerTexts()).map(one),['집중관리 → 일반관리 견적 후 30일 지남 1','집중관리 → 경쟁 · 입찰 대표회의 · 입찰 일정 잡힘 1','일반관리 → 대기관리 내년 이후 확정 · 4개월 지남 1','대기관리 → 집중관리 공사 시기 3개월 안 1','어디서든 → 실주 · 보류 담당자가 결과 기록 0']);
  /* ③ 오른쪽: 집중관리 — 연락 없는 기간 긴 순 · 줄마다 그 건의 값 */
  assert.equal(one(await b.locator('.prb-lhead>b').innerText()),'확인할 현장 집중관리 3곳');assert.deepEqual((await b.locator('.prb-chip').allInnerTexts()).map(one),['전체 3','7일+ 연락 없음 1','대표회의 잡힘 1']);assert.equal(await b.locator('.prb-lhead>small').innerText(),'연락 없는 기간 긴 순');
  assert.deepEqual((await b.locator('.prb-thead span').allInnerTexts()).map(s=>s.trim()),['','현장 · 담당','연락 없음','지금 걸린 것','금액','']);
  const rows=async()=>(await b.locator('.prb-row').allInnerTexts()).map(one);
  assert.deepEqual(await rows(),[
   '집중 12일 무연락 석민이앤씨 · 김성민 12일째 견적 후 12일 12일 연락 없음 · 대표회의 '+D.md13+' 3.8억 후속 연락',
   '집중 정상 아파트스퀘어 · 정정훈 3일째 견적 후 6일 정상 · 다음 연락 '+D.md3+' 5.4억 열기',
   '집중 판단 임박 석민이앤씨 · 이필선 1일째 견적 후 28일 30일 판단 2일 남음 2.8억 판단']);
  assert.equal((await rows()).some(t=>/34일/.test(t)),false,'단계 평균 체류(34일)가 줄에 찍히지 않는다');
  const r0=b.locator('.prb-row').first();
  assert.equal(await r0.locator('>i').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(232, 89, 12)','브랜드 띠');assert.equal(await r0.locator('.d b').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)');assert.equal(await r0.locator('.i').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)');
  assert.equal(await r0.locator('button').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(21, 23, 28)','기준 넘긴 줄 = 검정 버튼');assert.equal(await b.locator('.prb-row').nth(2).locator('.i').evaluate(n=>getComputedStyle(n).color),'rgb(192, 57, 43)','곧 넘김 = 주황');assert.equal(await b.locator('.prb-row').nth(1).locator('button').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
  assert.match(await b.locator('.prb-foot').innerText(),/^30일이 지나면 일반관리로 자동 이동 · 대표회의가 잡히면 경쟁 · 입찰로$/);
  assert.equal(await b.locator('.prb-thead').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),6);
  await b.locator('.prb-chip[data-v="meet"]').click();await page.waitForTimeout(150);assert.equal((await rows()).length,1);assert.match((await rows())[0],/^집중 12일 무연락/);await b.locator('.prb-chip[data-v="all"]').click();await page.waitForTimeout(150);
  /* 버튼 → 기존 상세 + 액션 · 줄 → 상세 */
  await r0.locator('button').click();await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>[__open,__act]),['f-stale','activity']);
  await b.locator('.prb-row').nth(2).locator('button').click();await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>[__open,__act]),['f-judge','stage'],'판단 = 단계 바꾸기');
  await b.locator('.prb-row').nth(1).locator('.s').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__open),'f-ok');
  if(shot)await page.screenshot({path:shot+'-focus.png',fullPage:true});
  /* 왜 멈춰 있나 → 그 칸으로 + 걸러짐 */
  await b.locator('.prb-reason[data-v="month30"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await b.locator('.prb-sub').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-pressed'))),['false','true','false']);assert.deepEqual(await rows(),['일반 40일 무접촉 POUR솔루션 · 황윤선 40일 전 견적 후 2개월 30일 넘게 접촉 없음 · 다음 행동 없음 3억 자료 보내기']);
  await b.locator('.prb-reason[data-v="month30"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await rows(),['일반 40일 무접촉 POUR솔루션 · 황윤선 40일 전 견적 후 2개월 30일 넘게 접촉 없음 · 다음 행동 없음 3억 자료 보내기','일반 4개월 도달 석민이앤씨 · 황윤선 5일 전 견적 후 4개월 4개월 도달 · 대기관리로 이동 예정 · 다음 행동 없음 5.5억 시기 확인']);
  assert.deepEqual((await b.locator('.prb-chip').allInnerTexts()).map(one),['전체 2','30일+ 접촉 없음 1','4개월 도달 1']);assert.equal((await b.locator('.prb-thead span').allInnerTexts())[2].trim(),'마지막 접촉');
  assert.deepEqual((await b.locator('.prb-act>span').allInnerTexts()).map(one),['30일 넘게 접촉 없음 1건','4개월 도달 1건','다음 행동 · 날짜 없음 2건']);
  /* 대기관리 — 공사 예정 가까운 순 */
  await b.locator('.prb-sub').nth(2).click();await page.waitForTimeout(200);
  assert.deepEqual(await rows(),[
   '대기 공사 임박 POUR솔루션 · 정정훈 '+D.nearLabel+' 3개월 안 공사 시기 3개월 안 → 집중관리 복귀 · 다음 행동 없음 1.4억 집중관리로',
   '대기 내년 공사 석민이앤씨 · 한준엽 '+(D.Y+2)+'년 CRM 연락 기록 없음 2개월 연락일 지남 · 다음 행동 없음 2.2억 안부 연락',
   '대기 연락일 지남 POUR솔루션 · 이필선 시기 미정 연락일 29일 지남 2개월 연락일 지남 · 공사 시기 미정 · 시기 확인 0.9억 안부 연락']);
  assert.deepEqual((await b.locator('.prb-chip').allInnerTexts()).map(one),['전체 3','연락일 지남 2','관리소장 변경 0']);assert.match(await b.locator('.prb-foot').innerText(),/^공사 시기가 3개월 안 = 집중관리로 복귀 · 관리소장이 바뀌면 변화 이벤트 생성$/);
  /* [집중관리로] = 지금 단계 정보에 집중 복귀일 저장 → 30일 집중관리 */
  await b.locator('.prb-row').first().locator('button').click();await page.waitForTimeout(200);assert.equal(one(await b.locator('.prb-pop').innerText()),'오늘부터 30일 동안 집중관리로 옮깁니다 · 7일 단위 후속 · 견적 다시 확인 집중관리로 옮기기 취소');
  await b.locator('.prb-pop [data-prb="popsave"]').click();await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(()=>__rpc.map(x=>[x[0],x[1].p.deal_id,x[1].p.stage_code,x[1].p.fields,x[1].p.reason])),[['crm_deal_stage_fields_update_v1','w-near','rapport',{focus_from:D.today},'공사 시기 3개월 안 · 집중관리 복귀']],'서버 저장 한 번');
  assert.deepEqual((await b.locator('.prb-sub .n').allInnerTexts()).map(one),['4건','2건','2건'],'집중관리로 옮겨짐');assert.equal(await b.locator('.prb-pop').count(),0);
  await b.locator('.prb-sub').first().click();await page.waitForTimeout(200);assert.match((await rows()).find(t=>/^대기 공사 임박/.test(t)),/오늘 집중 복귀 0일 다음 행동 · 날짜 없음 1\.4억 다음 행동$/,'복귀한 날부터 7일 단위 후속을 다시 센다');
  if(shot)await page.screenshot({path:shot+'-wait.png',fullPage:true});
  /* 견적 발송일 없는 건 = 데이터 확인 필요(분류하지 않음) — 369일 전 접촉 건이 집중관리에 없다 */
  assert.equal((await rows()).some(t=>/369/.test(t)),false,'369일 전 접촉 건은 집중관리에 없다');
  await b.locator('.prb-nodata').click();await page.waitForTimeout(200);
  assert.equal(one(await b.locator('.prb-lhead>b').innerText()),'확인할 현장 데이터 확인 필요 2곳');
  assert.deepEqual(await rows(),['발송일 없는 369일 석민이앤씨 · 김성민 발송일 없음 마지막 접촉 369일 전 견적 발송일 없음 · 넣으면 자동 분류 1.1억 발송일 입력','발송일도 접촉도 없음 석민이앤씨 · 한준엽 발송일 없음 접촉 기록 없음 견적 발송일 없음 · 넣으면 자동 분류 0.26억 발송일 입력']);
  assert.deepEqual((await b.locator('.prb-act>span').allInnerTexts()).map(one),['견적 발송일 없음 2건']);
  await page.evaluate(()=>{__rpc.length=0;});
  await b.locator('.prb-row').first().locator('button').click();await page.waitForTimeout(200);assert.match(one(await b.locator('.prb-pop').innerText()),/^견적 발송일 저장 취소 넣은 날부터 30일 집중관리 → 4개월 일반관리로 자동 분류됩니다$/);
  await b.locator('.prb-pop [data-prb="popsave"]').click();await page.waitForTimeout(200);assert.match(await b.locator('.prb-pop p').innerText(),/오늘까지의 날짜로 넣어 주세요/);assert.equal(await page.evaluate(()=>__rpc.length),0,'날짜 없이 저장하지 않는다');
  await page.fill('#prb-date',D.d3);await b.locator('.prb-pop [data-prb="popsave"]').click();await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(()=>__rpc.map(x=>[x[1].p.deal_id,x[1].p.stage_code,x[1].p.fields,x[1].p.reason])),[['x-369','rapport',{sent_date:D.d3},'관계관리 분류 · 견적 발송일 입력']]);
  assert.match(one(await b.locator('.prb-nodata').innerText()),/^데이터 확인 필요 1건/);assert.deepEqual((await b.locator('.prb-sub .n').allInnerTexts()).map(one),['5건','2건','2건'],'발송일을 넣으면 자동 분류');
  await b.locator('.prb-sub').first().click();await page.waitForTimeout(200);assert.match((await rows()).find(t=>/^발송일 없는 369일/.test(t)),/3일째 견적 후 3일 다음 행동 · 날짜 없음 1\.1억 다음 행동$/);
  /* 보드 = 세 칸 */
  await b.locator('[data-prb="view"][data-v="board"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await b.locator('.psb-col .ch b').allInnerTexts(),['집중관리','일반관리','대기관리']);assert.deepEqual(await b.locator('.psb-col .ch span').allInnerTexts(),['5','2','2']);assert.equal(await b.locator('.prb-card').count(),9);
  if(shot)await page.screenshot({path:shot+'-board.png',fullPage:true});
  await b.locator('[data-prb="view"][data-v="list"]').click();await page.waitForTimeout(200);
  /* 관리팀 KPI 단계별 기준: 같은 함수 — 기준 넘김 3종 */
  const kp=await page.evaluate(()=>{const m=PipelineStageB.model('relationship',PipelineWorkspace.rows().filter(r=>r.group==='relationship'));return {red:Object.keys(m.C.RS).filter(k=>m.isRed(k)),over:m.items.filter(i=>i.red).length,buckets:m.items.map(i=>i.bucket).sort().join(',')};});
  assert.deepEqual(kp.red,['focus7','month30','long60']);assert.equal(String(kp.over)+'건',one(await b.locator('.prb-kpis b').first().innerText()),'왼쪽 기준 넘김 = 같은 계산');
  /* 대표 화면 폭(1207) · 좁은 화면 */
  await page.setViewportSize({width:1207,height:914});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'1207 폭 넘침 없음');
  assert.equal((await b.locator('.prb-body').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ')))[0],'340px');assert.ok(await b.locator('.prb-row').first().locator('button').evaluate(n=>n.getBoundingClientRect().height<40),'버튼이 세로로 커지지 않는다');
  if(shot)await page.screenshot({path:shot+'-1207.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  /* 끄면 예전 화면(단계 이름 기준) */
  await page.evaluate(()=>{G.relSegOff=true;paint();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#pipeline-stage-b.prb').count(),0);assert.deepEqual((await page.locator('#pipeline-stage-b .psb-axis .leg button').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').replace(/\s\d+$/,'')),['집중관리 · 7일 단위','일반관리 · 월 1회','대기 · 2개월 1회']);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',classify_by_quote_date:true,no_369_in_focus:true,row_values_per_deal:true,layout_3cards_340_left:true,why5_todo3_moves:true,chips_columns_buttons:true,nodata_separate_and_input:true,back_to_focus:true,board:true,kpi_same_function:true,width_1207:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
