const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const adapter=require('../operational-adapter.js');

const inquiryId='f6090500-0005-4000-8000-000000000001';
const actorAuth='f6090500-0001-4000-8000-000000000001';
const actorUser='f6090500-0001-4000-8000-000000000002';
const requestId='f6090500-0002-4000-8000-000000000003';
const historyId='f6090500-0003-4000-8000-000000000004';
const auditId='f6090500-0004-4000-8000-000000000005';

function command(intent,to){
  const normalized=adapter.normalize('inquiry_assign',inquiryId,0,{
    inquiry_id:inquiryId,
    from:'미배정',
    to,
    status:'배정완료',
    reason:'경남 권역 문의',
    assignment_group:'gyeongnam',
    owner_group:'gyeongnam',
    branch_code:'gyeongnam',
    intent
  });
  return {...normalized,request_id:requestId,auth_uid:actorAuth,user_id:actorUser};
}

test('branch handoff normalizes to the existing server intent',()=>{
  const c=command('branch_handoff','경남지사');
  assert.deepEqual(c.payload,{intent:'branch_handoff',reason:'경남 권역 문의'});
  assert.equal(adapter.validateAck({contract_version:1,ok:true,request_id:requestId,operation:'inquiry_assign',object_id:inquiryId,actor_auth_uid:actorAuth,actor_user_id:actorUser,intent:'branch_handoff',assigned_to:null,assignee_name:'경남지사',status:'배정완료',changed:true,assignment_history_id:historyId,inquiry_audit_event_id:auditId,server_at:'2026-09-07T00:00:00Z',replayed:false},c).ok,true);
});

test('branch owner assign and nullable pool acknowledgements are distinct',()=>{
  const assigned=command('branch_owner_assign','TEST GYEONGNAM');
  assert.equal(assigned.payload.to_name,'TEST GYEONGNAM');
  assert.equal(adapter.validateAck({contract_version:1,ok:true,request_id:requestId,operation:'inquiry_assign',object_id:inquiryId,actor_auth_uid:actorAuth,actor_user_id:actorUser,intent:'branch_owner_assign',assigned_to:'f6090500-0001-4000-8000-000000000004',assignee_name:'TEST GYEONGNAM',status:'배정완료',changed:true,assignment_history_id:historyId,inquiry_audit_event_id:auditId,server_at:'2026-09-07T00:00:00Z',replayed:false},assigned).ok,true);
  const pooled=command('branch_owner_pool','경남지사');
  assert.equal(adapter.validateAck({contract_version:1,ok:true,request_id:requestId,operation:'inquiry_assign',object_id:inquiryId,actor_auth_uid:actorAuth,actor_user_id:actorUser,intent:'branch_owner_pool',assigned_to:null,assignee_name:'경남지사',status:'배정완료',changed:true,assignment_history_id:historyId,inquiry_audit_event_id:auditId,server_at:'2026-09-07T00:00:00Z',replayed:false},pooled).ok,true);
});

test('branch markers without an explicit intent remain blocked',()=>{
  assert.throws(()=>adapter.normalize('inquiry_assign',inquiryId,0,{inquiry_id:inquiryId,to:'경남지사',branch_code:'gyeongnam'}),/INQUIRY_INTENT_NOT_CONNECTED/);
});

test('PC handlers send explicit branch intents and surface enqueue failures',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
  assert.match(html,/inqCtlRecordAssignment\(q,'경남지사',reason,'branch_handoff'\)/);
  assert.match(html,/inqCtlRecordAssignment\(q,rep,reason,'branch_owner_assign'\)/);
  assert.match(html,/inqCtlRecordAssignment\(q,'경남지사','경남지사 내부 실담당자 미지정 전환','branch_owner_pool'\)/);
  assert.match(html,/var requestId=pushWrite\('inquiry_assign',payload\);if\(repProfile/);
  assert.match(html,/저장 요청에 실패했습니다\. 다시 시도해 주세요/);
});

test('branch confirmation click closes only after enqueue succeeds',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','crm.html'),'utf8');
  const source=html.match(/function inqCtlConfirmBranchHandoff\(\)\{[^\n]+\}/)[0];
  const row={id:inquiryId,site:'테스트 현장'};
  const events=[];
  const context={
    INQ_CTL_MODAL:{mode:'branch_handoff',reassign:false,keys:[inquiryId]},
    INQ_SEL:{[inquiryId]:true},
    G:{},
    $:()=>({value:''}),
    inqCtlFind:()=>row,
    inqKey:x=>x.id,
    inqCtlRecordAssignment:(q,to,reason,intent)=>events.push({q,to,reason,intent}),
    inqCtlError:message=>events.push({error:message}),
    saveLocal:()=>events.push('saved'),
    closeInquiryControlModal:()=>events.push('closed'),
    paint:()=>events.push('painted')
  };
  vm.runInNewContext(`${source};inqCtlConfirmBranchHandoff()`,context);
  assert.deepEqual(events[0],{q:row,to:'경남지사',reason:'본사에서 경남지사로 인계',intent:'branch_handoff'});
  assert.deepEqual(events.slice(1),['saved','closed','painted']);

  const failed=[];
  Object.assign(context,{INQ_CTL_MODAL:{mode:'branch_handoff',reassign:false,keys:[inquiryId]},INQ_SEL:{[inquiryId]:true},G:{},inqCtlRecordAssignment:()=>{throw Object.assign(Error('queue'),{code:'QUEUE_FAILED'});},inqCtlError:message=>failed.push(message),saveLocal:()=>failed.push('saved'),closeInquiryControlModal:()=>failed.push('closed'),paint:()=>failed.push('painted')});
  vm.runInNewContext(`${source};inqCtlConfirmBranchHandoff()`,context);
  assert.deepEqual(failed,['저장 요청에 실패했습니다. 다시 시도해 주세요. (QUEUE_FAILED)']);
});
