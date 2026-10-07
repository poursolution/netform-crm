/* 결정 일정 · 협업(2026-10-07 design_handoff_decision_collab ①~⑤) — decision-collab.js
   확인: 표식 읽기(결정 일정 · 막힌 곳 · 진척 · 하자 · 확인) → 상세 오른쪽 상자(필수 정보 아래) · 고객 합의 대기 판정 · 목록 꼬리표([내부 · 견적팀] · 연락 n회 · 진척 없음) · 확장관리 '하자 먼저' · 정보 확인 6개월 '다시 확인' */
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..'),one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/,'')||'crm.html');fs.readFile(f,(e,b)=>{if(e){r.statusCode=404;return r.end();}r.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html');r.end(b);});}).listen(0);
 const browser=await chromium.launch(),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DecisionCollab&&window.PipelineJudge&&window.DealDetailV3&&typeof goPage==='function');
  await page.evaluate(()=>{
   const U=n=>'cccccccc-0000-4000-8000-00000000000'+n;window.U=U;
   const k=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toLocaleDateString('en-CA');};window.K=k;
   const A=(note,daysAgo)=>({id:'a'+Math.random().toString(36).slice(2,8),type:'메모',note,at:new Date(Date.now()-(daysAgo||0)*864e5).toISOString()});
   const T=(daysAgo)=>({id:'t'+Math.random().toString(36).slice(2,8),type:'전화',note:'통화 시도 · 부재중 (전화 안 받음)',at:new Date(Date.now()-daysAgo*864e5).toISOString()});
   const deal=(n,site,code,owner,o)=>Object.assign({id:U(n),site,site_id:'s-'+n,assignee:owner,brand:'POUR솔루션',created:'2026-08-01',code,stage_code:code,amt:0,amount:0,activities:[],workItems:[],workSummary:'',version:1},o);
   B={deals:[
    deal(1,'[수원] 매탄임광','rapport','이필선',{activities:[A('[결정 일정] 대표회의 상정 | 2026-10-05 | 확인됨 | 관리소장 통화 10.1',6),A('[결정 일정] 입대의 회의 | '+k(12)+' | 확인됨 | 관리소장 통화 10.1',6),A('[결정 일정] 공사 예정 | 2027-03 | 미확인 | 근거 없음',6),A('[확인] 결정권자 | 확인됨 | 관리소장 통화 · 10.1 | 2026-10-01',6),A('[확인] 주소 | 확인됨 | 구글시트 접수 | 2026-01-10',6)]}),
    deal(2,'[서울 노원] 상계주공7단지','sent','정정훈',{activities:[A('[막힌 곳] 내부 · 견적팀 | 견적 검토 대기 3일 | 박OO | '+k(1)+' | 검토',2)]}),
    deal(3,'[서울 송파] 서울체육고','rapport','이필선',{activities:[T(50),T(45),T(40),T(35),T(30),A('[진척] 견적 요청 | '+k(-41),41)]}),
    deal(4,'[경기 용인] 수지삼성래미안','won',  '김성민',{grp:'수주 성공',closed_at:'2025-08-10',activities:[A('[하자] 101동 옥상 배수구 주변 들뜸 | 접수 2026-09-22 | 담당 박OO | 약속 2026-10-10 | 미해결',10)]})],
    inquiries:[],activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';window.saveLocal=()=>{};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   SB={rpc:async()=>({data:{ok:true,tasks:[],entries:[],sites:[],requests:[]}})};TOKEN='test';
   PipelineScope._reset();goPage('pipe');
  });
  /* 읽기 */
  const L=await page.evaluate(()=>{const DC=DecisionCollab,l=DC.list(B.deals[0]);return {dec:l.dec.map(x=>x.type+'|'+x.date+'|'+x.conf),chk:Object.keys(l.chk),wait:DC.decWaiting(B.deals[0]),todos:DC.autoTodos(DC.decWaiting(B.deals[0])).map(t=>t[1]),blk:DC.list(B.deals[1]).blk.who+'|'+DC.list(B.deals[1]).blk.step,tags2:DC.tags(B.deals[1]).block,tags3:DC.tags(B.deals[2]).stale,prog3:DC.progress(B.deals[2]).map(x=>x.type),def4:!!DC.openDefect(B.deals[3]),info1:DC.infoRows(B.deals[0]).map(r=>r.k+'|'+r.conf)};});
  assert.deepEqual(L.dec,['대표회의 상정|2026-10-05|확인됨','입대의 회의|'+await page.evaluate(()=>K(12))+'|확인됨','공사 예정|2027-03|미확인'],JSON.stringify(L.dec));
  assert.equal(L.wait.label,'입대의 회의','가장 가까운 앞으로의 회의 = 고객 합의 대기');
  assert.deepEqual(L.todos,['회의 자료 준비 (견적 · 시공 사례)','자료 발송 + 수신 확인','회의 결과 확인 → 진행 · 보류 · 종결 판단']);
  assert.equal(L.blk,'내부 · 견적팀|검토');assert.equal(L.tags2,'내부 · 견적팀');
  assert.match(L.tags3,/^연락 5회 · 진척 없음 41일$/,L.tags3);assert.deepEqual(L.prog3,['견적 요청']);
  assert.equal(L.def4,true,'미해결 하자');
  assert.deepEqual(L.info1,['주소|다시 확인','예상 금액|미확인','공사 예정|미확인','결정권자|확인됨'],JSON.stringify(L.info1));/* 주소는 확인한 지 6개월 지남 → 다시 확인 · 공사 예정은 결정 일정의 확인 상태(미확인) 그대로 */
  /* 판정: 고객 합의 대기 = 회의 날짜까지 경고 없음 */
  const J=await page.evaluate(()=>{const b=PipelineJudge.basis(B.deals[0]);return [b.src,b.why,PipelineJudge.state(b).key,PipelineJudge.line(b)];});
  assert.equal(J[0],'decide');assert.match(J[1],/^고객 합의 대기 · 입대의 회의 \d+\.\d+ · 회의 전 경고 없음$/,J[1]);assert.equal(J[2],'ok');assert.match(J[3],/→ 회의 D-5 자료 준비/);
  /* 상세 오른쪽 상자: 필수 정보 아래 · 타임라인 3줄 · 자동 할 일 · 정보 확인 4칸 */
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.on.dv3 .dcb');
  const sec=await page.evaluate(()=>{const s=document.querySelector('#detailView .dcb'),prev=s.previousElementSibling;return {prev:prev.className,h3:s.querySelector('h3').textContent.replace(/\s+/g,' ').trim(),dec:[...s.querySelectorAll('.dcb-dec')].map(x=>x.querySelector(':scope>div>b').textContent+'|'+x.querySelector('.dcb-c').textContent+'|'+x.classList.contains('past')),auto:s.querySelectorAll('.dcb-auto>span').length,info:[...s.querySelectorAll('.dcb-info>button')].map(b=>b.querySelector('span').textContent+'|'+b.querySelector('.dcb-c').textContent),h4:[...s.querySelectorAll('h4')].map(x=>x.textContent)};});
  assert.ok(/dv3-slot|da-stage-summary/.test(sec.prev),'필수 정보 바로 아래 '+sec.prev);
  assert.match(sec.h3,/^고객 결정 일정 고객 합의 대기 · 입대의 회의 \d+\.\d+$/,sec.h3);
  assert.deepEqual(sec.dec,['대표회의 상정|확인됨|true','입대의 회의|확인됨|false','공사 예정|미확인|false']);
  assert.equal(sec.auto,3);assert.deepEqual(sec.info,['주소|다시 확인','예상 금액|미확인','공사 예정|미확인','결정권자|확인됨']);
  assert.deepEqual(sec.h4,['막힌 곳 · 고객인가 내부인가','진척과 접촉 따로','미해결 불만 · 하자','정보 확인 상태']);
  /* 입력 폼 열림 · 저장은 메모 경로(가짜 큐) */
  await page.locator('#detailView .dcb [data-dc="dec-open"]').click();await page.waitForSelector('#detailView .dcb .dcb-form select[data-dcf="type"]');
  assert.deepEqual(await page.locator('#detailView .dcb .dcb-form select[data-dcf="type"] option').allInnerTexts(),['관리소장 변경','대표회의 상정','입대의 회의','예산 편성','현설','입찰','공사 예정']);
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  /* 막힌 곳 상자: 견적팀 5단계 · 검토 = 현재 */
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[1]));});await page.waitForSelector('#detailView.on.dv3 .dcb .dcb-steps');
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dcb .dcb-steps>div')].map(x=>x.querySelector('b').textContent+':'+x.className)),['요청:done','자료 확인:done','보완 요청:done','검토:cur','발행:']);
  assert.match(one(await page.locator('#detailView .dcb .dcb-blk').innerText()),/내부 · 견적팀 견적 검토 대기 3일 박OO · \d+\.\d+까지 · 고객 미응대 아님/);
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  /* 목록 줄 꼬리표 */
  await page.evaluate(()=>{goPage('pipe');PipelineWorkspace.open('sent');});await page.waitForSelector('#pipeline-stage-v3 .prv-row');
  const row2=await page.evaluate(()=>{const r=document.querySelector('#pipeline-stage-v3 .prv-row[data-key="'+U(2)+'"]');return r?[r.querySelector('.prv-b .dcb-tag')?.textContent,r.querySelector('.prv-b .dcb-tag')?.className]:null;});
  assert.deepEqual(row2,['내부 · 견적팀','dcb-tag in'],JSON.stringify(row2));
  await page.evaluate(()=>PipelineWorkspace.open('relationship'));await page.waitForSelector('#pipeline-stage-v3 .prv-row');
  const row3=await page.evaluate(()=>{const r=document.querySelector('#pipeline-stage-v3 .prv-row[data-key="'+U(3)+'"]');return r?r.querySelector('.prv-b .dcb-stale')?.textContent:null;});
  assert.match(String(row3),/^연락 5회 · 진척 없음 41일$/,String(row3));
  if(process.env.SHOT_DIR){await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.on.dv3 .dcb');await page.evaluate(()=>document.querySelector('#detailView .dcb').scrollIntoView());await page.screenshot({path:path.join(process.env.SHOT_DIR,'decision-collab.png')});}
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('verify-decision-collab: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
