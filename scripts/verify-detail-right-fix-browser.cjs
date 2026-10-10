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
    mk(6,'[경기 용인] 수지삼성래미안','POUR공법','정정훈','won',{outcome:'won',won_amount:140000000,closed_at:'2026-03-12',contract_date:'2026-03-12',completion_date:day(-40),amt:140000000,stage_contexts:{won:{fields:{completion_date:day(-40)}}}}),
    mk(7,'[대구] 강북이진캐스빌','석민이앤씨','한준엽','lost',{outcome:'lost',closed_at:'2026-05-07',amt:350000000}),
    mk(8,'[부산] 과거 이관 단지','석민이앤씨','김성민','old_stage_x',{amt:380000000}),mk(9,'[경기 안양] 미팅 전 컨설팅 단지','POUR솔루션','이필선','consulting',{activities:[]}),mk(10,'[서울 마포] 나눔빌딩','석민이앤씨','황윤선','bidding',{amt:300000000})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.__rpc=[];window.__uploads=[];window.uploadExecAttachment=async(d,f,cat,tags,memo)=>{__uploads.push({name:f.name,cat,memo});return {id:'u'+__uploads.length,file_name:f.name,mime_type:f.type,category:cat,memo,status:'ready',created_at:new Date().toISOString()};};window.logActivity=(type,note,res,at)=>({id:'l'+Date.now(),type,note,at});
   SB={rpc:async(n,a)=>{__rpc.push([n,a]);if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};
    if(n==='crm_deal_stage_fields_update_v1'||n==='crm_deal_closed_info_update_v1'){const p=a.p||{},dd=B.deals.find(x=>x.id===(p.deal_id||p.opportunity_id)),code=p.stage_code||'sent',cur=((dd&&dd.stage_contexts||{})[code]||{}).fields||{};return {data:{ok:true,deal_id:p.deal_id||p.opportunity_id,stage:p.stage,fields:p.fields||{},version:2,stage_context:{to:code,fields:Object.assign({},cur,p.fields||{})}}};}
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
  /* ① 7단계 + 과거 이관: 같은 구성 · 노트북에서 스크롤 없이 끝 · 업무 화면이 있는 단계는 확인할 정보 줄이 없다 */
  const TASK=['견적 요청 등록','발송 내역 확인 · 고객 반응 기록','입대의 결과 확인 연락','제안서 팀장 공유 · 제출 준비','계약 체결 확인','준공 후 사후 연락','실주 기록 완성','영업 재개 판단'];
  const BTN=['견적 요청 등록','발송 내역 확인','연락하고 결과 기록','제출 준비 확인','계약서 확인하기','사후 연락하기','실주 기록 채우기','영업 재개'];
  const HASW=[true,true,true,true,true,true,true,false];
  for(let i=0;i<8;i++){
   await open(i);const s=await snap(),closed=i===5||i===6;
   assert.equal(s.fit,true,(i+1)+'번: 오른쪽 칸이 스크롤 없이 끝난다(넘침 '+s.over+'px)');
   assert.deepEqual(s.vis,['dvs-task'],(i+1)+'번: 오른쪽에는 지금 처리 카드 하나만: '+s.vis);
   assert.deepEqual(s.parts,HASW[i]?['dv7-lb','dvs-tt','dv7-kvs','dv7-btns','dv7-next']:['dv7-lb','dvs-tt','dv7-kvs','dv7-btns','dv7-next','dv7-info'],(i+1)+'번: 업무 화면이 있으면 확인할 정보 줄 · [채우기]는 숨김: '+s.parts);
   assert.equal(s.lb,'지금 처리');assert.equal(s.task,TASK[i]);
   assert.deepEqual([s.kv.length,s.kv[0],s.kv[2]],[4,'확인됨','완료 조건']);
   assert.deepEqual(s.btns,[[BTN[i],true]].concat(closed?[]:[[i===1||i===7?'등록하기':'변경',false]]).concat(HASW[i]?[]:[['채우기',false]]),(i+1)+'번: 주 버튼 1개: '+JSON.stringify(s.btns));
   assert.equal(await V.locator('.dvs-primary').getAttribute('data-act'),HASW[i]?'work7':['','','activity','','','','','stage'][i]);
   assert.match(s.next,/^다음 업무 · 일정 /);
   if(!HASW[i]){assert.ok(Number(s.info.match(/^확인할 정보 (\d+)/)[1])<=3,'확인할 정보는 최대 3개');assert.doesNotMatch(s.info,/담당 최종 검토|무엇을 발송했나요|결정권자 · /);}
   assert.equal(s.old,0);assert.equal(s.right,0);assert.equal(s.plan,0);assert.equal(s.summ,0,'deal-same 의 빠진 정보 블록은 그리지 않는다');
   assert.equal(s.drawerHidden,true);assert.deepEqual(s.inDrawer.filter(x=>x!=='dv3-slot'),['dv7-fill','dv3-near'],'가운데 패널 = 업무 화면 · 근처 현장 패널 둘뿐(협업 · 관리 단위 · 영업 판단은 없음)');
   assert.deepEqual(s.left.slice(0,4),['연락처 · 결정권자','기본 정보','지금 영업건','이 단지 지난 영업 0']);assert.equal(s.leftAi,'none');assert.equal(s.ai,null);
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dvs-task *')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').length),0,'글 잘림 없음');
  }
  /* AI 한 줄 = 정말 한 줄 */
  await open(1);
  await page.evaluate(()=>{OpsStore.aiOn=()=>true;DealKeyman.ai=()=>({next:{how:'전화',what:'임석재 소장에게 자료 수신 확인',days:0}});DealDetailV3.apply();});await page.waitForTimeout(400);
  let s=await snap();assert.equal(s.ai,'AI전화 · 임석재 소장에게 자료 수신 확인 · 오늘');assert.doesNotMatch(s.ai,/이 단지와는|첫 영업/);
  await page.evaluate(()=>{OpsStore.aiOn=()=>false;delete DealKeyman.ai;DealDetailV3.apply();});
  /* 근거 줄은 한 번만: 미팅 기록 · 다음 업무가 없는 컨설팅 건 */
  await open(8);assert.equal(one(await V.locator('.dvs-tt>span').innerText()),'미팅 후 3일 기준 미팅 기록이 없어 판정 불가','판정 불가 문구 반복 없음');
  /* 왼쪽 기본 정보: 줄 아래 입력(관리정보 수정 패널 없음) */
  await open(1);
  const mgmt=()=>page.evaluate(()=>[document.querySelectorAll('#ddvPanel,#detailAction,.dp-info').length,/관리정보 수정/.test(document.getElementById('detailView').innerText)]);
  const saved=()=>page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_stage_fields_update_v1'||x[0]==='crm_deal_closed_info_update_v1').map(x=>x[1].p.fields));
  assert.deepEqual(await V.locator('.dv7-basic .dv3-row').evaluateAll(l=>l.map(r=>[r.querySelector('span').textContent,r.querySelector('.dv3-val').textContent])),[['주소','경기 평택시 포승읍 포승공단'],['공종','미입력'],['공사 예정','미입력'],['유입 경로','미입력']]);
  await V.locator('.dv7-basic .dv3-row',{hasText:'공사 예정'}).locator('.dv3-val').click();await page.waitForTimeout(300);
  assert.deepEqual(await V.locator('.dv7-be .chips button').allInnerTexts(),['올해','내년','그 이후','미정']);assert.deepEqual(await mgmt(),[0,false]);
  await V.locator('.dv7-be [data-dv3="bcancel"]').click();await page.waitForTimeout(250);
  await V.locator('.dv7-basic .dv3-row',{hasText:'유입 경로'}).locator('.dv3-val').click();await page.waitForTimeout(300);await V.locator('.dv7-be .chips button',{hasText:'소개'}).click();await V.locator('.dv7-be [data-dv3="bsave"]').click();await page.waitForTimeout(500);
  assert.deepEqual(await saved(),[{inflow_path:'소개'}]);
  /* ② 견적 요청 등록: 주 버튼 → 가운데 칸 한 곳에서 자료 올리기 → 공사 시기 → 범위 · 메모 → 등록 */
  await open(0);
  const P=()=>page.evaluate(()=>{const v=document.getElementById('detailView'),d=v.querySelector('.dv7-drawer'),r=d.getBoundingClientRect(),c=v.querySelector('.idv-composer').getBoundingClientRect(),ce=v.querySelector('.dw-center').getBoundingClientRect();
   return {p:d.dataset.p,hidden:d.hidden,head:d.querySelector('.dv7-phead .t')?d.querySelector('.dv7-phead .t').innerText.replace(/\s+/g,' ').trim():'',aboveComposer:Math.abs(r.bottom-c.top)<=2,inCenter:Math.abs(r.left-ce.left)<=1&&Math.abs(r.right-ce.right)<=1,text:d.innerText.replace(/\s+/g,' ').trim(),acts:[...d.querySelectorAll('[data-dv3]')].map(b=>b.dataset.dv3),btn:v.querySelector('.dvs-primary').textContent,btnOn:v.querySelector('.dvs-primary').classList.contains('on'),info:!!v.querySelector('.dv7-info')};});
  const openWork=async i=>{await open(i);if((await P()).hidden){await V.locator('.dvs-primary').click();await page.waitForTimeout(500);}};
  await V.locator('.dvs-primary').click();await page.waitForTimeout(500);let p=await P();
  assert.deepEqual([p.p,p.hidden,p.head],['work',false,'‹ 견적 요청 등록 자료 올리기 → 공사 시기 → 범위 · 메모 → 등록']);assert.deepEqual([p.aboveComposer,p.inCenter],[true,true]);
  assert.deepEqual([p.btn,p.btnOn,p.info],['견적 요청 등록 · 가운데에서 진행 중',true,false],'오른쪽 주 버튼 = 가운데에서 진행 중 · 확인할 정보 줄 없음');
  assert.deepEqual([...new Set(p.acts)].sort(),['p7close','upload','wpick','wsave'],'왼쪽 · 오른쪽으로 보내는 단추(자료 열기 · 기본 정보에서 입력)는 없다: '+p.acts);
  assert.match(p.text,/채울 것 2개 남음 · 여기서 다 입력 1 도면 · 현장 사진 미입력/);
  assert.equal(await V.locator('.dv7-wfoot .pri').isDisabled(),true,'자료 · 공사 시기가 없으면 등록은 잠김');
  /* 자료 올리기(그 자리 업로드 · 기존 업로드 함수) */
  {const [fc]=await Promise.all([page.waitForEvent('filechooser'),V.locator('.dv7-drop').click()]);await fc.setFiles([{name:'도면_102동.pdf',mimeType:'application/pdf',buffer:Buffer.from('pdf')},{name:'현장사진_옥상_1.jpg',mimeType:'image/jpeg',buffer:Buffer.from('img')}]);await page.waitForTimeout(700);}
  assert.deepEqual(await page.evaluate(()=>__uploads.map(u=>[u.name,u.cat,u.memo])),[['도면_102동.pdf','도면',''],['현장사진_옥상_1.jpg','현장사진','']],'파일 종류로 분류');
  {const tx=(await P()).text;assert.match(tx,/1 도면 · 현장 사진 2개 올림/);assert.ok(tx.includes('도면_102동.pdf')&&tx.includes('현장사진_옥상_1.jpg'),'올린 파일 이름이 그 자리에 보인다');}
  await V.locator('.dv7-chips button',{hasText:'내년'}).click();await page.waitForTimeout(300);assert.equal(await V.locator('.dv7-wfoot .pri').isDisabled(),false);
  assert.equal(await V.locator('.dv7-ta').inputValue(),'현장 방문 · 2개 층 바닥 들뜸 확인','범위 · 메모 = 미팅 기록에서 채움');
  await V.locator('.dv7-ta').fill('옥상 방수 · 3개동 · 부분 보수 여부 확인 필요');
  const b0=(await saved()).length;await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(700);
  {const f=(await saved()).slice(b0)[0],due=await page.evaluate(()=>{const t=new Date(Date.now()+9*36e5);let n=0,x=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),t.getUTCDate()));while(n<3){x=new Date(x.getTime()+864e5);if(x.getUTCDay()!==0&&x.getUTCDay()!==6)n++;}return x.toISOString().slice(0,10);});
   assert.deepEqual(f,{quote_request:'옥상 방수 · 3개동 · 부분 보수 여부 확인 필요',quote_due:due,construction_plan:'내년'},'견적 요청 기록 + 견적 예정일(3일 · 평일) + 공사 시기가 한 번에 저장');}
  p=await P();assert.equal(p.hidden,true,'저장하면 업무 화면이 닫힌다');
  assert.equal(await V.locator('.dv7-basic .dv3-row',{hasText:'공사 예정'}).locator('.dv3-val').innerText(),'내년','가운데에서 저장하면 왼쪽 기본 정보 값도 같이 바뀐다');
  /* 자료 없이 가견적 */
  await openWork(0);
  await V.locator('.dv7-ta').fill('옥상 방수');const b1=(await saved()).length;await V.locator('.dv7-wfoot button',{hasText:'자료 없이 가견적'}).click();await page.waitForTimeout(700);
  assert.match((await saved()).slice(b1)[0].quote_request,/^옥상 방수$|^자료 부족 · 가견적 — 옥상 방수$/,'자료 없이도 가견적으로 저장');
  /* ③ 자료 발송완료 = 발송 내역 확인: 줄 아래 펼침이 아니라 가운데 칸에서 같은 5단계(기존 기록 → 발송일 · 수신자 · 보낸 자료 → 경과일 판정 → 후속 업무 → 저장) */
  await openWork(1);p=await P();
  assert.deepEqual([p.p,p.head],['work','‹ 발송 내역 확인 기존 기록 → 발송일 · 수신자 · 보낸 자료 → 경과일 판정 → 후속 업무 → 저장']);
  assert.equal(await V.locator('.dv7-drawer .ifx[data-kind="sent"]').count(),1,'5단계 보완이 가운데 칸 안에 있다');assert.equal(await page.locator('#pipeline-stage-v3 .ifx, .prv-row + .ifx').count(),0,'목록 줄 아래에는 없다');
  assert.match(one(await V.locator('.ifx-s1').innerText()),/기존 첨부 · 이력에서 찾음 .*이메일 견적서 발송 · 임석재 소장/,'기존 기록 후보(HTML 태그 없는 글자)');
  await V.locator('.ifx-cand button').click();await page.waitForTimeout(300);
  await V.locator('.ifx input[data-ifxf="recipient"]').fill('임석재 소장');await V.locator('.ifx-foot .pri').click();await page.waitForTimeout(300);
  assert.match(one(await V.locator('.ifx-s3').innerText()),/발송 .* → 오늘/,'경과일 판정');await V.locator('.ifx-foot .pri').click();await page.waitForTimeout(300);
  await V.locator('.ifx-modes button',{hasText:'등록 안 함'}).click();await page.waitForTimeout(200);
  const b2=(await saved()).length;await V.locator('.ifx-foot .pri').click();await page.waitForTimeout(800);
  {const f=(await saved()).slice(b2)[0];assert.ok(f.sent_date&&f.recipient==='임석재 소장'&&Array.isArray(f.materials)&&f.sent_basis,'발송일 · 수신자 · 보낸 자료 · 근거가 한 번에 저장: '+JSON.stringify(f));}
  assert.match(one(await V.locator('.ifx-done').innerText()),/저장됨/);await V.locator('.ifx-foot .pri',{hasText:'닫기'}).click();await page.waitForTimeout(400);p=await P();assert.equal(p.hidden,true,'[닫기] = 업무 화면 닫힘');
  /* 경쟁 · 입찰: 일정이 하나도 없으면 [일정 입력] = 같은 5단계(입찰 · 결정 일정) */
  await open(9);assert.equal(one(await V.locator('.dvs-primary').innerText()),'일정 입력');await V.locator('.dvs-primary').click();await page.waitForTimeout(500);
  assert.equal(await V.locator('.dv7-drawer .ifx[data-kind="schedule"]').count(),1);assert.match((await P()).head,/^‹ 입찰 · 결정 일정 /);
  /* ④ 경쟁 · 입찰 제출 확인 */
  await openWork(3);p=await P();
  assert.deepEqual([p.p,p.head],['work','‹ 제출 확인 공법 비교표 · 경쟁 업체 · 제출 접수증']);assert.equal(await V.locator('.dv7-wfoot .pri').isDisabled(),true,'접수증이 없으면 제출 확인은 잠김');
  {const [fc]=await Promise.all([page.waitForEvent('filechooser'),V.locator('.dv7-drop').nth(0).click()]);await fc.setFiles([{name:'공법비교표.pdf',mimeType:'application/pdf',buffer:Buffer.from('x')}]);await page.waitForTimeout(700);}
  {const [fc]=await Promise.all([page.waitForEvent('filechooser'),V.locator('.dv7-drop').nth(1).click()]);await fc.setFiles([{name:'접수증.jpg',mimeType:'image/jpeg',buffer:Buffer.from('y')}]);await page.waitForTimeout(700);}
  assert.deepEqual(await page.evaluate(()=>__uploads.slice(-2).map(u=>[u.cat,u.memo])),[['견적자료','공법 비교표'],['기타','제출 접수증']]);
  assert.deepEqual((await saved()).slice(-2).map(f=>Object.keys(f)[0]),['compare_attached','receipt_attached'],'올린 표식은 단계 정보에 남는다');
  await openWork(3);assert.equal(await V.locator('.dv7-wfoot .pri').isDisabled(),false);
  await V.locator('.dv7-work input[data-dv3f="competitor"]').fill('코지건설');const b3=(await saved()).length;await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(600);
  assert.deepEqual((await saved()).slice(b3).map(f=>[Object.keys(f).sort().join(','),f.competitor]),[['competitor,submit_checked_at','코지건설']]);
  /* ⑤ 계약 · 시공: 계약서 확인 */
  await openWork(4);p=await P();assert.equal(p.head,'‹ 계약서 확인 계약서 파일 · 착공일 · 특이조건');assert.equal(await V.locator('.dv7-wfoot .pri').isDisabled(),true);
  {const [fc]=await Promise.all([page.waitForEvent('filechooser'),V.locator('.dv7-drop').click()]);await fc.setFiles([{name:'계약서.pdf',mimeType:'application/pdf',buffer:Buffer.from('c')}]);await page.waitForTimeout(700);}
  assert.deepEqual(await page.evaluate(()=>__uploads.slice(-1).map(u=>[u.cat,u.memo])),[['계약관련','계약서']]);
  await openWork(4);
  await V.locator('.dv7-work input[data-dv3f="start_date"]').fill('2026-11-02');await V.locator('.dv7-chips button',{hasText:'없음'}).click();await page.waitForTimeout(250);
  const b4=(await saved()).length;await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(600);
  assert.deepEqual((await saved()).slice(b4),[{contract_document:'수령',start_date:'2026-11-02',special_terms:'없음'}],'계약서 수령 · 착공일 · 특이조건');
  /* 서버 확인 대기열(합성): 저장 명령을 모아 두고 모두 '완료'로 답한다 */
  await page.evaluate(()=>{window.__ops=[];window.queueDetailContactOperation=(op,payload)=>{const id='op'+(__ops.length+1);__ops.push({id,op,payload});return id;};window.pushWrite=(k,payload)=>{const id='pw'+(__ops.length+1);__ops.push({id,op:k,payload});return id;};Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,status:'done',ack:{ok:true,operation:o.op,activity_id:'act-'+o.id,next_action_id:'nx-'+o.id}}));});
  /* ⑥ 수주 사후 연락 · 실주 기록(종료 건 전용 저장 길) */
  await openWork(5);p=await P();assert.equal(p.head,'‹ 사후 연락 전화 → 결과 · 재영업 · 다음 공사');
  await V.locator('.dv7-ta').fill('만족 · 하자 없음');await V.locator('.dv7-chips button',{hasText:'예'}).first().click();await page.waitForTimeout(250);await V.locator('.dv7-work input[data-dv3f="recontact_possibility"]').fill('외벽 2028');
  const b5=(await saved()).length;await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(600);
  assert.deepEqual((await saved()).slice(b5),[{customer_reaction:'만족 · 하자 없음',reengage:'예',recontact_possibility:'외벽 2028'}]);
  /* 사후 연락 → 하자 접수([하자] 표식) · 추가 공종 → 확장관리 새 영업건 */
  await openWork(5);await page.evaluate(()=>{__ops.length=0;});
  await V.locator('.dv7-wfoot button',{hasText:'하자 접수'}).click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__ops.length),0,'하자 내용이 없으면 접수하지 않는다');
  await V.locator('.dv7-work input[data-dv3f="defect_text"]').fill('101동 옥상 배수구 들뜸');await V.locator('.dv7-work input[data-dv3f="defect_due"]').fill('2026-12-20');await V.locator('.dv7-wfoot button',{hasText:'하자 접수'}).click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__ops.map(o=>[o.op,o.payload.type,o.payload.note.replace(/접수 \d{4}-\d{2}-\d{2}/,'접수 오늘')])),[['activity','메모','[하자] 101동 옥상 배수구 들뜸 | 접수 오늘 | 담당 정정훈 | 약속 2026-12-20 | 미해결']],'기존 [하자] 표식으로 내부 메모에 남는다');
  await openWork(5);assert.equal(await V.locator('.dv7-wfoot [data-dv3="wnewdeal"]').count(),1);
  await V.locator('.dv7-wfoot [data-dv3="wnewdeal"]').click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>!!(window.EXPANSION_NEW_SOURCE&&String(EXPANSION_NEW_SOURCE.sourceOpportunityId)===String(B.deals[5].id))),true,'확장관리 새 영업건 창이 이 수주 건을 출발점으로 열린다');await page.evaluate(()=>{try{closeNewDeal();}catch(e){}});
  await openWork(6);p=await P();assert.equal(p.head,'‹ 실주 기록 사유 · 확인한 내용 · 재영업');
  await V.locator('.dv7-chips button',{hasText:'가격'}).first().click();await page.waitForTimeout(250);await V.locator('.dv7-work select[data-dv3f="close_reason"]').selectOption({index:1});await V.locator('.dv7-ta').fill('가격 차이 13%');await V.locator('.dv7-chips button',{hasText:'아니오'}).click();await page.waitForTimeout(250);
  const b6=(await saved()).length;await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(600);
  assert.deepEqual((await saved()).slice(b6).map(f=>[Object.keys(f).sort().join(','),f.close_detail,f.reengage]),[['close_detail,close_reason,reengage','가격 차이 13%','아니오']]);
  /* ⑦ 관계관리 · 과거 이관: 업무 화면이 없는 단계 — 확인할 정보 3줄([채우기]) · 다른 칸으로 보내는 단추 없음 */
  await openWork(2);p=await P();
  assert.equal(p.head,'‹ 연락 기록 연락 결과 → 관리 상태 → 다음 연락일');assert.deepEqual([...new Set(p.acts)].filter(x=>['files','be'].includes(x)),[],'다른 칸으로 보내는 단추 없음');
  const promised=await page.evaluate(()=>new Date(Date.now()+4*864e5).toLocaleDateString('en-CA'));
  assert.equal(await V.locator('.dv7-work input[data-dv3f="next"]').inputValue(),promised,'다음 연락일 = 고객이 정한 약속일 우선');
  await page.evaluate(()=>{__ops.length=0;});
  await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__ops.length),0,'연락 결과를 안 고르면 저장하지 않는다');
  await V.locator('.dv7-chips button',{hasText:'집중관리'}).click();await page.waitForTimeout(250);await V.locator('.dv7-chips button',{hasText:'연결됨'}).click();await page.waitForTimeout(250);
  await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__ops.length),0,'견적 발송일을 모르면 집중 · 일반으로 저장하지 않는다');
  await V.locator('.dv7-chips button[data-f="state"][data-v="대기"]').click();await page.waitForTimeout(250);
  await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__ops.length),0,'대기는 사유가 있어야 저장한다');
  await V.locator('.dv7-work input[data-dv3f="reason"]').fill('2027 봄 공사 대기');await V.locator('.dv7-ta').fill('입대의 일정 확인 중이라고 함');await V.locator('.dv7-wfoot .pri').click();await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>__ops.map(o=>o.op)),['activity','relationship_contact'],'관리 상태 표식 + 연락 기록(기존 길)');
  assert.equal(await page.evaluate(()=>__ops[0].payload.note),'[관계 상태] 대기 | 2027 봄 공사 대기 | '+promised+' | 없음 | 미정');
  assert.deepEqual(await page.evaluate(()=>{const a=__ops[1].payload;return [a.activity.type,a.activity.meaningful_contact,a.next_action.text,a.next_action.due_at];}),['전화',true,'고객 약속: 입대의 결과 확인 연락',promised],'연락 결과 + 고객 약속 그대로 유지한 다음 연락');
  assert.equal((await P()).hidden,true,'저장하면 업무 화면이 닫힌다');
  await openWork(2);await V.locator('.dv7-wfoot button',{hasText:'실주 처리'}).click();await page.waitForTimeout(500);assert.equal(await V.locator('.dv3-move').count()>0,true,'[실주 처리] = 단계 바꾸기 창');
  await open(7);await V.locator('.dv7-info button').click();await page.waitForTimeout(400);assert.deepEqual(await V.locator('.dv7-fill .dv7-fr .h b').allInnerTexts(),['단계 정하기','다음 행동 · 날짜','마지막 연락']);
  /* 담당 미배정 줄 [담당 배정] → 상세 창 가운데 칸의 '담당 배정' 화면 */
  await page.evaluate(()=>{closeDetail();B.deals[9].assignee='';B.deals[9].owner='';});await open(9);
  await page.evaluate(()=>DealDetailV3.openFrom('owner'));await page.waitForTimeout(700);
  {const o=await page.evaluate(()=>{const p=document.querySelector('#detailView .dv3-cpanel');return {shown:!!p&&!p.hidden,by:p&&p.dataset.by,text:p?p.innerText.replace(/\s+/g,' ').trim().slice(0,80):''};});
   assert.deepEqual([o.shown,o.by],[true,'owner'],'[담당 배정] = 가운데 칸 담당 배정 화면: '+o.text);}
  /* ⑧ 근처 현장 = [···] 메뉴 */
  await open(1);await V.locator('.tf-more').click();await page.waitForTimeout(200);
  const menu=await V.locator('.tf-menu [role=menuitem]').allInnerTexts();assert.equal(menu[0],'근처 현장');assert.deepEqual(menu.filter(x=>/결정 일정|참여 · 브랜드|영업 판단|담당 · 실적 귀속|소장이 바뀌었어요/.test(x)),[]);
  await V.locator('.tf-menu [role=menuitem]',{hasText:'근처 현장'}).click();await page.waitForTimeout(500);p=await P();assert.deepEqual([p.p,p.head],['near','‹ 근처 현장 반경 안에서 영업했던 곳']);
  assert.equal(await V.locator('.dw-right .dv3-near').count(),0,'근처 현장은 오른쪽 기본 화면에 없다');assert.equal(await V.locator('.dv7-pbody .dv3-near').isVisible(),true);
  /* 소장이 바뀌었어요 = 소장 칸 */
  await V.locator('.dv7-phead [data-dv3="p7close"]').click();await page.waitForTimeout(250);assert.equal(one(await V.locator('.dv3-left .dv3-mgr .dvt-c4 button').innerText()),'소장이 바뀌었어요');
  assert.equal(await V.locator('.dv3-left .do-card').evaluate(n=>getComputedStyle(n).display),'none');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'detail-work-screens.png')});
  /* ⑨ 끄기: 예전처럼 오른쪽에 쌓이고 주 버튼은 예전 길로 */
  await page.evaluate(()=>{closeDetail();G.dealRightKeep=true;drwDeal(JSON.stringify(B.deals[1]));});await page.waitForSelector('#detailView.dv7 .dvs-task .dv7-lb');await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView'),r=v.querySelector('.dw-right');return [v.classList.contains('dv7r'),v.querySelectorAll('.dv7-drawer').length,r.querySelectorAll(':scope>.da-stage-summary,:scope>.dcb,:scope>.dvu,:scope>.dp6').length,v.querySelectorAll('.dv7-basic').length,v.querySelectorAll('.dv7-first').length];}),[false,0,4,0,1]);


  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('detail right fix ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
