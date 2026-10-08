/* 연락 한 번 연결(2026-10-07 design_handoff_contact_link) — contact-link.js
   확인: ① 응대 기록 입력칸 아래 '이 기록이 반영될 곳'(같은 현장의 영업건 · 문의 · 관리 요청 기본 체크 · 해제 가능) + AI 가 뽑은 것(할 일 · 미완료 · 약속) + 저장 버튼 'n곳 반영'
        · 연결 표식은 원본 1건에만 붙고 연결된 건의 이력에 '연결 기록 · 원본 현장'으로 보인다(복사 아님) · 화면 글에서는 표식이 숨는다
        ④ 대기 이유: '대기 이유: X (날짜까지)' 기록이 있으면 판정 = 그 날짜까지 경고 없음(기한 초과 아님) · 지금 할 일 카드 날짜 고르기에 대기 이유 칩 */
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.ContactLink&&window.PipelineJudge&&window.DealDetailV3&&window.PipelineScope&&typeof goPage==='function');await page.evaluate(()=>{window.G=window.G||{};G.dealSameOff=true;});/* 2026-10-08 같은 정보 같은 판단 층은 끄고 본다 */
  await page.evaluate(()=>{
   const U=n=>'bbbbbbbb-0000-4000-8000-00000000000'+n;window.U=U;
   const today=new Date(),k=d=>{const x=new Date(today);x.setDate(x.getDate()+d);return x.toLocaleDateString('en-CA');};window.K=k;
   const deal=(n,site,code,owner,o)=>Object.assign({id:U(n),site,site_id:'s-'+(o&&o.sid||n),assignee:owner,brand:'POUR솔루션',created:'2026-10-02',code,stage_code:code,amt:0,amount:0,activities:[],workItems:[],workSummary:'',version:1},o);
   B={deals:[
    deal(1,'[경북 경주] 전원하이빌','consulting','이필선',{sid:'A'}),
    deal(2,'[경북 경주] 전원하이빌','sent','황윤선',{sid:'A'}),/* 같은 현장의 다른 열린 영업건 */
    deal(3,'[서울 마포] 성산시영','rapport','이필선',{sid:'B',activities:[{id:'w1',type:'전화',note:'통화 완료 · 진행 중 · 대기 이유: 입대의 · 회의 결과 대기 ('+k(10)+'까지)',at:new Date().toISOString()}]}),
    deal(4,'[서울 마포] 성산시영 2차','rapport','이필선',{sid:'C',activities:[{id:'w2',type:'전화',note:'통화 완료 · 대기 이유: 예산 확정 대기 ('+k(-3)+'까지)',at:new Date(Date.now()-10*864e5).toISOString()}]}),
    deal(5,'[경기 수원] 연결받는현장','consulting','이필선',{sid:'D'}),
    deal(6,'[경기 수원] 연결받는현장','sent','황윤선',{sid:'D',activities:[{id:'o1',type:'전화',note:'통화 완료 · 소장과 방문 일정 협의 [연결 deal:'+U(5)+']',at:new Date().toISOString()}]})],
    inquiries:[{id:'q1',site:'[경북 경주] 전원하이빌',site_id:'s-A',brand:'POUR솔루션',status:'접수',created_at:'2026-10-03T01:00:00Z',assignee:'이필선'}],activities:[],inquiryTrash:[],inquiryCleanupArchived:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';window.saveLocal=()=>{};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';
   CRMRelease.has=()=>true;window.__linkCalls=[];
   SB={rpc:async(name,args)=>{if(name==='crm_activity_links_v1'){
    __linkCalls.push(args.p);if(window.__holdLinks)await new Promise(r=>window.__resolveLinks=r);
    return {data:{ok:true,items:args.p.target_id===U(5)?[{activity_id:'server-original',src:'deal:'+U(6),site:'[경기 수원] 연결받는현장',text:'통화 완료 · 소장과 방문 일정 협의',type:'전화',who:'황윤선',at:new Date().toISOString()}]:[],next_cursor:null}};
   }return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[]}};}};TOKEN='test';
   PipelineScope._reset();goPage('pipe');
  });
  /* AI 추출(규칙) */
  const ext=await page.evaluate(()=>ContactLink.extract('고객 연결 완료. 다음 주 현장 방문 희망. 옥상 도면 요청. 금요일까지 방문 날짜 확정 예정.').map(e=>e.k+'|'+e.v));
  assert.ok(ext.some(x=>/^약속\|고객: 다음 주 현장 방문 희망/.test(x)),'약속 '+JSON.stringify(ext));
  assert.ok(ext.some(x=>/^미완료\|옥상 도면 수령/.test(x)),'미완료 '+JSON.stringify(ext));
  assert.ok(ext.some(x=>/^할 일\|.*방문 날짜 확정.*까지/.test(x)),'할 일 + 기한 '+JSON.stringify(ext));
  /* 관련 건: 같은 현장의 다른 열린 영업건 + 문의, 자기 자신은 빼고 */
  const rel=await page.evaluate(()=>ContactLink.related(B.deals[0]).map(l=>l.kind+'|'+l.t+'|'+l.on));
  assert.deepEqual(rel,['deal|영업건 · [경북 경주] 전원하이빌|true','inq|견적문의 · [경북 경주] 전원하이빌|true'],JSON.stringify(rel));
  /* 상세 입력칸: 글을 적으면 상자가 뜨고 저장 버튼에 'n곳 반영' */
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.on.dv3 #ddvComposer textarea');
  const ta=page.locator('#detailView #ddvComposer textarea');await ta.fill('고객 연결 완료. 다음 주 현장 방문 희망. 옥상 도면 요청.');await page.waitForSelector('#detailView .cl-box:not([hidden]) .cl-link',{timeout:3000});
  const box=await page.evaluate(()=>{const b=document.querySelector('#detailView .cl-box');return [b.querySelectorAll('.cl-link').length,b.querySelectorAll('.cl-link.on').length,[...b.querySelectorAll('.cl-ai>div>em')].map(e=>e.textContent),document.querySelector('#detailView #ddvComposer .idv-save').textContent,ContactLink.markerOf(b)];});
  assert.deepEqual(box,[2,2,['약속','미완료'],'기록 저장 · 2곳 반영',' [연결 deal:'+await page.evaluate(()=>U(2))+',inq:q1]'],JSON.stringify(box));
  await page.locator('#detailView .cl-link').first().click();await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(()=>[document.querySelectorAll('#detailView .cl-link.on').length,document.querySelector('#detailView #ddvComposer .idv-save').textContent]),[1,'기록 저장 · 1곳 반영'],'해제 가능');
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  /* 연결된 건의 이력: 원본은 다른 건(U6)에 1건 · 이 건(U5)에는 '연결 기록'으로 보이고 표식은 숨는다 */
  await page.evaluate(()=>ContactLink.loadLinks('deal:'+U(5)));
  const linked=await page.evaluate(()=>ContactLink.linkedInto('deal:'+U(5)).map(x=>x.src+'|'+x.text));
  assert.deepEqual(linked,['deal:'+await page.evaluate(()=>U(6))+'|통화 완료 · 소장과 방문 일정 협의'],JSON.stringify(linked));
  await page.evaluate(()=>{ContactLink.clearLinks();B.deals[5].activities=[];window.__holdLinks=true;G._detailPopup=true;drwDeal(JSON.stringify(B.deals[4]));});await page.waitForSelector('#detailView.on.dv3 .idv-thread');
  await page.locator('#detailView #ddvComposer textarea').fill('입력 중인 메모 유지');
  await page.waitForFunction(()=>typeof window.__resolveLinks==='function');await page.evaluate(()=>{__holdLinks=false;__resolveLinks();});
  await page.waitForSelector('#detailView .cl-linked');
  assert.equal(await page.locator('#detailView #ddvComposer textarea').inputValue(),'입력 중인 메모 유지','연결 기록을 읽어 와도 작성 중인 내용 유지');
  const msgs=await page.evaluate(()=>[...document.querySelectorAll('#detailView .idv-thread .idv-msg')].map(m=>m.className.includes('cl-linked')+'|'+m.querySelector('.idv-meta em')?.textContent+'|'+m.querySelector('.idv-bubble').textContent.replace(/\s+/g,' ').trim()));
  assert.ok(msgs.some(m=>/^true\|연결 기록\|원본: \[경기 수원\] 연결받는현장 · 통화 완료 · 소장과 방문 일정 협의$/.test(m)),JSON.stringify(msgs));
  assert.ok(!msgs.some(m=>/\[연결/.test(m)),'표식은 숨는다 '+JSON.stringify(msgs));
  await page.evaluate(()=>closeDetail());await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>sayLegacyNote('통화 완료 [연결 deal:x,inq:y]')),'통화 완료','예전 문구 치환에서도 표식 제거');
  /* 대기 이유: 날짜 전이면 판정 = 그 날짜까지 경고 없음 · 지난 뒤에는 보통 판정 */
  const J=await page.evaluate(()=>{const a=PipelineJudge.basis(B.deals[2]),b=PipelineJudge.basis(B.deals[3]);return [a.src,a.why,PipelineJudge.dueText(a),PipelineJudge.state(a).key,b.src,PipelineJudge.state(b).key];});
  const until=await page.evaluate(()=>K(10));const mdU=(+until.slice(5,7))+'.'+(+until.slice(8,10)),mdS=(+until.slice(5,7))+'/'+(+until.slice(8,10));
  assert.deepEqual(J.slice(0,4),['wait','대기 이유: 입대의 · 회의 결과 대기 · '+mdU+'까지 경고 없음',mdS+'까지','ok'],JSON.stringify(J));
  assert.notEqual(J[4],'wait','지난 대기 이유는 판정에서 빠진다');
  /* 지금 할 일 카드 날짜 고르기: 대기 이유 칩 5개 · 하나만 고름 */
  await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.on.dv3');
  await page.evaluate(()=>NowCard.sheet());await page.waitForSelector('#nc-sheet [data-chip="ongoing"]');await page.locator('#nc-sheet [data-chip="ongoing"]').click();/* 결과 칩을 고르면 2단계(대기 이유 · 날짜) */await page.waitForSelector('#nc-sheet .nc-waits button',{state:'visible'});
  assert.deepEqual(await page.locator('#nc-sheet .nc-waits button').allInnerTexts(),['입대의 · 회의 결과 대기','고객과 합의한 대기','내년 공사 예정','예산 확정 대기','자료 회신 대기']);
  await page.locator('#nc-sheet .nc-waits button').nth(0).click();await page.locator('#nc-sheet .nc-waits button').nth(3).click();
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#nc-sheet .nc-waits button')].map(b=>b.getAttribute('aria-pressed'))),['false','false','false','true','false'],'하나만');
  await page.evaluate(()=>{document.getElementById('nc-sheet')?.remove();closeDetail();});
  if(process.env.SHOT_DIR){await page.evaluate(()=>{G._detailPopup=true;drwDeal(JSON.stringify(B.deals[0]));});await page.waitForSelector('#detailView.on.dv3 #ddvComposer textarea');await page.locator('#detailView #ddvComposer textarea').fill('고객 연결 완료. 다음 주 현장 방문 희망. 옥상 도면 요청. 금요일까지 방문 날짜 확정 예정.');await page.waitForSelector('#detailView .cl-box:not([hidden]) .cl-link');await page.screenshot({path:path.join(process.env.SHOT_DIR,'contact-link.png')});}
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('verify-contact-link: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
