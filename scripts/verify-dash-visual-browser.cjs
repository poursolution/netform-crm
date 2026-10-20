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
     deal('n1','[수원] 매탄 임박','이필선','bidding',{amt:4e8,brand:'석민이앤씨',stage_contexts:{bidding:{fields:{bid_deadline:'2026-10-09',bid_terms:'일반'}}},nextActionObj:{text:'입찰 준비',due:'2026-10-09',status:'open'},lastMeaningfulContactAt:T('2026-10-06'),activities:[{id:'an1',type:'전화',note:'관리소장 통화',at:T('2026-10-06')}]}),
     deal('n2','[서울 송파] 계약 검토','이필선','contract',{amt:3e8,stage_contexts:{contract:{fields:{contract_status:'체결 예정',contract_amount:35e7,contract_date:'2026-10-27'}}},nextActionObj:{text:'계약서 검토',due:'2026-10-20',status:'open'},lastMeaningfulContactAt:T('2026-10-05'),activities:[{id:'an2',type:'방문',note:'현장 방문',at:T('2026-10-05')}]})],
    inquiries:[inq(1,'[경기 고양] 계약 B','황윤선','2026-08-02T10:00:00+09:00',{responded_at:'2026-08-02T11:00:00+09:00'}),inq(2,'[서울] 미배정 문의','','2026-10-07T08:00:00+09:00'),inq(3,'[부산] 범위 밖','','2026-08-06T10:00:00+09:00',{status:'종결',close_reason:'기타 종결 — 배드핏(부적합) · 공사 범위 밖 · 이전 상태: 접수'}),inq(4,'[경기] 첫 연락 지연','이필선','2026-10-06T09:00:00+09:00')],
    activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op)=>{__writes.push(op);return 'req';};
   const ev=(id,k,n,o,b)=>({deal_id:id,brand:b,sales_owner_name:o,events:[{kind:'signed',effective_date:k,amount_delta:n}]});
   ContractSalesData.state=()=>({status:'ready',items:[ev('w1','2026-03-10',5e8,'이필선','석민이앤씨'),ev('w2','2026-09-20',3e8,'황윤선','POUR솔루션')]});
   window.__opened=[];drwDeal=s=>__opened.push(JSON.parse(s).id);drwInq=s=>__opened.push(JSON.parse(s).id);
   window.__batch=null;if(window.PipelineBatch)PipelineBatch.openRows=(rows,mode)=>{window.__batch=[rows.map(r=>r.item.id).sort(),mode];};
   G.dashVisOff=false;goPage('dash');
  });

  await page.waitForTimeout(500);
  const top=async pg=>{const t=one(await page.locator('#si-'+pg+' .db-tool').innerText());return t.replace(/^(전체 현황|컨트롤타워|성과 분석) ↗ (전체 현황|컨트롤타워|성과 분석) ↗ /,'');};
  /* ── 전체 현황 ── */
  const D=page.locator('#si-dash .dv');assert.equal(await D.count(),1,'시각화 화면');assert.equal(await page.locator('#si-dash .db-kpis').count(),0,'예전 숫자 카드 대신');
  assert.equal(await page.locator('#pg-dash>.cf-bar').isVisible(),true,'공통 필터줄');const topDash=await top('dash');assert.match(topDash,/2026년 연간 접수 · 계약실적 \/ 파이프라인 · 조치 필요는 현재 기준 .*연간 1분기 2분기 3분기 4분기 LIVE 10\.07 10:00/);
  const hero=one(await D.locator('.dv-hero').innerText());assert.match(hero,/^10월 계약 0 0건/,'이번 달 계약(원장) 없음 = 0 · 지어내지 않음: '+hero);assert.match(hero,/월 목표값 입력 후 막대 표시/,'목표값 없으면 막대 대신 안내');
  const made=one(await D.locator('.dv-made').innerText());assert.match(made,/^40\.0% 메이드율 수주 2 실주 3 결과 확정 건 기준/,'메이드율 = 수주 2 ÷ (2 + 3): '+made);
  const ytd=one(await D.locator('.dv-ytd').innerText());assert.match(ytd,/계약실적 8억 · 2건 기술자문 낙찰 \(별도\) 아직 없음 계약실적과 기술자문 낙찰은 합산하지 않음/,ytd);
  const flow=await D.locator('.dv-flow .dv-fs button').evaluateAll(l=>l.map(b=>[b.querySelector('span').textContent,b.querySelector('b').textContent]));
  assert.deepEqual(flow.map(f=>f[0]),['견적문의','컨설팅 설계','자료 발송','관계관리','경쟁 · 입찰','계약 · 시공','수주'],'영업 흐름 7칸');
  const C=await page.evaluate(()=>{const c=DashB.core();return {active:c.active.length,con:c.con.count};});
  assert.equal(flow.slice(1,6).reduce((s,f)=>s+Number(f[1]),0),C.active,'흐름 5칸 합 = 진행 중');assert.equal(flow[6][1],String(C.con),'수주 = 원장 계약 건수');
  assert.match(one(await D.locator('.dv-out').innerText()),/실주 \d+ · 배드핏 \d+ \(이번 주 · 흐름 밖으로\)/);
  const cols=await D.locator('.dv-cols button span').allInnerTexts();assert.deepEqual(cols,['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월'],'월별 = 올해 1월~이번 달');
  await D.locator('.dv-cols button[data-v="9"]').click();await page.waitForTimeout(150);assert.equal(one(await page.locator('#si-dash .dv-cols+.dv-sel').innerText()),'2026년 9월 · 3억 · 계약 1건','막대 누르면 그 달');
  assert.equal(await page.locator('#si-dash .dv-layers>div').count(),6,'진행 금액 단면 6층');
  const grid=one(await page.locator('#si-dash .dv-grid').innerText());assert.match(grid,/기록 미확인/,'기록 없는 사람 = 기록 미확인(0 아님)');
  await page.locator('#si-dash .dv-flow button[data-v="sent"]').click();await page.waitForTimeout(150);assert.equal(await page.locator('#si-dash .dv-grid .gh.on').innerText(),'자료 발송','흐름 칸 누르면 그 단계 강조');
  await page.locator('#si-dash .dv-people button[data-v="황윤선"]').click();await page.waitForTimeout(150);
  assert.match(one(await page.locator('#si-dash .dv-made').innerText()),/^33\.3% 메이드율 수주 1 실주 2/,'담당자 칩 = 그 사람 기준 도넛');assert.match(one(await page.locator('#si-dash .dv-hero').innerText()),/10월 계약 · 황윤선/);
  assert.ok(await page.locator('#si-dash .dv-grid .gn.dim').count()>=1,'다른 사람은 흐려짐');
  const anim=await page.evaluate(()=>[...document.querySelectorAll('#si-dash .dv *')].map(n=>getComputedStyle(n)).filter(s=>s.animationName!=='none').map(s=>parseFloat(s.animationDuration)));assert.ok(anim.length&&anim.every(x=>x<=0.24),'움직임 0.24초 이하');
  if(SHOT)await page.locator('#si-dash').screenshot({path:SHOT.replace('.png','-dash.png')});
  /* ── 컨트롤타워 ── */
  await page.locator('#si-dash .db-tool [data-db="go"][data-v="control"]').click();await page.waitForTimeout(500);
  const T=page.locator('#si-control .dv');assert.equal(await T.count(),1);assert.equal(await page.locator('#pg-control>.cf-bar').isVisible(),true);assert.equal(await top('control'),topDash,'세 화면 상단 같음');
  const M=await page.evaluate(()=>{const m=DashB.ctlModel(DashB.core());return {un:m.colT('unasg'),fi:m.colT('first'),du:m.colT('due')};});
  const th=one(await T.locator('.dv-hero').innerText());assert.equal(th,'오늘 개입할 곳 '+(M.un+M.fi+M.du)+' 건 미배정 '+M.un+' · 첫 연락 지연 '+M.fi+' · 기한 지남 '+M.du,'개입할 곳 = 같은 판정 함수: '+th);
  assert.match(one(await T.locator('.dv-made').innerText()),/요청 처리/);
  const ages=one(await T.locator('.dv-row3 .dv-card').nth(2).innerText());assert.match(ages,/^기한 지난 기간 1–3일 \d+ 4–7일 \d+ 8–30일 \d+ 30일\+ \d+ 다음 할 일 기한이 지난 영업건 5건/,ages);
  assert.equal(await T.locator('.dv-flow .dv-fs').count(),4,'요청 흐름 4칸');
  const cell=T.locator('.dv-heat button:not([disabled])').first();await cell.click();await page.waitForTimeout(150);assert.equal(await page.locator('#si-control .dv-selbox').count(),1,'칸 누르면 그 건 목록');
  assert.equal(await page.locator('#si-control .dv-pair>div').count(),5,'요일별 월~금');
  if(SHOT)await page.locator('#si-control').screenshot({path:SHOT.replace('.png','-control.png')});
  /* ── 성과 분석 ── */
  await page.locator('#si-control .db-tool [data-db="go"][data-v="perf"]').click();await page.waitForTimeout(500);
  const Pf=page.locator('#si-perf .dv');assert.equal(await Pf.count(),1);assert.equal(await top('perf'),topDash,'세 화면 상단 같음');
  assert.match(one(await Pf.locator('.dv-hero').innerText()),/^올해 계약실적 8억 2건 기술자문 낙찰\(별도 · 합산 안 함\) 없음/,'계약실적 ≠ 기술자문 낙찰');
  {const fm=/^문의 4 적합 3 견적 발송 (\d+) 계약 (\d+)$/.exec(one(await Pf.locator('.dv-fun').innerText()));assert.ok(fm,'깔때기');assert.ok(Number(fm[1])<=3&&Number(fm[2])<=3,'같은 문의 집단 — 칸이 거꾸로 넓어지지 않음');}
  assert.match(one(await Pf.locator('.dv-row3 .dv-card').nth(2).innerText()),/실주 원인 가격 열세 2/);
  assert.equal(await Pf.locator('.dv-path').count(),2,'수주 · 실주 흐름 비교');
  assert.ok(await Pf.locator('.dv-scatter button').count()>=1,'산점도');await Pf.locator('.dv-scatter button').first().click();await page.waitForTimeout(150);assert.match(one(await page.locator('#si-perf .dv-scatter+.dv-sel').innerText()),/메이드율 \d+\.\d% \(\d+ \/ \d+\)/);
  assert.equal(await page.locator('#si-perf .dv-br').count()>=4,true,'브랜드별');
  if(SHOT)await page.locator('#si-perf').screenshot({path:SHOT.replace('.png','-perf.png')});
  /* 색: 브랜드 · 파랑 · 빨강 계열 · 회색만(초록 · 주황 · 겨자 없음 — 브랜드 칩 제외) */
  const bad=await page.evaluate(()=>{const ok=c=>{const m=/rgba?\((\d+), (\d+), (\d+)/.exec(c);if(!m)return true;const [r,g,b]=m.slice(1).map(Number);const gray=Math.max(r,g,b)-Math.min(r,g,b)<24;const blue=b>r&&b>=g;const red=r>g&&r>b&&Math.abs(g-b)<40;return gray||blue||red;};const out=[];document.querySelectorAll('#si-perf .dv *:not(.dv-br *):not(.dv-br)').forEach(n=>{const s=getComputedStyle(n);[s.backgroundColor,s.color].forEach(c=>{if(!ok(c))out.push(n.className+' '+c);});});return out.slice(0,5);});
  assert.deepEqual(bad,[],'색 기준');
  /* 끄기 */
  await page.evaluate(()=>{G.dashVisOff=true;goPage('dash');});await page.waitForTimeout(400);assert.equal(await page.locator('#si-dash .dv').count(),0);assert.equal(await page.locator('#si-dash .db-kpis').count(),1,'끄기 = 예전 화면');
  assert.deepEqual(errs,[],'화면 오류 없음');
  console.log(JSON.stringify({status:'PASS',writes:0}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});