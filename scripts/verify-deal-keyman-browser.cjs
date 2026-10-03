'use strict';
/* 파이프라인 상세 · 담당자 관계 이력 + AI 판단 검사(2026-10-03 대표):
   왼쪽 '관리소장 근무 이력' 표 숨김 · 변경 경고 블록(확인 항목 4 · 첫 응대 기록 = 입력칸 채우기) · 가운데 변경 기록 강조 · 오른쪽 변경 후 재확인 제안 · AI 판단(다음 행동 · 첫마디, 제안만)
   · 연락처 패널에서 다른 현장의 같은 번호 → 기존 고객 관계 안내 · 끄기 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealKeyman&&window.DealPanelsV2&&window.DealDetailV2&&window.PipelineListV2&&window.DetailActions&&window.OpsStore);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   B={deals:[
    {id:'11111111-1111-4111-8111-111111111111',site:'[서울 도봉] 창동동아그린아파트',assignee:'황윤선',brand:'POUR솔루션',created:day(-60),code:'sent',stage_code:'sent',grp:'영업·관리',amt:38e7,manager_name:'김영수',manager_mobile:'01012345678',office_phone:'0212345678',
     contacts:[{person_key:'mobile:01012345678',name:'김영수',role:'관리소장',mobile:'01012345678',status:'current'},{person_key:'mobile:01011112222',name:'박영호',role:'이전 소장',mobile:'01011112222',status:'previous',ended_at:day(-3)}],
     next_action:{id:'n1',text:'견적 후속 통화',due:day(2),status:'open'},
     activities:[{id:'a1',type:'전화',note:'소장 통화 — 견적 검토 중',at:at(-20)},{id:'a2',type:'업무',note:'관리소장 변경 — 이전 소장 기록',result:'박영호 · 010-1111-2222 · '+day(-3)+'까지 → 새 소장 김영수',at:at(-3)}],stage_contexts:{sent:{fields:{sent_date:day(-15)}}}},
    {id:'22222222-2222-4222-8222-222222222222',site:'[경기 성남] 분당시범우성아파트',assignee:'이필선',brand:'POUR솔루션',created:day(-400),updated:day(-200),code:'won',stage_code:'won',outcome:'won',won_amount:2e8,closed_at:day(-200),grp:'영업·관리',amt:2e8,manager_name:'박영호',manager_mobile:'01011112222',
     contacts:[{person_key:'mobile:01011112222',name:'박영호',role:'관리소장',mobile:'01011112222',status:'current'}],activities:[{id:'b1',type:'방문',note:'현장 방문 · 옥상 상태 확인',at:at(-300)},{id:'b2',type:'전화',note:'견적 설명',at:at(-280)}]},
    {id:'33333333-3333-4333-8333-333333333333',site:'변경 없는 현장',assignee:'황윤선',brand:'POUR솔루션',created:day(-30),code:'sent',stage_code:'sent',grp:'영업·관리',amt:1e8,manager_name:'최소장',manager_mobile:'01099998888',contacts:[{person_key:'mobile:01099998888',name:'최소장',role:'관리소장',mobile:'01099998888',status:'current'}],activities:[]}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   SB={rpc:async()=>({data:{ok:true,tasks:[]}})};TOKEN='test';
   /* AI 는 흉내: 켜져 있고, 호출 입력을 기록한다(제안만) */
   window.__ai=[];OpsStore.aiOn=()=>true;OpsStore.ai=async(kind,type,id,input)=>{__ai.push([kind,type,id,input]);return kind==='next_action'?{suggestion:{how:'전화',what:'새 소장에게 기존 견적 조건 설명',days:1,why:'관리소장 변경 뒤 첫 응대가 없음'}}:{suggestion:{opener:'안녕하세요 소장님, 넷폼 송보람입니다. 전임 박영호 소장님과 진행하던 옥상 방수 건으로 연락드렸습니다.',goal:'기존 견적 조건 유지 여부 확인',summary:'3일 전 관리소장 변경'}};};
   G.pipeStageBOff=true;PipelineWorkspace.open('sent');
  });
  await page.waitForTimeout(200);
  await page.locator('#pipeline-list-v2 .plv-row',{hasText:'창동동아그린'}).locator('.plv-site').click();await page.waitForTimeout(500);
  const v=page.locator('#detailView.ddv');assert.equal(await v.count(),1,'새 상세');
  /* ① 왼쪽: 근무 이력 표 · 근무지 이동 버튼 숨김, 변경 경고 블록 */
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#contactCard .malb')].filter(n=>/근무 이력/.test(n.textContent)&&!n.hidden).length),0,'근무 이력 표 숨김');
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#contactCard button[onclick*="openManagerMove"]')].filter(b=>!b.hidden).length),0,'근무지 이동 버튼 숨김');
  const chg=v.locator('#contactCard .dk-change');assert.equal(await chg.count(),1,'변경 경고 블록');
  assert.match(await chg.innerText(),/⚠ \d+\/\d+ 담당자 변경\s*이전: 박영호 소장 · 변경 후 첫 응대 전\s*변경 내용 확인/);
  await chg.locator('[data-dk="toggle"]').click();await page.waitForTimeout(200);
  const body=page.locator('#contactCard .dk-change .dk-body');assert.equal(await body.count(),1);
  assert.match(await body.innerText(),/기존 관리소장\s*박영호[\s\S]*현재 관리소장\s*김영수[\s\S]*현재 영업단계[\s\S]*기존 견적\s*3\.8억[\s\S]*확인 필요\s*0\/4/);
  assert.deepEqual(await body.locator('.dk-checks button').allInnerTexts(),['☐ 기존 견적 조건 유지 여부','☐ 공법 선호 변경 여부','☐ 경쟁업체 변경 여부','☐ 공사 추진일정 변경 여부']);
  await body.locator('.dk-checks button').first().click();await page.waitForTimeout(150);
  assert.match(await page.locator('#contactCard .dk-change .dk-body').innerText(),/확인 필요\s*1\/4/);assert.equal(await page.evaluate(()=>itemPatch(CUR_DETAIL.item,'deal').keymanChecks.items[0]),true,'표시는 이 PC 에');
  /* ② 가운데: 변경 기록 강조 */
  assert.equal(await v.locator('.idv-thread .idv-msg.dk-key').count(),1,'변경 기록 강조');assert.equal(await v.locator('.idv-msg.dk-key .idv-meta em').innerText(),'담당자 변경');
  /* ③ 오른쪽: 변경 후 재확인 제안 → 첫 응대 기록 = 입력칸 채우기(저장은 사람이) */
  const now=v.locator('.dw-right .dk-now');assert.equal(await now.count(),1);
  assert.match(await now.innerText(),/담당자 변경 감지[\s\S]*관리소장 변경 후 기존 견적 · 공법조건 재확인[\s\S]*박영호 → 김영수/);
  await now.locator('[data-dk="first"]').click();await page.waitForTimeout(150);
  assert.match(await page.locator('#ddvComposer textarea').inputValue(),/^관리소장 변경 후 첫 응대\(박영호 → 김영수\): 기존 견적 조건 유지 확인 — $/);
  assert.deepEqual(await page.evaluate(()=>__writes.map(w=>w[0]).filter(o=>o!=='opportunity_touch'/* 상세 열람 기록(기존) */)),[],'자동 저장 없음');
  /* AI 판단: 제안만 · 입력에 변경 사실 포함 */
  const ai=v.locator('.dw-right .dk-ai');assert.equal(await ai.count(),1,'AI 판단 칸');
  assert.deepEqual(await ai.locator('.dk-aibtns button').allInnerTexts(),['다음 행동 추천','통화 첫마디']);
  await ai.locator('[data-dk="ai-next"]').click();await page.waitForTimeout(300);
  assert.match(await page.locator('.dw-right .dk-ai').innerText(),/다음 행동\s*전화 · 새 소장에게 기존 견적 조건 설명 · 1일 뒤\s*관리소장 변경 뒤 첫 응대가 없음/);
  const call=await page.evaluate(()=>__ai[0]);assert.equal(call[0],'next_action');assert.equal(call[3].keyman_change.prev,'박영호');assert.equal(call[3].keyman_change.responded_after,false);assert.equal(call[3].stage,'자료 발송완료');
  await page.locator('.dw-right .dk-ai [data-dk="ai-call"]').click();await page.waitForTimeout(300);
  assert.match(await page.locator('.dw-right .dk-ai').innerText(),/통화 첫마디\s*“안녕하세요 소장님[\s\S]*목표: 기존 견적 조건 유지 여부 확인/);
  await page.locator('.dw-right .dk-ai [data-dk="ai-next-use"]').click();await page.waitForTimeout(100);
  assert.match(await page.locator('#ddvComposer textarea').inputValue(),/^다음 행동: 새 소장에게 기존 견적 조건 설명 \(전화, 1일 뒤\)/);
  if(shot)await page.screenshot({path:shot+'-detail.png',fullPage:true});
  /* ④ 연락처 패널: 다른 현장(분당시범우성 · 수주)의 박영호 번호 → 기존 고객 관계 안내 */
  await page.evaluate(()=>openQuickContact('new'));await page.waitForTimeout(200);
  const panel=page.locator('#detailView .dw-right #ddvPanel.dp-contact');assert.equal(await panel.count(),1);
  await panel.locator('#qc-mobile').fill('010-1111-2222');await page.waitForTimeout(150);
  const known=panel.locator('.dk-known');assert.equal(await known.count(),1,'기존 고객 관계 안내');
  assert.match(await known.innerText(),/기존 고객 관계가 있습니다[\s\S]*박영호 관리소장[\s\S]*이전 근무: \[경기 성남\] 분당시범우성아파트[\s\S]*견적 0회 · 방문 1회 · 통화 1회 · 수주 단계까지[\s\S]*이 사람으로 채우기/);
  await known.locator('[data-dk-fill]').click();assert.equal(await panel.locator('#qc-name').inputValue(),'박영호');
  await panel.locator('#qc-mobile').fill('010-5555-6666');await page.waitForTimeout(150);assert.equal(await panel.locator('.dk-known').count(),0,'모르는 번호면 없음');
  if(shot)await page.screenshot({path:shot+'-known.png'});
  await page.locator('#ddvPanel .ddv-back').click();await page.waitForTimeout(150);
  /* 변경 없는 현장: 경고 · 제안 없음 */
  await page.evaluate(()=>{closeDetail?closeDetail():history.back();});await page.waitForTimeout(300);
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[2]));});await page.waitForTimeout(500);
  assert.equal(await page.locator('#detailView.ddv').count(),1);assert.equal(await page.locator('#contactCard .dk-change').count(),0,'변경 없으면 조용');assert.equal(await page.locator('.dw-right .dk-now').count(),0);
  assert.equal(await page.locator('.dw-right .dk-ai').count(),1,'AI 판단은 항상');
  /* 끄기 */
  await page.evaluate(()=>{G.dealKeymanOff=true;G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForTimeout(500);
  assert.equal(await page.locator('#contactCard .dk-change').count(),0);assert.equal(await page.locator('.dw-right .dk-ai').count(),0);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#contactCard .malb')].filter(n=>/근무 이력/.test(n.textContent)&&!n.hidden).length),1,'끄면 근무 이력 표 그대로');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',history_table_hidden:true,change_block:true,checks_local:true,timeline_key_event:true,now_suggestion:true,first_response_prefill:true,ai_next_call:true,ai_input_keyman:true,known_person:true,quiet_when_no_change:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
