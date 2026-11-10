'use strict';
/* 단계 바꾸기 → 끝 상태(실주 · 배드핏 · 연락두절 · 지원 종결) 저장이 쓰기 단계에서 거절되지 않는지(2026-11-10 대표 '실주가 안 옮겨짐') — 합성 자료(현장은 지어낸 것)
   확인: 실제 창에서 고르고 [저장] → pushWrite('close') 내용이 OperationalAdapter.normalize 를 통과 · 서버로 가는 칸은 사유 · 확인한 내용 두 칸 + terminal
        · 적은 선택 칸(재영업 가능 여부 · 경쟁사)은 기록 문장(note)에 남음 · 끄기 G.closeTwoFieldsOff = 예전처럼 거절 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!t.startsWith(root)||!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1400,height:900},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(String(e.message||e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);
  await page.waitForFunction(()=>window.StageTransitionUI&&window.StageTransition&&window.OperationalAdapter&&window.SettleMode&&typeof goPage==='function');
  const out=await page.evaluate(async()=>{
   const U=n=>'cccccccc-0000-4000-8000-0000000000'+String(n).padStart(2,'0');
   const deal=(n,code)=>({id:U(n),site:'[가상] 끝 상태 '+n,assignee:'이필선',brand:'석민이앤씨',created:'2026-08-01',code,stage_code:code,amt:1e8,amount:1e8,activities:[],workItems:[],version:4});
   B={deals:[deal(1,'sent'),deal(2,'consulting'),deal(3,'relationship'),deal(4,'compete'),deal(5,'sent'),deal(6,'consulting'),deal(7,'completion')],inquiries:[],activities:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};window.saveLocal=()=>{};
   CRMRules.apply({});/* 운영에서처럼 실주 사유 = 운영 기준 '실주 원인' 목록 */
   SB={rpc:async n=>n==='crm_settle_mode_v1'?{data:{ok:true,version:1}}:{error:{message:'X'}}};await SettleMode.check(true);
   goPage('pipe');await new Promise(r=>setTimeout(r,200));
   window.__w=[];window.pushWrite=(op,p)=>{__w.push([op,JSON.parse(JSON.stringify(p))]);return 'q'+__w.length;};
   const pick=(key,val)=>{const f=document.getElementById('stage-transition-form');const sel=f.querySelector('#sf-'+key);if(sel&&sel.tagName==='SELECT'){sel.value=val;sel.dispatchEvent(new Event('change',{bubbles:true}));return;}const b=[...f.querySelectorAll('button,label')].find(x=>x.textContent.trim()===val);if(b)b.click();};
   const setText=(key,val)=>{const el=document.querySelector('#stage-transition-form #sf-'+key);if(el){el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));}};
   const run=async(d0,to,reason,extra)=>{const before=__w.length;G._detailPopup=true;drwDeal(JSON.stringify(d0));await new Promise(r=>setTimeout(r,50));const d=CUR_DETAIL.item;StageTransitionUI.open(d,false,to);await new Promise(r=>setTimeout(r,50));if(reason)pick('close_reason',reason);if(extra)extra();document.getElementById('stage-transition-form').requestSubmit?document.getElementById('stage-transition-form').requestSubmit():document.getElementById('stage-transition-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));await new Promise(r=>setTimeout(r,50));
    const c=__w.slice(before).find(x=>x[0]==='close'||x[0]==='transition'),err=document.getElementById('sf-error')?.textContent||'';if(document.getElementById('stage-transition-form'))StageTransitionUI.close();
    if(!c)return {sent:false,err};let norm='';try{const n=OperationalAdapter.normalize(c[0],c[1].opportunity_id,d.version,c[1]);const p=n&&(n.payload||n.p_payload||n);norm='ok:'+p.outcome+'/'+p.category;}catch(e){norm='거절:'+e.message;}
    return {sent:true,norm,fields:Object.keys(c[1].stage_context.fields),terminal:c[1].stage_context.terminal,note:c[1].note,detail:c[1].stage_context.fields.close_detail};};
   const lost=await run(B.deals[0],'lost','가격 · 예산 부족',()=>{const f=document.getElementById('stage-transition-form');const b=[...f.querySelectorAll('button,label')].find(x=>x.textContent.trim()==='예');if(b)b.click();const sel=f.querySelector('#sf-reengage');if(sel&&sel.tagName==='SELECT'){sel.value='예';}setText('competitor','[가상] 경쟁사');});
   const badfit=await run(B.deals[1],'badfit_lead','지역 밖');
   const nocontact=await run(B.deals[2],'nocontact','3회 이상 시도 무응답');
   const support=await run(B.deals[3],'support','PT 지원');
   /* 정착 모드에서 칸을 하나도 안 채우고 옮김 → 기록 문장이 비지 않게 · 수주 완료(준공 4개 확인 모두 체크) */
   const empty=await run(B.deals[5],'compete',null,()=>{const b=document.querySelector('#stage-transition-form [data-next]');if(b)b.click();});/* 다음 할 일 날짜만 고름 */
   const won=await run(B.deals[6],'won',null,()=>{const f=document.getElementById('stage-transition-form');const s=(k,v)=>{const el=f.querySelector('#sf-'+k);if(el){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}};s('completion_date','2026-11-10');s('contract_amount','50000000');[...f.querySelectorAll('[name="sf-completion_checks"]')].forEach(c=>{if(!c.checked)c.click();});s('lesson','[가상] 배운 점');});
   G.closeTwoFieldsOff=true;const off=await run(B.deals[4],'lost','가격 · 가격 경쟁');G.closeTwoFieldsOff=false;
   return {lost,badfit,nocontact,support,off,empty,won};
  });
  for(const k of ['lost','badfit','nocontact','support']){const r=out[k];assert.equal(r.sent,true,k+' 저장 요청이 나감 '+(r.err||''));assert.match(r.norm,/^ok:/,k+' 쓰기 단계 통과: '+r.norm);assert.deepEqual(r.fields,['close_reason','close_detail'],k+' 서버로 가는 칸 = 두 칸');assert.equal(r.terminal,true,k+' 끝 상태 표시');}
  assert.match(out.lost.norm,/^ok:lost\/가격 · 예산 부족$/,'실주 원인 그대로');
  assert.match(out.lost.note,/경쟁사: \[가상\] 경쟁사/,'적은 선택 칸은 기록 문장에 남음');
  assert.ok(out.lost.detail.length>=5,'확인한 내용 5자 이상(비우면 정착 모드 문구)');
  assert.match(out.off.norm,/^거절:CLOSE_INTENT_NOT_CONNECTED$/,'끄기 G.closeTwoFieldsOff = 예전처럼 거절');
  assert.match(out.empty.norm,/^ok:/,'칸을 안 채운 단계 이동도 쓰기 단계 통과: '+out.empty.norm);assert.match(out.empty.note,/^단계 이동: 컨설팅 설계 → 경쟁·PT$/,'빈 기록 문장 대신 한 줄');
  assert.match(out.won.norm,/^ok:/,'수주 완료 쓰기 단계 통과: '+out.won.norm);assert.deepEqual(out.won.fields,['completion_date','completion_checks','contract_amount']);assert.match(out.won.note,/배운 점: \[가상\] 배운 점/);
  assert.deepEqual(errs,[]);await ctx.close();
  console.log('verify-close-two-fields-browser: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
