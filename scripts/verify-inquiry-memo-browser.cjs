'use strict';
/* 견적문의 · 과거 메모의 통화 · 약속 확인 (2026-10-08 design_handoff_inquiry_memo · 시안 '견적문의 과거 약속 확인 시안')
   합성 자료 6건(이름 · 현장은 지어낸 것): 담당 없음 2(하나는 이관 메모 있음) · 이관 메모가 있는 후속 1(천안두정: 실제 연결일 = 접수일 복사) · 후속 1(문흥라인동산: 8일 전 밤 통화) · 연락처 없는 과거 문의 1.
   확인: 상단 문구 / 기본 정렬 급한 순(① 신규 첫 연락 → ② 고객 약속 · 회의 → ③ 후속 기한 → ④ 과거 기록 정리) · 오래된 순 · 최근 순 선택 / 줄 오른쪽 세 줄 · 한국 날짜 일수
   / 연락처 없는 과거 문의 = '연락처 보완' 상태 · 후속 연락 필요에서 빠짐 / 날짜 3개 · 메모 원문 표시(통화 노랑 · 약속 파랑) · 보완은 담당 확정 시만 · 원래 값 보존
   / 과거 약속 확인함(완료 = 기록만 · 미완료 = 지금 할 일 · 확인 불가 = 첫 통화에서 물어볼 것) · 첫마디 · 서버 저장 · 서버에서 읽은 판단 / 글 잘림 없음 / 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryListV3&&window.InquiryDetailV2&&window.InquiryWorkbench&&window.InquiryMemo&&window.InquiryV4);
  await page.evaluate(()=>{
   const kd=n=>InquiryMemo.addDays(InquiryMemo.today(),n),at=(d,h)=>new Date(Date.now()-d*864e5-(h||0)*36e5).toISOString();
   const NEW='11111111-1111-4111-8111-111111111111',ANS='22222222-2222-4222-8222-222222222222',MUN='33333333-3333-4333-8333-333333333333',NOPH='44444444-4444-4444-8444-444444444444',UNA='55555555-5555-4555-8555-555555555555',OK='66666666-6666-4666-8666-666666666666';
   B={deals:[],inquiries:[
    {id:NEW,site:'[서울 성북] 길음뉴타운9단지',status:'접수',at:at(0,3),created_at:at(0,3),brand:'POUR솔루션',phone:'010-2281-4402',contact_name:'정미경',raw:{'문의내용':'옥상 방수 견적 요청드립니다.','상담채널':'홈페이지'}},
    {id:UNA,site:'[광주] 담당 미정 이관단지',status:'접수',at:at(2),created_at:at(2),brand:'POUR솔루션',phone:'010-7777-1212',contact_name:'관리소장',raw:{'문의내용':'옥상 방수 문의','상담채널':'전화','응대내용':'['+kd(-7)+' 10:00:00] 관리소장 통화 완료. 견적서 보내기로 함.'}},
    {id:ANS,site:'[충남 천안] 천안두정E편한세상2차',status:'배정완료',at:'2026-01-06T09:00:00+09:00',created_at:'2026-01-06T09:00:00+09:00',brand:'POUR솔루션',phone:'041-555-1234',contact_name:'관리소장',assignee:'이필선',assigned_to:'이필선',assigned_at:'2026-01-06T10:00:00+09:00',responded_at:'2026-01-06T09:00:00+09:00',raw:{'문의내용':'옥상 누수 3세대','상담채널':'전화','응대내용':'[2026-01-07 10:00:00] 관리소장 통화 완료. 옥상 누수 3세대. 사진 이메일로 받기로 함. 다음 날 방문 가능하다고 함.'}},
    {id:MUN,site:'[광주] 문흥라인동산',status:'배정완료',at:at(20),created_at:at(20),brand:'석민이앤씨',phone:'062-555-7788',contact_name:'관리소장',assignee:'정정훈',assigned_to:'정정훈',assigned_at:at(19.9),responded_at:kd(-8)+'T23:30:00+09:00',raw:{'문의내용':'외벽 재도장 견적','상담채널':'전화'},activities:[{type:'전화',note:'[전화 · 연결됨] 견적 범위 확인',at:kd(-8)+'T23:30:00+09:00',actor:'정정훈'}]},
    {id:NOPH,site:'[경기] 문의-0486',status:'접수',at:at(5),created_at:at(5),brand:'POUR솔루션',phone:'',contact_name:'',raw:{'문의내용':'방수 문의','상담채널':'홈페이지','응대내용':'[2026-02-03 10:00:00] 관리소장 010-3333-4444 번호로 통화 완료.'}},
    {id:OK,site:'[부산] 메모 없는 단지',status:'배정완료',at:at(3),created_at:at(3),brand:'POUR공법',phone:'051-222-3344',contact_name:'관리소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(2.9),responded_at:at(2),raw:{'문의내용':'공법 설명 요청','상담채널':'홈페이지'},activities:[{type:'전화',note:'[전화 · 연결됨] 자료 안내',at:at(2),actor:'이필선'}]}],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;G.inqDetailV3Off=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqV3=null;G.inqV4=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   window.__rpc=[];window.__reviews=[];
   SB={rpc:async(name,args)=>{__rpc.push([name,args]);
    if(name==='crm_inquiry_memo_review_v1'){const p=args.p;return {data:{ok:true,type:p.type,inquiry_id:p.inquiry_id,review:{kind:p.type==='promise'?'promise':'call',item_key:p.item_key,title:p.title||'',result:p.result||null,on_date:p.on_date||null}}};}
    if(name==='crm_inquiry_field_update_v1'){const p=args.p;return {data:{ok:true,inquiry_id:p.inquiry_id,field:p.field,value:p.value,raw_key:null}};}
    if(name==='crm_inquiry_memo_review_list_v1')return {data:{ok:true,reviews:__reviews}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>!/^crm_inquiry_(command|flow_list)_v1$/.test(n),noteMissing:()=>{}});
   goPage('inq');Object.assign(window,{NEW,ANS,MUN,NOPH,UNA,OK});
  });
  await page.waitForTimeout(600);
  const one=s=>String(s||'').replace(/\s+/g,' ').trim();
  const V=page.locator('#inq-v4'),rows=()=>V.locator('.i4-row'),det=V.locator('.i4-detail');
  const sites=()=>V.locator('.i4-row .site').evaluateAll(l=>l.map(b=>b.textContent.replace(/^\[[^\]]*\]\s*/,'')));
  const tabNums=()=>V.locator('.i4-tab b.n').evaluateAll(l=>l.map(b=>Number(b.textContent)));
  /* ⑤ 상단 문구 */
  assert.equal(one(await page.locator('.il-fixed').first().innerText()),'응대는 즉시 (배정 30분 · 첫 연락 2시간) · 기록 점검 12시');
  assert.equal(await page.locator('body').evaluate(b=>/12시까지 결과/.test(b.innerText)),false,'예전 문구는 사라짐');
  /* ④ 기본 정렬 = 급한 순 · 선택지 3개 */
  assert.deepEqual(await V.locator('.i4-sorts button').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-pressed')])),[['급한 순','true'],['오래된 순','false'],['최근 순','false']]);
  assert.equal(one(await V.locator('.i4-flags .cnt').innerText()),'6건 · 급한 순 · ↑ ↓ 이동');
  assert.deepEqual(await sites(),['담당 미정 이관단지','길음뉴타운9단지','천안두정E편한세상2차','문흥라인동산','메모 없는 단지','문의-0486']);
  /* 줄 오른쪽 세 줄 · 한국 날짜 일수 */
  const c3=await V.locator('.i4-row .c3').evaluateAll(l=>l.map(c=>[...c.children].map(x=>x.textContent.replace(/\s+/g,' ').trim())));
  assert.deepEqual(c3.map(x=>x[0]),['① 신규 첫 연락','① 신규 첫 연락','② 고객 약속 · 회의','③ 후속 기한','③ 후속 기한','④ 과거 기록 정리']);
  assert.match(c3[0][1],/^배정 기한 \d+(시간|일) 지남$/);
  assert.equal(c3[2][1],'과거 통화일 확인 필요 · 메모에 1.7 통화','천안두정: 실제 연결일 = 접수일 복사 → 확인 필요');assert.equal(c3[2][2],'메모 약속 2건 확인 전');
  assert.match(c3[3][1],/^실제 연결 후 8일 · \d+\.\d+ 통화$/,'밤 11시 반 통화: 시간으로는 8일이 안 됐어도 한국 날짜로 8일');
  assert.deepEqual(c3[5].slice(1),['연락처 없음 · 연락처 보완 먼저','기한 없음']);
  /* 상태 탭 6칸: 연락처 없는 과거 문의는 후속 연락 필요에서 빠지고 '연락처 보완' */
  assert.deepEqual((await V.locator('.i4-tab').allInnerTexts()).map(one).map(t=>t.replace(/ \S.*$/,'')),['6','2','0','2','1','1']);
  assert.deepEqual(await tabNums(),[6,2,0,2,1,1]);{const n=await tabNums();assert.equal(n[1]+n[2]+n[3]+n[4]+n[5],n[0]);}
  await V.locator('[data-i4="tab"][data-v="nocontact"]').click();await page.waitForTimeout(120);
  assert.deepEqual(await sites(),['문의-0486']);
  await V.locator('[data-i4="tab"][data-v="stale"]').click();await page.waitForTimeout(120);
  assert.equal((await sites()).includes('문의-0486'),false,'후속 연락 필요에 없음');
  await V.locator('[data-i4="tab"][data-v="all"]').click();
  /* 정렬 선택지: 오래된 순 · 최근 순 */
  await V.locator('[data-i4="sort"][data-v="old"]').click();await page.waitForTimeout(120);assert.equal((await sites())[0],'천안두정E편한세상2차');
  await V.locator('[data-i4="sort"][data-v="new"]').click();await page.waitForTimeout(120);assert.equal((await sites())[0],'길음뉴타운9단지');
  await V.locator('[data-i4="sort"][data-v="urgent"]').click();await page.waitForTimeout(120);
  /* 글 잘림 없음: 줄 오른쪽 · 상세 새 칸 */
  const clip=async sel=>page.evaluate(s=>[...document.querySelectorAll(s)].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.className+':'+e.textContent.slice(0,30)),sel);
  assert.deepEqual(await clip('#inq-v4 .i4-row .c3, #inq-v4 .i4-row .c3 *'),[],'줄 오른쪽 글이 잘리지 않는다');
  /* ① 날짜 3개 · 메모 원문 표시 · ② 과거 약속 확인함 (천안두정) */
  await V.locator('.i4-row',{hasText:'천안두정'}).click();await page.waitForTimeout(150);
  assert.deepEqual(await det.locator('.im-cell').evaluateAll(l=>l.map(c=>[...c.children].map(x=>x.textContent.replace(/\s+/g,' ').trim()))),[['접수일','2026.1.6','구글시트 접수 · 바뀌지 않음'],['실제 연결일','확인 필요','지금 1.6로 저장됨 = 접수일 복사'],['메모 속 통화','2026.1.7','이관 메모에서 찾음 · 보완 후보']]);
  assert.deepEqual([await det.locator('mark.im-call').allInnerTexts(),await det.locator('mark.im-pro').allInnerTexts()],[['관리소장 통화 완료'],['사진 이메일로 받기로 함','다음 날 방문 가능하다고 함']]);
  assert.match(one(await det.locator('.im-src').first().innerText()),/^이관 메모 · 2026\.1\.7 · 원문$/);
  assert.match(one(await det.locator('.im-prom .lb').innerText()),/^과거 약속 확인함 0 \/ 2$/);
  assert.deepEqual(await det.locator('.im-pt b').allInnerTexts(),['사진 이메일로 받기','다음 날 현장 방문']);
  assert.match(one(await det.locator('.i4-line').innerText()),/^AI 첫마디 ?"안녕하세요, 넷폼 이필선입니다\. 1월에 사진 이메일로 받기로, 다음 날 현장 방문하기로 했었는데, 그 뒤 진행 상황 여쭤보려고 연락드렸습니다\."$/);
  assert.match(one(await det.locator('.i4-pill').innerText()),/^후속 연락 필요 · 과거 통화일 확인 필요 · 메모에 1\.7 통화$/);
  assert.deepEqual(await clip('#inq-v4 .im-cell, #inq-v4 .im-cell *, #inq-v4 .im-btn, #inq-v4 .im-ps button, #inq-v4 .im-pt *'),[],'새 칸의 글이 잘리지 않는다');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'inq-memo.png')});
  /* 보완: 원래 값 보존 · 첫 연락 판정은 그대로 */
  const fcBefore=await page.evaluate(()=>InquiryFlow.firstConnectedAt(B.inquiries.find(q=>q.id===ANS)));
  assert.equal(await det.locator('[data-i4="memo-call"]').innerText(),'1.7 통화로 실제 연결일 보완');
  await det.locator('[data-i4="memo-call"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await det.locator('.im-cell').evaluateAll(l=>l.map(c=>[...c.children].map(x=>x.textContent.replace(/\s+/g,' ').trim()))).then(x=>x[1]),['실제 연결일','2026.1.7','메모 통화로 보완 · 원래 값 1.6 이력에 남음']);
  assert.equal(await page.evaluate(()=>InquiryFlow.firstConnectedAt(B.inquiries.find(q=>q.id===ANS))),fcBefore,'첫 연락(최초 응대) 판정 값은 그대로');
  assert.equal(await det.locator('[data-i4="memo-call"]').isDisabled(),true);assert.equal(one(await det.locator('[data-i4="memo-call"]').innerText()),'1.7 통화로 보완됨');
  assert.match(await det.locator('.i4-log').innerText(),/\[메모 통화 보완\] 메모에서 찾은 1\.7 통화로 실제 연결일을 보완했습니다 — 원래 값: 1\.6 \(접수일 복사\)/,'응대 이력에 원래 값과 함께 남음');
  assert.match(one(await det.locator('.i4-pill').innerText()),/^후속 연락 필요 · /);assert.doesNotMatch(await det.locator('.i4-pill').innerText(),/확인 필요/);
  assert.match(one(await det.locator('.i4-pill').innerText()),/^후속 연락 필요 · 실제 연결 후 2\d\d일 · 1\.7 통화$/,'보완한 날짜를 실제 연결로 센다');
  {const call=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_memo_review_v1').map(x=>x[1].p));assert.equal(call.length,1);assert.deepEqual([call[0].type,call[0].on_date,call[0].inquiry_id,/^c-/.test(call[0].item_key)],['call_supplement','2026-01-07',ANS_ID(),true]);}
  function ANS_ID(){return '22222222-2222-4222-8222-222222222222';}
  /* 약속: 미완료 = 지금 할 일 등록 · 완료 = 기록만 · 확인 불가 = 첫 통화에서 물어볼 것 */
  const before=await page.evaluate(()=>__writes.length);
  await det.locator('.im-p',{hasText:'사진 이메일로 받기'}).locator('button',{hasText:/^미완료$/}).click();await page.waitForTimeout(250);
  assert.match(one(await det.locator('.im-prom .lb').innerText()),/^과거 약속 확인함 1 \/ 2$/);
  assert.match(one(await det.locator('.im-p').first().locator('.im-pr').innerText()),/^미완료 · 지금 할 일로 등록/);
  assert.equal(await page.evaluate(()=>{const q=B.inquiries.find(x=>x.id===ANS),a=actionObj(q,itemPatch(q,'inq'));return a&&a.text;}),'[과거 약속] 사진 이메일로 받기 다시 확인','미완료만 지금 할 일로');
  assert.ok(await page.evaluate(b=>__writes.length>b,before),'다음 할 일 저장 명령이 나감');
  const w1=await page.evaluate(()=>__writes.length);
  await det.locator('.im-p',{hasText:'다음 날 현장 방문'}).locator('button',{hasText:/^완료$/}).click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>__writes.length),w1,'완료는 기록만 — 새 업무를 만들지 않는다');
  assert.match(one(await det.locator('.im-p').nth(1).locator('.im-pr').innerText()),/^완료 기록 · 업무 안 만듦$/);
  await det.locator('.im-p',{hasText:'다음 날 현장 방문'}).locator('button',{hasText:'확인 불가'}).click();await page.waitForTimeout(250);
  assert.deepEqual(await det.locator('.im-ask span').allInnerTexts(),['· 다음 날 현장 방문 — 했는지 확인']);assert.equal(one(await det.locator('.im-ask b').innerText()),'첫 통화에서 물어볼 것');
  assert.equal(await page.evaluate(()=>{const q=B.inquiries.find(x=>x.id===ANS),a=actionObj(q,itemPatch(q,'inq'));return a&&a.text;}),'[과거 약속] 사진 이메일로 받기 다시 확인','확인 불가도 새 업무를 만들지 않는다');
  assert.match(one(await det.locator('.i4-line').innerText()),/1월에 사진 이메일로 받기로, 다음 날 현장 방문하기로 했었는데/,'미완료 · 확인 불가는 첫마디에 남는다');
  if(process.env.SHOT_DIR){await det.locator('.im-prom').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.SHOT_DIR,'inq-memo2.png')});}
  await det.locator('.im-p',{hasText:'다음 날 현장 방문'}).locator('button',{hasText:/^완료$/}).click();await page.waitForTimeout(250);
  assert.match(one(await det.locator('.i4-line').innerText()),/1월에 사진 이메일로 받기로 했었는데/);assert.equal(await det.locator('.im-ask').count(),0);
  /* 서버 저장 · 서버에서 읽은 판단 */
  {const sent=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_memo_review_v1').map(x=>[x[1].p.type,x[1].p.title,x[1].p.result]));
   assert.deepEqual(sent,[['call_supplement',undefined,undefined],['promise','사진 이메일로 받기','미완료'],['promise','다음 날 현장 방문','완료'],['promise','다음 날 현장 방문','확인 불가'],['promise','다음 날 현장 방문','완료']]);}
  /* 담당이 정해지지 않은 문의: 보완 · 판단 단추는 눌리지 않는다 */
  await V.locator('.i4-row',{hasText:'담당 미정 이관단지'}).click();await page.waitForTimeout(150);
  assert.deepEqual([await det.locator('[data-i4="memo-call"]').isDisabled(),await det.locator('.im-ps button:not([disabled])').count()],[true,0]);
  assert.match(one(await det.locator('.im-note').innerText()),/담당이 정해진 뒤에 보완할 수 있습니다/);
  /* 메모가 없는 문의에는 새 칸이 없다 */
  await V.locator('.i4-row',{hasText:'메모 없는 단지'}).click();await page.waitForTimeout(150);
  assert.deepEqual([await det.locator('.im-d3').count(),await det.locator('.im-memo').count(),await det.locator('.im-prom').count()],[0,0,0]);
  assert.match(one(await det.locator('.i4-line').innerText()),/^AI 첫마디 ?"안녕하세요, 넷폼 이필선입니다\. 문의 주신 /,'약속이 없으면 지금 첫마디 그대로');
  /* 연락처 없는 과거 문의: 이관 기록에서 번호 후보 → 저장하면 후속 연락 목록으로 */
  await V.locator('.i4-row',{hasText:'문의-0486'}).click();await page.waitForTimeout(150);
  assert.equal(one(await det.locator('.im-find .lb').innerText()),'연락처 보완 · 이관 기록 확인 연락처가 없어 연락할 수 없습니다 — 이관 기록에서 번호를 찾아 보세요');
  assert.equal(await det.locator('.im-ph').count(),0,'찾기 전에는 후보를 보이지 않는다');
  await det.locator('[data-i4="phone-find"]').click();await page.waitForTimeout(120);
  assert.deepEqual(await det.locator('.im-ph').evaluateAll(l=>l.map(r=>[...r.children].slice(0,2).map(x=>x.textContent))),[['010-3333-4444','이관 메모 · 시트 원문']]);
  assert.deepEqual(await clip('#inq-v4 .im-find, #inq-v4 .im-find *'),[],'연락처 찾기 글이 잘리지 않는다');
  await det.locator('[data-i4="phone-save"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_field_update_v1').map(x=>[x[1].p.field,x[1].p.value])),[['phone','010-3333-4444']]);
  assert.deepEqual(await tabNums(),[6,3,0,2,1,0],'연락처를 찾으면 연락처 보완에서 빠진다');
  assert.equal((await sites()).includes('문의-0486'),true);
  /* 노트북 · 좁은 화면에서도 줄 오른쪽 글이 잘리지 않는다 */
  for(const w of [1200,1000]){await page.setViewportSize({width:w,height:800});await page.waitForTimeout(200);await page.evaluate(()=>{InquiryV4.state().detail=false;InquiryV4.render();});assert.deepEqual(await clip('#inq-v4 .i4-row .c3, #inq-v4 .i4-row .c3 *'),[],'폭 '+w+': 줄 오른쪽 글이 잘리지 않는다');}
  await page.setViewportSize({width:1600,height:1000});await page.waitForTimeout(200);
  /* 서버가 내려 준 판단 읽기: 이 PC 의 판단을 지워도 서버 값으로 같은 화면 */
  await page.evaluate(()=>{const q=B.inquiries.find(x=>x.id===ANS);const p=detailPatchFor('inq',inqKey(q));delete p.memoReview;
   __reviews.push({inquiry_id:ANS,kind:'promise',item_key:InquiryMemo.scan(q).promises[0].key,title:'사진 이메일로 받기',source_text:'x',on_date:'2026-01-07',result:'완료',decided_by:'이필선',decided_at:new Date().toISOString()},{inquiry_id:ANS,kind:'call',item_key:InquiryMemo.scan(q).calls[0].key,title:'',source_text:'x',on_date:'2026-01-07',result:null,original_at:'2026-01-06T09:00:00+09:00',decided_by:'이필선',decided_at:new Date().toISOString()});});
  await page.evaluate(async()=>{await InquiryMemo.load(true);InquiryV4.fresh();paint();});await page.waitForTimeout(200);
  await V.locator('.i4-row',{hasText:'천안두정'}).click();await page.waitForTimeout(150);
  assert.match(one(await det.locator('.im-prom .lb').innerText()),/^과거 약속 확인함 1 \/ 2$/,'서버 판단이 보인다');
  assert.equal((await det.locator('.im-cell').nth(1).locator('b').innerText()),'2026.1.7','서버의 보완 날짜가 보인다');
  /* 끄면: 새 칸 · 문장이 사라진다 */
  assert.deepEqual(await page.evaluate(()=>{G.inqMemoOff=true;InquiryV4.fresh();paint();return [document.querySelectorAll('#inq-v4 .im-prom, #inq-v4 .im-d3, #inq-v4 .im-memo').length];}),[0]);
  await page.evaluate(()=>{G.inqMemoOff=false;InquiryV4.fresh();paint();});
  /* 한국 날짜 일수는 접속 PC 의 시간대와 무관 */
  const la=await browser.newContext({timezoneId:'America/Los_Angeles'});const lp=await la.newPage();await lp.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  await lp.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await lp.waitForFunction(()=>window.InquiryMemo);
  assert.deepEqual(await lp.evaluate(()=>[InquiryMemo.diff('2026-09-30T23:30:00+09:00','2026-10-08T10:00:00+09:00'),InquiryMemo.days('2026-09-30T23:30:00+09:00','2026-10-08T10:00:00+09:00'),InquiryMemo.span('2026-09-30T23:30:00+09:00','2026-10-08T10:00:00+09:00'),InquiryMemo.md('2026-01-07T00:10:00+09:00')]),[8,8,'8일','1.7']);
  await la.close();
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('inquiry memo ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
