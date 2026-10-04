const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
function fixture(){
 const L=require('../contract-sales-ledger.js'),handlers={};
 const signed=(id,amount,owner='original')=>L.initial({contract_signed:true,contract_date:'2026-09-18',contract_amount:amount,sales_owner:owner,sales_owner_name:owner,deal_id:id,event_id:id+'-signed'});
 let events=[signed('partner',1e9)];events=L.append(events,{expected_version:1,kind:'amended',effective_date:'2026-10-01',amount_delta:2e8,event_id:'p-amended',reason:'signed increase'});events=L.append(events,{expected_version:2,kind:'cancelled',effective_date:'2026-11-01',event_id:'p-cancelled',reason:'cancelled'});
 const items=[{deal_id:'partner',brand:'A',sales_owner_name:'original',contract_date:'2026-09-18',balance:0,cancelled:true,events},{deal_id:'direct',brand:'A',sales_owner_name:'original',events:[signed('direct',5e8)]}];
 const R={G:{brand:'전체'},ME:{id:'a'},B:{deals:[{id:'partner',site:'synthetic',assignee:'new owner',brand:'A'}]},ContractSalesLedger:L,
  OpsStore:{has:()=>true},CRMRules:{},repN:x=>x,PERFORMANCE_TARGET_NAMES:['original'],TOKEN:true,
  esc:String,escAttr:String,paint(){},paintBrief(){},phase1RpcAvailable:()=>false,
  SalesScope:{state:()=>({type:'all',organization:'all',assignment:'all'})},repProfile:()=>({}),
  addEventListener:(k,f)=>{handlers[k]=f},dispatchEvent(){}};
 const document={addEventListener(){},getElementById(){return null},querySelector(){return null}};
 const ctx=vm.createContext({window:R,document,console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},MutationObserver:class{observe(){}},CustomEvent:class{}});
 for(const f of ['contract-sales-data.js','sales-insights.js','deal-win.js','brief-b.js'])vm.runInContext(code(f),ctx,{filename:f});
 // Adapter entries applies actual scope; feed via the same authenticated read path.
 R.SB={rpc:async()=>({data:{ok:true,policy:L.POLICY,items:items.map(r=>({...r,version:r.events.length,balance:L.validate(r.events).balance,sales_owner:r.events[0].sales_owner})),has_more:false}})};
 return {R,items,handlers};
}
test('partner breakdown uses contract dates, frozen owner and signed deltas; repeated advisory links count once',async()=>{
 const {R}=fixture();await R.ContractSalesData.refresh();
 R.DealWin._take({rows:[{deal_id:'partner',win_status:'confirmed',won_type:'partner_tech',award_amount:9e9,award_date:'2026-08-01',performance_owner:'new owner',tech_advisory:true,tech_advisory_amount:1e8,pour_contract_amount:5e7}],advisory:[{decision:'confirmed',source_deal_id:'partner',bid_amount:8e9},{decision:'confirmed',source_deal_id:'partner',bid_amount:7e9}]});
 const sept=R.DealWin.partnerIn('2026-09-01','2026-10-01','original');
 assert.equal(sept.amount,1e9);assert.equal(sept.count,1);assert.equal(sept.list.length,1);
 assert.equal(R.DealWin.partnerIn('2026-08-01','2026-09-01').amount,0);
 assert.equal(R.DealWin.partnerIn('2026-09-01','2026-10-01','new owner').amount,0);
 assert.equal(R.DealWin.partnerIn('2026-10-01','2026-11-01').amount,2e8);
 assert.equal(R.DealWin.partnerIn('2026-11-01','2026-12-01').amount,-1.2e9);
 assert.equal(R.DealWin.partnerIn('2026-10-01','2026-12-01').count,0);
 const lib=R.BriefB.lib,all=lib.ledger(),direct=lib.contractsIn(all,'2026-09-01','2026-10-01',null,'direct');
 assert.equal(direct.net,5e8);assert.equal(direct.net+sept.amount,R.ContractSalesData.summarize({year:2026,month:9}).netAmount);
 assert.equal(lib.contractsIn(all,'2026-09-01','2026-10-01').net,1.5e9,'unpartitioned trends keep all signed contracts');
});
test('unposted awards and missing ledger never fabricate revenue',async()=>{
 const {R}=fixture();R.DealWin._take({rows:[{deal_id:'missing',won_type:'partner_tech',win_status:'confirmed',award_amount:2e9,award_date:'2026-09-01'}]});
 assert.equal(R.DealWin.partnerIn('2026-09-01','2026-10-01').ready,false);
 await R.ContractSalesData.refresh();assert.equal(R.DealWin.partnerIn('2026-09-01','2026-10-01').amount,0);
 assert.equal(R.SalesInsights.advMatch({decision:'confirmed',bid_amount:2e9,bid_confirmed_at:'2026-09-01'},{},()=>true),false);
});

test('verified independent advisory appears in partner performance exactly once without a source Deal',async()=>{
 const {R,items}=fixture(),event={...items[1].events[0],deal_id:null,contract_id:'independent',event_id:'independent-sign',effective_date:'2026-08-20',amount_delta:885000000};
 items.push({contract_id:'independent',deal_id:null,advisory_id:'advisory-independent',brand:'A',site:'검증된 현장',
  sales_owner_name:'original',contract_date:'2026-08-20',events:[event]});
 await R.ContractSalesData.refresh();
 R.DealWin._take({rows:[],advisory:[]});
 const partner=R.DealWin.partnerIn('2026-08-01','2026-09-01','original');
 assert.equal(partner.amount,885000000);assert.equal(partner.count,1);
 const lib=R.BriefB.lib,all=lib.ledger(),direct=lib.contractsIn(all,'2026-08-01','2026-09-01',null,'direct');
 assert.equal(direct.net,0);assert.equal(direct.net+partner.amount,R.ContractSalesData.summarize({year:2026,month:8}).netAmount);
 const list=[{advisory_id:'advisory-independent',attribution:{decision:'confirmed',source_deal_id:null,bid_amount:1,performance_owner:'changed'}}];
 assert.equal(R.SalesInsights.advisoryPerformance(list,{},d=>d.startsWith('2026-08'))[0].attribution.bid_amount,885000000);
 assert.equal(R.DealWin.partnerIn('2026-08-01','2026-09-01','changed').count,0);
});
test('advisory cards use the same ledger events and scope; fees, amounts and reassignment cannot double performance',async()=>{
 const {R}=fixture();await R.ContractSalesData.refresh();
 const list=[1,2].map(i=>({advisory_id:i,attribution:{decision:'confirmed',source_deal_id:'partner',bid_amount:1e8,performance_owner:'new owner',bid_confirmed_at:'2026-08-01'}}));
 const selected=R.SalesInsights.advisoryPerformance(list,{owner:'original'},d=>d>='2026-09-01'&&d<'2026-10-01');
 assert.equal(selected.length,1);assert.equal(selected[0].attribution.bid_amount,1e9);
 assert.equal(R.SalesInsights.advisoryPerformance(list,{owner:'new owner'},()=>true).length,0);
 assert.equal(R.SalesInsights.advisoryPerformance(list,{brand:'B'},()=>true).length,0);
 R.ME={id:'other'};assert.equal(R.SalesInsights.advisoryPerformance(list,{},()=>true),null);
});
test('source files preserve layout while eliminating award and completion fallback totals',()=>{
 assert.doesNotMatch(code('sales-insights.js'),/withAdvisory|Math\.abs\(b-amt\)|d\.contract_date\|\|root\.wonDate/);
 assert.doesNotMatch(code('contract-sales-ui.js'),/t\?' disabled'/);
 assert.equal(code('server/technical-advisory/lifecycle.mjs'),code('supabase/functions/technical-advisory-ingest/lifecycle.mjs'));
});
