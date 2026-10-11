'use strict';
/* 견적 v3 · 가산 → 고객 제출금액 (2026-10-11) — 합성 자료(이름 · 금액은 지어낸 것). 서버 함수(crm_quote_submit_confirm_v1)는 가짜 응답.
   확인: 최신 견적에 [제출금액 만들기] · 기준금액 수정 불가 · 배수 + ㎡당 같이 쓰면 배수 → ㎡당 순서 · 미리보기 · 빠진 값 막힘 ·
   확정 시 서버로 화면 계산값(expected_submit)과 함께 보냄 · 새 수정본이 생기고 견적 금액 = 제출금액 · 서버 거절 문구 그대로 · 서버에 함수가 없으면 단추 숨김 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
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
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.DealDetailV3&&window.DealWin&&window.QuoteAmounts&&typeof execQuotePanel==='function'&&typeof openQuoteSubmitForm==='function');
  await page.evaluate(()=>{
   const day=n=>new Date(Date.now()+n*864e5).toLocaleDateString('en-CA');
   const mk=(n,site)=>({id:'1111111'+n+'-1111-4111-8111-111111111111',site,assignee:'이필선',brand:'POUR솔루션',created:'2025-09-10',code:'sent',stage_code:'sent',amt:170000000,quote_amount:170000000,manager_name:'이재석',manager_mobile:'01052493880',contacts:[],
    quote_versions:[{version_no:1,amount:170000000,reason:'최초 견적',created_at:day(-20)+'T09:00:00+09:00',created_by:'이필선'}],
    activities:[{id:'a'+n,type:'방문',note:'현장 방문',at:day(-12)+'T15:00:00+09:00',actor:'이필선',meaningful:true}]});
   B={deals:[mk(1,'[경기 화성] 동탄푸른마을'),mk(2,'[경기 이천] 솔밭아파트')],inquiries:[],activities:[],inquiryTrash:[],expansion_pool:[],messageLogs:[],message_logs:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.workFilter='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.pushWrite=()=>'req';
   window.__rpc=[];window.__fail=null;
   SB={rpc:async(n,a)=>{__rpc.push([n,a]);
    if(n==='crm_quote_submit_confirm_v1'){if(__fail)return {error:{message:__fail}};const p=a.p;return {data:{ok:true,deal_id:p.deal_id,version_no:2,amount:p.expected_submit,base_amount:170000000,submit_amount:p.expected_submit,added:p.expected_submit-170000000,markup_type:p.items.length>1?'multi':p.items[0]?p.items[0].type:'none',markup_items:p.items,display:'line',reason:'제출금액 확정 · 기준금액 170,000,000원 → '+p.expected_submit.toLocaleString('ko-KR')+'원',version:5,server_at:new Date().toISOString()}};}
    return {data:{ok:true,tasks:[],entries:[],sites:[],requests:[],links:[],rows:[],advisory:[]}};}};TOKEN='test';
   window.__open=async(i)=>{try{closeDetail();}catch(e){}await DealWin.load();drwDeal(JSON.stringify(B.deals[i]));detailTabFocus('현장·견적');};
  });
  const open=async i=>{await page.evaluate(i=>window.__open(i),i);await page.waitForSelector('#detailView [data-dv3="files"]');await page.waitForTimeout(500);if(await page.locator('#detailView .dv3-fadd').count()===0)await page.click('#detailView [data-dv3="files"]');await page.waitForSelector('#detailView .dv3-fadd');};
  /* ① 최신 견적에 [제출금액 만들기] */
  await open(0);const P=page.locator('#detailView .dv3-files');
  assert.equal(await P.locator('button[data-v="submit"]').count(),1);assert.equal(await P.locator('button[data-v="quote"]').count(),1,'기존 + 견적 버전 단추는 그대로');
  /* ② 폼: 기준금액은 글자로만(입력칸 아님) */
  await P.locator('button[data-v="submit"]').click();await page.waitForSelector('#qs-form');
  assert.match(one(await page.locator('#qs-form .detailnotice').first().innerText()),/적산 기준금액 170,000,000원 — 기준금액은 영업이 고칠 수 없습니다/);
  assert.equal(await page.locator('#qs-form input[id*="base"]').count(),0,'기준금액 입력칸 없음');
  /* ③ 배수만 */
  await page.fill('#qs-mul','1.52');assert.match(one(await page.locator('#qs-preview').innerText()),/258,400,000원.*가산액 88,400,000원 \(52%\)/);
  /* ④ ㎡당 + 배수 같이: 배수 → ㎡당 */
  await page.fill('#qs-ar','17,000');assert.match(one(await page.locator('#qs-preview').innerText()),/적용 면적/);assert.equal(await page.locator('#qs-ok').isDisabled(),true,'면적이 비면 확정 못 함');
  await page.fill('#qs-are','1000');const pv=one(await page.locator('#qs-preview').innerText());
  assert.match(pv,/배수 ×1\.52 · ㎡당 17,000원 × 1000㎡/);assert.match(pv,/275,400,000원/);assert.match(pv,/가산액 105,400,000원 \(62%\)/);assert.match(pv,/고객 서류에는 나오지 않습니다/);assert.equal(await page.locator('#qs-ok').isDisabled(),false);
  /* ⑤ 서버가 거절하면 그 문구 그대로 + 단추 다시 켜짐 */
  await page.evaluate(()=>{window.__fail='화면과 서버의 계산이 다릅니다(화면 1원, 서버 2원). 화면을 새로 열어 주세요'});
  await page.fill('#qs-note','공과잡비 포함');await page.click('#qs-ok');await page.waitForTimeout(300);
  assert.match(one(await page.locator('#dv-err').innerText()),/화면과 서버의 계산이 다릅니다/);assert.equal(await page.locator('#qs-ok').isDisabled(),false);
  /* ⑥ 확정: 서버로 간 값 */
  await page.evaluate(()=>{window.__fail=null;window.__rpc.length=0});await page.click('#qs-ok');await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(()=>__rpc.filter(x=>x[0]==='crm_quote_submit_confirm_v1').map(x=>x[1].p)),[{deal_id:'11111111-1111-4111-8111-111111111111',version_no:1,items:[{type:'multiplier',value:1.52},{type:'area',value:17000,area:1000}],display:'line',note:'공과잡비 포함',expected_submit:275400000}]);
  /* ⑦ 결과: 새 수정본 V2 · 견적 금액 = 제출금액 · 다시 가산 단추 없음 */
  await page.waitForSelector('#detailView .dv3-fadd');const rows=await page.locator('#detailView .dv3-frow').allInnerTexts();assert.equal(rows.length,2);assert.match(one(rows[1]),/Version 2.*제출금액 확정 · 기준금액 170,000,000원 → 275,400,000원/);
  assert.equal(await page.locator('#detailView button[data-v="submit"]').count(),0,'확정된 견적에는 다시 가산하지 않는다');
  assert.equal(await page.evaluate(()=>B.deals[0].quote_amount),275400000);assert.match(one(await page.locator('#dv-err').innerText()),/제출금액 275,400,000원을 확정했습니다/);
  /* ⑧ 가산 없이도 기준금액 그대로 확정 가능 */
  await open(1);await page.click('#detailView button[data-v="submit"]');assert.match(one(await page.locator('#qs-preview').innerText()),/가산 없음.*170,000,000원/);
  /* ⑨ 서버에 함수가 없으면 숨김 */
  await page.evaluate(()=>{window.CRMRelease={has:n=>n!=='crm_quote_submit_confirm_v1'}});await open(1);assert.equal(await page.locator('#detailView button[data-v="submit"]').count(),0,'서버 적용 대기 중에는 숨김');assert.equal(await page.locator('#detailView button[data-v="quote"]').count(),1)
  assert.deepEqual(errs,[],'화면 오류 없음: '+errs.join(' | '));
  console.log('quote submit ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
