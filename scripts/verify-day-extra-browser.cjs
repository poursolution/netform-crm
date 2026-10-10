'use strict';
/* 오늘 업무 — 기록 부족 ≠ 영업 정체 · 하루 마감 (2026-10-10 design_handoff_day_zones §4-3 · §5) — 합성 자료(현장 · 이름은 지어낸 것)
   확인: 접촉 기록이 없는 건 = '활동 여부 확인 필요' + [활동 확인](상황 4가지 · 고른 뒤에만 저장 · 연락 업무는 ③에서만) / 기록 상태 4가지(활동 확인 필요 · 회신 대기 · 무기한 대기 · 실제 정체)
         / 하루 마감 요약 3칸(오늘 완료 · 미완료 약속 · 내일 이어갈 일) · 미완료 약속은 사유 + 다음 처리일이 있어야 [요약 복사 · 공유] / 글 넘침 없음 / 끄기 G.dayExtraOff */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1400},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.TodayV2&&window.TodayV3&&window.DayZones&&window.DayExtra&&window.WorkRequest&&window.InquiryMemo&&window.DealDetailV3&&window.OpsStore);
  await page.evaluate(()=>{
   const at=d=>new Date(Date.now()-d*864e5).toISOString(),day=d=>new Date(Date.now()+d*864e5).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'});window.__day=day;
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-30),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:2e8,manager_name:'김소장',manager_mobile:'01077778888'},extra||{});
   const sentStall=(id,site,extra)=>deal(id,site,Object.assign({amt:1.1e8,code:'sent',stage_code:'sent',last_activity_at:at(9),stage_contexts:{sent:{fields:{sent_date:day(-9)}}},next_action:{id:'n-'+id,type:'전화',text:'견적 검토 확인',due:day(-2),status:'open'}},extra||{}));
   const nextWd=(()=>{let k=day(1);for(let i=0;i<3;i++){const g=new Date(k+'T00:00:00Z').getUTCDay();if(g===0||g===6)k=new Date(Date.parse(k+'T00:00:00Z')+864e5).toISOString().slice(0,10);else break;}return k;})();window.__nextWd=nextWd;
   B={deals:[
    /* 접촉 기록 없음 3건 → 활동 여부 확인 필요 */
    sentStall('norec1','[부산] 동부산훼미리타운4차'),sentStall('norec2','[대구] 강북이진캐스빌'),sentStall('norec3','[경기 김포] 한강반도유보라'),
    /* 접촉 기록 있음 = 활동은 확인됨 → 실제 정체(진행 판단 필요) */
    sentStall('stall1','[서울 송파] 서울체육고등학교',{activities:[{id:'s1',type:'전화',note:'통화 완료 · 견적 설명',at:at(9),occurred_at:at(9),actor:'이필선',meaningful:true}]}),
    /* 같은 현장의 다른 영업건(④ 연결 대상) */
    deal('sib1','[부산] 동부산훼미리타운4차',{code:'compete',stage_code:'compete',brand:'석민이앤씨',next_action:{id:'ns',type:'전화',text:'입찰 서류 확인',due:day(6),status:'open'},stage_contexts:{compete:{fields:{decision_date:day(20),competition_type:'PT'}}},activities:[{id:'sb',type:'전화',note:'통화 완료 · 일정 확인',at:at(1),occurred_at:at(1),actor:'이필선',meaningful:true}]}),
    /* 회신 대기(사유 + 확인일) · 무기한 대기(사유만) */
    deal('wait1','[서울 마포] 성산시영아파트',{code:'waiting',stage_code:'waiting',waiting_reason:'입대의 결과 회신 대기',expected_resume_at:day(4),last_activity_at:at(6),activities:[{id:'w1',type:'전화',note:'통화 완료 · 회신 대기',at:at(6),occurred_at:at(6),actor:'이필선',meaningful:true}]}),
    deal('nowait1','[경기 고덕] 고덕아이파크',{code:'waiting',stage_code:'waiting',waiting_reason:'예산 확정 뒤 연락 달라고 함',last_activity_at:at(5),activities:[{id:'nw',type:'전화',note:'통화 완료 · 예산 미확정',at:at(5),occurred_at:at(5),actor:'이필선',meaningful:true}]}),
    /* 하루 마감: 미완료 약속(어제 기한) · 내일 이어갈 일 · 오늘 완료 */
    deal('prom1','[경기 화성] 동탄푸른마을',{activities:[{id:'p1',type:'전화',note:'통화 완료 · 수정 견적 요청',at:at(3),occurred_at:at(3),actor:'이필선',meaningful:true}],last_activity_at:at(3),next_action:{id:'np',type:'후속접촉',text:'수정 견적서 발송',due:day(-1),status:'open'}}),
    deal('tom1','[충남 천안] 천안두정E편한세상2차',{code:'rapport',stage_code:'rapport',activities:[{id:'t1',type:'전화',note:'통화 완료 · 공사 시기 논의',at:at(2),occurred_at:at(2),actor:'이필선',meaningful:true}],last_activity_at:at(2),next_action:{id:'nt',type:'전화',text:'공사 시기 확인',due:nextWd,status:'open'}}),
    deal('done1','[경기 고양] 햇빛마을23단지',{code:'rapport',stage_code:'rapport',activities:[{id:'d1',type:'전화',note:'통화 완료 · 제안서 공유 확인',at:new Date().toISOString(),occurred_at:new Date().toISOString(),actor:'이필선',meaningful:true}],last_activity_at:new Date().toISOString(),next_action:{id:'nd',type:'전화',text:'결과 확인',due:day(9),status:'open'}})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[]};
   try{localStorage.removeItem('crm.dz.assignSeen.v1');}catch(e){}
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.todayV3Off=false;G.dayZones=null;G.workReq=null;G.rowInlineKeep=true;G.dayExtraOff=false;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__open=[];TodayWorkQueue.open=(k,a)=>{__open.push([k,a||'']);};window.__drw=[];drwDeal=s=>{__drw.push(JSON.parse(s).id);};
   SB={rpc:async(n)=>{if(n==='crm_work_request_list_v1')return {data:{ok:true,requests:[]}};if(n==='crm_deal_unit_list_v1')return {data:{ok:true,contract:1,units:[],events:[]}};if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};return {data:{ok:true,tasks:[],entries:[],sites:[],rows:[],events:[],comments:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   /* 저장 흉내: 기존 저장 길 세 가지(응대 기록 · 다음 할 일 · 메모)만 불린다 — 불린 내용을 적어 두고 화면 자료에도 반영 */
   window.__memo=[];window.__next=[];window.__rec=[];window.__fail=0;
   const push=(d,a)=>{d.activities=Array.isArray(d.activities)?d.activities:[];d.activities.unshift(a);};
   DealDetailV3.memo=async(d,note)=>{if(window.__fail>0){window.__fail--;throw Error('서버 연결 실패');}__memo.push([d.id,note]);push(d,{id:'m'+__memo.length,type:'메모',note,at:new Date().toISOString(),occurred_at:new Date().toISOString(),actor:'이필선'});};
   DealDetailV3.next=async(d,o)=>{__next.push([d.id,o.type,o.text,o.due]);const obj={id:'nx'+__next.length,type:o.type,text:o.text,due:o.due,due_at:o.due,status:'open'},pd=itemPatch(d,'deal');d.next_action=obj;d.nextActionObj=pd.nextActionObj=obj;d.nextAction=pd.nextAction=o.due;d.nextActionText=pd.nextActionText=o.text;/* 실제 저장(setNext)과 같은 자리에 반영 */};
   DealDetailV3.record=async(d,o)=>{__rec.push([d.id,o.ch,o.res,String(o.at).slice(0,10),o.memo]);push(d,{id:'r'+__rec.length,type:o.ch,note:'통화 완료 · '+o.res+' — '+o.memo,at:o.at,occurred_at:o.at,actor:'이필선',meaningful:true});};
   goPage('today');
  });
  await page.waitForSelector('#today-v2 .tv3 .dz');await page.waitForTimeout(900);
  const V=page.locator('#today-v2 .tv3'),D=await page.evaluate(()=>({t:__day(0),y:__day(-1),d2:__day(2),d5:__day(5),nw:__nextWd})),md=k=>{const m=/^(\d+)-(\d+)-(\d+)$/.exec(k);return (+m[2])+'.'+(+m[3]);};
  const strip=()=>V.locator('.dx-rs button').evaluateAll(l=>l.map(b=>b.textContent.replace(/\s+/g,' ').trim()));
  const rows=()=>V.locator('.dz-table .dz-row').evaluateAll(l=>l.map(r=>({site:r.querySelector('.c1>b').textContent,why:r.querySelector('.dz-why').textContent,btn:(r.querySelector(':scope>button')||{}).textContent||''})));
  const rowOf=t=>V.locator('.dz-table .dz-row',{hasText:t}),chk=()=>V.locator('.dz-chk');
  const clip=sel=>V.evaluate((v,sel)=>[...v.querySelectorAll(sel+' *')].filter(n=>n.children.length===0&&n.scrollWidth>n.clientWidth+1&&getComputedStyle(n).textOverflow!=='ellipsis'&&getComputedStyle(n).whiteSpace==='nowrap').map(n=>n.textContent),sel);

  /* 1. 기록 상태 4가지: 기록 없는 3건 = 활동 확인 필요 · 기록 있는 정체 1건만 '실제 정체' */
  assert.deepEqual(await strip(),['활동 확인 필요 3','회신 대기 1','무기한 대기 1','실제 정체 1']);
  assert.match(one(await V.locator('.dx-rs').innerText()),/지연 · 평가 = 실제 정체만$/);
  const r0=await rows();
  for(const s of ['동부산훼미리타운4차','강북이진캐스빌','한강반도유보라']){const r=r0.find(x=>x.site.includes(s)&&x.btn==='활동 확인');assert.ok(r,s+' 줄');assert.equal(r.why,'활동 여부 확인 필요','기록 없음 → 지연으로 단정하지 않는다');}
  const sr=r0.find(x=>x.site.includes('서울체육고'));assert.equal(sr.why,'진행 판단 필요');assert.equal(sr.btn,'전화','기록이 있는 건은 예전 그대로');

  /* 2. [활동 확인] → 상황 4가지 · 고르기 전에는 저장 버튼이 없다 */
  await rowOf('강북이진캐스빌').locator('[data-dz="chk"]').click();await page.waitForTimeout(250);
  assert.equal(await chk().count(),1);assert.deepEqual(await chk().locator('.dx-sits button b').allInnerTexts(),['담당이 통화했는데 기록을 안 했음','고객이 나중에 연락 달라고 함','담당도 진행 상황을 모름','이미 다른 영업건으로 진행 중']);
  assert.equal(await chk().locator('[data-dz="chksave"]').count(),0,'상황을 고른 뒤에만 저장');
  assert.deepEqual(await page.evaluate(()=>[__memo.length,__next.length,__rec.length,__open.length]),[0,0,0,0],'누른 것만으로 연락 요청 · 업무를 만들지 않는다');
  /* ② 고객이 나중에 연락 달라고 함 → 약속일 · 대기 사유 → 회신 대기 구역(단계는 그대로) */
  await chk().locator('[data-dz="chksit"][data-v="1"]').click();await page.waitForTimeout(150);
  await chk().locator('[data-dz="chksave"]').click();await page.waitForTimeout(150);assert.match(one(await chk().locator('em').innerText()),/약속일을 오늘 이후로/);
  await chk().locator('input[data-dx="due"]').fill(D.d5);await chk().locator('input[data-dx="why"]').fill('12월 입대의 후 연락 달라고 함');
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-check.png')});
  assert.deepEqual(await clip('.dz-chk'),[],'활동 확인 칸: 넘치는 글 없음');
  await chk().locator('[data-dz="chksave"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__next),[['norec2','전화','고객 회신 대기: 12월 입대의 후 연락 달라고 함',D.d5]]);
  assert.deepEqual(await page.evaluate(()=>__memo),[['norec2','[활동 확인] 고객이 나중에 연락 요청 · 확인일 '+md(D.d5)+' · 12월 입대의 후 연락 달라고 함']]);
  assert.equal(await chk().count(),0);assert.deepEqual(await strip(),['활동 확인 필요 2','회신 대기 2','무기한 대기 1','실제 정체 1'],'회신 대기로 옮겨지고 지연에서 빠진다');
  assert.equal(await page.evaluate(()=>B.deals.find(d=>d.id==='norec2').stage_code),'sent','단계는 바꾸지 않는다');
  /* ① 통화했는데 기록 안 함 → 그 날짜로 통화 결과 등록 · 기록이 생기면 '실제 정체' 판단으로 */
  await rowOf('한강반도유보라').locator('[data-dz="chk"]').click();await page.waitForTimeout(200);await chk().locator('[data-dz="chksit"][data-v="0"]').click();await page.waitForTimeout(120);
  await chk().locator('input[data-dx="date"]').fill(D.y);await chk().locator('[data-dz="chksave"]').click();await page.waitForTimeout(120);assert.match(one(await chk().locator('em').innerText()),/통화 결과를 골라 주세요/);
  await chk().locator('[data-dz="chkres"][data-v="연결됨"]').click();await page.waitForTimeout(100);
  await page.evaluate(()=>{window.__fail=1;});await chk().locator('[data-dz="chksave"]').click();await page.waitForTimeout(350);
  assert.match(one(await chk().locator('em').innerText()),/저장하지 못했습니다: 서버 연결 실패 — 다시 누르면 같은 요청을 확인합니다/);assert.equal(await page.evaluate(()=>__rec.length),1,'통화 결과는 저장됨');
  await chk().locator('[data-dz="chksave"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>__rec),[['norec3','전화','연결됨',D.y,'뒤늦게 등록(활동 확인)']],'다시 눌러도 통화 결과를 두 번 넣지 않는다');
  assert.equal(await page.evaluate(()=>__memo[__memo.length-1][1]),'[활동 확인] 통화했는데 미기록 → '+md(D.y)+' 통화 결과 등록 · 연결됨');
  /* ③ 담당도 모름 → 이때만 고객 연락 업무 */
  await rowOf('동부산훼미리타운4차').locator('[data-dz="chk"]').click();await page.waitForTimeout(200);await chk().locator('[data-dz="chksit"][data-v="2"]').click();await page.waitForTimeout(120);
  const due3=await chk().locator('input[data-dx="due"]').inputValue();await chk().locator('[data-dz="chkclose"]').click();await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>__next.length),1,'닫으면 아무것도 만들지 않는다');
  /* ④ 다른 영업건으로 진행 중 → 연결을 남기고 이 건은 상세에서 한 건씩 정리 */
  await rowOf('동부산훼미리타운4차').locator('[data-dz="chk"]').click();await page.waitForTimeout(200);await chk().locator('[data-dz="chksit"][data-v="3"]').click();await page.waitForTimeout(120);
  assert.equal(await chk().locator('[data-dz="chksib"]').count(),1,'같은 현장의 다른 영업건');
  await chk().locator('[data-dz="chksave"]').click();await page.waitForTimeout(120);assert.match(one(await chk().locator('em').innerText()),/진행 중인 영업건을 골라 주세요/);
  await chk().locator('[data-dz="chksib"]').click();await page.waitForTimeout(100);await chk().locator('[data-dz="chksave"]').click();await page.waitForTimeout(400);
  assert.match(await page.evaluate(()=>__memo[__memo.length-1].join('|')),/^norec1\|\[활동 확인\] 다른 영업건으로 진행 중 — .+ · 이 건 정리 검토$/);
  assert.deepEqual(await page.evaluate(()=>__drw),['norec1'],'정리는 상세에서 한 건씩(자동으로 닫지 않는다)');assert.equal(await page.evaluate(()=>B.deals.find(d=>d.id==='norec1').stage_code),'sent');
  assert.match(due3,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal((await strip())[0],'활동 확인 필요 0','확인한 건은 다시 묻지 않는다');

  /* 3. 기록 상태 줄 = 목록 거르기 */
  await V.locator('.dx-rs [data-v="stall"]').click();await page.waitForTimeout(300);
  const st=await rows();assert.ok(st.length>=1&&st.every(r=>r.why==='진행 판단 필요'),'실제 정체만: '+JSON.stringify(st));
  await V.locator('.dx-rs [data-v="nowait"]').click();await page.waitForTimeout(300);
  assert.deepEqual(await rows(),[{site:'[경기 고덕] 고덕아이파크',why:'무기한 대기',btn:'확인일 정하기'}]);
  assert.match(one(await V.locator('.dz-note').innerText()),/확인일을 정하면 회신 대기로 옮겨집니다/);
  await V.locator('.dx-rs [data-v="wait"]').click();await page.waitForTimeout(300);assert.equal(await V.locator('.dz-tabs [aria-selected="true"]').evaluate(b=>b.dataset.v),'wait','회신 대기 = 그 구역으로');
  await V.locator('.dz-tabs [data-v="now"]').click();await page.waitForTimeout(300);

  /* 4. 하루 마감 요약: 3칸 · 미완료 약속은 사유 + 다음 처리일이 있어야 마감 */
  await V.locator('[data-dz="close"]').click();await page.waitForTimeout(350);
  const cols=await V.locator('.dx-col').evaluateAll(l=>l.map(c=>[c.querySelector('header b').textContent,Number(c.querySelector('header b.n').textContent)]));
  assert.deepEqual(cols.map(c=>c[0]),['오늘 완료','미완료 약속','내일 이어갈 일']);assert.ok(cols[0][1]>=1,'오늘 완료(햇빛마을 통화 · 한강반도 등록)');assert.equal(cols[2][1],1,'내일 이어갈 일(천안두정)');
  const openN=cols[1][1];assert.ok(openN>=1,'미완료 약속(동탄 수정 견적)');
  assert.match(one(await V.locator('.dx-col').nth(0).innerText()),/햇빛마을23단지 · 통화 완료 · 제안서 공유 확인/);assert.match(one(await V.locator('.dx-col').nth(2).innerText()),/천안두정E편한세상2차 · 공사 시기 확인/);
  assert.equal(await V.locator('[data-dz="clcopy"]').isDisabled(),true,'사유 · 처리일 전에는 마감 불가');
  const po=V.locator('.dx-open',{hasText:'동탄푸른마을'});await po.locator('[data-dz="clsave"]').click();await page.waitForTimeout(150);assert.match(one(await po.locator('em').innerText()),/못 한 사유를 적어 주세요/);
  await po.locator('input[data-dx="cwhy"]').fill('견적팀 회신 대기');await po.locator('input[data-dx="cdue"]').fill(D.t);await po.locator('[data-dz="clsave"]').click();await page.waitForTimeout(150);assert.match(one(await V.locator('.dx-open',{hasText:'동탄푸른마을'}).locator('em').innerText()),/내일 이후로/);
  if(shot)await page.screenshot({path:shot.replace(/\.png$/,'-close.png')});
  assert.deepEqual(await clip('.dx-close'),[],'마감 요약: 넘치는 글 없음');
  const nb=await page.evaluate(()=>__next.length);
  await V.locator('.dx-open',{hasText:'동탄푸른마을'}).locator('input[data-dx="cdue"]').fill(D.d2);await V.locator('.dx-open',{hasText:'동탄푸른마을'}).locator('[data-dz="clsave"]').click();await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(n=>__next.slice(n),nb),[['prom1','후속접촉','수정 견적서 발송',D.d2]],'같은 업무를 새 처리일로');
  assert.equal(await page.evaluate(()=>__memo[__memo.length-1].join('|')),'prom1|[마감] 미완료 · 수정 견적서 발송 · 원래 '+md(D.y)+' → 다음 처리 '+md(D.d2)+' · 사유: 견적팀 회신 대기');
  /* 남은 미완료 약속이 있으면 같은 방식으로 처리한 뒤에만 복사 */
  for(let k=0;k<6;k++){const left=V.locator('.dx-open:not(.ok)');if(!(await left.count()))break;const x=left.first();await x.locator('input[data-dx="cwhy"]').fill('내일 오전 처리');await x.locator('input[data-dx="cdue"]').fill(D.d2);await x.locator('[data-dz="clsave"]').click();await page.waitForTimeout(350);}
  assert.equal(await V.locator('[data-dz="clcopy"]').isDisabled(),false,'모두 사유 · 처리일이 있으면 마감 가능');
  await V.locator('[data-dz="clcopy"]').click();await page.waitForTimeout(300);
  const txt=await V.locator('.dx-copy').inputValue();
  assert.match(txt,new RegExp('^\\[하루 마감 '+md(D.t).replace('.','\\.')+' · 이필선\\]\\n오늘 완료 \\d+건: '));assert.match(txt,/\n미완료 약속 \d+건/);assert.match(txt,/\n내일 이어갈 일 \d+건/);assert.match(txt,/동탄푸른마을 수정 견적서 발송 · 사유: 견적팀 회신 대기 → /,'요약에 사유 · 다음 처리일');
  await V.locator('[data-dz="clback"]').click();await page.waitForTimeout(300);assert.equal(await V.locator('.dz-table').count(),1,'목록으로');

  /* 5. 끄기: 예전 4구역 그대로 */
  await page.evaluate(()=>{G.dayExtraOff=true;const d=B.deals.find(x=>x.id==='norec1');d.activities=[];TodayV2.render();});await page.waitForTimeout(400);
  assert.equal(await V.locator('.dx-bar').count(),0);assert.equal((await rows()).some(r=>r.btn==='활동 확인'),false);
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log('verify-day-extra: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
