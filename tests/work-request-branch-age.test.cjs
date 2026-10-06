const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(base,'work-request.js'),'utf8');
const html=fs.readFileSync(path.join(base,'crm.html'),'utf8');
const helpers=['inquiryAssignedAt','gnDaysSince'].map(name=>{
 const line=html.split(/\r?\n/).find(l=>l.startsWith('function '+name+'('));
 assert.ok(line,name+' exists');return line;
}).join('\n');
const now=Date.parse('2026-10-06T03:00:00Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
function item(at,days=200){return {key:'inq:example',rk:'first',days,brand:'POUR솔루션',i:{site:'검증 현장'},x:{type:'inq',owner:'조민준',item:{id:'example',assigned_at:at,received_at:'2026-01-01',owner_team:'gyeongnam'}}};}
function setup(i,options={}){
 const calls=[];
 const context={Date:Clock,console,setTimeout,document:{addEventListener(){},getElementById(){return null;}}};
 context.window=context;
 Object.assign(context,{
 G:{workReq:{list:options.list||[],loaded:true,at:now,card:{},closing:{},seen:{}}},
 ME:{name:'송보람'},OPS_RULES:{workRequestBranchAuto:options.auto===true},
 esc:String,escAttr:String,repN:v=>v,itemOwnerTeam:q=>q.owner_team,
 TodayV3:{current:()=>({team:true,mine:[i]})},
 OpsStore:{has:()=>true,rpc:(name,args)=>{calls.push({name,args});return Promise.resolve({});}}
 });
 vm.createContext(context);vm.runInContext(helpers+'\n'+source,context);
 return {api:context.WorkRequest,calls,context};
}
test('recent reassignment does not inherit inquiry age or trigger recall',()=>{
 const i=item('2026-10-05T09:05:00Z',18),{api}=setup(i);
 const q=api.reqFor(i);assert.equal(q.branchDays,1);assert.equal(q.recall,false);
 assert.doesNotMatch(q.why,/18일|회수 검토/);
});
test('recall uses assignment age even when last contact is recent',()=>{
 const i=item('2026-09-20',1),{api}=setup(i);const q=api.reqFor(i);
 assert.equal(q.branchDays,16);assert.equal(q.recall,true);assert.match(q.why,/16일/);
});
test('assignment aliases use the existing canonical reader',()=>{
 for(const data of [{assignedAt:'2026-10-05'},{detail:{assigned_at:'2026-10-05'}}]){
  const i=item('');Object.assign(i.x.item,data);const {api}=setup(i);
  assert.equal(api.reqFor(i).branchDays,1);
 }
});
test('missing or invalid assignment date never falls back to receipt age',()=>{
 for(const at of ['',null,'invalid']){
  const i=item(at),{api,calls}=setup(i,{auto:true});
  assert.equal(api.reqFor(i).branchDays,null);assert.equal(api.reqFor(i).recall,false);
  api.sideHtml();assert.equal(calls.length,0);
 }
});
test('automatic branch requests remain disabled by default',()=>{
 const i=item('2026-09-01'),{api,calls}=setup(i);api.sideHtml();assert.equal(calls.length,0);
});
test('automatic request threshold is seven days since assignment',()=>{
 for(const [at,expected] of [['2026-10-05',0],['2026-09-30',0],['2026-09-29',1]]){
  const i=item(at),{api,calls}=setup(i,{auto:true});api.sideHtml();
  assert.equal(calls.length,expected,at);
  if(expected){assert.match(calls[0].args.memo,/넘긴 지 7일/);assert.equal(calls[0].args.to_scope,'branch');}
  api.sideHtml();assert.equal(calls.length,expected,'same-day guard preserved');
 }
});
test('existing open request prevents duplicate automatic request',()=>{
 const i=item('2026-09-01'),{api,calls}=setup(i,{auto:true,list:[{target_type:'inquiry',target_id:'example',kind:'branch',status:'sent'}]});
 api.sideHtml();assert.equal(calls.length,0);
});
test('non-branch request keeps the current salesperson and request kind',()=>{
 const i=item('2026-09-01');i.x.item.owner_team='hq';const {api}=setup(i);const q=api.reqFor(i);
 assert.equal(q.kind,'first');assert.equal(q.to,'조민준');assert.equal(q.recall,false);
});
