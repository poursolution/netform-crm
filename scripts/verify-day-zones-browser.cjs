'use strict';
/* 오늘 업무 4구역(2026-10-10 design_handoff_day_zones · 시안 '하루 업무 구역 · 마감 요약' · '기록 부족 vs 영업 정체') — 합성 자료(현장 · 이름은 지어낸 것)
   확인: 영업사원 화면 = 지금 처리 · 회신 대기 · 정보 보완 · 약속 누락 탭(큰 숫자 = 4구역 합계) / 줄 = 현장 · 단계 · 요청 꼬리표 / 할 일 / 먼저 하는 이유(행동 문구) + 근거 / 버튼 1개
         / 이유를 누르면 근거 보기(적용 규칙 · 기준일 · 관련 기록 · 빠진 것) / 회신 대기 = 대기 사유 + 확인일(지연 아님) / 약속 누락 = [업무로 만들기] · [이미 함](근거 한 줄 + 완료 · 미완료 · 확인 불가)
         / 관리자 요청 = 기존 줄의 꼬리표 + '알림 n건' 한 줄(카드 아님) · 같은 업무가 없을 때만 요청 줄 / 필터로 숨은 내 요청 안내 / 화면에 보였다고 담당 확인(seen)을 보내지 않음 / 글 잘림 없음 / 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1400},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayV3&&window.DayZones&&window.WorkRequest&&window.InquiryMemo&&window.DealDetailV3&&window.OpsStore);
  await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-30),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1)},extra||{});
   B={deals:[
    /* 지금 처리: 견적 발송 9일 · 후속 없음(진행 판단 필요) */
    deal('silent1','[서울 송파] 서울체육고등학교',{amt:1.1e8,code:'sent',stage_code:'sent',last_activity_at:at(9),/* 접촉 기록이 있는 건 = 활동은 확인됨 → '진행 판단 필요'(기록 없는 건의 '활동 여부 확인'은 verify-day-extra-browser.cjs) */activities:[{id:'s1',type:'전화',note:'통화 완료 · 견적 설명',at:at(9),occurred_at:at(9),actor:'이필선',meaningful:true}],stage_contexts:{sent:{fields:{sent_date:day(-9)}}},next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-2),status:'open'}}),
    /* 지금 처리: 오늘 약속(현장 실측) */
    deal('today1','[경기 화성] 동탄푸른마을',{amt:2.6e8,next_action:{id:'n7',type:'방문',text:'현장 실측',due:day(0)+'T14:00',status:'open'}}),
    /* 회신 대기: 대기 사유 + 다음 확인일(미래) — 지연으로 세지 않는다 */
    deal('wait1','[서울 마포] 성산시영아파트',{amt:1.5e8,code:'waiting',stage_code:'waiting',brand:'석민이앤씨',waiting_reason:'입대의 결과 회신 대기',expected_resume_at:day(4),last_activity_at:at(6),activities:[1,2,3].map(n=>({id:'w'+n,type:'전화',note:'통화 시도 · 회신대기',result:'회신대기',at:at(n*7),occurred_at:at(n*7),actor:'이필선'}))}),
    /* 정보 보완: 경쟁 · 입찰인데 결정 일정이 없다(기록만 · 지연 아님) */
    deal('bid0','[경기 고양] 햇빛마을23단지',{amt:4.2e8,code:'compete',stage_code:'compete',brand:'석민이앤씨',next_action:{id:'n1',type:'전화',text:'입찰 서류 확인',due:day(2),status:'open'}}),
    /* 약속 누락: 응대 기록에 고객 약속이 있는데 그 뒤 다음 행동이 없다 */
    deal('gap1','[경기 수원] 평동동남아파트',{amt:1.2e8,code:'rapport',stage_code:'rapport',last_activity_at:at(3),activities:[{id:'g1',type:'전화',note:'통화 연결 · 관리소장 · 현장 사진을 이메일로 받기로 함 · 다음 주 화요일 현장 방문하기로 함',at:at(3),occurred_at:at(3),actor:'이필선',meaningful:true}]}),
    /* 요청만 있는 건: 관제탑 항목이 아닌데 관리자 요청이 와 있다 → 지금 처리에 요청 줄 */
    deal('far1','[충남 천안] 천안두정E편한세상2차',{amt:9e7,code:'rapport',stage_code:'rapport',next_action:{id:'n9',type:'전화',text:'공사 시기 확인',due:day(12),status:'open'},last_activity_at:at(2)})],
    inquiries:[{id:'aaaaaaaa-1111-4111-8111-111111111111',site:'[경기 수원] 수원장안힐스테이트',status:'배정완료',at:at(0.02),created_at:at(0.02),brand:'POUR솔루션',phone:'010-1234-5612',contact_name:'고객1',assignee:'이필선',assigned_to:'이필선',assigned_at:new Date(Date.now()-20*6e4).toISOString(),memo:'옥상 방수 견적 문의',raw:{'문의내용':'견적 문의'}}],activities:[],inquiryTrash:[],expansion_pool:[]};
   try{localStorage.removeItem('crm.dz.assignSeen.v1');}catch(e){}
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.todayV3Off=false;G.dayZones=null;G.workReq=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};
   /* 요청 저장소 흉내: 내게 온 열린 요청 2건(기존 줄에 꼬리표 · 요청만 있는 건) · 상태 변경 기록 */
   window.__rpc=[];const mk=(id,target,label,kind,memo)=>({id,target_type:'deal',target_id:target,site:'',brand:'POUR솔루션',kind,label,to_scope:'user',to_name:'이필선',requested_by:'송보람',asks:[label],status:'sent',round:1,created_at:new Date().toISOString(),due_at:new Date(Date.now()+7*36e5).toISOString(),due_label:'오늘 17:00',memo:memo||'',to_me:true,by_me:false});
   window.__wr=[mk('r1','silent1','후속 연락 요청','follow','수신 확인 후 반응을 남겨 주세요'),mk('r2','far1','후속 연락 요청','follow','공사 시기 확인 결과를 남겨 주세요')];
   SB={rpc:async(n,a)=>{__rpc.push([n,JSON.parse(JSON.stringify(a&&a.p||a||{}))]);const p=a&&a.p||{};
    if(n==='crm_work_request_list_v1')return {data:{ok:true,requests:__wr}};
    if(n==='crm_work_request_reply_v1'){const r=__wr.find(x=>x.id===p.id);if(r){if(p.action==='seen'&&r.status==='sent')r.status='seen';if(p.action==='done'){r.status='done';r.closed_at=new Date().toISOString();}}return {data:{ok:true,request:r}};}
    if(n==='crm_deal_unit_list_v1')return {data:{ok:true,contract:1,units:[],events:[]}};
    if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};
    return {data:{ok:true,tasks:[],entries:[],sites:[],rows:[],events:[],comments:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.__memo=[];window.__next=[];DealDetailV3.memo=async(d,note)=>{__memo.push([d.id,note]);};DealDetailV3.next=async(d,o)=>{__next.push([d.id,o.text,o.due]);};
   goPage('today');
  });
  await page.waitForSelector('#today-v2 .tv3 .dz');await page.waitForTimeout(900);
  const V=page.locator('#today-v2 .tv3');
  /* 0. §2 팝업은 새 배정에만: 현장 · 첫 연락 기한(배정 후 2시간) · [응대 시작] [확인 · 나중에 처리] — 확인하면 이 PC 에 기억되어 다시 안 뜬다 */
  const pop=page.locator('#today-v2 .dz-pop');assert.equal(await pop.count(),1,'새 배정 팝업');
  const pt=one(await pop.innerText());assert.match(pt,/^새 배정 1건 첫 연락은 배정 후 2시간 안 · 팝업은 새 배정 · 긴급 기한 변경 · 중요 요청에만 \[경기 수원\] 수원장안힐스테이트 POUR솔루션 · 옥상 방수 견적 문의 첫 연락 기한 \d+\.\d+ \d{2}:\d{2} · 1\d\d분 남음 \(배정 후 2시간\) 응대 시작 확인 · 나중에 처리$/,pt);
  await pop.locator('[data-dz="popok"]').click();await page.waitForTimeout(400);assert.equal(await page.locator('#today-v2 .dz-pop').count(),0,'확인 · 나중에 처리 → 팝업 닫힘(상태 변경 없음)');assert.equal(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('crm.dz.assignSeen.v1')||'{}')).length),1);
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_work_request_reply_v1').length),0,'팝업 확인은 요청 상태를 바꾸지 않는다');
  /* 1. 탭 4개 · 큰 숫자 = 구역 합계 */
  const tabs=await V.locator('.dz-tabs button').evaluateAll(l=>l.map(b=>[b.querySelector('span').textContent.replace(/\s+/g,' ').trim(),b.querySelector('small').textContent]));
  assert.deepEqual(tabs.map(t=>t[0].replace(/ \d+$/,'')),['지금 처리','회신 대기','정보 보완','약속 누락']);
  const n=tabs.map(t=>Number(t[0].match(/(\d+)$/)[1]));assert.equal(n[1],1,'회신 대기 1건(성산시영 · 대기 사유 + 확인일)');assert.equal(n[2],1,'정보 보완 1건(햇빛마을 · 결정 일정 없음)');assert.ok(n[3]>=1,'약속 누락 1건 이상(평동동남 · 사진 · 방문 약속)');assert.ok(n[0]>=3,'지금 처리: 서울체육고 · 동탄 · 천안 요청 줄');
  const hero=Number(await V.locator('.tv3-hero .n b').evaluate(b=>b.textContent.match(/^(\d+)건/)[1]));assert.equal(hero,n[0]+n[1]+n[2]+n[3],'큰 숫자 = 4구역 합계');
  assert.match(await V.locator('.tv3-hero .leg').innerText(),/지금 처리 \d+\s*회신 대기 1\s*정보 보완 1\s*약속 누락 \d+/);
  /* 2. 지금 처리 줄: 현장 · 단계 · 요청 꼬리표 / 할 일 / 먼저 하는 이유(행동 문구) + 근거 / 버튼 1개 */
  const rows=await V.locator('.dz-table .dz-row').evaluateAll(l=>l.map(r=>({site:r.querySelector('.c1>b').textContent,stage:r.querySelector('.c1>div>span').textContent,tags:[...r.querySelectorAll('.dz-req')].map(t=>t.textContent),task:r.querySelector('.c2').textContent.trim(),why:r.querySelector('.dz-why').textContent,sub:r.querySelector('.c3 small').textContent,btn:(r.querySelector(':scope>button')||{}).textContent||''})));
  const sg=rows.find(r=>/서울체육고/.test(r.site));assert.ok(sg,'서울체육고 줄');assert.equal(sg.why,'진행 판단 필요','진단 문구 = 할 행동(정체 기준 초과 → 진행 판단 필요)');assert.match(sg.sub,/견적 발송 후 7일 · 후속 연락 없음 · \d+일/);assert.deepEqual(sg.tags,['송보람 요청 · 오늘 17:00'],'관리자 요청 = 기존 줄의 꼬리표');assert.equal(sg.task,'견적 검토 확인');assert.equal(sg.btn,'전화');
  const dt=rows.find(r=>/동탄/.test(r.site));assert.ok(dt);assert.equal(dt.why,'오늘 약속 · 연락');
  const far=rows.find(r=>/천안두정/.test(r.site));assert.ok(far,'같은 업무가 없는 요청은 요청 줄 하나');assert.equal(far.why,'관리자 요청');assert.equal(far.task,'후속 연락 요청');assert.equal(far.btn,'열어서 처리');
  assert.equal(await V.locator('.dz-table .dz-row').evaluateAll(l=>l.every(r=>r.querySelectorAll(':scope>button,:scope>.dz-btns button').length===1)),true,'줄마다 버튼 1개');
  /* 3. 요청은 카드가 아니라 '알림 n건' 한 줄 · 화면에 보였다고 담당 확인(seen)을 보내지 않는다 */
  assert.equal(await V.locator('.wrq-top .wrq-in:not(.wrq-soft)').count(),0,'중요하지 않은 요청은 카드가 아님');
  assert.match(one(await V.locator('.wrq-top .wrq-soft .hd').innerText()),/^알림 후속 연락 요청 2건 기존 업무 줄에 '송보람 요청' 꼬리표로 붙어 있습니다 보기$/);
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_work_request_reply_v1'&&x[1].action==='seen').length),0,'노출 ≠ 확인');
  await V.locator('.wrq-top [data-wr="softtoggle"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#today-v2 .tv3 .wrq-top .wrq-soft .wrq-in').count(),2,'[보기]를 누르면 카드가 펼쳐진다');
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_work_request_reply_v1'&&x[1].action==='seen').length),0,'펼쳐 봐도 아직 확인 아님');
  await page.locator('#today-v2 .tv3 .wrq-soft .wrq-in').first().locator('.res button').first().click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_work_request_reply_v1'&&x[1].action==='seen').length),1,'카드에서 무엇이든 누르면 그때 담당 확인');
  await page.locator('#today-v2 .tv3 .wrq-top [data-wr="softtoggle"]').click();await page.waitForTimeout(300);
  /* 4. 근거 보기: 이유를 누르면 적용 규칙(기준 버전) · 기준일 · 관련 기록(고객 접촉 / 내부 메모) · 빠진 것 */
  await page.locator('#today-v2 .tv3 .dz-row',{hasText:'서울체육고'}).locator('.dz-why').click();await page.waitForTimeout(300);
  const ev=one(await page.locator('#today-v2 .tv3 .dz-ev').innerText());
  assert.match(ev,/^진행 판단 필요 · 왜\? 적용 규칙 견적 발송 후 7일 안 후속\(실제 발송일부터\) \(기준 v\d+ · [^)]+\) 기준일 .+ 관련 기록 \d+\.\d+ 고객 접촉 · 고객 접촉 1회 빠진 것 대기 사유 진전 결정권자 확인 요청 자료 확보 방문 확정 경쟁사 파악 결정 일정 다음 단계 조건 0 \/ 5 누르면 견적 발송 후 후속/,ev);/* day_zones 4-3 진전 확인: 근거 보기 안에 다음 단계 조건 5가지 */
  /* 5. 회신 대기 탭: 기다리는 것 · 다음 확인일 · 지연 아님 · [확인일 변경] */
  await page.locator('#today-v2 .tv3 .dz-tabs [data-v="wait"]').click();await page.waitForTimeout(300);
  const w=one(await page.locator('#today-v2 .tv3 .dz-table').innerText());
  assert.match(w,/현장 기다리는 것 먼저 하는 이유 · 다음 확인일/);/* §4 같은 이유 3번째 대기 → 재알림 대신 [결정권자에게 연락] [관리자 판단 요청] [보류로 전환] */
  assert.match(w,/성산시영아파트[\s\S]*입대의 결과 회신 대기 같은 이유 3번째 대기 확인 \d+\.\d+ · 재알림 대신 다음 셋 중 하나 결정권자에게 연락 관리자 판단 요청 보류로 전환/);assert.match(w,/대기 중은 지연으로 안 셈 · 확인일에 지금 처리로 올라옴/);
  await page.locator('#today-v2 .tv3 .dz-w3 [data-dz="open"]').click();await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>__open.at(-1)),['deal:wait1','contact'],'[결정권자에게 연락] = 상세의 연락');
  await page.locator('#today-v2 .tv3 .dz-w3 [data-dz="judge"]').click();await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>__memo.map(m=>[m[0],m[1]])),[['wait1','[지원 요청] 같은 이유로 3번째 회신 대기 · 관리자 판단 요청 — 입대의 결과 회신 대기']],'관리자 판단 요청 = 지원 요청 메모(관리자 오늘 업무의 결정 요청으로)');await page.evaluate(()=>{__memo.length=0;});
  /* 6. 정보 보완 탭 */
  await page.locator('#today-v2 .tv3 .dz-tabs [data-v="info"]').click();await page.waitForTimeout(300);
  const inf=one(await page.locator('#today-v2 .tv3 .dz-table').innerText());assert.match(inf,/햇빛마을23단지[\s\S]*정보 보완 필요 CRM 필수정보 미입력/);assert.match(inf,/평가 · 지연에 안 셈/);
  /* 7. 약속 누락: 약속 원문 · 업무 없음 · [업무로 만들기] [이미 함] */
  await page.locator('#today-v2 .tv3 .dz-tabs [data-v="gaps"]').click();await page.waitForTimeout(300);
  const gaps=await page.locator('#today-v2 .tv3 .dz-gap').evaluateAll(l=>l.map(r=>({site:r.querySelector('.c1>b').textContent,who:r.querySelector('.c1>div>span').textContent,q:r.querySelector('.c2 mark').textContent,why:r.querySelector('.dz-gapwhy').textContent,sub:r.querySelector('.c3 small').textContent,btns:[...r.querySelectorAll('.dz-btns button')].map(b=>b.textContent)})));
  assert.ok(gaps.length>=1);assert.match(gaps[0].site,/평동동남/);assert.match(gaps[0].who,/^이필선 · \d+\.\d+ 응대 완료$/);assert.match(gaps[0].q,/사진|방문/);assert.equal(gaps[0].why,'업무 없음');assert.match(gaps[0].sub,/응대 완료 ≠ 약속 완료/);assert.deepEqual(gaps[0].btns,['업무로 만들기','이미 함']);
  /* [이미 함] = 근거 한 줄 필수 → 완료 / 미완료 / 확인 불가 → 내부 메모 '[약속 확인] …' */
  await page.locator('#today-v2 .tv3 .dz-gap').first().locator('[data-dz="did"]').click();await page.waitForTimeout(200);
  await page.locator('#today-v2 .tv3 .dz-ask [data-dz="didsave"][data-v="완료"]').click();await page.waitForTimeout(200);assert.match(await page.locator('#today-v2 .tv3 .dz-ask em').innerText(),/근거 한 줄을 적어 주세요/);
  await page.locator('#today-v2 .tv3 .dz-ask input').fill('10.7 사진 받아 견적 발송함');await page.locator('#today-v2 .tv3 .dz-ask [data-dz="didsave"][data-v="완료"]').click();await page.waitForTimeout(400);
  const memo=await page.evaluate(()=>__memo);assert.equal(memo.length,1);assert.equal(memo[0][0],'gap1');assert.match(memo[0][1],/^\[약속 확인\] 완료 · ".+" — 10\.7 사진 받아 견적 발송함$/);
  const left=await page.locator('#today-v2 .tv3 .dz-gap').count();
  if(left){await page.locator('#today-v2 .tv3 .dz-gap').first().locator('[data-dz="mk"]').click();await page.waitForTimeout(400);const nx=await page.evaluate(()=>__next);assert.equal(nx.length,1);assert.equal(nx[0][0],'gap1');assert.match(nx[0][1],/^고객 약속: /);assert.match(nx[0][2],/^\d{4}-\d{2}-\d{2}$/,'기한 = 약속 날짜 · 없으면 3일 후');}
  /* 8. 필터로 숨은 내 요청 안내 → [보기] = 필터 해제 */
  await page.evaluate(()=>{SalesFilterState.selectBrand('석민이앤씨');paint();});await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const Z=DayZones.last();return [].concat(Z.now,Z.wait,Z.info).map(i=>i.key).sort();}),['deal:bid0','deal:wait1'],'브랜드 필터는 구역 항목에도 똑같이(석민이앤씨 2건만)');
  assert.match(one(await page.locator('#today-v2 .tv3 .dz-hidden').innerText()),/^필터 때문에 숨은 내 요청 2건 \(석민이앤씨 필터 중\) 보기$/);
  await page.locator('#today-v2 .tv3 .dz-hidden button').click();await page.waitForTimeout(500);
  assert.equal(await page.locator('#today-v2 .tv3 .dz-hidden').count(),0);assert.deepEqual(await page.evaluate(()=>[G.brand,SalesFilterState.state().brands]),['전체',[]]);
  /* 9. 글 잘림 없음 */
  await page.locator('#today-v2 .tv3 .dz-tabs [data-v="now"]').click();await page.waitForTimeout(300);
  const clip=await page.evaluate(()=>[...document.querySelectorAll('#today-v2 .dz *')].filter(n=>getComputedStyle(n).overflow==='hidden'&&n.scrollWidth>n.clientWidth+1&&getComputedStyle(n).textOverflow!=='ellipsis'&&!/webkit-box/.test(getComputedStyle(n).display)).map(n=>n.className+': '+(n.textContent||'').slice(0,40)));
  assert.deepEqual(clip,[],'잘린 글 없음');
  /* 10. 끄기 → 예전 묶음 */
  await page.evaluate(()=>{G.dayZonesOff=true;paint();});await page.waitForTimeout(400);
  assert.equal(await page.locator('#today-v2 .tv3 .dz').count(),0);assert.ok((await page.locator('#today-v2 .tv3 .tv3-group').count())>=1,'끄면 예전 묶음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',four_zones:true,hero_equals_zones:true,row_reason_action:true,request_tag_not_card:true,seen_only_on_action:true,evidence_popover:true,waiting_tab:true,info_tab:true,promise_gap_actions:true,hidden_requests:true,no_clip:true,off_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
