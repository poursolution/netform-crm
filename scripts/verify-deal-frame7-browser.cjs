'use strict';
/* 영업건 상세 · 7단계 공통 틀 (2026-10-10 design_handoff_deal_detail_7 · 시안 '영업건 상세 · 단계별 버전') — 합성 자료(이름 · 금액 · 날짜는 지어낸 것)
   확인: 7단계가 같은 틀(머리 = 현재 건 한 줄 · 금액 줄 · 7단계 막대 · 이전 / 다음 / 왼쪽 = 연락처 · 결정권자 · 지금 영업건 · 이 단지 지난 영업 / 가운데 = 이력 탭 + 연락 시도 · 실제 연결
         / 오른쪽 '지금 처리' = 할 일 · 기한 종류 + 기한 · 확인됨 / 확인할 것 / 완료 조건 · 주 버튼 1개 · 먼저 확인 3개 · 고객 일정 · 추가 관리 · 참고정보)
         / 단계마다 금액 줄 · 할 일 · 기한 종류 · 먼저 확인만 다름 / 확인 필요 = 파랑 · 기한 지남 = 빨강 · 갈색 계열 없음 / 글 잘림 없음 / 끄기 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:1500},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealFrame7&&window.DealSame&&window.DecisionCollab&&window.SiteHistory&&window.DealWin&&window.PipelineStageB&&window.PipelineStageV3&&window.PipelineJudge&&window.DealPrep&&window.ListPager);
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const id=n=>'1111111'+n+'-1111-4111-8111-111111111111',S5='aaaaaaaa-0000-4000-8000-000000000005';
   const act=(i,type,note,at,who)=>({id:i,type,note,at,actor:who||'이필선',meaningful:true});
   const mk=(n,site,brand,who,code,extra)=>Object.assign({id:id(n),site,assignee:who,brand,created:'2025-09-10',code,stage_code:code,amt:260000000,manager_name:'이재석',manager_mobile:'01052493880',contacts:[{person_key:'mobile:01052493880',name:'이재석',role:'관리소장',mobile:'01052493880',status:'current'}],
    activities:[act('a'+n+'1','방문','현장 방문 · 2개 층 바닥 들뜸 확인',day(-12)+'T15:00:00+09:00',who),act('a'+n+'2','전화','통화 연결 · 방문 일정 협의',day(-30)+'T10:20:00+09:00',who)]},extra||{});
   B={deals:[
    mk(1,'[서울 노원] 상계주공7단지','POUR솔루션','이필선','consulting',{next_action:{id:'n1',text:'견적 요청 등록',type:'후속접촉',due:day(-7),status:'open'}}),
    mk(2,'[경기 평택] 오뚜기 포승공장','POUR솔루션','이필선','sent',{amt:57400000}),
    mk(3,'[서울 마포] 성산시영아파트','석민이앤씨','김성민','rapport',{amt:380000000,quote_versions:[{version_no:1,amount:410000000,created_at:day(-60)},{version_no:2,amount:380000000,created_at:day(-40)}],next_action:{id:'n3',text:'고객 약속: 입대의 결과 확인 연락',type:'전화',due:day(4),status:'open'}}),
    mk(4,'[경기 고양] 햇빛마을23단지','석민이앤씨','이필선','bidding',{amt:420000000,quote_versions:[{version_no:1,amount:420000000,created_at:day(-20)}],stage_contexts:{bidding:{fields:{bid_deadline:day(2),competition_flag:'있음'}}},next_action:{id:'n4',text:'제안서 팀장 공유 · 제출 준비',type:'후속접촉',due:day(1),status:'open'}}),
    mk(5,'[경기 평택] 평택비전지웰푸르지오','석민이앤씨','황윤선','contract',{site_id:S5,amt:1120000000,stage_contexts:{contract:{fields:{contract_date:'2026-01-26',contract_amount:1043900000}}},next_action:{id:'n5',text:'계약 체결 확인',type:'전화',due:day(-3),status:'open'}}),
    mk(6,'[경기 용인] 수지삼성래미안','POUR공법','정정훈','won',{outcome:'won',won_amount:140000000,closed_at:'2026-03-12',contract_date:'2026-03-12',amt:140000000,stage_contexts:{won:{fields:{completion_date:day(-40)}}},activities:[act('a61','전화','통화 연결 · 계약 조건 확인','2026-03-10T10:00:00+09:00','정정훈')]}),
    mk(7,'[대구] 강북이진캐스빌','석민이앤씨','한준엽','lost',{outcome:'lost',closed_at:'2026-05-07',amt:350000000,quote_versions:[{version_no:1,amount:350000000,created_at:'2026-04-10'}],stage_contexts:{lost:{fields:{competitor:'A건설',reengage:'미정'}}}}),
    /* 같은 단계 두 번째 건(이전 / 다음) · 같은 단지의 지난 수주 */
    mk(8,'[서울 강북] 두 번째 컨설팅 단지','POUR솔루션','이필선','consulting',{next_action:{id:'n8',text:'미팅 일정 잡기',type:'전화',due:day(3),status:'open'}}),
    mk(9,'[경기 평택] 평택비전지웰푸르지오','석민이앤씨','황윤선','won',{site_id:S5,created:'2023-01-10',outcome:'won',won_amount:120000000,closed_at:'2023-06-01',contract_date:'2023-06-01',amt:120000000,activities:[]})],
    inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.dkOpen=null;
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};
   window.pushWrite=()=>'req';window.__dial=0;window.contactDial=()=>{__dial++;};
   SB={rpc:async(n)=>{if(n==='crm_deal_win_list_v1')return {data:{ok:true,rows:[],advisory:[]}};return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[],links:[],rows:[]}};}};TOKEN='test';OpsStore.aiOn=()=>false;
   window.__open=async(i)=>{try{closeDetail();}catch(e){}await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));};
   window.__md=n=>{const t=new Date(Date.now()+n*864e5);return (t.getMonth()+1)+'.'+t.getDate();};
  });
  const V=page.locator('#detailView');
  const md=n=>page.evaluate(n=>window.__md(n),n);
  const open=async i=>{await page.evaluate(i=>window.__open(i),i);await page.waitForSelector('#detailView.dv7 .dvs-task .dv7-lb');await page.waitForTimeout(700);};
  const snap=()=>page.evaluate(()=>{const v=document.getElementById('detailView'),t=s=>{const n=v.querySelector(s);return n?n.innerText.replace(/\s+/g,' ').trim():null;},all=s=>[...v.querySelectorAll(s)].map(n=>n.innerText.replace(/\s+/g,' ').trim());
   return {bar:[...v.querySelectorAll('.dv7-bar>div')].map(n=>n.className||'-'),barL:all('.dv7-bar span'),meta:t('.dv7-meta'),line2:t('.dv7-line2'),lb:t('.dv7-lb'),task:t('.dvs-tt>b'),due:t('.dvs-tt>span'),dueC:v.querySelector('.dvs-tt>span>b').className,kv:all('.dvs-kv>span'),
    btns:[...v.querySelectorAll('.dvs-task button')].filter(b=>b.offsetParent).map(b=>[b.textContent.trim(),b.classList.contains('fill')]),first:[...v.querySelectorAll('.dv7-first .it')].map(n=>[n.querySelector('em').textContent,n.querySelector('span').textContent]),firstH:t('.dv7-first>b'),
    grp:[...v.querySelectorAll('.dv7-grp')].map(g=>[g.querySelector('b').textContent,[...g.querySelectorAll(':scope>div')].map(r=>r.innerText.replace(/\s+/g,' ').trim()+'|'+r.lastElementChild.className)]),
    left:all('.dv3-left .dvs-area, .dv3-left .dv7-h, .dv3-left .sth-hd>b'),hnote:t('.dvs-hnote'),area:v.querySelectorAll('.dw-center .dvs-area, .dvs-task .dvs-area').length,steps:getComputedStyle(v.querySelector('.ddv-steps')||v).display,now:getComputedStyle(v.querySelector('#nowCard')||v).display};});
  /* 갈색 · 황토색(주황 ~ 노랑 색상) 글자 · 바탕 · 테두리가 없어야 한다 — 브랜드 색은 띠와 브랜드 글자만 */
  const amber=()=>page.evaluate(()=>{const v=document.getElementById('detailView');
   const hsl=c=>{const m=/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c);if(!m||m[4]==='0')return null;const r=m[1]/255,g=m[2]/255,b=m[3]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;if(!d)return null;const s=d/(1-Math.abs(2*l-1));let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h=Math.round(h*60);if(h<0)h+=360;return {h,s,l};};
   const out=[];v.querySelectorAll('*').forEach(e=>{if(!e.offsetParent||e.closest('.dvs-ch,.idv-brand,.dv3-near'))return;const cs=getComputedStyle(e);[['color',cs.color],['bg',cs.backgroundColor],['bd',cs.borderTopColor]].forEach(([k,c])=>{if(k==='bd'&&cs.borderTopWidth==='0px')return;if(k==='color'&&![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;const x=hsl(c);if(x&&x.h>=18&&x.h<=55&&x.s>.3&&x.l>.12&&x.l<.93)out.push(k+' '+c+' '+e.tagName+'.'+String(e.className).slice(0,40)+' :: '+e.textContent.trim().slice(0,24));});});return [...new Set(out)];});
  const clip=()=>page.evaluate(()=>[...document.querySelectorAll('#detailView .dv7-meta, #detailView .dv7-line2 *, #detailView .dv7-bar *, #detailView .dv7-pos *, #detailView .dvs-task *, #detailView .dv3-left .sth-hd *')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible').map(e=>e.className+':'+e.textContent.slice(0,24)));
  const BAR=['컨설팅 설계','자료 발송완료','관계관리','경쟁 · 입찰','계약 · 시공','수주','실주'];
  const common=async(s,i)=>{
   assert.deepEqual(s.barL,BAR,'7단계 막대 이름');assert.equal(s.bar.filter(c=>c==='cur').length,1);assert.equal(s.bar.indexOf('cur'),i,'지금 단계');
   assert.deepEqual(s.bar.map(c=>c==='past'),BAR.map((_,k)=>i>=5?k<5:k<i),'지나온 단계(수주 · 실주는 앞 5단계)');
   assert.equal(s.lb,'지금 처리');assert.equal(s.steps,'none','예전 6칸 막대는 숨김');assert.equal(s.now,'none','예전 지금 할 일 카드는 숨김');
   assert.deepEqual([s.kv[0],s.kv[2],s.kv[4]],['확인됨','확인할 것','완료 조건']);
   assert.equal(s.btns.filter(b=>b[1]).length,1,'채운 주 버튼은 1개: '+JSON.stringify(s.btns));
   assert.equal(s.first.length,3,'먼저 확인 3개');assert.equal(s.firstH,'먼저 확인 · 3');
   assert.deepEqual(s.left.slice(0,3),['단지 공통','연락처 · 결정권자','지금 영업건']);assert.match(s.left[3],/^이 단지 지난 영업 \d+$/);
   assert.match(s.hnote,/^연락 시도 \d+ · 실제 연결 \d+$/);assert.equal(s.area,0,'가운데 · 오른쪽의 영역 라벨은 「지금 처리」 하나로');
   assert.equal(s.grp[0][0],'고객 일정');assert.equal(s.grp[s.grp.length-1][0],'참고정보');
   assert.deepEqual(await amber(),[],'갈색 · 황토색 없음');assert.deepEqual(await clip(),[],'글 잘림 없음');
   assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#detailView .dw-right')].every(r=>r.scrollWidth<=r.clientWidth+1)),true);
  };
  /* ① 컨설팅 설계 */
  await open(0);let s=await snap();await common(s,0);
  assert.match(s.meta,/^현재 건 · 공종 미분류 · 추진 2025 · 등록 2025\.9\.10 · #[0-9A-F]{6}$/);
  assert.equal(s.line2,'POUR솔루션 예상금액 2.6억 · 참고');
  assert.equal(s.task,'견적 요청 등록');assert.equal(s.due,'내부 처리 기한 '+await md(-7)+' · 7일 지남');assert.equal(s.dueC,'red');
  assert.equal(s.kv[1],await md(-12)+' 미팅 완료');assert.equal(s.kv[3],'도면 · 공사 시기');assert.equal(s.kv[5],'잔디 견적 요청 등록 + 견적 예정일');
  assert.deepEqual(s.btns,[['견적 요청 등록',true],['연락하기',false],['결과 기록',false],['다음 업무',false]]);
  assert.deepEqual(s.first,[['미입력','도면 · 현장 사진'],['미입력','공사 시기'],['해당 없음','입찰 마감']]);
  assert.deepEqual(s.grp,[['고객 일정',['가장 가까운 없음 · 견적 예정일 정하기|chk']],['참고정보',['첨부 0개|n']]]);
  /* 이전 / 다음: 같은 단계 목록 안에서(목록과 같은 순서) */
  assert.match(one(await V.locator('.dv7-pos').innerText()),/^‹ 이전 [12] \/ 2 컨설팅 설계 목록 다음 ›$/);
  {const b=await V.locator('.dv7-pos button:not([disabled])').first();const before=one(await V.locator('#dv-title').innerText());await b.click();await page.waitForTimeout(700);
   const after=one(await V.locator('#dv-title').innerText());assert.notEqual(after,before,'이전 / 다음을 누르면 그 단계의 다른 영업건이 열린다');assert.match(one(await V.locator('.dv7-pos').innerText()),/[12] \/ 2 컨설팅 설계 목록/);}
  /* 보조 단추는 기존 동작 그대로 */
  await open(0);await V.locator('.dv7-sub button',{hasText:'다음 업무'}).click();await page.waitForTimeout(150);
  assert.deepEqual(await V.locator('.dvs-task .dv3-nextonly button').allInnerTexts(),['내일','3일 후','7일 후','직접 정하기','취소']);
  await V.locator('.dvs-task .dv3-nextonly [data-dv3="nextcancel"]').click();
  await V.locator('.dv7-sub button',{hasText:'결과 기록'}).click();await page.waitForTimeout(250);
  assert.equal(await V.locator('#ddvComposer').evaluate(n=>n.classList.contains('dvt-calling')),true,'결과 기록 = 가운데 입력칸');
  /* ② 자료 발송완료: 발송일이 없으면 7일을 세지 않는다(판정 불가 · 파랑) */
  await open(1);s=await snap();await common(s,1);
  assert.equal(s.line2,'POUR솔루션 예상금액 5,740만 · 참고');
  assert.equal(s.task,'발송 내역 확인 · 고객 반응 기록');assert.equal(s.due,'발송 후 7일 발송일 없음 · 판정 불가');assert.equal(s.dueC,'blue');
  assert.equal(s.kv[5],'발송일 등록 + 고객 반응 기록');assert.equal(s.btns[0][0],'발송 내역 확인');
  assert.deepEqual(s.first,[['확인 필요','발송일 · 수신자'],['미입력','고객 반응'],['미입력','공사 시기']]);
  /* 색: 확인 필요 = 파랑 글자 · 연파랑 바탕 / 확인할 것 = 파랑 / 미입력 = 회색 */
  assert.deepEqual(await V.locator('.dv7-first em').first().evaluate(n=>[getComputedStyle(n).color,getComputedStyle(n).backgroundColor]),['rgb(42, 82, 184)','rgb(238, 243, 254)']);
  assert.equal(await V.locator('.dvs-kv>span').nth(3).evaluate(n=>getComputedStyle(n).color),'rgb(42, 82, 184)');
  assert.equal(await V.locator('.dvs-tt>span>b').evaluate(n=>getComputedStyle(n).color),'rgb(42, 82, 184)');
  assert.equal(await V.locator('.dv7-first em').nth(1).evaluate(n=>getComputedStyle(n).color),'rgb(107, 114, 128)');
  /* ③ 관계관리: 견적(Vn) · 예상 / 다음 연락일(고객 합의) */
  await open(2);s=await snap();await common(s,2);
  assert.equal(s.line2,'석민이앤씨 견적금액 3.8억 (V2) 예상금액 3.8억 · 참고');
  assert.equal(s.task,'입대의 결과 확인 연락');assert.equal(s.due,'다음 연락일 (고객 합의) '+await md(4)+' · 4일 남음');assert.equal(s.dueC,'');
  assert.equal(s.btns[0][0],'연락하고 결과 기록');assert.equal(s.kv[5],'결과 기록 + 다음 단계 판단');
  assert.deepEqual(s.first.map(f=>f[1].split(' · ')[0]),['관리 상태','경쟁사','입찰 마감']);assert.equal(s.first[2][0],'해당 없음');
  assert.equal(s.grp[0][1][0],'가장 가까운 '+await md(4)+' 입대의 결과 확인 연락|ok');
  assert.match(s.grp[s.grp.length-1][1].join(' / '),/견적 V1 4\.1억 → V2 3\.8억/);
  /* ④ 경쟁 · 입찰: 제안가 · 예상 / 입찰 마감 D-n(빨강) */
  await open(3);s=await snap();await common(s,3);
  assert.equal(s.line2,'석민이앤씨 제안가 4.2억 예상금액 4.2억 · 참고');
  assert.equal(s.task,'제안서 팀장 공유 · 제출 준비');assert.equal(s.due,'입찰 마감 '+await md(2)+' · D-2');assert.equal(s.dueC,'red');
  assert.equal(s.btns[0][0],'제출 준비 확인');assert.equal(s.kv[5],'제출 접수증 첨부');
  assert.deepEqual(s.first,[['미입력','공법 비교표'],['확인 필요','경쟁 업체 수'],['미입력','제출 접수증']]);
  assert.equal(s.grp[0][1][0],'가장 가까운 '+await md(2)+' 입찰 마감|red');
  /* ⑤ 계약 · 시공: 계약 · 낙찰 · 기술자문(예상은 빼고) / 내부 처리 기한 / 계약서 · 착공일 */
  await open(4);s=await snap();await common(s,4);
  assert.equal(s.line2,'석민이앤씨 계약금액 10억 4,390만원 ✓ 기존 고객 · 2023 수주 1');
  assert.equal(s.task,'계약 체결 확인');assert.equal(s.due,'내부 처리 기한 '+await md(-3)+' · 3일 지남');assert.equal(s.dueC,'red');
  assert.deepEqual(s.kv.slice(1),['체결 완료 · 2026.1.26 · 1,043,900,000원','확인할 것','계약서 미첨부 · 실제 체결 · 자료 확인','완료 조건','계약서 첨부 + 특이조건 선택'].slice(0));
  assert.equal(s.btns[0][0],'계약서 확인하기');
  assert.deepEqual(s.first,[['미입력','계약서 파일'],['미입력','착공일'],['해당 없음','입찰 마감']]);
  assert.deepEqual(s.grp.map(g=>g[0]),['고객 일정','추가 관리','참고정보']);assert.equal(s.grp[1][1][0],'막힌 곳 1 · 계약서 미첨부|red');
  assert.deepEqual(s.left.slice(2),['지금 영업건','이 단지 지난 영업 1']);
  assert.match(one(await V.locator('.sth-hd.sth-past').innerText()),/^이 단지 지난 영업 1 지난 수주 1건 · 1\.2억$/);
  /* ⑥ 수주: 준공 후 30일(지남 = 빨강) · 종료 건은 보조 단추 없이 주 버튼 하나 */
  await open(5);s=await snap();await common(s,5);
  assert.equal(s.line2,'POUR공법 계약금액 1억 4,000만원');
  assert.match(s.meta,/^현재 건 · 공종 미분류 · 준공 \d{4}\.\d+\.\d+ · 등록 2025\.9\.10 · #/);
  assert.equal(s.task,'준공 후 사후 연락');assert.equal(s.due,'준공 후 30일 '+await md(-10)+' · 10일 지남');assert.equal(s.dueC,'red');
  assert.deepEqual(s.btns,[['사후 연락하기',true]]);assert.equal(s.kv[5],'사후 연락 결과 + 재영업 여부');
  assert.deepEqual(s.first.map(f=>f[0]),['미입력','미입력','해당 없음']);assert.match(s.first[0][1],/^실적 정보/);assert.match(s.first[1][1],/^추가 공종/);
  await V.locator('.dvs-primary').click();assert.equal(await page.evaluate(()=>window.__dial),1,'사후 연락하기 = 전화 걸기');
  /* ⑦ 실주: 기록 보완(지연 아님 · 회색) · 타사 낙찰 · 당사 제안 */
  await open(6);s=await snap();await common(s,6);
  assert.equal(s.line2,'석민이앤씨 낙찰금액 타사 · A건설 당사 제안 3.5억');
  assert.match(s.meta,/· 실주 2026\.5\.7 ·/);
  assert.equal(s.task,'실주 기록 완성');assert.equal(s.due,'기록 보완 지연 아님 · 정보 보완');assert.equal(s.dueC,'gray');
  assert.equal(s.kv[1],'실주일 2026.5.7 · 낙찰사 A건설');assert.deepEqual(s.btns,[['실주 기록 채우기',true]]);
  assert.deepEqual(s.first,[['미입력','실주 사유'],['확인 필요','재영업 가능 여부 · 미정'],['해당 없음','다음 연락 · 재영업 예일 때만']]);
  if(process.env.SHOT_DIR)await page.screenshot({path:path.join(process.env.SHOT_DIR,'deal-frame7.png')});
  /* 기한 날짜는 목록과 같은 판정 함수 */
  assert.equal(await page.evaluate(()=>{const d=B.deals[0];return DealFrame7.due(d).date===PipelineJudge.basis(d).due;}),true);
  /* 끄기: 같은 정보 같은 판단 화면 그대로 */
  await page.evaluate(()=>{closeDetail();G.dealFrame7Off=true;drwDeal(JSON.stringify(B.deals[4]));});await page.waitForSelector('#detailView.dv3.dvt .dvs-task');await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>{const v=document.getElementById('detailView');return [v.classList.contains('dv7'),v.querySelectorAll('.dv7-bar,.dv7-meta,.dv7-first,.dv7-lb').length,v.querySelector('.dvs-task .lb').textContent,getComputedStyle(v.querySelector('.ddv-steps')).display!=='none',v.querySelector('.dv3-left .sth-hd>b').textContent];}),[false,0,'등록된 다음 업무',true,'이 단지 영업 이력']);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('deal frame7 ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
