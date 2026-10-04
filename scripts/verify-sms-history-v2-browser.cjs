'use strict';
/* 문자 · 캠페인 · 발송 이력 v2 검사(2026-10-04 design_handoff_sms_history · 문자 발송 이력 v2.dc.html)
   공통 고정 필터줄 하나(브랜드 · 보낸 사람 · 검색) + 기간 → 목록과 숫자를 같이 거른다 / 위 탭 3개는 기존 화면 연결 / 'DELIVERY HISTORY' · 연도 줄 · 'Stage' 없음
   숫자 4개(테스트 · 직접 발송 제외) / 7일 안 반응 = 응대 이력의 통화 · 회신 · 단계 이동(사람당 1번, 서버 response_count 를 쓰지 않는다)
   줄을 누르면 문구 전체 + 받은 사람별 발송 결과 · 이후 반응 + [실패 n명만 다시 보내기]. 받은 사람 목록이 없는 발송은 '-'(지어내지 않는다). 끄면 예전 화면. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:940},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.SmsHistoryV2&&window.SmsV2&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const T=(d,t)=>d+'T'+t+':00+09:00';
   const deal=(n,site,brand,acts)=>({id:'d000000'+n+'-0000-4000-8000-00000000000'+n,site,brand,assignee:'이필선',stage:'자료 발송완료',code:'sent',grp:'진행',created:'2026-08-01',amt:0,activities:acts||[]});
   const D=[deal(1,'서울체육고','POUR솔루션',[{type:'전화',result:'검토 중',at:T('2026-10-03','11:00')}]),
     deal(2,'길음뉴타운9','POUR솔루션',[{type:'문자',result:'방문 요청 회신',note:'고객 회신',at:T('2026-10-02','15:00')},{type:'단계전환',note:'자료 발송완료 → 경쟁·입찰',at:T('2026-10-05','09:00')}]),
     deal(3,'오뚜기 포승공장','POUR솔루션',[]),
     deal(4,'한강반도유보라','석민이앤씨',[{type:'전화',result:'추가 공사 문의',at:T('2026-09-29','10:00')},{type:'전화',result:'한 번 더 통화',at:T('2026-09-30','10:00')}]),
     deal(5,'평동동남','석민이앤씨',[{type:'전화',result:'8일 뒤 통화(반응 아님)',at:T('2026-10-05','10:00')},{type:'문자',result:'회신대기',note:'우리가 보낸 문자(반응 아님)',at:T('2026-09-27','10:00')}]),
     deal(6,'성원상떼뷰','POUR솔루션',[{type:'메모',note:'내부 메모(반응 아님)',at:T('2026-07-11','10:00')}])];
   const rc=(d,name,status,err)=>({recipient_key:'k'+d.id,opportunity_id:d.id,site_name:d.site,contact_name:name,status,last_error:err||null});
   B={deals:D,inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],campaigns:[
    {id:'c1',category_key:'sent',category:'견적 발송 후 7일 · 수신 확인',body:'소장님, 넷폼입니다. 보내드린 견적 잘 받아보셨는지요?\n검토 중 궁금하신 점 편하게 연락 주세요.',status:'partial',recipient_count:3,sent_count:2,failed_count:1,response_count:99,stage_advanced_count:99,created_by:'이필선',created_at:T('2026-10-02','10:20'),recipients:[rc(D[0],'박민준 과장','sent'),rc(D[1],'정미경 소장','sent'),rc(D[2],'관리사무소','failed','번호 확인 필요')]},
    {id:'c2',category_key:'chuseok',category:'추석 인사 · 수주 고객',body:'소장님, 넷폼입니다. 풍성한 한가위 보내세요.',status:'sent',recipient_count:2,sent_count:2,failed_count:0,created_by:'송보람',created_at:T('2026-09-26','15:00'),recipients:[rc(D[3],'김영호 소장','sent'),rc(D[4],'이OO 소장','sent')]},
    {id:'c3',category_key:'y1',category:'견적 후 3개월 · 안부',body:'소장님, 넷폼입니다. 진행 상황 여쭤보려고 연락드립니다.',status:'sent',recipient_count:38,sent_count:38,failed_count:0,created_by:'한준엽',created_at:T('2026-07-10','11:30')},
    {id:'c4',category_key:'all',category:'기타',category_group:'전체 발송',body:'[영업운영 CRM] 알리고 예약 발송 테스트',status:'sent',recipient_count:1,sent_count:1,failed_count:0,created_by:'송보람',created_at:T('2026-09-19','13:43')},
    {id:'c5',category_key:'lost',category:'실주 고객 — 재제안',body:'예약해 둔 문자',status:'scheduled',recipient_count:5,created_by:'송보람',created_at:T('2026-10-03','09:00'),scheduled_at:T('2026-10-10','09:00')},
    {id:'c6',category_key:'yearend',category:'작년 연말 인사',body:'작년 문자',status:'sent',recipient_count:10,sent_count:10,failed_count:0,created_by:'송보람',created_at:T('2025-12-15','09:00')}]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'a1',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   try{CAMPAIGN_STORE.campaigns=[];}catch(e){}
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';window.syncCampaignNow=()=>{};
   goPage('campaign');campaignSetTab('history');
  });
  await page.waitForTimeout(600);
  const pg=page.locator('#pg-campaign'),v=pg.locator('.sh2');
  /* 1. 예전 것 없음: DELIVERY HISTORY · 연도 줄 · Stage · 청록 버튼 줄 */
  const text=await pg.innerText();
  assert.ok(!/DELIVERY HISTORY|Stage|발송연도|발송 현황|성과 보기/.test(text),'예전 머리말 · 연도 줄 · Stage 표시가 없어야 한다');
  assert.equal(await pg.locator('.cc-utility,.cc-years,.cc-history').count(),0);
  assert.equal(await page.locator('#unibar').evaluate(n=>getComputedStyle(n).display),'none','예전 상단 두 줄 필터(브랜드 · 담당자 구분 · 연도)는 감춘다');
  assert.equal(await page.locator('#psub').innerText(),'발송 이력 · 줄을 누르면 문구와 받은 사람별 결과가 열립니다');
  /* 2. 공통 고정 필터줄 하나: 브랜드 · 보낸 사람 · 검색 */
  assert.equal(await pg.locator(':scope>.cf-bar:visible').count(),1,'필터줄은 하나');
  const bar=pg.locator(':scope>.cf-bar');
  assert.deepEqual(await bar.locator('[data-sf-brand]').allInnerTexts(),['전체','석민이앤씨','POUR솔루션','POUR공법','아파트스퀘어']);
  assert.equal(await bar.locator('.sh2-lab').innerText(),'보낸 사람');
  assert.deepEqual(await bar.locator('[data-sh2-who]').first().evaluate(n=>[n.textContent,n.getAttribute('aria-pressed')]),['전체','true']);
  assert.deepEqual((await bar.locator('[data-sh2-who]').allInnerTexts()).slice().sort(),['송보람','이필선','전체','한준엽']);
  assert.equal(await bar.locator('.cf-search').getAttribute('placeholder'),'현장 · 받은 사람 · 문구 검색');
  /* 3. 위 탭 3개 · 기간(이번 분기가 기본) */
  assert.equal(await v.locator('.sh2-top>b').innerText(),'문자 · 캠페인');
  assert.deepEqual(await v.locator('.sh2-pages button').evaluateAll(l=>l.map(n=>[n.textContent,n.getAttribute('aria-selected')])),[['묶음 · 보내기','false'],['발송 이력','true'],['성과','false']]);
  assert.deepEqual(await v.locator('.sh2-periods button').evaluateAll(l=>l.map(n=>[n.textContent,n.getAttribute('aria-pressed')])),[['이번 달','false'],['이번 분기','true'],['2026','false'],['전체','false']]);
  /* 4. 이번 분기(10~12월): c5 예약 · c1 — 숫자는 실제로 보낸 묶음만(c1), 응대 이력에서 센 반응 2명(서버 response_count 99 를 쓰지 않는다) */
  const kpi=()=>v.locator('.sh2-kpi').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent)));
  assert.deepEqual(await kpi(),[['보낸 묶음','1건','테스트 · 직접 발송 제외'],['받은 사람','3명','성공 2 · 실패 1'],['7일 안 반응','67%','2명 · 통화 · 회신 · 단계 이동'],['반응 → 단계 이동','1건','문자 뒤 실제 영업이 움직인 건']]);
  assert.deepEqual(await v.locator('.sh2-head span').allInnerTexts(),['보낸 시각','묶음 · 문구','보낸 사람','받은 사람','7일 안 반응','상태']);
  const rows=()=>v.locator('.sh2-row').evaluateAll(l=>l.map(n=>[n.querySelector('.sh2-when b').textContent,n.querySelector('.sh2-when span').textContent,n.querySelector('.sh2-kind').textContent,n.querySelector('.sh2-main b').textContent,n.querySelector('.sh2-who').textContent,n.querySelector('.sh2-n').innerText.replace(/\n/g,'|'),n.querySelector('.sh2-resp>span').innerText.trim(),n.querySelector('.sh2-st em').textContent]));
  assert.deepEqual(await rows(),[['2026.10.3','09:00','재활성','실주 고객 — 재제안','송보람','5명|결과 확인 전','- 받은 사람 목록 없음','예약'],['2026.10.2','10:20','병목','견적 발송 후 7일 · 수신 확인','이필선','3명|성공 2 · 실패 1','2명 · 67% 단계 이동 1','일부 실패']]);
  assert.equal(await v.locator('.sh2-row').nth(1).locator('.sh2-bar i').evaluate(n=>n.style.width),'100%');
  assert.deepEqual(await v.locator('.sh2-main>span:last-child').evaluateAll(l=>l.map(n=>getComputedStyle(n).color)),['rgb(107, 114, 128)','rgb(107, 114, 128)'],'문구 첫 줄은 회색');
  /* 5. 줄을 누르면 문구 전체 + 받은 사람별 결과 · 이후 반응 + 실패만 다시 보내기 */
  await v.locator('.sh2-row').nth(1).click();await page.waitForTimeout(150);
  const it=v.locator('.sh2-item.on');
  assert.match(await it.locator('.sh2-body').innerText(),/잘 받아보셨는지요\?\n검토 중 궁금하신 점/);
  assert.deepEqual(await it.locator('.sh2-rh span').allInnerTexts(),['받은 사람 · 현장','발송','이후 반응']);
  assert.deepEqual(await it.locator('.sh2-rv').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent.trim()))),[['박민준 과장 서울체육고','성공','10.3 통화 · 검토 중'],['정미경 소장 길음뉴타운9','성공','10.2 회신 · 방문 요청 회신'],['관리사무소 오뚜기 포승공장','실패','번호 확인 필요']]);
  assert.equal(await it.locator('.sh2-rf button[data-sh2="resend"]').innerText(),'실패 1명만 다시 보내기');
  if(shot)await page.screenshot({path:shot+'-history.png'});
  await page.evaluate(()=>{window.__custom=[];SmsV2.openCustom=(t,k)=>__custom.push([t,[...k].length]);});
  await it.locator('[data-sh2="resend"]').click();
  assert.deepEqual(await page.evaluate(()=>__custom),[['견적 발송 후 7일 · 수신 확인 · 실패 1명 다시 보내기',1]],'실패한 사람만 보내기 창으로 넘긴다');
  /* 6. 기간 = 목록 + 숫자 같이: 올해 → 9월 추석(반응 1명: 7일 넘은 통화 · 같은 사람 두 번은 1번) · 7월 안부(받은 사람 목록 없음) · 테스트는 숫자 제외 */
  await v.locator('.sh2-periods button',{hasText:'2026'}).click();await page.waitForTimeout(150);
  assert.deepEqual((await rows()).map(r=>[r[0],r[2],r[3],r[5],r[6],r[7]]),[['2026.10.3','재활성','실주 고객 — 재제안','5명|결과 확인 전','- 받은 사람 목록 없음','예약'],['2026.10.2','병목','견적 발송 후 7일 · 수신 확인','3명|성공 2 · 실패 1','2명 · 67% 단계 이동 1','일부 실패'],['2026.9.26','시즌','추석 인사 · 수주 고객','2명|모두 성공','1명 · 50%','발송 완료'],['2026.9.19','직접 발송','묶음 없이 보냄','1명|모두 성공','-','테스트'],['2026.7.10','장기 관계','견적 후 3개월 · 안부','38명|모두 성공','- 받은 사람 목록 없음','발송 완료']]);
  assert.deepEqual(await kpi(),[['보낸 묶음','3건','테스트 · 직접 발송 제외'],['받은 사람','43명','성공 42 · 실패 1'],['7일 안 반응','7%','3명 · 통화 · 회신 · 단계 이동'],['반응 → 단계 이동','1건','문자 뒤 실제 영업이 움직인 건']]);
  await v.locator('.sh2-row').nth(4).click();await page.waitForTimeout(120);
  assert.equal(await v.locator('.sh2-item.on .sh2-rf>span').innerText(),'받은 사람 목록이 남아 있지 않은 발송입니다 · 건수만 표시합니다');assert.equal(await v.locator('.sh2-item.on [data-sh2="resend"]').count(),0);
  await v.locator('.sh2-periods button',{hasText:'전체'}).click();await page.waitForTimeout(120);assert.equal(await v.locator('.sh2-row').count(),6);
  await v.locator('.sh2-periods button',{hasText:'이번 달'}).click();await page.waitForTimeout(120);assert.equal(await v.locator('.sh2-row').count(),2);
  /* 7. 보낸 사람 · 브랜드 · 검색도 목록과 숫자를 같이 거른다 */
  await v.locator('.sh2-periods button',{hasText:'2026'}).click();await page.waitForTimeout(120);
  await bar.locator('[data-sh2-who]',{hasText:'송보람'}).click();await page.waitForTimeout(150);
  assert.deepEqual((await rows()).map(r=>r[3]),['실주 고객 — 재제안','추석 인사 · 수주 고객','묶음 없이 보냄']);assert.deepEqual((await kpi()).map(k=>k[1]),['1건','2명','50%','0건']);
  await bar.locator('[data-sh2-who]',{hasText:'전체'}).click();await page.waitForTimeout(150);
  await bar.locator('[data-sf-brand="석민이앤씨"]').click();await page.waitForTimeout(250);
  assert.ok((await rows()).some(r=>r[3]==='추석 인사 · 수주 고객')&&!(await rows()).some(r=>r[3]==='견적 발송 후 7일 · 수신 확인'),'브랜드로 거른다(받은 사람의 현장 브랜드)');
  assert.equal(await bar.locator('[data-sf-brand="석민이앤씨"]').getAttribute('aria-pressed'),'true');
  await bar.locator('[data-sf-brand="전체"]').click();await page.waitForTimeout(250);
  await bar.locator('.cf-search').fill('길음');await bar.locator('.cf-search').press('Enter');await page.waitForTimeout(250);
  assert.deepEqual((await rows()).map(r=>r[3]),['견적 발송 후 7일 · 수신 확인']);assert.equal((await kpi())[0][1],'1건');
  await bar.locator('.cf-search').fill('');await bar.locator('.cf-search').press('Enter');await page.waitForTimeout(250);
  /* 8. 위 탭은 기존 화면으로 · 돌아오면 다시 이 화면 · 끄면 예전 화면 */
  await v.locator('.sh2-pages button',{hasText:'성과'}).click();await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>G.campaignTab),'analysis');assert.equal(await pg.locator('.sh2').count(),0);assert.equal(await pg.evaluate(n=>n.classList.contains('sh2-on')),false);
  await page.evaluate(()=>campaignSetTab('history'));await page.waitForTimeout(250);
  await v.locator('.sh2-pages button',{hasText:'묶음 · 보내기'}).click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>G.campaignTab),'home');assert.equal(await pg.locator(':scope>.cf-bar [data-sh2-who]').count(),0,'묶음 화면에서는 공통 필터줄이 원래 내용으로 돌아간다');
  await page.evaluate(()=>{G.smsHistoryV2Off=true;campaignSetTab('history');});await page.waitForTimeout(250);
  assert.equal(await pg.locator('.sh2').count(),0);assert.match(await pg.innerText(),/DELIVERY HISTORY/,'끄면 예전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',old_header_removed:true,one_filter_bar:true,page_tabs:true,period_filters_list_and_numbers:true,reaction_from_activity_log:true,test_and_direct_excluded:true,row_detail_and_resend_failed:true,sender_brand_search:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
