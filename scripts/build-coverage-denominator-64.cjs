'use strict';
// Local-only accounting compiler. It does not change UI, SQL, or remote state.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),source=path.join(root,'docs','operational-cutover-20260906','coverage-matrix.csv'),output=path.join(root,'docs','operational-cutover-20260906','coverage-denominator-64.json');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function parseCsv(text){const table=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;continue;}if(ch==='"'){quoted=true;continue;}if(ch===','){row.push(field);field='';continue;}if(ch==='\n'){row.push(field.replace(/\r$/,''));table.push(row);row=[];field='';continue;}field+=ch;}if(field||row.length){row.push(field);table.push(row);}const header=table.shift().map(x=>x.replace(/^\ufeff/,''));return table.filter(x=>x.some(Boolean)).map(x=>Object.fromEntries(header.map((key,i)=>[key,x[i]??''])));}
const groups=[
 ['R01_AUTH_LIFECYCLE',['C02L','C02S'],'로그인·세션 복원·로그아웃'],
 ['R02_DIRECT_ASSIGN',['I01','I02'],'PC/mobile 본사 개인 배정·재배정'],
 ['R03_INQUIRY_RESPONSE',['I03P','I03N','I03M'],'모바일 문의 응대결과'],
 ['R04_INQUIRY_PROMOTION',['I09','I10'],'문의→Pipeline 전환·계보'],
 ['R05_INQUIRY_TRASH',['I11','I12'],'문의 휴지통·복원'],
 ['R06_PIPELINE_CLOSE',['P04','P04W','P16'],'Pipeline 종료·수주·확장 Pool 생성'],
 ['R07_ACTIVITY_CONTACT',['P08','P08C'],'활동 기록·의미있는 접촉'],
 ['R08_NEXT_LIFECYCLE',['P09','P09M','P09X','P10','P11'],'Deal Next 생성·결과·연기·완료'],
 ['R09_CUSTOMER_TIMELINE',['A04D','A04S'],'Deal/Site 고객자산 Timeline 조회'],
 ['R10_PHONE_ATTEMPT',['M01O','M01A'],'전화 앱 열기·시도 Activity'],
 ['R11_PC_DASHBOARD_SOURCE',['O07S','O07D'],'PC Dashboard 원천행·KPI drilldown'],
 ['R12_MOBILE_OPERATIONS',['O08M','O08T','O08C','O08S','O08A'],'모바일 내 건·Today·관리·검색·질의'],
];
const passStatuses=new Set(['STAGING_COMPAT_PASS_FROZEN','STAGING_JWT_E2E_PASS_20260906','BROWSER_STAGING_PASS_NOT_DEPLOYED','LOCAL_ONLY_CONFIRMED']),outStatuses=new Set(['EXTERNAL_APP','REACHABLE_MOCK_BLOCKER','OUT_OF_SCOPE_31_OP_BOUNDARY']);
const reasonByStatus={
 BROWSER_STAGING_PASS_NOT_DEPLOYED:'STAGING_DEPLOYMENT_E2E_PENDING',DERIVED_SAFE_LOCAL_CANDIDATE:'STAGING_E2E_PENDING',READ_LOCAL_CANDIDATE:'STAGING_E2E_PENDING',DIRECT_SUPABASE_UNVERIFIED:'DIRECT_SUPABASE_PATH_NOT_E2E_VERIFIED',LOCAL_ONLY_MIGRATION_BLOCKER:'REACHABLE_LOCAL_ONLY_NOT_IN_31_OP',NEEDS_VERIFICATION_BLOCKED:'BUSINESS_RULE_OR_UUID_SCOPE_UNRESOLVED',NOT_CONNECTED:'REACHABLE_WRITE_NOT_CONNECTED',READ_CONTRACT_MISSING:'READ_PROJECTION_OR_SCOPE_INCOMPLETE',EXTERNAL_N8N_RETAINED_E2E_PENDING:'APPROVED_N8N_EXTERNAL_E2E_PENDING',EXTERNAL_APP:'EXTERNAL_APP_BOUNDARY',REACHABLE_MOCK_BLOCKER:'VISIBLE_MOCK_NOT_OPERATIONAL',OUT_OF_SCOPE_31_OP_BOUNDARY:'USER_FROZEN_31_OP_CUTOVER_BOUNDARY',STAGING_COMPAT_PASS_FROZEN:'STAGING_COMPAT_PASS',STAGING_JWT_E2E_PASS_20260906:'STAGING_JWT_E2E_PASS',LOCAL_ONLY_CONFIRMED:'LOCAL_BROWSER_BEHAVIOR_CONFIRMED'};
function build(){
 const raw=fs.readFileSync(source,'utf8'),rows=parseCsv(raw),byId=new Map(rows.map(x=>[x.id,x])),grouped=new Set(groups.flatMap(x=>x[1])),actions=[];
 for(const [id,members,name] of groups)actions.push({id,name,members});
 for(const row of rows)if(!grouped.has(row.id))actions.push({id:row.id,name:row.action,members:[row.id]});
 for(const action of actions){const members=action.members.map(id=>{const row=byId.get(id);if(!row)throw Error(`missing ${id}`);return row;}),statuses=[...new Set(members.map(x=>x.adapter_status))];action.domains=[...new Set(members.map(x=>x.domain))];action.surfaces=[...new Set(members.map(x=>x.surface))];action.operations=[...new Set(members.flatMap(x=>x.operations.split(';').map(y=>y.trim()).filter(Boolean)))];action.evidence_rows=action.members.length;action.source_statuses=statuses;action.out_of_scope_members=members.filter(x=>outStatuses.has(x.adapter_status)).map(x=>x.id);if(statuses.every(x=>passStatuses.has(x))||(statuses.some(x=>passStatuses.has(x))&&statuses.every(x=>passStatuses.has(x)||outStatuses.has(x)))){action.verdict='PASS';action.block_reason=null;action.operational_required=true;}else if(statuses.every(x=>outStatuses.has(x))){action.verdict='OUT_OF_SCOPE';action.block_reason=[...new Set(statuses.map(x=>reasonByStatus[x]))].join(';');action.operational_required=false;}else{action.verdict='BLOCKED';action.block_reason=[...new Set(statuses.filter(x=>!passStatuses.has(x)&&!outStatuses.has(x)).map(x=>reasonByStatus[x]||x))].join(';');action.operational_required=true;}}
 if(rows.length!==84||actions.length!==64||new Set(actions.flatMap(x=>x.members)).size!==84)throw Error(`denominator mismatch rows=${rows.length} actions=${actions.length}`);
 const counts=Object.fromEntries(['PASS','BLOCKED','OUT_OF_SCOPE'].map(verdict=>[verdict,actions.filter(x=>x.verdict===verdict).length]));
 const inScope=counts.PASS+counts.BLOCKED;
 const result={project_ref:'rprechiaglyjaydkmxsu',status:counts.BLOCKED===0?'FINAL_DENOMINATOR_CLASSIFIED_GO_SCOPE_COMPLETE':'FINAL_DENOMINATOR_CLASSIFIED_PARTIAL_STAGING_PASS',denominator:'64_LOGICAL_REACHABLE_ACTIONS',evidence_rows:84,folded_duplicate_or_child_rows:20,logical_actions:64,counts,completion_percent:Number((counts.PASS/64*100).toFixed(1)),in_scope_actions:inScope,scope_completion_percent:Number((counts.PASS/inScope*100).toFixed(1)),rule:'Only PASS counts as complete. OUT_OF_SCOPE is excluded only by the user-frozen 31-op cutover boundary and is never counted as PASS.',coverage_matrix_sha256:sha(raw),groups:groups.map(([id,members,name])=>({id,name,members,reduction:members.length-1})),actions,staging_ddl_dml_performed:false,production_accessed:false,n8n_accessed:false};
 fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');return result;
}
if(require.main===module){const result=build();console.log(JSON.stringify({status:result.status,actions:result.logical_actions,counts:result.counts,completion_percent:result.completion_percent},null,2));}
module.exports={parseCsv,groups,build};
