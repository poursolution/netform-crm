'use strict';
/* 견적문의 흐름 검사(2026-10-05 design_handoff_inquiry_flow · P0) — README 의 ✅ 확인 방법을 그대로 돌린다.
   ① 부재 저장 → 목록 '첫 연락 전' 탭에 그대로 남는다 · 2시간 첫 연락 지표 분자에 안 들어간다 · '시도 n회' · 접촉 없이 3회(간격 1일)면 연락두절 종결 제안 · 접촉을 저장하면 그때 최초응대
   ⑥ 대표회의와 자료 회신 기한은 다른 값 — D-3 탭은 대표회의만
   ⑦ 전화 응대자: 입력 → 새로 고침(서버에서 다시 읽음) → 다시 열었을 때 표시
   ② 종결 4종 — 사유 필수 · 고르는 즉시 종결 · '배드핏 종결 검토' 다음 할 일 없음 · 다른 업체 선택 = 상담종결
   ③ 문자 = 1:1 문자 보내기(가운데 칸 · design_handoff_inquiry_sms) → 응대 기록 '문자 · 회신대기'(연락 시도). CRM 발송 큐 · 목록 문자 버튼 · 문자 탭은 없음
   ④ 전환 = 1차 현장방문 완료 또는 견적 발송 완료 중 먼저('예정'은 전환 아님) — 상세 문구 · 전환 대기 목록 · 전송 계층이 같은 기준
   ⑤ 견적 = 버전(금액은 원 · 다음 할 일 문장에 금액 없음) · 보내면 후속 할 일 = 보낸 날 + 7일 '고객 반응 확인'
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
    if(name==='crm_inquiry_flow_list_v1')return {data:{ok:true,states:Object.values(__srv).map(x=>JSON.parse(JSON.stringify(x))),closed:window.__closed||[]}};
    if(name==='crm_inquiry_command_v1'){const s=st(p.inquiry_id);let extra={};s.updated_at=new Date().toISOString();
     if(p.type==='contact_log'){const k=kind(p.result);if(!k)return {error:{message:'invalid payload'}};if(!s.logs.some(l=>l.request_id===p.request_id)){s.logs.push({request_id:p.request_id,channel:p.channel,result:p.result,kind:k,content:p.content,next_action:p.next_action,next_check_date:p.next_check_date,occurred_at:p.occurred_at,actor_name:'송보람'});if(k==='attempt'){s.first_attempt_at=s.first_attempt_at||p.occurred_at;s.attempt_count++;}if(k==='connected'){s.first_connected_at=s.first_connected_at||p.occurred_at;s.connected_count++;}}}
     else if(p.type==='schedule_set'){if(p.schedule_type==='meeting')s.meeting_date=p.at;else s.reply_due=p.at;}
     else if(p.type==='field_set'){if(p.field!=='phone_handler')return {error:{message:'invalid payload'}};s.phone_handler=p.value;}
     else if(p.type==='close'){const L={bad_fit:['Bad Fit','배드핏'],unreachable:['연락두절','연락두절'],consult_end:['상담종결','종결']}[p.kind];if(!L)return {error:{message:'invalid payload'}};const reason=p.kind==='unreachable'?'시도 '+Math.max(s.attempt_count,p.attempts||0)+'회':p.reason;s.close_kind=p.kind;s.close_reason=reason;s.close_detail=p.detail||null;extra={status:L[1],close_reason:L[0]+' · '+reason+(p.detail?' — '+p.detail:''),close_kind:p.kind};}
     else if(p.type==='visit'){if(p.done){s.visit_done_at=s.visit_done_at||new Date().toISOString();s.qualified_at=s.qualified_at||s.visit_done_at;s.qualified_by=s.qualified_by||'visit_done';}}
     else if(p.type==='quote_send'){const last=s.quotes[s.quotes.length-1],sent=p.draft?null:(p.sent_at||new Date().toISOString());let ver;if(last&&!last.sent_at){last.amount=p.amount;last.sent_at=sent;ver=last.version_no;}else{ver=s.quotes.length+1;s.quotes.push({version_no:ver,amount:p.amount,sent_at:sent,method:p.method||null,change_reason:p.change_reason||null,author_name:'송보람',created_at:new Date().toISOString()});}
      extra={version_no:ver,draft:!!p.draft};if(!p.draft){s.quote_sent_at=s.quote_sent_at||sent;s.qualified_at=s.qualified_at||sent;s.qualified_by=s.qualified_by||'quote_sent';extra.next_action_id='99999999-9999-4999-8999-999999999999';extra.next_action_date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+7*864e5));extra.next_action_text='고객 반응 확인';}}
     else return {error:{message:'invalid payload'}};
     return {data:Object.assign({ok:true,type:p.type,inquiry_id:p.inquiry_id,state:JSON.parse(JSON.stringify(s))},extra)};}
    if(name==='crm_inquiry_field_update_v1')return {data:{ok:true,value:p.value}};
    return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:n=>true,noteMissing:()=>{}});
   try{localStorage.removeItem('crm.inqFlow.outbox.v1');}catch(e){}
   G.inqV4Off=true;/* 흐름 판정 · 저장을 목록 v3 의 줄에서 누르며 본다(끄기 스위치 뒤) — 보이는 화면의 저장은 verify-inquiry-v4-browser.cjs */goPage('inq');window.A=A;window.R=R;window.M=M;window.C=C;
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
  assert.deepEqual(await page.evaluate(()=>{const noon=Date.parse('2026-10-08T12:00:00+09:00');const q={id:'x',status:'배정완료',activities:[0,1,2].map(i=>({id:'t'+i,type:'전화',note:'고객 응대 기록',result:'[전화 · 부재]',at:new Date(noon-i*6e5).toISOString()}))};const s=InquiryFlow.state(q);return [s.attempts,s.spaced,s.unreachable];}),[3,1,false]);
  /* 접촉(연결됨)을 저장하면 그때 최초응대: 단계 진행 1건 + 서버 최초 접촉 시각 */
  await page.evaluate(()=>{__writes.length=0;});
  await d.locator('.idv3-rc',{hasText:/^연결됨$/}).click();await page.waitForTimeout(150);await d.locator('.idv3-rc',{hasText:/^관심 있음$/}).click();await page.waitForTimeout(150);await d.locator('#iq-res').fill('소장님과 통화 · 방문 일정 조율');await d.locator('.idv3-foot .idv-save').click();await page.waitForTimeout(700);
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
  /* ── ② 종결 4종 ── */
  const modal=page.locator('#inquiryControlModal.on'),day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+d*864e5));
  await page.evaluate(()=>{__writes.length=0;__rpc.length=0;InquiryWorkbench.open(R);});await page.waitForTimeout(400);
  const dd=page.locator('#inq-inbox-dialog.idv.idv3');
  assert.deepEqual(await dd.locator('.idv3-res .idv3-rc').allInnerTexts(),['연결됨','회신 받음','부재','번호 오류','배드핏']);
  await dd.locator('.idv3-rc',{hasText:/^배드핏$/}).click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#inquiryControlTitle').innerText(),'문의 종결','[배드핏] 칩 = 종결 창(다음 할 일을 만들지 않는다)');
  assert.deepEqual(await modal.locator('#inq-close-type option').evaluateAll(l=>l.map(n=>n.value)),['bad_fit','unreachable','consult_end','transfer'],'종결 4종');assert.equal(await modal.locator('#inq-close-type').inputValue(),'bad_fit');
  assert.deepEqual(await modal.locator('#inq-close-kind option').allInnerTexts(),['사유를 골라 주세요'].concat(await page.evaluate(()=>CRMRules.reasons('bad_fit'))),'Bad Fit 사유 = 운영 기준 목록(다른 업체 선택은 없다)');assert.deepEqual(await page.evaluate(()=>CRMRules.reasons('bad_fit')),['수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타']);
  await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(150);assert.match(await modal.locator('#inq-ctl-error').innerText(),/Bad Fit 사유를 골라 주세요/,'사유 필수');
  await modal.locator('#inq-close-kind').selectOption('기타');await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(150);assert.match(await modal.locator('#inq-ctl-error').innerText(),/기타 사유는 메모에/);
  await modal.locator('#inq-close-type').selectOption('consult_end');await page.waitForTimeout(150);
  assert.deepEqual(await modal.locator('#inq-close-kind option').allInnerTexts(),['사유를 골라 주세요','계획 없음','단순 문의','타사 선택'],'다른 업체 선택 = 상담종결');
  await modal.locator('#inq-close-kind').selectOption('타사 선택');await modal.locator('#inq-ctl-reason').fill('다른 업체와 계약');if(shot)await page.screenshot({path:shot+'-close.png'});await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1'&&x[1].type==='close').map(x=>[x[1].kind,x[1].reason,x[1].detail])),[['consult_end','타사 선택','다른 업체와 계약']]);
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlAll().find(x=>x.id===R),c=InquiryFlow.closeOf(q);return [q.status,q.close_reason,c.kind,c.reason,BriefB.badfitReason(q),__writes.length];}),['종결','상담종결 · 타사 선택 — 다른 업체와 계약','consult_end','타사 선택','상담종결 · 타사 선택',0],'고르는 즉시 종결 · 배드핏 종결 검토 같은 다음 할 일 없음');
  assert.equal(await page.locator('#inquiryControlModal.on').count(),0);assert.equal(await page.locator('#inq-inbox-dialog').count(),0,'종결하면 상세도 닫는다');assert.equal(await row('중계청구3차').count(),0,'종결 건은 목록에서 빠진다');
  /* 연락두절: 시도 횟수 자동 · 접촉한 문의는 못 고른다 */
  await page.evaluate(()=>inqCtlOpenClose(A));await page.waitForTimeout(200);await modal.locator('#inq-close-type').selectOption('unreachable');await page.waitForTimeout(150);
  assert.match(await modal.locator('#inq-close-auto').innerText(),/이미 접촉한 문의입니다 — 상담종결을 골라 주세요/);await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(200);assert.match(await modal.locator('#inq-ctl-error').innerText(),/이미 접촉한 문의/);await page.evaluate(()=>closeInquiryControlModal());
  await page.evaluate(()=>{__rpc.length=0;inqCtlOpenClose(C);});await page.waitForTimeout(200);await modal.locator('#inq-close-type').selectOption('unreachable');await page.waitForTimeout(150);
  assert.match(await modal.locator('#inq-close-auto').innerText(),/^접촉 없이 시도 1회$/);if(shot)await page.screenshot({path:shot+'-close2.png'});await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlAll().find(x=>x.id===C),c=InquiryFlow.closeOf(q);return [q.status,q.close_reason,c.kind,BriefB.badfitReason(q)];}),['연락두절','연락두절 · 시도 1회','unreachable','연락두절']);
  /* Bad Fit: 고르는 즉시 종결 */
  await page.evaluate(()=>{__writes.length=0;inqCtlOpenClose(M);});await page.waitForTimeout(200);await modal.locator('#inq-close-kind').selectOption('규모 부적합');await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlAll().find(x=>x.id===M),c=InquiryFlow.closeOf(q);return [q.status,q.close_reason,c.kind,c.reason,BriefB.badfitReason(q),__writes.length];}),['배드핏','Bad Fit · 규모 부적합','bad_fit','규모 부적합','규모 부적합',0]);
  /* 예전 자료 읽기: 종류가 안 적힌 종결 = 사유 미기록, 예전 배드핏 종결 글 = Bad Fit */
  assert.deepEqual(await page.evaluate(()=>[{status:'종결'},{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 규모 부적합 · 이전 상태: 접수'},{status:'배드핏',close_reason:'배드핏 · 공사범위 밖'},{status:'POUR스토어 이관대기'},{status:'배정완료'}].map(q=>{const c=InquiryFlow.closeOf(q);return c?c.kind+'|'+c.reason:null;})),['unknown|','bad_fit|규모 부적합','bad_fit|공사범위 밖','transfer|POUR스토어',null]);
  /* 서버에서 따로 읽은 종결 사유 글(기본 읽기는 이 칸을 내려 주지 않는다) → 닫힌 예전 문의도 종류 · 사유가 보인다 */
  assert.deepEqual(await page.evaluate(async()=>{const Z='99999999-0000-4000-8000-0000000000aa',q={id:Z,status:'배드핏'};const before=InquiryFlow.closeOf(q).reason+'|'+BriefB.badfitReason(q);window.__closed=[{inquiry_id:Z,status:'배드핏',close_reason:'배드핏 · 공사범위 밖'}];await InquiryFlow.load(true);const c=InquiryFlow.closeOf(q);return [before,c.kind+'|'+c.reason,BriefB.badfitReason(q)];}),['|사유 미기록','bad_fit|공사범위 밖','공사범위 밖']);
  /* 스토어 이관 / B2B 협약 = 기존 전용 처리로 */
  await page.evaluate(()=>{const X='99999999-0000-4000-8000-000000000001',now=new Date(Date.now()-864e5).toISOString();B.inquiries.push({id:X,site:'[대전] 둔산자이',status:'전화응대 완료',at:now,created_at:now,brand:'POUR솔루션',phone:'042-000-3333',contact_name:'최소장',assignee:'이필선',assigned_to:'이필선',assigned_at:now,responded_at:now,raw:{'문의내용':'자재만 구매 문의'}});window.X=X;inqCtlOpenClose(X);});await page.waitForTimeout(200);
  await modal.locator('#inq-close-type').selectOption('transfer');await page.waitForTimeout(150);assert.deepEqual(await modal.locator('#inq-close-kind option').allInnerTexts(),['이관처를 골라 주세요','POUR스토어','B2B 협약']);assert.equal(await modal.locator('#inq-ctl-confirm').innerText(),'이관 처리로');
  await modal.locator('#inq-close-kind').selectOption('B2B 협약');await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(200);assert.match(await modal.locator('#inq-ctl-error').innerText(),/공종이 협약인 문의만/,'다른 문의를 협약으로 바꾸지 않는다');
  await modal.locator('#inq-close-kind').selectOption('POUR스토어');await modal.locator('#inq-ctl-confirm').click();await page.waitForTimeout(250);assert.equal(await page.locator('#inquiryControlTitle').innerText(),'POUR스토어 이관','스토어 이관 = 기존 이관 창');await page.evaluate(()=>closeInquiryControlModal());
  /* ── ③ 문자 탭 · CRM 발송 큐 없음 · 수단 문자 = 가운데 칸 문자 보내기 → 기록(회신대기 = 연락 시도) ── */
  await page.evaluate(()=>{__rpc.length=0;__writes.length=0;InquiryWorkbench.open(X);});await page.waitForTimeout(400);
  assert.deepEqual(await dd.locator('.idv3-tabs [role=tab]').allInnerTexts(),['응대 기록','내부 메모'],'상세 문자 탭 없음');
  await dd.locator('.idv3-rc',{hasText:/^연결됨$/}).click();await page.waitForTimeout(150);await dd.locator('.idv3-rc',{hasText:/^관심 있음$/}).click();await page.waitForTimeout(150);await dd.locator('[data-idv="edit-sug"]').click();await page.waitForTimeout(150);
  await dd.locator('.idv-sugedit .idv-chip[data-idv="ch"][data-v="문자"]').click();await page.waitForTimeout(250);
  assert.equal(await dd.locator('.idv3-smswrap .ds2.iq-ds2 [data-idv="smstext"]').count(),1,'수단 문자 = 가운데 칸 문자 보내기');assert.equal(await dd.locator('[data-idv="sms-crm"]').count(),0,'CRM 직접 발송 버튼 없음');
  assert.deepEqual(await dd.locator('.ds2-ft button').evaluateAll(l=>l.map(n=>n.dataset.idv)),['sms-back','sms-copy','sms-go']);
  await dd.locator('.ds2-ft [data-idv="sms-go"]').click();await page.waitForTimeout(600);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1').map(x=>[x[1].type,x[1].channel,x[1].result])),[['contact_log','문자','회신대기']],'보낸 문자 = 응대 기록(수단 문자 · 회신대기)');
  assert.equal(await page.evaluate(()=>__rpc.filter(x=>/sms_request|sms_list/.test(x[0])).length),0,'문자 발송 큐 함수는 부르지 않는다');assert.ok(await dd.locator('.idv3-res').count()>=1,'기록하면 응대 기록 칸으로 돌아온다');/* 결과 두 줄이면 2줄 */
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(200);
  /* ── ④ ⑤ 전환 기준 하나 · 견적 = 버전 ── */
  assert.equal(await page.evaluate(()=>InquiryFlow.QUALIFY_TEXT),'1차 현장방문 완료 또는 견적 발송 완료 중 먼저 → 파이프라인 전환');
  assert.deepEqual(await page.evaluate(()=>['현장방문예정','현장방문 완료','견적서 발송예정','견적서 발송완료','전화응대 완료'].map(s=>[InquiryFlow.statusQualifies(s),InquiryFlow.isQualified({status:s}),inqStatusQualifies(s)].join())),['false,false,false','true,true,true','false,false,false','true,true,true','false,false,false'],'예정은 전환 기준이 아니다 — 판정 함수 하나');
  /* 견적 발송 예정: 금액은 견적 초안으로 · 다음 할 일 문장에 금액 없음 · 전환 안 함 */
  await page.evaluate(()=>{__rpc.length=0;__writes.length=0;InquiryWorkbench.open(X);});await page.waitForTimeout(400);
  assert.match(await dd.locator('.idv3-next small').innerText(),/^1차 현장방문 완료 또는 견적 발송 완료 중 먼저 → 파이프라인 전환$/,'상세 문구 = 같은 기준');
  await dd.locator('.idv3-next [data-idv="step"][data-v="quote"]').click();await page.waitForTimeout(150);await dd.locator('[data-idv="quoteAmt"]').fill('1850');await dd.locator('[data-idv="quoteDate"]').fill(day(2));await page.waitForTimeout(200);
  assert.equal(await dd.locator('[data-idv="handoff"]').innerText(),'저장','발송 예정 = 저장만');await dd.locator('[data-idv="handoff"]').click();await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1').map(x=>[x[1].type,x[1].amount,x[1].draft])),[['quote_send',18500000,true]],'금액 = 견적 초안(원)');
  assert.deepEqual(await page.evaluate(()=>__writes.map(x=>[x[0],x[1].text||''])),[['next_action','견적서 발송']],'다음 할 일 문장에 금액을 넣지 않는다 · 전환 요청 없음');
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlFind(X,false);return [q.status,inqCtlConverted(q),InquiryFlow.isQualified(q),isAwaitingPromotion(q),InquiryConversion.candidates().length];}),['견적서 발송예정',false,false,false,0],'발송 예정은 전환 · 전환 대기가 아니다');
  /* 견적 발송 완료: 버전에 보낸 날 · 후속 할 일 = +7일 고객 반응 확인 · 파이프라인 전환 */
  await page.evaluate(()=>{__rpc.length=0;__writes.length=0;if(!document.getElementById('inq-inbox-dialog'))InquiryWorkbench.open(X);});await page.waitForTimeout(400);
  await dd.locator('.idv3-next [data-idv="step"][data-v="quote"]').click();await page.waitForTimeout(150);await dd.locator('[data-idv="quoteMode"][data-v="완료"]').click();await page.waitForTimeout(150);
  assert.equal(await dd.locator('[data-idv="handoff"]').isDisabled(),true,'발송 완료는 금액이 있어야 한다');await dd.locator('[data-idv="quoteAmt"]').fill('1850');await page.waitForTimeout(150);
  assert.equal(await dd.locator('[data-idv="handoff"]').innerText(),'저장하고 파이프라인으로');await dd.locator('[data-idv="handoff"]').click();await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_inquiry_command_v1').map(x=>[x[1].type,x[1].amount,x[1].draft])),[['quote_send',18500000,false]]);
  const after=await page.evaluate(()=>{const q=inqCtlFind(X,false),p=itemPatch(q,'inq'),S=InquiryFlow.server(q),w=__writes.map(x=>[x[0],x[1].stage_code||'',x[1].reason||x[1].text||'']);const add=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));return {st:q.status,conv:!!inqCtlConverted(q),by:InquiryFlow.qualifiedBy(q),na:[p.nextActionObj&&p.nextActionObj.text,p.nextActionObj&&p.nextActionObj.due===add(7)],quotes:InquiryFlow.quotes(q).map(v=>[v.version_no,v.amount,!!v.sent_at]),w};});
  assert.equal(after.st,'견적서 발송완료');assert.equal(after.conv,true,'견적 발송 완료 = 전환');assert.equal(after.by,'quote_sent');assert.deepEqual(after.na,['고객 반응 확인',true],'후속 할 일 = 보낸 날 + 7일 · 고객 반응 확인(같은 날 아님)');
  assert.deepEqual(after.quotes,[[1,18500000,true]],'초안이던 v1 에 보낸 날이 찍힌다');assert.deepEqual(after.w,[['opportunity_create','sent','견적 발송완료로 파이프라인 인계']],'전환 요청 1건 · 다음 할 일 문장에 금액 없음');
  /* 1차 현장방문: 예정 = 저장만 / 완료 = 전환(컨설팅 설계) */
  await page.evaluate(()=>{const mk=(id,site)=>{const now=new Date(Date.now()-864e5).toISOString();return {id,site,status:'전화응대 완료',at:now,created_at:now,brand:'석민이앤씨',phone:'031-111-2222',contact_name:'소장',assignee:'이필선',assigned_to:'이필선',assigned_at:now,responded_at:now,raw:{'문의내용':'외벽 균열 보수'}};};window.V1='99999999-0000-4000-8000-000000000002';window.V2='99999999-0000-4000-8000-000000000003';B.inquiries.push(mk(V1,'[경기 화성] 동탄시범'),mk(V2,'[경기 안산] 고잔푸르지오'));__rpc.length=0;__writes.length=0;InquiryWorkbench.open(V1);});await page.waitForTimeout(400);
  await dd.locator('.idv3-next [data-idv="step"][data-v="visit"]').click();await page.waitForTimeout(150);assert.deepEqual(await dd.locator('[data-idv="visitMode"]').evaluateAll(l=>l.map(n=>n.textContent+':'+n.getAttribute('aria-pressed'))),['방문 예정:true','방문 완료:false']);
  await dd.locator('[data-idv="visitDate"]').fill(day(3));await dd.locator('[data-idv="visitTime"]').fill('14:00');await page.waitForTimeout(200);assert.equal(await dd.locator('[data-idv="handoff"]').innerText(),'저장');await dd.locator('[data-idv="handoff"]').click();await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlFind(V1,false);return [q.status,inqCtlConverted(q),InquiryFlow.isQualified(q),__writes.map(x=>x[0]+':'+(x[1].text||'')).join(),__rpc.filter(x=>x[0]==='crm_inquiry_command_v1').map(x=>x[1].type+':'+x[1].done).join()];}),['현장방문예정',false,false,'next_action:현장방문 14:00','visit:false'],'방문 예정은 전환이 아니다');
  await page.evaluate(()=>{__rpc.length=0;__writes.length=0;if(!document.getElementById('inq-inbox-dialog'))InquiryWorkbench.open(V1);});await page.waitForTimeout(400);
  await dd.locator('.idv3-next [data-idv="step"][data-v="visit"]').click();await page.waitForTimeout(150);await dd.locator('[data-idv="visitMode"][data-v="완료"]').click();await page.waitForTimeout(150);await dd.locator('[data-idv="visitDate"]').fill(day(0));await page.waitForTimeout(200);
  assert.equal(await dd.locator('[data-idv="handoff"]').innerText(),'저장하고 파이프라인으로');await dd.locator('[data-idv="handoff"]').click();await page.waitForTimeout(800);
  assert.deepEqual(await page.evaluate(()=>{const q=inqCtlFind(V1,false);return [q.status,!!inqCtlConverted(q),InquiryFlow.qualifiedBy(q),JSON.stringify(__writes.map(x=>[x[0],x[1].stage_code||'',x[1].reason||'']))];}),['현장방문 완료',true,'visit_done',JSON.stringify([['opportunity_create','consulting','현장방문 완료 상태로 파이프라인 인계']])],'1차 현장방문 완료 = 전환(컨설팅 설계)');
  /* 서버 흐름 함수가 아직 없으면(SQL 적용 전) 방문 완료는 저장만 하고 전환 요청을 보내지 않는다 — 전환 대기로 남는다 */
  assert.deepEqual(await page.evaluate(async()=>{const keep=CRMRelease.has;CRMRelease.has=n=>!/^crm_inquiry_(command|flow_list)_v1$/.test(n);__writes.length=0;const q=inqCtlFind(V2,false);
   const r=await InquiryCommand.run('visit',q,{date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()),done:true});CRMRelease.has=keep;
   return [q.status,r.promoted,/서버 적용 뒤/.test(r.msg),__writes.filter(x=>x[0]==='opportunity_create').length,InquiryFlow.isQualified(q),isAwaitingPromotion(q)];}),['현장방문 완료',false,true,0,true,true],'SQL 적용 전: 저장만 · 전환 대기');
  /* 전송 계층도 같은 기준: 현장방문 완료는 받고, 예정은 거절 */
  assert.deepEqual(await page.evaluate(()=>{const P=s=>({intent:'inquiry_promote_create',inquiry_id:V2,promotion_mode:'auto',inquiry_status:s,owner:'이필선',from:'',to:/견적.*발송\s*완료/.test(s)?'sent':'consulting',note:/견적.*발송\s*완료/.test(s)?'견적 발송완료로 파이프라인 인계':/견적.*발송/.test(s)?'견적 준비 단계로 파이프라인 인계':s+' 상태로 파이프라인 인계',name:'고잔푸르지오',work_name:'',brand:'석민이앤씨',client_ref:'local-1'});return ['현장방문 완료','견적서 발송완료','현장방문예정','전화응대 완료'].map(s=>{try{OperationalAdapter.normalize('opportunity_create',V2,0,P(s));return 'ok';}catch(e){return String(e.code||e.message);}});}),['ok','ok','INQUIRY_PROMOTION_INTENT_NOT_CONNECTED','INQUIRY_PROMOTION_INTENT_NOT_CONNECTED']);
  if(shot)await page.screenshot({path:shot+'-flow2.png'});
  await page.evaluate(()=>InquiryWorkbench.close());await page.waitForTimeout(200);
  /* 끄기: 예전 판정(어떤 기록이든 최초응대) */
  await page.evaluate(()=>{G.inqFlowOff=true;paint();});await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>!!inqCtlFirstResponseAt(inqCtlFind(C,false))),true,'끄면 예전 판정');
  assert.equal(await page.evaluate(()=>QUALIFY_ST.test('견적서 발송예정')&&inqStatusQualifies('견적서 발송예정')),true,'끄면 예전 전환 기준(발송 예정도 전환)');
  await page.evaluate(()=>{G.inqFlowOff=false;paint();});await page.waitForTimeout(200);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',close_four_kinds_reason_required:true,no_direct_sms_ui:true,one_qualified_rule:true,quote_versions_followup_7d:true,attempt_keeps_no_first_tab:true,kpi_2h_numerator_excludes_attempt:true,attempt_count_and_unreachable_suggestion:true,first_connected_on_contact:true,single_command:true,meeting_vs_reply_due:true,phone_handler_survives_reload:true,server_state_shared:true,off_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
