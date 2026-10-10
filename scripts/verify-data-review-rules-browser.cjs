'use strict';
/* 데이터 정리 판단 규칙 검사(2026-10-07 design_handoff_data_review_rules · 시안 '데이터 정리 판단 근거 시안.dc.html')
   빈 값 · '미입력' · '무제'는 일치 근거가 아니다(식별 근거가 없으면 '확인 불가' · 자료 보완) · 주소 · 현장명 일치 = 같은 현장까지만, 같은 공사는 공종까지 · 공종 모름 = 같은 현장 · 공사 확인 필요 · 공종 다름 = 같은 현장 · 다른 공사(현장만 묶기)
   줄마다 A · B(다른 값 노랑) · 합치기 전 영향 미리보기(항목마다 유지값 선택 · 보존 · 집계 변화 · 되돌리기) · 공종 다르면 합치기 실행 잠금 · 같은 전화 = 후보 찾기만 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'||(shot&&u.hostname==='cdn.jsdelivr.net')?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DupV2&&window.DataCleanupUI&&window.CleanupCore&&typeof paint==='function');
  /* 0. 빈 값 규칙(단위) */
  const U=await page.evaluate(()=>{const C=CleanupCore,row=(id,extra)=>Object.assign({ref:{type:'inquiry',id},name:'현장명 미입력',address:'',office:'',mobile:'',works:[],brand:'POUR솔루션',at:'2026-10-05T01:00:00Z',siteId:''},extra||{});
   return {blank:['','미입력','현장명 미입력','주소 미입력','무제','무제 문서','없음'].map(C.blank),real:[C.blank('[부산] 해운대동신'),C.blank('옥상 방수')],
    bothBlankNoLink:C.classify(row('a'),row('b'))===null,bothBlankSamePhone:(()=>{const c=C.classify(row('a',{office:'0312223333'}),row('b',{office:'0312223333'}));return c&&[c.unknown,c.action,c.reasons.join('|')];})(),
    blankNameNotMatch:C.classify(row('a',{address:'미입력',office:''}),row('b',{address:'미입력',office:''}))===null};});
  assert.deepEqual(U.blank,[true,true,true,true,true,true,true],'빈 값 · 미입력 · 무제는 일치 근거가 아니다');assert.deepEqual(U.real,[false,false]);
  assert.equal(U.bothBlankNoLink,true,'현장명이 둘 다 비어 있다고 같은 현장이 되지 않는다');assert.equal(U.blankNameNotMatch,true,"주소 '미입력'끼리도 일치 근거가 아니다");
  assert.deepEqual(U.bothBlankSamePhone,[true,'defer','현장명이 둘 다 비어 있음|다른 식별 근거 없음|같은 전화는 후보 찾기에만 씀'],'식별 근거가 같은 전화뿐이면 확인 불가');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=n=>new Date(Date.now()+n*3600e3).toISOString();
   const deal=(id,site,extra)=>Object.assign({id,site,assignee:'이필선',brand:'POUR솔루션',created:day(-10),code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,site,extra)=>Object.assign({id:'0000000'+String(n).padStart(2,'0')+'-0000-4000-8000-0000000000'+String(n).padStart(2,'0'),site,status:'접수',brand:'POUR솔루션',assignee:'',at:at(-n),created_at:at(-n)},extra||{});
   const W=['옥상 방수'],wk=w=>({workItems:[w],primaryWork:w});
   B={deals:[
     /* 같은 현장 · 다른 공사: 주소 같고 공종이 다른 두 영업 */
     deal('d1','[경기 성남] 청솔마을동아10단지',Object.assign({address:'경기 성남시 수정구 청솔로 10',office_phone:'0312220001'},wk('옥상>우레탄'))),deal('d2','[경기 성남] 청솔마을동아10단지',Object.assign({address:'경기 성남시 수정구 청솔로 10',office_phone:'0312220001',assignee:'황윤선'},wk('재도장>외부')))],
    inquiries:[
     /* 확인 불가: 현장명이 둘 다 비어 있고 같은 관리사무소 전화뿐 */
     inq(1,'현장명 미입력',{office_phone:'0319998888'}),inq(2,'현장명 미입력',{office_phone:'0319998888'}),
     /* 같은 현장 · 공사 확인 필요: 주소 · 전화 같음 · 한쪽 공종 미입력 */
     inq(3,'[부산] 해운대동신',Object.assign({address:'부산 해운대구 해운대로 100',office_phone:'0517770000',brand:'석민이앤씨'},wk('옥상>우레탄'))),inq(4,'[부산] 해운대동신',{address:'부산 해운대구 해운대로 100',office_phone:'0517770000',brand:'석민이앤씨'}),
     /* 같은 공사: 주소 · 전화 · 공종 같음 · 담당만 다름 */
     inq(5,'[인천] 연수한양',Object.assign({address:'인천 연수구 연수로 5',office_phone:'0324440000',assignee:'이필선'},wk('재도장>외부'))),inq(6,'[인천] 연수한양',Object.assign({address:'인천 연수구 연수로 5',office_phone:'0324440000',assignee:'황윤선'},wk('재도장>외부')))],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   window.__rpc=[];SB={rpc:async(n,a)=>{__rpc.push(n);if(n==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};return {error:{message:'CONTRACT_UNAVAILABLE'}};}};
   const has=CRMRelease.has;CRMRelease.has=n=>!['crm_inquiry_consultation_preview_v1','crm_inquiry_consultation_write_v1'].includes(n)&&has(n);
   goPage('dup');
  });
  await page.waitForTimeout(700);
  const v=page.locator('#dup-v2');assert.equal(await v.count(),1);
  const cases=await page.evaluate(()=>DataCleanupUI.active().map(c=>c.reasons.length?[c.a.name,c.type+':'+c.action,DupV2.judge(c)].join(' ｜ '):''));
  const byName=n=>cases.find(x=>x.startsWith(n));
  assert.match(byName('현장명 미입력'),/inquiry:defer ｜ unk$/);assert.match(byName('[부산] 해운대동신'),/inquiry:defer ｜ maybe$/,'공종을 모르면 같은 공사로 보지 않는다');assert.match(byName('[인천] 연수한양'),/inquiry:inquiry_merge ｜ maybe$/);assert.match(byName('[경기 성남]'),/site:site_link ｜ site$/,'공종이 다르면 같은 현장 · 다른 공사');
  /* 1. 줄: 판단 이름 · 근거 · 버튼 · 상태 */
  const rows=await v.locator('.plv-row').evaluateAll(l=>l.map(r=>({a:r.querySelector('.dv-s b').textContent,tag:r.querySelector('.plv-tag').textContent,why:r.querySelectorAll('.plv-c')[2].textContent,cta:r.querySelector('.plv-cta').textContent,st:r.querySelector('.dv-ctac small').textContent})));
  const R=n=>rows.find(r=>r.a.startsWith(n));
  assert.deepEqual([R('현장명 미입력').tag,R('현장명 미입력').cta,R('현장명 미입력').st],['확인 불가','자료 보완','근거 미확인']);
  assert.deepEqual([R('[부산]').tag,R('[부산]').cta,R('[부산]').st],['같은 현장 · 공사 확인 필요','비교하기','규칙 추천 · 확인 전']);
  assert.deepEqual([R('[경기 성남]').tag,R('[경기 성남]').cta,R('[경기 성남]').st],['같은 현장 · 다른 공사','비교하기','규칙 추천 · 확인 전']);
  assert.deepEqual([R('[인천]').tag,R('[인천]').cta],['같은 현장 · 공사 확인 필요','비교하기']);
  assert.match(R('현장명 미입력').why,/현장명이 둘 다 비어 있음 · 다른 식별 근거 없음 · 같은 전화는 후보 찾기에만 씀/);assert.match(R('[부산]').why,/주소 · 현장명 · 공종 · 범위 · 시기 미확인|공종 · 범위 · 시기 미확인/);
  assert.deepEqual(await v.locator('.plv-ghead b').allInnerTexts(),['같은 공사 · 합치기 검토','같은 현장 · 다른 공사','애매 · 확인 필요','확인 불가','다른 건']);
  /* 2. 줄마다 A · B(현장명 · 문의번호 · 브랜드 · 접수 시각 · 연락처 끝자리 · 공종) · 다른 값 노랑 */
  const ab=v.locator('.plv-row',{hasText:'[인천] 연수한양'}).locator('.dv-s');assert.equal(await ab.count(),2);
  assert.deepEqual(await ab.first().locator('em').evaluateAll(l=>l.map(n=>n.textContent)).then(a=>[a.length,/^문의 #/.test(a[0]),a[1],/…0000$/.test(a[3]),a[4]]),[5,true,'POUR솔루션',true,'재도장>외부']);
  assert.ok(await v.locator('.plv-row',{hasText:'[인천] 연수한양'}).locator('.dv-d').count()>=2,'접수 시각 · 문의번호가 다르면 노랑');
  assert.equal(await v.locator('.plv-row',{hasText:'[부산] 해운대동신'}).locator('.dv-d').filter({hasText:/옥상>우레탄|공종 미입력/}).count(),2,'공종이 다르면 노랑(미입력 포함)');
  assert.equal(await v.locator('.plv-row',{hasText:'현장명 미입력'}).locator('.dv-s b.blank').count(),2,'빈 현장명은 빨간 글씨로');
  assert.match(await v.locator('.dv-legend').innerText(),/\[비교하기\] = 원본 비교 · 판단 저장 아님\s*\/\s*\[합치기 실행\] = 관리자 · 영향 미리보기 확인 후에만/);
  assert.match(await v.locator('.pd-action').innerText(),/7일 내 같은 전화는 후보로 띄우고, 현장 · 공종 확인 후 연결하게 접수 규칙 정하기|애매한 건은 주 1회/,'같은 전화 = 후보 찾기만');
  assert.doesNotMatch(await v.locator('.pd-action').innerText(),/기존 건에 연결되게/);
  if(shot)await page.screenshot({path:shot+'-list.png',fullPage:true});
  /* 3. 비교 창 — 공종 모름: 같은 현장까지 · 합치기 잠금 · 현장만 묶기 */
  await page.evaluate(()=>{window.CRM_CLEANUP_WRITE=true;});
  await v.locator('.plv-row',{hasText:'[부산] 해운대동신'}).locator('.plv-cta').click();await page.waitForTimeout(200);
  let d=page.locator('#dupDialog.on .dv-box');assert.equal(await d.count(),1);
  assert.match(await d.locator('.dv-judge').innerText(),/판단 · 같은 현장 · 공사 확인 필요[\s\S]*빈 값 · '미입력'은 일치 근거로 쓰지 않습니다/);
  assert.match(await d.locator('.dv-warn').innerText(),/공종을 알 수 없음[\s\S]*같은 공사는 공종 · 범위 · 추진 시기까지 맞아야 합니다/);
  assert.ok(await d.locator('.dv-cmp>div span').allInnerTexts().then(a=>['문의번호','접수 시각','연락처'].every(k=>a.includes(k))),'비교 표에 문의번호 · 접수 시각 · 연락처');
  assert.deepEqual(await d.locator('.dv-pvt>.h').allInnerTexts(),['항목','원본 A','원본 B','유지할 값']);assert.deepEqual(await d.locator('.dv-pvt>*').evaluateAll(l=>l.filter((n,i)=>i>=4&&(i-4)%4===0).map(n=>n.textContent)),['담당','상태','다음 업무','공종','브랜드 · 접수']);
  assert.deepEqual(await d.locator('.dv-pvb>div b').allInnerTexts(),['보존','현장 수','영업건 수','견적문의 수','수주실적','되돌리기']);assert.match(await d.locator('.dv-pvb').innerText(),/문의 원본 2건 · 응대 0건 · 첨부 0[\s\S]*현장 수\s*\d → 1[\s\S]*영업건 수\s*0 → 0[\s\S]*견적문의 수\s*2 → 1[\s\S]*변화 없음 · 수주 0건[\s\S]*미지원/);
  /* data_review 13: 숫자마다 계산 근거 펼침 */
  assert.equal(await d.locator('.dv-pvb details').count(),6);assert.match(await d.locator('.dv-pvb>div').nth(2).locator('details small').evaluate(n=>n.textContent),/^원본 A · B에 영업건 없음 — 문의만$/);assert.match(await d.locator('.dv-pvb>div').nth(5).locator('details small').evaluate(n=>n.textContent),/되돌리기 지원 전까지 \[합치기\] 잠금 · 현장 연결만 가능/);
  assert.equal(await d.locator('.dv-primary[data-dd]').isDisabled(),true,'공종을 모르면 합치기 실행 잠금');assert.match(await d.locator('.dv-primary[data-dd]').getAttribute('title'),/공종을 몰라 같은 공사인지 확인 필요/);assert.equal(await d.locator('.dv-primary[data-dd]').innerText(),'합치기 (확인 후)');
  assert.deepEqual(await d.locator('.dv-foot button').allInnerTexts().then(a=>a.filter(x=>x!=='같은 상담으로 연결')),['다른 공사로 유지','담당에게 범위 확인 요청','현장만 묶기','합치기 (확인 후)']);
  /* data_review 9 · 11 · 12: 원본 A · B(먼저 등록 문구 없음) · 선후는 접수 시각 칸의 '먼저' · 다음 확인까지만 · 값 상태 3가지 */
  assert.deepEqual(await d.locator('.dv-cmp .dv-ch b').allInnerTexts(),['원본 A','원본 B']);assert.equal(await d.evaluate(n=>/먼저 등록/.test(n.textContent)),false,"'먼저 등록' 문구 없음");
  assert.equal(await d.locator('.dv-cmp>div',{hasText:'접수 시각'}).evaluate(n=>(n.textContent.match(/ · 먼저/g)||[]).length),1,'접수 시각이 이른 쪽 한 곳에만 먼저');
  assert.match(await d.locator('.dv-judge').innerText(),/다음 확인: 공사 범위 · 실제 추진 시기 · 기존 상담 관계/);assert.equal(await d.locator('.dv-judge').evaluate(n=>/제안: 합치기/.test(n.textContent)),false,'애매한 건에 합치기 추천 없음');
  assert.deepEqual(await d.locator('.dv-vs i').allInnerTexts(),['값 있음','값 없음 (확인됨)','불러오지 못함']);
  await d.locator('[data-dask]').click();await page.waitForTimeout(150);assert.match(await d.locator('#dvAskOut').innerText(),/^\[범위 확인 요청\] .+ — 원본 A\(문의 #.+\) · 원본 B\(문의 #.+\)가 같은 공사인지 공사 범위 · 실제 추진 시기 · 기존 상담 관계를 확인해 주세요\.$/);
  await page.keyboard.press('Escape');
  /* 4. 같은 공사 — 항목마다 유지값을 고른 뒤에만 합치기 실행 */
  await page.evaluate(async()=>{window.CRM_CLEANUP_WRITE=true;TOKEN='t';SB.rpc=async(n)=>{__rpc.push(n);if(n==='crm_cleanup_state')return {data:{ok:true,reviews:[],links:[],sites:[],moves:[]}};if(n==='crm_improvement_task_list_v1')return {data:{ok:true,tasks:[]}};return {error:{message:'not in test'}};};await DataCleanupUI.refresh();});await page.waitForTimeout(400);
  await v.locator('.plv-row',{hasText:'[인천] 연수한양'}).locator('.plv-cta').click();await page.waitForTimeout(200);d=page.locator('#dupDialog.on .dv-box');
  /* data_review 13: 되돌리기 미지원이면 같은 공사여도 [합치기 실행] 잠금 · 현장 연결만 */
  assert.equal(await d.locator('.dv-primary[data-dd]').isDisabled(),true);assert.match(await d.locator('.dv-primary[data-dd]').getAttribute('title'),/되돌리기 미지원 — 지원 전까지 합치기 잠금 · 현장 연결만 가능/);
  await page.evaluate(()=>{DupV2.close();DataCleanupUI.canUndo=()=>true;});await v.locator('.plv-row',{hasText:'[인천] 연수한양'}).locator('.plv-cta').click();await page.waitForTimeout(200);d=page.locator('#dupDialog.on .dv-box');assert.match(await d.locator('.dv-pvb').innerText(),/되돌리기\s*지원 · 처리 완료 탭에서 연결 해제/);
  assert.equal(await d.locator('.dv-warn').count(),0,'같은 공사는 경고 없음');
  assert.deepEqual(await d.locator('.dv-pvt .dv-pk').count(),1,'담당이 다른 것만 고른다(먼저 등록 자동 선택 없음)');assert.equal(await d.locator('.dv-pk button[aria-pressed="true"]').count(),0,'아무것도 미리 고르지 않음');
  assert.equal(await d.locator('.dv-primary[data-dd]').isDisabled(),true);assert.match(await d.locator('.dv-note').innerText(),/대표 기록을 자동으로 정하지 않습니다[\s\S]*미리보기에서 항목마다 유지할 값을 고른 뒤 열립니다/);
  await d.locator('.dv-pk button[data-v="B"]').click();await page.waitForTimeout(150);d=page.locator('#dupDialog.on .dv-box');
  assert.equal(await d.locator('.dv-pk button[aria-pressed="true"]').innerText(),'B 유지');assert.equal(await d.locator('.dv-primary[data-dd]').isDisabled(),false,'고른 뒤에 합치기 실행이 열린다');
  /* [합치기 실행] = 기존 서버 처리 창(미리보기 → 확인 → 처리)으로 — 이 화면은 데이터를 바꾸지 않는다 */
  await d.locator('.dv-primary[data-dd]').click();await page.waitForTimeout(300);assert.equal(await page.locator('#cleanup-dialog').count(),1,'기존 처리 창');assert.equal(await page.locator('#cleanup-action').inputValue(),'inquiry_merge');
  await page.evaluate(()=>{document.getElementById('cleanup-dialog')?.remove();});
  /* 5. 같은 현장 · 다른 공사: 공종 다르면 합치기 실행 잠금 + 현장만 묶기 */
  await v.locator('.plv-row',{hasText:'[경기 성남]'}).locator('.plv-cta').click();await page.waitForTimeout(200);d=page.locator('#dupDialog.on .dv-box');
  assert.match(await d.locator('.dv-warn').innerText(),/공종이 다름\(.+ ↔ .+\)[\s\S]*같은 공사로 합칠 근거 부족 · '같은 현장 · 다른 공사'로 현장만 묶기를 권장/);
  assert.equal(await d.locator('.dv-primary[data-dd]').isDisabled(),true,'공종이 다르면 합치기 실행 잠금');assert.match(await d.locator('.dv-pvt').innerText(),/두 공종 모두 · 공사 기회 2개/);
  assert.equal(await d.locator('.dv-foot [data-dd="site_link"]').isDisabled(),false,'현장만 묶기는 열려 있다');
  await d.locator('.dv-foot [data-dd="site_link"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('#cleanup-action').inputValue(),'site_link');await page.evaluate(()=>{document.getElementById('cleanup-dialog')?.remove();});
  /* 6. 확인 불가: 합치기 없음 · 판단 보류 */
  await v.locator('.plv-row',{hasText:'현장명 미입력'}).locator('.plv-cta').click();await page.waitForTimeout(200);d=page.locator('#dupDialog.on .dv-box');
  assert.match(await d.locator('.dv-warn').innerText(),/확인 불가[\s\S]*같은 전화는 후보를 찾는 조건일 뿐입니다/);assert.equal(await d.locator('.dv-pv').count(),0,'확인 불가에는 합치기 미리보기가 없다');assert.equal(await d.locator('.dv-primary[data-dd]').isDisabled(),true);assert.equal(await d.locator('[data-dd="defer"]').innerText(),'판단 보류 · 자료 보완');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>__writes.length),0,'이 화면은 데이터를 쓰지 않는다');
  /* 7. data_review 8 · 10 · 12(2026-10-10): 현장 그룹 · '기타' 공종 · 연락처 값 상태 — 새 자료로 다시 그린다 */
  await page.evaluate(async()=>{
   const at=n=>new Date(Date.now()-n*864e5).toISOString(),id=n=>'0000000'+String(n).padStart(2,'0')+'-0000-4000-8000-0000000000'+String(n).padStart(2,'0');
   const inq=(n,site,addr,work,extra)=>Object.assign({id:id(n),site,address:addr,office_phone:'',status:'접수',brand:'POUR솔루션',assignee:'',at:at(n*20),created_at:at(n*20)},work?{workItems:[work],primaryWork:work}:{},extra||{});
   B.deals=[];B.inquiries=[
    inq(11,'[경기 성남] 청솔마을','성남시 분당구 정자일로 120','옥상>옥상방수',{phone:'010-2222-2281'}),inq(12,'[경기 성남] 청솔마을','성남시 분당구 정자일로 120','옥상>기타',{brand:'석민이앤씨',status:'종결'}),
    inq(13,'[경기 성남] 청솔마을','성남시 분당구 정자일로 120','지하주차장>에폭시'),inq(14,'[경기 성남] 청솔마을','성남시 분당구 정자일로 120','옥상>옥상방수',{brand:'POUR공법'}),
    inq(15,'[경기 성남] 까치마을','성남시 분당구 미금로 33','옥상>기타',{brand:'석민이앤씨',status:'종결'}),inq(16,'[경기 성남] 까치마을','성남시 분당구 미금로 33','옥상>옥상방수',{status:'현장방문 예정',raw:{'문의자 연락처':'031-555-4402'}})];
   delete DataCleanupUI.canUndo;G.dupV2=null;await DataCleanupUI.refresh();});await page.waitForTimeout(500);
  const M=await page.evaluate(()=>{const U=DataCleanupUI,cs=U.active().map(c=>({c,i:U.cases().indexOf(c),band:DupV2.judge(c)})),CL=DupV2.clusters(cs),k=U.active().find(c=>/까치마을/.test(c.a.name));
   return {pairs:cs.length,groups:CL.map(g=>[g.recs.length,g.pairs.length,g.band]),kkachi:k?[DupV2.workState(k),DupV2.judge(k),DupV2.phoneState(k.a).s,DupV2.phoneState(k.b).s,DupV2.phoneState(k.a).text,DupV2.phoneState(k.b).text]:null};});
  assert.equal(M.groups.length,1,'원본 3건 이상인 현장만 그룹: '+JSON.stringify(M));assert.equal(M.groups[0][0],4,'청솔마을 원본 4건');assert.ok(M.groups[0][1]>=3,'쌍 여러 개가 그룹 하나로');
  /* 10: '옥상 > 기타'는 범위 불명확 → 다른 공사로 단정하지 않고 확인 필요 */
  assert.deepEqual(M.kkachi.slice(0,2),['unknown','maybe'],"'기타' 공종 = 공사 동일 확인 필요");
  /* 12: 견적문의 상세와 같은 칸(문의자 연락처)을 읽는다 · 정말 없는 값은 '없음(확인됨)' */
  assert.deepEqual([M.kkachi[2],M.kkachi[3]].sort(),['has','none']);assert.ok([M.kkachi[4],M.kkachi[5]].includes('…4402'),'문의자 연락처를 읽음');assert.ok([M.kkachi[4],M.kkachi[5]].includes('연락처 없음(확인됨)'));
  const gr=v.locator('.dv-g');assert.equal(await gr.count(),1,'그룹 줄 1개');assert.equal(await v.locator('.plv-row.dv-r',{hasText:'청솔마을'}).count(),0,'그룹에 든 쌍은 줄마다 반복하지 않는다');
  const gt=(await gr.locator('.dv-gr').innerText()).replace(/\s+/g,' ');assert.match(gt,/\[경기 성남\] 청솔마을 성남시 분당구 정자일로 120 · 원본 4건 같은 현장 주소 동일.* 공사 동일 · 확인 필요 쌍 \d+개를 한 줄로 원본 보기 ▾/,gt);
  await gr.locator('[data-dv="group"]').click();await page.waitForTimeout(250);
  const og=await v.locator('.dv-g .dv-gor').evaluateAll(l=>l.map(r=>[r.querySelector('i').textContent].concat([...r.querySelectorAll('span')].map(s=>s.textContent))));
  assert.deepEqual(og.map(r=>r[0]),['A','B','C','D']);assert.deepEqual(og.map(r=>r[1]).sort(),['옥상>기타','옥상>옥상방수','옥상>옥상방수','지하주차장>에폭시'],'펼치면 원본마다 공종');assert.ok(og.every(r=>/^\d{4}\.\d{1,2}\.\d{1,2} 접수$/.test(r[2])),'접수일');assert.ok(og.some(r=>r[3]==='종결')&&og.some(r=>r[4]==='POUR공법'),'상태 · 브랜드');
  assert.equal(await v.locator('.dv-g .dv-gp button').count(),M.groups[0][1],'쌍 비교 버튼 = 쌍 수');
  assert.deepEqual(await v.evaluate(el=>[...el.querySelectorAll('.dv-g *')].filter(n=>n.children.length===0&&n.scrollWidth>n.clientWidth+1&&getComputedStyle(n).textOverflow!=='ellipsis').map(n=>n.textContent)),[],'그룹 줄: 넘치는 글 없음');
  await v.locator('.dv-g .dv-gp button').first().click();await page.waitForTimeout(250);d=page.locator('#dupDialog.on .dv-box');assert.equal(await d.count(),1,'쌍 비교 버튼 → 원본 비교 창');await page.keyboard.press('Escape');
  /* 까치마을: 한 쌍은 예전 줄 그대로 · 근거에 '기타' 범위 불명확 · 비교 창은 다음 확인까지만 */
  const kr=v.locator('.plv-row.dv-r',{hasText:'까치마을'});assert.equal(await kr.count(),1);assert.match(await kr.innerText(),/'기타' 공종 · 범위 불명확/);
  await kr.locator('.plv-cta').click();await page.waitForTimeout(250);d=page.locator('#dupDialog.on .dv-box');
  assert.match(await d.locator('.dv-primary[data-dd]').getAttribute('title'),/'기타' 공종은 범위가 불명확해 같은 공사인지 확인 필요 — 다른 공사로 단정하지 않음/);assert.equal(await d.locator('.dv-primary[data-dd]').isDisabled(),true);
  assert.equal(await d.locator('.dv-cmp>div',{hasText:'문의자 연락처'}).count(),1,'비교 표에 문의자 연락처 줄');assert.equal(await d.locator('.dv-vs [data-dopen]').count(),2,'[원본 A 열기] [원본 B 열기]');
  await page.keyboard.press('Escape');
  assert.deepEqual(errs,[],'페이지 오류 없음 '+errs.join(' | '));
  if(shot){await page.screenshot({path:shot+'-list.png'});await v.locator('.plv-row.dv-r',{hasText:'까치마을'}).locator('.plv-cta').click();await page.waitForTimeout(200);await page.screenshot({path:shot+'-compare.png'});}
  console.log('verify-data-review-rules-browser ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
