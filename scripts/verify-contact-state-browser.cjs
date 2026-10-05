'use strict';
/* 정합성 ① 상태 충돌 해소 — 같은 현장 · 같은 문의는 어느 화면에서나 같은 줄 (2026-10-05 design_handoff_consistency)
   운영에서 본 모양 그대로(이름 · 번호는 지어낸 것): 같은 문의가 1초 차이로 두 번 들어온 복제 줄 + 사흘 뒤 재문의. 통화 기록은 첫 줄에만 있다.
   확인: 복제 줄은 목록 · 건수에서 빠짐 / 오늘 업무는 한 줄 / 오늘 업무 · 견적문의 목록 · 판정 함수가 같은 문장 / '기록 없음'은 단정하지 않는 문구 / 끄면 예전처럼 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.join(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:950},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ContactState&&window.InquiryFlow&&window.TodayWorkQueue&&typeof inqCtlPartition==='function');
  const R=await page.evaluate(()=>{
   const at=(days,ms)=>new Date(Date.now()-days*864e5+(ms||0)).toISOString(),SITE='[서울 강남] 한빛마을아파트';
   const row=(id,o)=>Object.assign({id,site:SITE,site_name:SITE,brand:'POUR솔루션',phone:'02-555-0100',detail:{phone:'02-555-0100'},contact:'관리소장',status:'접수',raw:{},activities:[],responses:[]},o);
   const q=[
    row('a1',{sheet_row:41,assignee:'이필선',assignee_name:'이필선',sales_assignee:'이필선',assigned_to:'u-lee',status:'현장방문예정',received_at:at(5),at:at(5),created:at(5),assigned_at:at(2,36e5),responded_at:at(2,2*36e5),raw:{'응대내용':'지하주차장 공사 추진 중 · 화요일 오전 현장방문 예정'}}),
    row('a2',{received_at:at(5,1100),at:at(5,1100),created:at(5,1100)}),
    row('b1',{sheet_row:57,assignee:'이필선',assignee_name:'이필선',sales_assignee:'이필선',assigned_to:'u-lee',status:'배정완료',received_at:at(2),at:at(2),created:at(2),assigned_at:at(2,36e5)}),
    row('b2',{received_at:at(2,900),at:at(2,900),created:at(2,900)}),
    /* 다른 현장: 기록이 없는 배정 건(운영 시작일 뒤 접수) */
    row('c1',{site:'새빛타운',site_name:'새빛타운',phone:'031-555-0111',detail:{phone:'031-555-0111'},assignee:'이필선',assignee_name:'이필선',sales_assignee:'이필선',assigned_to:'u-lee',status:'배정완료',received_at:at(1),at:at(1),created:at(1),assigned_at:at(1,36e5)})];
   B={deals:[],inquiries:q,activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};
   G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';window.saveLocal=()=>{};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   ContactState._reset();inqCtlPartition();
   const by=id=>B.inquiries.concat(B.inquiryCleanupArchived).find(x=>x.id===id),D=TodayWorkQueue.data(),mine=D.rows.filter(x=>x.type==='inq'&&x.item.site===SITE);
   const out={active:B.inquiries.map(x=>x.id).sort(),archived:B.inquiryCleanupArchived.map(x=>[x.id,x.shadow_of]).sort(),
    today:mine.map(x=>[x.item.id,x.caseCount||1,x.recent,x.status]),unassigned:D.rows.filter(x=>x.unassigned).length,
    recent:['a1','b1'].map(id=>todayRecent(by(id),'inq')),lines:['a1','b1'].map(id=>ContactState.lines(by(id),'inq').slice(0,2).map(l=>l.label+' '+l.text).join(' / ')),
    first:['a1','b1'].map(id=>!!inqCtlFirstResponseAt(by(id))),late:['a1','b1'].map(id=>inquiryResponseLate(by(id))),
    none:todayRecent(by('c1'),'inq'),noneLegacy:ContactState.recent(Object.assign({},by('c1'),{id:'c0',received_at:'2026-08-03T01:00:00+00:00',at:'2026-08-03T01:00:00+00:00'}),'inq')};
   /* 끄면 예전처럼: 줄마다 따로 · 복제 줄도 목록에 */
   G.contactStateOff=true;ContactState._reset();inqCtlPartition();
   out.off={active:B.inquiries.map(x=>x.id).sort(),first:['a1','b1'].map(id=>!!inqCtlFirstResponseAt(B.inquiries.find(x=>x.id===id)))};
   G.contactStateOff=false;ContactState._reset();inqCtlPartition();goPage('inq');
   return out;
  });
  /* 복제 줄 2개는 목록 · 건수에서 빠지고 정리 보관 쪽에(자료는 그대로) */
  assert.deepEqual(R.active,['a1','b1','c1']);assert.deepEqual(R.archived,[['a2','a1'],['b2','b1']]);
  assert.equal(R.unassigned,0,'가짜 미배정 없음');
  /* 오늘 업무: 같은 현장 · 같은 담당의 문의는 한 줄 — 먼저 접수된 줄 + 건수 */
  assert.equal(R.today.length,1,JSON.stringify(R.today));assert.deepEqual(R.today[0].slice(0,2),['a1',2]);
  assert.match(R.today[0][2],/^실제 연결 \d{4}\.\d{1,2}\.\d{1,2} · 같은 현장 문의 2건$/);
  /* 두 줄의 판정 · 문장이 같다(통화 기록은 첫 줄에만 있어도) */
  assert.equal(R.recent[0],R.recent[1]);assert.match(R.recent[0],/^실제 연결 \d{4}\.\d{1,2}\.\d{1,2}$/);assert.equal(R.lines[0],R.lines[1]);assert.match(R.lines[0],/^연락 시도 [\d.]+ · 연결됨 \/ 실제 연결 [\d.]+$/);
  assert.deepEqual(R.first,[true,true]);assert.deepEqual(R.late,[false,false],'재문의 줄이 첫 연락 늦음으로 뜨지 않는다');
  /* 기록이 없을 때: 단정하지 않는 문구 */
  assert.equal(R.none,'CRM 연락 기록 없음');assert.equal(R.noneLegacy,'CRM 연락 기록 없음 (이관 전 기록 확인 필요)');
  assert.deepEqual(R.off,{active:['a1','a2','b1','b2','c1'],first:[true,false]},'끄면 예전처럼');
  /* 견적문의 화면: 건수에 복제 줄이 들어가지 않는다(5줄 중 3건) */
  await page.waitForTimeout(500);
  const inq=await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' '));
  assert.match(inq,/구글시트 연결됨 · 3건/);assert.match(inq,/공사 견적문의 3 /);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('contact state ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
