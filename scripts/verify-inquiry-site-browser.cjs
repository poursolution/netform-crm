'use strict';
/* 견적문의 · 이 단지 영업 이력 + 근처에서 영업했던 현장 (2026-10-05 design_handoff_inquiry_site · 시안 '견적문의 상세 · 단지 이력.dc.html')
   합성 자료(이름 · 현장은 지어낸 것): 작년에 옥상 방수를 실주한 단지가 다른 공종으로 다시 문의 + 지난 영업이 없는 단지의 문의 + 같은 지역의 다른 현장들.
   확인: 목록 줄 꼬리표 / 상세 왼쪽 단지 영업 이력(실주 4가지 · 조언 한 줄 · 순서 · 채울 정보 접힘) / 가운데 [이 문의 | 단지 전체] / 오른쪽 첫마디 · 기존 건과 관계 · 근처 현장 / 끄면 예전처럼 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.clock.setFixedTime(new Date('2026-10-05T15:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquirySite&&window.InquiryDetailV2&&window.InquiryWorkbench&&window.InquiryListV3);
  await page.evaluate(()=>{
   const A='22222222-2222-4222-8222-222222222222',N='33333333-3333-4333-8333-333333333333',SITE='[경기 화성] 한빛마을2차아파트',ADDR='경기도 화성시 동탄청계로 303-13';
   const deal=(id,site,code,owner,o)=>Object.assign({id,site,address:'경기도 화성시 동탄대로 '+id.slice(-2),assignee:owner,brand:'석민이앤씨',created:'2025-04-01',code,stage_code:code,amt:1e8,amount:1e8,activities:[],workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',workSummary:'옥상(우레탄)'},o);
   B={deals:[
     deal('d0000001-0000-4000-8000-000000000a12',SITE,'lost','이필선',{site_id:'site-1',address:ADDR,grp:'수주 실패',closed_at:'2025-08-21',amount:1.5e8,amt:1.5e8,manager_name:'박영호',
      stage_contexts:{lost:{fields:{close_reason:'가격 열세',close_detail:'경쟁사 8% 낮음',competitor:'A건설'}}},quote_versions:[{version_no:1,amount:1.6e8,created_at:'2025-05-10'},{version_no:2,amount:1.5e8,created_at:'2025-07-02'}],
      activities:[{id:'x1',type:'방문',note:'1차 현장미팅 · 옥상 누수 3세대',at:'2025-04-10T02:00:00Z',actor:'이필선'},{id:'x2',type:'견적',note:'견적 V2 1.5억 발송 · 범위 축소',at:'2025-07-02T02:00:00Z',actor:'이필선'}]}),
     deal('d0000002-0000-4000-8000-000000000b34','[경기 화성] 동탄새빛캐슬','won','이필선',{grp:'수주 성공',closed_at:'2025-06-10',contract_date:'2025-06-10',won_amount:2.1e8}),
     deal('d0000003-0000-4000-8000-000000000c56','[경기 화성] 동탄푸른교회','sent','황윤선',{amount:6e6,amt:6e6,created:'2026-08-01'}),
     deal('d0000004-0000-4000-8000-000000000d78','[경기 화성] 동탄파크뷰','lost','한준엽',{grp:'수주 실패',closed_at:'2025-03-15',amount:8.6e7,amt:8.6e7,stage_contexts:{lost:{fields:{close_reason:'가격 열세'}}}}),
     deal('d0000005-0000-4000-8000-000000000e90','[서울 강남] 다른지역타워','sent','이필선',{address:'서울시 강남구 테헤란로 1'})],
    inquiries:[
     {id:A,site:SITE,site_id:'site-1',address:ADDR,status:'현장방문예정',at:'2026-01-13T15:18:00+09:00',created_at:'2026-01-13T15:18:00+09:00',brand:'석민이앤씨',phone:'031-378-5034',contact_name:'',work_type:'도로 보수',assignee:'이필선',assigned_to:'이필선',assigned_at:'2026-01-13T15:30:00+09:00',responded_at:'2026-01-13T19:01:00+09:00',raw:{'문의내용':'보도블럭 교체, 잔디블럭 교체, 계단보수공사','상담채널':'전화','공사유형':'도로 보수','건물주소':ADDR,'응대내용':'내일 연락 예정'}},
     {id:N,site:'[경기 용인] 새로운마을',address:'경기도 용인시 기흥구 새로 1',status:'배정완료',at:'2026-10-04T10:00:00+09:00',created_at:'2026-10-04T10:00:00+09:00',brand:'POUR솔루션',phone:'010-1111-2222',work_type:'옥상 방수',assignee:'이필선',assigned_to:'이필선',assigned_at:'2026-10-04T10:10:00+09:00',raw:{'문의내용':'옥상 방수 견적 문의','건물주소':'경기도 용인시 기흥구 새로 1'}}],activities:[],inquiryTrash:[],inquiryCleanupArchived:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   SB={rpc:async()=>({error:{message:'CONTRACT_UNAVAILABLE'}})};window.A=A;window.N=N;goPage('inq');
  });
  await page.waitForTimeout(400);
  /* 판정: 같은 단지의 영업건을 모든 상태로 읽는다 → 꼬리표 */
  const J=await page.evaluate(()=>{const qa=B.inquiries.find(x=>x.id===A),qn=B.inquiries.find(x=>x.id===N),S=InquirySite.summary(qa);
   return {kinds:S.D.map(x=>x.k),badge:InquirySite.badge(qa),none:InquirySite.badge(qn),facts:InquirySite.lostFacts(S.lost[0].d),clue:InquirySite.openerClue(qa),clueNone:InquirySite.openerClue(qn),near:InquirySite.nearList(qa).list.map(x=>[x.k,String(x.d.site).replace(/^\[[^\]]*\]\s*/,'')]),region:InquirySite.nearList(qa).region};});
  assert.deepEqual(J.kinds,['lost']);assert.deepEqual([J.badge.k,J.badge.text],['lost','이 단지 실주 1 · 2025 옥상']);assert.equal(J.none,null);
  assert.deepEqual([J.facts.why,J.facts.win,J.facts.q,J.facts.mgr],['가격 · 경쟁사 8% 낮음','A건설','V2 1.5억 (2025.7.2)','박영호'],'실주 사유 = 4분류 + 확인한 내용');
  assert.equal(J.clue,'작년 옥상 건 이후 다시 연락 주셔서 감사합니다.');assert.equal(J.clueNone,'');
  assert.deepEqual(J.near,[['won','동탄새빛캐슬'],['open','동탄푸른교회'],['lost','동탄파크뷰']],'같은 지역 현장: 수주 → 진행 → 실주 · 같은 단지와 다른 지역은 뺀다');
  /* 목록 줄: 현장명 아래 둘째 줄 앞 꼬리표(빨강) — 예전 '기존 현장 · n건'은 없다 */
  const row=await page.evaluate(()=>{const b=document.querySelector('.il-site i.il-sb');return b?[b.className,b.textContent,getComputedStyle(b).color,!!b.closest('.il-site').querySelector('b u'),b.parentElement.tagName]:null;});
  assert.deepEqual(row,['il-sb lost','이 단지 실주 1 · 2025 옥상','rgb(180, 35, 24)',false,'SPAN']);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'inqsite-list.png')});
  /* 상세 창 */
  await page.evaluate(()=>InquiryWorkbench.open(A));await page.waitForSelector('#inq-inbox-dialog.idv3 .isd-hist');
  const d=page.locator('#inq-inbox-dialog');
  /* 왼쪽 순서: 고객이 남긴 말 → 이 단지 영업 이력 → 문의 정보 → 채울 정보(접힘) */
  assert.deepEqual(await d.locator('.idv3-c1').evaluate(n=>[...n.children].map(c=>c.classList.contains('isd-hist')?'hist':c.classList.contains('idv3-need')?'need':c.classList.contains('idv3-fs')?'info':'quote')),['quote','hist','info','need']);
  const H=d.locator('.isd-hist');
  assert.equal(one(await H.locator('header').innerText()),'이 단지 영업 이력 2건');assert.equal(one(await H.locator('.isd-sum').innerText()),'누적 수주 없음 · 실주 1건 · 지금 문의 1건');
  assert.equal(one(await H.locator('.isd-card.lost .t').innerText()),'옥상(우레탄) 실주 열기');assert.equal(one(await H.locator('.isd-card.lost .m').innerText()),'2025.4 – 2025.8 · 이필선 · 석민이앤씨 · #000a12');
  assert.deepEqual((await H.locator('.isd-card.lost dl > *').allInnerTexts()).map(one),['실주 사유','가격 · 경쟁사 8% 낮음','낙찰사','A건설','견적','V2 1.5억 (2025.7.2)','그때 소장','박영호']);
  assert.deepEqual(await H.locator('.isd-card.lost dd.r').evaluate(n=>[getComputedStyle(n).color,getComputedStyle(n.closest('.isd-card')).borderTopColor]),['rgb(180, 35, 24)','rgb(243, 201, 199)']);
  assert.match(one(await H.locator('.isd-card.now').innerText()),/^옥상\(도로 보수\) 지금 문의 2026\.1\.13 접수 · 이필선 · 석민이앤씨$/);
  assert.match(one(await H.locator('.isd-ai').innerText()),/^AI ?2025년 옥상\(우레탄\) 건은 가격 사유로 실주했습니다\(경쟁사 A건설\)\. 이번 문의가 같은 공종이면 실주 건을 다시 열어 이력을 이어 가고, 다른 공종이면 새 공사로 보되/);
  assert.deepEqual([await d.locator('.idv3-need.fold').count(),await d.locator('.idv3-need .idv3-row').count(),one(await d.locator('.idv3-need [data-idv="need-toggle"]').innerText())],[1,0,'펼치기']);
  await d.locator('.idv3-need [data-idv="need-toggle"]').click();await page.waitForTimeout(150);assert.ok(await d.locator('.idv3-need .idv3-row').count()>=5,'펼치면 채울 정보 줄');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'inqsite-detail.png')});
  /* 가운데: [이 문의 | 단지 전체] */
  assert.deepEqual((await d.locator('.isd-scope [role="tab"]').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-selected')]))),[['이 문의','true'],['단지 전체','false']]);
  assert.equal(await d.locator('.idv3-ev.st').count(),0);
  await d.locator('.isd-scope [data-v="all"]').click();await page.waitForTimeout(150);
  const ev=await d.locator('.idv3-ev.st').evaluateAll(l=>l.map(n=>[n.querySelector('.isd-tag').textContent,n.querySelector('.t').textContent,n.querySelector('.t').classList.contains('r')]));
  assert.deepEqual(ev.map(e=>e[0]),['2025 옥상','2025 옥상','2025 옥상']);assert.deepEqual(ev.find(e=>e[2]).slice(1),['실주 처리 · 가격 · 경쟁사 8% 낮음 · 경쟁사 A건설',true]);assert.ok(ev.some(e=>/1차 현장미팅 · 옥상 누수 3세대/.test(e[1])));
  assert.match(one(await d.locator('.idv3-chead > span').innerText()),/^\d+건 · 시도 \d+ · 연결 \d+$/);
  await d.locator('.isd-scope [data-v="now"]').click();await page.waitForTimeout(150);assert.equal(await d.locator('.idv3-ev.st').count(),0);
  /* 오른쪽: 첫마디에 지난 이력 · 기존 건과 관계 · 근처에서 영업했던 현장(지도는 준비 중 — 사실대로 적는다) */
  assert.match(one(await d.locator('.idv3-opener').innerText()),/^첫마디 ?"안녕하세요, 넷폼 이필선입니다\. 작년 옥상 건 이후 다시 연락 주셔서 감사합니다\. 이번 옥상\(도로 보수\) 건으로 연락드렸습니다\. 지금 통화 괜찮으실까요\?"/);
  assert.deepEqual(await d.locator('.isd-rel .two button').evaluateAll(l=>l.map(b=>[b.textContent,b.disabled])),[['새 공사로 진행',true],['실주 건 다시 열기',true]],'서버 확인 전에는 잠금');
  assert.equal(await page.evaluate(()=>{const t=window.TOKEN;try{TOKEN='t';return InquirySite.reopenReady();}finally{try{TOKEN=t;}catch(e){}}}),false,'다시 열기 명령이 서버에 생기기 전에는 로그인돼 있어도 잠금');
  assert.equal(one(await d.locator('.isd-rel small').innerText()),'공종이 다르면 새 공사 · 같은 공종이면 실주 건을 다시 열어 이력을 이어 갑니다');
  const NR=d.locator('.isd-near');
  assert.match(one(await NR.locator('header').innerText()),/^근처에서 영업했던 현장 3곳 · .*화성.* 담당 변경$/);
  assert.deepEqual(await NR.locator('.seg button').evaluateAll(l=>l.map(b=>[b.textContent,b.disabled])),[['1km',true],['3km',true],['5km',true]]);
  assert.match(one(await NR.locator('.isd-map').innerText()),/^지도 준비 중 카카오맵 키 등록과 현장 좌표 저장이 끝나면 여기에 지도 · 반경 · 거리가 표시됩니다\./);
  assert.deepEqual((await NR.locator('.isd-nrow').allInnerTexts()).map(one),['동탄새빛캐슬 수주 2025.6 · 옥상 · 이필선 · 2.1억','동탄푸른교회 03. 자료 발송완료 · 황윤선 · 600만','동탄파크뷰 실주 2025.3 · 가격 · 한준엽 · 8,600만']);
  assert.equal(await d.locator('.idv3-bottom').count(),0,'접혀 있던 예전 근처 현장 줄은 없다');
  /* 지난 영업이 없는 단지: 이력 한 줄만 · 범위 전환 · 관계 버튼 없음 */
  await page.evaluate(()=>{InquiryWorkbench.close();InquiryWorkbench.open(N);});await page.waitForSelector('#inq-inbox-dialog.idv3 .isd-hist');
  assert.equal(one(await d.locator('.isd-sum').innerText()),'지난 영업 기록이 없습니다 · 지금 문의 1건');
  assert.deepEqual([await d.locator('.isd-scope').count(),await d.locator('.isd-rel').count(),await d.locator('.isd-card').count()],[0,0,1]);
  assert.match(one(await d.locator('.idv3-opener').innerText()),/문의 주신 옥상\(옥상 방수\) 건으로 연락드렸습니다/);
  /* 끄면 예전처럼 */
  const off=await page.evaluate(()=>{InquiryWorkbench.close();G.inqSiteOff=true;goPage('inq');paint();InquiryWorkbench.open(A);const dl=document.getElementById('inq-inbox-dialog');return [!!document.querySelector('.il-site i.il-sb'),!!document.querySelector('.il-site b u'),dl.querySelectorAll('.isd-hist,.isd-near,.isd-rel,.isd-scope').length,dl.querySelectorAll('.idv3-bottom').length];});
  assert.deepEqual(off,[false,true,0,1]);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('inquiry site ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
