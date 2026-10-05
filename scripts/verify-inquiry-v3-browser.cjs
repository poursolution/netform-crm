'use strict';
/* 견적문의 목록 v3 + 상세 보강 검사(2026-10-03 핸드오프 inquiry_v2):
   목록 — 상황 탭 7개 · 접수일 오름차순 기본 · 경과(첫 연락 전 = 접수부터, 후 = 마지막 연락부터, 연도 포함) · 버튼 · 줄 펼침 · 줄 안 결과 기록(결과+다음 행동일 둘 다 → 기존 iqApply 경로)
   상세 — 빈 칸 '미입력 · 눌러서 입력'(서버 함수 있을 때만, Enter 저장 · Esc 취소 · 서버 확인 뒤 반영), 결과 칩 + 다음 행동일 칩(둘 다 있어야 저장 · 규칙 기본값). 끄면(G.inqV3Off) v2 목록 */
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
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;G.inqDetailV3Off=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqV3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   window.__rpc=[];SB={rpc:async(name,args)=>{__rpc.push([name,args]);if(name==='crm_inquiry_field_update_v1'){const p=args.p;return {data:{ok:true,inquiry_id:p.inquiry_id,field:p.field,value:p.value,raw_key:{customer_type:'고객유형',work_type:'공사유형',channel:'상담채널',inflow:'유입경로',responder:'전화 응대자',timing:'공사 시기',competitor:'경쟁사',requested_material:'요청 자료',keyman:'결정권자'}[p.field]||null}};}if(name==='crm_inquiry_site_link_v1'){const p=args.p;return {data:{ok:true,inquiry_id:p.inquiry_id,decision:p.decision,deal_id:p.decision==='same'?p.deal_id:null}};}return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>!/^crm_inquiry_(command|flow_list)_v1$/.test(n),noteMissing:()=>{}});
   goPage('inq');window.U=U;window.A=A;window.F=F;window.M=M;window.N=N;
  });
  await page.waitForTimeout(600);
  const v=page.locator('#inq-v3');assert.equal(await v.count(),1,'목록 v3');assert.equal(await page.locator('#pg-inq.inq-v3 #inq-v2').isVisible(),false,'v2 목록은 숨김');
  /* 구글시트 상태 · 고정 문구는 상단 제목 옆 */
  assert.equal(await page.locator('#ptitle').innerText(),'견적문의');assert.match(await page.locator('#psub .il-sheet').innerText(),/^구글시트 연결됨 · .*5건$/);assert.equal(await page.locator('#psub .il-fixed').innerText(),'12시까지 결과 · 다음 행동 업데이트');assert.equal(await v.locator('.il-sheet').count(),0,'목록 안에는 다시 그리지 않음');
  /* 탭 7개 + 건수 */
  const tabs=await v.locator('.il-tab').evaluateAll(a=>a.map(n=>n.querySelector('span').textContent.trim()+'|'+n.querySelector('small').textContent.trim()));
  assert.deepEqual(tabs.map(t=>t.split('|')[0]),['5전체','1배정 필요','1첫 연락 전','1후속 연락 필요',((d=>d(Date.now()-3*36e5)===d(Date.now()))(t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(t)))?1:0)+'오늘 들어온 문의','1대표회의 · 기한 D-3','3필수정보 미입력'],JSON.stringify(tabs));
  assert.match(tabs[1],/30분 안에 담당 지정/);assert.match(tabs[2],/2시간 안 첫 연락/);assert.match(tabs[3],/7일 넘게 연락 없음/);
  /* 정렬: 접수일 오름차순(가장 오래된 것 먼저) · 상태와 무관 */
  const sites=async()=>v.locator('.il-row .il-site b').allInnerTexts();
  assert.deepEqual((await sites()).map(t=>t.replace(/기존 현장 · \d+건$/,'').trim()),['[경남] 혁신LH5단지','[경기 수원] 매탄임광아파트','[서울 노원] 중계청구3차','[경기 김포] 한강신도시반도유보라','[서울 성북] 길음뉴타운9단지']);
  assert.match(await v.locator('.il-sortrow').innerText(),/5건 · 접수일 오름차순/);
  await v.locator('.il-sorts [data-v="new"]').click();await page.waitForTimeout(300);assert.deepEqual((await sites())[0],'[서울 성북] 길음뉴타운9단지');await page.locator('#inq-v3 .il-sorts [data-v="old"]').click();await page.waitForTimeout(300);
  /* 경과 · 날짜(연도 포함) · 버튼 */
  const row=site=>page.locator('#inq-v3 .il-row',{hasText:site});
  assert.match(await row('길음뉴타운9단지').locator('.il-el').innerText(),/^3시간 \d+분\s*(오늘 \d{2}:\d{2}|\d{4}\.\d+\.\d+) 접수$/);assert.equal(await row('길음뉴타운9단지').locator('.il-act').innerText(),'담당 배정');assert.match(await row('길음뉴타운9단지').locator('.il-owner').innerText(),/미배정/);
  assert.match(await row('한강신도시반도유보라').locator('.il-el').innerText(),/^1일\s*\d{4}\.\d{1,2}\.\d{1,2} 접수$/);assert.equal(await row('한강신도시반도유보라').locator('.il-act').innerText(),'첫 연락');
  assert.match(await row('혁신LH5단지').locator('.il-el').innerText(),/^30일째\s*\d{4}\.\d{1,2}\.\d{1,2} 연락 후$/,'첫 연락 후 = 마지막 연락부터');assert.equal(await row('혁신LH5단지').locator('.il-act').innerText(),'후속 연락');
  assert.equal(await row('매탄임광아파트').locator('.il-act').innerText(),'자료 제출');assert.match(await row('매탄임광아파트').locator('.il-site em').innerText(),/대표회의 \d{4}\.\d{1,2}\.\d{1,2} D-2/);
  assert.equal(await row('중계청구3차').locator('.il-act').innerText(),'정보 보완');
  assert.equal(await row('혁신LH5단지').evaluate(n=>getComputedStyle(n).borderLeftColor),'rgb(232, 89, 12)','브랜드 띠 = 석민 색');
  /* 줄 끝 버튼 색 = 급한 정도: 배정 빨강 채움 · 첫 연락 검정 채움 · 기준 넘긴 후속 주황 테두리 · 나머지 흰 버튼 */
  const btn=site=>row(site).locator('.il-act').evaluate(n=>{const c=getComputedStyle(n);return [c.backgroundColor,c.color,c.borderTopColor,Math.round(n.getBoundingClientRect().width)];});
  assert.deepEqual(await btn('길음뉴타운9단지'),['rgb(217, 58, 58)','rgb(255, 255, 255)','rgb(217, 58, 58)',92],'담당 배정 = 빨강 채움');
  assert.deepEqual(await btn('한강신도시반도유보라'),['rgb(21, 23, 28)','rgb(255, 255, 255)','rgb(21, 23, 28)',92],'첫 연락 = 검정 채움');
  assert.deepEqual(await btn('혁신LH5단지'),['rgb(255, 255, 255)','rgb(180, 83, 9)','rgb(240, 197, 138)',92],'후속 연락 = 주황 테두리');
  assert.deepEqual(await btn('중계청구3차'),['rgb(255, 255, 255)','rgb(42, 82, 184)','rgb(213, 224, 251)',92],'나머지 = 흰 버튼');
  assert.deepEqual(await row('혁신LH5단지').evaluate(n=>[n.querySelector('.il-who'),n.querySelector('.il-owner'),n.querySelector('.il-el')].map(e=>Math.round(e.getBoundingClientRect().width)).concat(getComputedStyle(n.querySelector('.il-r')).columnGap)),[150,64,108,'28px'],'오른쪽 덩어리 폭 · 간격');
  /* 줄 꼬리표: 같은 단지의 지난 영업 요약(2026-10-05 design_handoff_inquiry_site) — 예전 '기존 현장 · n건' 자리 */
  assert.match(await row('한강신도시반도유보라').locator('.il-site i.il-sb').innerText(),/^이 단지 실주 1 · \d{4}$/);assert.equal(await row('한강신도시반도유보라').locator('.il-site b u').count(),0);assert.equal(await row('혁신LH5단지').locator('.il-site i.il-sb').count(),0);
  /* 탭 필터 */
  await v.locator('.il-tab[data-v="stale"]').click();await page.waitForTimeout(300);assert.deepEqual(await sites(),['[경남] 혁신LH5단지']);
  await page.locator('#inq-v3 .il-tab[data-v="all"]').click();await page.waitForTimeout(300);
  /* 줄 펼침: 원문 · 마지막 연락 · 빠진 정보 · 첫마디 · [상세 열기] 전화 문자 */
  await row('혁신LH5단지').click();await page.waitForTimeout(200);
  const pn=page.locator('#inq-v3 .il-item.open .il-panel');assert.equal(await pn.count(),1);
  assert.match(await pn.innerText(),/문의 원문\s*외벽 재도장 · 주차장 · 현장 확인 요청[\s\S]*마지막 연락\s*\d{4}\.\d+\.\d+ 전화 · 첫 연락 — 현장 확인 요청[\s\S]*빠진 정보[\s\S]*첫마디\s*안녕하세요, 넷폼 송보람입니다\.[\s\S]*상세 열기\s*전화$/,'목록의 문자 버튼은 없앴다(견적문의 흐름 ③)');
  /* 줄 안 결과 기록: [후속 연락] → 칩(기본값 연락 완료 · 7일 후) → 저장. 이미 응대한 문의의 후속 연락 = 다음 할 일 등록(next_action) — 단계 진행(inquiry_status)으로 보내면 서버가 같은 상태 충돌(PT409)로 거절한다 */
  await row('혁신LH5단지').locator('.il-act').click();await page.waitForTimeout(200);
  const rec=page.locator('#inq-v3 .il-rec');assert.equal(await rec.count(),1);
  assert.deepEqual(await rec.locator('.il-chip[data-il="res"]').allInnerTexts(),['연결됨','고객 회신','검토중','자료요청','견적요청','부재','통화불가','번호오류'],'결과 칩 = 결과 마스터(목록 · 상세 공통)');assert.deepEqual(await rec.locator('.il-chip.on').allInnerTexts(),['연결됨','3일 후'],'규칙 기본값이 미리 골라짐');
  await rec.locator('.il-chip[data-il="res"][data-v="검토중"]').click();await page.waitForTimeout(150);assert.deepEqual(await page.locator('#inq-v3 .il-rec .il-chip.on').allInnerTexts(),['검토중','7일 후'],'결과를 바꾸면 다음 행동일 제안도 따라감');await page.locator('#inq-v3 .il-rec .il-chip[data-il="next"][data-v="3일 후"]').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('#inq-v3 .il-save button').innerText(),'저장');assert.match(await page.locator('#inq-v3 .il-save span').innerText(),/결과와 다음 행동일을 모두 골라야 저장됩니다[\s\S]*다음 연락 \d{4}\.\d+\.\d+\([일월화수목금토]\)$/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  await page.locator('#inq-v3 .il-save button').click();await page.waitForTimeout(500);
  const w=await page.evaluate(()=>__writes.filter(x=>x[0]==='inquiry_status'||x[0]==='next_action').map(x=>[x[0],x[1]]));
  assert.equal(w.length,1,'저장 요청 1건 '+JSON.stringify(w));assert.equal(w[0][0],'next_action','후속 연락은 상태를 바꾸지 않는다(단계 진행 아님)');
  assert.equal(String(w[0][1].text),'다시 연락 — [전화 · 검토중]');assert.match(String(w[0][1].due_at),/^\d{4}-\d{2}-\d{2}$/,'다음 할 일 · 날짜 함께 '+JSON.stringify(w[0]));assert.equal(w[0][1].type,'전화');
  assert.equal(await page.evaluate(()=>!!document.querySelector('#inqActText,#inqActDue')),false,'임시 입력칸은 지운다');
  assert.equal(await page.evaluate(()=>!!document.querySelector('#iq-did')),false,'임시 입력칸은 지운다');
  /* 대표회의 건: 기본값 = 대표회의 예정 · 대표회의 다음날 */
  await row('매탄임광아파트').locator('.il-act').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#inq-v3 .il-rec .il-chip.on').allInnerTexts(),['연결됨','대표회의 다음날']);assert.match(await page.locator('#inq-v3 .il-rec em').innerText(),/대표회의 .* D-2 · 정확한 견적이 늦으면 개략 금액 먼저/);
  /* 상세: 빈 칸 바로 입력(서버 함수 있음) · Esc 취소 · Enter 저장(서버 확인 뒤 반영 · 감사용 RPC) */
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>!/^crm_inquiry_(command|flow_list)_v1$/.test(n),noteMissing:()=>{}});InquiryWorkbench.open(A);});await page.waitForTimeout(400);
  const d=page.locator('#inq-inbox-dialog.idv');assert.equal(await d.count(),1);
  /* 상세 머리글: 브랜드 색 칩 · 상태 알약(첫 연락 전 · 경과) · 접수 시각(연도 포함) · 오른쪽 지금 할 일 · 필수 확인 9개 */
  assert.equal(await d.locator('.idv-brand').evaluate(n=>getComputedStyle(n).color),'rgb(232, 89, 12)');assert.match(await d.locator('.idv-pill').innerText(),/^첫 연락 전 · 1일$/);assert.match(await d.locator('.idv-sub').innerText(),/이준호 · \d{4}\.\d{1,2}\.\d{1,2} \d{2}:\d{2} 접수$/);
  assert.match(await d.locator('.idv-c3').innerText(),/^지금 할 일\s*첫 연락\s*배정 후 2시간 안 첫 연락/);assert.match(await d.locator('.idv-recv').innerText(),/^\d{4}년 \d{1,2}월 \d{1,2}일 \d{2}:\d{2} 접수 \(경과 1일\)\s*배정 후 2시간 안 첫 연락$/);
  /* 상세 창 기준 = 파이프라인 상세(2026-10-05): 필수 확인 칩 · 보완 필요 상자 없이 문의 정보 한 상자 — 줄 + 제목 옆 '미입력 n' */
  assert.equal(await d.locator('.idv-need, .idv-needchip, .idv-missing').count(),0,'칩 · 보완 필요 상자 없음');
  assert.deepEqual((await d.locator('.idv-info dt').allInnerTexts()).slice(-6),['대표회의','회신 기한','공사 시기','경쟁사','요청 자료','결정권자'],'칩에만 있던 항목은 문의 정보의 줄로');
  assert.match(await d.locator('.idv-fh .idv-miss').innerText(),/^미입력 \d+$/);const miss0=Number((await d.locator('.idv-fh .idv-miss').innerText()).replace(/\D/g,''));assert.equal(miss0,await d.locator('.idv-info dd.warn').count(),'미입력 수 = 빈 줄 수');
  assert.match(await d.locator('.idv-chead').innerText(),/응대 이력\s*2건\s*연락 시도 0 · 실제 연결 0\s*최초 응대 아직 없음/);assert.match(await d.locator('.idv-ev .idv-evmeta').first().innerText(),/^\d{4}\.\d{1,2}\.\d{1,2} \d{2}:\d{2} · 자동\s*시스템\s*구글시트$/,'이력 시각 = 연도 포함 · 출처 배지는 끝');
  assert.equal(await d.locator('.idv-thint').innerText(),'적기만 하면 수단 · 결과 · 다음 행동을 채웁니다');assert.equal(await d.locator('.idv-sug').isVisible(),false,'내용이 없으면 제안 줄 없음');assert.equal(await d.locator('.idv-composer .idv-save').innerText(),'기록 저장');
  await d.locator('.idv-edit[data-v="competitor"]').click();await page.waitForTimeout(150);await page.keyboard.type('타 업체 2곳 비교 중');await page.keyboard.press('Enter');await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_field_update_v1').map(x=>[x[1].p.field,x[1].p.value])),[['competitor','타 업체 2곳 비교 중']],'경쟁사 줄 = 눌러서 바로 입력');
  assert.match(await d.locator('.idv-info>div',{hasText:'경쟁사'}).innerText(),/경쟁사\s*타 업체 2곳 비교 중/);assert.equal(Number((await d.locator('.idv-fh .idv-miss').innerText()).replace(/\D/g,'')),miss0-1,'채우면 미입력 수가 준다');await page.evaluate(()=>{__rpc.length=0;});
  const edits=await d.locator('.idv-edit').count();assert.ok(edits>=4,'빈 칸은 눌러서 입력 '+edits);
  assert.deepEqual(await d.locator('.idv-info dt').allInnerTexts(),['문의자','연락처','업체','현장 주소','공종','상담 채널','유입 경로','응대','대표회의','회신 기한','공사 시기','경쟁사','요청 자료','결정권자'],'핵심 확인 사항 두 칸 + 칩에만 있던 네 칸');
  await d.locator('.idv-edit[data-v="meeting_date"]').click();await page.waitForTimeout(150);const md=day=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+day*864e5));/* 화면은 서울 시각 — 검사 기계가 UTC 여도 같은 날짜 */await d.locator('.idv-editin[data-v="meeting_date"]').fill(md(2));await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_field_update_v1').map(x=>x[1].p.field)),['meeting_date'],'날짜는 고르면 바로 저장');assert.match(await d.locator('.idv-info').innerText(),new RegExp('대표회의\\s*'+md(2)));
  assert.match(await d.locator('.idv-nowbox').innerText(),/대표회의 \d{4}\.\d+\.\d+ D-2 · 정확한 견적이 늦으면 개략 금액 먼저/,'입력하자마자 D-3 경고');await page.evaluate(()=>{__rpc.length=0;});
  await d.locator('.idv-edit[data-v="customer_type"]').click();await page.waitForTimeout(150);
  assert.equal(await d.locator('.idv-editin[data-v="customer_type"]').count(),1);await page.keyboard.type('관리사무소');await page.keyboard.press('Escape');await page.waitForTimeout(150);
  assert.equal(await d.locator('.idv-editin').count(),0,'Esc = 취소');assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_field_update_v1').length),0,'취소하면 서버에 안 보냄');
  await d.locator('.idv-edit[data-v="customer_type"]').click();await page.waitForTimeout(150);await page.keyboard.type('관리사무소');await page.keyboard.press('Enter');await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_field_update_v1').map(x=>[x[0],x[1].p.field,x[1].p.value])),[['crm_inquiry_field_update_v1','customer_type','관리사무소']]);
  assert.match(await d.locator('.idv-info').innerText(),/업체\s*관리사무소/,'서버 확인 뒤 화면 반영');
  await d.locator('.idv-edit[data-v="inflow"]').click();await page.waitForTimeout(150);await page.keyboard.type('네이버 검색');await d.locator('.idv-quote').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_field_update_v1').length),2,'바깥 클릭 = 저장');
  /* 상세: 응대 기록 한 칸 — 자료 요청 문구 → 자료요청 · 자료 확인 · 3일 후 */
  await d.locator('#iq-res').fill('과장님 통화, 도면하고 현장 사진 보내주기로');await page.waitForTimeout(150);
  assert.match(await d.locator('.idv-sug').innerText(),/전화 · 자료요청\s*→ 다음 행동: 자료 확인 · \d{4}\.\d+\.\d+/);
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  await d.locator('[data-idv="save"]').click();await page.waitForTimeout(500);
  const w2=await page.evaluate(()=>__writes.filter(x=>x[0]==='inquiry_status').map(x=>x[1]));assert.equal(w2.length,1,'첫 응대(상세 저장) = 단계 진행 1건 — 앞의 후속 연락은 여기에 없다');assert.match(String(w2[0].result),/^\[전화 · 자료요청\] 과장님 통화/);assert.equal(w2[0].next,'자료 확인');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(200);
  /* 서버 함수가 없으면 입력 칸을 열지 않는다 */
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>n!=='crm_inquiry_field_update_v1'});InquiryWorkbench.open(U);});await page.waitForTimeout(400);
  assert.equal(await page.locator('#inq-inbox-dialog .idv-edit').count(),0);assert.match(await page.locator('#inq-inbox-dialog .idv-fieldnote').innerText(),/서버 적용 뒤에 열립니다/);
  await page.evaluate(()=>InquiryWorkbench.close());
  /* 기존 현장 판단: 같은 현장에 영업건이 있으면 배지 + 펼침에 질문 — 새 공사 / 같은 공사(붙이기) — 서버 확인 뒤에만 ✓ */
  await page.evaluate(()=>{TOKEN='test';__rpc.length=0;paint();});await page.waitForTimeout(300);
  if(!await page.locator('#inq-v3 .il-item.open',{hasText:'한강신도시반도유보라'}).count()){await row('한강신도시반도유보라').locator('.il-brand').click();await page.waitForTimeout(200);}
  const ex=page.locator('#inq-v3 .il-item.open .il-ex');assert.equal(await ex.count(),1);
  assert.match(await ex.innerText(),/^이 현장에 영업건 1개가 있어요 — 같은 공사인가요, 새 공사인가요\?\s*실주\s*공종 미분류\s*이필선\s*같은 공사 · 여기에 붙이기\s*같은 공사면 기존 건의 견적 버전 · 이력에 이어집니다\s*새 공사로 등록$/);
  assert.equal(await ex.evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(21, 23, 28)','고르기 전 = 검은 테두리');
  await ex.locator('.il-exnew').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_site_link_v1').map(x=>[x[1].p.inquiry_id,x[1].p.decision,x[1].p.deal_id])),[['22222222-2222-4222-8222-222222222222','new',null]]);
  assert.match(await page.locator('#inq-v3 .il-ex').innerText(),/^새 공사로 등록 · 같은 현장에 영업건 하나 추가[\s\S]*관리소장 · 연락처 · 이력은 현장 기준으로 함께 씁니다\s*새 공사 ✓$/);assert.equal(await page.evaluate(()=>inqCtlFind(A,false).raw['기존 현장 판단']),'새 공사');
  await page.locator('#inq-v3 .il-exbtn').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_site_link_v1').map(x=>[x[1].p.decision,x[1].p.deal_id]).at(-1)),['same','d-ex1']);
  assert.match(await page.locator('#inq-v3 .il-ex').innerText(),/^같은 공사 · 공종 미분류 건에 붙임[\s\S]*붙임 ✓/);
  assert.equal(await row('한강신도시반도유보라').locator('.il-act').innerText(),'영업건 보기');assert.match(await row('한강신도시반도유보라').locator('.il-el').innerText(),/기존 영업건에 붙임$/);
  assert.match(String(await page.evaluate(()=>autoPromote(inqCtlFind(A,false)))),/기존 영업건에 붙인 문의입니다/,'붙인 문의는 새 영업건을 만들지 않음');
  await page.locator('#inq-v3 .il-exbtn').click();await page.waitForTimeout(400);
  assert.equal(await page.evaluate(()=>inqCtlFind(A,false).raw['기존 영업건']),undefined,'다시 누르면 되돌림');assert.notEqual(await row('한강신도시반도유보라').locator('.il-act').innerText(),'영업건 보기','되돌리면 원래 할 일로');
  /* 서버 함수가 없으면 판단 버튼을 막는다 */
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>n!=='crm_inquiry_site_link_v1'});paint();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#inq-v3 .il-exbtn').isDisabled(),true);assert.match(await page.locator('#inq-v3 .il-exfoot').innerText(),/서버 적용 뒤에 고를 수 있습니다/);
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>true});delete window.TOKEN;});
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.inqV3Off=true;paint();});await page.waitForTimeout(400);
  assert.equal(await page.locator('#inq-v3').count(),0);assert.equal(await page.locator('#inq-v2 .iv-row').count()>0,true,'끄면 v2 목록');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',tabs7:true,sort_by_received:true,elapsed_rule_year:true,row_buttons:true,row_expand:true,inline_result_requires_both:true,detail_inline_edit_gated:true,detail_result_chips:true,button_colors:true,existing_site_decision:true,need9:true,head_chips:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
