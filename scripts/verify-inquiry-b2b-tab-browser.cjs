'use strict';
/* 견적문의 · 협약문의 B2B 탭 검사(2026-10-04 design_handoff_b2b · 협약문의 B2B.dc.html)
   위 탭 [공사 견적문의] [협약문의 · B2B n] + 담당 안내 / 왼쪽 목록(처리할 것 · 처리 끝, 접수 오래된 순) / 오른쪽 처리(원문 → 결과 3개 → 메모 → 처리 완료)
   결과 이름 = 협약완료 · 해결완료 · 종결(잔디 · 동기화 서버와 같은 InquiryB2B.results). 종결은 사유 필수. 서버가 저장을 확인한 뒤에만 종료로 표시하고 다음 미처리 건을 연다.
   공사 견적문의 목록은 건드리지 않는다(협약문의 탭에서는 가려 둘 뿐). 끄면 탭이 없다. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:940},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-04T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryB2BTab&&window.InquiryB2B&&window.InquiryListV3);
  await page.evaluate(()=>{
   const T=k=>k+'T09:00:00+09:00';
   const ag=(n,org,day,ch,who,phone,msg,extra)=>Object.assign({id:'b2b0000'+n+'-0000-4000-8000-00000000000'+n,site:org,site_name:org,status:'접수',at:T(day),created_at:T(day),received_at:T(day),updated_at:T(day),brand:'POUR솔루션',channel:ch,contact:who,contact_name:who,phone,work:'기술 공법 협약 관련 문의',work_type:'기술 공법 협약 관련 문의',detail:{inquiry:msg,workType:'기술 공법 협약 관련 문의',channel:ch,phone}},extra||{});
   const nq=(n,site)=>({id:'c0n0000'+n+'-0000-4000-8000-00000000000'+n,site,site_name:site,status:'접수',at:T('2026-10-0'+n),created_at:T('2026-10-0'+n),brand:'석민이앤씨',channel:'전화',phone:'010-1111-000'+n,work:'옥상방수',work_type:'옥상방수',detail:{inquiry:'옥상 방수 견적 문의',workType:'옥상방수'}});
   B={deals:[],inquiries:[nq(1,'[경기 화성] 동탄푸른마을'),nq(2,'[대전] 싸이언스빌'),
     ag(3,'대한시설안전협회','2026-10-01','이메일','박정민 팀장','02-3400-1100','회원사 대상 방수 공법 설명회 공동 개최 가능 여부 문의드립니다.'),
     ag(1,'(주)한빛관리','2026-09-24','홈페이지','김태호 부장','02-555-1820','소속 단지 12곳 정기 방수 점검을 묶어서 협약하고 싶습니다.'),
     ag(2,'우리주택관리','2026-09-29','전화','이수진 과장','031-712-4400','관리 단지 보수용 POUR 자재를 직접 공급받을 수 있는지 문의드립니다.'),
     ag(4,'(주)도시관리서비스','2026-09-10','홈페이지','최경아 대리','02-2085-7300','협력사 등록 절차와 필요 서류 안내 부탁드립니다.',{status:'협약완료',close_reason:'협약완료 · 협력사 등록 완료',updated_at:T('2026-09-15')}),
     Object.assign(ag(6,'시트에서 온 협약문의','2026-09-01','','','','',{status:'종결',close_reason:'종결',contact:'',contact_name:'',phone:'',channel:''}),{work:'',work_type:'',detail:null,raw:{'공사유형':'협약 문의','고객성함':'한소라','고객연락처':'010-2222-3333','상담채널':'구글폼','문의내용':'시트로 들어온 협약 문의 원문'}}),
     ag(5,'예전 배드핏 처리 업체','2026-08-20','전화','담당자','02-000-0000','협약 문의였으나 예전에 배드핏으로 처리',{status:'배드핏'})],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'a1',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__calls=[];window.__mode='ok';const api=window.InquiryB2B;
   window.InquiryB2B=Object.assign({},api,{complete:async(q,result,note)=>{api.request(q,result,note);__calls.push([q.id,result,note]);if(__mode==='uncertain')return {saved:false,queue_status:'uncertain'};if(__mode==='conflict')throw Error('B2B_STATE_CONFLICT');return {saved:true,result,note:note.trim(),completed_at:new Date().toISOString(),sync_status:'pending'};}});
   window.__toasts=[];window.toast=m=>{__toasts.push(String(m));};
   goPage('inq');
  });
  await page.waitForTimeout(700);
  const pg=page.locator('#pg-inq');
  /* 1. 위 탭: 공사 견적문의가 기본, 협약문의는 따로 */
  assert.deepEqual(await pg.locator('.b2b-kinds a').evaluateAll(l=>l.map(n=>[n.textContent.replace(/\s+/g,' ').trim(),n.getAttribute('aria-selected')])),[['공사 견적문의 2','true'],['협약문의 · B2B 3','false']],'협약문의는 공사 견적문의 수에 들어가지 않는다 · 처리할 협약문의 3건');
  assert.equal(await pg.locator('.b2b-pill').count(),0);assert.equal(await pg.locator('.b2b-view').count(),0);
  assert.ok((await pg.locator('.il-row').count())>=1,'공사 견적문의 목록은 그대로');
  assert.equal(await pg.locator('.il-row',{hasText:'한빛관리'}).count(),0,'협약문의는 공사 견적문의 목록에 없다');
  /* 2. 협약문의 탭: 담당 안내 · 목록(접수 오래된 순) · 첫 건이 열려 있다 */
  await pg.locator('.b2b-kinds a',{hasText:'협약문의'}).click();await page.waitForTimeout(200);
  assert.equal(await pg.locator('.b2b-pill').innerText(),'담당 조재연 · B2B팀 · 영업 아님 · 단건 처리 후 종료');
  assert.equal(await pg.locator('.b2b-kinds a').first().innerText().then(s=>s.replace(/\s+/g,' ')),'공사 견적문의 → 2');
  assert.equal(await pg.locator('.il-row:visible').count(),0,'협약문의 탭에서는 공사 목록을 가린다');
  const v=pg.locator('.b2b-view');
  assert.deepEqual(await v.locator('.b2b-tabs button').evaluateAll(l=>l.map(n=>[n.textContent,n.getAttribute('aria-pressed')])),[['처리할 것 3','true'],['처리 끝 3','false']]);
  assert.equal(await v.locator('.b2b-tabs>span').innerText(),'접수 오래된 순');
  const rows=()=>v.locator('.b2b-row').evaluateAll(l=>l.map(n=>[n.querySelector('.m b').textContent,n.querySelector('.w').textContent,n.querySelector('.s b').textContent,n.querySelector('.s span').textContent,n.classList.contains('on')]));
  assert.deepEqual(await rows(),[['(주)한빛관리','조재연 · 추천','처리 전','2026.9.24',true],['우리주택관리','조재연 · 추천','처리 전','2026.9.29',false],['대한시설안전협회','조재연 · 추천','처리 전','2026.10.1',false]]);
  assert.match(await v.locator('.b2b-row').first().locator('.m span').innerText(),/^기술 공법 협약 관련 문의 · 소속 단지 12곳/);
  const side=v.locator('.b2b-side');
  assert.deepEqual(await side.locator('.b2b-who').evaluate(n=>[...n.children].map(c=>c.textContent)),['기술 공법 협약 관련 문의 · 2026.9.24 접수 · 홈페이지','(주)한빛관리','김태호 부장 · 02-555-1820']);
  assert.equal(await side.locator('.b2b-msg').innerText(),'소속 단지 12곳 정기 방수 점검을 묶어서 협약하고 싶습니다.');
  assert.deepEqual(await side.locator('.b2b-res button').evaluateAll(l=>l.map(n=>[n.querySelector('b').textContent,n.querySelector('span').textContent])),[['협약완료','협약 체결'],['해결완료','안내 · 해결'],['종결','진행 안 함']]);
  assert.deepEqual(await page.evaluate(()=>[...InquiryB2B.results]),['협약완료','해결완료','종결'],'결과 이름 = 잔디 · 동기화 서버와 같은 3개');
  const go=()=>side.locator('.b2b-go').evaluate(n=>[n.querySelector('span').textContent,n.querySelector('button').classList.contains('off'),getComputedStyle(n.querySelector('button')).backgroundColor]);
  assert.deepEqual(await go(),['결과 하나를 고르세요',true,'rgb(201, 205, 213)']);
  assert.deepEqual(await side.locator('.b2b-foot span').allInnerTexts(),['· 수주 · 계약실적 · 메이드율 · 인센티브에 들어가지 않습니다','· 다음 행동 · 놓침 · 후속 순서 대상이 아닙니다','· 결과는 잔디와 같은 이름으로 동기화됩니다']);
  if(shot)await page.screenshot({path:shot+'-b2b.png'});
  /* 3. 종결은 사유 필수 */
  await side.locator('.b2b-res button',{hasText:'종결'}).click();await page.waitForTimeout(100);
  assert.deepEqual(await side.locator('[data-b2b-f="note"]').evaluate(n=>[n.placeholder,getComputedStyle(n).borderTopColor]),['종결 사유 (필수)','rgb(243, 201, 199)']);
  assert.deepEqual((await go()).slice(0,2),['종결은 사유를 적어야 저장됩니다',true]);
  await side.locator('.b2b-go button').click({force:true});assert.equal(await page.evaluate(()=>__calls.length),0,'사유가 비면 저장하지 않는다');
  await side.locator('[data-b2b-f="note"]').fill('조건이 맞지 않아 진행하지 않기로 함');
  assert.deepEqual(await go(),['저장하면 바로 종료되고 잔디에도 같은 결과로 반영됩니다',false,'rgb(21, 23, 28)']);
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.matches('[data-b2b-f="note"]')),true,'적는 동안 포커스 유지');
  /* 4. 서버가 확인하지 못하면 처리 완료로 표시하지 않는다 */
  await page.evaluate(()=>{__mode='uncertain';});await side.locator('.b2b-go button').click();await page.waitForTimeout(250);
  assert.match(await side.locator('.b2b-go>span').innerText(),/^서버 저장을 확인하지 못했습니다 \(uncertain\) · 처리 완료로 표시하지 않았습니다\.$/);
  assert.equal((await rows())[0][2],'처리 전');assert.equal(await page.evaluate(()=>B.inquiries.find(q=>q.site==='(주)한빛관리').status),'접수');
  /* 5. 처리 완료 = 서버 확인 뒤 종료 + 다음 미처리 건이 열린다 */
  await page.evaluate(()=>{__mode='ok';__calls.length=0;});
  await side.locator('.b2b-go button').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__calls),[['b2b00001-0000-4000-8000-000000000001','종결','조건이 맞지 않아 진행하지 않기로 함']]);
  assert.deepEqual(await rows(),[['우리주택관리','조재연 · 추천','처리 전','2026.9.29',true],['대한시설안전협회','조재연 · 추천','처리 전','2026.10.1',false]],'끝난 건은 빠지고 다음 미처리 건이 열린다');
  assert.equal(await side.locator('.b2b-who>b').innerText(),'우리주택관리');assert.deepEqual(await go(),['결과 하나를 고르세요',true,'rgb(201, 205, 213)']);
  assert.deepEqual(await page.evaluate(()=>__toasts.slice(-1)),['(주)한빛관리 · 종결 처리 완료']);
  assert.deepEqual(await v.locator('.b2b-tabs button').allInnerTexts(),['처리할 것 2','처리 끝 4']);assert.match(await pg.locator('.b2b-kinds a').nth(1).innerText(),/협약문의 · B2B\s*2/);
  /* 메모 없이 협약완료 */
  await side.locator('.b2b-res button',{hasText:'협약완료'}).click();assert.equal(await side.locator('[data-b2b-f="note"]').getAttribute('placeholder'),'처리 내용 한 줄 (선택)');
  await side.locator('.b2b-go button').click();await page.waitForTimeout(300);
  assert.deepEqual(await page.evaluate(()=>__calls.slice(-1)[0].slice(1)),['협약완료','']);
  /* 6. 처리 끝: 결과 · 처리일 · 담당 · 메모 — 예전 방식으로 끝난 것도 여기(수치 영향 없음) */
  await v.locator('.b2b-tabs button',{hasText:'처리 끝'}).click();await page.waitForTimeout(150);
  assert.deepEqual((await rows()).map(r=>[r[0],r[2]]),[['예전 배드핏 처리 업체','배드핏'],['시트에서 온 협약문의','종결'],['(주)도시관리서비스','협약완료'],['(주)한빛관리','종결'],['우리주택관리','협약완료']]);
  /* 서버가 남긴 메모('결과 · 메모')는 결과 이름을 빼고, 구글시트 원본 칸으로 들어온 문의도 그대로 읽는다 */
  await v.locator('.b2b-row',{hasText:'도시관리서비스'}).click();await page.waitForTimeout(120);
  assert.deepEqual(await side.locator('.b2b-done').evaluate(n=>[...n.children].map(c=>c.textContent)),['협약완료 · 2026.9.15 · 조재연','협력사 등록 완료']);
  await v.locator('.b2b-row',{hasText:'시트에서 온'}).click();await page.waitForTimeout(120);
  assert.deepEqual(await side.locator('.b2b-who').evaluate(n=>[...n.children].map(c=>c.textContent)),['협약 문의 · 2026.9.1 접수 · 구글폼','시트에서 온 협약문의','한소라 · 010-2222-3333']);
  assert.equal(await side.locator('.b2b-msg').innerText(),'시트로 들어온 협약 문의 원문');assert.equal(await side.locator('.b2b-done span').innerText(),'남긴 메모가 없습니다');
  await v.locator('.b2b-row',{hasText:'한빛관리'}).click();await page.waitForTimeout(120);
  assert.deepEqual(await side.locator('.b2b-done').evaluate(n=>[...n.children].map(c=>c.textContent)),['종결 · 2026.10.4 · 조재연','조건이 맞지 않아 진행하지 않기로 함']);assert.equal(await side.locator('.b2b-proc').count(),0,'끝난 건에는 처리 버튼이 없다');
  await v.locator('.b2b-row',{hasText:'예전 배드핏'}).click();await page.waitForTimeout(120);
  assert.match(await side.locator('.b2b-done span').innerText(),/예전 방식으로 종료된 건입니다 · 수치에는 영향이 없습니다/);
  /* 7. 서버가 거절(이미 처리됨)하면 이유를 보여 준다 */
  await v.locator('.b2b-tabs button',{hasText:'처리할 것'}).click();await page.waitForTimeout(120);
  await page.evaluate(()=>{__mode='conflict';});await side.locator('.b2b-res button',{hasText:'해결완료'}).click();await side.locator('.b2b-go button').click();await page.waitForTimeout(250);
  assert.equal(await side.locator('.b2b-go>span').innerText(),'이미 처리됐거나 영업으로 넘어간 문의입니다. 새로 고쳐 확인해 주세요.');
  /* 8. 공사 견적문의로 돌아가기 · 끄기 */
  await pg.locator('.b2b-kinds a',{hasText:'공사 견적문의'}).click();await page.waitForTimeout(200);
  assert.equal(await pg.locator('.b2b-view').count(),0);assert.ok((await pg.locator('#inq-v4 .i4-row:visible').count())>=1,'공사 견적문의 목록이 다시 보인다');
  await page.evaluate(()=>{G.inquiryB2BOff=true;paint();});await page.waitForTimeout(200);
  assert.equal(await pg.locator('.b2b-bar').count(),0,'끄면 탭이 없다');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',kind_tabs:true,list_oldest_first:true,process_panel:true,close_needs_reason:true,not_done_until_server_confirms:true,done_then_next_open:true,done_tab_with_legacy:true,server_reject_shown:true,construction_list_untouched:true,switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
