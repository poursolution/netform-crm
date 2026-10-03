'use strict';
/* 영업건 상세보기 정리 검사(2026-10-03 design_handoff_detail_panel):
   왼쪽 5구역(관리소장 · 같은 현장 다른 영업 · 현장 정보 · 자료 · 다른 연락처) · 같은 사람 한 번 · 전화 버튼 하나 ·
   수정 · 공종 · 정보 · 자료 보기는 누른 자리에서 펼쳐지고 오른쪽 '지금 할 일'은 그대로 · AI 판단 카드 없음(지금 할 일 안) · 필수 정보 중복 제거 · 창 크기 · 끄기 */
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
   SB={rpc:async()=>({data:{ok:true,tasks:[]}})};TOKEN='test';
   window.__ai=[];OpsStore.aiOn=()=>true;OpsStore.ai=async(kind)=>{__ai.push(kind);return {suggestion:kind==='next_action'?{how:'전화',what:'새 소장에게 기존 견적 조건 설명',days:1,why:'관리소장 변경 뒤 첫 응대가 없음'}:{opener:'안녕하세요 소장님',goal:'조건 확인',summary:''}};};
   const fake={current:null,openWork:async(id,item)=>{fake.current=item;CUR_DETAIL={kind:'deal',key:dealKey(item),item};openWorkEdit();},save:async()=>{}};window.Phase11=fake;
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
  assert.match(await L.locator('.dv3-row').nth(1).innerText(),/고객 반응\s*가격 부담/);assert.equal(await L.locator('.dv3-val.empty').count(),4,'미입력 = 주황');
  assert.match(await L.locator('.dv3-sec').nth(3).innerText(),/자료\s*사진 0 · 견적서 0 · 기타 0\s*자료 보기/);
  assert.match(await L.locator('.dv3-sec').nth(4).innerText(),/다른 연락처\s*1명\s*\+ 추가\s*이회장\s*입주자대표회장\s*010-7777-8888/);assert.equal(await L.locator('.dv3-other button:not(.nm)').count(),0,'다른 연락처에는 버튼 없음');
  /* 오른쪽: 지금 할 일(변경 재확인 + AI 안) · AI 판단 카드 없음 · 필수 정보 중복 없음 */
  const R=v.locator('.dw-right'),now=R.locator('#nowCard');
  assert.equal(await R.locator(':scope>.dk-ai').count(),0,'AI 판단 카드 없음');assert.equal(await now.locator('.dk-ai').count(),1,'AI는 지금 할 일 안');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dw-right>.dk-now')].filter(n=>getComputedStyle(n).display!=='none').length),0,'변경 감지 카드도 따로 없음');
  assert.match(await now.innerText(),/지금 할 일[\s\S]*관리소장 변경 후 기존 견적 · 공법 조건 재확인[\s\S]*기존 견적 조건 유지 여부[\s\S]*공사 추진일정 변경 여부[\s\S]*AI 추천 다음 행동[\s\S]*연락하고 결과 남기기[\s\S]*연락 없이 다음 할 일만 정하기/);
  assert.equal(await now.evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(21, 23, 28)','검은 테두리');
  await now.locator('[data-dk="check"]').first().click();await page.waitForTimeout(250);
  assert.equal(await page.locator('#nowCard [data-dk="check"]').first().getAttribute('aria-pressed'),'true','확인 표시(이 PC)');assert.equal(await page.locator('#detailView .dv3-left').count(),1,'다시 그려도 왼쪽 하나');
  await page.locator('#nowCard [data-dk="ai-next"]').click();await page.waitForTimeout(350);
  assert.match(await page.locator('#nowCard .dk-ai').innerText(),/전화 · 새 소장에게 기존 견적 조건 설명 · 1일 뒤/);assert.equal(await page.locator('#detailView .dw-right>.dk-ai').count(),0);
  const sumText=await R.locator('.da-stage-summary').innerText();assert.match(sumText,/^이 단계 필수 정보/);
  const dup=await page.evaluate(()=>[...document.querySelectorAll('#detailView .da-stage-summary dt')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.textContent.trim()).filter(t=>['공종','고객 반응','의사결정자','경쟁사','예상 금액','공사 예정'].includes(t)));assert.deepEqual(dup,[],'왼쪽과 같은 항목은 오른쪽에 없음');
  if(shot)await page.screenshot({path:shot+'-detail.png'});
  /* 그 자리에서 펼침: 오른쪽은 바뀌지 않는다 */
  const rightIntact=async(msg)=>{assert.equal(await page.evaluate(()=>{const r=document.querySelector('#detailView .dw-right'),n=document.getElementById('nowCard');return !r.classList.contains('ddv-covered')&&!r.querySelector(':scope>#ddvPanel')&&n.getClientRects().length>0&&!document.getElementById('dv-body').inert;}),true,msg+' — 오른쪽 그대로');};
  await L.locator('[data-dv3="editc"]').first().click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.dv3-slot[data-slot="mgr"]>#ddvPanel.dp-contact').count(),1,'수정 = 관리소장 아래에서 펼침');await rightIntact('연락처 수정');
  assert.equal(await page.locator('#ddvPanel #qc-name').inputValue(),'김영수');
  await page.locator('.dv3-left [data-dv3="editc"]').first().click();await page.waitForTimeout(200);assert.equal(await page.locator('#ddvPanel').count(),0,'다시 누르면 접힘');
  await page.locator('.dv3-left [data-dv3="work"]').click();await page.waitForTimeout(500);
  assert.equal(await page.locator('.dv3-slot[data-slot="site"]>#ddvPanel.dp-work').count(),1,'공종 = 현장 정보 아래에서 펼침');await rightIntact('공종');
  await page.locator('#ddvPanel [data-dp="close"]').first().click();await page.waitForTimeout(200);
  await page.locator('.dv3-left [data-dv3="info"]').first().click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.dv3-slot[data-slot="site"]>#ddvPanel.dp-info').count(),1,'고객 반응 등 = 현장 정보 아래');await rightIntact('현장 정보');
  await page.locator('#ddvPanel [data-dp="close"]').first().click();await page.waitForTimeout(200);
  await page.locator('.dv3-left [data-dv3="files"]').click();await page.waitForTimeout(350);
  assert.equal(await page.locator('.dv3-slot[data-slot="files"]>#detailAction').count(),1,'자료 보기 = 자료 아래에서 펼침');await rightIntact('자료 보기');
  assert.equal(await page.locator('.dv3-left [data-dv3="files"]').innerText(),'접기');
  if(shot)await page.screenshot({path:shot+'-files.png'});
  await page.locator('.dv3-left [data-dv3="files"]').click();await page.waitForTimeout(250);assert.equal(await page.locator('#detailAction').count(),0);assert.equal(await page.locator('.dv3-left [data-dv3="files"]').innerText(),'자료 보기');
  await page.locator('.dv3-left [data-dv3="addc"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('.dv3-slot[data-slot="others"]>#ddvPanel.dp-contact').count(),1,'+ 추가 = 다른 연락처 아래');await rightIntact('연락처 추가');
  await page.locator('#ddvPanel [data-dp="close"]').first().click();await page.waitForTimeout(200);
  /* 오른쪽에서 누른 것도 덮지 않고 그 카드 아래에 */
  await page.locator('#nowCard .nc-call').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#detailView .dw-right>.dv3-slot[data-slot="now"]>#ddvPanel').count(),1,'연락 결과 = 지금 할 일 아래');await rightIntact('연락 결과');
  await page.keyboard.press('Escape');await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>__writes.map(w=>w[0]).filter(o=>o!=='opportunity_touch')),[],'펼치고 접는 것만으로 저장 없음');
  /* 같은 현장 다른 영업 → 그 건 상세 */
  await page.locator('.dv3-left .dv3-rel').first().click();await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),'22222222-2222-4222-8222-222222222222');assert.equal(await page.locator('#detailView.dv3 .dv3-left').count(),1);
  assert.equal(await page.locator('#detailView .dv3-left .dv3-val').count(),0,'종료된 건은 칸이 눌리지 않음');
  /* 끄기 */
  await page.evaluate(()=>{G.dealDetailV3Off=true;G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForTimeout(600);
  assert.equal(await page.locator('#detailView.dv3').count(),0);assert.equal(await page.locator('#detailView .dv3-left').count(),0);assert.equal(await page.locator('#detailView .dw-right>.dk-ai').count(),1,'끄면 예전 모양');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',window_size:true,left_five_sections:true,one_person_one_call:true,related_deals:true,inline_expand_right_intact:true,now_card_merged_ai:true,stage_info_deduped:true,no_save_on_expand:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
