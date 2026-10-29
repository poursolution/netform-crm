'use strict';
/* 영업 대시보드 3화면 · 시각화 (2026-10-20 design_handoff_dashboard_visual) — 합성 자료(verify-dash-b 와 같은 것) · 외부 연결 차단 · 저장 없음
   확인: 세 화면 상단 같음(공통 필터줄 + 다른 두 화면 ↗ · 기준 · 연도 · 연간/분기 · LIVE)
         전체 현황 = 이번 달 계약 큰 숫자 · 메이드율 도넛(결과 확정 기준) · 계약실적 / 기술자문 낙찰 따로 · 영업 흐름 7칸 · 월별 막대(누르면 그 달) · 진행 금액 단면 · 담당자 × 단계(기록 없으면 '기록 미확인')
         컨트롤타워 = 오늘 개입할 곳 = 미배정 + 첫 연락 지연 + 기한 지남 · 요청 도넛 · 기한 지난 기간 · 요청 흐름 · 담당자 × 문제(누르면 목록) · 요일별
         성과 분석 = 올해 계약실적(기술자문 별도) · 문의 → 계약 · 실주 원인 · 수주/실주 흐름 · 산점도 · 브랜드별
         움직임 0.24초 이하 · 끄기(G.dashVisOff) = 예전 화면 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),SHOT=process.env.DV_SHOT||'';
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-07T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DashB&&window.DashVisual&&window.SalesInsights&&window.BriefB&&window.ContractSalesData&&window.CommonFilterBar);
  await page.evaluate(()=>{
   const U=n=>'0000000'+n+'-0000-4000-8000-00000000000'+n,T=k=>k+'T10:00:00+09:00';
   const deal=(id,site,owner,code,extra)=>Object.assign({id,site,assignee:owner,brand:'POUR솔루션',created:'2026-02-01',code,stage_code:code,grp:'영업·관리',amt:1e8},extra||{});
   const lost=(id,site,owner,k,reason,brand)=>deal(id,site,owner,'lost',{outcome:'lost',grp:'수주 실패',brand,closed_at:T(k),closed:k,stage_contexts:{lost:{fields:{close_reason:reason,close_detail:'확인'}}}});
   const inq=(n,site,owner,at,extra)=>Object.assign({id:U(n),site,status:owner?'배정완료':'접수',at,created_at:at,received_at:at,brand:'POUR솔루션',assignee:owner||'',assigned_to:owner||'',assigned_at:owner?at:null},extra||{});
   B={deals:[
     deal('w1','[서울 마포] 계약 A','이필선','won',{outcome:'won',grp:'수주 성공',brand:'석민이앤씨',won_amount:5e8,closed_at:T('2026-03-10')}),
     deal('w2','[경기 고양] 계약 B','황윤선','won',{outcome:'won',grp:'수주 성공',won_amount:3e8,closed_at:T('2026-09-20')}),
     lost('l1','[인천] 실주 가격','이필선','2026-08-08','가격 열세','석민이앤씨'),lost('l2','[수원] 실주 소장','황윤선','2026-09-18','담당자 부재·인수인계 누락','POUR솔루션'),lost('l3','[수원] 실주 가격2','황윤선','2026-05-19','가격 열세','POUR솔루션'),
     ...[1,2,3,4,5].map(i=>deal('o'+i,'[경기] 기한 지난 현장 '+i,'황윤선','sent',{nextActionObj:{text:'후속 통화',due:'2026-09-20',status:'open'},lastMeaningfulContactAt:T('2026-09-01'),activities:[{id:'ao'+i,type:'전화',note:'통화',at:T('2026-09-01')}]})),
     deal('n1','[수원] 매탄 임박','이필선','bidding',{amt:4e8,brand:'석민이앤씨',stage_contexts:{bidding:{fields:{bid_deadline:'2026-10-09',bid_terms:'일반'}}},nextActionObj:{text:'입찰 준비',due:'2026-10-09',status:'open'},lastMeaningfulContactAt:T('2026-10-06'),activities:[{id:'an1',type:'전화',note:'관리소장 통화',at:T('2026-10-06'),actor:'이필선'}]}),
     deal('n2','[서울 송파] 계약 검토','이필선','contract',{amt:3e8,stage_contexts:{contract:{fields:{contract_status:'체결 예정',contract_amount:35e7,contract_date:'2026-10-27'}}},nextActionObj:{text:'계약서 검토',due:'2026-10-20',status:'open'},lastMeaningfulContactAt:T('2026-10-05'),activities:[{id:'an2',type:'방문',note:'현장 방문',at:T('2026-10-05')}]})],
    inquiries:[inq(1,'[경기 고양] 계약 B','황윤선','2026-08-02T10:00:00+09:00',{responded_at:'2026-08-02T11:00:00+09:00'}),inq(2,'[서울] 미배정 문의','','2026-10-07T08:00:00+09:00'),inq(3,'[부산] 범위 밖','','2026-08-06T10:00:00+09:00',{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 공사 범위 밖 · 이전 상태: 접수'}),inq(4,'[경기] 첫 연락 지연','이필선','2026-10-06T09:00:00+09:00')],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   const ev=(id,k,n,o,b)=>({deal_id:id,brand:b,sales_owner_name:o,events:[{kind:'signed',effective_date:k,amount_delta:n}]});
   ContractSalesData.state=()=>({status:'ready',items:[ev('w1','2026-03-10',5e8,'이필선','석민이앤씨'),ev('w2','2026-09-20',3e8,'황윤선','POUR솔루션')]});
   window.__opened=[];drwDeal=s=>__opened.push(JSON.parse(s).id);drwInq=s=>__opened.push(JSON.parse(s).id);
   window.__batch=null;if(window.PipelineBatch)PipelineBatch.openRows=(rows,mode)=>{window.__batch=[rows.map(r=>r.item.id).sort(),mode];};
   G.dashVisOff=false;window.__ev=[];SalesInsights.openEvidence=(t,s,l)=>{__ev.push([t,(l||[]).length]);};goPage('dash');
  });

  await page.waitForTimeout(500);
  const top=async pg=>one(await page.locator('#si-'+pg+' .db-tool').innerText()).replace(/^(전체 현황|컨트롤타워|성과 분석) ↗ (전체 현황|컨트롤타워|성과 분석) ↗ /,'');
  /* ── 전체 현황: 직원들이 지금 어떻게 영업하고 있나 ── */
  const D=page.locator('#si-dash .dv');assert.equal(await D.count(),1,'시각화 화면');assert.equal(await page.locator('#si-dash .db-kpis').count(),0,'예전 숫자 카드 대신');
  assert.equal(await page.locator('#pg-dash>.cf-bar').isVisible(),true,'공통 필터줄');const topDash=await top('dash');assert.match(topDash,/2026년 연간 접수 · 계약실적 \/ 파이프라인 · 조치 필요는 현재 기준 .*연간 1분기 2분기 3분기 4분기 LIVE 10\.07 10:00/);
  assert.match(one(await D.locator('.dv-hero').innerText()),/^10월 매출 실적 0 계약 0건 월 목표값 입력 후 막대 표시 · 계약 체결일 · 기술자문 낙찰확정일 기준$/,'이번 달 매출 실적(계약 + 기술자문 · 2026-10-29 합산) · 목표 없으면 지어내지 않음');
  assert.match(one(await D.locator('.dv-made').innerText()),/^40\.0% 메이드율 수주 2 실주 3 수주 2 ÷ \(수주 2 \+ 실주 3\) · 결과 확정 건 · 배드핏 제외 · 2026년 연간$/,'메이드율 + 산식 그대로');
  assert.match(one(await D.locator('.dv-ytd').innerText()),/매출 합계 8억 · 2건 계약실적 8억 · 2건 기술자문 낙찰 아직 없음/,'매출 합계 = 계약실적 + 기술자문 낙찰(구성 따로 보임)');
  const flow=await D.locator('.dv-flow .dv-fs button').evaluateAll(l=>l.map(b=>[b.querySelector('span').textContent,b.querySelector('b').textContent,b.querySelector('small').textContent]));
  assert.deepEqual(flow.map(f=>f[0]),['견적문의','컨설팅 설계','자료 발송','관계관리','경쟁 · 입찰','계약 · 시공','수주'],'영업 흐름 7칸');
  const C=await page.evaluate(()=>{const c=DashB.core();return {active:c.active.length,con:c.con.count};});
  assert.equal(flow.slice(1,6).reduce((s,f)=>s+Number(f[1]),0),C.active,'흐름 = 지금 보유(진행 중)');assert.equal(flow[6][1],String(C.con),'수주 = 원장 계약 건수');assert.equal(flow[3][2],'—','관계관리는 진입을 세지 않음(근거 있는 진척만)');
  /* 담당자별 이번 주: 실제 활동자 기준 · 기록 없으면 기록 미확인 · 활동자 미확인은 사람에 안 넣음 */
  const prow=async n=>one(await page.evaluate(n=>{const c=[...document.querySelectorAll('#si-dash .dv-ptab>*')],i=c.findIndex(x=>x.classList.contains('pn')&&x.textContent===n);return c.slice(i,i+5).map(x=>x.textContent).join(' | ');},n));
  assert.match(await prow('이필선'),/^이필선 \| 연결 1 · 방문 0 · 견적 0 \| 확인된 진척 없음 \| 2건 /,'이필선 = 본인이 남긴 연결 1건(영업건 담당으로 넘겨짚지 않음)');
  assert.match(await prow('황윤선'),/^황윤선 \| 기록 미확인 \| /,'기록 없으면 기록 미확인(0 아님)');
  assert.match(one(await D.locator('.dv-ptab+.dv-leg').innerText()),/활동자 미확인 기록 1건은 사람에 넣지 않음/,'활동자 모르는 방문 기록 = 사람에 안 넣음');
  const sum=await D.locator('.dv-sum button').evaluateAll(l=>l.map(b=>b.innerText.replace(/\s+/g,' ').trim()));
  assert.ok(sum.some(s=>/^이필선 매탄 임박 고객 연결/.test(s))&&sum.some(s=>/^활동자 미확인 계약 검토 방문/.test(s)),'주요 진행 내용 = 담당 · 현장 · 한 일 · 결과: '+JSON.stringify(sum));
  assert.equal(await page.locator('#si-dash .dv-cols').count(),0,'월별 그래프는 성과 분석으로');
  await D.locator('.dv-hero .dv-ev').click();await page.waitForTimeout(100);assert.match((await page.evaluate(()=>__ev.pop()))[0],/2026년 10월 계약 근거/,'큰 숫자 = 같은 조건 근거 목록');
  await page.locator('#si-dash .dv-flow button[data-v="relationship"]').click();await page.waitForTimeout(150);assert.match(await prow('황윤선'),/관계관리 0건 전체 \d+건/,'흐름 칸 = 표의 보유 칸을 그 단계로');
  await page.locator('#si-dash .dv-people button[data-v="황윤선"]').click();await page.waitForTimeout(150);
  assert.match(one(await page.locator('#si-dash .dv-made').innerText()),/^33\.3% 메이드율 수주 1 실주 2 수주 1 ÷ \(수주 1 \+ 실주 2\)/,'담당자 칩 = 그 사람 기준');assert.ok(await page.locator('#si-dash .dv-ptab .dim').count()>=1,'다른 사람은 흐려짐');
  const anim=await page.evaluate(()=>[...document.querySelectorAll('#si-dash .dv *')].map(n=>getComputedStyle(n)).filter(s=>s.animationName!=='none').map(s=>parseFloat(s.animationDuration)));assert.ok(anim.length&&anim.every(x=>x<=0.24),'움직임 0.24초 이하');
  assert.doesNotMatch(await D.innerText(),/요청 보내기|재배정|독촉|잘함|못함|막힘/,'전체 현황에 요청 · 평가 문구 없음');
  if(SHOT)await page.locator('#si-dash').screenshot({path:SHOT.replace('.png','-dash.png')});
  /* ── 컨트롤타워: 어디에 개입하고 무엇을 처리하나 ── */
  await page.locator('#si-dash .db-tool [data-db="go"][data-v="control"]').click();await page.waitForTimeout(500);
  const T=page.locator('#si-control .dv');assert.equal(await T.count(),1);assert.equal(await top('control'),topDash,'세 화면 상단 같음');
  const th=/^지금 처리할 대상 (\d+) 영업건 · 문제 항목 (\d+)개/.exec(one(await T.locator('.dv-hero').innerText()));assert.ok(th,'영업건 수와 문제 항목 수를 나눠 적음');assert.ok(Number(th[1])<=Number(th[2]));
  const rows=await T.locator('.dv-tg .tr').evaluateAll(l=>l.map(r=>[...r.children].map(c=>c.textContent)));assert.equal(rows.length,Number(th[1]),'목록 = 고유 영업건');assert.ok(rows.length<=20,'한 쪽 20건');
  assert.ok(rows.every(r=>r.length===5&&r[4]),'현장 · 문제 · 근거 · 담당 · 조치 · 요청 상태');assert.ok(rows.some(r=>/기한 초과/.test(r[1])),'기한 초과 대상');assert.ok(rows.some(r=>/마감 임박/.test(r[1])),'제출 · 계약 마감 임박');
  assert.deepEqual(await T.locator('.dv-flow .dv-fs span').allInnerTexts(),['미확인','확인 후 미착수','진행','회신 대기','완료','취소'],'요청 추적 6단계');
  assert.match(one(await T.locator('.dv-heat').innerText()),/황윤선 \d+건/,'이름 옆 = 고유 영업건 수');
  await T.locator('.dv-heat button:not([disabled])').first().click();await page.waitForTimeout(150);assert.equal(await page.locator('#si-control .dv-selbox').count(),1,'칸 누르면 그 건 목록');
  const three=one(await page.locator('#si-control .dv-row3').nth(1).innerText());assert.match(three,/대기와 미처리 구분 고객 회신 대기.*내부 자료 대기.*담당 미착수.*처리 중/);assert.match(three,/기록 확인 · 자료 보완 연락 기록 미확인.*지연으로 세지 않음/);assert.match(three,/관리자 판단이 필요한 건 기한 변경 요청/);
  assert.doesNotMatch(await T.innerText(),/월별 계약|메이드율|실주 원인|우리가 못 챙김|접촉 끊김/,'성과 그래프 · 단정 문구는 컨트롤타워에 없음');
  if(SHOT)await page.locator('#si-control').screenshot({path:SHOT.replace('.png','-control.png')});
  /* ── 성과 분석: 성과가 어디서 나왔고 어떤 차이가 있나 ── */
  await page.locator('#si-control .db-tool [data-db="go"][data-v="perf"]').click();await page.waitForTimeout(500);
  const Pf=page.locator('#si-perf .dv');assert.equal(await Pf.count(),1);assert.equal(await top('perf'),topDash,'세 화면 상단 같음');
  assert.match(one(await Pf.locator('.dv-hero').innerText()),/^올해 매출 실적 8억 2건 계약실적 8억 · 2건 \+ 기술자문 낙찰 없음/);
  {const fm=/^문의 4 적합 3 견적 발송 (\d+) 계약 (\d+)$/.exec(one(await Pf.locator('.dv-fun').innerText()));assert.ok(fm,'문의 전환');assert.ok(Number(fm[1])<=3&&Number(fm[2])<=3,'같은 문의 집단');}
  assert.match(one(await Pf.locator('.dv-fun+.dv-mut').innerText()),/결과 확정 \d+\(계약 \d+ · 실주 \d+\) · 진행 중 \d+ · 배드핏 1/,'결과 확정과 진행 중 구분');
  assert.match(one(await Pf.locator('.dv-row3').first().locator('.dv-card').nth(2).innerText()),/^실주 원인 가격 열세 2 담당자 부재·인수인계 누락 1/);
  assert.deepEqual(await Pf.locator('.dv-cols button span').allInnerTexts(),['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월'],'계약실적 추이');
  await Pf.locator('.dv-cols button[data-v="9"]').click();await page.waitForTimeout(150);assert.match(one(await page.locator('#si-perf .dv-cols+.dv-sel').innerText()),/^2026년 9월 · 3억 · 계약 1건 · 2026년 연간 원장 기록 체결 2 · 변경 0 · 취소 0$/);
  assert.match(one(await page.locator('#si-perf .dv-cmp').innerText()),/황윤선 3억 · 1건 1 · 2 33\.3% \(1 \/ 3\)/,'담당자 비교 = 분자 / 분모');
  assert.match(one(await page.locator('#si-perf .dv-row3').nth(1).innerText()),/판단 보류/,'표본 적으면 판단 보류');
  if(SHOT)await page.locator('#si-perf').screenshot({path:SHOT.replace('.png','-perf.png')});
  const bad=await page.evaluate(()=>{const ok=c=>{const m=/rgba?\((\d+), (\d+), (\d+)/.exec(c);if(!m)return true;const [r,g,b]=m.slice(1).map(Number);const gray=Math.max(r,g,b)-Math.min(r,g,b)<24;const blue=b>r&&b>=g;const red=r>g&&r>b&&Math.abs(g-b)<40;return gray||blue||red;};const out=[];document.querySelectorAll('#si-perf .dv *:not(.dv-br *):not(.dv-br)').forEach(n=>{const s=getComputedStyle(n);[s.backgroundColor,s.color].forEach(c=>{if(!ok(c))out.push(n.className+' '+c);});});return out.slice(0,5);});
  assert.deepEqual(bad,[],'색 기준');
  await page.evaluate(()=>{G.dashVisOff=true;goPage('dash');});await page.waitForTimeout(400);assert.equal(await page.locator('#si-dash .dv').count(),0);assert.equal(await page.locator('#si-dash .db-kpis').count(),1,'끄기 = 예전 화면');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',writes:0}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
