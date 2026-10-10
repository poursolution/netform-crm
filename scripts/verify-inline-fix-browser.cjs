'use strict';
/* 빠진 정보를 그 자리에서 보완 검사 (2026-10-10 design_handoff_after_deploy 13)
   목록 줄의 [증빙 확인] · [일정 입력] · [정보 입력] → 상세를 열지 않고 그 줄 아래 칸만 펼친다(5단계).
   ① 기존 기록 후보 → [이걸로] ② 값 + 근거 ③ 목록과 같은 계산으로 판정 ④ 후속 업무 제안 ⑤ 저장 → 영업건 · 오늘 업무 · 진단 동시 반영.
   [확인 불가] = 날짜를 넣지 않고 판정 불가 유지. 실패하면 실패한 것만 재시도(같은 저장을 두 번 하지 않는다). 끄기 G.inlineFixOff. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);
  await page.waitForFunction(()=>window.InlineFix&&window.PipelineStageV3&&window.PipelineRowV11&&window.PipelineWorkspace&&window.DealDetailV3&&window.Phase1);
  await page.evaluate(()=>{
   window.G=window.G||{};G.dealSameOff=true;
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),at=n=>new Date(Date.now()-n*864e5).toISOString();window.__day=day;
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'석민이앤씨',created:day(-60),stage_entered_at:at(30),code,stage_code:code,grp:'영업·관리',amt:2e8,office_phone:'0511234567'},extra||{});
   B={deals:[
    deal('s-a','동부산훼미리타운4차','이필선','sent',{activities:[{id:'a1',type:'이메일',note:'동부산4차 견적서 송부 · 견적서_V1.pdf',occurred_at:at(28)},{id:'a2',type:'메모',note:'견적 메일로 보냄',occurred_at:at(28)},{id:'a3',type:'메모',note:'소장 휴가 중',occurred_at:at(12)}]}),
    deal('s-b','기록 없는 발송','이필선','sent'),
    deal('s-c','재시도 발송','황윤선','sent',{activities:[{id:'c1',type:'문자',note:'제안서 전달드렸습니다',occurred_at:at(3)}]}),
    deal('s-late','후속 없는 발송','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-9),materials:['견적서'],recipient:'관리소장'}}}}),
    deal('s-wait','대기 발송','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:day(-2)}}}}),
    deal('k-a','일정 없는 경쟁','이필선','compete',{stage_contexts:{compete:{fields:{competition_type:'경쟁견적'}}},legacy_notes:[{id:'n1',body:'소장 통화 — 12/20 입대의에서 결정한다고 함',occurred_at:day(-4)}]}),
    deal('k-b','마감 먼 입찰','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:day(20)}}}}),
    deal('t-a','계약 진행','이필선','contract'),
    deal('t-b','시공 중 · 계약 정보 없음','황윤선','construction',{stage_contexts:{construction:{fields:{start_date:day(-10),handover:'완료'}}}})
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.psb=null;G.prb=null;G.ps3=null;G.ifx=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=null;window.__act=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};window.DetailActions=Object.assign(window.DetailActions||{},{open:k=>{window.__act=k;}});
   window.CRMRelease=Object.assign(window.CRMRelease||{},{has:()=>true,noteMissing(){}});
   window.__sf=[];window.__sfFail=0;SB={rpc:async(name,args)=>{if(name!=='crm_deal_stage_fields_update_v1')return {data:{ok:true,tasks:[]}};if(window.__sfFail>0){window.__sfFail--;return {data:null,error:{message:'서버 연결 실패'}};}__sf.push(JSON.parse(JSON.stringify(args.p)));const d=B.deals.find(x=>x.id===args.p.deal_id);if(d.stage_code!==args.p.stage_code)return {data:null,error:{message:'단계가 바뀌었습니다',code:'PT409'}};const prev=(d.stage_contexts||{})[args.p.stage_code]||{},fields=Object.assign({},prev.fields||{});Object.entries(args.p.fields).forEach(([k,v])=>{if(v==null)delete fields[k];else fields[k]=v;});return {data:{ok:true,version:(d.version||1)+1,stage_context:{to:args.p.stage_code,fields,edited_at:new Date().toISOString(),edited_by:'송보람'}},error:null};}};TOKEN='test';
   window.__ops=[];window.__opFail=0;window.queueDetailContactOperation=(op,payload,actionId)=>{const id='op-'+(__ops.length+1);__ops.push({id,op,payload,actionId,ok:!(window.__opFail>0)});if(window.__opFail>0)window.__opFail--;return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>{const ok=o.ok;o.ok=true;/* 두 번째 확인에서는 서버가 받는다 */return {request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:ok?'done':'pending',payload:o.payload,ack:ok?{ok:true,operation:o.op,next_action_id:'srv-'+o.id}:null,error:ok?'':'서버 확인 대기 중'};});
   PipelineWorkspace.open('sent');
  });
  await page.waitForTimeout(400);
  const V=page.locator('#pipeline-stage-v3'),one=s=>String(s).replace(/\s+/g,' ').trim();
  const rowOf=id=>V.locator('.prv-row[data-key$="'+id+'"]'),panel=()=>V.locator('[data-ifx-panel]'),tx=async l=>one(await l.innerText());
  const diag=()=>V.evaluate(v=>{const b=v.querySelector('.ps3-jd');return [+b.dataset.ok,+b.dataset.all];});
  const fixBtn=id=>rowOf(id).locator('button[data-v="stagefields"]').first();
  const clip=()=>V.evaluate(v=>[...v.querySelectorAll('[data-ifx-panel] *')].filter(n=>n.children.length===0&&getComputedStyle(n).whiteSpace==='nowrap'&&getComputedStyle(n).overflow==='visible'&&n.getBoundingClientRect().right>v.querySelector('[data-ifx-panel]').getBoundingClientRect().right+1).map(n=>n.textContent));

  /* ── 자료 발송: 발송일 없는 3건은 판정 불가 ── */
  assert.deepEqual(await diag(),[2,5],'처음: 판정 가능 2 / 5');
  assert.equal(await tx(fixBtn('s-a')),'증빙 확인');
  await fixBtn('s-a').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.__open),null,'상세 창을 열지 않는다');
  assert.equal(await panel().count(),1,'그 줄 아래 칸 하나');
  assert.equal(await V.evaluate(v=>{const p=v.querySelector('[data-ifx-panel]');return p.previousElementSibling.dataset.key.replace(/^deal:/,'');}),'s-a','누른 줄 바로 아래');
  assert.equal(await tx(panel().locator('.ifx-top>span')),'단계 1 / 5');
  assert.deepEqual(await panel().locator('.ifx-steps button').allInnerTexts().then(a=>a.map(one)),['기존 첨부 · 이력 확인','발송일 · 수신자 등록','경과일 계산','후속 업무 제안','저장 · 반영']);
  /* ① 후보: 발송 관련 기록만(휴가 메모는 아님) · 날짜는 기록한 날 */
  const D=await page.evaluate(()=>({d28:__day(-28),d3:__day(-3),today:__day(0)})),dot=k=>{const m=/^(\d+)-(\d+)-(\d+)$/.exec(k);return +m[1]+'.'+(+m[2])+'.'+(+m[3]);},md=k=>{const m=/^(\d+)-(\d+)-(\d+)$/.exec(k);return (+m[2])+'.'+(+m[3]);};
  const cands=await panel().locator('.ifx-cand').evaluateAll(L=>L.map(c=>[c.querySelector('span').textContent.replace(/\s+/g,' ').trim(),c.querySelector('em').textContent.trim()]));
  assert.deepEqual(cands,[['이메일 동부산4차 견적서 송부 · 견적서_V1.pdf',dot(D.d28)],['메모 견적 메일로 보냄',dot(D.d28)]],'후보 2건 — 기록에 있는 것만');
  await panel().locator('.ifx-cand button').first().click();await page.waitForTimeout(100);
  /* ② 값 + 근거: 후보의 날짜 · 근거가 채워지고, 수신자는 직접 */
  assert.equal(await tx(panel().locator('.ifx-top>span')),'단계 2 / 5');
  assert.equal(await panel().locator('input[data-ifxf="sent_date"]').inputValue(),D.d28);
  assert.equal(await panel().locator('input[data-ifxf="__basis"]').inputValue(),md(D.d28)+' 이메일 기록에서 가져옴');
  assert.deepEqual(await panel().locator('.ifx-chips button[aria-pressed="true"]').allInnerTexts(),['견적서']);
  await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-err')),/수신자을\(를\) 넣어 주세요/,'수신자 없이 넘어가지 않는다');
  assert.equal(await page.evaluate(()=>__sf.length),0);
  await panel().locator('input[data-ifxf="recipient"]').fill('관리소장 · facility@dbfamily.kr');
  /* 내일 날짜는 발송일로 못 넣는다 */
  await panel().locator('input[data-ifxf="sent_date"]').fill(await page.evaluate(()=>__day(1)));await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-err')),/발송일은\(는\) 오늘까지의 날짜로/);
  await panel().locator('input[data-ifxf="sent_date"]').fill(D.d28);await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  /* ③ 판정: 목록과 같은 기준(발송 후 7일) */
  assert.equal(await tx(panel().locator('.ifx-s3')),'발송 '+dot(D.d28)+' → 오늘 28일 · 기준 7일 후속 연락 필요 · 21일 지남 이제 판정 가능 · 저장하면 진단 칸 \'판정 가능 3 / 5\'');
  assert.equal(await page.evaluate(()=>__sf.length),0,'판정을 보는 것만으로는 저장하지 않는다');
  await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  /* ④ 후속 업무 제안: 기한 넘긴 건 = 오늘(주말이면 다음 월요일) · 담당 확인 후 저장 */
  const due=await page.evaluate(()=>InlineFix._weekday(__day(0)));
  assert.equal(await panel().locator('input[data-ifxf="__ftext"]').inputValue(),'견적 수신 · 검토 여부 확인 전화');
  assert.equal(await panel().locator('input[data-ifxf="__fdue"]').inputValue(),due);
  assert.match(await tx(panel().locator('.ifx-s4')),/담당 이필선/);
  assert.equal(await tx(panel().locator('[data-ifx="save"]')),'저장');
  if(shot){await page.screenshot({path:shot.replace(/\.png$/,'-step4.png')});}
  assert.deepEqual(await clip(),[],'칸 밖으로 넘치는 글 없음');
  await panel().locator('[data-ifx="save"]').click();await page.waitForTimeout(350);
  /* ⑤ 저장: 단계 정보 한 번 + 다음 업무 한 번 · 세 곳 반영 */
  assert.deepEqual(await page.evaluate(()=>__sf.map(p=>[p.deal_id,p.stage_code,p.fields,p.reason])),[['s-a','sent',{sent_date:D.d28,materials:['견적서'],recipient:'관리소장 · facility@dbfamily.kr',sent_basis:md(D.d28)+' 이메일 기록에서 가져옴',sent_date_check:null},'목록에서 발송 증빙 확인']]);
  assert.deepEqual(await page.evaluate(()=>__ops.map(o=>[o.op,o.payload.opportunity_id,o.payload.text,o.payload.due_at,o.payload.assignee])),[['next_action','s-a','견적 수신 · 검토 여부 확인 전화',due,'이필선']]);
  assert.deepEqual(await diag(),[3,5],'진단: 판정 가능 3 / 5');
  assert.deepEqual(await panel().locator('.ifx-done li').allInnerTexts().then(a=>a.map(one)),['영업건 · 발송일 '+dot(D.d28)+' · 수신자 등록','오늘 업무 · "견적 수신 · 검토 여부 확인 전화" '+md(due)+' 추가','진단 · 판정 가능 3 / 5 · 후속 연락 필요 · 21일 지남']);
  assert.equal(await rowOf('s-a').getAttribute('data-tab'),'0','줄은 7일 넘음 칸으로');
  assert.equal(await V.evaluate(v=>v.querySelector('[data-ifx-panel]').previousElementSibling.dataset.key.replace(/^deal:/,'')),'s-a','저장 뒤에도 그 줄 아래');
  await panel().locator('[data-ifx="close"]').click();await page.waitForTimeout(100);assert.equal(await panel().count(),0);
  assert.equal(await fixBtn('s-a').count(),0,'보완이 끝난 줄에는 증빙 확인 버튼이 없다');

  /* ── 확인 불가: 날짜를 넣지 않는다 · 판정 불가 유지 ── */
  await fixBtn('s-b').click();await page.waitForTimeout(120);
  assert.match(await tx(panel().locator('.ifx-none')),/발송 관련 기록을 찾지 못했습니다/);
  await panel().locator('[data-ifx="unk"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-unk')),/임의 날짜 넣지 않음 · 지표는 계속 판정 불가/);
  await panel().locator('[data-ifx="unksave"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-err')),/어디를 확인했는지/);assert.equal(await page.evaluate(()=>__sf.length),1);
  await panel().locator('input[data-ifxf="__unk"]').fill('메일함 · 잔디 확인 — 기록 없음');await panel().locator('[data-ifx="unksave"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__sf[1].fields),{sent_date_check:'확인 불가',sent_basis:'메일함 · 잔디 확인 — 기록 없음'},'날짜 칸은 보내지 않는다');
  assert.equal(await page.evaluate(()=>__ops.length),1,'확인 불가는 후속 업무를 만들지 않는다');
  assert.deepEqual(await diag(),[3,5],'확인 불가 = 계속 판정 불가');
  assert.match(await tx(panel().locator('.ifx-done')),/확인 불가로 남김 .*임의 날짜를 넣지 않음 .*계속 판정 불가 \(판정 가능 3 \/ 5\)/);
  await panel().locator('[data-ifx="close"]').click();await page.waitForTimeout(100);
  assert.match(await tx(rowOf('s-b').locator('.prv-b')),/발송 확인 불가 · \d+\.\d+ 확인 · 판정 불가 유지/,'줄에 확인 불가 표시');
  assert.equal(await rowOf('s-b').getAttribute('data-tab'),'3','판정 불가 칸에 그대로');

  /* ── 실패 → 재시도: 저장된 것은 다시 보내지 않는다 ── */
  await fixBtn('s-c').click();await page.waitForTimeout(120);
  await panel().locator('.ifx-cand button').first().click();await page.waitForTimeout(80);
  assert.deepEqual(await panel().locator('.ifx-chips button[aria-pressed="true"]').allInnerTexts(),['제안서']);
  await panel().locator('input[data-ifxf="recipient"]').fill('입대의 회장');await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-s3')),/3일 · 기준 7일 기한 안 · 4일 남음/);
  await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.equal(await panel().locator('input[data-ifxf="__fdue"]').inputValue(),await page.evaluate(()=>InlineFix._weekday(__day(4))),'기한 안 = 발송 + 7일(평일)');
  await page.evaluate(()=>{window.__sfFail=1;});await panel().locator('[data-ifx="save"]').click();await page.waitForTimeout(250);
  assert.match(await tx(panel().locator('.ifx-err')),/^서버 연결 실패$/);assert.equal(await tx(panel().locator('[data-ifx="save"]')),'재시도');assert.equal(await page.evaluate(()=>__sf.length),2);
  await page.evaluate(()=>{window.__opFail=1;});await panel().locator('[data-ifx="save"]').click();await page.waitForTimeout(250);
  assert.match(await tx(panel().locator('.ifx-err')),/등록한 정보는 저장됐습니다 · 후속 업무만 다시 시도합니다/);assert.equal(await page.evaluate(()=>__sf.length),3,'단계 정보는 저장됨');
  await panel().locator('[data-ifx="save"]').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>__sf.length),3,'재시도가 단계 정보를 다시 보내지 않는다');assert.equal(await page.evaluate(()=>__ops.length),2,'후속 업무도 같은 요청 하나');
  assert.match(await tx(panel().locator('.ifx-done b')),/저장됨 · 한 번에 반영/);assert.deepEqual(await diag(),[4,5]);
  await panel().locator('[data-ifx="close"]').click();await page.waitForTimeout(100);

  /* ── 이미 다음 업무가 있는 건: 새 업무를 만들지 않는다(기본) ── */
  assert.equal(await page.evaluate(()=>{const x={row:PipelineWorkspace.rows({}).find(r=>r.item.id==='s-a')};G.ifx={key:x.row.key,stage:'sent',kind:'sent',code:'sent',draft:{sent_date:__day(-28)},step:4};const P=InlineFix.propose(G.ifx,x);G.ifx=null;return [P.mode,P.hasNext,P.next.text].join('|');}),'keep|true|견적 수신 · 검토 여부 확인 전화');

  /* ── 경쟁 · 입찰: 일정 없는 건 ── */
  await page.evaluate(()=>PipelineWorkspace.open('competition'));await page.waitForTimeout(300);
  const d0=await diag();
  await fixBtn('k-a').click();await page.waitForTimeout(120);
  assert.equal(await page.evaluate(()=>window.__open),null);assert.equal(await panel().getAttribute('data-kind'),'schedule');
  assert.match(await tx(panel().locator('.ifx-cand em')),/글 속 일정 12\.20/);
  await panel().locator('.ifx-cand button').first().click();await page.waitForTimeout(80);
  const when=await panel().locator('input[data-ifxf="meeting_date"]').inputValue();assert.match(when,/^\d{4}-12-20$/,'글 속 날짜를 제안(담당이 확인)');
  await panel().locator('input[data-ifxf="meeting_date"]').fill('');await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-err')),/입찰 마감 · PT · 결정 일정 중 하나는 넣어 주세요/);
  const d5=await page.evaluate(()=>__day(5));await panel().locator('input[data-ifxf="decision_date"]').fill(d5);await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-s3')),/결정 일정 .* D-5 · 준비 기준 D-7 마감 D-7 이내 · 제안서 · 가격 확정/);
  await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.equal(await panel().locator('input[data-ifxf="__ftext"]').inputValue(),'제안서 팀장 공유 · 가격 확정');
  await panel().locator('[data-ifx="mode"][data-v="none"]').click();await page.waitForTimeout(60);await panel().locator('[data-ifx="save"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>{const p=__sf[__sf.length-1];return [p.deal_id,p.stage_code,p.fields.decision_date,p.fields.meeting_date,p.fields.schedule_check,/입대의/.test(p.fields.schedule_basis)||/과거 메모/.test(p.fields.schedule_basis)];}),['k-a','compete',d5,null,null,true]);
  assert.equal(await page.evaluate(()=>__ops.length),2,'등록 안 함 = 후속 업무 없음');
  assert.deepEqual(await diag(),[d0[0]+1,d0[1]],'일정이 등록돼 판정 가능 +1');
  await panel().locator('[data-ifx="close"]').click();await page.waitForTimeout(100);

  /* ── 계약: 계약 단계에 있는 건만 그 자리에서 · 지난 단계 정보는 상세로 ── */
  await page.evaluate(()=>PipelineWorkspace.open('construction'));await page.waitForTimeout(300);
  await fixBtn('t-a').click();await page.waitForTimeout(120);
  assert.equal(await panel().getAttribute('data-kind'),'contract');await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(60);
  await panel().locator('[data-ifx="pick1"][data-v="체결 완료"]').click();await panel().locator('input[data-ifxf="contract_date"]').fill(await page.evaluate(()=>__day(-3)));await panel().locator('input[data-ifxf="contract_amount"]').fill('310000000');await panel().locator('input[data-ifxf="__basis"]').fill('계약서 사본 확인');
  await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(80);
  assert.match(await tx(panel().locator('.ifx-s3')),/310,000,000원 체결 완료 · 계약서 · 원장 확인 전 계약 정보 입력됨 · 증빙 확인 필요 수주실적\(낙찰금액 · VAT 별도\)과는 무관/);
  await panel().locator('[data-ifx="next"]').click();await page.waitForTimeout(60);await panel().locator('[data-ifx="save"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>{const p=__sf[__sf.length-1];return [p.deal_id,p.stage_code,p.fields.contract_amount,p.fields.contract_status,p.fields.contract_basis];}),['t-a','contract',310000000,'체결 완료','계약서 사본 확인']);
  await panel().locator('[data-ifx="close"]').click();await page.waitForTimeout(100);
  await page.evaluate(()=>{window.__open=null;});
  const tb=rowOf('t-b').locator('button[data-v="stagefields"]').first();if(await tb.count()){await tb.click();await page.waitForTimeout(250);assert.equal(await panel().count(),0,'시공 단계 건의 계약 정보는 그 자리 칸이 아니라 상세로');assert.equal(await page.evaluate(()=>window.__open),'t-b');}

  /* ── after_deploy 14: 결과별 후속 업무 제안(응대 기록이 쓰는 함수) ── */
  const PL=await page.evaluate(()=>{const d=B.deals.find(x=>x.id==='s-late'),pick=P=>P?[P.purpose,P.due,P.type,P.text,P.link?[P.link.by,P.link.due,P.link.applied]:null]:null,q=DealDetailV3.planOf(d,{res:'견적요청'}),a0=DealDetailV3.planOf(d,{res:'부재'});
   const W=WorkRequest.state();W.list=(W.list||[]).concat([{id:'rq1',target_type:'deal',target_id:'s-late',kind:'follow',status:'sent',requested_by:'송보람',to_name:'이필선',due_at:new Date(Date.now()+2*864e5).toISOString(),created_at:new Date().toISOString()}]);
   return {on:WorkRequest.enabled(),n:DealUnits.requests(d).length,q:pick(q),a0:pick(a0),a1:pick(DealDetailV3.planOf(d,{res:'부재'})),a2:pick(DealDetailV3.planOf(d,{res:'부재',day:1})),m:pick(DealDetailV3.planOf(d,{res:'자료요청'})),t:__day(0),t1:__day(1),t2:__day(2)};});
  assert.deepEqual(PL.q,['견적 요청 등록(잔디) · 물량 산출 3일 목표',PL.t,'후속접촉','견적 요청 등록(잔디) · 물량 산출 3일 목표',null],'견적 요청 → 견적 요청 등록 · 오늘');
  assert.deepEqual(PL.a0,['다시 전화',PL.t1,'전화','다시 전화',null],'요청이 없으면 내일 재연락');
  assert.equal(PL.on&&PL.n,1,'같은 영업건의 열린 연락 요청 1건');
  assert.deepEqual(PL.a1,['다시 전화',PL.t2,'전화','다시 전화 · 요청 송보람',['송보람',PL.t2,true]],'열린 연락 요청이 있으면 업무를 따로 잡지 않고 요청자 · 기한에 맞춘다');
  assert.deepEqual(PL.a2,['다시 전화',PL.t1,'전화','다시 전화',['송보람',PL.t2,false]],'날짜를 직접 고르면 그 날짜');
  assert.equal(PL.m[4],null,'전화가 아닌 업무(자료 보내기)는 요청에 묶지 않는다');

  /* ── 끄기 스위치: 예전처럼 상세로 ── */
  await page.evaluate(()=>{window.__open=null;G.inlineFixOff=true;PipelineWorkspace.open('sent');});await page.waitForTimeout(300);
  await fixBtn('s-b').click();await page.waitForTimeout(250);
  assert.equal(await panel().count(),0);assert.equal(await page.evaluate(()=>window.__open),'s-b');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log('verify-inline-fix: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
