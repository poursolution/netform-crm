'use strict';
/* 문의 → 영업 → 계약 → 시공 경로 한 줄 · 영업건 ↔ 문의 이동 · 넘어간 문의 찾기 (2026-11-05)
   합성 자료(현장 · 이름은 지어낸 것). 확인: 칸 내용(없는 사실을 안 적는지) / 연결 기록과 같은 현장 후보 구분 / 실제 클릭 이동과 되돌아오기 / 진행 중 숫자 그대로 / 375px 넘침 / 끄면 예전처럼 / 화면 오류 없음 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
const ID={Q1:'11111111-1111-4111-8111-111111111111',Q2:'22222222-2222-4222-8222-222222222222',Q3:'33333333-3333-4333-8333-333333333333',Q4:'44444444-4444-4444-8444-444444444444',Q5:'55555555-5555-4555-8555-555555555555',Q6:'66666666-6666-4666-8666-666666666666',Q7:'77777777-7777-4777-8777-777777777777',
 QS:'aaaa0000-1111-4111-8111-111111111111',QV:'bbbb0000-1111-4111-8111-111111111111',Q8:'88888888-1111-4111-8111-111111111111',Q9:'99999999-1111-4111-8111-111111111111',G:'d0000007-0000-4000-8000-000000000007',H:'d0000008-0000-4000-8000-000000000008',
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
     deal(ID.F,'[합성] 사랑아파트','consulting','영업·관리',{origin_inquiry_id:ID.Q4}),
     deal(ID.G,'[합성] 차오름아파트','consulting','영업·관리',{origin_inquiry_id:ID.Q8}),
     deal(ID.H,'[합성] 하늘아파트','consulting','영업·관리',{origin_inquiry_id:ID.Q9,activities:[{id:'h1',type:'전화',note:'통화 완료 · 연결됨 · 견적 검토 중',at:'2026-09-01T12:00:00+09:00'}]})],
    inquiries:[
     inq(ID.Q1,'[합성] 가람아파트',{status:'견적서 발송완료',deal_id:ID.A,at:'2026-08-20T10:00:00+09:00'}),
     inq(ID.Q2,'[합성] 나래아파트',{status:'수주',deal_id:ID.B}),
     inq(ID.Q3,'[합성] 다솜아파트',{status:'실주',deal_id:ID.C}),
     inq(ID.Q4,'[합성] 사랑아파트',{status:'견적서 발송완료',deal_id:ID.F,at:'2026-08-01T10:00:00+09:00',created_at:'2026-08-01T10:00:00+09:00'}),
     inq(ID.Q5,'[합성] 사랑아파트',{status:'현장방문예정',at:'2026-09-15T10:00:00+09:00',created_at:'2026-09-15T10:00:00+09:00',raw:{'문의내용':'[합성] 같은 공사 추가 문의','기존 현장 판단':'같은 공사','기존 영업건':ID.F}}),
     inq(ID.Q6,'[합성] 마루아파트',{site_id:'site-maru',status:'현장방문예정'}),
     inq(ID.Q7,'[합성] 아라아파트',{status:'배정완료',at:'2026-11-05T09:00:00+09:00',created_at:'2026-11-05T09:00:00+09:00'}),
     inq(ID.QS,'[합성] 타래아파트',{status:'견적서 발송완료'}),
     inq(ID.QV,'[합성] 파랑아파트',{status:'현장방문 완료'}),
     inq(ID.Q8,'[합성] 차오름아파트',{status:'현장방문 완료',deal_id:ID.G}),
     inq(ID.Q9,'[합성] 하늘아파트',{status:'견적서 발송완료',deal_id:ID.H}),
     inq('88888888-8888-4888-8888-888888888888','[합성] 자람아파트',{status:'배드핏',close_reason:'배드핏(부적합) · 수행불가 공종'})],activities:[],inquiryTrash:[],inquiryCleanupArchived:[]};
   LOCAL={deals:{},inquiries:{[inqKey(B.inquiries[0])]:{quoteSentAt:'2026-08-25',quoteVersions:[{version_no:2,amount:15e7,sent_at:'2026-08-25'}]},[inqKey(B.inquiries.find(q=>q.id===ID.Q8))]:{visitDoneAt:'2026-08-28'},[inqKey(B.inquiries.find(q=>q.id===ID.Q9))]:{quoteSentAt:'2026-08-25'}}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
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
  /* ①-2 문의에서 이어받기(3번): 문의 때 한 일을 다시 시키지 않는다 · 금액은 읽기만 · 미팅 완료 판정(KPI)과 기한은 그대로 */
  const T=await page.evaluate(ID=>{const by=id=>B.deals.find(x=>x.id===id),t=id=>{const d=by(id),s=DealFrame7.stageTask(d),a=DealFrame7.amounts(d)[0],b=PipelineJudge.basis(d);return {text:s.text,short:s.short,btn:s.btn,sit:s.sit,amt:a&&[a.k,a.v],why:b.why,kind:b.kind,met:PipelineJudge.meetingOf(d),quotes:(d.quote_versions||[]).length};};return {A:t(ID.A),G:t(ID.G),H:t(ID.H),E:t(ID.E)};},ID);
  assert.deepEqual([T.A.text,T.A.short,T.A.btn[0],T.A.sit],['보낸 견적 고객 반응 확인','문의 때 견적 발송','결과 기록','견적문의에서 견적 발송 8.25 · 1.5억 (V2)'],'견적을 보낸 건 = 미팅 확인 · 견적 요청을 다시 시키지 않음');
  assert.deepEqual(T.A.amt,['문의 때 견적','1.5억 (V2)'],'문의 때 금액 표시');assert.equal(T.A.quotes,0,'영업건 견적 버전으로 옮기지 않음');
  assert.deepEqual([T.A.why,T.A.kind,T.A.met],['문의 때 견적 발송 8.25 · 고객 반응 확인','none',''],'기한을 새로 만들지 않음 · 미팅 완료 판정 그대로');
  assert.deepEqual([T.G.text,T.G.short,T.G.btn[0],T.G.sit,T.G.met],['견적 요청 등록','문의 때 방문 완료 · 견적 요청 전','견적 요청 등록','견적문의에서 현장방문 완료 8.28 · 견적 요청 전',''],'방문 완료 건 = 다음 일은 견적 요청');
  assert.deepEqual([T.H.text,T.H.btn],['고객 반응을 보고 단계 정하기',['단계 바꾸기','stage']],'발송 뒤 연결 기록이 있으면 단계 판단');
  assert.match(T.E.text,/미팅/,'문의 없는 영업건은 예전과 같음');assert.ok(!T.E.amt||T.E.amt[0]!=='문의 때 견적');
  /* ② 영업건 상세: 띠 위에 한 줄 · 기존 띠 그대로 */
  await dealOpen(ID.A);await page.waitForSelector('#detailView .jp');
  assert.deepEqual((await cells('#detailView')).map(c=>c[3]),['BUTTON','DIV','DIV','DIV'],'원래 문의 칸만 이동 단추');
  assert.equal(await page.locator('#detailView .dv8-steps').count(),1,'기존 6칸 띠는 그대로');
  assert.ok(await page.evaluate(()=>{const a=document.querySelector('#detailView .jp').getBoundingClientRect(),b=document.querySelector('#detailView .dv8-steps').getBoundingClientRect();return a.bottom<=b.top+1;}),'경로 줄이 띠 위');
  assert.ok(await page.evaluate(()=>{const a=document.querySelector('#detailView .jp').getBoundingClientRect(),m=document.querySelector('#detailView .dv7-meta').getBoundingClientRect(),x=document.querySelector('#detailView .backbtn').getBoundingClientRect();return m.bottom<=a.top+1&&x.bottom<=a.top+1;}),'경로 줄이 머리 줄을 밀지 않는다(현재 건 줄 · 닫기 단추 아래)');
  if(process.env.SHOT_DIR){await page.waitForTimeout(700);await page.screenshot({path:path.join(process.env.SHOT_DIR,'jp-deal.png')});}
  const headA=one(await page.locator('#detailView .dv3-subrow').innerText()),bodyA=one(await page.locator('#detailView').innerText());
  assert.match(headA,/문의 때 견적 1\.5억 \(V2\)/,'머리 줄에 문의 때 금액');assert.match(bodyA,/보낸 견적 고객 반응 확인/);assert.doesNotMatch(bodyA,/미팅 진행 여부가 확인되지 않음|미팅 후 \d+일 기준|판정 불가/,'미팅 확인을 시키지 않음 · 판정 불가로 적지 않음');assert.match(bodyA,/다음 업무를 등록하면 정해짐/);
  assert.equal(one(await page.locator('#detailView .dv8-req .hd b').first().innerText()),'고객 요청','연결된 문의 = 고객 요청');
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
  await dealOpen(ID.D);await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .dv8-req'),ID.D);
  assert.equal(one(await page.locator('#detailView .dv8-req .hd b').first().innerText()),'같은 현장 문의 · 연결 기록 없음','같은 현장 문의를 이 건의 고객 요청이라고 쓰지 않음');
  await page.evaluate(id=>{const d=B.deals.find(x=>x.id===id);d.site_id='site-two';delete d.cleanup_site_id;const mk=(q,o)=>Object.assign({id:q,site:'[합성] 마루아파트',status:'현장방문예정',at:'2026-09-20T10:00:00+09:00',created_at:'2026-09-20T10:00:00+09:00',brand:'POUR솔루션',work_type:'옥상 방수',assignee:'이필선',site_id:'site-two',raw:{'문의내용':'[합성] 같은 현장 다른 문의'}},o||{});B.inquiries.push(mk('aaaaaaaa-1111-4111-8111-111111111111',{deal_id:window.__id.A}),mk('bbbbbbbb-1111-4111-8111-111111111111'),mk('cccccccc-1111-4111-8111-111111111111'));G._detailPopup=true;drwDeal(JSON.stringify(d));},ID.D);await page.waitForTimeout(300);
  assert.equal(await page.locator('#detailView .dv8-req').count(),0,'같은 현장 후보가 여럿이면 고객 요청 줄에 하나를 고르지 않음');
  assert.deepEqual((await cells('#detailView'))[0].slice(0,2),['문의','연결 기록 없음 · 같은 현장 문의 2건'],'다른 영업건에 연결된 문의는 후보에서 뺀다');
  await page.evaluate(()=>{B.inquiries.splice(-3);B.inquiries=B.inquiries.slice();});
  await dealOpen(ID.E);await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .jp'),ID.E);
  assert.deepEqual((await cells('#detailView'))[0].slice(0,2).concat((await cells('#detailView'))[0][3]),['문의','문의 기록 없음','DIV'],'문의가 없으면 이동 단추도 없다');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(100);
  /* ⑦ 견적문의 목록: 넘어간 문의 찾기 · 진행 중 숫자 그대로 */
  await page.evaluate(()=>{G.inqToss=null;goPage('inq');});await page.waitForSelector('#inq-toss .tq-row');
  const before=await page.evaluate(()=>[InquiryToss.compute().all.length,document.querySelector('#inq-toss .tq-lead').textContent]);
  const chip=page.locator('#inq-toss [data-tq="handed"]');assert.equal(one(await chip.innerText()),'영업건으로 넘어간 문의 6');
  await chip.click();await page.waitForSelector('#inq-toss .tq-gt');
  assert.equal(one(await page.locator('#inq-toss .tq-gt').innerText()),'영업건으로 넘어간 문의6');
  assert.deepEqual((await page.locator('#inq-toss .tq-nm').allInnerTexts()).sort(),['[합성] 가람아파트','[합성] 나래아파트','[합성] 다솜아파트','[합성] 사랑아파트','[합성] 차오름아파트','[합성] 하늘아파트'],'종결 상태로 바뀐 전환 문의(수주 · 실주)도 찾을 수 있다');
  assert.deepEqual(await page.evaluate(()=>[InquiryToss.compute().all.length,document.querySelector('#inq-toss .tq-lead').textContent]),before,'진행 중 숫자는 그대로');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'jp-handed.png')});
  const rowA=page.locator('#inq-toss .tq-row',{hasText:'가람아파트'});assert.match(one(await rowA.locator('.tq-ds').innerText()),/컨설팅 설계$/,'줄에 지금 영업 단계');
  await rowA.locator('.tq-ds').click();await page.waitForSelector('#inq-inbox-dialog .jp');await page.locator('#inq-inbox-dialog .idv3-x').click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>!!(CUR_DETAIL&&CUR_DETAIL.kind==='deal'&&document.getElementById('detailView').classList.contains('on'))),false,'목록에서 연 문의를 닫으면 목록으로');
  await page.locator('#inq-toss .tq-row',{hasText:'나래아파트'}).locator('[data-tq="deal"]').click();await page.waitForTimeout(400);assert.equal(await curDeal(),ID.B,'[영업건 보기]');
  /* ⑦-2 넘어가는 기준 하나(4번): 안내 문구 = 실제 판정 · 전환 대기 = 견적 발송 완료만 · 방문 완료는 04에 머문다 */
  await page.evaluate(()=>{G.inqToss=null;goPage('inq');});await page.waitForSelector('#inq-toss .tq-stg');
  assert.deepEqual((await page.locator('#inq-toss .tq-stg small').allInnerTexts()).map(one),['담당을 정하면 다음 단계','실제 연결되면 다음 단계','방문 · 견적 잡히면 다음 단계','견적 보내면 영업건으로'],'단계 안내 = 실제 조건');
  assert.deepEqual(await page.locator('#inq-toss .tq-stg small').evaluateAll(l=>l.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent)),[],'단계 안내 글 잘림 없음');
  const R=await page.evaluate(ID=>{const q=id=>B.inquiries.find(x=>x.id===id),QS=q(ID.QS),QV=q(ID.QV);return {waitS:isAwaitingPromotion(QS),waitV:isAwaitingPromotion(QV),qualV:InquiryFlow.isQualified(QV),cands:InquiryConversion.candidates().map(x=>x.q.site)};},ID);
  assert.deepEqual([R.waitS,R.waitV,R.qualV],[true,false,true],'전환 대기 = 견적 발송 완료만 · 서버 전환 자격은 그대로');
  assert.deepEqual(R.cands,['[합성] 타래아파트'],'전환 대기 목록에 방문 완료 건 없음');
  /* ⑦-3 견적을 보냈는데 영업건이 없는 건: 이유 + 다시 넘기기 */
  await page.evaluate(id=>{InquiryWorkbench.open(inqKey(B.inquiries.find(x=>x.id===id)));},ID.QS);await page.waitForSelector('#inq-inbox-dialog .idv3-stuck');
  const stuck=page.locator('#inq-inbox-dialog .idv3-stuck');
  assert.equal(one(await stuck.locator('.lb').innerText()),'영업건으로 넘어가지 않았습니다');assert.match(one(await stuck.locator('p').innerText()),/견적 발송은 저장됐지만 영업건이 아직 없습니다/);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'jr-stuck.png')});
  await page.evaluate(()=>{window.__ap=window.autoPromote;window.autoPromote=()=>{throw Error('[합성] 서버 거절');};});
  await stuck.locator('[data-idv="promote"]').click();await page.waitForTimeout(150);
  assert.match(one(await page.locator('#inq-inbox-dialog .idv3-stuck .idv-err').innerText()),/파이프라인 전환은 하지 못했습니다 — \[합성\] 서버 거절/,'실패하면 이유가 카드에 남는다');
  await page.evaluate(id=>{window.autoPromote=q=>{q.deal_id=id;return '';};},ID.A);
  await page.locator('#inq-inbox-dialog [data-idv="promote"]').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#inq-inbox-dialog .idv3-stuck').count(),0,'넘어가면 카드가 사라진다');assert.match(one(await page.locator('#inq-inbox-dialog').innerText()),/파이프라인 전환 완료/);
  await page.locator('#inq-inbox-dialog .idv3-x').click();await page.waitForTimeout(150);
  await page.evaluate(id=>{window.autoPromote=window.__ap;const q=B.inquiries.find(x=>x.id===id);delete q.deal_id;},ID.QS);
  await page.evaluate(id=>{InquiryWorkbench.open(inqKey(B.inquiries.find(x=>x.id===id)));},ID.QV);await page.waitForSelector('#inq-inbox-dialog .idv3-next');
  assert.equal(await page.locator('#inq-inbox-dialog .idv3-stuck').count(),0,'방문 완료 건은 막힌 건이 아니다');await page.locator('#inq-inbox-dialog .idv3-x').click();await page.waitForTimeout(150);
  /* ⑦-4 계약 원장 근거 → 그 영업건(5번): 원장 행에 영업건 번호가 있으면 [열기] · 지금 기간 밖이어도 연다 */
  const L=await page.evaluate(ID=>{const d=B.deals.find(x=>x.id===ID.B);ContractSalesData.state=()=>({status:'ready',items:[{deal_id:dealKey(d),brand:'POUR솔루션',sales_owner_name:'이필선',events:[{kind:'signed',effective_date:'2026-10-05',amount_delta:2e8,sales_owner_name:'이필선'}]},{deal_id:'not-in-crm',brand:'POUR솔루션',site_name:'[합성] 원장만 있는 현장',events:[{kind:'signed',effective_date:'2026-10-06',amount_delta:1e8,sales_owner_name:'이필선'}]}]});
   const rows=SalesInsights.contractEvidence({});return rows.map(r=>[r.site,r.key]);},ID);
  assert.deepEqual(L.map(x=>[x[0],!!x[1]]),[['[합성] 원장만 있는 현장',false],['[합성] 나래아파트',true]],'영업건이 있는 원장 행만 [열기]');
  await page.evaluate(k=>{closeDetail();SalesInsights.openRecord(k);},L.find(x=>x[1])[1]);
  await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .jp'),ID.B);
  assert.deepEqual(await page.evaluate(id=>DealFrame7.steps(B.deals.find(x=>x.id===id)).map(s=>[s.key,s.st,s.ev]).slice(4),ID.B),[['construction','done','계약 10.5'],['won','cur','2026.10.2']],'수주 건: 계약 근거가 있으면 계약 · 시공 칸은 지나옴');
  assert.deepEqual(await page.evaluate(id=>DealFrame7.steps(B.deals.find(x=>x.id===id)).map(s=>s.st).slice(0,4),ID.B),['todo','todo','todo','todo'],'기록 없는 앞 단계는 지나옴으로 그리지 않음');
  await page.waitForTimeout(300);
  /* ⑧ 좁은 폭: 가로 넘침 없음 */
  await page.setViewportSize({width:375,height:800});await page.waitForTimeout(300);
  const nar=await page.evaluate(()=>{const j=document.querySelector('#detailView .jp-row');return {cols:getComputedStyle(j).gridTemplateColumns.split(' ').length,over:j.scrollWidth>j.clientWidth+1,clip:[...j.querySelectorAll('b')].filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.textContent)};});
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'jp-narrow.png')});
  assert.equal(nar.cols,2,'375px = 두 칸씩');assert.equal(nar.over,false,'가로 넘침 없음');assert.deepEqual(nar.clip,[],'칸 글자 잘림 없음');
  await page.setViewportSize({width:1440,height:950});
  /* ⑨ 끄면 예전처럼 */
  await page.evaluate(()=>{G.journeyPathOff=true;});await dealOpen(ID.A);await page.waitForFunction(id=>CUR_DETAIL&&CUR_DETAIL.item.id===id&&document.querySelector('#detailView .dv8-steps'),ID.A);
  assert.equal(await page.locator('#detailView .jp').count(),0,'끄면 경로 줄 없음');assert.equal(await page.locator('#detailView .dv8-steps').count(),1);
  assert.match(await page.evaluate(id=>DealFrame7.stageTask(B.deals.find(x=>x.id===id)).text,ID.A),/미팅/,'끄면 할 일도 예전과 같음');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',cells:true,site_candidate_marked:true,deal_to_inquiry_and_back:true,inquiry_to_deal:true,multi_inquiry:true,handed_list:true,counts_unchanged:true,narrow:true,off_switch:true,no_errors:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
