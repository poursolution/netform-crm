'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'kpi-source-consistency.test.cjs'),'utf8');
const fixture=new Function('require','__dirname',source.slice(0,source.indexOf('\ntest('))+'\nreturn fixture;')(require,__dirname);
const tick=()=>new Promise(setImmediate);
function setup(){const {r,calls}=fixture();r.KpiB.weekly().actState='idle';r.toast=()=>{};return {r,calls};}
const action={promise_key:'kpi:3',target_type:'deal',target_id:'d26',created_at:'2026-10-08T03:00:00Z'};

test('delayed history cannot authorize requests, score zero, or persist a weekly snapshot',async()=>{
 const {r}=setup();let resolve;const writes=[];
 r.OpsStore.has=n=>['crm_kpi_action_list_v2','crm_kpi_weekly_save_v1'].includes(n);
 r.OpsStore.rpc=(n,p)=>{if(n==='crm_kpi_action_list_v2')return new Promise(ok=>{resolve=ok;});writes.push({n,p});return Promise.resolve({});};
 r.KpiB.load();const C=r.KpiB.compute(),rows=r.KpiV7.coreRows(C,[],false);
 assert.equal(r.KpiB.requestStatus().state,'loading');assert.equal(C.M[7].v,null);assert.equal(C.M[7].ready,false);
 assert.equal(rows.find(x=>x.i===2).dis,true);assert.match(rows.find(x=>x.i===2).reqSum,/계산 중/);
 await assert.rejects(r.KpiB.requestLine('담당0','test','kpi:3',[]),/연결 확인/);r.KpiB.saveWeek(null);assert.equal(writes.length,0);
 resolve({ok:true,contract_version:2,actions:[],has_more:false,next_cursor:null});await tick();assert.equal(r.KpiB.canRequest(),true);
 assert.equal(r.KpiB.compute().M[7].ready,true);
});

test('all history pages load before ready, including rows outside KPI filters',async()=>{
 const {r}=setup();let resolve;const calls=[];r.OpsStore.has=n=>n==='crm_kpi_action_list_v2';
 r.OpsStore.rpc=async(n,p)=>{calls.push(p);return calls.length===1?{ok:true,contract_version:2,actions:Array.from({length:200},(_,i)=>({promise_key:'unrelated',id:'a'+i})),has_more:true,next_cursor:{after_id:'a199'}}:new Promise(ok=>resolve=ok);};
 r.KpiB.load();await tick();assert.equal(r.KpiB.requestStatus().state,'loading');assert.equal(r.KpiB.canRequest(),false);
 resolve({ok:true,contract_version:2,actions:[{...action,id:'last'}],has_more:false,next_cursor:null});await tick();
 assert.equal(calls.length,2);assert.equal(r.KpiB.requestStatus().state,'ready');assert.equal(r.KpiB.weekly().acts.length,1);
});

test('a repeated cursor, duplicate row, and missing release capability cannot authorize requests',async()=>{
 for(const duplicate of [true,false]){const {r}=setup();let n=0;r.OpsStore.has=()=>true;r.OpsStore.rpc=async()=>({ok:true,contract_version:2,actions:[{id:duplicate?'same':'id'+n++,promise_key:'other'}],has_more:true,next_cursor:{after_id:'same'}});r.KpiB.load();await tick();assert.equal(r.KpiB.canRequest(),false);assert.equal(r.KpiB.requestStatus().state,'failed');}
 const {r}=setup();r.OpsStore.has=()=>true;r.CRMRelease={has:()=>false};r.KpiB.load();assert.equal(r.KpiB.requestStatus().state,'off');
});

test('failed/malformed refresh does not authorize with stale data; explicit retry can recover',async()=>{
 const {r}=setup();r.KpiB.weekly().acts=[action];r.OpsStore.has=n=>n==='crm_kpi_action_list_v2';
 r.OpsStore.rpc=async()=>{throw Error('offline');};r.KpiB.load();await tick();
 assert.equal(r.KpiB.requestStatus().state,'failed');assert.equal(r.KpiB.canRequest(),false);
 r.OpsStore.rpc=async()=>({});r.KpiB.load(true);await tick();assert.equal(r.KpiB.requestStatus().state,'failed');
 r.OpsStore.rpc=async()=>({ok:true,contract_version:2,actions:[],has_more:false,next_cursor:null});r.KpiB.load(true);await tick();assert.equal(r.KpiB.canRequest(),true);
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
 assert.match(v,/function send\(pkey,title,list(?:,all)?\)\{\s*if\(K\(\)\.canRequest/);/* after_deploy 16: 묶음 미리보기용 넷째 인자(all)가 붙어도 첫 줄은 요청 가능 여부 확인 */
 assert.match(k,/function request\(b\)\{\s*if\(!canRequest\(\)\)/);
 assert.match(k,/if\(a==='nm'\)\{if\(!canRequest\(\)\)return/);
});
