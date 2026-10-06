'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../technical-advisory-ui.js'),'utf8');
function setup(rpc){
 const events={},window={SB:rpc?{rpc}:null,addEventListener:(n,fn)=>{events[n]=fn;}};
 const context={window,document:{querySelector:()=>null},URL};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../list-pager.js'),'utf8'),context);
 vm.runInNewContext(source,context);
 return {ui:window.TechnicalAdvisoryUI.projects,events,window};
}
const plain=x=>JSON.parse(JSON.stringify(x));
test('existing SB client connects lazily and reads only one cursor page with no Deal filter',async()=>{
 const calls=[],items=[{source_project_id:'test-1',source_contract_document_type:null,source_consulting_contract_amount:null}];
 const {ui}=setup(async(name,args)=>{calls.push({name,args});return {data:{ok:true,items,next_cursor:null}};});
 assert.equal(ui._state.loader,ui.read);assert.equal(calls.length,0);
 const result=await ui.read({after:'test-0'});
 assert.deepEqual(plain(calls),[{name:'crm_advisory_project_read_v1',args:{p_after:'test-0',p_deal_id:null}}]);
 assert.deepEqual(plain(result),{items,next_cursor:null});
 assert.equal(Object.hasOwn(result.items[0],'has_contract_document'),false);
 await ui.reload();assert.equal(ui._state.rows.length,1);
 assert.doesNotMatch(ui.html(),/계약 문서 있음|계약 문서 없음/);
});
test('empty, denied, and failed results stay distinct',async()=>{
 const {ui,window}=setup(async()=>({data:{ok:true,items:[],next_cursor:null}}));
 await ui.reload();assert.equal(ui._state.state,'ready');assert.match(ui.html(),/조회 권한이 있는 기술자문 프로젝트가 없습니다/);
 window.SB.rpc=async()=>({error:{code:'42501'}});await ui.reload();assert.equal(ui._state.state,'denied');
 window.SB.rpc=async()=>({error:{code:'503'}});await ui.reload();assert.equal(ui._state.state,'failed');assert.match(ui.html(),/다시 조회/);
});
test('invalid ACK, oversized page and invalid/repeated cursor are failures, never empty success',async()=>{
 const {ui,window}=setup(async()=>({data:null}));
 for(const data of [null,{ok:false,items:[],next_cursor:null},{ok:true,items:[]},{ok:true,items:[],next_cursor:'more'},{ok:true,items:Array(21).fill({source_project_id:'x'}),next_cursor:null},{ok:true,items:[{}],next_cursor:'same'}]){
  window.SB.rpc=async()=>({data});await assert.rejects(()=>ui.read({after:'same'}),/READ_FAILED/);
 }
});
test('account invalidation clears cached results and ignores late responses',async()=>{
 let finish;const {ui,events,window}=setup(()=>new Promise(r=>{finish=r;}));
 const pending=ui.reload();assert.equal(ui._state.busy,true);
 events['phase1:identity-cleared']();assert.equal(ui._state.busy,false);assert.equal(ui._state.rows.length,0);
 window.SB.rpc=async()=>({data:{ok:true,items:[{source_project_id:'new-account'}],next_cursor:null}});
 await ui.reload();finish({data:{ok:true,items:[{source_project_id:'old-account'}],next_cursor:null}});await pending;
 assert.deepEqual(plain(ui._state.rows),[{source_project_id:'new-account'}]);
 events['phase1:identity-cleared']();assert.equal(ui._state.rows.length,0);assert.equal(ui._state.cursor,null);assert.equal(ui._state.state,'idle');
});
test('late failure after identity switch cannot replace new results',async()=>{
 let fail;const {ui,events,window}=setup(()=>new Promise((_,r)=>{fail=r;}));const pending=ui.reload();
 events['phase1:identity-cleared']();window.SB.rpc=async()=>({data:{ok:true,items:[],next_cursor:null}});await ui.reload();
 fail({code:'42501'});await pending;assert.equal(ui._state.state,'ready');assert.equal(ui._state.busy,false);
});
test('transport allowlist and existing error naming include the deployed read RPC',()=>{
 assert.match(fs.readFileSync(path.join(__dirname,'../pc-manager-transport.js'),'utf8'),/'crm_advisory_project_read_v1'/);
 assert.match(fs.readFileSync(path.join(__dirname,'../pc-error-state.js'),'utf8'),/crm_advisory_project_read_v1:'기술자문 프로젝트 기본 정보 읽기'/);
});
