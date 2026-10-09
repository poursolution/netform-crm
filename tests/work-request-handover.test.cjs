const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=f=>fs.readFileSync(require('node:path').join(__dirname,'..',f),'utf8');
function context(){const r={G:{},ME:{id:'admin',name:'관리자'},esc:String,escAttr:String,repN:String,
 document:{addEventListener(){},getElementById(){return null;}},setTimeout(){},crypto:{randomUUID:()=> 'test-request'},console};r.window=r;vm.createContext(r);return r;}
test('handover recognition preserves old rows but cannot confuse another request with matching label',()=>{
 const r=context();vm.runInContext(read('work-request.js'),r);
 assert.equal(r.WorkRequest.isHandover({kind:'handover',label:'다른 표시'}),true);
 assert.equal(r.WorkRequest.isHandover({kind:'support',label:'재배정 인계'}),true);
 assert.equal(r.WorkRequest.isHandover({kind:'first',label:'재배정 인계'}),false);
 for(const kind of ['handover','support'])assert.equal(r.WorkRequest.evidence({kind,label:'재배정 인계',target_type:'deal',target_id:'x'}),null);
});
test('assignment never changes local owner before ACK; uncertain retry reuses request id',async()=>{
 const r=context(),patch={},calls=[];let resolve,fail=true;
 r.OpsStore={has:()=>true,rpc:(name,p)=>{calls.push(p);return new Promise((yes,no)=>{resolve=()=>fail?no(Error('network')):yes({ok:true,deal_id:'d',assignee:'새담당',owner_id:'new',version:2,activity_id:'activity',server_at:'2026-10-07'});});}};
 r.itemPatch=()=>patch;r.toast=()=>{};r.G.dealOwnerV2={memo:'인계'};
 vm.runInContext(read('deal-owner.js'),r);
 const d={id:'d',assignee:'이전담당',version:1},o={from:'이전담당',to:'새담당',reason:'변경',attr:'keep'};
 const first=r.DealOwner.change(d,o);assert.equal(d.assignee,'이전담당');resolve();await assert.rejects(first,/network/);
 assert.equal(d.assignee,'이전담당');assert.equal(d.version,1);
 fail=false;const second=r.DealOwner.change(d,o);assert.equal(d.assignee,'이전담당');resolve();await second;
 assert.equal(d.assignee,'새담당');assert.equal(d.version,2);assert.equal(calls[0].request_id,calls[1].request_id);
 assert.equal(patch.assignmentHistory.length,1);assert.equal(d.activities.length,1);
});
test('new commands are gated, allowlisted and named without changing markup or styles',()=>{
 for(const name of ['crm_work_request_handover_v1','crm_deal_reassign_handover_v1']){
  assert.ok(read('pc-manager-transport.js').includes("'"+name+"'"));assert.ok(read('pc-error-state.js').includes(name+':'));
 }
 assert.match(read('deal-owner.js'),/CRMRelease\?\.has\(RPC.change\)===false/);
 assert.match(read('deal-owner-v2.js'),/await R.saveAssigneeChange\(\)/);
});

test('reassignment applies ACK task IDs only, preserving drafts, independent owners and completed work',async()=>{
 for(const variant of ['matching','draft','independent','completed','old-server']){
  const r=context(),task={id:'saved-task',assignee:'이전담당',text:'견적 보내기',due:'2026-12-01',status:'open'};
  if(variant==='draft')task.id='local-draft';
  if(variant==='independent')task.assignee='지원담당';
  if(variant==='completed')task.status='completed';
  const before={...task},patch={nextActionObj:{...task}},d={id:'d',assignee:'이전담당',next_action:{...task},nextActionObj:{...task}};
  let resolve;r.OpsStore={has:()=>true,rpc:()=>new Promise(yes=>{resolve=yes})};
  r.itemPatch=()=>patch;r.toast=()=>{};vm.runInContext(read('deal-owner.js'),r);
  const pending=r.DealOwner.change(d,{from:'이전담당',to:'새담당',reason:'변경',attr:'keep'});
  assert.deepEqual(patch.nextActionObj,before,'no optimistic transfer before server ACK');
  const ack={ok:true,deal_id:'d',assignee:'새담당',owner_id:'new',version:2,activity_id:'event',server_at:'2026-10-10'};
  if(variant!=='old-server')ack.transferred_next_actions=[{id:'saved-task',from:'이전담당',to:'새담당'}];
  resolve(ack);await pending;
  const expected={...before,assignee:variant==='matching'?'새담당':before.assignee};
  for(const actual of [patch.nextActionObj,d.next_action,d.nextActionObj])assert.deepEqual(actual,expected);
 }
});
