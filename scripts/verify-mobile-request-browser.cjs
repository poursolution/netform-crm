'use strict';
/* 모바일 관리자 요청 검사(2026-10-09): 새 요청 도착 팝업(요청자 · 현장 · 해야 할 일 · 기한만) → [응대 시작] / [확인 · 나중에 처리]
   → 확인 뒤 '오늘' 맨 위 작은 카드 · [처리하기] = 처리 중 + 결과 입력 화면 → 실제 결과를 저장하면 자동 완료(부재 = absent).
   닫기(×)는 아무것도 기록하지 않는다. 서버는 이 검사 안의 가짜 저장소(MobileRequest.use) — 실제 규칙은 sql/work-request-v1-20261005.sql */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html; charset=utf-8');fs.createReadStream(t).pipe(res)});
const one=s=>String(s).replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MobileRequest&&typeof render==='function'&&typeof nav==='function');
  await page.evaluate(()=>{
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req';};DEMO=true;G.user=REPS.find(r=>r.role==='rep')||REPS[0];G.mode='rep';
   const INQ='00000009-0000-4000-8000-000000000009',now=()=>new Date().toISOString(),at=ms=>new Date(Date.now()+ms).toISOString();
   ADMIN.inquiries=[inquiryViewM({id:INQ,site:'[경기 수원] 수원장안힐스테이트',status:'배정완료',assignee:G.user.nm,phone:'010-1234-5678',created_at:at(-3*864e5),detail:{inquiry:'옥상 방수 견적'}})];
   DEALS.unshift(normalizeDeal({id:'deal-req',nm:'[서울 송파] 가락현대TWELVE',rep:G.user.nm,code:'consulting',lastAt:at(-10*864e5),stageAt:at(-10*864e5),nextAction:null,activities:[],amt:1e8,manager_name:'김소장',manager_mobile:'01077778888'}));
   const mk=(id,extra)=>Object.assign({id,target_type:'inquiry',target_id:INQ,site:'[경기 수원] 수원장안힐스테이트',brand:'POUR솔루션',kind:'first',label:'첫 연락 요청',to_scope:'user',to_name:G.user.nm,asks:['고객 첫 연락'],due_at:at(6*3600e3),due_label:'오늘 중',memo:'',status:'sent',round:1,requested_by:'송보람',created_at:at(-600e3),updated_at:at(-600e3),to_me:true,by_me:false},extra||{});
   window.__db=[mk('r1')];window.__rpc=[];
   MobileRequest.use({rpc:(name,p)=>{__rpc.push([name,p]);const r=__db.find(x=>x.id===p.id);
    if(name==='crm_work_request_list_v1')return {ok:true,requests:__db.map(x=>Object.assign({},x))};
    if(!r)return {ok:false};if(!['sent','seen','working'].includes(r.status))return {ok:true,request:Object.assign({},r),already:true};
    if(p.action==='seen'){if(r.status==='sent')r.status='seen';r.seen_at=r.seen_at||now();}
    else if(p.action==='working'){r.status='working';r.seen_at=r.seen_at||now();}
    else if(p.action==='done'){Object.assign(r,{status:p.absent?'absent':'done',result:p.result,next_text:p.next_text||null,next_due:p.next_due||null,auto_done:!!p.auto,closed_at:now()});}
    return {ok:true,request:Object.assign({},r)};}});
   nav('today');MobileRequest.load(true);
  });
  await page.waitForTimeout(500);
  const st=id=>page.evaluate(id=>__db.find(r=>r.id===id).status,id);
  /* 1. 도착 팝업: 요청자 · 현장 · 해야 할 일 · 기한만 · 보기만으로는 확인 아님 */
  const pop=page.locator('#mrq-pop .mrq-pop');assert.equal(await pop.count(),1,'새 요청 팝업');
  assert.equal(await pop.locator('header b').innerText(),'새 요청');
  assert.deepEqual(await pop.locator('.mrq-item>*').allInnerTexts(),['송보람님이 고객 응대를 요청했습니다.','[경기 수원] 수원장안힐스테이트','고객에게 연락한 뒤 통화 결과와 다음 일정을 등록해주세요.','처리 기한: 오늘 중']);
  assert.deepEqual(await pop.locator('footer button').allInnerTexts(),['응대 시작','확인 · 나중에 처리']);
  assert.equal(await st('r1'),'sent','팝업을 본 것만으로는 담당 확인이 아니다');
  assert.equal(await page.evaluate(()=>{const p=document.querySelector('#mrq-pop .mrq-pop').getBoundingClientRect();return p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight;}),true,'팝업이 화면 안에');
  if(shot)await page.screenshot({path:shot+'-pop.png'});
  /* 2. 닫기(×) = 기록 없음 · 카드에 '확인 전' + [새 요청 보기] */
  await pop.locator('[data-mrq="close"]').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#mrq-pop').count(),0);assert.equal(await st('r1'),'sent','닫기 ≠ 확인');
  const top=page.locator('#scr .mrq-top');assert.equal(await top.count(),1,"'오늘' 맨 위 작은 카드");
  assert.equal(one(await top.locator('.hd').innerText()),'관리자 요청 미완료 1건 확인 전 1건 새 요청 보기');
  assert.deepEqual(await top.locator('.mrq-row').first().evaluate(n=>['.l b','.l span','.st','.go'].map(q=>n.querySelector(q).textContent)),['[경기 수원] 수원장안힐스테이트','고객 연락 · 오늘까지','확인 전','처리하기']);
  assert.equal(await page.evaluate(()=>{const t=document.querySelector('#scr .mrq-top'),h=document.querySelector('#scr .mt-head');return !!h&&t.getBoundingClientRect().top>=h.getBoundingClientRect().bottom-1;}),true,'제목 바로 아래');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'가로 넘침 없음');
  if(shot)await page.screenshot({path:shot+'-card.png',fullPage:true});
  /* 3. [새 요청 보기] → 팝업 → [확인 · 나중에 처리] = seen 만 · 카드는 남는다 */
  await top.locator('[data-mrq="show"]').click();await page.waitForTimeout(200);assert.equal(await page.locator('#mrq-pop').count(),1);
  await page.locator('#mrq-pop footer [data-mrq="ack"]').click();await page.waitForTimeout(300);
  assert.equal(await page.locator('#mrq-pop').count(),0);assert.equal(await st('r1'),'seen');
  assert.equal(one(await top.locator('.hd').innerText()),'관리자 요청 미완료 1건');assert.equal(await top.locator('.mrq-row .st').innerText(),'확인함');
  /* 4. [처리하기] = working + 첫 연락 화면 → 결과를 남기면 자동 완료 */
  await top.locator('.mrq-row [data-mrq="start"]').click();await page.waitForTimeout(400);
  assert.equal(await st('r1'),'working');assert.equal(await page.evaluate(()=>G.sub&&G.sub.t),'inqAssigned');assert.equal(await page.locator('#scr .appbar .ttl').innerText(),'새 문의 · 첫 연락');
  assert.equal(await page.locator('#scr .mrq-top').count(),0,'결과 화면에서는 카드가 안 보인다');
  if(shot)await page.screenshot({path:shot+'-inq.png',fullPage:true});
  const btn=page.locator('#scr button[onclick*="recordInquiryResponse"]').first(),label=await btn.getAttribute('data-v');
  await btn.click();await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const r=__db.find(x=>x.id==='r1');return [r.status,r.result,r.auto_done];}),[/못 받|안 받|부재/.test(label)?'absent':'done',/못 받|안 받|부재/.test(label)?'부재':'연락 기록 확인',true],'실제 결과 저장 뒤 자동 완료 · '+label);
  assert.equal(await page.locator('#scr .mrq-top').count(),0,'처리하면 카드가 사라진다');
  /* 5. 영업건 요청: 팝업 [응대 시작] = working + 상세로 → 연락 결과 · 다음 할 일이 저장되면 자동 완료(다음 할 일 같이) */
  await page.evaluate(()=>{const at=ms=>new Date(Date.now()+ms).toISOString();__db.push(Object.assign({},__db[0],{id:'r2',target_type:'deal',target_id:'deal-req',site:'[서울 송파] 가락현대TWELVE',kind:'follow',label:'후속 연락 요청',asks:['고객 반응 기록'],due_label:'오늘 17:00',due_at:at(3*3600e3),status:'sent',result:null,auto_done:false,closed_at:null}));G.mreq.at=0;nav('today');});
  await page.waitForTimeout(500);
  assert.deepEqual(await page.locator('#mrq-pop .mrq-item>*').allInnerTexts(),['송보람님이 고객 응대를 요청했습니다.','[서울 송파] 가락현대TWELVE','고객에게 후속 연락한 뒤 고객 반응과 다음 일정을 등록해주세요.','처리 기한: 오늘 17:00']);
  await page.locator('#mrq-pop footer [data-mrq="start"]').click();await page.waitForTimeout(400);
  assert.equal(await st('r2'),'working');assert.equal(await page.evaluate(()=>String(G.deal)),'deal-req','영업건 상세(전화 · 결과 남기기)');
  await page.evaluate(()=>{const d=DEALS.find(x=>x.id==='deal-req'),at=new Date().toISOString();d.activities.push({id:'a1',type:'전화',note:'통화 완료 · 진행 중',at,occurred_at:at});d.contactAt=at;d.nextAction={id:'n1',type:'전화',text:'진행 상황 확인 전화',due_at:new Date(Date.now()+3*864e5).toISOString().slice(0,10),status:'open'};G.deal=null;nav('today');});
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const r=__db.find(x=>x.id==='r2');return [r.status,r.result,r.next_text,!!r.next_due];}),['done','응대 기록 확인','진행 상황 확인 전화',true]);
  assert.equal(await page.locator('#scr .mrq-top').count(),0);
  /* 6. 끄면 아무것도 없다 */
  await page.evaluate(()=>{__db.push(Object.assign({},__db[0],{id:'r3',status:'sent',result:null,closed_at:null}));G.mobileRequestOff=true;G.mreq=null;nav('today');});await page.waitForTimeout(300);
  assert.equal(await page.locator('#mrq-pop, #scr .mrq-top').count(),0);
  assert.equal(await page.evaluate(()=>__writes.filter(w=>w[0]!=='inquiry_assign').length),0,'이 모듈은 쓰기 큐를 쓰지 않는다');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',arrival_popup_summary_only:true,close_ack_work_done_are_distinct:true,compact_card_under_title:true,start_opens_result_screen:true,auto_complete_from_saved_result:true,deal_next_action_carried:true,off_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
