'use strict';
/* 견적문의 흐름 검사(2026-10-05 design_handoff_inquiry_flow · P0) — README 의 ✅ 확인 방법을 그대로 돌린다.
   ① 부재 저장 → 목록 '첫 연락 전' 탭에 그대로 남는다 · 2시간 첫 연락 지표 분자에 안 들어간다 · '시도 n회' · 접촉 없이 3회(간격 1일)면 연락두절 종결 제안 · 접촉을 저장하면 그때 최초응대
   ⑥ 대표회의와 자료 회신 기한은 다른 값 — D-3 탭은 대표회의만
   ⑦ 전화 응대자: 입력 → 새로 고침(서버에서 다시 읽음) → 다시 열었을 때 표시
   서버는 흉내(저장 명령 · 읽기 함수가 같은 모양으로 응답). 끄면(G.inqFlowOff) 예전 판정 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryFlow&&window.InquiryCommand&&window.InquiryListV3&&window.InquiryDetailV2&&window.InquiryWorkbench);
  await page.evaluate(()=>{
   const at=(d,h)=>new Date(Date.now()-d*864e5-(h||0)*36e5).toISOString(),day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+d*864e5));
   const A='22222222-2222-4222-8222-222222222222',R='66666666-6666-4666-8666-666666666666',M='44444444-4444-4444-8444-444444444444',C='77777777-7777-4777-8777-777777777777';
   window.__seed=()=>({deals:[],inquiries:[
    /* A: 배정됨 · 첫 연락 전(3시간 지남) */
    {id:A,site:'[경기 김포] 한강신도시반도유보라',status:'배정완료',at:at(0,3),created_at:at(0,3),brand:'석민이앤씨',phone:'031-987-1150',contact_name:'이준호',assignee:'이필선',assigned_to:'이필선',assigned_at:at(0,3),raw:{'문의내용':'지하주차장 바닥 에폭시 들뜸 보수 문의.','상담채널':'전화','전화응대자':'조현식'}},
    /* R: 이미 접촉함 · 자료 회신 기한만 있음(대표회의 없음) */
    {id:R,site:'[서울 노원] 중계청구3차',status:'배정완료',at:at(6),created_at:at(6),brand:'아파트스퀘어',phone:'02-933-1180',contact_name:'홍성우',assignee:'이필선',assigned_to:'이필선',assigned_at:at(5.9),responded_at:at(5),raw:{'문의내용':'공법 설명 자료 요청','상담채널':'홈페이지','자료 회신 기한':day(2)},activities:[{type:'전화',note:'자료 발송 안내',at:at(5),actor:'이필선'}]},
    /* M: 이미 접촉함 · 대표회의 D-2 */
    {id:M,site:'[경기 수원] 매탄임광아파트',status:'배정완료',at:at(8),created_at:at(8),brand:'POUR공법',phone:'031-214-7710',contact_name:'관리소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(7.9),responded_at:at(5),raw:{'문의내용':'외벽 재도장 견적 · 대표회의 전 자료 필요','상담채널':'전화','대표회의':day(2)},activities:[{type:'전화',note:'견적 범위 확인',at:at(5),actor:'이필선'}]},
    /* C: 예전 방식으로 부재가 최초응대가 된 문의(상태는 전화응대 완료 · 그 시각의 기록이 부재) */
    {id:C,site:'[인천] 송도더샵',status:'전화응대 완료',at:at(4),created_at:at(4),brand:'POUR솔루션',phone:'032-000-1111',contact_name:'박소장',assignee:'이필선',assigned_to:'이필선',assigned_at:at(3.9),first_response_at:at(3),raw:{'문의내용':'옥상 방수'},activities:[{id:'iq-1',type:'단계전환',note:'고객 응대 기록',result:'[전화 · 부재] 두 번 전화했으나 받지 않음',at:at(3),actor:'이필선'}]}],
    activities:[],inquiryTrash:[],expansion_pool:[]});
   B=__seed();LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.inqPeriodMode='snapshot';G.inqV3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{window.__writes.push([op,p]);return 'req-'+window.__writes.length};
   /* 서버 흉내: 저장 명령 · 읽기 함수 */
   window.__srv={};window.__rpc=[];
   const kind=r=>['부재','통화불가','번호오류'].includes(r)?'attempt':['연결됨','고객 회신','검토중','자료요청','견적요청'].includes(r)?'connected':r==='회신대기'?'wait':null;
   const st=id=>__srv[id]||(__srv[id]={inquiry_id:id,first_attempt_at:null,first_connected_at:null,attempt_count:0,connected_count:0,meeting_date:null,reply_due:null,phone_handler:null,migrated:null,logs:[],quotes:[],schedules:[],updated_at:new Date().toISOString()});
   SB={rpc:async(name,args)=>{const p=args&&args.p||{};__rpc.push([name,p]);
    if(name==='crm_inquiry_flow_list_v1')return {data:{ok:true,states:Object.values(__srv).map(x=>JSON.parse(JSON.stringify(x)))}};
    if(name==='crm_inquiry_command_v1'){const s=st(p.inquiry_id);s.updated_at=new Date().toISOString();
     if(p.type==='contact_log'){const k=kind(p.result);if(!k)return {error:{message:'invalid payload'}};if(!s.logs.some(l=>l.request_id===p.request_id)){s.logs.push({request_id:p.request_id,channel:p.channel,result:p.result,kind:k,content:p.content,next_action:p.next_action,next_check_date:p.next_check_date,occurred_at:p.occurred_at,actor_name:'송보람'});if(k==='attempt'){s.first_attempt_at=s.first_attempt_at||p.occurred_at;s.attempt_count++;}if(k==='connected'){s.first_connected_at=s.first_connected_at||p.occurred_at;s.connected_count++;}}}
     else if(p.type==='schedule_set'){if(p.schedule_type==='meeting')s.meeting_date=p.at;else s.reply_due=p.at;}
     else if(p.type==='field_set'){if(p.field!=='phone_handler')return {error:{message:'invalid payload'}};s.phone_handler=p.value;}
     else return {error:{message:'invalid payload'}};
     return {data:{ok:true,type:p.type,inquiry_id:p.inquiry_id,state:JSON.parse(JSON.stringify(s))}};}
    if(name==='crm_inquiry_field_update_v1')return {data:{ok:true,value:p.value}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>true,noteMissing:()=>{}});
   try{localStorage.removeItem('crm.inqFlow.outbox.v1');}catch(e){}
   goPage('inq');window.A=A;window.R=R;window.M=M;window.C=C;
  });
  await page.waitForTimeout(700);
  const v=page.locator('#inq-v3'),row=site=>page.locator('#inq-v3 .il-row',{hasText:site});
  const tabN=async k=>Number(await page.locator('#inq-v3 .il-tab[data-v="'+k+'"] b').innerText());
  /* 2시간 첫 연락 지표(관리 화면과 같은 식): 배정된 문의 가운데 배정 → 최초응대가 2시간 안인 건 */
  const kpi=()=>page.evaluate(()=>{const Q=B.inquiries.filter(q=>inquiryAssigned(q)),inTime=Q.filter(q=>{const f=inqCtlFirstResponseAt(q),t=Date.parse(f||''),a=Date.parse(inquiryAssignedAt(q)||q.assigned_at||inquiryCreatedAt(q)||'');return Number.isFinite(t)&&Number.isFinite(a)&&(t-a)/36e5<=2;});return [inTime.length,Q.length];});
  /* 시작 상태: A · C 는 첫 연락 전(C 는 예전에 부재가 최초응대로 찍힌 문의 — 시도로 옮겨 본다), R · M 은 접촉함 */
  assert.equal(await tabN('nofirst'),2,'첫 연락 전 = A + 예전 부재 최초응대 C');
  assert.deepEqual(await page.evaluate(()=>[C].map(id=>{const q=inqCtlFind(id,false),s=InquiryFlow.state(q);return [!!s.firstAttemptAt,s.firstConnectedAt,s.attempts,inquiryResponded(q)];})),[[true,'',1,false]],'예전 최초응대 시각의 기록이 부재면 시도로 본다');
  assert.match(await row('송도더샵').locator('.il-site em.il-tries').innerText(),/시도 1회/);
  const k0=await kpi();assert.deepEqual(k0,[0,4],'2시간 첫 연락: 분자 0(R · M 은 2시간 넘김) / 분모 4');
  /* ① 목록에서 A 에 '부재' 저장 */
  await row('한강신도시반도유보라').locator('.il-act').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#inq-v3 .il-rec .il-chip[data-il="res"]').allInnerTexts(),['연결됨','고객 회신','검토중','자료요청','견적요청','부재','통화불가','번호오류'],'결과 마스터');
  await page.locator('#inq-v3 .il-rec .il-chip[data-il="res"][data-v="부재"]').click();await page.waitForTimeout(150);
  assert.deepEqual(await page.locator('#inq-v3 .il-rec .il-chip.on').allInnerTexts(),['부재','내일'],'부재 → 내일 다시 연락 제안');
  await page.locator('#inq-v3 .il-save button').click();await page.waitForTimeout(600);
  const w1=await page.evaluate(()=>__writes.map(x=>[x[0],x[1].text||x[1].result||'']));
  assert.deepEqual(w1,[['next_action','다시 연락']],'부재 = 연락 시도: 단계 진행(inquiry_status) 없이 다음 할 일만 · 문장은 행동만 '+JSON.stringify(w1));
  const sent=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1').map(x=>[x[1].type,x[1].inquiry_id,x[1].channel,x[1].result]));
  assert.deepEqual(sent,[['contact_log','22222222-2222-4222-8222-222222222222','전화','부재']],'응대 기록은 저장 명령 하나로 서버에');
  assert.equal(await tabN('nofirst'),2,'✅ 부재 저장 뒤에도 첫 연락 전 탭에 그대로');
  assert.equal(await row('한강신도시반도유보라').locator('.il-act').innerText(),'첫 연락');assert.match(await row('한강신도시반도유보라').locator('.il-site em.il-tries').innerText(),/^ · 시도 1회$/);
  assert.match(await row('한강신도시반도유보라').locator('.il-el').innerText(),/^3시간 \d+분/,'첫 연락 지연 판정(접수부터 경과)은 그대로');
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlFind(A,false),s=InquiryFlow.state(q);return [q.status,inqCtlFirstResponseAt(q),inquiryResponded(q),!!s.firstAttemptAt,s.attempts,s.unreachable];}),['배정완료','',false,true,1,false]);
  assert.deepEqual(await kpi(),k0,'✅ 2시간 첫 연락 지표 분자에 들어가지 않는다');
  assert.equal(await page.evaluate(()=>InquiryFlow.server(inqCtlFind(A,false)).attempt_count),1,'서버 상태: 시도 1 · 최초 접촉 없음');
  if(shot)await page.screenshot({path:shot+'-attempt.png'});
  /* 접촉 없이 3회(하루 간격) → 연락두절 종결 제안(제안만 — 상태는 그대로) */
  await page.evaluate(()=>{const q=inqCtlFind(A,false),p=itemPatch(q,'inq');const at=d=>new Date(Date.now()-d*864e5).toISOString();
   p.activities.push({id:'fu-a',type:'전화',note:'고객 응대 기록',result:'[전화 · 통화불가] ',at:at(2),actor:'이필선',flow:{ch:'전화',res:'통화불가',kind:'attempt',rid:''}},{id:'fu-b',type:'전화',note:'고객 응대 기록',result:'[전화 · 부재] ',at:at(1),actor:'이필선'});paint();});await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>{const s=InquiryFlow.state(inqCtlFind(A,false));return [s.attempts,s.spaced,s.unreachable,inqCtlFind(A,false).status];}),[3,3,true,'배정완료']);
  assert.match(await row('한강신도시반도유보라').locator('.il-site em.il-tries').innerText(),/^ · 시도 3회 · 연락두절 종결 제안$/);
  await page.evaluate(()=>InquiryWorkbench.open(A));await page.waitForTimeout(400);
  const d=page.locator('#inq-inbox-dialog.idv.idv3');assert.equal(await d.count(),1);
  assert.match(await d.locator('.idv3-pill').innerText(),/^첫 연락 전 · .+ · 시도 3회$/);assert.match(await d.locator('.idv3-opener').innerText(),/접촉 없이 시도 3회 — 연락두절로 종결할 수 있습니다/);
  assert.match(await d.locator('.idv3-chead').innerText(),/시도 3 · 연결 0$/);
  /* 같은 날 여러 번은 간격(1일)을 지킨 시도로 한 번만 센다 */
  assert.deepEqual(await page.evaluate(()=>{const q={id:'x',status:'배정완료',activities:[0,1,2].map(i=>({id:'t'+i,type:'전화',note:'고객 응대 기록',result:'[전화 · 부재]',at:new Date(Date.now()-i*6e5).toISOString()}))};const s=InquiryFlow.state(q);return [s.attempts,s.spaced,s.unreachable];}),[3,1,false]);
  /* 접촉(연결됨)을 저장하면 그때 최초응대: 단계 진행 1건 + 서버 최초 접촉 시각 */
  await page.evaluate(()=>{__writes.length=0;});
  await d.locator('.idv3-rc',{hasText:/^연결됨$/}).click();await page.waitForTimeout(150);await d.locator('#iq-res').fill('소장님과 통화 · 방문 일정 조율');await d.locator('.idv3-foot .idv-save').click();await page.waitForTimeout(700);
  const w2=await page.evaluate(()=>__writes.map(x=>[x[0],x[1].intent||'',x[1].result||x[1].text||'']));
  assert.equal(w2.length,1,JSON.stringify(w2));assert.equal(w2[0][0],'inquiry_status');assert.equal(w2[0][1],'progress');assert.match(w2[0][2],/^\[전화 · 연결됨\] 소장님과 통화/);
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlFind(A,false),s=InquiryFlow.state(q),S=InquiryFlow.server(q);return [!!inqCtlFirstResponseAt(q),inquiryResponded(q),s.attempts,!!S.first_connected_at,S.attempt_count,S.connected_count];}),[true,true,3,true,1,1],'접촉 뒤: 최초응대 완료 · 그 전 시도 수는 남는다');
  assert.equal(await tabN('nofirst'),1,'접촉하면 첫 연락 전 탭에서 빠진다');assert.deepEqual(await kpi(),[0,4],'늦은 접촉(2시간 넘김)은 분자에 안 들어간다');
  assert.equal(await page.evaluate(()=>!!document.querySelector('body>#iq-did,body>#iq-next,body>#iq-due,#inqActText,#inqActDue')),false,'임시 입력칸은 남기지 않는다');
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(200);
  /* 배정 직후 2시간 안 접촉 → 분자에 들어간다 */
  await page.evaluate(()=>{const N='88888888-8888-4888-8888-888888888888',now=new Date(Date.now()-36e5).toISOString();B.inquiries.push({id:N,site:'[부산] 해운대자이',status:'배정완료',at:now,created_at:now,brand:'석민이앤씨',phone:'051-000-2222',contact_name:'김소장',assignee:'이필선',assigned_to:'이필선',assigned_at:now,raw:{'문의내용':'주차장 방수'}});window.N=N;__writes.length=0;
   InquiryCommand.run('contact_log',inqCtlFind(N,false),{ch:'전화',result:'고객 회신',text:'문자 보고 전화 주심',next:'다시 연락',due:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+3*864e5))});paint();});await page.waitForTimeout(500);
  assert.deepEqual(await kpi(),[1,5],'2시간 안 접촉은 분자 +1');
  /* ⑥ 대표회의 ≠ 자료 회신 기한: D-3 탭은 대표회의만 */
  await page.locator('#inq-v3 .il-tab[data-v="meet"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await v.locator('.il-row .il-site b').allInnerTexts(),['[경기 수원] 매탄임광아파트'],'자료 회신 기한만 있는 문의는 대표회의 D-3 탭에 안 나온다');
  assert.deepEqual(await page.evaluate(()=>{const L=InquiryListV3,r=inqCtlFind(R,false),m=inqCtlFind(M,false);return [!!L.meetOf(r),L.replyOf(r).dd,L.meetOf(m).dd,!!L.replyOf(m)];}),[false,2,2,false]);
  await page.locator('#inq-v3 .il-tab[data-v="all"]').click();await page.waitForTimeout(200);
  /* 대표회의 · 회신 기한 저장 = 일정으로 따로(schedule_set) */
  await page.evaluate(()=>{__rpc.length=0;return Promise.all([InquiryCommand.run('field_set',inqCtlFind(R,false),{field:'meeting_date',value:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+864e5))}),InquiryCommand.run('schedule_set',inqCtlFind(M,false),{schedule_type:'reply_due',at:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+5*864e5))})]).then(()=>paint());});await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1').map(x=>[x[1].type,x[1].schedule_type])),[['schedule_set','meeting'],['schedule_set','reply_due']]);
  assert.deepEqual(await page.evaluate(()=>{const L=InquiryListV3,r=inqCtlFind(R,false),m=inqCtlFind(M,false);return [L.meetOf(r).dd,L.replyOf(r).dd,L.meetOf(m).dd,L.replyOf(m).dd];}),[1,2,2,5],'둘은 서로 덮어쓰지 않는다');
  /* ⑦ 전화 응대자: 시트 값이 보이고 → 입력 → 새로 고침(문의를 서버에서 다시 읽음) → 다시 열면 그대로 */
  const handler=()=>page.evaluate(()=>new Map(InquiryWorkbench.sourceFields(inqCtlFind(A,false))).get('전화 응대자'));
  assert.equal(await handler(),'조현식','시트 열(전화응대자) 값이 보인다');
  await page.evaluate(()=>{__rpc.length=0;return InquiryCommand.run('field_set',inqCtlFind(A,false),{field:'responder',value:'황윤선'});});
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1').map(x=>[x[1].type,x[1].field,x[1].value])),[['field_set','phone_handler','황윤선']],'저장 이름은 phone_handler 하나');
  assert.equal(await handler(),'황윤선');
  await page.evaluate(()=>{B=__seed();LOCAL={deals:{},inquiries:{}};InquiryFlow._reset();paint();return InquiryFlow.load(true);});await page.waitForTimeout(400);
  assert.equal(await handler(),'황윤선','✅ 새로 고친 뒤에도 표시(시트가 문의를 다시 덮어써도 남는다)');
  await page.evaluate(()=>{G.inqDetailV3Off=true;InquiryWorkbench.open(A);});await page.waitForTimeout(400);
  assert.match(await page.locator('#inq-inbox-dialog .idv-info').innerText(),/응대\s*황윤선/,'상세 문의 정보 칸에도 같은 값');
  await page.evaluate(()=>{InquiryWorkbench.close();G.inqDetailV3Off=false;});
  /* 새로 고친 뒤(이 PC 기록 없음)에도 서버 흐름 상태로 같은 판정 */
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlFind(A,false),s=InquiryFlow.state(q);return [!!s.firstConnectedAt,s.logs.filter(l=>l.server).length];}),[true,2],'다른 PC 에서도 같은 최초응대 · 같은 이력');
  /* 끄기: 예전 판정(어떤 기록이든 최초응대) */
  await page.evaluate(()=>{G.inqFlowOff=true;paint();});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>!!inqCtlFirstResponseAt(inqCtlFind(C,false))),true,'끄면 예전 판정');
  assert.deepEqual(await page.evaluate(()=>{const b=document.createElement('div');return InquiryListV3.meetOf(inqCtlFind(R,false))?1:0;}),1,'끄면 회신 기한도 D-3 판정에 섞이는 예전 방식');
  await page.evaluate(()=>{G.inqFlowOff=false;paint();});await page.waitForTimeout(200);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',attempt_keeps_no_first_tab:true,kpi_2h_numerator_excludes_attempt:true,attempt_count_and_unreachable_suggestion:true,first_connected_on_contact:true,single_command:true,meeting_vs_reply_due:true,phone_handler_survives_reload:true,server_state_shared:true,off_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
