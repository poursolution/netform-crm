'use strict';
/* 견적 발송 → 자료 발송완료 자동(2026-11-09 · StageTransitionUI.autoSent) — 합성 자료(이름 · 현장은 지어낸 것)
   확인: 컨설팅 설계 건에서 견적 발송 기록 = 창 없이 단계 변경 저장 길로 'sent'(발송 자료 견적서 · Version · 받는 사람 · 발송일 · 다음 확인일 = 발송일 + 7일)
        · 이미 발송 단계 이후 건은 그대로 · 끄기 G.autoSentOff · 견적 Version 이 없으면 '기타자료' */
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
  await page.waitForFunction(()=>window.StageTransitionUI&&window.StageTransitionUI.autoSent&&window.StageTransition&&typeof goPage==='function');
  const out=await page.evaluate(()=>{
   const U=n=>'aaaaaaaa-0000-4000-8000-0000000000'+String(n).padStart(2,'0');
   const deal=(n,site,code)=>({id:U(n),site,site_id:'s-'+n,assignee:'이필선',brand:'POUR솔루션',created:'2026-10-03',code,stage_code:code,amt:0,amount:0,activities:[],workItems:[],version:3});
   B={deals:[deal(1,'[가상] 한빛마을아파트','consulting'),deal(2,'[가상] 푸른숲아파트','compete'),deal(3,'[가상] 새솔단지','consulting'),deal(4,'[가상] 별빛마을','consulting')],inquiries:[],activities:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'adm',name:'송보람',role:'admin'};window.saveLocal=()=>{};
   window.__w=[];window.pushWrite=(op,p)=>{__w.push([op,JSON.parse(JSON.stringify(p))]);return 'q'+__w.length;};
   const kst=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
   const plus=(k,n)=>{const d=new Date(k+'T00:00:00');d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
   const r1=StageTransitionUI.autoSent(B.deals[0],{version:2,recipient:'관리소장 박OO'});
   const tr=__w.filter(x=>x[0]==='transition');
   const r2=StageTransitionUI.autoSent(B.deals[1],{version:1,recipient:'x'});
   G.autoSentOff=true;const r3=StageTransitionUI.autoSent(B.deals[2],{version:1,recipient:'x'});G.autoSentOff=false;
   const before=__w.length;const r4=StageTransitionUI.autoSent(B.deals[3],{recipient:''});const tr4=__w.slice(before).find(x=>x[0]==='transition');
   return {r1,r2:r2.why,r3:r3.why,r4:r4.ok,code1:B.deals[0].code,code2:B.deals[1].code,code3:B.deals[2].code,tr:tr.map(x=>({from:x[1].from,to:x[1].to,fields:x[1].stage_context&&x[1].stage_context.fields,memo:x[1].stage_context&&x[1].stage_context.memo})),f4:tr4&&tr4[1].stage_context.fields,today:kst(),follow:plus(kst(),7),dlg:!!document.getElementById('stage-transition-form')};
  });
  assert.deepEqual(out.r1,{ok:true});assert.equal(out.code1,'sent','컨설팅 설계 → 자료 발송완료');
  assert.equal(out.tr.length,1);assert.equal(out.tr[0].from,'consulting');assert.equal(out.tr[0].to,'sent');
  assert.deepEqual(out.tr[0].fields,{materials:['견적서'],recipient:'관리소장 박OO',sent_date:out.today,followup_date:out.follow,quote_version:'2'},'발송일 = 오늘 · 다음 확인일 = 7일 뒤');
  assert.match(out.tr[0].memo,/\[자동\] 견적 발송 기록으로 단계 이동/);
  assert.equal(out.r2,'stage');assert.equal(out.code2,'compete','이미 발송 단계 이후 건은 그대로');
  assert.equal(out.r3,'off');assert.equal(out.code3,'consulting','끄기 G.autoSentOff');
  assert.equal(out.r4,true);assert.deepEqual(out.f4.materials,['기타자료'],'견적 Version 이 없으면 기타자료');assert.equal(out.f4.recipient,'고객');
  assert.equal(out.dlg,false,'창을 열지 않는다');
  assert.deepEqual(errs,[]);await ctx.close();
  console.log('verify-auto-sent-browser: ok');
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1);});
