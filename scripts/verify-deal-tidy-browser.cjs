'use strict';
/* 영업건 상세 정돈안 (2026-10-06 design_handoff_deal_detail_tidy · 시안 '영업건 상세 정돈안.dc.html') — 합성 자료(이름 · 번호 · 금액은 지어낸 것)
   확인: 머리 한 줄(브랜드 = 색 띠 + 글자 · '단계 · n일째' 꼬리표 · 기존 고객 알약 · [단계 바꾸기 ▾] [···] [×]) / 왼쪽 연락처 세 줄 · 이 단지 영업 이력(수주 완료 줄 · 줄 = 시기 · 상태 · 금액)
        / 가운데 입력칸이 맨 위 · 이력 줄을 누르면 가운데 칸만 그 영업건 요약([‹ 지금 건으로] · [이 건 전체 열기 ↗]) — 머리 · 왼쪽 · 오른쪽은 지금 건 그대로
        / 오른쪽 지금 할 일 = 행동 + 근거 · [전화하고 결과 남기기] = 가운데 입력칸(AI 가 꺼져 있으면 결과 · 다음 행동일을 그 자리에서) · 필수 정보 'n / m [채우기 ▾]'
        / 노트북 폭(920px)에서 세 칸 순서 · 글자가 세로로 쪼개지지 않음 / 끄기 G.dealTidyOff */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.SiteHistory&&window.DealTransfer&&window.DealKeyman&&window.DealPanelsV2&&window.OpsStore&&window.ListPager);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();
   const S='aaaaaaaa-0000-4000-8000-000000000001';window.DAY=day;
   B={deals:[
    {id:'11111111-1111-4111-8111-111111111111',site:'[경기 용인] 가람마을아파트',site_id:S,assignee:'황윤선',brand:'석민이앤씨',created:day(-34),code:'first_contact',stage_code:'first_contact',grp:'영업·관리',amt:0,manager_name:'이영수',manager_mobile:'01000001234',
     contacts:[{person_key:'mobile:01000001234',name:'이영수',role:'관리소장',mobile:'01000001234',status:'current'}],activities:[],stage_contexts:{}},
    {id:'22222222-2222-4222-8222-222222222222',site:'[경기 용인] 가람마을아파트',site_id:S,assignee:'황윤선',brand:'석민이앤씨',created:day(-400),updated:day(-380),code:'won',stage_code:'won',outcome:'won',won_amount:92e6,closed_at:day(-380),contract_date:day(-380),grp:'영업·관리',amt:92e6,
     activities:Array.from({length:23},(_,i)=>({id:'w'+i,type:'전화',note:'지난 통화 '+(i+1),at:at(-381-i),actor:'황윤선'}))},
    {id:'33333333-3333-4333-8333-333333333333',site:'[경기 용인] 가람마을아파트',site_id:S,assignee:'황윤선',brand:'석민이앤씨',created:day(-540),code:'lead',stage_code:'lead',grp:'영업·관리',amt:92e6,activities:[]},
    {id:'44444444-4444-4444-8444-444444444444',site:'[경기 용인] 혼자인단지',assignee:'이필선',brand:'POUR솔루션',created:day(-10),code:'first_contact',stage_code:'first_contact',grp:'영업·관리',amt:5e7,manager_name:'박소장',manager_mobile:'01000005678',contacts:[],activities:[],next_action:{id:'n1',text:'1차 미팅',due:day(3),status:'open'}}],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__ops=[];window.queueDetailContactOperation=(op,payload,actionId)=>{const id='op-'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:'done',payload:o.payload,ack:{ok:true,operation:o.op,activity_id:'srv-'+o.id,next_action_id:'srv-'+o.id}}));
   SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[]}})};TOKEN='test';OpsStore.aiOn=()=>false;
   drwDeal(JSON.stringify(B.deals[0]));
  });
  await page.waitForSelector('#detailView.ddv.dv3.dvt .sth-tidy');await page.waitForTimeout(500);
  const v=page.locator('#detailView.dv3.dvt');
  /* ① 머리: 한 줄 — 브랜드는 색 띠 + 글자(채운 칩 아님) · 단계 + 체류일 꼬리표 하나 · 기존 고객 알약 · 사유 문장은 머리에 없다 */
  const ym=await page.evaluate(()=>{const m=/^(\d{4})-(\d{2})/.exec(DAY(-380));return m[1]+'.'+Number(m[2]);});
  const head=await page.evaluate(()=>{const v=document.getElementById('detailView'),bc=v.querySelector('.ddv-chips .idv-brand'),cs=getComputedStyle(bc),bar=getComputedStyle(v.querySelector('.detailtopin'),'::before');
   return {brand:[bc.textContent.trim(),cs.backgroundColor,cs.color,bar.width,bar.backgroundColor],badge:v.querySelector('.dv3-stagebadge').textContent,tx:v.querySelector('.dv3-subrow .tx').textContent,won:v.querySelector('.dvt-won').textContent,
    over:[...v.querySelectorAll('.dv3-subrow .over')].map(n=>getComputedStyle(n).display),fav:getComputedStyle(v.querySelector('.exec-favorite')).display,btn:[...v.querySelectorAll('.dv3-headact button')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()),
    rowY:[...v.querySelectorAll('#dv-title,.dv3-stagebadge,.dv3-subrow .tx,.dvt-won,.dv3-headact .mv,.backbtn')].map(n=>{const r=n.getBoundingClientRect();return Math.round(r.top+r.height/2);})};});
  assert.deepEqual(head.brand,['석민이앤씨','rgba(0, 0, 0, 0)','rgb(232, 89, 12)','3px','rgb(232, 89, 12)'],'브랜드 = 색 띠 + 글자');
  assert.deepEqual([head.badge,head.tx,head.won,head.over,head.fav,head.btn],['컨설팅 설계 · 34일째','담당 황윤선 · 예상 금액 미정','✓ 기존 고객 · '+ym+' 수주 완료',['none'],'none',['단계 바꾸기 ▾','···']]);
  assert.ok(Math.max(...head.rowY)-Math.min(...head.rowY)<=16,'머리 글자 · 버튼이 한 줄에 있다 '+JSON.stringify(head.rowY));
  /* [···] 메뉴: 즐겨찾기 · 소장이 바뀌었어요 · 담당자 변경 · … · 실주 처리 */
  await v.locator('.tf-more').click();await page.waitForTimeout(150);
  assert.deepEqual((await v.locator('.tf-menu button').allInnerTexts()).filter(t=>!/타사 이관|승인 요청/.test(t)),['☆ 즐겨찾기','소장이 바뀌었어요','담당자 변경','보류','실주 처리']);
  await v.locator('.tf-menu [data-tf="m-repl"]').click();await page.waitForSelector('#detailView .dv3-mgr .dv3-repl');
  assert.match(one(await v.locator('.dv3-repl').innerText()),/^새 관리소장 등록 취소 이영수 소장님은 지우지 않고 이전 소장으로 남깁니다/);
  await v.locator('[data-dv3="replcancel"]').click();await page.waitForTimeout(150);
  /* ② 왼쪽: 연락처 세 줄(이름 · 역할 · 수정 / 번호 + 작은 전화 · 문자 / 동의 · 결정권자 회색 한 줄) — 큰 버튼 · 칩 없음 */
  assert.deepEqual([one(await v.locator('.dvt-c1').innerText()),one(await v.locator('.dvt-c2').innerText()),one(await v.locator('.dvt-c3').innerText()),await v.locator('.dv3-acts,.dv3-chips,.dv3-av').count()],
   ['이영수 관리소장 수정','010-0000-1234 전화 문자','문자 · 카카오 수신 동의 안 받음 · 결정권자 미확인',0]);
  await v.locator('.dvt-c3 [data-dv3="cons"]').click();await page.waitForTimeout(150);
  assert.equal(one(await v.locator('.dvt-c3').innerText()),'문자 · 카카오 수신 동의 안 받음 · 결정권자 확인됨','결정권자 문장을 누르면 바뀐다');
  /* 이 단지 영업 이력: 제목 + 요약 · 수주 완료 줄 · 줄 = 시기 · 상태 · 금액 + 설명 · 지금 건 줄에 표시 */
  assert.deepEqual([one(await v.locator('.sth-hd').innerText()),one(await v.locator('.sth-won b').innerText()),(await v.locator('.sth-row .sth-t1').allInnerTexts()).map(one).map(s=>s.replace(/^\d{4}\.\d{1,2} /,'')),await v.locator('.sth-row').evaluateAll(l=>l.map(n=>n.classList.contains('on')))],
   ['이 단지 영업 이력 3건 · 누적 수주 9,200만','✓ '+ym+' 수주 완료 · 9,200만',['문의 지금 이 건 금액 미정','계약 수주 완료 9,200만','문의 과거 이관 9,200만'],[true,false,false]]);
  assert.match(one(await v.locator('.sth-row.cur .sth-t2').innerText()),/다음 할 일 없음 · 공종 미정/);
  assert.equal(one(await v.locator('.sth-ai').innerText()).replace(/^AI\s*/,''),ym.slice(0,4)+'년 수주한 기존 고객입니다. 지난 공사 뒤 문제 없었는지부터 물어보세요.');
  /* ③ 가운데: 입력칸이 맨 위 → 응대 이력 · 빈 기록은 한 줄 */
  const mid=await page.evaluate(()=>{const v=document.getElementById('detailView'),y=s=>Math.round(v.querySelector(s).getBoundingClientRect().top);return [y('#ddvComposer')<y('.ddv-talk>.idv-chead'),y('.ddv-talk>.idv-chead')<y('.idv-thread'),[...v.querySelectorAll('#ddvComposer [role=tab],#ddvComposer .ce-open')].map(b=>b.textContent.trim()),v.querySelector('.ddv-nothing').textContent,Math.round(v.querySelector('.ddv-nothing').getBoundingClientRect().height)<30,v.querySelector('.dv3-cfoot>span').textContent];});
  assert.deepEqual(mid,[true,true,['응대 기록','내부 메모','변화 기록'],'아직 없습니다. 위에 첫 연락 결과를 적으면 여기 쌓입니다.',true,'부재는 연락 시도로만 셈']);
  /* ④ 오른쪽: 지금 할 일 = 상자 없이 행동 + 근거 한 줄 · 필수 정보 'n / m [채우기 ▾]' */
  const right=await page.evaluate(()=>{const v=document.getElementById('detailView'),n=v.querySelector('#nowCard'),cs=getComputedStyle(n);return [cs.borderTopWidth,n.querySelector('.nc-stage').textContent,n.querySelector('.dv3-title b').textContent,n.querySelector('.dv3-title span').textContent,n.querySelector('.nc-call').textContent,n.querySelector('.dv3-sub').textContent,n.querySelectorAll('.dv3-reco').length];});
  assert.deepEqual(right.slice(0,2).concat(right.slice(4)),['0px','지금 할 일','전화하고 결과 남기기','연락 없이 다음 일만 정하기',0]);
  assert.match(right[3],/^컨설팅 설계 34일째 · /,'근거 한 줄 = 단계 · 체류일 · 사유');assert.ok(right[2]&&right[2]!==right[3].replace(/^컨설팅 설계 34일째 · /,''),'제목은 사유가 아니라 할 일');
  assert.deepEqual([one(await v.locator('.da-stage-summary>h3').innerText()),await v.locator('.da-stage-summary .dv3-row').count(),one(await v.locator('.dvt-reqlist').innerText()).split(' · ').slice(0,2)],['이 단계 필수 정보 0 / 5 채우기 ▾',0,['공종','예상 금액']]);
  await v.locator('[data-dv3="reqtoggle"]').click();await page.waitForTimeout(150);
  assert.deepEqual([one(await v.locator('.da-stage-summary>h3').innerText()),await v.locator('.da-stage-summary .dv3-row').count(),await v.locator('.dvt-reqlist').count()],['이 단계 필수 정보 0 / 5 접기 ▴',5,0],'펼치면 그 자리에서 입력');
  await v.locator('[data-dv3="reqtoggle"]').click();await page.waitForTimeout(150);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'deal-tidy.png')});
  /* ⑤ 이력 줄을 누르면: 가운데 칸만 그 영업건 요약 — 머리 · 왼쪽 · 오른쪽 · 지금 보는 영업건은 그대로 */
  await v.locator('.sth-row.past').first().click();await page.waitForSelector('#detailView .dw-center.dvt-peeking .dvt-peek');
  const pk=await page.evaluate(()=>{const v=document.getElementById('detailView'),p=v.querySelector('.dvt-peek');return {cur:CUR_DETAIL.item.id,title:v.querySelector('#dv-title').textContent.trim(),talk:getComputedStyle(v.querySelector('.ddv-talk')).display,now:v.querySelector('#nowCard .dv3-title b').textContent,
   on:[...v.querySelectorAll('.sth-row')].map(n=>n.classList.contains('on')),bar:p.querySelector('.dvt-pbar').innerText.replace(/\s+/g,' ').trim(),hd:p.querySelector('.dvt-phd em').textContent,facts:[...p.querySelectorAll('.dvt-pfacts>div')].map(n=>n.innerText.replace(/\s+/g,' ').trim()),
   miss:p.querySelectorAll('.dvt-pmiss>div span').length>0,tip:p.querySelector('.dvt-ptip').textContent,log:[p.querySelector('.dvt-plog .hd').innerText.replace(/\s+/g,' ').trim(),p.querySelectorAll('.dvt-plog .lg').length,(p.querySelector('.dvt-plog .lpg-info')||{}).textContent||''],foot:[...p.querySelectorAll('.dvt-pfoot button')].map(b=>b.textContent.trim())};});
  assert.deepEqual([pk.cur,pk.title,pk.talk,pk.now,pk.on],['11111111-1111-4111-8111-111111111111','[경기 용인] 가람마을아파트','none',right[2],[false,true,false]],'창 전체가 바뀌지 않는다');
  assert.deepEqual([pk.bar,pk.hd,pk.facts,pk.miss,pk.foot],['‹ 지금 건으로 같은 단지 다른 영업건을 보는 중 · 오른쪽 할 일은 지금 건 그대로','수주 완료',['영업 경로 석민이앤씨','담당 황윤선','결과 수주','수주 금액 9,200만'],true,['이 건 전체 열기 ↗']]);
  assert.match(pk.tip,/^AI지난 공사 뒤 문제 없었는지부터 물어보세요\./);
  assert.deepEqual(pk.log,['이 건 응대 이력 23건',20,'1–20 / 23건'],'그 건의 응대 이력은 한 쪽 20건');
  await v.locator('.dvt-plog .lpg-b[data-page="2"]:not(.lpg-arrow)').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#detailView .dvt-plog .lg').length,!!document.querySelector('#detailView .dvt-peek')]),[3,true],'2쪽 = 나머지 3건');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'deal-tidy-peek.png')});
  /* 다른 줄 → 그 건으로 바뀜(금액이 같은 수주 건이 있으면 그 사실을 알린다) · [‹ 지금 건으로] → 돌아옴 */
  await v.locator('.sth-row.past').nth(1).click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>{const p=document.querySelector('#detailView .dvt-peek');return [p.querySelector('.dvt-phd em').textContent,/수주 건과 금액\(9,200만\)이 같습니다\. 같은 공사의 이전 기록일 가능성이 높습니다/.test(p.querySelector('.dvt-ptip').textContent),p.querySelectorAll('.dvt-plog .lg').length,p.querySelector('.dvt-plog .none').textContent];}),['과거 이관 · 분류 전',true,0,'기록이 남아 있지 않습니다']);
  await v.locator('[data-dv3="peekback"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView');return [v.querySelectorAll('.dvt-peek').length,getComputedStyle(v.querySelector('.ddv-talk')).display,[...v.querySelectorAll('.sth-row')].map(n=>n.classList.contains('on'))];}),[0,'flex',[true,false,false]]);
  /* [이 건 전체 열기 ↗]만 창 전체를 그 건으로 바꾼다 */
  await v.locator('.sth-row.past').first().click();await page.waitForSelector('#detailView .dvt-peek');await v.locator('[data-dv3="peekopen"]').click();await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.id),'22222222-2222-4222-8222-222222222222');
  await page.evaluate(()=>{closeDetail();drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.dvt .sth-tidy');await page.waitForTimeout(400);
  assert.equal(await page.locator('#detailView .dvt-peek').count(),0,'다시 열면 지금 건 그대로');
  /* ⑥ [전화하고 결과 남기기] = 가운데 입력칸으로(파란 테두리 · 통화 중 표시). AI 가 꺼져 있으면 결과 · 다음 행동일을 그 자리에서 고르고, 기존 연락 기록 경로로 저장한다 */
  await v.locator('#nowCard .nc-call').click();await page.waitForSelector('#detailView #ddvComposer.dvt-calling .dvt-res');await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView'),ta=v.querySelector('#ddvComposer textarea');return [v.querySelector('#nowCard .nc-call').textContent,document.activeElement===ta,getComputedStyle(ta).borderTopColor,ta.placeholder.slice(0,11),v.querySelectorAll('.dv3-form').length,[...v.querySelectorAll('.dvt-res .r>span')].map(n=>n.textContent)];}),
   ['통화 중 · 결과를 가운데에 적어 주세요',true,'rgb(59, 108, 228)','통화 결과를 한 줄로',0,['수단','결과']]);
  await v.locator('#ddvComposer .idv-save').click();await page.waitForTimeout(200);
  assert.deepEqual([one(await v.locator('.dvt-res .dv3-recerr').innerText()),await page.evaluate(()=>__ops.length)],['연락 수단과 결과를 골라 주세요.',0],'결과를 고르기 전에는 저장하지 않는다');
  await v.locator('#ddvComposer textarea').fill('소장 통화 — 12월 입대의 뒤 결정');await v.locator('.dvt-res [data-dv3="rres"][data-v="연결됨"]').click();await page.waitForTimeout(150);
  assert.match(one(await v.locator('.dvt-res').innerText()),/다음 행동 다시 연락 · \d{4}\.\d{1,2}\.\d{1,2}\(.\) 내일 3일 후 7일 후/);
  assert.equal(await v.locator('#ddvComposer textarea').inputValue(),'소장 통화 — 12월 입대의 뒤 결정','고르는 동안 적은 글이 지워지지 않는다');
  await v.locator('#ddvComposer .idv-save').click();await page.waitForFunction(()=>__ops.length>=2);await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>[__ops.map(o=>o.op),__ops[0].payload.note,__ops[1].payload.text,document.querySelectorAll('#detailView .dvt-calling,#detailView .dvt-res').length,document.querySelector('#detailView #nowCard .nc-call').textContent,document.querySelector('#detailView #nowCard .nc-stage').textContent]),
   [['activity','next_action'],'통화 완료 · 연결됨 — 소장 통화 — 12월 입대의 뒤 결정','다시 연락',0,'전화하고 결과 남기기','다음 할 일'],'기록 + 다음 할 일이 같이 저장되고, 오른쪽이 다음 할 일로 바뀐다');
  assert.match(await v.locator('#nowCard .dv3-title b').innerText(),/^다시 연락 · \d{4}\.\d{1,2}\.\d{1,2}\(.\)$/);
  /* 목록의 [미팅 잡기] 류(openFrom)도 같은 입력칸으로 */
  assert.deepEqual(await page.evaluate(()=>[DealDetailV3.openFrom('next'),document.querySelectorAll('#detailView #ddvComposer.dvt-calling').length,document.querySelectorAll('#detailAction,.dp-next,#detailView .dv3-form').length]),[true,1,0]);
  await v.locator('#nowCard .nc-call').click();await page.waitForTimeout(150);
  /* ⑦ 같은 단지 수주가 없으면 알약 · 수주 완료 줄이 없다 · 등록된 다음 할 일이 있으면 '다음 할 일' */
  await page.evaluate(()=>{closeDetail();drwDeal(JSON.stringify(B.deals[3]));});await page.waitForSelector('#detailView.dvt .sth-tidy');await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView');return [v.querySelectorAll('.dvt-won,.sth-won').length,v.querySelector('.sth-hd').innerText.replace(/\s+/g,' ').trim(),getComputedStyle(v.querySelector('.ddv-chips .idv-brand')).color];}),[0,'이 단지 영업 이력 1건','rgb(31, 157, 85)']);
  /* ⑧ 노트북 폭(920px): 세 칸 순서 그대로 · 좁아도 글자가 세로로 쪼개지지 않는다(한 줄 높이) */
  await page.evaluate(()=>{closeDetail();});await page.setViewportSize({width:920,height:760});await page.evaluate(()=>drwDeal(JSON.stringify(B.deals[0])));await page.waitForSelector('#detailView.dvt .sth-tidy');await page.waitForTimeout(500);
  const nar=await page.evaluate(()=>{const v=document.getElementById('detailView'),x=s=>Math.round(v.querySelector(s).getBoundingClientRect().left),w=s=>Math.round(v.querySelector(s).getBoundingClientRect().width),hh=s=>[...v.querySelectorAll(s)].map(n=>Math.round(n.getBoundingClientRect().height));
   return {order:x('.dw-left')<x('.dw-center')&&x('.dw-center')<x('.dw-right'),w:[w('.dw-left')>=258,w('.dw-center')>=358,w('.dw-right')>=218],
    one:Math.max(...hh('.dv3-tel,.dvt-cbtn button,.sth-hd>b,.sth-t1>b,.sth-t1>em,.sth-t1>.amt,#ddvComposer [role=tab],#ddvComposer .ce-open,#ddvComposer .idv-save,.ddv-talk>.idv-chead>b,.dv3-stagebadge,.dvt-won,.dv3-headact .mv,.da-stage-summary>h3>button,.dvt-cnt')),over:v.scrollWidth<=v.clientWidth+1};});
  assert.deepEqual([nar.order,nar.w,nar.over],[true,[true,true,true],true],'세 칸: 왼쪽 → 가운데 → 오른쪽');assert.ok(nar.one<=40,'한 줄로 있어야 할 글자가 줄바꿈되지 않는다(가장 높은 것 '+nar.one+'px)');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'deal-tidy-920.png')});
  /* ⑨ 끄기: G.dealTidyOff → 정돈안 이전 배치 */
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(()=>{closeDetail();G.dealTidyOff=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.dv3 .sth');await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView');return [v.classList.contains('dvt'),v.querySelectorAll('.dvt-c1,.sth-tidy,.dvt-won,.dvt-cnt').length,v.querySelectorAll('.dv3-acts').length,v.querySelector('.tf-more').textContent,v.querySelector('#nowCard .nc-call').textContent];}),[false,0,1,'··· 기타 처리','연락하고 결과 남기기']);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('deal tidy ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
