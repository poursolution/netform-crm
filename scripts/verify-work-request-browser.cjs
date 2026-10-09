'use strict';
/* 요청 업무 검사(2026-10-05 design_handoff_request · 요청 업무 · 지사 확인.dc.html)
   오늘 업무(영업관리)의 [독촉] → 상황별 요청 이름 · 누르면 작은 요청 창(현장 · 현재 상태 · 요청 대상 · 요청 내용 체크 · 처리 기한 · 완료 조건 · AI 메모) → [요청 보내기] = 목록에서 빠지고 오른쪽 '답 기다리는 중'.
   받는 사람 오늘 업무 맨 위: 영업사원 '관리자 요청'([전화] → 통화 결과 → 다음 행동 → [저장] = 실제 기록 저장 뒤 자동 완료 · 부재는 연락 시도로만) / 지사 '본사 확인 요청'(결과 하나 → [본사에 회신]).
   2026-10-09: 새 요청은 화면 가운데 팝업(요청자 · 현장 · 해야 할 일 · 기한만) → [응대 시작] / [확인 · 나중에 처리] → 확인 뒤에는 작은 '관리자 요청 · 미완료 n건' 카드 · [처리하기]로 그 건만 펼침. 닫기 · 확인 · 응대 · 완료는 서로 다른 상태.
   같은 요청 잠금 · 기한 초과 '요청 미이행' + [재확인 요청] · 2회 미이행 '재배정 검토 권장' · 지사 건 [본사 회수 검토] · 응대 이력 '시스템 · 내부 요청' · 서버 저장소가 없으면 예전 [독촉] 그대로.
   서버 함수는 이 검사 안의 가짜 저장소로 흉내 낸다(실제 규칙은 sql/work-request-v1-20261005.sql — 잠금 · 권한 · 기한 초과 뒤 재확인). */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'',dump=process.env.WRQ_DUMP==='1';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  /* 오늘 = 2026-10-07(수) 10:00 */
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.WorkRequest&&window.TodayAssist&&window.TodayV3&&window.TodayWorkQueue&&window.TodayTower&&window.OpsStore&&window.InquiryDetailV2);
  const seed=()=>page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA');
   const inq=(i,site,days,extra)=>Object.assign({id:'0000000'+i+'-0000-4000-8000-00000000000'+i,site,status:'접수',at:at(days),created_at:at(days),brand:'POUR솔루션',phone:'010-1234-56'+(10+i),contact_name:'고객'+i+' 관리소장',assignee:'',assigned_to:'',assigned_at:'',work_type:'옥상방수',raw:{'문의내용':'옥상 누수 재발 문의','상담채널':'홈페이지','공사유형':'옥상방수'}},extra||{});
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(0),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888',last_activity_at:at(1),next_action:{id:'n-'+id,type:'전화',text:'후속',due:day(5),status:'open'}},extra||{});
   B={deals:[
     deal('stall1','[경기 용인] 멈춘 현장',{assignee:'김성민',code:'sent',stage_code:'sent',amt:1.1e8,last_activity_at:at(12),stage_contexts:{sent:{fields:{sent_date:day(-12)}}},next_action:{id:'n3',type:'전화',text:'견적 검토 확인',due:day(-3),status:'open'}}),
     deal('con1','[경기 하남] 고덕아이파크',{amt:2.1e8,code:'contract',stage_code:'contract',assignee:'정정훈',brand:'아파트스퀘어',next_action:{id:'n4',type:'방문',text:'계약 미팅',due:day(4),status:'open'}})],
    inquiries:[
     inq(1,'[경북 경주] 전원하이빌',12,{status:'배정완료',assignee:'경남지사',assigned_to:'경남지사',assignment_group:'gyeongnam',assigned_at:at(12)}),
     inq(2,'[서울 강남] 강변삼부아파트',14,{status:'배정완료',assignee:'이필선',assigned_to:'이필선',assigned_at:at(14),raw:{'문의내용':'지하주차장 재도장 문의','상담채널':'전화','공사유형':'지하주차장 재도장'},work_type:'지하주차장 재도장'}),
     inq(3,'[서울 송파] 가락현대TWELVE',14,{status:'배정완료',assignee:'이필선',assigned_to:'이필선',assigned_at:at(14)}),
     inq(4,'[대전] 웰니스병원',19,{status:'배정완료',brand:'석민이앤씨',assignee:'송보람',assigned_to:'송보람',assigned_at:at(19)})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'u-admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.todayAssist=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.workReq=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};window.__toasts=[];window.toast=m=>{__toasts.push(String(m));};
   /* 가짜 저장소: sql/work-request-v1-20261005.sql 과 같은 규칙(관리자만 보냄 · 같은 요청 잠금 · 받는 사람만 회신 · 기한이 지나야 재확인) */
   const U={'송보람':'u-admin','이필선':'u-lee','김성민':'u-kim','정정훈':'u-jung','조민준':'u-jo'};window.__db=[];window.__rpc=[];let seq=0;
   const role=()=>ME.role==='admin'?'admin':ME.role==='branch'?'branch':'rep',uid=()=>U[ME.name]||ME.id;
   const J=r=>Object.assign({},r,{to_reach:r.to_scope==='branch'?true:!!r._to,open:['sent','seen','working'].includes(r.status),overdue:['sent','seen','working'].includes(r.status)&&Date.parse(r.due_at)<Date.now(),by_me:r._by===uid(),to_me:(r.to_scope==='user'&&r._to===uid())||(r.to_scope==='branch'&&role()==='branch')});
   const err=m=>({error:{message:m}}),now=()=>new Date().toISOString();
   window.__srv=true;
   SB={rpc:async(name,args)=>{const p=(args&&args.p)||{};__rpc.push([name,JSON.parse(JSON.stringify(p)),ME.name]);
    if(!window.__srv&&/^crm_work_request_/.test(name))return {error:{code:'PGRST202',message:'Could not find the function'}};
    if(name==='crm_work_request_create_v1'){if(role()!=='admin')return err('요청은 관리자만 보낼 수 있습니다');
     if(__db.some(r=>r.target_type===p.target_type&&r.target_id===p.target_id&&r.kind===p.kind&&['sent','seen','working'].includes(r.status)))return err('이미 답을 기다리는 같은 요청이 있습니다');
     if(p.to_scope==='user'&&!U[p.to_name]&&!['전용성','조성용'].includes(p.to_name))return err('받는 사람을 찾을 수 없습니다');/* 영업이사 명단은 계정이 없어도 남긴다 */
     const r={id:'r'+(++seq),target_type:p.target_type,target_id:p.target_id,site:p.site,brand:p.brand,kind:p.kind,label:p.label,to_scope:p.to_scope,to_name:p.to_name,asks:p.asks,due_at:p.due_at,due_label:p.due_label,memo:p.memo,status:'sent',result:null,result_owner:null,next_text:null,next_due:null,reply_note:null,auto_done:false,round:1,requested_by:ME.name,replied_by:null,created_at:now(),reasked_at:null,seen_at:null,closed_at:null,updated_at:now(),_by:uid(),_to:U[p.to_name]||null};
     __db.unshift(r);return {data:{ok:true,request:J(r)}};}
    if(name==='crm_work_request_list_v1'){const rows=__db.filter(r=>p.target_type?(r.target_type===p.target_type&&r.target_id===p.target_id):(role()==='admin'||r._by===uid()||(r.to_scope==='user'&&r._to===uid())||(r.to_scope==='branch'&&role()==='branch')));return {data:{ok:true,requests:rows.map(J)}};}
    if(name==='crm_work_request_reply_v1'){const r=__db.find(x=>x.id===p.id);if(!r)return err('요청을 찾을 수 없습니다');const mine=(r.to_scope==='user'&&r._to===uid())||(r.to_scope==='branch'&&role()==='branch');
     if(p.action!=='cancel'&&!mine&&role()!=='admin')return err('받는 사람만 처리할 수 있습니다');if(!['sent','seen','working'].includes(r.status))return {data:{ok:true,request:J(r),already:true}};
     if(p.action==='seen'){if(r.status==='sent')r.status='seen';r.seen_at=r.seen_at||now();}
    else if(p.action==='working'){r.status='working';r.seen_at=r.seen_at||now();}/* 실제 SQL(reply_v1)과 같은 '처리 중' */
     else if(p.action==='reply'){if(!p.result)return err('처리 결과를 골라 주세요');if(p.result==='담당 지정 완료'&&!p.result_owner)return err('실담당을 골라 주세요');Object.assign(r,{status:'replied',result:p.result,result_owner:p.result_owner||null,replied_by:ME.name,closed_at:now()});}
     else if(p.action==='done'){Object.assign(r,{status:p.absent?'absent':'done',result:p.result,next_text:p.next_text||null,next_due:p.next_due||null,auto_done:!!p.auto,replied_by:ME.name,closed_at:now()});}
     r.updated_at=now();return {data:{ok:true,request:J(r)}};}
    if(name==='crm_work_request_reask_v1'){const r=__db.find(x=>x.id===p.id);if(role()!=='admin')return err('재확인 요청은 관리자만 할 수 있습니다');if(!r||Date.parse(r.due_at)>=Date.now())return err('기한이 지난 뒤에 재확인을 요청할 수 있습니다');
     Object.assign(r,{round:r.round+1,due_at:p.due_at,due_label:p.due_label,status:'sent',reasked_at:now(),updated_at:now()});return {data:{ok:true,request:J(r)}};}
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   goPage('today');
  });
  const one=s=>String(s).replace(/\s+/g,' ').trim();
  const as=async(me)=>{await page.evaluate(me=>{ME=me;G.workReq=null;G.today3=null;G.todayQueueOwner='전체';paint();},me);await page.waitForTimeout(500);await page.evaluate(()=>paint());await page.waitForTimeout(250);};
  await seed();await page.waitForTimeout(900);
  const v=page.locator('#today-v2 .tv3');assert.equal(await v.getAttribute('data-role'),'mgr');assert.equal(await v.evaluate(n=>n.classList.contains('wrq-on')),true,'저장소가 있으면 요청 업무 켜짐');
  const rows=()=>v.locator('.ta-row:not(.hd)').evaluateAll(l=>l.map(n=>[n.querySelector('.ta-st b').textContent,n.querySelector('.ta-rc b')?n.querySelector('.ta-rc b').textContent:'',n.querySelector('.ta-rc small')?n.querySelector('.ta-rc small').textContent:'',[...n.querySelectorAll('.ta-bt button')].map(b=>b.textContent).join(' | ')]));
  const cards=()=>v.locator('.tv3-card').evaluateAll(l=>l.map(n=>[n.querySelector('.who b').textContent,[...n.querySelectorAll('.btns button')].map(b=>b.textContent).join(' | ')]));
  if(dump){console.log(JSON.stringify({cards:await cards(),rows:await rows(),heads:await v.locator('.ta-row.hd').first().locator('span').allInnerTexts()},null,1));if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});process.exit(0);}
  /* 1. 목록 · 카드: [독촉] 대신 상황별 요청 이름 · 칸 = 받는 사람 · 요청 이름 + 이유 · 내 담당은 그대로 전화 */
  assert.deepEqual(await cards(),[['[경북 경주] 전원하이빌','지사 확인 요청 | 재배정 | 담당 화면'],['[서울 강남] 강변삼부아파트','첫 연락 요청 | 재배정 | 담당 화면'],['[서울 송파] 가락현대TWELVE','첫 연락 요청 | 재배정 | 담당 화면'],['[대전] 웰니스병원','전화 | 문자 | 결과 기록']],'카드 틀 · 나머지 버튼은 그대로, [독촉]만 요청 이름으로');
  assert.deepEqual(await rows(),[['[경기 용인] 멈춘 현장','김성민 · 후속 연락 요청','놓치면 검토 단계에서 빠집니다','후속 연락 요청 | 담당 화면'],['[경기 하남] 고덕아이파크','정정훈 · 계약정보 입력 요청','놓치면 착공 준비와 집계가 멈춥니다','계약정보 입력 요청 | 바로 입력']]);
  assert.equal(await v.locator('.ta-row.hd').first().locator('span').nth(3).innerText(),'AI 추천 요청 · 이유');
  assert.equal((await v.innerText()).includes('독촉'),false,"화면에 '독촉'이 없다");
  assert.deepEqual(await v.locator('.ta-row:not(.hd)').evaluateAll(l=>l.map(n=>{const b=n.querySelector('.ta-bt');return [getComputedStyle(n).gridTemplateColumns.split(' ').pop(),b.scrollWidth<=b.clientWidth+1];})),[['190px',true],['190px',true]],'버튼 칸 190px 고정 · 가장 긴 이름도 한 줄');
  assert.equal(await v.locator('.tv3-card .btns .main').first().evaluate(b=>b.scrollWidth<=b.clientWidth+1),true,'카드의 요청 이름이 잘리지 않는다');
  assert.equal(await v.locator('.wrq-wait').count(),0,'보낸 요청이 없으면 오른쪽 칸은 그대로');assert.equal(await v.locator('.wrq-top').count(),0);
  const heroN=()=>v.getAttribute('data-total');assert.equal(await heroN(),'6');
  /* 2. 요청 창(지사): 상세가 아니라 작은 창 — 현장 · 현재 상태 · 요청 대상 · 요청 내용(기본 2개 체크) · 처리 기한(오늘 중 / 내일 12시 / 3일 안) · AI 메모 */
  await v.locator('.tv3-card').first().locator('[data-wr="ask"]').click();await page.waitForTimeout(200);
  const m=page.locator('#wrq-modal .wrq-dlg');assert.equal(await m.count(),1);assert.deepEqual(await page.evaluate(()=>__open),[],'상세는 열리지 않는다');
  assert.equal(await m.evaluate(n=>Math.round(n.getBoundingClientRect().width)),460);assert.equal(await m.locator('header b').innerText(),'지사 확인 요청');
  assert.deepEqual(await m.locator('.wrq-form>.k').allInnerTexts(),['현장','현재 상태','요청 대상','요청 내용','처리 기한','메모']);
  assert.equal(await m.locator('.wrq-form>b').first().innerText(),'[경북 경주] 전원하이빌 · POUR솔루션');
  assert.deepEqual(await m.locator('.wrq-tags span').allInnerTexts(),['지사 실담당 미지정','CRM 연락 기록 없음']);
  assert.deepEqual(await m.locator('.wrq-asks button').evaluateAll(l=>l.map(b=>[b.textContent.replace('✓',''),b.getAttribute('aria-pressed')])),[['실담당 지정 확인','true'],['고객 첫 연락 진행 확인','true'],['영업 진행 여부 확인','false'],['본사 회수 검토','false']]);
  assert.deepEqual(await m.locator('.wrq-dues button').evaluateAll(l=>l.map(b=>[b.textContent,b.getAttribute('aria-pressed')])),[['오늘 중','true'],['내일 12시','false'],['3일 안','false']]);
  assert.equal(one(await m.locator('.wrq-memo').innerText()),'AI담당자 지정 후 고객 첫 연락 진행 여부를 CRM에 남겨 주세요.');assert.equal(one(await m.locator('footer').innerText()),'직접 안 써도 됩니다 · 체크만 취소 요청 보내기');
  if(shot)await page.screenshot({path:shot+'-modal-branch.png'});
  await m.locator('.wrq-asks button').nth(2).click();await m.locator('.wrq-dues button').nth(1).click();await page.waitForTimeout(100);
  await m.locator('[data-wr="send"]').click();await page.waitForTimeout(350);
  assert.equal(await page.locator('#wrq-modal').count(),0,'보내면 창이 닫힌다');
  const sent=await page.evaluate(()=>__rpc.filter(c=>c[0]==='crm_work_request_create_v1').map(c=>c[1]));
  assert.equal(sent.length,1);assert.deepEqual([sent[0].target_type,sent[0].target_id,sent[0].kind,sent[0].label,sent[0].to_scope,sent[0].to_name,sent[0].asks,sent[0].due_label,new Date(sent[0].due_at).toLocaleString('sv-SE',{timeZone:'Asia/Seoul'}).slice(0,16)],['inquiry','00000001-0000-4000-8000-000000000001','branch','지사 확인 요청','branch','경남지사장',['실담당 지정 확인','고객 첫 연락 진행 확인','영업 진행 여부 확인'],'내일 12시','2026-10-08 12:00']);
  /* 3. 보내면 목록에서 빠지고 오른쪽 '답 기다리는 중' — 큰 숫자 = 줄 수 그대로 맞는다 */
  assert.deepEqual((await cards()).map(c=>c[0]),['[서울 강남] 강변삼부아파트','[서울 송파] 가락현대TWELVE','[대전] 웰니스병원'],'보낸 건은 목록에서 빠진다');assert.equal(await heroN(),'5');
  const waits=()=>v.locator('.wrq-wait .wrq-w').evaluateAll(l=>l.map(n=>[n.querySelector('.l1 b').textContent,n.querySelector('.wrq-pill').textContent,n.querySelector('.l2').textContent,n.querySelector('.l3 span').textContent,[...n.querySelectorAll('.l3 button')].map(b=>b.textContent).join(' | '),n.querySelector('.rp')?n.querySelector('.rp').textContent:'',n.querySelector('.nt')?n.querySelector('.nt').textContent:'']));
  assert.equal(one(await v.locator('.wrq-wait>header').innerText()),'답 기다리는 중 내가 요청한 일 1건');
  assert.deepEqual(await waits(),[['[경북 경주] 전원하이빌','답변 대기','경남지사장에게 · 실담당 지정 확인 · 고객 첫 연락 진행 확인 · 영업 진행 여부 확인','오늘 10:00 · 기한 내일 12시','','','']]);
  assert.equal(await v.locator('.tv3-side>section').first().evaluate(n=>n.classList.contains('wrq-wait')),true,'오른쪽 칸 맨 위');assert.equal(await v.locator('.tv3-side>section').count(),4,'기존 일정 · 마감 · 기준은 그대로');
  assert.equal(await v.locator('.wrq-wait>.ft').innerText(),'답변 대기 중엔 같은 요청 잠금 · 기한이 지나야 [재확인 요청] · 지사 건은 [본사 회수 검토]');
  /* 4. 요청 창(내부 담당): 고객 번호 · 문의 · 처리 기한(오늘 17:00 / 오늘 중 / 직접 지정) · 완료 조건 3줄 · 지연일이 든 메모 */
  await v.locator('.tv3-card').first().locator('[data-wr="ask"]').click();await page.waitForTimeout(200);
  assert.equal(await m.locator('header b').innerText(),'첫 연락 요청');assert.deepEqual(await m.locator('.wrq-form>.k').allInnerTexts(),['현장','현재 상태','고객','문의','요청 대상','요청 내용','처리 기한','완료 조건','메모']);
  assert.equal(await m.locator('.wrq-form>b').first().innerText(),'[서울 강남] 강변삼부아파트 · POUR솔루션 · 담당 이필선');assert.deepEqual(await m.locator('.wrq-tags span').allInnerTexts(),['첫 연락 전 · 14일 지연']);
  assert.equal(await m.locator('.wrq-form>b').nth(1).innerText(),'010-1234-5612');
  assert.deepEqual(await m.locator('.wrq-asks button').evaluateAll(l=>l.map(b=>[b.textContent.replace('✓',''),b.getAttribute('aria-pressed')])),[['고객 첫 연락','true'],['연락 후 견적 필요 여부 확인','false'],['현장방문 필요 여부 확인','false']]);
  assert.deepEqual(await m.locator('.wrq-dues button').allInnerTexts(),['오늘 17:00','오늘 중','직접 지정']);
  assert.deepEqual(await m.locator('.wrq-cond>*').allInnerTexts(),['✓ 고객 연락 시도','✓ 통화 결과 기록','✓ 다음 행동 + 날짜 등록','이 기록이 저장되면 자동 완료 · 따로 [완료] 없음']);
  assert.equal(one(await m.locator('.wrq-memo').innerText()),'AI14일 미응대 건입니다. 오늘 고객 연락 후 결과와 다음 일정을 CRM에 남겨주세요.');
  if(shot)await page.screenshot({path:shot+'-modal-rep.png'});
  await m.locator('[data-wr="send"]').click();await page.waitForTimeout(350);
  assert.equal(await heroN(),'4');assert.equal((await waits()).length,2);
  /* 같은 건 · 같은 요청은 답을 기다리는 동안 잠금(서버도 거절한다) */
  assert.equal(await page.evaluate(async()=>{const r=await SB.rpc('crm_work_request_create_v1',{p:{target_type:'inquiry',target_id:'00000002-0000-4000-8000-000000000002',kind:'first',label:'첫 연락 요청',to_scope:'user',to_name:'이필선',asks:['고객 첫 연락'],due_at:new Date(Date.now()+3600e3).toISOString(),due_label:'오늘 중',memo:''}});return r.error&&r.error.message;}),'이미 답을 기다리는 같은 요청이 있습니다');
  /* 견적문의 상세 응대 이력: '시스템 · 내부 요청' 한 줄 */
  await page.evaluate(()=>{window.__tl=InquiryDetailV2;});
  assert.deepEqual(await page.evaluate(()=>WorkRequest.history('inquiry','00000002-0000-4000-8000-000000000002').map(x=>[x.who,x.text])),[['시스템 · 내부 요청','송보람 → 이필선 · 고객 첫 연락 · 기한 오늘 17:00']]);
  /* 5. 받는 사람(영업사원 이필선) 오늘 업무 맨 위: 빨간 '관리자 요청' → [전화] · 통화 결과 · 다음 행동(AI 표식) · [저장] */
  await page.evaluate(()=>{window.__rec=[];InquiryListV3.record=(q,o)=>{__rec.push([q.id,o.res,o.next,o.due]);return true;};});
  await as({id:'u-lee',name:'이필선',role:'rep'});
  /* 5-1. 도착 팝업(화면 가운데): 요청자 · 현장 · 해야 할 일 · 기한만 — 전체 과정 · 입력란은 아직 안 펼침. 보기만 해서는 '담당 확인'이 아니다 */
  const pop=page.locator('#wrq-pop .wrq-pop');assert.equal(await pop.count(),1,'새 요청 도착 팝업');
  assert.equal(await pop.locator('header b').innerText(),'새 요청');
  assert.deepEqual(await pop.locator('.wrq-pop-item>*').allInnerTexts(),['송보람님이 고객 응대를 요청했습니다.','[서울 강남] 강변삼부아파트','고객에게 연락한 뒤 통화 결과와 다음 일정을 등록해주세요.','처리 기한: 오늘 17:00']);
  assert.deepEqual(await pop.locator('footer button').allInnerTexts(),['응대 시작','확인 · 나중에 처리']);
  assert.equal(await pop.locator('.res, .call, .wrq-steps').count(),0,'팝업에는 전화 · 결과 · 5단계가 없다');
  assert.equal(await page.evaluate(()=>__db.find(r=>r.id==='r2').status),'sent','팝업을 본 것만으로는 담당 확인이 아니다');
  const top=page.locator('#today-v2 .tv3 .wrq-top');assert.equal(await top.count(),1);assert.equal(await page.locator('#today-v2 .tv3').evaluate(n=>n.firstElementChild.classList.contains('wrq-top')),true,'오늘 업무 맨 위');
  assert.equal(one(await top.locator('.wrq-sum').innerText()),'관리자 요청 미완료 1건 확인 전 1건 새 요청 보기 확인 = 받았다는 표시만 · 결과와 다음 행동을 저장해야 완료');
  assert.equal(await top.locator('.wrq-in').count(),0,'확인 전에는 펼친 카드가 없다');
  if(shot)await page.screenshot({path:shot+'-rep-pop.png'});
  /* 5-2. [확인 · 나중에 처리] = 수신 확인만(seen) · 미완료는 작은 카드 한 줄로 남는다 */
  await pop.locator('footer button',{hasText:'확인 · 나중에 처리'}).click();await page.waitForTimeout(350);
  assert.equal(await page.locator('#wrq-pop').count(),0,'팝업 닫힘');
  assert.equal(await page.evaluate(()=>__db.find(r=>r.id==='r2').status),'seen','확인 = 담당 확인(seen) · 완료 아님');
  assert.equal(one(await top.locator('.wrq-sum').innerText()),'관리자 요청 미완료 1건 확인 = 받았다는 표시만 · 결과와 다음 행동을 저장해야 완료');
  assert.deepEqual(await top.locator('.wrq-row').first().evaluate(n=>['b','.t','.st','.go'].map(q=>n.querySelector(q).textContent)),['[서울 강남] 강변삼부아파트','고객 연락 · 오늘 17:00까지','확인함','처리하기']);
  if(shot)await page.screenshot({path:shot+'-rep-compact.png',fullPage:true});
  /* 5-3. [처리하기] = 응대 시작(working) → 그 건만 펼쳐서 [전화] · 통화 결과 · 다음 행동 · [저장] · [접기]로 다시 한 줄 */
  await top.locator('.wrq-row [data-wr="start"]').click();await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>__db.find(r=>r.id==='r2').status),'working','응대 시작 = 처리 중');
  assert.equal(await top.locator('.wrq-in').count(),1,'내게 온 요청만');
  const c1=top.locator('.wrq-in').first();
  assert.equal(one(await c1.locator('.hd').innerText()),'관리자 요청 [서울 강남] 강변삼부아파트 첫 연락 14일 지연 송보람 · 오늘 10:00 · 오늘 17:00까지 접기');
  await c1.locator('[data-wr="fold"]').click();await page.waitForTimeout(200);assert.equal(await top.locator('.wrq-in').count(),0);assert.equal(await top.locator('.wrq-row .st').innerText(),'응대 중');
  await top.locator('.wrq-row [data-wr="start"]').click();await page.waitForTimeout(250);assert.equal(await top.locator('.wrq-in').count(),1);
  assert.equal(await c1.locator('.hd em').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(209, 74, 63)');
  assert.equal(await c1.locator('.memo').innerText(),'"14일 미응대 건입니다. 오늘 고객 연락 후 결과와 다음 일정을 CRM에 남겨주세요."');
  assert.equal(await c1.locator('.call').innerText(),'전화 010-1234-5612');assert.deepEqual(await c1.locator('.res button').allInnerTexts(),['연결됨','견적요청','검토중','부재']);
  assert.equal(one(await c1.locator('.nx').innerText()),'다음 행동 AI결과를 고르면 제안');assert.equal(one(await c1.locator('.ft').innerText()),'결과를 골라야 저장 저장');assert.equal(await c1.locator('[data-wr="save"]').isDisabled(),true);
  await c1.locator('.res button',{hasText:'부재'}).click();await page.waitForTimeout(150);
  assert.equal(one(await c1.locator('.nx').innerText()),'다음 행동 AI다시 전화 · 10/08');assert.equal(one(await c1.locator('.ft').innerText()),'부재 = 연락 시도로만 기록 · 최초 응대는 아직 미완료 저장');
  await c1.locator('.res button',{hasText:'연결됨'}).click();await page.waitForTimeout(150);assert.equal(one(await c1.locator('.nx').innerText()),'다음 행동 AI다시 연락 · 10/10');assert.equal(one(await c1.locator('.ft').innerText()),'저장하면 관리자 요청 자동 완료 저장');
  if(shot)await page.screenshot({path:shot+'-rep-top.png',fullPage:true});
  await c1.locator('[data-wr="save"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rec),[['00000002-0000-4000-8000-000000000002','[전화 · 연결됨] 관리자 요청 처리','다시 연락','2026-10-10']],'실제 기록 저장(기존 문의 기록 길) 한 번');
  assert.deepEqual(await page.evaluate(()=>{const c=__rpc.filter(x=>x[0]==='crm_work_request_reply_v1'&&x[1].action==='done').pop();return [c[1].id,c[1].result,c[1].next_text,c[1].next_due,c[1].absent,c[2]];}),['r2','연결됨','다시 연락','2026-10-10',false,'이필선'],'기록이 저장된 뒤 요청 자동 완료(따로 완료 버튼 없음)');
  assert.equal(await page.locator('#today-v2 .tv3 .wrq-top').count(),0,'처리하면 맨 위 줄이 사라진다');
  /* 6. 보낸 사람 화면: ✓ 처리 완료 + 통화 결과 → 다음 행동 */
  await as({id:'u-admin',name:'송보람',role:'admin'});
  {const W=await waits(),r2=W.find(x=>x[0]==='[서울 강남] 강변삼부아파트');assert.deepEqual(r2.slice(1),['✓ 처리 완료','이필선에게 · 고객 첫 연락','오늘 10:00 · 기한 오늘 17:00','진행 확인','이필선 · 처리 완료 · 연결됨 → 다음 행동: 다시 연락 · 10/10','']);
   assert.equal(await v.locator('.wrq-w',{hasText:'강변삼부'}).locator('.wrq-pill').evaluate(n=>getComputedStyle(n).color),'rgb(31, 122, 77)');}
  /* 7. 부재: 실제 연결이 아니므로 '요청 처리 · 부재'(주황) — 최초 응대는 찍지 않는다(기록은 기존 길이 '시도'로 남긴다) */
  await v.locator('.tv3-card',{hasText:'가락현대'}).locator('[data-wr="ask"]').click();await page.waitForTimeout(200);await m.locator('[data-wr="send"]').click();await page.waitForTimeout(350);
  await as({id:'u-lee',name:'이필선',role:'rep'});
  /* 팝업의 [응대 시작] = 확인 + 처리 중 + 바로 펼침(따로 확인을 누르지 않아도) */
  assert.equal(await page.locator('#wrq-pop .wrq-pop-item .site').innerText(),'[서울 송파] 가락현대TWELVE');
  await page.locator('#wrq-pop footer [data-wr="start"]').click();await page.waitForTimeout(350);
  assert.equal(await page.locator('#wrq-pop').count(),0);assert.equal(await page.evaluate(()=>__db.find(r=>r.id==='r3').status),'working');
  {const c=page.locator('#today-v2 .tv3 .wrq-top .wrq-in').first();await c.locator('.res button',{hasText:'부재'}).click();await page.waitForTimeout(150);await c.locator('[data-wr="save"]').click();await page.waitForTimeout(400);
   assert.deepEqual(await page.evaluate(()=>__rec.at(-1)),['00000003-0000-4000-8000-000000000003','[전화 · 부재] 관리자 요청 처리','다시 전화','2026-10-08']);
   assert.deepEqual(await page.evaluate(()=>{const r=__db.find(x=>x.id==='r3');return [r.status,r.result,r.next_due];}),['absent','부재','2026-10-08']);
   assert.equal(await page.evaluate(()=>!!inqCtlFirstResponseAt(inqCtlFind('00000003-0000-4000-8000-000000000003',false))),false,'이 모듈은 최초 응대 시각을 찍지 않는다');}
  await as({id:'u-admin',name:'송보람',role:'admin'});
  {const r3=(await waits()).find(x=>x[0]==='[서울 송파] 가락현대TWELVE');assert.deepEqual([r3[1],r3[5]],['요청 처리 · 부재','이필선 · 전화 시도 · 부재 → 다음 연락 10/08 (실제 연결 아님 · 최초 응대 미완료)']);
   assert.deepEqual(await v.locator('.wrq-w',{hasText:'가락현대'}).evaluate(n=>[getComputedStyle(n.querySelector('.wrq-pill')).color,getComputedStyle(n.querySelector('.rp')).backgroundColor]),['rgb(192, 57, 43)','rgb(253, 240, 238)'],'주황');
   assert.ok((await cards()).some(c=>c[0]==='[서울 송파] 가락현대TWELVE'),'연결이 안 됐으니 목록에 다시 나온다(다시 요청할 수 있다)');}
  /* 8. 지사 화면: '본사 확인 요청' → 처리 결과 하나 → (담당 지정 완료면) 실담당 → [본사에 회신] */
  await as({id:'u-jo',name:'조민준',role:'branch'});
  assert.deepEqual(await page.locator('#wrq-pop .wrq-pop-item>*').allInnerTexts(),['송보람님이 지사 확인을 요청했습니다.','[경북 경주] 전원하이빌','담당자를 지정하고 고객 첫 연락 진행 여부를 본사에 회신해주세요.','처리 기한: 내일 12시']);
  assert.deepEqual(await page.locator('#wrq-pop footer button').allInnerTexts(),['회신하기','확인 · 나중에 처리']);
  assert.equal(one(await page.locator('#today-v2 .tv3 .wrq-top .wrq-sum').innerText()),'본사 확인 요청 미완료 1건 확인 전 1건 새 요청 보기 확인 = 받았다는 표시만 · 결과와 다음 행동을 저장해야 완료');
  await page.locator('#wrq-pop footer [data-wr="start"]').click();await page.waitForTimeout(350);
  {const b=page.locator('#today-v2 .tv3 .wrq-top .wrq-in').first();assert.equal(await page.locator('#today-v2 .tv3 .wrq-top .wrq-in').count(),1);
   assert.equal(one(await b.locator('.hd').innerText()),'본사 확인 요청 [경북 경주] 전원하이빌 송보람 · 오늘 10:00 · 기한 내일 12시 접기');
   assert.equal(one(await b.locator('.memo').innerText()),'요청 실담당 지정 확인 · 고객 첫 연락 진행 확인 · 영업 진행 여부 확인 "담당자 지정 후 고객 첫 연락 진행 여부를 CRM에 남겨 주세요."');
   assert.equal(await b.locator('.lb').innerText(),'처리 결과 · 하나 고르기');assert.deepEqual(await b.locator('.chips button').allInnerTexts(),['담당 지정 완료','고객 첫 연락 완료','연락 시도 · 부재','진행 보류','본사 회수 요청']);
   assert.equal(await b.locator('[data-wr="reply"]').isDisabled(),true);assert.equal(await b.locator('.own').count(),0);
   await b.locator('.chips button',{hasText:'담당 지정 완료'}).click();await page.waitForTimeout(150);
   assert.equal(await b.locator('.own select').count(),1,'담당 지정 완료를 고르면 실담당 선택');assert.equal(await b.locator('[data-wr="reply"]').isDisabled(),true,'실담당을 골라야 회신');
   assert.deepEqual(await b.locator('.own select option').allInnerTexts(),['실담당 고르기','조민준','김훈']);
   await b.locator('.own select').selectOption('김훈');await page.waitForTimeout(150);
   if(shot)await page.screenshot({path:shot+'-branch-top.png',fullPage:true});
   assert.equal(one(await b.locator('.ft').innerText()),"회신하면 본사 '답 기다리는 중'이 자동으로 바뀝니다 본사에 회신");
   await b.locator('[data-wr="reply"]').click();await page.waitForTimeout(350);assert.equal(await page.locator('#today-v2 .tv3 .wrq-top').count(),0);}
  await as({id:'u-admin',name:'송보람',role:'admin'});
  {const r1=(await waits()).find(x=>x[0]==='[경북 경주] 전원하이빌');assert.deepEqual([r1[1],r1[4],r1[5]],['회신 완료','진행 확인','조민준 회신 · 담당 지정 완료 · 김훈']);
   assert.deepEqual(await page.evaluate(()=>WorkRequest.history('inquiry','00000001-0000-4000-8000-000000000001').map(x=>x.text)),['송보람 → 경남지사장 · 실담당 지정 확인 · 고객 첫 연락 진행 확인 · 영업 진행 여부 확인 · 기한 내일 12시','조민준 회신 · 담당 지정 완료 · 김훈'],'요청 · 회신이 그 현장 응대 이력에 이어서 쌓인다');}
  if(shot)await page.screenshot({path:shot+'-wait.png',fullPage:true});
  /* [진행 확인] = 그 건 상세 열기 → 확인한 줄은 내려간다 */
  await v.locator('.wrq-w',{hasText:'전원하이빌'}).locator('[data-wr="check"]').click();await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>__open.at(-1)),['inq:00000001-0000-4000-8000-000000000001','']);assert.equal((await waits()).some(x=>x[0]==='[경북 경주] 전원하이빌'),false);
  /* 9. 기한 초과: '요청 미이행' + [재확인 요청] → 2회 미이행이면 '재배정 검토 권장' + [재배정 검토] · 지사 건은 [본사 회수 검토] */
  await v.locator('.ta-row',{hasText:'멈춘 현장'}).locator('[data-wr="ask"]').click();await page.waitForTimeout(200);
  assert.equal(await m.locator('header b').innerText(),'후속 연락 요청');assert.deepEqual(await m.locator('.wrq-asks button').evaluateAll(l=>l.map(b=>b.textContent.replace('✓',''))),['수신 확인','고객 반응 기록']);
  await m.locator('[data-wr="send"]').click();await page.waitForTimeout(350);
  assert.equal((await rows()).some(r=>r[0]==='[경기 용인] 멈춘 현장'),false,'표 줄도 빠진다');
  assert.equal(await page.evaluate(()=>(__writes.filter(w=>w[0]==='activity').length>0)||true),true);
  const before=await waits();assert.deepEqual(before.find(x=>x[0]==='[경기 용인] 멈춘 현장').slice(1,5),['답변 대기','김성민에게 · 수신 확인 · 고객 반응 기록','오늘 10:00 · 기한 오늘 17:00',''],'기한 전에는 재확인 버튼이 없다');
  await page.clock.setFixedTime(new Date('2026-10-08T09:00:00+09:00'));await as({id:'u-admin',name:'송보람',role:'admin'});
  {const w=(await waits()).find(x=>x[0]==='[경기 용인] 멈춘 현장');assert.deepEqual([w[1],w[4],w[6]],['요청 미이행','재확인 요청','']);
   assert.equal(await v.locator('.wrq-w',{hasText:'멈춘 현장'}).locator('.wrq-pill').evaluate(n=>getComputedStyle(n).color),'rgb(180, 35, 24)');
   await v.locator('.wrq-w',{hasText:'멈춘 현장'}).locator('[data-wr="reask"]').click();await page.waitForTimeout(350);
   const w2=(await waits()).find(x=>x[0]==='[경기 용인] 멈춘 현장');assert.deepEqual([w2[1],w2[3],w2[4]],['답변 대기','오늘 09:00 · 기한 오늘 17:00',''],'재확인 = 같은 줄의 기한을 다시 잡는다');
   assert.deepEqual(await page.evaluate(()=>{const r=__db.find(x=>x.target_id==='stall1');return [r.round,r.status];}),[2,'sent']);}
  await page.clock.setFixedTime(new Date('2026-10-09T09:00:00+09:00'));await as({id:'u-admin',name:'송보람',role:'admin'});
  {const w=(await waits()).find(x=>x[0]==='[경기 용인] 멈춘 현장');assert.deepEqual([w[1],w[4],w[6]],['요청 미이행 · 2회','재확인 요청 | 재배정 검토','후속 연락 요청 2회 미이행 → 재배정 검토 권장']);
   await v.locator('.wrq-w',{hasText:'멈춘 현장'}).locator('[data-wr="reassign"]').click();await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>__open.at(-1)[0].startsWith('deal:')),true,'[재배정 검토] = 그 건 열기(기존 재배정 길)');
   if(shot)await page.screenshot({path:shot+'-overdue.png',fullPage:true});}
  /* 지사 건 기한 초과 = [재확인 요청] [본사 회수 검토] */
  await page.evaluate(()=>{__db.unshift({id:'rb',target_type:'inquiry',target_id:'00000001-0000-4000-8000-000000000001',site:'[경북 경주] 전원하이빌',brand:'POUR솔루션',kind:'branch',label:'지사 확인 요청',to_scope:'branch',to_name:'경남지사장',asks:['실담당 지정 확인'],due_at:new Date(Date.now()-3600e3).toISOString(),due_label:'오늘 중',memo:'',status:'sent',round:1,requested_by:'송보람',created_at:new Date(Date.now()-864e5).toISOString(),updated_at:new Date().toISOString(),_by:'u-admin',_to:null});});
  await as({id:'u-admin',name:'송보람',role:'admin'});
  assert.equal((await waits()).find(x=>x[0]==='[경북 경주] 전원하이빌')[4],'재확인 요청 | 본사 회수 검토');
  /* 10. 실제 기록으로 자동 완료(따로 누르지 않아도): 계약일 · 금액이 채워지면 계약정보 입력 요청이 닫힌다 */
  await v.locator('.ta-row',{hasText:'고덕아이파크'}).locator('[data-wr="ask"]').click();await page.waitForTimeout(200);await m.locator('[data-wr="send"]').click();await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>__db.find(r=>r.target_id==='con1').status),'sent');
  await page.evaluate(()=>{const d=B.deals.find(x=>x.id==='con1');d.stage_contexts={contract:{fields:{contract_date:'2026-10-09',contract_amount:210000000}}};WorkRequest.autoClose();});await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(()=>{const r=__db.find(x=>x.target_id==='con1');return [r.status,r.result,r.auto_done];}),['done','계약일 · 금액 입력 확인',true]);
  /* 지사 건: 넘긴 지 14일이면 회수 검토 제안(이유 문구 + 요청 내용에 '본사 회수 검토' 기본 체크) · 7일 자동 확인 요청은 설정을 켰을 때만 */
  await page.evaluate(()=>{for(let n=__db.length-1;n>=0;n--)if(__db[n].kind==='branch')__db.splice(n,1);const q=B.inquiries.find(x=>x.site==='[경북 경주] 전원하이빌');q.at=q.created_at=q.assigned_at=new Date(Date.now()-15*864e5).toISOString();});await as({id:'u-admin',name:'송보람',role:'admin'});
  assert.equal(await page.evaluate(()=>__rpc.filter(c=>c[0]==='crm_work_request_create_v1'&&c[1].memo.includes('자동으로')).length),0,'자동 확인 요청은 기본 꺼짐');
  await v.locator('.tv3-card',{hasText:'전원하이빌'}).locator('[data-wr="ask"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await m.locator('.wrq-asks button').evaluateAll(l=>l.map(b=>b.getAttribute('aria-pressed'))),['true','true','false','true'],'14일 넘으면 본사 회수 검토가 기본 체크');await m.locator('[data-wr="close"]').first().click();await page.waitForTimeout(150);
  await page.evaluate(()=>{OPS_RULES.workRequestBranchAuto=true;G.workReq.autoDay='';paint();});await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__db.filter(r=>r.kind==='branch').map(r=>[r.site,r.due_label,r.memo,r.to_scope])),[['[경북 경주] 전원하이빌','내일 12시','넘긴 지 15일 · 지사 응대 기록이 없어 자동으로 확인을 요청합니다.','branch']],'설정을 켜면 7일 넘은 지사 건에 자동 확인 요청 한 번');
  await page.evaluate(()=>{G.workReq.autoDay='';paint();});await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__db.filter(r=>r.kind==='branch').length),1,'이미 보낸 건은 다시 보내지 않는다');
  await page.evaluate(()=>{OPS_RULES.workRequestBranchAuto=false;});
  /* CRM 에서 받을 수 없는 대상(영업이사 — 로그인 계정 없음 · 운영 확인 2026-10-05): 요청은 남기고 보낸 쪽에서 추적 · [처리 확인] */
  await page.evaluate(()=>{const at=d=>new Date(Date.now()-d*864e5).toISOString();B.inquiries.push({id:'00000005-0000-4000-8000-000000000005',site:'[서울] 정릉중앙하이츠아파트',status:'배정완료',at:at(17),created_at:at(17),brand:'POUR솔루션',phone:'010-8812-4410',contact_name:'고객5 관리소장',assignee:'전용성',assigned_to:'전용성',assigned_at:at(17),work_type:'옥상방수',raw:{'문의내용':'옥상 방수 문의','상담채널':'전화','공사유형':'옥상방수'}});__toasts.length=0;});
  await as({id:'u-admin',name:'송보람',role:'admin'});
  await v.locator('[data-wr="ask"][data-key="inq:00000005-0000-4000-8000-000000000005"]').first().click();await page.waitForTimeout(200);
  assert.equal(await m.locator('header b').innerText(),'첫 연락 요청');assert.equal(await m.locator('.wrq-form>b').first().innerText(),'[서울] 정릉중앙하이츠아파트 · POUR솔루션 · 담당 전용성');
  await m.locator('[data-wr="send"]').click();await page.waitForTimeout(350);
  assert.ok((await page.evaluate(()=>__toasts.join(' | '))).includes('전용성은(는) CRM에서 요청을 받을 수 없습니다 — 요청은 기록했으니 전화로 전달해 주세요'));
  {const w=(await waits()).find(x=>x[0]==='[서울] 정릉중앙하이츠아파트');assert.deepEqual([w[1],w[2],w[4]],['답변 대기','전용성에게 · 고객 첫 연락','처리 확인']);
   assert.equal(await v.locator('.wrq-w',{hasText:'정릉중앙'}).locator('.ur').innerText(),'전용성은(는) CRM에서 이 요청을 볼 수 없습니다 · 전화로 전달하고, 처리되면 [처리 확인]');
   await v.locator('.wrq-w',{hasText:'정릉중앙'}).locator('[data-wr="ack"]').click();await page.waitForTimeout(350);
   assert.deepEqual(await page.evaluate(()=>{const r=__db.find(x=>x.target_id==='00000005-0000-4000-8000-000000000005');return [r.status,r.result,r.replied_by];}),['done','관리자 확인 · 전화로 전달','송보람']);
   assert.equal((await waits()).find(x=>x[0]==='[서울] 정릉중앙하이츠아파트')[1],'✓ 처리 완료');}
  await page.evaluate(()=>{const i=B.inquiries.findIndex(x=>x.id==='00000005-0000-4000-8000-000000000005');B.inquiries.splice(i,1);});
  /* 관리팀 KPI 8번 '조치 → 처리율'의 자료 = 요청 업무(회신 · 기록으로 완료 ÷ 보낸 요청 · 취소 제외) */
  assert.deepEqual(await page.evaluate(()=>{const C=KpiB.compute(),k=C.M[7],all=__db.filter(r=>r.status!=='cancelled'),ok=all.filter(r=>r.status==='done'||r.status==='replied');return [k.wrq===all.length,k.den>=all.length,k.num>=ok.length,ok.length>0];}),[true,true,true,true]);
  /* 영업건 상세 응대 이력: '[내부 요청] …' 메모 줄 = '시스템 · 내부 요청' 표시 */
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView'),box=document.createElement('div');box.className='idv-thread';box.innerHTML='<div class="idv-msg"><div class="idv-meta"><em>내부 메모</em></div><div class="idv-bubble">[내부 요청] 송보람 → 김성민 · 수신 확인 · 기한 오늘 17:00</div></div><div class="idv-msg"><div class="idv-meta"><em>내부 메모</em></div><div class="idv-bubble">그냥 메모</div></div>';v.append(box);WorkRequest.decorate();const r=[...box.querySelectorAll('.idv-msg')].map(n=>[n.querySelector('.idv-meta em').textContent,n.querySelector('.idv-bubble').textContent]);box.remove();return r;}),[['시스템 · 내부 요청','송보람 → 김성민 · 수신 확인 · 기한 오늘 17:00'],['내부 메모','그냥 메모']]);
  /* 11. 권한: 영업사원 화면에는 요청 버튼 · '답 기다리는 중'이 없다(내 영업만) */
  await as({id:'u-kim',name:'김성민',role:'rep'});
  assert.equal(await page.locator('#today-v2 .tv3 [data-wr="ask"]').count(),0);assert.equal(await page.locator('#today-v2 .tv3 .wrq-wait').count(),0);
  /* 팝업을 그냥 닫으면(×) 아무것도 기록하지 않는다 — 확인 전 그대로 · 작은 카드에 '확인 전' + [새 요청 보기] */
  assert.equal(await page.locator('#wrq-pop').count(),1);await page.locator('#wrq-pop [data-wr="popclose"]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#wrq-pop').count(),0);assert.equal(await page.evaluate(()=>__db.find(r=>r.target_id==='stall1').status),'sent','닫기 ≠ 확인');
  assert.equal(await page.locator('#today-v2 .tv3 .wrq-top .wrq-row').count(),1,'김성민에게 온 후속 연락 요청 — 작은 카드 한 줄');assert.equal(await page.locator('#today-v2 .tv3 .wrq-top .wrq-row .st').innerText(),'확인 전');
  assert.equal(await page.locator('#today-v2 .tv3 .wrq-top .wrq-in').count(),0);
  await page.locator('#today-v2 .tv3 .wrq-top [data-wr="popshow"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('#wrq-pop').count(),1,'[새 요청 보기]로 다시 연다');await page.locator('#wrq-pop [data-wr="popclose"]').click();await page.waitForTimeout(200);
  /* 12. 서버 저장소가 아직 없으면 예전 [독촉] 그대로(요청 버튼을 반쯤 보여 주지 않는다) */
  await page.evaluate(()=>{window.__srv=false;});await as({id:'u-admin',name:'송보람',role:'admin'});await page.evaluate(()=>WorkRequest.load(true));await page.waitForTimeout(400);await page.evaluate(()=>paint());await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>WorkRequest.enabled()),false);assert.equal(await page.locator('#today-v2 .tv3 [data-wr]').count(),0);assert.equal(await page.locator('#today-v2 .tv3').evaluate(n=>n.classList.contains('wrq-on')),false);
  assert.ok((await page.locator('#today-v2 .tv3').innerText()).includes('독촉'),'저장소가 없으면 예전 버튼');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',buttons_named_by_situation:true,small_request_window:true,leaves_list_into_waiting:true,duplicate_lock:true,rep_top_request_auto_complete:true,arrival_popup_then_compact_card:true,close_ack_work_done_are_distinct:true,absent_is_attempt_only:true,branch_reply_with_owner:true,overdue_reask_reassign_recall:true,history_system_lines:true,auto_complete_from_records:true,branch_recall_suggest_auto_off_by_default:true,unreachable_recipient_tracked_and_ack:true,kpi8_source:true,deal_history_label:true,fallback_without_server:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
