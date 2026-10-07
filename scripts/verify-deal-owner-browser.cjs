'use strict';
/* 담당 · 귀속 분리 검사(2026-10-04 운영 기준 2차 기능 8)
   상세 왼쪽 '담당 정보': 현재 담당 · 최초 담당(첫 연결일) · 실적 귀속(주담당 · 지금 담당은 보조) · 변경 이력 — 저장된 귀속이 없으면 최초로 실제 연결된 담당자
   담당자 변경 창: 새 담당 · 변경 사유 * · 실적 귀속(주담당 유지 (기본) / 귀속도 변경 요청) + 안내 → 저장하면 기존 담당 변경 뒤에 사유 · 귀속 선택 기록, 요청이면 예외 승인함으로
   승인 전에는 귀속이 바뀌지 않는다. 승인 요청 창의 귀속 변경은 바꿀 귀속을 담당자 이름으로 받는다. 끄기 스위치 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealOwner&&window.ApprovalInbox&&window.ApprovalRequest&&window.DealTransfer&&window.CRMRules&&window.DealDetailV3&&window.OpsStore);
  await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222';
   const deal=(id,site,owner,acts,extra)=>Object.assign({id,site,assignee:owner,brand:'석민이앤씨',created:'2026-02-01',code:'sent',stage_code:'sent',grp:'영업·관리',amt:3e8,nextActionObj:{text:'견적 검토 확인',due:'2026-11-05',status:'open'},lastMeaningfulContactAt:T('2026-10-20'),stage_contexts:{sent:{fields:{sent_date:'2026-09-23',recipient:'소장',followup_date:'2026-10-25',materials:['견적서']}}},activities:acts},extra||{});
   B={deals:[deal(D1,'[경기 용인] 수지삼성래미안','김성민',[{id:'a0',type:'전화',note:'전화 시도 · 부재',at:T('2026-07-10'),actor:'이필선'},{id:'a1',type:'전화',note:'통화 완료 — 견적 요청',at:T('2026-07-14'),actor:'이필선'},{id:'a2',type:'방문',note:'현장 방문 완료',at:T('2026-09-25'),actor:'김성민'}]),
     deal(D2,'[대전] 싸이언스빌','정정훈',[{id:'b1',type:'전화',note:'통화 완료',at:T('2026-08-03'),actor:'정정훈'}])],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;G.dealOwnerV2Off=true;/* 이 검사는 예전 담당자 관리 상자로 실적 귀속 흐름을 본다(새 창은 verify-deal-owner-v2) */ME={id:'adm',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(...a)=>{__writes.push(a);return 'req';};
   window.__own={[D1]:{deal_id:D1,first_owner:'이필선',first_connected_at:'2026-07-14',performance_owner:'이필선'}};
   window.__ev={[D1]:[{action:'reassign',from_owner:'이필선',to_owner:'김성민',reason:'지역 재배치',attribution:'keep',actor_name:'송보람',at:T('2026-09-20')}]};
   window.__ap=[{id:1,type:'owner_change',deal_id:D1,title:'[경기 용인] 수지삼성래미안 이필선 → 김성민',reason:'지역 재배치 · 계약은 김성민이 진행',payload:{from_owner:'이필선',to_owner:'김성민'},status:'pending',requested_by_name:'김성민',requested_at:T('2026-10-02'),decided_by_name:null,decided_at:null,decision_reason:null}];
   window.CRMRelease.has=()=>true;window.OpsStore.has=()=>true;window.__calls=[];let seq=1;const now=()=>new Date().toISOString();
   SB={rpc:async(name,args)=>{const p=args.p||{};__calls.push([name,JSON.parse(JSON.stringify(p))]);
    if(name==='crm_deal_owner_list_v1')return {data:{ok:true,rows:Object.values(__own),events:p.deal_id?(__ev[p.deal_id]||[]):[]}};
    if(name==='crm_deal_reassign_handover_v1'){
     const d=B.deals.find(x=>x.id===p.deal_id),first=DealOwner.first(d);
     if(!__own[p.deal_id])__own[p.deal_id]={deal_id:p.deal_id,first_owner:first.name,first_connected_at:first.at,performance_owner:first.name};
     (__ev[p.deal_id]=__ev[p.deal_id]||[]).push({action:'reassign',from_owner:p.from,to_owner:p.to,reason:p.reason,attribution:p.attribution,actor_name:ME.name,at:now()});
     const approval=p.attribution==='request'?{id:++seq,type:'owner_change',deal_id:p.deal_id,status:'pending',requested_by_name:ME.name,requested_at:now(),payload:{from_owner:__own[p.deal_id].performance_owner,to_owner:p.to}}:null;
     if(approval)__ap.unshift(approval);
     return {data:{ok:true,deal_id:p.deal_id,owner_id:'mock-'+p.to,assignee:p.to,version:(d.version||0)+1,activity_id:'mock-'+seq++,server_at:now(),owner:__own[p.deal_id],approval}};
    }
    if(name==='crm_deal_owner_reassign_v1'){if(!__own[p.deal_id])__own[p.deal_id]={deal_id:p.deal_id,first_owner:p.first_owner||p.keep_owner,first_connected_at:p.first_connected_at||null,performance_owner:p.keep_owner};(__ev[p.deal_id]=__ev[p.deal_id]||[]).push({action:'reassign',from_owner:p.from,to_owner:p.to,reason:p.reason,attribution:p.attribution,actor_name:ME.name,at:now()});return {data:{ok:true,deal_id:p.deal_id,owner:__own[p.deal_id]}};}
    if(name==='crm_approval_list_v1')return {data:{ok:true,admin:true,approver:false,rows:__ap}};
    if(name==='crm_approval_request_v1'){const r={id:++seq,type:p.type,deal_id:p.deal_id||null,title:p.title,reason:p.reason,payload:p.payload||{},status:'pending',requested_by_name:ME.name,requested_at:now(),decided_by_name:null,decided_at:null,decision_reason:null};__ap.unshift(r);return {data:{ok:true,request:r}};}
    if(name==='crm_deal_transfer_list_v1')return {data:{ok:true,rows:[]}};
    if(name==='crm_ops_rules_v1')return {data:{ok:true,rules:{},history:[]}};if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.D1=D1;window.D2=D2;G._detailPopup=true;goPage('pipe');drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForTimeout(1200);
  const v=page.locator('#detailView.dv3');assert.equal(await v.count(),1);
  /* 1. 담당 정보 상자: 현장 정보 아래 · 현재 담당 / 최초 담당 / 실적 귀속 / 변경 이력 */
  const card=v.locator('.dw-left .do-card');assert.equal(await card.count(),1);
  assert.match(await card.evaluate(n=>n.previousElementSibling.querySelector('header b').textContent),/^(이 단지 영업 이력|같은 현장 다른 영업)$/,'왼쪽 현장 정보가 빠진 뒤에는 영업 이력 칸 아래');
  /* 접어 둔 채로 시작: 머리줄 = 담당 정보 + 지금 담당 이름 + [펼치기](2026-10-05 대표) → 펼치면 예전 내용 그대로, 다시 누르면 접힘 */
  assert.deepEqual(await card.evaluate(n=>[[...n.querySelectorAll(':scope>header>*')].map(x=>x.textContent).filter(Boolean),n.querySelectorAll('.do-grid,.do-hist').length,n.querySelector('[data-do="fold"]').getAttribute('aria-expanded')]),[['담당 정보','김성민','펼치기'],0,'false']);
  await card.locator('[data-do="fold"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await card.evaluate(n=>[[...n.querySelectorAll(':scope>header>*')].map(x=>x.textContent).filter(Boolean),n.querySelector('[data-do="fold"]').getAttribute('aria-expanded')]),[['담당 정보','김성민','접기'],'true']);
  assert.deepEqual(await card.locator('.do-grid>*').evaluateAll(l=>l.map(n=>n.textContent.replace(/\s+/g,' ').trim())),['현재 담당','김성민','최초 연락 받은 사원','이필선 2026.7.10 회의 잠정안','최초 실제 연결된 사원','이필선 첫 연결 2026.7.14 현재 설정','실적 귀속','이필선 주담당 · 김성민 보조']);
  assert.equal(await card.locator('.do-grid b.perf').evaluate(n=>getComputedStyle(n).color),'rgb(29, 63, 153)');assert.equal(await card.locator('.do-grid').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ')[0]),'96px');
  assert.deepEqual(await card.locator('.do-hist>div').evaluateAll(l=>l.map(n=>[...n.children].map(c=>c.textContent))),[['2026.7.14','최초 담당 이필선 · 첫 연결 (주담당 확정)'],['2026.9.20','담당 변경 이필선 → 김성민 · 사유: 지역 재배치 · 귀속 유지'],['2026.10.2','귀속 변경 요청 → 승인함 대기']]);
  assert.deepEqual(await page.evaluate(()=>[DealOwner.perf(B.deals[0]),DealOwner.perf(B.deals[1]),DealOwner.info(B.deals[1]).sub]),['이필선','정정훈','주담당'],'저장된 귀속이 없으면 최초로 실제 연결된 담당자');
  if(shot)await page.screenshot({path:shot+'-card.png'});
  /* 2. 담당자 변경 창: 새 담당 · 변경 사유 · 실적 귀속(주담당 유지 (기본) / 귀속도 변경 요청) */
  await page.evaluate(()=>{PeopleEligibility.allowed=()=>true;});
  await v.locator('.tf-more').click();await page.waitForTimeout(150);await v.locator('.tf-menu button',{hasText:'담당자 변경'}).click();await page.waitForTimeout(500);
  const box=page.locator('.do-attr');assert.equal(await box.count(),1);
  assert.deepEqual(await box.locator('.do-chips button').evaluateAll(l=>l.map(n=>[n.textContent,n.getAttribute('aria-pressed'),getComputedStyle(n).backgroundColor])),[['주담당 유지 (기본)','true','rgb(21, 23, 28)'],['귀속도 변경 요청','false','rgb(255, 255, 255)']]);
  assert.equal(await page.evaluate(()=>{const s=document.getElementById('dv-assignee');return [s.closest('.field').querySelector('label').textContent.trim(),document.querySelector('#rs-asg>label').textContent.replace(/\s+/g,' ').trim()].join('|');}),'새 담당|변경 사유 *');
  /* 새 담당을 고르면 안내가 그 사람 이름으로 */
  await page.evaluate(()=>{const s=document.getElementById('dv-assignee');if(![...s.options].some(o=>o.value==='정정훈')){const o=document.createElement('option');o.value='정정훈';o.textContent='정정훈';s.append(o);}s.value='정정훈';s.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(await box.locator('.do-note').innerText(),'담당만 바뀌고 수주실적 · 인센티브는 이필선(주담당) 유지. 정정훈은 보조로 표시됩니다.');
  assert.deepEqual(await box.locator('.do-note').evaluate(n=>[getComputedStyle(n).color,getComputedStyle(n).backgroundColor]),['rgb(55, 65, 81)','rgb(245, 246, 248)']);
  await box.locator('.do-chips button',{hasText:'귀속도 변경 요청'}).click();
  assert.equal(await box.locator('.do-note').innerText(),'귀속 변경은 바로 바뀌지 않고 예외 승인함으로 갑니다. 승인자(이승우 · 황윤선) 승인 후 반영 · 이력 기록.');
  assert.deepEqual(await box.locator('.do-note').evaluate(n=>[getComputedStyle(n).color,getComputedStyle(n).backgroundColor]),['rgb(192, 57, 43)','rgb(253, 240, 238)']);
  if(shot)await page.screenshot({path:shot+'-change.png'});
  /* 3. 저장(귀속도 변경 요청): 기존 담당 변경 → 사유 · 귀속 선택 기록 → 승인 요청. 승인 전에는 귀속 그대로 */
  await page.evaluate(()=>{__calls.length=0;const t=document.getElementById('rs-asg-text');t.value='지역 재배치 (경기 남부) — 정정훈이 계약 진행';t.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.evaluate(()=>saveAssigneeChange());await page.waitForTimeout(900);
  assert.equal(await page.evaluate(()=>B.deals[0].assignee),'정정훈','서버 확인 응답 뒤 담당 변경');
  const calls=await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_reassign_handover_v1').map(c=>{const {request_id,...p}=c[1];return [c[0],p];}));
  assert.deepEqual(calls,[['crm_deal_reassign_handover_v1',{deal_id:'11111111-1111-4111-8111-111111111111',from:'김성민',to:'정정훈',reason:'지역 재배치 (경기 남부) — 정정훈이 계약 진행',attribution:'request',memo:''}]]);
  assert.deepEqual(await page.evaluate(()=>__writes.filter(x=>['assign','handover'].includes(x[0]))),[],'서버 확인 전 로컬 assign/handover 명령을 만들지 않는다');
  assert.deepEqual(await page.evaluate(()=>[DealOwner.perf(B.deals[0]),DealOwner.info(B.deals[0]).sub]),['이필선','주담당 · 정정훈 보조'],'승인 전에는 귀속을 바꾸지 않는다');
  assert.equal(await page.evaluate(()=>DealOwner.state().attr),'keep','다음에는 다시 기본(주담당 유지)');
  /* 4. 주담당 유지(기본): 승인 요청 없이 기록만 — 귀속이 아직 저장되지 않은 영업건은 최초 연결 담당자를 주담당으로 고정 */
  await page.evaluate(()=>{closeDetail();G._detailPopup=true;drwDeal(JSON.stringify(B.deals[1]));});await page.waitForTimeout(1000);
  await page.locator('#detailView .tf-more').click();await page.waitForTimeout(150);await page.locator('#detailView .tf-menu button',{hasText:'담당자 변경'}).click();await page.waitForTimeout(500);
  await page.evaluate(()=>{__calls.length=0;const s=document.getElementById('dv-assignee');if(![...s.options].some(o=>o.value==='김성민')){const o=document.createElement('option');o.value='김성민';o.textContent='김성민';s.append(o);}s.value='김성민';s.dispatchEvent(new Event('change',{bubbles:true}));const t=document.getElementById('rs-asg-text');t.value='업무량 재배분 — 대전 권역 조정';t.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('.do-attr .do-note').innerText(),'담당만 바뀌고 수주실적 · 인센티브는 정정훈(주담당) 유지. 김성민은 보조로 표시됩니다.');
  await page.evaluate(()=>saveAssigneeChange());await page.waitForTimeout(900);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_deal_reassign_handover_v1').map(c=>{const {request_id,...p}=c[1];return [c[0],p];})),[['crm_deal_reassign_handover_v1',{deal_id:'22222222-2222-4222-8222-222222222222',from:'정정훈',to:'김성민',reason:'업무량 재배분 — 대전 권역 조정',attribution:'keep',memo:''}]]);
  assert.deepEqual(await page.locator('#detailView .do-card .do-grid>*').evaluateAll(l=>l.map(n=>n.textContent.replace(/\s+/g,' ').trim())),['현재 담당','김성민','최초 연락 받은 사원','정정훈 2026.8.3 회의 잠정안','최초 실제 연결된 사원','정정훈 첫 연결 2026.8.3 현재 설정','실적 귀속','정정훈 주담당 · 김성민 보조']);
  assert.match(await page.locator('#detailView .do-card .do-hist').innerText(),/2026\.10\.21\s*담당 변경 정정훈 → 김성민 · 사유: 업무량 재배분 — 대전 권역 조정 · 귀속 유지/);
  /* 5. 승인 요청 창의 귀속 변경: 지금 귀속을 미리 넣고, 바꿀 귀속은 담당자 이름이어야 한다 */
  await page.evaluate(()=>{window.SALES_PEOPLE_MASTER=[{name:'정정훈',active:true},{name:'김성민',active:true},{name:'이필선',active:true}];__calls.length=0;ApprovalRequest.open('owner_change');});await page.waitForTimeout(200);
  const dlg=page.locator('#aq-dialog .aq-dlg');assert.equal(await dlg.locator('[data-aq-f="0"]').inputValue(),'정정훈 (주담당)');
  await dlg.locator('[data-aq-f="1"]').fill('아무개');await dlg.locator('[data-aq-f="why"]').fill('계약은 김성민이 진행');await dlg.locator('[data-aq="send"]').click();
  assert.equal(await dlg.locator('.aq-err').innerText(),'바꿀 귀속은 영업담당자 이름으로 적어 주세요.');
  await dlg.locator('[data-aq-f="1"]').fill('김성민');await dlg.locator('[data-aq="send"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__calls.filter(c=>c[0]==='crm_approval_request_v1').map(c=>[c[1].title,c[1].payload.from_owner,c[1].payload.to_owner])),[['[대전] 싸이언스빌 정정훈 → 김성민','정정훈','김성민']]);
  await page.evaluate(()=>ApprovalRequest.close());
  /* 6. 끄기 */
  await page.evaluate(()=>{G.dealOwnerOff=true;DealDetailV3.apply();});await page.waitForTimeout(200);
  assert.equal(await page.locator('.do-card,.do-attr').count(),0);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',owner_card_as_design:true,derived_first_connected:true,change_dialog_attribution:true,request_goes_to_inbox_no_change_before_approval:true,keep_records_only:true,approval_dialog_owner_name:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
