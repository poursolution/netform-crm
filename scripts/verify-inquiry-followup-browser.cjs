'use strict';
/* 견적문의 결과 기록 한 길 검사(2026-10-04 저장 실패 PT409 수정)
   이미 응대한 문의의 후속 연락은 '단계 진행(inquiry_status progress)'이 아니다 — 서버는 같은 상태로의 진행을 충돌(PT409)로 거절하고, 상태 이름이 다르면 엉뚱한 단계로 되돌린다.
   첫 응대 = 단계 진행(접수 → 전화응대 완료) / 후속 연락 = 상태는 그대로 두고 다음 할 일만 다시 잡는다(next_action · inquiry_next_set).
   목록 줄 기록 · 오늘 업무 실행 모드 · 상세 기록이 같은 함수(InquiryListV3.record)를 쓴다. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const srv=http.createServer((req,res)=>{const t=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!fs.existsSync(t)||!fs.statSync(t).isFile()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',t.endsWith('.js')?'text/javascript':t.endsWith('.css')?'text/css':t.endsWith('.png')?'image/png':'text/html');fs.createReadStream(t).pipe(res)});
(async()=>{
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1500,height:950},timezoneId:'Asia/Seoul'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());return u.hostname==='127.0.0.1'?r.continue():r.abort()});
  const page=await ctx.newPage(),errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00+09:00'));
  await page.goto(`http://127.0.0.1:${srv.address().port}/crm.html`);await page.waitForFunction(()=>window.InquiryListV3&&window.TodayV3&&window.InquiryWorkbench&&window.OperationalAdapter&&typeof window.applyInqBulkAction==='function');
  const out=await page.evaluate(()=>{
   const T=k=>k+'T10:00:00+09:00',Q1='bca8047d-9b86-4d14-8a6e-936888d1355b',Q2='f50faba3-ccef-44e4-8ff3-028d86b36fcc',Q3='11111111-1111-4111-8111-111111111111';
   const inq=(id,site,status,first)=>({id,site,assignee:'정정훈',brand:'석민이앤씨',status,created:'2026-09-05',at:T('2026-09-05'),first_response_at:first||null,phone:'010-1111-2222'});
   B={deals:[],inquiries:[inq(Q1,'[충남 천안] 천안두정E편한세상2차','전화응대 완료',T('2026-09-10')),inq(Q2,'[충남 천안] 천안두정E편한세상2차 (재문의)','견적서 발송예정',T('2026-09-10')),inq(Q3,'[인천] 첫 연락 전 문의','접수',null)],activities:[],inquiryTrash:[],expansion_pool:[]};
   LOCAL={deals:{},inquiries:{},expansionPool:[]};AUTH_ON=true;ME={id:'rep2',name:'정정훈',role:'rep'};G.year='전체';G.quarter=0;G.rep='전체';G.brand='전체';G.q='';
   document.getElementById('authGate').classList.remove('on');document.getElementById('load').style.display='none';window.saveLocal=()=>{};window.__writes=[];window.pushWrite=(op,p)=>{__writes.push([op,JSON.parse(JSON.stringify(p))]);return 'req';};
   const R=InquiryListV3,q1=B.inquiries[0],q2=B.inquiries[1],q3=B.inquiries[2],o={res:'통화 결과: 통화 연결 → 다음 연락 2026.10.28(수)',next:'다음 연락 · 통화 연결',due:'2026-10-28'};
   INQ_SEL={keep:true};G.inqBulkMode='x';G.inqNotice='n';
   const r={};
   r.first=[R.isFirst(q1),R.isFirst(q2),R.isFirst(q3)];
   /* 1. 이미 응대한 문의(전화응대 완료): 후속 연락 = 다음 할 일 등록, 상태는 그대로 */
   r.ok1=R.record(q1,o);r.w1=__writes.slice();r.s1=q1.status;r.next1=[q1.nextAction,q1.nextActionText];
   r.kept=[JSON.stringify(INQ_SEL),G.inqBulkMode,G.inqNotice,!!document.querySelector('#inqActText,#inqActDue,#iq-did')];
   r.act1=(itemPatch(q1,'inq').activities||[]).map(a=>[a.type,a.result||'']);
   /* 서버 명령 규칙에 맞는 모양인지(다음 할 일 등록) · 같은 상태로의 단계 진행은 보내지 않는다 */
   try{OperationalAdapter.normalize('next_action',q1.id,0,{inquiry_id:q1.id,intent:'inquiry_next_set',type:'전화',text:r.w1[0][1].text,due_at:r.w1[0][1].due_at});r.norm=true;}catch(e){r.norm=String(e.message||e);}
   /* 2. 상태 이름이 목록에 없는 문의(견적서 발송예정): 엉뚱한 단계로 되돌리지 않는다 */
   __writes.length=0;r.ok2=R.record(q2,o);r.w2=__writes.map(w=>w[0]);r.s2=q2.status;
   /* 3. 첫 응대: 단계 진행(접수 → 전화응대 완료) — 다음 할 일 등록으로 가지 않는다 */
   __writes.length=0;r.ok3=R.record(q3,{res:'[전화 · 통화 연결] 소장 통화',next:'자료 보내기',due:'2026-10-24'});r.w3=__writes.map(w=>w[0]);r.s3=[q3.status,!!q3.first_response_at,q3.nextActionText];
   /* 4. 값이 빠지면 저장하지 않는다 */
   __writes.length=0;try{R.record(q1,{res:'',next:'x',due:'2026-10-28'});r.miss='저장됨';}catch(e){r.miss=e.message;}r.w4=__writes.length;
   /* 5. 화면에 같은 id 의 입력칸이 이미 있으면 지우지 않고 값만 되돌린다 */
   const real=document.createElement('input');real.id='inqActText';real.value='원래 값';document.body.append(real);__writes.length=0;r.ok5=R.record(q1,o);r.real=[document.getElementById('inqActText')===real,real.value];real.remove();
   return r;
  });
  assert.deepEqual(out.first,[false,false,true]);
  assert.equal(out.ok1,true);assert.deepEqual(out.w1,[['next_action',{inquiry_id:'bca8047d-9b86-4d14-8a6e-936888d1355b',type:'전화',text:'다음 연락 · 통화 연결 — 통화 결과: 통화 연결 → 다음 연락 2026.10.28(수)',due_at:'2026-10-28'}]],'후속 연락 = 다음 할 일 등록 1건(단계 진행 아님)');
  assert.equal(out.s1,'전화응대 완료','상태는 그대로');assert.deepEqual(out.next1,['2026-10-28','다음 연락 · 통화 연결 — 통화 결과: 통화 연결 → 다음 연락 2026.10.28(수)']);
  assert.deepEqual(out.kept,['{"keep":true}','x','n',false],'선택 · 안내 상태는 그대로 · 임시 입력칸은 지운다');
  assert.deepEqual(out.act1.slice(-1),[['전화','통화 결과: 통화 연결 → 다음 연락 2026.10.28(수)']],'연락 결과는 기록에 남는다');
  assert.equal(out.norm,true,'서버 명령 규칙(다음 할 일 등록)에 맞는다');
  assert.equal(out.ok2,true);assert.deepEqual(out.w2,['next_action']);assert.equal(out.s2,'견적서 발송예정','다른 단계로 되돌리지 않는다');
  assert.equal(out.ok3,true);assert.deepEqual(out.w3.filter(x=>x==='next_action'),[],'첫 응대는 단계 진행');assert.deepEqual(out.s3,['전화응대 완료',true,'자료 보내기']);
  assert.equal(out.miss,'결과와 다음 행동일을 모두 넣어 주세요.');assert.equal(out.w4,0);
  assert.equal(out.ok5,true);assert.deepEqual(out.real,[true,'원래 값']);
  /* 세 화면이 같은 함수를 쓴다 */
  const src=f=>fs.readFileSync(path.join(root,f),'utf8');
  assert.match(src('today-v3.js'),/InquiryListV3\.record\(q,/);assert.doesNotMatch(src('today-v3.js'),/iqApply\(q,'step:'\+idx\)/);
  assert.match(src('inquiry-workbench.js'),/L3\.record\(q,o\)/);assert.doesNotMatch(src('inquiry-list-v3.js'),/iqApply\(q,'step:'\+idx\)/);
  assert.deepEqual(errs,[]);
  console.log(JSON.stringify({status:'PASS',followup_is_next_action_not_progress:true,status_unchanged:true,no_backward_move:true,first_contact_progress:true,required_values:true,existing_inputs_kept:true,one_function_three_screens:true}));
 }finally{await browser.close();srv.close();}
})().catch(e=>{console.error(e);process.exit(1)});
