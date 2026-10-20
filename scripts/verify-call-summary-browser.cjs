'use strict';
/* 통화 녹음 → 응대 기록 (2026-10-20 design_handoff_six_fixes ⑥) — 합성 자료(상세 오른쪽 칸 검사와 같은 자료 · 이름은 지어낸 것)
   확인: 상세의 연락 결과 입력칸에 [통화 녹음 요약] · 녹음 파일 고르기 · 글 → 3줄 요약 · 고객 요청 · 약속 · 다음 행동(날짜 확인 필요) 제안
         / [응대 기록 입력칸에 넣기] = 입력칸에 글만(저장 · 업무 완료 · 새 업무 없음) · 전사 원문은 내부 메모로 / 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch(require('../review-preview/review-environment.cjs').launchOptions()),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealFrame7&&window.DealSame&&window.DecisionCollab&&window.SiteHistory&&window.DealWin&&window.DealTransfer&&window.DealUnits&&window.PipelineStageB&&window.PipelineJudge&&window.DealPrep&&window.ListPager);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const id=n=>'1111111'+n+'-1111-4111-8111-111111111111';
   const act=(i,type,note,at,who)=>({id:i,type,note,at,actor:who||'이필선',meaningful:true});
   const mk=(n,site,brand,who,code,extra)=>Object.assign({id:id(n),site,assignee:who,brand,created:'2025-09-10',code,stage_code:code,amt:260000000,manager_name:'이재석',manager_mobile:'01052493880',contacts:[{person_key:'mobile:01052493880',name:'이재석',role:'관리소장',mobile:'01052493880',status:'current'}],
    activities:[act('a'+n+'1','방문','현장 방문 · 2개 층 바닥 들뜸 확인',day(-12)+'T15:00:00+09:00',who),act('a'+n+'2','전화','통화 연결 · 방문 일정 협의',day(-30)+'T10:20:00+09:00',who)]},extra||{});
   B={deals:[
    mk(1,'[서울 노원] 상계주공7단지','POUR솔루션','이필선','consulting',{next_action:{id:'n1',text:'견적 요청 등록',type:'후속접촉',due:day(-7),status:'open'}}),
    mk(2,'[경기 평택] 오뚜기 포승공장','POUR솔루션','이필선','sent',{amt:57400000,address:'경기 평택시 포승읍 포승공단',activities:[act('a21','이메일','견적서 발송 · 임석재 소장',day(-20)+'T11:00:00+09:00','이필선'),act('a22','방문','현장 방문 · 2개 층 바닥 들뜸 확인',day(-12)+'T15:00:00+09:00','이필선')]}),
    mk(3,'[서울 마포] 성산시영아파트','석민이앤씨','김성민','rapport',{amt:380000000,quote_versions:[{version_no:1,amount:410000000,created_at:day(-60)},{version_no:2,amount:380000000,created_at:day(-40)}],next_action:{id:'n3',text:'고객 약속: 입대의 결과 확인 연락',type:'전화',due:day(4),status:'open'}}),
    mk(4,'[경기 고양] 햇빛마을23단지','석민이앤씨','이필선','bidding',{amt:420000000,stage_contexts:{bidding:{fields:{bid_deadline:day(2)}}},next_action:{id:'n4',text:'제안서 팀장 공유 · 제출 준비',type:'후속접촉',due:day(1),status:'open'}}),
    mk(5,'[경기 평택] 평택비전지웰푸르지오','석민이앤씨','황윤선','contract',{amt:1120000000,stage_contexts:{contract:{fields:{contract_date:'2026-01-26',contract_amount:1043900000}}},next_action:{id:'n5',text:'계약 체결 확인',type:'전화',due:day(-3),status:'open'}}),
    mk(6,'[경기 용인] 수지삼성래미안','POUR공법','정정훈','won',{outcome:'won',won_amount:140000000,closed_at:'2026-03-12',contract_date:'2026-03-12',completion_date:day(-40),amt:140000000,stage_contexts:{won:{fields:{completion_date:day(-40)}}}}),
    mk(7,'[대구] 강북이진캐스빌','석민이앤씨','한준엽','lost',{outcome:'lost',closed_at:'2026-05-07',amt:350000000}),
    mk(8,'[부산] 과거 이관 단지','석민이앤씨','김성민','old_stage_x',{amt:380000000,activities:[act('a81','방문','현장 방문 · 2개 층 바닥 들뜸 확인','2026-08-20T15:00:00+09:00','김성민'),act('a82','전화','통화 연결 · 방문 일정 협의','2026-07-30T10:20:00+09:00','김성민')]}),mk(9,'[경기 안양] 미팅 전 컨설팅 단지','POUR솔루션','이필선','consulting',{activities:[]}),mk(10,'[서울 마포] 나눔빌딩','석민이앤씨','황윤선','bidding',{amt:300000000})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.__rpc=[];window.__uploads=[];window.uploadExecAttachment=async(d,f,cat,tags,memo)=>{__uploads.push({name:f.name,cat,memo});return {id:'u'+__uploads.length,file_name:f.name,mime_type:f.type,category:cat,memo,status:'ready',created_at:new Date().toISOString()};};window.logActivity=(type,note,res,at)=>({id:'l'+Date.now(),type,note,at});
   SB={rpc:async(n,a)=>{__rpc.push([n,a]);if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};
    if(n==='crm_deal_stage_fields_update_v1'||n==='crm_deal_closed_info_update_v1'){const p=a.p||{},dd=B.deals.find(x=>x.id===(p.deal_id||p.opportunity_id)),code=p.stage_code||'sent',cur=((dd&&dd.stage_contexts||{})[code]||{}).fields||{};return {data:{ok:true,deal_id:p.deal_id||p.opportunity_id,stage:p.stage,fields:p.fields||{},version:2,stage_context:{to:code,fields:Object.assign({},cur,p.fields||{})}}};}
    return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[],links:[],rows:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.__open=async(i)=>{try{closeDetail();}catch(e){}await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));};
   window.__md=n=>{const t=new Date(Date.now()+n*864e5);return (t.getMonth()+1)+'.'+t.getDate();};
  });
  const V=page.locator('#detailView');
  const md=n=>page.evaluate(n=>window.__md(n),n);
  const open=async i=>{await page.evaluate(i=>window.__open(i),i);await page.waitForSelector('#detailView.dv7r .dvs-task :is(.dv7-lb,.dv8-lb)');await page.waitForTimeout(700);if(await page.locator('#detailView.dv8 .dv7-drawer:not([hidden])').count()){await page.locator('#detailView [data-dv3="hadd"]').click();await page.waitForTimeout(300);}/* 지금 응대 중심: 열면 단계 업무 화면 → [이력 추가] = 응대 입력칸 */};
  await open(0);
  const btn=page.locator('#detailView #ddvComposer .cs-open');await btn.waitFor();assert.equal((await btn.innerText()).trim(),'통화 녹음 요약','입력칸 머리에 단추');
  await page.evaluate(()=>{window.__memo=[];DealDetailV3.memo=async(d,note)=>{__memo.push([d.id,note]);};window.__w0=window.__writes=0;const pw=window.pushWrite;window.pushWrite=(...a)=>{window.__writes++;return pw(...a);};});
  await btn.click();const box=page.locator('#cs-root .cs-box');await box.waitFor();
  assert.deepEqual((await box.locator('.cs-steps li').allInnerTexts()).map(s=>s.replace(/^\d · /,'').trim()),['녹음 파일','글 · 요약','확인 · 수정','응대 기록'],'4단계');
  assert.equal(await box.locator('input[type=file][accept="audio/*"]').count(),1,'녹음 파일 고르기');
  assert.equal(await box.locator('[data-cs="sum"]').isDisabled(),true,'글이 없으면 요약 단추 꺼짐');
  await box.locator('input[type=file]').setInputFiles({name:'통화_20261020.m4a',mimeType:'audio/mp4',buffer:Buffer.from('fake')});
  assert.match(await box.locator('.cs-file small').innerText(),/통화_20261020\.m4a/,'고른 파일 이름');
  await box.locator('[data-cs="text"]').fill('담당: 넷폼 이필선입니다. 옥상 방수 견적 건으로 연락드렸습니다.\n고객: 우레탄이랑 시트 두 가지로 비교 견적 보내 주세요.\n담당: 금요일까지 견적서 두 안으로 보내드리겠습니다.\n고객: 현장은 수요일 오전에 보셔도 됩니다.');
  await box.locator('[data-cs="sum"]').click();await page.waitForTimeout(150);
  const f=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#cs-root [data-cs-f]')].map(n=>[n.getAttribute('data-cs-f'),n.value])));
  assert.match(f.request,/비교 견적/,'고객 요청 추림: '+f.request);assert.match(f.promise,/금요일까지 견적서/,'약속 추림: '+f.promise);assert.ok(f.next,'다음 행동 제안');
  assert.ok(f.summary.split('\n').length<=3&&/고객 요청/.test(f.summary),'3줄 요약: '+f.summary);
  assert.match(await box.locator('.cs-sum').innerText(),/확인 전[\s\S]*제안[\s\S]*날짜 확인 필요[\s\S]*업무를 자동으로 완료하지 않습니다/,'제안 · 날짜 확인 필요 · 자동 완료 없음');
  if(process.env.CS_SHOT)await page.screenshot({path:process.env.CS_SHOT});
  await box.locator('[data-cs-f="promise"]').fill('금요일까지 견적서 2안 발송');
  await box.locator('[data-cs="apply"]').click();await page.waitForTimeout(500);
  assert.equal(await page.locator('#cs-root .cs-box').count(),0,'창 닫힘');
  const ta=await page.locator('#detailView #ddvComposer textarea').inputValue();assert.match(ta,/^\[통화 녹음 요약\]\n고객 요청: /,'입력칸에 요약');assert.match(ta,/약속: 금요일까지 견적서 2안 발송/,'고친 값 그대로');
  assert.deepEqual(await page.evaluate(()=>__memo.map(m=>[m[0],m[1].startsWith('[통화 전사 · 통화_20261020.m4a] 담당: 넷폼 이필선입니다.')&&m[1].includes('수요일 오전')])),[[await page.evaluate(()=>B.deals[0].id),true]],'전사 원문 전체 = 내부 메모');
  assert.equal(await page.evaluate(()=>window.__writes),0,'저장 · 업무 완료 · 새 업무 없음(입력칸에 넣기만)');
  assert.equal(await page.evaluate(()=>B.deals[0].next_action&&B.deals[0].next_action.status),'open','기존 업무 그대로');
  /* 끄기 */
  await page.evaluate(()=>{G.callSummaryOff=true;document.querySelectorAll('.cs-open').forEach(b=>b.remove());});await open(1);await page.waitForTimeout(300);assert.equal(await page.locator('#detailView .cs-open').count(),0,'끄면 단추 없음');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',button:true,four_steps:true,file:true,summary3:true,suggest_only:true,no_write:true,transcript_memo:true,off:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
