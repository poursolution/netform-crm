'use strict';
/* 영업건 상세 · 같은 정보 같은 판단 (2026-10-08 design_handoff_deal_same_info · 시안 '영업건 상세 · 같은 정보 같은 판단 시안') — 합성 자료(평택비전지웰 모양 · 이름 · 금액은 지어낸 것)
   확인: 목록 · 상세 · 진척이 같은 계약 정보(입력됐지만 증빙 전 = 확인 필요 · 없음 아님) / 머리 둘째 줄(영업 경로 · 낙찰 확정 · 기술자문 확정 · 예상 참고 · 기존 고객)
         / 오른쪽 맨 위 = 등록된 다음 업무(업무 · 기한 · 확인됨 · 확인할 것 · 완료 조건) + [연락하기][결과 기록][다음 업무] / 빠진 정보 n(입력된 것은 회색 한 줄) · 특이조건 없음 / 있음 / 확인 필요
         / 일정 · 막힌 곳 · 진척 · 특이조건 · 하자 · 출처 한 줄씩(접는 곳 없음 · 일정 · 막힌 곳 빨강) / 이력 탭 고객 접촉 · 내부 변경(접촉 수 = 고객 접촉만)
         / 진척 = 단계 이동 · 낙찰 · 계약 체결 · '진척 없음 n일' 대신 마지막 진척 날짜 · 내용 / 같은 사건 날짜 표기 / 글 잘림 없음 / 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1700},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealSame&&window.DecisionCollab&&window.SiteHistory&&window.DealTransfer&&window.DealKeyman&&window.DealPanelsV2&&window.OpsStore&&window.DealWin&&window.PipelineStageB&&window.ListPager);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const S='aaaaaaaa-0000-4000-8000-000000000001',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222',D3='33333333-3333-4333-8333-333333333333';
   const act=(id,type,note,at)=>({id,type,note,at,actor:'황윤선',meaningful:true});
   B={deals:[
    {id:D1,site:'[경기 평택] 평택비전지웰푸르지오',site_id:S,assignee:'황윤선',brand:'석민이앤씨',created:'2025-11-20',code:'contract',stage_code:'contract',grp:'계약·시공',amt:1120000000,manager_name:'김정훈',manager_mobile:'0316562210',
     contacts:[{person_key:'mobile:0316562210',name:'김정훈',role:'관리소장',mobile:'0316562210',status:'current'}],
     stage_contexts:{contract:{fields:{contract_date:'2026-01-26',contract_amount:1043900000,decision_maker:'최OO · 입대의 회장'}}},
     next_action:{id:'n1',text:'계약 체결 확인',type:'전화',due:day(-3),status:'open'},
     stageHistory:[{id:'h1',from:'bidding',to:'contract',at:'2026-10-03T14:20:00+09:00',actor:'황윤선'}],
     activities:[act('a1','전화','통화 연결 · 관리소장 · 낙찰 결과 안내 (코지건설) 고객 말: 결과 나왔으니 계약 진행하자 담당 판단: 코지 낙찰 확정 · 계약 단계로','2026-09-12T10:05:00+09:00'),act('a2','방문','현장 방문 · 착공 일정 협의','2026-02-03T15:40:00+09:00'),act('a3','전화','통화 연결 · 계약 조건 확인','2026-01-15T09:30:00+09:00'),{id:'a4',type:'메모',note:'[내부] 계약 체결 기록 · 10.439억',at:'2026-01-26T11:00:00+09:00',actor:'황윤선'}]},
    {id:D2,site:'[경기 평택] 평택비전지웰푸르지오',site_id:S,assignee:'황윤선',brand:'석민이앤씨',created:'2023-01-10',code:'won',stage_code:'won',outcome:'won',won_amount:120000000,closed_at:'2023-06-01',contract_date:'2023-06-01',grp:'영업·관리',amt:120000000,activities:[]},
    /* 진척 판단: 연락은 많고 마지막 진척(견적 요청 · 단계 이동)이 오래된 건 */
    {id:D3,site:'[서울] 진척이 멈춘 단지',assignee:'황윤선',brand:'POUR솔루션',created:'2026-06-01',code:'sent',stage_code:'sent',grp:'컨설팅·견적',amt:5e7,stageHistory:[{id:'h9',from:'consulting',to:'sent',at:'2026-08-28T10:00:00+09:00',actor:'황윤선'}],
     activities:[1,2,3,4,5].map(i=>act('s'+i,'전화','통화 연결 '+i,'2026-09-0'+i+'T10:00:00+09:00'))}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   /* 이 검사는 '같은 정보 같은 판단' 층을 본다 — 그 위에 얹은 7단계 공통 틀(deal-frame7.js)은 verify-deal-frame7-browser.cjs 가 따로 본다 */G.dealFrame7Off=true;
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};window.__rpc=[];
   SB={rpc:async(n,a)=>{__rpc.push([n,a]);if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[{deal_id:D1,win_status:'confirmed',won_type:'partner_tech',award_company:'코지건설',award_amount:1043900000,award_date:'2026-01-20',sales_channel_brand:'석민이앤씨',performance_owner:'황윤선',tech_advisory:true,tech_advisory_company:'넷폼',tech_advisory_amount:433650000}],advisory:[]}};
    if(n==='crm_deal_stage_fields_update_v1'){const p=a.p||{};return {data:{ok:true,deal_id:p.deal_id||p.opportunity_id,stage:p.stage||'contract',fields:p.fields||{},version:2,stage_contexts:{contract:{fields:Object.assign({contract_date:'2026-01-26',contract_amount:1043900000},p.fields||{})}}}};}
    return {data:{ok:true,tasks:[],entries:[],sites:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.D1=D1;window.D3=D3;window.__open=async(i)=>{await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));};
  });
  /* ① 목록 · 상세 · 진척이 같은 계약 정보: 입력됐지만 증빙 전 = '확인 필요'(없음 아님) */
  const same=await page.evaluate(()=>{const d=B.deals[0],c=DealSame.contract(d),row=PipelineWorkspace.rows({unscoped:true}).find(r=>r.item.id===d.id),v=StageSpecs.values(row,null,{work:'',stage:'계약'}),M=PipelineStageB.model('construction',[row]),m=M.items[0];
   return {state:c.state,text:c.text,sub:c.sub,vDate:v.contractDate,vAmt:v.contractAmount,vProof:v.contractProof,vState:v.contractState,rs:m&&m.rs,sub2:m&&m.sub};});
  assert.deepEqual([same.state,same.text,same.sub],['check','계약 체결 · 2026.1.26 · 10.44억','계약 정보 입력됨 · 증빙 확인 필요']);
  assert.deepEqual([same.vDate,same.vAmt,same.vProof,same.vState],['2026-01-26',1043900000,'check','계약 정보 입력됨 · 증빙 확인 필요'],'목록이 읽는 값 = 상세와 같은 값');
  assert.ok(same.rs&&same.rs.includes('cproof')&&!same.rs.includes('cinfo'),'목록 사유: 증빙 확인 필요(계약일 · 금액 없음 아님): '+JSON.stringify(same.rs));
  assert.equal(same.sub2,'계약 체결 · 2026.1.26 · 10.44억');
  /* 증빙이 생기면(계약서 수령) 정상 */
  assert.equal(await page.evaluate(()=>{const d=JSON.parse(JSON.stringify(B.deals[0]));d.stage_contexts.contract.fields.contract_document='수령';return DealSame.contract(d).state;}),'ok');
  assert.equal(await page.evaluate(()=>{const d=JSON.parse(JSON.stringify(B.deals[0]));d.stage_contexts.contract.fields={};d.contract_date='';d.contract_amount=0;return DealSame.contract(d).state;}),'none');
  /* 목록 줄(계약 · 시공)도 같은 값: '계약 체결 · 날짜 · 금액 · 증빙 확인 필요' + [계약서 확인] — '계약일 · 금액 없음'이 아니다 */
  await page.evaluate(()=>{G.pipelineStage='construction';goPage('pipe');});await page.waitForTimeout(900);
  {const r=await page.evaluate(()=>{const n=document.querySelector('#pipeline-stage-root .prv-row');return n?{now:n.querySelector('.prv-b>span').textContent,task:n.querySelector('.prv-c>b').textContent,btn:n.querySelector(':scope>button').textContent}:null;});
   assert.deepEqual(r,{now:'계약 체결 · 2026.1.26 · 10.44억 · 계약 정보 입력됨 · 증빙 확인 필요',task:'계약 체결 확인',btn:'계약서 확인'});}
  /* ② 상세 */
  await page.evaluate(()=>window.__open(0));await page.waitForSelector('#detailView.ddv.dv3.dvt .dvs-task');await page.waitForTimeout(700);
  const V=page.locator('#detailView');
  /* 머리 */
  assert.equal(one(await V.locator('.dv3-stagebadge').innerText()),'계약 · 시공'.replace(' · ','·'),'단계 알약에 n일째를 붙이지 않는다');
  assert.equal(one(await V.locator('.dv3-subrow .tx').innerText()),'담당 황윤선');
  assert.equal(one(await V.locator('.dvs-line2').innerText()),'석민이앤씨 계약금액 10억 4,390만원 낙찰금액 10.439억 · 코지건설 기술자문금액 4.3365억 · 넷폼 예상금액 11.2억 · 참고 ✓ 기존 고객 · 2023 수주 1');
  assert.equal(await V.locator('.ddv-chips .idv-brand').evaluate(n=>getComputedStyle(n).display),'none','맨 위 브랜드 글자는 둘째 줄과 겹쳐 숨김');
  /* 왼쪽 결정권자 줄: 이름 · 역할 / 결정권자 · 연락처 [입력](점선) */
  assert.equal(one(await V.locator('.dv3-left .dvs-dm').innerText()),'최OO · 입대의 회장 결정권자 · 연락처 입력');
  assert.equal(await V.locator('.dv3-left .dvs-dm .dvs-in').evaluate(b=>getComputedStyle(b).borderTopStyle),'dashed');
  /* 오른쪽 맨 위 */
  assert.equal(await V.locator('.dw-right').evaluate(r=>r.firstElementChild.className.includes('dvs-task')),true);
  assert.equal(one(await V.locator('.dvs-task .lb').innerText()),'등록된 다음 업무');
  /* 3차 정돈: 영역 라벨 · 기한 종류 */
  assert.deepEqual([one(await V.locator('.dv3-left>.dvs-area').innerText()),one(await V.locator('.dvs-task>.dvs-area').innerText()),one(await V.locator('.dw-center .dvs-area').innerText())],['단지 공통','현재 영업건','현재 영업건']);
  assert.equal(one(await V.locator('.dvs-tt>b').innerText()),'계약 체결 확인');
  assert.match(one(await V.locator('.dvs-tt>span').innerText()),/^내부 처리 기한 \d+\.\d+ · 3일 지남$/,'기한 종류를 붙인다(기한 초과만 쓰지 않음)');assert.equal(await V.locator('.dvs-tt>span>b').evaluate(n=>n.className),'red');
  assert.deepEqual(await V.locator('.dvs-kv>span').allInnerTexts(),['확인됨','체결 완료 · 2026.1.26 · 1,043,900,000원','확인할 것','계약서 미첨부 · 실제 체결 · 자료 확인','완료 조건','계약서 첨부 + 특이조건 선택']);
  assert.deepEqual(await V.locator('.dvs-btns button').allInnerTexts(),['계약서 확인하기','연락하기','결과 기록','다음 업무'],'강조 버튼은 현재 업무 실행 하나 · 나머지는 보조');
  assert.deepEqual(await V.locator('.dvs-btns button').evaluateAll(l=>l.map(b=>b.classList.contains('fill'))),[true,false,false,false]);
  assert.equal(one(await V.locator('.dvs-scope').innerText()),'다음 업무 = 업무 · 기한만 저장 · 결과 기록 = 응대 이력 1건 · 칸 수정 = 그 칸만');
  assert.match(one(await V.locator('.dvs-aux').innerText()),/^지침 구두 약속은 계약서 특약에 남겨야 분쟁이 없습니다/,'지침 · 추천은 아래 보조 줄');
  /* 예전 '지금 할 일' 카드는 숨김 · 접는 곳 없음 */
  assert.equal(await V.locator('#nowCard').evaluate(n=>getComputedStyle(n).display),'none');
  assert.equal(await V.locator('.dw-right [aria-expanded], .dw-right details, .dw-right summary, .dw-right .dvt-reqtoggle').count(),0,'오른쪽에 접는 곳이 없다');
  /* 빠진 정보 n · 입력된 것은 회색 한 줄 · 특이조건 기본 확인 필요 */
  assert.match(one(await V.locator('.da-stage-summary h3').innerText()),/^빠진 정보 5$/);
  assert.deepEqual(await V.locator('.da-stage-summary .dv3-row>span').allInnerTexts(),['공종','낙찰결과','계약 상태','계약서 파일']);
  assert.deepEqual(await V.locator('.da-stage-summary .dv3-row .dvs-in').allInnerTexts(),['입력','입력','입력','첨부'],'미입력 = 점선 [입력] · [첨부]');
  assert.match(one(await V.locator('.dvs-ok').innerText()),/^입력됨 예상 금액 수정 · 계약금액 수정 · 계약예정·체결일 2026\.1\.26 수정 · 낙찰사 · 기술자문 · 담당$/,'입력됨 = 값 + [수정] 링크');
  assert.deepEqual(await V.locator('.dvs-sp button').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-pressed')])),[['없음','false'],['있음','false'],['확인 필요','true']]);
  /* 특이조건을 고르면 저장 경로로 가고, 빠진 정보가 하나 줄어든다 */
  await V.locator('.dvs-sp button',{hasText:'없음'}).click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_stage_fields_update_v1').map(x=>x[1].p.fields)),[{special_terms:'없음'}]);
  /* 6줄 */
  const rows=await V.locator('.dvs-rows .dvs-row').evaluateAll(l=>l.map(r=>[r.children[0].textContent,r.classList.contains('hot'),r.children[1].innerText.replace(/\s+/g,' ').trim()]));
  assert.deepEqual(rows.map(r=>[r[0],r[1]]),[['일정',true],['막힌 곳',true],['진척',false],['특이조건',false],['하자 · 출처',false]],'일정 · 막힌 곳만 빨강');
  assert.match(rows[0][2],/^착공 예정일 없음 착공 준비로 넘어가려면 착공 · 준공 예정일 필요 · 고객 약속 없음 · 입찰 마감 해당 없음 · 내부 처리 \d+\.\d+ 지남 · 기록 보완 착공 예정일/,'일정 = 기한을 종류별로');
  assert.match(rows[1][2],/^1 · 계약서 계약서 미첨부 · 기한 \d+\.\d+ 3일 지남/);
  assert.match(rows[2][2],/^마지막 10\.3 10\.3 계약 · 시공 이동 · 1\.26 계약 체결 · 1\.20 낙찰 · 코지건설 · 고객 접촉 3회/,'진척 = 단계 이동 · 낙찰 · 계약 체결');
  assert.match(rows[3][2],/^확인 필요 계약 때 말로 약속한 조건이 있으면/);
  assert.match(rows[4][2],/^없음 하자 접수 0 · 정보 출처 \d+ · 되돌릴 변경 1건/);
  /* 이력 탭: 기본 고객 접촉 · 접촉 수 = 고객 접촉만 */
  assert.deepEqual(await V.locator('.dvs-htabs button').allInnerTexts(),['전체 5','고객 접촉 3','내부 변경 2']);
  assert.equal(await V.locator('.dvs-htabs [aria-pressed="true"]').innerText(),'고객 접촉 3');
  assert.equal(one(await V.locator('.dvs-hnote').innerText()),'고객 접촉 = 연락 시도 3 · 실제 연결 1 · 내부 변경은 따로');
  /* 이력 한 줄: 작성자 · 날짜 · 종류 같은 위치 · 고객 말 / 담당 판단 구분 */
  assert.deepEqual(await V.locator('.idv-thread>.idv-msg:not(.dvs-hide)').first().evaluate(m=>[...m.querySelectorAll('.idv-meta>*')].sort((a,b)=>Number(getComputedStyle(a).order)-Number(getComputedStyle(b).order)).map(n=>n.textContent)),['황윤선','2026.1.15 09:30','고객 접촉','전화']);
  assert.deepEqual(await V.locator('.idv-msg:has(.dvs-q) .dvs-q').evaluateAll(l=>l.map(q=>[q.className,q.textContent,getComputedStyle(q).borderLeftColor])),[['dvs-q said','고객 말결과 나왔으니 계약 진행하자','rgb(21, 23, 28)'],['dvs-q judge','담당 판단코지 낙찰 확정 · 계약 단계로','rgb(201, 205, 213)']]);
  assert.equal(await V.locator('.idv-thread>.idv-msg:not(.dvs-hide)').count(),3);
  assert.match(one(await page.locator('#ddvComposer').innerText()),/저장 = 이 응대 기록 1건 · 다른 칸은 안 바뀜/,'입력칸 저장 범위 한 줄');
  await V.locator('.dvs-htabs button',{hasText:'내부 변경'}).click();await page.waitForTimeout(150);
  assert.deepEqual(await V.locator('.idv-thread>.idv-msg:not(.dvs-hide)').evaluateAll(l=>l.map(m=>m.dataset.dv3k)).then(a=>a.every(k=>k!=='touch')&&a.length),2);
  await V.locator('.dvs-htabs button',{hasText:'전체'}).click();await page.waitForTimeout(150);assert.equal(await V.locator('.idv-thread>.idv-msg:not(.dvs-hide)').count(),5);
  await V.locator('.dvs-htabs button',{hasText:'고객 접촉'}).click();await page.waitForTimeout(150);
  /* 날짜 표기: 같은 사건 'YYYY.M.D HH:MM'(한국 시간) */
  assert.match(one(await V.locator('.idv-thread>.idv-msg:not(.dvs-hide) .idv-meta').first().innerText()),/2026\.1\.15 09:30/);
  assert.equal(await page.evaluate(()=>DealSame.stamp('2026-10-03T05:20:00Z')),'2026.10.3 14:20');
  /* 연락하기 · 결과 기록 · 다음 업무는 기존 동작 */
  await V.locator('.dvs-btns button',{hasText:'결과 기록'}).click();await page.waitForTimeout(250);
  assert.equal(await V.locator('#ddvComposer').evaluate(n=>n.classList.contains('dvt-calling')),true,'결과 기록 = 가운데 입력칸 · 연결 상태');
  await V.locator('.dvs-btns button',{hasText:'다음 업무'}).click();await page.waitForTimeout(150);
  assert.deepEqual(await V.locator('.dvs-task .dv3-nextonly button').allInnerTexts(),['내일','3일 후','7일 후','직접 정하기','취소']);
  await V.locator('.dvs-task .dv3-nextonly [data-dv3="nextcancel"]').click();
  /* 글 잘림 없음 */
  const clip=sel=>page.evaluate(s=>[...document.querySelectorAll(s)].filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').map(e=>e.className+':'+e.textContent.slice(0,24)),sel);
  assert.deepEqual(await clip('#detailView .dvs-line2 *, #detailView .dvs-task *, #detailView .dvs-rows *, #detailView .dvs-ok *, #detailView .dvs-htabs *'),[]);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dw-right')].every(r=>r.scrollWidth<=r.clientWidth+1)),true,'오른쪽 칸이 옆으로 넘치지 않는다');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'deal-same.png')});
  /* ③ 진척 판단: 단계 이동 · 낙찰 · 계약 체결도 진척 · '진척 없음 n일' 금지 */
  const tg=await page.evaluate(()=>({stale:DecisionCollab.tags(B.deals[2]).stale,last:DealSame.lastProgress(B.deals[2]).text,none:DealSame.lastProgress({id:'x',stageHistory:[]}).text}));
  assert.deepEqual([tg.stale,tg.last,tg.none],['연락 5회 · 마지막 진척 8.28 · 자료 발송완료 이동','마지막 진척 8.28 · 자료 발송완료 이동','진척 기록 없음']);
  assert.doesNotMatch(tg.stale,/진척 없음 \d+일/);
  /* ④ 끄기: 정돈안 그대로(같은 정보 층만 사라짐) */
  await page.evaluate(()=>{closeDetail();G.dealSameOff=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.dv3.dvt');await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#detailView .dvs-task,#detailView .dvs-line2,#detailView .dvs-htabs,#detailView .dvs-rows').length,getComputedStyle(document.getElementById('nowCard')).display!=='none']),[0,true]);
  /* ⑤ 상세를 닫으면 목록의 단계 · 쪽 · 스크롤 위치 그대로 복귀 */
  await page.evaluate(()=>{closeDetail();const base=B.deals[0];for(let k=0;k<30;k++){const d=JSON.parse(JSON.stringify(base));d.id='aaaaaaaa-0000-4000-8000-'+String(100000+k).padStart(12,'0');d.site='[경기] 목록 현장 '+k;d.site_id=null;B.deals.push(d);}goPage('pipe');});await page.waitForTimeout(800);
  await page.setViewportSize({width:1600,height:800});
  await page.evaluate(()=>{document.querySelector('#pipeline-stage-menu [data-ps-action="stage"][data-value="construction"]').click();});await page.waitForTimeout(1000);
  await page.locator('#pipeline-stage-root .lpg button',{hasText:'2'}).first().click();await page.waitForTimeout(300);
  await page.evaluate(()=>window.scrollTo(0,300));await page.waitForTimeout(200);
  const snap=()=>page.evaluate(()=>({stage:document.querySelector('#pipeline-stage-menu [aria-current], #pipeline-stage-menu .on')&&1,rows:document.querySelectorAll('#pipeline-stage-root .prv-row').length,first:document.querySelector('#pipeline-stage-root .prv-row b').textContent,scroll:Math.round(window.scrollY)}));
  const before=await snap();assert.equal(before.rows,11);assert.equal(before.scroll,300);
  await page.locator('#pipeline-stage-root .prv-row').nth(2).click();await page.waitForSelector('#detailView.on');await page.waitForTimeout(500);
  await page.locator('#detailView .backbtn').first().click();await page.waitForTimeout(500);
  assert.deepEqual(await snap(),before,'상세를 닫으면 목록의 단계 · 쪽 · 스크롤 위치 그대로');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('deal same info ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
