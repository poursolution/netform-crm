'use strict';
/* 회의록(8~10월) 모바일 1단계 점검 · 2026-10-22
   시각을 2026-10-22(목) 10:00 KST 로 고정하고 합성 영업건 8건 + 문의 2건 + 관리자 요청 1건으로:
   ① 320 · 360 · 390 폭에서 오늘 · 그다음 목록 · 내 현장 · 현장 상세 · 연락 결과 · 기록 등록 · 일정 화면 모두 문서 가로 넘침 0, 오른쪽 끝을 넘는 요소 0(가로 스크롤 띠 .approved-stages 안은 제외)
   ② 작은 글자 버튼(탭 · 단계 칩 · 단계 바꾸기 · 전체 보기 · 그다음 n건 · 성과 › · 목록/오늘 동선 · 통화 녹음 요약 · 고객 정보 변경)의 누르는 영역이 44px 이상(::after 포함)
   ③ 로그인 뒤 자료가 오기 전(TOKEN 있음 · LIVE 아님 · DEMO 아님)에는 뼈대 화면(.gs-skel)만 — 예전 바깥 탭(#tabbar button) 없음 · 승인 틀 data-mobile-approved-view=approved · 끄면(G.mobileSkelOff) 안 나옴
   ④ 현장 상세 [전화] = 전화 앱 → 바로 연락 결과 화면(.approved-d) · 끄면(G.mobileCallSheetOff) 안 열림
   ⑤ buildToday 가 문의를 12건에서 자르지 않음(승인 셸에서는 500)
   합성 자료 · 외부 연결 차단 · 저장 없음. */
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const NOW=Date.parse('2026-10-22T10:00:00+09:00');
const SHOT=process.env.SHOT_DIR||'';
const SEED=()=>{
 closeSheet&&closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;delete window.__approvedHExample;delete window.__approvedScheduleNow;
 const day=n=>DayZoneRules.kst(Date.now()+n*864e5),actor=Phase1.profile.user_id,iso=s=>new Date(s).toISOString();
 G.user={...G.user,id:actor};G.mode='rep';G.tab='today';G.deal=null;G.sub=null;G.done={};G.brandF='전체';G.mobileV5Off=false;
 Object.assign(MobileGuideShell.state,{q:'',stage:'',page:1,scroll:0,area:'now',areaPage:1,detailView:'',v5more:false,v5page:1});
 const C=[
  ['p01','합성 기한 지남 3일 아주 긴 현장 이름 테스트 아파트 101동',{due:-3,text:'견적 검토 확인 · 입대의 안건 상정 여부 · 경쟁사 견적 확인'}],
  ['p02','합성 기한 지남 1일',{due:-1,text:'자료 회신 확인'}],
  ['p03','합성 오늘 방문',{due:0,text:'외벽 균열 범위 · 실측 · 사진',type:'방문',at:'2026-10-22T11:00:00+09:00'}],
  ['p04','합성 오늘 약속',{due:0,text:'고객 약속: 견적서 보내기',type:'약속'}],
  ['p05','합성 요청 재연락',{due:0,text:'첫 연락',type:'전화',at:'2026-10-22T16:10:00+09:00'}],
  ['p06','합성 모레 연락',{due:2,text:'공사 시기 확인'}],
  ['p07','합성 회신 대기',{wait:'입대의 결과 회신 대기',until:3,due:3,text:'입대의 결과 확인'}],
  ['p08','합성 다음 할 일 없음',{}]
 ];
 DEALS=C.map(([id,nm,x])=>({id,site_id:id+'s',nm,code:x.wait?'waiting':'consulting',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 소장',manager_role:'관리소장',manager_mobile:'01000000000',
  created_at:iso(Date.now()-5*864e5),stageAt:iso(Date.now()),lastAt:iso(Date.now()),contactAt:iso(Date.now()),activities:[],tl:[],waiting_reason:x.wait||'',expected_resume_at:x.until!=null?day(x.until):'',
  nextAction:x.text?{id:id+'n',type:x.type||'전화',text:x.text,due:day(x.due),due_at:day(x.due),scheduled_at:x.at||undefined,status:'open'}:null}));
 const inq=(n,nm,assigned)=>{const raw={id:'aaaaaaaa-1111-4111-8111-0000000000'+String(n).padStart(2,'0'),site:nm,status:'배정완료',at:assigned,assignee:G.user.nm,assigned_at:assigned,phone:'010000000'+String(n).padStart(2,'0'),contact_name:'합성 고객',message:'옥상 누수 견적 문의'};return Object.assign(inquiryViewM(raw),{raw,done:true,rep:G.user.nm,status:'배정완료'});};
 ADMIN.inquiries=[inq(1,'합성 문의 기준 넘김','2026-10-22T07:00:00+09:00'),inq(2,'합성 문의 새 배정','2026-10-22T09:30:00+09:00')];
 Object.assign(MobileRequests.state(),{list:[{id:'req-1',to_me:true,status:'sent',target_type:'deal',target_id:'p05',kind:'first',label:'첫 연락 요청',asks:['견적 요청 내용','방문이 필요한지'],due_at:'2026-10-22T18:00:00+09:00',requested_by:'송보람',created_at:'2026-10-22T08:00:00+09:00'}],loaded:true,busy:false,off:false,at:Date.now()});
 render();
};
const MEASURE=()=>{
 const W=innerWidth,vis=el=>{const r=el.getBoundingClientRect();if(r.width<2||r.height<2)return false;const s=getComputedStyle(el);return s.visibility!=='hidden'&&s.display!=='none'&&s.opacity!=='0';};
 const over=[];for(const el of document.querySelectorAll('#scr *,#sheetwrap *')){if(!vis(el)||el.closest('.approved-stages'))continue;const r=el.getBoundingClientRect();if(r.right>W+1&&r.left<W)over.push(el.tagName.toLowerCase()+'.'+String(el.className).trim().split(/\s+/).slice(0,2).join('.')+' right='+Math.round(r.right)+' "'+(el.innerText||'').replace(/\s+/g,' ').slice(0,24)+'"');}
 const hit=el=>{const r=el.getBoundingClientRect();let h=r.height,w=r.width;const a=getComputedStyle(el,'::after');if(a&&a.content!=='none'&&a.position==='absolute'){h=Math.max(h,parseFloat(a.height)||0);w=Math.max(w,parseFloat(a.width)||0);}return {w:Math.round(w),h:Math.round(h)};};
 const SEL='[data-gs="tab"],[data-gs="stage"],[data-gs="stage-change"],[data-gs="history"],[data-gs="pending"],[data-gs="v5more"],[data-gs="v5perf"],[data-gs="area"],.approved-route-tabs button,.approved-d .cs-open,.approved-d .ce-infobtn,.approved-d .ce-chip';
 const small=[...document.querySelectorAll(SEL)].filter(vis).map(el=>({...hit(el),t:(el.innerText||'').replace(/\s+/g,' ').slice(0,16)})).filter(x=>x.w<44||x.h<44);
 return {docOver:document.documentElement.scrollWidth-W,over,small};
};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;let browser;const errors=[];
 try{
  browser=await chromium.launch(launchOptions());
  for(const width of [320,360,390]){
   const c=await browser.newContext({viewport:{width,height:740},timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true});
   await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin?r.continue():r.abort();});
   const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(width+': '+String(e.message||e)));
   await page.clock.setFixedTime(new Date(NOW));
   await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
   await page.evaluate(SEED);await page.locator('.approved-a.mv5').waitFor();
   const check=async name=>{await page.waitForTimeout(120);const m=await page.evaluate(MEASURE);
    assert.equal(m.docOver,0,width+'px '+name+' 문서 가로 넘침 '+m.docOver);
    assert.deepEqual(m.over,[],width+'px '+name+' 오른쪽 끝 넘는 요소: '+m.over.join(' | '));
    assert.deepEqual(m.small,[],width+'px '+name+' 44px 미만 누르는 영역: '+JSON.stringify(m.small));
    if(SHOT)await page.screenshot({path:path.join(SHOT,'mobile-meeting-'+name+'-'+width+'.png')});};
   /* ① · ② 화면 7곳 */
   await check('today');
   await page.evaluate(()=>{MobileGuideShell.state.v5more=true;render();});await page.locator('.mv5 .mv5-row').first().waitFor();await check('today-more');
   await page.evaluate(()=>{closeSheet&&closeSheet();G.deal=null;G.tab='mine';MobileGuideShell.state.v5more=false;render();});await page.locator('.approved-bc .approved-stages').waitFor();await check('mine');
   await page.evaluate(()=>{closeSheet&&closeSheet();G.deal='p01';render();});await page.locator('.approved-c').waitFor();await check('detail');
   /* ④ 상세 [전화] → 결과 화면 */
   await page.locator('.approved-c [data-gs="phone"]').click();await page.locator('.approved-d').waitFor();
   assert.equal(await page.locator('.approved-d .cd-head b').innerText(),'연락 결과','상세 [전화] 뒤 바로 연락 결과 화면');
   await check('result-sheet');
   await page.evaluate(()=>{closeSheet&&closeSheet();G.deal='p01';G.mobileCallSheetOff=true;render();});await page.locator('.approved-c').waitFor();
   await page.waitForFunction(()=>!document.getElementById('sheetwrap').classList.contains('open'));
   await page.locator('.approved-c [data-gs="phone"]').click();await page.waitForTimeout(300);
   assert.equal(await page.evaluate(()=>document.getElementById('sheetwrap').classList.contains('open')),false,'끄기(G.mobileCallSheetOff)면 결과 화면 안 열림');
   await page.evaluate(()=>{G.mobileCallSheetOff=false;closeSheet&&closeSheet();G.deal=null;G.tab='pending';render();});await page.waitForTimeout(150);await check('pending');
   await page.evaluate(()=>{closeSheet&&closeSheet();G.tab='schedule';render();});await page.waitForTimeout(150);await check('schedule');
   /* ③ 로딩 뼈대 화면 */
   const sk=await page.evaluate(()=>{closeSheet&&closeSheet();G.deal=null;G.tab='today';const keep={LIVE,DEMO,TOKEN};DEMO=false;LIVE=false;TOKEN='synthetic-session';LOAD_ERR=null;render();
    const r={skel:document.querySelectorAll('#scr > .approved-a.gs-skel').length,cards:document.querySelectorAll('#scr .gs-skel-card').length,oldTabs:document.querySelectorAll('#tabbar button').length,view:document.documentElement.getAttribute('data-mobile-approved-view'),text:document.querySelector('#scr .gs-skel-note')?.innerText||'',digits:/\d/.test(document.querySelector('#scr .mv5-body')?.innerText||''),over:document.documentElement.scrollWidth-innerWidth};
    G.mobileSkelOff=true;render();r.offSkel=document.querySelectorAll('#scr .gs-skel').length;G.mobileSkelOff=false;
    DEMO=keep.DEMO;LIVE=keep.LIVE;TOKEN=keep.TOKEN;render();r.back=document.querySelectorAll('#scr > .approved-a.mv5:not(.gs-skel)').length;return r;});
   assert.equal(sk.skel,1,width+'px 로딩 중 뼈대 화면 하나');assert.equal(sk.cards,3,'뼈대 카드 3장');assert.equal(sk.oldTabs,0,'예전 바깥 탭 없음');
   assert.equal(sk.view,'approved','승인 틀 보임(빈 배경 아님)');assert.equal(sk.text,'서버에서 오늘 업무를 불러오는 중입니다');assert.equal(sk.digits,false,'뼈대에 숫자 없음');assert.equal(sk.over,0,'뼈대 가로 넘침 없음');
   assert.equal(sk.offSkel,0,'끄기(G.mobileSkelOff)면 뼈대 없음');assert.equal(sk.back,1,'자료 오면 오늘 화면');
   /* ⑥ 과거 이관 · 분류 전 건(PC 와 같은 PipelineScope): 내 현장 목록 · 오늘 기록 보완에서 빠지고 한 줄로 알림, 끄면(G.mobileScopeOff) 보임 */
   const lg=await page.evaluate(()=>{closeSheet&&closeSheet();G.deal=null;G.mobileScopeOff=false;
    DEALS.push({id:'p09',site_id:'p09s',nm:'합성 과거 이관 건',code:'qualified',stage_code:'qualified',stage_raw:'검증된 고객',sub:'방수',rep:G.user.nm,owner_id:Phase1.profile.user_id,brand:'POUR솔루션',version:0,amt:5e7,manager_name:'합성 소장',manager_role:'관리소장',manager_mobile:'01000000000',created_at:'2026-06-01T00:00:00Z',stageAt:'2026-06-01T00:00:00Z',lastAt:'2026-06-01T00:00:00Z',contactAt:'',activities:[],tl:[],nextAction:null});
    G.tab='mine';MobileGuideShell.state.q='';MobileGuideShell.state.stage='';render();
    const names=[...document.querySelectorAll('.approved-bc .approved-list [data-gs="deal"]')].map(n=>n.innerText.replace(/\s+/g,' ')),note=document.querySelector('.approved-bc .gs-legacy-note')?.innerText||'';
    G.tab='today';render();const quiet=document.querySelector('.mv5 .mv5-quiet')?.innerText.replace(/\s+/g,' ')||'';
    G.mobileScopeOff=true;G.tab='mine';render();const off=[...document.querySelectorAll('.approved-bc .approved-list [data-gs="deal"]')].some(n=>/합성 과거 이관 건/.test(n.innerText)),offNote=document.querySelectorAll('.approved-bc .gs-legacy-note').length;
    G.mobileScopeOff=false;DEALS=DEALS.filter(d=>d.id!=='p09');G.tab='today';render();return {inList:names.some(t=>/합성 과거 이관 건/.test(t)),note,quiet,off,offNote};});
   assert.equal(lg.inList,false,'과거 이관 건은 내 현장 목록에 없다');
   assert.equal(lg.note,'과거 이관 · 분류 전 1건은 이 목록 · 오늘에 넣지 않습니다 — PC 파이프라인 [과거 이관]에서 영업 재개','한 줄 알림: '+lg.note);
   assert.equal(lg.quiet,'고객 회신 대기 1 기록 보완 1','기록 보완에 과거 이관 건이 섞이지 않는다: '+lg.quiet);
   assert.equal(lg.off,true,'끄면 보인다');assert.equal(lg.offNote,0,'끄면 알림 없음');
   /* ⑤ 문의 한도 */
   const cap=await page.evaluate(()=>{const base=ADMIN.inquiries[1];ADMIN.inquiries=[ADMIN.inquiries[0]].concat(Array.from({length:19},(_,i)=>{const raw={...base.raw,id:'bbbbbbbb-1111-4111-8111-0000000000'+String(i+10).padStart(2,'0'),site:'합성 문의 '+(i+10)};return Object.assign(inquiryViewM(raw),{raw,done:true,rep:G.user.nm,status:'배정완료'});}));const n=(buildToday()||[]).filter(t=>t.kind!=='deal').length;return n;});
   assert.equal(cap,20,'문의 20건이 12건에서 잘리지 않음: '+cap);
   await c.close();
  }
  /* ⑦ 잔디 알림 링크 → 앱 실행: mobile.html?open=inq:<id> 로 열면 로그인 · 자료 뒤 그 문의 응대 화면이 한 번 열리고, 주소에서 open 은 지워진다 · deal:<id> 는 상세 · 끄면(G.mobileOpenLinkOff) 안 열림 */
  {
   const c=await browser.newContext({viewport:{width:390,height:740},timezoneId:'Asia/Seoul'});
   await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin?r.continue():r.abort();});
   const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push('open: '+String(e.message||e)));
   await page.clock.setFixedTime(new Date(NOW));
   await page.goto(origin+'/mobile.html?demo=1&review=hub&screen=B&open=inq%3Aaaaaaaaa-1111-4111-8111-000000000001',{waitUntil:'domcontentloaded'});await page.locator('.approved-b').waitFor();
   assert.equal(await page.evaluate(()=>new URL(location.href).searchParams.get('open')),null,'주소에서 open 은 바로 지운다');
   await page.evaluate(SEED);await page.waitForFunction(()=>window.MobileInquiryEntry&&MobileInquiryEntry.state()!==null,null,{timeout:5000});
   assert.equal(await page.evaluate(()=>String(MobileInquiryEntry.state()?.target_id||'')),'aaaaaaaa-1111-4111-8111-000000000001','그 문의의 응대 화면이 열린다');
   await page.evaluate(()=>{closeSheet&&closeSheet();MobileInquiryEntry.close?.();G.tab='today';render();});await page.waitForTimeout(200);
   assert.equal(await page.evaluate(()=>MobileInquiryEntry.state()),null,'한 번만 연다');
   await c.close();
   const c2=await browser.newContext({viewport:{width:390,height:740},timezoneId:'Asia/Seoul'});
   await c2.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin?r.continue():r.abort();});
   const p2=await c2.newPage();p2.setDefaultTimeout(15000);p2.on('pageerror',e=>errors.push('open2: '+String(e.message||e)));
   await p2.clock.setFixedTime(new Date(NOW));
   await p2.goto(origin+'/mobile.html?demo=1&review=hub&screen=B&open=deal%3Ap03',{waitUntil:'domcontentloaded'});await p2.locator('.approved-b').waitFor();
   await p2.evaluate(SEED);await p2.waitForFunction(()=>String(G.deal)==='p03');
   assert.equal(await p2.locator('.approved-c').count(),1,'영업건 상세가 열린다');
   await c2.close();
  }
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',widths:[320,360,390],screens:7,writes:0,openLink:true}));
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
