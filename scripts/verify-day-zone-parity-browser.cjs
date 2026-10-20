'use strict';
/* 오늘 업무 4구역 PC · 모바일 같은 숫자 (2026-10-20 design_handoff_six_fixes ③)
   같은 계정 · 같은 합성 영업건 8건을 PC(crm.html 오늘 업무)와 모바일(mobile.html 오늘)에 넣고
   오늘 처리 · 기한 초과 · 고객 회신 대기 · 기록 보완 숫자와 각 구역의 현장이 같은지 본다. 판정 함수는 하나(DayZoneRules).
   합성 자료(현장 · 이름은 지어낸 것) · 외부 연결 차단 · 저장 없음. */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=require('../review-preview/server.cjs');
const {launchOptions}=require('../review-preview/review-environment.cjs');
const root=path.resolve(__dirname,'..');
const pcSrv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res);});
/* 기한(오늘 기준 일수) · 다음 할 일 · 대기 — 두 화면에 같은 값으로 넣는다 */
const CASES=[
 ['p01','합성 기한 지남 3일',{due:-3,text:'견적 검토 확인'}],
 ['p02','합성 기한 지남 1일',{due:-1,text:'자료 회신 확인'}],
 ['p03','합성 오늘 실측',{due:0,text:'현장 실측',type:'방문'}],
 ['p04','합성 오늘 약속',{due:0,text:'고객 약속: 견적서 보내기',type:'약속'}],
 ['p05','합성 모레 연락',{due:2,text:'공사 시기 확인'}],
 ['p06','합성 다음 할 일 없음',{}],
 ['p07','합성 회신 대기',{wait:'입대의 결과 회신 대기',until:3,due:3,text:'입대의 결과 확인'}],
 ['p08','합성 무기한 대기',{wait:'관리소장 휴가'}]
];
/* 견적문의 2건: 배정 3시간 전(첫 연락 기준 2시간 넘김 → 기한 초과) · 배정 30분 전(오늘 처리) */
const INQ=[['i01','합성 문의 기준 넘김',3],['i02','합성 문의 새 배정',0.5]];
const EXPECT={now:['합성 오늘 실측','합성 오늘 약속','합성 문의 새 배정'],late:['합성 기한 지남 3일','합성 기한 지남 1일','합성 문의 기준 넘김'],wait:['합성 회신 대기'],fix:['합성 다음 할 일 없음','합성 무기한 대기']};
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));await new Promise(r=>pcSrv.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port,pcOrigin='http://127.0.0.1:'+pcSrv.address().port;let browser;const errors=[];
 try{
  browser=await chromium.launch(launchOptions());
  const ctx=async w=>{const c=await browser.newContext({viewport:{width:w,height:1200},timezoneId:'Asia/Seoul'});await c.route('**/*',r=>{const u=new URL(r.request().url());if(!['GET','HEAD'].includes(r.request().method()))return r.abort();return u.origin===origin||u.origin===pcOrigin?r.continue():r.abort();});const p=await c.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(String(e.message||e)));return p;};
  /* ── PC ── */
  const pc=await ctx(1600);
  await pc.goto(pcOrigin+'/crm.html');await pc.waitForFunction(()=>window.TodayV2&&window.DayZones&&window.DayZoneRules&&window.TodayWorkQueue);
  await pc.evaluate(([CASES,INQ])=>{
   const day=n=>DayZoneRules.kst(Date.now()+n*864e5),at=n=>new Date(Date.now()-n*864e5).toISOString();
   B={deals:CASES.map(([id,site,c])=>({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-10),created_at:at(10),code:c.wait?'waiting':'consulting',stage_code:c.wait?'waiting':'consulting',grp:'영업·관리',amt:1e8,manager_name:'합성 관리소장',manager_mobile:'01000000000',last_activity_at:at(1),activities:[{id:id+'a',type:'전화',note:'통화 연결',at:at(1),occurred_at:at(1),actor:'이필선',meaningful:true}],
    waiting_reason:c.wait||'',expected_resume_at:c.until!=null?day(c.until):'',next_action:c.text?{id:id+'n',type:c.type||'전화',text:c.text,due:day(c.due),status:'open'}:null})),inquiries:INQ.map(([k,site,h],n)=>({id:'aaaaaaaa-1111-4111-8111-00000000000'+(n+1),site,status:'배정완료',at:new Date(Date.now()-(h+0.1)*36e5).toISOString(),created_at:new Date(Date.now()-(h+0.1)*36e5).toISOString(),brand:'POUR솔루션',phone:'010-0000-000'+n,contact_name:'합성 고객',assignee:'이필선',assigned_to:'이필선',assigned_at:new Date(Date.now()-h*36e5).toISOString(),memo:'옥상 방수 견적 문의',raw:{'문의내용':'견적 문의'}})),activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'rep1',name:'이필선',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.today3=null;G.tower=null;G.towerRole=null;G.todayQueueOwner='전체';G.dayZones=null;G.workReq=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   SB={rpc:async()=>({data:{ok:true,requests:[],tasks:[],entries:[],rows:[],units:[],events:[],comments:[],advisory:[]}})};OpsStore.aiOn=()=>false;
   goPage('today');
  },[CASES,INQ]);
  await pc.waitForSelector('#today-v2 .dz');await pc.waitForTimeout(800);
  const pcZones=await pc.evaluate(()=>{const Z=DayZones.last(),site=i=>(i.i&&i.i.site)||(i.d&&(i.d.site||i.d.site_name))||'';return {now:Z.now.map(site),late:(Z.late||[]).map(site),wait:Z.wait.map(site),fix:(Z.fix||[]).map(site)};});
  const pcTabs=await pc.locator('#today-v2 .dz-tabs button span').allInnerTexts();
  /* ── 모바일 ── */
  const mo=await ctx(390);
  await mo.goto(origin+'/mobile.html?demo=1&review=hub&screen=B',{waitUntil:'domcontentloaded'});await mo.locator('.approved-b').waitFor();
  await mo.evaluate(([CASES,INQ])=>{
   closeSheet();delete window.__approvedAExample;delete window.__approvedBCExample;delete window.__approvedHExample;delete window.__approvedScheduleNow;
   const day=n=>DayZoneRules.kst(Date.now()+n*864e5),actor=Phase1.profile.user_id;
   G.user={...G.user,id:actor};G.mode='rep';G.tab='today';G.deal=null;G.sub=null;G.done={};G.brandF='전체';
   Object.assign(MobileGuideShell.state,{q:'',stage:'',page:1,scroll:0,area:'now',areaPage:1,detailView:''});
   DEALS=CASES.map(([id,nm,c])=>({id,site_id:id+'s',nm,code:c.wait?'waiting':'consulting',sub:'방수',rep:G.user.nm,owner_id:actor,brand:'POUR솔루션',version:0,amt:1e8,manager_name:'합성 관리소장',manager_mobile:'',
    created_at:new Date().toISOString(),stageAt:new Date().toISOString(),lastAt:new Date().toISOString(),contactAt:new Date().toISOString(),activities:[],tl:[],waiting_reason:c.wait||'',expected_resume_at:c.until!=null?day(c.until):'',
    nextAction:c.text?{id:id+'n',type:c.type||'전화',text:c.text,due:day(c.due),due_at:day(c.due),status:'open'}:null}));
   ADMIN.inquiries=INQ.map(([k,nm,h],n)=>{const raw={id:'aaaaaaaa-1111-4111-8111-00000000000'+(n+1),site:nm,status:'배정완료',at:new Date(Date.now()-(h+0.1)*36e5).toISOString(),assignee:G.user.nm,assigned_at:new Date(Date.now()-h*36e5).toISOString(),phone:'0100000000'+n};return Object.assign(inquiryViewM(raw),{raw,done:true,rep:G.user.nm,status:'배정완료'});});
   Object.assign(MobileRequests.state(),{list:[],loaded:true,busy:false,off:false,at:Date.now()});render();
  },[CASES,INQ]);
  await mo.locator('.approved-a').waitFor();
  const moAreas=await mo.evaluate(()=>[...document.querySelectorAll('.approved-a [data-gs="area"]')].map(n=>n.textContent.replace(/\s+/g,' ').trim()));
  const moZones={};
  for(const k of ['now','late','wait','fix']){await mo.locator('.approved-a [data-gs="area"][data-value="'+k+'"]').click();await mo.locator('.approved-a').waitFor();
   moZones[k]=await mo.evaluate(()=>[...document.querySelectorAll('.approved-a [data-gs="task"]')].map(b=>{const d=DEALS.find(x=>String(x.id)===String(b.dataset.id));if(d)return d.nm;const q=(ADMIN.inquiries||[]).find(x=>String(x.key)===String(b.dataset.id));return q?q.nm:'';}));}
  /* ── 비교 ── */
  const nm=s=>String(s).replace(/^\[[^\]]*\]\s*/,'');
  const sorted=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.map(nm).sort()]));
  const exp=sorted(EXPECT);
  assert.deepEqual(sorted(pcZones),exp,'PC 4구역 = 기대값');
  assert.deepEqual(sorted(moZones),exp,'모바일 4구역 = 기대값');
  const labels=['오늘 처리','기한 초과','고객 회신 대기','기록 보완'],cnt=['now','late','wait','fix'].map(k=>EXPECT[k].length);
  assert.deepEqual(pcTabs.map(t=>t.replace(/\s+/g,' ').trim()),labels.map((l,i)=>l+' '+cnt[i]),'PC 탭 이름 · 숫자');
  assert.deepEqual(moAreas,labels.map((l,i)=>l+' '+cnt[i]),'모바일 구역 이름 · 숫자 = PC 와 같음');
  assert.deepEqual(errors,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',pc:pcTabs,mobile:moAreas}));
 }finally{if(browser)await browser.close();server.close();pcSrv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
