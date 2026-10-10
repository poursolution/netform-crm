'use strict';
/* 관리팀 KPI v7 검사(2026-10-05 design_handoff_kpi_v7 · 시안 '관리팀 KPI v7.dc.html')
   위(담당자 알약 '미달 n' + 기간 · 제목 · 버튼 3개) / 왼쪽 진단 380px / 오른쪽 탭 2개 — 핵심 지표 8(리스트 · 보드 · 나쁜 순)과 단계별 기준(단계 화면과 같은 계산 함수 · 같은 숫자)
   숫자는 기존 계산(KpiB.compute · kpi:1~8) 그대로 · 요청 = 관리자 한마디 한 줄 + 조치 기록 → '보냄 ✓' · 지난주 보기 · 주간 저장 · 끄기 G.kpiV7Off */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.KpiB&&window.KpiV7&&window.KpiV2&&window.PipelineStageB&&window.OpsStore&&typeof paintMgmt==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,days)=>({id:'0000000'+n+'-0000-4000-8000-00000000000'+n,site:'신규 문의 '+n,status:owner?'배정완료':'접수',at:at(-days),created_at:at(-days),brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(-days+0.0007)/* 접수 1분 뒤 배정 — 시각과 상관없이 같은 날 */:null});
   B={deals:[
     deal('d1','할 일 없는 큰 현장','이필선','consulting',{amt:9e8}),
     deal('d2','기한 지난 현장','이필선','sent',{amt:3e8,next_action:{id:'n1',text:'견적 확인',due:day(-12),status:'open'}}),
     deal('d3','정상 현장','황윤선','compete',{amt:5e8,created:day(-10),updated:day(-1),next_action:{id:'n3',text:'PT 준비',due:day(3),status:'open'},activities:[{id:'a3',type:'전화',note:'통화',at:at(-1)}]}),
     deal('d4','사유 없는 실주','이필선','lost',{outcome:'lost',closed_at:day(-3)}),
     deal('d5','미팅 후 견적 없는 현장','황윤선','consulting',{amt:2e8,created:day(-20),updated:day(-10),next_action:{id:'n5',text:'현장방문',type:'현장방문',due:day(-8),status:'open'},activities:[{id:'a5',type:'방문',note:'1차 미팅',at:at(-8)}]})],
    inquiries:[inq(1,'',2),inq(2,'이필선',3),inq(3,'이필선',4),inq(4,'이필선',5)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.kb=null;G.kbDone=null;G.kbNmSent=null;G.k7=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req';};
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};
   /* 운영 저장소 흉내: 지난주 · 3주 전 저장값, 조치 기록 1건(지난주) */
   const mon=OpsStore.monday,wk=[];window.__rpc=[];window.__weekly=[{week_start:mon(-1),promise_key:'kpi:1',numerator:1,denominator:4},{week_start:mon(-1),promise_key:'kpi:3',numerator:1,denominator:4},{week_start:mon(-3),promise_key:'kpi:3',numerator:3,denominator:4},{week_start:mon(-2),promise_key:'kpi:3',numerator:2,denominator:4}];
   window.__acts=[{promise_key:'kpi:1',action:'담당 정하기',target_type:'inquiry',target_id:'00000001-0000-4000-8000-000000000001',target_name:'신규 문의 1',created_at:new Date(Date.now()-10*864e5).toISOString(),actor_name:'송보람'},{promise_key:'kpi:3',action:'등록 요청',target_type:'person',target_id:'정정훈',target_name:'정정훈',created_at:new Date(Date.now()-5*864e5).toISOString(),actor_name:'송보람'}];
   SB={rpc:async(name,args)=>{__rpc.push([name,args&&args.p]);if(name==='crm_kpi_weekly_list_v1')return {data:{ok:true,rows:__weekly}};if(name==='crm_kpi_action_list_v1')return {data:{ok:true,actions:__acts}};if(name==='crm_kpi_action_log_v1'){const a=Object.assign({created_at:new Date().toISOString(),actor_name:'송보람'},args.p);__acts.unshift(a);return {data:{ok:true,action:a}};}if(name==='crm_kpi_weekly_save_v1'){return {data:{ok:true,saved:args.p.rows.length}};}if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};return {data:{ok:true,tasks:[],rows:[],actions:[]}};}};TOKEN='test';
   goPage('mgmt');
  });
  await page.evaluate(require('./kpi-request-browser-fixture.cjs'));await page.evaluate(async()=>{await KpiB.load(true);paintMgmt();});
  await page.waitForTimeout(500);
  const v=page.locator('#kpi-v7');assert.equal(await v.count(),1,'새 KPI 화면(v7)');assert.equal(await page.locator('#kpi-b,#kpi-v2').count(),0,'예전 화면 없음');
  assert.equal(await page.evaluate(()=>document.getElementById('ptitle').textContent),'관리팀 KPI');
  await page.evaluate(()=>{window.__toasts=[];window.toast=(m,k)=>{__toasts.push(String(m));};});
  /* 1. 위: 담당자 알약(미달 n) + 기간 · 제목 한 줄 · 버튼 3개. 공통 필터줄은 그대로 있고 이 화면에서는 가려진다 */
  const pills=await v.locator('.k7-filter .k7-who').evaluateAll(l=>l.map(b=>[b.textContent.replace(/\s+/g,' ').trim(),b.getAttribute('aria-pressed')]));
  assert.equal(pills[0][0],'전체');assert.equal(pills[0][1],'true');assert.ok(pills.length>=3,'담당자 알약 '+JSON.stringify(pills));assert.ok(pills.slice(1).every(p=>/ (미달 \d+|기록 없음)$/.test(p[0])),'알약마다 미달 n');
  assert.equal(pills.some(p=>/^조재연/.test(p[0])),false,'B2B 협약 전담은 영업 지표에서 뺀다');
  assert.match(await v.locator('.k7-filter .k7-period').innerText(),/^기간 이번 주 \d+\/\d+\(월\) – \d+\/\d+\(금\)$/);
  assert.equal(await page.evaluate(()=>{const b=document.querySelector('#pg-mgmt>.cf-bar');return !!b&&getComputedStyle(b).display==='none';}),true,'공통 필터줄은 가림');
  assert.match(await v.locator('.k7-intro').innerText(),/^관리팀 KPI\s*관리팀이 할 일을 지표 8개로 잽니다 — 빨강 = 이번 주 목표 미달 · 줄마다 버튼 하나로 담당에게 요청 · 금요일 18시 결과 자동 저장$/);
  assert.deepEqual(await v.locator('.k7-bar button').allInnerTexts(),['지난주 보기','기준 설정','이번 주 결과 저장']);assert.match(await v.locator('.k7-bar').innerText(),/관리팀 KPI\s*한 줄 = 지표 하나/);
  /* 2. 왼쪽 진단 380px: 막대 · 작은 칸 3개 · 단계별 기준 넘긴 건 · 원인 4개 · 뭘 해야 하나 */
  assert.equal(await v.locator('.k7-left').evaluate(n=>getComputedStyle(n).flexBasis),'380px');
  assert.deepEqual(await v.locator('.k7-left .k7-card>header b').allInnerTexts(),['KPI 진단','관리팀 지표','왜 멈춰 있나','그래서 뭘 해야 하나'],'ops_12 D⑩: 관리팀 지표 칸');
  assert.deepEqual(await v.locator('.k7-left .k7-mg .k7-tiles>div>span, .k7-left .k7-mg .k7-none').allInnerTexts().then(a=>a.length?a:['없음']),(await v.locator('.k7-left .k7-mg .k7-tiles').count())?['요청','기한 내 해결률','재요청률','평균 처리 시간','기한 변경']:['요청 저장소가 아직 서버에 없어 잴 수 없습니다'],'관리팀 지표 = 요청 · 기한 내 해결률 · 재요청률 · 평균 처리 시간(요청 엔진 기록)');
  const K=await page.evaluate(()=>KpiV7.coreRows(KpiB.compute(),[],false).map(m=>({key:m.key,v:m.v,num:m.num,den:m.den,ready:KpiB.compute().M[m.i].ready,ok:m.ok,pilot:m.pilot,left:m.left,n:m.total})));/* 화면과 같은 줄 계산(견적문의 둘은 이번 주 월~금 · 2026-10-06 집계 ⑤) */
  const miss=K.filter(m=>m.v!=null&&!m.ok&&!m.pilot).length,pl=K.filter(m=>m.pilot).length,nd=K.filter(m=>m.v==null&&!m.pilot).length,hit=8-miss-nd-pl;/* 시범 측정(kpi:6)은 미달 · 달성에 넣지 않는다 */
  assert.match((await v.locator('.k7-leg').innerText()).replace(/\s+/g,' '),new RegExp('미달 '+miss+' ■ 달성 '+hit+' ■ 아직 못 잼 '+nd+(pl?' ■ 시범 · 평가 제외 '+pl:'')));
  assert.deepEqual(await v.locator('.k7-card:not(.k7-mg) .k7-tiles>div>span').allInnerTexts(),['목표 미달','남은 요청','지난주보다']);
  assert.equal(await v.locator('.k7-card:not(.k7-mg) .k7-tiles>div').nth(0).locator('b').innerText(),miss+'지표');assert.equal(await v.locator('.k7-card:not(.k7-mg) .k7-tiles>div').nth(1).locator('b').innerText(),K.reduce((a,m)=>a+m.left,0)+'건');
  assert.match(await v.locator('.k7-tiles>div').nth(2).innerText(),/▲\d+ · ▼\d+/,'지난주 저장본과 비교');
  const SG=await page.evaluate(()=>KpiV7.stageGroups(KpiB.compute().done).map(g=>({key:g.key,label:g.label,total:g.total,over:g.over,rules:g.rules.map(r=>[r.k,r.t,r.n,r.base,r.p,r.left])})));
  assert.equal(await v.locator('.k7-over').innerText(),"단계별 기준 넘긴 건 "+SG.reduce((a,g)=>a+g.over,0)+"건 · 오른쪽 '단계별 기준' 탭");
  assert.deepEqual(await v.locator('.k7-cause>span:first-child>span').allInnerTexts(),['고객 연락이 늦음','기록 · 입력을 안 남김','판단을 미룸','아직 못 잼']);
  /* 3. 오른쪽 '핵심 지표 8': 숫자 = 기존 계산(KpiB.compute) 그대로 · 나쁜 순 · 줄 모양 */
  assert.deepEqual(await v.locator('.k7-tabs button').evaluateAll(l=>l.map(b=>[b.textContent.replace(/\s+/g,' ').trim(),b.getAttribute('aria-selected')])),[['핵심 지표 8','true'],['단계별 기준 '+SG.reduce((a,g)=>a+g.rules.length,0),'false'],['측정 기준 13','false']]);
  const rows=await v.locator('.k7-list>.k7-row').evaluateAll(l=>l.map(n=>({key:n.dataset.kpi,cls:n.className.replace('k7-row','').trim(),q:n.querySelector('.q b').textContent,sub:n.querySelector('.q span').textContent,frac:n.querySelector('.m b').textContent,meta:n.querySelector('.m span').textContent,why:n.querySelector('.why').textContent,v:n.querySelector('.v').textContent,btn:(n.querySelector('.k7-req')||n.querySelector('.k7-auto')).textContent})));
  assert.equal(rows.length,8);assert.deepEqual(rows.map(r=>r.key).sort(),['kpi:1','kpi:2','kpi:3','kpi:4','kpi:5','kpi:6','kpi:7','kpi:8'],'지표 키는 예전 그대로');
  const order=rows.map(r=>r.cls==='bad'?0:r.cls==='ok'?1:2);assert.deepEqual(order,order.slice().sort((a,b)=>a-b),'미달 → 달성 → 아직 못 잼 순');
  for(const r of rows){const m=K.find(x=>x.key===r.key),f=v=>v==null?'–':(Math.round(v*10)/10)+'%';assert.equal(r.v,f(m.v),r.key+' 값');assert.ok(m.den&&m.ready!==false?r.frac.startsWith(m.num+' / '+m.den+'건 · 목표 '):r.frac.startsWith('아직 못 잼 · 목표 '),r.key+' 분자/분모 '+r.frac);assert.match(r.meta,/^지난주 .+ · 누가 .+/);assert.equal(r.cls,m.v==null||m.pilot?'':m.ok?'ok':'bad');assert.match(r.why,m.pilot?/^시범 측정 · 평가 제외$/:m.v==null?/^(아직 못 잼|완료 근거 미확인 .*|요청 업무 계산 중)$/:m.ok?/^달성$/:/^미달 · [\d.]+%p (부족|초과)$/);assert.ok(!m.n?r.btn==='자동 측정':true,r.key+' 버튼 '+r.btn);/* 이번 주 값이 없어도 누적 미처리가 있으면 요청 버튼(2026-10-06 집계 ⑤) */}
  const lost=rows.find(r=>r.key==='kpi:7');assert.deepEqual([lost.q,lost.sub,lost.v,lost.why,lost.btn],['사유 · 재영업 여부 · 필요한 낙찰 정보를 남겼나','실주 · 실주 정보 완성률','0%','미달 · 100%p 부족','담당 1명에게 요청 (1건)']);/* after_deploy ③: 숫자마다 단위(명 · 건) */
  assert.equal(rows.find(r=>r.key==='kpi:5').sub,'파이프라인 · 장기정체 비율');assert.match(rows.find(r=>r.key==='kpi:5').frac,/목표 ≤ 10%$/,'낮을수록 좋은 지표');
  assert.match(rows.find(r=>r.key==='kpi:3').meta,/^지난주 25% (▲|▼)[\d.]+%p · 누가 /,'지난주 저장값과 비교');
  if(shot)await page.screenshot({path:shot+'-core.png',fullPage:true});
  /* 4. 요청 버튼 = 담당자 이번 주 관리자 한마디 한 줄 + 건마다 조치 기록 → '보냄 ✓' */
  await v.locator('.k7-row[data-kpi="kpi:7"] .k7-req').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__deliveries.flatMap(p=>p.targets.map(t=>[p.promise_key,t.action,t.target_type,t.target_name]))),[['kpi:7','사유 요청','deal','사유 없는 실주']]);
  assert.deepEqual(await page.evaluate(()=>__deliveries.map(p=>[p.rep_name,p.targets.length,p.promise_key])),[['이필선',1,'kpi:7']],'서버 확인된 전달 1건');assert.equal(await page.evaluate(()=>__writes.length),0,'미연결 pushWrite 우회 없음');
  assert.deepEqual(await page.locator('#kpi-v7 .k7-row[data-kpi="kpi:7"] .k7-req').evaluate(b=>[b.textContent,b.disabled,b.classList.contains('sent')]),['보냄 ✓',true,true]);
  assert.match(await page.evaluate(()=>__toasts.slice(-1)[0]),/^요청 저장 확인 1건/);
  /* 배정은 요청이 아니라 오늘 업무의 배정 표로 */
  await page.locator('#kpi-v7 .k7-row[data-kpi="kpi:1"] .k7-req').click();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>G.page),'today');assert.match(await page.evaluate(()=>__toasts.slice(-1)[0]),/담당 배정 안 된 견적문의/);
  await page.evaluate(()=>goPage('mgmt'));await page.waitForTimeout(400);
  /* 5. 원인을 누르면 오른쪽이 걸러진다 · 리스트 / 보드 */
  await page.locator('#kpi-v7 .k7-cause[data-v="rec"]').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#kpi-v7 .k7-cause[data-v="rec"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#kpi-v7 .k7-clear').innerText(),'기록 · 입력을 안 남김 · 해제 ×');
  assert.ok((await page.locator('#kpi-v7 .k7-list>.k7-row').evaluateAll(l=>l.map(n=>n.dataset.kpi))).every(k=>['kpi:3','kpi:4','kpi:6','kpi:7'].includes(k)),'기록 · 입력 지표만');
  assert.equal(await page.locator('#kpi-v7 .k7-act').count(),1,'고른 원인의 할 일 한 문장');
  await page.locator('#kpi-v7 .k7-clear').click();await page.waitForTimeout(150);assert.equal(await page.locator('#kpi-v7 .k7-list>.k7-row').count(),8);
  await page.locator('#kpi-v7 .k7-view [data-v="board"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#kpi-v7 .k7-col>header b').allInnerTexts(),['미달','달성','아직 못 잼','시범 · 평가 제외']);assert.equal(await page.locator('#kpi-v7 .k7-kcard').count(),8);
  if(shot)await page.screenshot({path:shot+'-board.png',fullPage:true});
  await page.locator('#kpi-v7 .k7-view [data-v="list"]').click();await page.waitForTimeout(150);
  /* 6. '단계별 기준' 탭: 단계 화면과 같은 함수 · 같은 숫자 */
  await page.locator('#kpi-v7 .k7-tabs [data-v="stage"]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#kpi-v7 .k7-note').innerText(),"파이프라인 각 단계의 '그래서 뭘 해야 하나' 기준을 그대로 가져왔습니다. 기준을 넘긴 건이 곧 관리 대상입니다.");
  const same=await page.evaluate(()=>{const rows=PipelineWorkspace.rows(),out=[];Object.keys(PipelineStageB.CFG).forEach(key=>{const list=rows.filter(r=>r.group===key);if(!list.length)return;const md=PipelineStageB.model(key,list);Object.keys(md.C.RS).filter(k=>md.isRed(k)||(key==='lost'&&['noreason','relist','nobid'].includes(k))/* 실주 = 실주 화면 · 핵심 지표 7 · 측정 기준과 같은 완료 판정 */).forEach(k=>out.push([key,k,md.C.RS[k][0],md.items.filter(it=>it.rs.includes(k)).length]));});return out;});
  const shown=SG.filter(g=>g.key!=='inquiry').flatMap(g=>g.rules.map(r=>[g.key,r[0],r[1],r[2]]));assert.deepEqual(shown,same,'기준 이름 · 넘긴 건수 = 단계 화면 계산 그대로');
  const inq=SG.find(g=>g.key==='inquiry');assert.ok(inq,'견적문의 묶음');assert.deepEqual(inq.rules.map(r=>r[1]),['첫 연락 전','후속 연락 필요']);
  assert.deepEqual(inq.rules.map(r=>r[2]),await page.evaluate(()=>{const ms=InquiryListV2.rows().map(x=>InquiryListV3.model(x)).filter(m=>m.step<4);return [ms.filter(m=>m.step===1).length,ms.filter(m=>m.follow&&m.late).length];}),'견적문의 목록 탭과 같은 판정');
  const heads=await page.locator('#kpi-v7 .k7-stage').evaluateAll(l=>l.map(n=>[n.querySelector('em').textContent,n.querySelector('span').textContent.replace(/\s+/g,' '),n.querySelector('button').textContent]));
  assert.deepEqual(heads,SG.map(g=>[g.label,g.total+'건 · 기준 넘김 '+g.over+'건','단계로 이동 →']));
  const srow=await page.locator('#kpi-v7 .k7-row[data-rule="stage:lost:noreason"]').evaluate(n=>({t:n.querySelector('.q b').textContent,how:n.querySelector('.q span').textContent,p:n.querySelector('.p b').textContent,n:n.querySelector('.n').textContent,btn:n.querySelector('.k7-req').textContent,bad:n.classList.contains('bad')}));
  assert.equal(srow.n,'1건');assert.equal(srow.p,'0%');assert.equal(srow.bad,true,'지킨 비율 80% 미만 빨강');assert.match(srow.how,/ · 기준 대상 1건$/);assert.equal(srow.btn,'담당 1명에게 요청 (1건)');
  if(shot)await page.screenshot({path:shot+'-stage.png',fullPage:true});
  {const n0=await page.evaluate(()=>__deliveries.length);await page.locator('#kpi-v7 .k7-row[data-rule="stage:lost:noreason"] .k7-req').click();await page.waitForTimeout(500);
   const a=await page.evaluate(n=>__deliveries.slice(n).flatMap(p=>p.targets.map(t=>[p.promise_key,t.target_type,t.target_name])),n0);assert.deepEqual(a,[['stage:lost:noreason','deal','사유 없는 실주']]);
   assert.equal(await page.locator('#kpi-v7 .k7-row[data-rule="stage:lost:noreason"] .k7-req').innerText(),'보냄 ✓');}
  await page.locator('#kpi-v7 .k7-stage [data-v="consulting"]').click();await page.waitForTimeout(500);assert.notEqual(await page.evaluate(()=>G.page),'mgmt','단계로 이동');
  await page.evaluate(()=>goPage('mgmt'));await page.waitForTimeout(400);
  /* 7. 지난주 보기 · 담당자 알약 · 이번 주 결과 저장 */
  await page.locator('#kpi-v7 [data-k7="last"]').click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#kpi-v7 [data-k7="last"]').innerText(),'이번 주 보기');
  {const lr=await page.locator('#kpi-v7 .k7-list>.k7-row').evaluateAll(l=>l.map(n=>[n.dataset.kpi,n.querySelector('.v').textContent,n.querySelector('.m span').textContent,(n.querySelector('.k7-auto')||{}).textContent||'버튼']));
   assert.deepEqual(lr.find(r=>r[0]==='kpi:1'),['kpi:1','25%','지난주 금요일 저장본','자동 측정']);assert.equal(lr.find(r=>r[0]==='kpi:7')[1],'–','저장이 없던 지표는 못 잼');}
  await page.locator('#kpi-v7 [data-k7="last"]').click();await page.waitForTimeout(200);
  const who=pills[1][0].replace(/ (미달 \d+|기록 없음)$/,'');await page.locator('#kpi-v7 .k7-who',{hasText:who}).first().click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>SalesScope.state().owner),who,'알약 = 공통 담당 필터');assert.equal(await page.locator('#kpi-v7 .k7-who.on').first().evaluate(n=>n.dataset.v),who);
  await page.locator('#kpi-v7 .k7-who[data-v="전체"]').click();await page.waitForTimeout(400);
  await page.locator('#kpi-v7 [data-k7="save"]').click();await page.waitForTimeout(400);
  assert.ok(await page.evaluate(()=>__rpc.some(r=>r[0]==='crm_kpi_weekly_save_v1'&&r[1].rows.every(x=>/^kpi:\d$/.test(x.promise_key)))),'주간 저장은 예전 열쇠 그대로');
  /* 8. 좁은 화면 넘침 없음 · 끄면 예전 화면 */
  await page.setViewportSize({width:1207,height:914});await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'노트북 폭에서 옆으로 넘치지 않음');if(shot)await page.screenshot({path:shot+'-laptop.png',fullPage:true});
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.kpiV7Off=true;paint();});await page.waitForTimeout(400);assert.equal(await page.locator('#kpi-v7').count(),0);assert.equal(await page.locator('#kpi-b').count(),1,'끄면 예전 KPI 화면');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#pg-mgmt>.cf-bar')).display!=='none'),true,'끄면 공통 필터줄도 다시 보인다');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',people_pills_with_miss_count:true,left_diagnosis:true,core8_same_numbers_as_kpib:true,request_logs_and_marks_sent:true,cause_filter_and_board:true,stage_rules_same_function:true,last_week_and_save:true,narrow:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
