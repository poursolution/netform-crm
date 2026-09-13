'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../crm.html'),'utf8');
test('detail decorators have one explicit sequence, without captured render chains',()=>{
 const source=html.match(/function renderDetailAddons\(\)\{[\s\S]*?\n\}/)?.[0];assert.ok(source);
 const calls=[],context={window:{DetailWorkspace:true},DetailWorkspace:{decorate:()=>calls.push('workspace')}};
 for(const [fn,label] of [['decorateExecutionDetail','execution'],['decorateFieldDetail','field'],['decorateRelationshipEngineDetail','engine'],['relationshipManagementDecorateDetail','relationship']])context[fn]=()=>calls.push(label);
 vm.runInNewContext(source+';renderDetailAddons();',context);
 assert.deepEqual(calls,['execution','field','engine','relationship','workspace']);
 assert.doesNotMatch(html,/_execRenderDetail|_fieldRenderDetail|_relV8RenderDetail/);
 const relationship=fs.readFileSync(path.join(__dirname,'../relationship-management.js'),'utf8');
 assert.doesNotMatch(relationship,/root\.renderDetail\s*=/);
 assert.match(relationship,/root\.relationshipManagementDecorateDetail=decorateDetail/);
});
test('optional page modules are not required to render core detail',()=>{
 const source=html.match(/function renderDetailAddons\(\)\{[\s\S]*?\n\}/)[0],calls=[];
 vm.runInNewContext(source+';renderDetailAddons();',{window:{},decorateExecutionDetail:()=>calls.push(1),decorateFieldDetail:()=>calls.push(2),decorateRelationshipEngineDetail:()=>calls.push(3)});
 assert.deepEqual(calls,[1,2,3]);
});
