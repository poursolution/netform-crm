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
    mk(2,'[경기 평택] 오뚜기 포승공장','POUR솔루션','이필선','sent',{amt:57400000,address:'경기 평택시 포승읍 포승공단'}),
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
    if(n==='crm_deal_stage_fields_update_v1'){const p=a.p||{};return {data:{ok:true,deal_id:p.deal_id||p.opportunity_id,stage:p.stage,fields:p.fields||{},version:2,stage_contexts:{[p.stage||'sent']:{fields:p.fields||{}}}}};}
    return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[],links:[],rows:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.__open=async(i)=>{try{closeDetail();}catch(e){}await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));};
   window.__md=n=>{const t=new Date(Date.now()+n*864e5);return (t.getMonth()+1)+'.'+t.getDate();};
  });
  const V=page.locator('#detailView');
  const md=n=>page.evaluate(n=>window.__md(n),n);
  const open=async i=>{await page.evaluate(i=>window.__open(i),i);await page.waitForSelector('#detailView.dv7r .dvs-task .dv7-lb');await page.waitForTimeout(700);};
  const snap=()=>page.evaluate(()=>{const v=document.getElementById('detailView'),r=v.querySelector('.dw-right'),t=s=>{const n=v.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};
   return {fit:r.scrollHeight<=r.clientHeight+1,over:r.scrollHeight-r.clientHeight,vis:[...r.children].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className.split(' ')[0]),
    parts:[...v.querySelectorAll('.dvs-task>*')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className.split(' ').pop()),
    lb:t('.dv7-lb'),task:t('.dvs-tt>b'),due:t('.dvs-tt>span'),kv:[...v.querySelectorAll('.dv7-kvs>span')].map(n=>n.textContent),btns:[...v.querySelectorAll('.dvs-task button')].filter(b=>b.offsetParent).map(b=>[b.textContent.trim(),b.classList.contains('fill')]),
    next:t('.dv7-next>div'),info:t('.dv7-info>div'),ai:t('.dv7-ai'),old:v.querySelectorAll('.dw-right .dv7-first,.dw-right .dv7-grps,.dw-right .dv7-sub,.dw-right .dvs-aux:not([style*="none"])').length,
    right:[...r.querySelectorAll('.da-stage-summary,.dcb,.dvu,.dp6,.dv3-near')].length,drawerHidden:v.querySelector('.dv7-drawer').hidden,inDrawer:[...v.querySelectorAll('.dv7-pbody>*')].map(n=>n.className.split(' ').filter(c=>/^(da-stage-summary|dv3-slot|dcb|dvu|dp6|dv3-near)$/.test(c))[0]||n.className),
    left:[...v.querySelectorAll('.dv3-left .dv7-h, .dv3-left header>b')].map(n=>n.textContent.trim()),leftAi:getComputedStyle(v.querySelector('.dv3-left .sth-ai')||v).display,plan:v.querySelectorAll('.dp6-plan').length};});
  /* ① 7단계 + 과거 이관: 같은 구성 · 노트북에서 스크롤 없이 끝 */
  const TASK=['견적 요청 등록','발송 내역 확인 · 고객 반응 기록','입대의 결과 확인 연락','제안서 팀장 공유 · 제출 준비','계약 체결 확인','준공 후 사후 연락','실주 기록 완성','영업 재개 판단'];
  const BTN=['견적 요청 등록','발송 내역 확인','연락하고 결과 기록','제출 준비 확인','계약서 확인하기','사후 연락하기','실주 기록 채우기','영업 재개'];
  for(let i=0;i<8;i++){
   await open(i);const s=await snap(),closed=i===5||i===6;
   assert.equal(s.fit,true,(i+1)+'번: 오른쪽 칸이 스크롤 없이 끝난다(넘침 '+s.over+'px)');
   assert.deepEqual(s.vis,['dvs-task'],(i+1)+'번: 오른쪽에는 지금 처리 카드 하나만: '+s.vis);
   assert.deepEqual(s.parts,['dv7-lb','dvs-tt','dv7-kvs','dv7-btns','dv7-next','dv7-ai','dv7-info'],(i+1)+'번: 지금 처리 · 주 버튼 · 다음 업무 · AI 한 줄 · 확인할 정보 순서: '+s.parts);
   assert.equal(s.lb,'지금 처리');assert.equal(s.task,TASK[i]);
   assert.deepEqual([s.kv[0],s.kv[2],s.kv[4]],['확인됨','확인할 것','완료 조건'],'세 줄은 회색 작은 글씨로만');
   assert.deepEqual(s.btns,closed?[[BTN[i],true],['채우기',false]]:[[BTN[i],true],[i===1||i===7?'등록하기':'변경',false],['채우기',false]],(i+1)+'번: 주 버튼 1개 · 보조 단추(연락하기 · 결과 기록 · 다음 업무) 없음: '+JSON.stringify(s.btns));
   assert.match(s.next,/^다음 업무 · 일정 /);assert.match(s.info,/^확인할 정보 \d+ /);
   assert.equal(s.old,0,'먼저 확인 · 요약 묶음 · 보조 단추 · 지침 줄은 오른쪽에 없다');assert.equal(s.right,0,'예전 상자는 오른쪽에 남지 않는다');assert.equal(s.plan,0,'지금 할 일 5줄도 확인할 정보로 합침');
   assert.equal(s.drawerHidden,true);assert.deepEqual(s.inDrawer.filter(x=>x!=='dv3-slot'),['da-stage-summary','dcb','dvu','dp6','dv3-near'],'상자들은 가운데 칸 패널에(기능 그대로)');
   assert.deepEqual(s.left.slice(0,4),['연락처 · 결정권자','기본 정보','지금 영업건','이 단지 지난 영업 0']);assert.equal(s.leftAi,'none','왼쪽 AI 문장은 오른쪽 한 줄로');
   assert.match(s.ai,/^AI\S/);
   assert.equal(await V.locator('.dvs-kv>span').nth(1).evaluate(n=>getComputedStyle(n).fontSize),'11.5px');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dvs-task *')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').length),0,'글 잘림 없음');
  }
  /* ② 자료 발송완료: 값 */
  await open(1);let s=await snap();
  assert.equal(s.due,'발송 후 7일 발송일 없음 · 판정 불가');assert.equal(s.next,'다음 업무 · 일정 등록 없음');
  assert.equal(s.info,'확인할 정보 8 결정권자 · 담당 최종 검토 · 무엇을 발송했나요? 외 5','빠진 정보 · 먼저 확인을 한 줄로 합침(같은 것은 한 번)');
  /* 왼쪽 기본 정보: 주소 · 공종 · 공사 예정 · 유입 경로 — 값을 누르면 그 자리에서 고친다 */
  assert.deepEqual(await V.locator('.dv7-basic .dv3-row').evaluateAll(l=>l.map(r=>[r.querySelector('span').textContent,r.querySelector('.dv3-val').textContent,getComputedStyle(r.querySelector('.dv3-val'),'::after').content])),[['주소','경기 평택시 포승읍 포승공단','"수정"'],['공종','미입력','"입력"'],['공사 예정','미입력','"입력"'],['유입 경로','미입력','"입력"']]);
  await V.locator('.dv7-basic .dv3-row',{hasText:'공사 예정'}).locator('.dv3-val').click();await page.waitForTimeout(300);
  assert.equal(await V.locator('.dv7-basic input[data-dv3in="left"][data-key="construction_plan"]').count(),1,'공사 예정 = 왼쪽에서 바로 입력');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  /* 머리 예상금액 = 누르면 고치는 자리(오른쪽 표에는 없다) */
  assert.equal(await V.locator('.dv7-line2 .dv7-amt').count(),1);assert.equal(await V.locator('.dv7-pbody .dv3-row',{hasText:'예상 금액'}).count(),0);
  /* ③ [채우기] = 가운데 칸 패널: 응대 이력 자리에 뜨고 입력칸은 그대로 보인다 */
  await V.locator('.dv7-info button').click();await page.waitForTimeout(400);
  const P=()=>page.evaluate(()=>{const v=document.getElementById('detailView'),d=v.querySelector('.dv7-drawer'),r=d.getBoundingClientRect(),c=v.querySelector('.idv-composer').getBoundingClientRect(),ce=v.querySelector('.dw-center').getBoundingClientRect();
   return {p:d.dataset.p,hidden:d.hidden,head:d.querySelector('.dv7-phead .t')?d.querySelector('.dv7-phead .t').innerText.replace(/\s+/g,' ').trim():'',shown:[...d.querySelectorAll('.dv7-pbody>*')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.className.split(' ').filter(c=>/^(da-stage-summary|dv3-slot|dcb|dvu|dp6|dv3-near)$/.test(c))[0]),aboveComposer:Math.abs(r.bottom-c.top)<=2,inCenter:Math.abs(r.left-ce.left)<=1&&Math.abs(r.right-ce.right)<=1,composer:c.height>40};});
  let p=await P();assert.deepEqual([p.p,p.hidden,p.head],['info',false,'‹ 확인할 정보 이 단계에 필요한 것만 · 칸을 누르면 바로 입력']);assert.deepEqual(p.shown.filter(x=>x!=='dv3-slot'),['da-stage-summary'],'확인할 정보 패널 = 이 단계 정보 상자 하나');
  assert.deepEqual([p.aboveComposer,p.inCenter,p.composer],[true,true,true],'가운데 칸 안 · 응대 기록 입력칸 바로 위까지');
  assert.deepEqual(await V.locator('.dv7-pbody .da-stage-summary .dv3-row>span').allInnerTexts(),['결정권자','담당 최종 검토','무엇을 발송했나요?','견적 Version','수신자','발송일','고객 반응']);
  assert.deepEqual(await V.locator('.dv7-xrows>div').evaluateAll(l=>l.map(r=>r.innerText.replace(/\s+/g,' ').trim())),['미입력 공사 예정 입력'],'상자에 칸이 없는 확인 항목은 패널 머리 아래에서 그 자리로');
  /* 패널 안에서 바로 입력 → 기존 저장 길 */
  await V.locator('.dv7-pbody .dv3-row',{hasText:'수신자'}).locator('.dv3-val').click();await page.waitForTimeout(300);
  const inp=V.locator('.dv7-pbody input[data-dv3in="stage"][data-key="recipient"]');assert.equal(await inp.count(),1);await inp.fill('임석재 소장');await inp.press('Enter');await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_stage_fields_update_v1').map(x=>x[1].p.fields)),[{recipient:'임석재 소장'}],'패널에서 채운 값은 같은 저장 함수로');
  p=await P();assert.equal(p.p,'info','저장 뒤에도 패널은 열린 채');
  /* [‹] = 응대 이력으로 */
  await V.locator('.dv7-phead [data-dv3="p7close"]').click();await page.waitForTimeout(300);p=await P();assert.equal(p.hidden,true);assert.equal(await V.locator('.idv-thread').isVisible(),true);
  /* 주 버튼(발송 내역 확인) = 같은 패널 */
  await V.locator('.dvs-primary').click();await page.waitForTimeout(400);p=await P();assert.deepEqual([p.p,p.hidden],['info',false]);
  /* ④ [···] 메뉴: 오른쪽에서 뺀 상자 4개 */
  await V.locator('.tf-more').click();await page.waitForTimeout(200);
  assert.deepEqual((await V.locator('.tf-menu [role=menuitem]').allInnerTexts()).slice(0,4),['결정 일정 · 특이조건 · 하자','참여 · 브랜드','영업 판단 · 내부 지원','근처 현장']);
  for(const [label,key,cls,title] of [['결정 일정 · 특이조건 · 하자','collab','dcb','결정 일정 · 막힌 곳 · 진척 · 특이조건 · 하자'],['참여 · 브랜드','units','dvu','참여 · 브랜드'],['영업 판단 · 내부 지원','prep','dp6','영업 판단 · 내부 지원'],['근처 현장','near','dv3-near','근처 현장']]){
   if(!(await V.locator('.tf-menu').count())){await V.locator('.tf-more').click();await page.waitForTimeout(200);}
   await V.locator('.tf-menu [role=menuitem]',{hasText:label}).click();await page.waitForTimeout(500);p=await P();
   assert.equal(p.p,key,label);assert.deepEqual(p.shown.filter(x=>x!=='dv3-slot'),[cls],label+' 패널에는 그 상자만');assert.match(p.head,new RegExp('^‹ '+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
   assert.equal((await snap()).fit,true,'패널을 열어도 오른쪽은 그대로');
  }
  /* 담당 = 머리 한 곳: 왼쪽 담당 정보 카드는 평소 숨김 · [···] '담당 · 실적 귀속'에서 펼친다 */
  assert.equal(await V.locator('.dv3-left .do-card').evaluate(n=>getComputedStyle(n).display),'none');
  await V.locator('.tf-more').click();await page.waitForTimeout(200);await V.locator('.tf-menu [role=menuitem]',{hasText:'담당 · 실적 귀속'}).click();await page.waitForTimeout(500);
  assert.notEqual(await V.locator('.dv3-left .do-card').evaluate(n=>getComputedStyle(n).display),'none','담당 정보 카드가 왼쪽에 펼쳐진다');
  /* 값도 근거도 없는 줄은 '미확인' 한 단어 */
  await V.locator('.tf-more').click();await page.waitForTimeout(200);await V.locator('.tf-menu [role=menuitem]',{hasText:'영업 판단 · 내부 지원'}).click();await page.waitForTimeout(400);
  assert.equal(one(await V.locator('.dv7-pbody .dp6 .dp6-row.nov').first().innerText()),'예산 미확인');
  /* 협업 상자의 기능은 패널 안에서 그대로(결정 일정 기록 창) */
  await V.locator('.tf-more').click();await page.waitForTimeout(200);await V.locator('.tf-menu [role=menuitem]',{hasText:'결정 일정 · 특이조건 · 하자'}).click();await page.waitForTimeout(400);
  await V.locator('.dv7-pbody .dcb [data-dc]',{hasText:'결정 일정 기록'}).first().click();await page.waitForTimeout(300);assert.ok(await V.locator('.dv7-pbody .dcb .dcb-form').count()>=1,'결정 일정 기록 창이 패널 안에서 열린다');
  /* 응대 기록 입력칸의 [막힌 곳 · 진척 표시] = 같은 패널 */
  await V.locator('.dv7-phead [data-dv3="p7close"]').click();await page.waitForTimeout(300);
  assert.equal(one(await V.locator('#ddvComposer .dv7-blk').innerText()),'+ 막힌 곳 · 진척 표시');await V.locator('#ddvComposer .dv7-blk').click();await page.waitForTimeout(400);p=await P();assert.equal(p.p,'collab');
  /* 다음 업무 [등록하기] = 그 줄 아래 빠른 선택(기존 저장 길) */
  await V.locator('.dv7-next button').click();await page.waitForTimeout(200);assert.deepEqual(await V.locator('.dvs-task .dv3-nextonly button').allInnerTexts(),['내일','3일 후','7일 후','직접 정하기','취소']);
  await V.locator('.dvs-task .dv3-nextonly [data-dv3="nextcancel"]').click();await page.waitForTimeout(200);
  /* ⑤ 경쟁 · 입찰: 진행 조건 · 입찰 준비도 확인할 정보에 포함 · 그 자리로 보내는 단추 */
  await open(3);s=await snap();assert.match(s.info,/^확인할 정보 1\d /);
  await V.locator('.dv7-info button').click();await page.waitForTimeout(400);
  const xr=await V.locator('.dv7-xrows>div').evaluateAll(l=>l.map(r=>r.innerText.replace(/\s+/g,' ').trim()));
  assert.ok(xr.includes('미확인 예산 진행 조건 · 입찰 준비 열기')&&xr.some(x=>/^미입력 입찰 준비 \d+개 /.test(x)),'경쟁 · 입찰: '+JSON.stringify(xr));
  await V.locator('.dv7-xrows button',{hasText:'진행 조건 · 입찰 준비 열기'}).first().click();await page.waitForTimeout(400);p=await P();assert.equal(p.p,'prep');
  /* 계약 · 시공: 특이조건은 확인할 정보에 포함 */
  await open(4);await V.locator('.dv7-info button').click();await page.waitForTimeout(400);assert.equal(await V.locator('.dv7-pbody .da-stage-summary .dvs-sp').count(),1,'계약 단계 = 특이조건 선택이 확인할 정보 패널에');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'detail-right-fix.png')});
  /* ⑥ 끄기: 예전처럼 오른쪽에 쌓인다 */
  await page.evaluate(()=>{closeDetail();G.dealRightKeep=true;drwDeal(JSON.stringify(B.deals[1]));});await page.waitForSelector('#detailView.dv7 .dvs-task .dv7-lb');await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView'),r=v.querySelector('.dw-right');return [v.classList.contains('dv7r'),v.querySelectorAll('.dv7-drawer').length,r.querySelectorAll(':scope>.da-stage-summary,:scope>.dcb,:scope>.dvu,:scope>.dp6').length,v.querySelectorAll('.dv7-basic').length,v.querySelectorAll('.dv7-first').length];}),[false,0,4,0,1]);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('detail right fix ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
