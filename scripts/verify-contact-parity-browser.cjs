'use strict';
/* PC · 모바일 같은 작업 → 같은 저장 (2026-10-10 design_handoff_mobile_all 완료 판정 · 통과 기준 5 'PC 일치')
   같은 영업건 · 같은 입력(연락 결과 · 상담 내용 · 다음 업무)을 PC 상세 가운데 칸과 모바일 결과 창에서 각각 저장하고,
   서버로 가는 저장 명령(완료 → 기록 → 다음 업무 · 기한 변경 기록)이 같은지 비교한다 — 합성 자료. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\/+/,'')||'mobile.html',t=path.resolve(root,rel);if(!t.startsWith(root+path.sep)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',t.endsWith('.html')?'text/html; charset=utf-8':t.endsWith('.css')?'text/css':'application/javascript; charset=utf-8');fs.createReadStream(t).pipe(res)});
const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));
const ID='11111111-1111-4111-8111-111111111111',AID='99999999-9999-4999-8999-999999999999';
/* 시나리오: ex = 지금 열린 일정(며칠 뒤) */
const CASES=[
 {name:'연결됨 · 새 업무(오늘 일정 처리)',ex:0,res:'연결됨',memo:'금요일까지 견적서 보내 달라고 함',mode:'new',purpose:'견적서 발송',date:kst(4)},
 {name:'부재 · 기존 일정 유지',ex:5,res:'부재',mode:'keep'},
 {name:'회신 받음 · 일정 변경(앞당김)',ex:5,res:'회신 받음',memo:'앞당기자고 함',mode:'change',date:kst(2)},
 {name:'연결됨 · 일정 변경(늦춤 + 사유)',ex:5,res:'연결됨',memo:'입대의 일정이 밀렸다고 함',mode:'change',date:kst(12),reason:'고객 요청 · 입대의 후 연락'},
 {name:'번호 오류 · 새 업무',ex:0,res:'번호 오류',mode:'new',purpose:'연락처 확인',date:kst(1)},
 {name:'연결됨 · 다음 일정 없음 + 사유',ex:0,res:'연결됨',memo:'올해는 어렵다고 함',mode:'none',reason:'2027 예산 · 3월 재확인'},
 {name:'배드핏 · 다음 일정 없음 + 사유',ex:0,res:'배드핏',memo:'공사 계획 없다고 함',mode:'none',reason:'자체 보수 완료'}
];
const MODE={keep:'기존 일정 유지',change:'일정 변경',new:'새 업무',none:'다음 일정 없음'};
const norm=o=>[o.op,o.payload.type||'',String(o.payload.note||o.payload.text||'').replace(/\d{4}-\d{2}-\d{2}/g,'D'),o.payload.due_at||'',o.actionId||''];
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const port=srv.address().port;
  /* ── PC ── */
  const pcCtx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});await pcCtx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const pc=await pcCtx.newPage();pc.on('pageerror',e=>errs.push('pc '+e.message));
  await pc.goto(`http://127.0.0.1:${port}/crm.html`);await pc.waitForFunction(()=>window.DealDetailV3&&window.ContactEntry&&window.OpsStore&&window.DealKeyman);
  const pcBoot=()=>pc.evaluate(([id,aid,exDue])=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   B={deals:[{id,site:'[경기 용인] 일치 검증 단지',assignee:'황윤선',brand:'석민이앤씨',created:day(-34),code:'first_contact',stage_code:'first_contact',grp:'영업·관리',amt:5e7,manager_name:'이영수',manager_mobile:'01000001234',contacts:[{person_key:'mobile:01000001234',name:'이영수',role:'관리소장',mobile:'01000001234',status:'current'}],activities:[],stage_contexts:{},next_action:{id:aid,type:'전화',text:'대표회의 결과 확인',due:day(exDue),due_at:day(exDue),status:'open'}}],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,p]);return 'req-'+__writes.length;};
   window.__ops=[];window.queueDetailContactOperation=(op,payload,actionId)=>{const i='op-'+(__ops.length+1);__ops.push({id:i,op,payload,actionId});return i;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:'done',payload:o.payload,ack:{ok:true,operation:o.op,activity_id:'srv-'+o.id,next_action_id:'srv-'+o.id}}));
   SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[]}})};TOKEN='test';OpsStore.aiOn=()=>false;
   try{closeDetail();}catch(e){}drwDeal(JSON.stringify(B.deals[0]));
  },[ID,AID,0]);
  const pcRun=async c=>{
   await pc.evaluate(([id,aid,exDue])=>{const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');try{closeDetail();}catch(e){}LOCAL={deals:{},inquiries:{},expansionPool:[]};/* 앞 시나리오가 남긴 로컬 변경 지움 */B.deals[0].next_action={id:aid,type:'전화',text:'대표회의 결과 확인',due:day(exDue),due_at:day(exDue),status:'open'};B.deals[0].activities=[];{const p=itemPatch(B.deals[0],'deal');['nextActionObj','nextAction','nextActionText','activities'].forEach(k=>{delete p[k];delete B.deals[0][k];});}window.__ops.length=0;drwDeal(JSON.stringify(B.deals[0]));},[ID,AID,c.ex]);
   await pc.waitForSelector('#detailView.dv3.dvt .sth-tidy');await pc.waitForTimeout(400);
   const v=pc.locator('#detailView.dv3.dvt');
   await pc.evaluate(()=>DealDetailV3.openFrom('activity'));await pc.waitForTimeout(300);/* 오른쪽 [연락하고 결과 기록] = 가운데 입력칸 */
   await v.locator('#ddvComposer textarea').fill(c.memo||'');await v.locator('.dvt-res [data-dv3="rres"]',{hasText:new RegExp('^'+c.res+'$')}).click();await pc.waitForTimeout(120);
   if(c.memo)await v.locator('#ddvComposer textarea').fill(c.memo);
   await v.locator('.dvt-res [data-dv3="rmode"]',{hasText:MODE[c.mode]}).click();await pc.waitForTimeout(100);
   if(c.mode==='new'){await v.locator('.dvt-res [data-dv3rec="purpose"]').fill(c.purpose);}
   if(c.mode==='new'||c.mode==='change'){await v.locator('.dvt-res [data-dv3="rdate"]').click();await pc.waitForTimeout(100);await v.locator('.dvt-res [data-dv3rec="date"]').fill(c.date);await pc.waitForTimeout(150);}
   if(c.reason)await v.locator('.dvt-res [data-dv3rec="reason"]').fill(c.reason);
   const n0=await pc.evaluate(()=>__ops.length);
   await v.locator('#ddvComposer .idv-save').click();await pc.waitForTimeout(900);
   return pc.evaluate(()=>__ops.map(o=>({op:o.op,payload:o.payload,actionId:o.actionId})));
  };
  await pcBoot();
  /* ── 모바일 ── */
  const moCtx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});await moCtx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const mo=await moCtx.newPage();mo.on('pageerror',e=>errs.push('mobile '+e.message));
  await mo.goto(`http://127.0.0.1:${port}/mobile.html?demo=1`,{waitUntil:'domcontentloaded'});await mo.waitForFunction(()=>window.ContactEntry&&window.MobileEntry&&typeof render==='function'&&window.OperationalUI);
  const moRun=async c=>{
   await mo.evaluate(([id,aid,exDue])=>{const kst=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));try{sessionStorage.removeItem('crm:call-entry:v1');}catch(e){}
    G.user=REPS.find(r=>r.role==='dual')||REPS[0];G.mode='rep';DEMO=true;window.toast=()=>{};DEALS=[{id,nm:'[경기 용인] 일치 검증 단지',code:'consulting',sub:'방수',rep:G.user.nm,amt:5e7,activities:[],tl:[],manager_name:'이영수',manager_mobile:'01000001234',nextAction:{id:aid,type:'전화',text:'대표회의 결과 확인',due:kst(exDue),due_at:kst(exDue),status:'open'}}];
    G._today=[];G.done={};G.deal=id;G.sub=null;G.tab='today';render();
    window.__ops=[];window.queueMobileContactOperation=(op,payload,actionId)=>{const i='op'+(__ops.length+1);__ops.push({id:i,op,payload,actionId});return i;};
    Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,status:'done',ack:{ok:true,operation:o.op,activity_id:'act-'+o.id,next_action_id:'nx-'+o.id}}));dealCallSheetM();},[ID,AID,c.ex]);
   await mo.waitForTimeout(350);const C=mo.locator('#sheetcard');
   await C.locator('.ce-chip',{hasText:new RegExp('^'+c.res+'$')}).click();await mo.waitForTimeout(100);
   if(c.memo)await C.locator('textarea[data-ce-in="memo"]').fill(c.memo);
   await C.locator('.ce-chip[data-ce="mode"]',{hasText:MODE[c.mode]}).click();await mo.waitForTimeout(100);
   if(c.mode==='new')await C.locator('input[data-ce-in="purpose"]').fill(c.purpose);
   if(c.mode==='new'||c.mode==='change'){await C.locator('.ce-pick input').evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},c.date);await mo.waitForTimeout(150);}
   if(c.reason)await C.locator('input[data-ce-in="reason"]').fill(c.reason);
   await mo.waitForTimeout(80);await C.locator('.ce-save').click();await mo.waitForTimeout(700);
   return mo.evaluate(()=>__ops.map(o=>({op:o.op,payload:o.payload,actionId:o.actionId})));
  };
  /* ── 비교 ── */
  const out=[];
  for(const c of CASES){
   const a=(await pcRun(c)).map(norm),b=(await moRun(c)).map(norm);
   assert.ok(a.length>=1,'PC 저장 명령이 있다: '+c.name);
   assert.deepEqual(b,a,'PC · 모바일 저장 명령이 같다 — '+c.name+'\nPC '+JSON.stringify(a)+'\n모바일 '+JSON.stringify(b));
   out.push(c.name+' → '+a.map(x=>x[0]+(x[1]?'('+x[1]+')':'')).join(' · '));
  }
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('verify-contact-parity: ok\n'+out.join('\n'));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
