'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'kpi-source-consistency.test.cjs'),'utf8');
const fixture=new Function('require','__dirname',source.slice(0,source.indexOf('\ntest('))+'\nreturn fixture;')(require,__dirname);
const tick=()=>new Promise(setImmediate);
function setup(){
 const {r}=fixture(),storage=new Map(),messages=[];
 r.REP_INTERNAL=['담당0','담당1'];r.Phase1={storage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 let seq=0;r.crypto={randomUUID:()=>`00000000-0000-4000-8000-${String(++seq).padStart(12,'0')}`};
 r.repManagerLocalComments=()=>JSON.parse(storage.get('netform_crm_rep_manager_comments_v1')||'[]');
 r.OpsStore.has=n=>n==='crm_kpi_request_send_v1';r.toast=(m)=>messages.push(m);
 return {r,storage,messages};
}
const target={kind:'deal',id:'d30',owner:'담당0',name:'Test',label:'등록 요청'};
function ack(p){return {ok:true,request_id:p.request_id,actions:p.targets.map((t,i)=>({...t,id:p.request_id+'-'+i,promise_key:p.promise_key,created_at:'2026-10-09T03:00:00Z'})),comment:{rep_name:p.rep_name,week_start:p.week_start,comment:p.line,status:'open'}};}

test('sent state waits for both writes; repeated click is suppressed while in flight',async()=>{
 const {r,storage,messages}=setup();let resolve,payload,calls=0;
 r.OpsStore.rpc=(n,p)=>{calls++;payload=p;return new Promise(ok=>resolve=ok);};
 const pending=r.KpiB.requestMany('kpi:3','Next',[target]);
 assert.equal(r.KpiB.weekly().acts.length,0);assert.equal(r.KpiB.compute().done.has('kpi:3|deal:d30'),false);
 assert.equal(storage.has('netform_crm_rep_manager_comments_v1'),false);assert.equal(r.KpiB.requestStatus().state,'saving');
 await r.KpiB.requestMany('kpi:3','Next',[target]);assert.equal(calls,1);
 resolve(ack(payload));const result=await pending;assert.equal(result.sent,1);assert.equal(result.failed,0);
 assert.equal(r.KpiB.compute().done.has('kpi:3|deal:d30'),true);assert.equal(r.repManagerLocalComments().length,1);
 assert.match(messages.at(-1),/저장 확인 1건/);await r.KpiB.requestMany('kpi:3','Next',[target]);assert.equal(calls,1,'confirmed target cannot be resent');
});

test('lost ACK retains the command across reload; no local success until replay ACK',async()=>{
 const {r,storage}=setup();let first;
 r.OpsStore.rpc=async(n,p)=>{first=p;throw Error('response lost');};
 const failed=await r.KpiB.requestMany('kpi:3','Next',[target]);assert.equal(failed.failed,1);assert.equal(r.KpiB.weekly().acts.length,0);
 const {r:reload}=setup();reload.Phase1.storage=r.Phase1.storage;
 reload.OpsStore.rpc=async(n,p)=>{assert.equal(p.request_id,first.request_id);assert.equal(JSON.stringify(p),JSON.stringify(first));return ack(p);};
 const retried=await reload.KpiB.requestMany('kpi:3','Next',[target]);assert.equal(retried.sent,1);
 assert.equal(Object.keys(JSON.parse(storage.get('nf_kpi_pending_commands_v1'))).length,0);
});

test('malformed ACK and unavailable server never mark sent; mixed owner failures report only confirmed targets',async()=>{
 const {r}=setup();r.OpsStore.rpc=async(n,p)=>p.rep_name==='담당0'?ack(p):{ok:true};
 const result=await r.KpiB.requestMany('kpi:3','Next',[target,{...target,id:'d31',owner:'담당1'}]);
 assert.equal(result.sent,1);assert.equal(result.failed,1);assert.equal(r.KpiB.compute().done.has('kpi:3|deal:d31'),false);
 r.CRMRelease={has:()=>false};await assert.rejects(r.KpiB.requestLine('담당1','x','kpi:3',[]),/연결 확인/);
});

test('weekly automatic marker is written only after validated ACK and a failure does not loop on repaint',async()=>{
 const {r,storage}=setup();r.Date=class extends r.Date{getDay(){return 5;}getHours(){return 19;}};
 r.OpsStore.admin=()=>true;r.OpsStore.has=n=>n==='crm_kpi_weekly_save_v1';
 r.KpiB.weekly().state='ready';let resolve,calls=0,payload;
 r.OpsStore.rpc=(n,p)=>{calls++;payload=p;return new Promise(ok=>resolve=ok);};
 const pending=r.KpiB.autoSave();assert.equal(storage.has('nf_kpi_autosave'),false);
 r.KpiB.autoSave();assert.equal(calls,1);resolve({ok:false});await pending;assert.equal(storage.has('nf_kpi_autosave'),false);
 r.KpiB.weekly().actState='ready';r.KpiB.autoSave();assert.equal(calls,1,'no unbounded auto retry');
 r.KpiB.weekly().autoAttempt=null;const retry=r.KpiB.autoSave();resolve({ok:true,week_start:payload.week_start,saved:payload.rows.length});await retry;
 assert.equal(storage.get('nf_kpi_autosave'),'2026-10-05');
});

test('new RPCs have install SQL, transport, error names and explicit release gates',()=>{
 const base=path.join(__dirname,'..'),sql=fs.readFileSync(path.join(base,'sql/20261009171018_kpi_request_history_and_ack.sql'),'utf8');
 for(const fn of ['crm_kpi_action_list_v2','crm_kpi_request_send_v1']){
  assert.ok(sql.includes('function public.'+fn+'('));
  for(const file of ['pc-manager-transport.js','pc-error-state.js'])assert.ok(fs.readFileSync(path.join(base,file),'utf8').includes(fn));
 }
 assert.equal((fs.readFileSync(path.join(base,'kpi-b.js'),'utf8').match(/CRMRelease\?\.has\(fn\)===false/g)||[]).length,2);
});
