'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','deal-detail-workspace.js'),'utf8');
function fixture(handled=true){
 const calls=[],root={CUR_DETAIL:{kind:'deal',item:{}},dealStage:()=> 'sent',outcomeOf:()=> '',PipelineStages:{group:()=> 'sent'},StageSpecs:{get:()=>({primaryAction:{key:'process'}})},briefNext:()=>({text:'후속 연락'}),DealDetailV3:{openFrom:key=>{calls.push(['current',key]);return handled;}},DetailActions:{open:key=>calls.push(['legacy',key])},openTransition:()=>calls.push(['legacy','stage'])};
 vm.runInNewContext(source,{window:root,document:{querySelector:()=>null}});return {root,calls};
}
test('shared workspace actions prefer current detail including primary/process aliases',()=>{
 for(const [action,target] of [['contact','activity'],['next','next'],['stage-edit','stage'],['primary','activity'],['process','activity']]){
  const {root,calls}=fixture();assert.equal(root.DealDetailWorkspace.run(action),true);assert.deepEqual(calls,[['current',target]],action);
 }
});
test('legacy fallback remains available only when current detail cannot handle the action',()=>{
 for(const [action,target] of [['contact','activity'],['next','next'],['stage-edit','stage']]){
  const {root,calls}=fixture(false);assert.equal(root.DealDetailWorkspace.run(action),true);assert.deepEqual(calls,[['current',target],['legacy',target]]);
 }
});
test('missing deal context does not launch any form',()=>{
 const {root,calls}=fixture();root.CUR_DETAIL=null;assert.equal(root.DealDetailWorkspace.run('next'),false);assert.deepEqual(calls,[]);
});
