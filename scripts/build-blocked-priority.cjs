'use strict';

// Derives the second-wave cutover backlog from the single 64-action denominator.
// Local-only: this script never contacts Staging, Production, n8n, or a provider.
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const dir=path.join(root,'docs','operational-cutover-20260906');
const source=path.join(dir,'coverage-denominator-64.json');
const target=path.join(dir,'blocked-priority-20260906.json');
const denominator=JSON.parse(fs.readFileSync(source,'utf8'));
const blocked=denominator.actions.filter(action=>action.verdict==='BLOCKED');

if(denominator.logical_actions!==64||blocked.length!==denominator.counts.BLOCKED)throw Error('64-action denominator drift');
if(blocked.some(action=>action.operational_required!==true))throw Error('blocked operational requirement drift');

function lane(action){
 if(action.id==='R01_AUTH_LIFECYCLE')return 'CORE_UI_CUTOVER_BLOCKER';
 if(action.block_reason==='EXTERNAL_APP_BOUNDARY'||action.id==='M06')return 'EXTERNAL_INTEGRATION';
 return 'SECOND_WAVE_OPERATIONAL_REQUIRED';
}

const items=blocked.map(action=>({
 id:action.id,
 name:action.name,
 lane:lane(action),
 block_reason:action.block_reason,
 operational_required:true,
 source_statuses:action.source_statuses
}));
const lane_counts=items.reduce((counts,item)=>(counts[item.lane]=(counts[item.lane]||0)+1,counts),{});
const reason_counts=items.reduce((counts,item)=>(counts[item.block_reason]=(counts[item.block_reason]||0)+1,counts),{});
if(Object.values(lane_counts).reduce((sum,count)=>sum+count,0)!==blocked.length)throw Error('blocked lane classification drift');

const report={
 project_ref:'rprechiaglyjaydkmxsu',
 status:'NO_GO_FULL_64_STAGING_31_PASS_REMAINING_CONNECTIONS',
 denominator:'64_LOGICAL_REACHABLE_ACTIONS',
 pass:denominator.counts.PASS,
 blocked:denominator.counts.BLOCKED,
 out_of_scope:denominator.counts.OUT_OF_SCOPE,
 rule:'Blocked actions are existing Golden behavior awaiting backend/read/UUID/E2E or approved external integration evidence; they are not new feature builds.',
 lane_counts,
 reason_counts,
 estimates:{
  core_ui_cutover_rehearsal:'1-2 hours for final PC/mobile artifact and role rehearsal if no new drift appears',
  remaining_existing_behavior:'re-estimate after connection/read/UUID/E2E categorization; do not price as new feature development',
  external_integration:'existing n8n boundary; test recipient/provider evidence and CRM read-back still required'
 },
 items,
 production_accessed:false,
 n8n_accessed:false
};
fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,lane_counts,reason_counts}));
