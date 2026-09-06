'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),build=require('./build.cjs');
const deal='f6090500-0006-4000-8000-000000000001';
function load(text,name){const m=new Module(name);m._compile(text,name+'.js');return m.exports;}
function base(extra={}){
 const queued=[],listeners={},adapter=load(build.adapter(),'stage-check-adapter');
 const root={
  OperationalAdapter:adapter,TOKEN:'jwt',ME:{id:'u'},WRITE_Q:[],console,B:{deals:[]},
  Phase1:{
   read:async()=>({data:{deals:[],inquiries:[]}}),
   queue:{list:()=>[],enqueue:(op,id,version,payload)=>{const c=adapter.normalize(op,id,version,payload),q={...c,payload:c.payload,request_id:'f6090600-0070-4000-8000-000000000099'};queued.push(q);return q;},flush:async()=>{}}
  },
  addEventListener:(n,fn)=>{listeners[n]=fn},...extra
 };
 return {root,queued,ui:load(build.overlay(),'stage-check-overlay')};
}
test('PC manual guide handler reaches one canonical stage_check command',()=>{const d={id:deal,stage_code:'first_contact'};const x=base({CUR_DETAIL:{kind:'deal',item:d},toggleExecGuide(){this.pushWrite('stage_check',{opportunity_id:deal,stage_code:'first_contact',item_index:1,item_text:'공사 예정시기 확인',checked:true});}});const state=x.ui.install(x.root);state.versions.set(deal,4);x.root.toggleExecGuide(1);assert.equal(x.queued.length,1);assert.deepEqual(x.queued[0].payload,{stage_code:'first_contact',item_index:1,checked:true});});
test('mobile manual guide handler uses the identical contract',()=>{const x=base({toggleStageGuideM(){this.pushWrite('stage_check',{opportunity_id:deal,stage_code:'bidding',item_index:2,item_text:'예상 낙찰가 확인',checked:true});}});const state=x.ui.install(x.root);state.versions.set(deal,7);x.root.toggleStageGuideM(2);assert.equal(x.queued.length,1);assert.deepEqual(x.queued[0].payload,{stage_code:'bidding',item_index:2,checked:true});});
test('stage_check outside the two named handlers and automatic items fail closed',()=>{const x=base();const state=x.ui.install(x.root);state.versions.set(deal,1);assert.throws(()=>x.root.pushWrite('stage_check',{opportunity_id:deal,stage_code:'first_contact',item_index:1,item_text:'공사 예정시기 확인',checked:true}),/STAGE_CHECK_INTENT_NOT_CONNECTED/);const y=base({toggleStageGuideM(){this.pushWrite('stage_check',{opportunity_id:deal,stage_code:'first_contact',item_index:0,item_text:'관리주체·연락처 확인',checked:true});}});y.ui.install(y.root).versions.set(deal,1);assert.throws(()=>y.root.toggleStageGuideM(0),/INVALID_STAGE_CHECK/);});
test('mobile live hydration preserves server checklist while automatic state remains derived',async()=>{let normalized;const x=base({TOKEN:'jwt',Phase1:{read:async()=>({data:{deals:[{id:deal,stage_code:'first_contact',version:3,stage_checklist:{first_contact:{1:true}}}],inquiries:[]}}),queue:{list:()=>[],enqueue:()=>{},flush:async()=>{}}},normalizeDeal:d=>(normalized=d),rebuildAdmin(){},render(){},CUR:'mine'});x.ui.install(x.root);await x.root.loadLive();assert.deepEqual(normalized.stage_checklist,{first_contact:{1:true}});assert.deepEqual(normalized.stageChecklist,{first_contact:{1:true}});});
test('generated adapter validates stage ACK and manifest stays local only',()=>{const text=build.adapter();assert.match(text,/command\.operation==='stage_check'/);const manifest=build.build();assert.equal(manifest.staging_ddl_dml_performed,false);assert.equal(manifest.operation,'stage_check');});
