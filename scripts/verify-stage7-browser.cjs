'use strict';
/* 파이프라인 7단계 기준 · 판정 정리 검사(2026-10-07 design_handoff_stage7 · 시안 '7단계 기준 정리 시안.dc.html') — 합성 자료(현장 이름은 지어낸 것)
   단계 순서 · 메뉴 · 배치는 그대로. 확인하는 것:
   ① 컨설팅: '물량 산출 기한'(견적 예정일 · 견적팀) · 견적 요청 등록 전 = '기한 없음 · 설정값 확인'(설정 quote_request_days 는 보류 · 운영 제안)
   ② 발송: 발송일 없으면 '발송일 확인 필요 · 7일 계산 안 함' + 다음 업무 = 실제 발송 · 기존 증빙 확인
   ④ 경쟁: 일정 없으면 '입찰 · PT 일정 확인' · '기한 없음 · 일정 입력 후 계산' · 운영 제안 표시
   ⑤ 계약 · 시공: 세부 상태별 다음 업무(계약 정보 입력 / 착공 준비 / 주간 현장 방문 / 준공 확인) · 계약 확인 끝난 건의 '계약 체결 확인'은 종료 대상
   ⑥⑦ 수주 · 실주: 끝 상태 · 서로 거치지 않음 · 재영업 가능 '예'만 재접촉 · 실주일은 한국 시간(목록 · 판정 같은 날)
   공통: 제목 숫자 '기한 초과 n · 확인 필요 n' · 필수값 없으면 단계 이동 차단 · 필수 정보 칩(회의 확정 진하게 · 적용안 회색) · 설정 화면 '미팅 후 견적 요청 등록' = 보류 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineStageV3&&window.PipelineRowV11&&window.PipelineWorkspace&&window.PipelineJudge&&window.StageTransition&&window.CRMRules&&window.DealDetailV3);
  await page.evaluate(()=>{
   const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
   const day=n=>KST.format(new Date(Date.now()+n*864e5)),at=n=>new Date(Date.now()+n*864e5).toISOString();window.DAY=day;
   const deal=(id,site,code,o)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-60),stage_entered_at:at(-20),code,stage_code:code,grp:'영업·관리',amt:1e8,manager_name:'관리소장',manager_mobile:'01000001111',contacts:[],activities:[],stage_contexts:{}},o||{});
   B={deals:[
    /* ① 컨설팅: 미팅 완료 · 견적 요청 전 / 견적 요청 등록 · 견적 예정일 없음 / 견적 예정일(물량 산출 기한) 2일 지남 */
    deal('c-meet','미팅 완료 견적 요청 전','consulting',{activities:[{id:'a1',type:'방문',note:'1차 현장미팅 완료',at:at(-4),occurred_at:at(-4)}]}),
    deal('c-req','견적 요청 등록 현장','consulting',{stage_contexts:{consulting:{fields:{quote_request:'옥상 방수 전체'}}},activities:[{id:'a2',type:'전화',note:'통화 완료',at:at(-2),occurred_at:at(-2)}]}),
    deal('c-due','물량 산출 기한 지난 현장','consulting',{stage_contexts:{consulting:{fields:{quote_request:'외벽 균열',quote_due:day(-2)}}}}),
    /* ② 발송: 발송일 없음(연락 기록 있음) */
    deal('s-nodate','발송일 없는 현장','sent',{last_meaningful_contact_at:at(-3),activities:[{id:'a3',type:'전화',note:'자료 보냈다고 함',at:at(-3),occurred_at:at(-3)}]}),
    /* ④ 경쟁: 일정 없음 */
    deal('k-nodate','일정 없는 경쟁','compete',{last_meaningful_contact_at:at(-2),activities:[{id:'a4',type:'전화',note:'경쟁 견적 진행 중',at:at(-2),occurred_at:at(-2)}],stage_contexts:{compete:{fields:{competition_type:'경쟁견적'}}}}),
    /* ⑤ 계약 · 시공: 계약 정보 없음 / 계약 확인 끝 · 착공 전 / 시공 중(착공 10일 전 · 다음 할 일이 아직 '계약 체결 확인') / 준공 단계 */
    deal('t-info','계약 정보 없는 현장','contract',{}),
    deal('t-prep','착공 준비 현장','construction',{stage_contexts:{contract:{fields:{contract_date:day(-5),contract_amount:3e8}},construction:{fields:{start_date:day(7),handover:'진행중'}}}}),
    deal('t-build','시공 중 현장','construction',{last_meaningful_contact_at:at(-2),stage_contexts:{contract:{fields:{contract_date:day(-20),contract_amount:3e8}},construction:{fields:{start_date:day(-10),handover:'완료'}}},next_action:{id:'n1',text:'계약 체결 확인',due:day(-1),status:'open'}}),
    deal('t-fin','준공 확인 현장','completion',{stage_contexts:{contract:{fields:{contract_date:day(-60),contract_amount:2.5e8}},construction:{fields:{start_date:day(-40),handover:'완료'}}}}),
    /* ⑥⑦ 수주 · 실주(실주일은 UTC 15:00 = 한국 다음날 00:00 → 한국 날짜로 보여야 한다) · 재영업 '예' · '아니오' */
    deal('w-1','수주 현장','won',{outcome:'won',won_amount:1.4e8,closed_at:day(-34),completion_date:day(-34)}),
    deal('l-yes','재영업 예 실주','lost',{outcome:'lost',closed_at:day(-10)+'T15:00:00.000Z',lost_reason:'가격 · 가격 경쟁',stage_contexts:{lost:{fields:{close_reason:'가격 · 가격 경쟁',close_detail:'타사 단가',competitor:'A건설',reengage:'예'}}}}),
    deal('l-no','재영업 아니오 실주','lost',{outcome:'lost',closed_at:day(-3),lost_reason:'사업 · 공사 취소',stage_contexts:{lost:{fields:{close_reason:'사업 · 공사 취소',close_detail:'사업 취소',competitor:'B건설',reengage:'아니오'}}}})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};/* 이 검사는 오른쪽 상자의 기능을 본다 — 상자를 가운데 칸 패널로 옮긴 새 배치(detail_right_fix)는 verify-detail-right-fix-browser.cjs 가 본다 */G.dealRightKeep=true;AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.ps3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.queueDetailContactOperation=()=>'op';SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[]}})};TOKEN='test';if(window.OpsStore)OpsStore.aiOn=()=>false;
   PipelineWorkspace.open('consulting');
  });
  await page.waitForSelector('#pipeline-stage-v3 .prv-list .prv-row');await page.waitForTimeout(300);
  const V=page.locator('#pipeline-stage-v3'),L=V.locator('.prv-list');
  const rowOf=k=>L.locator('.prv-row[data-key$="'+k+'"]').evaluate(r=>{const t=s=>{const n=r.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};return {now:t('.prv-b>span'),base:t('.prv-b>small.base'),task:t('.prv-c>b'),due:t('.prv-c>small:first-of-type'),dueCls:r.querySelector('.prv-c>small:first-of-type').className,why:t('.prv-c>small.why'),stale:t('.prv-c>small.why.stale'),btn:t(':scope>button'),act:r.querySelector(':scope>button').dataset.v,tab:r.dataset.tab};});
  const kpi=()=>V.locator('.ps3-kpis .over').innerText().then(one);
  /* ① 컨설팅 */
  assert.match(one(await V.locator('.ps3-head span').innerText()),/물량 산출 목표 3일 · 최대 5일 \(견적 요청 등록일부터 · 견적팀\)$/);assert.doesNotMatch(one(await V.locator('.ps3-head span').innerText()),/견적 처리/);
  assert.equal(one(await V.locator('.ps3-tab').nth(3).locator('span').innerText()),'미팅 기록 · 견적 요청 확인');
  const cm=await rowOf('c-meet');assert.deepEqual([cm.task,cm.due,cm.why,cm.btn],['견적 요청 등록','기한 없음 · 설정값 확인','판정: 미팅 완료 '+(await page.evaluate(()=>PipelineJudge.md(DAY(-4))))+' · 견적 요청 전 견적 요청 등록','견적 요청'],'미팅 후 견적 요청 등록 = 별도 업무 · 기한은 설정값');
  const cr=await rowOf('c-req');assert.deepEqual([cr.task,cr.due,cr.why.replace(/\s*견적 예정일 입력$/,'')],['물량 산출 기한 확인 (견적팀)','날짜 미입력 · 기한 계산 안 함','판정: 견적 요청 등록 · 예정일 없음']);
  const cd=await rowOf('c-due');assert.deepEqual([cd.due,cd.dueCls,cd.why.slice(0,22)],['2일 지남','r','판정: 물량 산출 기한 '+(await page.evaluate(()=>PipelineJudge.md(DAY(-2))))]);
  assert.match(await kpi(),/^기한 초과 판정 가능 1 \/ 3 판정 불가 · 일정 · 기록 미확인 2건 기한 안 · 해당 없음 0건 실제 기한 초과 1건 다음 업무 · 기존 기록 확인 → 일정 · 날짜 등록$/,'진단 칸(after_deploy 8): 판정 가능 1 / 3 · 판정 불가 2 · 실제 기한 초과(물량 산출 기한) 1');
  assert.deepEqual((await V.locator('.ps3-reason span>b:first-child').allInnerTexts()),['미팅 여부 확인 필요','물량 산출 기한 넘김','필수 확인 미입력','다음 행동 · 날짜 없음','30일 넘게 머묾']);
  /* 설정: '미팅 후 견적 요청 등록'은 보류(운영 제안) · 값이 없으니 기한 계산 안 함 · 값을 넣으면 계산 */
  assert.deepEqual(await page.evaluate(()=>{const r=CRMRules.ROWS.find(x=>x.k==='quote_request_days');return [r.st,r.l,r.unit,CRMRules.get('quote_request_days')===undefined];}),['hold','미팅 후 견적 요청 등록','일',true]);
  /* 값이 정해지면(회의 확정 뒤 설정에 값이 들어오면) 미팅 완료 + n일로 계산 — 지금은 보류 행이라 설정 화면에서 못 넣으므로 읽기 함수만 잠시 바꿔 본다 */
  await page.evaluate(()=>{Object.defineProperty(window.OPS_RULES,'quoteRequestDays',{get:()=>3,set(){},configurable:true});paint();});await page.waitForTimeout(250);
  assert.deepEqual([(await rowOf('c-meet')).due,(await rowOf('c-meet')).why.slice(0,9)],['1일 지남','판정: 미팅 완료'],'설정값이 생기면 미팅 완료 + n일로 계산');
  await page.evaluate(()=>{delete window.OPS_RULES.quoteRequestDays;paint();});await page.waitForTimeout(250);assert.equal((await rowOf('c-meet')).due,'기한 없음 · 설정값 확인');
  /* ② 발송 */
  await page.evaluate(()=>PipelineWorkspace.open('sent'));await page.waitForSelector('#pipeline-stage-v3[data-stage="sent"] .prv-row');await page.waitForTimeout(200);
  assert.deepEqual(await V.locator('.ps3-tab .l').allInnerTexts(),['전체','7일 넘음 · 후속 없음','발송 후 7일 안','후속 확인 기록 있음','발송일 확인 필요']);
  const sn=await rowOf('s-nodate');assert.deepEqual([sn.tab,sn.now,sn.task,sn.due,sn.dueCls,sn.btn,sn.act],['3','발송일 확인 필요 · 발송 여부 · 기존 증빙 확인','실제 발송 · 기존 증빙 확인','발송일 확인 필요 · 7일 계산 안 함','g','증빙 확인','stagefields']);
  assert.match(sn.why,/^판정: 발송일 미등록 발송일 입력$/);assert.match(await kpi(),/^발송 후 후속 지연 판정 가능 0 \/ 1 판정 불가 · 발송일 미확인 1건 확인 완료 · 기한 안 – 실제 지연 – 다음 업무 · 기존 발송 자료 · 수신자 · 발송일 확인$/,'발송일 없는 건은 지연 0건이 아니라 판정 불가(근거 없는 0건 금지)');
  /* ④ 경쟁 */
  await page.evaluate(()=>PipelineWorkspace.open('competition'));await page.waitForSelector('#pipeline-stage-v3[data-stage="competition"] .prv-row');await page.waitForTimeout(200);
  assert.deepEqual(await V.locator('.ps3-tab').evaluateAll(l=>l.map(t=>[t.querySelector('.l').textContent,t.querySelector('span').textContent])),[['전체','이 단계 모든 현장'],['마감 D-7 이내','제안서 · 가격 확정 · 운영 제안'],['진행 중','일정 확인'],['결과 대기','개찰 다음날 결과 등록 · 운영 제안'],['일정 미등록','입찰 · PT 일정 확인']]);
  assert.match(one(await V.locator('.ps3-head span').innerText()),/운영 제안 · 회의 확정 아님/);
  const kn=await rowOf('k-nodate');assert.deepEqual([kn.tab,kn.task,kn.due,kn.btn],['3','입찰 · PT 일정 확인','기한 없음 · 일정 입력 후 계산','일정 입력']);assert.match(kn.why,/^판정: 결정 · 입찰 일정 미등록 입찰 · PT 일정 입력$/);
  /* ⑤ 계약 · 시공 */
  await page.evaluate(()=>PipelineWorkspace.open('construction'));await page.waitForSelector('#pipeline-stage-v3[data-stage="construction"] .prv-row');await page.waitForTimeout(200);
  const ti=await rowOf('t-info'),tp=await rowOf('t-prep'),tb=await rowOf('t-build'),tf=await rowOf('t-fin');
  assert.deepEqual([ti.task,ti.btn,tp.task,tp.btn,tb.task,tb.btn,tf.task,tf.btn],['계약 정보 입력','정보 입력','착공 준비','착공 준비','주간 현장 방문','현장 확인','준공 확인','준공 확인'],'세부 상태별 다음 업무');
  assert.equal(tb.stale,'"계약 체결 확인" 종료 대상','계약 확인 끝난 건의 이전 업무는 종료 대상');assert.equal(tb.due,'1일 지남');
  assert.deepEqual(await V.locator('.ps3-reason').evaluateAll(l=>l.map(b=>[b.querySelector('span>b').textContent,b.querySelector('.c').textContent])),[['계약일 · 금액 없음','1'],['착공일 미입력','0'],['인계서 미확인','1'],['시공 중 주 1회 방문 없음','0'],['준공 확인 없음','1']],'시공 중 방문 없음은 착공한 건만(2일 전 연락 → 0)');
  assert.equal(one(await V.locator('.ps3-tab').nth(3).locator('span').innerText()),'착공일 입력 후 · 주 1회 방문');/* stage7_2 ⑤: 4상태 — 계약 체결 · 착공 준비 · 시공 중 · 준공 확인 */
  /* ⑥ 수주 · ⑦ 실주: 끝 상태 · 제목 숫자 · 실주일 한국 시간 · 재영업 '예'만 재접촉 */
  await page.evaluate(()=>PipelineWorkspace.open('won'));await page.waitForSelector('#pipeline-stage-v3[data-stage="won"] .prv-row');await page.waitForTimeout(200);
  assert.match(await kpi(),/^실적 정보 보완 1건 기한 초과 0 · 지연 아님 · 끝 상태$/);assert.match(one(await V.locator('.ps3-diag .ps3-box header span').first().innerText()),/^1건 · 1\.4억 · 낙찰금액 입력 1건 기준$/);
  const w1=await rowOf('w-1');assert.deepEqual([w1.now,w1.base,w1.due,w1.dueCls],['수주 · '+(await page.evaluate(()=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(DAY(-34));return m[1]+'.'+(+m[2])+'.'+(+m[3]);}))+' · 1.4억','수주 결과 항목 보완 필요','확인 필요 · 기한 아님','amb']);
  assert.match(one(await V.locator('.ps3-head span').innerText()),/^끝 상태 · /);
  await page.evaluate(()=>PipelineWorkspace.open('lost'));await page.waitForSelector('#pipeline-stage-v3[data-stage="lost"] .prv-row');await page.waitForTimeout(200);
  assert.match(await kpi(),/^결과 정보 보완 \d+건 기한 초과 0 · 지연 아님 · 끝 상태$/);assert.doesNotMatch(one(await V.locator('.ps3-head span').innerText()),/대기|2개월|차기 공사/);
  const kd=await page.evaluate(()=>{const k=DAY(-9),m=/^(\d{4})-(\d{2})-(\d{2})/.exec(k);return {dot:m[1]+'.'+(+m[2])+'.'+(+m[3]),md:(+m[2])+'.'+(+m[3])};});
  const ly=await rowOf('l-yes'),ln=await rowOf('l-no');
  assert.deepEqual([ly.now,ly.why],['실주 · '+kd.dot+' · 가격','판정: 실주 '+kd.md+' · 기한 없음'],'실주일 = 한국 날짜(UTC 15:00 = 다음날) · 목록과 판정이 같은 날');
  assert.deepEqual([ly.tab,ly.task,ly.btn,ly.base,ln.tab,ln.task,ln.base],['2','재접촉 할 일 하나 등록','재접촉 등록','재접촉 할 일 없음','1','사유 + 재영업 여부 입력됨','기록 완료 · 경쟁사 해당 없음'],'재영업 "예"만 재접촉 할 일 · "아니오"는 결과 기록만');
  assert.deepEqual(await V.locator('.ps3-tab .l').allInnerTexts(),['전체','기록 보완 필요','기록 완료','재영업 가능 · 예']);
  /* 공통: 수주 ↔ 실주 서로 거치지 않음 · 필수값 없으면 단계 이동 차단 · 실주 처리 때 서버가 열린 업무를 닫는다(전환 함수 계약) */
  assert.deepEqual(await page.evaluate(()=>[StageTransition.choices('won'),StageTransition.choices('lost'),StageTransition.validate('compete','lost',{transition_date:DAY(0),fields:{}},DAY(0)).length>0,StageTransition.validate('consulting','sent',{transition_date:DAY(0),fields:{materials:['견적서'],quote_version:'v1',recipient:'관리소장',sent_date:DAY(0),followup_date:DAY(3)}},DAY(0))]),[[],[],true,[]]);
  assert.match(fs.readFileSync(path.join(root,'sql','pipeline-transition','20260906','helper.sql'),'utf8'),/UPDATE public\.next_actions SET status='cancelled'[^\n]*WHERE deal_id=p_object_id AND status='open'/,'단계가 바뀌면 열린 다음 할 일은 서버가 취소');
  assert.match(fs.readFileSync(path.join(root,'sql','deal-reopen-v1-20261006.sql'),'utf8'),/실주 때 적은 내용\(stage_contexts\.lost\)은 지우지도 고치지도 않는다/,'다시 열어도 실주 결과 보존');
  /* 필수 정보 칩: 회의 확정 = 진하게 · 적용안 = 회색(상세 '이 단계 필수 정보') */
  await page.evaluate(()=>PipelineWorkspace.open('lost'));await page.waitForTimeout(200);await L.locator('.prv-row[data-key$="l-yes"]').click();await page.waitForSelector('#detailView.on.dv3 .dv3-stage .dv3-row');await page.waitForTimeout(300);
  const chips=await page.evaluate(()=>[...document.querySelectorAll('#detailView .dv3-stage .dv3-row>span')].map(s=>[s.textContent.trim(),s.className,getComputedStyle(s).fontWeight,getComputedStyle(s).color]));
  const conf=chips.find(c=>c[0]==='실주 원인'/* 운영 기준(ops-rules sync)이 라벨을 '실주 원인'으로 바꾼다 */),prop=chips.find(c=>c[0]==='경쟁사'),re=chips.find(c=>c[0]==='재영업 가능 여부');
  assert.ok(conf&&conf[1]==='conf'&&conf[2]==='700','회의 확정 = 진하게: '+JSON.stringify(conf));assert.ok(prop&&prop[1]==='prop'&&prop[3]==='rgb(156, 163, 175)','적용안 = 회색: '+JSON.stringify(prop));assert.ok(re&&re[1]==='conf','재영업 가능 여부(회의 확정)');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  /* 2026-10-07 대표 "내용 넘어가는 것 하지 말아": 이 화면들의 줄 안 글은 말줄임(…)으로 잘리지 않는다(1600 폭) */
  for(const k of ['consulting','sent','competition','construction','won','lost']){await page.evaluate(k=>PipelineWorkspace.open(k),k);await page.waitForSelector('#pipeline-stage-v3[data-stage="'+k+'"] .prv-row');await page.waitForTimeout(200);
   const clipped=await page.evaluate(()=>[...document.querySelectorAll('#pipeline-stage-v3 .prv-row *')].filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').map(e=>(e.className||e.tagName)+': '+e.textContent.trim().slice(0,40)));assert.deepEqual(clipped,[],k+': 줄 안 글이 잘림');}  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('stage7 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
