'use strict';
/* 예외 승인함 검사(2026-10-04 운영 기준 2차 기능 4)
   사이드바 설정 → 예외 승인함(승인자 · 관리자가 본다 · 승인 · 반려는 예외 승인자 이승우 · 황윤선 중 한 사람): 승인 대기 n건 · 종류 꼬리표 6색 · 요청 내용 · 사유 · 올린 사람 · 언제 · [반려] [승인]
   타사 이관 실적 = 기존 타사 이관의 실적 인정 창 그대로(같은 저장 함수) / 그 밖 = 승인 요청 저장소(승인 · 반려 사유 필수 · 서버 확인 뒤에만 표시)
   처리된 줄은 흐리게 남는다(승인됨 · 이름 / 반려 · 사유). 저장소가 없어도 타사 이관 줄은 보인다. 끄기 스위치 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ApprovalInbox&&window.DealTransfer&&window.CRMRules&&window.OpsStore&&window.SalesScope);
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222',D3='33333333-3333-4333-8333-333333333333';
   const deal=(id,site,owner,code)=>({id,site,assignee:owner,brand:'석민이앤씨',created:'2026-02-01',code,stage_code:code,grp:'영업·관리',amt:4e8,nextActionObj:{text:'입찰 준비',due:'2026-11-05',status:'open'},lastMeaningfulContactAt:T('2026-10-20'),activities:[{id:'a-'+id,type:'전화',note:'통화',at:T('2026-10-20')}]});
   B={deals:[deal(D1,'[세종] 조치원자이','이필선','bidding'),deal(D2,'[경기 화성] 동탄','정정훈','bidding'),deal(D3,'[대전] 싸이언스빌','황윤선','bidding')],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'lead1',name:'이승우',role:'manager'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   const tf=(deal_id,o)=>Object.assign({deal_id,transfer_status:'transferred',transfer_company:'코지건설',transfer_reason:'영업권 조율',transfer_date:'2026-10-03',transfer_reported:true,transfer_reported_at:'2026-10-02',award_result:'transferred_won',award_company:'코지건설',award_date:'2026-10-20',award_amount:380000000,award_evidence:'낙찰공고 첨부',performance_amount:380000000,performance_owner:'이필선',created_by_name:'이필선',incentive_eligible:false,approved_at:null,updated_at:'2026-10-21T09:00:00+09:00'},o||{});
   window.__tf={[D1]:tf(D1),[D3]:tf(D3,{award_company:'한빛건설',award_amount:210000000,transfer_reported:false,transfer_reported_at:null,award_evidence:'결과 통보 문자',performance_owner:'황윤선',created_by_name:'황윤선',updated_at:'2026-10-17T09:00:00+09:00'})};
   const rq=(id,type,deal_id,title,reason,who,at,o)=>Object.assign({id,type,deal_id,title,reason,payload:{},status:'pending',requested_by_name:who,requested_at:at,decided_by_name:null,decided_at:null,decision_reason:null},o||{});
   window.__ap=[rq(1,'owner_change',null,'[경기 용인] 수지삼성래미안 이필선 → 김성민','지역 재배치 · 계약은 김성민이 진행','김성민','2026-10-20T09:00:00+09:00'),
    rq(2,'dup_lead',null,'[서울 강남] 풍림1차 황윤선 · 정정훈 동시 접촉','최초 연결 황윤선 9.11 · 정정훈 9.14','정정훈','2026-10-19T09:00:00+09:00'),
    rq(3,'strategic_win',D3,'[대전] 싸이언스빌 할인 7%','레퍼런스 현장 확보 목적','황윤선','2026-10-18T10:00:00+09:00'),
    rq(4,'result_fix',D2,'[경기 화성] 동탄 실주 → 수주','재입찰로 낙찰 · 낙찰공고 첨부','정정훈','2026-10-18T08:00:00+09:00'),
    rq(5,'special_incentive',null,'[인천] 옥련현대 특별 인센티브','신규 공법 첫 수주','한준엽','2026-10-10T09:00:00+09:00',{status:'approved',decided_by_name:'이승우',decided_at:'2026-10-11T09:00:00+09:00'})];
   window.__calls=[];window.__apOff=false;const now=()=>new Date().toISOString();
   SB={rpc:async(name,args)=>{const p=args.p||{};__calls.push([name,JSON.parse(JSON.stringify(p))]);
    if(name==='crm_deal_transfer_list_v1')return {data:{ok:true,rows:Object.values(__tf)}};
    if(name==='crm_deal_transfer_approve_v1'){const t=__tf[p.deal_id];if(p.decision==='approve')Object.assign(t,{incentive_eligible:true,approved_by_name:'이승우',approved_at:now(),rejected_reason:null});else Object.assign(t,{incentive_eligible:false,approved_by_name:'이승우',approved_at:now(),rejected_reason:p.reason});return {data:{ok:true,deal_id:p.deal_id,transfer:t}};}
    if(name==='crm_approval_list_v1')return __apOff?{error:{code:'PGRST202',message:'Could not find the function'}}:{data:{ok:true,admin:true,rows:__ap}};
    if(name==='crm_approval_decide_v1'){const r=__ap.find(x=>x.id===p.id);if(!r||r.status!=='pending')return {error:{message:'이미 처리된 요청입니다'}};if(p.decision==='reject'&&!p.reason)return {error:{message:'반려 사유를 적어 주세요'}};Object.assign(r,{status:p.decision==='approve'?'approved':'rejected',decided_by_name:'이승우',decided_at:now(),decision_reason:p.reason||null});return {data:{ok:true,request:r}};}
    if(name==='crm_ops_rules_v1')return {data:{ok:true,rules:{},history:[]}};if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.D1=D1;window.D3=D3;SalesScope.sidebar&&SalesScope.sidebar();goPage('approvals');
  });
  await page.waitForTimeout(900);
  /* 1. 화면: 제목 · 사이드바(설정 → 예외 승인함) · 머리글 */
  assert.equal(await page.locator('#ptitle').innerText(),'예외 승인함');assert.match(await page.locator('#psub').innerText(),/현장에서 바로 고치지 않고 여기로 모읍니다 · 승인 · 반려 모두 이력에 남습니다 · 승인자 · 관리자 전용/);
  assert.equal(await page.locator('.menu [data-p="approvals"]').innerText().then(s=>s.replace(/\s+/g,' ').trim()),'예외 승인함');assert.equal(await page.locator('.menu [data-p="approvals"]').isVisible(),true,'사이드바 설정 → 예외 승인함');
  const v=page.locator('#approval-inbox');
  assert.equal(await v.locator('.apv-hd').innerText().then(s=>s.replace(/\s+/g,' ')),'승인 대기 6건 현장에서 바로 고치지 않고 여기로 모음 · 승인 · 반려 모두 이력에 남음 · 승인자(이승우 · 황윤선) 중 한 사람');
  assert.equal(await v.locator('.apv-hd em').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)');
  /* 2. 줄: 대기 먼저 · 최근 순, 처리된 줄은 흐리게 뒤로. 종류 꼬리표 색 = 시안 */
  const rows=()=>v.locator('.apv-row').evaluateAll(l=>l.map(n=>[n.querySelector('.apv-type').textContent,n.querySelector('.apv-t').textContent,n.querySelector('.apv-main span').textContent,n.querySelector('.apv-who').textContent,(n.querySelector('.apv-act')?[...n.querySelectorAll('.apv-act button')].map(b=>b.textContent).join('|'):n.querySelector('.apv-res')?n.querySelector('.apv-res').textContent:'')]));
  assert.deepEqual(await rows(),[
   ['타사 이관 실적','[세종] 조치원자이 · 코지건설 3.8억','사전 보고 10.2 · 낙찰공고 첨부','이필선 · 오늘','반려|승인'],
   ['귀속 변경','[경기 용인] 수지삼성래미안 이필선 → 김성민','지역 재배치 · 계약은 김성민이 진행','김성민 · 어제','반려|승인'],
   ['중복 리드 정산','[서울 강남] 풍림1차 황윤선 · 정정훈 동시 접촉','최초 연결 황윤선 9.11 · 정정훈 9.14','정정훈 · 2일 전','반려|승인'],
   ['전략수주','[대전] 싸이언스빌 할인 7%','레퍼런스 현장 확보 목적','황윤선 · 3일 전','반려|승인'],
   ['결과 수정','[경기 화성] 동탄 실주 → 수주','재입찰로 낙찰 · 낙찰공고 첨부','정정훈 · 3일 전','반려|승인'],
   ['타사 이관 실적','[대전] 싸이언스빌 · 한빛건설 2.1억','사전 보고 없음 · 결과 통보 문자','황윤선 · 4일 전','반려|승인'],
   ['특별 인센티브','[인천] 옥련현대 특별 인센티브','신규 공법 첫 수주','한준엽 · 11일 전','승인됨 · 이승우']]);
  assert.deepEqual(await v.locator('.apv-type').evaluateAll(l=>l.slice(0,5).concat(l.slice(6)).map(n=>[getComputedStyle(n).color,getComputedStyle(n).backgroundColor])),[['rgb(29, 63, 153)','rgb(238, 243, 254)'],['rgb(138, 90, 0)','rgb(255, 244, 214)'],['rgb(107, 114, 128)','rgb(243, 244, 246)'],['rgb(31, 122, 77)','rgb(232, 246, 238)'],['rgb(180, 35, 24)','rgb(253, 236, 236)'],['rgb(112, 72, 232)','rgb(241, 237, 253)']]);
  assert.deepEqual(await v.locator('.apv-row').evaluateAll(l=>l.map(n=>[n.classList.contains('done'),getComputedStyle(n).opacity,getComputedStyle(n).gridTemplateColumns.split(' ')[0]])).then(a=>[a[0],a[6]]),[[false,'1','96px'],[true,'0.55','96px']]);
  assert.deepEqual(await v.locator('.apv-row').first().locator('.apv-act button').evaluateAll(l=>l.map(n=>[getComputedStyle(n).backgroundColor,getComputedStyle(n).color])),[['rgb(255, 255, 255)','rgb(21, 23, 28)'],['rgb(21, 23, 28)','rgb(255, 255, 255)']]);
  if(shot)await page.screenshot({path:shot+'-list.png'});
  /* 3. 승인(귀속 변경): 서버 확인 뒤에만 '승인됨 · 이름' */
  const row=t=>v.locator('.apv-row',{has:page.locator('.apv-t',{hasText:t})});
  await page.evaluate(()=>{__calls.length=0;});
  await row('수지삼성래미안').locator('[data-apv="yes"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__calls),[['crm_approval_decide_v1',{id:1,decision:'approve'}]]);
  assert.equal(await row('수지삼성래미안').locator('.apv-res').innerText(),'승인됨 · 이승우');assert.equal(await row('수지삼성래미안').evaluate(n=>n.classList.contains('done')),true);
  assert.equal(await v.locator('.apv-hd em').innerText(),'5');
  /* 4. 반려(결과 수정): 사유 필수 → 사유와 함께 저장 */
  await page.evaluate(()=>{__calls.length=0;});
  await row('동탄 실주').locator('[data-apv="no"]').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.getAttribute('placeholder')),'반려 사유');
  await row('동탄 실주').locator('[data-apv="rej-ok"]').click();await page.waitForTimeout(150);
  assert.equal(await v.locator('.apv-err').innerText(),'반려 사유를 적어 주세요.');assert.deepEqual(await page.evaluate(()=>__calls),[],'사유 없이는 보내지 않음');
  await row('동탄 실주').locator('[data-apv-f="reason"]').fill('낙찰공고 확인 안 됨');
  if(shot)await page.screenshot({path:shot+'-reject.png'});
  await row('동탄 실주').locator('[data-apv="rej-ok"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__calls),[['crm_approval_decide_v1',{id:4,decision:'reject',reason:'낙찰공고 확인 안 됨'}]]);
  assert.equal(await row('동탄 실주').locator('.apv-res').innerText(),'반려 · 낙찰공고 확인 안 됨');assert.equal(await row('동탄 실주').locator('.apv-res').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)');
  assert.equal(await v.locator('.apv-hd em').innerText(),'4');assert.equal(await v.locator('.apv-err').count(),0);
  /* 서버가 거절하면 처리된 것으로 표시하지 않는다 */
  await page.evaluate(()=>{const o=SB.rpc;window.__rpc0=o;SB.rpc=async(n,a)=>n==='crm_approval_decide_v1'?{error:{message:'이미 처리된 요청입니다'}}:o(n,a);});
  await row('풍림1차').locator('[data-apv="yes"]').click();await page.waitForTimeout(300);
  assert.match(await v.locator('.apv-err').innerText(),/저장하지 못했습니다: 이미 처리된 요청입니다/);assert.equal(await row('풍림1차').locator('.apv-act').count(),1,'여전히 대기');
  await page.evaluate(()=>{SB.rpc=__rpc0;});
  /* 5. 타사 이관 실적: [승인] = 기존 실적 인정 창(확인 3개) → 같은 저장 함수 */
  await page.evaluate(()=>{__calls.length=0;});
  await row('조치원자이').locator('[data-apv="yes"]').click();await page.waitForTimeout(250);
  const dlg=page.locator('#tf-dialog');assert.equal(await dlg.count(),1);assert.match(await dlg.innerText(),/3\.8억[\s\S]*타사 이관 수주 · 이필선 · 실적 반영 대기/);
  assert.equal(await dlg.locator('[data-tf="approve-ok"]').isDisabled(),true,'확인 3개 전에는 잠금');
  for(const i of [0,1,2])await dlg.locator('[data-tf="ck"]').nth(i).click();
  await dlg.locator('[data-tf="approve-ok"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_transfer_approve_v1')),[['crm_deal_transfer_approve_v1',{deal_id:'11111111-1111-4111-8111-111111111111',decision:'approve',checks:{reported:true,result:true,amount:true}}]]);
  assert.equal(await page.locator('#tf-dialog').count(),0);assert.equal(await row('조치원자이').locator('.apv-res').innerText(),'승인됨 · 이승우');assert.equal(await v.locator('.apv-hd em').innerText(),'3');
  /* [반려] = 같은 창의 제외 사유 입력부터 */
  await row('한빛건설').locator('[data-apv="no"]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#tf-dialog [data-tf="reject"]').innerText(),'제외 확정');assert.equal(await page.locator('#tf-dialog [data-tf-f="reason"]').count(),1);
  await page.locator('#tf-dialog [data-tf-f="reason"]').fill('사전 보고 없음');await page.locator('#tf-dialog [data-tf="reject"]').click();await page.waitForTimeout(400);
  assert.equal(await row('한빛건설').locator('.apv-res').innerText(),'반려 · 사전 보고 없음');assert.equal(await v.locator('.apv-hd em').innerText(),'2');
  /* 6. 제목 = 같은 상세 */
  await row('싸이언스빌 할인').locator('[data-apv="open"]').click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>CUR_DETAIL&&CUR_DETAIL.kind==='deal'&&CUR_DETAIL.item.id),'33333333-3333-4333-8333-333333333333');
  await page.evaluate(()=>{try{closeDetail();}catch(e){}});await page.waitForTimeout(200);
  /* 7. 저장소가 아직 없으면: 타사 이관 줄만(오류 문구 없음) · 관리자 아니면 안내만 · 끄기 */
  assert.deepEqual(await page.evaluate(async()=>{__apOff=true;const S=ApprovalInbox.state();S.rows=null;await ApprovalInbox.load();ApprovalInbox.render();return [[...document.querySelectorAll('#approval-inbox .apv-type')].map(n=>n.textContent),!!document.querySelector('#approval-inbox .apv-err')];}),[['타사 이관 실적','타사 이관 실적'],false]);
  assert.equal(await page.evaluate(()=>{ME={id:'rep1',name:'이필선',role:'rep'};ApprovalInbox.render();return document.getElementById('approval-inbox').innerText.trim();}),'예외 승인함은 승인자 · 관리자 전용 화면입니다.');
  assert.equal(await page.evaluate(()=>{ME={id:'adm',name:'이승우',role:'admin'};G.approvalInboxOff=true;ApprovalInbox.render();return document.getElementById('approval-inbox').innerHTML;}),'');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',page_and_menu:true,rows_as_design:true,approve_server_confirmed:true,reject_reason_required:true,transfer_same_dialog:true,title_opens_detail:true,store_missing_and_admin_only:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
