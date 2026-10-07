'use strict';
/* 확장관리 단지 묶음 배치 검사(2026-10-07 시안 '확장관리 단지 묶음 시안.dc.html' · 대표 캡처 1711 폭)
   ① 단지 머리 줄 = 다른 줄과 같은 4칸 · 흰 버튼 · 같은 현장명은 한 번만 / 계약 줄 = '계약 n · 공종 · 금액 · 준공월' + 버튼 자리 '위 단지 줄에서'
   ② 필터줄과 목록 칸 이름 줄이 각각 고정돼 스크롤해도 겹치지 않음
   ③ 본문이 사이드바를 밀지 않음(228 · 노트북 폭 200 고정 · 가로 스크롤 없음 · 열었다 닫아도 그대로) */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1711,height:860},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ExpansionB&&window.StageBoard&&window.ExpansionV2&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),Y=new Date().getFullYear();
   const won=(id,site,owner,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:day(-200),code:'won',stage_code:'won',outcome:'won',won_amount:5e6,closed_at:day(-60),completion_date:day(-60)},extra||{});
   B={deals:[won('w1','이천신둔코아루','한준엽'),won('w2','[서울 강서] 마곡청구아파트','황윤선',{won_amount:82e6}),won('w3','시범현대아파트','이필선',{brand:'석민이앤씨'}),won('w4','니즈 확인된 현장','황윤선'),won('w5','보류 현장','이필선'),won('w6','작년 준공 현장','이필선',{completion_date:(Y-1)+'-05-10',closed_at:(Y-1)+'-05-10'}),won('w7','오래된 접촉 현장','김성민',{completion_date:day(-120),closed_at:day(-120)}),won('g1','정릉중앙하이츠빌2단지아파트','황윤선',{brand:'석민이앤씨',won_amount:73e6,site_id:'aaaaaaaa-0000-4000-8000-000000000001'}),won('g2','정릉중앙하이츠빌2단지아파트','황윤선',{brand:'석민이앤씨',won_amount:287e5,site_id:'aaaaaaaa-0000-4000-8000-000000000001'})],
    inquiries:[],activities:[],inquiryTrash:[],
    expansion_pool:[
     {id:'e1',source_opportunity_id:'w1',site_name:'이천신둔코아루',owner_name:'한준엽',completion_date:day(-60),next_contact_at:day(-2),expansion_status:'신규 대상',candidate_work_items:['타공종 확인','유지보수 확인'],version:1},
     {id:'e2',source_opportunity_id:'w2',site_name:'[서울 강서] 마곡청구아파트',owner_name:'황윤선',source_work_summary:'옥상 방수',source_won_amount:82e6,completion_date:day(-60),next_contact_at:day(5),last_contact_at:day(-7),expansion_status:'접촉 예정',candidate_work_items:['지하주차장','재도장'],version:1},
     {id:'e3',source_opportunity_id:'w3',site_name:'시범현대아파트',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:4e6,completion_date:day(-60),next_contact_at:day(40),last_contact_at:day(-10),expansion_status:'관계 관리중',candidate_work_items:['재도장'],version:1},
     {id:'e4',source_opportunity_id:'w4',site_name:'니즈 확인된 현장',owner_name:'황윤선',source_work_summary:'재도장',source_won_amount:3e7,completion_date:day(-60),next_contact_at:day(20),last_contact_at:day(-3),expansion_status:'추가 니즈 확인',need_note:'지하주차장 에폭시 견적 요청',version:1},
     {id:'e5',source_opportunity_id:'w5',site_name:'보류 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:day(-60),next_contact_at:day(90),expansion_status:'보류/휴면',version:1},
     {id:'e6',source_opportunity_id:'w6',site_name:'작년 준공 현장',owner_name:'이필선',source_work_summary:'옥상 방수',source_won_amount:1e7,completion_date:(Y-1)+'-05-10',next_contact_at:day(3),expansion_status:'신규 대상',version:1},
     {id:'g1e',source_opportunity_id:'g1',site_name:'정릉중앙하이츠빌2단지아파트',owner_name:'황윤선',source_work_summary:'옥상 방수',source_won_amount:73e6,completion_date:day(-168),next_contact_at:day(-2),expansion_status:'신규 대상',version:1},{id:'g2e',source_opportunity_id:'g2',site_name:'정릉중앙하이츠빌2단지아파트',owner_name:'황윤선',source_work_summary:'재도장',source_won_amount:287e5,completion_date:day(-168),next_contact_at:day(-2),expansion_status:'신규 대상',version:1},{id:'e7',source_opportunity_id:'w7',site_name:'오래된 접촉 현장',owner_name:'김성민',source_work_summary:'옥상 방수',source_won_amount:2e7,completion_date:day(-120),next_contact_at:day(10),last_contact_at:day(-75),expansion_status:'관계 관리중',version:1}],
    expansion_events:[{source_opportunity_id:'w2',occurred_at:day(-7),kind:'접촉',note:'관리소장 통화 — 하자 없음',actor:'황윤선'}],expansion_quote_dispatches:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.sb=null;G.expansionYear=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p.expansion_status,p.next_contact_at]);return 'req';};
   window.__info=[];SB={rpc:async(name,args)=>{if(name==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};if(name==='crm_expansion_info_update_v1'){__info.push(args.p);return {data:{ok:true,source_opportunity_id:args.p.source_opportunity_id,expansion_record_id:'x1',field:args.p.field,value:args.p.value}};}return {data:{ok:true,event:{source_opportunity_id:args.p.source_opportunity_id,occurred_at:new Date().toISOString(),kind:'접촉·니즈',note:args.p.note,actor:'송보람'}}};}};TOKEN='test';
   window.__new=null;expansionOpenNew=id=>{window.__new=id;};
   goPage('expansion');
  });
  await page.waitForTimeout(300);
  await page.waitForSelector('#expansion-b .prv-list .prv-row');await page.waitForTimeout(400);
  const one=s=>String(s||'').replace(/\s+/g,' ').trim(),box=el=>{const b=el.getBoundingClientRect();return {l:Math.round(b.left),t:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height),b:Math.round(b.bottom)};};
  /* ① 머리 줄 = 일반 줄과 같은 4칸 */
  const H=await page.evaluate(()=>{const site=document.querySelector('#expansion-b .xb-site'),row=document.querySelector('#expansion-b .prv-list>.prv-row:not(.xb-site):not(.xb-sub)'),btn=site.querySelector(':scope>button'),cs=getComputedStyle(btn);return {cls:site.classList.contains('prv-row'),cols:[getComputedStyle(site).gridTemplateColumns,getComputedStyle(row).gridTemplateColumns],kids:[...site.children].map(c=>c.className||c.tagName),text:[...site.children].map(c=>c.innerText.replace(/\s+/g,' ').trim()),btn:[btn.textContent,Math.round(btn.getBoundingClientRect().height),cs.borderRadius,cs.backgroundColor,cs.borderTopColor,btn.dataset.v],bg:getComputedStyle(site).backgroundColor,dup:[...document.querySelectorAll('#expansion-b .prv-list b')].filter(b=>b.textContent.includes('정릉중앙하이츠빌2단지아파트')).length};});
  assert.equal(H.cls,true,'머리 줄도 prv-row 틀');assert.equal(H.cols[0],H.cols[1],'머리 줄 칸 폭 = 일반 줄 칸 폭: '+H.cols.join(' | '));assert.deepEqual(H.kids,['prv-a','prv-b','prv-c','BUTTON']);
  assert.deepEqual(H.text,['정릉중앙하이츠빌2단지아파트 계약 2건 · 1억 · 2026.04 준공 · 황윤선','사후 연락 · 기록 보완 필요','다음 접촉일 2일 지남 기록은 단지 단위로 두 계약에 연결','단지 연락 기록']);
  assert.deepEqual(H.btn,['단지 연락 기록',34,'8px','rgb(255, 255, 255)','rgb(217, 221, 228)','sitenote'],'다른 줄과 같은 흰 버튼');assert.equal(H.bg,'rgb(246, 247, 249)','줄 바탕은 연회색');assert.equal(H.dup,1,'같은 현장명은 한 번만');
  /* ② 계약 줄 */
  const S=await page.evaluate(()=>[...document.querySelectorAll('#expansion-b .xb-sub')].map(s=>({t:[...s.children].map(c=>c.innerText.replace(/\s+/g,' ').trim()),pad:getComputedStyle(s.querySelector('.prv-a')).paddingLeft,cls:s.children[3].className})));
  assert.deepEqual(S.map(x=>x.t[0]),['계약 1 · 옥상 방수 · 7,300만 · 2026.04 준공 석민이앤씨 · 황윤선','계약 2 · 재도장 · 2,870만 · 2026.04 준공 석민이앤씨 · 황윤선']);assert.deepEqual(S.map(x=>x.t[3]),['위 단지 줄에서','위 단지 줄에서']);assert.deepEqual(S.map(x=>x.pad),['16px','16px'],'들여쓰기 유지');
  /* 단지 줄 아닌 곳은 그대로: 한 건짜리 줄은 현장명 · 버튼 [연락] */
  assert.equal(await page.locator('#expansion-b .prv-list>.prv-row:not(.xb-site):not(.xb-sub)').first().locator(':scope>button').innerText(),'연락');
  /* ③ 필터줄과 목록 칸 이름 줄: 스크롤해도 겹치지 않음 */
  await page.evaluate(()=>window.scrollBy(0,520));await page.waitForTimeout(300);
  const K=await page.evaluate(()=>{const b=el=>{const r=el.getBoundingClientRect();return {t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width),l:Math.round(r.left)}};return {sy:scrollY,cf:b(document.querySelector('#pg-expansion>.cf-bar')),head:b(document.querySelector('#expansion-b .prv-head')),side:b(document.querySelector('.side')),sw:document.documentElement.scrollWidth,iw:innerWidth};});
  assert.ok(K.sy>300,'스크롤됨');assert.ok(K.head.t>=K.cf.b,'목록 칸 이름 줄이 필터줄 아래: '+JSON.stringify(K));assert.ok(K.cf.t<=80&&K.head.t<=K.cf.b+16,'둘 다 화면 위에 고정: '+JSON.stringify(K));
  /* ④ 사이드바 폭 고정 · 가로 스크롤 없음 — 열었다 닫아도 밀리지 않는다 */
  assert.deepEqual([K.side.l,K.side.w,K.sw<=K.iw],[0,228,true],'사이드바 228 고정');
  await page.locator('#expansion-b .xb-site>button').click();await page.waitForTimeout(500);await page.keyboard.press('Escape');await page.waitForTimeout(300);
  const K2=await page.evaluate(()=>({side:Math.round(document.querySelector('.side').getBoundingClientRect().left),w:Math.round(document.querySelector('.side').getBoundingClientRect().width),sx:scrollX,all:[...document.querySelectorAll('.dash,.main,#pg-expansion')].map(e=>e.scrollLeft)}));
  assert.deepEqual([K2.side,K2.w,K2.sx,K2.all.every(x=>x===0)],[0,228,0,true],'열었다 닫아도 밀리지 않음');
  /* 노트북 폭(1300): 사이드바 200 고정 · 가로 넘침 없음 */
  await page.setViewportSize({width:1300,height:860});await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>{const s=document.querySelector('.side').getBoundingClientRect();return [Math.round(s.width),document.documentElement.scrollWidth<=innerWidth,getComputedStyle(document.querySelector('.dash')).gridTemplateColumns.split(' ')[0]];}),[200,true,'200px'],'노트북 폭');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('expansion group layout ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});