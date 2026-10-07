'use strict';
/* 파이프라인 단계별 화면 · '확인할 현장' 목록 줄 v11 (2026-10-06 design_handoff_pipeline_v11 · 펼침 없음) — 합성 자료(이름 · 번호는 지어낸 것)
   확인: 칸 이름 줄 + 4칸 줄(현장 · 담당 / 현재 상황 / 다음 업무 · 기한 / 버튼) · 기한 급한 순 · 미배정 빨강 · 기한 글 · 버튼 = 업무 동사
        / 줄을 누르면 바로 그 영업건 상세(펼침 없음) / 버튼 = 새 상세의 그 자리 / 위 상태 탭 · 왼쪽 진단 · 리스트/보드는 그대로 / 수주 · 실주도 같은 줄 / 끄기 G.pipeRowV11Off */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineStageV3&&window.PipelineStageB&&window.PipelineRowV11&&window.PipelineWorkspace&&window.DealDetailV3&&window.OpsStore);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*864e5).toISOString();window.DAY=day;
   const S='aaaaaaaa-0000-4000-8000-00000000000';
   const deal=(n,site,brand,owner,o)=>Object.assign({id:'1111111'+n+'-1111-4111-8111-11111111111'+n,site,site_id:S+n,assignee:owner,brand,created:day(-40-n),code:'first_contact',stage_code:'first_contact',grp:'영업·관리',amt:0,contacts:[],activities:[],stage_contexts:{}},o);
   B={deals:[
    deal(1,'[경기 용인] 가람마을아파트','석민이앤씨','황윤선',{manager_name:'이영수',manager_mobile:'01000001234',next_action:{id:'n1',text:'관리소장 첫 통화',due:day(-3),status:'open'}}),
    deal(2,'새빛파크뷰','POUR솔루션','이승우',{manager_name:'관리과장',manager_mobile:'01000002222',activities:[{id:'a2',type:'전화',note:'부재중 (전화 안 받음)',at:at(-39)}],next_action:{id:'n2',text:'관리과장 재통화',due:day(0),status:'open'}}),
    deal(3,'한강제이타워','POUR솔루션','정정훈',{}),
    deal(4,'[경기 인천] 삼보','POUR솔루션','',{manager_name:'관리소장',manager_mobile:'01000004444'}),
    deal(5,'전농아름숲','POUR솔루션','정정훈',{amt:5e6,manager_name:'관리소장',manager_mobile:'01000005555',activities:[{id:'a5',type:'전화',note:'통화 완료 · 연결됨 — 10월 중 방문 희망',at:at(-37)}],next_action:{id:'n5',text:'방문 일정 확정',due:day(4),status:'open'},stage_contexts:{first_contact:{fields:{construction_plan:'2026년 10~11월',decision_maker:'관리소장'}}}}),
    deal(6,'[서울 노원] 상계7단지','POUR솔루션','이필선',{amt:26e6,manager_name:'관리소장',manager_mobile:'01000006666',next_action:{id:'n6',text:'입대의 일정 확인 전화',due:day(1),status:'open'}}),
    Object.assign(deal(7,'[경기 용인] 가람마을아파트','석민이앤씨','황윤선',{site_id:S+1}),{created:day(-400),code:'won',stage_code:'won',outcome:'won',won_amount:92e6,closed_at:day(-380),contract_date:day(-380),amt:92e6}),
    Object.assign(deal(8,'[경기 수원] 선경빌','석민이앤씨','황윤선',{manager_name:'관리과장',manager_mobile:'01000008888'}),{created:day(-200),code:'lost',stage_code:'lost',outcome:'lost',closed_at:day(-90),amt:4e7})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.queueDetailContactOperation=()=>'op';SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[]}})};TOKEN='test';OpsStore.aiOn=()=>false;
   PipelineWorkspace.open('consulting');
  });
  await page.waitForSelector('#pipeline-stage-v3 .prv-list .prv-row');await page.waitForTimeout(300);
  const V=page.locator('#pipeline-stage-v3'),L=V.locator('.prv-list');
  const ymd=n=>page.evaluate(n=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(DAY(n));return [+m[1]+'.'+(+m[2])+'.'+(+m[3]),(+m[2])+'/'+(+m[3])];},n);
  /* ① 위 상태 탭 · 왼쪽 진단 · 리스트/보드는 그대로 */
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('pipeline-stage-v3');return [v.querySelectorAll('.ps3-tab').length,v.querySelectorAll('.ps3-diag .ps3-box').length,[...v.querySelectorAll('.ps3-views button')].map(b=>b.textContent),v.querySelector('.ps3-lhead>b').textContent.replace(/\s+/g,' ').trim()];}),[4,3,['리스트','보드'],'확인할 현장 6곳']);
  /* ② 칸 이름 줄 + 4칸 줄 · 기한 급한 순(지난 것 → 오늘 → 내일 → 날짜 → 기한 없음) · 펼침 칸 없음 */
  assert.deepEqual((await L.locator('.prv-head span').allInnerTexts()).map(one),['현장 · 담당','현재 상황','다음 업무 · 기한','']);
  const d2=await ymd(-39),d5=await ymd(-37),due5=await ymd(4);
  const rows=await L.locator('.prv-row').evaluateAll(l=>l.map(r=>{const t=s=>{const n=r.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};return [t('.prv-a>b'),t('.prv-a>span'),t('.prv-b>span'),t('.prv-b>small'),t('.prv-c>b'),t('.prv-c>small'),t(':scope>button'),r.querySelector(':scope>button').dataset.v,r.dataset.ps3];}));
  if(process.env.DUMP)fs.writeFileSync(process.env.DUMP,JSON.stringify(rows,null,1));assert.deepEqual(rows,[
   ['[경기 용인] 가람마을아파트','석민이앤씨 · 공종 미분류 · 황윤선','미팅 일정 없음','CRM 연락 기록 없음 (이관 전 기록 확인 필요)','관리소장 첫 통화','3일 지남','연락 기록','next','open'],
   ['새빛파크뷰','POUR솔루션 · 공종 미분류 · 이승우','미팅 일정 없음','최근 연락 시도 '+d2[0],'관리과장 재통화','오늘까지','연락 기록','next','open'],
   ['[서울 노원] 상계7단지','POUR솔루션 · 공종 미분류 · 이필선','미팅 일정 없음','CRM 연락 기록 없음 (이관 전 기록 확인 필요)','입대의 일정 확인 전화','내일까지','연락 기록','next','open'],
   ['전농아름숲','POUR솔루션 · 공종 미분류 · 정정훈','미팅 일정 없음','최근 연락 시도 '+d5[0]+' · 연결됨','방문 일정 확정',due5[1]+'까지','일정 등록','next','open'],
   ['[경기 인천] 삼보','POUR솔루션 · 공종 미분류 · 미배정','담당자 미지정','CRM 연락 기록 없음 (이관 전 기록 확인 필요)','담당자 배정','기한 없음 · 정하기','담당 배정','owner','open'],
   ['한강제이타워','POUR솔루션 · 공종 미분류 · 정정훈','미팅 일정 없음','CRM 연락 기록 없음 (이관 전 기록 확인 필요)','첫 통화에서 미팅 날짜 잡기','판정 불가 · 기한 계산 안 함','연락처 찾기','contact','open']]);
  /* 판정 하나(2026-10-06 집계 · 판정 정리 ② ③ ④): 다음 업무 아래 '판정: 근거', 현재 상황 아래 '최근 실제 연결 / 실제 연결 없음' */
  assert.deepEqual(await L.locator('.prv-row').evaluateAll(l=>l.map(r=>[((r.querySelector('.prv-c>small.why')||{}).textContent||'').replace(/[\d.]+/g,'D'),r.querySelector('.prv-b>small.cn').textContent.replace(/[\d.]+/g,'D')])),[['판정: 다음 행동일 D','실제 연결 없음'],['판정: 다음 행동일 D','실제 연결 없음'],['판정: 다음 행동일 D','실제 연결 없음'],['판정: 다음 행동일 D','최근 실제 연결 D'],['판정: 판정 불가 · 미팅 · 연락 기록 없음(이관 전 기록 확인) → 데이터 검토에서 이관 전 기록 확인','실제 연결 없음'],['판정: 판정 불가 · 미팅 · 연락 기록 없음(이관 전 기록 확인) → 데이터 검토에서 이관 전 기록 확인','실제 연결 없음']].map((x,i)=>i===4?['','실제 연결 없음']:x)/* 미배정 줄은 담당 배정이 먼저 — 판정 줄 없음 */,'판정 줄 · 실제 연결 줄');
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#pipeline-stage-v3 .prv-more,#pipeline-stage-v3 .prv-main,#pipeline-stage-v3 [data-ps3="toggle"]').length),0,'펼침 칸 · 펼침 누름이 없다');
  /* 강조색은 빨강 하나: 기한 지남 · 미배정. 왼쪽 3px 브랜드 띠 · 흰 버튼 120px 칸 · 줄 높이 */
  const css=await page.evaluate(()=>{const R=[...document.querySelectorAll('#pipeline-stage-v3 .prv-row')],cs=(n,p)=>getComputedStyle(n)[p];
   return [cs(R[0].querySelector('.prv-c>small'),'color'),cs(R[1].querySelector('.prv-c>small'),'color'),cs(R[4].querySelector('.prv-c>small'),'color'),cs(R[4].querySelector('.prv-a i'),'color'),cs(R[0].querySelector('.prv-a i'),'color'),
    cs(R[0],'borderLeftColor'),cs(R[0],'borderLeftWidth'),cs(R[1],'borderLeftColor'),cs(R[0].querySelector(':scope>button'),'backgroundColor'),Math.round(R[0].querySelector(':scope>button').getBoundingClientRect().width),cs(R[0].querySelector('.prv-a>b'),'fontSize'),
    Math.max(...R.map(r=>Math.round(r.getBoundingClientRect().height)))<=92/* 세 줄 글(상태 · 시도 · 실제 연결 / 업무 · 기한 · 판정 — 2026-10-06 집계 정리) + 안쪽 여백 26 + 밑줄 1 */,cs(R[0],'cursor')];});
  assert.deepEqual(css,['rgb(180, 35, 24)','rgb(107, 114, 128)','rgb(156, 163, 175)','rgb(180, 35, 24)','rgb(107, 114, 128)','rgb(232, 89, 12)','3px','rgb(31, 157, 85)','rgb(255, 255, 255)',120,'14.5px',true,'pointer']);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'pipe-v11.png')});
  /* ③ 줄을 누르면 바로 그 영업건 상세(예전 입력 창 없음) */
  await L.locator('.prv-row').first().click();await page.waitForSelector('#detailView.on.dv3');
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.id,document.querySelectorAll('#detailView .dvt-calling,#detailAction').length]),['11111111-1111-4111-8111-111111111111',0]);
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  /* ④ 위 상태 탭 · 왜 멈춰 있나를 누르면 이 목록이 걸러진다(기존 동작) */
  await V.locator('.ps3-reason',{hasText:'다음 행동 · 날짜 없음'}).click();await page.waitForTimeout(200);/* stage7 ①: 사유에 '물량 산출 기한 넘김'이 들어와 번호 대신 이름으로 */
  assert.deepEqual([(await L.locator('.prv-row .prv-a>b').allInnerTexts()).map(one),one(await V.locator('.ps3-lhead>b').innerText())],[['[경기 인천] 삼보','한강제이타워'],'확인할 현장 2곳'],'다음 행동 · 날짜 없음 = 2곳');
  await V.locator('[data-ps3="clear"]').click();await page.waitForTimeout(200);
  /* ⑤ 버튼 = 새 상세의 그 자리 */
  await L.locator('.prv-row').nth(1).locator(':scope>button').click();await page.waitForSelector('#detailView.dv3 #ddvComposer.dvt-calling',{timeout:5000});
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.site,document.querySelectorAll('#detailAction,.dp-next').length]),['새빛파크뷰',0],'연락 기록 = 가운데 입력칸');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  await L.locator('.prv-row').nth(5).locator(':scope>button').click();await page.waitForSelector('#detailView.on.dv3');await page.waitForTimeout(700);
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.site,!!document.querySelector('#detailView .dw-center>.dv3-cpanel:not([hidden])')]),['한강제이타워',true],'연락처 찾기 = 상세의 연락처 등록 칸');
  await page.evaluate(()=>{try{DealPanelsV2.close();}catch(e){}closeDetail();});await page.waitForTimeout(200);
  /* ⑥ 보드는 그대로(카드) */
  await V.locator('.ps3-views [data-v="board"]').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#pipeline-stage-v3 .ps3-card').length,document.querySelectorAll('#pipeline-stage-v3 .prv-row').length]),[6,0]);
  await V.locator('.ps3-views [data-v="list"]').click();await page.waitForTimeout(200);
  /* 끄기: G.pipeRowV11Off → 예전 줄 */
  await page.evaluate(()=>{G.pipeRowV11Off=true;paint();});await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#pipeline-stage-v3 .prv-row,#pipeline-stage-v3 .prv-head').length,document.querySelectorAll('#pipeline-stage-v3 .ps3-row .ps3-a').length]),[0,6]);
  await page.evaluate(()=>{G.pipeRowV11Off=false;paint();});await page.waitForSelector('#pipeline-stage-v3 .prv-list .prv-row');
  /* ⑦ 수주 · 실주도 같은 줄 구조(위 진단은 그 화면 그대로) · 줄 = 바로 상세 */
  /* stage7 ⑥⑦: 끝 상태 줄 = '확인 필요 · 기한 아님'(정보 보완 · 주황) */
  for(const [key,want] of [['won',['[경기 용인] 가람마을아파트','석민이앤씨 · 공종 미분류 · 황윤선','CRM 연락 기록 없음 (이관 전 기록 확인 필요)','확인 필요 · 기한 아님','수주 정보']],['lost',['[경기 수원] 선경빌','석민이앤씨 · 공종 미분류 · 황윤선','CRM 연락 기록 없음 (이관 전 기록 확인 필요)','확인 필요 · 기한 아님','사유 기록']]]){
   await page.evaluate(k=>PipelineWorkspace.open(k),key);await page.waitForSelector('#pipeline-stage-v3 .prv-list .prv-row');await page.waitForTimeout(200);
   const b=page.locator('#pipeline-stage-v3');
   assert.deepEqual([(await b.locator('.prv-head span').allInnerTexts()).map(one),await b.locator('.ps3-diag .ps3-box').count()>=1,await b.locator('.prv-row.ps3-row').count(),await b.locator('.prv-more,.prv-main').count()],[['현장 · 담당','현재 상황','다음 업무 · 기한',''],true,1,0],key+': 같은 줄 · 진단은 그대로 · 펼침 없음');
   assert.deepEqual(await b.locator('.prv-row').first().evaluate(r=>{const t=s=>r.querySelector(s).innerText.replace(/\s+/g,' ').trim();return [t('.prv-a>b'),t('.prv-a>span'),t('.prv-b>small'),t('.prv-c>small'),t(':scope>button')];}),want,key);
   assert.match(one(await b.locator('.prv-b>span').first().innerText()),key==='won'?/^수주 · \d{4}\.\d{1,2}\.\d{1,2} · 9,200만$/:/^실주 · \d{4}\.\d{1,2}\.\d{1,2}$/,key+': 줄 = 결과 · 날짜 · 금액(stage7)');
   assert.equal(one(await b.locator('.prv-b>small.base').first().innerText()),key==='won'?'수주 유형 · 낙찰금액 · 낙찰사 미기록':'실주 사유 미입력',key+': 기준일 줄 = 빠진 정보');
   assert.equal(await b.locator('.prv-c>small').first().evaluate(n=>n.classList.contains('amb')&&getComputedStyle(n).color),'rgb(138, 90, 0)',key+': 확인 필요는 주황');
   if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'pipe-v11-'+key+'.png')});
  }
  await page.locator('#pipeline-stage-v3 .prv-row').first().click();await page.waitForSelector('#detailView.on.dv3');
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.site),'[경기 수원] 선경빌','실주 줄을 누르면 그 영업건 상세');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  await page.locator('#pipeline-stage-v3 .prv-row>button').first().click();await page.waitForSelector('#detailView.on.dv3');
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.site),'[경기 수원] 선경빌','실주 줄의 버튼 = 그 영업건 상세');
  await page.evaluate(()=>{try{StageTransitionUI.close();}catch(e){}try{DetailActions.close(false);}catch(e){}closeDetail();});await page.waitForTimeout(200);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('pipeline row v11 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
