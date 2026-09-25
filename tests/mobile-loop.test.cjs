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
 assert.equal(opened.length,1);assert.match(opened[0],/진행 중이에요/);
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
});

test('mobile.html loads the loop after the overlay and fixes the D-NaN due date',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8');
 assert.ok(html.indexOf('mobile-loop.js?v=')>html.indexOf('operational-overlay.js?v='));
 const dd=html.slice(html.indexOf('function dueDays(d)'),html.indexOf('function dueDays(d)')+420);
 assert.match(dd,/slice\(0,10\)/);assert.doesNotMatch(dd,/T23:59:59/);
 assert.match(html,/MOBILE_SYNC_GAP=\{inquiryMs:300000,dealMs:600000/);
});
