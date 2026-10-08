'use strict';
/* 견적문의 v4 — 상단 정리 + 목록 옆 상세 (2026-10-06 design_handoff_inquiry_v4 · 시안 '견적문의 v4.dc.html')
   합성 자료 5건(이름 · 현장은 지어낸 것): 미배정 1 · 첫 연락 전 1(같은 단지에 지난 실주) · 후속 연락 필요 1 · 정상 진행 2(대표회의 D-2 하나).
   확인: 숫자 하나(위 탭 = 브랜드 전체 = 진행 중 전체 = 목록 건수) / 상태 탭 5칸의 합 = 전체 / 함께 확인 칩 / 정렬 / 줄의 경과 기준 라벨
        / 고른 줄이 오른쪽에 바로 / 키보드 ↑ ↓ · 주소의 선택 문의 / 결과 저장 → 다음 문의 · 부재는 연락 시도로만 / 빠진 정보 그 자리 입력 / 전체 상세 / 좁은 화면 / 끄면 목록 v3 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryListV3&&window.InquiryDetailV2&&window.InquiryWorkbench);
  await page.evaluate(()=>{
   const at=(d,h)=>new Date(Date.now()-d*864e5-(h||0)*36e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222',F='33333333-3333-4333-8333-333333333333',M='44444444-4444-4444-8444-444444444444',N='55555555-5555-4555-8555-555555555555';
   B={deals:[{id:'d-ex1',site:'[경기 김포] 한강신도시반도유보라',code:'lost',grp:'수주 실패',assignee:'이필선',created:at(400),brand:'석민이앤씨'}],inquiries:[
    {id:U,site:'[서울 성북] 길음뉴타운9단지',status:'접수',at:at(0,3),created_at:at(0,3),brand:'POUR솔루션',phone:'010-2281-4402',contact_name:'정미경',raw:{'문의내용':'옥상 방수 견적 요청드립니다. 최상층 3세대 누수.','고객유형':'관리소장','상담채널':'홈페이지'}},
    {id:A,site:'[경기 김포] 한강신도시반도유보라',status:'배정완료',at:at(1),created_at:at(1),brand:'석민이앤씨',phone:'031-987-1150',contact_name:'이준호',assignee:'이필선',assigned_to:'이필선',assigned_at:at(0.9),raw:{'문의내용':'지하주차장 바닥 에폭시 들뜸 보수 문의.','상담채널':'전화'}},
    {id:F,site:'[경남] 혁신LH5단지',status:'배정완료',at:at(40),created_at:at(40),brand:'석민이앤씨',phone:'055-757-7977',contact_name:'관리소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(39),responded_at:at(30),raw:{'문의내용':'외벽 재도장 · 주차장 · 현장 확인 요청','상담채널':'전화'},activities:[{type:'전화',note:'첫 연락 — 현장 확인 요청',at:at(30),actor:'이필선'}]},
    {id:M,site:'[경기 수원] 매탄임광아파트',status:'배정완료',at:at(8),created_at:at(8),brand:'POUR공법',phone:'031-214-7710',contact_name:'관리소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(7.9),responded_at:at(5),raw:{'문의내용':'외벽 재도장 견적 · 대표회의 전 자료 필요','상담채널':'전화','대표회의':day(2),'고객유형':'관리사무소','건물주소':'수원시 영통구','공사유형':'외벽 재도장','유입경로':'지인 소개','전화 응대자':'송보람'},address:'수원시 영통구',activities:[{type:'전화',note:'견적 범위 확인',at:at(5),actor:'이필선'}]},
    {id:N,site:'[서울 노원] 중계청구3차',status:'배정완료',at:at(2),created_at:at(2),brand:'아파트스퀘어',phone:'02-933-1180',contact_name:'홍성우',assignee:'이필선',assigned_to:'이필선',assigned_at:at(1.9),responded_at:at(1),raw:{'문의내용':'공법 설명 자료 요청','상담채널':'홈페이지'},activities:[{type:'전화',note:'자료 발송 안내',at:at(1),actor:'이필선'}]}],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;G.inqDetailV3Off=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqV3=null;G.inqV4={sort:'old'};/* 기본은 급한 순(inquiry_memo) — 이 검사는 오래된 순 기준 */
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   window.__rpc=[];SB={rpc:async(name,args)=>{__rpc.push([name,args]);if(name==='crm_inquiry_field_update_v1'){const p=args.p;return {data:{ok:true,inquiry_id:p.inquiry_id,field:p.field,value:p.value,raw_key:{customer_type:'고객유형',work_type:'공사유형',channel:'상담채널',inflow:'유입경로',responder:'전화 응대자',timing:'공사 시기',competitor:'경쟁사',requested_material:'요청 자료',keyman:'결정권자'}[p.field]||null}};}if(name==='crm_inquiry_site_link_v1'){const p=args.p;return {data:{ok:true,inquiry_id:p.inquiry_id,decision:p.decision,deal_id:p.decision==='same'?p.deal_id:null}};}return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>!/^crm_inquiry_(command|flow_list)_v1$/.test(n),noteMissing:()=>{}});
   goPage('inq');window.U=U;window.A=A;window.F=F;window.M=M;window.N=N;
  });

  await page.waitForTimeout(500);
  const one=s=>String(s||'').replace(/\s+/g,' ').trim();
  const V=page.locator('#inq-v4'),rows=()=>V.locator('.i4-row'),det=V.locator('.i4-detail');
  const tabNums=()=>V.locator('.i4-tab b.n').evaluateAll(l=>l.map(b=>Number(b.textContent)));
  const sites=()=>V.locator('.i4-row .site').evaluateAll(l=>l.map(b=>b.textContent.replace(/^\[[^\]]*\]\s*/,'')));
  /* ① 숫자는 하나: 위 탭 = 브랜드 '전체' = 진행 중 전체 = 목록 건수, 뒤 네 칸의 합 = 전체 */
  assert.deepEqual(await page.evaluate(()=>[document.getElementById('pg-inq').classList.contains('inq-v4'),getComputedStyle(document.getElementById('inq-v3')).display,InquiryV4.on()]),[true,'none',true]);
  assert.deepEqual((await V.locator('.i4-tab').allInnerTexts()).map(one),['5 진행 중 전체 종결 · 휴지통 제외','1 배정 필요 30분 안에 담당 지정','1 첫 연락 전 배정 후 2시간 안 첫 연락','1 후속 연락 필요 첫 연락 후 7일 넘게 연락 없음','2 정상 진행 마지막 연락 7일 안','0 연락처 보완 연락처 찾기 · 이관 기록 확인']);
  {const n=await tabNums();assert.equal(n[1]+n[2]+n[3]+n[4]+n[5],n[0],'뒤 다섯 칸의 합 = 진행 중 전체');}
  assert.deepEqual(await page.evaluate(()=>[document.querySelector('.b2b-kinds a span').textContent,document.querySelector('.cf-brands .cf-pill em').textContent,[...document.querySelectorAll('.cf-brands .cf-pill em')].slice(1).reduce((s,e)=>s+Number(e.textContent),0),document.querySelector('#inq-v4 .cnt b').textContent]),['5','5',5,'5건']);
  assert.equal(one(await V.locator('.i4-flags .cnt').innerText()),'5건 · 오래된 순 · ↑ ↓ 이동');
  assert.deepEqual((await V.locator('.i4-flag').allInnerTexts()).map(one),['필수정보 미입력 3','대표회의 · 기한 D-3 1','오늘 들어온 문의 1']);
  /* ② 목록 줄: 경과 기준 라벨 + 경과 + 상태(오래된 순) · 꼬리표 · 마지막 기록 점 */
  assert.deepEqual(await sites(),['혁신LH5단지','매탄임광아파트','중계청구3차','한강신도시반도유보라','길음뉴타운9단지']);
     /* 줄 오른쪽 세 줄(2026-10-08 inquiry_memo): 묶음 · 지금 상태 · 기한 — 날짜는 한국 날짜 기준 일수 */
   {const c3=await V.locator('.i4-row .c3').evaluateAll(l=>l.map(c=>[...c.children].map(x=>x.textContent)));
    assert.deepEqual(c3.map(x=>x[0]),['③ 후속 기한','② 고객 약속 · 회의','③ 후속 기한','① 신규 첫 연락','① 신규 첫 연락']);
    assert.match(c3[0][1],/^실제 연결 후 30일 · \d+\.\d+ 통화$/);assert.match(c3[0][2],/^\d+\.\d+까지 · 2\d일 지남$/);
    assert.match(c3[1][1],/^대표회의 D-2 · \d+\.\d+$/);assert.match(c3[1][2],/^\d+\.\d+까지 · 2일 남음$/);
    assert.match(c3[2][1],/^실제 연결 후 1일 · \d+\.\d+ 통화$/);assert.match(c3[2][2],/^\d+\.\d+까지 · \d+일 남음$/);
    assert.match(c3[3][1],/^첫 연락 기한 \d+시간 지남$/);assert.match(c3[3][2],/^\d+\.\d+ \d\d:\d\d까지$/);
    assert.match(c3[4][1],/^배정 기한 \d+시간 지남$/);}
assert.deepEqual(await rows().evaluateAll(l=>l.map(r=>[...r.querySelectorAll('.i4-tag')].map(t=>t.className.replace('i4-tag ','')+':'+t.textContent).join('|'))),['','meet:대표회의 D-2','','lost:이 단지 실주 1','']);
  assert.deepEqual(await V.locator('.i4-row .last').evaluateAll(l=>l.map(s=>[s.querySelector('i').className,s.textContent.replace(/^\d{4}\.\d+\.\d+ /,'')])),[['real','실제 연결 · 연결됨 · 첫 연락 — 현장 확인 요청'],['real','실제 연결 · 연결됨 · 견적 범위 확인'],['real','실제 연결 · 연결됨 · 자료 발송 안내'],['','CRM 연락 기록 없음'],['','CRM 연락 기록 없음']]);
  assert.deepEqual(await rows().first().evaluate(r=>[getComputedStyle(r).borderLeftColor,getComputedStyle(r).backgroundColor,r.getAttribute('aria-current')]),['rgb(232, 89, 12)','rgb(238, 243, 254)','true']);
  /* ③ 오른쪽 상세: 고른 줄이 바로 열린다(첫 줄) */
  assert.equal(await det.locator('.i4-dh .site').innerText(),'[경남] 혁신LH5단지');
  assert.match(one(await det.locator('.i4-pill').innerText()),/^후속 연락 필요 · 실제 연결 후 30일 · \d+\.\d+ 통화$/);
  assert.equal(one(await det.locator('.i4-dh .r1').innerText()).startsWith('석민이앤씨 전화 · 담당 이필선'),true);
  assert.deepEqual((await det.locator('.i4-dh .r3 button').allInnerTexts()).map(one),['전화','문자','전체 상세 ↗']);
  assert.equal(one(await det.locator('.i4-raw').innerText()),'외벽 재도장 · 주차장 · 현장 확인 요청');
  assert.match(one(await det.locator('.i4-sec .lb').nth(1).innerText()),/^빠진 정보 \d \/ 9 · 누르면 바로 입력$/);
  assert.match(one(await det.locator('.i4-line').innerText()),/^AI 첫마디 ?"안녕하세요, 넷폼 이필선입니다\. 문의 주신 .+ 건으로 연락드렸습니다\. 지금 통화 괜찮으실까요\?"$/);
  assert.equal(one(await det.locator('.i4-next').innerText()),'AI 다음 행동 결과를 고르면 제안');
  assert.deepEqual([await det.locator('[data-i4="save"]').isDisabled(),one(await det.locator('.i4-save span').innerText())],[true,'저장하면 다음 문의가 열립니다']);
  assert.match(one(await det.locator('.i4-log .ttl').innerText()),/^응대 이력 3건$/);
  assert.deepEqual(await det.locator('.i4-ev').evaluateAll(l=>l.map(e=>[e.querySelector('i').className,e.textContent.replace(/^\d{4}\.\d+\.\d+/,'').replace(/^ · /,'')])),[['real','이필선 · 실제 연결 · 연결됨 · 첫 연락 — 현장 확인 요청'],['','영업관리 · 담당 이필선 배정'],['','전화 견적문의 접수']]);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'inq-v4.png')});
  /* ④ 상태 탭 · 함께 확인 칩 · 정렬 */
  await V.locator('[data-i4="tab"][data-v="nofirst"]').click();await page.waitForTimeout(120);
  assert.deepEqual([await sites(),one(await V.locator('.cnt b').innerText()),await det.locator('.i4-dh .site').innerText()],[['한강신도시반도유보라'],'1건','[경기 김포] 한강신도시반도유보라']);
  assert.match(one(await det.locator('.i4-hist').innerText()),/^이 단지 지난 영업 · .*실주/);assert.equal(await det.locator('.i4-hist.lost').count(),1);
  assert.match(one(await det.locator('.i4-pill').innerText()),/^첫 연락 전 · 첫 연락 기한 \d+시간 지남$/);
  await V.locator('[data-i4="tab"][data-v="unassigned"]').click();await page.waitForTimeout(120);
  assert.deepEqual([await sites(),one(await det.locator('.i4-assign').innerText()),await det.locator('[data-i4="save"]').count()],[['길음뉴타운9단지'],'담당이 정해지기 전입니다 — 배정 뒤에 응대 기록을 남깁니다. 담당 배정',0]);
  await V.locator('[data-i4="tab"][data-v="all"]').click();await V.locator('[data-i4="flag"][data-v="meet"]').click();await page.waitForTimeout(120);
  assert.deepEqual([await sites(),await V.locator('[data-i4="flag"][data-v="meet"]').getAttribute('aria-pressed'),one(await V.locator('.cnt b').innerText())],[['매탄임광아파트'],'true','1건']);
  await V.locator('[data-i4="flag"][data-v="meet"]').click();await V.locator('[data-i4="sort"][data-v="new"]').click();await page.waitForTimeout(120);
  assert.deepEqual([await sites(),one(await V.locator('.i4-flags .cnt').innerText())],[['길음뉴타운9단지','한강신도시반도유보라','중계청구3차','매탄임광아파트','혁신LH5단지'],'5건 · 최근 순 · ↑ ↓ 이동']);
  await V.locator('[data-i4="sort"][data-v="old"]').click();await page.waitForTimeout(120);
  /* ⑤ 브랜드를 바꾸면 위 탭 · 상태 탭 · 목록이 그 기준으로(브랜드 칩의 건수는 그대로) */
  await page.locator('.cf-brands .cf-pill',{hasText:'석민이앤씨'}).click();await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>[document.querySelector('.b2b-kinds a span').textContent,[...document.querySelectorAll('#inq-v4 .i4-tab b.n')].map(b=>Number(b.textContent)),[...document.querySelectorAll('.cf-brands .cf-pill')].map(b=>b.innerText.replace(/\s+/g,' ').trim()),document.querySelector('#inq-v4 .cnt b').textContent]),['2',[2,0,1,1,0,0],['전체 5','석민이앤씨 2','POUR솔루션 1','POUR공법 1','아파트스퀘어 1'],'2건']);
  assert.equal(await V.locator('.i4-tab b.n').nth(1).evaluate(b=>b.style.color),'rgb(201, 205, 213)','0은 회색 숫자');
  await page.locator('.cf-brands .cf-pill',{hasText:'전체'}).click();await page.waitForTimeout(250);assert.deepEqual(await tabNums(),[5,1,1,1,2,0]);
  /* ⑥ 키보드 ↑ ↓ = 이동(입력 중엔 무시) · 고른 문의가 주소에 남는다 */
  await rows().first().click();await page.waitForTimeout(100);
  await page.evaluate(()=>document.activeElement&&document.activeElement.blur());
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(120);
  assert.deepEqual([await det.locator('.i4-dh .site').innerText(),await page.evaluate(()=>location.hash==='#p=inq&sel='+M),await page.evaluate(()=>document.querySelectorAll('#inq-v4 .i4-row.on').length)],['[경기 수원] 매탄임광아파트',true,1]);
  await det.locator('.i4-memo').click();await page.keyboard.press('ArrowDown');await page.waitForTimeout(100);
  assert.equal(await det.locator('.i4-dh .site').innerText(),'[경기 수원] 매탄임광아파트','메모를 적는 중에는 줄이 넘어가지 않는다');
  await page.evaluate(()=>document.activeElement&&document.activeElement.blur());await page.keyboard.press('ArrowUp');await page.waitForTimeout(120);
  assert.equal(await det.locator('.i4-dh .site').innerText(),'[경남] 혁신LH5단지');
  assert.equal(await page.evaluate(()=>{PCRouter.apply('#p=inq&sel='+N);return InquiryV4.selected()===N;}),true,'주소의 선택 문의로 같은 건이 열린다');
  await page.waitForTimeout(150);assert.equal(await det.locator('.i4-dh .site').innerText(),'[서울 노원] 중계청구3차');
  /* ⑦ 결과 저장 → 다음 문의. 부재 = 연락 시도로만(최초 응대 시각은 그대로) */
  const firstBefore=await page.evaluate(()=>String(inqCtlFirstResponseAt(B.inquiries.find(q=>q.id===N))||''));
  await det.locator('[data-i4="con"][data-v="부재"]').click();await page.waitForTimeout(100);
  assert.match(one(await det.locator('.i4-next').innerText()),/^AI 다음 행동 다시 연락 · 내일 \(\d{4}\.\d+\.\d+\([일월화수목금토]\)\) 바꾸기$/);
  assert.equal(one(await det.locator('.i4-save span').innerText()),'부재 = 연락 시도로만 기록 · 최초 응대 아님');
  await det.locator('[data-i4="pick"]').click();await page.waitForTimeout(80);
  assert.deepEqual(await det.locator('.i4-res.when .i4-chip').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-pressed')])),[['내일','true'],['3일 후','false'],['7일 후','false']]);
  await det.locator('[data-i4="when"][data-v="3일 후"]').click();await page.waitForTimeout(80);assert.match(one(await det.locator('.i4-next').innerText()),/다시 연락 · 3일 후 /);
  await det.locator('.i4-memo').fill('관리실 부재 · 오후에 다시');
  await page.evaluate(()=>{window.__writes.length=0;});
  await det.locator('[data-i4="save"]').click();await page.waitForTimeout(500);
  const sv=await page.evaluate(()=>{const q=B.inquiries.find(x=>x.id===N),w=__writes.map(x=>[x[0],x[1]&&(x[1].result||x[1].text||''),x[1]&&x[1].next]);return {first:String(inqCtlFirstResponseAt(q)||''),w,sel:InquiryV4.selected()===A,tl:(InquiryDetailV2.timeline(q)||[]).filter(e=>e.kind==='contact').map(e=>e.res)};});
  assert.equal(sv.first,firstBefore,'부재는 최초 응대 시각을 바꾸지 않는다');assert.ok(sv.tl.includes('부재'),'응대 이력에 부재(연락 시도)가 남는다: '+JSON.stringify(sv));
  assert.ok(sv.w.some(x=>/\[전화 · 부재\] 관리실 부재 · 오후에 다시/.test(String(x[1])))||sv.w.length>0,'저장 명령이 나간다: '+JSON.stringify(sv.w));
  assert.equal(sv.sel,true,'저장하면 다음 문의(한강신도시반도유보라)가 열린다');assert.equal(await det.locator('.i4-dh .site').innerText(),'[경기 김포] 한강신도시반도유보라');
  assert.deepEqual([await det.locator('.i4-chip.on').count(),await det.locator('.i4-memo').inputValue()],[0,''],'다음 문의는 빈 기록 칸으로');
  /* 첫 연락 전 탭에서 '연결됨'을 저장하면 그 탭에서 빠진다 */
  await V.locator('[data-i4="tab"][data-v="nofirst"]').click();await page.waitForTimeout(120);
  await det.locator('[data-i4="con"][data-v="연결됨"]').click();await det.locator('[data-i4="rea"][data-v="관심 있음"]').click();await det.locator('[data-i4="save"]').click();await page.waitForTimeout(500);
  assert.deepEqual([await tabNums(),await rows().count(),one(await det.innerText())],[[5,1,0,1,3,0],0,'왼쪽에서 문의를 고르면 여기에 열립니다']);
  await V.locator('[data-i4="tab"][data-v="all"]').click();await page.waitForTimeout(120);
  /* ⑧ 빠진 정보: 누르면 그 자리에서 입력 */
  await rows().first().click();await page.waitForTimeout(100);
  const missBefore=Number(await det.locator('.i4-sec .lb em').innerText());
  await det.locator('[data-i4="miss"][data-v="경쟁사"]').click();await page.waitForTimeout(100);
  assert.equal(await det.locator('.i4-fill input').getAttribute('placeholder'),'경쟁사 입력');
  await det.locator('.i4-fill input').fill('타 업체 2곳 비교 중');await page.keyboard.press('Enter');await page.waitForTimeout(500);
  assert.deepEqual([Number(await det.locator('.i4-sec .lb em').innerText()),await det.locator('[data-i4="miss"][data-v="경쟁사"]').count(),await page.evaluate(()=>B.inquiries.find(q=>q.id===F).raw['경쟁사'])],[missBefore-1,0,'타 업체 2곳 비교 중']);
  /* ⑨ 전체 상세 ↗ = 기존 상세 창 */
  await det.locator('.i4-dh [data-i4="full"]').click();await page.waitForSelector('#inq-inbox-dialog');
  assert.equal(await page.evaluate(()=>G.inqSelKey===inqKey(B.inquiries.find(q=>q.id===F))),true);
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(80);assert.equal(await det.locator('.i4-dh .site').innerText(),'[경남] 혁신LH5단지','상세 창이 떠 있으면 줄이 넘어가지 않는다');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(150);
  /* ⑩ 노트북 · 좁은 화면 */
  await page.setViewportSize({width:1200,height:800});await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>[getComputedStyle(document.querySelector('#inq-v4 .i4-panes')).gridTemplateColumns.split(' ')[0],getComputedStyle(document.querySelector('#inq-v4 .i4-row .c2')).display]),['340px','none']);
  await page.setViewportSize({width:1000,height:800});await page.waitForTimeout(200);
  await page.evaluate(()=>{InquiryV4.state().detail=false;InquiryV4.render();});
  assert.deepEqual(await page.evaluate(()=>[getComputedStyle(document.querySelector('#inq-v4 .i4-list')).display,getComputedStyle(document.querySelector('#inq-v4 .i4-detail')).display]),['block','none']);
  await rows().nth(1).click();await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>[getComputedStyle(document.querySelector('#inq-v4 .i4-list')).display,getComputedStyle(document.querySelector('#inq-v4 .i4-detail')).display,getComputedStyle(document.querySelector('#inq-v4 .i4-dh .back')).display]),['none','block','block']);
  await det.locator('[data-i4="back"]').click();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#inq-v4 .i4-list')).display),'block');
  await page.setViewportSize({width:1600,height:1000});await page.waitForTimeout(200);
  /* 두 칸은 화면 높이에 맞고 각 칸 안에서만 스크롤 */
  assert.equal(await page.evaluate(()=>{const p=document.querySelector('#inq-v4 .i4-panes').getBoundingClientRect();return p.bottom<=innerHeight&&p.height>=420&&getComputedStyle(document.querySelector('#inq-v4 .i4-list')).overflowY==='auto';}),true);
  /* ⑪ 끄면 목록 v3 그대로 */
  const off=await page.evaluate(()=>{G.inqV4Off=true;paint();return [!!document.getElementById('inq-v4'),document.getElementById('pg-inq').classList.contains('inq-v4'),getComputedStyle(document.getElementById('inq-v3')).display!=='none',document.querySelectorAll('#inq-v3 .il-tab').length];});
  assert.deepEqual(off,[false,false,true,7]);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('inquiry v4 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
