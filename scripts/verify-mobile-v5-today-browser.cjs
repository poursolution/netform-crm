'use strict';
/* 모바일 v5 오늘 (2026-10-20 design_handoff_mobile_all '모바일 v5 · 세 작업 바로 하기' + v5 보완)
   시각을 2026-10-20(화) 10:00 KST 로 고정하고 합성 영업건 8건 + 문의 2건 + 관리자 요청 1건을 넣어 본다.
   · 맨 위 한 줄 "지금 먼저 할 일 n건 · …" · 숫자 4개 나열 없음 · 회신 대기 · 기록 보완은 맨 아래 숫자만
   · 순서 = 기한 지남(오래된 것 먼저) → 가까운 시각(방문 11:00 · 문의 기준 11:30 · 재연락 16:10) → 시각 없는 것
   · 요청 카드 = 기한 · 요청자 / 확인할 것 = 요청 항목 / 재연락을 뒤로 잡아도 '18:00 마감 그대로'
   · 오늘에 나오는 건 = PC 와 같은 판정(오늘 처리 + 기한 초과) · 320 · 390 폭에서 가로 넘침 없음
   합성 자료(현장 · 이름은 지어낸 것) · 외부 연결 차단 · 저장 없음. */
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const NOW=Date.parse('2026-10-20T10:00:00+09:00');
const SHOT=process.env.SHOT_DIR||'';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[];
 try{
  browser=await chromium.launch(launchOptions());
  for(const width of [320,390]){
   const c=await browser.newContext({viewport:{width,height:844},timezoneId:'Asia/Seoul'});
   await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin?r.continue():r.abort();});
   const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(String(e.message||e)));
   await page.clock.setFixedTime(new Date(NOW));
   await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
   await page.evaluate(()=>{
    closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;delete window.__approvedHExample;delete window.__approvedScheduleNow;
    const day=n=>DayZoneRules.kst(Date.now()+n*864e5),actor=Phase1.profile.user_id,iso=s=>new Date(s).toISOString();
    G.user={...G.user,id:actor};G.mode='rep';G.tab='today';G.deal=null;G.sub=null;G.done={};G.brandF='전체';G.mobileV5Off=false;
    Object.assign(MobileGuideShell.state,{q:'',stage:'',page:1,scroll:0,area:'now',areaPage:1,detailView:'',v5more:false,v5page:1});
    const C=[
     ['p01','합성 기한 지남 3일',{due:-3,text:'견적 검토 확인'}],
     ['p02','합성 기한 지남 1일',{due:-1,text:'자료 회신 확인'}],
     ['p03','합성 오늘 방문',{due:0,text:'외벽 균열 범위 · 실측 · 사진',type:'방문',at:'2026-10-20T11:00:00+09:00'}],
     ['p04','합성 오늘 약속',{due:0,text:'고객 약속: 견적서 보내기',type:'약속'}],
     ['p05','합성 요청 재연락',{due:0,text:'첫 연락',type:'전화',at:'2026-10-20T16:10:00+09:00'}],
     ['p06','합성 모레 연락',{due:2,text:'공사 시기 확인'}],
     ['p07','합성 회신 대기',{wait:'입대의 결과 회신 대기',until:3,due:3,text:'입대의 결과 확인'}],
     ['p08','합성 다음 할 일 없음',{}]
    ];
    DEALS=C.map(([id,nm,x])=>({id,site_id:id+'s',nm,code:x.wait?'waiting':'consulting',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 소장',manager_role:'관리소장',manager_mobile:'01034158556',
     created_at:iso(Date.now()-5*864e5),stageAt:iso(Date.now()),lastAt:iso(Date.now()),contactAt:iso(Date.now()),activities:[],tl:[],waiting_reason:x.wait||'',expected_resume_at:x.until!=null?day(x.until):'',
     nextAction:x.text?{id:id+'n',type:x.type||'전화',text:x.text,due:day(x.due),due_at:day(x.due),scheduled_at:x.at||undefined,status:'open'}:null}));
    const inq=(n,nm,assigned)=>{const raw={id:'aaaaaaaa-1111-4111-8111-00000000000'+n,site:nm,status:'배정완료',at:assigned,assignee:G.user.nm,assigned_at:assigned,phone:'0100000000'+n,contact_name:'합성 고객',message:'옥상 누수 견적 문의'};return Object.assign(inquiryViewM(raw),{raw,done:true,rep:G.user.nm,status:'배정완료'});};
    ADMIN.inquiries=[inq(1,'합성 문의 기준 넘김','2026-10-20T07:00:00+09:00'),inq(2,'합성 문의 새 배정','2026-10-20T09:30:00+09:00')];
    Object.assign(MobileRequests.state(),{list:[{id:'req-1',to_me:true,status:'sent',target_type:'deal',target_id:'p05',kind:'first',label:'첫 연락 요청',asks:['견적 요청 내용','방문이 필요한지'],due_at:'2026-10-20T18:00:00+09:00',requested_by:'송보람',created_at:'2026-10-20T08:00:00+09:00'}],loaded:true,busy:false,off:false,at:Date.now()});
    render();
   });
   await page.locator('.approved-a.mv5').waitFor();
   const v=await page.evaluate(()=>{const q=s=>document.querySelector('.mv5 '+s),t=n=>n?n.innerText.replace(/\s+/g,' ').trim():'';
    return {top:t(q('.mv5-top')),card:t(q('.mv5-card')),done:t(q('.mv5-done')),sub:t(q('.mv5-sub')),rows:document.querySelectorAll('.mv5 .mv5-row').length,hidden:document.querySelectorAll('.mv5 .mv5-next,.mv5 [data-gs="v5more"]').length,quiet:t(q('.mv5-quiet')),perf:t(q('[data-gs="v5perf"]')),areaTabs:document.querySelectorAll('.mv5 [data-gs="area"][data-value="now"],.mv5 [data-gs="area"][data-value="late"]').length,
     scroll:document.documentElement.scrollWidth<=innerWidth,first:q('.mv5-card [data-gs="v5task"]')?.dataset.id,boot:document.documentElement.getAttribute('data-mobile-approved-view')};});
   assert.equal(v.boot,'approved','승인 틀 부팅');
   assert.match(v.top,/^지금 먼저 할 일 7건 · 기한 지남 3건$/,'맨 위 한 줄: '+v.top);
   assert.equal(v.areaTabs,0,'숫자 4개 탭 없음');
   assert.match(v.card,/3일 지남 · 10\.17 \(토\) 기한/,'첫 카드 = 가장 오래 지난 건: '+v.card);
   assert.match(v.card,/합성 기한 지남 3일/);assert.match(v.card,/합성 소장 관리소장 · 010-3415-8556/,'현장 · 연락처');
   assert.match(v.card,/이번에 확인할 것 견적 검토 확인/,'확인할 것 = 고객 기록(다음 할 일)');
   assert.match(v.card,/전화하기$/,'버튼 하나');assert.equal(v.first,'p01');
   assert.equal(v.done,'끝나는 조건 연결돼서 확인한 내용을 남기면 끝','전화 업무 끝나는 조건');
   /* 2026-10-22 대표: 나머지는 접지 않고 항상 줄로(숨기면 안 본다) — '다음 · …' 미리보기 · [그다음 n건 ›] 펼침 없음 */
   assert.equal(v.sub,'그다음 6건','나머지 건수 제목: '+v.sub);assert.equal(v.rows,6,'나머지 6건이 바로 줄로 보인다');assert.equal(v.hidden,0,'미리보기 · 펼침 버튼 없음');
   assert.equal(v.quiet,'고객 회신 대기 1 기록 보완 1','회신 대기 · 기록 보완 숫자만(오늘 밖)');
   assert.equal(v.perf,'성과 ›');assert.equal(v.scroll,true,width+'px 가로 넘침 없음');
   if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-v5-today-'+width+'.png')});
   /* 그다음 n건(항상 보임) → 순서 확인 */
   const rows=await page.evaluate(()=>[...document.querySelectorAll('.mv5 .mv5-row')].map(r=>r.innerText.replace(/\s+/g,' ').trim()));
   const NAMES=['합성 기한 지남 1일','합성 문의 기준 넘김','합성 오늘 방문','합성 문의 새 배정','합성 요청 재연락','합성 오늘 약속'],order=rows.map(r=>NAMES.find(n=>r.includes(n))||r);
   assert.deepEqual(order,['합성 기한 지남 1일','합성 문의 기준 넘김','합성 오늘 방문','합성 문의 새 배정','합성 요청 재연락','합성 오늘 약속'],'순서: '+JSON.stringify(rows));
   const req=rows.find(r=>/합성 요청 재연락/.test(r));
   assert.match(req,/오늘 18:00까지 · 송보람 요청/,'요청 카드 = 기한 · 요청자: '+req);
   assert.match(req,/견적 요청 내용 · 방문이 필요한지/,'확인할 것 = 요청 항목');
   assert.match(rows.find(r=>/합성 오늘 방문/.test(r)),/오늘 11:00 · 방문 약속.*방문 결과 남기기/,'방문 카드');
   assert.match(rows.find(r=>/합성 문의 기준 넘김/.test(r)),/첫 연락 기준 오늘 09:00 지남 · 견적문의 첫 연락/,'문의 기준 넘김 · 머리 글은 "첫 연락"(배정이 아님)');
   /* 2026-10-22 대표: 담당 미배정 문의 = 회색(붉게 재촉 안 함) · 문의 요약 = 원문 토막 세 개까지 · 두 줄 */
   const iq=await page.evaluate(()=>{const now=Date.now(),mk=(done,body)=>MobileV5Today._item.inqItem({inq:{ref:'q',nm:'합성 요약 현장',kind:'inquiry'},late:true},{inquiry:()=>({raw:{at:'2026-06-30T04:10:00+09:00',contact_name:'합성 고객'},done,phone:'0328816611',body})},now);
    const a=mk(false,'안녕하세요.\n- 올해 하반기 지하주차장 보수공사 예정\n- 설계.감리 진행 문의 및 견적 요청드립니다.\n감사합니다.'),b=mk(true,'지하주차장 누수로 문의 주심. 10년차 아파트로, 이 전에 부분 인젝션 공사 한적 있음. 지하2층 주차장에 누수가 심하게 발생하여 낙수, 석회물 등이 차에 떨어져 피해를 보고 있는 상태. 담당자가 현장 와서 보고 자세한 상담 원하심.');
    const html=MobileV5Today.render({items:[a],line:'1건',wait:0,fix:0,late:1},{},{});const box=document.createElement('div');box.innerHTML=html;const card=box.querySelector('.mv5-card');
    return {aHead:a.head,aColor:a.color,aGray:a.gray,aSrc:a.source,bHead:b.head,bColor:b.color,bSrc:b.source,cls:card.className,k:card.querySelector('.mv5-k').className,sum:MobileV5Today.summarize('문의드립니다. 옥상 누수.',90)};});
   assert.equal(iq.aHead,'담당 미배정 · 견적문의');assert.equal(iq.aColor,'#9ca3af');assert.equal(iq.aGray,true);assert.equal(iq.cls,'mv5-card gray');assert.equal(iq.k,'mv5-k gray','미배정은 붉은 글이 아니다');
   assert.equal(iq.aSrc,'문의 요약: 올해 하반기 지하주차장 보수공사 예정 · 설계.감리 진행 문의 및 견적 요청드립니다','인사말 빼고 항목만: '+iq.aSrc);
   assert.match(iq.bHead,/^첫 연락 기준 .+ 지남 · 견적문의 첫 연락$/);assert.equal(iq.bColor,'#15171c');
   assert.equal(iq.bSrc,'문의 요약: 지하주차장 누수로 문의 주심 · 10년차 아파트로, 이 전에 부분 인젝션 공사 한적 있음 · 지하2층 주차장에 누수가 심하게 발생하여 낙수, 석회물 등이 차에 …','문장 세 토막 · 90자: '+iq.bSrc);
   assert.equal(iq.sum,'옥상 누수');
   /* 요청 건을 맨 위로: 재연락 16:10 · 마감 그대로 */
   const card=await page.evaluate(()=>{const M=MobileV5Today._item.dealItem('now',{d:DEALS.find(d=>d.id==='p05'),p:{type:'deal',due:DEALS[4].nextAction.due,text:'첫 연락'},r:MobileRequests.forDeal('p05')[0]},{next:d=>d.nextAction,color:()=>'#1f9d55'},Date.now());return M;});
   assert.equal(card.retry,'오늘 16:10 다시 · 18:00 마감 그대로','재연락을 뒤로 잡아도 마감 그대로');
   assert.equal(card.done,'연결돼서 확인한 내용을 남기면 끝','첫 연락 요청 끝나는 조건');
   /* 회신 대기 목록 → 오늘로 */
   await page.locator('.mv5 [data-gs="area"][data-value="wait"]').click();await page.locator('.mv5 .mv5-row [data-gs="task"]').first().waitFor();
   assert.match(await page.locator('.mv5 .mv5-body').innerText(),/합성 회신 대기/);
   await page.locator('.mv5 [data-gs="area"][data-value="now"]').click();await page.locator('.mv5 .mv5-card').waitFor();
   /* 버튼: 전화하기(예시 화면 = 전화 앱 안 엶) → 그 현장으로 */
   await page.locator('.mv5 .mv5-card [data-gs="v5task"]').click();
   await page.waitForFunction(()=>String(G.deal)==='p01');
   /* 끄면 예전 4구역 */
   await page.evaluate(()=>{closeSheet&&closeSheet();G.deal=null;G.tab='today';G.mobileV5Off=true;MobileGuideShell.state.area='now';render();});
   assert.equal(await page.locator('.approved-a:not(.mv5) [data-gs="area"][data-value="late"]').count(),1,'끄기 = 예전 4구역');
   /* 요청 카드 → 그 현장(담당 확인 뒤) · 문의 카드 → 문의 응대 화면 */
   await page.evaluate(()=>{G.mobileV5Off=false;MobileGuideShell.state.v5more=true;render();});
   await page.locator('.mv5 [data-gs="v5task"][data-id="p05"]').click();await page.waitForFunction(()=>String(G.deal)==='p05');
   await page.evaluate(()=>{closeSheet&&closeSheet();G.deal=null;G.tab='today';render();});
   await page.locator('.mv5 [data-gs="v5task"][data-kind="inquiry"]').first().click();await page.waitForFunction(()=>MobileInquiryEntry.state()!==null);
   await c.close();
  }
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',widths:[320,390],writes:0}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
