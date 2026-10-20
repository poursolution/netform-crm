'use strict';
/* 견적문의 · 토스 방식 목록 (2026-10-18 대표 "토스 스타일로" → 시안 확인 뒤 "진행해")
   합성 자료 8건(검사 verify-inquiry-v5 와 같은 것 · 이름 · 현장은 지어낸 것).
   확인: v5 자리를 대신(위 탭 줄 그대로) / 단계 4칸 = v5 와 같은 건수 · 합 = 진행 중 전체 / 맨 위 문장 = 가장 급한 일 하나
        / 할 일 묶음 순서 · 줄마다 버튼 하나(일어날 일 그대로) / 줄 클릭 = 오른쪽 요약, 한 번 더 = 상세 창 / 버튼 = 상세 창
        / 단계 칸 · 확인 필요 칩으로 거르기 · 전체 보기 / 글 넘침 없음 / 한 쪽 20건 + 쪽 번호 / 끄면 v5 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions());
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-09T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryListV3&&window.InquiryWorkbench&&window.InquiryV5&&window.InquiryToss);
  await page.evaluate(()=>{
   const at=(d,h)=>new Date(Date.now()-d*864e5-(h||0)*36e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
   const rep={assignee:'이필선',assigned_to:'이필선'};
   B={deals:[],inquiries:[
    {id:id(1),site:'[서울 성북] 길음뉴타운9단지',status:'접수',at:at(0,3),created_at:at(0,3),brand:'POUR솔루션',phone:'010-2281-4402',contact_name:'정미경',raw:{'문의내용':'옥상 방수 견적 요청드립니다.','상담채널':'홈페이지'}},
    {id:id(2),site:'[부산] 동부산훼미리타운4차',status:'접수',at:at(0,0.1),created_at:at(0,0.1),brand:'석민이앤씨',phone:'051-700-1100',contact_name:'박소장',raw:{'문의내용':'지하주차장 에폭시 문의.','상담채널':'전화'}},
    {id:id(3),site:'[경기 김포] 한강반도유보라',status:'배정완료',at:at(1),created_at:at(1),brand:'석민이앤씨',phone:'031-987-1150',contact_name:'이준호',...rep,assigned_at:at(0.9),raw:{'문의내용':'지하주차장 바닥 에폭시 들뜸 보수 문의.','상담채널':'전화'}},
    {id:id(4),site:'[경남] 혁신LH5단지',status:'배정완료',at:at(40),created_at:at(40),brand:'석민이앤씨',phone:'055-757-7977',contact_name:'관리소장',...rep,assigned_at:at(39),responded_at:at(30),raw:{'문의내용':'외벽 재도장 현장 확인 요청','상담채널':'전화'},activities:[{type:'전화',note:'첫 연락 — 현장 확인 요청',at:at(30),actor:'이필선'}]},
    {id:id(5),site:'[경기 수원] 매탄임광아파트',status:'배정완료',at:at(8),created_at:at(8),brand:'POUR공법',phone:'031-214-7710',contact_name:'관리소장',...rep,assigned_at:at(7.9),responded_at:at(5),raw:{'문의내용':'외벽 재도장 견적 · 대표회의 전 자료 필요','상담채널':'전화','대표회의':day(2),'공사유형':'외벽 재도장'},activities:[{type:'전화',note:'견적 범위 확인',at:at(5),actor:'이필선'}]},
    {id:id(6),site:'[서울 노원] 중계청구3차',status:'배정완료',at:at(2),created_at:at(2),brand:'아파트스퀘어',phone:'02-933-1180',contact_name:'홍성우',...rep,assigned_at:at(1.9),responded_at:at(1),raw:{'문의내용':'공법 설명 자료 요청','상담채널':'홈페이지'},activities:[{type:'전화',note:'자료 발송 안내',at:at(1),actor:'이필선'}]},
    {id:id(7),site:'[서울 은평] 녹번역e편한세상',status:'현장방문예정',at:at(4),created_at:at(4),brand:'POUR솔루션',phone:'02-300-1180',contact_name:'김소장',...rep,assigned_at:at(3.9),responded_at:at(3),raw:{'문의내용':'옥상 방수 견적','상담채널':'홈페이지'},activities:[{type:'전화',note:'방문 일정 협의',at:at(3),actor:'이필선'}]},
    {id:id(8),site:'[경기 광교] 광교한빛아파트',status:'견적서 발송예정',at:at(6),created_at:at(6),brand:'POUR솔루션',phone:'031-300-1180',contact_name:'최과장',...rep,assigned_at:at(5.9),responded_at:at(4),raw:{'문의내용':'옥상 방수 견적','상담채널':'전화'},activities:[{type:'전화',note:'견적 범위 확인',at:at(4),actor:'이필선'}]}],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;G.inqTidyOff=true;/* 예전 상세 배치(끄기 경로) — 정리된 상세는 verify-inquiry-tidy-browser */ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqV3=null;G.inqV4=null;G.inqV5=null;G.inqToss=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   SB={rpc:async()=>({error:{message:'CONTRACT_UNAVAILABLE'}})};
   window.Phase1={profile:{auth_uid:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'송보람'},rpc:async()=>{throw Error('CONTRACT_UNAVAILABLE');}};
   window.id=id;goPage('inq');
  });
  await page.waitForTimeout(500);
  const one=s=>String(s||'').replace(/\s+/g,' ').trim();
  const T=page.locator('#inq-toss'),nums=()=>T.locator('.tq-stg b').evaluateAll(l=>l.map(b=>Number(b.textContent)));
  const row=n=>T.locator('.tq-row',{hasText:n}),titles=async()=>(await T.locator('.tq-gt').allInnerTexts()).map(t=>one(t).replace(/\s*\d+$/,''));
  /* ① v5 자리를 대신하고, 위쪽(탭 · 브랜드 칩)은 그대로 */
  assert.equal(await T.count(),1);assert.equal(await page.evaluate(()=>getComputedStyle(document.getElementById('inq-v5')).display),'none','v5 는 가려 둔다');
  assert.equal(await page.locator('#pg-inq .b2b-bar').count(),1,'위 탭 줄 그대로');
  /* ①-2 가려진 v4 목록은 줄 · 상세를 그리지 않는다(줄마다 응대 이력을 읽어 업무 요청 조회가 한 건씩 나가던 것) */
  assert.deepEqual(await page.evaluate(()=>{let n=0;const D=InquiryDetailV2,t=D.timeline;D.timeline=function(){n++;return t.apply(this,arguments);};try{paint();}finally{D.timeline=t;}return [n,document.querySelectorAll('#inq-v4 .i4-row').length,document.querySelectorAll('#inq-v4 .i4-tab').length>0];}),[0,0,true],'가려진 v4: 응대 이력 읽기 0번 · 줄 0개 · 위 탭은 그대로');
  /* ② 단계 4칸 = v5 와 같은 계산 · 합 = 진행 중 전체 */
  assert.deepEqual(await nums(),[2,1,3,2],'접수 2 · 담당 배정 1 · 접촉 · 상담 3 · 방문 · 견적 2');
  assert.deepEqual(await page.evaluate(()=>[InquiryV4.total(),InquiryV5.compute().cols.map(c=>c.length)]),[8,[2,1,3,2]]);
  assert.deepEqual((await T.locator('.tq-stg span').allInnerTexts()).map(one),['접수','담당 배정','접촉 · 상담','방문 · 견적']);
  assert.match(one(await T.locator('.tq-stg small').nth(3).innerText()),/^견적 보내면 .+\(으\)로$/);
  /* ③ 맨 위 문장 = 가장 급한 일 하나(기준 30분 넘긴 미배정이 있다) */
  assert.equal(one(await T.locator('.tq-hero').innerText()),'담당자를 기다리는 문의가 2건 있어요');
  assert.match(one(await T.locator('.tq-lead').innerText()),/^가장 오래된 건은 .+째 기다리고 있어요 · 진행 중 8건/);
  /* ④ 할 일 묶음: 담당 → 첫 연락 → 그 밖(기한 순) · 줄마다 버튼 하나 */
  const tt=await titles();assert.deepEqual(tt.slice(0,2),['담당자를 정해 주세요','첫 연락이 필요해요']);
  assert.ok(tt.slice(2).every(t=>['기한이 지났어요','오늘 할 일','다가오는 일','기한을 정해 주세요'].includes(t)),tt.join(','));
  assert.equal(await T.locator('.tq-gt').first().getAttribute('class'),'tq-gt red','기준 넘긴 미배정이 있으면 제목 빨강');
  assert.equal(await T.locator('.tq-row').count(),8);
  for(const r of await T.locator('.tq-row').all())assert.equal(await r.locator('button').count(),1,'줄마다 버튼 하나');
  assert.equal(one(await row('길음뉴타운').locator('.tq-btn').innerText()),'배정하기');
  assert.equal(one(await row('한강반도').locator('.tq-btn').innerText()),'첫 연락하기');
  assert.equal(one(await row('매탄임광').locator('.tq-btn').innerText()),'결과 남기기');
  assert.match(await row('길음뉴타운').locator('.tq-d').getAttribute('class'),/red/,'기다린 시간이 기준을 넘으면 빨강');
  assert.doesNotMatch(await row('동부산훼미리').locator('.tq-d').getAttribute('class'),/red/);
  assert.match(one(await row('혁신LH5').locator('.tq-d').innerText()),/일/);
  assert.doesNotMatch(await T.innerText(),/미분류/,'공종 미분류는 쓰지 않는다');
  /* ⑤ 글 넘침 없음 */
  assert.deepEqual(await T.locator('.tq-nm,.tq-ds,.tq-c,.tq-btn,.tq-stg small,.tq-d b').evaluateAll(l=>l.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)),[],'글 넘침 없음');
  /* ⑥ 오른쪽 요약: 처음엔 맨 위 줄 · 줄 클릭 = 요약만 바뀜 · 같은 줄 한 번 더 = 상세 창 */
  assert.equal(one(await T.locator('.tq-st').innerText()),'[서울 성북] 길음뉴타운9단지');
  assert.equal(await T.locator('.tq-side button').count(),2,'버튼 둘');assert.equal(one(await T.locator('.tq-p1').innerText()),'배정하기');assert.equal(one(await T.locator('.tq-p2').innerText()),'상세 열기');
  await row('중계청구').click();assert.equal(one(await T.locator('.tq-st').innerText()),'[서울 노원] 중계청구3차');assert.equal(await page.locator('#inq-inbox-dialog').count(),0,'첫 클릭은 고르기만');
  assert.match(await T.innerText(),/02-933-1180/,'연락처');
  if(shot)await page.screenshot({path:shot,fullPage:true});
  await row('중계청구').click();const D=page.locator('#inq-inbox-dialog');await D.waitFor();assert.match(await D.innerText(),/중계청구3차/);
  /* 상세 창도 같은 모양(모양만): 회색 바탕 · 흰 상자 · 단계 둥근 칸 · 파란 전화 버튼 */
  assert.deepEqual(await page.evaluate(()=>{const q=s=>document.querySelector('#inq-inbox-dialog '+s),cs=s=>getComputedStyle(q(s));
   return [document.documentElement.classList.contains('tq-on'),cs('.inq-dialog').backgroundColor,cs('.idv3-c2').borderRadius,cs('.idv3-steps.i5-mini>div').clipPath,cs('.idv3-call').backgroundColor];}),
   [true,'rgb(242, 244, 246)','20px','none','rgb(59, 108, 228)'],'상세 창 토스 모양');
  if(process.argv[3])await page.screenshot({path:process.argv[3]});
  assert.equal(await page.evaluate(()=>{G.inqTossDetailOff=true;InquiryToss.skin();const r=document.documentElement.classList.contains('tq-on');G.inqTossDetailOff=false;InquiryToss.skin();return r;}),false,'상세 창 모양만 따로 끌 수 있다');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(150);
  await row('한강반도').locator('.tq-btn').click();await D.waitFor();assert.match(await D.innerText(),/한강반도유보라/,'버튼 = 상세 창');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(150);
  /* ⑦ 거르기: 단계 칸 · 확인 필요 칩 · 전체 보기 */
  await T.locator('.tq-stg').nth(2).click();assert.equal(await T.locator('.tq-stg').nth(2).getAttribute('aria-pressed'),'true');
  assert.equal(await T.locator('.tq-row').count(),3);assert.deepEqual(await nums(),[2,1,3,2],'단계 칸 숫자는 그대로');
  await T.locator('[data-tq="clear"]').click();assert.equal(await T.locator('.tq-row').count(),8);assert.equal(await T.locator('[data-tq="clear"]').count(),0);
  const chips=(await T.locator('.tq-chip').allInnerTexts()).map(one);assert.deepEqual(chips,['미배정 1','첫 연락 지연 1','정보 부족 3','대표회의 D-3 1','후속 지연 1']);
  await T.locator('.tq-chip[data-v="follow"]').click();assert.equal(await T.locator('.tq-row').count(),1);assert.equal(await row('혁신LH5').count(),1);
  await T.locator('[data-tq="clear"]').click();
  /* ⑧ 한 쪽 20건 + 쪽 번호(묶음을 넘어 이어서 센다) */
  await page.evaluate(()=>{const at=d=>new Date(Date.now()-d*864e5).toISOString();for(let n=20;n<36;n++)B.inquiries.push({id:id(n),site:'[합성] 추가 단지 '+n,status:'배정완료',at:at(3),created_at:at(3),brand:'석민이앤씨',phone:'02-000-00'+n,contact_name:'소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(2.9),responded_at:at(1),raw:{'문의내용':'문의','상담채널':'전화'},activities:[{type:'전화',note:'통화',at:at(1),actor:'이필선'}]});InquiryV4.fresh();paint();});
  await page.waitForTimeout(300);assert.equal(await T.locator('.tq-row').count(),20);assert.equal(await T.locator('nav.lpg').count(),1);
  await T.locator('nav.lpg button[data-page="2"]:not(.lpg-arrow)').click();assert.equal(await T.locator('.tq-row').count(),4);
  /* ⑨ 좁은 화면(390) 넘침 없음 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  /* ⑩ 끄면 v5 */
  assert.deepEqual(await page.evaluate(()=>{G.inqTossOff=true;paint();return [!!document.getElementById('inq-toss'),document.getElementById('pg-inq').classList.contains('inq-toss'),getComputedStyle(document.getElementById('inq-v5')).display!=='none'];}),[false,false,true]);
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log('inquiry toss ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
