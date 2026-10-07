const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const d='11111111-1111-4111-8111-111111111111',e='22222222-2222-4222-8222-222222222222';
const input={deal_id:d,source_event_id:e,expected_version:2,target_balance:300,effective_date:'2020-10-02',reason:'확인된 계약 정정'};
function env(rpc){const handlers={},taken=[],root={ME:{id:'a'},CRMRelease:{has:()=>true},OpsStore:{has:()=>true,rpc},ApprovalInbox:{take:x=>taken.push(x)},addEventListener:(n,f)=>handlers[n]=f};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../contract-correction.js'),'utf8'),{window:root,crypto:require('node:crypto').webcrypto});return {root,C:root.ContractCorrection,handlers,taken};}
const ack=(n,p)=>({ok:true,operation:n,request_id:p.request_id,request:{id:1,type:'contract_amount',deal_id:p.deal_id,status:'pending',payload:p}});
test('correction submission requires explicit facts, keeps the same retry ID and never changes a ledger locally',async()=>{
 const calls=[];let fail=true;const {C,root,taken}=env(async(n,p)=>{calls.push(p);if(fail)throw Error('lost reply');return ack(n,p);});
 for(const invalid of [{effective_date:undefined},{effective_date:'2020-02-31'},{target_balance:0},{target_balance:1.5},{source_event_id:undefined},{reason:''}])await assert.rejects(C.request({...input,...invalid}),/확인해/);
 assert.equal(calls.length,0);await assert.rejects(C.request(input),/lost reply/);assert.equal(taken.length,0);
 fail=false;await C.request(input);await C.request(input);assert.equal(new Set(calls.map(x=>x.request_id)).size,1);assert.equal(taken.length,2);
 root.CRMRelease.has=()=>false;await assert.rejects(C.request(input),/준비되지/);assert.equal(calls.length,3);
});
test('mismatched ACK and old account responses cannot enter the approval cache',async()=>{
 let done;const {C,root,handlers,taken}=env(()=>new Promise(r=>done=r));const p=C.request(input);
 root.ME={id:'b'};handlers['phase1:identity-cleared']();done({ok:true});await assert.rejects(p,/계정이 변경/);assert.equal(taken.length,0);
 root.OpsStore.rpc=async(n,p)=>({...ack(n,p),request_id:crypto.randomUUID()});await assert.rejects(C.request(input),/저장 결과/);assert.equal(taken.length,0);
});
test('preview is selected-deal only and rejects unverified server context',async()=>{
 const calls=[];const {C,root}=env(async(n,p)=>{calls.push(p);return {ok:true,deal_id:d,source_event_id:e,expected_version:2,balance:350,cancelled:false,last_effective_date:'2020-10-01',contract_date:'2020-09-01',contract_amount:300,sales_owner:d,previous_balance:300};});
 assert.equal((await C.preview(d)).balance,350);assert.equal(calls.length,1);assert.deepEqual(Object.keys(calls[0]),['deal_id']);
 root.OpsStore.rpc=async()=>({ok:true});await assert.rejects(C.preview(d),/조회 결과/);
});
