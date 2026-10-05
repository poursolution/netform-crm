const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(dir,'inquiry-assignment-clarity.js'),'utf8');
const command=source.slice(source.indexOf(' /* Assignment changes'),source.indexOf(' function receivedAt'));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function runtime(){
 const q={id:'inquiry-1',assigned_to:'old-id',assignee_name:'이필선',assignee:'이필선',status:'배정완료'},patch={draft:'응대 작성 중'},rows=[];
 const c={Map,Promise,Error,root:null,B:{inquiries:[q]},INQ_SEL:{'inquiry-1':true},inqKey:q=>q.id,isTechnicalInquiry:()=>false,detailPatchFor:()=>patch,inquiryRoutedOwner:q=>q.assignee_name,saveLocal:()=>{},mergeInquiryAssignmentTruth:(q)=>{q._assignmentServerTruth={seen:true,id:q.assigned_to,name:q.assignee_name}},OperationalUI:{shell:({inquiries})=>({inquiries:inquiries.map(x=>({...x,assignee:x.assignee_name}))})}};
 c.root=c;c.Phase1={profile:{auth_uid:'actor-1'},queue:{list:()=>rows,flush:async()=>{rows.at(-1).status='done';rows.at(-1).ack={assigned_to:'new-id'}}},read:async()=>({data:{item:{...q,assigned_to:'new-id',assignee_name:'조민준',assignment_history:[{id:'history-1',from_owner:'이필선',to_owner:'조민준'}]}}})};
 c.pushWrite=(operation,payload)=>{const request_id='request-'+(rows.length+1);rows.push({request_id,operation,object_id:payload.inquiry_id,payload:{...payload,to_name:payload.to},status:'pending'});return request_id};
 vm.createContext(c);vm.runInContext(command,c);c.inqCtlRecordAssignment=c.inquiryCommitAssignment;return {c,q,patch,rows};
}
test('owner and history remain unchanged until ACK and canonical read',async()=>{
 const {c,q,patch,rows}=runtime(),ack=deferred(),read=deferred();c.Phase1.queue.flush=()=>ack.promise;c.Phase1.read=()=>read.promise;
 const job=c.inquiryCommitAssignment(q,'조민준','사용자 요청','branch_owner_assign');
 assert.equal(q.assignee,'이필선');assert.equal(q.assignmentHistory,undefined);
 rows[0].status='done';rows[0].ack={assigned_to:'new-id'};ack.resolve();await Promise.resolve();assert.equal(q.assignee,'이필선');
 read.resolve({data:{item:{id:q.id,assigned_to:'new-id',assignee_name:'조민준',status:'배정완료',assignment_history:[{id:'h1'}]}}});await job;
 assert.equal(q.assignee,'조민준');assert.equal(q.assigned_to,'new-id');assert.equal(q._assignmentServerTruth.name,'조민준');assert.equal(q.assignmentHistory[0].id,'h1');assert.equal(patch.draft,'응대 작성 중');
});
test('rejection does not change assignment or history',async()=>{const {c,q,rows}=runtime();c.Phase1.queue.flush=async()=>{rows[0].status='rejected';rows[0].error='branch owner target denied';throw Error('rejected')};await assert.rejects(c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign'),/저장되지/);assert.equal(q.assignee,'이필선');assert.equal(q.assignmentHistory,undefined)});
test('uncertain delivery reuses request instead of duplicating assignment',async()=>{const {c,q,rows}=runtime();c.Phase1.queue.flush=async()=>{rows[0].status='uncertain';throw Error('network')};await assert.rejects(c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign'),/확인 중/);c.Phase1.queue.flush=async()=>{rows[0].status='done';rows[0].ack={assigned_to:'new-id'}};await c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign');assert.equal(rows.length,1);assert.equal(q.assignee,'조민준')});
test('read failure after success retries only read',async()=>{const {c,q,rows}=runtime(),read=c.Phase1.read;c.Phase1.read=async()=>{throw Error('network')};await assert.rejects(c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign'),/저장됐지만/);c.Phase1.read=read;await c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign');assert.equal(rows.length,1)});
test('double click and identity changes cannot create false success',async()=>{const {c,q,rows}=runtime(),ack=deferred();c.Phase1.queue.flush=()=>ack.promise;const job=c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign');await assert.rejects(c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign'),/저장 중/);c.Phase1.profile={auth_uid:'other'};ack.resolve();await assert.rejects(job,/사용자가 변경/);assert.equal(q.assignee,'이필선');assert.equal(rows.length,1)});
test('batch preserves confirmed count and unprocessed selection on failure',async()=>{const {c,q}=runtime();const q2={id:'q2'},q3={id:'q3'};c.INQ_SEL={ [q.id]:true,q2:true,q3:true };let calls=0;c.inqCtlRecordAssignment=async()=>{if(++calls===2)throw Error('rejected')};await assert.rejects(c.inquiryAssignmentBatch([q,q2,q3],'조민준','x','branch_owner_assign'),/1건 저장 확인 · 2건 미완료/);assert.equal(calls,2);assert.deepEqual(Object.keys(c.INQ_SEL),['q2','q3'])});
test('concurrent server change is displayed and not claimed as requested success',async()=>{const {c,q}=runtime();c.Phase1.read=async()=>({data:{item:{id:q.id,assigned_to:'third-id',assignee_name:'김훈'}}});await assert.rejects(c.inquiryCommitAssignment(q,'조민준','x','branch_owner_assign'),/다른 담당자/);assert.equal(q.assignee,'김훈')});
