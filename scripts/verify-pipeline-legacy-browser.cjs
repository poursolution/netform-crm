'use strict';
/* 과거 이관 · 분류 전 정리안 (2026-10-06 design_handoff_legacy · 시안 '과거 이관 정리안.dc.html') — 합성 자료(이름 · 번호는 지어낸 것) + 가짜 서버 함수
   확인: 제목 줄 숫자 3개(큰 안내 상자 없음) / 담당자별 재개 카드(요청 · 담당 없음 배정 · 카드 = 필터) / 탭 4개 + 예전 단계 선택칸(같은 집계) / v11 모양 줄 · 버튼(영업 재개 · 담당 배정 · 서버 보완 요청)
        / 줄을 누르면 바로 상세(펼침 없음) / 묶음 요청 = 한 건씩 요청 엔진 · 받는 쪽은 한 카드 / 삭제 = 상세 [···] 메뉴 · 서버 확인 뒤에만 빠짐 · 거절 문장 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.PipelineScope&&window.PipelineLegacy&&window.PipelineWorkspace&&window.PipelineRowV11&&window.DealDiscard&&window.WorkRequest&&window.DealDetailV3&&window.OpsStore&&typeof goPage==='function');
  await page.evaluate(()=>{
   const U=n=>'aaaaaaaa-0000-4000-8000-00000000000'+n;window.U=U;
   const deal=(n,site,code,owner,o)=>Object.assign({id:U(n),site,site_id:'s-'+n,assignee:owner,brand:'POUR솔루션',created:'2025-06-10',code,stage_code:code,amt:0,amount:0,activities:[],workItems:[],workSummary:'',version:3},o);
   B={deals:[
    deal(1,'[경기 수원] 창전삼성래미안','qualified','이필선',{created:'2025-04-02',brand:'',activities:[{id:'x1',type:'전화',note:'[전화 · 연결됨] 내년 검토',at:'2026-09-20T02:00:00Z'}],manager_name:'박소장',manager_mobile:'01000001111'}),
    deal(2,'[대전] 싸이언스빌','nurturing','황윤선',{created:'2025-01-15',brand:''}),
    deal(3,'[서울 성동] 행당대림아파트','qualified','황윤선',{created:'2026-03-03',brand:''}),
    deal(4,'[경기 고양] 일산후곡마을','potential','',{created:'2025-12-01',brand:'아파트스퀘어'}),
    deal(5,'[부산] 해운대롯데캐슬','qualified','',{created:'2025-06-20',brand:'석민이앤씨',activities:[{id:'x5',type:'메모',note:'옮겨 온 메모',at:'2025-06-21T02:00:00Z'}]}),
    deal(6,'영업기회 · 2c5cfb','','',{created:'2025-07-14',brand:'아파트스퀘어',code:'',stage:'',activities:[{id:'x6',type:'전화',note:'통화 완료 · 진행 중',at:'2026-09-02T02:34:00Z'}]}),
    deal(7,'사천청구타운','','',{created:'2025-08-01',brand:'POUR솔루션',code:'',stage:'경남지사 인계'}),
    deal(8,'[인천 연수] 송도더샵센트럴','nurturing','김성준',{created:'2025-10-10'}),/* CRM 명단에 없는 이름 */
    deal(9,'[서울 마포] 진행중인아파트','sent','이필선',{created:'2026-09-01'}),/* 운영 시작 전 등록 = 이관 자료(진행 단계라도 휴지통 가능) */
    deal(10,'[서울 송파] CRM에서새로만든건','sent','이필선',{created:'2026-10-05'})],/* 운영 시작 뒤 CRM 에서 만든 건 = 휴지통 없음 */
    inquiries:[],activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.pipeRepYear='전체';window.saveLocal=()=>{};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   window.__ops=[];window.queueDetailContactOperation=(op,payload,actionId)=>{const id='op-'+(__ops.length+1);__ops.push({id,op,payload,actionId});return id;};
   Phase1.queue.flush=async()=>{};Phase1.queue.list=()=>__ops.map(o=>({request_id:o.id,object_id:o.payload.opportunity_id,operation:o.op,status:'done',payload:o.payload,ack:{ok:true,operation:o.op,activity_id:'srv-'+o.id,next_action_id:'srv-'+o.id}}));
   /* 가짜 서버: 삭제 · 요청 만들기 · 요청 목록 — 서버 함수는 인자 이름이 p 하나다 */
   window.SRV={discard:[],reqs:[],deny:'',trash:[],restored:[]};
   SB={rpc:async(n,a)=>{const p=a&&a.p;if(!p||Object.keys(a).length!==1)return {error:{code:'PGRST202',message:'Could not find the function'}};
    if(n==='crm_deal_discard_v1'){SRV.discard.push(p);if(SRV.deny)return {error:{code:'PT409',message:SRV.deny}};const d=B.deals.find(x=>String(x.id)===String(p.deal_id));SRV.trash.unshift({deal_id:p.deal_id,site:d?d.site:'',brand:d?d.brand:'',stage_code:d?d.stage_code:'',owner:d?d.assignee:'',created:'2025-12-01T00:00:00Z',trashed_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*864e5).toISOString(),days_left:30,child_rows:2,by:'송보람',reason:p.reason});return {data:{ok:true,deal_id:p.deal_id,batch:'deal-trash-20261007',child_rows:2,expires_at:new Date(Date.now()+30*864e5).toISOString()}};}
    /* 휴지통 목록 · 복원(sql/deal-trash-v1-20261007.sql 과 같은 모양) */
    if(n==='crm_deal_trash_list_v1')return {data:{ok:true,total:SRV.trash.length,page:p.page||1,per:20,retention_days:30,purged:0,items:SRV.trash.slice(0,20)}};
    if(n==='crm_deal_restore_v1'){const i=SRV.trash.findIndex(x=>String(x.deal_id)===String(p.deal_id));if(i<0)return {error:{code:'P0002',message:'휴지통에 없는 자료입니다'}};SRV.restored.push(SRV.trash.splice(i,1)[0]);return {data:{ok:true,deal_id:p.deal_id,batch:'deal-trash-20261007',child_rows:2}};}
    if(n==='crm_work_request_create_v1'){if(SRV.reqs.some(r=>r.target_id===p.target_id&&r.kind===p.kind&&r.status==='sent'))return {error:{code:'23505',message:'이미 답을 기다리는 같은 요청이 있습니다'}};const r=Object.assign({id:'r'+(SRV.reqs.length+1),status:'sent',to_me:false,created_at:new Date().toISOString(),requested_by:'송보람'},p);SRV.reqs.push(r);return {data:{ok:true,request:r}};}
    if(n==='crm_work_request_list_v1')return {data:{ok:true,requests:SRV.reqs.map(r=>Object.assign({},r,{to_me:r.to_name===(ME&&ME.name)}))}};
    if(n==='crm_work_request_reply_v1'){const r=SRV.reqs.find(x=>x.id===p.id);if(r&&p.action==='done')r.status='done';if(r&&p.action==='seen'&&r.status==='sent')r.status='seen';return {data:{ok:true,request:r?Object.assign({},r,{to_me:r.to_name===(ME&&ME.name)}):null}};}/* 회신도 목록과 같이 to_me 를 돌려준다(서버와 같은 모양) */
    return {data:{ok:true,tasks:[],entries:[],sites:[]}};}};TOKEN='test';
   CRM_RPC_ALLOW=(window.CRM_RPC_ALLOW||[]).concat(['crm_deal_discard_v1','crm_deal_trash_list_v1','crm_deal_restore_v1']);
   PipelineScope._reset();goPage('pipe');PipelineWorkspace.open('legacy');
  });
  await page.waitForSelector('#pipeline-legacy .plg-row');await page.waitForTimeout(300);
  const L=page.locator('#pipeline-legacy');
  /* ① 제목 줄 숫자 3개 · 큰 안내 상자 없음 · 담당자별 재개 카드 */
  assert.equal(one(await L.locator('.plg-head').innerText()),'과거 이관 · 분류 전 예전 시스템에서 옮겨 온 자료 · 진행 건수 · 메이드율 계산에 안 들어감 전체 8 · 담당자 확인 대상 3 · 담당 배정 후 확인 5 · 서버 보완 필요 0 휴지통');
  assert.equal(await L.locator('.plg-note').count(),0,'큰 안내 상자 없음');
  assert.deepEqual(await L.locator('.plg-owner').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('span').textContent,n.querySelector('small').textContent,n.querySelector('button').textContent,n.querySelector('button').disabled])),
   [['황윤선','2건','확인 대상 2','2건 담당에게 재개 요청',false],['이필선','1건','확인 대상 1','1건 담당에게 재개 요청',false],['담당 없음','5건','배정 필요','담당 5건 배정하기',false]],'카드 = 명단 담당(확인 대상 수 순) + 담당 없음(담당 없음 · 명단에 없는 담당 · 단계 값이 비어 있는 건도 — 서버가 unclassified 출발을 받는다)');
  /* ② 탭 4개 + 예전 단계 선택칸 — 같은 집계 */
  assert.deepEqual((await L.locator('.plg-tabs [role="tab"]').allInnerTexts()).map(one),['전체 8','담당자 확인 대상 3','담당 없음 5','서버 보완 필요 0']);
  assert.deepEqual(await L.locator('select[data-plg="old"] option').evaluateAll(l=>l.map(o=>o.textContent)),['전체 8','검증된 고객 3','잠재고객 1','후속 관리 고객 2','경남지사 인계 1','단계 없음 1']);
  /* ③ v11 모양 줄: 정렬(서버 보완 불필요 → 명단 담당 → CRM 기록 → 최근) · 칸 글 · 버튼 */
  assert.deepEqual((await L.locator('.prv-head span').allInnerTexts()).map(one),['현장 · 브랜드','예전 단계 · 기존 담당','CRM 기록','']);
  const rows=await L.locator('.plg-row').evaluateAll(l=>l.map(r=>{const t=s=>r.querySelector(s).innerText.replace(/\s+/g,' ').trim();return [r.querySelector('.prv-a b').textContent,t('.prv-a span'),t('.prv-b'),t('.prv-c'),t(':scope>button'),r.dataset.cat];}));
  assert.deepEqual(rows,[
   ['[경기 수원] 창전삼성래미안','브랜드 미지정 · 예전 등록 2025.4','예전 단계 · 검증된 고객 기존 담당 이필선','CRM 기록 있음 지난 응대 이력 이어서 사용','영업 재개','ok'],
   ['[서울 성동] 행당대림아파트','브랜드 미지정 · 예전 등록 2026.3','예전 단계 · 검증된 고객 기존 담당 황윤선','CRM 기록 없음 기존 연락·결과·현재 추진 여부 확인','영업 재개','ok'],
   ['[대전] 싸이언스빌','브랜드 미지정 · 예전 등록 2025.1','예전 단계 · 후속 관리 고객 기존 담당 황윤선','CRM 기록 없음 기존 연락·결과·현재 추진 여부 확인','영업 재개','ok'],
   ['영업기회 · 2c5cfb','아파트스퀘어 · 예전 등록 2025.7','예전 단계 · 단계 없음 기존 담당 없음','CRM 기록 있음 지난 응대 이력 이어서 사용','담당 배정','noown'],
   ['[부산] 해운대롯데캐슬','석민이앤씨 · 예전 등록 2025.6','예전 단계 · 검증된 고객 기존 담당 없음','CRM 기록 있음 지난 응대 이력 이어서 사용','담당 배정','noown'],
   ['[경기 고양] 일산후곡마을','아파트스퀘어 · 예전 등록 2025.12','예전 단계 · 잠재고객 기존 담당 없음','CRM 기록 없음 기존 연락·결과·현재 추진 여부 확인','담당 배정','noown'],
   ['[인천 연수] 송도더샵센트럴','POUR솔루션 · 예전 등록 2025.10','예전 단계 · 후속 관리 고객 기존 담당 김성준 · CRM 명단에 없음','CRM 기록 없음 기존 연락·결과·현재 추진 여부 확인','담당 배정','noown'],
   ['사천청구타운','POUR솔루션 · 예전 등록 2025.8','예전 단계 · 경남지사 인계 기존 담당 없음','CRM 기록 없음 기존 연락·결과·현재 추진 여부 확인','담당 배정','noown']],'단계 값이 비어 있는 건(2c5cfb · 사천)도 서버 보완 대신 배정 → 영업 재개(출발 단계 unclassified)');
  const css=await page.evaluate(()=>{const R=[...document.querySelectorAll('#pipeline-legacy .plg-row')],cs=(n,p)=>getComputedStyle(n)[p];return [cs(R[4].querySelector('.prv-b>small'),'color'),cs(R[0].querySelector('.prv-b>small'),'color'),cs(R[4],'borderLeftColor'),Math.round(R[0].querySelector(':scope>button').getBoundingClientRect().width),cs(R[0].querySelector(':scope>button'),'backgroundColor')];});
  assert.deepEqual(css,['rgb(180, 35, 24)','rgb(156, 163, 175)','rgb(232, 89, 12)',120,'rgb(255, 255, 255)'],'담당 없음 빨강 · 브랜드 띠 · 흰 버튼 120px');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'legacy-v2.png')});
  /* 카드 = 필터(다시 누르면 해제) · 선택칸 · 탭 */
  await L.locator('.plg-owner',{hasText:'황윤선'}).locator('.t').click();await page.waitForTimeout(200);
  if(process.env.DIAG)console.log(JSON.stringify(await page.evaluate(()=>[G.plg.owner,G.plg.busy,G.plg.tab,G.plg.old,SRV.reqs.length,[...document.querySelectorAll('#pipeline-legacy .plg-row')].map(r=>r.dataset.cat+':'+r.querySelector('.prv-b small').textContent)])));
  assert.deepEqual([(await L.locator('.plg-row .prv-a b').allInnerTexts()),(await L.locator('.plg-tabs [role="tab"]').allInnerTexts()).map(one),await L.locator('[data-plg="owner-clear"]').count()],[['[서울 성동] 행당대림아파트','[대전] 싸이언스빌'],['전체 2','담당자 확인 대상 2','담당 없음 0','서버 보완 필요 0'],1]);
  await L.locator('.plg-owner',{hasText:'황윤선'}).locator('.t').click();await page.waitForTimeout(200);assert.equal(await L.locator('.plg-row').count(),8);
  await L.locator('.plg-tabs [data-v="fix"]').click();await page.waitForTimeout(200);assert.deepEqual(await L.locator('.plg-row .prv-a b').allInnerTexts(),[],'서버가 unclassified 출발을 받으므로 서버 보완 필요 건은 없다');
  await L.locator('.plg-tabs [data-v="all"]').click();await L.locator('select[data-plg="old"]').selectOption('검증된 고객');await page.waitForTimeout(200);
  assert.deepEqual((await L.locator('.plg-row .prv-a b').allInnerTexts()),['[경기 수원] 창전삼성래미안','[서울 성동] 행당대림아파트','[부산] 해운대롯데캐슬']);
  await L.locator('select[data-plg="old"]').selectOption('all');await page.waitForTimeout(200);
  /* ④ 줄을 누르면 바로 그 영업건 상세(펼침 없음) */
  assert.equal(await L.locator('.prv-more,.prv-main,[data-plg="toggle"]').count(),0,'펼침 칸 · 펼침 누름이 없다');
  await L.locator('.plg-row').nth(3).click();await page.waitForSelector('#detailView.on.dv3');
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.id===U(6),document.getElementById('detailView').classList.contains('dv3-legacy')]),[true,true]);
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(250);
  /* ⑥ 버튼: [영업 재개] = 상세의 단계 바꾸기 띠 · [담당 배정] = 담당 정하는 칸 · [서버 보완 요청] = 응대 이력 내부 메모 */
  await L.locator('.plg-row').first().locator(':scope>button').click();await page.waitForSelector('#detailView.dv3 .dv3-move:not([hidden])',{timeout:5000});
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.id===U(1),document.getElementById('detailView').classList.contains('dv3-legacy'),document.querySelector('#pipeline-legacy .plg-row.dn>button').textContent]),[true,true,'재개 중']);
  await page.evaluate(()=>{try{StageTransitionUI.close();}catch(e){}closeDetail();});await page.waitForTimeout(250);
  await L.locator('.plg-row[data-cat="noown"]').first().locator(':scope>button').click();await page.waitForSelector('#detailView.on.dv3');await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>[CUR_DETAIL.item.id===U(6),!!document.querySelector('#detailView .dw-center>.dv3-cpanel:not([hidden])')]),[true,true],'담당 배정 = 상세의 담당 정하는 칸(첫 담당 없음 줄 = 단계 값이 비어 있는 2c5cfb)');
  await page.evaluate(()=>{try{DetailActions.close(false);}catch(e){}closeDetail();});await page.waitForTimeout(250);
  /* 단계 값이 비어 있는 건: 출발 단계 = unclassified(서버 sql/transition-null-stage-v1-20261007.sql) → 상세의 띠는 '영업 재개' · 전환 후보가 있다 */
  assert.equal(await L.locator('.plg-row[data-cat="fix"]').count(),0,'서버 보완 요청 줄이 없다');
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals.find(x=>x.id===U(6))));});await page.waitForSelector('#detailView.on.dv3');await page.waitForTimeout(400);
  const nul=await page.evaluate(()=>[PipelineScope.fromCode(CUR_DETAIL.item),PipelineScope.canResume(CUR_DETAIL.item),StageTransition.choices('unclassified').length>0,StageTransition.choices('unclassified').includes('won'),document.getElementById('detailView').classList.contains('dv3-legacy'),String((document.querySelector('#detailView .dv3-headact .mv')||{}).textContent||'').replace(/\s*▾\s*$/,'')]);
  if(process.env.DUMP)require('fs').writeFileSync(process.env.DUMP,JSON.stringify(nul));
  assert.deepEqual(nul,['unclassified',true,true,false,true,'영업 재개'],'단계 값이 비어 있는 과거 이관 건도 영업 재개 띠 · 출발 단계 unclassified');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(250);
  /* ⑦ 담당 카드 [n건 담당에게 재개 요청]: 요청 엔진으로 한 건씩(중복은 건너뜀) · 받는 쪽 오늘 업무에는 한 묶음 카드 · 단계가 정해지면 자동 완료 */
  await L.locator('.plg-owner',{hasText:'황윤선'}).locator('button').click();await page.waitForTimeout(900);
  /* 카드 버튼은 마우스 좌표로 누른다(위치 지정 클릭 — 카드 전체가 role=button 이라 Playwright 의 요소 클릭이 카드로 잡히는 일이 있었다) */
  const mouseClick=async loc=>{const bb=await loc.boundingBox();await page.mouse.click(bb.x+bb.width/2,bb.y+bb.height/2);};
  await mouseClick(L.locator('.plg-owner',{hasText:'황윤선'}).locator('button'));await page.waitForFunction(()=>SRV.reqs.length===2);await page.waitForTimeout(400);
  await page.waitForFunction(()=>SRV.reqs.length===2);await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>[SRV.reqs.map(r=>[r.target_id===U(3)||r.target_id===U(2),r.kind,r.label,r.to_name,r.to_scope,r.asks,r.due_label]),document.querySelector('#pipeline-legacy .plg-sent').textContent]),
   [[[true,'follow','과거 자료 재개','황윤선','user',['과거 연락·결과·현재 추진 여부 확인 후 재개 판단'],'내일 12시'],[true,'follow','과거 자료 재개','황윤선','user',['과거 연락·결과·현재 추진 여부 확인 후 재개 판단'],'내일 12시']],'황윤선님 오늘 업무에 「과거 자료 재개 2건」 요청을 보냈습니다 · 하나씩 단계 · 다음 행동 · 날짜를 정하면 진행 건이 됩니다']);
  await L.locator('.plg-owner',{hasText:'황윤선'}).locator('button').click();await page.waitForTimeout(400);
  assert.match(one(await L.locator('.plg-sent').innerText()),/「과거 자료 재개 0건」 요청을 보냈습니다 .* 이미 요청한 2건 제외$/,'같은 건은 다시 보내지 않는다');
  /* 받는 사람(황윤선)으로 오늘 업무를 열면 한 카드 */
  await page.evaluate(()=>{ME={id:'hwang',name:'황윤선',role:'rep'};});await page.waitForFunction(()=>!WorkRequest.state().busy);await page.evaluate(()=>WorkRequest.load(true));
  await page.waitForFunction(()=>WorkRequest.state().list.filter(r=>r.to_me).length===2);await page.evaluate(()=>goPage('today'));await page.waitForTimeout(800);
  if(process.env.DIAG)console.log('TODAY-DIAG',JSON.stringify(await page.evaluate(()=>[G.page,TodayV3&&TodayV3.enabled(),!!document.querySelector('#today-v2 .tv3'),document.querySelector('#today-v2')&&document.querySelector('#today-v2').className,WorkRequest.enabled(),WorkRequest.state().list.map(r=>[r.to_me,r.status,r.label,r.to_name]),document.querySelectorAll('#pg-today .wrq-in').length,document.querySelectorAll('#pg-today .wrq-top').length,(document.querySelector('#pg-today')||{}).className,ME.name,ME.role])));
  await page.waitForSelector('#pg-today .wrq-in.wrq-legacy');
  assert.deepEqual(await page.evaluate(()=>{const c=document.querySelector('#pg-today .wrq-in.wrq-legacy');return [document.querySelectorAll('#pg-today .wrq-in').length,c.querySelector('.hd b').textContent,[...c.querySelectorAll('.wrq-lg>div b')].map(n=>n.textContent).sort(),[...c.querySelectorAll('.wrq-lg button')].map(n=>n.textContent)];}),[1,'과거 자료 재개 2건',['[대전] 싸이언스빌','[서울 성동] 행당대림아파트'],['영업 재개','영업 재개']]);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'legacy-v2-today.png')});
  await page.locator('#pg-today .wrq-lg button').first().click();await page.waitForSelector('#detailView.dv3 .dv3-move:not([hidden])',{timeout:5000});
  assert.equal(await page.evaluate(()=>[U(2),U(3)].includes(CUR_DETAIL.item.id)),true,'[영업 재개] = 그 건 상세의 단계 바꾸기');
  await page.evaluate(()=>{try{StageTransitionUI.close();}catch(e){}closeDetail();});
  /* 단계가 정해진 건(과거 이관에서 벗어남)은 요청이 자동 완료된다 */
  await page.evaluate(async()=>{const d=B.deals.find(x=>x.id===U(3));d.code='first_contact';d.stage_code='first_contact';WorkRequest.autoClose();await new Promise(r=>setTimeout(r,300));paint();});await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>[SRV.reqs.map(r=>r.status),[...document.querySelectorAll('#pg-today .wrq-lg>div b')].map(n=>n.textContent)]),[['seen','done'],['[대전] 싸이언스빌']]);/* 요청은 자료 순서대로 싸이언스빌 → 행당대림. 행당대림은 단계를 정해 완료, 싸이언스빌은 받는 사람이 화면을 열어 '담당 확인' 상태로 남음 */
  /* ⑧ 상세 [···] 메뉴: 과거 이관 건에만 '이 자료 삭제' */
  await page.evaluate(()=>{ME={id:'adm',name:'송보람',role:'admin'};goPage('pipe');PipelineWorkspace.open('legacy');});await page.waitForSelector('#pipeline-legacy .plg-row');
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals.find(x=>x.id===U(4))));});await page.waitForSelector('#detailView.on.dv3 .tf-more');await page.locator('#detailView .tf-more').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('#detailView .tf-menu [data-tf="m-discard"]').count(),1);
  await page.evaluate(()=>{window.confirm=()=>true;SRV.deny='계약실적이 연결된 자료는 삭제할 수 없습니다';});await page.locator('#detailView .tf-menu [data-tf="m-discard"]').click();await page.waitForFunction(()=>SRV.discard.length===1);await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>[B.deals.some(x=>x.id===U(4)),document.getElementById('detailView').classList.contains('on'),SRV.discard[0].deal_id===U(4),SRV.discard[0].expected_version,SRV.discard[0].reason]),[true,true,true,3,'상세 창에서 삭제'],'서버가 거절하면 화면 자료 · 창은 그대로');
  await page.evaluate(()=>{SRV.deny='';});await page.locator('#detailView .tf-more').click();await page.waitForTimeout(150);await page.locator('#detailView .tf-menu [data-tf="m-discard"]').click();await page.waitForFunction(()=>!B.deals.some(x=>x.id===U(4)));await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>[document.getElementById('detailView').classList.contains('on'),SRV.discard.length,document.querySelectorAll('#pipeline-legacy .plg-row').length,document.querySelector('#pipeline-legacy .plg-head').innerText.replace(/\s+/g,' ').trim().replace(/^[\s\S]*?(?=전체 \d)/,'')]),[false,2,6,'전체 6 · 담당자 확인 대상 2 · 담당 배정 후 확인 4 · 서버 보완 필요 0 휴지통'],'서버 확인 뒤 창이 닫히고 목록 · 숫자에서 빠진다(행당대림은 단계를 정해 떠났고 일산후곡은 지웠다)');
  /* 2026-10-07 대표: 파이프라인 단계로 이관된 건(운영 시작 전 등록)도 휴지통으로 · CRM 에서 새로 만든 건은 아님 */
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals.find(x=>x.id===U(9))));});await page.waitForSelector('#detailView.on.dv3 .tf-more');await page.locator('#detailView .tf-more').click();await page.waitForTimeout(150);
  assert.deepEqual([await page.locator('#detailView .tf-menu [data-tf="m-discard"]').count(),one(await page.locator('#detailView .tf-menu [data-tf="m-discard"]').innerText())],[1,'휴지통으로 보내기'],'이관 자료는 진행 단계라도 휴지통으로 보낼 수 있다');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals.find(x=>x.id===U(10))));});await page.waitForSelector('#detailView.on.dv3 .tf-more');await page.locator('#detailView .tf-more').click();await page.waitForTimeout(150);
  assert.equal(await page.locator('#detailView .tf-menu [data-tf="m-discard"]').count(),0,'CRM 에서 새로 만든 진행 건에는 휴지통이 없다');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  /* ⑨ 휴지통(deal-trash.js): 과거 이관 머리 [휴지통] → 보낸 건 목록(남은 일수 · 보낸 사람 · 사유) → [복원] → 서버 확인 뒤 목록에서 빠진다 */
  await page.evaluate(()=>{window.loadData=()=>{};goPage('pipe');PipelineWorkspace.open('legacy');});await page.waitForSelector('#pipeline-legacy .plg-row');
  assert.equal(await L.locator('.plg-head .plg-trash').count(),1,'관리자에게 휴지통 진입');
  await L.locator('.plg-head .plg-trash').click();await page.waitForSelector('#dealTrash .dtr-row');
  const tr=await page.evaluate(()=>{const w=document.getElementById('dealTrash'),r=w.querySelector('.dtr-row'),t=s=>r.querySelector(s).innerText.replace(/\s+/g,' ').trim();return [w.querySelector('.dtr-hd .n').textContent,t('.dtr-a b'),t('.dtr-b'),t('.dtr-c'),t('.dtr-d'),r.querySelector('button').textContent,document.querySelectorAll('#dealTrash .dtr-row').length];});
  const trashDates=await page.evaluate(()=>[SRV.trash[0].trashed_at,SRV.trash[0].expires_at]);
  const ymd=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d)).split('-').map(Number).join('.');
  assert.deepEqual(tr,['1건','[경기 고양] 일산후곡마을','잠재고객 담당 없음 · 함께 보관 2건',ymd(trashDates[0])+' 송보람 상세 창에서 삭제','남은 30일 '+ymd(trashDates[1])+' 자동 삭제','복원',1],'휴지통 줄 = 현장 · 예전 단계 · 담당 · 보낸 날 · 사람 · 사유 · 남은 일수');
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'legacy-trash.png')});
  await page.evaluate(()=>{window.confirm=()=>true;});await page.locator('#dealTrash .dtr-row button').click();await page.waitForFunction(()=>SRV.restored.length===1);await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(()=>[SRV.restored[0].deal_id===U(4),document.querySelectorAll('#dealTrash .dtr-row').length,(document.querySelector('#dealTrash .dtr-empty')||{}).textContent]),[true,0,'휴지통이 비어 있습니다'],'복원 = 서버 확인 뒤 목록에서 빠진다');
  await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(await page.locator('#dealTrash').count(),0,'Esc 로 닫힘');
  await page.evaluate(()=>{ME={id:'hwang',name:'황윤선',role:'rep'};paint();});await page.waitForTimeout(300);assert.equal(await page.locator('#pipeline-legacy .plg-trash').count(),0,'영업사원에게는 휴지통 진입이 없다');
  await page.evaluate(()=>{ME={id:'adm',name:'송보람',role:'admin'};paint();});
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('pipeline legacy ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
