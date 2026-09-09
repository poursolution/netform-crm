'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const adapter=require('../operational-adapter.js');

const deal='f6090900-0001-4000-8000-000000000001';
const request='f6090900-0002-4000-8000-000000000001';
const auth='f6090900-0003-4000-8000-000000000001';
const actor='f6090900-0004-4000-8000-000000000001';
const history=42;
const activity='f6090900-0005-4000-8000-000000000001';
const audit='f6090900-0006-4000-8000-000000000001';

test('원천 브랜드 정정은 별도 버전 명령이며 현재 사업유형 입력을 받지 않는다',()=>{
  const c=adapter.normalize('origin_business_correct',deal,7,{opportunity_id:deal,expected_version:7,to_origin:'아파트스퀘어',reason:'아파트스퀘어 문의 유입 확인',reason_source:'text'});
  assert.deepEqual(c.payload,{to_origin:'아파트스퀘어',reason:'아파트스퀘어 문의 유입 확인',reason_source:'text'});
  assert.equal(c.expected_version,7);
  assert.equal('current_business' in c.payload,false);
  assert.throws(()=>adapter.normalize('origin_business_correct',deal,7,{to_origin:'임의 브랜드',reason:'근거 충분함'}),{code:'INVALID_ORIGIN_BUSINESS_TARGET'});
  assert.throws(()=>adapter.normalize('origin_business_correct',deal,7,{to_origin:'아파트스퀘어',reason:'짧음'}),{code:'INVALID_ORIGIN_BUSINESS_REASON'});
  assert.throws(()=>adapter.normalize('origin_business_correct',deal,7,{to_origin:'아파트스퀘어',reason:'근거 충분함',actor_name:'위조'}),{code:'INVALID_ORIGIN_BUSINESS_PAYLOAD'});
});

test('ACK는 기술자문 유지·버전 증가·3중 이력이 모두 있어야 통과한다',()=>{
  const normalized=adapter.normalize('origin_business_correct',deal,7,{to_origin:'아파트스퀘어',reason:'아파트스퀘어 문의 유입 확인'});
  const command={...normalized,request_id:request,auth_uid:auth,user_id:actor};
  const ack={contract_version:1,ok:true,request_id:request,operation:'origin_business_correct',object_id:deal,
    actor_auth_uid:auth,actor_user_id:actor,actor_name:'황윤선',previous_version:7,version:8,
    from_origin:'기술자문',to_origin:'아파트스퀘어',current_business:'기술자문',business_history_id:history,
    activity_id:activity,audit_event_id:audit,server_at:'2026-09-09T01:02:03Z',replayed:false};
  assert.equal(adapter.validateAck(ack,command),ack);
  for(const patch of [{current_business:'아파트스퀘어'},{to_origin:'POUR솔루션'},{version:7},{business_history_id:null},{activity_id:null},{audit_event_id:null}])
    assert.throws(()=>adapter.validateAck({...ack,...patch},command),{code:'ACK_CONTRACT_MISMATCH'});
});

test('UI와 SQL 후보는 담당자 수정·ACK 후 반영·기술자문 불변을 명시한다',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
  const overlay=fs.readFileSync(path.join(__dirname,'..','operational-overlay.js'),'utf8');
  const sql=fs.readFileSync(path.join(__dirname,'..','sql','origin-business-correction','20260909','candidate.sql'),'utf8');
  assert.match(html,/function canEditOriginBusiness/);
  assert.match(html,/원천 영업브랜드 정정을 서버에 요청했습니다\. ACK 확인 후 화면에 반영됩니다/);
  assert.match(html,/현재 사업유형 기술자문은 유지됩니다/);
  assert.match(overlay,/function applyOriginBusinessAck/);
  assert.match(sql,/current_business_value is distinct from '기술자문'/);
  assert.match(sql,/update public\.deals d set\s+origin_business=to_origin_value/);
  assert.doesNotMatch(sql,/update public\.deals d set[\s\S]{0,220}current_business\s*=/i);
  assert.match(sql,/not crm_security\.can_deal\(p_object_id,true\)/);
  assert.match(sql,/'origin_business_correct'/);
  assert.match(sql,/'origin_correction'/);
  assert.match(sql,/revoke all on function crm_security\.crm_origin_business_correct_command_v1[\s\S]*service_role/);
});
