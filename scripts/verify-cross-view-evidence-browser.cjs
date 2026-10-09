'use strict';
// Synthetic fixtures. All non-local traffic blocked; no storage or outbound messages.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root)||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');fs.createReadStream(p).pipe(res);});
(async()=>{await new Promise(r=>srv.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1600,height:1000},timezoneId:'Asia/Seoul'});await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.RelV12&&window.DashB&&window.PipelineStageV3);
 await page.evaluate(()=>{const day=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()+n*864e5));window.DAY=day;
  const make=(id,code,extra={})=>Object.assign({id,site:'검증 '+id,assignee:'이필선',brand:'POUR솔루션',created:day(-50),code,stage_code:code,grp:'영업·관리',amt:1e8,activities:[],stage_contexts:{}},extra);window.MAKE=make;
  B={deals:[make('unknown','waiting'),make('silent','silent'),make('hold','waiting',{activities:[{id:'h',type:'내부 메모',note:'[관계 상태] 보류 | 예산 협의 중 | 없음 | '+day(20)+' | 미정',at:day(-2)}]}),make('lost','lost',{outcome:'lost',lost_reason:'사업 · 공사 취소',stage_contexts:{lost:{fields:{reengage:'미정'}}}})],inquiries:[],activities:[],expansion_pool:[],inquiryTrash:[]};
  LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'admin',name:'송보람',role:'admin'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';G.workFilter='전체';G.ps3=null;G.dealSameOff=true;
  document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';saveLocal=()=>{throw Error('unexpected save');};pushWrite=()=>{throw Error('unexpected write');};PipelineWorkspace.open('relationship');
 });
 const before=await page.evaluate(()=>JSON.stringify(B));
 const classification=await page.evaluate(()=>{const list=PipelineWorkspace.rows().filter(r=>r.group==='relationship');return list.map(r=>({id:r.item.id,list:RelV12.state(r).key,shared:RelV12.of(r.item).key}));});
 assert.deepEqual(classification.map(x=>[x.id,x.list,x.shared]).sort(),[['hold','hold','hold'],['silent','unk','unk'],['unknown','unk','unk']]);
 const analytics=await page.evaluate(()=>SalesInsights.rows().deals.filter(r=>r.relationship).map(r=>({id:r.item.id,label:r.stageLabel,issues:r.issues,reason:r.reason})));
 for(const id of ['unknown','silent']){const r=analytics.find(r=>r.id===id);assert.match(r.label,/미확인/);assert.match(r.reason,/과거 기록·고객 반응 확인/);assert.ok(!r.issues.includes('stale')&&!r.issues.includes('stall'));}
 assert.match(analytics.find(r=>r.id==='hold').label,/보류/);
 const audience=await page.evaluate(()=>{const d=B.deals[0],q=MAKE('send','sent'),lost=B.deals[3],copy=v=>JSON.parse(JSON.stringify(v)),run=(x,k)=>campaignCatMatch(x,k);
  const yes=copy(lost);yes.stage_contexts.lost.fields.reengage='예';const legacy=copy(lost);legacy.stage_contexts.lost.fields={recontact_possibility:'높음'};
  const sent=copy(q);sent.stage_contexts.sent={fields:{sent_date:DAY(-10)}};const reacted=copy(sent);reacted.stage_contexts.sent.fields.reaction='자료요청';
  const attempt=MAKE('try','rapport',{stage_contexts:{sent:{fields:{sent_date:DAY(-10)}}},activities:[{id:'t1',type:'전화',result:'부재',note:'연락 시도',at:DAY(-2)+'T10:00:00+09:00'},{id:'t2',type:'전화',result:'부재',note:'연락 시도',at:DAY(-1)+'T10:00:00+09:00'}]});
  const answered=copy(attempt);answered.activities.push({id:'connected',type:'전화',result:'연결됨',note:'통화 완료',at:DAY(0)+'T09:00:00+09:00'});
  return {oldSilent:run(B.deals[1],'silent'),unknown:run(d,'waiting'),lost:run(lost,'lost'),yes:run(yes,'lost'),legacy:run(legacy,'lost'),sentMissing:run(q,'sent'),sent:run(sent,'sent'),reacted:run(reacted,'sent'),attempt:run(attempt,'noresponse'),answered:run(answered,'noresponse')};});
 assert.deepEqual(audience,{oldSilent:false,unknown:false,lost:false,yes:true,legacy:false,sentMissing:false,sent:true,reacted:false,attempt:true,answered:false});
 const data=await page.evaluate(()=>{
  const q=PipelineStageB.rules(),r={item:B.deals[3],code:'lost',fields:{},next:null,amount:100};const l=PipelineStageB.CFG.lost.calc(r,{lossReason:'사업 · 공사 취소'},q);
  const w=PipelineStageB.CFG.won.calc({...r,item:MAKE('won','won'),code:'won'},{},q);
  const cx={P:{a:'2026-01-01',b:'2027-01-01'},L:{rows:[]},pt:{list:[{brand:'POUR솔루션',company:'검증업체',signedCount:1,amount:100,revenue:20,revKnown:true},{brand:'POUR솔루션',company:'검증업체',signedCount:1,amount:200,revenue:0,revKnown:false}]},tf:{list:[]}};
  const matrix=DashB.lib.matrixRows(cx)[0];return {lost:l.bucket,missing:l.rs,won:w.missing,matrix};});
 assert.equal(data.lost,'nore');assert.ok(data.missing.includes('relist'));assert.deepEqual(data.won,{type:true,amount:false,company:true});
 assert.equal(data.matrix.amt,300);assert.equal(data.matrix.ratioAmount,100);assert.equal(data.matrix.ratioRevenue,20);assert.equal(data.matrix.unknown,1);
 await page.evaluate(()=>PipelineWorkspace.open('lost'));const V=page.locator('#pipeline-stage-v3');assert.match(await V.locator('.ps3-kpis').innerText(),/결과 정보 보완\s*1건/);
 assert.equal(await page.evaluate(()=>JSON.stringify(B)),before);assert.deepEqual(errors,[]);console.log('cross-view evidence browser ok');
}finally{await browser.close();srv.close();}})().catch(e=>{console.error(e);process.exit(1);});
