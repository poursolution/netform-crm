'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ID='11111111-1111-4111-8111-111111111111',RID='22222222-2222-4222-8222-222222222222';
function setup(){
 const r={id:RID,target_type:'deal',target_id:ID,kind:'first',label:'첫 연락 요청',asks:['고객 첫 연락'],to_me:true,status:'sent',open:true,closed_at:null};
 const s={row:structuredClone(r),writes:[],mode:''},root={G:{},document:{addEventListener(){}},Phase1:{profile:{auth_uid:ID,user_id:ID}}};
 root.Phase1.rpc=async(name,{p})=>{
  if(name==='crm_work_request_list_v1'){if(s.mode==='account')root.Phase1.profile={auth_uid:RID,user_id:RID};return {ok:true,requests:[structuredClone(s.row)]};}
  s.writes.push(p);if(s.mode==='reject')throw Error('denied');
  if(p.action==='working')Object.assign(s.row,{status:'working',open:true,closed_at:null});
  else Object.assign(s.row,{status:'done',open:false,closed_at:'2026-10-11T00:00:00Z',result:p.result,next_text:p.next_text,next_due:p.next_due});
  if(s.mode==='lost')throw Error('lost response');
  if(s.mode==='id-only')return {ok:true,request:{id:RID}};
  if(s.mode==='wrong-target')return {ok:true,request:{...s.row,target_id:RID}};
  if(s.mode==='absent-closed')return {ok:true,request:{...s.row,status:'absent',open:false,closed_at:'2026-10-11T00:00:00Z'}};
  return {ok:true,request:structuredClone(s.row)};
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../mobile-requests.js'),'utf8'),{window:root,Date,console});
 const o={result:'연결됨',absent:false,next_text:'회의 결과 확인',next_due:'2026-10-15',activity:{ok:true,operation:'activity',object_id:ID,activity_id:RID,actor_auth_uid:ID,actor_user_id:ID,meaningful_contact:true}};
 return {s,root,r,o,api:root.MobileRequests};
}
test('connected contact verifies target, result and schedule before marking done',async()=>{const e=setup();const r=await e.api.complete(e.r,e.o);assert.equal(r.status,'done');assert.equal(e.s.writes.length,1);});
test('absence uses working action, not done with absent flag',async()=>{const e=setup();await e.api.complete(e.r,{...e.o,result:'부재',absent:true,activity:{...e.o.activity,meaningful_contact:false}});assert.deepEqual(JSON.parse(JSON.stringify(e.s.writes)),[{id:RID,action:'working'}]);assert.equal(e.s.row.closed_at,null);});
test('lost completion response reconciles without second write',async()=>{const e=setup();e.s.mode='lost';await assert.rejects(e.api.complete(e.r,e.o),/lost/);e.s.mode='';assert.equal((await e.api.complete(e.r,e.o)).status,'done');assert.equal(e.s.writes.length,1);});
test('lost working response reconciles without second write',async()=>{const e=setup(),o={...e.o,result:'번호 오류',absent:true,activity:{...e.o.activity,meaningful_contact:false}};e.s.mode='lost';await assert.rejects(e.api.complete(e.r,o),/lost/);e.s.mode='';assert.equal((await e.api.complete(e.r,o)).status,'working');assert.equal(e.s.writes.length,1);});
test('request ID alone does not acknowledge completion',async()=>{const e=setup();e.s.mode='id-only';await assert.rejects(e.api.complete(e.r,e.o),/확인하지 못/);assert.equal(e.api.state().list.length,0);});
test('wrong target acknowledgement does not change local state',async()=>{const e=setup();e.s.mode='wrong-target';await assert.rejects(e.api.complete(e.r,e.o),/확인하지 못/);assert.equal(e.api.state().list.length,0);});
test('closed absent response contradicts promised working state',async()=>{const e=setup();e.s.mode='absent-closed';await assert.rejects(e.api.complete(e.r,{...e.o,result:'부재',absent:true,activity:{...e.o.activity,meaningful_contact:false}}),/확인하지 못/);});
test('compound or unverified follow requests never close from a contact',async()=>{const e=setup();for(const r of [{...e.r,asks:['고객 첫 연락','견적 필요 여부']},{...e.r,kind:'follow',asks:['수신 확인','고객 반응 기록']}])await assert.rejects(e.api.complete(r,e.o),/PC/);assert.equal(e.s.writes.length,0);});
test('reassignment, changed asks or renewed deadline block before write',async()=>{for(const patch of [{to_me:false},{asks:['견적 필요 여부']},{target_id:RID},{round:2},{due_at:'2026-10-16T12:00:00Z'}]){const e=setup();Object.assign(e.s.row,patch);await assert.rejects(e.api.complete(e.r,e.o),/바뀌었습니다/);assert.equal(e.s.writes.length,0);}});
test('different closed result is not this completion',async()=>{const e=setup();Object.assign(e.s.row,{status:'cancelled',open:false});await assert.rejects(e.api.complete(e.r,e.o),/다른 결과/);assert.equal(e.s.writes.length,0);});
test('account switch while reading blocks request writes',async()=>{const e=setup();e.s.mode='account';await assert.rejects(e.api.complete(e.r,e.o),/계정/);assert.equal(e.s.writes.length,0);});
test('wrong activity target, actor or missing proof never reaches RPC',async()=>{for(const proof of [null,{object_id:RID},{actor_user_id:RID}]){const e=setup();await assert.rejects(e.api.complete(e.r,{...e.o,activity:proof?{...e.o.activity,...proof}:null}),/응대 기록/);assert.equal(e.s.writes.length,0);}});

test('server attempt cannot prove a connected request',async()=>{const e=setup();await assert.rejects(e.api.complete(e.r,{...e.o,activity:{...e.o.activity,meaningful_contact:false}}),/실제 연결/);assert.equal(e.s.writes.length,0);});
