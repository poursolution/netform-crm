'use strict';
/* 문의 → 영업 → 계약 → 시공 경로 한 줄 · 영업건 ↔ 문의 이동 · 넘어간 문의 찾기 (2026-11-05)
   합성 자료(현장 · 이름은 지어낸 것). 확인: 칸 내용(없는 사실을 안 적는지) / 연결 기록과 같은 현장 후보 구분 / 실제 클릭 이동과 되돌아오기 / 진행 중 숫자 그대로 / 375px 넘침 / 끄면 예전처럼 / 화면 오류 없음 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
const ID={Q1:'11111111-1111-4111-8111-111111111111',Q2:'22222222-2222-4222-8222-222222222222',Q3:'33333333-3333-4333-8333-333333333333',Q4:'44444444-4444-4444-8444-444444444444',Q5:'55555555-5555-4555-8555-555555555555',Q6:'66666666-6666-4666-8666-666666666666',Q7:'77777777-7777-4777-8777-777777777777',
 A:'d0000001-0000-4000-8000-00000000000a',B:'d0000002-0000-4000-8000-00000000000b',C:'d0000003-0000-4000-8000-00000000000c',D:'d0000004-0000-4000-8000-00000000000d',E:'d0000005-0000-4000-8000-00000000000e',F:'d0000006-0000-4000-8000-00000000000f'};
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:950},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.clock.setFixedTime(new Date('2026-11-05T15:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.JourneyPath&&window.InquiryToss&&window.InquiryDetailV2&&window.DealFrame7&&window.DealSame);
  await page.evaluate(ID=>{
   const deal=(id,site,code,grp,o)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:'2026-09-01',code,stage_code:code,grp,amt:1e8,amount:1e8,activities:[],workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',workSummary:'옥상(우레탄)',version:1},o||{});
   const inq=(id,site,o)=>Object.assign({id,site,status:'배정완료',at:'2026-08-20T10:00:00+09:00',created_at:'2026-08-20T10:00:00+09:00',brand:'POUR솔루션',phone:'010-1111-2222',work_type:'옥상 방수',assignee:'이필선',assigned_to:'이필선',assigned_at:'2026-08-20T10:10:00+09:00',raw:{'문의내용':'[합성] 옥상 누수 견적 문의'}},o||{});
   B={deals:[
     deal(ID.A,'[합성] 가람아파트','consulting','영업·관리',{origin_inquiry_id:ID.Q1}),
     deal(ID.B,'[합성] 나래아파트','won','수주 성공',{origin_inquiry_id:ID.Q2,closed_at:'2026-10-02',contract_date:'2026-10-05',completion_date:'',stage_contexts:{contract:{fields:{contract_date:'2026-10-05',contract_amount:2e8,contract_document:'수령'}},construction:{fields:{start_date:'2026-10-20'}}}}),
     deal(ID.C,'[합성] 다솜아파트','lost','수주 실패',{origin_inquiry_id:ID.Q3,closed_at:'2026-10-10'}),
     deal(ID.D,'[합성] 마루아파트','consulting','영업·관리',{site_id:'site-maru'}),
     deal(ID.E,'[합성] 바다아파트','consulting','영업·관리'),
     deal(ID.F,'[합성] 사랑아파트','consulting','영업·관리',{origin_inquiry_id:ID.Q4})],
    inquiries:[
     inq(ID.Q1,'[합성] 가람아파트',{status:'견적서 발송완료',deal_id:ID.A,at:'2026-08-20T10:00:00+09:00'}),
     inq(ID.Q2,'[합성] 나래아파트',{status:'수주',deal_id:ID.B}),
     inq(ID.Q3,'[합성] 다솜아파트',{status:'실주',deal_id:ID.C}),
     inq(ID.Q4,'[합성] 사랑아파트',{status:'견적서 발송완료',deal_id:ID.F,at:'2026-08-01T10:00:00+09:00',created_at:'2026-08-01T10:00:00+09:00'}),
     inq(ID.Q5,'[합성] 사랑아파트',{status:'현장방문예정',at:'2026-09-15T10:00:00+09:00',created_at:'2026-09-15T10:00:00+09:00',raw:{'문의내용':'[합성] 같은 공사 추가 문의','기존 현장 판단':'같은 공사','기존 영업건':ID.F}}),
     inq(ID.Q6,'[합성] 마루아파트',{site_id:'site-maru',status:'현장방문예정'}),
     inq(ID.Q7,'[합성] 아라아파트',{status:'배정완료',at:'2026-11-05T09:00:00+09:00',created_at:'2026-11-05T09:00:00+09:00'}),
     inq('88888888-8888-4888-8888-888888888888','[합성] 자람아파트',{status:'배드핏',close_reason:'배드핏(부적합) · 수행불가 공종'})],activities:[],inquiryTrash:[],inquiryCleanupArchived:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   SB={rpc:async()=>({error:{message:'CONTRACT_UNAVAILABLE'}})};window.__id=ID;
   goPage('pipe');
  },ID);
  await page.waitForTimeout(300);
  const dealOpen=id=>page.evaluate(id=>{const d=B.deals.find(x=>x.id===id);G._detailPopup=true;drwDeal(JSON.stringify(d));},id);
  const cells=sel=>page.locator(sel+' .jp-row>*').evaluateAll(L=>L.map(n=>[n.querySelector('small').textContent,n.querySelector('b').textContent,n.className.replace('jp-s','').replace('jp-go','').trim(),n.tagName]));
  const curDeal=()=>page.evaluate(()=>CUR_DETAIL&&CUR_DETAIL.kind==='deal'&&document.getElementById('detailView').querySelector('.jp')?CUR_DETAIL.item.id:null);
  /* ① 판정: 칸 내용(없는 사실을 안 적는다) */
  const J=await page.evaluate(ID=>{const by=id=>B.deals.find(x=>x.id===id),q=id=>B.inquiries.find(x=>x.id===id),v=S=>S.map(s=>[s.name,s.v,s.st]);
   return {A:v(JourneyPath.ofDeal(by(ID.A))),B:v(JourneyPath.ofDeal(by(ID.B))),C:v(JourneyPath.ofDeal(by(ID.C))),D:v(JourneyPath.ofDeal(by(ID.D))),E:v(JourneyPath.ofDeal(by(ID.E))),F:v(JourneyPath.ofDeal(by(ID.F))),QA:v(JourneyPath.ofInquiry(q(ID.Q1))),QN:v(JourneyPath.ofInquiry(q(ID.Q7))),QB:v(JourneyPath.ofInquiry(B.inquiries[B.inquiries.length-1]))};},ID);
  assert.deepEqual(J.A,[['문의','2026.8.20 접수','done'],['영업','컨설팅 설계','cur'],['계약','—','todo'],['시공','—','todo']],'진행 중 영업건');
  assert.deepEqual(J.B.slice(1),[['영업','수주 2026.10.2','done'],['계약','계약 2026.10.5','done'],['시공','착공 2026.10.20','cur']],'수주 · 계약 · 착공');
  assert.deepEqual(J.C.slice(1),[['영업','실주 2026.10.10','end'],['계약','해당 없음','todo'],['시공','해당 없음','todo']],'실주는 뒤 칸이 해당 없음');
  assert.deepEqual(J.D[0],['문의','연결 기록 없음 · 같은 현장 문의 1건','todo'],'같은 현장 문의는 연결로 적지 않는다');
  assert.deepEqual(J.E[0],['문의','문의 기록 없음','todo'],'문의가 없는 영업건');
  assert.deepEqual(J.F[0],['문의','2026.8.1 접수 · 문의 2건','done'],"전환 문의 + '같은 공사'로 붙인 문의");
  assert.deepEqual(J.QA,[['문의','2026.8.20 접수','done'],['영업','컨설팅 설계','cur'],['계약','—','todo'],['시공','—','todo']],'문의에서 본 경로 = 영업건에서 본 경로');
  assert.deepEqual(J.QN.slice(0,2),[['문의','2026.11.5 접수','cur'],['영업','전환 전','todo']],'전환 전 문의');
  assert.deepEqual(J.QB[1],['영업','영업건 없음 · Bad Fit','end'],'Bad Fit 문의');
  /* ② 영업건 상세: 띠 위에 한 줄 · 기존 띠 그대로 */
  await dealOpen(ID.A);await page.waitForSelector('#detailView .jp');
  assert.deepEqual((await cells('#detailView')).map(c=>c[3]),['BUTTON','DIV','DIV','DIV'],'원래 문의 칸만 이동 단추');
  assert.equal(await page.locator('#detailView .dv8-steps').count(),1,'기존 6칸 띠는 그대로');
  assert.ok(await page.evaluate(()=>{const a=document.querySelector('#detailView .jp').getBoundingClientRect(),b=document.querySelector('#detailView .dv8-steps').getBoundingClientRect();return a.bottom<=b.top+1;}),'경로 줄이 띠 위');
  assert.ok(await page.evaluate(()=>{const a=document.querySelector('#detailView .jp').getBoundingClientRect(),m=document.querySelector('#detailView .dv7-meta').getBoundingClientRect(),x=document.querySelector('#detailView .backbtn').getBoundingClientRect();return m.bottom<=a.top+1&&x.bottom<=a.top+1;}),'경로 줄이 머리 줄을 밀지 않는다(현재 건 줄 · 닫기 단추 아래)');
  if(process.env.SHOT_DIR){await page.waitForTimeout(700);await page.screenshot({path:path.join(process.env.SHOT_DIR,'jp-deal.png')});}
  /* ③ 영업건 → 문의 → 닫으면 보던 영업건 */
  await page.locator('#detailView .jp-row [data-jp="inq"]').click();await page.waitForSelector('#inq-inbox-dialog .jp');
  assert.ok(await page.locator('#inq-inbox-dialog').isVisible(),'문의 창이 보인다');
  assert.equal(one(await page.locator('#inq-inbox-dialog #inq-dialog-title').innerText()),'[합성] 가람아파트');
  assert.equal(await page.evaluate(()=>{const n=document.elementFromPoint(innerWidth/2,innerHeight/2);return !!(n&&n.closest('#inq-inbox-dialog'));}),true,'문의 창이 맨 위');
  assert.deepEqual((await cells('#inq-inbox-dialog')).map(c=>c[3]),['DIV','BUTTON','DIV','DIV'],'문의 창에서는 영업 칸이 이동 단추');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'jp-inquiry.png')});
  await page.locator('#inq-inbox-dialog .idv3-x').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#inq-inbox-dialog').count(),0,'문의 창 닫힘');assert.equal(await curDeal(),ID.A,'보던 영업건으로 돌아온다');
  /* ③-2 다른 메뉴에서 연 영업건도 같다: 오늘 업무 · 견적문의 메뉴 위에서 열어도 문의 창이 위에 뜨고, 닫으면 영업건과 원래 메뉴로 돌아온다 */
  for(const from of ['today','inq']){
   await page.evaluate(()=>closeDetail());await page.evaluate(p=>goPage(p),from);await page.waitForTimeout(150);
   await dealOpen(ID.A);await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .jp'),ID.A);
   await page.locator('#detailView .jp-row [data-jp="inq"]').click();await page.waitForSelector('#inq-inbox-dialog .jp');
   assert.equal(await page.evaluate(()=>{const n=document.elementFromPoint(innerWidth/2,innerHeight/2);return !!(n&&n.closest('#inq-inbox-dialog'));}),true,from+': 문의 창이 맨 위');
   await page.locator('#inq-inbox-dialog .idv3-x').click();await page.waitForTimeout(300);
   assert.deepEqual([await curDeal(),await page.evaluate(()=>G.page)],[ID.A,from],from+': 닫으면 영업건 · 원래 메뉴');
  }
  /* ④ 문의 → 영업건(문의 창의 영업 칸) */
  await page.locator('#detailView .jp-row [data-jp="inq"]').click();await page.waitForSelector('#inq-inbox-dialog .jp');
  await page.locator('#inq-inbox-dialog .jp-row [data-jp="deal"]').click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#inq-inbox-dialog').count(),0);assert.equal(await curDeal(),ID.A,'문의에서 영업건으로');
  /* ⑤ 문의 2건: 칸을 누르면 고를 수 있게 펼친다 */
  await dealOpen(ID.F);await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .jp'),ID.F);
  assert.equal(await page.locator('#detailView .jp-list').isVisible(),false);
  await page.locator('#detailView .jp-row [data-jp="list"]').click();
  assert.deepEqual((await page.locator('#detailView .jp-list button').allInnerTexts()).map(one).map(s=>s.split(' · ')[0]),['2026.8.1 접수','2026.9.15 접수'],'문의 2건 접수순');
  await page.locator('#detailView .jp-list button').nth(1).click();await page.waitForSelector('#inq-inbox-dialog .jp');
  assert.match(await page.evaluate(()=>document.querySelector('#inq-inbox-dialog').innerText),/같은 공사 추가 문의/,'고른 문의가 열린다');
  await page.locator('#inq-inbox-dialog .idv3-x').click();await page.waitForTimeout(300);assert.equal(await curDeal(),ID.F);
  /* ⑥ 같은 현장 후보 · 문의 없음 */
  await dealOpen(ID.E);await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .jp'),ID.E);
  assert.deepEqual((await cells('#detailView'))[0].slice(0,2).concat((await cells('#detailView'))[0][3]),['문의','문의 기록 없음','DIV'],'문의가 없으면 이동 단추도 없다');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(100);
  /* ⑦ 견적문의 목록: 넘어간 문의 찾기 · 진행 중 숫자 그대로 */
  await page.evaluate(()=>{G.inqToss=null;goPage('inq');});await page.waitForSelector('#inq-toss .tq-row');
  const before=await page.evaluate(()=>[InquiryToss.compute().all.length,document.querySelector('#inq-toss .tq-lead').textContent]);
  const chip=page.locator('#inq-toss [data-tq="handed"]');assert.equal(one(await chip.innerText()),'영업건으로 넘어간 문의 4');
  await chip.click();await page.waitForSelector('#inq-toss .tq-gt');
  assert.equal(one(await page.locator('#inq-toss .tq-gt').innerText()),'영업건으로 넘어간 문의4');
  assert.deepEqual((await page.locator('#inq-toss .tq-nm').allInnerTexts()).sort(),['[합성] 가람아파트','[합성] 나래아파트','[합성] 다솜아파트','[합성] 사랑아파트'],'종결 상태로 바뀐 전환 문의(수주 · 실주)도 찾을 수 있다');
  assert.deepEqual(await page.evaluate(()=>[InquiryToss.compute().all.length,document.querySelector('#inq-toss .tq-lead').textContent]),before,'진행 중 숫자는 그대로');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'jp-handed.png')});
  const rowA=page.locator('#inq-toss .tq-row',{hasText:'가람아파트'});assert.match(one(await rowA.locator('.tq-ds').innerText()),/컨설팅 설계$/,'줄에 지금 영업 단계');
  await rowA.locator('.tq-ds').click();await page.waitForSelector('#inq-inbox-dialog .jp');await page.locator('#inq-inbox-dialog .idv3-x').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>!!(CUR_DETAIL&&CUR_DETAIL.kind==='deal'&&document.getElementById('detailView').classList.contains('on'))),false,'목록에서 연 문의를 닫으면 목록으로');
  await page.locator('#inq-toss .tq-row',{hasText:'나래아파트'}).locator('[data-tq="deal"]').click();await page.waitForTimeout(400);assert.equal(await curDeal(),ID.B,'[영업건 보기]');
  /* ⑧ 좁은 폭: 가로 넘침 없음 */
  await page.setViewportSize({width:375,height:800});await page.waitForTimeout(300);
  const nar=await page.evaluate(()=>{const j=document.querySelector('#detailView .jp-row');return {cols:getComputedStyle(j).gridTemplateColumns.split(' ').length,over:j.scrollWidth>j.clientWidth+1,clip:[...j.querySelectorAll('b')].filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent)};});
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'jp-narrow.png')});
  assert.equal(nar.cols,2,'375px = 두 칸씩');assert.equal(nar.over,false,'가로 넘침 없음');assert.deepEqual(nar.clip,[],'칸 글자 잘림 없음');
  await page.setViewportSize({width:1440,height:950});
  /* ⑨ 끄면 예전처럼 */
  await page.evaluate(()=>{G.journeyPathOff=true;});await dealOpen(ID.A);await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .dv8-steps'),ID.A);
  assert.equal(await page.locator('#detailView .jp').count(),0,'끄면 경로 줄 없음');assert.equal(await page.locator('#detailView .dv8-steps').count(),1);
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',cells:true,site_candidate_marked:true,deal_to_inquiry_and_back:true,inquiry_to_deal:true,multi_inquiry:true,handed_list:true,counts_unchanged:true,narrow:true,off_switch:true,no_errors:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
