'use strict';
/* 영업건 상세보기 정리 검사(2026-10-03 design_handoff_detail_panel):
   왼쪽 5구역(관리소장 · 같은 현장 다른 영업 · 현장 정보 · 자료 · 다른 연락처) · 같은 사람 한 번 · 전화 버튼 하나 ·
   수정 · 공종 · 정보 · 자료 보기는 누른 자리에서 펼쳐지고 오른쪽 '지금 할 일'은 그대로 · AI 판단 카드 없음(지금 할 일 안) · 필수 정보 중복 제거 · 창 크기 · 끄기
   연락하고 결과 남기기 = 지금 할 일 카드 안(수단 · 결과 · 메모 · 다음 행동일 · 저장) · 단계 바꾸기 = 머리글 띠(오른쪽 그대로 · 칩 · 옮기기) · 소장이 바뀌었어요 = 관리소장 카드 안 상자 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealKeyman&&window.DealPanelsV2&&window.DealDetailV2&&window.PipelineListV2&&window.DetailActions&&window.OpsStore);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S='aaaaaaaa-0000-4000-8000-000000000001';
   B={deals:[
    {id:'11111111-1111-4111-8111-111111111111',site:'[서울 도봉] 창동동아그린아파트',site_id:S,assignee:'황윤선',brand:'POUR솔루션',created:day(-60),code:'sent',stage_code:'sent',grp:'영업·관리',amt:38e7,manager_name:'김영수',manager_mobile:'01012345678',office_phone:'0212345678',
     contacts:[{person_key:'mobile:01012345678',name:'김영수',role:'관리소장',mobile:'01012345678',status:'current'},{person_key:'mobile:01011112222',name:'박영호',role:'이전 소장',mobile:'01011112222',status:'previous',ended_at:day(-3)},{person_key:'mobile:01077778888',name:'이회장',role:'입주자대표회장',mobile:'01077778888',status:'current'}],
     next_action:{id:'n1',text:'견적 후속 통화',due:day(2),status:'open'},
     activities:[{id:'a1',type:'전화',note:'소장 통화 — 견적 검토 중',at:at(-20)},{id:'a2',type:'업무',note:'관리소장 변경 — 이전 소장 기록',result:'박영호 · 010-1111-2222 · '+day(-3)+'까지 → 새 소장 김영수',at:at(-3)}],stage_contexts:{sent:{fields:{sent_date:day(-15),reaction:'가격 부담'}}}},
    {id:'22222222-2222-4222-8222-222222222222',site:'[서울 도봉] 창동동아그린아파트',site_id:S,assignee:'이필선',brand:'POUR솔루션',created:day(-500),updated:day(-400),code:'won',stage_code:'won',outcome:'won',won_amount:2e8,closed_at:day(-400),grp:'영업·관리',amt:2e8,workItems:['옥상>우레탄'],primaryWork:'옥상>우레탄',activities:[]},
    {id:'33333333-3333-4333-8333-333333333333',site:'다른 현장',assignee:'황윤선',brand:'POUR솔루션',created:day(-30),code:'sent',stage_code:'sent',grp:'영업·관리',amt:1e8,manager_name:'최소장',manager_mobile:'01099998888',contacts:[],activities:[]}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__ops=[];window.queueDetailContactOperation=(op,payload,actionId)=>{const id='op-'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:'done',payload:o.payload,ack:{ok:true,operation:o.op,activity_id:'srv-'+o.id,next_action_id:'srv-'+o.id}}));
   window.__sf=[];SB={rpc:async(name,args)=>{if(name==='crm_deal_stage_fields_update_v1'){__sf.push(args.p);const d=B.deals.find(x=>x.id===args.p.deal_id),cur=((d.stage_contexts||{})[args.p.stage_code]||{}).fields||{},fields=Object.assign({},cur);Object.entries(args.p.fields).forEach(([k,v])=>{if(v==null)delete fields[k];else fields[k]=v;});return {data:{ok:true,version:(d.version||1)+1,stage_context:{fields}}};}return {data:{ok:true,tasks:[]}};}};TOKEN='test';
   window.__ai=[];OpsStore.aiOn=()=>true;OpsStore.ai=async(kind)=>{__ai.push(kind);return {suggestion:kind==='next_action'?{how:'전화',what:'새 소장에게 기존 견적 조건 설명',days:1,why:'관리소장 변경 뒤 첫 응대가 없음'}:{opener:'안녕하세요 소장님',goal:'조건 확인',summary:''}};};
   window.__work=[];const fake={current:null,openWork:async(id,item)=>{fake.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async(item,payload)=>{if(item!==fake.current)throw Error('EDITOR_IDENTITY_MISMATCH');__work.push(payload);item.workItems=payload.work_items;item.primaryWork=payload.primary_work;closeNewDeal();renderDetail();}};window.Phase11=fake;
   G.pipeStageBOff=true;PipelineWorkspace.open('sent');
  });
  await page.waitForTimeout(200);
  await page.locator('#pipeline-list-v2 .plv-row',{hasText:'창동동아그린'}).locator('.plv-site').click();await page.waitForTimeout(600);
  const v=page.locator('#detailView.ddv.dv3');assert.equal(await v.count(),1,'정리된 상세');
  /* 창 크기: 좌우 16px */
  const box=await v.boundingBox();assert.ok(Math.abs(box.x-16)<=1&&Math.abs(box.width-(1600-32))<=2,'좌우 16px '+JSON.stringify(box));assert.ok(Math.abs(box.height-(1000-32))<=2,'높이 = 화면 - 32');
  /* 왼쪽 5구역 · 예전 카드 숨김 */
  const L=v.locator('.dv3-left');
  assert.deepEqual(await L.locator('.dv3-sec>header b').allInnerTexts(),['같은 현장 다른 영업','현장 정보','자료','다른 연락처']);
  assert.match(await L.locator('.dv3-mgr').innerText(),/관리소장\s*김영수\s*010-1234-5678[\s\S]*⚠ \d+\/\d+ 관리소장 변경\s*이전: 박영호 · 변경 후 첫 응대 전[\s\S]*전화\s*문자\s*수정[\s\S]*문자 동의 미확인/);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dw-left>*')].filter(n=>!n.classList.contains('dv3-left')&&getComputedStyle(n).display!=='none').length),0,'예전 카드(연락처 · 관리 정보 · 자료)는 보이지 않음');
  /* 같은 사람 한 번 · 전화 버튼 하나 */
  const leftText=await v.locator('.dw-left').innerText();
  assert.equal((leftText.match(/김영수/g)||[]).length,1,'관리소장 이름 한 번');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dw-left button')].filter(b=>getComputedStyle(b).display!=='none'&&b.getClientRects().length&&/^(📞|📱)?\s*(전화|소장 전화|관리사무소)$/.test(b.innerText.trim())).length),1,'전화 버튼은 관리소장 카드 하나');
  /* 같은 현장 다른 영업: 항상 펼침 · 누르면 그 건 */
  assert.match(await L.locator('.dv3-rel').first().innerText(),/수주\s*옥상[\s\S]*이필선 · 2억/);
  /* 현장 정보 · 자료 · 다른 연락처 */
  assert.deepEqual(await L.locator('.dv3-row>span').allInnerTexts(),['공종','고객 반응','의사결정자','경쟁사','예상 금액','공사 예정']);
  assert.match(await L.locator('.dv3-row').nth(1).innerText(),/고객 반응\s*가격 부담/);assert.equal(await L.locator('.dv3-val.empty').count(),4,'미입력 = 주황');assert.deepEqual(await L.locator('.dv3-val.empty').allInnerTexts(),['미분류 · 분류하기','미입력 · 입력하기','미입력 · 입력하기','미입력 · 입력하기']);
  assert.match(await L.locator('.dv3-sec').nth(3).innerText(),/자료\s*사진 0 · 견적서 0 · 기타 0\s*자료 보기/);
  assert.match(await L.locator('.dv3-sec').nth(4).innerText(),/다른 연락처\s*1명\s*\+ 추가\s*이회장\s*입주자대표회장\s*010-7777-8888/);assert.equal(await L.locator('.dv3-other button:not(.nm)').count(),0,'다른 연락처에는 버튼 없음');
  /* 오른쪽: 지금 할 일(변경 재확인 + AI 안) · AI 판단 카드 없음 · 필수 정보 중복 없음 */
  const R=v.locator('.dw-right'),now=R.locator('#nowCard');
  assert.equal(await R.locator('.dk-ai:visible').count(),0,'AI 판단 카드 없음');assert.equal(await now.locator('.dv3-reco').count(),1,'추천 다음 행동은 지금 할 일 안 · 상자 하나');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dw-right>.dk-now')].filter(n=>getComputedStyle(n).display!=='none').length),0,'변경 감지 카드도 따로 없음');
  assert.match(await now.innerText(),/지금 할 일[\s\S]*관리소장 변경 후 기존 견적 · 공법 조건 재확인[\s\S]*기존 견적 조건 유지 여부[\s\S]*공사 추진일정 변경 여부[\s\S]*추천 다음 행동[\s\S]*새 소장 인사 통화 → 기존 조건 재확인 · 오늘[\s\S]*연락하고 결과 남기기[\s\S]*연락 없이 다음 할 일만 정하기/);
  assert.equal(await now.locator('.dv3-reco .dv3-aitag').count(),0,'규칙 추천에는 AI 표식 없음');
  assert.equal(await now.evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(21, 23, 28)','검은 테두리');
  await now.locator('[data-dk="check"]').first().click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#nowCard [data-dk="check"]').first().getAttribute('aria-pressed'),'true','확인 표시(이 PC)');assert.equal(await page.locator('#detailView .dv3-left').count(),1,'다시 그려도 왼쪽 하나');
  await page.locator('#nowCard [data-dk="ai-next"]').click();await page.waitForTimeout(350);
  assert.match(await page.locator('#nowCard .dv3-reco').innerText(),/AI\s*추천 다음 행동[\s\S]*전화 · 새 소장에게 기존 견적 조건 설명 · 1일 뒤/);assert.equal(await page.locator('#detailView .dw-right .dk-ai:visible').count(),0);
  await page.locator('#nowCard [data-dv3="line"]').click();await page.waitForTimeout(350);
  assert.match(await page.locator('#nowCard .dv3-reco .line').innerText(),/“안녕하세요 소장님”/,'통화 첫마디 보기 = 상자 안에서');assert.equal(await page.locator('#nowCard [data-dv3="line"]').innerText(),'접기');assert.deepEqual(await page.evaluate(()=>__ai),['next_action','call_opener']);
  /* 머리글: [단계 바꾸기 ▾] [담당자 변경] — 오른쪽에는 단계 바꾸기 카드 없음 */
  assert.deepEqual(await v.locator('.dv3-headact button').allInnerTexts(),['단계 바꾸기 ▾','담당자 변경']);assert.equal(await R.locator('.ddv-switch:visible').count(),0,'단계 바꾸기 카드는 오른쪽에 없음');assert.equal(await v.locator('.detailtop>.dv3-move:visible').count(),0,'띠는 접혀 있음');
  const sumText=await R.locator('.da-stage-summary').innerText();assert.match(sumText,/^이 단계 필수 정보/);
  assert.deepEqual(await R.locator('.dv3-stage .dv3-row>span').allInnerTexts(),['무엇을 발송했나요?','견적 Version','수신자','발송일'],'왼쪽과 같은 항목(고객 반응)은 오른쪽에 없음');
  assert.match(sumText,/미입력 3/);assert.equal(await R.locator('.da-stage-summary .da-fill:visible,.da-stage-summary .da-stage-edit:visible').count(),0,'[입력하기] · [단계 정보 입력] 버튼 없음');
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  /* 그 자리에서 펼침: 오른쪽은 바뀌지 않는다 */
  const rightIntact=async(msg)=>{assert.equal(await page.evaluate(()=>{const r=document.querySelector('#detailView .dw-right'),n=document.getElementById('nowCard');return !r.classList.contains('ddv-covered')&&!r.querySelector(':scope>#ddvPanel')&&n.getClientRects().length>0&&!document.getElementById('dv-body').inert;}),true,msg+' — 오른쪽 그대로');};
  await L.locator('[data-dv3="editc"]').first().click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.dv3-slot[data-slot="mgr"]>#ddvPanel.dp-contact').count(),1,'수정 = 관리소장 아래에서 펼침');await rightIntact('연락처 수정');
  assert.equal(await page.locator('#ddvPanel #qc-name').inputValue(),'김영수');
  await page.locator('.dv3-left [data-dv3="editc"]').first().click();await page.waitForTimeout(200);assert.equal(await page.locator('#ddvPanel').count(),0,'다시 누르면 접힘');
  /* 공종: 공종 줄 바로 아래 작은 상자(공종 표 + [완료]) — 패널 · 예전 창 아님 */
  await page.locator('.dv3-left [data-dv3="work"]').click();await page.waitForTimeout(500);
  const wb=page.locator('.dv3-left .dv3-row:first-of-type + .dv3-slot[data-slot="work"] .dv3-work');assert.equal(await wb.count(),1,'공종 줄 바로 아래 상자');
  assert.equal(await page.locator('#ddvPanel').count(),0,'패널 없음');assert.equal(await page.evaluate(()=>document.getElementById('newDealModal').classList.contains('on')),false,'예전 창 없음');await rightIntact('공종');
  assert.deepEqual(await wb.locator('.dp-wtable>div>span').allInnerTexts(),['옥상','재도장','지하주차장','기타']);assert.equal(await wb.locator('[data-dv3="workdone"]').innerText(),'완료');if(shot)await page.screenshot({path:shot+'-work.png'});
  await wb.locator('[data-work]',{hasText:'우레탄'}).click();await page.waitForTimeout(150);
  await page.locator('.dv3-work [data-dv3="workdone"]').click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>__work.length),1,'완료 = 기존 공종 저장 경로');assert.match(await page.evaluate(()=>JSON.stringify(__work[0].work_items)),/우레탄/);
  assert.match(await page.locator('.dv3-left .dv3-row').first().innerText(),/공종\s*옥상.*우레탄/,'저장 뒤 공종 칸에 반영');assert.equal(await page.locator('.dv3-left .dv3-work').count(),0,'저장 뒤 접힘');
  /* 현장 정보 칸: 누르면 그 칸이 입력칸 — Enter 저장 · Esc 취소 */
  await page.locator('.dv3-left [data-dv3="field"][data-key="decision_maker"]').click();await page.waitForTimeout(200);
  const inp=page.locator('.dv3-left [data-dv3in="left"][data-key="decision_maker"]');assert.equal(await inp.count(),1,'그 칸이 입력칸으로');assert.equal(await inp.evaluate(n=>n===document.activeElement),true,'바로 포커스');await rightIntact('현장 정보 입력');
  await inp.fill('입대의 회장');if(shot)await page.screenshot({path:shot+'-field.png'});await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.equal(await page.locator('.dv3-left [data-dv3in]').count(),0,'Esc = 취소');assert.equal(await page.locator('#detailView.on').count(),1,'창은 그대로');assert.deepEqual(await page.evaluate(()=>__sf),[]);
  await page.locator('.dv3-left [data-dv3="field"][data-key="decision_maker"]').click();await page.waitForTimeout(200);
  await page.locator('.dv3-left [data-dv3in="left"]').fill('입대의 회장');await page.keyboard.press('Enter');await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__sf.map(x=>[x.stage_code,x.fields])),[['sent',{decision_maker:'입대의 회장'}]],'Enter = 그 항목만 서버 저장');
  assert.match(await page.locator('.dv3-left .dv3-row').nth(2).innerText(),/의사결정자\s*입대의 회장/);
  /* 이 단계 필수 정보: 칸 안에서 바로 입력(글자 · 여러 개 고르기) */
  await page.locator('#detailView .dv3-stage [data-dv3="sfield"][data-key="recipient"]').click();await page.waitForTimeout(200);
  await page.locator('#detailView .dv3-stage [data-dv3in="stage"][data-key="recipient"]').fill('김영수 소장');await page.keyboard.press('Enter');await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__sf.at(-1).fields),{recipient:'김영수 소장'});assert.match(await page.locator('#detailView .da-stage-summary').innerText(),/미입력 2[\s\S]*수신자\s*김영수 소장/);
  await page.locator('#detailView .dv3-stage [data-dv3="sfield"][data-key="materials"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.locator('#detailView .dv3-multi button').allInnerTexts(),['견적서','제안서','공법자료','기타자료','완료']);
  await page.locator('#detailView .dv3-multi button',{hasText:'견적서'}).click();await page.locator('#detailView .dv3-multi .done').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__sf.at(-1).fields),{materials:['견적서']});await rightIntact('필수 정보 입력');
  assert.equal(await page.evaluate(()=>!!document.getElementById('detailAction')),false,'입력 창이 따로 뜨지 않음');
  await page.locator('.dv3-left [data-dv3="files"]').click();await page.waitForTimeout(350);
  assert.equal(await page.locator('.dv3-slot[data-slot="files"]>#detailAction').count(),1,'자료 보기 = 자료 아래에서 펼침');await rightIntact('자료 보기');
  assert.equal(await page.locator('.dv3-left [data-dv3="files"]').innerText(),'접기');
  if(shot)await page.screenshot({path:shot+'-files.png'});
  await page.locator('.dv3-left [data-dv3="files"]').click();await page.waitForTimeout(250);assert.equal(await page.locator('#detailAction').count(),0);assert.equal(await page.locator('.dv3-left [data-dv3="files"]').innerText(),'자료 보기');
  await page.locator('.dv3-left [data-dv3="addc"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.dv3-slot[data-slot="others"]>#ddvPanel.dp-contact').count(),1,'+ 추가 = 다른 연락처 아래');await rightIntact('연락처 추가');
  await page.locator('#ddvPanel [data-dp="close"]').first().click();await page.waitForTimeout(200);
  /* 연락하고 결과 남기기: 지금 할 일 카드 안에서 펼침(패널 없음) */
  const day=n=>page.evaluate(n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),n);
  await page.locator('#nowCard .nc-call').click();await page.waitForTimeout(250);
  const F=page.locator('#nowCard .dv3-form');assert.equal(await F.count(),1,'카드 안에서 펼침');assert.equal(await page.locator('#ddvPanel,#detailAction').count(),0,'패널 · 창 없음');await rightIntact('연락 결과');
  assert.equal(await page.locator('#nowCard .nc-call').innerText(),'접기');
  assert.deepEqual(await F.locator('.dv3-pills').nth(0).locator('button').allInnerTexts(),['전화','문자','카카오','방문','이메일']);assert.equal(await F.locator('[data-dv3="rch"][aria-pressed="true"]').innerText(),'전화','기본 전화');
  assert.deepEqual(await F.locator('.dv3-pills').nth(1).locator('button').allInnerTexts(),['연결됨','부재','검토중','자료요청','회신대기','거절']);
  assert.match(await F.innerText(),/어떻게 연락했나요\?[\s\S]*결과[\s\S]*다음 행동\s*결과를 고르면 추천[\s\S]*저장[\s\S]*저장하면 가운데 응대 이력에 쌓이고, 다음 행동일에 오늘 업무로 다시 뜹니다/);
  assert.equal(await F.locator('.dv3-save.off').count(),1,'수단 + 결과가 있어야 저장');
  await page.locator('#nowCard .dv3-save').click();await page.waitForTimeout(150);assert.match(await page.locator('#nowCard .dv3-recerr').innerText(),/연락 수단과 결과/);assert.deepEqual(await page.evaluate(()=>__ops),[]);
  await page.locator('#nowCard [data-dv3="rres"]',{hasText:'부재'}).click();await page.waitForTimeout(120);
  assert.match(await page.locator('#nowCard .dv3-recnext').innerText(),/다음 행동\s*다시 전화 · \d{4}\.\d+\.\d+\(.\)[\s\S]*내일\s*3일 후\s*7일 후/);assert.equal(await page.locator('#nowCard [data-dv3="rday"][aria-pressed="true"]').innerText(),'내일','부재 → 내일');
  await page.locator('#nowCard [data-dv3="rres"]',{hasText:'검토중'}).click();await page.waitForTimeout(120);
  assert.match(await page.locator('#nowCard .dv3-recnext').innerText(),/결과 확인/);assert.equal(await page.locator('#nowCard [data-dv3="rday"][aria-pressed="true"]').innerText(),'7일 후','검토중 → 7일 후');
  await page.locator('#nowCard [data-dv3="rday"]',{hasText:'3일 후'}).click();await page.waitForTimeout(120);
  await page.locator('#nowCard .dv3-memo').fill('12월 입대의 후 결정');
  await page.locator('#nowCard [data-dv3="rch"]',{hasText:'방문'}).click();await page.waitForTimeout(120);
  assert.equal(await page.locator('#nowCard .dv3-memo').inputValue(),'12월 입대의 후 결정','다시 그려도 메모 유지');
  await page.locator('#nowCard [data-dv3="rch"]',{hasText:'전화'}).click();await page.waitForTimeout(120);
  if(shot)await page.screenshot({path:shot+'-record.png'});
  assert.deepEqual(await page.evaluate(()=>__ops),[],'고르는 것만으로 저장 없음');
  await page.locator('#nowCard .dv3-save').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__ops.map(o=>[o.op,o.payload.type,o.payload.note||o.payload.text,o.payload.due_at||''])),[['activity','전화','통화 완료 · 검토중 — 12월 입대의 후 결정',''],['next_action','전화','결과 확인',await day(3)]],'저장 = 연락 기록 + 다음 할 일(기존 경로)');
  assert.equal(await page.locator('#nowCard .dv3-form').count(),0,'저장 뒤 접힘');assert.equal(await page.locator('#nowCard .nc-call').innerText(),'연락하고 결과 남기기');
  assert.match(await page.locator('#detailView .dw-center').innerText(),/통화 완료 · 검토중 — 12월 입대의 후 결정/,'가운데 응대 이력에 쌓임');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .idv-thread .idv-meta')].every(n=>/\d{4}\. \d{2}\. \d{2}\./.test(n.innerText))),true,'기록마다 연도 표시');
  assert.match(await page.locator('#nowCard').innerText(),/결과 확인/,'다음 할 일 반영');
  /* 거절 = 다음 행동 없이 저장 */
  await page.locator('#nowCard .nc-call').click();await page.waitForTimeout(200);
  await page.locator('#nowCard [data-dv3="rch"]',{hasText:'문자'}).click();await page.waitForTimeout(100);await page.locator('#nowCard [data-dv3="rres"]',{hasText:'거절'}).click();await page.waitForTimeout(120);
  assert.match(await page.locator('#nowCard .dv3-recnext').innerText(),/없음 · 실주 처리 검토/);assert.equal(await page.locator('#nowCard [data-dv3="rday"]').count(),0);
  await page.locator('#nowCard .dv3-save').click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__ops.slice(2).map(o=>[o.op,o.payload.type,o.payload.note])),[['activity','문자','문자 답변 받음 · 거절']],'거절 = 기록만');
  /* 연락 없이 다음 할 일만 정하기: 그 자리 칩 */
  await page.locator('#nowCard [data-dv3="nextonly"]').click();await page.waitForTimeout(150);
  assert.match(await page.locator('#nowCard .dv3-nextonly').innerText(),/다시 연락\s*내일\s*3일 후\s*7일 후/);assert.equal(await page.locator('#ddvPanel').count(),0);
  await page.locator('#nowCard [data-dv3="nextpick"]',{hasText:'7일 후'}).click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__ops.slice(3).map(o=>[o.op,o.payload.text,o.payload.due_at])),[['next_action','다시 연락',await day(7)]]);assert.equal(await page.locator('#nowCard .dv3-nextonly').count(),0);
  assert.deepEqual(await page.evaluate(()=>__writes.map(w=>w[0]).filter(o=>o!=='opportunity_touch')),[],'여기까지 다른 저장 없음');
  /* 소장이 바뀌었어요: 관리소장 카드 안 '새 관리소장 등록' 상자 */
  await page.locator('.dv3-left [data-dv3="replace"]').click();await page.waitForTimeout(250);
  const RP=page.locator('.dv3-left .dv3-mgr .dv3-repl');assert.equal(await RP.count(),1,'관리소장 카드 안 상자');assert.equal(await page.locator('#ddvPanel').count(),0,'패널 없음');await rightIntact('새 관리소장 등록');
  assert.match(await RP.innerText(),/새 관리소장 등록\s*취소\s*김영수 소장님은 지우지 않고 이전 소장으로 남깁니다 \(오늘 날짜\)\s*이전 소장은 어디로\?\s*다른 단지로 이동\s*퇴직\s*모름\s*새 소장\s*자동 채우기\s*수신 동의\s*동의 받음\s*아직 안 물어봄\s*거부\s*저장 · 재확인 할 일 만들기\s*저장하면 응대 이력에 ‘관리소장 변경’이 남고/);
  assert.equal(await RP.locator('[data-dv3="replconsent"][aria-pressed="true"]').innerText(),'아직 안 물어봄');assert.equal(await RP.locator('.dv3-save.off').count(),1);
  await RP.locator('[data-dv3repl="paste"]').fill('이정민 소장 010-5555-6666');await page.keyboard.press('Enter');await page.waitForTimeout(200);
  assert.equal(await page.locator('.dv3-repl #qc-name').inputValue(),'이정민');assert.equal(await page.locator('.dv3-repl #qc-mobile').inputValue(),'010-5555-6666');assert.equal(await page.locator('.dv3-repl .dv3-save.off').count(),0);
  await page.locator('.dv3-repl [data-dv3="replwhere"]',{hasText:'퇴직'}).click();await page.waitForTimeout(150);
  if(shot)await page.screenshot({path:shot+'-replace.png'});
  await page.locator('.dv3-repl [data-dv3="replsave"]').click();await page.waitForTimeout(400);
  const cw=await page.evaluate(()=>__writes.filter(w=>w[0]!=='opportunity_touch').map(w=>[w[0],w[1].note||w[1].manager_name,w[1].result||w[1].manager_mobile,w[1].manager_role||'',w[1].is_primary===true]));
  assert.equal(cw.length,2);assert.equal(cw[0][0],'activity');assert.equal(cw[0][1],'관리소장 변경 — 이전 소장 기록');assert.match(cw[0][2],/^김영수 · 010-1234-5678 · .*새 소장 이정민 · 이전 소장 퇴직$/);
  assert.deepEqual(cw[1],['contact_upsert','이정민','01055556666','관리소장',true],'기존 연락처 저장 경로');
  await page.locator('.dv3-repl [data-dv3="replsave"]').click();await page.waitForTimeout(300);
  assert.equal(await page.evaluate(()=>__writes.filter(w=>w[0]==='activity').length),1,'다시 눌러도 변경 기록은 한 번');
  await page.locator('.dv3-repl [data-dv3="replcancel"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('.dv3-repl').count(),0);
  /* 담당자 변경 · 단계 바꾸기: 머리글에서 — 오른쪽은 그대로 */
  await page.locator('#detailView .dv3-headact [data-dv3="owner"]').click();await page.waitForTimeout(350);
  assert.equal(await page.locator('#detailView .detailtop>.dv3-slot[data-slot="owner"]>#detailAction').count(),1,'담당자 변경 = 머리글 아래');await rightIntact('담당자 변경');
  await page.locator('#detailView .dv3-headact [data-dv3="owner"]').click();await page.waitForTimeout(250);assert.equal(await page.locator('#detailAction').count(),0);
  await page.locator('#detailView .dv3-headact [data-dv3="mv"]').click();await page.waitForTimeout(200);
  const band=page.locator('#detailView .detailtop>.dv3-move');assert.equal(await band.isVisible(),true,'진행 막대 아래 띠');
  assert.match(await band.locator('.hd').innerText(),/^어느 단계로 옮길까요\?/);
  assert.deepEqual(await band.locator('.dv3-moves button').allInnerTexts(),['컨설팅 설계','자료 발송완료 (지금)','관계관리','경쟁·입찰','계약·시공','수주','실주']);
  assert.equal(await page.locator('#detailView .dv3-headact .mv').innerText(),'단계 바꾸기 ▴');await rightIntact('단계 바꾸기 띠');
  await band.locator('.dv3-moves button',{hasText:'수주'}).click({force:true});await page.waitForTimeout(200);assert.equal(await page.locator('#stage-transition-form').count(),0,'수주는 준공 뒤에만');
  await band.locator('.dv3-moves button',{hasText:'관계관리'}).click();await page.waitForTimeout(450);
  const SF=band.locator('#stage-transition-form');assert.equal(await SF.count(),1,'띠 안에서 입력');await rightIntact('단계 입력');
  assert.equal(await band.locator('.dv3-moves button[aria-pressed="true"]').innerText(),'관계관리');
  assert.match(await SF.locator(':scope>header').innerText(),/자료 발송완료 → 관계 유지\s*기존 기록 · 최근 활동 [\s\S]* · 다음 할 일 /);
  assert.equal(await band.locator('select:visible').count(),0,'선택 상자 대신 칩');
  assert.deepEqual(await SF.locator('.sf-field',{hasText:'세부 단계'}).locator('.dv3-pills button').allInnerTexts(),['관계 유지','침묵관리','대기고객']);
  assert.equal(await SF.locator('footer .sf-primary').innerText(),'옮기기');assert.equal(await SF.locator('footer .sf-primary.off').count(),1);
  assert.match(await SF.locator('.dv3-mvhint').innerText(),/^필수 입력: 관계관리 사유 · 고객 반응 · 다음 접촉일$/);
  if(shot)await page.screenshot({path:shot+'-move.png'});
  await SF.locator('.sf-field',{hasText:'관계관리 사유'}).locator('.dv3-pills button',{hasText:'예산 미확보'}).click();
  await SF.locator('#sf-reaction').fill('내년 예산 확정 후 재검토');await SF.locator('#sf-contact_date').fill(await day(14));await page.waitForTimeout(200);
  assert.match(await SF.locator('.dv3-mvhint').innerText(),/^옮기면 응대 이력에 단계 변경과 입력 내용이 함께 남습니다$/);assert.equal(await SF.locator('footer .sf-primary.off').count(),0);
  await SF.locator('footer .sf-primary').click();await page.waitForTimeout(600);
  const mv=await page.evaluate(()=>__writes.filter(w=>w[0]==='transition').map(w=>[w[1].from,w[1].to,w[1].stage_context.fields.relationship_reason]));
  assert.deepEqual(mv,[['sent','rapport','예산 미확보']],'옮기기 = 기존 단계 전환 저장');assert.equal(await page.evaluate(()=>dealStage(CUR_DETAIL.item)),'rapport');
  assert.equal(await page.locator('#detailView .detailtop>.dv3-move:visible').count(),0,'옮긴 뒤 띠 접힘');assert.match(await page.locator('#detailView .dw-center').innerText(),/관계 유지/,'응대 이력에 단계 변경');
  /* 같은 현장 다른 영업 → 그 건 상세 */
  await page.locator('.dv3-left .dv3-rel').first().click();await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),'22222222-2222-4222-8222-222222222222');assert.equal(await page.locator('#detailView.dv3 .dv3-left').count(),1);
  assert.equal(await page.locator('#detailView .dv3-left .dv3-val').count(),0,'종료된 건은 칸이 눌리지 않음');
  /* 끄기 */
  await page.evaluate(()=>{G.dealDetailV3Off=true;G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForTimeout(600);
  assert.equal(await page.locator('#detailView.dv3').count(),0);assert.equal(await page.locator('#detailView .dv3-left').count(),0);assert.equal(await page.locator('#detailView .dw-right>.dk-ai').count(),1,'끄면 예전 모양');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',record_inline:true,next_only_chips:true,manager_replace_box:true,stage_move_header_band:true,window_size:true,left_five_sections:true,one_person_one_call:true,related_deals:true,inline_expand_right_intact:true,now_card_merged_ai:true,stage_info_deduped:true,no_save_on_expand:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
