'use strict';
/* 파이프라인 단계 화면 v3 검사(2026-10-05 design_handoff_pipeline_v3 · 파이프라인 단계 v3.dc.html)
   컨설팅 설계 · 자료 발송완료 · 관계관리 · 경쟁·입찰 · 계약·시공 = 공통 컴포넌트 하나(#pipeline-stage-v3) · 단계마다 다른 것은 설정값(탭 3개 · 버튼 · 사유 · 체류 기준)뿐.
   위 [전체] + 상태 탭 3개(첫 상태 빨강) · 아래 왼쪽 진단(기준 넘김 · 평균 체류 / 왜 멈춰 있나 4개 / 뭘 해야 하나) · 오른쪽 리스트 | 보드.
   숫자는 전부 자료에서: 탭 합 = 전체 = 그 단계 건수 · 첫 사유 = 빨강 탭 = 기준 넘김. 글자 크기 · 버튼(96px · 연파랑)은 시안 그대로.
   수주 · 실주는 그대로(B안) · 끄면(G.pipeStageV3Off) 이전 화면. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'',dump=process.env.PV_DUMP==='1';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineStageV3&&window.PipelineStageB&&window.PipelineListV2&&window.PipelineWorkspace&&window.ListPager&&window.CommonFilterBar);await page.evaluate(()=>{window.G=window.G||{};G.dealSameOff=true;});/* 2026-10-08 같은 정보 같은 판단 층은 끄고 본다 */
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()-n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-40),stage_entered_at:at(10),code,stage_code:code,grp:'영업·관리',amt:2e8},extra||{});
   B={deals:[
    /* 컨설팅: 일정 없음 · 미팅 예정 · 미팅 지남(완료) · 견적 준비 */
    deal('c-none','일정 없는 컨설팅','이필선','consulting',{brand:'석민이앤씨',stage_entered_at:at(35)}),
    deal('c-plan','미팅 예정 컨설팅','이필선','consulting',{next_action:{id:'n1',type:'현장방문',text:'1차 미팅',due:day(3),status:'open'},stage_contexts:{first_contact:{fields:{needs:'옥상 누수',work_scope:'옥상 전체',expected_timing:'10월'}}}}),
    deal('c-late','견적 늦은 컨설팅','황윤선','consulting',{amt:6e8,stage_entered_at:at(12),next_action:{id:'n2',type:'현장방문',text:'1차 미팅',due:day(-6),status:'open'},stage_contexts:{first_contact:{fields:{needs:'외벽 균열'}}}}),
    deal('c-ok','정상 컨설팅','황윤선','consulting',{brand:'',stage_entered_at:at(4),next_action:{id:'n3',type:'견적',text:'견적 작성',due:day(2),status:'open'},stage_contexts:{first_contact:{fields:{needs:'옥상 방수',work_scope:'옥상',expected_timing:'11월'}},consulting:{fields:{quote_request:'옥상 방수',quote_due:day(2)}}}}),
    /* 발송: 9일 전 발송 후속 없음 · 반응 기록 · 2일 전 발송 */
    deal('s-late','후속 없는 발송','이필선','sent',{amt:3.1e8,stage_contexts:{sent:{fields:{sent_date:day(-9),materials:['견적서']}}}}),
    deal('s-done','반응 기록된 발송','황윤선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-10),reaction:'검토중',followup_date:day(3),decision_maker:'입대의 회장'}}},next_action:{id:'n4',text:'검토 결과 확인',due:day(3),status:'open'}}),
    deal('s-wait','대기 발송','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-2),decision_maker:'모름'}}}}),
    /* stage7 ②: 발송일 없는 건 = 넷째 칸(7일 계산 안 함) */
    deal('s-nodate','발송일 없는 발송','이필선','sent',{stage_entered_at:at(20),last_meaningful_contact_at:at(3)}),
    /* 관계: 다음 연락일 5일 지남 · 이틀 뒤 약속 · 다음 행동 없음(70일 무접촉) · 한 달 뒤 연락 */
    deal('r-over','연락일 지난 현장','이필선','rapport',{last_meaningful_contact_at:at(20),next_action:{id:'n5',text:'안부 전화',due:day(-5),status:'open'}}),
    deal('r-week','이번 주 약속 현장','황윤선','silent',{last_meaningful_contact_at:at(9),next_action:{id:'n6',text:'자료 전달',due:day(2),status:'open'},stage_contexts:{silent:{fields:{construction_plan:'2027.3'}}}}),
    deal('r-none','다음 행동 없는 현장','이필선','waiting',{created:day(-100),last_meaningful_contact_at:at(70),stage_entered_at:at(75)}),
    deal('r-far','한 달 뒤 연락 현장','황윤선','waiting',{last_meaningful_contact_at:at(12),next_action:{id:'n7',text:'공사 시기 확인',due:day(30),status:'open'}}),
    /* 경쟁: 마감 D-2 · PT D-6 · 마감 D-20 · 제출 완료 · 마감 지남 */
    deal('k-d2','입찰 D-2','이필선','bidding',{amt:4.2e8,stage_contexts:{bidding:{fields:{bid_deadline:day(2),bid_plan:'준비 중'}}}}),
    deal('k-pt','PT 앞둔 경쟁','황윤선','compete',{stage_contexts:{compete:{fields:{competition_type:'PT',competitor:'타사 A',meeting_date:day(6)}}}}),
    deal('k-run','마감 먼 입찰','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(20)}}}}),
    deal('k-sub','제출한 입찰','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(5),bid_plan:'제출 완료'}}}}),
    deal('k-past','마감 지난 입찰','황윤선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(-2)}}}}),
    /* stage7 ④: 결정 · 입찰 일정 없음 = 넷째 칸(D-7 계산 안 함) */
    deal('k-nodate','일정 없는 경쟁','이필선','compete',{last_meaningful_contact_at:at(2),stage_contexts:{compete:{fields:{competition_type:'경쟁견적'}}}}),
    /* 계약·시공: 계약정보 없음 · 인계 중 · 시공 중(9일 무연락) · 준공 단계 */
    deal('t-sign','계약 진행','이필선','contract'),
    deal('t-hand','인계 중','황윤선','construction',{stage_contexts:{contract:{fields:{contract_date:day(-5),contract_amount:3e8,special_terms:'야간 작업 불가'}},construction:{fields:{start_date:day(7),handover:'진행중'}}}}),
    deal('t-build','시공 중','이필선','construction',{last_meaningful_contact_at:at(9),stage_contexts:{contract:{fields:{contract_date:day(-20),contract_amount:3e8,special_terms:'-'}},construction:{fields:{start_date:day(-10),handover:'완료'}}}}),
    deal('t-fin','준공 확인 대기','황윤선','completion',{stage_contexts:{contract:{fields:{contract_date:day(-60),contract_amount:2.5e8}},construction:{fields:{handover:'완료'}}}}),
    deal('w-1','수주 현장','이필선','won',{outcome:'won',won_amount:1.4e8,closed_at:day(-34),completion_date:day(-34)}),
    deal('l-1','실주 현장','이필선','lost',{outcome:'lost',closed_at:day(-3)})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;G.pipeRowV11Off=true;/* 이 검사는 목록 줄 v11 이전의 줄(끄기 스위치 뒤)을 본다 — v11 줄은 scripts/verify-pipeline-row-v11-browser.cjs */ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.psb=null;G.prb=null;G.ps3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=null;window.__act=null;window.__drwReal=drwDeal;window.__daReal=window.DetailActions&&window.DetailActions.open;drwDeal=s=>{window.__open=JSON.parse(s).id;};window.DetailActions=Object.assign(window.DetailActions||{},{open:k=>{window.__act=k;}});
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:()=>true,noteMissing(){}});
   PipelineWorkspace.open('consulting');
  });
  await page.waitForTimeout(400);
  const V=page.locator('#pipeline-stage-v3'),one=s=>String(s).replace(/\s+/g,' ').trim();
  const snap=()=>V.evaluate(v=>{const tx=n=>n?n.textContent.replace(/\s+/g,' ').trim():'';return {stage:v.dataset.stage,head:tx(v.querySelector('.ps3-head b')),desc:tx(v.querySelector('.ps3-head span')),
   tabs:[...v.querySelectorAll('.ps3-tab')].map(t=>[tx(t.querySelector('.n')),tx(t.querySelector('.l')),tx(t.querySelector('span')),t.classList.contains('on'),t.querySelector('.n').classList.contains('r')]),
   diag:tx(v.querySelector('.ps3-box header')),kpis:[...v.querySelectorAll('.ps3-kpis>div')].map(tx),reasons:[...v.querySelectorAll('.ps3-reason')].map(r=>[tx(r.querySelector('span b')),tx(r.querySelector('.c')),r.querySelector('u').style.width]),todo:tx(v.querySelector('.ps3-todo')),
   lhead:tx(v.querySelector('.ps3-lhead>b')),rows:[...v.querySelectorAll('.ps3-row')].map(r=>[r.dataset.key.replace(/^deal:/,''),r.dataset.tab,tx(r.querySelector('.ps3-a b')),tx(r.querySelector('.ps3-a span')),tx(r.querySelector('.ps3-b b')),tx(r.querySelector('.ps3-b span')),tx(r.querySelector('.ps3-d b')),tx(r.querySelector('button')),r.querySelector('.ps3-b b').classList.contains('r'),r.querySelector('.ps3-d b').classList.contains('r')])};});
  /* 단계마다: 탭 이름 · 기준 / 건수 [전체, 빨강, 2, 3] / 사유 4개 건수 / 버튼 3개 / 체류 기준 */
  const EXPECT={
   /* 2026-10-07 stage7: 컨설팅 = 물량 산출 기한(견적팀) · 사유 5개 / 발송 = 넷째 칸 '발송일 확인 필요'(s-nodate) / 경쟁 = 넷째 칸 '일정 미등록'(k-nodate) · 운영 제안 표시 / 계약 · 시공 = 시공 중 방문 없음은 시공 중 칸과 같은 조건 */
   consulting:{name:'컨설팅 설계',goal:14,tabs:[['미팅 전 · 일정 없음','첫 통화에서 미팅 날짜 잡기'],['미팅 예정','미팅 전날 확인 연락'],['미팅 완료 · 견적 준비','미팅 후 견적 요청 등록']],n:[4,1,1,2],reasons:[['미팅 일정 없음',1],['물량 산출 기한 넘김',1],['필수 확인 미입력',2],['다음 행동 · 날짜 없음',1],['30일 넘게 머묾',1]],act:['미팅 잡기','확인 연락','견적 요청'],order:['c-none','c-plan','c-late','c-ok']},
   sent:{name:'자료 발송완료',goal:14,tabs:[['7일 넘음 · 후속 없음','오늘 후속 연락'],['발송 후 7일 안','D+3 수신 확인'],['고객 반응 있음','다음 단계 판단'],['발송일 확인 필요','발송일 · 자료 · 수신자 입력']],n:[4,1,1,1,1],reasons:[['발송 후 7일 · 후속 없음',1],['발송일 미기록 · 판정 불가',1],['결정권자 미확인',3],['다음 행동 · 날짜 없음',3],['30일 넘게 머묾',0]],act:['후속 연락','수신 확인','단계 판단','정보 입력'],order:['s-late','s-wait','s-done','s-nodate'],amb:3},
   /* 관계관리는 2026-10-07 v12(상태 5칸 · 업무 필터 · 전환 검토)로 바뀌어 전용 검사(scripts/verify-relationship-v12-browser.cjs)가 본다. 끄기(G.relV12Off) 경로의 예전 탭 3개는 아래 relOld 로 */
   competition:{name:'경쟁 · 입찰',goal:30,tabs:[['마감 D-7 이내','제안서 · 가격 확정 · 운영 제안'],['진행 중','일정 확인'],['결과 대기','개찰 다음날 결과 등록 · 운영 제안'],['일정 미등록','입찰 · PT 일정 확인']],n:[6,2,1,2,1],reasons:[['제안서 미공유',2],['결정 · 입찰 일정 미등록',1],['경쟁 공법 미확인',5],['결정권자 미확인',6],['결과 미등록',1]],act:['제안 준비','일정 확인','결과 등록','일정 입력'],order:null,amb:3},
   construction:{name:'계약 · 시공',goal:14,/* stage7_2 ⑤: 4상태 — 계약 체결 · 착공 준비(착공일 미입력 · 아직 안 온 착공일) · 시공 중(착공일 입력 후) · 준공 확인 */
   tabs:[['계약 체결','계약일 · 금액 · 계약서'],['착공 준비','착공일 미입력 · 착공일 확인'],['시공 중','착공일 입력 후 · 주 1회 방문'],['준공 확인','준공검사 · 고객 확인']],n:[4,1,1,1,1],reasons:[['계약일 · 금액 없음',1],['착공일 미입력',0],['인계서 미확인',1],['시공 중 주 1회 방문 없음',1]/* 착공한 시공 중 건(9일 무연락)만 — 인계 중(착공 전)은 세지 않는다 */,['준공 확인 없음',1]],act:['정보 입력','착공일 입력','현장 확인','준공 확인'],order:null}};
  for(const key of Object.keys(EXPECT)){
   const E=EXPECT[key];await page.evaluate(k=>PipelineWorkspace.open(k),key);await page.waitForTimeout(350);
   assert.equal(await V.count(),1,key+': 공통 틀 v3');assert.equal((await page.locator('#pg-pipe>.cf-bar .cf-pill').first().innerText()).replace(/\s+/g,' ').trim().replace(/^전체 /,''),(await page.locator('#pipeline-stage-v3 .ps3-tab .n').first().innerText()).trim(),key+': 브랜드 칩 전체 = 목록 전체(2026-10-06 집계 ①)');assert.equal(await page.locator('#pipeline-stage-b').count(),0,key+': 예전 화면은 없다');
   const s=await snap();if(dump)console.log('=====',key,'\n'+JSON.stringify(s,null,1));
   assert.equal(s.stage,key);assert.equal(s.head,E.name);assert.ok(s.desc.length>10,key+': 설명 한 줄');
   /* 상태 탭: [전체] + 상태 3개(stage7: 발송 · 경쟁은 4개) · 기본 선택 = 전체 · 첫 상태만 빨강 */
   assert.deepEqual(s.tabs.map(t=>[t[1],t[2]]),[['전체','이 단계 모든 현장']].concat(E.tabs),key+': 탭 이름 · 기준');
   assert.deepEqual(s.tabs.map(t=>Number(t[0])),E.n,key+': 탭 건수');assert.deepEqual(s.tabs.map(t=>t[3]),[true].concat(E.tabs.map(()=>false)),key+': 기본 = 전체');
   assert.deepEqual(s.tabs.map(t=>t[4]),[false,E.n[1]>0].concat(E.tabs.slice(1).map(()=>false)),key+': 빨강은 첫 상태 숫자만');
   assert.equal(E.n.slice(1).reduce((a,b)=>a+b,0),E.n[0],key+': 탭 합 = 전체');
   assert.equal(await page.evaluate(k=>PipelineWorkspace.rows({}).filter(r=>PipelineStages.group(r.code)===k).length,key),E.n[0],key+': 전체 = 이 단계 건수');
   /* 진단: 기준 넘김 = 빨강 상태 건수 · 평균 체류 · 기준 n일 */
   assert.match(s.diag,new RegExp('^단계 진단 ?'+E.n[0]+'건 · '));
   /* stage7 공통: 제목 숫자 = '기한 초과 n'(판정 함수의 기한 초과와 같은 수) · 아래 '확인 필요 n = 날짜 미입력 + 판정 불가'. '기준 넘김' 단어 없음 */
   if(key==='competition'){assert.match(s.kpis[0],/^후속 업무 지연 ?0건 ?입찰 일정 없음 1 · 다음 행동일 없음 6 · 판정 불가 0$/);}else{const m=/^기한 초과 ?(\d+)건 ?확인 필요 (\d+) · 날짜 미입력 (\d+) · 판정 불가 (\d+)$/.exec(s.kpis[0]);assert.ok(m,key+': 제목 숫자 글 — '+s.kpis[0]);assert.equal(Number(m[2]),Number(m[3])+Number(m[4]),key+': 확인 필요 = 날짜 미입력 + 판정 불가');
    const T=await page.evaluate(k=>{const J=PipelineJudge,T=J.tally(PipelineWorkspace.rows({}).filter(r=>PipelineStages.group(r.code)===k).map(r=>r.item));return [T.late,T.nodate,T.norecord];},key);assert.deepEqual([Number(m[1]),Number(m[3]),Number(m[4])],T,key+': 판정 함수와 같은 수');}
   assert.doesNotMatch(s.kpis[0]+s.diag+s.todo,/기준 넘김/,key+': 기준 넘김 단어 없음');assert.match(s.kpis[1],key==='competition'?/^평균 체류 ?\d+일 ?진입일 입력 6 \/ 6건$/:new RegExp('^평균 체류 ?\\d+일 ?기준 '+E.goal+'일$'));
   /* 왜 멈춰 있나: 사유(4~5개) · 첫 사유 = 빨강 상태 건수 */
   assert.deepEqual(s.reasons.map(r=>[r[0],Number(r[1])]),E.reasons,key+': 사유 건수');assert.equal(Number(s.reasons[0][1]),E.n[1],key+': 첫 사유 = 빨강 상태');
   assert.deepEqual(s.reasons.map(r=>r[2]),E.reasons.map(r=>Math.min(100,Math.round(r[1]/E.n[0]*100))+'%'),key+': 막대 = 건수 ÷ 전체');
   assert.ok(s.todo.length>15&&/[.]$/.test(s.todo),key+': 뭘 해야 하나 한 문장');
   /* 리스트: 전체 탭에서는 줄마다 그 현장 상태의 사유 · 버튼. 빨강 상태만 사유 빨강 · 체류는 기준 넘으면 빨강 */
   assert.equal(s.lhead,'확인할 현장 '+E.n[0]+'곳');assert.equal(s.rows.length,E.n[0]);
   if(E.order)assert.deepEqual(s.rows.map(r=>r[0]),E.order,key+': 빨강 상태 먼저 → 체류 긴 순');
   for(const r of s.rows){const t=Number(r[1]);assert.equal(r[7],key==='construction'&&r[0]==='t-hand'?'착공 준비'/* stage7 ⑤: 착공 전 시공 중 건 */:E.act[t],key+' '+r[0]+': 버튼 = 상태별 이름');assert.equal(r[4],t===0?E.reasons[0][0]:E.tabs[t][1],key+' '+r[0]+': 사유 = 상태별');assert.equal(r[8],t===0,key+' '+r[0]+': 빨강 상태만 빨강');assert.equal(r[9],Number(r[6].replace('일',''))>E.goal,key+' '+r[0]+': 체류 기준 '+E.goal+'일');assert.ok(r[5].length>0,key+' '+r[0]+': 보조 한 줄');}
   assert.deepEqual(E.tabs.map((_,t)=>s.rows.filter(r=>Number(r[1])===t).length),E.n.slice(1),key+': 줄 수 = 탭 건수');
   if(E.amb!=null)assert.equal(await page.locator('#pipeline-stage-v3 .ps3-tab').nth(E.amb+1).locator('.n').evaluate(n=>n.classList.contains('amb')&&getComputedStyle(n).color),'rgb(192, 57, 43)',key+': 넷째 칸(확인 필요) 숫자는 붉은 계열');
   if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-'+key+'.png')});
  }
  /* 시안의 글자 크기 · 버튼 모양 */
  await page.evaluate(()=>PipelineWorkspace.open('consulting'));await page.waitForTimeout(300);
  const css=(sel,props)=>V.locator(sel).first().evaluate((n,props)=>{const s=getComputedStyle(n);return props.map(p=>s[p]);},props);
  assert.equal(await V.evaluate(n=>getComputedStyle(n).fontFamily===getComputedStyle(document.body).fontFamily),true,'CRM 본문 글꼴 그대로');
  assert.deepEqual(await css('.ps3-head b',['fontSize']),['22px']);assert.deepEqual(await css('.ps3-head span',['fontSize','color']),['14px','rgb(75, 85, 99)']);
  assert.deepEqual(await css('.ps3-tab .n',['fontSize']),['24px']);assert.deepEqual(await css('.ps3-tab .l',['fontSize','whiteSpace','textOverflow']),['15px','nowrap','ellipsis']);assert.deepEqual(await css('.ps3-tab span',['fontSize','color']),['12.5px','rgb(107, 114, 128)']);
  assert.deepEqual(await css('.ps3-tab.on',['borderBottomWidth','borderBottomColor','backgroundColor']),['3px','rgb(59, 108, 228)','rgb(248, 250, 255)'],'선택 = 파란 밑줄 3px');
  assert.deepEqual(await V.locator('.ps3-tab').nth(1).locator('.n').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)','빨강 상태는 숫자 빨강');
  assert.equal(await V.locator('.ps3-tabs').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),4,'상태 탭 4칸');
  assert.deepEqual(await css('.ps3-box header b',['fontSize']),['16px']);assert.deepEqual(await css('.ps3-kpis .over',['backgroundColor']),['rgb(253, 243, 242)']);assert.deepEqual(await css('.ps3-kpis .over b',['fontSize','color']),['24px','rgb(180, 35, 24)']);
  assert.deepEqual(await css('.ps3-reason span b',['fontSize','fontWeight']),['14px','600']);assert.deepEqual(await css('.ps3-todo',['fontSize','color']),['14px','rgb(55, 65, 81)']);
  assert.deepEqual(await css('.ps3-a>b',['fontSize','whiteSpace']),['15.5px','nowrap']);assert.deepEqual(await css('.ps3-a>span',['fontSize']),['13px']);assert.deepEqual(await css('.ps3-b>b',['fontSize','fontWeight','color']),['14px','700','rgb(180, 35, 24)']);
  assert.deepEqual(await css('.ps3-row button',['width','backgroundColor','borderTopColor','color','fontSize','fontWeight','borderTopLeftRadius']),['96px','rgb(245, 248, 255)','rgb(213, 224, 251)','rgb(42, 82, 184)','13px','600','8px'],'버튼 96px 고정 · 연파랑');
  assert.deepEqual(await V.locator('.ps3-row').evaluateAll(l=>l.map(r=>getComputedStyle(r).borderLeftColor)),['rgb(232, 89, 12)','rgb(31, 157, 85)','rgb(31, 157, 85)','rgb(227, 230, 236)'],'왼쪽 브랜드 색 띠(없으면 회색)');
  assert.deepEqual(await V.locator('.ps3-diag').evaluate(n=>[Math.round(n.getBoundingClientRect().width)<=360,n.getBoundingClientRect().left<document.querySelector('#pipeline-stage-v3 .ps3-main').getBoundingClientRect().left]),[true,true],'왼쪽 진단 최대 360px');
  assert.deepEqual(await V.evaluate(v=>[...v.querySelectorAll('*')].filter(e=>!e.closest('.ps3-views')&&!e.closest('.lpg')).map(e=>getComputedStyle(e).backgroundColor).filter(c=>/^rgb\(/.test(c)&&c.match(/\d+/g).slice(0,3).every(x=>Number(x)<90))),[],'검정 · 남색 바탕 없음');
  /* 탭 → 목록 · 사유 → 필터 꼬리표(×) */
  await V.locator('.ps3-tab').nth(3).click();await page.waitForTimeout(200);
  assert.deepEqual(await V.locator('.ps3-row').evaluateAll(l=>l.map(r=>r.dataset.key.replace(/^deal:/,''))),['c-late','c-ok']);assert.equal(one(await V.locator('.ps3-lhead>b').innerText()),'확인할 현장 2곳');
  assert.deepEqual(await V.locator('.ps3-tab').evaluateAll(l=>l.map(t=>t.getAttribute('aria-pressed'))),['false','false','false','true']);
  await V.locator('.ps3-reason',{hasText:'필수 확인 미입력'}).click();await page.waitForTimeout(200);
  assert.deepEqual(await V.locator('.ps3-row').evaluateAll(l=>l.map(r=>r.dataset.key.replace(/^deal:/,''))),['c-late'],'탭 + 사유로 걸러짐');assert.equal(await V.locator('.ps3-chip').innerText(),'필수 확인 미입력 ×');
  assert.deepEqual(await V.locator('.ps3-reason.on').evaluate(n=>{const s=getComputedStyle(n);return [s.borderTopColor,s.backgroundColor];}),['rgb(21, 23, 28)','rgb(248, 249, 251)']);
  await V.locator('.ps3-chip').click();await page.waitForTimeout(200);assert.equal(await V.locator('.ps3-chip').count(),0);assert.equal(await V.locator('.ps3-row').count(),2);
  await V.locator('.ps3-tab').first().click();await page.waitForTimeout(200);
  await V.locator('.ps3-reason',{hasText:'30일 넘게 머묾'}).click();await page.waitForTimeout(200);assert.deepEqual(await V.locator('.ps3-row').evaluateAll(l=>l.map(r=>r.dataset.key.replace(/^deal:/,''))),['c-none']);
  await V.locator('.ps3-reason',{hasText:'30일 넘게 머묾'}).click();await page.waitForTimeout(200);assert.equal(await V.locator('.ps3-row').count(),4,'같은 사유를 다시 누르면 풀림');
  /* 버튼 = 그 현장 상세 + 상태별 액션 · 줄 = 상세 */
  await V.locator('.ps3-row[data-key$="c-none"] button').click();assert.deepEqual(await page.evaluate(()=>[__open,__act]),['c-none',null]);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>__act),'next','미팅 잡기 = 다음 할 일');
  await page.evaluate(()=>{__open=null;__act=null;});await V.locator('.ps3-row[data-key$="c-ok"] .ps3-a').click();await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>[__open,__act]),['c-ok',null],'줄 = 상세만');
  /* 보드: 상태 3개 = 세로 칸 */
  await V.locator('.ps3-views button',{hasText:'보드'}).click();await page.waitForTimeout(250);
  assert.deepEqual((await V.locator('.ps3-col .ch').allInnerTexts()).map(one),['미팅 전 · 일정 없음 1','미팅 예정 1','미팅 완료 · 견적 준비 2']);
  assert.deepEqual(await V.locator('.ps3-col').evaluateAll(l=>l.map(c=>c.querySelectorAll('.ps3-card').length)),[1,1,2]);
  /* 카드: 막힌 이유 · 다음 행동이 항상 보인다(마우스를 올리지 않아도) + 공종 · 영업건 번호(2026-10-05 정합성 ③ ④) */
  assert.match(one(await V.locator('.ps3-card').first().innerText()),/^석민이앤씨 #cnone 35일 일정 없는 컨설팅 공종 미분류 · 이필선 · 2억 확인 필요 · 미팅 일정 없음 다음 행동 없음 미팅 잡기$/);
  assert.deepEqual(await V.locator('.ps3-col').first().evaluate(n=>{const s=getComputedStyle(n),c=getComputedStyle(n.querySelector('.ps3-card button')),d=getComputedStyle(n.querySelector('.ch .c'));return [s.backgroundColor,s.borderTopLeftRadius,c.backgroundColor,c.color,c.fontSize,d.color];}),['rgb(238, 240, 244)','12px','rgb(245, 248, 255)','rgb(29, 63, 153)','12.5px','rgb(180, 35, 24)']);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-board.png')});
  await V.locator('.ps3-views button',{hasText:'리스트'}).click();await page.waitForTimeout(200);
  /* 공통 필터(브랜드)를 걸어도 탭 합 = 전체 */
  await page.locator('.cf-bar [data-sf-brand="POUR솔루션"]:visible').first().click();await page.waitForTimeout(300);
  const fs2=await snap();assert.deepEqual(fs2.tabs.map(t=>Number(t[0])),[2,0,1,1],'브랜드 필터 뒤 탭 건수');assert.equal(fs2.rows.length,2);
  await page.locator('.cf-bar [data-sf-brand="전체"]:visible').first().click();await page.waitForTimeout(300);
  /* 좁은 화면: 진단이 위로 */
  await page.setViewportSize({width:900,height:1000});await page.waitForTimeout(300);
  assert.equal(await V.evaluate(v=>v.querySelector('.ps3-diag').getBoundingClientRect().bottom<=v.querySelector('.ps3-main').getBoundingClientRect().top+1),true,'좁으면 진단이 위로');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'가로 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  /* 목록 버튼은 새 상세 창의 자리로 간다(2026-10-05 대표 "미팅 잡기 누르면 최근에 만들어놨던 걸로 연결" · "이전 버전은 내 눈에 안 띄게"):
     [미팅 잡기] → 상세 창의 가운데 입력칸(통화 중 표시 — 2026-10-06 정돈안: 연락 입구는 입력칸 하나) · 예전 '다음 할 일 설정' 창(#detailAction · .dp-next) 없음 · 머리줄 [⋯] 메뉴 없음 */
  await page.evaluate(()=>{drwDeal=window.__drwReal;if(window.__daReal)window.DetailActions.open=window.__daReal;window.__act=null;PipelineWorkspace.open('consulting');});await page.waitForTimeout(300);
  await page.locator('#pipeline-stage-v3 .ps3-row[data-key$="c-none"] button').click();await page.waitForSelector('#detailView.dv3 #ddvComposer.dvt-calling',{timeout:5000});
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView');return [!!v.querySelector('.nc-call.dvt-on'),v.querySelectorAll('#ddvComposer.dvt-calling').length,document.querySelectorAll('#detailAction,.dp-next').length,v.querySelectorAll('.da-more,.da-toolbar,.da-tools').length,/다음 할 일 설정/.test(v.innerText)];}),[true,1,0,0,false],'미팅 잡기 = 지금 할 일 카드');
  assert.match(await page.locator('#detailView .nc-call').innerText(),/통화 중 · 결과를 가운데에 적어 주세요/);assert.equal(await page.locator('#detailView .dv3-form').count(),0,'오른쪽 카드 안에 입력 틀을 펼치지 않는다');
  if(process.env.SHOT)await page.screenshot({path:process.env.SHOT});
  /* [견적 요청] → 이 단계 필수 정보 · [단계 판단] 류 → 단계 바꾸기 띠. 둘 다 예전 입력 창을 띄우지 않는다 */
  assert.deepEqual(await page.evaluate(()=>[DealDetailV3.openFrom('stagefields'),document.querySelectorAll('#detailAction').length,DealDetailV3.openFrom('stage'),!!document.querySelector('#detailView .dv3-move'),DealDetailV3.openFrom('support')]),[true,0,true,true,false]);
  /* 오늘 업무 · 관계관리 · 다른 목록이 쓰는 바로가기(briefNextAction · dccGoNext · dccGoActivity)도 같은 카드로 간다 — 예전 창 없음 */
  const fold=async()=>{await page.evaluate(()=>{try{DetailActions.close();}catch(e){}const v=document.getElementById('detailView'),m=v.querySelector('[data-dv3="mv"]');if(v.querySelector('.dv3-move #stage-transition-form')&&m)m.click();});await page.locator('#detailView .nc-call.dvt-on').click();await page.waitForTimeout(150);assert.equal(await page.locator('#detailView .dvt-calling').count(),0);};
  for(const go of ['briefNextAction','dccGoNext','dccGoActivity']){await fold();await page.evaluate(go=>window[go](),go);await page.waitForTimeout(300);
   assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#detailView.dv3 #ddvComposer.dvt-calling').length,document.querySelectorAll('#detailAction,.dp-next').length]),[1,0],go+' = 지금 할 일 카드');}
  /* 창을 열자마자 부르는 경우(오늘 업무: 열기 + 바로가기)도 같다 */
  await fold();await page.evaluate(()=>{const d=CUR_DETAIL.item;G._detailPopup=true;drwDeal(JSON.stringify(d));dccGoActivity();});await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#detailView.dv3 #ddvComposer.dvt-calling').length,document.querySelectorAll('#detailAction,.dp-next').length]),[1,0],'열자마자 바로가기 = 지금 할 일 카드');
  await page.evaluate(()=>{try{closeDetail();}catch(e){}});await page.waitForTimeout(200);
  /* 수주 · 실주도 같은 틀(2026-10-06 대표 "이 기준으로 수주 · 실주 크기 및 배치 동일하게"): 상태 탭 4칸 = B안 막대 3칸, 사유 · 버튼은 B안 표 그대로 · 끄면 이전 화면 */
  for(const [k,tabs,reason0] of [['won',['전체','수주 정보 미기록','계약일 · 착공 · 준공 확인','실적 · 완료 정보 완료'],'수주 유형 · 낙찰금액 · 낙찰사 미기록'],['lost',['전체','기록 보완 필요','기록 완료','재영업 가능 · 예'/* stage7 ⑦ */],'실주 사유 미입력']]){
   await page.evaluate(k=>PipelineWorkspace.open(k),k);await page.waitForTimeout(300);
   assert.equal(await page.locator('#pipeline-stage-v3[data-stage="'+k+'"]').count(),1,k+': 공통 틀 v3');assert.equal(await page.locator('#pipeline-stage-b').count(),0,k+': 예전 화면 없음');
   assert.deepEqual(await page.locator('#pipeline-stage-v3 .ps3-tab .l').allInnerTexts(),tabs,k+' 탭');
   assert.deepEqual(await page.locator('#pipeline-stage-v3 .ps3-reason.first>span>b:first-child').allInnerTexts(),[reason0],k+' 빨강 사유 = B안 표의 빨강');
   assert.match(await page.locator('#pipeline-stage-v3 .ps3-kpis').innerText(),k==='won'?/실적 정보 보완\s*\d+건\s*기한 초과 0 · 지연 아님 · 끝 상태[\s\S]*결과 기록 완성률\s*[\d.]+%\s*\d+ \/ \d+/:/결과 정보 보완\s*\d+건\s*기한 초과 0 · 지연 아님 · 끝 상태[\s\S]*결과 기록 완성률\s*[\d.]+%\s*\d+ \/ \d+/,k+': stage7 ⑥⑦ 끝 상태 제목 숫자');
   if(k==='won')assert.match(await page.locator('#pipeline-stage-v3 .ps3-diag .ps3-box header span').first().innerText(),/^1건 · 1\.4억 · 낙찰금액 입력 1건 기준$/,'수주 금액 옆 근거 건수');
   assert.equal(await page.locator('#pipeline-stage-v3 .ps3-diag>.ps3-box').nth(2).locator('.psb-act,.ps3-none').count()>0,true,k+' 그래서 뭘 해야 하나 = 사유별 할 일');
  }
  /* 관계관리: v12 를 끄면(G.relV12Off) 예전 탭 3개(다음 연락일 지남 · 이번 주 연락 · 장기 대기) · 켜면 상태 5칸 — 자세한 것은 scripts/verify-relationship-v12-browser.cjs */
  await page.evaluate(()=>{G.relV12Off=true;PipelineWorkspace.open('relationship');});await page.waitForTimeout(300);
  assert.deepEqual(await page.locator('#pipeline-stage-v3 .ps3-tab .l').allInnerTexts(),['전체','다음 연락일 지남','이번 주 연락','장기 대기'],'relOld: 끄면 예전 탭 3개');
  assert.deepEqual(await page.locator('#pipeline-stage-v3 .ps3-tab .n').allInnerTexts(),['4','1','1','2'],'relOld: 탭 건수');
  await page.evaluate(()=>{G.relV12Off=false;PipelineWorkspace.open('relationship');});await page.waitForTimeout(300);
  assert.deepEqual(await page.locator('#pipeline-stage-v3 .ps3-tab .l').allInnerTexts(),['전체','집중관리','일반관리','대기','보류','미확인 · 기준일 확인 필요'],'v12: 상태 5칸');
  await page.evaluate(()=>{G.pipeStageV3Off=true;PipelineWorkspace.open('consulting');});await page.waitForTimeout(300);
  assert.equal(await page.locator('#pipeline-stage-v3').count(),0);assert.equal(await page.locator('#pipeline-stage-b').count(),1,'끄면 이전 화면');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('pipeline stage v3 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
