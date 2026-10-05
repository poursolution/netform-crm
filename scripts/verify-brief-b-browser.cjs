'use strict';
/* 주간 영업 브리핑 v2 검사(2026-10-03 design_handoff_weekly):
   이번 주 성과(v2: 이번 주 한 줄 · 흐름 4칸 · 비율 한 줄 · 꼬리표 한 줄) · 전주 문제 → 조치 → 결과(지난주 등록 항목을 지금 자료로 다시 셈) · 영업 이동 · 계약실적(원장) · 담당자별 움직임 ·
   다음 주 반드시 끝낼 것(담당 · 기한 · 등록 = 스냅샷 약속 저장) · 전체 현황 · 잔디 미리보기. 메이드율은 배드핏 제외. 이모지 없음. 끄면 이전 화면.
   견적문의 종결 = 배드핏(부적합 종결) · 사유 필수 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),shot=process.argv[2]||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});/* 뒤에 등록한 crm-jandi 흉내가 먼저 잡는다 */
  const page=await ctx.newPage(),errs=[],jandi=[];page.on('pageerror',e=>errs.push(e.message));
  /* 잔디 발송 서버 함수 흉내: 받은 요청을 기록하고 보낸 시각을 돌려준다 */
  await ctx.route('**/functions/v1/crm-jandi',async r=>{const b=r.request().postDataJSON();jandi.push(b);const at=new Date().toISOString(),jd=b.auto?{auto_sent_at:at}:{auto_sent_at:jandi.some(x=>x.auto)?at:undefined,resent_at:at};return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,skipped:false,jandi:jd,snapshot:{kind:b.kind,period_key:b.period_key,payload:Object.assign({},b.payload||{},{jandi:jd}),promises:b.promises||[]}})});});
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.BriefB&&window.BriefV2&&window.OpsStore&&window.ContractSalesData&&typeof paintBrief==='function');
  const w=await page.evaluate(()=>{
   const w=BriefB.win(),day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA'),at=k=>k+'T10:00:00+09:00';
   const P='POUR솔루션',U=n=>'0000000'+n+'-0000-4000-8000-00000000000'+n;
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:P,created:day(-100),updated:day(-50),code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const inq=(n,owner,k,extra)=>Object.assign({id:U(n),site:'문의 '+n,status:owner?'배정완료':'접수',at:at(k),created_at:at(k),received_at:at(k),brand:P,assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at(k):null},extra||{});
   B={deals:[
     deal('d1','[서울 도봉] 발송 현장','이필선','sent',{stage_contexts:{sent:{fields:{sent_date:w.a,materials:['견적서'],recipient:'소장'}}},stageHistory:[{at:at(w.a),from:'consulting',to:'sent'}],next_action:{id:'n1',text:'후속 통화',due:day(3),status:'open'},activities:[{id:'a1',type:'전화',note:'통화 완료 · 견적 발송 안내',at:at(w.a)}]}),
     deal('d2','[경기 고양] 실주 현장','이필선','lost',{outcome:'lost',grp:'수주 실패',closed_at:at(w.a),closed:w.a,stage_contexts:{lost:{fields:{close_reason:'가격 열세',close_detail:'타사 견적이 낮음'}}}}),
     deal('d3','[서울 마포] 계약 현장','황윤선','won',{outcome:'won',grp:'수주 성공',won_amount:2e8,closed_at:at(w.a),workItems:['재도장>외부'],primaryWork:'재도장>외부'}),
     deal('d4','[서울 노원] 지난주 계약','이필선','won',{outcome:'won',grp:'수주 성공',won_amount:1e8,closed_at:at(w.p)}),
     deal('d5','[인천 연수] 멈춘 현장','황윤선','consulting',{amt:4e8}),
     deal('d6','[서울 강남] 계약 예정','황윤선','contract',{amt:3e8,created:day(-40),stage_contexts:{contract:{fields:{bid_result:'수의계약',contract_amount:3e8,contract_status:'체결 예정',contract_date:day(3)}}},next_action:{id:'n6',text:'계약서 확인',due:day(3),status:'open'},activities:[{id:'a6',type:'전화',note:'통화 완료 · 계약 일정 확인',at:new Date(Date.now()-864e5).toISOString()}]})],
    inquiries:[inq(1,'이필선',w.a),inq(2,'',w.a,{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 공사 범위 밖 — 세대 내부 공사 · 이전 상태: 접수'}),inq(3,'',w.a,{status:'POUR스토어 이관대기'}),inq(4,'이필선',w.p)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';G.briefView='week';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   /* 계약실적 원장 · 주간 스냅샷 저장소 흉내 */
   const ev=(id,k,n,o)=>({deal_id:id,brand:P,sales_owner_name:o,events:[{kind:'signed',effective_date:k,amount_delta:n}]});
   ContractSalesData.state=()=>({status:'ready',items:[ev('d3',w.a,2e8,'황윤선'),ev('d4',w.p,1e8,'이필선')]});
   window.__snaps=[{kind:'weekly',period_key:w.p,payload:{},promises:[{kind:'no_next',t:'다음 행동 미등록 2건 등록',act:'담당자별 코칭 · 다음 행동 등록 요청',n:2,ids:['d1','d5'],owner:'이필선',due:'수요일',at:w.p+'T09:00:00+09:00'}]}];window.__saves=[];
   TOKEN='test';window.__flags={};OpsStore.flags=()=>__flags;OpsStore.setFlag=async(k,v)=>{__flags[k]=!!v;return __flags;};OpsStore.has=()=>true;OpsStore.admin=()=>true;OpsStore.rpc=async(name,p)=>{if(name==='crm_report_snapshot_get_v1')return {ok:true,snapshots:__snaps.slice()};if(name==='crm_report_snapshot_save_v1'){__saves.push(p);const i=__snaps.findIndex(s=>s.period_key===p.period_key);const row={kind:'weekly',period_key:p.period_key,payload:p.payload,promises:p.promises};if(i>=0)__snaps[i]=row;else __snaps.push(row);return {ok:true};}return {ok:true};};
   goPage('brief');return w;
  });
  await page.waitForTimeout(500);
  const v=page.locator('#brief-b');assert.equal(await v.count(),1,'새 주간 브리핑');assert.equal(await page.locator('#brief-v2').count(),0);
  assert.match(await v.locator('.bb-head').innerText(),new RegExp('^'+w.a.replace(/-/g,'\\.')+' – \\d{2}\\.\\d{2}\\s*지난주 대비 무엇이 움직였나\\s*월간 일정 보기$'));
  /* 1. 이번 주 성과 */
  /* 이번 주 성과 v2(2026-10-05 design_handoff_brief_v2): 흰 카드 하나 — 이번 주 한 줄(끊긴 단계 자동 감지) · 흐름 4칸 · 비율 한 줄 · 꼬리표 한 줄. 검정 · 남색 바탕 없음 */
  const P2=page.locator('#brief-b .bp2'),one=s=>String(s).replace(/\s+/g,' ').trim(),cssOf=(sel,props)=>page.locator('#brief-b .bp2 '+sel).evaluateAll((l,props)=>l.map(n=>{const s=getComputedStyle(n);return props.map(p=>s[p]);}),props);
  assert.equal(await P2.count(),1);assert.equal(await v.locator('.bb-card').first().evaluate(n=>n.classList.contains('bp2')),true,'맨 위 블록');
  assert.equal(await v.locator('.bb-funnel,.bb-rates,.tf-perf,.bb-two').count(),0,'예전 숫자 카드 · 수주 표 · 종결 상자는 꼬리표로 합쳤다');
  assert.equal(one(await P2.locator('.bp2-line').innerText()),'이번 주 한 줄 문의 3건 → 견적 1건 → 계약 1건 · 2억 계약 목록 보기 →');
  assert.deepEqual(await P2.evaluate(n=>{const s=getComputedStyle(n),b=getComputedStyle(n.querySelector('.bp2-bar'));return [s.backgroundColor,s.borderTopColor,s.borderTopWidth,s.borderTopLeftRadius,b.backgroundColor,b.width,b.height];}),['rgb(255, 255, 255)','rgb(232, 234, 239)','1px','14px','rgb(59, 108, 228)','3px','22px'],'흰 카드 · 끊김 없음 = 파란 띠');
  assert.deepEqual((await P2.locator('.bp2-step').allInnerTexts()).map(one),['신규 견적문의 3 건 ▲2 전주 대비 →','적합 문의 1 건 전주와 같음 33% 넘어옴 →','견적 발송 1 건 ▲1 전주 대비 100% 넘어옴 →','신규 계약 1 건 · 2억 전주와 같음 100% 넘어옴'],'닫힌 문의 2건(배드핏 종결 1 + 스토어 이관 1)을 뺀 적합 1건');
  assert.deepEqual(await cssOf('.bp2-step .v b',['fontSize','color']),Array(4).fill(['30px','rgb(21, 23, 28)']));
  assert.deepEqual((await cssOf('.bp2-step .d',['color'])).flat(),['rgb(31, 122, 77)','rgb(156, 163, 175)','rgb(31, 122, 77)','rgb(156, 163, 175)'],'▲ 초록 · 같으면 회색');
  assert.equal(await P2.locator('.bp2-step .ar').count(),3,'칸 사이 원형 →');assert.equal(await P2.locator('.bp2-flow').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),4);
  const rates=(await P2.locator('.bp2-rates>div').allInnerTexts()).map(one);
  assert.deepEqual(rates.slice(0,3),['문의 적합률 33.3% ▼66.7%p 적합 ÷ 문의 · 문의 품질','영업 메이드율 50.0% ▼50.0%p 수주 ÷ (수주 + 실주) · Bad Fit 제외','문의 → 계약 33.3% ▼66.7%p 이번 주 활동 비율'],'메이드율 = 수주 1 ÷ (수주 1 + 실주 1) — 종결 2건은 분모에 없음');
  assert.match(rates[3],/^확정 전환율 \((\d+)월 문의\) — \1월에 접수된 문의가 없습니다$/);
  assert.deepEqual((await P2.locator('.bp2-tags .t').allInnerTexts()).map(one),['수주 1건 · 2억 · 계약실적 1건 2억 · 협약 · 기술자문 0 · 타사 이관 0','파이프라인 실주 1건 · 메이드율에 포함','견적문의 종결 2건 · Bad Fit 1 (공사 범위 밖 1) · 메이드율 제외']);
  assert.deepEqual(await cssOf('.bp2-tags .t',['backgroundColor','color','borderTopLeftRadius']),[['rgb(245, 248, 255)','rgb(21, 23, 28)','999px'],['rgb(253, 236, 236)','rgb(180, 35, 24)','999px'],['rgb(245, 246, 248)','rgb(55, 65, 81)','999px']],'수주 = 옅은 파랑 · 실주 있음 = 빨강 · 종결 = 회색');
  assert.deepEqual(await P2.locator('.bp2-tags .t').evaluateAll(l=>l.map(n=>n.title)).then(a=>[a[1],/^(공사 범위 밖 1 · 스토어 · 자재 문의 1|스토어 · 자재 문의 1 · 공사 범위 밖 1)$/.test(a[2])]),['가격 열세 1',true],'사유는 올려 두면 보인다');
  assert.deepEqual(await P2.evaluate(n=>[...n.querySelectorAll('*')].concat(n).map(e=>getComputedStyle(e).backgroundColor).filter(c=>/^rgb\((\d+), (\d+), (\d+)\)$/.test(c)&&c.match(/\d+/g).slice(0,3).every(v=>Number(v)<90))),[],'검정 · 남색 바탕 없음');
  /* 계약 목록 보기 = 이 화면의 이번 주 계약실적으로 */
  await P2.locator('.bp2-go').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>G.page),'brief');
  /* 끊긴 단계: 견적 발송이 0이면 빨간 띠 + 그 칸 빨간 숫자 + '여기서 끊김' + [견적 대기 n건 보기] */
  await page.evaluate(()=>{window.__keepDeals=B.deals;B.deals=B.deals.filter(d=>d.id!=='d1');paintBrief();});await page.waitForTimeout(200);
  assert.equal(one(await P2.locator('.bp2-line').innerText()),'이번 주 한 줄 적합 문의 1건이 견적 발송으로 넘어가지 않았습니다 — 이번 주 견적 발송 0건 견적 대기 1건 보기 →');
  assert.equal(await P2.locator('.bp2-bar').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(209, 74, 63)','끊김 = 빨간 띠');
  assert.deepEqual((await P2.locator('.bp2-step').allInnerTexts()).map(one).slice(2),['견적 발송 0 건 전주와 같음 여기서 끊김 · 1건이 안 넘어옴 →','신규 계약 1 건 · 2억 전주와 같음']);
  assert.deepEqual(await cssOf('.bp2-step.cut .v b, .bp2-step.cut .n',['color','fontWeight']).then(a=>a.map(x=>x[0])),['rgb(180, 35, 24)','rgb(180, 35, 24)']);assert.equal(await P2.locator('.bp2-step.cut').count(),1,'끊긴 첫 칸만');
  await P2.locator('.bp2-go').click();await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>G.page),'inq','견적 대기 = 견적문의로');
  /* 원장을 못 읽으면 계약 칸 · 수주 꼬리표 · 비율을 지어내지 않는다 */
  await page.evaluate(()=>{B.deals=window.__keepDeals;window.__keepLedger=ContractSalesData.state;ContractSalesData.state=()=>({status:'loading',items:[]});goPage('brief');});await page.waitForTimeout(300);
  assert.equal(one(await P2.locator('.bp2-line').innerText()),'이번 주 한 줄 문의 3건 → 견적 1건 → 계약 원장 확인 중 계약 목록 보기 →');
  assert.equal(one(await P2.locator('.bp2-step').nth(3).innerText()),'신규 계약 — 원장 확인 중');assert.equal(one(await P2.locator('.bp2-tags .t').first().innerText()),'수주실적 원장 확인 중');
  assert.match(one(await P2.locator('.bp2-rates>div').nth(1).innerText()),/^영업 메이드율 — 계약실적 원장을 읽은 뒤 계산합니다$/);
  /* 끄면 예전 블록 */
  await page.evaluate(()=>{ContractSalesData.state=window.__keepLedger;G.briefPerfV2Off=true;paintBrief();});await page.waitForTimeout(200);
  assert.equal(await v.locator('.bp2').count(),0);assert.deepEqual(await v.locator('.bb-fn>b').allInnerTexts(),['3건','1건','1건','1건 · 2억']);assert.match(await v.locator('.tf-perf').innerText(),/^수주실적 낙찰금액 · VAT 별도\s*1건 · 2억\s*├ 계약실적 \(계약 체결일\)/,'수주실적 = 낙찰금액(VAT 별도) · 그 안의 계약실적(계약 체결일)을 이름 붙여 보여 준다');
  await page.evaluate(()=>{G.briefPerfV2Off=false;paintBrief();});await page.waitForTimeout(200);assert.equal(await P2.count(),1);
  /* 2. 전주 문제 → 조치 → 결과: 지난주 등록 항목을 지금 자료로 다시 센다 */
  /* 2차 기능 5: 지난주 약속 → 이번 주 결과 요약(큰 숫자 · 막대 · 완료 / 지연 / 미완료 — 시안 그대로) — 아래 표와 같은 계산 */
  assert.match(await v.locator('.bb-card').nth(1).locator('.bb-prom').innerText(),/^2건\s*지난주에 ‘다음 주 반드시 끝낼 것’으로 등록\s*완료 1\s*지연 0\s*미완료 1$/);
  assert.deepEqual(await v.locator('.bb-card').nth(1).locator('.bb-prom .bar i').evaluateAll(l=>l.map(n=>n.style.width)),['50%','0%','50%']);
  assert.match(await v.locator('.bb-card').nth(1).innerText(),/전주 문제 → 이번 주 조치 → 결과\s*지난주 회의에서 정한 것 · 해결 1 \/ 2건[\s\S]*다음 행동 미등록\s*2건\s*담당자별 코칭 · 다음 행동 등록 요청 — 이필선 · 수요일\s*1건 등록\s*· 1건 미완료/);
  /* 3. 영업 이동 · 4. 계약실적 */
  assert.deepEqual(await v.locator('.bb-move>span:first-child').allInnerTexts(),['신규 문의','담당 배정','견적 준비','자료 발송','관계관리','경쟁 · 입찰','계약']);
  const mv=await v.locator('.bb-move').allInnerTexts();assert.match(mv[0],/\+3\s*\(\+2\)/);assert.match(mv[3],/\+1\s*\(\+1\)/,'자료 발송 = 단계 변경 이력');assert.match(mv[6],/\+1\s*\(\+0\)/,'계약 = 원장');
  assert.match(await v.locator('.bb-grid2 .bb-card').nth(1).innerText(),/이번 주 계약실적\s*계약 체결일 기준 · 계약금액\s*1건 · 2억\s*전주 1건 · 1억 → \+1억[\s\S]*월 누적[\s\S]*연 누적[\s\S]*\[서울 마포\] 계약 현장\s*POUR솔루션 · [\s\S]*황윤선 · \d+\/\d+\s*2억/);
  assert.equal(await v.locator('.bb-cons>div').first().evaluate(n=>getComputedStyle(n).borderLeftColor),'rgb(31, 157, 85)','브랜드 색 띠');
  /* 5. 담당자별 움직임 */
  assert.deepEqual(await v.locator('.bb-thead.bb-pcols span').allInnerTexts(),['담당','진행','장기정체','문의 · 견적','계약','한 줄']);
  const rows=await v.locator('.bb-prow').allInnerTexts(),lee=rows.find(r=>/^이필선/.test(r)),hw=rows.find(r=>/^황윤선/.test(r));
  assert.match(lee,/문의 1 · 견적 1\s*0건/);assert.match(hw,/1건 · 2억/);assert.match(hw,/\d+ → \d+/);
  /* 6. 다음 주 반드시 끝낼 것 */
  const N=v.locator('.bb-next');assert.ok(await N.count()>=2,'규칙 후보');
  assert.match(await v.locator('.bb-card.bb-main').first().innerText(),/^다음 주 반드시 끝낼 것[\s\S]*계약 예상 1건 · 3억/);
  const ce=N.filter({hasText:'계약 예상 1건 진행 확인 · 3억'});assert.equal(await ce.count(),1);assert.deepEqual(await ce.locator('.due button').allInnerTexts(),['월요일','수요일','금요일']);assert.equal(await ce.locator('.due button[aria-pressed="true"]').innerText(),'금요일');assert.equal(await ce.locator('.own button[aria-pressed="true"]').innerText(),'황윤선');
  await ce.locator('.due button',{hasText:'수요일'}).click();await page.waitForTimeout(150);
  assert.deepEqual(await page.evaluate(()=>__saves),[],'고르는 것만으로 저장 없음');
  await page.locator('#brief-b .bb-next',{hasText:'계약 예상 1건'}).locator('.reg').click();await page.waitForTimeout(400);
  const sv=await page.evaluate(()=>__saves.map(s=>[s.kind,s.period_key,s.promises.map(p=>[p.kind,p.owner,p.due,p.ids.join(',')])]));
  assert.deepEqual(sv,[['weekly',w.a,[['contract_expected','황윤선','수요일','d6']]]],'등록 = 주간 스냅샷 약속 저장');
  assert.equal(await page.locator('#brief-b .bb-next.done .reg').innerText(),'등록됨 ✓');
  /* 잔디 미리보기 */
  const J=await page.locator('#bbJandi').innerText();
  assert.match(J,/^\[주간 영업 브리핑\][\s\S]*1\. 이번 주 성과\s*견적문의 3건 → 적합 1 → 견적 발송 1 → 계약 1건 · 2억[\s\S]*영업 메이드율 50\.0%[\s\S]*종결 2건 · Bad Fit 1 \(메이드율 제외\) · 파이프라인 실주 1건 \(가격 열세 1\)[\s\S]*\[전주 문제 → 결과\]\s*· 다음 행동 미등록 2건 → 1건 등록 \/ 1건 미완료[\s\S]*계약실적 1건 · 2억[\s\S]*다음 주 반드시 끝낼 것\s*· 계약 예상 1건 진행 확인 · 3억 — 황윤선 · 수요일/);
  assert.equal(/\p{Extended_Pictographic}/u.test((await v.innerText()).replace(/[✓▲▼]/g,'')),false,'이모지 없음');
  /* 잔디: 꺼져 있으면 켜기 → 아직 발송 전 → [다시 보내기] = 서버 함수로 실제 발송(약속 포함) → 회의 후 다시 보냄 */
  assert.match(await v.locator('.bb-side dl').innerText(),/자동 발송\s*꺼짐 \(화면에서만 확인\)\s*상태\s*잔디 발송 꺼짐/);
  await v.locator('.bb-side [data-bb="jandion"]').click();await page.waitForTimeout(300);
  assert.match(await page.locator('#brief-b .bb-side dl').innerText(),/상태\s*아직 발송 전 — 월요일 08:30 이후 자동 발송/);assert.equal(await page.locator('#brief-b .bb-side [data-bb="jandion"]').count(),0);
  await page.locator('#brief-b .bb-side .send').click();await page.waitForTimeout(600);
  assert.equal(jandi.length,1);assert.equal(jandi[0].kind,'weekly');assert.equal(jandi[0].period_key,w.a);assert.equal(jandi[0].auto,false);assert.match(jandi[0].text,/^\[주간 영업 브리핑\][\s\S]*다음 주 반드시 끝낼 것\s*· 계약 예상 1건 진행 확인 · 3억 — 황윤선 · 수요일/);
  assert.deepEqual(jandi[0].promises.map(p=>[p.kind,p.owner,p.due]),[['contract_expected','황윤선','수요일']],'회의에서 정한 약속을 넣어 보냄');assert.equal(typeof jandi[0].payload.jandi,'string');
  assert.match(await page.locator('#brief-b .bb-side dl').innerText(),/상태\s*회의 후 다시 보냄 ✓ · \d+\/\d+ \d{2}:\d{2}/);
  /* 자동 발송: 월요일 08:30 이후 관리자 화면이 열려 있으면 그 주 한 번 */
  await page.evaluate(k=>{G.briefBNow=k+'T08:10:00';BriefB.autoSend();},w.b);await page.waitForTimeout(300);assert.equal(jandi.length,1,'08:30 전에는 보내지 않음');
  await page.evaluate(k=>{G.briefBNow=k+'T09:00:00';BriefB.autoSend();},w.b);await page.waitForTimeout(500);
  assert.equal(jandi.length,2);assert.equal(jandi[1].auto,true);assert.equal(jandi[1].period_key,w.a);assert.match(jandi[1].text,/^\[주간 영업 브리핑\]/);
  await page.evaluate(()=>BriefB.autoSend());await page.waitForTimeout(300);assert.equal(jandi.length,2,'같은 주는 한 번만');await page.evaluate(()=>{G.briefBNow=null;});
  /* 7. 전체 현황(참고) */
  assert.match(await page.locator('#brief-b .bb-ref').innerText(),/^전체 현황 \(참고\)\s*진행 3건 · 올해 수주 \d+건 · 승률 [\d.]+% · 180일\+ 방치 \d+건[\s\S]*이필선 진행 \d+ · 방치 \d+ · 수주 \d+/);
  if(shot){await page.locator('#brief-b .bb-head').scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.screenshot({path:shot+'-1.png'});await page.locator('#brief-b .bb-prow').first().scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.screenshot({path:shot+'-2.png'});}
  /* 견적문의 종결 = 종결 창(4종 · 2026-10-05 견적문의 흐름 ②)에서 Bad Fit · 사유 필수(목록 = 운영 기준) · 저장은 명령 하나 */
  const r=await page.evaluate(async()=>{
   window.__rpc=[];SB={rpc:async(name,args)=>{__rpc.push([name,args.p]);return {data:{ok:true,closed_at:new Date().toISOString(),close_reason:args.p.kind+' 종결 — '+args.p.reason+' · 이전 상태: 배정완료'}};}};
   const keepRpc=OpsStore.rpc;OpsStore.rpc=async(name,p)=>{if(name==='crm_inquiry_command_v1'){__rpc.push([name,p]);return {ok:true,status:'배드핏',close_reason:'Bad Fit · '+p.reason,state:null};}return keepRpc(name,p);};
   const q=B.inquiries[0];inqCtlOpenClose(inqKey(q));const m=document.querySelector('.inq-ctl-modalintro').closest('[role=dialog],.modal,.inq-ctl-modal,div');const title=document.getElementById('inquiryControlTitle').textContent==='문의 종결'&&document.getElementById('inq-close-type').value==='bad_fit';
   const opts=[...document.querySelectorAll('#inq-close-kind option')].map(o=>o.textContent);inqCtlConfirmClose();const err=document.getElementById('inq-ctl-error').textContent;
   document.getElementById('inq-close-kind').value='대상 고객 아님';inqCtlConfirmClose();await new Promise(z=>setTimeout(z,150));
   return {title,opts,err,rpc:__rpc,status:q.status,bad:BriefB.badfit(q),reason:BriefB.badfitReason(q)};
  });
  assert.equal(r.title,true);assert.deepEqual(r.opts,['사유를 골라 주세요','수행불가 공종','규모 부적합','대상 고객 아님','서비스 범위 아님','기타']/* 운영 기준(ops-rules.js)의 Bad Fit 사유 */);assert.match(r.err,/Bad Fit 사유를 골라 주세요/,'사유 필수');
  assert.deepEqual(r.rpc,[['crm_inquiry_command_v1',{type:'close',inquiry_id:'00000001-0000-4000-8000-000000000001',kind:'bad_fit',reason:'대상 고객 아님',detail:'',attempts:0}]]);assert.equal(r.status,'배드핏');assert.equal(r.bad,true);assert.equal(r.reason,'대상 고객 아님');
  /* 끄기 */
  await page.evaluate(()=>{G.briefBOff=true;goPage('brief');});await page.waitForTimeout(400);
  assert.equal(await page.locator('#brief-b').count(),0);assert.equal(await page.locator('#brief-v2').count(),1,'끄면 이전 화면');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',week_result:true,made_rate_excludes_badfit:true,prev_promises_reevaluated:true,stage_moves:true,contract_ledger:true,people_moves:true,next_promises_saved:true,jandi_preview:true,jandi_send:true,jandi_auto_once:true,no_emoji:true,inquiry_badfit_close:true,legacy_switch:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
