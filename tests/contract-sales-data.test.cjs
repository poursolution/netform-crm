const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const L=require('../contract-sales-ledger.js');
test('production PC transport admits contract RPCs while rejecting tables and unrelated destinations',async()=>{
 const url='https://ymfbmpnizxvqsamnczow.supabase.co',calls=[];
 const storage={length:0,getItem(){return null},setItem(){},removeItem(){},key(){return null}};
 const root={PHASE1_CONFIG:{project_ref:'ymfbmpnizxvqsamnczow',url,publishable_key:'synthetic'},localStorage:storage,sessionStorage:storage,fetch:async(u)=>{calls.push(u);return {ok:true}},XMLHttpRequest:class{open(){}},addEventListener(){},dispatchEvent(){}};
 root.supabase={createClient:()=>({channel(){},auth:{onAuthStateChange(){}},rpc:name=>root.fetch(url+'/rest/v1/rpc/'+name)})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../pc-manager-transport.js'),'utf8'),{window:root,URL,location:{origin:'http://localhost',hostname:'localhost',href:'http://localhost/'},navigator:{},setTimeout,clearTimeout,AbortController});
 const client=root.Phase1.createClient(url,'synthetic');
 await client.rpc('crm_contract_sales_read_v1',{});await client.rpc('crm_contract_sales_write_v1',{});
 assert.equal(calls.length,2);
 assert.throws(()=>client.rpc('arbitrary_admin_rpc',{}),/PHASE1_RPC_DENIED/);
 assert.throws(()=>client.from('contract_sales'),/PHASE1_DIRECT_TABLE_DENIED/);
 await assert.rejects(root.fetch(url+'/rest/v1/contract_sales'),/PHASE1_TRANSPORT_DENIED/);
 await assert.rejects(root.fetch('https://example.com/rest/v1/rpc/crm_contract_sales_read_v1'),/PHASE1_TRANSPORT_DENIED/);
 assert.equal(calls.length,2);
});
const event=L.initial({event_id:'event-a',deal_id:'deal-a',contract_signed:true,contract_date:'2026-09-18',contract_amount:300000000,sales_owner:'owner-a',sales_owner_name:'황윤선'});
const item={deal_id:'deal-a',sales_owner:'owner-a',sales_owner_name:'황윤선',brand:'시험',version:1,balance:300000000,events:[event]};
function fixture(rpc){const root={ME:{id:'actor-a'},TOKEN:'synthetic',SB:{rpc},ContractSalesLedger:L,addEventListener(){},dispatchEvent(){}};vm.runInNewContext(fs.readFileSync(require.resolve('../contract-sales-data.js'),'utf8'),{window:root,CustomEvent:class{}});return root}
test('data adapter uses frozen owner and common period aggregation',async()=>{
 const root=fixture(async()=>({data:{ok:true,policy:L.POLICY,items:[item],has_more:false}}));await root.ContractSalesData.refresh();
 assert.equal(root.ContractSalesData.summarize({year:2026,month:9,owner:'황윤선'}).netAmount,300000000);
 assert.equal(root.ContractSalesData.summarize({owner:'정정훈'}).netAmount,0);
});
test('RPC error and incomplete pagination never become zero or partial totals',async()=>{
 let calls=0;const root=fixture(async()=>++calls===1?{data:{ok:true,policy:L.POLICY,items:[item],has_more:true,next_cursor:'deal-a'}}:{error:{message:'offline'}});
 await root.ContractSalesData.refresh();assert.equal(root.ContractSalesData.state().status,'unavailable');assert.equal(root.ContractSalesData.summarize({}),null);
});
test('identity switch discards in-flight response and clears previous contract data',async()=>{
 let finish;const root=fixture(()=>new Promise(r=>finish=r));const work=root.ContractSalesData.refresh();root.ME={id:'actor-b'};root.ContractSalesData.state();finish({data:{ok:true,policy:L.POLICY,items:[item],has_more:false}});await work;
 assert.equal(root.ContractSalesData.summarize({}),null);assert.equal(root.ContractSalesData.state().items.length,0);
});
test('read version and balance mismatches fail closed',async()=>{
 const root=fixture(async()=>({data:{ok:true,policy:L.POLICY,items:[{...item,balance:1}],has_more:false}}));await root.ContractSalesData.refresh();assert.equal(root.ContractSalesData.summarize({}),null);
});

test('unchanged background reads do not reset the current screen',async()=>{
 const root=fixture(async()=>({data:{ok:true,policy:L.POLICY,items:[item],has_more:false}}));
 let notifications=0;root.dispatchEvent=()=>notifications++;
 await root.ContractSalesData.refresh();assert.equal(notifications,1);
 for(let i=0;i<5;i++)await root.ContractSalesData.refresh();
 assert.equal(notifications,1);
 root.SB.rpc=async()=>({error:{message:'offline'}});
 await root.ContractSalesData.refresh();assert.equal(notifications,2);
 await root.ContractSalesData.refresh();assert.equal(notifications,2);
});
