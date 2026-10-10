'use strict';
/* 상세 창 오른쪽 칸 바로잡기 (2026-10-10 design_handoff_detail_right_fix · 시안 '상세 창 · 오른쪽 정리 실제 화면') — 합성 자료(이름 · 금액 · 날짜는 지어낸 것)
   확인: 노트북(1366×768)에서 오른쪽 칸이 스크롤 없이 끝난다 · 7단계 + 과거 이관 모두 같은 구성(지금 처리 · 주 버튼 1개 · 다음 업무 · 일정 · AI 한 줄 · 확인할 정보 n)
         / 오른쪽에 예전 상자(빠진 정보 · 일정 · 막힌 곳 · 관리 단위 · 영업 판단 · 근처 현장 · 지침 · 추천 · 보조 단추)가 없다
         / [채우기] · 주 버튼 = 가운데 칸 패널(입력칸은 그대로 보임) · 패널 안에서 바로 입력 · [···] 메뉴로 나머지 상자 · 입력칸의 막힌 곳 표시
         / 왼쪽 기본 정보(주소 · 공종 · 공사 예정 · 유입 경로) · 왼쪽 AI 문장 없음 · 머리 예상금액 = 누르면 고침 / 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealFrame7&&window.DealSame&&window.DecisionCollab&&window.SiteHistory&&window.DealWin&&window.DealTransfer&&window.DealUnits&&window.PipelineStageB&&window.PipelineJudge&&window.DealPrep&&window.ListPager);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const id=n=>'1111111'+n+'-1111-4111-8111-111111111111';
   const act=(i,type,note,at,who)=>({id:i,type,note,at,actor:who||'이필선',meaningful:true});
   const mk=(n,site,brand,who,code,extra)=>Object.assign({id:id(n),site,assignee:who,brand,created:'2025-09-10',code,stage_code:code,amt:260000000,manager_name:'이재석',manager_mobile:'01052493880',contacts:[{person_key:'mobile:01052493880',name:'이재석',role:'관리소장',mobile:'01052493880',status:'current'}],
    activities:[act('a'+n+'1','방문','현장 방문 · 2개 층 바닥 들뜸 확인',day(-12)+'T15:00:00+09:00',who),act('a'+n+'2','전화','통화 연결 · 방문 일정 협의',day(-30)+'T10:20:00+09:00',who)]},extra||{});
   B={deals:[
    mk(1,'[서울 노원] 상계주공7단지','POUR솔루션','이필선','consulting',{next_action:{id:'n1',text:'견적 요청 등록',type:'후속접촉',due:day(-7),status:'open'}}),
    mk(2,'[경기 평택] 오뚜기 포승공장','POUR솔루션','이필선','sent',{amt:57400000,address:'경기 평택시 포승읍 포승공단',activities:[act('a21','이메일','견적서 발송 · 임석재 소장',day(-20)+'T11:00:00+09:00','이필선'),act('a22','방문','현장 방문 · 2개 층 바닥 들뜸 확인',day(-12)+'T15:00:00+09:00','이필선')]}),
    mk(3,'[서울 마포] 성산시영아파트','석민이앤씨','김성민','rapport',{amt:380000000,quote_versions:[{version_no:1,amount:410000000,created_at:day(-60)},{version_no:2,amount:380000000,created_at:day(-40)}],next_action:{id:'n3',text:'고객 약속: 입대의 결과 확인 연락',type:'전화',due:day(4),status:'open'}}),
    mk(4,'[경기 고양] 햇빛마을23단지','석민이앤씨','이필선','bidding',{amt:420000000,stage_contexts:{bidding:{fields:{bid_deadline:day(2)}}},next_action:{id:'n4',text:'제안서 팀장 공유 · 제출 준비',type:'후속접촉',due:day(1),status:'open'}}),
    mk(5,'[경기 평택] 평택비전지웰푸르지오','석민이앤씨','황윤선','contract',{amt:1120000000,stage_contexts:{contract:{fields:{contract_date:'2026-01-26',contract_amount:1043900000}}},next_action:{id:'n5',text:'계약 체결 확인',type:'전화',due:day(-3),status:'open'}}),
    mk(6,'[경기 용인] 수지삼성래미안','POUR공법','정정훈','won',{outcome:'won',won_amount:140000000,closed_at:'2026-03-12',contract_date:'2026-03-12',amt:140000000,stage_contexts:{won:{fields:{completion_date:day(-40)}}}}),
    mk(7,'[대구] 강북이진캐스빌','석민이앤씨','한준엽','lost',{outcome:'lost',closed_at:'2026-05-07',amt:350000000}),
    mk(8,'[부산] 과거 이관 단지','석민이앤씨','김성민','old_stage_x',{amt:380000000})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.__rpc=[];
   SB={rpc:async(n,a)=>{__rpc.push([n,a]);if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};
    if(n==='crm_deal_stage_fields_update_v1'){const p=a.p||{};return {data:{ok:true,deal_id:p.deal_id||p.opportunity_id,stage:p.stage,fields:p.fields||{},version:2,stage_context:{to:p.stage_code||'sent',fields:p.fields||{}}}};}
    return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[],links:[],rows:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.__open=async(i)=>{try{closeDetail();}catch(e){}await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));};
   window.__md=n=>{const t=new Date(Date.now()+n*864e5);return (t.getMonth()+1)+'.'+t.getDate();};
  });
  const V=page.locator('#detailView');
  const md=n=>page.evaluate(n=>window.__md(n),n);
  const open=async i=>{await page.evaluate(i=>window.__open(i),i);await page.waitForSelector('#detailView.dv7r .dvs-task .dv7-lb');await page.waitForTimeout(700);};
  const snap=()=>page.evaluate(()=>{const v=document.getElementById('detailView'),r=v.querySelector('.dw-right'),t=s=>{const n=v.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};
   return {fit:(()=>{const t=r.querySelector('.dvs-task').getBoundingClientRect(),b=r.getBoundingClientRect();return t.bottom<=b.bottom+1;})(),over:Math.round(r.querySelector('.dvs-task').getBoundingClientRect().bottom-r.getBoundingClientRect().bottom),vis:[...r.children].filter(n=>getComputedStyle(n).display!=='none'&&!n.classList.contains('dv3-near')).map(n=>n.className.split(' ')[0]),near:r.querySelectorAll(':scope>.dv3-near').length,
    parts:[...v.querySelectorAll('.dvs-task>*')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className.split(' ').pop()),
    lb:t('.dv7-lb'),task:t('.dvs-tt>b'),due:t('.dvs-tt>span'),kv:[...v.querySelectorAll('.dv7-kvs>span')].map(n=>n.textContent),btns:[...v.querySelectorAll('.dvs-task button')].filter(b=>b.offsetParent).map(b=>[b.textContent.trim(),b.classList.contains('fill')]),
    next:t('.dv7-next>div'),info:t('.dv7-info>div'),ai:t('.dv7-ai'),old:v.querySelectorAll('.dw-right .dv7-first,.dw-right .dv7-grps,.dw-right .dv7-sub,.dw-right .dvs-aux:not([style*="none"])').length,
    right:[...r.querySelectorAll('.da-stage-summary,.dcb,.dvu,.dp6')].length,drawerHidden:v.querySelector('.dv7-drawer').hidden,inDrawer:[...v.querySelectorAll('.dv7-pbody>*')].map(n=>n.className.split(' ').filter(c=>/^(dv7-fill|dv3-slot|dcb|dvu|dp6|dv3-near)$/.test(c))[0]||n.className),summ:v.querySelectorAll('.da-stage-summary').length,
    left:[...v.querySelectorAll('.dv3-left .dv7-h, .dv3-left header>b')].map(n=>n.textContent.trim()),leftAi:getComputedStyle(v.querySelector('.dv3-left .sth-ai')||v).display,plan:v.querySelectorAll('.dp6-plan').length};});
  /* ① 7단계 + 과거 이관: 같은 구성 · 노트북에서 스크롤 없이 끝 · 확인할 정보는 단계별 최대 3개 */
  const TASK=['견적 요청 등록','발송 내역 확인 · 고객 반응 기록','입대의 결과 확인 연락','제안서 팀장 공유 · 제출 준비','계약 체결 확인','준공 후 사후 연락','실주 기록 완성','영업 재개 판단'];
  const BTN=['견적 요청 등록','발송 내역 확인','연락하고 결과 기록','제출 준비 확인','계약서 확인하기','사후 연락하기','실주 기록 채우기','영업 재개'];
  const INFO=['도면 · 현장 사진 · 공사 시기','발송일 · 수신자 · 고객 반응 · 공사 시기','관리 상태 · 경쟁사','공법 비교표 · 경쟁 업체 수 · 제출 접수증','계약서 파일 · 착공일','실적 정보 · 추가 공종','실주 사유 · 재영업 가능 여부','단계 정하기 · 다음 행동 · 날짜 · 마지막 연락'];
  for(let i=0;i<8;i++){
   await open(i);const s=await snap(),closed=i===5||i===6;
   assert.equal(s.fit,true,(i+1)+'번: 오른쪽 칸이 스크롤 없이 끝난다(넘침 '+s.over+'px)');
   assert.deepEqual(s.vis,['dvs-task'],(i+1)+'번: 오른쪽에는 지금 처리 카드 하나만: '+s.vis);
   assert.deepEqual(s.parts,['dv7-lb','dvs-tt','dv7-kvs','dv7-btns','dv7-next','dv7-info'],(i+1)+'번: 지금 처리 · 주 버튼 · 다음 업무 · 확인할 정보 순서(AI 한 줄은 AI 결과가 있을 때만): '+s.parts);
   assert.equal(s.lb,'지금 처리');assert.equal(s.task,TASK[i]);
   assert.deepEqual([s.kv.length,s.kv[0],s.kv[2]],[4,'확인됨','완료 조건'],'확인됨 · 완료 조건만 회색 작은 글씨(확인할 것 줄은 지움): '+s.kv);
   assert.deepEqual(s.btns,closed?[[BTN[i],true],['채우기',false]]:[[BTN[i],true],[i===1||i===7?'등록하기':'변경',false],['채우기',false]],(i+1)+'번: 주 버튼 1개 · 보조 단추(연락하기 · 결과 기록 · 다음 업무) 없음: '+JSON.stringify(s.btns));
   assert.match(s.next,/^다음 업무 · 일정 /);assert.equal(s.info.replace(/^확인할 정보 \d+ /,''),INFO[i],(i+1)+'번: 확인할 정보 = 단계 표의 먼저 확인 3개 안: '+s.info);
   assert.ok(Number(s.info.match(/^확인할 정보 (\d+)/)[1])<=3,'확인할 정보는 단계별 최대 3개');assert.doesNotMatch(s.info,/담당 최종 검토|무엇을 발송했나요|결정권자 · /);
   assert.equal(s.old,0,'먼저 확인 · 요약 묶음 · 보조 단추 · 지침 줄은 오른쪽에 없다');assert.equal(s.right,0,'예전 상자는 오른쪽에 남지 않는다');assert.equal(s.plan,0,'지금 할 일 5줄도 확인할 정보로 합침');
   assert.equal(s.summ,0,'deal-same 의 이 단계 필수 정보 · 빠진 정보 블록은 상세 창 어디에도 그리지 않는다');
   assert.equal(s.drawerHidden,true);assert.deepEqual(s.inDrawer.filter(x=>x!=='dv3-slot'),['dv7-fill'],'가운데 패널 = 확인할 정보 · 발송 내역 화면 하나 — 근처 현장은 오른쪽에 그대로');assert.equal(s.near,1,'근처 현장은 오른쪽 지금 처리 아래에 그대로');assert.equal(await V.locator('.dw-right>.dv3-near').evaluate(n=>n.getBoundingClientRect().top>=document.querySelector('#detailView .dvs-task').getBoundingClientRect().bottom),true);
   assert.deepEqual(s.left.slice(0,4),['연락처 · 결정권자','기본 정보','지금 영업건','이 단지 지난 영업 0']);assert.equal(s.leftAi,'none','왼쪽 AI 문장은 오른쪽 한 줄로');
   assert.equal(s.ai,null,'AI 결과가 없으면 문장을 지어내지 않는다');
   assert.equal(await V.locator('.dvs-kv>span').nth(1).evaluate(n=>getComputedStyle(n).fontSize),'11.5px');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dvs-task *')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').length),0,'글 잘림 없음');
  }
  /* AI 한 줄 = 정말 한 줄: 첫마디 또는 다음 행동 제안 1문장(단지 이력 문장은 붙이지 않는다) */
  await open(1);
  await page.evaluate(()=>{OpsStore.aiOn=()=>true;DealKeyman.ai=()=>({next:{how:'전화',what:'임석재 소장에게 자료 수신 확인',days:0}});DealDetailV3.apply();});await page.waitForTimeout(400);
  let s=await snap();assert.equal(s.ai,'AI전화 · 임석재 소장에게 자료 수신 확인 · 오늘');assert.doesNotMatch(s.ai,/이 단지와는|첫 영업/);assert.equal(s.fit,true);
  await page.evaluate(()=>{OpsStore.aiOn=()=>false;delete DealKeyman.ai;DealDetailV3.apply();});
  /* ② 자료 발송완료: 값 */
  await open(1);s=await snap();
  assert.equal(s.due,'발송 후 7일 발송일 없음 · 판정 불가');assert.equal(s.next,'다음 업무 · 일정 등록 없음');
  assert.equal(s.info,'확인할 정보 3 발송일 · 수신자 · 고객 반응 · 공사 시기','자료 발송완료 = 발송일 · 수신자 / 고객 반응 / 공사 시기');
  /* 왼쪽 기본 정보: [입력] · [수정] = 누른 줄 아래에서 바로(관리정보 수정 패널을 열지 않는다) */
  assert.deepEqual(await V.locator('.dv7-basic .dv3-row').evaluateAll(l=>l.map(r=>[r.querySelector('span').textContent,r.querySelector('.dv3-val').textContent,getComputedStyle(r.querySelector('.dv3-val'),'::after').content])),[['주소','경기 평택시 포승읍 포승공단','"수정"'],['공종','미입력','"입력"'],['공사 예정','미입력','"입력"'],['유입 경로','미입력','"입력"']]);
  const mgmt=()=>page.evaluate(()=>[document.querySelectorAll('#ddvPanel,#detailAction,.dp-info').length,/관리정보 수정/.test(document.getElementById('detailView').innerText)]);
  const saved=()=>page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_stage_fields_update_v1').map(x=>x[1].p.fields));
  await V.locator('.dv7-basic .dv3-row',{hasText:'공사 예정'}).locator('.dv3-val').click();await page.waitForTimeout(300);
  assert.deepEqual(await V.locator('.dv7-be .chips button').allInnerTexts(),['올해','내년','그 이후','미정'],'공사 예정 = 칩 1개 선택');assert.deepEqual(await mgmt(),[0,false],'관리정보 수정 패널은 열리지 않는다');
  assert.equal(await V.locator('.dv7-basic .dv3-row',{hasText:'공사 예정'}).evaluate(n=>n.nextElementSibling.className),'dv7-be','누른 줄 바로 아래에 펼침');
  await V.locator('.dv7-be .chips button',{hasText:'내년'}).click();await page.waitForTimeout(200);await V.locator('.dv7-be [data-dv3="bsave"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await saved(),[{construction_plan:'내년'}]);
  await V.locator('.dv7-basic .dv3-row',{hasText:'유입 경로'}).locator('.dv3-val').click();await page.waitForTimeout(300);
  assert.deepEqual(await V.locator('.dv7-be .chips button').allInnerTexts(),['홈페이지','전화','소개','기존 고객']);
  await V.locator('.dv7-be .chips button',{hasText:'소개'}).click();await V.locator('.dv7-be [data-dv3="bsave"]').click();await page.waitForTimeout(500);
  assert.deepEqual((await saved()).slice(1),[{inflow_path:'소개'}]);
  await V.locator('.dv7-basic .dv3-row',{hasText:'주소'}).locator('.dv3-val').click();await page.waitForTimeout(300);
  assert.equal(await V.locator('.dv7-be input[data-dv3be="addr"]').inputValue(),'경기 평택시 포승읍 포승공단','주소 = 검색 입력칸 1개');
  await V.locator('.dv7-be input').fill('경기 평택시 포승읍 새길 1');await V.locator('.dv7-be input').press('Enter');await page.waitForTimeout(500);
  assert.deepEqual((await saved()).slice(2),[{site_address:'경기 평택시 포승읍 새길 1'}],'주소는 Enter · 저장으로');assert.deepEqual(await mgmt(),[0,false]);
  await V.locator('.dv7-basic .dv3-row',{hasText:'주소'}).locator('.dv3-val').click();await page.waitForTimeout(250);await V.locator('.dv7-be [data-dv3="bcancel"]').click();await page.waitForTimeout(250);assert.equal(await V.locator('.dv7-be').count(),0,'취소 = 접힘');
  assert.equal(await V.locator('.dv7-basic .dv3-row',{hasText:'공종'}).locator('.dv3-val').getAttribute('data-dv3'),'work','공종 = 기존 공종 분류 칩(그 줄 아래)');
  /* 머리 예상금액 = 누르면 고치는 자리(오른쪽 표에는 없다) */
  assert.equal(await V.locator('.dv7-line2 .dv7-amt').count(),1);assert.equal(await V.locator('.dv7-pbody .dv3-row').count(),0);
  /* ③ [채우기] = 가운데 칸: 확인할 정보 3줄만(줄마다 그 자리에서 입력 · 저장) */
  await V.locator('.dv7-info button').click();await page.waitForTimeout(400);
  const P=()=>page.evaluate(()=>{const v=document.getElementById('detailView'),d=v.querySelector('.dv7-drawer'),r=d.getBoundingClientRect(),c=v.querySelector('.idv-composer').getBoundingClientRect(),ce=v.querySelector('.dw-center').getBoundingClientRect();
   return {p:d.dataset.p,hidden:d.hidden,head:d.querySelector('.dv7-phead .t')?d.querySelector('.dv7-phead .t').innerText.replace(/\s+/g,' ').trim():'',shown:[...d.querySelectorAll('.dv7-pbody>*')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className.split(' ').filter(c=>/^(dv7-fill|dv3-slot|dcb|dvu|dp6|dv3-near)$/.test(c))[0]),aboveComposer:Math.abs(r.bottom-c.top)<=2,inCenter:Math.abs(r.left-ce.left)<=1&&Math.abs(r.right-ce.right)<=1,composer:c.height>40,text:d.innerText.replace(/\s+/g,' ').trim()};});
  let p=await P();assert.deepEqual([p.p,p.hidden,p.head],['info',false,'‹ 확인할 정보 이 단계에 필요한 것만 · 줄마다 바로 입력']);assert.deepEqual(p.shown.filter(x=>x!=='dv3-slot'),['dv7-fill'],'확인할 정보 패널 = 3줄 화면 하나');
  assert.deepEqual([p.aboveComposer,p.inCenter,p.composer],[true,true,true],'가운데 칸 안 · 응대 기록 입력칸 바로 위까지');
  assert.deepEqual(await V.locator('.dv7-fill .dv7-fr .h b').allInnerTexts(),['발송일 · 수신자','고객 반응','공사 시기'],'오른쪽과 같은 3개');
  assert.doesNotMatch(p.text,/빠진 정보|담당 최종 검토|무엇을 발송했나요|견적 Version|입력됨|완료$|공사 예정/,'옛 빠진 정보 목록 · 공사 예정 중복 · 담당 최종 검토 · [완료] 없음: '+p.text);
  /* 공사 시기 줄은 왼쪽 기본 정보로 안내(가운데에 다시 안 나옴) */
  await V.locator('.dv7-fr',{hasText:'공사 시기'}).locator('[data-dv3="be"]').click();await page.waitForTimeout(300);assert.equal(await V.locator('.dv7-basic .dv7-be').count(),1,'공사 시기 = 왼쪽 기본 정보에서만 입력');
  await V.locator('.dv7-be [data-dv3="bcancel"]').click();await page.waitForTimeout(250);
  /* 줄에서 바로 입력 → 기존 저장 길 */
  const before=(await saved()).length;
  await V.locator('.dv7-fill input[data-dv3f="sent_date"]').fill('2026-10-01');await V.locator('.dv7-fill input[data-dv3f="recipient"]').fill('임석재 소장');await V.locator('.dv7-fill [data-dv3="fsave"]').click();await page.waitForTimeout(600);
  assert.deepEqual((await saved()).slice(before),[{sent_date:'2026-10-01',recipient:'임석재 소장'}],'발송일 · 수신자 = 한 줄에서 같은 저장 함수로');
  p=await P();assert.equal(p.p,'info','저장 뒤에도 패널은 열린 채');
  /* 고객 반응 = 응대 기록 입력칸으로 */
  await V.locator('.dv7-fr',{hasText:'고객 반응'}).locator('[data-dv3="fgo"]').click();await page.waitForTimeout(400);p=await P();assert.equal(p.hidden,true);assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.tagName),'TEXTAREA','고객 반응 = 가운데 응대 기록 입력칸');
  /* ④ [발송 내역 확인] = 발송 내역 화면(기존 기록 찾기 → 발송일 · 수신자 · 보낸 자료 · 견적 버전 · 확인 불가) */
  await V.locator('.dvs-primary').click();await page.waitForTimeout(500);p=await P();
  assert.deepEqual([p.p,p.hidden,p.head],['send',false,'‹ 발송 내역 기존 기록에서 찾거나 직접 등록 · 확인할 수 없으면 [확인 불가]']);assert.deepEqual(p.shown.filter(x=>x!=='dv3-slot'),['dv7-fill']);
  assert.match(p.text,/① 기존 기록에서 찾기 \d+\.\d+ · 이메일 .*견적서 발송 · 임석재 소장 이걸로 등록 ② 직접 등록 발송일 · 수신자 보낸 자료 견적서 제안서 공법자료 기타자료 견적 버전 등록된 견적 없음 견적 버전 등록 › 확인 불가 저장/,p.text);
  assert.doesNotMatch(p.text,/무엇을 발송했나요|담당 최종 검토/,'질문 문구 대신 [보낸 자료]');
  await V.locator('.dv7-cand button').click();await page.waitForTimeout(300);assert.match(await V.locator('.dv7-send input[data-dv3f="sent_date"]').inputValue(),/^\d{4}-\d{2}-\d{2}$/,'[이걸로 등록] = 발송일 채움');
  await V.locator('.dv7-send [data-dv3="sendmat"]',{hasText:'견적서'}).click();await V.locator('.dv7-send [data-dv3="sendmat"]',{hasText:'제안서'}).click();await page.waitForTimeout(250);
  assert.deepEqual(await V.locator('.dv7-send [data-dv3="sendmat"]').evaluateAll(l=>l.map(b=>b.getAttribute('aria-pressed'))),['true','true','false','false']);
  await V.locator('.dv7-send input[data-dv3f="recipient"]').fill('임석재 소장');
  const b4=(await saved()).length;await V.locator('.dv7-send [data-dv3="fsave"]').click();await page.waitForTimeout(600);
  assert.deepEqual((await saved()).slice(b4).map(f=>[Object.keys(f).sort().join(','),f.materials,f.recipient]),[['materials,recipient,sent_date',['견적서','제안서'],'임석재 소장']],'발송 내역 저장 = 발송일 · 수신자 · 보낸 자료');
  await V.locator('.dv7-send [data-dv3="sendnone"]').click();await page.waitForTimeout(500);assert.deepEqual((await saved()).slice(-1),[{sent_date_check:'확인 불가'}],'[확인 불가] = 발송일 확인 불가로 기록');
  await V.locator('.dv7-phead [data-dv3="p7close"]').click();await page.waitForTimeout(300);p=await P();assert.equal(p.hidden,true);assert.equal(await V.locator('.idv-thread').isVisible(),true);
  /* ⑤ [···] 메뉴: 결정 일정 · 특이조건 · 하자 / 참여 · 브랜드 / 영업 판단 · 내부 지원 / 담당 · 실적 귀속은 없앴다(대표 "필요없을거같아") · 소장이 바뀌었어요는 소장 칸으로 */
  await V.locator('.tf-more').click();await page.waitForTimeout(200);
  const menu=await V.locator('.tf-menu [role=menuitem]').allInnerTexts();
  assert.deepEqual(menu.filter(x=>/결정 일정|참여 · 브랜드|영업 판단|내부 지원|담당 · 실적 귀속|근처 현장|소장이 바뀌었어요/.test(x)),[],'빼기로 한 메뉴는 없다: '+menu);
  assert.ok(menu.includes('담당자 변경')&&menu.includes('보류')&&menu.includes('실주 처리'),'나머지 메뉴는 그대로: '+menu);
  await V.locator('.tf-more').click();await page.waitForTimeout(150);
  assert.equal(await V.locator('.dv7-drawer .dcb,.dv7-drawer .dvu,.dv7-drawer .dp6').count(),0,'협업 · 관리 단위 · 영업 판단 상자는 상세 창에 그리지 않는다');
  assert.equal(await V.locator('#ddvComposer .dv7-blk').count(),0,'입력칸의 막힌 곳 · 진척 표시 단추도 없다');assert.equal(await page.evaluate(()=>document.querySelectorAll('#detailView .dp6-plan').length),0);
  /* 소장이 바뀌었어요 = 소장 칸(연락처 줄 아래) */
  assert.equal(one(await V.locator('.dv3-left .dv3-mgr .dvt-c4 button').innerText()),'소장이 바뀌었어요');
  assert.equal(await V.locator('.dv3-left .dv3-mgr .dvt-c2').evaluate(n=>n.parentElement.querySelector('.dvt-c4')!==null&&n.compareDocumentPosition(n.parentElement.querySelector('.dvt-c4'))&4?true:false),true,'전화 · 문자 줄 아래');
  await V.locator('.dvt-c4 button').click();await page.waitForTimeout(300);assert.ok(await V.locator('.dv3-left .dv3-mgr [data-dv3repl], .dv3-left .dv3-mgr .dv3-repl').count()>=1,'소장 바뀜 입력이 소장 칸에서 열린다');
  await page.evaluate(()=>{const d=CUR_DETAIL.item;DealDetailV3.apply();});
  /* ⑥ 경쟁 · 입찰: 비교표 · 경쟁 업체 수 · 접수증 3줄(진행 조건 · 입찰 준비는 [···] 메뉴) */
  await open(3);s=await snap();assert.equal(s.info,'확인할 정보 3 공법 비교표 · 경쟁 업체 수 · 제출 접수증');
  await V.locator('.dv7-info button').click();await page.waitForTimeout(400);
  assert.deepEqual(await V.locator('.dv7-fill .dv7-fr .h b').allInnerTexts(),['공법 비교표','경쟁 업체 수','제출 접수증']);
  assert.equal(await V.locator('.dv7-fr',{hasText:'경쟁 업체 수'}).locator('input[data-dv3f="competitor"]').count(),1);
  assert.equal(await V.locator('.dv7-fr',{hasText:'공법 비교표'}).locator('[data-dv3="files"]').count(),1,'공법 비교표 = 자료 열기');
  /* 계약 · 시공 · 실주 */
  await open(4);await V.locator('.dv7-info button').click();await page.waitForTimeout(400);assert.deepEqual(await V.locator('.dv7-fill .dv7-fr .h b').allInnerTexts(),['계약서 파일','착공일']);
  await open(6);await V.locator('.dv7-info button').click();await page.waitForTimeout(400);assert.deepEqual(await V.locator('.dv7-fill .dv7-fr .h b').allInnerTexts(),['실주 사유','재영업 가능 여부']);assert.equal(await V.locator('.dv7-fill select[data-dv3f="reengage"]').count(),1);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'detail-right-fix.png')});
  /* ⑦ 끄기: 예전처럼 오른쪽에 쌓인다 */
  await page.evaluate(()=>{closeDetail();G.dealRightKeep=true;drwDeal(JSON.stringify(B.deals[1]));});await page.waitForSelector('#detailView.dv7 .dvs-task .dv7-lb');await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView'),r=v.querySelector('.dw-right');return [v.classList.contains('dv7r'),v.querySelectorAll('.dv7-drawer').length,r.querySelectorAll(':scope>.da-stage-summary,:scope>.dcb,:scope>.dvu,:scope>.dp6').length,v.querySelectorAll('.dv7-basic').length,v.querySelectorAll('.dv7-first').length];}),[false,0,4,0,1]);

  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('detail right fix ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
