'use strict';
/* KPI 측정 기준 검사(2026-10-07 design_handoff_kpi_measure · 시안 'KPI 측정 기준 시안.dc.html')
   관리팀 KPI 세 번째 탭 '측정 기준': 4묶음 13칸 · 분모 0이면 '측정 불가'(100% 아님) · 미확정 기준은 '시범 측정 · 평가 제외'(미달 · 달성에 안 들어감)
   · 칸을 누르면 지표 근거(숫자 3칸 · 계산식 · 포함 · 제외 · 기준 · 현장 목록 20건 쪽 번호) · 요청 버튼 숫자 설명 · 오늘 업무 · 확장관리 같은 분류 · 끄기 G.kpiMeasureOff */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.KpiB&&window.KpiV7&&window.KpiMeasure&&window.PipelineStageB&&window.PipelineJudge&&window.OpsStore&&typeof paintMgmt==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-90),updated:day(-60),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const ctx=(stage,fields,editedAt)=>({stage_contexts:{[stage]:{fields,edited_at:editedAt||at(-1)}}});
   B={deals:[
    /* 자료 발송: 준수(발송 12일 전 · 8일 전 후속) / 미준수(12일 전 · 후속 없음) / 발송일 없음 / 기한 전(3일 전) */
    deal('s1','발송 후속 한 현장','이필선','sent',Object.assign({activities:[{id:'as1',type:'전화',note:'통화',at:at(-8)}]},ctx('sent',{sent_date:day(-12)}))),
    deal('s2','발송 후속 안 한 현장','이필선','sent',ctx('sent',{sent_date:day(-12)})),
    deal('s3','발송일 없는 현장','황윤선','sent',{activities:[{id:'as3',type:'전화',note:'통화',at:at(-2)}]}),
    deal('s4','발송 3일 된 현장','황윤선','sent',ctx('sent',{sent_date:day(-3)})),
    /* 관계관리: 집중(발송 10일 전 · 연락 없음 → 7일 지남) / 일반(발송 40일 전 · 2일 전 연락) / 미확인(발송일 없음) */
    deal('r1','집중관리 현장','이필선','rapport',ctx('sent',{sent_date:day(-10)})),
    deal('r2','일반관리 현장','황윤선','rapport',Object.assign({activities:[{id:'ar2',type:'전화',note:'통화',result:'연결됨',meaningful:true,at:at(-2)}]},ctx('sent',{sent_date:day(-40)}))),
    deal('r3','분류 안 된 현장','황윤선','rapport',{}),
    /* 컨설팅: 미팅 8일 전 + 7일 전 견적 요청(준수) / 미팅 8일 전 요청 없음(미준수) */
    deal('c1','미팅 후 견적 요청한 현장','이필선','consulting',Object.assign({activities:[{id:'ac1',type:'방문',note:'1차 미팅',at:at(-8)}]},ctx('consulting',{quote_request:'견적 요청',meeting_date:day(-8)},at(-7)))),
    deal('c2','미팅 후 견적 없는 현장','황윤선','consulting',Object.assign({activities:[{id:'ac2',type:'방문',note:'1차 미팅',at:at(-8)}]},ctx('consulting',{meeting_date:day(-8)},at(-8)))),
    /* 실주: 사유 없음 / 사유 + 재영업 여부 */
    deal('l1','사유 없는 실주','이필선','lost',{outcome:'lost',closed_at:day(-3)}),
    deal('l2','기록 끝난 실주','황윤선','lost',Object.assign({outcome:'lost',closed_at:day(-5),close_reason:'가격'},ctx('lost',{close_reason:'가격',reengage:'아니오'}))),
    /* 시공: 착공일 없음 */
    deal('k2','착공일 없는 현장','황윤선','construction',{})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.kb=null;G.kbDone=null;G.kbNmSent=null;G.k7=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   const mem={};Phase1.storage.getItem=k=>k in mem?mem[k]:null;Phase1.storage.setItem=(k,v)=>{mem[k]=String(v);};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req';};
   window.__open=null;drwDeal=s=>{window.__open=JSON.parse(s).id;};
   window.__rpc=[];SB={rpc:async(name,args)=>{__rpc.push([name,args&&args.p]);if(name==='crm_kpi_weekly_list_v1')return {data:{ok:true,rows:[]}};if(name==='crm_kpi_action_list_v1')return {data:{ok:true,actions:[]}};if(name==='crm_ops_settings_v1')return {data:{ok:true,settings:{}}};return {data:{ok:true,tasks:[],rows:[],actions:[]}};}};TOKEN='test';
   goPage('mgmt');
  });
  await page.waitForTimeout(500);
  const v=page.locator('#kpi-v7');assert.equal(await v.count(),1);
  /* 1. 세 번째 탭 '측정 기준 13' */
  const tabs=await v.locator('.k7-tabs button').evaluateAll(l=>l.map(b=>b.textContent.replace(/\s+/g,' ').trim()));
  assert.deepEqual(tabs.map(t=>t.replace(/ \d+$/,'')),['핵심 지표','단계별 기준','측정 기준'],'탭 3개');assert.equal(tabs[2],'측정 기준 13');
  await v.locator('.k7-tabs button').nth(2).click();await page.waitForTimeout(150);
  assert.equal(await page.locator('#kpi-v7 .km').count(),1);
  /* 2. 4묶음 · 13칸 */
  assert.deepEqual(await v.locator('.km-g>header b').allInnerTexts(),['기록 완성도','행동 준수','영업 결과','관리팀 처리']);
  assert.deepEqual(await v.locator('.km-g').evaluateAll(l=>l.map(g=>g.querySelectorAll('.km-card').length)),[3,6,2,2]);
  const M=await page.evaluate(()=>{const D=KpiMeasure.compute();return D.list.map(m=>({id:m.id,label:m.label,state:m.state,vText:m.vText,num:m.num,den:m.den,n:m.n.map(x=>[x[0],x[1]]),rows:m.rows.length}));});
  const by=id=>M.find(m=>m.id===id);
  /* 기록 완성도 */
  assert.deepEqual([by('a1').num,by('a1').den,by('a1').vText],[3,4,'75%'],'발송일 입력률 = 입력 3 ÷ 발송 단계 4');
  assert.deepEqual(by('a1').n,[['입력됨',3],['미입력',1],['해당 없음',0]]);
  assert.deepEqual([by('a2').num,by('a2').den],[2,3],'관계관리 분류 완료 2 ÷ 3(발송일 없는 1건 = 미확인)');
  assert.deepEqual([by('a3').num,by('a3').den,by('a3').vText],[1,2,'50%'],'실주 결과 기록 완성: 사유 + 재영업 여부 둘 다 있는 1 ÷ 2');
  /* 행동 준수 — 측정 가능 건만 분모 */
  assert.deepEqual(by('b1').n,[['준수',1],['미준수',1],['측정 불가',1]],'발송 후 7일 후속: 준수 1 · 미준수 1 · 발송일 없음 1 · (기한 전 1은 분모에서 뺌)');
  assert.deepEqual([by('b1').num,by('b1').den,by('b1').vText],[1,2,'50%']);
  assert.deepEqual([by('b2').num,by('b2').den,by('b2').vText],[0,1,'0%'],'집중관리 1곳 · 7일 지나 미준수');
  assert.deepEqual(by('b2').n,[['준수',0],['미준수',1],['미확인 제외',1]]);
  assert.deepEqual([by('b2n').num,by('b2n').den,by('b2n').vText],[1,1,'100%'],'일반관리 1곳 · 월 안 접촉');
  assert.equal(by('b2w').vText,'측정 불가','대기로 분류된 고객 0 → 100%가 아니라 측정 불가');assert.equal(by('b2w').state,'na');
  assert.equal(by('b4').vText,'측정 불가');assert.deepEqual(by('b4').n,[['준수',0],['미준수',0],['측정 불가',1]],'착공일 없는 시공 현장은 측정 불가');
  assert.equal(by('b3').state,'pilot','미팅 후 3일 견적 요청 = 시범 측정');assert.deepEqual([by('b3').num,by('b3').den],[1,2]);
  /* 3. 카드 모양: 측정 불가 = 회색 '측정 불가' · 시범 = 태그 · 100% 금지 */
  const card=id=>v.locator('.km-card[data-v="'+id+'"]');
  assert.match((await card('b4').innerText()).replace(/\s+/g,' '),/^착공 후 주 1회 방문 측정 불가 /);assert.equal(await card('b4').locator('.km-v').evaluate(n=>n.classList.contains('na')),true);
  assert.match((await card('b3').innerText()).replace(/\s+/g,' '),/^미팅 후 3일 견적 요청 50% 시범 측정 · 평가 제외 /);
  assert.match((await card('b2w').innerText()).replace(/\s+/g,' '),/측정 불가 대기로 분류된 고객 0 · 미확인 1 제외/);
  assert.match((await card('a1').innerText()).replace(/\s+/g,' '),/자료 발송일 입력률 75% 3 \/ 4 · 발송일 보완 1건/);
  /* 4. 칸 누르면 지표 근거 */
  await card('b1').click();await page.waitForTimeout(100);
  const pn=v.locator('.km-panel');
  assert.match(await pn.locator('header b').innerText(),/^지표 근거 · 발송 후 7일 후속 준수$/);
  assert.deepEqual(await pn.locator('.km-tiles>div').evaluateAll(l=>l.map(d=>d.innerText.replace(/\s+/g,' ').trim())),['준수 1','미준수 1','측정 불가 1']);
  assert.deepEqual(await pn.locator('.km-pl dt').allInnerTexts(),['계산식','포함','제외','기준']);
  assert.match(await pn.locator('.km-pl dd').nth(0).innerText(),/기한 내 후속 완료 ÷ 기한이 도래한 측정 가능 건/);assert.match(await pn.locator('.km-pl dd').nth(2).innerText(),/발송일 없음 1/);
  const rows=await pn.locator('.km-row').evaluateAll(l=>l.map(r=>[r.querySelector('.km-s1').textContent,r.querySelector('.km-j').textContent,r.querySelector('.km-e').textContent]));
  assert.equal(rows.length,4);assert.deepEqual(rows.map(r=>r[1]),['미준수','측정 불가','기한 전','준수'],'미준수 → 측정 불가 · 기한 전 → 준수 순');
  assert.match(rows[0][2],/후속 기록 없음/);assert.match(rows[1][2],/발송일 없음 · 발송일 입력/);
  /* 5. 현장 줄을 누르면 상세가 열린다 · 글이 잘리지 않는다 */
  await pn.locator('.km-row').first().click();assert.equal(await page.evaluate(()=>window.__open),'s2');
  const clip=await page.evaluate(()=>[...document.querySelectorAll('#kpi-v7 .km-card, #kpi-v7 .km-tiles>div, #kpi-v7 .km-pl dd')].filter(n=>n.scrollWidth>n.clientWidth+1&&getComputedStyle(n).overflow!=='visible').length);assert.equal(clip,0,'칸 안 글이 잘리지 않음');
  /* 6. 영업 결과 · 관리팀 처리: 계약 원장 · 요청 저장소가 없으면 '불러오는 중'/'잴 수 없음'이지 숫자를 지어내지 않는다 */
  assert.equal(M.filter(m=>m.id==='c1'||m.id==='c2'||m.id==='d1'||m.id==='d2').length,4);
  /* 7. 핵심 지표 탭: 시범 측정 지표는 미달 · 달성에 들어가지 않는다 */
  await v.locator('.k7-tabs button').nth(0).click();await page.waitForTimeout(120);
  const q6=v.locator('.k7-row[data-kpi="kpi:6"]');assert.match(await q6.locator('.why').innerText(),/^시범 측정 · 평가 제외$/);assert.equal(await q6.evaluate(n=>n.classList.contains('bad')||n.classList.contains('ok')),false);assert.equal(await q6.locator('.k7-req').count(),0,'시범 지표는 요청 버튼 없음');
  assert.match((await v.locator('.k7-leg').innerText()).replace(/\s+/g,' '),/시범 · 평가 제외 1/);
  assert.equal(await page.evaluate(()=>KpiV7.coreRows(KpiB.compute(),[],false).filter(r=>r.pilot).length),1);
  /* 8. 요청 버튼 숫자 설명: '미등록 n건 중 요청 가능 n건 · 이미 요청 중 · 담당 없음' */
  const rq=await v.locator('.k7-row .k7-reqn').allInnerTexts();assert.ok(rq.length>=1&&rq.every(t=>/ \d+건 중 요청 가능 \d+건/.test(t)),'요청 숫자 설명 '+JSON.stringify(rq));
  assert.ok((await v.locator('.k7-req').allInnerTexts()).filter(t=>/요청 가능 \d+건|배정|판단 요청|담당별 요청|다시 확인|보냄/.test(t)).length>=1);
  /* 9. 확장관리 · 오늘 업무: '확인된 미실행'과 '기록 보완'을 같은 함수로 가른다 · 판정 함수가 미팅일 · 발송일 근거를 내보낸다 */
  assert.deepEqual(await page.evaluate(()=>{const K=ExpansionB.kindOf;return [K(['after30','work'],true).kind+':'+K(['after30','work'],true).key,K(['late'],true).kind,K(['wait60'],true).kind,K(['work'],true).kind+':'+K(['work'],true).key,K([],false).kind+':'+K([],false).key,K(['nocontact'],true).key,K(['nonext'],true).kind];}),['fix:work','miss','miss','fix:work','fix:nodate','nocontact','ok'],'확인된 미실행 = 사후 연락 · 약속일 · 관계 연락 / 기록 보완 = 준공일 · 공종 · 연락 기록 없음');
  assert.equal(await page.evaluate(()=>typeof PipelineJudge.meetingOf+typeof PipelineJudge.sentOfDeal+typeof PipelineJudge.field),'functionfunctionfunction');
  assert.equal(await page.evaluate(()=>PipelineJudge.TARGET.stale),'컨설팅 설계 · 관계관리 진행 건(과거 이관 제외)','장기정체 대상 한 줄 = 과거 이관 제외');
  /* 10. 끄기 */
  await page.evaluate(()=>{G.kpiMeasureOff=true;G.k7=null;paintMgmt();});await page.waitForTimeout(150);
  assert.deepEqual(await v.locator('.k7-tabs button').evaluateAll(l=>l.map(b=>b.textContent.replace(/\s+/g,' ').trim().replace(/ \d+$/,''))),['핵심 지표','단계별 기준'],'끄면 두 탭만');
  assert.deepEqual(errs,[],'페이지 오류 없음 '+errs.join(' | '));
  if(shot){await page.evaluate(()=>{G.kpiMeasureOff=false;G.k7={tab:'measure',view:'list',cause:'',last:false,mk:'b1'};paintMgmt();});await page.waitForTimeout(200);await page.screenshot({path:shot,fullPage:true});}
  console.log('verify-kpi-measure-browser ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
