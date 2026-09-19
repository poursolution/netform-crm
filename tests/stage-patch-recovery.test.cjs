const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('crm.html','utf8');
const context={};vm.createContext(context);vm.runInContext(html.slice(html.indexOf('function reconcileStagePatch('),html.indexOf('function applyOverrides(){')),context);
const reconcile=context.reconcileStagePatch;
test('rejected stage cannot survive a server refresh; retain draft and unrelated edits',()=>{
 const d={id:'d',version:3,stage_code:'first_contact',nextActionObj:null,activities:[]},p={code:'rapport',stage:'유대관계',nextActionObj:{id:'na-local'},stage_contexts:{rapport:{memo:'test'}},phone:'unchanged',activities:[{id:'local-1',type:'단계전환'},{id:'local-2',type:'메모'}]};
 assert.equal(reconcile(d,p,[{object_id:'d',status:'rejected'}]),true);
 assert.equal(p.code,undefined);assert.equal(p.nextActionObj,undefined);assert.equal(p.phone,'unchanged');assert.equal(p.recoveredTransitionDraft.code,'rapport');assert.equal(p.activities,undefined);assert.equal(p.recoveredActivityDrafts.length,2);assert.equal(d.stage_code,'first_contact');
});
test('pending/uncertain writes and newer ACKs remain protected from stale reads',()=>{
 for(const q of [{status:'pending'},{status:'sending'},{status:'uncertain'},{status:'done',ack:{version:4}}]){const p={code:'rapport'};assert.equal(reconcile({id:'d',version:3,stage_code:'first_contact'},p,[{object_id:'d',...q}]),false);assert.equal(p.code,'rapport');}
 assert.equal(reconcile({id:'d',stage_code:'first_contact'},{code:'rapport'},[]),false);
 assert.equal(reconcile({id:'d',version:3,stage_code:'rapport'},{phone:'unchanged'},[]),false);
});
test('same-stage refresh displays the atomic Next and complete server activity history',()=>{
 const d={id:'d',version:6,stage_code:'rapport',nextActionObj:{id:'new',text:'verified'},activities:[{id:'server-new',type:'메모'},{id:'server-old',type:'문자'}]};
 const p={code:'rapport',nextActionObj:{id:'old',text:'outdated'},nextAction:'2026-09-27',activities:[{id:'local-1',type:'메모'}],phone:'unchanged'};
 assert.equal(reconcile(d,p,[{object_id:'d',status:'done',ack:{version:6}}]),true);
 Object.assign(d,p);assert.equal(d.nextActionObj.id,'new');assert.equal(d.activities.length,2);assert.equal(d.activities[0].id,'server-new');assert.equal(d.phone,'unchanged');assert.equal(p.recoveredNextActionDraft.id,'old');
 const completed={id:'d',version:7,stage_code:'rapport',nextActionObj:null,activities:[]},old={nextActionObj:{id:'new'},nextAction:'2026-09-21'};
 assert.equal(reconcile(completed,old,[]),true);Object.assign(completed,old);assert.equal(completed.nextActionObj,null);assert.equal(old.nextAction,undefined);
});
