const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'kpi-source-consistency.test.cjs'),'utf8');
const fixture=new Function('require','__dirname',source.slice(0,source.indexOf('\ntest('))+'\nreturn fixture;')(require,__dirname);
const recipient='33333333-3333-4333-8333-333333333333';
const targets=Array.from({length:203},(_,i)=>({target_type:'deal',target_id:'d'+i,action:'확인'}));
function setup(storage=new Map()){
 const {r}=fixture();r.ME={id:'actor'};r.B.users=[{user_id:recipient,name:'담당0',active:true}];
 r.Phase1={storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 let seq=0;r.crypto={randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`};
 r.CRMRelease={has:()=>true};r.OpsStore.has=()=>true;return {r,storage};
}
function ack(p){return {ok:true,contract_version:2,request_id:p.request_id,group_id:p.group_id,batch_index:p.batch_index,recipient_user_id:p.recipient_user_id,target_count:p.snapshot.targets.length,
 comment:{rep_name:p.rep_name,week_start:p.week_start,status:'open',comment:p.line,updated_at:'2026-10-09T03:00:00Z'},
 actions:p.targets.map((t,i)=>({...t,id:p.request_id+'-'+i,request_id:p.request_id,request_group_id:p.group_id,batch_index:p.batch_index,recipient_user_id:p.recipient_user_id,request_week:p.week_start,promise_key:p.promise_key}))};}
test('reload resumes the original group, exact lost-ACK command and immutable recipient',async()=>{
 const {r,storage}=setup();const job=r.KpiB.coachingGroup('담당0','kpi:3',targets,{year:2026});let first;
 r.OpsStore.rpc=async(n,p)=>{assert.equal(n,'crm_kpi_request_send_v2');first=JSON.parse(JSON.stringify(p));throw Error('lost ACK');};
 await assert.rejects(r.KpiB.coachingSend(job,'original'),/lost ACK/);assert.equal(r.KpiB.weekly().acts.length,0);
 const {r:reload}=setup(storage),resumed=reload.KpiB.coachingGroup('담당0','kpi:3',[...targets,{target_type:'deal',target_id:'new'}],{year:2025});
 assert.equal(resumed.group_id,job.group_id);assert.equal(resumed.snapshot.targets.length,203);assert.equal(resumed.snapshot.source_scope.year,2026);
 reload.OpsStore.rpc=async(n,p)=>{assert.deepEqual(JSON.parse(JSON.stringify(p)),first);return ack(p);};
 await reload.KpiB.coachingSend(resumed,'different retry description');resumed.at++;reload.KpiB.coachingProgress(resumed,false);
 const {r:again}=setup(storage),tail=again.KpiB.coachingGroup('담당0','kpi:3',targets,{});
 assert.equal(tail.at,1);assert.equal(tail.commands[1].targets.length,3);
 again.OpsStore.rpc=async(n,p)=>ack(p);await again.KpiB.coachingSend(tail,'tail');tail.at++;again.KpiB.coachingProgress(tail,true);
 assert.equal(Object.keys(JSON.parse(storage.get('nf_coaching_pending_groups_v1'))).length,0);
});
test('recipient mismatch, missing release gate and changed login cannot publish success',async()=>{
 const {r}=setup(),job=r.KpiB.coachingGroup('담당0','kpi:3',targets,{});
 r.OpsStore.rpc=async(n,p)=>({...ack(p),recipient_user_id:'wrong'});
 await assert.rejects(r.KpiB.coachingSend(job,'x'),/응답 확인/);assert.equal(r.KpiB.weekly().acts.length,0);
 r.CRMRelease.has=()=>false;await assert.rejects(r.KpiB.coachingSend(job,'x'),/담당자 또는 기간 변경/);
 r.CRMRelease.has=()=>true;r.ME.id='another';await assert.rejects(r.KpiB.coachingSend(job,'x'),/담당자 또는 기간 변경/);
 r.ME.id='actor';r.OpsStore.rpc=async(n,p)=>{r.ME.id='changed-during-save';return ack(p);};
 await assert.rejects(r.KpiB.coachingSend(job,'x'),/응답 확인/);assert.equal(r.KpiB.weekly().acts.length,0);
});
test('legacy name-only accounts cannot create new coaching groups; SQL and RPC gate ship together',()=>{
 const {r}=setup();r.B.users=[{id:'name:담당0',name:'담당0'}];assert.equal(r.KpiB.coachingReady('담당0'),false);
 const base=path.join(__dirname,'..'),fn='crm_kpi_request_send_v2';
 for(const file of ['pc-manager-transport.js','pc-error-state.js','kpi-b.js'])assert.ok(fs.readFileSync(path.join(base,file),'utf8').includes(fn));
 assert.ok(fs.readFileSync(path.join(base,'sql/20261009203001_coaching_target_receipts.sql'),'utf8').includes('function public.'+fn+'('));
});
