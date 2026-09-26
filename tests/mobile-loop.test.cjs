'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const overlay=require('../operational-overlay.js');

const ACTION='0972a944-1bdc-4a0c-9217-73704fd3f02b';
const src=fs.readFileSync(path.join(__dirname,'..','mobile-loop.js'),'utf8');
/* 앱의 기한 계산(execDueM)은 기기 현지 날짜 기준 — 테스트도 같은 기준(CI는 UTC) */
const kst=()=>new Intl.DateTimeFormat('en-CA').format(new Date());
const plus=n=>{const t=new Date();t.setDate(t.getDate()+n);return new Intl.DateTimeFormat('en-CA').format(t);};

function loadLoop(root){vm.runInNewContext(src,{window:root,Intl,Date,JSON,Math,Number,String,Object,Array,Set,Map,Error,setTimeout:()=>0});return root;}
function mobileRoot(deals,base){
 const due=d=>{const a=d.nextAction;if(!a||a.status!=='open')return null;const s=String(a.due_at).slice(0,10),x=new Date(s+'T00:00:00'),t=new Date();t.setHours(0,0,0,0);return Math.round((x-t)/864e5);};
 const root={G:{user:{id:'me',nm:'담당'},done:{}},DEALS:deals,esc:String,escAttr:String,isOpen:()=>true,execDueM:due,amtTxt:()=>'',stageLabel:c=>c,execCallM:()=>true,localStorage:{getItem:()=>null,setItem(){}}};
 root.myDeals=()=>root.DEALS.slice();
 root.buildToday=function(){return base(root);};
 return loadLoop(root);
}

test('mobile Today puts customer promises first, restores a promise the 12-cap cut, and moves legacy deals to cleanup',()=>{
 const deals=[
  {id:'P',nm:'약속 오늘',created_at:'2026-10-02',nextAction:{id:ACTION,type:'고객 약속',text:'고객 약속: 견적 전달',due_at:kst(),status:'open'}},
  {id:'P2',nm:'약속 지남',created_at:'2026-10-02',nextAction:{id:'x',type:'전화',text:'고객 약속: 샘플 전달',due_at:plus(-2),status:'open'}},
  {id:'O',nm:'기한 지남',created_at:'2026-10-02',nextAction:{id:'y',type:'전화',text:'확인',due_at:plus(-1),status:'open'}},
  {id:'L',nm:'과거 이관',created_at:'2026-08-01',nextAction:null}];
 let seen=null;
 const root=mobileRoot(deals,r=>{seen=r.myDeals().map(d=>d.id);/* 동기화 계층의 12건 자르기를 흉내: P2가 잘려 나감 */return [{kind:'deal',ref:'O',p:0,nm:'기한 지남'},{kind:'deal',ref:'P',p:1,nm:'약속 오늘'},{kind:'deal',ref:'L',p:5,nm:'과거 이관'}];});
 const out=root.buildToday();
 assert.deepEqual(seen,['P','P2','O'],'legacy deals are hidden from the base builder before it caps the list');
 assert.deepEqual(out.map(t=>t.ref),['P2','P','O','L'].filter(x=>x!=='L'));
 assert.equal(out[0].p,-2);assert.match(out[0].why,/🤝 고객 약속 · 2일 지남 — 샘플 전달/);
 assert.equal(out[1].p,-1);assert.match(out[1].why,/오늘 — 견적 전달/);
 assert.deepEqual(root.G._legacyM.map(d=>d.id),['L']);
});

test('mobile result chips complete the current action, then record the contact and the promise, confirmed by the server',async()=>{
 const ops=[],rows=[];
 const d={id:'D1',nm:'현장',activities:[],nextAction:{id:ACTION,type:'전화',text:'통화 후속 확인',due_at:plus(-1),status:'open'}};
 const root=mobileRoot([d],()=>[]);
 root.G.deal='D1';root.closeSheet=()=>{};root.render=()=>{};root.doneKey=t=>'k:'+t.ref;
 root.queueMobileContactOperation=(op,payload,actionId)=>{const id='r'+ops.length;ops.push({op,payload,actionId});rows.push({request_id:id,status:'done',ack:{ok:true,activity_id:'A1',next_action_id:'N1'}});return id;};
 root.Phase1={queue:{list:()=>rows,flush:async()=>rows}};
 const status={textContent:'',classList:{add(){}}},card={querySelectorAll:()=>[]};
 await root.MobileLoop.save(d,'promise',plus(3),'금요일까지 수정 견적 전달',status,card);
 assert.deepEqual(ops.map(x=>x.op),['next_action_complete','activity','next_action']);
 assert.equal(ops[0].actionId,ACTION);
 assert.match(ops[1].payload.note,/고객 약속: 금요일까지 수정 견적 전달/);
 assert.equal(ops[2].payload.type,'고객 약속');
 assert.equal(d.nextAction.id,'N1');assert.equal(d.nextAction.type,'고객 약속');
 assert.match(status.textContent,/✓ 기록 완료/);
 assert.equal(root.G.done['k:D1'],1);
});

test('a promise needs a one-line note before anything is written',async()=>{
 const ops=[];const d={id:'D1',nm:'현장',nextAction:null};
 const root=mobileRoot([d],()=>[]);root.G.deal='D1';
 root.queueMobileContactOperation=(op)=>{ops.push(op);return 'r';};root.Phase1={queue:{list:()=>[],flush:async()=>[]}};
 const status={textContent:'',classList:{add(){}}};
 await root.MobileLoop.save(d,'promise',plus(1),'',status,{querySelectorAll:()=>[]});
 assert.equal(ops.length,0);assert.match(status.textContent,/약속/);
});

test('overlay mobile contact path is bound to the open deal and completes only server actions',()=>{
 const enq=[];
 const root={TOKEN:'t',ME:{id:'u'},G:{deal:'D1'},DEALS:[{id:'D1',version:4}],
  Phase1:{profile:null,read:async()=>({data:{}}),queue:{enqueue(op,id,expected,payload){enq.push({op,id,payload});return {request_id:'r'+enq.length,operation:op,payload,status:'pending'};},list:()=>[],flush:async()=>[]}},
  OperationalAdapter:{},addEventListener(){},document:{getElementById:()=>null}};
 overlay.install(root);
 assert.throws(()=>root.queueMobileContactOperation('activity',{opportunity_id:'OTHER'}),/MOBILE_CONTACT_INTENT_NOT_CONNECTED/);
 assert.throws(()=>root.queueMobileContactOperation('next_action_complete',{opportunity_id:'D1'},'na-temp'),/NEXT_ACTION_ID_REQUIRED/);
 root.queueMobileContactOperation('next_action_complete',{opportunity_id:'D1'},ACTION);
 root.queueMobileContactOperation('activity',{opportunity_id:'D1',type:'전화',note:'통화',result:'',occurred_at:new Date().toISOString()});
 root.queueMobileContactOperation('next_action',{opportunity_id:'D1',type:'고객 약속',text:'견적',due_at:plus(2)});
 assert.deepEqual(enq.map(x=>x.op),['next_action_complete','activity','next_action']);
 assert.equal(enq[0].payload.action_id,ACTION);
 assert.equal(enq[1].payload.intent,'standalone');
 assert.equal(enq[2].payload.intent,'standalone');
});

test('after a long call reloads the page, the called site and its result sheet come back (30 min)',()=>{
 const store=new Map([['crm:call-pending:v1',JSON.stringify({id:'D9',at:Date.now()-60000})]]),opened=[];
 const root={G:{user:{id:'me'},done:{}},DEALS:[{id:'D9',nm:'현장',activities:[]}],esc:String,escAttr:String,render(){},intro:()=>'',IC:{phone:''},contactInfoM:()=>({}),
  openSheet:(a,b)=>opened.push(b),document:{getElementById:()=>null},
  sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  setInterval:fn=>{fn();return 1;},clearInterval(){},setTimeout:fn=>fn()};
 vm.runInNewContext(src,{window:root,Intl,Date,JSON,Math,Number,String,Object,Array,Set,Map,Error,setTimeout:fn=>fn()});
 assert.equal(root.G.deal,'D9');
 assert.equal(opened.length,1);assert.match(opened[0],/통화함 · 진행 중/);
 assert.equal(store.has('crm:call-pending:v1'),false,'pending is cleared once the sheet is shown');
});

test('the now card [결과 남기기] opens the same result chips (fallback when the sheet did not pop)',()=>{
 const root=mobileRoot([],()=>[]);
 root.mNowCardM=()=>'<div class="card"><div>x</div><button class="btn btn-primary" onclick="dealCallM()">전화하고 결과 남기기</button><div style="display:flex"><button class="btn btn-line" style="flex:1" onclick="callMemoSheetM()">결과 남기기</button></div></div>';
 vm.runInNewContext(src,{window:root,Intl,Date,JSON,Math,Number,String,Object,Array,Set,Map,Error,setTimeout:()=>0});
 const html=root.mNowCardM({id:'D1',activities:[],nextAction:null});
 assert.match(html,/onclick="dealCallSheetM\(\)">결과 남기기/);
 assert.doesNotMatch(html,/callMemoSheetM/);
 assert.match(html,/MobileLoop\.support\(\)/);
 assert.match(html,/class="ml-steps"/,'stage progress infographic');
 assert.match(html,/class="ml-tl"/,'date-scaled flow timeline');
});

test('result chips save plain-language notes (absent / ongoing) with the same server operations',async()=>{
 for(const [chip,note,next] of [['absent',/^부재중 \(전화 안 받음\)$/,'다시 전화하기'],['ongoing',/^통화 완료 · 진행 중 \(\d\d\/\d\d 다시 확인\)$/,'진행 상황 확인 전화'],['recall',/^통화 시도 · 다시 연락하기로 함$/,'진행 상황 확인 전화']]){
  const ops=[],rows=[];const d={id:'D1',nm:'현장',activities:[],nextAction:null};
  const root=mobileRoot([d],()=>[]);root.G.deal='D1';root.closeSheet=()=>{};root.render=()=>{};root.doneKey=t=>'k:'+t.ref;
  root.queueMobileContactOperation=(op,payload)=>{const id='r'+ops.length;ops.push({op,payload});rows.push({request_id:id,status:'done',ack:{ok:true,activity_id:'A1',next_action_id:'N1'}});return id;};
  root.Phase1={queue:{list:()=>rows,flush:async()=>rows}};
  await root.MobileLoop.save(d,chip,plus(2),'',{textContent:'',classList:{add(){}}},{querySelectorAll:()=>[]});
  assert.deepEqual(ops.map(x=>x.op),['activity','next_action']);
  assert.equal(ops[0].payload.type,'전화');assert.match(ops[0].payload.note,note);
  assert.equal(ops[1].payload.type,'전화');assert.equal(ops[1].payload.text,next);
 }
});

test('flow strip reads old and new history phrases in the new plain words',()=>{
 const root=mobileRoot([],()=>[]);
 const at=n=>new Date(Date.now()-n*864e5).toISOString();
 for(const [acts,last,gone] of [
  [[{type:'부재',note:'전화 부재 — 못 받으심',at:at(1)}],/부재 · 전화 안 받음/,/못 받으심/],
  [[{type:'전화',note:'부재중 (전화 안 받음)',at:at(1)}],/부재 · 전화 안 받음/,/부재중 \(전화/],
  [[{type:'전화',note:'통화 — 진행됨',result:'',at:at(1)}],/전화 · 진행 중/,/진행됨/],
  [[{type:'전화',note:'통화 시도 · 다시 연락하기로 함',at:at(1)}],/전화 · 다시 연락하기로 함/,/통화 시도/]]){
  const html=root.MobileLoop.flowStrip({id:'D',activities:acts,nextAction:{id:'n',type:'재통화',text:'재통화 시도',due_at:plus(1),status:'open'}});
  assert.match(html,last);assert.doesNotMatch(html.replace(/<em>[^<]*<\/em>/,''),gone);
  assert.match(html,/<em>다시 전화하기<\/em>/,'old next-action text is shown in the new words');
 }
 assert.equal(root.MobileLoop.plainWords('통화 후속 확인 · 고객 요청 재연락 · 고객 요청으로 후속 연기'),'통화 후 진행 확인 · 요청 시점에 다시 연락 · 고객 요청으로 다음 주 재연락');
});

test('Today pills speak in days, not D-N or hundreds of hours',()=>{
 const deal=(id,n)=>({id,nextAction:{id:'x',type:'전화',text:'t',due_at:plus(n),status:'open'}});
 const root=mobileRoot([deal('A',2),deal('B',-3),deal('C',0)],()=>[]),P=t=>Array.from(root.MobileLoop.pill(t));
 assert.deepEqual(P({kind:'deal',ref:'A'}),['2일 남음','etc']);
 assert.deepEqual(P({kind:'deal',ref:'B'}),['3일 지남','late']);
 assert.deepEqual(P({kind:'deal',ref:'C'}),['오늘','today']);
 root.ADMIN={inquiries:[{key:'q1',at:'x'},{key:'q2',at:'y'},{key:'q3',at:'z'}]};
 const hours={x:0,y:5,z:449};root.todayHoursM=v=>hours[v];
 assert.deepEqual(P({kind:'inquiry',ref:'q1'}),['방금 접수','new']);
 assert.deepEqual(P({kind:'inquiry',ref:'q2'}),['5시간 경과','late']);
 assert.deepEqual(P({kind:'inquiry',ref:'q3'}),['18일 경과','late']);
 const kst=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(Date.now()-4*864e5));
 assert.deepEqual(P({kind:'inquiry',bucket:'overdue',ref:'q9',due_at:kst}),['4일 지남','late']);
});

test('mobile inquiry result chips keep the exact server keys and only relabel what reps read',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8');
 const overlaySrc=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
 const keys=JSON.parse(overlaySrc.match(/RESPONSE_OUTCOMES=new Set\((\[[^\]]+\])\)/)[1].replace(/'/g,'"'));
 const block=html.slice(html.indexOf('var INQ_RESULTS_M='),html.indexOf('function noteLabelM('));
 const ctx={};vm.runInNewContext(block+html.slice(html.indexOf('function noteLabelM('),html.indexOf('\n',html.indexOf('function noteLabelM('))),ctx);
 assert.deepEqual(Array.from(ctx.INQ_RESULTS_M),keys,'chip values are the overlay/server keys');
 assert.deepEqual(keys.map(ctx.inqResultLabelM),['통화 완료 · 다음 일정 잡음','다음 주에 다시 연락','전화 안 받음 · 내일 다시']);
 assert.deepEqual(['배정완료','응대중','전화응대 완료','접수'].map(ctx.inqStatusLabelM),['배정됨 · 연락 전','연락 진행 중','첫 통화 완료','접수']);
 assert.equal(ctx.noteLabelM('전화 부재 — 못 받으심 · 재통화 시도'),'부재중 (전화 안 받음) · 다시 전화하기');
 const inq=html.slice(html.indexOf('function rInqAssigned('),html.indexOf('function recordInquiryResponse('));
 assert.match(inq,/INQ_RESULTS_M\.map/);assert.match(inq,/data-v="'\+escAttr\(v\)\+'"/);assert.match(inq,/recordInquiryResponse\(.*?this\.dataset\.v\)/);assert.match(inq,/esc\(inqResultLabelM\(v\)\)/);
 const flow=html.slice(html.indexOf('function callFlow('),html.indexOf('function startTodayCall('));
 assert.ok(flow.includes("pickToday('+i+',\\''+c[2]+'\\')"),'the chip passes the raw server key');assert.match(flow,/esc\(inqResultLabelM\(c\[2\]\)\)/);
 const rec=html.slice(html.indexOf('function recordInquiryResponse('),html.indexOf('\n',html.indexOf('function recordInquiryResponse(')));
 assert.match(rec,/label\.indexOf\('못 받'\)>=0\?'배정완료':label\.indexOf\('다음주'\)>=0\?'응대중':'전화응대 완료'/,'stored inquiry status values are unchanged');
});

test('the bell shows no fake sample notifications outside demo mode',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8');
 const src=html.slice(html.indexOf('function rNoti(){'),html.indexOf('/* 설정 (V1.5'));
 for(const DEMO of [false,true]){
  const ctx={DEMO,scr:{innerHTML:''},appbarS:t=>'<b>'+t+'</b>',tile:()=>'',IC:{}};
  vm.runInNewContext(src+';rNoti()',ctx);
  if(DEMO)assert.match(ctx.scr.innerHTML,/\(예시\)/);
  else{assert.match(ctx.scr.innerHTML,/새 알림이 없습니다\./);assert.doesNotMatch(ctx.scr.innerHTML,/농협하나로|6건|G\.deal=3/);}
 }
});

test('mobile stage names and today reasons use the approved plain words',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8');
 const sm=html.slice(html.indexOf('var STAGE_MASTER={'),html.indexOf('};',html.indexOf('var STAGE_MASTER={')));
 for(const [code,name] of [['first_contact','첫 상담·요구 파악'],['rapport','관계 유지'],['silent','장기 무응답 관리'],['waiting','보류 고객'],['compete','경쟁 \\(PT\\)']])assert.match(sm,new RegExp(code+"\\s*:\\{name:'"+name+"'"));
 assert.doesNotMatch(sm,/1차 접촉|유대관계|침묵 관리|대기고객|경쟁단계/);
 const live=html.slice(html.lastIndexOf('function buildToday(){'),html.indexOf('function execCoordM('));
 assert.doesNotMatch(live,/D\+|'D-'|최초 응대|오늘 마감|지정 필요/);
 assert.match(live,/일 지남/);assert.match(live,/일 남음/);
});

test('mobile.html loads the loop after the overlay and fixes the D-NaN due date',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8');
 assert.ok(html.indexOf('mobile-loop.js?v=')>html.indexOf('operational-overlay.js?v='));
 const dd=html.slice(html.indexOf('function dueDays(d)'),html.indexOf('function dueDays(d)')+420);
 assert.match(dd,/slice\(0,10\)/);assert.doesNotMatch(dd,/T23:59:59/);
 assert.match(html,/MOBILE_SYNC_GAP=\{inquiryMs:300000,dealMs:600000/);
});

test('flow timeline shows the originating inquiry (received, assigned, first contact), manager support handling and the final result',()=>{
 const root=mobileRoot([],()=>[]);
 root.BUNDLE={inquiries:[{id:'Q1',received_at:'2026-09-01T01:00:00Z',assigned_at:'2026-09-01T02:00:00Z',first_response_at:'2026-09-01T03:00:00Z'}]};
 const d={id:'D1',code:'contract',origin_inquiry_id:'Q1',outcome:'won',closed_at:'2026-09-20T00:00:00Z',nextAction:null,
  activities:[{type:'메모',note:'[지원 요청] 가격 협의 동행',at:'2026-09-05T00:00:00Z'},{type:'메모',note:'[지원 처리] 가격 조건 결정',at:'2026-09-06T00:00:00Z'}]};
 const html=root.MobileLoop.flowStrip(d);
 assert.equal((html.match(/class="d in"/g)||[]).length,3,'문의 접수·배정·첫 연락');
 assert.match(html,/class="d won"/);
 assert.equal((html.match(/class="d sup"/g)||[]).length,2,'지원 요청과 관리자 처리');
 assert.match(html,/문의·배정/);
});
test('outside demo, mock screens say "준비 중" and nothing pretends to send or save',()=>{
 const toasts=[],scr={innerHTML:''};
 const root=mobileRoot([],()=>[]);
 Object.assign(root,{DEMO:false,toast:m=>toasts.push(m),appbarS:t=>'<h1>'+t+'</h1>',document:{getElementById:id=>id==='scr'?scr:null,querySelectorAll:()=>[]},
  rBrief(){scr.innerHTML='지난주: 수주 1건 · 1.2억';},rCoach(){},rMonthly(){},rDups(){},rAxis(){},tmplSheet(){toasts.push('발송 완료');},photoSheet(){toasts.push('사진 첨부 — 타임라인 기재됨');},voiceMemo(){toasts.push('음성 메모 저장됨');},callMemoSheetM(){toasts.push('memo-sheet');}});
 vm.runInNewContext(src,{window:root,Intl,Date,JSON,Math,Number,String,Object,Array,Set,Map,Error,setTimeout:()=>0});
 root.rBrief();assert.match(scr.innerHTML,/준비 중인 화면/);assert.doesNotMatch(scr.innerHTML,/1\.2억/);
 root.tmplSheet();root.photoSheet();root.voiceMemo();
 assert.deepEqual(toasts,['템플릿 발송은 준비 중입니다 — 문자는 [문자] 버튼으로 보내 주세요.','사진 첨부는 준비 중입니다 — 아직 저장되지 않습니다.','memo-sheet']);
});
test('a call attempt without a result shows up as "결과를 안 남긴 통화" until a result is recorded',()=>{
 const now=Date.now(),iso=ms=>new Date(ms).toISOString();
 const d={id:'D1',nm:'현장',activities:[{type:'전화',note:'전화 시도 — 010-1234-5678',at:iso(now-30*60e3)}]};
 const root=mobileRoot([d],()=>[]);
 assert.equal(root.MobileLoop.pendingCalls().length,1);
 d.activities.push({type:'전화',note:'부재중 (전화 안 받음)',at:iso(now-10*60e3)});
 assert.equal(root.MobileLoop.pendingCalls().length,0,'결과를 남기면 사라진다');
 d.activities.push({type:'전화',note:'전화 시도 — 010-1234-5678',at:iso(now-26*3600e3)});
 assert.equal(root.MobileLoop.pendingCalls().length,0,'24시간 지난 시도는 알림에서 뺀다(관리자 지표에는 남음)');
 /* 상세 화면 연락처 버튼은 '관리소장 전화 시도'로 남긴다 — 이것도 시도다 */
 const d2={id:'D2',nm:'현장2',activities:[{type:'전화',note:'관리소장 전화 시도',result:'010-1111-2222',at:iso(now-20*60e3)}]};
 root.DEALS.push(d2);
 assert.equal(root.MobileLoop.pendingCalls().map(x=>x.d.id).join(','),'D2');
});

test('"오늘 처리" counts sites from server records by me — work done on PC shows on the phone, one result save counts once',()=>{
 const now=Date.now(),iso=ms=>new Date(ms).toISOString(),yest=new Date(now-864e5).toISOString();
 const deals=[
  /* PC에서 처리: 연락 결과 + 완료 + 다음 할 일 = 현장 1건(고객 연락) */
  {id:'PC',nm:'PC 처리',activities:[{id:'a1',type:'전화',note:'통화 완료 · 진행 중',actor_name:'담당',at:iso(now-5e3)},{id:'a2',type:'next_action_complete',actor_name:'담당',at:iso(now-5e3)},{id:'a3',type:'next_action_set',note:'다음 확인',actor_name:'담당',at:iso(now-5e3)}]},
  /* 고객 약속을 잡은 현장 */
  {id:'PR',nm:'약속',activities:[{id:'b1',type:'부재',note:'부재중 (전화 안 받음)',actor_name:'담당',at:iso(now-9e3)},{id:'b2',type:'next_action_set',note:'고객 약속: 견적 전달',actor_name:'담당',at:iso(now-9e3)}]},
  /* 다른 사람 기록·전화 시도만·어제 기록은 세지 않는다 */
  {id:'OT',nm:'남의 것',activities:[{id:'c1',type:'전화',note:'통화',actor_name:'다른사람',at:iso(now-9e3)}]},
  {id:'AT',nm:'시도만',activities:[{id:'e1',type:'전화',note:'관리소장 전화 시도',actor_name:'담당',at:iso(now-9e3)}]},
  {id:'YD',nm:'어제',activities:[{id:'f1',type:'전화',note:'통화',actor_name:'담당',at:yest}]},
  /* 이 기기가 방금 저장해 아직 작성자 이름이 없는 기록 — 서버 확인(ACK) 목록으로 내 것임을 안다 */
  {id:'MB',nm:'방금',activities:[{id:'g1',type:'전화',note:'통화 완료 · 진행 중',at:iso(now-1e3)}]}];
 const root=mobileRoot(deals,()=>[]);
 root.Phase1={queue:{list:()=>[{request_id:'r1',status:'done',operation:'activity',object_id:'MB',payload:{type:'전화',note:'통화 완료 · 진행 중'},ack:{activity_id:'g1',server_at:iso(now-1e3)}}]}};
 root.BUNDLE={inquiries:[{id:'Q1',assignee:'담당',first_response_at:iso(now-3e3)},{id:'Q2',assignee:'다른사람',first_response_at:iso(now-3e3)}]};
 const ds=root.MobileLoop.daySummary();
 assert.equal(ds.total,4,'PC·약속·방금·문의 = 현장 4곳');
 assert.equal(ds.promise,1);assert.equal(ds.contact,3,'PC 처리·방금·문의 첫 연락');assert.equal(ds.next,1,'약속은 다음 할 일에 포함');
 assert.deepEqual([...ds.sites].sort(),['d:MB','d:PC','d:PR','i:Q1']);
 const k=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date(yest));
 if(k in ds.hist)assert.equal(ds.hist[k],1,'어제 막대도 서버 기록으로');
});

test('PC flow metrics treat "관리소장 전화 시도" as an attempt, not a customer contact',()=>{
 const si=fs.readFileSync(path.join(__dirname,'..','sales-insights.js'),'utf8');
 assert.doesNotMatch(si,/\/\^\\s\*전화 시도\//,'시작 위치만 보던 예전 판정이 남아 있지 않다');
 const re=/(?:^|\s)전화 시도(?:\s|$)/;
 for(const n of ['전화 시도 — 010-1234-5678','관리소장 전화 시도','관리사무소 전화 시도'])assert.ok(re.test(n),n);
 assert.ok(!re.test('통화 완료 · 진행 중'));
});