const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../dashboard-data.js'),'utf8');
function setup(rpc){
 const events={};const own={deals:[{id:'own'}],inquiries:[]};
 const w={B:own,G:{page:'dash'},Phase1:{profile:{auth_uid:'a',user_id:'b'},rpc},CRM_RPC_ALLOW:['crm_dashboard_source_v1','crm_dashboard_contracts_v1'],CRMRelease:{has:()=>true},
 ContractSalesLedger:require('../contract-sales-ledger.js'),OperationalUI:{shell:v=>v},CustomEvent:class{constructor(t,p){this.type=t;this.detail=p.detail;}},
 addEventListener:(n,f)=>events[n]=f,dispatchEvent(){},paint(){}};
 w.window=w;vm.runInNewContext(source,w);return {w,own,events,x:w.DashboardData};
}
const response=(n,p)=>n==='crm_dashboard_contracts_v1'?{ok:true,policy:'contract-signed-event-v1',items:[],has_more:false}:
 {scope_completeness:'dashboard_all_read_only',domain:p.p_domain,items:[{id:p.p_domain}],pagination:{has_more:false}};
test('complete company data stays separate from operational bundle and cache never spans accounts',async()=>{
 let calls=0;const {w,own,x,events}=setup(async(n,p)=>{calls++;return response(n,p);});
 assert.equal(await x.load(),true);assert.equal(calls,3);assert.equal(w.B,own);assert.equal(w.B.deals[0].id,'own');
 assert.equal(x.source().deals[0].id,'deal_core');assert.equal(x.contractState().status,'ready');
 w.G.page='inq';assert.equal(x.active(),false);assert.equal(await x.load(),false);assert.equal(calls,3);
 w.G.page='dash';events['phase1:identity-cleared']();w.Phase1.profile=null;assert.equal(x.source().deals.length,0);
});
test('partial read failure is unavailable, never a partial company total',async()=>{
 const {x}=setup(async(n,p)=>{if(p.p_domain==='inquiry_core')throw Error('network');return response(n,p);});
 assert.equal(await x.load(),false);assert.equal(x.contractState().status,'unavailable');assert.equal(x.source().deals.length,0);
});
test('identity change during read prevents committing old company rows',async()=>{
 const done=[];const {x,w,events}=setup(()=>new Promise(r=>done.push(r)));
 const p=x.load();w.Phase1.profile={auth_uid:'other'};events['phase1:profile']();
 done[0](response('crm_dashboard_source_v1',{p_domain:'deal_core'}));done[1](response('crm_dashboard_source_v1',{p_domain:'inquiry_core'}));done[2](response('crm_dashboard_contracts_v1',{}));
 assert.equal(await p,false);w.G.page='inq';assert.equal(x.source().deals.length,0);
});
test('CRMRelease gate prevents all company reads while the server is missing',async()=>{
 let calls=0;const {x,w}=setup(async()=>calls++);w.CRMRelease.has=()=>false;
 assert.equal(await x.load(),false);assert.equal(calls,0);assert.equal(x.contractState().status,'unavailable');
});
test('company ledger retains attribution and rejects a mismatched event deal',async()=>{
 const L=require('../contract-sales-ledger.js'),event=L.initial({deal_id:'foreign',event_id:'sign-foreign',contract_signed:true,contract_date:'2026-10-07',contract_amount:300,sales_owner:'other',sales_owner_name:'Other'});
 const row={deal_id:'foreign',sales_owner:'other',version:1,balance:300,events:[event]};
 const {x}=setup(async(n,p)=>n==='crm_dashboard_contracts_v1'?{ok:true,policy:L.POLICY,items:[row],has_more:false}:response(n,p));
 assert.equal(await x.load(),true);assert.equal(x.contractState().items[0].sales_owner,'other');
 row.deal_id='different';assert.equal(await x.load(true),false);assert.equal(x.contractState().status,'unavailable');
});
