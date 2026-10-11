'use strict';
/* 공법견적 · 간단견적 작성 (2026-10-11 견적 v3 6단계) — 합성 영업건 + 실제 파일에서 읽은 기준(공법 9 · 자재 94 · 노임 · 요율). 서버 함수는 가짜 응답.
   확인: 자료 구역 [견적 작성] → 가운데 칸 '견적 작성' · 공법 + 수량 → 적산 기준금액이 계산 함수(QuoteCompose)와 같음 · 기준 버전 칩 · 간단 항목 · 승인된 기준이 없으면 막힘 ·
   간단견적 합계 · [견적 확정] 서버로 간 값(expected_base 포함) · 새 수정본 · 서버 거절 문구 · 서버에 함수가 없으면 단추 숨김 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const S=require('../quote-standards.js'),QP=require('../quote-compose.js');
const root=path.resolve(__dirname,'..');
const fx=n=>JSON.parse(fs.readFileSync(path.join(root,'tests','fixtures',n),'utf8'));
const act=rows=>rows.map(r=>Object.assign({},r,{status:'active'}));
const met=S.parseMethodSpecs(fx('method-sheets-20260825.json'));
const STD={ok:true,can_manage:false,events:[],
 cost:act(S.parseCostRates(fx('cost-rates-cells-20260413.json').cells).items.map(i=>i.manual?Object.assign({},i,{rate:0.0101,source:'직접 입력'}):i)),
 labor:act(S.wageToRows(S.parseWageRows(fx('wage-2026h2-items.json')),'x')),
 material:act(S.parseMaterialPrices(fx('material-prices-cells-20260812.json').cells).items),
 method:act(met.specs.map(s=>({method:s.method,composition:s.composition,effective_from:met.effective_from,source:'x'})))};
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealWin&&window.QuoteComposer&&window.QuoteCompose&&typeof openQuoteSubmitForm==='function');
  await page.evaluate(std=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const mk=(n,site)=>({id:'1111111'+n+'-1111-4111-8111-111111111111',site,assignee:'이필선',brand:'POUR솔루션',created:'2025-09-10',code:'sent',stage_code:'sent',amt:170000000,quote_amount:170000000,manager_name:'이재석',manager_mobile:'01052493880',contacts:[],
    quote_versions:[{version_no:1,amount:170000000,reason:'최초 견적',created_at:day(-20)+'T09:00:00+09:00',created_by:'이필선'}],
    activities:[{id:'a'+n,type:'방문',note:'현장 방문',at:day(-12)+'T15:00:00+09:00',actor:'이필선',meaningful:true}]});
   B={deals:[mk(1,'[경기 이천] 솔밭아파트'),mk(2,'[경기 화성] 동탄푸른마을')],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__rpc=[];window.__fail=null;window.__std=std;
   SB={rpc:async(n,a)=>{__rpc.push([n,a]);
    if(n==='crm_cost_standard_list_v1')return {data:window.__std};
    if(n==='crm_quote_version_save_v1'){if(__fail)return {error:{message:__fail}};const p=a.p;return {data:{ok:true,deal_id:p.deal_id,version_no:2,kind:p.kind,amount:p.expected_base,base_amount:p.expected_base,supply_amount:null,reason:(p.kind==='simple'?'간단견적 · 항목 '+p.simple_items.length+'개':'공법견적 · '+p.items.map(i=>i.method+' '+i.area+'㎡').join(' · '))+' · 기준금액 '+p.expected_base.toLocaleString('ko-KR')+'원',version:5,server_at:new Date().toISOString()}};}
    return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[],links:[],rows:[],advisory:[]}};}};TOKEN='test';
   window.__open=async(i)=>{try{closeDetail();}catch(e){}await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));detailTabFocus('현장·견적');};
  },STD);
  const date=await page.evaluate(()=>new Date(Date.now()+9*36e5).toISOString().slice(0,10));
  const open=async i=>{await page.evaluate(i=>window.__open(i),i);await page.waitForSelector('#detailView [data-dv3="files"]');await page.waitForTimeout(500);if(await page.locator('#detailView .dv3-fadd').count()===0)await page.click('#detailView [data-dv3="files"]');await page.waitForSelector('#detailView .dv3-fadd');};
  /* ① 자료 구역 [견적 작성] → 가운데 칸 */
  await open(0);assert.equal(await page.locator('#detailView .dv3-fadd button[data-v="compose"]').count(),1);
  await page.click('#detailView .dv3-fadd button[data-v="compose"]');await page.waitForSelector('#detailView .dv7-drawer:not([hidden]) .qc');
  assert.match(one(await page.locator('#detailView .dv7-phead').innerText()),/견적 작성/);
  await page.waitForFunction(()=>document.querySelectorAll('.qc select[data-qc="im"] option').length>1);
  const opts=await page.locator('.qc select[data-qc="im"] option').allInnerTexts();assert.deepEqual(opts.slice(1),['금속기와','단면복구(탄성)','슬라브(듀얼)','싱글','에폭시(PMQ)','에폭시(상도)','우레탄','PVC','표면강화'].sort((a,b)=>opts.indexOf(a)-opts.indexOf(b)),'공법 9개');
  assert.equal(await page.locator('#qc-ok').isDisabled(),true,'수량 전에는 확정 못 함');assert.match(one(await page.locator('#qc-chips').innerText()),new RegExp('견적일 '+date));
  /* ② 공법견적: 싱글 3,960㎡ · 일반관리비 3% · 이윤 12% · 공사기간 90일 → 계산 함수와 같은 금액 */
  await page.selectOption('.qc select[data-qc="im"]','싱글');await page.fill('.qc input[data-qc="ia"]','3960');await page.fill('.qc input[data-qc="gp"]','3');await page.fill('.qc input[data-qc="pp"]','12');await page.fill('.qc input[data-qc="dur"]','90');
  const exp=QP.compose({date,items:[{method:'싱글',area:3960}],generalPct:0.03,profitPct:0.12,durationDays:90},STD);assert.equal(exp.ok,true);
  const txt=one(await page.locator('#qc-res').innerText());assert.match(txt,new RegExp('적산 기준금액 '+exp.sheet.base.toLocaleString('ko-KR')+'원'));assert.match(txt,new RegExp('공급가액 '+exp.sheet.supply.toLocaleString('ko-KR')+'원'));
  assert.match(txt,new RegExp('일반관리비 '+exp.sheet.general.toLocaleString('ko-KR')+'원'));assert.match(await page.locator('#qc-chips').innerText(),/공법 기준 2026-08-12.*자재 기준 2026-08-12.*노임 기준 2026-09-01.*요율 기준 2026-04-13/s);
  assert.equal(await page.locator('#qc-ok').isDisabled(),false);
  /* ③ 간단 항목을 더하면 금액이 바뀐다 */
  await page.click('[data-qc="xadd"]');await page.fill('.qc input[data-qc="xn"]','캐노피 방수');await page.fill('.qc input[data-qc="xq"]','2');await page.fill('.qc input[data-qc="xu"]','개소');await page.fill('.qc input[data-qc="xp"]','800000');
  const exp2=QP.compose({date,items:[{method:'싱글',area:3960}],extras:[{name:'캐노피 방수',qty:2,unit:'개소',price:800000}],generalPct:0.03,profitPct:0.12,durationDays:90},STD);
  assert.notEqual(exp2.sheet.base,exp.sheet.base);assert.match(one(await page.locator('#qc-res').innerText()),new RegExp('적산 기준금액 '+exp2.sheet.base.toLocaleString('ko-KR')+'원'));
  /* ④ 서버가 거절하면 그 문구 + 단추 다시 켜짐 */
  await page.evaluate(()=>{window.__fail='화면과 서버의 계산이 다릅니다(화면 1원, 서버 2원). 화면을 새로 열어 주세요'});
  await page.fill('.qc input[data-qc="memo"]','옥상 전체');await page.click('#qc-ok');await page.waitForTimeout(300);
  assert.match(one(await page.locator('#qc-msg').innerText()),/화면과 서버의 계산이 다릅니다/);assert.equal(await page.locator('#qc-ok').isDisabled(),false);
  /* ⑤ 확정: 서버로 간 값 */
  await page.evaluate(()=>{window.__fail=null;window.__rpc.length=0});await page.click('#qc-ok');await page.waitForFunction(()=>!document.querySelector('#detailView .dv7-drawer:not([hidden]) .qc'));
  const sent=await page.evaluate(()=>__rpc.find(x=>x[0]==='crm_quote_version_save_v1')[1].p);
  assert.deepEqual({k:sent.kind,i:sent.items,x:sent.extras,g:sent.generalPct,p:sent.profitPct,d:sent.durationDays,r:sent.retire,e:sent.expected_base,m:sent.memo},{k:'method',i:[{method:'싱글',area:3960}],x:[{name:'캐노피 방수',qty:2,unit:'개소',price:800000}],g:0.03,p:0.12,d:90,r:false,e:exp2.sheet.base,m:'옥상 전체'});
  assert.equal(await page.evaluate(()=>B.deals[0].quote_amount),exp2.sheet.base);
  await page.waitForSelector('#detailView .dv3-fadd');const rows=await page.locator('#detailView .dv3-frow').allInnerTexts();assert.equal(rows.length,2);assert.match(one(rows[1]),/Version 2.*공법견적 · 싱글 3960㎡/);
  assert.match(one(await page.locator('#dv-err').innerText()),/견적 V2을 확정했습니다/);
  /* ⑥ 간단견적 */
  await open(1);await page.click('#detailView .dv3-fadd button[data-v="compose"]');await page.waitForSelector('.qc');await page.click('[data-qc="mode"][data-v="simple"]');
  await page.fill('.qc input[data-qc="sn"]','균열 보수');await page.fill('.qc input[data-qc="sq"]','12');await page.fill('.qc input[data-qc="su"]','m');await page.fill('.qc input[data-qc="sp"]','15000');
  await page.click('[data-qc="sadd"]');await page.locator('.qc input[data-qc="sn"]').nth(1).fill('배수구 교체');await page.locator('.qc input[data-qc="sq"]').nth(1).fill('3');await page.locator('.qc input[data-qc="sp"]').nth(1).fill('42500');
  assert.match(one(await page.locator('#qc-res').innerText()),/합계 307,500원/);assert.doesNotMatch(one(await page.locator('#qc-res').innerText()),/공급가액/,'간단견적은 원가계산서가 없다');
  await page.evaluate(()=>{window.__rpc.length=0});await page.click('#qc-ok');await page.waitForFunction(()=>!document.querySelector('#detailView .dv7-drawer:not([hidden]) .qc'));
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_quote_version_save_v1').map(x=>[x[1].p.kind,x[1].p.simple_items,x[1].p.expected_base])),[['simple',[{name:'균열 보수',qty:12,unit:'m',price:15000},{name:'배수구 교체',qty:3,unit:'',price:42500}],307500]]);
  /* ⑦ 승인된 기준이 없으면 계산하지 않는다 */
  await page.evaluate(()=>{QuoteComposer.reset();window.__std=Object.assign({},window.__std,{cost:[]});});
  await open(0);await page.click('#detailView .dv3-fadd button[data-v="compose"]');await page.waitForFunction(()=>document.querySelectorAll('.qc select[data-qc="im"] option').length>1);
  await page.selectOption('.qc select[data-qc="im"]','싱글');await page.fill('.qc input[data-qc="ia"]','100');
  assert.match(one(await page.locator('#qc-res').innerText()),/승인된 기준이 없어 계산할 수 없습니다.*원가 요율 · 간접노무비/);assert.equal(await page.locator('#qc-ok').isDisabled(),true);
  /* ⑧ 서버에 함수가 없으면 숨김 */
  await page.evaluate(()=>{window.CRMRelease={has:n=>n!=='crm_quote_version_save_v1'}});await open(1);assert.equal(await page.locator('#detailView .dv3-fadd button[data-v="compose"]').count(),0);assert.equal(await page.locator('#detailView .dv3-fadd button[data-v="quote"]').count(),1);
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('quote composer ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
