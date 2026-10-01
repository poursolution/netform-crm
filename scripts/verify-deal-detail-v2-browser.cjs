'use strict';
/* 파이프라인 상세창 v2 검사(2026-10-01 디자인 핸드오프 pipeline ③④):
   머리(칩·한 줄·진행 막대 6칸) · 3열(고객·현장 / 대화+입력칸 / 지금 할 일·챙길 정보·단계 바꾸기) · 작업창은 오른쪽 열 자리 패널.
   저장은 기존 경로만 쓴다 — 이 검사는 쓰기 요청을 가로채 실제 저장 없이 확인한다. 끄면 예전 상세 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV2&&window.PipelineListV2&&window.DetailActions&&window.NowCard);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   B={deals:[{id:'11111111-1111-4111-8111-111111111111',site:'[서울 도봉] 창동동아그린아파트',assignee:'황윤선',brand:'POUR솔루션',created:day(-60),code:'silent',stage_code:'silent',grp:'영업·관리',amt:2e8,
     next_action:{id:'n1',text:'통화 후속 확인',due:day(-9),status:'open'},
     activities:[{id:'a1',type:'전화',note:'통화 완료 · 진행 중 (예산 확인 중이라고 함)',at:at(-30)},{id:'a2',type:'문자',note:'견적서 발송 안내 문자',at:at(-40)},{id:'a3',type:'메모',note:'관리소장 교체 예정이라고 들음',at:at(-20)}],
     stageHistory:[{from:'consulting',to:'sent',at:day(-45)},{from:'sent',to:'silent',at:day(-29)}],
     stage_contexts:{silent:{fields:{relationship_reason:'예산 미확정',contact_date:day(-9)}}}}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   /* 쓰기 가로채기: 기존 연락 기록 경로로 무엇이 나가는지만 본다 */
   window.__ops=[];window.queueDetailContactOperation=(op,payload)=>{const id='req-'+(__ops.length+1);__ops.push({id,op,payload});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:'done',payload:o.payload,ack:{ok:true,operation:o.op,activity_id:'srv-'+o.id,next_action_id:'srv-'+o.id}}));
   PipelineWorkspace.open('relationship');
  });
  await page.waitForTimeout(200);
  await page.locator('#pipeline-list-v2 .plv-row .plv-site').first().click();await page.waitForTimeout(500);
  const v=page.locator('#detailView.ddv');assert.equal(await v.count(),1,'새 상세');
  /* 머리 */
  assert.equal(await v.locator('.ddv-chips .idv-brand').innerText(),'POUR솔루션');
  assert.match(await v.locator('#dv-sub').innerText(),/담당 황윤선 · 예상 2억 · 관계관리 \d+일째/);
  assert.deepEqual(await v.locator('.ddv-steps span').allInnerTexts(),['접촉','견적·검토','지금 · 관계관리','경쟁·입찰','계약','수주']);
  assert.equal(await v.locator('.ddv-steps .done').count(),2);assert.equal(await v.locator('.ddv-steps .cur').count(),1);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView #nowFlow,#detailView .dcc-journey,#detailView .da-recent')].every(n=>getComputedStyle(n).display==='none')),true,'영업 흐름·진행도·최근 활동은 감춤');
  /* 3열 */
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#detailView .ddv-cols')).gridTemplateColumns.split(' ').length),3);
  assert.deepEqual(await v.locator('.ddv-manage dt').allInnerTexts(),['고객 반응','의사결정자','경쟁사','공종','예상 금액','공사 예정']);
  assert.deepEqual(await v.locator('.ddv-manage header .ddv-link').allInnerTexts(),['공종','금액','수정']);
  assert.equal(await v.locator('.ddv-manage dd.ddv-empty').count(),5,'빈 값은 주황 미입력');
  assert.equal(await v.locator('.dw-left .ddv-files').count(),1,'자료는 왼쪽');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dw-site,#detailView .dw-voice')].every(n=>getComputedStyle(n).display==='none')),true,'현장 정보·핵심 발언 카드는 합침');
  /* 가운데: 말풍선 시간순 + 입력칸 */
  assert.deepEqual(await v.locator('.ddv-talk .idv-msg .idv-bubble').allInnerTexts(),['견적서 발송 안내 문자','통화 완료 · 진행 중 (예산 확인 중이라고 함)','관리소장 교체 예정이라고 들음']);
  assert.equal(await v.locator('.ddv-talk .idv-msg.out').count(),2);assert.equal(await v.locator('.ddv-talk .idv-msg.memo').count(),1);
  assert.deepEqual(await v.locator('#ddvComposer [role=tab]').allInnerTexts(),['통화 기록','문자 기록','내부 메모']);
  /* 오른쪽: 지금 할 일 → 챙길 정보 → 단계 바꾸기 */
  assert.equal(await page.evaluate(()=>[...document.querySelector('#detailView .dw-right').children].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.id||n.className.split(' ').pop()).join('|')),'nowCard|da-stage-summary|ddv-switch');
  assert.match(await v.locator('#nowCard').innerText(),/지금 할 일[\s\S]*통화 후 진행 확인[\s\S]*9일 지남[\s\S]*연락하고 결과 남기기[\s\S]*다음 할 일 · 날짜/);
  assert.equal(await v.locator('#nowCard.late').count(),1);
  assert.match(await v.locator('.da-stage-summary .ddv-pace').innerText(),/^관계관리 · 이 단계 \d+일째/);
  assert.deepEqual(await v.locator('.ddv-stages button').allInnerTexts(),['컨설팅 설계','자료 발송완료','관계관리','경쟁·입찰','계약·시공','수주','실주']);
  assert.equal(await v.locator('.ddv-stages button.cur').innerText(),'관계관리');
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  /* ④ 연락 결과 패널: 오른쪽 열 안, 카드 5개, 자세히 기록 = 가운데 입력칸 */
  await v.locator('#nowCard .nc-call').click();await page.waitForTimeout(150);
  assert.equal(await v.locator('.dw-right #ddvPanel').count(),1);assert.equal(await page.locator('#nc-sheet').count(),0,'모달 위 모달 없음');
  assert.equal(await v.locator('#ddvPanel [data-chip]').count(),5);
  if(shot)await page.screenshot({path:shot+'-contact.png'});
  await v.locator('#ddvPanel [data-chip="detail"]').click();await page.waitForTimeout(150);
  assert.equal(await v.locator('#ddvPanel').count(),0);assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('#ddvComposer textarea')),true,'자세히 기록 → 가운데 입력칸');
  /* ④ 작업창: 오른쪽 열 자리 패널(뒤로 + 제목 + 설명), 가운데 중앙 창이 아님 */
  for(const [open,title] of [["DetailActions.open('amount')",'예상금액 수정'],["DetailActions.open('materials')",'자료 보기 · 추가'],["DetailActions.open('stagefields')",'이 단계에서 챙길 정보 입력'],["openTransition()",'진행상태 변경']]){
   await page.evaluate(code=>{(0,eval)(code)},open);await page.waitForTimeout(250);
   const p=page.locator('#detailAction.ddv-panel');assert.equal(await p.count(),1,title);
   assert.equal(await p.locator('#da-title').innerText(),title);assert.equal(await p.locator('.ddv-back').count(),1,title+' 뒤로');
   const geo=await page.evaluate(()=>{const s=document.querySelector('#detailAction .da-sheet').getBoundingClientRect(),r=document.querySelector('#detailView .dw-right').getBoundingClientRect();return {dx:Math.abs(s.left-r.left),dw:Math.abs(s.width-r.width),top:Math.abs(s.top-r.top)}});
   assert.equal(geo.dx<=2&&geo.dw<=2&&geo.top<=2,true,title+' 오른쪽 열 자리 '+JSON.stringify(geo));
   if(shot&&/next|Transition/.test(open))await page.screenshot({path:shot+'-panel-'+(/next/.test(open)?'next':'stage')+'.png'});
   await p.locator('.ddv-back').click();await page.waitForTimeout(150);assert.equal(await page.locator('#detailAction').count(),0,title+' 닫힘');
  }
  /* 다음 할 일 · 관리정보는 예전 작업창 대신 새 패널(DealPanelsV2)로 열린다 */
  for(const [key,cls] of [['next','dp-next'],['management','dp-info']]){await page.evaluate(k=>DetailActions.open(k),key);await page.waitForTimeout(250);assert.equal(await page.locator('#ddvPanel.'+cls).count(),1,key);assert.equal(await page.locator('#detailAction').count(),0,key+' 예전 작업창 없음');await page.locator('#ddvPanel [data-dp="close"]').first().click();await page.waitForTimeout(150);}
  /* 단계 버튼 → 그 단계를 고른 전환창 */
  await v.locator('.ddv-stages [data-stage="competition"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#detailAction.ddv-panel #da-title').innerText(),'진행상태 변경');
  assert.match(await page.locator('#detailAction').innerText(),/경쟁|PT/);
  await page.locator('#detailAction .ddv-back').click();await page.waitForTimeout(150);
  /* 더보기: 전체 이력 */
  await v.locator('.da-more').click();assert.deepEqual((await v.locator('.da-tools button').allInnerTexts()).slice(0,2),['전체 이력','기술자문 계약']);
  await v.locator('.da-tools .ddv-tool').first().click();await page.waitForTimeout(200);assert.equal(await page.locator('#detailAction #da-title').innerText(),'전체 이력');
  await page.locator('#detailAction .ddv-back').click();await page.waitForTimeout(150);
  /* 입력칸 저장 = 기존 연락 기록 경로, 서버 확인 뒤 대화에 쌓임 */
  await v.locator('#ddvComposer [data-type="메모"]').click();await v.locator('#ddvComposer textarea').fill('12월 입대의 전 예산 자료 준비');
  await v.locator('#ddvComposer .idv-save').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__ops.map(o=>[o.op,o.payload.type,o.payload.note,o.payload.opportunity_id])),[['activity','메모','12월 입대의 전 예산 자료 준비','11111111-1111-4111-8111-111111111111']]);
  assert.equal(await page.locator('#detailView.ddv .ddv-talk .idv-msg .idv-bubble').last().innerText(),'12월 입대의 전 예산 자료 준비');
  assert.equal(await page.locator('#detailView.ddv .ddv-talk .idv-chead span').innerText(),'4건');
  /* 좁은 화면 · 끄기 */
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'좁은 화면 넘침 없음');
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{G.dealDetailV2Off=true;renderDetail();});await page.waitForTimeout(300);
  assert.equal(await page.locator('#detailView.ddv').count(),0);assert.equal(await page.locator('#detailView .ddv-talk,#detailView .ddv-steps,#detailView .ddv-chips').count(),0,'끄면 예전 상세');
  assert.equal(await page.locator('#detailView .da-recent').count(),1);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',header_steps:true,three_columns:true,bubbles:true,now_card_right:true,contact_panel_in_column:true,panels_in_column:6,stage_button_transition:true,more_menu:true,composer_saves_activity:true,narrow:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
