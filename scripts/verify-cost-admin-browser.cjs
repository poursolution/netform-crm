'use strict';
/* 원가 기준 관리 (2026-10-11 견적 v3 5단계) — 실제 파일에서 뽑은 칸으로 만든 xlsx 를 올려 본다. 서버 함수(crm_cost_standard_*_v1)는 메모리 속 가짜.
   확인: 사이드바 '원가 기준'(관리자) · 요율표 xlsx → 미리보기(78항목 · 시행일 2026-04-13) · 고용보험료는 직접 입력 + 출처 없으면 저장 막힘 · 20건씩 쪽 번호 ·
   초안 저장 → 승인 전 확인 → 승인 · 사용 중 표시 · 자재 단가 xlsx · 노임(PDF 에서 읽은 줄) · 엉뚱한 파일은 이유를 알려 줌 · 관리자가 아니면 올리기 단추 없음 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {makeXlsx}=require('../tests/helpers/make-xlsx.cjs');
const root=path.resolve(__dirname,'..');
const fx=n=>JSON.parse(fs.readFileSync(path.join(root,'tests','fixtures',n),'utf8'));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',mime[path.extname(t)]||'application/octet-stream');res.end(fs.readFileSync(t))});
const one=s=>String(s||'').replace(/\s+/g,' ').trim();
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true}),errs=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1366,height:900},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage();page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.CostAdmin&&window.QuoteStandards&&window.QuoteExcel&&typeof goPage==='function');
  await page.evaluate(()=>{
   B={deals:[],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};TOKEN='test';
   window.__db={labor:[],cost:[],material:[],events:[]};window.__rpc=[];window.__can=true;
   const D=window.__db,keyOf={labor:r=>r.trade+'|'+r.effective_from,cost:r=>r.item+'|'+(r.tier||'')+'|'+r.effective_from,material:r=>r.item+'|'+(r.spec||'')+'|'+r.price_date};
   SB={rpc:async(n,a)=>{const p=a.p||{};__rpc.push([n,p]);
    if(n==='crm_cost_standard_list_v1')return {data:{ok:true,labor:D.labor,cost:D.cost,material:D.material,events:D.events,can_manage:__can}};
    if(n==='crm_cost_standard_stage_v1'){D[p.kind]=D[p.kind].filter(r=>r.status!=='draft');const skipped=[];let st=0;for(const r of p.rows){if(D[p.kind].some(x=>keyOf[p.kind](x)===keyOf[p.kind](r))){skipped.push(r.item||r.trade);continue;}D[p.kind].push(Object.assign({},r,{status:'draft',source:r.source||p.source}));st++;}D.events.unshift({kind:p.kind,action:'stage',row_count:st,skipped_count:skipped.length,actor_name:'송보람',created_at:new Date().toISOString()});return {data:{ok:true,kind:p.kind,staged:st,skipped}};}
    if(n==='crm_cost_standard_approve_v1'){const d=D[p.kind].filter(r=>r.status==='draft');if(!d.length)return {error:{message:'승인할 초안이 없습니다'}};if(d.some(r=>!String(r.source||'').trim()))return {error:{message:'출처가 없는 항목이 있습니다'}};d.forEach(r=>{r.status='active';r.approved_by='송보람'});D.events.unshift({kind:p.kind,action:'approve',row_count:d.length,skipped_count:0,actor_name:'송보람',created_at:new Date().toISOString()});return {data:{ok:true,kind:p.kind,approved:d.length,effective_from:d.map(r=>r.effective_from||r.price_date).sort()[0]}};}
    if(n==='crm_cost_standard_discard_v1'){const k=D[p.kind].filter(r=>r.status==='draft').length;D[p.kind]=D[p.kind].filter(r=>r.status!=='draft');return {data:{ok:true,kind:p.kind,discarded:k}};}
    return {data:{ok:true}};}};
   goPage('costbase');
  });
  await page.waitForSelector('#cost-admin .ca-card');
  const T=()=>page.locator('#cost-admin').innerText().then(one);
  /* ① 카드 3개 · 아직 승인된 기준 없음 */
  assert.equal(await page.locator('#cost-admin .ca-card').count(),3);assert.equal((await T()).match(/승인된 기준 없음/g).length,3);
  assert.equal(await page.locator('#cost-admin input[type=file]').count(),3);
  /* ② 엉뚱한 파일 */
  const matX=makeXlsx({'단가표(개인)':fx('material-prices-cells-20260812.json').cells});
  await page.setInputFiles('#cost-admin input[data-k="cost"]',{name:'통합관리표.xlsx',mimeType:'application/octet-stream',buffer:matX});
  await page.waitForSelector('.ca-msg.cae');assert.match(await T(),/「건축제비율」 시트를 찾지 못했습니다/);
  await page.setInputFiles('#cost-admin input[data-k="labor"]',{name:'a.xlsx',mimeType:'application/octet-stream',buffer:matX});
  await page.waitForFunction(()=>/PDF 를 올려 주세요/.test(document.getElementById('cost-admin').innerText));
  /* ③ 요율표 xlsx 미리보기 */
  const ratesX=makeXlsx({'건축제비율(4.13.)':fx('cost-rates-cells-20260413.json').cells});
  await page.setInputFiles('#cost-admin input[data-k="cost"]',{name:'2026 제비율.xlsx',mimeType:'application/octet-stream',buffer:ratesX});
  await page.waitForSelector('#ca-view');let t=await T();
  assert.match(t,/원가 요율 · 올린 파일 미리보기/);assert.match(t,/항목 78개/);assert.match(t,/새 항목 78/);
  assert.equal(await page.inputValue('#ca-view input[data-ca="eff"]'),'2026-04-13');assert.match(await page.inputValue('#ca-view input[data-ca="source"]'),/조달청 간접공사비\(제비율\) 적용기준 · 적용시기/);
  assert.equal(await page.locator('#ca-view .ca-pg button').count(),4,'20건씩 쪽 번호 1 2 3 4');
  /* ④ 고용보험료: 파일에 숫자가 없다 → 직접 입력 + 출처 없으면 저장 막힘 */
  let guard=0;while(!(await page.locator('#ca-view input[data-ca="rate"]').count())&&guard++<5)await page.locator('#ca-view .ca-pg button').nth(guard-1).click();
  assert.equal(await page.locator('#ca-view input[data-ca="rate"]').count(),1,'고용보험료만 직접 입력');
  assert.match(t.replace(/\s+/g,' '),/승인 전에 해결할 것/);assert.equal(await page.locator('[data-ca="stage"]').isDisabled(),true);
  assert.match(await page.locator('#ca-view .ca-prob').last().innerText(),/출처가 없는 항목 1개.*값이 비어 있는 항목 1개: 고용보험료/s);
  await page.fill('#ca-view input[data-ca="rate"]','1.01');
  await page.locator('#ca-view input[data-ca="rate"]').evaluate(n=>n.blur());await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-ca="stage"]').isDisabled(),true,'값만 넣으면 아직 출처 때문에 막힘');
  let g2=0;while(!(await page.locator('#ca-view input[data-ca="src"]').count())&&g2++<5)await page.locator('#ca-view .ca-pg button').nth(g2-1).click();
  await page.fill('#ca-view input[data-ca="src"]','고용노동부 고시 · 직접 입력');await page.locator('#ca-view input[data-ca="src"]').evaluate(n=>n.blur());await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-ca="stage"]').isDisabled(),false);
  /* ⑤ 초안 저장 → 서버로 간 값 */
  await page.evaluate(()=>{window.__rpc.length=0});await page.click('[data-ca="stage"]');await page.waitForFunction(()=>/승인 전 확인/.test(document.getElementById('cost-admin').innerText));
  const sent=await page.evaluate(()=>__rpc.find(x=>x[0]==='crm_cost_standard_stage_v1')[1]);
  assert.equal(sent.kind,'cost');assert.equal(sent.rows.length,78);assert.ok(sent.rows.every(r=>r.effective_from==='2026-04-13'&&r.source));
  const emp=sent.rows.find(r=>r.item==='고용보험료');assert.deepEqual([emp.rate,emp.source],[0.0101,'고용노동부 고시 · 직접 입력']);
  assert.equal(sent.rows.find(r=>r.item==='석면분담금').rate,0.00006);assert.equal(sent.rows.find(r=>r.item==='산업안전보건관리비'&&/5억~50억미만\|건축/.test(r.tier)).fixed_amount,4325000);
  t=await T();assert.match(t,/승인 대기 초안 78줄/);assert.equal(await page.locator('[data-ca="approve"]').isDisabled(),false);
  /* ⑥ 승인 */
  await page.click('[data-ca="approve"]');await page.waitForFunction(()=>/사용 중 · 시행일 2026-04-13/.test(document.getElementById('cost-admin').innerText));
  t=await T();assert.match(t,/78줄을 승인했습니다. 시행일 2026-04-13 이후 견적부터 적용됩니다/);assert.match(t,/항목 78개/);assert.equal(await page.locator('#ca-view').count(),0);
  /* ⑦ 같은 파일을 다시 올리면 모두 '같음' + 서버가 같은 시행일 줄은 건너뜀 */
  await page.setInputFiles('#cost-admin input[data-k="cost"]',{name:'2026 제비율.xlsx',mimeType:'application/octet-stream',buffer:ratesX});await page.waitForSelector('#ca-view');
  assert.match(await T(),/같음 77/);
  await page.click('[data-ca="close"]');
  /* ⑧ 자재 단가 */
  await page.setInputFiles('#cost-admin input[data-k="material"]',{name:'통합관리표.xlsx',mimeType:'application/octet-stream',buffer:matX});await page.waitForSelector('#ca-view');
  t=await T();assert.match(t,/자재 단가 · 올린 파일 미리보기/);assert.match(t,/항목 94개/);assert.match(t,/건너뜀|준비중/);assert.equal(await page.inputValue('#ca-view input[data-ca="eff"]'),'2026-08-12');
  await page.click('[data-ca="stage"]');await page.waitForFunction(()=>/승인 전 확인/.test(document.getElementById('cost-admin').innerText));
  await page.click('[data-ca="approve"]');await page.waitForFunction(()=>/자재 단가 94줄을 승인/.test(document.getElementById('cost-admin').innerText));
  /* ⑨ 노임 (PDF 에서 읽은 줄) */
  await page.evaluate(pages=>{const parsed=QuoteStandards.parseWageRows(pages),source='임금실태 조사표 · 2026 하반기.pdf';CostAdmin.preview('labor',{kind:'labor',file:'2026 하반기.pdf',source,parsed,rows:QuoteStandards.wageToRows(parsed,source),notes:parsed.notes,dates:parsed.dates});},fx('wage-2026h2-items.json'));
  t=await T();assert.match(t,/노임 · 올린 파일 미리보기/);assert.match(t,/직종 123개/);assert.match(t,/공표일 4개/);
  for(const d of ['2026-09-01','2026-01-01','2025-09-01','2025-01-01'])assert.match(t,new RegExp(d));
  assert.match(t,/특별인부 228,717 226,122 224,490 221,506/);
  await page.click('[data-ca="stage"]');await page.waitForFunction(()=>/승인 전 확인/.test(document.getElementById('cost-admin').innerText));
  await page.click('[data-ca="approve"]');await page.waitForFunction(()=>/노임 \d+줄을 승인/.test(document.getElementById('cost-admin').innerText));
  /* ⑩ 다시 올린 노임: 같은 시행일 줄은 건너뜀 */
  await page.evaluate(pages=>{const parsed=QuoteStandards.parseWageRows(pages),source='x';CostAdmin.preview('labor',{kind:'labor',file:'again.pdf',source,parsed,rows:QuoteStandards.wageToRows(parsed,source),notes:[],dates:parsed.dates});},fx('wage-2026h2-items.json'));
  await page.click('[data-ca="stage"]');await page.waitForFunction(()=>/건너뛰었습니다/.test(document.getElementById('cost-admin').innerText));
  /* ⑪ 관리자가 아니면 올리기 단추가 없다 */
  await page.evaluate(()=>{__can=false;CostAdmin.reload();});await page.waitForSelector('#cost-admin .ca-card');await page.waitForTimeout(200);
  assert.equal(await page.locator('#cost-admin input[type=file]').count(),0);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('cost admin ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
