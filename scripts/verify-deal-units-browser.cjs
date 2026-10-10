'use strict';
/* 관리 단위(2026-10-10 design_handoff_units · 시안 '관리 단위 · 현장 아래 영업건 시안') — 합성 자료(현장 · 이름 · 금액은 지어낸 것)
   확인: 영업건 상세 오른쪽 '관리 단위 · 영업건' 상자(책임자 · 참여 · 브랜드 3종 · 금액 · 요청 · 현장 공통) / 저장 전 = '추정 · 저장 전' / 참여 · 브랜드 수정 → 서버 저장 → 추정 표시 사라짐
         / 같은 현장 다른 영업건은 따로(연락 이력은 현장 공통으로 합산) / 수주 · 시공 건 = 시공 인계 5칸 + [수령 확인 요청](시공 담당 없으면 안내) / 실주 건 = 현장 관계 유지 줄 / 글 잘림 없음 / 끄기 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealUnits&&window.DealOwner&&window.DealSame&&window.DecisionCollab&&window.OpsStore&&window.DealWin&&window.WorkRequest);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const S='aaaaaaaa-0000-4000-8000-000000000001',D1='11111111-1111-4111-8111-111111111111',D2='22222222-2222-4222-8222-222222222222',D3='33333333-3333-4333-8333-333333333333';
   const act=(id,type,note,at)=>({id,type,note,at,actor:'이필선',meaningful:true});
   B={deals:[
    /* 옥상방수 · 수주(계약 · 시공) */
    {id:D1,site:'[경기 고양] 햇빛마을23단지',site_id:S,assignee:'이필선',brand:'POUR공법',origin_business:'석민이앤씨',created:'2025-11-20',code:'contract',stage_code:'contract',grp:'계약·시공',amt:420000000,manager_name:'김정훈',manager_mobile:'0319991234',work_summary:'옥상방수',
     contacts:[{person_key:'mobile:0319991234',name:'김정훈',role:'관리소장',mobile:'0319991234',status:'current'},{person_key:'p2',name:'최OO',role:'입주자대표회장',mobile:'',status:'current'}],
     stage_contexts:{contract:{fields:{contract_date:'2026-09-26',contract_amount:420000000,special_terms:'하자 5년 · 공사 중 소음 안내문'}},construction:{fields:{start_date:'2026-11-03',completion_due:'2026-12-15'}}},
     next_action:{id:'n1',text:'시공 인계 확인',type:'전화',due:day(2),status:'open',assignee_name:'박현우'},
     activities:[act('a1','전화','통화 연결 · 계약 조건 확인','2026-09-12T10:05:00+09:00'),act('a2','방문','현장 방문 · 착공 일정 협의','2026-09-20T15:40:00+09:00')]},
    /* 재도장 · 관계관리(같은 현장 · 다른 영업건) */
    {id:D2,site:'[경기 고양] 햇빛마을23단지',site_id:S,assignee:'이필선',brand:'POUR솔루션',created:'2026-06-10',code:'rapport',stage_code:'rapport',grp:'영업·관리',amt:310000000,work_summary:'재도장',
     next_action:{id:'n2',text:'입대의 회의 후 연락',type:'전화',due:day(10),status:'open'},activities:[act('b1','전화','통화 연결 · 입대의 10월 중순','2026-10-02T11:00:00+09:00')]},
    /* 외벽 · 실주 */
    {id:D3,site:'[서울 송파] 실주한 단지',assignee:'황윤선',brand:'석민이앤씨',created:'2025-03-01',code:'lost',stage_code:'lost',outcome:'lost',closed_at:'2025-09-01',grp:'종료',amt:200000000,work_summary:'외벽',
     stage_contexts:{lost:{fields:{close_reason:'가격 · 가격 경쟁',close_detail:'A건설 낙찰',reengage:'예',lesson:'장기수선 옥상 2027 반영',recontact_possibility:'2027-03-01'}}},activities:[]}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};/* 이 검사는 오른쪽 상자의 기능을 본다 — 상자를 가운데 칸 패널로 옮긴 새 배치(detail_right_fix)는 verify-detail-right-fix-browser.cjs 가 본다 */G.dealRightKeep=true;AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};window.__rpc=[];window.__units={};
   SB={rpc:async(n,a)=>{__rpc.push([n,JSON.parse(JSON.stringify(a&&a.p||a||{}))]);const p=a&&a.p||{};
    if(n==='crm_deal_unit_list_v1')return {data:{ok:true,contract:1,units:Object.values(__units),events:[]}};
    if(n==='crm_deal_unit_save_v1'){const u={deal_id:p.deal_id,roles:p.roles||[],brand_inflow:p.brand_inflow||null,brand_proposal:p.brand_proposal||null,brand_contract:p.brand_contract||null,updated_by_name:'송보람',updated_at:new Date().toISOString()};__units[p.deal_id]=u;return {data:{ok:true,contract:1,unit:u}};}
    /* 요청 저장소 흉내: 만든 요청을 기억하고, 읽을 때 지금 로그인한 사람 기준으로 to_me · by_me 를 붙인다(받는 쪽 카드 검사용) */
    window.__wr=window.__wr||[];const me=()=>String(ME&&ME.name||'');const view=r=>Object.assign({},r,{to_me:r.to_name===me(),by_me:r.requested_by===me()});
    if(n==='crm_work_request_list_v1')return {data:{ok:true,requests:__wr.map(view)}};
    if(n==='crm_work_request_create_v1'){const r=Object.assign({id:'wr-'+(__wr.length+1),status:'sent',created_at:new Date().toISOString(),requested_by:'송보람',round:1},p);__wr.push(r);return {data:{ok:true,request:view(r)}};}
    if(n==='crm_work_request_reply_v1'){const r=__wr.find(x=>x.id===p.id);if(!r)return {error:{message:'없음'}};if(p.action==='seen'){if(r.status==='sent')r.status='seen';}else if(p.action==='done'){r.status='done';r.result=p.result||'';r.closed_at=new Date().toISOString();r.auto=!!p.auto;}return {data:{ok:true,request:view(r)}};}
    if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};
    return {data:{ok:true,tasks:[],entries:[],sites:[],rows:[],events:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.__open=async(i)=>{await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));};
  });
  /* 단위 값(모델): 책임자 · 추정 브랜드 · 현장 공통 */
  const U=await page.evaluate(()=>{const u=DealUnits.unit(B.deals[0]),v=DealUnits.unit(B.deals[1]);return {r0:u.responsible,r1:v.responsible,b0:u.brand,sib0:u.site.siblings.length,acts0:u.site.acts,acts1:v.site.acts,contacts0:u.site.contacts,work0:u.work,work1:v.work};});
  assert.equal(U.r0,'박현우','책임자 = 다음 행동의 담당 1명');assert.equal(U.r1,'이필선');
  assert.deepEqual([U.b0.inflow,U.b0.proposal,U.b0.contract,U.b0.saved],['석민이앤씨','POUR공법','',false],'저장 전 = 지금 자료에서 추정(계약 브랜드는 수주 확정 전이라 미정)');
  assert.equal(U.sib0,1);assert.equal(U.acts0,3);assert.equal(U.acts1,3,'연락 이력은 현장 공통(같은 현장 영업건 전체)');assert.equal(U.contacts0,2);assert.deepEqual([U.work0,U.work1],['옥상방수','재도장']);
  /* 상세 상자 */
  await page.evaluate(()=>window.__open(0));await page.waitForSelector('#detailView .dvu');await page.waitForTimeout(600);
  const box=page.locator('#detailView .dvu');assert.equal(await box.count(),1);
  let t=one(await box.innerText());
  assert.match(t,/^관리 단위 · 영업건 #\w+ · 옥상방수 · 2025 · 계약단계/);
  assert.match(t,/책임자 박현우 다음 행동의 담당 1명/);
  assert.match(t,/참여 이필선 주담당 · 실적 귀속/);
  assert.match(t,/브랜드 유입 석민이앤씨 → 제안 POUR공법 → 계약 미정 추정 · 저장 전/);
  assert.match(t,/요청 없음/);
  assert.match(t,/현장 공통 연락 이력 3건 · 관계자 2명 · 같은 현장 영업건 2건 \(재도장 2026\)/);
  assert.match(t,/금액 4\.2억 요청 없음/);
  assert.match(t,/시공 인계 공사 범위 옥상방수 제외 사항 미기록 금액 4\.2억 일정 착공 2026-11-03 · 준공 예정 2026-12-15 고객 약속 하자 5년 · 공사 중 소음 안내문 수령 확인 요청 시공 담당이 수령 확인해야 영업 단계 종료/);
  assert.match(t,/이 건의 처리\(수주 · 연락 기록\)는 같은 현장 다른 영업건의 업무를 완료시키지 않습니다 참여 · 브랜드 수정/);
  /* 시공 담당 없이 수령 확인 요청 → 안내 */
  await box.locator('[data-dvu="receipt"]').click();await page.waitForTimeout(300);
  assert.match(one(await page.locator('#detailView .dvu').innerText()),/참여 역할에 시공 담당을 먼저 넣어 주세요/);
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_work_request_create_v1').length),0,'시공 담당 없으면 요청을 보내지 않음');
  /* 참여 · 브랜드 수정 → 저장 */
  await page.locator('#detailView .dvu [data-dvu="edit"]').click();await page.waitForTimeout(300);
  await page.locator('#detailView .dvu [data-dvu-in="who"]').selectOption({label:'박현우'}).catch(async()=>{await page.evaluate(()=>{const s=document.querySelector('#detailView .dvu [data-dvu-in="who"]');const o=document.createElement('option');o.value='박현우';o.textContent='박현우';s.append(o);s.value='박현우';s.dispatchEvent(new Event('change',{bubbles:true}));});});
  await page.locator('#detailView .dvu [data-dvu-in="role"]').selectOption('시공 담당');await page.locator('#detailView .dvu [data-dvu="radd"]').click();await page.waitForTimeout(250);
  await page.locator('#detailView .dvu [data-dvu-in="b-contract"]').selectOption('POUR공법');await page.waitForTimeout(100);
  assert.match(one(await page.locator('#detailView .dvu').innerText()),/박현우 시공 담당/);
  await page.locator('#detailView .dvu [data-dvu="save"]').click();await page.waitForTimeout(600);
  const saved=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_unit_save_v1').map(x=>x[1]));
  assert.equal(saved.length,1);assert.deepEqual(saved[0].roles,[{name:'박현우',role:'시공 담당'}]);assert.deepEqual([saved[0].brand_inflow,saved[0].brand_proposal,saved[0].brand_contract],['석민이앤씨','POUR공법','POUR공법']);
  t=one(await page.locator('#detailView .dvu').innerText());
  assert.match(t,/참여 이필선 주담당 · 실적 귀속 박현우 시공 담당/);assert.match(t,/브랜드 유입 석민이앤씨 → 제안 POUR공법 → 계약 POUR공법/);assert.doesNotMatch(t,/추정 · 저장 전/,'서버가 확인한 값 = 추정 표시 사라짐');
  /* 시공 담당이 있으면 수령 확인 요청 → 요청 엔진(kind support · 이름 '시공 인계 수령 확인') */
  await page.locator('#detailView .dvu [data-dvu="receipt"]').click();await page.waitForTimeout(500);
  const wr=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_work_request_create_v1').map(x=>x[1]));
  assert.equal(wr.length,1);assert.deepEqual([wr[0].kind,wr[0].label,wr[0].to_name,wr[0].target_type,wr[0].target_id],['support','시공 인계 수령 확인','박현우','deal','11111111-1111-4111-8111-111111111111']);
  assert.match(wr[0].memo,/공사 범위: 옥상방수[\s\S]*고객 약속: 하자 5년/);
  await page.waitForTimeout(400);t=one(await page.locator('#detailView .dvu').innerText());assert.match(t,/수령 확인 대기 · 박현우 · 기한 3일 안/,'보낸 뒤 상자는 수령 확인 대기');
  /* ③ 받는 쪽(시공 담당 박현우) 오늘 업무 맨 위: '시공 인계' 카드 = 인계 요약 5칸 + [수령 확인] → 요청 완료(결과 '수령 확인') → 보낸 쪽 상자 '수령 확인 완료' */
  await page.evaluate(()=>{closeDetail&&closeDetail();ME={id:'rep-park',name:'박현우',role:'rep'};WorkRequest.load(true);});await page.waitForTimeout(500);await page.evaluate(()=>goPage('today'));await page.waitForTimeout(900);
  const card=page.locator('#today-v2 .tv3 .wrq-top .wrq-in');assert.equal(await card.count(),1,'박현우에게 온 수령 확인 요청 한 장');
  const ct=one(await card.innerText());assert.match(ct,/^시공 인계 \[경기 고양\] 햇빛마을23단지/);assert.match(ct,/공사 범위\s*옥상방수[\s\S]*제외 사항\s*미기록[\s\S]*금액\s*4\.2억[\s\S]*일정\s*착공 2026-11-03 · 준공 예정 2026-12-15[\s\S]*고객 약속\s*하자 5년 · 공사 중 소음 안내문/);
  assert.match(ct,/수령 확인 전까지 영업 단계가 끝나지 않습니다\s*수령 확인$/);assert.equal(await card.locator('[data-wr="hoask"]').count(),0,'시공 인계에는 [이전 담당에게 질문] 없음');
  await card.locator('[data-wr="hodone"]').click();await page.waitForTimeout(500);
  const rp=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_work_request_reply_v1'&&x[1].action==='done').map(x=>x[1].result));assert.deepEqual(rp,['수령 확인']);
  assert.equal(await page.locator('#today-v2 .tv3 .wrq-top').count(),0,'수령 확인하면 카드가 사라진다');
  await page.evaluate(()=>{ME={id:'admin',name:'송보람',role:'admin'};WorkRequest.load(true);});await page.waitForTimeout(400);await page.evaluate(()=>window.__open(0));await page.waitForSelector('#detailView .dvu');await page.waitForTimeout(500);
  t=one(await page.locator('#detailView .dvu').innerText());assert.match(t,/수령 확인 완료 · \d+\.\d+ · 박현우/,'보낸 쪽 상자 = 수령 확인 완료');
  /* 같은 현장 다른 영업건(재도장) 상자는 따로: 책임자 · 금액 · 저장값 없음 */
  await page.evaluate(()=>{closeDetail&&closeDetail();});await page.waitForTimeout(200);await page.evaluate(()=>window.__open(1));await page.waitForSelector('#detailView .dvu');await page.waitForTimeout(500);
  t=one(await page.locator('#detailView .dvu').innerText());assert.match(t,/재도장 · 2026/);assert.match(t,/책임자 이필선/);assert.match(t,/금액 3\.1억/);assert.match(t,/추정 · 저장 전/);assert.match(t,/같은 현장 영업건 2건 \(옥상방수 2025\)/);assert.doesNotMatch(t,/시공 인계/);
  /* 실주 건 = 현장 관계 유지 줄 · 수정 버튼 없음 */
  await page.evaluate(()=>{closeDetail&&closeDetail();});await page.waitForTimeout(200);await page.evaluate(()=>window.__open(2));await page.waitForSelector('#detailView .dvu');await page.waitForTimeout(500);
  t=one(await page.locator('#detailView .dvu').innerText());assert.match(t,/현장 관계 유지 · 다음 확인 2027-03-01 근거: 장기수선 옥상 2027 반영 · 재영업 예 재접촉 업무는 근거 \+ 예정일이 있을 때만/);assert.equal(await page.locator('#detailView .dvu [data-dvu="edit"]').count(),0,'종료 건은 수정 버튼 없음');
  /* 글 잘림 없음 */
  const clip=await page.evaluate(()=>[...document.querySelectorAll('#detailView .dvu *')].filter(n=>getComputedStyle(n).overflow==='hidden'&&n.scrollWidth>n.clientWidth+1&&getComputedStyle(n).textOverflow!=='ellipsis').map(n=>n.className+': '+(n.textContent||'').slice(0,40)));
  assert.deepEqual(clip,[],'잘린 글 없음');
  /* 끄기 */
  await page.evaluate(()=>{G.dealUnitsOff=true;closeDetail&&closeDetail();});await page.waitForTimeout(200);await page.evaluate(()=>window.__open(0));await page.waitForSelector('#detailView.ddv.dv3');await page.waitForTimeout(500);
  assert.equal(await page.locator('#detailView .dvu').count(),0,'G.dealUnitsOff → 상자 없음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',unit_model:true,detail_box:true,estimate_mark:true,save_roles_brand:true,receipt_request:true,site_siblings_separate:true,lost_relation_kept:true,no_clip:true,off_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
