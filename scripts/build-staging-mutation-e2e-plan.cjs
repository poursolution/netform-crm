'use strict';

// Deterministic, local-only planner. It inventories the reachable frozen/local
// candidates and assigns every coverage row to a future Staging JWT scenario.
// It never connects to Supabase and never mutates a database.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const docs=path.join(root,'docs','operational-cutover-20260906');
const matrixFile=path.join(docs,'coverage-matrix.csv');
const fixtureFile=path.join(root,'sql','baseline','20260905','synthetic','fixture.json');
const bundleFile=path.join(root,'sql','operational-full-local-candidate','20260906','manifest.json');
const completedByGoRun=new Set(['I16','I17','I18','P02','A01','A02','A03','O01']);
const outputFile=path.join(docs,'staging-mutation-e2e-plan.json');
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function parseCsv(text){
 const table=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;continue;}
  if(ch==='"'){quoted=true;continue;}
  if(ch===','){row.push(field);field='';continue;}
  if(ch==='\n'){row.push(field.replace(/\r$/,''));table.push(row);row=[];field='';continue;}
  field+=ch;
 }
 if(field||row.length){row.push(field);table.push(row);}
 const header=table.shift().map(x=>x.replace(/^\ufeff/,''));
 return table.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]??''])));
}

function build(){
const rows=parseCsv(fs.readFileSync(matrixFile,'utf8'));
const fixture=JSON.parse(fs.readFileSync(fixtureFile,'utf8'));
const bundle=JSON.parse(fs.readFileSync(bundleFile,'utf8'));
const includedStatuses=new Set(['STAGING_COMPAT_PASS_FROZEN','STAGING_JWT_E2E_PASS_20260906','DERIVED_SAFE_LOCAL_CANDIDATE','READ_LOCAL_CANDIDATE']);
const includedRows=rows.filter(row=>includedStatuses.has(row.adapter_status)&&!completedByGoRun.has(row.id));
const byId=new Map(rows.map(row=>[row.id,row]));

const scenario=(id,coverage_ids,disposition,fixture_mode,actors,operations,checks,cleanup)=>({
 id,
 domain:[...new Set(coverage_ids.map(coverageId=>byId.get(coverageId)?.domain))].filter(Boolean).join(' + '),
 coverage_ids,
 disposition,
 fixture_mode,
 actors,
 operations,
 checks,
 cleanup,
 remote_status:'READY_NOT_RUN'
});

const scenarios=[
 scenario('cross-cutting-receipt-replay',['C04'],'CROSS_CUTTING_ASSERTION','NO_EXTRA_FIXTURE',['INTERNAL_REP','ADMIN'],bundle.operations,
  ['same request_id and payload returns the same ACK','same request_id with different payload returns 409','every mutation scenario records exact receipt count one'],
  'No state cleanup; receipt evidence is append-only and is counted by run token.'),
 scenario('frozen-direct-assign-pc-mobile',['I01','I02'],'FROZEN_REGRESSION_BUSINESS_RESTORE','CANONICAL_SNAPSHOT',['ADMIN','INTERNAL_REP','OTHER_REP'],['inquiry_assign'],
  ['PC and mobile payloads converge on target CRM UUID','first assignment and reason-required reassignment rules remain frozen','unauthorized assignment is rejected'],
  'Restore assignee and status through the public command; retain append-only receipt/history/audit evidence.'),
 scenario('mobile-inquiry-response-outcomes',['I03P','I03N','I03M'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_INQUIRY_REQUIRED',['INTERNAL_REP','CONSULT','OTHER_REP'],['inquiry_assign'],
  ['three response intents set only their confirmed status/date/timestamp effects','first response is write-once and last response is server time','other rep is rejected'],
  'Use disposable inquiries because first_response_at and audit/history are not business-reversible.'),
 scenario('pc-inquiry-progress',['I04'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_INQUIRY_REQUIRED',['INTERNAL_REP','CONSULT','OTHER_REP','ADMIN'],['inquiry_status'],
  ['steps 0 through 5 preserve confirmed status transitions','replacement Next Action and activity/history counts are exact','stale from_status is rejected'],
  'Dispose the isolated inquiry graph after private evidence capture; never rewind timestamps on canonical rows.'),
 scenario('frozen-inquiry-unassign',['I05'],'FROZEN_REGRESSION_BUSINESS_RESTORE','CANONICAL_SNAPSHOT',['ADMIN','INTERNAL_REP'],['inquiry_unassign','inquiry_assign'],
  ['unassign clears assignment fields and applies only the frozen status rule','non-admin is rejected','history and audit actor UUIDs are server-derived'],
  'Restore the canonical inquiry with direct_assign; retain append-only evidence.'),
 scenario('inquiry-hold',['I06'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_INQUIRY_REQUIRED',['INTERNAL_REP','CONSULT','ADMIN','OTHER_REP'],['inquiry_status'],
  ['hold requires the confirmed reason and allowed source status','arbitrary status and release meanings remain blocked','read-back shows the held projection'],
  'Use an isolated inquiry; hold/audit evidence remains append-only.'),
 scenario('inquiry-next-complete-check',['I07'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_INQUIRY_REQUIRED',['INTERNAL_REP','CONSULT','OTHER_REP'],['next_action','next_action_complete','stage_check'],
  ['Next replacement, server action UUID completion, and six checklist items work','Deal meanings for the same external operations do not regress','foreign actor is rejected'],
  'Use an isolated inquiry and cancel/complete remaining open actions before fixture teardown.'),
 scenario('inquiry-followup',['I08'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_INQUIRY_REQUIRED',['INTERNAL_REP','CONSULT','OTHER_REP'],['inquiry_followup'],
  ['server due date and inquiry next_action_date agree','stale and foreign actor requests fail','refresh returns the same value'],
  'Use an isolated inquiry because action and audit evidence is append-only.'),
 scenario('inquiry-pipeline-promote-lineage',['I09','I10'],'FORWARD_ONLY_DISPOSABLE_FIXTURE','DEDICATED_INQUIRY_AND_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['transition','opportunity_create','lineage_link'],
  ['existing Deal link and new Deal creation paths are both exercised','inquiry and Deal lineage agree after refresh','duplicate promotion and foreign scope fail'],
  'Provision distinct disposable rows for existing-link and create paths; preserve evidence until finalizer completes.'),
 scenario('inquiry-trash-restore',['I11','I12'],'REVERSIBLE_PAIRED_COMMAND','DEDICATED_INQUIRY_REQUIRED',['ADMIN','INTERNAL_REP'],['inquiry_trash','inquiry_restore'],
  ['trash hides the inquiry from normal scope','restore returns the prior UI-visible state','non-admin and stale transitions fail'],
  'Pair restore after trash; use an isolated inquiry so append-only archive/audit evidence does not contaminate canonical rows.'),
 scenario('inquiry-purge',['I13'],'IRREVERSIBLE_DISPOSABLE_FIXTURE','DEDICATED_PURGE_INQUIRY_REQUIRED',['ADMIN','ADMIN_MFA','INTERNAL_REP'],['inquiry_purge'],
  ['purge requires the confirmed admin/MFA gate','row is absent after refresh','non-MFA admin and rep are rejected'],
  'No rollback exists after runtime purge; create a single-purpose inquiry that is never shared with another scenario.'),
 scenario('inquiry-reclassify',['I14'],'REVERSIBLE_SNAPSHOT_RESTORE','DEDICATED_INQUIRY_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['inquiry_reclassify'],
  ['only the confirmed general-inquiry classification is accepted','server actor and history are exact','foreign scope fails'],
  'Restore UI-visible classification from the pre-run snapshot using approved fixture cleanup after evidence capture.'),
 scenario('technical-inquiry-transfer',['I15'],'FORWARD_ONLY_DISPOSABLE_FIXTURE','DEDICATED_INQUIRY_AND_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['opportunity_create'],
  ['one Deal is created and child inquiry status effect is atomic','unassigned UUID truth is preserved','duplicate transfer and foreign scope fail'],
  'Use a single-purpose technical inquiry and created Deal; do not reuse canonical rows.'),
 scenario('frozen-inquiry-read-refresh',['I19'],'READ_ONLY_ROLE_MATRIX','CANONICAL_READ_ONLY',['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN'],[],
  ['inquiry display, search, assignment history, and pagination are role-scoped','private relations remain unreachable through PostgREST'],
  'No mutation.'),
 scenario('pipeline-opportunity-create',['P01'],'FORWARD_ONLY_DISPOSABLE_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['opportunity_create'],
  ['PC create payload yields one Deal with server owner/version','refresh finds the same Deal','replay is idempotent and foreign actor fails'],
  'Use a dedicated create seed and retain the created Deal through private evidence capture.'),
 scenario('pipeline-stage-transition',['P03'],'FORWARD_ONLY_DISPOSABLE_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['transition'],
  ['allowed stage progression and date effects are exact','stale version and illegal edge return 409','foreign owner fails'],
  'Use an isolated Deal because stage transitions are forward-only business events.'),
 scenario('pipeline-close-nonwon',['P04'],'FORWARD_ONLY_DISPOSABLE_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['close'],
  ['lost, bad-fit, and unreachable variants preserve their distinct fields','closed state survives refresh','invalid reason, stale version, and foreign owner fail'],
  'Use one disposable Deal per close variant; closed rows are not reopened for cleanup.'),
 scenario('pipeline-close-won-expansion',['P04W','P16'],'IRREVERSIBLE_DISPOSABLE_FIXTURE','DEDICATED_COMPLETION_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['close'],
  ['completion to won creates exactly one expansion pool record','absorbed activity and pool effects are atomic','replay creates no duplicate and foreign owner fails'],
  'Runtime won is outside rollback safety; use a single-purpose completion-stage Deal and retain it through final evidence.'),
 scenario('pipeline-expected-amount',['P05E'],'REVERSIBLE_BUSINESS_RESTORE','CANONICAL_SNAPSHOT',['INTERNAL_REP','ADMIN','OTHER_REP'],['amount'],
  ['amount save and confirmed clear semantics refresh correctly','stale version and foreign owner fail','audit and receipt counts are exact'],
  'Restore amount and unknown reason through the public command; retain append-only evidence.'),
 scenario('frozen-opportunity-work',['P06'],'FROZEN_REGRESSION_BUSINESS_RESTORE','CANONICAL_SNAPSHOT',['INTERNAL_REP','OTHER_REP'],['opportunity_work_set'],
  ['PC and mobile payloads preserve primary_work, work_items, and work_summary','refresh, replay, conflict, and stale checks remain frozen'],
  'Restore the three UI-visible work fields through the public command.'),
 scenario('frozen-service-change',['P07'],'FROZEN_REGRESSION_BUSINESS_RESTORE','CANONICAL_SNAPSHOT',['INTERNAL_REP','OTHER_REP'],['service_change'],
  ['service fields, version, business history, and activity retain the frozen contract','replay, conflict, stale, and foreign-owner checks remain frozen'],
  'Restore UI-visible service fields through the public command; retain append-only history.'),
 scenario('pipeline-activity-and-contact',['P08','P08C','M01A'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['activity'],
  ['independent activity, meaningful contact, and pre-call attempt remain distinct intents','server actor/time and contact timestamp are exact','foreign owner fails'],
  'Use an isolated Deal because activities are append-only.'),
 scenario('deal-next-action-lifecycle',['P09','P09X','P10','P11'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['next_action','next_action_complete'],
  ['replace, postpone, complete, and current-action complete use server action UUIDs','postpone count and refresh are exact','temporary IDs, stale state, and foreign owner fail'],
  'Use an isolated Deal; complete/cancel open actions before fixture teardown.'),
 scenario('mobile-today-outcomes',['P09M','O08T'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_AND_INQUIRY_SET_REQUIRED',['INTERNAL_REP','CONSULT','OTHER_REP'],['next_action_complete','inquiry_assign','inquiry_followup'],
  ['three Deal outcomes and supervisor inquiry response/followup actions match mobile handlers','absorbed activity/Next effects occur once','cross-owner actions fail'],
  'Use one isolated Deal or Inquiry per outcome so timestamp and counter effects never need rewinding.'),
 scenario('pipeline-waiting-context',['P13'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['waiting_context','next_action'],
  ['waiting evidence and replacement Next Action commit together','refresh shows the same context/due date','stale version and foreign owner fail'],
  'Use an isolated waiting Deal; retain append-only history.'),
 scenario('pipeline-quote-version',['P14'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['quote_version'],
  ['one quote version is appended with server actor/time','replay creates no duplicate','stale version and foreign owner fail'],
  'Use an isolated Deal because quote versions are append-only.'),
 scenario('pipeline-stage-check',['P15'],'REVERSIBLE_PAIRED_COMMAND','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['stage_check'],
  ['toggle and read-back preserve the confirmed checklist key/index','stale version and foreign owner fail'],
  'Toggle back to the before value; retain audit/receipt evidence.'),
 scenario('customer-and-operational-reads',['C03','A04D','A04S','O07S','O07D','O07P','O07R','O07G','O08M','O08C','O08S','O08A'],'READ_ONLY_ROLE_MATRIX','CANONICAL_READ_ONLY',['INTERNAL_REP','OTHER_REP','CONSULT','GYEONGNAM','ADMIN'],[],
  ['direct-linked contact/work history and scoped Deal/inquiry/site/contact rows are complete','Golden role dashboard renders and the visible admin KPI drills into Pipeline','pagination has no duplicates or omissions','cross-role leakage and private relation access fail'],
  'No mutation.'),
 scenario('expansion-pool-update-note-context',['X01','X02'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_WON_DEAL_AND_POOL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['expansion_pool_update','expansion_note'],
  ['allowed status/date updates and note/context RPCs agree after refresh','quote dispatch and Pipeline conversion meanings stay blocked','stale pool version and foreign owner fail'],
  'Seed through the isolated close-won scenario; retain pool events and note evidence.'),
 scenario('attachment-lifecycle',['T01','T02'],'STORAGE_DISPOSABLE_OBJECT','DEDICATED_STORAGE_OBJECT_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['attachment_prepare','attachment_complete'],
  ['prepare returns a signed path for the private bucket','PUT then complete exposes one ready attachment','foreign owner, oversize/type mismatch, and duplicate completion fail'],
  'Delete the run-prefixed Storage object after metadata/evidence capture; never reuse a production-like filename.'),
 scenario('personalization',['T03'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','OTHER_REP'],['favorite_set','opportunity_touch'],
  ['favorite state and recent-touch ordering are actor-private','one actor cannot alter another actor state','replay is idempotent'],
  'Unset favorite where supported; isolate touch evidence by run token.'),
 scenario('message-log',['M02'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['message_log'],
  ['sent, failed, and cancelled attestations remain distinct and never claim provider delivery','server resolves the current contact/phone','stale version and foreign owner fail'],
  'Use an isolated Deal/contact because message logs are append-only.'),
 scenario('message-reminder',['M04'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['next_action'],
  ['staff reminder replaces current open Deal action and stores draft body','no provider delivery claim is emitted','foreign owner fails'],
  'Use an isolated Deal and complete/cancel the reminder after refresh evidence.'),
 scenario('relationship-cadence',['M05'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_REQUIRED',['INTERNAL_REP','ADMIN','OTHER_REP'],['relationship_hold','relationship_response'],
  ['hold creates no activity and response cancels only the linked open action','server cadence state refreshes identically','provider delivery inference and foreign owner fail'],
  'Use an isolated Deal/action graph; retain append-only cadence evidence.'),
 scenario('customer-support-request',['O02'],'APPEND_ONLY_DEDICATED_FIXTURE','DEDICATED_DEAL_OR_INQUIRY_REQUIRED',['ADMIN','INTERNAL_REP','OTHER_REP'],['customer_support_action'],
  ['all sixteen action keys create requested-only records','downstream completion is never inferred','non-admin and out-of-scope admin requests fail'],
  'Use isolated target rows because support requests are append-only.')
];

const assigned=scenarios.flatMap(item=>item.coverage_ids);
const duplicateIds=assigned.filter((id,index)=>assigned.indexOf(id)!==index);
const missingIds=includedRows.map(row=>row.id).filter(id=>!assigned.includes(id));
const unexpectedIds=assigned.filter(id=>!includedRows.some(row=>row.id===id));
if(duplicateIds.length||missingIds.length||unexpectedIds.length){
 throw new Error(`scenario coverage mismatch duplicate=${duplicateIds} missing=${missingIds} unexpected=${unexpectedIds}`);
}

const excludedRows=rows.filter(row=>!includedStatuses.has(row.adapter_status)||completedByGoRun.has(row.id));
const fixtureSummary={
 accounts:Object.fromEntries(fixture.accounts.map(account=>[account.kind,{user_id:account.user_id,auth_uid:account.auth_uid,source_role:account.source_role}])),
 canonical_counts:Object.fromEntries(Object.entries(fixture.rows).map(([name,value])=>[name,Array.isArray(value)?value.length:0])),
 canonical_ids:{
  inquiries:fixture.rows.inquiries.map(row=>row.id),
  deals:fixture.rows.deals.map(row=>row.id),
  next_actions:fixture.rows.next_actions.map(row=>row.id)
 }
};

const requiredFixtureModes=[...new Set(scenarios.map(item=>item.fixture_mode).filter(mode=>mode.includes('REQUIRED')))];
const plan={
 project_ref:'rprechiaglyjaydkmxsu',
 status:'MUTATION_MATRIX_COMPLETE_FIXTURE_EXTENSION_PENDING_READONLY_PREFLIGHT',
 generated_at:'2026-09-06T00:00:00.000Z',
 execution:'SERIAL_ONLY_AFTER_EXPLICIT_STAGING_APPROVAL_AND_APPLY',
 staging_ddl_dml_performed:false,
 staging_jwt_mutation_performed:false,
 production_accessed:false,
 n8n_accessed:false,
 sources:{
  coverage_matrix:'docs/operational-cutover-20260906/coverage-matrix.csv',
  coverage_matrix_sha256:sha256(matrixFile),
  synthetic_fixture:'sql/baseline/20260905/synthetic/fixture.json',
  synthetic_fixture_sha256:sha256(fixtureFile),
  candidate_manifest:'sql/operational-full-local-candidate/20260906/manifest.json',
  candidate_manifest_sha256:sha256(bundleFile),
  candidate_apply_sha256:bundle.files_sha256['staging-apply.sql']
 },
 scope:{
  included_adapter_statuses:[...includedStatuses],
  included_coverage_rows:includedRows.length,
  scenario_count:scenarios.length,
  candidate_operations:bundle.operations,
  excluded_coverage_rows:excludedRows.length,
  excluded_by_status:Object.fromEntries([...new Set(excludedRows.map(row=>row.adapter_status))].sort().map(status=>[status,excludedRows.filter(row=>row.adapter_status===status).map(row=>row.id)]))
 },
 standard_gates:{
  exact_origin_and_ref:true,
  publishable_key_and_real_user_jwt_only:true,
  server_auth_uuid_to_crm_uuid:true,
  positive_and_negative_role_scope:true,
  refresh_read_after_write:true,
  request_id_replay_no_duplicate:true,
  request_id_payload_reuse_409:true,
  stale_version_or_state_409_where_applicable:true,
  ack_shape_preserved:true,
  private_receipt_audit_history_exact_counts:true,
  production_requests:0,
  n8n_requests:0,
  skip_is_not_pass:true
 },
 fixture:fixtureSummary,
 fixture_gap:{
  present:true,
  reason:'The five canonical Inquiry/Deal rows are shared regression assets and cannot safely absorb append-only, forward-only, purge, won, or Storage scenarios.',
  required_modes:requiredFixtureModes,
  resolution_gate:'After the approved read-only catalog preflight, create a separately reviewed synthetic setup/cleanup bundle with exact FK-aware disposable rows. Do not improvise runtime cleanup.'
 },
 scenarios,
 coverage_index:Object.fromEntries(includedRows.map(row=>[row.id,{adapter_status:row.adapter_status,scenario_id:scenarios.find(item=>item.coverage_ids.includes(row.id)).id,domain:row.domain,action:row.action,operations:row.operations}])),
 excluded_index:Object.fromEntries(excludedRows.map(row=>[row.id,{adapter_status:row.adapter_status,reason:completedByGoRun.has(row.id)?'Proven by the separate 20260907 final-blocker Staging JWT run.':'Outside the historical 31-operation mutation plan.'}]))
};

fs.writeFileSync(outputFile,JSON.stringify(plan,null,2)+'\n');
return {plan,summary:{output:path.relative(root,outputFile).replaceAll('\\','/'),status:plan.status,coverage_rows:plan.scope.included_coverage_rows,scenarios:plan.scope.scenario_count,fixture_gap_modes:requiredFixtureModes.length}};
}

if(require.main===module)console.log(JSON.stringify(build().summary,null,2));
module.exports={build,parseCsv};
