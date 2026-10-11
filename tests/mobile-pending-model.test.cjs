'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),create=require('../mobile-pending-model.js');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',auth='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',user='cccccccc-cccc-4ccc-8ccc-cccccccccccc',rid='dddddddd-dddd-4ddd-8ddd-dddddddddddd',log='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',sid='ffffffff-ffff-4fff-8fff-ffffffffffff';
function fixture(){
 const owner=auth+':'+user,records=new Map(),root={ADMIN:{inquiries:[{key:id,nm:'합성 문의'}]},Phase1:{profile:{auth_uid:auth,user_id:user},queue:{list:()=>[]}},sessionStorage:{get length(){return records.size;},key:i=>[...records.keys()][i]},MobileSaveJournal:{owner:()=>owner,session:()=>1,read:(kind,target)=>records.get('crm:mobile-save:v1:'+owner+':'+kind+':'+target)}};
 const value={surface:'mobile-d',input:{result:'부재'},progress:{contactSent:true,contact:{inquiry_id:id,request_id:rid,occurred_at:'2026-10-11T01:00:00Z'},needsResponse:false,plan:{mode:'none'}}};
 records.set('crm:mobile-save:v1:'+owner+':pc_inquiry:'+id,value);
 return {root,value,records,read:create(root).read};
}
test('제출된 문의는 I4에 한 건으로 나타나며 조회로 전송하지 않는다',()=>{
 const f=fixture(),before=JSON.stringify([...f.records]),s=f.read();assert.equal(s.ok,true);assert.equal(s.count,1);assert.equal(s.groups[0].target_type,'inquiry');assert.equal(s.groups[0].resume.allowed,true);assert.equal(s.groups[0].result,'부재');assert.equal(JSON.stringify([...f.records]),before);
});
test('문의 부분저장은 저장된 응대와 남은 일정·현재값 반영을 구분한다',()=>{
 const f=fixture(),p=f.value.progress;p.logAck={inquiry_id:id,request_id:rid,log_id:log};p.inquirySchedule={request_id:sid,checked:true,input:null,current:{items:[]}};
 const s=f.read();assert.equal(s.count,1);assert.equal(s.groups[0].state,'partial');assert.deepEqual(s.groups[0].parts.map(x=>[x.kind,x.state]),[['activity','done'],['schedule','done'],['refresh','pending']]);
});
test('미제출 초안과 다른 PC 입력의 보관은 모바일 응대 대기 수에 섞지 않는다',()=>{
 const f=fixture();f.value.progress.contactSent=false;assert.equal(f.read().count,0);f.value.progress.contactSent=true;f.value.surface='detail';assert.equal(f.read().count,0);
});
test('다른 문의의 응대 영수증·현재 계정과 다른 응대확정은 0건으로 숨기지 않는다',()=>{
 const f=fixture(),p=f.value.progress;p.logAck={inquiry_id:user,request_id:rid,log_id:log};let s=f.read();assert.equal(s.ok,false);assert.equal(s.count,null);
 p.logAck.inquiry_id=id;p.needsResponse=true;p.responsePrepared={command:{inquiry_id:id,request_id:sid}};p.responseAck={ok:true,contract:'crm.inquiry-response.v1',inquiry_id:id,request_id:sid,contact_log_id:log,actor_auth_uid:user,actor_user_id:user,status:'전화응대 완료',completed_action_ids:[],cancelled_action_ids:[]};
 s=f.read();assert.equal(s.ok,false);assert.equal(s.count,null);
});
test('현재 목록에 없는 문의와 바뀐 계정은 재시도 진입을 허용하지 않는다',()=>{
 const f=fixture();f.root.ADMIN.inquiries=[];assert.equal(f.read().groups[0].resume.allowed,false);f.root.Phase1.profile.user_id=auth;assert.equal(f.read().ok,false);
});
