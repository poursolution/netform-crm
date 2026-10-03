'use strict';
/* 전역 검색 검사(2026-10-01): 현장·문의·담당자·전화번호 결과, 키보드 이동·Enter로 상세 열기, 담당자 권한 범위 */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:900},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.GlobalSearch&&window.PipelineWorkspace);
  const seed=role=>page.evaluate(role=>{
   B={deals:[{id:'d-1',site:'래미안 용인 수지',assignee:'이필선',brand:'POUR솔루션',created:CUR_Y+'-09-01',code:'consulting',stage_code:'consulting',grp:'영업·관리',amt:3e8,contact:{managerName:'김소장',managerMobile:'010-5555-1234'}},{id:'d-2',site:'자이 분당',assignee:'황윤선',brand:'POUR솔루션',created:CUR_Y+'-09-01',code:'sent',stage_code:'sent',grp:'영업·관리',amt:1e8,contact:{managerMobile:'010-9999-0000'}}],
    inquiries:[{id:'q-1',site:'힐스테이트 수지',assignee:'이필선',status:'배정완료',at:CUR_Y+'-09-20T09:00:00',brand:'POUR솔루션',phone:'010-7777-4321',contact_name:'박관리'}],activities:[]};
   LOCAL={deals:{},inquiries:{}};AUTH_ON=true;ME=role==='admin'?{id:'admin',name:'송보람',role:'admin'}:{id:'rep-1',name:'이필선',role:'rep'};
   document.getElementById('authGate').classList.remove('on');window.pushWrite=()=>{};goPage('today');
  },role);
  await seed('admin');
  const type=async t=>{await page.evaluate(t=>{const q=document.getElementById('q');q.focus();q.value=t;q.dispatchEvent(new Event('input',{bubbles:true}));},t);await page.waitForTimeout(250);};
  const key=async k=>{await page.evaluate(k=>{document.getElementById('q').dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));},k);};
  await type('수지');
  const r1=await page.evaluate(()=>[].map.call(document.querySelectorAll('.gs-item b'),b=>b.textContent));
  assert.deepEqual(r1,['래미안 용인 수지','힐스테이트 수지'],'현장명 검색: 영업건+문의');
  await type('5555');
  const r2=await page.evaluate(()=>[].map.call(document.querySelectorAll('.gs-item b'),b=>b.textContent));
  assert.deepEqual(r2,['래미안 용인 수지'],'전화번호 검색');
  await type('황윤');
  const r3=await page.evaluate(()=>[].map.call(document.querySelectorAll('.gs-item'),b=>b.querySelector('b').textContent+'/'+b.querySelector('em').textContent));
  assert.ok(r3.includes('황윤선/담당자'),'담당자 결과 '+r3.join(','));
  await type('자이');await key('Enter');await page.waitForTimeout(200);
  const opened=await page.evaluate(()=>document.getElementById('detailView').classList.contains('on')&&CUR_DETAIL&&CUR_DETAIL.key);
  assert.equal(opened,'d-2','Enter로 영업 상세 열림');
  const hidden=await page.evaluate(()=>document.querySelector('.gs-pop').hidden);assert.equal(hidden,true,'선택 후 닫힘');
  await page.evaluate(()=>closeDetail());
  await seed('rep');await type('분당');
  const r4=await page.evaluate(()=>[].map.call(document.querySelectorAll('.gs-item b'),b=>b.textContent));
  assert.deepEqual(r4,[],'담당자는 남의 영업건이 안 보임');
  await type('수지');
  const r5=await page.evaluate(()=>[].map.call(document.querySelectorAll('.gs-item b'),b=>b.textContent));
  assert.ok(r5.includes('래미안 용인 수지'),'담당자 본인 건은 보임');
  await page.setViewportSize({width:390,height:844});await type('수지');
  const fits=await page.evaluate(()=>{G.dashBOff=true;/* 예전 대시보드 화면 검사 — 새 화면은 verify-dash-b */const r=document.querySelector('.gs-pop').getBoundingClientRect();return r.left>=0&&r.right<=390});
  assert.equal(fits,true,'좁은 화면에서 넘치지 않음');
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',site:true,phone:true,rep:true,enter_opens:true,role_scope:true,narrow:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
