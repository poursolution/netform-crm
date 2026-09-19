const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('crm.html','utf8');
const context={};vm.createContext(context);vm.runInContext(html.slice(html.indexOf('function reconcileStagePatch('),html.indexOf('function applyOverrides(){')),context);
const reconcile=context.reconcileStagePatch;
test('rejected stage cannot survive a server refresh; retain draft and unrelated edits',()=>{
 const d={id:'d',version:3,stage_code:'first_contact'},p={code:'rapport',stage:'유대관계',nextActionObj:{id:'na-local'},stage_contexts:{rapport:{memo:'test'}},phone:'unchanged',activities:[{id:'local-1',type:'단계전환'},{id:'local-2',type:'메모'}]};
 assert.equal(reconcile(d,p,[{object_id:'d',status:'rejected'}]),true);
 assert.equal(p.code,undefined);assert.equal(p.nextActionObj,undefined);assert.equal(p.phone,'unchanged');assert.equal(p.recoveredTransitionDraft.code,'rapport');assert.equal(p.activities.length,1);assert.equal(p.activities[0].type,'메모');assert.equal(d.stage_code,'first_contact');
});
test('pending/uncertain writes and newer ACKs remain protected from stale reads',()=>{
 for(const q of [{status:'pending'},{status:'sending'},{status:'uncertain'},{status:'done',ack:{version:4}}]){const p={code:'rapport'};assert.equal(reconcile({id:'d',version:3,stage_code:'first_contact'},p,[{object_id:'d',...q}]),false);assert.equal(p.code,'rapport');}
 assert.equal(reconcile({id:'d',stage_code:'first_contact'},{code:'rapport'},[]),false);
 assert.equal(reconcile({id:'d',version:3,stage_code:'rapport'},{code:'rapport'},[]),false);
});
