'use strict';
/* 타사 이관 검사(2026-10-04 핸드오프 transfer · 운영 기준 4 · 5단계)
   상세 [··· 기타 처리] → 타사 이관 등록(필수값 · 미보고 경고) → '타사 이관 · 낙찰결과 대기' 꼬리표 · 이관 정보 상자(단계는 그대로) → 낙찰결과 등록(낙찰금액 · 증빙 필수)
   → 관리자 실적 인정(확인 3개 모두) → 수주실적 · 메이드율에 반영(대시보드 · 주간 브리핑 · 리포트가 같은 함수) · 인정 전에는 실적도 메이드율도 아님 · 서버 확인 뒤에만 표시 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealTransfer&&window.CRMRules&&window.DealDetailV3&&window.DashB&&window.BriefB&&window.ContractSalesData);
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222';
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'석민이앤씨',created:'2026-02-01',code,stage_code:code,grp:'영업·관리',amt:4e8,nextActionObj:{text:'입찰 준비',due:'2026-11-05',status:'open'},lastMeaningfulContactAt:T('2026-10-20'),activities:[{id:'a-'+id,type:'전화',note:'통화',at:T('2026-10-20')}]},extra||{});
   B={deals:[deal(D1,'[세종] 조치원자이아파트','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:'2026-11-10',bid_terms:'일반'}}}}),deal(D2,'[수원] 자사 수주 현장','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:5e8,closed_at:T('2026-10-10')}),
     deal('33333333-3333-4333-8333-333333333333','[인천] 실주 현장','이필선','lost',{outcome:'lost',grp:'수주 실패',closed_at:T('2026-10-12'),closed:'2026-10-12',stage_contexts:{lost:{fields:{close_reason:'가격',close_detail:'확인'}}}})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   ContractSalesData.state=()=>({status:'ready',items:[{deal_id:D2,brand:'석민이앤씨',sales_owner_name:'이필선',events:[{kind:'signed',effective_date:'2026-10-10',amount_delta:5e8}]}]});
   /* 서버 흉내: sql/deal-transfer-v1 의 규칙(등록 → 낙찰결과 → 관리자 인정) */
   window.__tf={};window.__calls=[];const now=()=>new Date().toISOString();
   SB={rpc:async(name,args)=>{const p=args.p||{};__calls.push([name,JSON.parse(JSON.stringify(p))]);
    if(name==='crm_deal_transfer_list_v1')return {data:{ok:true,rows:Object.values(__tf).filter(t=>t.transfer_status==='transferred')}};
    if(name==='crm_deal_transfer_register_v1'){if(p.cancel){delete __tf[p.deal_id];return {data:{ok:true,deal_id:p.deal_id,transfer:null}};}__tf[p.deal_id]={deal_id:p.deal_id,transfer_status:'transferred',transfer_company:p.company,transfer_reason:p.reason,transfer_date:p.date,transfer_reported:p.reported,transfer_reported_at:p.reported?p.reported_at||null:null,transfer_memo:p.memo||null,expected_amount:p.expected_amount||null,award_result:'pending',performance_owner:'이필선',incentive_eligible:false,created_at:now()};return {data:{ok:true,deal_id:p.deal_id,transfer:__tf[p.deal_id]}};}
    if(name==='crm_deal_transfer_award_v1'){const t=__tf[p.deal_id];Object.assign(t,{award_result:p.result,award_company:p.company||null,award_date:p.date||'2026-10-21',award_amount:p.amount||null,award_evidence:p.evidence||null,award_note:p.note||null,performance_amount:p.result==='transferred_won'?p.amount:null,incentive_eligible:false,rejected_reason:null});return {data:{ok:true,deal_id:p.deal_id,transfer:t}};}
    if(name==='crm_deal_transfer_approve_v1'){if(!['이승우','황윤선'].includes(ME.name))return {error:{message:'실적 인정은 예외 승인자만 할 수 있습니다'}};const t=__tf[p.deal_id];if(p.decision==='approve')Object.assign(t,{incentive_eligible:true,approved_by_name:ME.name,approved_at:now(),rejected_reason:null});else Object.assign(t,{incentive_eligible:false,rejected_reason:p.reason});return {data:{ok:true,deal_id:p.deal_id,transfer:t}};}
    if(name==='crm_ops_rules_v1')return {data:{ok:true,rules:{},history:[]}};if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.D1=D1;window.__opened=[];window.StageTransitionUI&&(window.__st=StageTransitionUI.open,StageTransitionUI.open=(d,x,code)=>{__opened.push(code);});
   G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(900);
  const v=page.locator('#detailView.dv3');assert.equal(await v.count(),1);
  /* 1. [··· 기타 처리] 메뉴: 담당자 변경 · 타사 이관 등록 · 보류 · 실주 처리 — 상시 버튼 아님 */
  assert.deepEqual(await v.locator('.dv3-headact button:visible').allInnerTexts(),['단계 바꾸기 ▾','···']);assert.equal(await page.locator('#tf-card').count(),0,'등록 전에는 이관 상자 없음');
  await v.locator('.tf-more').click();await page.waitForTimeout(150);
  assert.deepEqual(await v.locator('.tf-menu button').allInnerTexts(),['근처 현장','☆ 즐겨찾기','담당자 변경','타사 이관 등록','승인 요청','보류','실주 처리']);/* 오른쪽 정리: 근처 현장은 이 메뉴의 패널 *//* 정돈안: 즐겨찾기도 이 메뉴에서 *//* 정돈안: 즐겨찾기도 이 메뉴에서 */
  await v.locator('.tf-menu [data-tf="m-lost"]').click();await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>__opened),['lost'],'실주 처리 = 기존 단계 전환');
  await v.locator('.tf-more').click();await v.locator('.tf-menu [data-tf="m-reg"]').click();await page.waitForTimeout(200);
  /* 2. 등록 창: 필수값 · 사유는 운영 기준 목록 · 미보고 경고 */
  const dlg=page.locator('#tf-dialog .tf-dlg');assert.match(await dlg.locator('header').innerText(),/^타사 이관 등록\s*담당자 · 기타 처리 → 타사 이관 등록/);
  assert.deepEqual(await dlg.locator('.tf-chips .tf-chip').allInnerTexts(),['영업권 조율','영업권 중복','안전 · 시공조건','파트너사 협업','시공역량 문제','기타']);
  assert.match(await dlg.locator('.tf-form').innerText(),/원 담당자\s*이필선\s*자동 · 실적 귀속/);assert.equal(await dlg.locator('[data-tf-f="date"]').inputValue(),'2026-10-21','이관일 기본 = 오늘');
  await dlg.locator('[data-tf="save-reg"]').click();assert.match(await page.locator('#tf-dialog .tf-err').innerText(),/이관 업체를 적어 주세요/);
  await page.locator('#tf-dialog [data-tf-f="company"]').fill('코지건설');await page.locator('#tf-dialog .tf-chip',{hasText:'영업권 조율'}).click();
  await page.locator('#tf-dialog [data-tf-f="date"]').fill('2026-10-03');
  await page.locator('#tf-dialog .tf-chip',{hasText:'미보고'}).click();assert.match(await page.locator('#tf-dialog .tf-warn').innerText(),/미보고 이관은 등록은 되지만 인센티브 실적으로 인정되지 않습니다/);
  await page.locator('#tf-dialog .tf-chip',{hasText:'보고 완료'}).click();assert.equal(await page.locator('#tf-dialog .tf-warn').count(),0);await page.locator('#tf-dialog [data-tf-f="reported_at"]').fill('2026-10-02');
  await page.locator('#tf-dialog [data-tf-f="memo"]').fill('10.2 한준엽 팀장 협의 후 코지건설 이관');await page.locator('#tf-dialog [data-tf-f="expected"]').fill('400000000');
  if(shot)await page.screenshot({path:shot+'-register.png'});
  assert.equal(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_transfer_register_v1').length),0,'누르기 전에는 서버에 안 보냄');
  await page.locator('#tf-dialog [data-tf="save-reg"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_transfer_register_v1').map(c=>c[1])),[{deal_id:'11111111-1111-4111-8111-111111111111',company:'코지건설',reason:'영업권 조율',date:'2026-10-03',reported:true,reported_at:'2026-10-02',memo:'10.2 한준엽 팀장 협의 후 코지건설 이관',expected_amount:'400000000'}]);
  /* 3. 낙찰결과 대기: 단계는 그대로 · 꼬리표 · 이관 정보 상자 · 실적 0 · 메이드율 계산 제외 */
  assert.match(await page.locator('#tf-dialog .tf-wait').innerText(),/타사 이관 · 낙찰결과 대기[\s\S]*실주로 닫지 않습니다[\s\S]*개인 실적\s*0원\s*아직 없음\s*메이드율\s*계산 제외\s*진행 중 취급\s*예상금액\s*참고만\s*실적 아님/);
  await page.locator('#tf-dialog [data-tf="close"]').first().click();await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>dealStage(CUR_DETAIL.item)),'bidding','새 단계를 만들지 않음 — 단계 그대로');
  assert.equal(await v.locator('.tf-badge').innerText(),'타사 이관 · 낙찰결과 대기');
  assert.match(await page.locator('#tf-card').innerText(),/이관 업체\s*코지건설\s*이관 사유\s*영업권 조율 · 2026\.10\.3 이관\s*사전 보고\s*보고 완료 \(2026\.10\.2\) · 10\.2 한준엽 팀장 협의 후 코지건설 이관\s*원 담당자\s*이필선 · 실적 귀속\s*타사 이관 결과 확인\s*코지건설 낙찰 여부를 확인하고 결과를 등록하세요\.\s*낙찰결과 등록\s*오늘 업무에 뜸 · 이관 후 14일 지남/);
  assert.deepEqual(await page.evaluate(()=>[CRMRules.dealResult(CUR_DETAIL.item),DealTransfer.checkDue(CUR_DETAIL.item),DealTransfer.wonIn('2026-01-01','2027-01-01').count]),['transfer_pending',true,0],'대기 = 계산 제외 · 이관 후 14일 → 결과 확인');
  assert.equal(await page.evaluate(()=>{const C=DashB.core();return [C.made,C.perf,C.won].join('|');}),'50|500000000|1','대기 중에는 수주실적 · 메이드율에 안 들어감(자사 1 ÷ (1 + 실주 1))');
  assert.match(await page.evaluate(()=>advisoryBadge(B.deals[0])),/tf-tag[^>]*>타사 이관 · 낙찰결과 대기</,'목록 꼬리표');
  if(shot)await page.screenshot({path:shot+'-pending.png'});
  /* 4. 낙찰결과 등록: 수주 = 낙찰 업체 · 낙찰일 · 낙찰금액 · 증빙 필수 */
  await page.locator('#tf-card [data-tf="award"]').click();await page.waitForTimeout(200);
  assert.match(await page.locator('#tf-dialog header').innerText(),/^낙찰결과 등록/);assert.deepEqual(await page.locator('#tf-dialog .tf-chips .tf-chip').allInnerTexts(),['타사 이관 수주','실주','입찰 취소 · 보류']);
  assert.equal(await page.locator('#tf-dialog [data-tf-f="company"]').inputValue(),'코지건설');
  await page.locator('#tf-dialog [data-tf="save-award"]').click();assert.match(await page.locator('#tf-dialog .tf-err').innerText(),/낙찰금액\(VAT 별도\)을 넣어 주세요/);
  await page.locator('#tf-dialog [data-tf-f="date"]').fill('2026-10-20');await page.locator('#tf-dialog [data-tf-f="amount"]').fill('380000000');
  assert.equal(await page.locator('#tf-dialog [data-tf-f="amount"]').inputValue(),'380,000,000');assert.match(await page.locator('#tf-dialog .tf-info').innerText(),/실적 금액은 낙찰금액 380,000,000원 그대로 생성됩니다\. 기술자문료 · 타사 마진 · 회사 입금액은 실적 금액을 바꾸지 않습니다\./);
  await page.locator('#tf-dialog [data-tf="save-award"]').click();assert.match(await page.locator('#tf-dialog .tf-err').innerText(),/증빙/);
  await page.locator('#tf-dialog [data-tf-f="evidence"]').fill('낙찰공고 캡처 · 자료에 첨부');
  assert.equal(await page.locator('#tf-dialog [data-tf="save-award"]').innerText(),'실적 확정 요청');
  if(shot)await page.screenshot({path:shot+'-award.png'});
  await page.locator('#tf-dialog [data-tf="save-award"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_transfer_award_v1').map(c=>c[1])),[{deal_id:'11111111-1111-4111-8111-111111111111',result:'transferred_won',company:'코지건설',date:'2026-10-20',amount:380000000,evidence:'낙찰공고 캡처 · 자료에 첨부'}]);
  assert.equal(await v.locator('.tf-badge').innerText(),'타사 이관 수주 · 실적 인정 대기');
  assert.match(await page.locator('#tf-card').innerText(),/낙찰\s*코지건설 · 2026\.10\.20 · 3\.8억 \(VAT 별도\)\s*승인자 실적 인정 대기\s*승인자\(이승우 · 황윤선\) 확인 후 실적에 반영됩니다/);assert.equal(await page.locator('#tf-card [data-tf="approve"]').count(),0,'담당자에게는 실적 인정 버튼 없음');
  assert.equal(await page.evaluate(()=>{const C=DashB.core();return [CRMRules.dealResult(B.deals[0]),C.perf,C.won,C.made].join('|');}),'transfer_pending|500000000|1|50','인정 전에는 실적 아님');
  /* 5. 실적 인정: 예외 승인자(이승우 · 황윤선) 중 한 사람 · 관리자에게는 버튼 없음 · 확인 3개 모두 */
  await page.evaluate(()=>{ME={id:'admin',name:'송보람',role:'admin'};paint();DealDetailV3.apply();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#tf-card [data-tf="approve"]').count(),0,'승인 요청은 관리자에게 가지 않는다');
  await page.evaluate(()=>{ME={id:'lead1',name:'이승우',role:'manager'};paint();DealDetailV3.apply();});await page.waitForTimeout(300);
  await page.locator('#tf-card [data-tf="approve"]').click();await page.waitForTimeout(200);
  assert.match(await page.locator('#tf-dialog .tf-dlg').innerText(),/^실적 인정\s*승인자 이승우 · 황윤선 중 한 사람[\s\S]*3\.8억\s*타사 이관 수주 · 이필선 · 실적 반영 대기\s*사전 보고 확인\s*2026\.10\.2 10\.2 한준엽 팀장 협의 후 코지건설 이관\s*낙찰결과 확인\s*낙찰공고 캡처 · 자료에 첨부\s*낙찰금액 확인\s*380,000,000원 · VAT 별도\s*등록은 담당자가, 인정은 승인자\(이승우 · 황윤선\)가 합니다\. 본인 건은 다른 승인자가 처리합니다\./);
  assert.equal(await page.locator('#tf-dialog [data-tf="approve-ok"]').isDisabled(),true);
  for(const i of [0,1])await page.locator('#tf-dialog .cks button').nth(i).click();assert.equal(await page.locator('#tf-dialog [data-tf="approve-ok"]').isDisabled(),true,'셋 다 확인해야');
  await page.locator('#tf-dialog .cks button').nth(2).click();assert.equal(await page.locator('#tf-dialog [data-tf="approve-ok"]').isDisabled(),false);
  if(shot)await page.screenshot({path:shot+'-approve.png'});
  await page.locator('#tf-dialog [data-tf="approve-ok"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_transfer_approve_v1').map(c=>c[1])),[{deal_id:'11111111-1111-4111-8111-111111111111',decision:'approve',checks:{reported:true,result:true,amount:true}}]);
  assert.equal(await v.locator('.tf-badge').innerText(),'타사 이관 수주 · 3.8억 반영');assert.match(await page.locator('#tf-card').innerText(),/완료 · 수주실적 반영\s*이필선 실적 3\.8억 · 주간 브리핑 · 대시보드에 반영됨/);
  /* 6. 반영: 같은 계산 함수 — 수주실적 = 자사 5억 + 타사 이관 3.8억 · 메이드율 = (1 + 1) ÷ (1 + 1 + 1) */
  assert.deepEqual(await page.evaluate(()=>{const C=DashB.core();return [CRMRules.dealResult(B.deals[0]),C.perf,C.won,C.tf.count,C.tf.amount,C.made,CRMRules.madeRate(1,1,1)];}),['won_transfer',880000000,2,1,380000000,66.7,66.7]);
  await page.evaluate(()=>{document.getElementById('detailView')&&typeof closeDetail==='function'&&closeDetail();goPage('dash');});await page.waitForTimeout(500);
  const kpi=await page.locator('#si-dash .db-kpi').nth(1).evaluate(n=>[n.querySelector('span').textContent,n.querySelector('b').textContent,n.querySelector('small').textContent]);
  assert.deepEqual(kpi,['올해 수주실적','8.8억','합산 = 계약실적(계약금액 · 계약일) 5억(1건) + 협약 수주(낙찰금액 · 낙찰일) 없음 + 기술자문 실적(낙찰금액 · 낙찰일) 없음 + 타사 이관(낙찰금액 · 낙찰일) 3.8억(1건) · VAT 별도'],'대시보드: 합산하되 나눠 적는다');
  /* 영업 Funnel(2026-10-05): 메이드율은 머리 오른쪽, 식은 '영업력' 상자 아래 한 줄 */
  assert.deepEqual([await page.locator('#si-dash .db-f6 .db-ch .mr b').innerText(),await page.locator('#si-dash .db-f6x').innerText()],['66.7%','(직접 1 + 협약 · 기술자문 0 + 타사 이관 1) ÷ (직접 1 + 협약 · 기술자문 0 + 타사 이관 1 + 실주 1) · 배드핏 제외']);
  await page.locator('#si-dash .db-secs [data-v="people"]').click();await page.waitForTimeout(200);
  assert.match(await page.locator('#si-dash .db-prow',{hasText:'이필선'}).innerText(),/8\.8억\s*타사 이관 3\.8억 포함\s*66\.7%\s*수주 2 · 실주 1/);
  if(shot)await page.screenshot({path:shot+'-dash.png',fullPage:true});
  /* 주간 브리핑: 수주실적 아래 직접 / 협약 · 기술자문 / 타사 이관 세 줄 + 메이드율 식 */
  await page.evaluate(()=>{OpsStore.rpc=(o=>async(name,p)=>name==='crm_report_snapshot_get_v1'?{ok:true,snapshots:[]}:o(name,p))(OpsStore.rpc);goPage('brief');});await page.waitForTimeout(600);
  /* 이번 주 성과 v2(2026-10-05): 수주 표 대신 꼬리표 한 줄 */
  {const one=s=>String(s).replace(/\s+/g,' ').trim(),win=page.locator('#brief-b .bp2-tags .t.win');
   assert.equal(one(await win.innerText()),'수주 1건 · 3.8억 · 계약실적 0 · 협약 · 기술자문 0 · 타사 이관 1건 3.8억','이번 주(10/19~) 낙찰 1건');
   assert.equal(await win.getAttribute('title'),'이필선 · [세종] 조치원자이아파트 · 3.8억 (타사 이관)');
   assert.equal(one(await page.locator('#brief-b .bp2-step').nth(3).innerText()).startsWith('신규 계약 1 건 · 3.8억'),true);
   assert.match(one(await page.locator('#brief-b .bp2-rates>div').nth(1).innerText()),/^영업 메이드율 100\.0%/);
   assert.deepEqual((await page.locator('#brief-b .bp2-tags .t').allInnerTexts()).map(one).slice(1),['파이프라인 실주 0건 · 메이드율에 포함','견적문의 종결 0건 · Bad Fit 0 · 메이드율 제외']);}
  /* 리포트(직전 달 = 9월)는 해당 없음 → 표에 타사 이관 열만 */
  /* 7. 오늘 업무: 대기 건이 다시 생기면 이관 후 14일 → '타사 이관 결과 확인' */
  const cls=await page.evaluate(()=>{__tf[D1]=Object.assign(__tf[D1],{award_result:'pending',incentive_eligible:false,award_amount:null});DealTransfer._take(Object.values(__tf));const d=B.deals[0],x={key:'deal:'+d.id,type:'deal',kind:'pipeline',item:d,owner:'이필선',overdue:false,missingNext:false,dueDays:15};const r=TodayTower.classify(x,'rep');return r&&[r.rk,r.urg,r.missTxt];});
  assert.deepEqual(cls,['transfer','today','타사 이관 뒤 낙찰결과 확인 안 함']);
  /* 서버 함수가 없으면 메뉴에서 잠금 */
  await page.evaluate(()=>{window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>!/^crm_deal_transfer_/.test(n)});G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));});await page.waitForTimeout(800);
  await page.locator('#detailView .tf-more').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('#detailView .tf-menu .hot').isDisabled(),true);assert.match(await page.locator('#detailView .tf-menu .hot').innerText(),/서버 적용 대기/);
  /* 끄기 */
  await page.evaluate(()=>{G.dealTransferOff=true;DealDetailV3.apply();});await page.waitForTimeout(200);
  assert.equal(await page.locator('#detailView .tf-more').count()===0||!(await page.locator('#detailView .dv3-headact').evaluate(n=>n.classList.contains('tf-on'))),true);assert.equal(await page.locator('#detailView .dv3-headact [data-dv3="owner"]').isVisible(),true,'끄면 담당자 변경 버튼이 다시 보임');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',other_menu:true,register_required_prereport_warning:true,pending_stage_unchanged:true,award_requires_amount_evidence:true,admin_approval_three_checks:true,performance_split_same_function:true,today_item_after_days:true,server_confirmed_only:true,gate_and_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
