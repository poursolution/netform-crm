'use strict';
/* 파이프라인 단계별 B안 검사(2026-10-03 핸드오프 pipeline_b): 왼쪽 진단(막대 3칸 · 숫자 3개 · 왜 멈춰 있나 · 뭘 해야 하나) / 오른쪽 현장(리스트 · 보드)
   단계별 막대 칸 · 빨강 사유 · 정렬(빨강 사유 순서 → 사유 개수 → 체류일)을 README 표대로 실제 필드로 계산. 열기는 기존 상세 경로. 끄면(G.pipeStageBOff) v2 목록 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineStageB&&window.PipelineListV2&&window.PipelineWorkspace&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()-n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-40),stage_entered_at:at(10),code,stage_code:code,grp:'영업·관리',amt:2e8},extra||{});
   B={deals:[
    /* 컨설팅: 일정 없음(빨강 1순위) · 미팅 예정 · 미팅 완료 후 견적 3일 넘김(빨강 2순위) · 정상 */
    deal('c-none','일정 없는 컨설팅','이필선','consulting',{brand:'석민이앤씨',stage_entered_at:at(35)}),
    deal('c-plan','미팅 예정 컨설팅','이필선','consulting',{next_action:{id:'n1',type:'현장방문',text:'1차 미팅',due:day(3),status:'open'},stage_contexts:{first_contact:{fields:{needs:'옥상 누수',work_scope:'옥상 전체',expected_timing:'10월'}}}}),
    deal('c-late','견적 늦은 컨설팅','황윤선','consulting',{amt:6e8,stage_entered_at:at(12),next_action:{id:'n2',type:'현장방문',text:'1차 미팅',due:day(-6),status:'open'},stage_contexts:{first_contact:{fields:{needs:'외벽 균열'}}}}),
    deal('c-ok','정상 컨설팅','황윤선','consulting',{stage_entered_at:at(4),next_action:{id:'n3',type:'견적',text:'견적 작성',due:day(2),status:'open'},stage_contexts:{first_contact:{fields:{needs:'옥상 방수',work_scope:'옥상',expected_timing:'11월'}},consulting:{fields:{quote_request:'옥상 방수',quote_due:day(2)}}}}),
    /* 발송: 7일 넘김 후속 없음 · 반응 기록 완료 · 대기 */
    deal('s-late','후속 없는 발송','이필선','sent',{amt:3.1e8,stage_contexts:{sent:{fields:{sent_date:day(-9),materials:['견적서']}}}}),
    deal('s-done','반응 기록된 발송','황윤선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-10),reaction:'검토중',followup_date:day(3)}}},next_action:{id:'n4',text:'검토 결과 확인',due:day(3),status:'open'}}),
    deal('s-wait','대기 발송','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-2)}}}}),
    /* 관계: 집중 7일 무연락 · 일반 30일 무접촉 · 대기 60일 */
    deal('r-focus','집중 현장','이필선','rapport',{last_meaningful_contact_at:at(9),next_action:{id:'n5',text:'안부 전화',due:day(2),status:'open'}}),
    deal('r-normal','일반 현장','황윤선','silent',{last_meaningful_contact_at:at(35)}),
    deal('r-wait','대기 현장','이필선','waiting',{last_meaningful_contact_at:at(70),stage_contexts:{waiting:{fields:{resume_date:day(-1)}}}}),
    /* 경쟁: D-3 미완료 · 결정 대기 · 제출 */
    deal('k-d3','입찰 D-2','이필선','bidding',{amt:4.2e8,stage_contexts:{bidding:{fields:{bid_deadline:day(2),bid_plan:'준비 중'}}}}),
    deal('k-dec','결정 대기 경쟁','황윤선','compete',{stage_contexts:{compete:{fields:{competition_type:'PT',competitor:'타사 A',meeting_date:day(6)}}}}),
    deal('k-sub','제출한 입찰','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(5),bid_plan:'제출 완료'}}}}),
    /* 계약·시공: 계약정보 없음 · 인계 미완료 · 시공 중 방문 9일 */
    deal('t-sign','계약 진행','이필선','contract'),
    deal('t-hand','인계 중','황윤선','construction',{stage_contexts:{contract:{fields:{contract_date:day(-5),contract_amount:3e8,special_terms:'야간 작업 불가'}},construction:{fields:{start_date:day(7),handover:'진행중'}}}}),
    deal('t-build','시공 중','이필선','construction',{last_meaningful_contact_at:at(9),stage_contexts:{contract:{fields:{contract_date:day(-20),contract_amount:3e8,special_terms:'-'}},construction:{fields:{start_date:day(-10),handover:'완료'}}}}),
    /* 수주: D+34 사후 연락 없음 · D+12 */
    deal('w-after','사후 연락 없는 수주','이필선','won',{outcome:'won',won_amount:1.4e8,closed_at:day(-34),completion_date:day(-34),last_meaningful_contact_at:at(40)}),
    deal('w-fresh','갓 준공','황윤선','won',{outcome:'won',won_amount:1.2e8,closed_at:day(-12),completion_date:day(-12),last_meaningful_contact_at:at(5)}),
    /* 실주: 사유 없음 · 기록 완료 · 재영업 */
    deal('l-none','사유 없는 실주','이필선','lost',{outcome:'lost',closed_at:day(-3),stageHistory:[{from:'compete',to:'lost',at:day(-3)}]}),
    deal('l-rec','기록된 실주','황윤선','lost',{outcome:'lost',closed_at:day(-5),lost_reason:'가격 열세',stageHistory:[{from:'sent',to:'lost',at:day(-5)}],stage_contexts:{lost:{fields:{competitor:'타사 B'}}}}),
    deal('l-re','재영업 실주','이필선','lost',{outcome:'lost',closed_at:day(-40),lost_reason:'공법',next_action:{id:'n9',text:'2027 재입찰 확인',due:day(60),status:'open'},stage_contexts:{lost:{fields:{competitor:'타사 C',recontact_possibility:'높음'}}}})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.psb=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=null;window.__act=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};window.DetailActions=Object.assign(window.DetailActions||{},{open:k=>{window.__act=k;}});
   PipelineWorkspace.open('consulting');
  });
  await page.waitForTimeout(300);
  const b=page.locator('#pipeline-stage-b');assert.equal(await b.count(),1,'B안');assert.equal(await b.getAttribute('data-stage'),'consulting');
  assert.equal(await page.locator('#pipeline-list-v2').count(),0,'v2 목록은 안 그린다');assert.equal(await page.locator('#pg-pipe>.cf-bar:not([hidden])').count(),1,'공통 필터줄(브랜드 · 검색)');
  assert.match(await b.locator('.psb-head').innerText(),/^컨설팅 설계\s+1차 현장미팅으로 고객 요구를 확인하고 견적을 준비하는 단계 · 견적 처리 목표 3일 \/ 최대 5일$/);
  /* 진단: 막대 3칸 · 숫자 · 사유 */
  assert.deepEqual((await b.locator('.psb-axis .leg button').allInnerTexts()).map(x=>x.replace(/\s+/g,' ')),['미팅 전 · 일정 없음 1','미팅 예정 1','미팅 완료 · 견적 준비 2']);
  assert.match(await b.locator('.psb-kpis').innerText(),/기준 넘김 \(빨강\)\s*2건[\s\S]*미팅 전 · 일정 없음\s*1건[\s\S]*평균 체류\s*\d+일/);
  const reasons=await b.locator('.psb-reason span').allInnerTexts();assert.deepEqual(reasons.slice(0,2),['미팅 일정 없음','견적 요청 3일 넘김'],'빨강 사유가 표 순서대로 '+reasons.join(','));
  assert.match(await b.locator('.psb-act').first().innerText(),/미팅 일정 없음 1건\s*첫 통화에서 1차 미팅 날짜까지 잡기/);
  /* 리스트: 빨강 사유 순서(일정 없음 → 견적 3일 넘김) → 사유 개수 → 체류일 */
  const sites=async()=>page.locator('#pipeline-stage-b .psb-row .l b').allInnerTexts();
  assert.deepEqual(await sites(),['일정 없는 컨설팅','견적 늦은 컨설팅','미팅 예정 컨설팅','정상 컨설팅']);
  const r0=b.locator('.psb-row').first();assert.match(await r0.innerText(),/일정 없는 컨설팅\s*석민이앤씨 · 이필선 · 2억\s*미팅 전\s*일정 없음\s*미팅 일정 없음\s*35일\s*미팅 잡기/);
  assert.equal(await r0.evaluate(n=>getComputedStyle(n).borderLeftColor),'rgb(232, 89, 12)','브랜드 띠');
  assert.match(await b.locator('.psb-row',{hasText:'견적 늦은 컨설팅'}).innerText(),/미팅 완료[\s\S]*견적 요청 3일 넘김\s*12일\s*견적 요청/);
  /* 막대 칸 · 사유 클릭 = 필터 */
  await b.locator('.psb-axis .leg button').nth(2).click();await page.waitForTimeout(250);assert.deepEqual(await sites(),['견적 늦은 컨설팅','정상 컨설팅']);assert.match(await page.locator('#pipeline-stage-b .psb-lhead em').innerText(),/미팅 완료 · 견적 준비/);
  await page.locator('#pipeline-stage-b .psb-reason[data-v="req"]').click();await page.waitForTimeout(250);assert.deepEqual(await sites(),['견적 늦은 컨설팅']);
  await page.locator('#pipeline-stage-b [data-psb="clear"]').click();await page.waitForTimeout(250);assert.equal((await sites()).length,4);
  /* 보드 = 막대 3칸 */
  await page.locator('#pipeline-stage-b [data-psb="view"][data-v="board"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await page.locator('#pipeline-stage-b .psb-col .ch b').allInnerTexts(),['미팅 전 · 일정 없음','미팅 예정','미팅 완료 · 견적 준비']);assert.equal(await page.locator('#pipeline-stage-b .psb-card').count(),4);
  if(shot)await page.screenshot({path:shot+'-board.png',fullPage:true});
  await page.locator('#pipeline-stage-b [data-psb="view"][data-v="list"]').click();await page.waitForTimeout(250);
  /* 버튼 → 기존 상세 + 액션 · 줄 → 상세 */
  await page.locator('#pipeline-stage-b .psb-row',{hasText:'일정 없는 컨설팅'}).locator('button').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>__open),'c-none');assert.equal(await page.evaluate(()=>__act),'next','미팅 잡기 = 다음 할 일');
  await page.locator('#pipeline-stage-b .psb-row',{hasText:'정상 컨설팅'}).locator('.l').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__open),'c-ok');
  if(shot)await page.screenshot({path:shot+'-consulting.png',fullPage:true});
  /* 단계 전환: 발송 · 관계 · 경쟁 · 계약 · 수주 · 실주 — 막대 칸과 첫 빨강 사유 */
  const expect={sent:[['D+7 전 · 후속 대기','7일 넘김 · 후속 없음','후속 완료 · 반응 기록'],'후속 없는 발송','발송 후 7일 · 후속 없음'],relationship:[['집중관리 · 7일 단위','일반관리 · 월 1회','대기 · 2개월 1회'],'집중 현장','집중관리 7일 넘게 연락 없음'],competition:[['참여 · 가격 결정 대기','서류 · 제안서 준비','제출 완료 · 결과 대기'],'입찰 D-2','마감 D-3 · 준비 안 됨'],construction:[['계약 진행','시공팀 인계','착공 · 시공 중'],'계약 진행','계약일 · 금액 미입력'],won:[['준공 직후 · D+30 전','D+30 사후 확인','재영업 연결'],'사후 연락 없는 수주','준공 D+30 사후 연락 안 함'],lost:[['사유 미기록','기록 완료','재영업 예정'],'사유 없는 실주','실주 사유 미입력']};
  for(const [key,[bars,firstSite,firstReason]] of Object.entries(expect)){
   await page.evaluate(k=>PipelineWorkspace.open(k),key);await page.waitForTimeout(300);
   assert.equal(await page.locator('#pipeline-stage-b').getAttribute('data-stage'),key);
   assert.deepEqual((await page.locator('#pipeline-stage-b .psb-axis .leg button').allInnerTexts()).map(t=>t.replace(/\s+/g,' ').replace(/\s\d+$/,'')),bars,key+' 막대');
   const first=page.locator('#pipeline-stage-b .psb-row').first();assert.match(await first.locator('.l b').innerText(),new RegExp('^'+firstSite),key+' 최상단');assert.equal(await first.locator('.i').innerText(),firstReason,key+' 첫 빨강');
   assert.equal(await first.locator('.i').evaluate(n=>getComputedStyle(n).color),'rgb(217, 58, 58)',key+' 빨강');
   if(shot)await page.screenshot({path:shot+'-'+key+'.png',fullPage:true});
  }
  /* 관계: 일반 30일 · 대기 60일도 사유로 */
  await page.evaluate(()=>PipelineWorkspace.open('relationship'));await page.waitForTimeout(300);
  assert.match(await page.locator('#pipeline-stage-b .psb-row',{hasText:'일반 현장'}).locator('.i').innerText(),/30일 넘게 접촉 없음/);assert.match(await page.locator('#pipeline-stage-b .psb-row',{hasText:'대기 현장'}).locator('.i').innerText(),/대기 2개월 연락일 도래/);
  /* 수주 · 실주: 정상 건은 '정상' */
  await page.evaluate(()=>PipelineWorkspace.open('won'));await page.waitForTimeout(300);assert.match(await page.locator('#pipeline-stage-b .psb-row',{hasText:'갓 준공'}).locator('.s b').innerText(),/준공 직후/);
  await page.evaluate(()=>PipelineWorkspace.open('lost'));await page.waitForTimeout(300);assert.match(await page.locator('#pipeline-stage-b .psb-row',{hasText:'재영업 실주'}).locator('.s b').innerText(),/재영업 예정/);
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.pipeStageBOff=true;paint();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#pipeline-stage-b').count(),0);assert.equal(await page.locator('#pipeline-list-v2').count(),1,'끄면 v2 목록');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',layout_b:true,diag_bars_kpis_reasons:true,sort_red_first:true,filters:true,board:true,open_existing_path:true,seven_stages:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
