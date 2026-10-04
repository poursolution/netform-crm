'use strict';
/* 영업건 상세 · 담당자 변경 창 v2 검사(2026-10-04 대표 시안 캡처)
   지금 → 새 담당 / 누구에게 *(진행 건수 · 업무량 = 영업사원 관리와 같은 계산, 아래 한 줄은 자료에서만) / 왜 *(칩 + 한 줄 더) / 실적은 누구에게 / [취소] [담당자 변경 저장] / 변경 이력
   저장 경로는 그대로: 기존 칸에 값을 옮긴 뒤 saveAssigneeChange() — 담당 변경(assign) · 사유 · 실적 귀속 기록이 전과 같이 일어난다. 가운데 패널 · 오른쪽 '지금 할 일'은 그대로. 끄면 예전 상자. */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealOwnerV2&&window.DealOwner&&window.DealDetailV3&&window.DetailActions&&window.PipelineListV2&&window.OpsStore);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   let seq=0;const mk=(site,who,brand,code)=>{seq++;const x=String(seq).padStart(2,'0');return {id:x.repeat(4)+'-1111-4111-8111-'+x.repeat(6),site,assignee:who,brand:brand||'POUR솔루션',created:day(-60),code:code||'sent',stage_code:code||'sent',grp:'영업·관리',amt:1e8,manager_name:'김영수',manager_mobile:'01012345678',contacts:[],activities:[],next_action:{id:'n'+seq,text:'후속 통화',due:day(3),status:'open'}};};
   B={deals:[Object.assign(mk('[경기 평택] 오뚜기 포승공장','이필선'),{activities:[{id:'a1',type:'전화',note:'소장 통화',at:at(-20),actor:'이필선',meaningful:true}]}),
     mk('[경기 평택] 평택 A','정정훈','석민이앤씨'),mk('[경기 평택] 평택 B','정정훈','석민이앤씨','consult'),
     mk('[서울] 서울 C','김성민'),mk('[서울] 서울 D','한준엽','석민이앤씨')],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   /* 실적 귀속 서버 흉내 */
   window.__rpc=[];const base=OpsStore.rpc.bind(OpsStore);OpsStore.has=()=>true;OpsStore.rpc=async(name,p)=>{__rpc.push([name,p]);if(name==='crm_deal_owner_list_v1')return {rows:[],events:[]};if(name==='crm_deal_owner_reassign_v1')return {owner:{deal_id:p.deal_id,performance_owner:p.keep_owner,first_owner:p.first_owner||null}};if(/approval/.test(name))return {request:{id:'ap1',type:'owner_change',state:'pending',deal_id:p.deal_id,at:new Date().toISOString()},requests:[],rows:[]};return {rows:[],tasks:[]};};
   window.__toasts=[];window.toast=m=>__toasts.push(String(m));
   G.pipeStageBOff=true;PipelineWorkspace.open('sent');
  });
  await page.waitForTimeout(300);
  await page.locator('#pipeline-list-v2 .plv-row',{hasText:'오뚜기'}).locator('.plv-site').click();await page.waitForTimeout(700);
  const v=page.locator('#detailView'),openOwner=async()=>{await v.locator('.dv3-headact .tf-more').click();await v.locator('.tf-menu [data-tf="m-owner"]').click();await page.waitForTimeout(450);};
  const rightBefore=await v.locator('.dw-right').innerText();
  await openOwner();
  /* 1. 가운데 패널 · 예전 상자는 숨김 · 머리말 */
  const A=page.locator('#detailAction'),o=A.locator('.ow2');
  assert.equal(await v.locator('.dw-center>.dv3-cpanel:not([hidden])>.dv3-slot[data-slot="center"]>#detailAction.ow2-on').count(),1,'담당자 변경 = 가운데 패널');
  assert.equal(await A.locator('#da-title').innerText(),'담당자 변경');
  assert.equal(await A.locator('.dcard').first().evaluate(n=>getComputedStyle(n).display),'none','예전 담당자 관리 상자는 숨김');
  assert.equal(await A.locator('.da-content>button.da-action').evaluate(n=>getComputedStyle(n).display),'none');
  assert.equal(await v.locator('.dw-right').innerText(),rightBefore,'오른쪽 지금 할 일은 그대로');
  /* 2. 지금 → 새 담당(선택 전) */
  const flow=()=>o.locator('.ow2-flow>div').evaluateAll(l=>l.map(n=>[n.querySelector('span').textContent,n.querySelector('b').textContent,n.classList.contains('empty')]));
  assert.deepEqual(await flow(),[['지금','이필선',false],['새 담당','선택하세요',true]]);
  assert.equal(await o.locator('.ow2-flow>div.empty').evaluate(n=>getComputedStyle(n).borderTopStyle),'dashed');
  assert.deepEqual(await o.locator('.ow2-lb').allInnerTexts(),['누구에게 *','왜 *','실적은 누구에게']);
  /* 3. 누구에게: 기존 선택지 그대로(지금 담당 제외) · 진행 건수 · 업무량 · 아래 한 줄은 자료에서 */
  const people=await o.locator('.ow2-people button').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('span>span').textContent,n.querySelector('em').textContent]));
  const optNames=await page.evaluate(()=>[...document.getElementById('dv-assignee').options].map(x=>repN(x.value)).filter(n=>n!=='이필선'));
  assert.deepEqual(people.map(p=>p[0]).slice().sort(),optNames.slice().sort(),'고를 수 있는 사람 = 기존 선택 상자의 선택지');
  const P=Object.fromEntries(people.map(p=>[p[0],p]));
  assert.equal(P['정정훈'][1],'평택 인근 진행 2곳','같은 지역 진행 건수');assert.match(P['정정훈'][2],/^진행 2 · (여유|보통|많음|관리 부하)$/);
  assert.equal(P['김성민'][1],'POUR솔루션 진행 1건','같은 브랜드 진행 건수');assert.match(P['김성민'][2],/^진행 1 · /);
  assert.match(P['한준엽'][1],/^(팀장|진행 중인 같은 지역 · 브랜드 영업 없음)$/);assert.equal(P['한준엽'][1],'팀장','지역 · 브랜드가 없으면 직함');
  assert.equal(people[0][0],'정정훈','같은 지역 경험이 있는 사람이 위로');
  const levels=await page.evaluate(()=>{const rows=repFlowData(true),min=Math.min.apply(null,rows.map(r=>r.load.score));return Object.fromEntries(rows.map(r=>[r.nm,[r.load.open,r.risk>=4?'관리 부하':r.load.score<=min?'여유':r.load.score>min+16?'많음':'보통']]));});
  for(const p of people)if(levels[p[0]])assert.equal(p[2],'진행 '+levels[p[0]][0]+' · '+levels[p[0]][1],p[0]+' 업무량 = 영업사원 관리와 같은 판정');
  /* 4. 왜 칩 + 한 줄 더 · 실적은 누구에게 · 저장 잠금 */
  assert.deepEqual(await o.locator('.ow2-chips button').allInnerTexts(),['지역 재배치','업무량 재분배','브랜드 담당 변경','고객 요청','퇴사 · 휴직']);
  assert.equal(await o.locator('.ow2-more').getAttribute('placeholder'),'한 줄 더 (선택)');
  assert.deepEqual(await o.locator('.ow2-attr button').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('span').textContent,n.getAttribute('aria-checked')])),[['이필선 유지 (기본)','지금까지 영업한 사람에게 · 바로 저장','true'],['새 담당에게 넘기기','예외 승인함으로 올라감 · 승인 후 바뀜','false']]);
  assert.equal(await o.locator('.ow2-hint').innerText(),'누구에게 · 왜를 고르면 저장할 수 있습니다');
  assert.deepEqual(await o.locator('.ow2-act button').evaluateAll(l=>l.map(n=>[n.textContent,n.disabled])),[['취소',false],['담당자 변경 저장',true]]);
  assert.equal(await o.locator('.ow2-act .go').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(201, 205, 213)');
  assert.equal(await o.locator('.ow2-hist>b').innerText(),'변경 이력');assert.ok((await o.locator('.ow2-hist>div').count())>=1);
  if(shot)await page.screenshot({path:shot+'-owner-empty.png'});
  /* 5. 고르기: 사람만 → 아직 잠김, 사유까지 → 열림 */
  await o.locator('.ow2-people button',{hasText:'정정훈'}).click();await page.waitForTimeout(80);
  assert.deepEqual(await flow(),[['지금','이필선',false],['새 담당','정정훈',false]]);assert.equal(await o.locator('.ow2-act .go').isDisabled(),true);
  assert.equal(await o.locator('.ow2-people button[aria-checked="true"]').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(245, 248, 255)');
  await o.locator('.ow2-chips button',{hasText:'지역 재배치'}).click();await page.waitForTimeout(80);
  assert.equal(await o.locator('.ow2-act .go').isDisabled(),false);assert.equal(await o.locator('.ow2-hint').innerText(),'이필선 → 정정훈 · 지역 재배치');
  await o.locator('.ow2-more').fill('평택 현장이 몰려 있어 묶음');
  assert.equal(await o.locator('.ow2-hint').innerText(),'이필선 → 정정훈 · 지역 재배치 · 평택 현장이 몰려 있어 묶음');
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.matches('.ow2-more')),true,'적는 동안 포커스 유지');
  if(shot)await page.screenshot({path:shot+'-owner-ready.png'});
  /* 6. 저장 = 기존 경로 그대로(assign + 사유 + 실적 귀속 유지 기록) */
  await o.locator('.ow2-act .go').click();await page.waitForTimeout(500);
  const w=await page.evaluate(()=>__writes.filter(x=>x[0]==='assign').map(x=>[x[1].from,x[1].to,x[1].reason]));
  assert.deepEqual(w,[['이필선','정정훈','지역 재배치 · 평택 현장이 몰려 있어 묶음']]);
  const re=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_owner_reassign_v1').map(x=>[x[1].from,x[1].to,x[1].reason,x[1].attribution,x[1].keep_owner]));
  assert.deepEqual(re,[['이필선','정정훈','지역 재배치 · 평택 현장이 몰려 있어 묶음','keep','이필선']],'실적 귀속은 주담당 유지로 기록');
  assert.equal(await page.evaluate(()=>repN(B.deals[0].assignee)),'정정훈');
  /* 저장 뒤: 고른 값은 비우고, 지금 담당이 바뀌어 있다 */
  if(!(await A.count()))await openOwner();
  assert.deepEqual(await flow(),[['지금','정정훈',false],['새 담당','선택하세요',true]]);
  assert.ok(!(await o.locator('.ow2-people button').allInnerTexts()).some(t=>/^정정훈/.test(t)),'지금 담당은 목록에서 빠진다');
  assert.match(await o.locator('.ow2-hist').innerText(),/이필선 → 정정훈/,'변경 이력에 남는다');
  /* 7. 새 담당에게 넘기기 = 귀속 변경 요청으로 기록 */
  await o.locator('.ow2-people button',{hasText:'김성민'}).click();await o.locator('.ow2-chips button',{hasText:'고객 요청'}).click();
  await o.locator('.ow2-attr button',{hasText:'새 담당에게 넘기기'}).click();await page.waitForTimeout(80);
  assert.equal(await o.locator('.ow2-attr button[aria-checked="true"] b').innerText(),'새 담당에게 넘기기');
  await o.locator('.ow2-act .go').click();await page.waitForTimeout(500);
  const re2=await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_deal_owner_reassign_v1').map(x=>[x[1].to,x[1].reason,x[1].attribution]).pop());
  assert.deepEqual(re2,['김성민','고객 요청','request']);
  /* 8. 취소 = 패널 닫힘 · 끄면 예전 상자 */
  if(!(await A.count()))await openOwner();
  await o.locator('.ow2-act button',{hasText:'취소'}).click();await page.waitForTimeout(300);assert.equal(await page.locator('#detailAction').count(),0,'취소 = 패널 닫힘');
  await page.evaluate(()=>{G.dealOwnerV2Off=true;});await openOwner();
  assert.equal(await page.locator('#detailAction .ow2').count(),0);assert.equal(await page.locator('#detailAction .dcard').first().evaluate(n=>getComputedStyle(n).display)!=='none',true,'끄면 예전 상자');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',center_panel:true,flow_boxes:true,people_from_existing_options_with_load:true,why_chips_and_note:true,attribution_choice:true,save_gate:true,saves_through_existing_path:true,cancel_and_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
