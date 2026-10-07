'use strict';
/* 대표 판단 문구 검사(2026-10-07 design_handoff_exec_wording · 시안 '대표 판단 문구 시안.dc.html')
   대시보드: '종결 n · 사유별 분류 후 품질 판단'(5분류) · '영업건 전환 대기 n · 지연 여부 확인 필요'(나눔 · 합계 = 제목 · 진행 중은 이탈 아님) · 조치 필요 = 기한 지남 + 다음 할 일 없음 + 담당 미배정 = 제목
   영업사원 관리: 업무량 5칸 + 신규 배정 판단 · 밀린 첫 연락 정리 · 조치 n = 견적문의 + 파이프라인 / 단계 전진 같은 함수 / 기한 미루기 원래 기한 · 사유(필수) / 왜 이 판단인지 보기 */
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
  /* 오늘 = 2026-10-07(수) 10:00 · 이번 주 = 10/5(월) ~ 10/9(금) */
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DashB&&window.ExecWording&&window.RepsB&&window.SalesInsights&&window.BriefB&&window.ContractSalesData&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const U=n=>'0000000'+n+'-0000-4000-8000-0000000000'+String(n).padStart(2,'0'),T=k=>k+'T10:00:00+09:00';
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:'2026-02-01',code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,site,owner,at,extra)=>Object.assign({id:U(n),site,status:owner?'배정완료':'접수',at,created_at:at,received_at:at,brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at:null},extra||{});
   const closed=(n,site,reason,status)=>inq(n,site,'','2026-09-0'+(n%9+1)+'T10:00:00+09:00',{status:status||'종결',close_reason:reason});
   B={deals:[
     ...[1,2].map(i=>deal('o'+i,'[경기] 기한 지난 현장 '+i,'황윤선','sent',{nextActionObj:{text:'후속 통화',due:'2026-09-20',status:'open'},lastMeaningfulContactAt:T('2026-09-01'),activities:[{id:'ao'+i,type:'전화',note:'통화',at:T('2026-09-01')}]})),
     deal('m1','[서울] 다음 할 일 없는 현장','이필선','consulting',{}),deal('m2','[서울] 다음 할 일 없는 현장 2','이필선','consulting',{}),
     deal('u1','[인천] 담당 없는 현장','','consulting',{nextActionObj:{text:'배정 확인',due:'2026-10-20',status:'open'},lastMeaningfulContactAt:T('2026-10-06'),activities:[{id:'au1',type:'전화',note:'통화',at:T('2026-10-06')}]}),
     deal('n1','[수원] 정상 현장','이필선','bidding',{stage_contexts:{bidding:{fields:{bid_deadline:'2026-10-09'}}},nextActionObj:{text:'입찰 준비',due:'2026-10-09',type:'입찰',status:'open'},lastMeaningfulContactAt:T('2026-10-06'),activities:[{id:'an1',type:'전화',note:'통화',at:T('2026-10-06')}]})],
    inquiries:[
     /* 종결 5분류: 부적합 · 중복 · 협약 → B2B · 고객 취소 · 사유 미확인 */
     closed(1,'[부산] 범위 밖','기타 종결 — 배드핏(부적합) · 공사 범위 밖 · 이전 상태: 접수','종결'),closed(2,'[대구] 중복','중복 문의 · 같은 고객','종결'),closed(3,'[광주] 협약','협약 종결 · B2B 협약','종결'),closed(4,'[울산] 취소','상담종결 · 계획 없음','종결'),closed(5,'[제주] 사유 없음','','종결'),
     /* 전환 대기: 첫 연락 전 기한 안 · 2시간 넘김 · 응대 중 정상 · 7일 무연락 · 담당 미배정 */
     inq(11,'[경기] 첫 연락 기한 안','이필선','2026-10-07T09:00:00+09:00'),
     inq(12,'[경기] 첫 연락 늦음','이필선','2026-10-07T04:00:00+09:00'),
     inq(13,'[경기] 응대 중 정상','황윤선','2026-10-03T10:00:00+09:00',{responded_at:'2026-10-06T10:00:00+09:00'}),
     inq(14,'[경기] 응대 중 7일 넘게 연락 없음','황윤선','2026-09-20T10:00:00+09:00',{responded_at:'2026-09-21T10:00:00+09:00'}),
     inq(15,'[서울] 미배정 문의','','2026-10-07T08:00:00+09:00')],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   ContractSalesData.state=()=>({status:'ready',items:[]});
   window.__opened=[];drwDeal=s=>__opened.push(JSON.parse(s).id);drwInq=s=>__opened.push(JSON.parse(s).id);
   goPage('dash');
  });
  await page.waitForTimeout(600);
  const d=page.locator('#si-dash .db-shell');assert.equal(await d.count(),1,'새 대시보드');
  /* ── 1~3 대시보드 판단 문구 · 합계 ── */
  if(shot)await page.screenshot({path:shot+'-dash.png',fullPage:true});
  const f6=await d.locator('.db-f6n').innerText();
  assert.doesNotMatch(f6,/유입 품질 문제/,"'유입 품질 문제' 문구는 없다");assert.doesNotMatch(f6,/가장 큰 이탈/,"'가장 큰 이탈' 문구는 없다");
  assert.match(f6,/문의 품질 · 종결 5건 · 사유별 분류 후 품질 판단/);
  assert.match(f6,/영업건 전환 · 영업건 전환 대기 5건 · 지연 여부 확인 필요/);
  assert.equal(await d.locator('.db-f6n .red').count(),1,'지연이 있으면 전환 대기 문장만 빨강');
  const ew=await d.evaluate(()=>{const s=ExecWording;const C=DashB.core();return {close:s.closeSplit(C.bad).parts.map(p=>[p.k,p.n]),wait:s.waitSplit(C.q.filter(x=>!C.B.badfit(x)&&!R_conv(x))).parts.map(p=>[p.k,p.n])};function R_conv(x){try{return !!inqCtlConverted(x);}catch(e){return false;}}});
  assert.deepEqual(ew.close,[['bad',1],['dup',1],['b2b',1],['cancel',1],['unk',1]],'종결 5분류 · 한 건은 한 곳');
  assert.deepEqual(ew.wait,[['firstOk',1],['firstLate',1],['talkOk',1],['talkStale',1],['noOwner',1]],'전환 대기 나눔 · 담당 미배정도 표시');
  const boxes=d.locator('.ew-box');assert.equal(await boxes.count(),2);
  assert.match(await boxes.nth(0).innerText(),/종결 5건 · 사유별[\s\S]*부적합 \(배드핏\)[\s\S]*중복 문의[\s\S]*협약 문의 → B2B 전환[\s\S]*고객 취소 · 계획 없음[\s\S]*사유 미확인[\s\S]*유입 품질 판단은 부적합 1 기준 · 사유 미확인 1은 분류 후 다시 판단/);
  assert.match(await boxes.nth(1).innerText(),/영업건 전환 대기 5건 · 나눔[\s\S]*첫 연락 전 · 기한 안[\s\S]*첫 연락 전 · 2시간 넘김[\s\S]*응대 중 · 정상[\s\S]*응대 중 · 7일 넘게 연락 없음[\s\S]*담당 미배정[\s\S]*1 \+ 1 \+ 1 \+ 1 \+ 1 = 5/);
  for(let i=0;i<2;i++){const nums=await boxes.nth(i).locator('.ew-bar>b').allInnerTexts();assert.equal(nums.reduce((a,b)=>a+Number(b),0),5,'막대 합계 = 제목 숫자');}
  /* 조치 필요 = 기한 지남 + 다음 할 일 없음 + 담당 미배정 = 제목 */
  const kpi=await d.locator('.db-kpi').evaluateAll(a=>a.map(n=>[n.querySelector('span').textContent,n.querySelector('b').textContent,n.querySelector('small').textContent]));
  const act=kpi.find(k=>k[0]==='조치 필요');assert.ok(act,'조치 필요 카드');
  const m=/^기한 지남 (\d+) \+ 다음 할 일 없음 (\d+) \+ 담당 미배정 (\d+)(?: \+ 그 밖 · 연락 · 정체 · 정보 부족 (\d+))? = (\d+)$/.exec(act[2]);assert.ok(m,'조치 필요 설명 '+act[2]);
  assert.equal(Number(m[1])+Number(m[2])+Number(m[3])+Number(m[4]||0),Number(m[5]),'설명 숫자 합계 = 제목 숫자');assert.equal(act[1],m[5]+'건');assert.equal(Number(m[3]),1,'담당 미배정 1건이 조치 필요에 들어간다');
  /* ── 7 왜 이 판단인지 보기 ── */
  await d.locator('.db-f6n [data-ew-why="close"]').click();await page.waitForTimeout(150);
  let w=page.locator('#ew-why');assert.equal(await w.count(),1,'근거 창');
  assert.match(await w.locator('header b').innerText(),/^왜 이 판단인지 보기 · 종결 5건 · 사유별 분류$/);
  assert.deepEqual(await w.locator('.ew-tiles>div').evaluateAll(l=>l.map(x=>x.innerText.replace(/\s+/g,' ').trim())),['부적합 1','사유 미확인 1','그 밖 분류 3']);
  assert.deepEqual(await w.locator('.ew-dl dt').allInnerTexts(),['판정 조건','제외','근거 날짜']);assert.match(await w.locator('.ew-dl dd').nth(2).innerText(),/^2026\.10\.7 10:00 기준/);
  assert.match(await w.locator('.ew-sum').innerText(),/^1 \+ 1 \+ 1 \+ 1 \+ 1 = 5$/);assert.equal(await w.locator('.km-row').count(),5);
  await w.locator('[data-ew="close"]').click();assert.equal(await page.locator('#ew-why').count(),0,'닫기');
  await d.locator('.db-f6n [data-ew-why="wait"]').click();await page.waitForTimeout(150);w=page.locator('#ew-why');
  assert.match(await w.locator('header b').innerText(),/영업건 전환 대기 5건/);assert.deepEqual(await w.locator('.ew-tiles>div').evaluateAll(l=>l.map(x=>x.innerText.replace(/\s+/g,' ').trim())),['첫 연락 전 3건','응대 중 2건','지연 확인 필요 2건']);
  const wrows=await w.locator('.km-row').evaluateAll(l=>l.map(r=>r.querySelector('.km-j').textContent));assert.deepEqual(wrows.slice(0,3).every(x=>/2시간 넘김|7일 무연락|담당 미배정/.test(x)),true,'지연이 먼저: '+wrows.join(','));
  await w.locator('[data-ew="close"]').click();assert.equal(await page.locator('#ew-why').count(),0);
  await d.locator('.db-kpi .ew-j[data-ew-why="action"]').click();await page.waitForTimeout(150);w=page.locator('#ew-why');
  assert.match(await w.locator('header b').innerText(),new RegExp('조치 필요 '+m[5]+'건'));assert.equal(await w.locator('.ew-sum').innerText(),act[2],'근거 합계 = 카드 설명');
  assert.equal(await w.locator('.km-row').count(),Number(m[5]));await w.locator('.km-row[data-kind="deal"]').first().click();assert.equal(await page.locator('#ew-why').count(),0,'줄을 누르면 창을 닫고 그 현장을 연다');assert.equal(await page.evaluate(()=>__opened.length>=1),true,'기존 상세 경로');await d.locator('.db-kpi .ew-j[data-ew-why="action"]').click();await page.waitForTimeout(100);await page.keyboard.press('Escape');assert.equal(await page.locator('#ew-why').count(),0,'Esc 로 닫힘');
  /* ── 8 단계 전진: 대시보드 · 영업사원 관리 같은 함수 ── */
  await d.locator('.db-secs [data-v="pipe"]').click().catch(()=>{});await page.waitForTimeout(100);
  const adv=await page.evaluate(()=>{const C=DashB.core(),a=ExecWording.advanceStats(C.AD);return a.n;});
  assert.equal(typeof adv,'number');
  /* 인정 조건: 뒤로 이동 · 종결 · 근거 없는 이동은 안 센다 */
  const rules=await page.evaluate(()=>{const J=PipelineJudge,w=J.week(0),wk=J.week(-1);const mk=(from,to,reason,at)=>({deal:{id:'adv',stage_history:[],stageHistory:[{at:at||(w.mon+'T10:00:00+09:00'),from,to,reason}]}});const run=(from,to,reason)=>{const d={id:'adv'+from+to,stageHistory:[{at:w.mon+'T10:00:00+09:00',from,to,reason}]};return ExecWording.advanceOf(d,w);};return {fwd:run('first_contact','sent','자료 발송 확인'),noEv:run('first_contact','sent',''),back:run('sent','first_contact','되돌림'),end:run('contract','won','계약')};});
  assert.ok(rules.fwd&&rules.fwd.evidence===true,'다음 단계로 이동 + 근거 기록 = 인정');assert.ok(rules.noEv&&rules.noEv.evidence===false,'근거 기록 없음 = 인정 안 함(따로 표시)');assert.equal(rules.back,null,'뒤로 이동 제외');assert.equal(rules.end,null,'종결 제외');
  assert.match(await d.evaluate(()=>ExecWording.ADVANCE_RULE),/다음 단계로 이동 \+ 근거 기록 있음 · 대상: 영업 담당 전체 · 기간 월~금 · 뒤로 이동 · 종결은 제외/);
  /* ── 6 기한 미루기: 원래 기한 · 새 기한 · 사유(필수) ── */
  const pp=await page.evaluate(()=>{const dd=B.deals.find(x=>x.id==='o1');window.__pp=ExecWording.postponeAsk(dd,'2026-10-10').then(g=>{window.__ppRes=g;});return !!document.getElementById('ew-postpone');});
  assert.equal(pp,true,'미루면 사유 창');
  const pf=page.locator('#ew-postpone');assert.match(await pf.locator('.ew-dl').innerText(),/원래 기한\s*9\.20\s*17일 지남[\s\S]*새 기한\s*10\.10[\s\S]*사유 \*/);
  await pf.locator('button[type=submit]').click();assert.match(await pf.locator('.ew-err').innerText(),/미루는 사유를 입력/,'사유는 필수');assert.equal(await page.evaluate(()=>window.__ppRes===undefined),true,'사유 없이는 저장 안 됨');
  await pf.locator('textarea').fill('고객 요청 · 입대의 후 연락');await pf.locator('button[type=submit]').click();await page.waitForTimeout(100);
  const res=await page.evaluate(()=>window.__ppRes);assert.deepEqual([res.postpone,res.from,res.to,res.reason,res.over],[true,'2026-09-20','2026-10-10','고객 요청 · 입대의 후 연락',17]);assert.equal(await page.locator('#ew-postpone').count(),0);
  assert.equal(await page.evaluate(()=>{const dd=B.deals.find(x=>x.id==='o1');return ExecWording.postponeAsk(dd,'2026-09-19').then(g=>g.postpone===false&&!document.getElementById('ew-postpone'));}),true,'앞당기면 사유 안 받음');
  assert.equal(await page.evaluate(()=>{const dd=B.deals.find(x=>x.id==='o1');const w=PipelineJudge.week(0);dd.activities=(dd.activities||[]).concat([{id:'pp1',type:'기타',note:ExecWording.markText(window.__ppRes),at:w.mon+'T11:00:00+09:00'}]);return ExecWording.postponeCount([dd]).n;}),1,"KPI '기한 변경 n회' = 기록 표식 수");
  assert.match(await page.evaluate(()=>ExecWording.markText(window.__ppRes)),/^\[기한 변경\] 원래 2026-09-20 \(17일 지남\) \| 새 2026-10-10 \| 사유 고객 요청 · 입대의 후 연락$/);
  assert.equal(await page.evaluate(()=>(DashB.core().loss||[]).length>=0),true);
  /* ── 5 영업사원 관리: 업무량 5칸 + 신규 배정 판단 ── */
  await page.evaluate(()=>{goPage('repmanage');});await page.waitForTimeout(500);
  const rb=page.locator('#reps-b');assert.equal(await rb.count(),1);
  const ld=page.locator('.ew-load');assert.equal(await ld.count(),1,'업무량 5칸 블록');
  assert.deepEqual(await ld.locator('.ew-lr.h>span').allInnerTexts(),['담당','오늘 처리','이번 주 일정','첫 연락 전','관리 고객','기록 보완','신규 배정']);
  const L=await page.evaluate(()=>ExecWording.loadAll(REP_MANAGER_ROWS).map(l=>[l.name,l.due.length,l.first.length,l.late.length,l.miss.length,l.judge]));
  const lp=L.find(x=>x[0]==='이필선'),hy=L.find(x=>x[0]==='황윤선');assert.ok(lp&&hy,'사람 '+JSON.stringify(L));
  assert.equal(lp[2],2,'이필선 첫 연락 전 2건(기한 안 1 · 2시간 넘김 1)');assert.equal(lp[3],1,'밀린 첫 연락 = 2시간 넘김 1건');assert.equal(lp[5],'첫 연락 먼저','첫 연락 전이 있으면 신규 배정은 첫 연락 먼저');
  assert.equal(hy[1],2,'황윤선 오늘 처리 = 기한 지난 2건');assert.equal(hy[5],'가능');
  const lrow=ld.locator('.ew-lr:not(.h)').filter({hasText:'이필선'});assert.match(await lrow.innerText(),/이필선\s*0\s*1 · 입찰 1\s*2\s*—\s*\d+\s*첫 연락 먼저/);
  assert.match(await ld.locator('footer').innerText(),/첫 연락 기준 신규 문의는 배정 후 2시간 안 · 밀린 첫 연락 1건 정리 · 금요일까지로 따로[\s\S]*조치 n건 = 견적문의 \+ 파이프라인 모두[\s\S]*신규 배정 판단 첫 연락 전이 있으면 첫 연락 먼저/);
  assert.match(await rb.locator('.psb-row[data-key="이필선"]').innerText(),/신규 배정 첫 연락 먼저/,'사람 줄: 업무량 대신 신규 배정 판단');assert.doesNotMatch(await rb.innerText(),/관리부하/);
  /* 조치 n = 견적문의 + 파이프라인: 이필선 조치 = 위험 현장 + 첫 연락 전 2 */
  const act2=await page.evaluate(()=>{const r=REP_MANAGER_ROWS.find(x=>x.nm==='이필선');return [r.risk,r.unresponded];});
  assert.match(await rb.locator('.psb-row[data-key="이필선"]').innerText(),new RegExp('조치 '+(act2[0]+act2[1])+'건'),'조치 n = 위험 현장 + 첫 연락 전 문의('+act2.join(' + ')+')');assert.ok(act2[1]>=2,'첫 연락 전 문의가 조치에 들어간다');
  await lrow.locator('[data-ew-why="load"]').click();await page.waitForTimeout(150);w=page.locator('#ew-why');
  assert.match(await w.locator('header b').innerText(),/이필선 · 신규 배정 첫 연락 먼저/);assert.match(await w.locator('.ew-dl dd').nth(0).innerText(),/오늘 처리 6건 이상이면 여유 없음/);assert.match(await w.locator('.ew-dl dd').nth(1).innerText(),/잠정 기준\(설정값 아님\)/);
  assert.ok(await w.locator('.km-row').count()>=2,'첫 연락 전 2건 + 기록 보완');await w.locator('[data-ew="close"]').click();
  /* 사람 줄의 단계 전진 = 대시보드와 같은 함수 */
  assert.equal(await page.evaluate(()=>{const r=REP_MANAGER_ROWS.find(x=>x.nm==='이필선');return r.weekAdvanced===ExecWording.advanceStats(r.deals||[]).n;}),true,'영업사원 관리 단계 전진 = ExecWording.advanceStats');
  if(shot)await page.screenshot({path:shot+'-reps.png',fullPage:true});
  /* 끄기 */
  await page.evaluate(()=>{G.execWordingOff=true;goPage('repmanage');paintRepManagement();});await page.waitForTimeout(300);
  assert.equal(await page.locator('.ew-load').count(),0,'끄면 5칸 블록 없음');assert.match(await page.locator('#reps-b .psb-row').first().innerText(),/업무량/);
  assert.deepEqual(errs,[],'페이지 오류 없음 '+errs.join(' | '));
  console.log('verify-exec-wording-browser ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
