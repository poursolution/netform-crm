'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'kpi-source-consistency.test.cjs'),'utf8');
const fixture=new Function('require','__dirname',source.slice(0,source.indexOf('\ntest('))+'\nreturn fixture;')(require,__dirname);
const tick=()=>new Promise(setImmediate);
function setup(){const {r,calls}=fixture();r.KpiB.weekly().actState='idle';r.toast=()=>{};return {r,calls};}
const action={promise_key:'kpi:3',target_type:'deal',target_id:'d26',created_at:'2026-10-08T03:00:00Z'};

test('delayed history cannot authorize requests, score zero, or persist a weekly snapshot',async()=>{
 const {r}=setup();let resolve;const writes=[];
 r.OpsStore.has=n=>['crm_kpi_action_list_v1','crm_kpi_weekly_save_v1'].includes(n);
 r.OpsStore.rpc=(n,p)=>{if(n==='crm_kpi_action_list_v1')return new Promise(ok=>{resolve=ok;});writes.push({n,p});return Promise.resolve({});};
 r.KpiB.load();const C=r.KpiB.compute(),rows=r.KpiV7.coreRows(C,[],false);
 assert.equal(r.KpiB.requestStatus().state,'loading');assert.equal(C.M[7].v,null);assert.equal(C.M[7].ready,false);
 assert.equal(rows.find(x=>x.i===2).dis,true);assert.match(rows.find(x=>x.i===2).reqSum,/계산 중/);
 assert.equal(r.KpiB.requestLine('담당0','test'),false);r.KpiB.saveWeek(null);assert.equal(writes.length,0);
 resolve({actions:[]});await tick();assert.equal(r.KpiB.canRequest(),true);
 assert.equal(r.KpiB.compute().M[7].ready,true);
});

test('server cap is checked before filtering unrelated events; partial history stays blocked',async()=>{
 const {r}=setup();r.OpsStore.has=n=>n==='crm_kpi_action_list_v1';
 r.OpsStore.rpc=async()=>({actions:Array.from({length:200},(_,i)=>({promise_key:'unrelated',id:i}))});
 r.KpiB.load();await tick();assert.equal(r.KpiB.weekly().acts.length,0);
 assert.equal(r.KpiB.requestStatus().state,'partial');assert.equal(r.KpiB.canRequest(),false);
 assert.equal(r.KpiB.compute().M[7].v,null);
});

test('failed/malformed refresh does not authorize with stale data; explicit retry can recover',async()=>{
 const {r}=setup();r.KpiB.weekly().acts=[action];r.OpsStore.has=n=>n==='crm_kpi_action_list_v1';
 r.OpsStore.rpc=async()=>{throw Error('offline');};r.KpiB.load();await tick();
 assert.equal(r.KpiB.requestStatus().state,'failed');assert.equal(r.KpiB.canRequest(),false);
 r.OpsStore.rpc=async()=>({});r.KpiB.load(true);await tick();assert.equal(r.KpiB.requestStatus().state,'failed');
 r.OpsStore.rpc=async()=>({actions:[]});r.KpiB.load(true);await tick();assert.equal(r.KpiB.canRequest(),true);
});

test('owner filter cannot convert missing legacy target into processed, and unknown is not snapshotted',async()=>{
 const {r,calls}=fixture();r.KpiB.weekly().acts=[action];
 let metric=r.KpiB.compute().M[7];assert.equal(metric.num,0);assert.equal(metric.v,0);
 r.G.rep='담당0';metric=r.KpiB.compute().M[7];assert.equal(metric.num,0);assert.equal(metric.unverified,1);assert.equal(metric.v,null);
 const row=r.KpiV7.coreRows(r.KpiB.compute(),[],false).find(x=>x.i===7);
 assert.equal(row.frac,'아직 못 잼');assert.match(row.reason,/완료 근거 미확인 1건/);
 r.KpiB.saveWeek(null);await tick();const saved=calls.find(x=>x.n==='crm_kpi_weekly_save_v1');
 assert.ok(saved);assert.ok(!saved.p.rows.some(x=>x.promise_key==='kpi:8'));
 assert.ok(saved.p.rows.some(x=>x.promise_key==='kpi:3'));
});

test('actual request-engine completion remains countable; loading request engine is not empty',()=>{
 const {r}=fixture();let loaded=false;r.OpsStore.has=n=>n==='request-list';
 const state={loaded:false,busy:true,list:[]};
 r.WorkRequest={RPC:{list:'request-list'},state:()=>state,enabled:()=>loaded};
 assert.equal(r.KpiB.compute().M[7].v,null);
 loaded=true;Object.assign(state,{loaded:true,busy:false,list:[{status:'done',created_at:'2026-10-08'}]});
 const m=r.KpiB.compute().M[7];assert.equal(m.num,1);assert.equal(m.den,1);assert.equal(m.v,100);
 state.busy=true;assert.equal(r.KpiB.compute().M[7].v,100,'loaded snapshot remains usable during refresh; provider repaints before busy clears');
});

test('v7 core and stage requests share execution guard; fallback requests and bulk entry are guarded',()=>{
 const k=fs.readFileSync(path.join(__dirname,'../kpi-b.js'),'utf8'),v=fs.readFileSync(path.join(__dirname,'../kpi-v7.js'),'utf8');
 assert.match(v,/function send\(pkey,title,list\)\{\s*if\(K\(\)\.canRequest/);
 assert.match(k,/function request\(b\)\{\s*if\(!canRequest\(\)\)/);
 assert.match(k,/if\(a==='nm'\)\{if\(!canRequest\(\)\)return/);
});
