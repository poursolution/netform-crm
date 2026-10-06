'use strict';
/* 파이프라인 단계별 화면 · '확인할 현장' 목록 줄 v11 (2026-10-06 design_handoff_pipeline_v11) — 합성 자료(이름 · 번호는 지어낸 것)
   확인: 칸 이름 줄 + 4칸 줄(현장 · 담당 / 현재 상황 / 다음 업무 · 기한 / 버튼) · 기한 급한 순 · 미배정 빨강 · 기한 글 · 버튼 = 업무 동사
        / 줄을 누르면 그 줄 아래 펼침(한 번에 한 줄 · 접수일 · 유입 경로 · 연락처 · 단계 진입 후 · 공사 예정 · 결정 상황 · AI 추천 근거 + [전화] [상세 열기 ↗])
        / 버튼 = 새 상세의 그 자리로 / 위 상태 탭 · 왼쪽 진단 · 리스트/보드는 그대로 / 수주 · 실주도 같은 줄 / 끄기 G.pipeRowV11Off */
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
  /* ② 칸 이름 줄 + 4칸 줄 · 기한 급한 순(지난 것 → 오늘 → 내일 → 날짜 → 기한 없음) */
  assert.deepEqual((await L.locator('.prv-head span').allInnerTexts()).map(one),['현장 · 담당','현재 상황','다음 업무 · 기한','']);
  const d2=await ymd(-39),d5=await ymd(-37),due5=await ymd(4);
  const rows=await L.locator('.prv-row').evaluateAll(l=>l.map(r=>{const t=s=>{const n=r.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;};return [t('.prv-a>b'),t('.prv-a>span'),t('.prv-b>span'),t('.prv-b>small'),t('.prv-c>b'),t('.prv-c>small'),t('.prv-main>button'),r.querySelector('.prv-main>button').dataset.v];}));
  assert.deepEqual(rows,[
   ['[경기 용인] 가람마을아파트','석민이앤씨 · 공종 미분류 · 황윤선','미팅 일정 없음','CRM 연락 기록 없음','관리소장 첫 통화','3일 지남','연락 기록','next'],
   ['새빛파크뷰','POUR솔루션 · 공종 미분류 · 이승우','미팅 일정 없음','최근 연락 '+d2[0],'관리과장 재통화','오늘까지','연락 기록','next'],
   ['[서울 노원] 상계7단지','POUR솔루션 · 공종 미분류 · 이필선','미팅 일정 없음','CRM 연락 기록 없음','입대의 일정 확인 전화','내일까지','연락 기록','next'],
   ['전농아름숲','POUR솔루션 · 공종 미분류 · 정정훈','미팅 일정 없음','최근 연락 '+d5[0],'방문 일정 확정',due5[1]+'까지','일정 등록','next'],
   ['[경기 인천] 삼보','POUR솔루션 · 공종 미분류 · 미배정','담당자 미지정','CRM 연락 기록 없음','담당자 배정','기한 없음 · 정하기','담당 배정','owner'],
   ['한강제이타워','POUR솔루션 · 공종 미분류 · 정정훈','미팅 일정 없음','CRM 연락 기록 없음','첫 통화에서 미팅 날짜 잡기','기한 없음 · 정하기','연락처 찾기','contact']]);
  /* 강조색은 빨강 하나: 기한 지남 · 미배정. 왼쪽 3px 브랜드 띠 · 흰 버튼 120px 칸 */
  const css=await page.evaluate(()=>{const R=[...document.querySelectorAll('#pipeline-stage-v3 .prv-row')],cs=(n,p)=>getComputedStyle(n)[p];
   return [cs(R[0].querySelector('.prv-c>small'),'color'),cs(R[1].querySelector('.prv-c>small'),'color'),cs(R[4].querySelector('.prv-c>small'),'color'),cs(R[4].querySelector('.prv-a i'),'color'),cs(R[0].querySelector('.prv-a i'),'color'),
    cs(R[0],'borderLeftColor'),cs(R[0],'borderLeftWidth'),cs(R[1],'borderLeftColor'),cs(R[0].querySelector('.prv-main>button'),'backgroundColor'),Math.round(R[0].querySelector('.prv-main>button').getBoundingClientRect().width),cs(R[0].querySelector('.prv-a>b'),'fontSize'),
    Math.max(...R.map(r=>Math.round(r.querySelector('.prv-main').getBoundingClientRect().height)))<=70];});
  assert.deepEqual(css,['rgb(180, 35, 24)','rgb(107, 114, 128)','rgb(156, 163, 175)','rgb(180, 35, 24)','rgb(107, 114, 128)','rgb(232, 89, 12)','3px','rgb(31, 157, 85)','rgb(255, 255, 255)',120,'14.5px',true]);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'pipe-v11.png')});
  /* ③ 줄을 누르면 그 줄 아래 펼침 · 한 번에 한 줄 */
  await L.locator('.prv-row').first().locator('.prv-main').click();await page.waitForSelector('#pipeline-stage-v3 .prv-row.open .prv-more');
  const ym=await page.evaluate(()=>{const m=/^(\d{4})-(\d{2})/.exec(DAY(-380));return m[1]+'.'+Number(m[2]);}),rec=await ymd(-41);
  const more=await L.locator('.prv-more>div:not(.prv-foot)').evaluateAll(l=>l.map(n=>[n.querySelector('span').textContent,n.querySelector('b').textContent,n.querySelector('b').className]));
  assert.deepEqual(more,[['접수일',rec[0],''],['유입 경로','인바운드',''],['연락처','이영수 관리소장 · 010-0000-1234',''],['단계 진입 후','41일','r'],['공사 예정','미확인','g'],['결정 상황','미확인','g'],
   ['AI 추천 근거','기존 고객('+ym+' 수주) · 지난 공사 안부로 시작 · 미팅 일정 없음 · 필수 확인 미입력 · 30일 넘게 머묾',''],['예상 금액','금액 미정','g'],['영업건 번호','#111111','']]);
  assert.deepEqual(await L.locator('.prv-foot').evaluate(f=>[...f.children].map(n=>[n.tagName,n.textContent,n.getAttribute('href')])),[['A','전화 010-0000-1234','tel:01000001234'],['BUTTON','상세 열기 ↗',null]]);
  assert.equal(await page.evaluate(()=>!!window.CUR_DETAIL&&document.getElementById('detailView').classList.contains('on')),false,'줄을 눌러도 상세가 열리지 않는다');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'pipe-v11-open.png')});
  await L.locator('.prv-row').nth(3).locator('.prv-main').click();await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#pipeline-stage-v3 .prv-row')].map(r=>r.classList.contains('open'))),[false,false,false,true,false,false],'한 번에 한 줄');
  assert.deepEqual(await L.locator('.prv-more>div:not(.prv-foot)').evaluateAll(l=>l.slice(4,6).map(n=>n.querySelector('b').textContent)),['2026년 10~11월','관리소장'],'공사 예정 · 결정 상황은 그 건의 기록에서');
  await L.locator('.prv-row').nth(3).locator('.prv-main').click();await page.waitForTimeout(200);assert.equal(await L.locator('.prv-more').count(),0,'다시 누르면 접힌다');
  /* ④ 위 상태 탭 · 왜 멈춰 있나를 누르면 이 목록이 걸러진다(기존 동작) */
  await V.locator('.ps3-reason').nth(2).click();await page.waitForTimeout(200);
  assert.deepEqual([(await L.locator('.prv-row .prv-a>b').allInnerTexts()).map(one),one(await V.locator('.ps3-lhead>b').innerText())],[['[경기 인천] 삼보','한강제이타워'],'확인할 현장 2곳'],'다음 행동 · 날짜 없음 = 2곳');
  await V.locator('[data-ps3="clear"]').click();await page.waitForTimeout(200);
  /* ⑤ [상세 열기 ↗] · 버튼 = 새 상세의 그 자리 */
  await L.locator('.prv-row').first().locator('.prv-main').click();await L.locator('[data-ps3="detail"]').click();await page.waitForSelector('#detailView.on.dv3');
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.id,document.querySelectorAll('#detailView .dvt-calling,#detailAction').length]),['11111111-1111-4111-8111-111111111111',0]);
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  await L.locator('.prv-row').nth(1).locator('.prv-main>button').click();await page.waitForSelector('#detailView.dv3 #ddvComposer.dvt-calling',{timeout:5000});
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.site,document.querySelectorAll('#detailAction,.dp-next').length]),['새빛파크뷰',0],'연락 기록 = 가운데 입력칸');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  await L.locator('.prv-row').nth(5).locator('.prv-main>button').click();await page.waitForSelector('#detailView.on.dv3');await page.waitForTimeout(700);
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
  /* ⑦ 수주 · 실주도 같은 줄 구조(위 진단은 그 화면 그대로) */
  for(const [key,want] of [['won',['[경기 용인] 가람마을아파트','석민이앤씨 · 공종 미분류 · 황윤선','CRM 연락 기록 없음','기한 없음 · 정하기','연도 확인']],['lost',['[경기 수원] 선경빌','석민이앤씨 · 공종 미분류 · 황윤선','CRM 연락 기록 없음','기한 없음 · 정하기','사유 기록']]]){
   await page.evaluate(k=>PipelineWorkspace.open(k),key);await page.waitForSelector('#pipeline-stage-b .prv-list .prv-row');await page.waitForTimeout(200);
   const b=page.locator('#pipeline-stage-b');
   assert.deepEqual([(await b.locator('.prv-head span').allInnerTexts()).map(one),await b.locator('.psb-diag .psb-box').count()>=1,await b.locator('.prv-row.psb-row').count()],[['현장 · 담당','현재 상황','다음 업무 · 기한',''],true,1],key+': 같은 줄 · 진단은 그대로');
   assert.deepEqual(await b.locator('.prv-row').first().evaluate(r=>{const t=s=>r.querySelector(s).innerText.replace(/\s+/g,' ').trim();return [t('.prv-a>b'),t('.prv-a>span'),t('.prv-b>small'),t('.prv-c>small'),t('.prv-main>button')];}),want,key);
   assert.match(one(await b.locator('.prv-b>span').first().innerText()),key==='won'?/^차기 공사 미확인 · /:/^실주 사유 미입력 · \d{1,2}\/\d{1,2} 실주$/);
   await b.locator('.prv-main').first().click();await page.waitForSelector('#pipeline-stage-b .prv-row.open .prv-more');
   assert.deepEqual(await b.locator('.prv-more>div:not(.prv-foot)').evaluateAll(l=>l.map(n=>n.querySelector('span').textContent)),['접수일','유입 경로','연락처','단계 진입 후','공사 예정','결정 상황','AI 추천 근거',key==='won'?'수주 금액':'예상 금액','영업건 번호']);
   if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'pipe-v11-'+key+'.png')});
  }
  await page.locator('#pipeline-stage-b .prv-main>button').first().click();await page.waitForSelector('#detailView.on.dv3');
  assert.equal(await page.evaluate(()=>CUR_DETAIL.item.site),'[경기 수원] 선경빌','실주 줄의 버튼 = 그 영업건 상세');
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('pipeline row v11 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
