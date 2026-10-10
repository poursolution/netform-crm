'use strict';
/* 영업 판단 · 준비 지원 검사 (2026-10-10 design_handoff_rules 6차) — 합성 자료(현장 · 이름은 지어낸 것)
   영업건 상세 오른쪽: 진행 조건 5가지(고객 확인 / 담당 추정 / 미확인 · 값이 있어도 출처 전에는 미확인) · 관계자(역할 · 결정 영향) · 입찰 준비 체크(준비 ≠ 제출)
   · 내부 지원 요청(요청 엔진 + '[지원 요청]' 메모) · 방문 전 요약(같은 날 확정 일정 충돌) · 예상 수주일 변경(사유 필수 · 2회 연기 = 가능성 낮음) · 단계 변경 이력(이관일 구분)
   · 지금 할 일 5줄. 저장 = 내부 메모 한 줄(기존 길) · 넘치는 글 없음 · 끄기 G.dealPrepOff */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1500},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealPrep&&window.DealUnits&&window.DealDetailV3&&window.CRMRules&&window.WorkRequest&&window.OpsStore);
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222';
   B={deals:[
    {id:D1,site:'[경기 고양] 햇빛마을23단지',assignee:'이필선',brand:'석민이앤씨',created:'2025-11-03',code:'bidding',stage_code:'bidding',grp:'영업·관리',amt:4.2e8,nextActionObj:{id:'n1',type:'방문',text:'입대의 PT · 현장 방문',due:'2026-10-23',status:'open'},lastMeaningfulContactAt:T('2026-10-20'),
     stage_contexts:{first_contact:{fields:{needs:'균열 보수 포함 · 하자 5년',work_scope:'외벽 전체 + 균열 보수'}},sent:{fields:{sent_date:'2026-10-06',materials:['제안서','견적서']}},bidding:{fields:{bid_deadline:'2026-10-30',bid_terms:'일반',competitor:'타사 A'}}},
     contacts:[{person_key:'p1',name:'김정훈',role:'관리소장 · 연락 창구',decision_role:'결정 아님',status:'current'},{person_key:'p2',name:'최회장',role:'입대의 회장',decision_role:'최종 결정',status:'current'},{person_key:'p3',name:'박총무',role:'입대의 총무',influence_level:'영향 중',status:'current'}],
     stageHistory:[{from:'',to:'consulting',at:T('2025-11-03'),actor:'시스템',reason:'구글시트 이관'},{from:'consulting',to:'sent',at:T('2026-10-06'),actor:'이필선',reason:'견적 V1 이메일'},{from:'sent',to:'bidding',at:T('2026-10-15'),actor:'이필선',reason:'현설 참석 · 입찰 공고 확인'}],
     activities:[{id:'a1',type:'전화',note:'통화 완료 · 공법 비교표 가져가기로 함',at:T('2026-10-20'),actor:'이필선'}]},
    {id:D2,site:'[경기 화성] 동탄푸른마을',assignee:'이필선',brand:'POUR솔루션',created:'2026-10-02',code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,nextActionObj:{id:'n2',type:'방문',text:'고객 약속: 현장 방문',due:'2026-10-23',status:'open'},lastMeaningfulContactAt:T('2026-10-19'),activities:[{id:'b1',type:'전화',note:'통화 완료',at:T('2026-10-19'),actor:'이필선'}]}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';G.dealPrep=null;G.dealPrepOff=false;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__memo=[];window.__sf=[];window.__req=[];
   DealDetailV3.memo=async(d,note)=>{__memo.push([d.id,note]);d.activities=Array.isArray(d.activities)?d.activities:[];d.activities.push({id:'m'+__memo.length,type:'메모',note,at:new Date(Date.now()+__memo.length*1000).toISOString(),actor:'이필선'});};
   DealDetailV3.stageFields=async(d,f,why)=>{__sf.push([d.id,f,why]);};
   SB={rpc:async(n,a)=>{const p=a&&a.p||{};if(n==='crm_work_request_list_v1')return {data:{ok:true,requests:__req}};
     if(n==='crm_work_request_create_v1'){const r=Object.assign({id:'rq'+(__req.length+1),status:'sent',round:1,requested_by:'이필선',by_me:true,to_me:false,created_at:new Date().toISOString()},p);__req.push(r);return {data:{ok:true,request:r}};}
     if(n==='crm_deal_unit_list_v1')return {data:{ok:true,contract:1,units:[],events:[]}};if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};
     return {data:{ok:true,tasks:[],entries:[],sites:[],rows:[],events:[],comments:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(1100);
  const v=page.locator('#detailView.dv3'),P=v.locator('.dp6'),one=s=>String(s).replace(/\s+/g,' ').trim(),tx=async l=>one(await l.innerText());
  assert.equal(await P.count(),1,'영업 판단 · 준비 지원 상자');assert.equal(await tx(P.locator(':scope>h3')),'영업 판단 · 준비 지원');
  const sec=t=>P.locator(':scope>section',{has:page.locator('header b',{hasText:t})});
  /* 1. 진행 조건: 기록에 값이 있어도 출처를 표시하기 전에는 '미확인' */
  assert.equal(await tx(sec('영업 진행 조건').locator('header span')),'확인 0 / 5');
  const cr=()=>sec('영업 진행 조건').locator('.dp6-row').evaluateAll(l=>l.map(r=>[r.querySelector('span').textContent,r.querySelector('em').textContent,r.querySelector('b').textContent,r.querySelector('small').textContent]));
  assert.deepEqual(await cr(),[['예산','미확인','미입력','근거 없음'],['추진 시기','미확인','미입력','근거 없음'],['공사 범위','미확인','외벽 전체 + 균열 보수','기록에 있는 값 · 출처 표시 전'],['결정 절차','미확인','미입력','근거 없음'],['경쟁 여부','미확인','타사 A','기록에 있는 값 · 출처 표시 전']]);
  await sec('영업 진행 조건').locator('.dp6-row').first().click();await page.waitForTimeout(250);
  await P.locator('[data-dp="cst"][data-v="고객 확인"]').click();await page.waitForTimeout(150);await P.locator('[data-dp="csave"]').click();await page.waitForTimeout(250);
  assert.match(await tx(P.locator('.dp6-err')),/확인 · 추정한 내용을 적어 주세요/);assert.equal(await page.evaluate(()=>__memo.length),0);
  await P.locator('[data-dp="cst"][data-v="고객 확인"]').click();await page.waitForTimeout(150);await P.locator('input[data-dpf="cv"]').fill('장기수선 4.5억 반영 (관리소장)');await P.locator('[data-dp="csave"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__memo.map(m=>m[1])),['[진행 조건] 예산 | 고객 확인 | 장기수선 4.5억 반영 (관리소장)']);
  assert.equal(await tx(sec('영업 진행 조건').locator('header span')),'확인 1 / 5');assert.deepEqual((await cr())[0].slice(0,3),['예산','고객 확인','장기수선 4.5억 반영 (관리소장)']);
  /* 추정은 확인으로 세지 않는다 */
  await sec('영업 진행 조건').locator('.dp6-row').nth(2).click();await page.waitForTimeout(250);await P.locator('[data-dp="cst"][data-v="담당 추정"]').click();await page.waitForTimeout(120);await P.locator('input[data-dpf="cv"]').fill('입대의 투표 → 공개 입찰로 보임');await P.locator('[data-dp="csave"]').click();await page.waitForTimeout(500);
  assert.equal(await tx(sec('영업 진행 조건').locator('header span')),'확인 1 / 5','담당 추정은 확인 수에 넣지 않는다');
  /* 2. 관계자: 연락처의 역할 · 결정 영향 */
  assert.deepEqual(await sec('의사결정자').locator('.dp6-pp').evaluateAll(l=>l.map(r=>[...r.children].map(c=>c.textContent))),[['김정훈','관리소장 · 연락 창구','결정 아님'],['최회장','입대의 회장','최종 결정'],['박총무','입대의 총무','영향']]);
  /* 3. 입찰 준비: 준비 ≠ 제출 */
  assert.equal(await tx(sec('입찰 준비 체크').locator('header span')),'준비 0 / 5 · 제출 전 · 마감 10.30');assert.equal(await sec('입찰 준비 체크').locator('.dp6-ck').count(),5);
  await sec('입찰 준비 체크').locator('.dp6-ck').first().click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>__memo[__memo.length-1][1]),'[입찰 준비] 공고 확인 · 입찰 방식 | 완료');assert.equal(await tx(sec('입찰 준비 체크').locator('header span')),'준비 1 / 5 · 제출 전 · 마감 10.30');
  assert.match(await tx(sec('입찰 준비 체크').locator('.dp6-note')),/'준비 완료' ≠ '제출 완료'/);
  /* 4. 내부 지원 요청: 원인 → 받는 사람 · 요청 · 필요일 → 요청 엔진 + 메모 */
  await sec('내부 지원 요청').locator('[data-dp="sopen"]').click();await page.waitForTimeout(200);await P.locator('[data-dp="scause"][data-v="기술 검토"]').click();await page.waitForTimeout(150);
  assert.equal(await P.locator('input[data-dpf="sask"]').inputValue(),'공법 비교자료 검토','원인을 고르면 요청 문구 제안');
  await P.locator('[data-dp="ssave"]').click();await page.waitForTimeout(200);assert.match(await tx(P.locator('.dp6-err')),/받는 사람을 적어 주세요/);
  await P.locator('input[data-dpf="sto"]').fill('박현우');await P.locator('input[data-dpf="sdue"]').fill('2026-10-23');await P.locator('[data-dp="ssave"]').click();await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>__req.map(r=>[r.target_type,r.kind,r.label,r.to_name,r.asks,r.due_label])),[['deal','support','내부 지원 · 기술 검토','박현우',['공법 비교자료 검토'],'10.23']]);
  assert.equal(await page.evaluate(()=>__memo[__memo.length-1][1]),'[지원 요청] 기술 검토 · 공법 비교자료 검토 → 박현우 · 필요일 10.23 — 이필선');
  assert.deepEqual(await sec('내부 지원 요청').locator('.dp6-sp').evaluateAll(l=>l.map(r=>[...r.children].map(c=>c.textContent))),[['기술 검토','박현우 · 공법 비교자료 검토','필요일 10.23 · 보냄 · 확인 전']]);
  /* 6. 방문 전 요약 + 같은 날 확정 일정 */
  assert.deepEqual(await sec('방문 전 요약').locator('.dp6-kv>*').allInnerTexts(),['고객 요구','균열 보수 포함 · 하자 5년','지난 약속',await sec('방문 전 요약').locator('.dp6-kv>b').nth(1).innerText(),'미해결','추진 시기 · 공사 범위 · 결정 절차 외 1','최신 자료','제안서 · 견적서 · 10.6']);
  assert.match(await tx(sec('방문 전 요약').locator('.dp6-clash')),/^일정 충돌 · 같은 날 \[경기 화성\] 동탄푸른마을 방문\(확정\) — 시각은 저장되지 않아 날짜까지만 확인$/);
  /* 7. 예상 수주일: 등록 → 변경은 사유 필수 → 2회 연기 = 가능성 낮음 */
  const ex=sec('예상 수주일 변경');assert.equal(await tx(ex.locator('header span')),'미등록');
  const setExp=async(to,why)=>{await sec('예상 수주일 변경').locator('[data-dp="eopen"]').click();await page.waitForTimeout(200);await P.locator('input[data-dpf="eto"]').fill(to);if(why!=null)await P.locator('input[data-dpf="ewhy"]').fill(why);await P.locator('[data-dp="esave"]').click();await page.waitForTimeout(500);};
  await setExp('2026-11-20',null);assert.equal(await page.evaluate(()=>__memo[__memo.length-1][1]),'[예상 수주일]  | 2026-11-20 | 최초 등록','처음 등록 = 이전 날짜 칸이 비어 있다');
  await sec('예상 수주일 변경').locator('[data-dp="eopen"]').click();await page.waitForTimeout(200);await P.locator('input[data-dpf="eto"]').fill('2026-12-10');await P.locator('[data-dp="esave"]').click();await page.waitForTimeout(250);assert.match(await tx(P.locator('.dp6-err')),/바꾸는 사유를 적어 주세요/);
  await P.locator('input[data-dpf="ewhy"]').fill('예산 재검토');await P.locator('[data-dp="esave"]').click();await page.waitForTimeout(500);
  await setExp('2027-01-15','입대의 투표 연기');
  assert.equal(await tx(sec('예상 수주일 변경').locator('header span')),'지금 2027.1.15 · 2회 연기 · 가능성 낮음');
  assert.deepEqual(await sec('예상 수주일 변경').locator('.dp6-h').evaluateAll(l=>l.map(r=>[r.querySelector('b').textContent,r.querySelector('small').textContent])),[['2026.12.10 → 2027.1.15','사유 · 입대의 투표 연기'],['2026.11.20 → 2026.12.10','사유 · 예산 재검토'],['2026.11.20','사유 · 최초 등록']]);
  assert.equal(await page.evaluate(()=>__sf.length),0,'최종협의 단계가 아니면 단계 정보는 건드리지 않는다');
  /* 5. 단계 변경 이력: 이관 전 날짜는 실제 진입일 미확인 */
  assert.deepEqual(await sec('단계 변경 이력').locator('.dp6-h').evaluateAll(l=>l.map(r=>[...r.children].map(c=>c.textContent))),[['입찰단계','2026.10.15 · 이필선','근거 · 현설 참석 · 입찰 공고 확인'],['자료 발송완료','2026.10.6 · 이필선','근거 · 견적 V1 이메일'],['컨설팅 설계','2025.11.3 (이관일) · 시스템','이관 자료 · 실제 진입일 미확인 · 구글시트 이관']]);
  /* 0. 지금 할 일 5줄 */
  const plan=await v.locator('.dp6-plan>div').evaluateAll(l=>l.map(r=>[r.querySelector('span').textContent,r.querySelector('b').textContent]));
  assert.deepEqual(plan.map(r=>r[0]),['미확인','필요 지원','담당자 행동','내부 지원','준비 완료 조건']);
  assert.equal(plan[0][1],'추진 시기 · 공사 범위 외 2');assert.equal(plan[1][1],'기술 검토');assert.equal(plan[2][1],'입대의 PT · 현장 방문 · 10.23');assert.equal(plan[3][1],'박현우에게 기술 검토 · 10.23까지');assert.equal(plan[4][1],'조건 확인 1 / 5 · 입찰 준비 1 / 5');
  if(shot){await v.locator('.dp6').screenshot({path:shot});const pl=v.locator('.dp6-plan');assert.equal(await pl.evaluate(n=>n.getBoundingClientRect().height>40),true,'지금 할 일 5줄이 보이는 카드에 붙는다');await pl.locator('xpath=..').screenshot({path:shot.replace(/\.png$/,'-plan.png')});}else{assert.equal(await v.locator('.dp6-plan').evaluate(n=>n.getBoundingClientRect().height>40),true,'지금 할 일 5줄이 보이는 카드에 붙는다');}
  assert.deepEqual(await v.evaluate(el=>[...el.querySelectorAll('.dp6 *,.dp6-plan *')].filter(n=>n.children.length===0&&n.scrollWidth>n.clientWidth+1).map(n=>n.textContent)),[],'넘치는 글 · 잘린 글 없음(말줄임도 없음)');
  /* 끄기 */
  await page.evaluate(()=>{G.dealPrepOff=true;renderDetail();});await page.waitForTimeout(400);assert.equal(await v.locator('.dp6').count(),0);assert.equal(await v.locator('.dp6-plan').count(),0);
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log('verify-deal-prep: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
