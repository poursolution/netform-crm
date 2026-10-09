'use strict';
/* 7단계 2차 보완 검사(2026-10-07 design_handoff_stage7_2 · 시안 '7단계 2차 보완 시안.dc.html') — 합성 자료(현장 이름은 지어낸 것)
   ① 상태 분류 ≠ 업무 기한: 미확인이어도 이미 잡힌 연락 약속은 그대로('35일 지남 · M/D 약속') · '기한 없음'은 다음 행동일이 없을 때만
   ② 재분류 창: 날짜 입력 → 상태 → 사유 → 다음 확인일 · 저장 전 '지금 → 저장 후' · 기존 업무는 날짜만 바꾸고(같은 내용) 새로 추가하지 않음 · 날짜를 안 바꾸면 업무를 건드리지 않음
   ③ 관리 기간: 일반관리 = 발송일부터 총 3개월('해석 미확정') ④ 설정: 확정 / 잠정 + 출처 · '적용 예정' 목록
   ⑤ 계약 · 시공 4상태(착공일이 있어야 시공 중) ⑥⑦ 실주 기록 완료 = 사유 + 재영업 여부 · 경쟁사 낙찰일 때만 경쟁사 필수 · 해당 없음 ⑧ 수주 · 실주 왼쪽 칸 = 결과 기록 완성률
   '자료 없음' 3가지(현재 업무 미수행 / 과거 자료 미확인 / 해당 없음) · 실적 귀속 두 기준(최초 연락 받은 사원 / 최초 실제 연결된 사원 · 다르면 귀속 확인 필요) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.RelV12&&window.PipelineStageV3&&window.PipelineRowV11&&window.PipelineWorkspace&&window.PipelineJudge&&window.DealDetailV3&&window.CRMRules&&window.DealOwner);
  await page.evaluate(()=>{
   const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
   const day=n=>KST.format(new Date(Date.now()+n*864e5)),at=n=>new Date(Date.now()+n*864e5).toISOString();window.DAY=day;
   const deal=(id,site,code,o)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-60),stage_entered_at:at(-20),code,stage_code:code,grp:'영업·관리',amt:1e8,manager_name:'관리소장',manager_mobile:'01000001111',contacts:[],activities:[],stage_contexts:{}},o||{});
   const act=(id,type,note,n,actor)=>({id,type,note,at:at(n),occurred_at:at(n),actor});
   B={deals:[
    /* 관계관리: 미확인 + 이미 잡힌 연락 약속(35일 지남) / 미확인 + 약속 없음 */
    deal('p-unk','약속 있는 미확인','rapport',{last_meaningful_contact_at:at(-40),next_action:{id:'n1',text:'재통화 시도',due:day(-35),status:'open'}}),
    deal('p-none','약속 없는 미확인','rapport',{}),
    /* 계약 · 시공: 착공일 없음(계약 정보 있음) · 이미 닫혔어야 할 '계약 체결 확인' 업무가 남음 */
    deal('c-info','계약 정보 없는 현장','contract',{}),
    deal('c-nostart','착공일 없는 현장','construction',{stage_contexts:{contract:{fields:{contract_date:day(-30),contract_amount:3e8}},construction:{fields:{handover:'진행중'}}},next_action:{id:'n2',text:'계약 체결 확인',due:day(2),status:'open'}}),
    deal('c-build','시공 중 현장','construction',{last_meaningful_contact_at:at(-9),stage_contexts:{contract:{fields:{contract_date:day(-30),contract_amount:3e8}},construction:{fields:{start_date:day(-10),handover:'완료'}}}}),
    deal('c-fin','준공 확인 현장','completion',{stage_contexts:{contract:{fields:{contract_date:day(-60),contract_amount:2e8}},construction:{fields:{start_date:day(-40),handover:'완료'}}}}),
    /* 실주 4건: 경쟁사 낙찰 · 경쟁사 없음 / 사업 취소(해당 없음) / 재영업 미정 / 사유 없음 */
    deal('l-comp','경쟁사 낙찰 실주','lost',{outcome:'lost',closed_at:day(-5),lost_reason:'타사 선정 (경쟁 패배)',stage_contexts:{lost:{fields:{close_reason:'타사 선정 (경쟁 패배)',reengage:'예'}}},next_action:{id:'n3',text:'재접촉',due:day(20),status:'open'}}),
    deal('l-cancel','사업 취소 실주','lost',{outcome:'lost',closed_at:day(-6),lost_reason:'사업 · 공사 취소',stage_contexts:{lost:{fields:{close_reason:'사업 · 공사 취소',reengage:'아니오'}}}}),
    deal('l-undecided','재영업 미정 실주','lost',{outcome:'lost',closed_at:day(-7),lost_reason:'가격 · 가격 경쟁',stage_contexts:{lost:{fields:{close_reason:'가격 · 가격 경쟁',reengage:'미정'}}}}),
    deal('l-none','사유 없는 실주','lost',{outcome:'lost',closed_at:day(-8)}),
    /* 자료 발송: 발송일 없음 — Live 이후 건(현재 업무 미수행) / 이관 전(과거 자료) / 연락 기록도 없음(과거) */
    deal('s-live','Live 뒤 발송일 없음','sent',{created:day(-3),last_meaningful_contact_at:at(-2),activities:[act('a1','전화','통화 완료 · 연결됨',-2,'이필선')]}),
    deal('s-past','이관 전 발송일 없음','sent',{created:day(-60),last_meaningful_contact_at:at(-9),activities:[act('a2','전화','통화 완료 · 연결됨',-9,'이필선')]}),
    deal('s-norec','연락 기록도 없음','sent',{created:day(-60)}),
    /* 실적 귀속: 처음 연락을 받은 사람 ≠ 처음 실제 연결된 사람 */
    deal('o-diff','귀속 다른 현장','construction',{stage_contexts:{contract:{fields:{contract_date:day(-30),contract_amount:3e8}},construction:{fields:{start_date:day(-10),handover:'완료'}}},activities:[act('b1','전화','부재중 (전화 안 받음)',-20,'이필선'),act('b2','전화','통화 완료 · 연결됨 — 방문 일정 협의',-18,'황윤선')]}),
    deal('o-same','귀속 같은 현장','construction',{activities:[act('b3','전화','통화 완료 · 연결됨',-20,'황윤선'),act('b4','전화','통화 완료 · 연결됨',-18,'황윤선')]})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.ps3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.queueDetailContactOperation=()=>'op';SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[]}})};TOKEN='test';if(window.OpsStore)OpsStore.aiOn=()=>false;
   window.__sf=[];window.__memo=[];window.__next=[];
   DealDetailV3.stageFields=async(d,f)=>{__sf.push([d.id,f]);};
   DealDetailV3.memo=async(d,t)=>{__memo.push([d.id,t]);};
   DealDetailV3.next=async(d,o)=>{__next.push([d.id,o.type,o.text,o.due]);d.next_action={id:'nn'+__next.length,type:o.type,text:o.text,due:o.due,status:'open'};};
   PipelineWorkspace.open('relationship');
  });
  await page.waitForSelector('#pipeline-stage-v3 .prv-list .prv-row');await page.waitForTimeout(300);
  const V=page.locator('#pipeline-stage-v3'),L=V.locator('.prv-list');
  const md=n=>page.evaluate(n=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(DAY(n));return (+m[2])+'/'+(+m[3]);},n);
  const mdDot=n=>page.evaluate(n=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(DAY(n));return (+m[2])+'.'+(+m[3]);},n);
  const rowOf=k=>L.locator('.prv-row[data-key$="'+k+'"]').evaluate(r=>{const t=s=>{const n=r.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};return {tag:t('.prv-a>em.prv-tag'),tagBtn:!!r.querySelector('.prv-a>em.prv-tag[role="button"]'),now:t('.prv-b>span'),base:t('.prv-b>small.base'),task:t('.prv-c>b'),due:t('.prv-c>small:first-of-type'),dueCls:r.querySelector('.prv-c>small:first-of-type').className,why:t('.prv-c>small.why'),btn:t(':scope>button'),act:r.querySelector(':scope>button').dataset.v,tab:r.dataset.tab,stale:t('.prv-c>small.why.stale')};});
  /* ① 미확인이어도 연락 약속은 기한으로 · 약속이 없을 때만 '기한 없음' */
  const pu=await rowOf('p-unk'),pn=await rowOf('p-none');
  assert.deepEqual([pu.tag,pu.tagBtn,pu.now,pu.task,pu.due,pu.dueCls,pu.btn,pu.act],['미확인 · 분류 필요',true,'다음 연락일 지남 · 약속 있음','재통화 시도','35일 지남 · '+await md(-35)+' 약속','r','연락 기록','activity'],'미확인 + 약속: 기한 그대로 · 약속 업무 먼저');
  assert.deepEqual([pn.tag,pn.task,pn.due,pn.dueCls,pn.btn,pn.act],['미확인 · 분류 필요','상태 재분류','기한 없음 · 분류 후 정해짐','g','분류하기','classify'],'약속이 없을 때만 기한 없음');
  assert.deepEqual((await L.locator('.prv-row').evaluateAll(l=>l.map(r=>r.dataset.key.replace(/^deal:/,'')))).slice(0,2),['p-unk','p-none'],'재분류 목록은 연락 약속 있는 건부터');
  /* ③ 관리 기간: 일반관리 = 발송일부터 총 3개월 · 해석 미확정 · '1~4개월' 문구 없음 */
  assert.deepEqual(await V.locator('.ps3-tab').nth(2).evaluate(t=>[t.querySelector('span').textContent,t.querySelector('small.src').textContent]),['집중 이후 ~ 발송일부터 3개월 · 최소 월 1회','월 1회 = 회의 결정 · 기간 = 해석 미확정(설정)']);
  assert.doesNotMatch(await V.innerText(),/1~4개월/);
  /* ② 재분류: 꼬리표를 눌러 열기 → 기존 업무는 날짜만 바꿈(같은 내용 · 새 업무 아님) */
  await L.locator('.prv-row[data-key$="p-unk"] .prv-tag').click();await page.waitForSelector('#rv-dlg .rv-box2');
  assert.equal(one(await page.locator('#rv-dlg .rv-cmp').innerText()),'저장하면 업무가 이렇게 바뀝니다 지금 재통화 시도 · '+await mdDot(-35)+' (35일 지남) 저장 후 재통화 시도 · '+await mdDot(-35)+' 기존 업무는 그대로 둡니다','날짜를 안 바꾸면 업무는 그대로');
  const nd=await page.evaluate(()=>DAY(1));await page.fill('#rv-dlg [data-rv-in="next"]',nd);await page.locator('#rv-dlg [data-rv-in="next"]').dispatchEvent('change');await page.waitForTimeout(100);
  assert.equal(one(await page.locator('#rv-dlg .rv-cmp').innerText()),'저장하면 업무가 이렇게 바뀝니다 지금 재통화 시도 · '+await mdDot(-35)+' (35일 지남) 저장 후 재통화 시도 · '+await mdDot(1)+' 기존 업무 날짜만 바꿈 · 새로 추가 안 함');
  await page.locator('#rv-dlg [data-rv="unknown"]').click();await page.waitForTimeout(80);
  await page.locator('#rv-dlg [data-rv="save"]').click();await page.waitForSelector('#rv-dlg',{state:'detached'});await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>[__sf,__memo,__next]),[[],[['p-unk','[관계 상태] 미확인 | 발송일 모름 | '+nd+' | 없음 | 미정']],[['p-unk','전화','재통화 시도',nd]]],'발송일 모름 표식 + 기존 업무와 같은 내용으로 날짜만(새 업무 추가 아님) · 발송일 저장 없음');
  /* 약속 날짜를 안 바꾸고 사유만 남기면 업무는 건드리지 않는다 */
  await page.evaluate(()=>{__sf.length=0;__memo.length=0;__next.length=0;});await L.locator('.prv-row[data-key$="p-unk"] .prv-tag').click();await page.waitForSelector('#rv-dlg .rv-box2');
  await page.fill('#rv-dlg [data-rv-in="reason"]','고객 통화 후 다시 확인');await page.locator('#rv-dlg [data-rv="save"]').click();await page.waitForSelector('#rv-dlg',{state:'detached'});await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>[__sf.length,__memo.length,__next.length]),[0,1,0],'사유만 남기고 날짜 그대로 = 업무 변경 없음');
  /* ④ 설정: 확정 / 잠정 + 출처 · 적용 예정 */
  await page.evaluate(()=>{goPage('rules');});await page.waitForSelector('#rules-admin .ra-row');await page.waitForTimeout(200);
  const RA=await page.evaluate(()=>{const row=l=>{const r=[...document.querySelectorAll('#rules-admin .ra-row')].find(x=>x.querySelector('.ra-l b').textContent===l);return r?r.querySelector('.ra-l').innerText.replace(/\s+/g,' ').trim():null;};return {focus:row('집중관리 기간'),general:row('일반관리 기간'),wait:row('장기 대기 연락 주기'),all:row('고객관리 기간'),pend:(document.querySelector('#ra-pending')||{innerText:''}).innerText.replace(/\s+/g,' ').trim(),chips:[...document.querySelectorAll('#rules-admin .ra-conf')].map(e=>e.textContent)};});
  assert.match(RA.focus,/잠정/);assert.match(RA.focus,/출처 · 회의록 · 승인 전/);assert.match(RA.general,/잠정 · 해석 미확정/);assert.match(RA.general,/총 이 기간까지는 일반관리/);assert.match(RA.wait,/확정/);assert.match(RA.wait,/현재 계산은 설정 일수/);assert.match(RA.all,/기간 잠정 · 해석 미확정/);assert.doesNotMatch(RA.all,/송보람 승인/);
  assert.match(RA.pend,/적용 예정/);assert.match(RA.pend,/→ 단계 이동 창/);assert.match(RA.pend,/→ 관계관리 재분류/);assert.match(RA.pend,/→ 상세 담당 변경/);
  /* ⑤ 계약 · 시공 4상태 */
  await page.evaluate(()=>{G.ps3=null;PipelineWorkspace.open('construction');});await page.waitForSelector('#pipeline-stage-v3[data-stage="construction"] .prv-row');await page.waitForTimeout(250);
  assert.deepEqual(await V.locator('.ps3-tab').evaluateAll(l=>l.map(t=>[t.querySelector('.l').textContent,t.querySelector('span').textContent,Number(t.querySelector('.n').textContent)])),[['전체','이 단계 모든 현장',6],['계약 체결','계약일 · 금액 · 계약서',2],['착공 준비','착공일 미입력 · 착공일 확인',1],['시공 중','착공일 입력 후 · 주 1회 방문',2],['준공 확인','준공검사 · 고객 확인',1]],'4상태 + 전체 = 합');
  const ci=await rowOf('c-info'),ns=await rowOf('c-nostart'),cb=await rowOf('c-build'),cf=await rowOf('c-fin');
  assert.deepEqual([ci.tab,ci.task,ci.btn,ns.tab,ns.task,ns.btn,ns.act,cb.tab,cb.task,cb.btn,cf.tab,cf.task],['0','계약 정보 입력','정보 입력','1','착공일 확인','착공일 입력','stagefields','2','주간 현장 방문','현장 확인','3','준공 확인'],'계약일만으로 시공 중 아님 · 착공일 없으면 착공 준비');
  assert.equal(ns.stale,'"계약 체결 확인" 종료 대상','끝난 상태의 업무는 종료 대상 표시');
  assert.deepEqual(await V.locator('.ps3-reason').evaluateAll(l=>l.map(b=>[b.querySelector('span>b').textContent,Number(b.querySelector('.c').textContent)])),[['계약일 · 금액 없음',2],['착공일 미입력',1],['인계서 미확인',1],['시공 중 주 1회 방문 없음',2],['준공 확인 없음',1]]);
  /* ⑥⑦⑧ 실주: 기록 완료 = 사유 + 재영업 여부 · 경쟁사는 경쟁사 낙찰일 때만 · 왼쪽 칸 = 완성률 + 보완할 것 */
  await page.evaluate(()=>{G.ps3=null;PipelineWorkspace.open('lost');});await page.waitForSelector('#pipeline-stage-v3[data-stage="lost"] .prv-row');await page.waitForTimeout(250);
  assert.deepEqual(await V.locator('.ps3-tab').evaluateAll(l=>l.map(t=>[t.querySelector('.l').textContent,Number(t.querySelector('.n').textContent)])),[['전체',4],['기록 보완 필요',2],['기록 완료',1],['재영업 가능 · 예',1]]);
  assert.deepEqual(await V.locator('.prv-row').evaluateAll(l=>l.map(r=>[r.dataset.key.replace(/^deal:/,''),r.dataset.tab])).then(a=>a.sort()),[['l-cancel','1'],['l-comp','2'],['l-none','0'],['l-undecided','0']].sort());
  const side=await V.locator('.ps3-diag').innerText();
  assert.match(one(side),/결과 기록 완성률 50% 2 \/ 4/);assert.match(one(side),/보완할 것 2건/);assert.doesNotMatch(side,/평균 체류|왜 멈춰 있나/,'체류 · 왜 멈춰 있나는 없음');
  assert.deepEqual(await V.locator('.ps3-reason').evaluateAll(l=>l.map(b=>[b.querySelector('span>b').textContent,Number(b.querySelector('.c').textContent)])),[['실주 사유 미입력',1],['경쟁사 낙찰 · 경쟁사 · 낙찰가 미입력',1],['재영업 가능 여부 미입력',2],['재접촉 할 일 없음',0]],'경쟁사 필수는 경쟁사 낙찰 1건만 · 사업 취소는 해당 없음(세지 않음) · 미정은 미입력');
  assert.equal(one(await L.locator('.prv-row[data-key$="l-cancel"] .prv-b>small.base').innerText()),'기록 완료 · 경쟁사 해당 없음');
  /* ⑤ 자료 없음 3가지 */
  await page.evaluate(()=>{G.ps3=null;PipelineWorkspace.open('sent');});await page.waitForSelector('#pipeline-stage-v3[data-stage="sent"] .prv-row');await page.waitForTimeout(250);
  assert.deepEqual(await V.locator('.ps3-miss .ps3-ms').evaluateAll(l=>l.map(x=>[x.querySelector('b').textContent,Number(x.querySelector('span').textContent.replace(/\D/g,'')),x.querySelector('small').textContent])),[['현재 업무 미수행',1,'기준일 있고 기한 넘김 · 담당 평가 · 지연 통계 포함'],['과거 자료 미확인',2,'이관 전 기록 · 보완 대상 · 평가 제외'],['해당 없음',0,'그 단계에 필요 없는 정보 · 집계 제외']]);
  assert.deepEqual(await page.evaluate(()=>['s-live','s-past','s-norec'].map(id=>{const d=B.deals.find(x=>x.id===id);return PipelineJudge.missKind(d,PipelineJudge.basis(d,'sent'));})),['cur','past','past']);
  /* ④ 실적 귀속 두 기준 */
  assert.deepEqual(await page.evaluate(()=>['o-diff','o-same'].map(id=>{const a=DealOwner.attribution(B.deals.find(x=>x.id===id));return [a.received&&a.received.name,a.connected&&a.connected.name,a.differ,a.pending];})),[['이필선','황윤선',true,true],['황윤선','황윤선',false,false]]);
  await page.evaluate(()=>{DealOwner.state().open=true;G._detailPopup=true;drwDeal(JSON.stringify(B.deals.find(x=>x.id==='o-diff')));});await page.waitForSelector('#detailView.on .do-grid',{timeout:8000});
  const card=one(await page.locator('#detailView .do-grid').innerText());
  assert.match(card,/최초 연락 받은 사원 이필선/);assert.match(card,/회의 잠정안/);assert.match(card,/최초 실제 연결된 사원 황윤선/);assert.match(card,/현재 설정/);assert.match(card,/귀속 확인 필요 두 사람이 다릅니다\(이필선 · 황윤선\)/);
  await page.evaluate(()=>{try{closeDetail();}catch(e){}});
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('stage7_2 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
