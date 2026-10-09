'use strict';
/* 관계관리 v12 검사(2026-10-07 design_handoff_relationship_v12 · 시안 '관계관리 v12.dc.html') — 합성 자료(현장 이름은 지어낸 것)
   확인: 상태 6칸(전체 + 집중 · 일반 · 대기 · 보류 · 미확인) · 칸마다 기준 한 줄 + 근거 · 업무 필터 3개(다음 연락일 지남 · 이번 주 연락 · 다음 행동 미등록)는 상태와 함께 걸림
        / 목록 줄은 v11 4칸 그대로 + 상태 꼬리표 · 기준일 · 상태 주기로 정한 기한 / 왼쪽 전환 검토 요청 3줄(자동 전환 없음) · 기존 n건 재분류 진행률
        / [분류하기] · [전환 검토] = 분류 창(사유 · 다음 확인일 · 재검토일 · 공사 예정 연도) → 표식 '[관계 상태] …' 메모 + 다음 할 일 / 끄기 G.relV12Off → 예전 탭 3개 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineStageV3&&window.RelV12&&window.PipelineRowV11&&window.PipelineWorkspace&&window.DealDetailV3&&window.CRMRules);
  await page.evaluate(()=>{
   const KST=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
   const day=n=>KST.format(new Date(Date.now()+n*864e5)),at=n=>new Date(Date.now()+n*864e5).toISOString();window.DAY=day;
   const deal=(id,site,code,o)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-200),stage_entered_at:at(-60),code,stage_code:code,grp:'영업·관리',amt:1e8,manager_name:'관리소장',manager_mobile:'01000001111',contacts:[],activities:[],stage_contexts:{}},o||{});
   const mark=(t,n)=>({id:'m'+Math.random().toString(36).slice(2,7),type:'메모',note:t,at:at(n),occurred_at:at(n)});
   B={deals:[
    /* 집중: 견적 10일 전 · 마지막 연락 4일 전 · 다음 행동 없음 → 기한 = 마지막 연락 + 7일 */
    deal('f-new','집중 새 현장','rapport',{stage_contexts:{sent:{fields:{sent_date:day(-10)}}},last_meaningful_contact_at:at(-4)}),
    /* 집중: 마지막 연락 12일 전 → 7일 주기 5일 지남 */
    deal('f-over','집중 연락 지난 현장','rapport',{stage_contexts:{sent:{fields:{sent_date:day(-20)}}},last_meaningful_contact_at:at(-12)}),
    /* 집중(담당이 분류) · 견적 40일 → 1개월 지남 → 일반관리 검토(자동 전환 없음) · 약속 연락일 2일 지남 */
    deal('f-mark-rev','집중 분류 뒤 1개월 지난 현장','rapport',{stage_contexts:{sent:{fields:{sent_date:day(-40)}}},activities:[mark('[관계 상태] 집중관리 | 반응 좋음 | '+day(-2)+' | 없음 | 올해',-30)],next_action:{id:'n3',text:'결정 일정 확인',due:day(-2),status:'open'}}),
    /* 일반: 견적 130일 → 4개월 지남 → 고객 반응·추진 시기 재확인 · 마지막 연락 20일 전 → 월 1회 주기 10일 남음 */
    deal('n-rev','일반 4개월 지난 현장','silent',{stage_contexts:{sent:{fields:{sent_date:day(-130)}}},last_meaningful_contact_at:at(-20)}),
    /* 일반: 견적 50일 · 약속 연락일 = 오늘 */
    deal('wk-1','일반 오늘 약속 현장','silent',{stage_contexts:{sent:{fields:{sent_date:day(-50)}}},next_action:{id:'n5',text:'진행 확인 통화',due:day(0),status:'open'}}),
    /* 대기(담당이 분류 · 사유 · 다음 확인일 · 향후 연도) */
    deal('w-1','대기 현장','waiting',{activities:[mark('[관계 상태] 대기 | 2027 봄 공사 · 장기수선 반영 대기 | '+day(20)+' | 없음 | 향후 연도',-10)],next_action:{id:'n6',text:'대기 · 공사 시기 · 예산 확인',due:day(20),status:'open'}}),
    /* 보류 · 재검토일 어제 → 재검토일 도래 */
    deal('h-1','보류 현장','waiting',{activities:[mark('[관계 상태] 보류 | 입대의 교체 후 재논의 | '+day(5)+' | '+day(-1)+' | 미정',-15)]}),
    /* 미확인: 견적 발송일 · 표식 · 연락 기록 없음(이관 건) */
    deal('u-1','미확인 이관 현장','waiting',{created:day(-400)}),
    deal('c-1','다른 단계 현장','consulting')
   ],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.ps3=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.queueDetailContactOperation=()=>'op';SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[]}})};TOKEN='test';if(window.OpsStore)OpsStore.aiOn=()=>false;
   /* 저장 경로는 기존 그대로(DealDetailV3.memo · next) — 여기서는 무엇을 보냈는지만 받는다 */
   window.__memo=[];window.__next=[];
   window.__sf=[];DealDetailV3.stageFields=async(d,f)=>{__sf.push([d.id,f]);d.stage_contexts=Object.assign({},d.stage_contexts||{},{rapport:{fields:Object.assign({},((d.stage_contexts||{}).rapport||{}).fields,f),edited_at:new Date().toISOString()}});};
   DealDetailV3.memo=async(d,t)=>{__memo.push([d.id,t]);const at=new Date().toISOString();d.activities=d.activities||[];d.activities.unshift({id:'mm'+__memo.length,type:'메모',note:t,at,occurred_at:at});};
   DealDetailV3.next=async(d,o)=>{__next.push([d.id,o.type,o.text,o.due]);d.next_action={id:'nn'+__next.length,type:o.type,text:o.text,due:o.due,status:'open'};};
   PipelineWorkspace.open('relationship');
  });
  await page.waitForSelector('#pipeline-stage-v3 .prv-list .prv-row');await page.waitForTimeout(300);
  const V=page.locator('#pipeline-stage-v3'),L=V.locator('.prv-list');
  const W=await page.evaluate(()=>{const w=RelV12.week(),t=DAY(0),inWeek=k=>k>=w.mon&&k<=w.fri;return {today:t,wkToday:inWeek(t),wkPlus3:inWeek(DAY(3)),wkPlus10:inWeek(DAY(10))};});
  const dot=n=>page.evaluate(n=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(DAY(n));return m[1]+'.'+(+m[2])+'.'+(+m[3]);},n);
  /* ① 상태 6칸: 이름 · 기준 한 줄 · 근거(작은 글) · 건수. 전체 = 합. 미확인 숫자는 주황(amb) · 빨강 아님 */
  const tabs=await V.locator('.ps3-tab').evaluateAll(l=>l.map(t=>{const x=s=>{const n=t.querySelector(s);return n?n.textContent.replace(/\s+/g,' ').trim():'';};return [x('.l'),x('span'),x('small.src'),Number(x('.n')),t.querySelector('.n').classList.contains('amb'),t.querySelector('.n').classList.contains('r')];}));
  assert.deepEqual(tabs,[
   ['전체','이 단계 모든 현장','',8,false,false],
   ['집중관리','견적 후 1개월 · 7일 안 후속 통화','7일 = 회의 결정 · 1개월 = 잠정(설정)',3,false,true]/* 기한 지난 건이 있는 칸만 숫자 빨강 */,
   ['일반관리','집중 이후 ~ 발송일부터 3개월 · 최소 월 1회','월 1회 = 회의 결정 · 기간 = 해석 미확정(설정)',2,false,false],
   ['대기','향후 추진 가능 · 60일 1회','회의 기준 2개월 1회 · 현재 60일 환산은 미확정',1,false,false],
   ['보류','고객이 중단 사유를 밝힘 · 재검토일에 확인','주기 미확정 · 재검토일만',1,false,true],
   ['미확인 · 기준일 확인 필요','견적 발송일 · 반응 · 시기 모름','자동 분류 안 함 · 재분류 대상',1,true,false]],'상태 6칸 · 기준 · 근거 · 건수 · 빨강 = 기한 지난 건이 있는 칸 · 미확인은 주황');
  assert.equal(await V.locator('.ps3-tabs').getAttribute('data-n'),'6');
  assert.equal(await V.locator('.ps3-tab').evaluateAll(l=>Math.min(...l.map(t=>Math.round(t.getBoundingClientRect().width)))),await V.locator('.ps3-tab').evaluateAll(l=>Math.max(...l.map(t=>Math.round(t.getBoundingClientRect().width)))),'여섯 칸 같은 폭');
  /* ② 업무 필터 3개 · 건수(전체 탭 기준) · 안내 글 */
  const wkN=(W.wkToday?1:0)+(W.wkPlus3?1:0)+(W.wkPlus10?1:0);
  assert.deepEqual((await V.locator('.ps3-works button').allInnerTexts()).map(one),['다음 연락일 지남 3','이번 주 연락 '+wkN,'다음 행동 미등록 5'],'업무 필터 건수(이번 주는 오늘 요일에 따라)');
  assert.equal(one(await V.locator('.ps3-works>span').innerText()),'업무 필터 · 상태와 함께 걸림');assert.match(one(await V.locator('.ps3-works>small').innerText()),/대기 · 보류로 판정하지 않음/);
  /* ③ 왼쪽: 단계 진단 + 전환 검토 요청 3줄(자동 전환 없음) + 기존 8건 재분류(미확인 1건만 남음) */
  assert.deepEqual(await V.locator('.ps3-diag .ps3-box header b').allInnerTexts().then(l=>l.map(one)),['단계 진단','전환 검토 요청 3','기존 8건 재분류']);
  assert.deepEqual(await V.locator('.rv-rev').evaluateAll(l=>l.map(b=>[b.querySelector('span').textContent,b.querySelector('b').textContent,b.dataset.v])),[['집중 1개월 지남 → 일반관리 검토','1','toNormal'],['일반 3개월 지남 → 고객 반응·추진 시기 재확인','1','toWait'],['보류 재검토일 도래','1','holdDue']]);
  assert.equal(one(await V.locator('.rv-prog').innerText()),'분류 끝남 3 / 8');assert.match(one(await V.locator('.rv-box .rv-note').first().innerText()),/자동으로 바꾸지 않음/);
  assert.equal(await V.locator('.ps3-kpis .over b').innerText(),'3건','다음 연락일 지남 = 업무 필터와 같은 수');
  /* ④ 목록 줄: v11 4칸 그대로 + 상태 꼬리표(현장 아래) · 기준일(현재 상황 둘째 줄) · 상태 주기로 정한 기한 · 버튼 */
  const mdn=n=>page.evaluate(n=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(DAY(n));return (+m[2])+'.'+(+m[3]);},n);/* 줄 안 글은 짧게(2026-10-07 대표 "내용 넘어가는 것 하지 말아") — 기준일은 월.일 */
  const d10=await mdn(-10),d20=await mdn(-20),d40=await mdn(-40),d130=await mdn(-130),d50=await mdn(-50),dr=await mdn(-1);
  const rows=await L.locator('.prv-row').evaluateAll(l=>l.map(r=>{const t=s=>{const n=r.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};return [r.dataset.key.replace(/^deal:/,''),t('.prv-a>em.prv-tag'),r.querySelector('.prv-a>em.prv-tag').className.replace('prv-tag','').trim(),t('.prv-b>span'),t('.prv-b>small.base'),t('.prv-c>b'),t('.prv-c>small:first-of-type'),r.querySelector('.prv-c>small:first-of-type').className,t(':scope>button'),r.querySelector(':scope>button').dataset.v];}));
  if(process.env.DUMP)fs.writeFileSync(process.env.DUMP,JSON.stringify(rows,null,1));
  const byKey=Object.fromEntries(rows.map(r=>[r[0],r]));
  assert.deepEqual(byKey['f-new'],['f-new','집중관리 · 7일 후속','focus','마지막 연락 4일 전','견적 '+d10+' · 집중 D+10 · 분류 전','수신 · 반응 확인 통화','3일 남음 · 연락 + 7일','','다음 행동','next']);
  assert.deepEqual(byKey['f-over'],['f-over','집중관리 · 7일 후속','focus','마지막 연락 12일 전','견적 '+d20+' · 집중 D+20 · 분류 전','수신 · 반응 확인 통화','5일 지남 · 연락 + 7일','r','연락 기록','activity']);
  assert.deepEqual(byKey['f-mark-rev'].slice(0,6).concat(byKey['f-mark-rev'].slice(8)),['f-mark-rev','집중관리 · 7일 후속','focus','집중 1개월 지남 → 일반관리 검토','견적 '+d40+' · 집중 D+40','결정 일정 확인'/* 등록된 다음 할 일이 있으면 그것(v11 규칙) */,'전환 검토','classify'],'담당이 분류한 건은 기간이 지나도 자동 전환 없음 · 전환 검토만');
  assert.deepEqual(byKey['n-rev'],['n-rev','일반관리 · 월 1회','normal','고객 반응·추진 시기 재확인','견적 '+d130+' · 일반 4개월째 · 분류 전','전환 검토 · 사유 · 다음 확인일','10일 남음 · 연락 + 30일','','전환 검토','classify']);
  assert.deepEqual(byKey['wk-1'].slice(0,6),['wk-1','일반관리 · 월 1회','normal','CRM 연락 기록 없음','견적 '+d50+' · 일반 2개월째 · 분류 전','진행 확인 통화'],'약속 연락일이 있으면 그 날짜(기한은 판정 함수 글)');
  assert.deepEqual(byKey['w-1'].slice(0,6),['w-1','대기 · 60일 1회','wait','2027 봄 공사 · 장기수선 반영 대기',''+(await page.evaluate(()=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(DAY(-10));return (+m[2])+'.'+(+m[3]);}))+' 전환 · 향후 연도','대기 · 공사 시기 · 예산 확인']);
  assert.deepEqual(byKey['h-1'],['h-1','보류 · 재검토일','hold','보류 재검토일 도래 → 추진 여부','재검토 '+dr,'전환 검토 · 사유 · 다음 확인일','1일 지남 · 재검토일','r','전환 검토','classify']);
  assert.deepEqual(byKey['u-1'],['u-1','미확인 · 분류 필요','unk','CRM 연락 기록 없음','발송일 없음 · 기간 계산 안 함','상태 재분류','기한 없음 · 분류 후 정해짐','g','분류하기','classify']);
  assert.equal(rows.length,8);assert.deepEqual((await L.locator('.prv-head span').allInnerTexts()).map(one),['현장 · 담당','현재 상황','다음 업무 · 기한','']);
  /* 꼬리표 색: 집중 파랑 · 미확인 붉은 바탕 · 기준일 회색 */
  assert.deepEqual(await page.evaluate(()=>{const q=k=>document.querySelector('#pipeline-stage-v3 .prv-row[data-key$="'+k+'"]'),cs=(n,p)=>getComputedStyle(n)[p];return [cs(q('f-new').querySelector('.prv-tag'),'color'),cs(q('u-1').querySelector('.prv-tag'),'backgroundColor'),cs(q('f-new').querySelector('.prv-b>small.base'),'color'),cs(document.querySelector('#pipeline-stage-v3 .ps3-tab:last-child .n'),'color')];}),['rgb(29, 63, 153)','rgb(253, 236, 235)','rgb(156, 163, 175)','rgb(192, 57, 43)']);
  /* 2026-10-07 대표 "내용 넘어가는 것 하지 말아": 줄 안 글이 말줄임(…)으로 잘리지 않는다(1600 폭) */
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#pipeline-stage-v3 .prv-row *')].filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').map(e=>(e.className||e.tagName)+': '+e.textContent.trim().slice(0,40))),[],'관계관리 줄 안 글이 잘림');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'rel-v12.png'),fullPage:true});
  /* ⑤ 업무 필터는 상태와 함께 걸림: [다음 연락일 지남] → 3줄 · 다시 누르면 풀림 · [집중관리] + [다음 행동 미등록] → 2줄 */
  await V.locator('.ps3-works button[data-v="od"]').click();await page.waitForTimeout(200);
  assert.deepEqual([(await L.locator('.prv-row').evaluateAll(l=>l.map(r=>r.dataset.key.replace(/^deal:/,'')))).sort(),await V.locator('.ps3-works button[data-v="od"]').getAttribute('aria-pressed'),one(await V.locator('.ps3-lhead>b').innerText())],[['f-mark-rev','f-over','h-1'],'true','확인할 현장 3곳']);
  await V.locator('.ps3-works button[data-v="od"]').click();await page.waitForTimeout(200);assert.equal(await L.locator('.prv-row').count(),8,'다시 누르면 풀림');
  await V.locator('.ps3-tab').nth(1).click();await page.waitForTimeout(200);
  assert.deepEqual((await V.locator('.ps3-works button').allInnerTexts()).map(one),['다음 연락일 지남 2','이번 주 연락 '+((W.wkPlus3?1:0)),'다음 행동 미등록 2'],'업무 필터 건수는 고른 상태 안에서');
  await V.locator('.ps3-works button[data-v="nx"]').click();await page.waitForTimeout(200);
  assert.deepEqual((await L.locator('.prv-row').evaluateAll(l=>l.map(r=>r.dataset.key.replace(/^deal:/,'')))).sort(),['f-new','f-over'],'집중관리 + 다음 행동 미등록');
  await V.locator('.ps3-tab').first().click();await page.waitForTimeout(200);assert.equal(await L.locator('.prv-row').count(),5,'전체로 돌아가도 업무 필터는 남는다');
  await V.locator('.ps3-works button[data-v="nx"]').click();await page.waitForTimeout(200);assert.equal(await L.locator('.prv-row').count(),8);
  /* ⑥ 전환 검토 요청 줄 → 그 사유로 걸러짐(꼬리표 ×) */
  await V.locator('.rv-rev[data-v="toNormal"]').click();await page.waitForTimeout(200);
  assert.deepEqual([await L.locator('.prv-row').evaluateAll(l=>l.map(r=>r.dataset.key.replace(/^deal:/,''))),one(await V.locator('.ps3-chip').innerText()),await V.locator('.rv-rev[data-v="toNormal"]').getAttribute('aria-pressed')],[['f-mark-rev'],'집중 1개월 지남 → 일반관리 검토 ×','true']);
  await V.locator('.ps3-chip').click();await page.waitForTimeout(200);assert.equal(await L.locator('.prv-row').count(),8);
  /* ⑦ [분류하기] → 재분류 창(stage7_2): ① 발송일(날짜 / 모름) → ② 상태(발송일 모름이면 집중 · 일반 비활성 · 기본 '미확인 유지') → ③ 사유 → ④ 다음 확인일 · '지금 → 저장 후' 비교 */
  await L.locator('.prv-row[data-key$="u-1"]>button').click();await page.waitForSelector('#rv-dlg .rv-box2');
  assert.deepEqual(await page.evaluate(()=>{const b=document.querySelector('#rv-dlg .rv-box2');return [b.querySelector('header b').textContent,b.querySelector('header span').textContent,[...b.querySelectorAll('.rv-states [role=radio]')].map(x=>[x.querySelector('b').textContent,x.getAttribute('aria-checked'),x.getAttribute('aria-disabled')||'']),[...b.querySelectorAll('.rv-f>span')].map(x=>x.firstChild.textContent.trim()),!!b.querySelector('[data-rv-in="next"]'),!!b.querySelector('[data-rv-in="review"]'),!!b.querySelector('[data-rv-in="year"]'),b.querySelector('.rv-cmp').innerText.replace(/\s+/g,' ').trim()];}),
   ['재분류','미확인 이관 현장 · 기준일부터 확인',[['미확인 유지','true',''],['집중관리','false','true'],['일반관리','false','true'],['대기','false',''],['보류','false','']],['① 견적 발송일','② 상태','③ 사유','④ 다음 확인일'],true,false,false,'저장하면 업무가 이렇게 바뀝니다 지금 등록된 업무 없음 저장 후 변경 없음 다음 확인일을 넣으면 새 업무가 만들어집니다']);
  await page.locator('#rv-dlg [data-rv="state"][data-v="focus"]').click({force:true});await page.waitForTimeout(80);assert.equal(await page.locator('#rv-dlg .rv-states [aria-checked="true"] b').innerText(),'미확인 유지','발송일 모르면 집중 · 일반은 못 고름');
  const sentDay=await page.evaluate(()=>DAY(-10));await page.fill('#rv-dlg [data-rv-in="sent"]',sentDay);await page.locator('#rv-dlg [data-rv-in="sent"]').dispatchEvent('change');await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#rv-dlg .rv-states [role=radio]')].map(x=>[x.getAttribute('aria-checked'),x.getAttribute('aria-disabled')||''])),[['false',''],['true',''],['false',''],['false',''],['false','']],'발송일을 넣으면 집중(기본 자리)이 골라지고 집중 · 일반을 고를 수 있음');
  await page.locator('#rv-dlg [data-rv="unknown"]').click();await page.waitForTimeout(80);assert.deepEqual(await page.evaluate(()=>[document.querySelector('#rv-dlg [data-rv-in="sent"]').value,document.querySelector('#rv-dlg .rv-states [aria-checked="true"] b').textContent]),['','미확인 유지'],'모름 = 날짜 비움 · 미확인 유지');
  await page.fill('#rv-dlg [data-rv-in="sent"]',sentDay);await page.locator('#rv-dlg [data-rv-in="sent"]').dispatchEvent('change');await page.waitForTimeout(80);
  await page.locator('#rv-dlg [data-rv="state"][data-v="wait"]').click();await page.waitForTimeout(100);
  await page.locator('#rv-dlg [data-rv="save"]').click();await page.waitForTimeout(150);assert.equal(one(await page.locator('#rv-dlg .rv-err').innerText()),'사유를 적어 주세요.','대기는 사유 필수');
  await page.fill('#rv-dlg [data-rv-in="reason"]','2027 하반기 공사 · 예산 반영 뒤');await page.locator('#rv-dlg [data-rv="save"]').click();await page.waitForTimeout(150);assert.equal(one(await page.locator('#rv-dlg .rv-err').innerText()),'다음 확인일을 골라 주세요.','다음 확인일 필수');
  const nextDay=await page.evaluate(()=>DAY(30));await page.fill('#rv-dlg [data-rv-in="next"]',nextDay);await page.locator('#rv-dlg [data-rv-in="next"]').dispatchEvent('change');await page.waitForTimeout(100);
  assert.match(one(await page.locator('#rv-dlg .rv-cmp').innerText()),/지금 등록된 업무 없음 저장 후 공사 시기 · 예산 확인 · \d+\.\d+ 기존 업무가 없어 새로 만듦$/,'기존 업무가 없으면 새 업무 · 그렇다고 말해 줌');
  await page.locator('#rv-dlg [data-rv="save"]').click();await page.waitForSelector('#rv-dlg',{state:'detached'});await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>[__sf,__memo,__next]),[[['u-1',{sent_date:sentDay}]],[['u-1','[관계 상태] 대기 | 2027 하반기 공사 · 예산 반영 뒤 | '+nextDay+' | 없음 | 미정']],[['u-1','전화','공사 시기 · 예산 확인',nextDay]]],'발송일(단계 정보) + 표식 메모 + 다음 할 일(기존 저장 경로)');
  assert.deepEqual(await V.locator('.ps3-tab .n').allInnerTexts(),['8','3','2','2','1','0'],'미확인 → 대기로');assert.equal(one(await V.locator('.rv-prog').innerText()),'분류 끝남 4 / 8');
  assert.deepEqual((await L.locator('.prv-row[data-key$="u-1"]').evaluate(r=>[r.querySelector('.prv-tag').textContent,r.querySelector('.prv-b>span').textContent,r.querySelector(':scope>button').textContent])),['대기 · 60일 1회','2027 하반기 공사 · 예산 반영 뒤','연락 기록']);
  /* ⑧ [전환 검토](보류 재검토일 도래) → 창 머리 '전환 검토' · 지금 상태 보류가 골라져 있음 · 재검토일 칸 · Esc 로 닫힘. 자동으로 바뀐 것은 없다 */
  await L.locator('.prv-row[data-key$="h-1"]>button').click();await page.waitForSelector('#rv-dlg .rv-box2');
  assert.deepEqual(await page.evaluate(()=>{const b=document.querySelector('#rv-dlg .rv-box2');return [b.querySelector('header b').textContent,/기준일부터 확인 · 보류 재검토일 도래/.test(b.querySelector('header span').textContent),b.querySelector('.rv-states [aria-checked="true"] b').textContent,!!b.querySelector('[data-rv-in="review"]')];}),['전환 검토',true,'보류',true]);
  await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(await page.locator('#rv-dlg').count(),0);
  assert.deepEqual(await V.locator('.ps3-tab .n').allInnerTexts(),['8','3','2','2','1','0'],'창을 닫기만 하면 아무것도 바뀌지 않음');
  /* 근거 없이 약속으로 확정하지 않음. 새 업무·분류를 자동 저장하지 않음. */
  const evidence=await page.evaluate(()=>{
   const r={item:{activities:[],stage_contexts:{}},due:DAY(-37),next:{text:'재통화 시도',due:DAY(-37)},contactDays:null};
   const plain=RelV12.state(r),yes=RelV12.state({...r,next:{...r.next,type:'고객 약속'}}),prefix=RelV12.state({...r,next:{...r.next,text:'고객 약속: 방문'}});
   const dated=RelV12.state({...r,item:{activities:[],stage_contexts:{sent:{fields:{sent_date:DAY(-120)}}}}});
   return {plain:plain.now,due:plain.due,customer:plain.customerPromise,yes:yes.customerPromise,prefix:prefix.customerPromise,classified:dated.classified};
  });
  assert.match(evidence.plain,/기존 일정 37일 경과.*약속 여부/);assert.equal(evidence.customer,false);assert.equal(evidence.yes,true);assert.equal(evidence.prefix,true);assert.equal(evidence.classified,false,'발송일 추정 분류는 완료가 아님');
  await page.evaluate(()=>RelV12.openClassify('n-rev'));await page.waitForSelector('#rv-dlg');
  assert.equal(await page.locator('#rv-dlg .rv-states [aria-checked="true"] b').innerText(),'일반관리','기간만으로 대기를 미리 선택하지 않음');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{const d=B.deals.find(x=>x.id==='h-1');d.next_action={text:'고객 약속: 재논의',type:'고객 약속',due:DAY(5),status:'open'};__memo.length=0;__next.length=0;RelV12.openClassify('h-1');});await page.waitForSelector('#rv-dlg');
  assert.equal(await page.inputValue('#rv-dlg [data-rv-in="review"]'),await page.evaluate(()=>DAY(-1)),'기존 재검토일 복원');
  assert.match(await page.locator('#rv-dlg .rv-cmp').innerText(),/중단 사유·연락 제한 확인/);
  await page.fill('#rv-dlg [data-rv-in="review"]',await page.evaluate(()=>DAY(8)));
  await page.locator('#rv-dlg [data-rv="save"]').click();await page.waitForSelector('#rv-dlg',{state:'detached'});
  assert.deepEqual(await page.evaluate(()=>[__memo.length,__next.length]),[1,0],'재검토일만 수정하면 이력 저장 · 기존 업무 유지');
  assert.match(await page.evaluate(()=>__memo[0][1]),new RegExp(await page.evaluate(()=>DAY(8))));
  await page.evaluate(()=>{__memo.length=0;__next.length=0;RelV12.openClassify('h-1');});await page.waitForSelector('#rv-dlg');
  await page.fill('#rv-dlg [data-rv-in="next"]',await page.evaluate(()=>DAY(6)));await page.locator('#rv-dlg [data-rv-in="next"]').dispatchEvent('change');
  await page.locator('#rv-dlg [data-rv="save"]').click();await page.waitForSelector('#rv-dlg',{state:'detached'});
  assert.equal(await page.evaluate(()=>__next[0][1]),'고객 약속','날짜 변경으로 기존 업무 종류를 전화로 덮지 않음');
  /* ⑨ 설정값: 집중 · 일반 기간은 운영 기준(care_focus_months · care_general_months) — 바꾸면 칸 기준 글이 따라간다 */
  await page.evaluate(()=>{CRMRules.apply({care_focus_months:2,care_general_months:4});paint();});await page.waitForTimeout(300);
  assert.deepEqual((await V.locator('.ps3-tab span').allInnerTexts()).slice(1,3).map(one),['견적 후 2개월 · 7일 안 후속 통화','집중 이후 ~ 발송일부터 4개월 · 최소 월 1회']);
  assert.deepEqual(await page.evaluate(()=>CRMRules.ROWS.filter(r=>/^care_/.test(r.k)).map(r=>[r.k,r.st,r.unit,r.min,r.max])),[['care_focus_months','cond','개월',1,6],['care_general_months','cond','개월',1,12]],'설정 화면 항목(조건부)');
  await page.evaluate(()=>{CRMRules.apply({care_focus_months:1,care_general_months:3});});
  /* ⑩ 끄기: G.relV12Off → 예전 탭 3개 */
  await page.evaluate(()=>{G.relV12Off=true;PipelineWorkspace.open('relationship');});await page.waitForTimeout(300);
  assert.deepEqual(await V.locator('.ps3-tab .l').allInnerTexts(),['전체','다음 연락일 지남','이번 주 연락','장기 대기']);assert.equal(await V.locator('.ps3-works').count(),0);
  await page.evaluate(()=>{G.relV12Off=false;PipelineWorkspace.open('relationship');});await page.waitForTimeout(300);assert.equal(await V.locator('.ps3-tab').count(),6);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('relationship v12 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
