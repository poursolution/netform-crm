'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const adapter=require('../operational-adapter.js');

const inquiry='f6090800-0001-4000-8000-000000000001';
const auth='f6090800-0002-4000-8000-000000000002';
const user='f6090800-0003-4000-8000-000000000003';
const request='f6090800-0004-4000-8000-000000000004';

test('store handoff keeps material-only demand out of Pipeline and normalizes durable fields',()=>{
 const payload={inquiry_id:inquiry,intent:'store_handoff',reason:'자재만 구매',material_note:'옥탑 싱글 방수 자재 · 면적 확인 필요',delivery_method:'배송',desired_date:'2026-09-15',direct_install:true,needs_construction_consultation:false};
 const out=adapter.normalize('inquiry_status',inquiry,0,payload);
 assert.deepEqual(out.payload,{intent:'store_handoff',reason:'자재만 구매',material_note:'옥탑 싱글 방수 자재 · 면적 확인 필요',delivery_method:'배송',desired_date:'2026-09-15',direct_install:true,needs_construction_consultation:false});
 assert.equal(out.expected_version,0);
});

test('store handoff rejects empty notes, unknown reasons and forged fields',()=>{
 const base={inquiry_id:inquiry,intent:'store_handoff',reason:'자재만 구매',material_note:'자재',delivery_method:'미정',desired_date:'',direct_install:true,needs_construction_consultation:false};
 for(const payload of [{...base,material_note:''},{...base,reason:'자동판정'},{...base,actor:'위조'}])assert.throws(()=>adapter.normalize('inquiry_status',inquiry,0,payload),{code:'INQUIRY_STORE_HANDOFF_INTENT_NOT_CONNECTED'});
});

test('store handoff ACK is request, actor, queue and payload correlated',()=>{
 const payload={inquiry_id:inquiry,intent:'store_handoff',reason:'소규모 현장',material_note:'소량 자재 구매',delivery_method:'방문수령',desired_date:'',direct_install:true,needs_construction_consultation:true};
 const normalized=adapter.normalize('inquiry_status',inquiry,0,payload);
 const command={...normalized,request_id:request,auth_uid:auth,user_id:user};
 const ack={contract_version:1,ok:true,request_id:request,operation:'inquiry_status',object_id:inquiry,actor_auth_uid:auth,actor_user_id:user,replayed:false,intent:'store_handoff',from_status:'접수',to_status:'POUR스토어 이관대기',queue_code:'pour_store',reason:payload.reason,material_note:payload.material_note,delivery_method:payload.delivery_method,desired_date:'',direct_install:true,needs_construction_consultation:true,routed_at:'2026-09-08T09:00:00Z',routed_by:'관리자',inquiry_audit_event_id:'f6090800-0005-4000-8000-000000000005'};
 assert.equal(adapter.validateAck(ack,command),ack);
 for(const patch of [{queue_code:'sales'},{material_note:'변조'},{to_status:'영업전환'}])assert.throws(()=>adapter.validateAck({...ack,...patch},command),{code:'ACK_CONTRACT_MISMATCH'});
});

test('PC and mobile expose the same explicit POUR Store handoff action',()=>{
 const pc=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
 const mobile=fs.readFileSync(path.join(__dirname,'..','mobile.html'),'utf8');
 for(const code of [pc,mobile]){assert.match(code,/POUR스토어 이관/);assert.match(code,/intent:'store_handoff'/);assert.match(code,/material_note/);assert.match(code,/needs_construction_consultation/);}
 assert.match(pc,/G\.inqBucket='스토어 이관'/);
 assert.match(mobile,/CLOSED_INQ=.*POUR스토어 이관대기/);
});

test('migration writes one server-owned route record and reprojects it',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20260908090000_inquiry_store_handoff.sql'),'utf8');
 assert.match(sql,/status='POUR스토어 이관대기'/);
 assert.match(sql,/action='inquiry_store_handoff'/);
 assert.match(sql,/raw=coalesce\(raw,'\{\}'::jsonb\)\|\|jsonb_build_object\('store_handoff',route_value\)/);
 assert.match(sql,/p_domain<>'inquiry_core'/);
 assert.doesNotMatch(sql,/insert into public\.deals/i);
});
