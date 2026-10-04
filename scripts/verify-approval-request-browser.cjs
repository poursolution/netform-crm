'use strict';
/* 승인 요청 창 검사(2026-10-04 design_handoff_rules/승인 요청 창.dc.html + 같은 날 보완 + 대표 지정: 승인자 = 이승우 · 황윤선 중 한 사람 · 누가 승인했는지 기록)
   상세 [··· 기타 처리] → '승인 요청' → 종류 6개마다 정해진 칸 + 날짜 안내 + 근거 + 증빙 → 보내면 예외 승인함 대기 + 머리 '승인 대기 · 종류' 꼬리표. 승인 전에는 영업건을 바꾸지 않는다.
   날짜는 실제 일어난 날(오늘까지)만 — 승인한 날로 대신하지 않는다. 결과 수정(직접 수주) = 낙찰일 · 낙찰금액 · 계약일 · 계약금액, 타사 이관 실적 = 이관일 · 낙찰일,
   중복 리드 정산 = 실적 나눔(합 100%), 특별 인센티브 = 대상자 · 방식 · 금액(자동) · 지급 월. 6종 모두 이 창에서 올린다 · 보낸 뒤 [다시 보기] · 결과는 요청자에게 알림.
   승인자(이승우 · 황윤선)만 승인 · 반려 — 관리자 · 본인 건은 버튼 없음. 승인하면 '승인됨 · 이름' + 응대 이력 시스템 기록 + 머리 '승인 완료 · 종류 · 이름'. */
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
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ApprovalRequest&&window.ApprovalInbox&&window.DealTransfer&&window.CRMRules&&window.DealDetailV3&&window.OpsStore&&window.SalesScope);
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222';
   B={deals:[{id:D1,site:'[경기 화성] 동탄푸른마을',assignee:'정정훈',brand:'POUR솔루션',created:'2026-02-01',code:'lost',stage_code:'lost',outcome:'lost',grp:'수주 실패',amt:1.8e8,closed_at:T('2026-10-12'),closed:'2026-10-12',stage_contexts:{lost:{fields:{close_reason:'가격 · 가격 경쟁',close_detail:'확인'}}},lastMeaningfulContactAt:T('2026-09-14'),
     activities:[{id:'a1',type:'전화',note:'통화 완료 — 견적 요청',at:T('2026-09-11'),actor:'황윤선'},{id:'a2',type:'전화',note:'전화 시도 · 부재',at:T('2026-09-10'),actor:'정정훈'},{id:'a3',type:'방문',note:'현장 방문 완료 · 소장 면담',at:T('2026-09-14'),actor:'정정훈'}]},
    {id:D2,site:'[대전] 싸이언스빌',assignee:'황윤선',brand:'석민이앤씨',created:'2026-03-01',code:'bidding',stage_code:'bidding',grp:'영업·관리',amt:3e8,nextActionObj:{text:'입찰 준비',due:'2026-11-05',status:'open'},lastMeaningfulContactAt:T('2026-10-20'),activities:[{id:'b1',type:'전화',note:'통화 완료',at:T('2026-10-20'),actor:'황윤선'}]}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'rep2',name:'정정훈',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   window.SALES_PEOPLE_MASTER=['정정훈','황윤선','이필선','김성민','이승우'].map(name=>({name,active:true}));
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(...a)=>{__writes.push(a);return 'req';};
   window.__ap=[];window.__calls=[];window.__up=[];window.__memo=[];let seq=0;const now=()=>new Date().toISOString();
   window.uploadExecAttachment=async(d,f,cat,tags,memo)=>{__up.push([d.id,f.name,f.size,cat,tags,memo]);return {id:'att-'+__up.length,file_name:f.name};};
   DealDetailV3.memo=async(d,note)=>{__memo.push([d.id,note]);d.activities=Array.isArray(d.activities)?d.activities:[];d.activities.unshift({id:'m'+__memo.length,type:'메모',note,at:now(),occurred_at:now(),actor:ME.name});};
   SB={rpc:async(name,args)=>{const p=args.p||{};__calls.push([name,JSON.parse(JSON.stringify(p))]);
    if(name==='crm_approval_list_v1')return {data:{ok:true,admin:ME.role==='admin',approver:['이승우','황윤선'].includes(ME.name),rows:__ap.filter(r=>r.status!=='cancelled')}};
    if(name==='crm_approval_request_v1'){const r={id:++seq,type:p.type,deal_id:p.deal_id||null,title:p.title,reason:p.reason,payload:p.payload||{},status:'pending',requested_by_name:ME.name,requested_at:now(),decided_by_name:null,decided_at:null,decision_reason:null};__ap.unshift(r);return {data:{ok:true,request:r}};}
    if(name==='crm_approval_decide_v1'){const r=__ap.find(x=>x.id===p.id);if(!['이승우','황윤선'].includes(ME.name))return {error:{message:'승인 · 반려는 예외 승인자만 할 수 있습니다'}};if(r.requested_by_name===ME.name)return {error:{message:'본인이 올린 요청은 다른 승인자가 처리해야 합니다'}};Object.assign(r,{status:p.decision==='approve'?'approved':'rejected',decided_by_name:ME.name,decided_at:now(),decision_reason:p.reason||null});return {data:{ok:true,request:r}};}
    if(name==='crm_deal_transfer_list_v1')return {data:{ok:true,rows:[]}};
    if(name==='crm_ops_rules_v1')return {data:{ok:true,rules:{},history:[]}};if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.D1=D1;window.D2=D2;G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(900);
  const v=page.locator('#detailView.dv3');assert.equal(await v.count(),1);
  /* 종료된 영업건(실주): 빈 값 줄이 벌어지지 않는다(공통 빈칸 상자 규칙이 걸리던 것 · 2026-10-04 대표 캡처) */
  assert.deepEqual(await v.locator('.dv3-row').evaluateAll(l=>[l.length>5,Math.max(...l.map(n=>Math.round(n.getBoundingClientRect().height)))<60,[...new Set(l.map(n=>n.querySelector('.empty')).filter(Boolean).map(n=>getComputedStyle(n).display+'|'+getComputedStyle(n).minHeight+'|'+getComputedStyle(n).paddingTop))].join(',')]),[true,true,'block|0px|0px']);
  const before=await page.evaluate(()=>JSON.stringify(B.deals[0]));
  const writes0=await page.evaluate(()=>JSON.stringify(__writes));
  const sentReq=()=>page.evaluate(()=>__calls.filter(c=>c[0]==='crm_approval_request_v1').map(c=>c[1]));
  /* 1. [··· 기타 처리] → 승인 요청 */
  assert.equal(await v.locator('.aq-tag').count(),0);
  await v.locator('.tf-more').click();await page.waitForTimeout(150);
  assert.deepEqual(await v.locator('.tf-menu button').allInnerTexts(),['담당자 변경','타사 이관 등록','승인 요청','보류','실주 처리']);
  await v.locator('.tf-menu button',{hasText:'승인 요청'}).click();await page.waitForTimeout(200);
  const dlg=page.locator('#aq-dialog .aq-dlg');assert.equal(await dlg.count(),1);
  const labels=()=>dlg.locator('.aq-form>span').allInnerTexts();
  assert.equal(await dlg.locator('.aq-hd').innerText().then(s=>s.replace(/\s+/g,' ')),'승인 요청 승인자(이승우 · 황윤선) 승인 후 반영');
  assert.deepEqual(await dlg.locator('.aq-types button').allInnerTexts(),['중복 리드 정산','전략수주','특별 인센티브','결과 수정','귀속 변경','타사 이관 실적']);
  assert.equal(await dlg.locator('.aq-types').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3);
  assert.equal(await dlg.locator('.aq-pick').innerText(),'요청 종류를 먼저 골라 주세요.');
  /* 2. 결과 수정: 현재 결과 · 바꿀 결과 · 낙찰일 · 낙찰금액 · 계약일 · 계약금액 + 날짜 안내 + 근거 + 증빙 필수 */
  await dlg.locator('.aq-types button',{hasText:'결과 수정'}).click();
  assert.deepEqual(await labels(),['현재 결과 *','바꿀 결과 *','낙찰일 *','낙찰금액 *','계약일 · 계약금액 *','근거 *','증빙 *']);
  assert.equal(await dlg.locator('.aq-hint').innerText(),'날짜는 실제 일어난 날로 적습니다 · 승인한 날로 대신하지 않음');
  assert.deepEqual(await dlg.locator('.aq-hint').evaluate(n=>[getComputedStyle(n).color,n.previousElementSibling.dataset.aqF,n.nextElementSibling.textContent]),['rgb(156, 163, 175)','4','근거 *'],'날짜 안내는 칸들 아래 · 근거 위');
  assert.equal(await dlg.locator('[data-aq-f="0"]').inputValue(),'실주 · 가격 · 가격 경쟁','지금 결과를 미리 넣어 둔다');
  assert.equal(await dlg.locator('.aq-effect').innerText(),'승인되면 결과 · 낙찰일 · 금액이 바뀌고 메이드율 · 수주실적에 바로 반영 · 계약 정보도 함께 들어가 계약 전환까지 한 번에');
  assert.deepEqual(await dlg.locator('.aq-types button[aria-pressed="true"]').evaluateAll(l=>l.map(n=>[n.textContent,getComputedStyle(n).borderTopWidth,getComputedStyle(n).backgroundColor])),[['결과 수정','2px','rgb(248, 250, 255)']]);
  assert.equal(await dlg.locator('.aq-file').innerText(),'+ 파일 첨부');assert.equal(await dlg.locator('.aq-file').evaluate(n=>getComputedStyle(n).borderTopStyle),'dashed');
  await dlg.locator('[data-aq="send"]').click();assert.equal(await dlg.locator('.aq-err').innerText(),'바꿀 결과 · 낙찰일 · 낙찰금액 · 계약일 · 계약금액을(를) 적어 주세요.');
  await dlg.locator('[data-aq-f="1"]').fill('수주 · 직접');await dlg.locator('[data-aq-f="2"]').fill('2026.11.1');await dlg.locator('[data-aq-f="3"]').fill('180,000,000원 (VAT 별도)');await dlg.locator('[data-aq-f="4"]').fill('2026.10.8 · 180,000,000원');
  await dlg.locator('[data-aq="send"]').click();assert.equal(await dlg.locator('.aq-err').innerText(),'근거를 적어 주세요.');
  await dlg.locator('[data-aq-f="why"]').fill('재입찰로 낙찰 · 낙찰공고 첨부');await dlg.locator('[data-aq="send"]').click();assert.equal(await dlg.locator('.aq-err').innerText(),'증빙 파일을 첨부해 주세요.');
  await page.locator('#aq-file').setInputFiles({name:'낙찰공고.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});await page.waitForTimeout(150);
  assert.equal(await dlg.locator('.aq-file').innerText(),'낙찰공고.pdf');
  await dlg.locator('[data-aq="send"]').click();assert.equal(await dlg.locator('.aq-err').innerText(),'낙찰일은 오늘까지의 날짜여야 합니다 — 승인한 날로 대신하지 않습니다.','앞날은 받지 않는다');
  assert.deepEqual(await page.evaluate(()=>[__up.length,__calls.filter(c=>c[0]==='crm_approval_request_v1').length]),[0,0],'빠지거나 틀린 값이 있으면 아무것도 보내지 않는다');
  await dlg.locator('[data-aq-f="2"]').fill('2026.10.1');
  if(shot)await page.screenshot({path:shot+'-form.png'});
  await dlg.locator('[data-aq="send"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__up),[['11111111-1111-4111-8111-111111111111','낙찰공고.pdf',13,'기타',['승인 요청 증빙'],'결과 수정 승인 요청 증빙']],'증빙 = 그 영업건 자료에 올린다');
  assert.deepEqual(await sentReq(),[{type:'result_fix',deal_id:'11111111-1111-4111-8111-111111111111',title:'[경기 화성] 동탄푸른마을 실주 → 수주 · 직접 1.8억',reason:'재입찰로 낙찰 · 낙찰공고 첨부',payload:{fields:[{l:'현재 결과',v:'실주 · 가격 · 가격 경쟁',auto:false},{l:'바꿀 결과',v:'수주 · 직접',auto:false},{l:'낙찰일',v:'2026.10.1',auto:false},{l:'낙찰금액',v:'180,000,000원 (VAT 별도)',auto:false},{l:'계약일 · 계약금액',v:'2026.10.8 · 180,000,000원',auto:false}],evidence:{attachment_id:'att-1',file_name:'낙찰공고.pdf'},to_result:'won_own',award_date:'2026-10-01',amount:'180000000',contract_date:'2026-10-08',contract_amount:'180000000'}}],'실제 낙찰일 · 계약일 · 금액을 읽어 둔다(승인되면 계약 전환까지)');
  /* 3. 보낸 뒤: 안내 · [다시 보기] · 머리 '승인 대기 · 종류' 꼬리표 · 영업건은 그대로 */
  assert.equal(await dlg.locator('.aq-sent>b').innerText(),'예외 승인함에 올라갔습니다');assert.equal(await dlg.locator('.aq-sent>b').evaluate(n=>getComputedStyle(n).color),'rgb(31, 122, 77)');
  assert.match(await dlg.locator('.aq-sent>span').innerText(),/^결과 수정 · 정정훈 · 오늘\s*영업건 머리에 "승인 대기" 꼬리표 · 승인 · 반려 결과는 응대 이력에 시스템 기록으로 남고 요청자에게 알림$/);
  if(shot)await page.screenshot({path:shot+'-sent.png'});
  assert.equal(await dlg.locator('.aq-sent button').innerText(),'다시 보기');await dlg.locator('[data-aq="review"]').click();
  assert.deepEqual(await dlg.locator('.aq-form input:not([type=file])').evaluateAll(l=>l.map(n=>[n.value,n.disabled])),[['실주 · 가격 · 가격 경쟁',true],['수주 · 직접',true],['2026.10.1',true],['180,000,000원 (VAT 별도)',true],['2026.10.8 · 180,000,000원',true],['재입찰로 낙찰 · 낙찰공고 첨부',true]]);
  assert.deepEqual(await dlg.locator('.aq-ft button').evaluateAll(l=>l.map(n=>[n.textContent,n.disabled])),[['취소',false],['승인 대기 중',true]]);assert.equal(await dlg.locator('.aq-unfile').count(),0);
  await dlg.locator('[data-aq="close"]').click();assert.equal(await page.locator('#aq-dialog').count(),0);
  assert.deepEqual(await v.locator('.ddv-chips .aq-tag').evaluateAll(l=>l.map(n=>[n.textContent,n.className,getComputedStyle(n).color,getComputedStyle(n).backgroundColor,n.previousElementSibling&&n.previousElementSibling.className])),[['승인 대기 · 결과 수정','aq-tag wait','rgb(138, 90, 0)','rgb(255, 244, 214)','idv-brand']]);
  assert.equal(await page.evaluate(()=>JSON.stringify(B.deals[0])),before,'승인 전에는 영업건(결과 · 금액 · 담당)을 바꾸지 않는다');assert.deepEqual(await page.evaluate(()=>[JSON.stringify(__writes),__memo.length]),[writes0,0],'요청을 보내는 동안 영업건 쓰기는 없다');
  /* 협약시공사 수주는 계약 칸 없이, 실주는 날짜 · 금액 없이 */
  assert.deepEqual(await page.evaluate(()=>{const d=B.deals[0],b=f=>ApprovalRequest.build('result_fix',d,f);return [b(['실주','수주 · 협약시공사','2026.10.1','5억','']).extra,b(['수주 · 직접','실주','','','']).extra,b(['실주','수주 · 타사 이관','','','']).err,b(['실주','수주 · 직접','2026.10.1','1.8억','2026.10.8']).err];}),[{to_result:'won_partner_tech',award_date:'2026-10-01',amount:'500000000'},{to_result:'lost'},"타사 이관 수주는 요청 종류 '타사 이관 실적'으로 올려 주세요.",'직접 수주는 계약일 · 계약금액을 함께 적어 주세요 (예: 2026.10.8 · 180,000,000원).']);
  /* 4. 중복 리드 정산: 첫 연결일 = 자동 · 실적 나눔은 합 100% · 증빙 선택 */
  await page.evaluate(()=>ApprovalRequest.open('dup_lead'));await page.waitForTimeout(150);
  assert.deepEqual(await labels(),['함께 접촉 *','첫 연결일 *','실적 나눔 *','적용 대상 *','근거 *','증빙 (선택)']);
  assert.deepEqual(await dlg.locator('.aq-form input:not([type=file])').evaluateAll(l=>l.slice(0,4).map(n=>[n.value,n.readOnly,n.classList.contains('auto')])),[['정정훈 · 황윤선',false,false],['황윤선 9.11 · 정정훈 9.14 (자동)',true,true],['',false,false],['이 영업건 수주실적 (낙찰금액)',false,false]],'부재(전화 시도)는 연결로 치지 않는다');
  assert.equal(await dlg.locator('[data-aq-f="1"]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(248, 249, 251)');assert.equal(await dlg.locator('[data-aq-f="2"]').getAttribute('placeholder'),'황윤선 60% · 정정훈 40%');
  assert.equal(await dlg.locator('.aq-effect').innerText(),'승인되면 수주실적이 비율대로 두 사람에게 나눠 잡힙니다 · 나눈 기록은 정산 내역에 남음');
  await dlg.locator('[data-aq-f="2"]').fill('황윤선 60% · 정정훈 30%');await dlg.locator('[data-aq-f="why"]').fill('두 사람이 같은 현장을 동시에 접촉');await dlg.locator('[data-aq="send"]').click();
  assert.equal(await dlg.locator('.aq-err').innerText(),'실적 나눔의 합이 100%여야 합니다 (지금 90%).');
  await dlg.locator('[data-aq-f="2"]').fill('황윤선 60% · 아무개 40%');await dlg.locator('[data-aq="send"]').click();assert.match(await dlg.locator('.aq-err').innerText(),/^실적 나눔은 담당자 이름과 비율로 적어 주세요/);
  await dlg.locator('[data-aq-f="2"]').fill('황윤선 60% · 정정훈 40%');await dlg.locator('[data-aq="send"]').click();await page.waitForTimeout(300);
  assert.deepEqual((r=>[r.type,r.title,r.payload.shares,r.payload.target,r.payload.evidence])((await sentReq())[1]),['dup_lead','[경기 화성] 동탄푸른마을 정정훈 · 황윤선 동시 접촉 황윤선 60% · 정정훈 40%',[{name:'황윤선',ratio:60},{name:'정정훈',ratio:40}],'이 영업건 수주실적 (낙찰금액)',null]);
  /* 5. 특별 인센티브: 방식(금액 또는 비율)을 적으면 금액 · 비율 칸이 자동으로 · 지급 월 */
  await page.evaluate(()=>ApprovalRequest.open('special_incentive'));await page.waitForTimeout(150);
  assert.deepEqual(await labels(),['대상자 *','방식 *','금액 · 비율 *','지급 월 *','근거 *','증빙 *']);
  assert.deepEqual(await dlg.locator('.aq-form input:not([type=file])').evaluateAll(l=>l.slice(0,4).map(n=>[n.value,n.getAttribute('placeholder')||'',n.readOnly])),[['정정훈','',false],['','금액 · 비율 중 하나',false],['','',true],['','2026.11 정산',false]]);
  assert.equal(await dlg.locator('.aq-effect').innerText(),'승인되면 정산 내역에 별도 항목(대상자 · 금액 · 지급 월)으로 반영');
  await dlg.locator('[data-aq-f="1"]').fill('비율 1%');assert.equal(await dlg.locator('[data-aq-f="2"]').inputValue(),'수주실적의 +1% (수주 확정 뒤 계산, 자동)');
  await dlg.locator('[data-aq-f="1"]').fill('금액 180만원');assert.equal(await dlg.locator('[data-aq-f="2"]').inputValue(),'1,800,000원 (자동)');
  await dlg.locator('[data-aq-f="3"]').fill('11월');await dlg.locator('[data-aq-f="why"]').fill('고난도 재입찰 수주');
  await page.locator('#aq-file').setInputFiles({name:'결재.png',mimeType:'image/png',buffer:Buffer.from('x')});await page.waitForTimeout(100);
  await dlg.locator('[data-aq="send"]').click();assert.equal(await dlg.locator('.aq-err').innerText(),'지급 월을 적어 주세요 (예: 2026.11 정산).');
  await dlg.locator('[data-aq-f="3"]').fill('2026.11 정산');await dlg.locator('[data-aq="send"]').click();await page.waitForTimeout(300);
  assert.deepEqual((r=>[r.type,r.title,r.payload.target,r.payload.mode,r.payload.value,r.payload.amount,r.payload.pay_month])((await sentReq())[2]),['special_incentive','[경기 화성] 동탄푸른마을 정정훈 1,800,000원 2026.11 정산','정정훈','amount','1800000','1800000','2026-11']);
  /* 6. 타사 이관 실적: 이관일 · 낙찰일(실제 날) · 낙찰금액 — 이 창에서 바로 예외 승인함으로 */
  await page.evaluate(()=>ApprovalRequest.open('transfer'));await page.waitForTimeout(150);
  assert.deepEqual(await labels(),['이관 업체 *','이관일 *','낙찰일 *','낙찰금액 *','근거 *','증빙 *']);
  assert.equal(await dlg.locator('.aq-effect').innerText(),'승인되면 낙찰일 기준으로 타사 이관 수주 실적 반영 (승인일 아님)');
  await dlg.locator('[data-aq-f="0"]').fill('코지건설');await dlg.locator('[data-aq-f="1"]').fill('2026.10.20');await dlg.locator('[data-aq-f="2"]').fill('2026.10.3');await dlg.locator('[data-aq-f="3"]').fill('380,000,000원 (VAT 별도)');await dlg.locator('[data-aq-f="why"]').fill('사전 보고 10.2 · 낙찰공고 첨부');
  await page.locator('#aq-file').setInputFiles({name:'공고.png',mimeType:'image/png',buffer:Buffer.from('x')});await page.waitForTimeout(100);
  await dlg.locator('[data-aq="send"]').click();assert.equal(await dlg.locator('.aq-err').innerText(),'낙찰일은 이관일보다 앞설 수 없습니다.');
  await dlg.locator('[data-aq-f="1"]').fill('2026.10.3');await dlg.locator('[data-aq-f="2"]').fill('2026.10.20');
  if(shot)await page.screenshot({path:shot+'-transfer.png'});
  await dlg.locator('[data-aq="send"]').click();await page.waitForTimeout(400);
  assert.equal(await page.locator('#tf-dialog').count(),0,'다른 창으로 넘기지 않는다');assert.equal(await dlg.locator('.aq-sent>b').innerText(),'예외 승인함에 올라갔습니다');
  assert.deepEqual((r=>[r.type,r.title,r.reason,r.payload.company,r.payload.amount,r.payload.transfer_date,r.payload.award_date,r.payload.evidence.file_name])((await sentReq())[3]),['transfer','[경기 화성] 동탄푸른마을 코지건설 380,000,000원 (VAT 별도) 낙찰 2026.10.20','사전 보고 10.2 · 낙찰공고 첨부','코지건설','380000000','2026-10-03','2026-10-20','공고.png']);
  await dlg.locator('[data-aq="review"]').click();await dlg.locator('[data-aq="close"]').click();
  assert.deepEqual(await v.locator('.ddv-chips .aq-tag').allInnerTexts(),['승인 대기 · 타사 이관 실적','승인 대기 · 특별 인센티브','승인 대기 · 중복 리드 정산','승인 대기 · 결과 수정']);
  assert.equal(await page.evaluate(()=>JSON.stringify(B.deals[0])),before,'승인 전에는 실적 · 귀속 · 결과를 바꾸지 않는다');
  /* 전략수주 · 귀속 변경: 칸 2개 + 같은 날짜 안내 */
  await page.evaluate(()=>ApprovalRequest.open('strategic_win'));await page.waitForTimeout(100);assert.deepEqual(await labels(),['할인 · 조건 *','목적 *','근거 *','증빙 (선택)']);assert.equal(await dlg.locator('.aq-hint').count(),1);
  await dlg.locator('.aq-types button',{hasText:'귀속 변경'}).click();assert.deepEqual(await labels(),['현재 귀속 *','바꿀 귀속 *','근거 *','증빙 (선택)']);assert.equal(await dlg.locator('.aq-effect').innerText(),'승인되면 실적 귀속이 바뀌고, 이전 귀속은 이력에 남음');
  await page.evaluate(()=>{ApprovalRequest.close();__ap.splice(0,__ap.length,...__ap.filter(r=>r.type==='result_fix'));closeDetail();});await page.waitForTimeout(200);
  /* 7. 승인자(이승우 · 영업사원 권한)도 설정 → 예외 승인함을 보고 승인한다 · 누가 승인했는지 남는다 */
  await page.evaluate(()=>{ME={id:'lead1',name:'이승우',role:'rep'};paint();goPage('approvals');});await page.waitForTimeout(700);
  assert.equal(await page.locator('.menu [data-p="approvals"]').isVisible(),true);assert.equal(await page.locator('.menu [data-p="rules"]').isVisible(),false,'운영 기준 설정은 관리자만');
  const inbox=page.locator('#approval-inbox');
  assert.equal(await inbox.locator('.apv-hd').innerText().then(s=>s.replace(/\s+/g,' ')),'승인 대기 1건 현장에서 바로 고치지 않고 여기로 모음 · 승인 · 반려 모두 이력에 남음 · 승인자(이승우 · 황윤선) 중 한 사람');
  assert.deepEqual(await inbox.locator('.apv-row').evaluateAll(l=>l.map(n=>[n.querySelector('.apv-type').textContent,n.querySelector('.apv-t').textContent,n.querySelector('.apv-main span').textContent,n.querySelector('.apv-who').textContent,[...n.querySelectorAll('.apv-act button')].map(b=>b.textContent).join('|')])),[['결과 수정','[경기 화성] 동탄푸른마을 실주 → 수주 · 직접 1.8억','재입찰로 낙찰 · 낙찰공고 첨부','정정훈 · 오늘','반려|승인']]);
  await page.evaluate(()=>{__calls.length=0;});
  await inbox.locator('[data-apv="yes"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_approval_decide_v1')),[['crm_approval_decide_v1',{id:1,decision:'approve'}]]);
  assert.equal(await inbox.locator('.apv-res').innerText(),'승인됨 · 이승우');
  assert.deepEqual(await page.evaluate(()=>__memo),[['11111111-1111-4111-8111-111111111111','[승인 요청 · 결과 수정] 이승우 승인 완료 — [경기 화성] 동탄푸른마을 실주 → 수주 · 직접 1.8억']],'응대 이력에 누가 승인했는지 남긴다');
  assert.equal(await page.evaluate(()=>{const d=B.deals[0];return [d.code,d.outcome,d.assignee].join('|');}),'lost|lost|정정훈','영업건의 단계 · 담당은 그대로 — 수주 결과 · 계약은 서버가 승인과 함께 반영한다');
  /* 상세: '승인 완료 · 종류 · 승인자' 꼬리표 + 시스템 기록 */
  await inbox.locator('[data-apv="open"]').click();await page.waitForTimeout(800);
  assert.deepEqual(await page.locator('#detailView .ddv-chips .aq-tag').evaluateAll(l=>l.map(n=>[n.textContent,getComputedStyle(n).color,getComputedStyle(n).backgroundColor])),[['승인 완료 · 결과 수정 · 이승우','rgb(31, 122, 77)','rgb(232, 246, 238)']]);
  const ev=page.locator('#detailView .idv-thread .idv-msg.aq-ev');assert.equal(await ev.count(),1);assert.equal(await ev.locator('.dv3-kind').innerText(),'시스템');assert.match(await ev.locator('.idv-bubble').innerText(),/^\[승인 요청 · 결과 수정\] 이승우 승인 완료 — /);
  if(shot)await page.screenshot({path:shot+'-approved.png'});
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  /* 8. 본인이 올린 요청: 승인자여도 버튼 없음 · 반려는 사유와 함께 · 응대 이력에 누가 반려했는지 */
  await page.evaluate(()=>{__ap.unshift({id:7,type:'strategic_win',deal_id:D2,title:'[대전] 싸이언스빌 할인 7%',reason:'레퍼런스 현장 확보 목적',payload:{},status:'pending',requested_by_name:'황윤선',requested_at:new Date().toISOString(),decided_by_name:null,decided_at:null,decision_reason:null});});
  await page.evaluate(async()=>{ME={id:'lead2',name:'황윤선',role:'rep'};await ApprovalInbox.load();paint();});await page.waitForTimeout(300);
  const r7=inbox.locator('.apv-row',{has:page.locator('.apv-t',{hasText:'싸이언스빌'})});
  assert.equal(await r7.locator('.apv-wait').innerText(),'본인 건 · 다른 승인자 처리 대기');assert.equal(await r7.locator('.apv-act').count(),0);
  await page.evaluate(async()=>{ME={id:'lead1',name:'이승우',role:'rep'};await ApprovalInbox.load();paint();__memo.length=0;});await page.waitForTimeout(300);
  await r7.locator('[data-apv="no"]').click();await r7.locator('[data-apv-f="reason"]').fill('할인 폭 근거 부족');await r7.locator('[data-apv="rej-ok"]').click();await page.waitForTimeout(400);
  assert.equal(await r7.locator('.apv-res').innerText(),'반려 · 할인 폭 근거 부족');
  assert.deepEqual(await page.evaluate(()=>__memo),[['22222222-2222-4222-8222-222222222222','[승인 요청 · 전략수주] 이승우 반려 — 사유: 할인 폭 근거 부족']]);
  /* 9. 관리자(송보람): 목록은 보지만 승인 · 반려 버튼은 없다 / 영업사원: 메뉴 없음 · 요청자에게 알림(한 번) */
  await page.evaluate(async()=>{__ap.unshift({id:9,type:'special_incentive',deal_id:null,title:'[인천] 옥련현대 정정훈 수주실적의 +1%',reason:'고난도 재입찰 수주',payload:{},status:'pending',requested_by_name:'정정훈',requested_at:new Date().toISOString(),decided_by_name:null,decided_at:null,decision_reason:null});ME={id:'adm',name:'송보람',role:'admin'};await ApprovalInbox.load();paint();});await page.waitForTimeout(300);
  const r9=inbox.locator('.apv-row',{has:page.locator('.apv-t',{hasText:'옥련현대'})});
  assert.equal(await r9.locator('.apv-wait').innerText(),'승인자 처리 대기');assert.equal(await r9.locator('.apv-act').count(),0,'승인 요청은 관리자에게 가지 않는다');
  assert.equal(await page.locator('.menu [data-p="approvals"]').isVisible(),true);
  await page.evaluate(()=>{window.__toasts=[];const t0=window.toast;window.toast=(m,k)=>{__toasts.push(String(m));return t0&&t0(m,k);};try{localStorage.clear();}catch(e){}ME={id:'rep2',name:'정정훈',role:'rep'};paint();});await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__toasts.filter(m=>/^승인 요청 결과/.test(m))),['승인 요청 결과 — 결과 수정 · 이승우 승인 완료 · [경기 화성] 동탄푸른마을 실주 → 수주 · 직접 1.8억'],'요청자에게 알림');
  await page.evaluate(()=>{__toasts.length=0;paint();});await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>__toasts.filter(m=>/^승인 요청 결과/.test(m))),[],'같은 결과는 한 번만 알린다');
  assert.equal(await page.locator('.menu [data-p="approvals"]').isVisible(),false);assert.equal(await page.locator('#approval-inbox').innerText().then(s=>s.trim()),'예외 승인함은 승인자 · 관리자 전용 화면입니다.');
  /* 10. 끄기 */
  await page.evaluate(()=>{goPage('pipe');G._detailPopup=true;drwDeal(JSON.stringify(B.deals[1]));});await page.waitForTimeout(700);
  await page.evaluate(()=>{G.approvalRequestOff=true;DealDetailV3.apply();});await page.locator('#detailView .tf-more').click();await page.waitForTimeout(150);
  assert.deepEqual(await page.locator('#detailView .tf-menu button').allInnerTexts(),['담당자 변경','타사 이관 등록','보류','실주 처리']);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',menu_and_dialog_as_design:true,real_dates_not_approval_day:true,result_fix_contract_fields:true,split_sum_100:true,incentive_auto_amount_month:true,transfer_dates_in_this_dialog:true,sent_review_tag_no_data_change:true,approver_decides_who_recorded:true,own_and_admin_no_buttons:true,requester_notified_once:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
